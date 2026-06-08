import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { ENABLE_ZERO_U_PDU } from './featureFlags';

export interface PowerChainNode {
  device: PlacedDevice;
  loadW: number;
  downstreamW: number;
  totalW: number;
  children: PowerChainNode[];
  cable?: CableRoute;
}

export interface PowerChain {
  root: PowerChainNode;
}

export const isPowerSource = (d: PlacedDevice) =>
  d.category === 'ups' || d.category === 'pdu' || (ENABLE_ZERO_U_PDU && d.category === 'pdu-0u');

function getPduCapacityW(device: PlacedDevice): number | undefined {
  if (device.category === 'pdu') {
    const outlets = device.ports?.power ?? 8;
    return outlets <= 8 ? 3680 : outlets <= 12 ? 4600 : 7360;
  }
  if (ENABLE_ZERO_U_PDU && device.category === 'pdu-0u') {
    return 4600;
  }
  return undefined;
}

export function getUpsCapacityW(device: PlacedDevice): number | undefined {
  if (device.category !== 'ups') return undefined;
  const outlets = device.ports?.power ?? 4;
  if (outlets <= 4) return 600;
  if (outlets <= 6) return 900;
  if (outlets <= 8) return 1500;
  if (outlets <= 10) return 2200;
  return 3000;
}

export function getDeviceCapacityW(device: PlacedDevice): number | undefined {
  return getPduCapacityW(device) ?? getUpsCapacityW(device);
}

export function buildPowerChains(layout: RackLayout): PowerChain[] {
  const powerCables = layout.cables.filter((c) => c.type === 'power');
  const adj = new Map<string, { deviceId: string; cable: CableRoute }[]>();
  const allPowerDeviceIds = new Set<string>();

  for (const cable of powerCables) {
    allPowerDeviceIds.add(cable.fromDeviceId);
    allPowerDeviceIds.add(cable.toDeviceId);
    if (!adj.has(cable.fromDeviceId)) adj.set(cable.fromDeviceId, []);
    adj.get(cable.fromDeviceId)!.push({ deviceId: cable.toDeviceId, cable });
  }

  const roots: PlacedDevice[] = [];
  const rootIds = new Set<string>();

  for (const deviceId of allPowerDeviceIds) {
    const device = layout.devices.find((d) => d.id === deviceId);
    if (!device) continue;
    const hasIncoming = powerCables.some((c) => c.toDeviceId === deviceId);

    if (device.category === 'ups') {
      roots.push(device);
      rootIds.add(device.id);
    } else if (!hasIncoming && isPowerSource(device) && !rootIds.has(device.id)) {
      roots.push(device);
      rootIds.add(device.id);
    }
  }

  const orphanedPdus = layout.devices.filter(
    (d) => isPowerSource(d) && !allPowerDeviceIds.has(d.id)
  );
  roots.push(...orphanedPdus);

  return roots.map((root) => ({
    root: buildNode(root, adj, layout, new Set<string>()),
  }));
}

function buildNode(
  device: PlacedDevice,
  adj: Map<string, { deviceId: string; cable: CableRoute }[]>,
  layout: RackLayout,
  visited: Set<string>
): PowerChainNode {
  if (visited.has(device.id)) {
    return {
      device,
      loadW: device.powerW,
      downstreamW: 0,
      totalW: device.powerW,
      children: [],
    };
  }
  visited.add(device.id);

  const connections = adj.get(device.id) ?? [];
  const childNodes: PowerChainNode[] = [];

  for (const { deviceId, cable } of connections) {
    const childDevice = layout.devices.find((d) => d.id === deviceId);
    if (!childDevice) continue;
    const childNode = buildNode(childDevice, adj, layout, visited);
    childNode.cable = cable;
    childNodes.push(childNode);
  }

  const downstreamW = childNodes.reduce((sum, child) => sum + child.totalW, 0);
  const totalW = device.powerW + downstreamW;

  return {
    device,
    loadW: device.powerW,
    downstreamW,
    totalW,
    children: childNodes,
  };
}

export function formatWatts(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(2)}kW`;
  return `${Math.round(w)}W`;
}

/** Circuit load tracking */
export interface CircuitLoad {
  circuit: 'A' | 'B';
  totalW: number;
  deviceCount: number;
  sources: PlacedDevice[];
}

export function getCircuitLoads(layout: RackLayout): CircuitLoad[] {
  const powerCables = layout.cables.filter((c) => c.type === 'power');
  const loads: Record<string, { totalW: number; deviceCount: number; sources: PlacedDevice[] }> = {
    A: { totalW: 0, deviceCount: 0, sources: [] },
    B: { totalW: 0, deviceCount: 0, sources: [] },
  };

  for (const device of layout.devices) {
    if (!device.circuit) continue;
    const circuit = device.circuit;
    if (!loads[circuit]) continue;

    if (isPowerSource(device)) {
      loads[circuit].sources.push(device);
    }

    const poweredDevices = powerCables
      .filter((c) => c.fromDeviceId === device.id || c.toDeviceId === device.id)
      .map((c) => {
        const peerId = c.fromDeviceId === device.id ? c.toDeviceId : c.fromDeviceId;
        return layout.devices.find((d) => d.id === peerId);
      })
      .filter((d): d is PlacedDevice => d !== undefined && !isPowerSource(d));

    for (const powered of poweredDevices) {
      loads[circuit].totalW += powered.powerW;
      loads[circuit].deviceCount += 1;
    }
  }

  return (['A', 'B'] as const).map((circuit) => ({
    circuit,
    totalW: loads[circuit].totalW,
    deviceCount: loads[circuit].deviceCount,
    sources: loads[circuit].sources,
  }));
}

export interface PduOutletInfo {
  outletIndex: number;
  assignedDeviceId: string | null;
  assignedDeviceName: string | null;
  loadW: number;
  cableId: string | null;
}

export interface PduOutletUsage {
  totalOutlets: number;
  usedOutlets: number;
  freeOutlets: number;
  loadW: number;
  assignedOutlets: number;
  outlets: PduOutletInfo[];
}

export function getPduOutletMap(layout: RackLayout, pduId: string): PduOutletInfo[] {
  const pdu = layout.devices.find((d) => d.id === pduId && (d.category === 'pdu' || d.category === 'pdu-0u'));
  if (!pdu) return [];

  const totalOutlets = pdu.ports?.power ?? 8;
  const powerCables = layout.cables.filter((c) => c.type === 'power');
  const connected = powerCables.filter((c) => c.fromDeviceId === pduId || c.toDeviceId === pduId);

  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));
  const outletMap = new Map<number, { deviceId: string; cableId: string; loadW: number }>();

  for (const cable of connected) {
    const peerId = cable.fromDeviceId === pduId ? cable.toDeviceId : cable.fromDeviceId;
    const peer = deviceMap.get(peerId);
    const loadW = peer?.powerW ?? 0;
    if (cable.outletIndex !== undefined && cable.outletIndex >= 0 && cable.outletIndex < totalOutlets) {
      outletMap.set(cable.outletIndex, { deviceId: peerId, cableId: cable.id, loadW });
    }
  }

  const outlets: PduOutletInfo[] = [];
  for (let i = 0; i < totalOutlets; i++) {
    const assigned = outletMap.get(i);
    const assignedDevice = assigned ? deviceMap.get(assigned.deviceId) : undefined;
    outlets.push({
      outletIndex: i,
      assignedDeviceId: assigned?.deviceId ?? null,
      assignedDeviceName: assignedDevice?.name ?? null,
      loadW: assigned?.loadW ?? 0,
      cableId: assigned?.cableId ?? null,
    });
  }
  return outlets;
}

export function getPduOutletUsage(layout: RackLayout, pduId: string): PduOutletUsage | null {
  const pdu = layout.devices.find((d) => d.id === pduId && (d.category === 'pdu' || d.category === 'pdu-0u'));
  if (!pdu) return null;

  const totalOutlets = pdu.ports?.power ?? 8;
  const outlets = getPduOutletMap(layout, pduId);
  const assignedOutlets = outlets.filter((o) => o.assignedDeviceId !== null).length;
  const usedOutlets = outlets.filter((o) => o.cableId !== null).length;
  const loadW = outlets.reduce((sum, o) => sum + o.loadW, 0);

  return {
    totalOutlets,
    usedOutlets,
    freeOutlets: Math.max(0, totalOutlets - usedOutlets),
    loadW,
    assignedOutlets,
    outlets,
  };
}

export interface OutletValidationIssue {
  pduId: string;
  pduName: string;
  outletIndex: number;
  type: 'duplicate-assignment' | 'unassigned-cable' | 'outlet-overload' | 'ab-mismatch';
  detail: string;
  deviceIds: string[];
  cableIds: string[];
}

export function validatePduOutletAssignments(layout: RackLayout): OutletValidationIssue[] {
  const issues: OutletValidationIssue[] = [];
  const powerCables = layout.cables.filter((c) => c.type === 'power');
  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));

  // Group power cables by PDU
  const cablesByPdu = new Map<string, CableRoute[]>();
  for (const cable of powerCables) {
    const fromDevice = deviceMap.get(cable.fromDeviceId);
    const toDevice = deviceMap.get(cable.toDeviceId);
    const pduId = fromDevice && isPowerSource(fromDevice) ? cable.fromDeviceId : toDevice && isPowerSource(toDevice) ? cable.toDeviceId : null;
    if (!pduId) continue;
    const list = cablesByPdu.get(pduId) ?? [];
    list.push(cable);
    cablesByPdu.set(pduId, list);
  }

  for (const [pduId, cables] of cablesByPdu) {
    const pdu = deviceMap.get(pduId);
    if (!pdu) continue;
    const totalOutlets = pdu.ports?.power ?? 8;

    // Check for duplicate outlet assignments
    const outletToCables = new Map<number, CableRoute[]>();
    for (const cable of cables) {
      if (cable.outletIndex === undefined) continue;
      const list = outletToCables.get(cable.outletIndex) ?? [];
      list.push(cable);
      outletToCables.set(cable.outletIndex, list);
    }
    for (const [outletIndex, assignedCables] of outletToCables) {
      if (assignedCables.length > 1) {
        const deviceIds = assignedCables.map((c) => {
          const peerId = c.fromDeviceId === pduId ? c.toDeviceId : c.fromDeviceId;
          return peerId;
        });
        issues.push({
          pduId,
          pduName: pdu.name,
          outletIndex,
          type: 'duplicate-assignment',
          detail: `Outlet ${outletIndex + 1} on ${pdu.name} has ${assignedCables.length} devices assigned.`,
          deviceIds,
          cableIds: assignedCables.map((c) => c.id),
        });
      }
      if (outletIndex < 0 || outletIndex >= totalOutlets) {
        issues.push({
          pduId,
          pduName: pdu.name,
          outletIndex,
          type: 'outlet-overload',
          detail: `Outlet ${outletIndex + 1} on ${pdu.name} exceeds the ${totalOutlets} available outlets.`,
          deviceIds: assignedCables.map((c) => (c.fromDeviceId === pduId ? c.toDeviceId : c.fromDeviceId)),
          cableIds: assignedCables.map((c) => c.id),
        });
      }
    }

    // Check for unassigned cables (cables without outletIndex)
    const unassigned = cables.filter((c) => c.outletIndex === undefined);
    if (unassigned.length > 0) {
      const deviceIds = unassigned.map((c) => (c.fromDeviceId === pduId ? c.toDeviceId : c.fromDeviceId));
      issues.push({
        pduId,
        pduName: pdu.name,
        outletIndex: -1,
        type: 'unassigned-cable',
        detail: `${unassigned.length} power cable(s) on ${pdu.name} are not assigned to a specific outlet.`,
        deviceIds,
        cableIds: unassigned.map((c) => c.id),
      });
    }

    // Check A/B mismatch at outlet level for dual-PSU devices
    const deviceOutlets = new Map<string, { circuit?: 'A' | 'B'; outletIndex: number; cableId: string }[]>();
    for (const cable of cables) {
      if (cable.outletIndex === undefined) continue;
      const peerId = cable.fromDeviceId === pduId ? cable.toDeviceId : cable.fromDeviceId;
      const peer = deviceMap.get(peerId);
      if (!peer || (peer.ports?.power ?? 0) < 2) continue; // Only dual-PSU devices
      const list = deviceOutlets.get(peerId) ?? [];
      list.push({ circuit: pdu.circuit, outletIndex: cable.outletIndex, cableId: cable.id });
      deviceOutlets.set(peerId, list);
    }
    for (const [deviceId, entries] of deviceOutlets) {
      const circuits = Array.from(new Set(entries.map((e) => e.circuit).filter((c): c is 'A' | 'B' => c !== undefined)));
      if (circuits.length === 1) {
        const device = deviceMap.get(deviceId);
        issues.push({
          pduId,
          pduName: pdu.name,
          outletIndex: entries[0].outletIndex,
          type: 'ab-mismatch',
          detail: `${device?.name ?? deviceId} has both PSUs on circuit ${circuits[0]}. Move one to the other circuit for redundancy.`,
          deviceIds: [deviceId],
          cableIds: entries.map((e) => e.cableId),
        });
      }
    }
  }

  return issues;
}

export interface OutletFailureResult {
  pduId: string;
  pduName: string;
  outletIndex: number;
  affectedDevices: { id: string; name: string; powerW: number }[];
  totalLostW: number;
  downstreamDevices: { id: string; name: string; powerW: number }[];
}

export function simulateOutletFailure(layout: RackLayout, pduId: string, outletIndex: number): OutletFailureResult | null {
  const pdu = layout.devices.find((d) => d.id === pduId && (d.category === 'pdu' || d.category === 'pdu-0u'));
  if (!pdu) return null;

  const powerCables = layout.cables.filter((c) => c.type === 'power');
  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));

  // Find the device directly connected to this outlet
  const cable = powerCables.find(
    (c) =>
      (c.fromDeviceId === pduId || c.toDeviceId === pduId) &&
      c.outletIndex === outletIndex
  );
  if (!cable) {
    return {
      pduId,
      pduName: pdu.name,
      outletIndex,
      affectedDevices: [],
      totalLostW: 0,
      downstreamDevices: [],
    };
  }

  const directDeviceId = cable.fromDeviceId === pduId ? cable.toDeviceId : cable.fromDeviceId;
  const directDevice = deviceMap.get(directDeviceId);
  if (!directDevice) {
    return {
      pduId,
      pduName: pdu.name,
      outletIndex,
      affectedDevices: [],
      totalLostW: 0,
      downstreamDevices: [],
    };
  }

  // Directly affected: the device on this outlet
  const affectedDevices = [{ id: directDevice.id, name: directDevice.name, powerW: directDevice.powerW }];
  let totalLostW = directDevice.powerW;

  // Downstream: if the affected device is a PDU/UPS, its children also go down
  const downstreamDevices: { id: string; name: string; powerW: number }[] = [];

  function collectDownstream(deviceId: string) {
    const device = deviceMap.get(deviceId);
    if (!device || !isPowerSource(device)) return;
    const childCables = powerCables.filter((c) => c.fromDeviceId === deviceId || c.toDeviceId === deviceId);
    for (const childCable of childCables) {
      const childId = childCable.fromDeviceId === deviceId ? childCable.toDeviceId : childCable.fromDeviceId;
      const childDevice = deviceMap.get(childId);
      if (!childDevice || isPowerSource(childDevice)) continue;
      if (!downstreamDevices.some((d) => d.id === childId)) {
        downstreamDevices.push({ id: childId, name: childDevice.name, powerW: childDevice.powerW });
        totalLostW += childDevice.powerW;
      }
      // Recurse if child is also a power source
      if (isPowerSource(childDevice)) {
        collectDownstream(childId);
      }
    }
  }

  collectDownstream(directDeviceId);

  return {
    pduId,
    pduName: pdu.name,
    outletIndex,
    affectedDevices,
    totalLostW,
    downstreamDevices,
  };
}

export interface RedundancyCheckResult {
  device: PlacedDevice;
  powerCables: CableRoute[];
  circuits: ('A' | 'B')[];
  isRedundant: boolean;
}

export function checkPowerRedundancy(layout: RackLayout): RedundancyCheckResult[] {
  const powerCables = layout.cables.filter((c) => c.type === 'power');

  const devicePowerCables = new Map<string, CableRoute[]>();
  for (const cable of powerCables) {
    const fromDevice = layout.devices.find((d) => d.id === cable.fromDeviceId);
    const toDevice = layout.devices.find((d) => d.id === cable.toDeviceId);
    const consumerId = fromDevice && !isPowerSource(fromDevice)
      ? cable.fromDeviceId
      : toDevice && !isPowerSource(toDevice)
        ? cable.toDeviceId
        : null;
    if (!consumerId) continue;
    const existing = devicePowerCables.get(consumerId) ?? [];
    existing.push(cable);
    devicePowerCables.set(consumerId, existing);
  }

  const results: RedundancyCheckResult[] = [];
  for (const [deviceId, cables] of devicePowerCables) {
    if (cables.length < 2) continue;
    const device = layout.devices.find((d) => d.id === deviceId);
    if (!device) continue;

    const circuits = cables
      .map((c) => {
        const sourceId = c.fromDeviceId === deviceId ? c.toDeviceId : c.fromDeviceId;
        const source = layout.devices.find((d) => d.id === sourceId);
        return source?.circuit;
      })
      .filter((c): c is 'A' | 'B' => c === 'A' || c === 'B');

    const uniqueCircuits = Array.from(new Set(circuits));
    results.push({
      device,
      powerCables: cables,
      circuits: uniqueCircuits,
      isRedundant: uniqueCircuits.length >= 2,
    });
  }

  return results;
}

export function getDeviceCircuit(layout: RackLayout, deviceId: string): 'A' | 'B' | undefined {
  const device = layout.devices.find((d) => d.id === deviceId);
  if (!device) return undefined;
  if (device.circuit) return device.circuit;

  if (!isPowerSource(device)) {
    const powerCables = layout.cables.filter((c) => c.type === 'power');
    const upstreamCable = powerCables.find((c) => c.toDeviceId === deviceId);
    if (upstreamCable) {
      return getDeviceCircuit(layout, upstreamCable.fromDeviceId);
    }
  }

  return undefined;
}

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

export interface PduOutletUsage {
  totalOutlets: number;
  usedOutlets: number;
  freeOutlets: number;
  loadW: number;
}

export function getPduOutletUsage(layout: RackLayout, pduId: string): PduOutletUsage | null {
  const pdu = layout.devices.find((d) => d.id === pduId && (d.category === 'pdu' || d.category === 'pdu-0u'));
  if (!pdu) return null;

  const powerCables = layout.cables.filter((c) => c.type === 'power');
  const connected = powerCables.filter((c) => c.fromDeviceId === pduId || c.toDeviceId === pduId);
  const totalOutlets = pdu.ports?.power ?? 8;
  const loadW = connected.reduce((sum, c) => {
    const peerId = c.fromDeviceId === pduId ? c.toDeviceId : c.fromDeviceId;
    const peer = layout.devices.find((d) => d.id === peerId);
    return sum + (peer?.powerW ?? 0);
  }, 0);

  return {
    totalOutlets,
    usedOutlets: connected.length,
    freeOutlets: Math.max(0, totalOutlets - connected.length),
    loadW,
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

import { projectPoeInputLoads } from './poeLoad';
import { checkConnectorCompatibility } from './connectorCompatibility';
import type { CableRoute, PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { powerOutletIndex, hasPowerOutletConflict } from './powerOutlet';
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

export function getUpsCapacityW(device: PlacedDevice): number | undefined {
  return device.category === 'ups' ? getDeviceCapacityW(device) : undefined;
}

export function getDeviceCapacityW(device: PlacedDevice): number | undefined {
  const rating = device.powerCapacityW;
  return isPowerSource(device) && rating !== undefined && Number.isFinite(rating) && rating > 0
    ? rating : undefined;
}

type PowerEdge = { sourceId: string; targetId: string; cable: CableRoute };

/** Source/consumer direction is independent of the order in which users picked sockets. */
export function buildPowerTopology(layout: RackLayout) {
  const devices = new Map(layout.devices.map(device => [device.id, device]));
  const edges: PowerEdge[] = [];
  const incomingSupplyIds = new Set<string>();
  const warnings: string[] = [];
  for (const cable of layout.cables.filter(c => c.type === 'power')) {
    const from = devices.get(cable.fromDeviceId);
    const to = devices.get(cable.toDeviceId);
    if (!from || !to || from.id === to.id) {
      warnings.push(`Cable ${cable.label ?? cable.id}: invalid power endpoints.`);
      continue;
    }
    const connectorCheck = checkConnectorCompatibility(layout, cable);
    const declaredSupply = connectorCheck.supplyDeviceId ??
      ([from.id, to.id].includes(cable.powerSourceDeviceId ?? '') ? cable.powerSourceDeviceId! : isPowerSource(from) ? from.id : to.id);
    incomingSupplyIds.add(declaredSupply === from.id ? to.id : from.id);
    if (connectorCheck.status === 'conflict') {
      warnings.push(`Cable ${cable.label ?? cable.id}: ${connectorCheck.conflicts.join(' ')}`);
      continue;
    }
    const fromSource = isPowerSource(from);
    const toSource = isPowerSource(to);
    if (!fromSource && !toSource) {
      warnings.push(`Cable ${cable.label ?? cable.id}: neither endpoint is a power source.`);
      continue;
    }
    let sourceId = fromSource ? from.id : to.id;
    if (connectorCheck.supplyDeviceId) {
      sourceId = connectorCheck.supplyDeviceId;
    } else if (cable.powerSourceDeviceId !== undefined) {
      const source = devices.get(cable.powerSourceDeviceId);
      if (!source || !isPowerSource(source) || (source.id !== from.id && source.id !== to.id)) {
        warnings.push(`Cable ${cable.label ?? cable.id}: invalid supply direction.`);
        continue;
      }
      sourceId = source.id;
    } else if (fromSource && toSource) {
      warnings.push(`Cable ${cable.label ?? cable.id}: supply direction is assumed from the first endpoint. Confirm it in cable details.`);
    }
    edges.push({ sourceId, targetId: sourceId === from.id ? to.id : from.id, cable });
  }
  const roots = layout.devices.filter(d => isPowerSource(d) && !incomingSupplyIds.has(d.id));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    const cycle = edges.some(e => e.sourceId === id && hasCycle(e.targetId));
    visiting.delete(id);
    done.add(id);
    return cycle;
  };
  if (layout.devices.some(d => hasCycle(d.id))) warnings.push('Power wiring contains a cycle. Review supply directions before relying on this simulation.');
  return { devices, edges, roots, warnings };
}

const reachablePowerDevices = (edges: PowerEdge[], roots: string[], excluded = new Set<string>()): Set<string> => {
  const reached = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const id = queue.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const edge of edges) {
      if (edge.sourceId === id && !excluded.has(edge.cable.id)) queue.push(edge.targetId);
    }
  }
  return reached;
};

export function buildPowerChains(layout: RackLayout, supplyId?: string): PowerChain[] {
  const { devices, edges, roots } = buildPowerTopology(layout);
  const buildNode = (device: PlacedDevice, ancestors: Set<string>): PowerChainNode => {
    const path = new Set([...ancestors, device.id]);
    const childIds = new Set<string>();
    const children = edges.filter(e => {
      if (e.sourceId !== device.id || path.has(e.targetId) || childIds.has(e.targetId)) return false;
      childIds.add(e.targetId);
      return true;
    })
      .map(edge => ({ ...buildNode(devices.get(edge.targetId)!, path), cable: edge.cable }));
    // Shared/dual-fed descendants count once per source, even when displayed on two branches.
    const reachable = reachablePowerDevices(edges, [device.id]);
    const totalW = [...reachable].reduce((sum, id) => sum + (devices.get(id)?.powerW ?? 0), 0);
    return { device, loadW: device.powerW, downstreamW: totalW - device.powerW, totalW, children };
  };
  const selectedRoots = supplyId ? layout.devices.filter(d => d.id === supplyId && isPowerSource(d)) : roots;
  return selectedRoots.map(root => ({ root: buildNode(root, new Set()) }));
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
  const { devices, edges, roots } = buildPowerTopology(layout);
  return (['A', 'B'] as const).map(circuit => {
    const sources = roots.filter(d => d.circuit === circuit);
    const reached = reachablePowerDevices(edges, sources.map(d => d.id));
    const consumers = [...reached].map(id => devices.get(id)!).filter(d => !isPowerSource(d));
    return { circuit, sources, totalW: consumers.reduce((sum, d) => sum + d.powerW, 0), deviceCount: consumers.length };
  });
}

export interface PduOutletInfo {
  outletIndex: number;
  assignedDeviceId: string | null;
  assignedDeviceName: string | null;
  loadW: number;
  cableId: string | null;
}

export interface PduOutletUsage {
  totalOutlets: number | null;
  usedOutlets: number;
  freeOutlets: number | null;
  loadW: number;
  assignedOutlets: number;
  outlets: PduOutletInfo[];
}

export function getPduOutletMap(layout: RackLayout, pduId: string): PduOutletInfo[] {
  const pdu = layout.devices.find((d) => d.id === pduId && (d.category === 'pdu' || d.category === 'pdu-0u'));
  if (!pdu) return [];

  const totalOutlets = pdu.ports?.power ?? null;
  const { edges } = buildPowerTopology(layout);
  const connected = edges.filter(edge => edge.sourceId === pduId).map(edge => edge.cable);

  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));
  const outletMap = new Map<number, { deviceId: string; cableId: string; loadW: number }>();

  for (const cable of connected) {
    const peerId = cable.fromDeviceId === pduId ? cable.toDeviceId : cable.fromDeviceId;
    const reachable = reachablePowerDevices(edges, [peerId]);
    reachable.delete(pduId);
    const loadW = [...reachable].reduce((sum, id) => sum + (deviceMap.get(id)?.powerW ?? 0), 0);
    const outletIndex = powerOutletIndex(cable, pduId);
    if (outletIndex !== undefined && Number.isInteger(outletIndex) && outletIndex >= 0 && (totalOutlets === null || outletIndex < totalOutlets)) {
      outletMap.set(outletIndex, { deviceId: peerId, cableId: cable.id, loadW });
    }
  }

  const outlets: PduOutletInfo[] = [];
  const indices = totalOutlets === null
    ? [...outletMap.keys()].sort((a, b) => a - b)
    : Array.from({ length: totalOutlets }, (_, i) => i);
  for (const i of indices) {
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

  const totalOutlets = pdu.ports?.power ?? null;
  const outlets = getPduOutletMap(layout, pduId);
  const assignedOutlets = outlets.filter((o) => o.assignedDeviceId !== null).length;
  const usedOutlets = outlets.filter((o) => o.cableId !== null).length;
  const { edges, devices } = buildPowerTopology(layout);
  const reached = reachablePowerDevices(edges, edges.filter(edge => edge.sourceId === pduId).map(edge => edge.targetId));
  reached.delete(pduId);
  const loadW = [...reached].reduce((sum, id) => sum + (devices.get(id)?.powerW ?? 0), 0);

  return {
    totalOutlets,
    usedOutlets,
    freeOutlets: totalOutlets === null ? null : Math.max(0, totalOutlets - usedOutlets),
    loadW,
    assignedOutlets,
    outlets,
  };
}

export interface OutletValidationIssue {
  pduId: string;
  pduName: string;
  outletIndex: number;
  type: 'unknown-count' | 'duplicate-assignment' | 'unassigned-cable' | 'outlet-overload' | 'ab-mismatch' | 'conflicting-assignment';
  detail: string;
  deviceIds: string[];
  cableIds: string[];
}

export function validatePduOutletAssignments(layout: RackLayout): OutletValidationIssue[] {
  const issues: OutletValidationIssue[] = [];
  const { edges, devices: deviceMap } = buildPowerTopology(layout);
  const cablesByPdu = new Map<string, CableRoute[]>();
  for (const { sourceId, cable } of edges) {
    const list = cablesByPdu.get(sourceId) ?? [];
    list.push(cable);
    cablesByPdu.set(sourceId, list);
  }

  for (const [pduId, cables] of cablesByPdu) {
    const pdu = deviceMap.get(pduId);
    if (!pdu) continue;
    const totalOutlets = pdu.ports?.power ?? null;

    if (totalOutlets === null) {
      issues.push({ pduId, pduName: pdu.name, outletIndex: -1, type: 'unknown-count',
        detail: `Outlet count for ${pdu.name} is unknown. Recorded connections are retained; free sockets and socket range cannot be verified. Enter the equipment socket count.`,
        deviceIds: [pduId], cableIds: cables.map(cable => cable.id) });
    }

    // Check for duplicate outlet assignments
    const outletToCables = new Map<number, CableRoute[]>();
    for (const cable of cables) {
      const outletIndex = powerOutletIndex(cable, pduId);
      if (outletIndex === undefined) continue;
      if (hasPowerOutletConflict(cable, pduId)) {
        issues.push({ pduId, pduName: pdu.name, outletIndex, type: 'conflicting-assignment',
          detail: `The selected power socket ${outletIndex + 1} on ${pdu.name} conflicts with legacy outlet ${cable.outletIndex! + 1}. Review this cable before relying on outlet simulation.`,
          deviceIds: [pduId], cableIds: [cable.id] });
      }
      const list = outletToCables.get(outletIndex) ?? [];
      list.push(cable);
      outletToCables.set(outletIndex, list);
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
      if (!Number.isInteger(outletIndex) || outletIndex < 0 || (totalOutlets !== null && outletIndex >= totalOutlets)) {
        issues.push({
          pduId,
          pduName: pdu.name,
          outletIndex,
          type: 'outlet-overload',
          detail: `Outlet ${outletIndex + 1} on ${pdu.name} is invalid${totalOutlets === null ? '' : ` for ${totalOutlets} available outlets`}.`,
          deviceIds: assignedCables.map((c) => (c.fromDeviceId === pduId ? c.toDeviceId : c.fromDeviceId)),
          cableIds: assignedCables.map((c) => c.id),
        });
      }
    }

    // Explicit endpoint sockets and legacy assignments both count as assigned.
    const unassigned = cables.filter((c) => powerOutletIndex(c, pduId) === undefined);
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
      const outletIndex = powerOutletIndex(cable, pduId);
      if (outletIndex === undefined) continue;
      const peerId = cable.fromDeviceId === pduId ? cable.toDeviceId : cable.fromDeviceId;
      const peer = deviceMap.get(peerId);
      if (!peer || (peer.ports?.power ?? 0) < 2) continue; // Only dual-PSU devices
      const list = deviceOutlets.get(peerId) ?? [];
      list.push({ circuit: pdu.circuit, outletIndex, cableId: cable.id });
      deviceOutlets.set(peerId, list);
    }
    for (const [deviceId, entries] of deviceOutlets) {
      const circuits = Array.from(new Set(entries.map((e) => e.circuit).filter((c): c is 'A' | 'B' => c !== undefined)));
      if (entries.length >= 2 && circuits.length === 1) {
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
  warnings: string[];
  survivingDevices: { id: string; name: string; powerW: number }[];
  downstreamDevices: { id: string; name: string; powerW: number }[];
  remainingSupplies: {
    id: string;
    name: string;
    loadW: number;
    capacityW?: number;
    status: 'overload' | 'within-rating' | 'unknown';
  }[];
}

export function simulateOutletFailure(layout: RackLayout, pduId: string, outletIndex: number, workspace?: Workspace): OutletFailureResult | null {
  const projection = projectPoeInputLoads(layout, workspace);
  layout = projection.layout;
  const pdu = layout.devices.find(d => d.id === pduId && isPowerSource(d));
  if (!pdu) return null;
  const { devices, edges, roots, warnings } = buildPowerTopology(layout);
  const failedEdges = edges.filter(e => e.sourceId === pduId && powerOutletIndex(e.cable, pduId) === outletIndex);
  const rootIds = roots.map(d => d.id);
  const before = reachablePowerDevices(edges, rootIds);
  // Keep original roots: an unplugged downstream PDU must never become a new supply.
  const after = reachablePowerDevices(edges, rootIds, new Set(failedEdges.map(e => e.cable.id)));
  const failedIds = new Set(failedEdges.map(e => e.cable.id));
  // Check every live distribution stage, not only roots. Each source must be
  // able to carry the full reachable planning load; do not assume PSU sharing.
  const remainingSupplies = layout.devices.filter(d => isPowerSource(d) && after.has(d.id)).map(source => {
    const downstream = reachablePowerDevices(edges, [source.id], failedIds);
    downstream.delete(source.id); // Output rating excludes this supply's own consumption.
    const loadW = [...downstream].reduce((sum, id) => sum + devices.get(id)!.powerW, 0);
    const capacityW = getDeviceCapacityW(source);
    const unverifiedLoad = [...downstream].some(id => projection.warnings.has(id));
    const status = capacityW !== undefined && loadW > capacityW ? 'overload' as const
      : capacityW === undefined || unverifiedLoad || warnings.length > 0 ? 'unknown' as const : 'within-rating' as const;
    return { id: source.id, name: source.name, loadW, capacityW, status };
  });
  const directIds = new Set(failedEdges.map(e => e.targetId));
  const candidates = reachablePowerDevices(edges, [...directIds]);
  const lost = [...before].filter(id => !after.has(id));
  const describe = (id: string) => {
    const device = devices.get(id)!;
    return { id, name: device.name, powerW: device.powerW };
  };
  return {
    pduId, pduName: pdu.name, outletIndex,
    affectedDevices: lost.filter(id => directIds.has(id)).map(describe),
    downstreamDevices: lost.filter(id => !directIds.has(id)).map(describe),
    survivingDevices: [...candidates].filter(id => before.has(id) && after.has(id)).map(describe),
    remainingSupplies,
    totalLostW: lost.reduce((sum, id) => sum + devices.get(id)!.powerW, 0),
    warnings: [...warnings,
      ...[...projection.warnings.entries()].filter(([id]) => before.has(id)).flatMap(([, messages]) => messages),
      'PoE input uses recorded draw and conversion assumptions at each PSE, including cross-rack receivers. Unknown PoE input prevents a within-rating result. Each surviving wired feed carries full planned input; no load sharing or receiver shedding is assumed.',
      'Models loss of wired supply paths. Root supplies are assumed live; UPS battery hold-up, breaker and cable current limits are not verified.',
      'Remaining output checks use full reachable planning loads per supply without assuming load sharing. Within rating is conditional on your recorded loads and ratings; overload does not predict breaker trip behavior.',
      ...validatePduOutletAssignments(layout).filter(issue => issue.pduId === pduId).map(issue => issue.detail)],
  };
}

export interface RedundancyCheckResult {
  device: PlacedDevice;
  powerCables: CableRoute[];
  circuits: ('A' | 'B')[];
  isRedundant: boolean;
}

export function checkPowerRedundancy(layout: RackLayout): RedundancyCheckResult[] {
  const { edges, roots, warnings } = buildPowerTopology(layout);
  const results: RedundancyCheckResult[] = [];
  for (const device of layout.devices.filter(d => !isPowerSource(d))) {
    const feeds = edges.filter(e => e.targetId === device.id);
    if (feeds.length < 2) continue;
    const supplyingRoots = roots.filter(root => reachablePowerDevices(edges, [root.id]).has(device.id));
    const circuits = [...new Set(supplyingRoots.map(root => root.circuit).filter((c): c is 'A' | 'B' => c === 'A' || c === 'B'))];
    const ports = feeds.map(({ cable }) => cable.fromDeviceId === device.id ? cable.fromPort : cable.toPort);
    const validInlets = ports.every(port => port?.type === 'power' && Number.isInteger(port.index) && port.index >= 0 && port.index < (device.ports?.power ?? 0));
    const separateInlets = validInlets && new Set(ports.map(port => `${port!.side ?? 'default'}:${port!.index}`)).size === feeds.length;
    const survivesSingleSourceLoss = layout.devices.filter(isPowerSource).every(source => {
      const remainingRoots = roots.filter(root => root.id !== source.id).map(root => root.id);
      return reachablePowerDevices(edges.filter(edge => edge.sourceId !== source.id && edge.targetId !== source.id), remainingRoots).has(device.id);
    });
    results.push({ device, powerCables: feeds.map(e => e.cable), circuits,
      isRedundant: warnings.length === 0 && circuits.length === 2 && separateInlets && survivesSingleSourceLoss });
  }
  return results;
}

export function getDeviceCircuit(layout: RackLayout, deviceId: string): 'A' | 'B' | undefined {
  const { edges, roots } = buildPowerTopology(layout);
  const circuits = new Set(roots.filter(root => reachablePowerDevices(edges, [root.id]).has(deviceId)).map(root => root.circuit).filter(Boolean));
  return circuits.size === 1 ? [...circuits][0] : undefined;
}

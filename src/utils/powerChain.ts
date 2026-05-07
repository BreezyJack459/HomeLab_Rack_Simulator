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

const isPowerSource = (d: PlacedDevice) =>
  d.category === 'ups' || d.category === 'pdu' || (ENABLE_ZERO_U_PDU && d.category === 'pdu-0u');

function getPduCapacityW(device: PlacedDevice): number | undefined {
  if (device.category === 'pdu') {
    const outlets = device.ports?.power ?? 8;
    // Rough estimate: 16A @ 230V for standard rack PDU
    return outlets <= 8 ? 3680 : outlets <= 12 ? 4600 : 7360;
  }
  if (ENABLE_ZERO_U_PDU && device.category === 'pdu-0u') {
    return 4600; // 20A @ 230V typical for vertical PDU
  }
  return undefined;
}

function getUpsCapacityW(device: PlacedDevice): number | undefined {
  if (device.category !== 'ups') return undefined;
  // Common UPS capacities by port count as rough proxy
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

  // Build adjacency: upstreamId -> list of { downstreamId, cable }
  const adj = new Map<string, { deviceId: string; cable: CableRoute }[]>();
  const allPowerDeviceIds = new Set<string>();

  for (const cable of powerCables) {
    allPowerDeviceIds.add(cable.fromDeviceId);
    allPowerDeviceIds.add(cable.toDeviceId);
    if (!adj.has(cable.fromDeviceId)) adj.set(cable.fromDeviceId, []);
    adj.get(cable.fromDeviceId)!.push({ deviceId: cable.toDeviceId, cable });
  }

  // Find roots:
  // 1. UPS devices are always roots
  // 2. Power sources (PDU) with no incoming power cable
  // 3. Any device with outgoing power cables but no incoming (direct wall-powered PDU)
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

  // Also include wall-powered PDUs that aren't in allPowerDeviceIds
  // (PDUs with no cables at all — show them as empty roots)
  const orphanedPdus = layout.devices.filter(
    (d) => isPowerSource(d) && !allPowerDeviceIds.has(d.id)
  );
  roots.push(...orphanedPdus);

  // Build tree for each root
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
    // Circular reference guard
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

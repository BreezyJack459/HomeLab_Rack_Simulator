import type { PlacedDevice, RackLayout } from '../types/rack';
import { isPdu } from './routing';

export type ImpactType = 'power' | 'network' | 'boot';

export interface ImpactedDevice {
  deviceId: string;
  deviceName: string;
  impactType: ImpactType;
  distance: number;
  path: string[];
}

export interface UpstreamDependency {
  deviceId: string;
  deviceName: string;
  type: ImpactType;
}

export interface BlastRadiusAnalysis {
  targetDeviceId: string;
  targetDeviceName: string;
  criticalityScore: number;
  directlyImpacted: ImpactedDevice[];
  indirectlyImpacted: ImpactedDevice[];
  totalAffected: number;
  impactBreakdown: Record<ImpactType, number>;
  upstreamDependencies: UpstreamDependency[];
}

function isPowerSource(device: PlacedDevice): boolean {
  return device.category === 'ups' || isPdu(device);
}

function isNetworkCable(type: string): boolean {
  return type === 'ethernet' || type === 'fiber' || type === 'patch' || type === 'structured';
}

function buildPowerAdjacency(layout: RackLayout): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const cable of layout.cables) {
    if (cable.type !== 'power') continue;
    const list = adj.get(cable.fromDeviceId) ?? [];
    list.push(cable.toDeviceId);
    adj.set(cable.fromDeviceId, list);
  }
  return adj;
}

function buildReversePowerAdjacency(layout: RackLayout): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const cable of layout.cables) {
    if (cable.type !== 'power') continue;
    const list = adj.get(cable.toDeviceId) ?? [];
    list.push(cable.fromDeviceId);
    adj.set(cable.toDeviceId, list);
  }
  return adj;
}

function buildNetworkAdjacency(layout: RackLayout): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const cable of layout.cables) {
    if (!isNetworkCable(cable.type)) continue;
    const fromList = adj.get(cable.fromDeviceId) ?? [];
    fromList.push(cable.toDeviceId);
    adj.set(cable.fromDeviceId, fromList);

    const toList = adj.get(cable.toDeviceId) ?? [];
    toList.push(cable.fromDeviceId);
    adj.set(cable.toDeviceId, toList);
  }
  return adj;
}

function buildBootReverseAdjacency(layout: RackLayout): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const device of layout.devices) {
    if (device.category === 'blank' || device.category === 'cable-management') continue;
    for (const depId of device.bootDependsOn ?? []) {
      const list = adj.get(depId) ?? [];
      list.push(device.id);
      adj.set(depId, list);
    }
  }
  return adj;
}

function buildBootForwardAdjacency(layout: RackLayout): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const device of layout.devices) {
    adj.set(device.id, device.bootDependsOn ?? []);
  }
  return adj;
}

function bfsDownstream(
  startId: string,
  adjacency: Map<string, string[]>,
  deviceMap: Map<string, PlacedDevice>,
  maxDepth: number
): ImpactedDevice[] {
  const visited = new Set<string>();
  const queue: { id: string; distance: number; path: string[] }[] = [
    { id: startId, distance: 0, path: [startId] }
  ];
  const results: ImpactedDevice[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id !== startId) {
      const device = deviceMap.get(current.id);
      if (device) {
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          impactType: 'power',
          distance: current.distance,
          path: [...current.path]
        });
      }
    }

    if (current.distance >= maxDepth) continue;

    const neighbors = adjacency.get(current.id) ?? [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        queue.push({
          id: neighborId,
          distance: current.distance + 1,
          path: [...current.path, neighborId]
        });
      }
    }
  }

  return results;
}

function bfsNetworkImpact(
  startId: string,
  adjacency: Map<string, string[]>,
  deviceMap: Map<string, PlacedDevice>,
  maxDepth: number
): ImpactedDevice[] {
  const visited = new Set<string>();
  const queue: { id: string; distance: number; path: string[] }[] = [
    { id: startId, distance: 0, path: [startId] }
  ];
  const results: ImpactedDevice[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id !== startId) {
      const device = deviceMap.get(current.id);
      if (device) {
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          impactType: 'network',
          distance: current.distance,
          path: [...current.path]
        });
      }
    }

    if (current.distance >= maxDepth) continue;

    const neighbors = adjacency.get(current.id) ?? [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        queue.push({
          id: neighborId,
          distance: current.distance + 1,
          path: [...current.path, neighborId]
        });
      }
    }
  }

  return results;
}

function bfsBootImpact(
  startId: string,
  reverseAdjacency: Map<string, string[]>,
  deviceMap: Map<string, PlacedDevice>,
  maxDepth: number
): ImpactedDevice[] {
  const visited = new Set<string>();
  const queue: { id: string; distance: number; path: string[] }[] = [
    { id: startId, distance: 0, path: [startId] }
  ];
  const results: ImpactedDevice[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id !== startId) {
      const device = deviceMap.get(current.id);
      if (device) {
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          impactType: 'boot',
          distance: current.distance,
          path: [...current.path]
        });
      }
    }

    if (current.distance >= maxDepth) continue;

    const dependents = reverseAdjacency.get(current.id) ?? [];
    for (const dependentId of dependents) {
      if (!visited.has(dependentId)) {
        queue.push({
          id: dependentId,
          distance: current.distance + 1,
          path: [...current.path, dependentId]
        });
      }
    }
  }

  return results;
}

function collectUpstream(
  targetId: string,
  adjacency: Map<string, string[]>,
  deviceMap: Map<string, PlacedDevice>,
  type: ImpactType
): UpstreamDependency[] {
  const deps = adjacency.get(targetId) ?? [];
  return deps
    .map((id) => {
      const device = deviceMap.get(id);
      if (!device) return null;
      return { deviceId: device.id, deviceName: device.name, type };
    })
    .filter((d): d is UpstreamDependency => d !== null);
}

export function analyzeBlastRadius(layout: RackLayout, deviceId: string): BlastRadiusAnalysis | null {
  const targetDevice = layout.devices.find((d) => d.id === deviceId);
  if (!targetDevice) return null;

  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));

  // Power impact: only if target is a power source
  const powerAdj = buildPowerAdjacency(layout);
  const powerImpacts = isPowerSource(targetDevice)
    ? bfsDownstream(deviceId, powerAdj, deviceMap, 5)
    : [];

  // Network impact
  const networkAdj = buildNetworkAdjacency(layout);
  const networkImpacts = bfsNetworkImpact(deviceId, networkAdj, deviceMap, 3);

  // Boot impact
  const bootReverseAdj = buildBootReverseAdjacency(layout);
  const bootImpacts = bfsBootImpact(deviceId, bootReverseAdj, deviceMap, 5);

  // Deduplicate: if a device is affected by multiple types, keep the most severe
  // Priority: power > network > boot
  const impactMap = new Map<string, ImpactedDevice>();
  const priority: Record<ImpactType, number> = { power: 3, network: 2, boot: 1 };

  for (const impact of [...bootImpacts, ...networkImpacts, ...powerImpacts]) {
    const existing = impactMap.get(impact.deviceId);
    if (!existing || priority[impact.impactType] > priority[existing.impactType]) {
      impactMap.set(impact.deviceId, impact);
    }
  }

  const allImpacts = Array.from(impactMap.values());
  const directlyImpacted = allImpacts.filter((i) => i.distance === 1);
  const indirectlyImpacted = allImpacts.filter((i) => i.distance > 1);

  // Upstream dependencies
  const reversePowerAdj = buildReversePowerAdjacency(layout);
  const powerUpstream = collectUpstream(deviceId, reversePowerAdj, deviceMap, 'power');

  const networkUpstream = collectUpstream(deviceId, networkAdj, deviceMap, 'network');

  const bootForwardAdj = buildBootForwardAdjacency(layout);
  const bootUpstream = collectUpstream(deviceId, bootForwardAdj, deviceMap, 'boot');

  const upstreamDependencies = [...powerUpstream, ...networkUpstream, ...bootUpstream];

  // Impact breakdown
  const impactBreakdown: Record<ImpactType, number> = {
    power: powerImpacts.length,
    network: networkImpacts.length,
    boot: bootImpacts.length
  };

  // Criticality score: weighted impact count
  const scoreBase = 5;
  const powerWeight = 12;
  const networkWeight = 6;
  const bootWeight = 4;
  const weightedScore =
    scoreBase +
    powerImpacts.length * powerWeight +
    networkImpacts.length * networkWeight +
    bootImpacts.length * bootWeight;
  const criticalityScore = Math.min(100, weightedScore);

  return {
    targetDeviceId: deviceId,
    targetDeviceName: targetDevice.name,
    criticalityScore,
    directlyImpacted,
    indirectlyImpacted,
    totalAffected: allImpacts.length,
    impactBreakdown,
    upstreamDependencies
  };
}

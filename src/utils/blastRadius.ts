import type { PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { powerDeviceKey, simulatePoeSourceFailure } from './poeFailure';
import { assessSwitchRemoval } from './scenarioNetwork';

export type ImpactType = 'power' | 'network' | 'boot';

export interface ImpactedDevice {
  deviceId: string;
  rackId?: string;
  detail?: string;
  deviceName: string;
  impactType: ImpactType;
  distance: number;
  path: string[];
}

export interface UpstreamDependency {
  deviceId: string;
  rackId?: string;
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
  retainedPower: { key: string; name: string }[];
  untracedPower: { key: string; name: string }[];
  warnings: string[];
}

function isNetworkCable(type: string): boolean {
  return ['ethernet', 'fiber', 'patch', 'structured'].includes(type);
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

    if (current.id !== startId && !['switch', 'router', 'firewall', 'modem', 'patch-panel', 'poe-injector'].includes(deviceMap.get(current.id)?.category ?? '')) continue;
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

export function analyzeBlastRadius(layout: RackLayout, deviceId: string, workspace?: Workspace): BlastRadiusAnalysis | null {
  const targetDevice = layout.devices.find((d) => d.id === deviceId);
  if (!targetDevice) return null;

  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));

  const context: Workspace = workspace
    ? { ...workspace, racks: workspace.racks.map(r => r.id === layout.id ? layout : r) }
    : { id: 'blast', name: 'Blast radius', updatedAt: '', racks: [layout], interRackCables: [] };
  const failedKey = powerDeviceKey(layout.id, deviceId);
  const supply = simulatePoeSourceFailure(context, failedKey);
  const powerImpacts: ImpactedDevice[] = supply.supplyLost.filter(d => d.key !== failedKey).flatMap(d => {
    const path = supply.failurePaths.get(d.key);
    if (!path) return [];
    const [rackId, targetId] = JSON.parse(d.key) as [string, string];
    return [{ deviceId: targetId, rackId, deviceName: rackId === layout.id ? deviceMap.get(targetId)!.name : d.name,
      impactType: 'power' as const, distance: path.length - 1, path,
      detail: 'Recorded supply path is lost after removing this device. Electrical capacity and actual operation remain subject to wiring/PoE warnings.' }];
  });

  const networkAdj = buildNetworkAdjacency(layout);
  const removal = assessSwitchRemoval(layout, deviceId);
  const networkImpacts = bfsNetworkImpact(deviceId, networkAdj, deviceMap, layout.devices.length)
    .filter(d => d.distance === 1 || !removal.hasGateway || (removal.before.has(d.deviceId) && !removal.after.has(d.deviceId)))
    .map(d => ({ ...d, detail: d.distance === 1
      ? `Direct network link is lost.${removal.after.has(d.deviceId) ? ' Another device-level gateway path remains; configured failover is unverified.' : ' Remaining connectivity is unverified.'}`
      : removal.hasGateway ? 'Recorded device-level gateway path is lost. VLANs, routing and patch-jack continuity are unverified.'
        : 'Connected network dependency to review. No gateway path is recorded, so disruption is unverified.' }));

  // Boot impact
  const bootReverseAdj = buildBootReverseAdjacency(layout);
  const bootImpacts = bfsBootImpact(deviceId, bootReverseAdj, deviceMap, layout.devices.length).map(d => ({ ...d, detail: 'Recorded restart dependency. This does not establish that a running service stops.' }));

  // Deduplicate: if a device is affected by multiple types, keep the most severe
  // Priority: power > network > boot
  const impactMap = new Map<string, ImpactedDevice>();
  const priority: Record<ImpactType, number> = { power: 3, network: 2, boot: 1 };

  for (const impact of [...bootImpacts, ...networkImpacts, ...powerImpacts]) {
    const key = powerDeviceKey(impact.rackId ?? layout.id, impact.deviceId);
    const existing = impactMap.get(key);
    if (!existing || priority[impact.impactType] > priority[existing.impactType]) {
      impactMap.set(key, impact);
    }
  }

  const allImpacts = Array.from(impactMap.values());
  const directlyImpacted = allImpacts.filter((i) => i.distance === 1);
  const indirectlyImpacted = allImpacts.filter((i) => i.distance > 1);

  // Upstream dependencies
  const powerUpstream: UpstreamDependency[] = supply.upstreamSupplies.map(d => {
    const [rackId, targetId] = JSON.parse(d.key) as [string, string];
    return { deviceId: targetId, ...(rackId !== layout.id ? { rackId } : {}),
      deviceName: rackId === layout.id ? deviceMap.get(targetId)!.name : d.name, type: 'power' };
  });

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
    upstreamDependencies,
    retainedPower: supply.supplyRetained.filter(d => d.key !== failedKey),
    untracedPower: supply.supplyUntraced.filter(d => d.key !== failedKey),
    warnings: supply.warnings,
  };
}

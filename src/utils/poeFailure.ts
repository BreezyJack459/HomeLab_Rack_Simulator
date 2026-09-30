import { powerOutletIndex } from './powerOutlet';
import type { RackLayout, Workspace } from '../types/rack';
import { assessPoeBudgets } from './poeBudget';
import { buildPowerTopology, simulateOutletFailure } from './powerChain';

export const powerDeviceKey = (rackId: string, deviceId: string) => JSON.stringify([rackId, deviceId]);

/** Recorded reachability only: allocation is never substituted for electrical consumption. */
export function simulatePoeSourceFailure(workspace: Workspace, failedKey?: string, outlet?: { rackId: string; pduId: string; index: number }) {
  const audit = assessPoeBudgets(workspace);
  const devices = workspace.racks.flatMap(rack => rack.devices.map(device => ({
    key: powerDeviceKey(rack.id, device.id), name: `${rack.name} / ${device.name}`,
  })));
  const edges: { from: string; to: string; failed?: boolean }[] = [];
  const origins: string[] = [];
  const roots: string[] = [];
  const warnings: string[] = [];
  for (const rack of workspace.racks) {
    const topology = buildPowerTopology(rack);
    roots.push(...topology.roots.map(d => powerDeviceKey(rack.id, d.id)));
    edges.push(...topology.edges.map(e => {
      const failed = !!outlet && rack.id === outlet.rackId && e.sourceId === outlet.pduId && powerOutletIndex(e.cable, outlet.pduId) === outlet.index;
      const to = powerDeviceKey(rack.id, e.targetId);
      if (failed) origins.push(to);
      return { from: powerDeviceKey(rack.id, e.sourceId), to, failed };
    }));
    warnings.push(...topology.warnings.map(w => `${rack.name}: ${w}`));
  }
  for (const link of audit.links) {
    if (link.sourceKey && link.receiverKey) edges.push({ from: link.sourceKey, to: link.receiverKey });
    warnings.push(...[...link.conflicts, ...link.unknowns].map(w => `${link.label}: ${w}`));
  }
  for (const source of audit.sources.filter(s => s.status !== 'within-budget')) {
    warnings.push(`${source.name}: PoE budget ${source.status === 'overload' ? 'exceeded' : 'unverified'}.`);
  }
  // A receiver cannot become an independent live root just because it is a supply category.
  const receiverKeys = new Set(audit.links.flatMap(l => l.receiverKey ? [l.receiverKey] : []));
  const walk = (failed?: string, removeOutlet = false, start = roots.filter(id => !receiverKeys.has(id))) => {
    const reached = new Set<string>();
    const queue = [...start];
    while (queue.length) {
      const id = queue.pop()!;
      if (id === failed || reached.has(id)) continue;
      reached.add(id);
      queue.push(...edges.filter(e => e.from === id && !(removeOutlet && e.failed)).map(e => e.to));
    }
    return reached;
  };
  const before = walk();
  const after = walk(failedKey, true);
  const candidates = outlet ? walk(undefined, false, origins) : undefined;
  const receivers = devices.filter(d => receiverKeys.has(d.key) && (!candidates || candidates.has(d.key)));
  const failurePaths = new Map<string, string[]>();
  if (failedKey) {
    const queue = [[failedKey]];
    while (queue.length) {
      const path = queue.shift()!;
      const id = path[path.length - 1];
      if (failurePaths.has(id)) continue;
      failurePaths.set(id, path);
      for (const edge of edges.filter(e => e.from === id)) {
        if (!failurePaths.has(edge.to)) queue.push([...path, edge.to]);
      }
    }
  }
  return {
    lost: receivers.filter(d => before.has(d.key) && !after.has(d.key)),
    retained: receivers.filter(d => after.has(d.key)),
    untraced: receivers.filter(d => !before.has(d.key)),
    supplyLost: devices.filter(d => before.has(d.key) && !after.has(d.key)),
    supplyRetained: devices.filter(d => failurePaths.has(d.key) && after.has(d.key)),
    supplyUntraced: devices.filter(d => failurePaths.has(d.key) && !before.has(d.key)),
    upstreamSupplies: devices.filter(d => edges.some(e => e.to === failedKey && e.from === d.key)),
    failurePaths,
    warnings,
  };
}


export function simulateWorkspaceOutletFailure(layout: RackLayout, pduId: string, index: number, workspace: Workspace) {
  const context = { ...workspace, racks: workspace.racks.map(r => r.id === layout.id ? layout : r) };
  const wired = simulateOutletFailure(layout, pduId, index, context);
  if (!wired) return null;
  const poe = simulatePoeSourceFailure(context, undefined, { rackId: layout.id, pduId, index });
  const retained = new Set(poe.retained.map(d => d.key));
  const regained = [...wired.affectedDevices, ...wired.downstreamDevices].filter(d => retained.has(powerDeviceKey(layout.id, d.id)));
  const stillLost = (d: { id: string }) => !retained.has(powerDeviceKey(layout.id, d.id));
  return { ...wired, poe,
    affectedDevices: wired.affectedDevices.filter(stillLost),
    downstreamDevices: wired.downstreamDevices.filter(stillLost),
    survivingDevices: [...new Map([...wired.survivingDevices, ...regained].map(d => [d.id, d])).values()],
    warnings: [...new Set([...wired.warnings, ...poe.warnings])],
  };
}

import type { RackLayout, Workspace } from '../types/rack';
import { buildPowerTopology } from './powerChain';
import { assessPoeBudgets } from './poeBudget';
import { calculateUpsRuntimes } from './upsRuntime';
import { upsOutletBackup } from './upsOutletBackup';

/** Keep device identity rack-scoped while reporting impacts only for the selected rack. */
export function scenarioPowerContext(layout: RackLayout, workspace?: Workspace) {
  const context: Workspace = workspace
    ? { ...workspace, racks: workspace.racks.map(r => r.id === layout.id ? layout : r) }
    : { id: 'scenario', name: 'Scenario', updatedAt: '', racks: [layout], interRackCables: [] };
  const key = (rackId: string, id: string) => JSON.stringify([rackId, id]);
  const adjacency = new Map<string, Set<string>>();
  const utilityAdjacency = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, from: string, to: string) => {
    const targets = map.get(from) ?? new Set<string>();
    targets.add(to);
    map.set(from, targets);
  };
  for (const rack of context.racks) for (const edge of buildPowerTopology(rack).edges) {
    add(utilityAdjacency, key(rack.id, edge.sourceId), key(rack.id, edge.targetId));
    const source = rack.devices.find(d => d.id === edge.sourceId)!;
    if (source.category === 'ups' && upsOutletBackup(source, edge.cable) !== 'battery') continue;
    add(adjacency, key(rack.id, edge.sourceId), key(rack.id, edge.targetId));
  }
  for (const link of assessPoeBudgets(context).links) {
    if (link.sourceKey && link.receiverKey) {
      add(adjacency, link.sourceKey, link.receiverKey);
      add(utilityAdjacency, link.sourceKey, link.receiverKey);
    }
  }
  const reachable = (map: Map<string, Set<string>>, root: string) => {
    const reached = new Set<string>();
    const queue = [root];
    while (queue.length) {
      const current = queue.pop()!;
      if (reached.has(current)) continue;
      reached.add(current);
      queue.push(...(map.get(current) ?? []));
    }
    return reached;
  };
  const paths = context.racks.flatMap(rack => calculateUpsRuntimes(rack, context).flatMap(runtime => {
    const root = key(rack.id, runtime.device.id);
    const reached = reachable(adjacency, root);
    const utilityReached = reachable(utilityAdjacency, root);
    const deviceIds = layout.devices.filter(d => d.category !== 'ups' && reached.has(key(layout.id, d.id))).map(d => d.id);
    // Keep relevant remote UPS diagnostics even when its outlet backup is unknown or surge-only.
    return rack.id === layout.id || layout.devices.some(d => utilityReached.has(key(layout.id, d.id))) ? [{ runtime, deviceIds }] : [];
  }));
  return { paths, runtimes: paths.map(p => p.runtime), backedIds: new Set(paths.flatMap(p => p.deviceIds)) };
}

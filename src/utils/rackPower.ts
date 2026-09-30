import type { RackLayout, Workspace, ValidationIssue } from '../types/rack';
import { assessPoeBudgets } from './poeBudget';
import { projectPoeInputLoads } from './poeLoad';
import { buildPowerTopology } from './powerChain';

/** Attribute PoE input to the source rack, retaining full load on independent wired feeds. */
export function getRackPowerSummary(layout: RackLayout, workspace?: Workspace) {
  const context: Workspace = workspace
    ? { ...workspace, racks: workspace.racks.map(r => r.id === layout.id ? layout : r) }
    : { id: 'power-summary', name: layout.name, updatedAt: '', racks: [layout], interRackCables: [] };
  const audit = assessPoeBudgets(context);
  const projection = projectPoeInputLoads(layout, context);
  const topology = buildPowerTopology(layout);
  const wiredInputs = new Set(topology.edges.map(e => e.targetId));
  const acceptedCables = new Set(topology.edges.map(e => e.cable.id));
  // A rejected connection is unresolved input intent, not proof of a PoE-only receiver.
  const unresolvedWiredEndpoints = new Set(layout.cables.filter(c => c.type === 'power' && !acceptedCables.has(c.id)).flatMap(c => [c.fromDeviceId, c.toDeviceId]));
  const receiverKeys = new Set(audit.links.flatMap(l => l.receiverKey ? [l.receiverKey] : []));
  const attributedIds = new Set(layout.devices.filter(d => receiverKeys.has(JSON.stringify([layout.id, d.id])) && !wiredInputs.has(d.id) && !unresolvedWiredEndpoints.has(d.id)).map(d => d.id));
  const relevantSourceKeys = new Set(audit.links.filter(l => l.endpoints.some(e => e.rackId === layout.id)).flatMap(l => l.sourceKey ? [l.sourceKey] : []));
  const issues: ValidationIssue[] = [];
  if (topology.warnings.length) issues.push({ id: 'power-input-topology', severity: 'warning', title: 'Rack input attribution needs wiring review',
    detail: `${topology.warnings.join(' ')} Rejected wired inputs retain device planning watts; remaining input and energy estimates stay unverified until wiring is resolved.`,
    deviceIds: [...unresolvedWiredEndpoints].filter(id => layout.devices.some(d => d.id === id)),
  });
  for (const rack of context.racks) {
    const projected = rack.id === layout.id ? projection : projectPoeInputLoads(rack, context);
    for (const [id, warnings] of projected.warnings) {
      if (rack.id !== layout.id && !relevantSourceKeys.has(JSON.stringify([rack.id, id]))) continue;
      issues.push({ id: `power-poe-input-${JSON.stringify([rack.id, id])}`, severity: 'warning', title: 'PoE input estimate needs review',
        detail: `${rack.name}: ${warnings.join(' ')} The displayed input is incomplete or conditional; do not treat remaining budget as verified headroom.`,
        deviceIds: rack.id === layout.id ? [id] : [], editTarget: { rackId: rack.id, deviceId: id } });
    }
  }
  return {
    powerW: projection.layout.devices.reduce((sum, d) => sum + (attributedIds.has(d.id) ? 0 : d.powerW), 0),
    devicePowerW: layout.devices.reduce((sum, d) => sum + d.powerW, 0),
    poeAttributedDevices: attributedIds.size,
    powerInputUnverified: issues.length > 0 || audit.links.some(l => l.endpoints.some(e => e.rackId === layout.id) && (l.conflicts.length > 0 || l.unknowns.length > 0)),
    powerAttributionActive: audit.links.some(l => l.endpoints.some(e => e.rackId === layout.id)),
    issues,
  };
}

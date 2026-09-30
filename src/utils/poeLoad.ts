import type { RackLayout, Workspace } from '../types/rack';
import { assessPoeBudgets } from './poeBudget';

/** Charge each PSE once for its output, including cross-rack receivers. Never add PD nameplate watts. */
export function projectPoeInputLoads(layout: RackLayout, workspace?: Workspace) {
  const context: Workspace = workspace
    ? { ...workspace, racks: workspace.racks.map(r => r.id === layout.id ? layout : r) }
    : { id: 'power', name: 'Power', updatedAt: '', racks: [layout], interRackCables: [] };
  const audit = assessPoeBudgets(context);
  const warnings = new Map<string, string[]>();
  const projected = { ...layout, devices: layout.devices.map(device => {
    const sourceKey = JSON.stringify([layout.id, device.id]);
    const links = audit.links.filter(l => l.sourceKey === sourceKey || (!l.sourceKey && l.endpoints.some(e => e.rackId === layout.id && e.deviceId === device.id)));
    if (!links.length) return device;
    const issues: string[] = [];
    const source = audit.sources.find(s => s.id === sourceKey);
    if (source?.status !== 'within-budget') issues.push('PoE source budget is exceeded or unverified.');
    issues.push(...links.flatMap(l => [...l.conflicts, ...l.unknowns]));
    if (!device.poeInputMode) issues.push('Declare whether planning watts include PoE output.');
    let extraW = 0;
    if (device.poeInputMode === 'self-only') {
      if (links.some(l => l.drawW === undefined || !l.sourceKey)) issues.push('Record planned draw at the PSE for every PoE receiver.');
      if (!device.poeEfficiencyPct || device.poeEfficiencyPct > 100) issues.push('Record PSE conversion efficiency above 0 and at most 100%.');
      if (links.every(l => l.drawW !== undefined && l.sourceKey) && device.poeEfficiencyPct && device.poeEfficiencyPct <= 100) {
        extraW = links.reduce((sum, l) => sum + l.drawW!, 0) / (device.poeEfficiencyPct / 100);
      }
    }
    if (device.poeInputMode === 'includes-poe' && links.every(l => l.drawW !== undefined) && device.powerW < links.reduce((sum, l) => sum + l.drawW!, 0)) {
      issues.push('Inclusive planning watts are below the recorded PoE output draw.');
    }
    if (issues.length) warnings.set(device.id, [...new Set(issues)].map(s => `${device.name}: ${s}`));
    return extraW ? { ...device, powerW: device.powerW + extraW } : device;
  }) };
  return { layout: projected, warnings };
}

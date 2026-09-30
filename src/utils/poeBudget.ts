import type { PlacedDevice, PortRef, Workspace, ValidationIssue } from '../types/rack';
import { getPortConnectionSpec } from './connectorCompatibility';

type Endpoint = { rackId: string; device?: PlacedDevice; port?: PortRef };
export type PoeLinkAssessment = {
  id: string; label: string; sourceKey?: string; receiverKey?: string; allocationW?: number; drawW?: number;
  conflicts: string[]; unknowns: string[];
  endpoints: { rackId: string; deviceId?: string }[];
  editTarget?: { rackId: string; deviceId: string };
};

/** An explicit power allocation audit; ordinary data links never imply PoE. */
export function assessPoeBudgets(workspace: Workspace) {
  const links: PoeLinkAssessment[] = [];
  const sources = new Map<string, { rackId: string; deviceId: string; name: string; budgetW?: number; allocatedW: number; unknownAllocations: number }>();
  for (const rack of workspace.racks) for (const device of rack.devices) {
    if (device.poeBudgetW !== undefined || Object.values(device.portConnectionSpecs ?? {}).some(s => s.poeRole === 'pse')) {
      sources.set(JSON.stringify([rack.id, device.id]), { rackId: rack.id, deviceId: device.id, name: `${rack.name} / ${device.name}`, budgetW: device.poeBudgetW, allocatedW: 0, unknownAllocations: 0 });
    }
  }
  const review = (id: string, label: string, a: Endpoint, b: Endpoint, ethernet: boolean) => {
    const row: PoeLinkAssessment = { id, label, conflicts: [], unknowns: [], endpoints: [a, b].map(e => ({ rackId: e.rackId, deviceId: e.device?.id })), editTarget: a.device ? { rackId: a.rackId, deviceId: a.device.id } : undefined };
    const markUnallocated = () => { for (const e of [a, b]) { const source = sources.get(JSON.stringify([e.rackId, e.device?.id])); if (source) source.unknownAllocations++; } };
    links.push(row);
    if (!ethernet) { markUnallocated(); row.conflicts.push('PoE intent is only supported on Ethernet links.'); return; }
    if (!a.device || !b.device || !a.port || !b.port) { markUnallocated(); row.unknowns.push('Assign both physical Ethernet sockets.'); return; }
    for (const endpoint of [a, b]) {
      if (endpoint.port!.type !== 'ethernet' || !Number.isInteger(endpoint.port!.index) || endpoint.port!.index < 0 || endpoint.port!.index >= (endpoint.device!.ports?.ethernet ?? 0)) {
        markUnallocated(); row.conflicts.push('PoE endpoint does not identify a recorded Ethernet socket.'); return;
      }
    }
    const sa = getPortConnectionSpec(a.device, a.port);
    const sb = getPortConnectionSpec(b.device, b.port);
    const source = sa?.poeRole === 'pse' ? a : sb?.poeRole === 'pse' ? b : undefined;
    const supply = source === a ? sa : sb;
    const receiver = source === a ? sb : sa;
    if (sa?.poeRole === 'none' || sb?.poeRole === 'none' || (sa?.poeRole && sa.poeRole === sb?.poeRole)) {
      markUnallocated(); row.conflicts.push('PoE intent requires one supply (PSE) and one receiver (PD); check the recorded roles.'); return;
    }
    if (!source || receiver?.poeRole !== 'pd') { markUnallocated(); row.unknowns.push('Record one PSE and one PD role.'); return; }
    row.sourceKey = JSON.stringify([source.rackId, source.device!.id]);
    const destination = source === a ? b : a;
    row.receiverKey = JSON.stringify([destination.rackId, destination.device!.id]);
    const target = receiver.poeRequiredW === undefined ? (source === a ? b : a) : source;
    row.editTarget = { rackId: target.rackId, deviceId: target.device!.id };
    row.allocationW = receiver.poeRequiredW;
    row.drawW = receiver.poeDrawW;
    if (row.drawW !== undefined && row.allocationW !== undefined && row.drawW > row.allocationW) row.conflicts.push('Planned PoE draw exceeds the recorded allocation.');
    const total = sources.get(row.sourceKey)!;
    if (row.allocationW === undefined) { row.unknowns.push('PD required allocation at the PSE is unknown.'); total.unknownAllocations++; }
    else total.allocatedW += row.allocationW;
    if (!supply?.poeProfile?.trim() || !receiver.poeProfile?.trim()) row.unknowns.push('PoE profiles are not fully recorded; negotiation/voltage compatibility is unknown.');
    else if (supply.poeProfile.trim().toLowerCase() !== receiver.poeProfile.trim().toLowerCase()) row.conflicts.push('Recorded PoE profiles differ. Confirm a supported combination; do not assume passive and negotiated power are interchangeable.');
    if (supply?.poeLimitW === undefined) row.unknowns.push('PSE per-port limit is unknown.');
    else if (row.allocationW !== undefined && row.allocationW > supply.poeLimitW) row.conflicts.push(`Per-port allocation exceeds the recorded limit by ${(row.allocationW - supply.poeLimitW).toFixed(2)} W.`);
  };
  for (const rack of workspace.racks) for (const cable of rack.cables.filter(c => c.poe)) {
    review(JSON.stringify(['rack', rack.id, cable.id]), cable.label || cable.id,
      { rackId: rack.id, device: rack.devices.find(d => d.id === cable.fromDeviceId), port: cable.fromPort },
      { rackId: rack.id, device: rack.devices.find(d => d.id === cable.toDeviceId), port: cable.toPort }, cable.type === 'ethernet');
  }
  for (const cable of workspace.interRackCables.filter(c => c.poe)) {
    review(JSON.stringify(['inter', cable.id]), cable.label || cable.id,
      { rackId: cable.fromRackId, device: workspace.racks.find(r => r.id === cable.fromRackId)?.devices.find(d => d.id === cable.fromDeviceId), port: cable.fromPort },
      { rackId: cable.toRackId, device: workspace.racks.find(r => r.id === cable.toRackId)?.devices.find(d => d.id === cable.toDeviceId), port: cable.toPort }, cable.type === 'cat6a');
  }
  return { links, sources: [...sources.entries()].map(([id, source]) => ({ id, ...source,
    status: source.budgetW !== undefined && source.allocatedW > source.budgetW ? 'overload' as const
      : source.budgetW === undefined || source.unknownAllocations > 0 ? 'unverified' as const : 'within-budget' as const,
  })) };
}


export function getPoeIssues(workspace: Workspace, currentRackId: string): ValidationIssue[] {
  const audit = assessPoeBudgets(workspace);
  const issues: ValidationIssue[] = [];
  for (const source of audit.sources) {
    const related = audit.links.filter(link => link.sourceKey === source.id || link.endpoints.some(e => e.rackId === source.rackId && e.deviceId === source.deviceId));
    if (!related.length || source.status === 'within-budget' || !related.some(link => link.endpoints.some(e => e.rackId === currentRackId))) continue;
    issues.push({
      evidence: source.status === 'unverified' ? 'unverified' : undefined,
      id: `power-poe-budget-${source.id}`, severity: source.status === 'overload' ? 'critical' : 'warning',
      title: source.status === 'overload' ? 'PoE source budget exceeded' : 'PoE source budget is unverified',
      detail: `${source.name}: ${source.allocatedW.toFixed(2)} W known allocation${source.budgetW === undefined ? '; total budget is unknown.' : ` / ${source.budgetW.toFixed(2)} W recorded budget.`} ${source.status === 'overload' ? `Excess: ${(source.allocatedW - source.budgetW!).toFixed(2)} W. Reduce assigned demand or use a supply with a verified adequate budget.` : 'Record the source budget and every intended receiver allocation before relying on this total.'}`,
      deviceIds: source.rackId === currentRackId ? [source.deviceId] : [],
      editTarget: { rackId: source.rackId, deviceId: source.deviceId },
    });
  }
  for (const link of audit.links) {
    if (!link.endpoints.some(e => e.rackId === currentRackId) || (!link.conflicts.length && !link.unknowns.length)) continue;
    issues.push({ id: `power-poe-link-${link.id}`, severity: 'warning', evidence: !link.conflicts.length ? 'unverified' : undefined,
      title: link.conflicts.length ? 'PoE link constraints conflict' : 'PoE link power is unverified',
      detail: `${link.label}: ${[...link.conflicts, ...link.unknowns].join(' ')}`,
      deviceIds: link.endpoints.filter(e => e.rackId === currentRackId && e.deviceId).map(e => e.deviceId!), editTarget: link.editTarget,
    });
  }
  return issues;
}

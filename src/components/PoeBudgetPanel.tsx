import { useRackStore } from '../store/rackStore';
import { assessPoeBudgets } from '../utils/poeBudget';
import { useState } from 'react';
import { powerDeviceKey, simulatePoeSourceFailure } from '../utils/poeFailure';
import { isPowerSource } from '../utils/powerChain';

export function PoeBudgetPanel() {
  const workspace = useRackStore(s => s.workspace);
  const audit = assessPoeBudgets(workspace);
  const [failedKey, setFailedKey] = useState('');
  const candidates = workspace.racks.flatMap(rack => rack.devices.filter(d => isPowerSource(d) || audit.sources.some(s => s.rackId === rack.id && s.deviceId === d.id)).map(d => ({ key: powerDeviceKey(rack.id, d.id), name: `${rack.name} / ${d.name}` })));
  const failure = candidates.some(c => c.key === failedKey) ? simulatePoeSourceFailure(workspace, failedKey) : undefined;
  return <section aria-label="PoE allocation audit" className="mt-3 space-y-2 rounded border border-edge p-3 text-xs">
    <h3 className="font-semibold">PoE allocation audit</h3>
    <p className="text-content-muted">Record PSE/PD roles, profile identities, per-port limits and required allocation in Socket specifications. Mark each intended Ethernet power link in its cable details. All racks share this budget audit.</p>
    {!audit.links.length && <p>No Ethernet links are explicitly marked for PoE power.</p>}
    {audit.sources.map(source => <div key={source.id} className="rounded border border-edge p-2">
      <p className="font-medium">{source.name}: {source.allocatedW.toFixed(2)} W known allocation / {source.budgetW === undefined ? 'unknown total budget' : `${source.budgetW.toFixed(2)} W total budget`}</p>
      <p className={source.status === 'overload' ? 'text-red-400' : 'text-content-muted'}>{source.status === 'overload' ? `Budget exceeded by ${(source.allocatedW - source.budgetW!).toFixed(2)} W.` : source.status === 'unverified' ? 'Total allocation remains unverified.' : 'Known allocations are within the recorded budget; check link constraints below.'}</p>
    </div>)}
    {audit.links.map(link => <div key={link.id} className="rounded border border-edge p-2">
      <p className="font-medium">{link.label}: {link.allocationW === undefined ? 'allocation unknown' : `${link.allocationW.toFixed(2)} W requested at PSE`}</p>
      {[...link.conflicts, ...link.unknowns].map(message => <p key={message} className="text-amber-400">{message}</p>)}
      {!link.conflicts.length && !link.unknowns.length && <p>Recorded per-port allocation and profile constraints match.</p>}
    </div>)}
    {!!audit.links.length && <div className="space-y-2 border-t border-edge pt-2">
      <label className="block">Simulate supply unavailable
        <select className="mt-1 w-full rounded border border-edge bg-surface p-2 text-content" value={failure ? failedKey : ''} onChange={e => setFailedKey(e.target.value)}>
          <option value="">Choose UPS, PDU or PoE source</option>
          {candidates.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
      </label>
      <p className="text-content-muted">Traces recorded wired and PoE paths across racks, assuming root supplies are live. Removing a UPS means its output is unavailable, not a mains outage with battery hold-up. Path presence does not verify operating power or capacity.</p>
      {failure && <div aria-live="polite">
        <p>Lose recorded supply path: {failure.lost.map(d => d.name).join(', ') || 'None traced'}</p>
        <p>Retain recorded supply path: {failure.retained.map(d => d.name).join(', ') || 'None traced'}</p>
        <p>No upstream path traced before failure: {failure.untraced.map(d => d.name).join(', ') || 'None'}</p>
        {failure.warnings.map((w, i) => <p key={i} className="text-amber-400">{w}</p>)}
      </div>}
    </div>}
    <p className="text-content-muted">Required allocation is at the PSE output, including your allowance for cable loss. Each feed reserves its full allocation. Negotiation, conversion losses and patch-panel transit are not modeled. UPS runtime and Power Chain use explicit planned draw and conversion efficiency when PSE planning watts exclude PoE. Missing input assumptions block a runtime estimate. Reserved allocation is not consumption.</p>
  </section>;
}

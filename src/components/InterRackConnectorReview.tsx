import { useState } from 'react';
import type { InterRackCable, Workspace } from '../types/rack';
import { useRackStore } from '../store/rackStore';
import { checkInterRackConnectors } from '../utils/interRackCables';

export function InterRackConnectorReview({ workspace, cable }: { workspace: Workspace; cable: InterRackCable }) {
  const [fit, setFit] = useState({ from: cable.socketFit?.from ?? '', to: cable.socketFit?.to ?? '' });
  const [poe, setPoe] = useState(cable.poe === true);
  const review = checkInterRackConnectors(workspace, { ...cable, socketFit: fit });
  const changed = poe !== (cable.poe === true) || fit.from !== (cable.socketFit?.from ?? '') || fit.to !== (cable.socketFit?.to ?? '');
  return <div className="space-y-2 text-xs" aria-label="Inter-rack connector review">
    <p className="font-medium">{review.status === 'recorded-match' ? 'Recorded connector constraints match' : 'Connector compatibility unverified'}{changed ? ' (unsaved preview)' : ''}</p>
    {[...review.conflicts, ...review.unknowns].map(message => <p key={message} className="text-amber-400">{message}</p>)}
    {(['from', 'to'] as const).map(end => <label key={end} className="block">{end === 'from' ? 'Source' : 'Destination'} cable end fits socket identity
      <input type="text" value={fit[end]} onChange={event => setFit(current => ({ ...current, [end]: event.target.value }))} className="mt-1 w-full rounded border border-edge bg-surface p-2" />
    </label>)}
    {cable.type === 'cat6a' && <label className="flex items-center gap-2"><input type="checkbox" checked={poe} onChange={e => setPoe(e.target.checked)} />Plan PoE power on this Ethernet link</label>}
    <button type="button" disabled={!changed || review.status === 'conflict'} className="rounded border border-edge px-2 py-1 disabled:opacity-40" onClick={() => useRackStore.getState().updateInterRackCable(cable.id, { poe: cable.type === 'cat6a' && poe, socketFit: { from: fit.from || undefined, to: fit.to || undefined } })}>Save cable-end identities</button>
    <p className="text-content-muted">Use the socket identity this cable end is specified to fit. PoE power and optical/protocol compatibility are not verified.</p>
  </div>;
}

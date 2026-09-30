import { useEffect, useState } from 'react';
import type { ValidationIssue } from '../types/rack';
import { useRackStore } from '../store/rackStore';
import { findingIdentity, getFindingAcceptance } from '../utils/findingExceptions';

export function FindingExceptionControls({ issue }: { issue: ValidationIssue }) {
  const layout = useRackStore(state => state.layout);
  const accept = useRackStore(state => state.acceptFindingException);
  const reopen = useRackStore(state => state.reopenFindingException);
  const identity = findingIdentity(issue);
  const decision = getFindingAcceptance(layout, identity);
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [identity.ruleId, identity.targetKey, identity.fingerprint]);
  return <details className="rounded-lg border border-edge p-3" open={decision.state !== 'open'} data-testid="finding-exception-controls">
    <summary className="cursor-pointer text-xs font-semibold">{decision.state === 'accepted' ? 'Accepted exception' : decision.state === 'reopened' ? 'Changed since acceptance — review again' : 'Record an accepted exception'}</summary>
    <p className="mt-2 text-xs leading-5 text-content-muted">Acceptance records your decision for these facts. It does not resolve a conflict or verify missing information. Changes to the relevant facts reopen the review.</p>
    {decision.exception && <p className="mt-2 break-words text-xs text-content-secondary">Previous reason: {decision.exception.reason}</p>}
    {decision.state === 'accepted' && decision.exception ? <button type="button" onClick={() => reopen(decision.exception!.id)} className="mt-3 w-full rounded-lg border border-edge px-3 py-2 text-xs hover:bg-fill">Reopen this exception</button> : <>
      <label className="mt-3 block text-xs text-content-secondary">
        Reason for accepted exception
        <textarea aria-label="Reason for accepted exception" rows={3} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-edge bg-fill p-2" />
      </label>
      <button type="button" disabled={!reason.trim()} onClick={() => { if (accept(identity, reason)) setReason(''); }} className="mt-2 w-full rounded-lg border border-edge px-3 py-2 text-xs hover:bg-fill disabled:opacity-40">Accept current facts with this reason</button>
    </>}
  </details>;
}

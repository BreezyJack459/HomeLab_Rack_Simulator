import type { CableRoute, RackLayout } from '../types/rack';
import { checkConnectorCompatibility } from '../utils/connectorCompatibility';

export function ConnectorCompatibilityDetails({ layout, cable, onChange }: { layout: RackLayout; cable: CableRoute; onChange?: (patch: Partial<CableRoute>) => void }) {
  const result = checkConnectorCompatibility(layout, cable);
  return <div className="space-y-2 rounded-lg border border-edge p-3 text-xs text-content-muted">
    <p className="font-semibold">{result.status === 'conflict' ? 'Connector conflict' : result.status === 'unverified' ? 'Connector compatibility unverified' : 'Recorded connector constraints match'}</p>
    {[...result.conflicts, ...result.unknowns].map((reason, index) => <p key={index}>{reason}</p>)}
    <p>These checks compare recorded data. Protocol support, cable current rating, grounding, adapters and hardware condition still require verification.</p>
    {cable.type === 'ethernet' && <p>Ethernet connectivity does not verify PoE power, negotiation or budget. This data cable is not a modeled power-supply path.</p>}
    {onChange && <div className="grid gap-2">
      {cable.type === 'ethernet' && <label className="flex items-center gap-2"><input type="checkbox" checked={cable.poe === true} onChange={e => onChange({ poe: e.target.checked })} />Plan PoE power on this Ethernet link</label>}
      {(['from', 'to'] as const).map(end => <label key={end} className="grid gap-1">
        {end === 'from' ? 'First' : 'Second'} cable end fits socket identity
        <input value={cable.socketFit?.[end] ?? ''} placeholder="Socket connector name this cable end is specified to fit"
          onClick={event => event.stopPropagation()}
          onChange={event => onChange({ socketFit: { ...cable.socketFit, [end]: event.target.value || undefined } })}
          className="h-9 rounded border border-edge-strong bg-surface px-2 text-content" />
      </label>)}
      <p>Use the socket identity from the cable specification, not the plug name. Different socket types at opposite ends are allowed when the cable is made for them.</p>
    </div>}
  </div>;
}

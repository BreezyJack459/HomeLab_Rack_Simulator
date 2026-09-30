import type { InstallationRequirements, PlacedDevice, RackLayout } from '../types/rack';
import { getInstallationChecks } from '../utils/installationChecks';

function OptionalMillimeters({ label, value, onChange }: { label: string; value?: number; onChange: (value: number | undefined) => void }) {
  return <label className="grid gap-1 text-xs text-content-muted">{label}
    <input type="number" min={0} step="any" value={value ?? ''} placeholder="Unknown"
      className="h-9 w-full rounded-lg border border-edge-strong bg-surface px-2 text-content"
      onChange={event => {
        const value = event.target.value;
        if (value === '') onChange(undefined);
        else if (Number.isFinite(Number(value)) && Number(value) >= 0) onChange(Number(value));
      }} />
  </label>;
}

export function InstallationFields({ layout, device, onChange }: {
  layout: RackLayout; device: PlacedDevice; onChange: (patch: Partial<PlacedDevice>) => void;
}) {
  const requirements = device.installationRequirements ?? { support: 'unknown' as const };
  const patch = (change: Partial<InstallationRequirements>) => onChange({ installationRequirements: { ...requirements, ...change } });
  return <div className="grid gap-3">
    <p className="text-xs text-content-muted">Chassis fit does not confirm installation. Record requirements for the exact kit and hardware variant. Blank measurements stay unverified.</p>
    <label className="grid gap-1 text-xs text-content-muted">Required mounting support
      <select value={requirements.support} onChange={event => patch({ support: event.target.value as InstallationRequirements['support'] })}
        className="h-9 rounded-lg border border-edge-strong bg-surface px-2 text-content">
        <option value="unknown">Unknown</option><option value="rails">Front/rear rail kit</option>
        <option value="front-mount">Front brackets / ears</option><option value="shelf">Shelf</option>
        <option value="printed-mount">Printed mount</option>
      </select>
    </label>
    {requirements.support === 'rails' && <div className="grid grid-cols-2 gap-2">
      <OptionalMillimeters label="Rail minimum spacing (mm)" value={requirements.railMinMm} onChange={railMinMm => patch({ railMinMm })} />
      <OptionalMillimeters label="Rail maximum spacing (mm)" value={requirements.railMaxMm} onChange={railMaxMm => patch({ railMaxMm })} />
    </div>}
    <OptionalMillimeters label="Required rear cable allowance (mm)" value={requirements.rearClearanceMm} onChange={rearClearanceMm => patch({ rearClearanceMm })} />
    <label className="grid gap-1 text-xs text-content-muted">Requirements source / hardware variant
      <input value={requirements.source ?? ''} onChange={event => patch({ source: event.target.value || undefined })}
        className="h-9 rounded-lg border border-edge-strong bg-surface px-2 text-content" />
    </label>
    <label className="grid gap-1 text-xs text-content-muted">Installed mounting kit / shelf model
      <input value={device.installationKit ?? ''} onChange={event => onChange({ installationKit: event.target.value || undefined })}
        className="h-9 rounded-lg border border-edge-strong bg-surface px-2 text-content" />
    </label>
    <ul className="space-y-2 text-xs" aria-label="Installation check results">
      {getInstallationChecks(layout, device).map(check => <li key={check.id} className={check.status === 'passed' ? 'text-content-secondary' : 'text-amber-400'}>
        <strong>{check.status === 'passed' ? 'Recorded check passed' : check.status === 'failed' ? 'Requirement not met' : 'Unverified'}: </strong>{check.detail}
      </li>)}
    </ul>
  </div>;
}

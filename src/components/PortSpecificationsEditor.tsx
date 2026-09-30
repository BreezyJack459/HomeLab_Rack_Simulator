import { useState } from 'react';
import type { PlacedDevice, PortConnectionSpec, RackLayout } from '../types/rack';
import { portChoicesForDevice } from '../utils/portSelection';
import { portSpecificationKey } from '../utils/connectorCompatibility';
import { PORT_TYPE_NAMES } from '../utils/cableEndpoints';

export function PortSpecificationsEditor({ layout, device, onChange }: { layout: RackLayout; device: PlacedDevice; onChange: (patch: Partial<PlacedDevice>) => void }) {
  const choices = portChoicesForDevice(device, layout);
  const [selected, setSelected] = useState('');
  const choice = choices.find(port => portSpecificationKey(device, port) === selected) ?? choices[0];
  if (!choice) return <p className="text-xs text-content-muted">No sockets are recorded for this device.</p>;
  const key = portSpecificationKey(device, choice);
  const spec = device.portConnectionSpecs?.[key] ?? {};
  const patch = (change: Partial<PortConnectionSpec>) => onChange({ portConnectionSpecs: { ...device.portConnectionSpecs, [key]: { ...spec, ...change } } });
  const inputClass = 'h-9 rounded-lg border border-edge-strong bg-surface px-2 text-content';
  return <div className="grid gap-3 text-xs text-content-muted">
    <p>Record the exact socket and hardware variant. Generic port types and schematic socket drawings do not establish connector compatibility.</p>
    <label className="grid gap-1">Socket to specify<select className={inputClass} value={key} onChange={event => setSelected(event.target.value)}>
      {choices.map(port => <option key={portSpecificationKey(device, port)} value={portSpecificationKey(device, port)}>{PORT_TYPE_NAMES[port.type]} {port.index + 1} · {port.side}</option>)}
    </select></label>
    {choice.type === 'ethernet' && <div className="grid gap-2 rounded border border-edge p-2">
      <label className="grid gap-1">PoE role<select className={inputClass} value={spec.poeRole ?? ''} onChange={e => patch({ poeRole: (e.target.value || undefined) as PortConnectionSpec['poeRole'] })}>
        <option value="">Unknown</option><option value="none">No PoE</option><option value="pse">PSE — supplies power</option><option value="pd">PD — receives power</option>
      </select></label>
      <label className="grid gap-1">PoE profile identity<input className={inputClass} value={spec.poeProfile ?? ''} onChange={e => patch({ poeProfile: e.target.value || undefined })} placeholder="Exact negotiated profile or passive voltage/pinout" /></label>
      {(spec.poeRole === 'pse' || spec.poeRole === 'pd') && <label className="grid gap-1">{spec.poeRole === 'pse' ? 'PoE port output limit (W)' : 'PoE required allocation at PSE (W)'}
        <input type="number" min="0" step="any" className={inputClass} value={(spec.poeRole === 'pse' ? spec.poeLimitW : spec.poeRequiredW) ?? ''} onChange={e => {
          const value = e.target.value;
          if (value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)) patch({ [spec.poeRole === 'pse' ? 'poeLimitW' : 'poeRequiredW']: value === '' ? undefined : Number(value) });
        }} />
      </label>}
      {spec.poeRole === 'pd' && <label className="grid gap-1">Planned PoE draw at PSE (W)<input type="number" min="0" step="any" className={inputClass} value={spec.poeDrawW ?? ''} onChange={e => {
        const value = e.target.value;
        if (value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)) patch({ poeDrawW: value === '' ? undefined : Number(value) });
      }} /><span>Expected output draw including cable loss; separate from reserved allocation.</span></label>}
      {spec.poeRole === 'pse' && <>
        <label className="grid gap-1">Planning watts include PoE?<select className={inputClass} value={device.poeInputMode ?? ''} onChange={e => onChange({ poeInputMode: (e.target.value || undefined) as PlacedDevice['poeInputMode'] })}>
          <option value="">Unknown — review required</option><option value="self-only">No — device self-load only</option><option value="includes-poe">Yes — total input with planned PoE load</option>
        </select></label>
        {device.poeInputMode === 'self-only' && <label className="grid gap-1">PSE conversion efficiency (%)<input type="number" min="0.01" max="100" step="any" className={inputClass} value={device.poeEfficiencyPct ?? ''} onChange={e => {
          const value = e.target.value;
          if (value === '' || (Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100)) onChange({ poeEfficiencyPct: value === '' ? undefined : Number(value) });
        }} /></label>}
        <p>Use measured or documented assumptions for this planned load. Inclusive input must be reviewed when connected loads change.</p>
      </>}
      {spec.poeRole === 'pse' && <label className="grid gap-1">Device total PoE budget (W)<input type="number" min="0" step="any" className={inputClass} value={device.poeBudgetW ?? ''} onChange={e => {
        const value = e.target.value;
        if (value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)) onChange({ poeBudgetW: value === '' ? undefined : Number(value) });
      }} /></label>}
      <p>PoE role is separate from data direction. Two PSE ports can carry data without a PoE supply intent. Required allocation includes your allowance for cable loss; no profile watts are inferred.</p>
    </div>}
    <label className="grid gap-1">Socket connector identity<input className={inputClass} value={spec.connector ?? ''} placeholder="Exact socket family / model and variant" onChange={event => patch({ connector: event.target.value || undefined })} /></label>
    <label className="grid gap-1">Socket role<select className={inputClass} value={spec.role ?? 'unknown'} onChange={event => patch({ role: event.target.value as PortConnectionSpec['role'] })}>
      <option value="unknown">Unknown</option><option value="input">Input</option><option value="output">Output</option><option value="bidirectional">Bidirectional data</option><option value="passive">Passive pass-through</option>
    </select></label>
    {choice.type === 'power' && <>
      {device.category === 'ups' && <label className="grid gap-1">UPS outlet backup<select className={inputClass} value={spec.upsBackup ?? ''} onChange={event => patch({ upsBackup: (event.target.value || undefined) as PortConnectionSpec['upsBackup'] })}>
        <option value="">Unknown — verify this outlet</option><option value="battery">Battery-backed output</option><option value="surge-only">Surge-only — no battery backup</option>
      </select><span>Use the exact numbered output and face. This records backup intent; it does not verify transfer time or battery condition.</span></label>}
      <label className="grid gap-1">Supply kind<select className={inputClass} value={spec.powerKind ?? ''} onChange={event => patch({ powerKind: (event.target.value || undefined) as PortConnectionSpec['powerKind'] })}>
        <option value="">Unknown</option><option value="ac">AC</option><option value="dc">DC</option>
      </select></label>
      <label className="grid gap-1">Configured operating voltage (V)<input type="number" min="0.01" step="any" className={inputClass} value={spec.nominalVoltageV ?? ''} placeholder="Unknown" onChange={event => {
        const value = event.target.value;
        if (value === '') patch({ nominalVoltageV: undefined });
        else if (Number.isFinite(Number(value)) && Number(value) > 0) patch({ nominalVoltageV: Number(value) });
      }} /></label>
      <label className="grid gap-1">DC polarity / pinout identity<input className={inputClass} value={spec.polarity ?? ''} onChange={event => patch({ polarity: event.target.value || undefined })} /></label>
    </>}
    <label className="grid gap-1">Socket specification source<input className={inputClass} value={spec.source ?? ''} placeholder="Model revision, manufacturer specification or inspection note" onChange={event => patch({ source: event.target.value || undefined })} /></label>
  </div>;
}

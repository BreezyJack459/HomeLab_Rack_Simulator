import { ConnectorCompatibilityDetails } from './ConnectorCompatibilityDetails';
import { checkConnectorCompatibility } from '../utils/connectorCompatibility';
import { useEffect, useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import type { PairingSource, PairingStage } from '../types/pairing';
import type { CableRoute } from '../types/rack';
import { portChoicesForDevice, resolveCompatibleCable, type PortChoice } from '../utils/portSelection';
import { formatCableEndpoint, PORT_TYPE_NAMES } from '../utils/cableEndpoints';
import { DevicePortDiagram } from './DevicePortDiagram';

export function VisualCableConnector({ showCableView = false, onToggleCableView }: {
  showCableView?: boolean;
  onToggleCableView?: () => void;
} = {}) {
  const layout = useRackStore(s => s.layout);
  const selectedDeviceId = useRackStore(s => s.selectedDeviceId);
  const [stage, setStage] = useState<PairingStage>('selecting_source_port');
  const [source, setSource] = useState<PairingSource | null>(null);
  const [destination, setDestination] = useState<PortChoice | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(selectedDeviceId);
  const [hover, setHover] = useState<PortChoice | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [keepConnecting, setKeepConnecting] = useState(true);
  const sourceDevice = layout.devices.find(d => d.id === source?.deviceId);
  const device = layout.devices.find(d => d.id === deviceId);
  const target = destination ?? hover;
  const compatible = target ? resolveCompatibleCable(layout, source, target) : null;
  const preview = useMemo((): CableRoute | null => source && target && compatible ? {
    id: 'connection-preview', fromDeviceId: source.deviceId, fromPort: source.port,
    toDeviceId: target.deviceId, toPort: { type: target.type, index: target.index, side: target.side },
    type: compatible.cableType, color: compatible.color,
  } : null, [source, target, compatible?.cableType, compatible?.color]);
  const previewCompatibility = preview ? checkConnectorCompatibility(layout, preview) : null;
  const cancel = () => useCableWorkspaceStore.getState().consumeConnectionRequest();
  useEffect(() => { useRackStore.getState().setPreviewCable(preview); }, [preview]);
  useEffect(() => { useRackStore.getState().setPairingStage(stage); useRackStore.getState().setPairingSource(source); }, [stage, source]);
  useEffect(() => () => {
    const store = useRackStore.getState();
    store.setPreviewCable(null); store.setPairingStage('idle'); store.setPairingSource(null); store.registerPortPick3D(null);
  }, []);
  useEffect(() => { if (selectedDeviceId) setDeviceId(selectedDeviceId); }, [selectedDeviceId]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  function pick(choice: PortChoice) {
    if (stage === 'review') return;
    if (!source) {
      if (choice.disabled) return;
      setSource({ deviceId: choice.deviceId, deviceName: choice.deviceName, port: { type: choice.type, index: choice.index, side: choice.side }, label: choice.label });
      setStage('selecting_dest_port'); setDeviceId(null); setQuery(''); setHover(null); setMessage('');
    } else if (resolveCompatibleCable(layout, source, choice)) {
      setDestination(choice); setDeviceId(choice.deviceId); setStage('review'); setHover(null);
    }
  }
  useEffect(() => {
    useRackStore.getState().registerPortPick3D(hit => {
      const hitDevice = layout.devices.find(d => d.id === hit.deviceId);
      if (!hitDevice) return;
      const match = portChoicesForDevice(hitDevice, layout).find(c => c.type === hit.portType && c.index === hit.portIndex && (hitDevice.sizeU === 0 || c.side === hit.face));
      if (match) pick(match);
    });
  }, [layout, source, stage]);
  function confirm() {
    // Re-read both ends at commit time: an undo, edit or removal may have changed availability.
    const current = useRackStore.getState();
    const freshDevice = current.layout.devices.find(d => d.id === destination?.deviceId);
    const freshChoice = freshDevice && portChoicesForDevice(freshDevice, current.layout).find(c => c.type === destination?.type && c.index === destination.index && c.side === destination.side);
    const connection = freshChoice && resolveCompatibleCable(current.layout, source, freshChoice);
    if (!source || !freshChoice || !connection) { setMessage('A selected port is no longer available. Go back and choose another port.'); return; }
    current.addCable({ fromDeviceId: source.deviceId, fromPort: source.port, toDeviceId: freshChoice.deviceId,
      toPort: { type: freshChoice.type, index: freshChoice.index, side: freshChoice.side }, type: connection.cableType, color: connection.color });
    if (keepConnecting) {
      setDeviceId(source.deviceId); setSource(null); setDestination(null); setHover(null); setStage('selecting_source_port'); setQuery('');
      setMessage('Cable connected. Choose the next source socket on the same device.');
    } else cancel();
  }
  const candidates = layout.devices.map(d => {
    const choices = portChoicesForDevice(d, layout);
    const available = choices.filter(c => !c.disabled && (!source || resolveCompatibleCable(layout, source, c))).length;
    return { device: d, choices, available };
  }).filter(candidate => !source || (candidate.device.id !== source.deviceId && (candidate.available > 0 || candidate.choices.some(choice => choice.type === source.port.type && checkConnectorCompatibility(layout, {
    id: 'candidate', fromDeviceId: source.deviceId, fromPort: source.port,
    toDeviceId: candidate.device.id, toPort: { type: choice.type, index: choice.index, side: choice.side }, type: choice.type, color: '',
  }).status === 'conflict'))));
  const devices = candidates.filter(({ device: d }) => `${d.label ?? ''} ${d.name}`.toLowerCase().includes(query.toLowerCase()));
  const availableDevices = devices.filter(candidate => candidate.available > 0);
  const unavailableDevices = devices.filter(candidate => candidate.available === 0);
  function deviceButton({ device: d, choices, available }: typeof candidates[number]) {
    const freeChoices = choices.filter(c => !c.disabled && (!source || resolveCompatibleCable(layout, source, c)));
    const groups = new Map<string, number>();
    for (const choice of freeChoices) {
      const label = `${choice.side === 'front' ? 'Front' : 'Rear'} ${PORT_TYPE_NAMES[choice.type]}`;
      groups.set(label, (groups.get(label) ?? 0) + 1);
    }
    const counts = [...groups].map(([label, count]) => `${label}: ${count}`).join(' · ');
    const conflict = source && !available ? choices.filter(c => c.type === source.port.type).flatMap(c => checkConnectorCompatibility(layout, {
      id: 'candidate', fromDeviceId: source.deviceId, fromPort: source.port,
      toDeviceId: d.id, toPort: { type: c.type, index: c.index, side: c.side }, type: c.type, color: '',
    }).conflicts)[0] : undefined;
    const reason = !choices.length ? 'No ports' : available ? `${available} available` : choices.every(c => c.disabled) ? 'All ports in use' : 'No compatible free ports';
    return <button key={d.id} type="button" disabled={!available} aria-label={`${d.label || d.name} ${reason}`} aria-pressed={deviceId === d.id} onClick={() => { setDeviceId(d.id); setHover(null); }} className={`min-h-11 w-full rounded-lg border p-2 text-left disabled:opacity-60 ${deviceId === d.id ? 'border-accent bg-accent-subtle' : 'border-edge hover:bg-fill'}`}><span className="block text-sm font-medium">{d.label || d.name}</span><span className="text-xs text-content-muted">{reason}</span>{counts && <span className="block text-xs text-content-muted">{counts}</span>}{conflict && <span className="block text-xs text-amber-400">{conflict}</span>}</button>;
  }
  const visibleDevice = device && candidates.some(candidate => candidate.device.id === device.id) ? device : null;
  return <section aria-label="Visual cable connector" className={`mb-3 flex max-h-[max(14rem,min(45dvh,calc(100dvh-30rem)))] min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-accent/40 bg-surface p-3 lg:max-h-none ${showCableView ? 'lg:shrink-0' : 'lg:mb-0 lg:flex-1'}`}>
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{stage === 'review' ? '3 · Preview and connect' : source ? '2 · Pick a compatible destination' : '1 · Pick a source socket'}</h2><p className={`mt-1 text-xs text-content-muted ${showCableView ? 'lg:hidden' : ''}`}>Select a device, then click its socket. You can also pick ports in the 3D view.</p></div><div className="flex items-center gap-2">{onToggleCableView && <button type="button" aria-pressed={showCableView} onClick={onToggleCableView} className="hidden rounded-lg border border-accent/40 px-3 py-2 text-sm text-accent-fg lg:block">{showCableView ? 'Back to sockets' : 'Show cable view'}</button>}<button type="button" onClick={cancel} className="rounded-lg border border-edge px-3 py-2 text-sm">Cancel connection</button></div></div>
    {message && <p role="status" className="my-3 rounded-lg bg-accent-subtle p-3 text-sm text-accent-fg">{message}</p>}
    <div className={showCableView ? "lg:grid lg:grid-cols-2 lg:gap-2" : ""}>
    {source && <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 px-3 py-2"><span className="text-sm">Source: {formatCableEndpoint(sourceDevice, source.port, source.deviceName)}</span><button type="button" onClick={() => { setDeviceId(source.deviceId); setSource(null); setDestination(null); setHover(null); setQuery(''); setStage('selecting_source_port'); }} className="text-xs text-accent-fg underline">Change source</button></div>}
    {stage === 'review' && destination && <p className="mt-2 hidden shrink-0 rounded-lg bg-fill lg:block px-3 py-2 text-sm">Destination: {formatCableEndpoint(device, { type: destination.type, index: destination.index, side: destination.side })}</p>}
    </div>
    <div className={`min-h-0 overflow-y-auto overscroll-contain lg:flex-1 ${showCableView ? 'lg:hidden' : stage === 'review' ? '' : 'lg:overflow-hidden'}`}>
    {stage === 'review' ? <div className="mt-3 space-y-3">
      {preview && <ConnectorCompatibilityDetails layout={layout} cable={preview} />}
      <div className="grid gap-3 lg:grid-cols-2">
        {sourceDevice && <DevicePortDiagram key={`source-${sourceDevice.id}`} device={sourceDevice} layout={layout} source={source} destination={destination} onPick={() => {}} onHover={() => {}} />}
        {device && <DevicePortDiagram key={`destination-${device.id}`} device={device} layout={layout} source={source} destination={destination} onPick={() => {}} onHover={() => {}} />}
      </div>
      <div className="rounded-lg bg-fill p-3 text-sm"><p>{formatCableEndpoint(sourceDevice, source?.port)}</p><p className="mt-1">→ {formatCableEndpoint(device, destination ? { type: destination.type, index: destination.index, side: destination.side } : undefined)}</p><p className="mt-2 text-xs text-content-muted">{compatible?.cableType ?? 'Unavailable'} · Exact ports recorded automatically. Connector subtype and signal direction are not modelled; check the physical cable.</p></div>
    </div> : <div className="mt-4 grid min-w-0 gap-3 lg:mt-0 lg:h-full lg:min-h-0 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-3">
      <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-col">{source && <p className="mb-2 text-xs text-content-secondary">Available devices have free {PORT_TYPE_NAMES[source.port.type]} ports with no recorded conflict. Missing specifications remain unverified.</p>}<input aria-label="Find connection device" placeholder="Find a device" value={query} onChange={e => setQuery(e.target.value)} className="h-10 w-full shrink-0 rounded-lg border border-edge bg-fill px-3 text-sm"/><div className="mt-2 max-h-52 space-y-1 overflow-auto lg:min-h-0 lg:max-h-none lg:flex-1">{availableDevices.map(deviceButton)}{unavailableDevices.length > 0 && <details className="rounded-lg border border-edge p-2"><summary className="cursor-pointer py-2 text-sm text-content-muted">Unavailable devices ({unavailableDevices.length})</summary><div className="mt-2 space-y-1">{unavailableDevices.map(deviceButton)}</div></details>}{!devices.length && <p className="p-2 text-sm text-content-muted">{source && !candidates.length ? 'No compatible free ports. Change the source or free a port on another device.' : 'No matching devices.'}</p>}</div></div>
      <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">{visibleDevice ? <DevicePortDiagram key={`${visibleDevice.id}-${source?.port.type ?? 'source'}`} device={visibleDevice} layout={layout} source={source} onPick={pick} onHover={setHover} /> : <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-edge p-5 text-sm text-content-muted">{layout.devices.length ? source ? 'Choose a compatible device to see its available sockets.' : 'Choose a device to see its front and rear sockets.' : 'Add devices in Build before connecting cables.'}</div>}</div>
    </div>}
    </div>
    {stage === 'review' && <div className={`mt-2 shrink-0 space-y-2 border-t border-edge pt-2 ${showCableView ? 'lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-2 lg:space-y-0' : ''}`}>
      {showCableView && preview && previewCompatibility && <details className="hidden max-h-36 overflow-y-auto rounded-lg border border-edge px-3 py-2 text-xs lg:block lg:basis-full">
        <summary className="cursor-pointer text-content-secondary">{previewCompatibility.status === 'conflict' ? 'Connector conflict' : previewCompatibility.status === 'unverified' ? 'Connector compatibility unverified' : 'Recorded connector constraints match'} · Review details</summary>
        <div className="mt-2"><ConnectorCompatibilityDetails layout={layout} cable={preview} /></div>
      </details>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepConnecting} onChange={e => setKeepConnecting(e.target.checked)} />Keep connecting from this device</label>
      {!preview && <p role="alert" className="text-sm text-content-secondary">A selected port is no longer available. Go back and choose another port.</p>}
      <div className="flex gap-2"><button type="button" onClick={() => { setDestination(null); setStage('selecting_dest_port'); }} className="rounded-lg border border-edge px-4 py-2 text-sm">Back to destination</button><button type="button" onClick={confirm} disabled={!preview} className="rounded-lg bg-accent-solid px-5 py-2 text-sm font-semibold text-accent-on disabled:opacity-40">Connect cable</button></div>
    </div>}
  </section>;
}

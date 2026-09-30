import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlacedDevice, RackLayout, ViewSide } from '../types/rack';
import type { PairingSource } from '../types/pairing';
import { getDevicePortSurfaces, getDeviceWorldBox, getRackWorldDimensions } from '../utils/rackGeometry';
import { PORT_META, resolvePortFace } from '../utils/portLayout';
import { portChoicesForDevice, portKey, resolveCompatibleCable, type PortChoice } from '../utils/portSelection';
import { PORT_TYPE_NAMES } from '../utils/cableEndpoints';

export function DevicePortDiagram({ device, layout, source, destination, onPick, onHover }: {
  device: PlacedDevice; layout: RackLayout; source: PairingSource | null; destination?: PortChoice | null;
  onPick: (choice: PortChoice) => void; onHover: (choice: PortChoice | null) => void;
}) {
  const choices = portChoicesForDevice(device, layout);
  const [face, setFace] = useState<ViewSide>(() => (source?.deviceId === device.id ? source.port.side : destination?.deviceId === device.id ? destination.side : undefined) ?? choices.find(c => !c.disabled && (!source || resolveCompatibleCable(layout, source, c)))?.side ?? choices[0]?.side ?? 'front');
  const [zoom, setZoom] = useState(1);
  const [hint, setHint] = useState('Click a socket, or use the numbered port list below for larger targets.');
  const box = getDeviceWorldBox(layout, device, getRackWorldDimensions(layout));
  const surface = getDevicePortSurfaces(device, box).find(s => s.face === (box.isZeroU ? 'front' : face));
  const width = box.isZeroU && surface?.normal.x ? box.depth : box.isZeroU ? box.width * 0.9 : box.width;
  const height = box.height;
  const faceChoices = choices.filter(c => box.isZeroU || c.side === face);
  const statusFor = (choice: PortChoice) => {
    if (source?.deviceId === device.id && portKey(source.port) === portKey(choice)) return 'Source';
    if (destination?.deviceId === device.id && portKey(destination) === portKey(choice)) return 'Selected';
    if (choice.disabled) return 'In use';
    if (source && !resolveCompatibleCable(layout, source, choice)) return 'Not compatible';
    return 'Available';
  };
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(320);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Fit before the first paint so an immediate zoom uses the real viewport,
    // not the fallback width while ResizeObserver's first callback is pending.
    const style = getComputedStyle(viewport);
    setViewportWidth(viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (zoom === 1 && viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }, [zoom, face]);
  // Fit is independent of occupancy; occupied marks stay inside each socket.
  const diagramWidth = Math.max(1, Math.min(viewportWidth, box.isZeroU ? 80 : 420 * width / height)) * zoom;
  const diagramHeight = diagramWidth * height / width;
  return <section aria-label={`${device.label || device.name} port diagram`} className="min-w-0 rounded-xl border border-edge bg-surface p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold">{device.label || device.name}</h3><p className="text-xs text-content-muted">U{device.positionU} · Schematic port positions — check the physical device</p></div>
      <div className="flex flex-wrap gap-1">
        {!box.isZeroU && (['front', 'rear'] as const).map(side => <button key={side} type="button" aria-pressed={face === side} onClick={() => { setFace(side); onHover(null); }} className={`rounded-lg px-3 py-2 text-xs ${face === side ? 'bg-accent-solid text-accent-on' : 'bg-fill text-content-secondary'}`}>{side === 'front' ? 'Front face' : 'Rear face'}</button>)}
        <button type="button" onClick={() => setZoom(zoom === 1 ? 2 : zoom === 2 ? 4 : 1)} className="rounded-lg border border-edge px-3 py-2 text-xs" aria-label="Zoom port diagram">{zoom}× zoom</button>
      </div>
    </div>
    <div ref={viewportRef} data-testid="port-diagram-viewport" className="max-h-64 overflow-auto rounded-lg border border-edge bg-fill px-3 py-6">
      <div className="relative mx-auto" style={{ width: diagramWidth, height: diagramHeight }}>
      <div data-testid="port-diagram-face" className="relative rounded-lg border-2 border-edge-strong bg-surface-raised" style={{ width: diagramWidth, height: diagramHeight }}>
        <span className="pointer-events-none absolute left-2 top-1 text-[10px] uppercase text-content-faint">{box.isZeroU ? 'Outlet face' : `${face} face`}</span>
        {surface?.slots.map(slot => {
          const choice = faceChoices.find(c => c.type === slot.type && c.index === slot.index);
          if (!choice) return null;
          const status = statusFor(choice);
          const blocked = status === 'In use' || status === 'Not compatible' || status === 'Source';
          const selected = status === 'Source' || status === 'Selected';
          const text = `${PORT_TYPE_NAMES[choice.type]} ${choice.index + 1} · ${resolvePortFace(device, choice)} · ${status}`;
          return <button key={`${choice.type}-${choice.index}`} type="button" aria-label={text} aria-disabled={blocked} aria-pressed={selected}
            data-port-type={choice.type} data-port-index={choice.index} data-port-face={choice.side} data-port-status={status}
            onMouseEnter={() => { setHint(text); onHover(blocked ? null : choice); }} onMouseLeave={() => onHover(null)}
            onFocus={() => { setHint(text); onHover(blocked ? null : choice); }} onBlur={() => onHover(null)}
            onClick={() => { setHint(text); if (!blocked) onPick(choice); }}
            title={text} className={`absolute flex flex-col items-center justify-center rounded border-2 bg-surface text-content transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''} ${blocked && !selected ? 'cursor-default' : 'hover:brightness-125'}`}
            style={{ left: `${(slot.x / width + .5) * 100}%`, top: `${(.5 - slot.y / height) * 100}%`, transform: 'translate(-50%,-50%)', width: `${slot.width / width * 100}%`, height: `${slot.height / height * 100}%`, minWidth: 10, minHeight: 10, borderColor: selected ? 'rgb(var(--c-accent))' : PORT_META[choice.type].color }}>
            <svg viewBox="0 0 40 26" aria-hidden="true" className={`h-full w-full p-0.5 ${blocked && !selected ? 'opacity-40' : ''}`} style={{ color: PORT_META[choice.type].color }}>
              {choice.type === 'ethernet' ? <><path d="M3 3h34v16H26v5H14v-5H3Z" fill="none" stroke="currentColor" strokeWidth="2"/>{[10,14,18,22,26,30].map(x => <path key={x} d={`M${x} 4v6`} stroke="currentColor" strokeWidth="2"/>)}</>
                : choice.type === 'hdmi' ? <path d="M3 6h34l-5 15H8Z" fill="none" stroke="currentColor" strokeWidth="2"/>
                : choice.type === 'coax' ? <><circle cx="20" cy="13" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="13" r="2" fill="currentColor"/></>
                : <><rect x="3" y="4" width="34" height="18" rx={choice.type === 'usb' ? 3 : 1} fill="none" stroke="currentColor" strokeWidth="2"/><path d={choice.type === 'usb' ? 'M8 14h24' : 'M12 9v8M20 9v8M28 9v8'} stroke="currentColor" strokeWidth="3"/></>}
            </svg>
            {slot.width / width * diagramWidth >= 22 && <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-surface/80 text-xs font-semibold">{choice.index + 1}</span>}
            {status === 'In use' && <span aria-hidden="true" data-testid="port-in-use-mark" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 text-xs font-bold leading-none text-content">×</span>}
            {selected && <span className="pointer-events-none absolute -right-1 -top-2 rounded bg-surface text-[10px] text-content-secondary">✓</span>}
          </button>;
        })}
      </div>
      </div>
    </div>
    {!faceChoices.length && <p className="mt-2 text-sm text-content-muted">No ports on this face. Try the other face.</p>}
    <p role="status" className="mt-3 min-h-5 text-xs text-content-secondary">{hint}</p>
    <div className="mt-2 flex flex-wrap gap-3 text-xs">{[...new Set(choices.map(c => c.type))].map(type => <span key={type} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PORT_META[type].color }}/>{PORT_TYPE_NAMES[type]}</span>)}<span className="text-content-muted">× In use · ✓ Selected</span></div>
    <details open className="mt-3 text-sm"><summary className="cursor-pointer text-content-muted">Port list (larger targets and keyboard selection)</summary><div className="mt-2 flex flex-wrap gap-2">{faceChoices.map(choice => { const status = statusFor(choice); return <button key={portKey(choice)} type="button" disabled={status !== 'Available' && status !== 'Selected'} onFocus={() => { setHint(`${PORT_TYPE_NAMES[choice.type]} ${choice.index + 1} · ${choice.side} · ${status}`); onHover(status === 'Available' ? choice : null); }} onBlur={() => onHover(null)} onClick={() => onPick(choice)} className="min-h-11 min-w-11 rounded border border-edge p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40">{PORT_TYPE_NAMES[choice.type]} {choice.index + 1} · {status}</button>; })}</div></details>
  </section>;
}

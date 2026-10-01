import { createPortal } from 'react-dom';
import { getTabbableElements } from '../utils/tabbable';
import { useEffect, useRef, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import { planABCables, abFingerprint, type ABRequest, type ABResult, type ABSocket } from '../utils/abCablePlanner';
import { resolvePortFace } from '../utils/portLayout';
import { shouldHideDevice } from '../utils/featureFlags';

const field = 'mt-1 min-h-11 w-full rounded-lg border border-edge-strong bg-fill px-3 text-sm text-content';
export function ABCableConnector() {
  const layout = useRackStore(s => s.layout), workspace = useRackStore(s => s.workspace);
  const apply = useRackStore(s => s.applyABPlan), status = useRackStore(s => s.statusMessage);
  const close = () => useCableWorkspaceStore.getState().setABRequested(false);
  const devices = layout.devices.filter(d => d.category !== 'patch-panel' && (d.ports?.ethernet ?? 0) > 0 && !shouldHideDevice(d));
  const [a, setA] = useState(devices[0]?.id ?? ''), [b, setB] = useState(devices[1]?.id ?? '');
  const [aPort, setAPort] = useState(0), [bPort, setBPort] = useState(0);
  const [mode, setMode] = useState<ABRequest['mode']>('auto');
  const [completedFingerprint, setCompletedFingerprint] = useState<string | null>(null);
  const [result, setResult] = useState<ABResult | null>(null), [chosen, setChosen] = useState(0), [applied, setApplied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = result?.plans[chosen];
  const appliedCurrent = applied && completedFingerprint === abFingerprint(layout, workspace);
  const stale = Boolean(selected && selected.fingerprint !== abFingerprint(layout, workspace) && !appliedCurrent);
  const reset = () => { setResult(null); setChosen(0); setApplied(false); };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const appRoot = document.getElementById('root');
    const hadInert = appRoot?.hasAttribute('inert') ?? false;
    appRoot?.setAttribute('inert', '');
    root.current?.querySelector<HTMLElement>('button')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); useCableWorkspaceStore.getState().setABRequested(false); } };
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('keydown', escape, true); document.body.style.overflow = oldOverflow; if (!hadInert) appRoot?.removeAttribute('inert'); previous?.focus(); };
  }, []);
  const socket = (id: string, index: number): ABSocket => ({ deviceId: id, port: { type: 'ethernet', index, side: layout.devices.find(d => d.id === id) ? resolvePortFace(layout.devices.find(d => d.id === id)!, { type: 'ethernet', index }) : undefined } });
  const endpointLabel = (s: ABSocket) => `${layout.devices.find(d => d.id === s.deviceId)?.name ?? 'Missing device'} · ${s.port.side} #${s.port.index + 1}`;
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-2 sm:p-5" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="ab-title" className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-xl border border-edge bg-surface p-4 shadow-2xl sm:p-6" onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const els = getTabbableElements(root.current);
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-content-muted">Connection desk · 接線</p><h2 id="ab-title" className="mt-1 text-xl font-semibold">Connect A–B · 經配線架接線</h2></div><button type="button" onClick={close} className="min-h-11 shrink-0 whitespace-nowrap rounded-lg border border-edge px-3">Cancel · 取消</button></div>
      <p className="mt-3 text-sm leading-6 text-content-secondary">Same-rack Ethernet. Choose final devices and sockets; existing physical cables stay fixed. Only patch panels provide internal front ↔ rear continuity.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['A', 'B'] as const).map(end => {
          const id = end === 'A' ? a : b, index = end === 'A' ? aPort : bPort;
          const d = devices.find(d => d.id === id);
          return <fieldset key={end} className="min-w-0 rounded-lg border border-edge p-3"><legend className="px-1 font-semibold">Endpoint {end}</legend>
            <label className="block text-xs text-content-secondary">Device {end}<select aria-label={`Device ${end}`} className={field} value={id} onChange={e => { if (end === 'A') { setA(e.target.value); setAPort(0); } else { setB(e.target.value); setBPort(0); } reset(); }}><option value="">Choose device</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="mt-3 block text-xs text-content-secondary">Ethernet socket {end}<select aria-label={`Socket ${end}`} className={field} value={index} onChange={e => { (end === 'A' ? setAPort : setBPort)(Number(e.target.value)); reset(); }}>{Array.from({ length: d?.ports?.ethernet ?? 0 }, (_, i) => <option key={i} value={i}>#{i + 1} · {d ? resolvePortFace(d, { type: 'ethernet', index: i }) : ''}</option>)}</select></label>
          </fieldset>;
        })}
      </div>
      <label className="mt-4 block text-xs text-content-secondary">Path preference<select aria-label="Path preference" className={field} value={mode} onChange={e => { setMode(e.target.value as ABRequest['mode']); reset(); }}><option value="auto">Best available · direct or panels</option><option value="direct">Direct</option><option value="one-panel">Via one patch panel</option><option value="two-panels">Via two patch panels</option></select></label>
      <button type="button" disabled={!a || !b || a === b} onClick={() => { setResult(planABCables(layout, workspace, { from: socket(a, aPort), to: socket(b, bPort), mode })); setChosen(0); setApplied(false); }} className="mt-4 min-h-11 w-full rounded-lg border border-accent px-3 font-semibold text-accent-fg disabled:opacity-50">Preview paths · 預覽路徑</button>
      {result && <div className="mt-4 space-y-3">
        <p role="status" className="text-sm leading-6 text-content-secondary">{result.message}</p>
        {result.plans.length > 0 && <fieldset><legend className="mb-2 text-sm font-semibold">Candidates</legend><div className="grid gap-2 sm:grid-cols-2">{result.plans.map((plan, i) => <label key={plan.key} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs ${chosen === i ? 'border-accent bg-accent-soft' : 'border-edge'}`}><input type="radio" name="ab-candidate" checked={chosen === i} disabled={appliedCurrent} onChange={() => setChosen(i)} />Path {i + 1} · {plan.newCount} new / {plan.reusedCount} reused</label>)}</div></fieldset>}
        {selected && <><ol aria-label="Physical path preview" className="space-y-2">{selected.steps.map((step, i) => <li key={i} className={`rounded-lg border p-3 text-sm ${step.kind === 'internal' ? 'border-edge bg-fill' : step.kind === 'reuse' ? 'border-emerald-500/50' : 'border-accent/60'}`}><strong className="block text-xs uppercase tracking-wide">{step.kind === 'new' ? 'New planned cable · 新增' : step.kind === 'reuse' ? 'Reuse existing cable · 沿用' : 'Internal jack hop · 內部連通 — no cable / BOM'}</strong><span className="mt-1 block break-words">{endpointLabel(step.from)} → {endpointLabel(step.to)}</span>{step.kind !== 'internal' && <p className="mt-1 text-xs text-content-secondary">Installation: {step.cable?.installationRole ?? 'Legacy inferred role'} · {step.cable?.type}</p>}{step.kind !== 'internal' && <span className="mt-1 block text-xs text-content-muted">{step.kind === 'reuse' ? `${step.cable?.label ?? step.cable?.id} · ${step.cable?.lifecycleStatus ?? 'status unspecified'} · recorded length ${step.cable?.length ?? (step.cable?.lengthMm ? `${step.cable.lengthMm} mm` : 'unspecified')}` : `${step.estimatedMm === undefined ? 'No feasible route estimate; review routing' : `Estimated requirement ${step.estimatedMm} mm`} · ${step.stockedMm ? `stock length ${step.stockedMm / 1000} m` : 'custom length needed'} · planned`}</span>}{step.unknowns.length > 0 && <details className="mt-2 text-xs text-content-secondary"><summary tabIndex={0} className="cursor-pointer">Unverified specifications ({step.unknowns.length})</summary><ul className="mt-2 space-y-1">{step.unknowns.map((text, j) => <li key={j}>{text}</li>)}</ul></details>}</li>)}</ol>
          <p className="text-xs leading-5 text-content-muted">Internal jack hops are not purchases. Estimates do not replace measured or purchased lengths. Network, VLAN and link operation remain unverified.</p>
          {stale && <p role="alert" className="text-sm text-amber-500">Layout changed. Refresh the preview before confirming.</p>}
          <button type="button" disabled={appliedCurrent || stale} onClick={() => { if (apply(selected)) { setApplied(true); const current = useRackStore.getState(); setCompletedFingerprint(abFingerprint(current.layout, current.workspace)); root.current?.querySelector<HTMLElement>('button')?.focus(); } }} className="min-h-11 w-full rounded-lg bg-accent-solid px-3 font-semibold text-accent-on disabled:opacity-50">{appliedCurrent ? 'Connection present · 已完成' : selected.newCount ? `Confirm ${selected.newCount} new segment(s) · 確認` : 'Already connected · 確認已有接線'}</button>
          {(appliedCurrent || status?.startsWith('A–B preview')) && <p role="status" className="text-sm leading-6">{status}</p>}
        </>}
      </div>}
    </div>
  </div>, document.body);
}

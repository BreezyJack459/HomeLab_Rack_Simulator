import { useState } from 'react';
import { useRackStore } from '../store/rackStore';
export function PatchPanelTidyControl() {
  const layout = useRackStore(s => s.layout), tidy = useRackStore(s => s.tidyPatchPanel), status = useRackStore(s => s.statusMessage);
  const panels = layout.devices.filter(d => d.category === 'patch-panel');
  const [chosen, setChosen] = useState(''), [message, setMessage] = useState<string | null>(null);
  const panelId = panels.some(d => d.id === chosen) ? chosen : panels[0]?.id ?? '';
  if (!panels.length) return null;
  return <div className="space-y-2 rounded-lg border border-edge bg-fill/50 p-3"><label className="block text-xs text-content-secondary">Patch panel<select aria-label="Panel to tidy" value={panelId} onChange={e => { setChosen(e.target.value); setMessage(null); }} className="mt-1 min-h-11 w-full rounded-lg border border-edge bg-surface px-2 text-sm">{panels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="button" onClick={() => { tidy(panelId); setMessage(useRackStore.getState().statusMessage); }} className="min-h-11 w-full rounded-lg border border-edge-strong px-2 text-sm font-semibold hover:bg-fill">整理走線 · Tidy routes</button><p className="text-xs leading-5 text-content-muted">Panel cables only. Keep sockets, connectivity, recorded lengths and manual routes. One Undo restores routing.</p>{message && <p role="status" className="text-xs leading-5 text-content-secondary">{status === message ? message : 'Layout changed. Run tidy again to review the current routes.'}</p>}</div>;
}

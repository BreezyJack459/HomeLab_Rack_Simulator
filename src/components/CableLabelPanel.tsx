import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { cablePrinterLabels, printerLabelsCsv, printerLabelsText, type PrinterLabelFormat } from '../utils/cablePrinterLabels';
import { formatCableEndpoint } from '../utils/cableEndpoints';
import { detectLabelInconsistencies } from '../utils/cableLabeling';

export function CableLabelPanel() {
  const layout = useRackStore(s => s.layout);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [deviceId, setDeviceId] = useState('all');
  const [format, setFormat] = useState<PrinterLabelFormat>('two-line');
  const [separator, setSeparator] = useState<'blank-line' | 'tab'>('blank-line');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState('');
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const issues = useMemo(() => detectLabelInconsistencies(layout.cables, layout.devices), [layout]);
  const cables = layout.cables.filter(c => (type === 'all' || c.type === type) && (deviceId === 'all' || c.fromDeviceId === deviceId || c.toDeviceId === deviceId) &&
    `${c.label ?? ''} ${c.type} ${cablePrinterLabels(layout, c, 'two-line')[0]}`.toLowerCase().includes(query.toLowerCase()));
  // Bulk output always matches the current filter; hidden selections cannot leak into a print batch.
  const batch = cables.filter(c => selected.has(c.id));
  const text = printerLabelsText(batch.flatMap(c => cablePrinterLabels(layout, c, format)), separator);
  const allSelected = cables.length > 0 && cables.every(c => selected.has(c.id));
  async function copy(value: string, count: number) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value); setManualCopy(null); setFeedback(`Copied ${count} label${count === 1 ? '' : 's'}. Paste into your label printer app.`);
    } catch { setManualCopy(value); setFeedback('Clipboard access is unavailable. Select and copy the text below.'); }
  }
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const download = () => {
    const blob = new Blob([printerLabelsCsv(layout, batch, format)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cable-labels.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return <section aria-label="Cable labels" className="h-full overflow-auto bg-surface p-4 sm:p-6">
    <h1 className="text-xl font-semibold">Cable Labels</h1><p className="mt-2 text-sm text-content-muted">Choose cables, preview the labels, then copy into your label printer app. Names follow your device labels and port aliases.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-content-muted">Search cables<input aria-label="Search cable labels" value={query} onChange={e => setQuery(e.target.value)} placeholder="Device, port or cable name" className="mt-1 h-10 w-full rounded-lg border border-edge bg-fill px-3 text-sm text-content" /></label>
      <label className="text-xs text-content-muted">Device<select aria-label="Label device filter" value={deviceId} onChange={e => setDeviceId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-edge bg-fill px-2 text-sm text-content"><option value="all">All devices</option>{layout.devices.map(d => <option key={d.id} value={d.id}>{d.label || d.name}</option>)}</select></label>
      <label className="text-xs text-content-muted">Cable type<select aria-label="Label cable type" value={type} onChange={e => setType(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-edge bg-fill px-2 text-sm text-content"><option value="all">All types</option>{[...new Set(layout.cables.map(c => c.type))].map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="text-xs text-content-muted">Label format<select aria-label="Label format" value={format} onChange={e => setFormat(e.target.value as PrinterLabelFormat)} className="mt-1 h-10 w-full rounded-lg border border-edge bg-fill px-2 text-sm text-content"><option value="two-line">Two lines · same label at both ends</option><option value="single-line">Single line</option><option value="both-ends">Two labels · local end first</option></select></label>
    </div>
    <div className="my-4 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} onChange={() => setSelected(current => { const next = new Set(current); cables.forEach(c => allSelected ? next.delete(c.id) : next.add(c.id)); return next; })} />Select visible cables</label>
      <span className="text-xs text-content-muted">{batch.length} selected / {cables.length} visible</span>
      <button type="button" disabled={!batch.length} onClick={() => void copy(text, batch.length * (format === 'both-ends' ? 2 : 1))} className="rounded-lg bg-accent-solid px-3 py-2 text-sm text-accent-on disabled:opacity-40">Copy selected labels</button>
      <button type="button" disabled={!batch.length} onClick={download} className="rounded-lg border border-edge px-3 py-2 text-sm disabled:opacity-40">Export selected CSV</button>
      <label className="text-xs">Between labels <select aria-label="Between labels" value={separator} onChange={e => setSeparator(e.target.value as typeof separator)} className="rounded border border-edge bg-fill p-2"><option value="blank-line">Blank line</option><option value="tab">Tab</option></select></label>
    </div>
    <p className="mb-3 text-xs text-content-muted">Batch text uses the separator above. Printer apps may need CSV import to create separate labels. CSV has one row per label.</p>
    {feedback && <p role="status" className="mb-3 rounded-lg bg-accent-subtle p-3 text-sm text-accent-fg">{feedback}</p>}
    {manualCopy !== null && <label className="mb-4 block text-sm">Copy text manually<textarea aria-label="Manual label copy" readOnly value={manualCopy} onFocus={e => e.target.select()} className="mt-2 min-h-28 w-full rounded-lg border border-edge bg-fill p-3 font-mono text-xs" /></label>}
    <div className="space-y-3">{cables.map(c => {
      const labels = cablePrinterLabels(layout, c, format);
      const warnings = issues.filter(i => i.cableId === c.id);
      return <article key={c.id} className="rounded-xl border border-edge bg-surface-raised p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><label className="flex min-w-0 items-start gap-3"><input aria-label={`Select cable ${c.id}`} type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="mt-1"/><span><span className="block text-sm font-semibold">{c.label || `${c.type} cable`}</span><span className="text-xs text-content-muted">{formatCableEndpoint(layout.devices.find(d => d.id === c.fromDeviceId), c.fromPort)} → {formatCableEndpoint(layout.devices.find(d => d.id === c.toDeviceId), c.toPort)}</span></span></label><button type="button" aria-label={`Copy label for ${c.id}`} onClick={() => void copy(printerLabelsText(labels, separator), labels.length)} className="rounded-lg border border-edge px-3 py-2 text-sm">Copy {labels.length > 1 ? 'both labels' : 'label'}</button></div>
        <div className="mt-3 flex flex-wrap gap-3">{labels.map((label, i) => <pre key={i} data-testid="cable-label-preview" className="max-w-full whitespace-pre-wrap break-words rounded-lg border border-edge bg-fill px-4 py-3 font-mono text-sm leading-6 text-content">{label}</pre>)}</div>
        {warnings.length > 0 && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{warnings.map(w => w.message).join(' · ')}</p>}
      </article>;
    })}</div>
    {!cables.length && <p className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-content-muted">{layout.cables.length ? 'No matching cables. Clear the filters to see more.' : 'No cables yet. Connect devices in Cable, then return here to create labels.'}</p>}
  </section>;
}

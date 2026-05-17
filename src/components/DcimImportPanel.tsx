import { Download, FileJson, FileSpreadsheet, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { PlacedDevice } from '../types/rack';
import {
  importDcimDevices,
  summarizeImport,
  type DcimFormat,
} from '../utils/dcimImport';

export function DcimImportPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);

  const [format, setFormat] = useState<DcimFormat>('netbox-json');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{
    placed: PlacedDevice[];
    unmatchedNames: string[];
    summary: ReturnType<typeof summarizeImport>;
  } | null>(null);

  function runPreview() {
    if (!text.trim()) return;
    const result = importDcimDevices(text, format);
    setPreview({
      placed: result.placedDevices,
      unmatchedNames: result.unmatched.map((u) => u.name),
      summary: summarizeImport(result),
    });
  }

  function commitImport() {
    if (!preview || preview.placed.length === 0) return;
    const currentDevices = layout.devices ?? [];
    updateRack({ devices: [...currentDevices, ...preview.placed] });
    setPreview(null);
    setText('');
  }

  function clearAll() {
    setPreview(null);
    setText('');
  }

  const sampleNetbox = useMemo(
    () =>
      JSON.stringify(
        [
          {
            name: 'Core-SW-01',
            device_type: { model: '24-port switch', manufacturer: { name: 'Ubiquiti' }, u_height: 1 },
            position: 5,
            face: { value: 'front' },
          },
          {
            name: 'Server-01',
            device_type: { model: '2U server', manufacturer: { name: 'Dell' }, u_height: 2 },
            position: 10,
            face: { value: 'front' },
          },
        ],
        null,
        2
      ),
    []
  );

  const sampleCsv = useMemo(
    () => 'name,type,position,height_u,power_w,weight_kg\nCore-SW-01,24-port switch,5,1,25,2.5\nServer-01,2U server,10,2,150,12',
    []
  );

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Download size={15} />
          DCIM Import
        </div>
      </div>

      {/* Format selector */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => { setFormat('netbox-json'); setPreview(null); }}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1.5 text-[11px] font-medium transition"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: format === 'netbox-json' ? 'var(--theme-bg-primary)' : 'transparent',
            color: format === 'netbox-json' ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
          }}
        >
          <FileJson size={12} />
          NetBox JSON
        </button>
        <button
          type="button"
          onClick={() => { setFormat('generic-csv'); setPreview(null); }}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1.5 text-[11px] font-medium transition"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: format === 'generic-csv' ? 'var(--theme-bg-primary)' : 'transparent',
            color: format === 'generic-csv' ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
          }}
        >
          <FileSpreadsheet size={12} />
          Generic CSV
        </button>
      </div>

      {/* Text input */}
      <div className="mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={format === 'netbox-json' ? 'Paste NetBox device export JSON…' : 'Paste CSV with columns: name, type, position, height_u, power_w…'}
          className="h-32 w-full resize-y rounded border p-2 text-xs font-mono"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
            color: 'var(--theme-text-primary)',
          }}
        />
      </div>

      {/* Actions */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={!text.trim()}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-cyan-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-cyan-700 disabled:opacity-40"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setText(format === 'netbox-json' ? sampleNetbox : sampleCsv)}
          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          Sample
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Preview results */}
      {preview && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div
              className="rounded-md border p-2 text-center"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
            >
              <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                {preview.summary.total}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                Parsed
              </div>
            </div>
            <div
              className="rounded-md border p-2 text-center"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
            >
              <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                {preview.summary.matched}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                Matched
              </div>
            </div>
            <div
              className="rounded-md border p-2 text-center"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
            >
              <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                {preview.summary.unmatched}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                Unmatched
              </div>
            </div>
            <div
              className="rounded-md border p-2 text-center"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
            >
              <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                {preview.summary.totalU}U
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                Total U
              </div>
            </div>
          </div>

          {/* Unmatched warning */}
          {preview.unmatchedNames.length > 0 && (
            <div
              className="rounded-md border p-2 text-xs"
              style={{ borderColor: 'rgba(234,179,8,0.4)', backgroundColor: 'rgba(234,179,8,0.08)' }}
            >
              <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                Unmatched:
              </span>{' '}
              <span style={{ color: 'var(--theme-text-secondary)' }}>
                {preview.unmatchedNames.join(', ')}
              </span>
            </div>
          )}

          {/* Device list */}
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {preview.placed.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
              >
                <span className="truncate font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {d.name}
                </span>
                <span className="shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                  U{d.positionU} · {d.sizeU}U · {d.powerW}W
                </span>
              </div>
            ))}
          </div>

          {/* Commit */}
          <button
            type="button"
            onClick={commitImport}
            disabled={preview.placed.length === 0}
            className="inline-flex w-full items-center justify-center gap-1 rounded bg-cyan-600 py-1.5 text-[11px] font-medium text-white transition hover:bg-cyan-700 disabled:opacity-40"
          >
            <Plus size={12} />
            Import {preview.placed.length} Device{preview.placed.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </section>
  );
}

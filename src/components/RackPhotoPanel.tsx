import { Camera, Download, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackPhoto } from '../types/rack';
import { exportPhotosMarkdown, summarizePhotos } from '../utils/rackPhotos';

export function RackPhotoPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const photos = layout.photos ?? [];
  const summary = useMemo(() => summarizePhotos(photos), [photos]);

  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  function addPhoto() {
    if (!formLabel.trim() || !formSource.trim()) return;
    const newPhoto: RackPhoto = {
      id: `photo-${Date.now()}`,
      label: formLabel.trim(),
      source: formSource.trim(),
      capturedAt: formDate || undefined,
      notes: formNotes.trim() || undefined,
    };
    updateRack({ photos: [...photos, newPhoto] });
    setFormLabel('');
    setFormSource('');
    setFormDate('');
    setFormNotes('');
    setShowForm(false);
  }

  function removePhoto(id: string) {
    updateRack({ photos: photos.filter((p) => p.id !== id) });
  }

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
          <Camera size={15} />
          Photo Log
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportPhotosMarkdown(photos);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'photo-log.md';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Download size={11} />
          MD
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.total}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Photos
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.withDate}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Dated
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.withNotes}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            With Notes
          </div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border p-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">New Photo</span>
            <button type="button" onClick={() => setShowForm(false)} className="opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Label (e.g. Front view)"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <input
            type="text"
            placeholder="Source (URL or file path)"
            value={formSource}
            onChange={(e) => setFormSource(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <input
            type="text"
            placeholder="Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <button
            type="button"
            onClick={addPhoto}
            className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      )}

      {/* Photo list */}
      <div className="space-y-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="rounded-md border p-2.5 text-sm"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex-1 truncate font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                {photo.label}
              </span>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="opacity-60 transition hover:opacity-100"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="mt-1 text-[11px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>
              {photo.source}
            </div>
            {(photo.capturedAt || photo.notes) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {photo.capturedAt && (
                  <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                    {photo.capturedAt}
                  </span>
                )}
                {photo.notes && (
                  <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                    {photo.notes}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded border py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={12} />
          Add Photo
        </button>
      )}
    </section>
  );
}

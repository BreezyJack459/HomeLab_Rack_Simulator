import { AlertTriangle, Download, Grid3X3, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackType, RoomRack } from '../types/rack';
import { exportRoomRacksMarkdown, findRackOverlaps, getRoomBounds, summarizeRoomRacks } from '../utils/roomRacks';

export function RoomRackMapPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const roomRacks = layout.roomRacks ?? [];
  const summary = useMemo(() => summarizeRoomRacks(roomRacks), [roomRacks]);
  const bounds = useMemo(() => getRoomBounds(roomRacks), [roomRacks]);
  const overlaps = useMemo(() => findRackOverlaps(roomRacks), [roomRacks]);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<RackType>('19in');
  const [formHeightU, setFormHeightU] = useState('');
  const [formX, setFormX] = useState('');
  const [formY, setFormY] = useState('');
  const [formNotes, setFormNotes] = useState('');

  function resetForm() {
    setFormName('');
    setFormType('19in');
    setFormHeightU('');
    setFormX('');
    setFormY('');
    setFormNotes('');
  }

  function addRack() {
    if (!formName.trim() || !formHeightU.trim()) return;
    const newRack: RoomRack = {
      id: `room-rack-${Date.now()}`,
      name: formName.trim(),
      rackType: formType,
      heightU: parseInt(formHeightU, 10),
      xMm: formX ? parseFloat(formX) : 0,
      yMm: formY ? parseFloat(formY) : 0,
      widthMm: formType === '10in' ? 254 : 482.6,
      depthMm: formType === '10in' ? 600 : 1000,
      notes: formNotes.trim() || undefined,
    };
    updateRack({ roomRacks: [...roomRacks, newRack] });
    resetForm();
    setShowForm(false);
  }

  function removeRack(id: string) {
    updateRack({ roomRacks: roomRacks.filter((r) => r.id !== id) });
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
          <Grid3X3 size={15} />
          Room Rack Map
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportRoomRacksMarkdown(roomRacks);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'room-rack-layout.md';
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
            Racks
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.totalHeightU}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Total U
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {bounds.widthMm > 0 ? `${(bounds.widthMm / 1000).toFixed(1)}m` : '—'}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Width
          </div>
        </div>
      </div>

      {/* Overlap alerts */}
      {overlaps.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {overlaps.map((o) => (
            <div
              key={`${o.rackAId}-${o.rackBId}`}
              className="flex items-start gap-2 rounded-md border p-2 text-xs"
              style={{
                borderColor: 'rgba(234,179,8,0.4)',
                backgroundColor: 'rgba(234,179,8,0.08)',
              }}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow-500" />
              <div className="min-w-0">
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {o.rackAName}
                </span>
                <span className="ml-1" style={{ color: 'var(--theme-text-secondary)' }}>
                  overlaps
                </span>
                <span className="ml-1 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {o.rackBName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border p-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">New Rack</span>
            <button type="button" onClick={() => setShowForm(false)} className="opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as RackType)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="19in">19&quot;</option>
              <option value="10in">10&quot;</option>
            </select>
            <input
              type="number"
              placeholder="Height (U)"
              value={formHeightU}
              onChange={(e) => setFormHeightU(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="X position (mm)"
              value={formX}
              onChange={(e) => setFormX(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              placeholder="Y position (mm)"
              value={formY}
              onChange={(e) => setFormY(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
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
            onClick={addRack}
            className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      )}

      {/* Rack list */}
      <div className="space-y-2">
        {roomRacks.map((rack) => (
          <div
            key={rack.id}
            className="rounded-md border p-2.5 text-sm"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex-1 truncate font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                {rack.name}
              </span>
              <button
                type="button"
                onClick={() => removeRack(rack.id)}
                className="opacity-60 transition hover:opacity-100"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
              <span>{rack.rackType === '19in' ? '19″' : '10″'} · {rack.heightU}U</span>
              <span>({rack.xMm}mm, {rack.yMm}mm)</span>
              <span>{Math.round(rack.widthMm)}×{rack.depthMm}mm</span>
            </div>
            {rack.notes && (
              <div className="mt-1.5">
                <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                  {rack.notes}
                </span>
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
          Add Rack
        </button>
      )}
    </section>
  );
}

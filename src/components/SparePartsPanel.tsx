import {
  Download,
  Package,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { SparePart } from '../types/rack';
import {
  exportSparePartsCsv,
  exportSparePartsMarkdown,
  findCompatibleParts,
  summarizeSpareParts,
} from '../utils/spareParts';

const conditionOptions: SparePart['condition'][] = [
  'new',
  'used',
  'refurbished',
  'unknown',
];

function PartRow({
  part,
  onUpdate,
  onRemove,
  deviceOptions,
}: {
  part: SparePart;
  onUpdate: (patch: Partial<SparePart>) => void;
  onRemove: () => void;
  deviceOptions: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);

  const conditionColors: Record<string, string> = {
    new: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    used: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    refurbished: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    unknown: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  };

  function toggleCompatible(deviceId: string) {
    const current = part.compatibleDeviceIds ?? [];
    const next = current.includes(deviceId)
      ? current.filter((id) => id !== deviceId)
      : [...current, deviceId];
    onUpdate({ compatibleDeviceIds: next.length > 0 ? next : undefined });
  }

  return (
    <div
      className="rounded-md border text-sm"
      style={{
        borderColor: 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg-primary)',
      }}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="opacity-70 transition hover:opacity-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <Package size={14} className="shrink-0 opacity-70" />
        <span className="flex-1 truncate font-medium">{part.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${conditionColors[part.condition] ?? conditionColors.unknown}`}
        >
          {part.condition}
        </span>
        <span className="text-[10px] opacity-60">×{part.quantity}</span>
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {expanded && (
        <div
          className="grid grid-cols-2 gap-2 border-t px-3 py-2 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Name
            </div>
            <input
              type="text"
              value={part.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Category
            </div>
            <input
              type="text"
              value={part.category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Quantity
            </div>
            <input
              type="number"
              min={0}
              value={part.quantity}
              onChange={(e) =>
                onUpdate({ quantity: Number(e.target.value) })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Condition
            </div>
            <select
              value={part.condition}
              onChange={(e) =>
                onUpdate({
                  condition: e.target.value as SparePart['condition'],
                })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {conditionOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Storage Location
            </div>
            <input
              type="text"
              value={part.storageLocation ?? ''}
              onChange={(e) =>
                onUpdate({
                  storageLocation: e.target.value || undefined,
                })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. Blue bin under desk"
            />
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Notes
            </div>
            <input
              type="text"
              value={part.notes ?? ''}
              onChange={(e) =>
                onUpdate({ notes: e.target.value || undefined })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Compatible Devices
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {deviceOptions.map((d) => {
                const selected = part.compatibleDeviceIds?.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleCompatible(d.id)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                      selected
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : ''
                    }`}
                    style={
                      !selected
                        ? { borderColor: 'var(--theme-border)' }
                        : undefined
                    }
                  >
                    {selected && <CheckCircle2 size={10} className="mr-0.5 inline" />}
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SparePartsPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<SparePart>>({
    name: '',
    category: '',
    quantity: 1,
    condition: 'unknown',
  });

  const parts = layout.spareParts ?? [];
  const summary = useMemo(
    () => summarizeSpareParts(parts, layout.devices),
    [parts, layout.devices]
  );
  const compatibles = useMemo(
    () => findCompatibleParts(parts, layout.devices),
    [parts, layout.devices]
  );

  const deviceOptions = useMemo(
    () => layout.devices.map((d) => ({ id: d.id, name: d.name })),
    [layout.devices]
  );

  function addPart() {
    if (!form.name?.trim() || !form.category?.trim()) return;
    const newPart: SparePart = {
      id: `spare-${Date.now()}`,
      name: form.name.trim(),
      category: form.category.trim(),
      quantity: Math.max(0, form.quantity ?? 1),
      condition: (form.condition as SparePart['condition']) ?? 'unknown',
      storageLocation: form.storageLocation,
      notes: form.notes,
    };
    updateRack({ spareParts: [...parts, newPart] });
    setForm({ name: '', category: '', quantity: 1, condition: 'unknown' });
    setShowForm(false);
  }

  function updatePart(id: string, patch: Partial<SparePart>) {
    updateRack({
      spareParts: parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removePart(id: string) {
    updateRack({ spareParts: parts.filter((p) => p.id !== id) });
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Package size={15} />
          Spare Parts
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportSparePartsCsv(parts);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'spare-parts.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <Download size={11} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const md = exportSparePartsMarkdown(parts, layout.devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'spare-parts.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <Download size={11} />
            MD
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.totalParts}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Parts
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.totalQuantity}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Quantity
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {compatibles.length}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Compatible
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.missingCompatibleDevices}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Orphaned
          </div>
        </div>
      </div>

      {summary.missingCompatibleDevices > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {summary.missingCompatibleDevices} part(s) are marked compatible with devices not in this rack.
          </span>
        </div>
      )}

      {showForm ? (
        <div
          className="mb-3 flex flex-col gap-2 rounded-md border p-2"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="Category"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              placeholder="Quantity"
              value={form.quantity ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  quantity: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <select
              value={form.condition}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  condition: e.target.value as SparePart['condition'],
                }))
              }
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {conditionOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Storage location"
            value={form.storageLocation ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                storageLocation: e.target.value || undefined,
              }))
            }
            className="rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPart}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Part
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border px-2 py-1 text-[11px]"
              style={{
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-secondary)',
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mb-3 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <Plus size={11} />
          Add spare part
        </button>
      )}

      <div className="space-y-1">
        {parts.map((part) => (
          <PartRow
            key={part.id}
            part={part}
            onUpdate={(patch) => updatePart(part.id, patch)}
            onRemove={() => removePart(part.id)}
            deviceOptions={deviceOptions}
          />
        ))}
      </div>
    </section>
  );
}

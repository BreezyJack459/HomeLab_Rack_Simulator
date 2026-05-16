import {
  Camera,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image,
  Plus,
  Receipt,
  Shield,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { EvidenceRecord, EvidenceType } from '../types/rack';
import {
  entityOptions,
  evidenceTypeLabel,
  exportEvidenceCsv,
  exportEvidenceMarkdown,
  summarizeEvidence,
} from '../utils/evidenceLocker';

const typeIcons: Record<string, React.ReactNode> = {
  receipt: <Receipt size={12} />,
  'serial-photo': <Camera size={12} />,
  'firmware-screenshot': <Image size={12} />,
  'config-backup-hash': <Shield size={12} />,
  'warranty-pdf': <FileText size={12} />,
  'install-photo': <Camera size={12} />,
  'test-result': <Wrench size={12} />,
  'thermal-photo': <Image size={12} />,
  other: <FileText size={12} />,
};

const typeColors: Record<string, string> = {
  receipt: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'serial-photo': 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'firmware-screenshot': 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'config-backup-hash': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'warranty-pdf': 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'install-photo': 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'test-result': 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  'thermal-photo': 'bg-red-500/10 text-red-700 dark:text-red-300',
  other: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
};

const evidenceTypeOptions: EvidenceType[] = [
  'receipt',
  'serial-photo',
  'firmware-screenshot',
  'config-backup-hash',
  'warranty-pdf',
  'install-photo',
  'test-result',
  'thermal-photo',
  'other',
];

function EvidenceRow({
  record,
  onUpdate,
  onRemove,
  entityName,
}: {
  record: EvidenceRecord;
  onUpdate: (patch: Partial<EvidenceRecord>) => void;
  onRemove: () => void;
  entityName: string;
}) {
  const [expanded, setExpanded] = useState(false);

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
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${typeColors[record.type] ?? typeColors.other}`}>
          {typeIcons[record.type]}
          <span className="ml-1">{evidenceTypeLabel(record.type)}</span>
        </span>
        <span className="flex-1 truncate font-medium">{record.title}</span>
        {record.redacted && <EyeOff size={12} className="shrink-0 text-red-500" />}
        {record.safeToExport && <Eye size={12} className="shrink-0 text-emerald-500" />}
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
            <div className="text-[10px] uppercase tracking-wider opacity-60">Entity</div>
            <div className="mt-0.5">{entityName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Source</div>
            <input
              type="text"
              value={record.source}
              onChange={(e) => onUpdate({ source: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Captured</div>
            <input
              type="date"
              value={record.capturedAt ?? ''}
              onChange={(e) => onUpdate({ capturedAt: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={record.redacted ?? false}
                onChange={(e) => onUpdate({ redacted: e.target.checked })}
                className="h-3.5 w-3.5 accent-cyan-600"
              />
              <span className="text-[10px]">Redacted</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={record.safeToExport ?? false}
                onChange={(e) => onUpdate({ safeToExport: e.target.checked })}
                className="h-3.5 w-3.5 accent-cyan-600"
              />
              <span className="text-[10px]">Safe to export</span>
            </label>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={record.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="Optional notes"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function EvidenceLockerPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [form, setForm] = useState<Partial<EvidenceRecord>>({
    type: 'receipt',
    title: '',
    source: '',
  });

  const records = layout.evidenceRecords ?? [];
  const summary = useMemo(() => summarizeEvidence(records), [records]);
  const entities = useMemo(() => entityOptions(layout), [layout]);

  const filteredRecords = useMemo(() => {
    if (filter === 'all') return records;
    return records.filter((r) => r.type === filter || r.entityType === filter);
  }, [records, filter]);

  function addRecord() {
    if (!form.title?.trim() || !form.source?.trim() || !form.entityId) return;
    const newRecord: EvidenceRecord = {
      id: `ev-${Date.now()}`,
      entityType: (form.entityType as EvidenceRecord['entityType']) ?? 'device',
      entityId: form.entityId,
      type: (form.type as EvidenceType) ?? 'receipt',
      title: form.title.trim(),
      source: form.source.trim(),
      capturedAt: form.capturedAt,
      redacted: form.redacted,
      safeToExport: form.safeToExport,
      notes: form.notes,
    };
    updateRack({ evidenceRecords: [...records, newRecord] });
    setForm({ type: 'receipt', title: '', source: '' });
    setShowForm(false);
  }

  function updateRecord(id: string, patch: Partial<EvidenceRecord>) {
    updateRack({
      evidenceRecords: records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeRecord(id: string) {
    updateRack({ evidenceRecords: records.filter((r) => r.id !== id) });
  }

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entities) {
      map.set(`${e.type}:${e.id}`, e.name);
    }
    return map;
  }, [entities]);

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
          <Camera size={15} />
          Evidence Locker
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportEvidenceCsv(records, layout);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'evidence-locker.csv';
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
              const md = exportEvidenceMarkdown(records, layout);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'evidence-locker.md';
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
            {summary.totalRecords}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Records
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {summary.safeToExportCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Safe Export
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {summary.redactedCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Redacted
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {summary.missingExportFlagCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Unflagged
          </div>
        </div>
      </div>

      {showForm ? (
        <div
          className="mb-3 flex flex-col gap-2 rounded-md border p-2"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EvidenceType }))}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {evidenceTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {evidenceTypeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.entityId ?? ''}
              onChange={(e) => {
                const [type, id] = e.target.value.split(':');
                setForm((f) => ({ ...f, entityType: type as EvidenceRecord['entityType'], entityId: id }));
              }}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="">Select entity...</option>
              {entities.map((e) => (
                <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>
                  {e.name} ({e.type})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Source (URL / path / ref)"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRecord}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Record
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
          Add evidence record
        </button>
      )}

      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'all' ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'opacity-60'
          }`}
        >
          All
        </button>
        {(['device', 'cable', 'rack'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
              filter === t ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'opacity-60'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filteredRecords.map((record) => (
          <EvidenceRow
            key={record.id}
            record={record}
            onUpdate={(patch) => updateRecord(record.id, patch)}
            onRemove={() => removeRecord(record.id)}
            entityName={entityNameMap.get(`${record.entityType}:${record.entityId}`) ?? record.entityId}
          />
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          No evidence records yet. Add receipts, photos, test results, or warranty docs.
        </div>
      )}
    </section>
  );
}

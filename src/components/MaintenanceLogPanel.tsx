import { Download, Wrench, AlertTriangle, Clock, CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { MaintenanceLogEntry, MaintenanceLogType, PlacedDevice } from '../types/rack';
import {
  exportMaintenanceLogCsv,
  exportMaintenanceLogMarkdown,
  summarizeMaintenance,
  upcomingMaintenance,
} from '../utils/maintenanceLog';

const logTypeOptions: MaintenanceLogType[] = ['cleaning', 'firmware', 'repair', 'inspection', 'replacement', 'other'];

function LogEntryRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: MaintenanceLogEntry;
  onUpdate: (patch: Partial<MaintenanceLogEntry>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border text-sm" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="opacity-70 transition hover:opacity-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase">{entry.type}</span>
        <span className="text-[10px] opacity-60">{entry.date}</span>
        <span className="flex-1 truncate">{entry.description}</span>
        <button type="button" onClick={onRemove} className="opacity-60 transition hover:opacity-100" style={{ color: 'var(--theme-text-muted)' }}>
          <Trash2 size={12} />
        </button>
      </div>
      {expanded && (
        <div className="grid grid-cols-2 gap-2 border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Date</div>
            <input
              type="date"
              value={entry.date}
              onChange={(e) => onUpdate({ date: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Type</div>
            <select
              value={entry.type}
              onChange={(e) => onUpdate({ type: e.target.value as MaintenanceLogType })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            >
              {logTypeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Description</div>
            <input
              type="text"
              value={entry.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Parts Used</div>
            <input
              type="text"
              value={entry.partsUsed ?? ''}
              onChange={(e) => onUpdate({ partsUsed: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Labor (min)</div>
            <input
              type="number"
              min={0}
              value={entry.laborMinutes ?? ''}
              onChange={(e) => onUpdate({ laborMinutes: e.target.value ? Number(e.target.value) : undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Technician</div>
            <input
              type="text"
              value={entry.technician ?? ''}
              onChange={(e) => onUpdate({ technician: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={entry.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceLogCard({
  device,
  onUpdate,
}: {
  device: PlacedDevice;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<MaintenanceLogEntry>>({
    date: new Date().toISOString().slice(0, 10),
    type: 'inspection',
    description: '',
  });

  const logs = device.maintenanceLog ?? [];

  function addEntry() {
    if (!form.description?.trim()) return;
    const newEntry: MaintenanceLogEntry = {
      id: `maint-${Date.now()}`,
      date: form.date ?? new Date().toISOString().slice(0, 10),
      type: (form.type as MaintenanceLogType) ?? 'inspection',
      description: form.description.trim(),
      partsUsed: form.partsUsed,
      laborMinutes: form.laborMinutes,
      technician: form.technician,
      notes: form.notes,
    };
    onUpdate({ maintenanceLog: [...logs, newEntry] });
    setForm({ date: new Date().toISOString().slice(0, 10), type: 'inspection', description: '' });
    setShowForm(false);
  }

  function updateEntry(id: string, patch: Partial<MaintenanceLogEntry>) {
    onUpdate({
      maintenanceLog: logs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  function removeEntry(id: string) {
    onUpdate({ maintenanceLog: logs.filter((l) => l.id !== id) });
  }

  return (
    <div className="rounded-md border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
      <div className="flex items-center gap-2 p-2.5">
        <Wrench size={14} className="shrink-0 opacity-70" />
        <span className="flex-1 text-sm font-medium">{device.name}</span>
        <span className="text-[10px] opacity-60">{logs.length} entr{logs.length === 1 ? 'y' : 'ies'}</span>
      </div>
      {logs.length > 0 && (
        <div className="space-y-1 border-t px-2 pb-2 pt-1" style={{ borderColor: 'var(--theme-border)' }}>
          {logs.map((entry) => (
            <LogEntryRow
              key={entry.id}
              entry={entry}
              onUpdate={(patch) => updateEntry(entry.id, patch)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}
        </div>
      )}
      {showForm ? (
        <div className="flex flex-col gap-2 border-t p-2" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MaintenanceLogType }))}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            >
              {logTypeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addEntry}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Entry
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border px-2 py-1 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-1 border-t py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={11} />
          Add maintenance entry
        </button>
      )}
    </div>
  );
}

export function MaintenanceLogPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const devices = layout.devices;
  const summary = useMemo(() => summarizeMaintenance(devices), [devices]);
  const overdue = useMemo(() => upcomingMaintenance(devices), [devices]);

  return (
    <section className="rounded-lg border p-4" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <Wrench size={15} />
          Maintenance Log
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportMaintenanceLogCsv(devices);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'maintenance-log.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            <Download size={11} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const md = exportMaintenanceLogMarkdown(devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'maintenance-log.md';
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
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalEntries}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Entries</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.devicesWithLogs}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Logged</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="flex items-center justify-center gap-1 text-lg font-bold text-slate-900 dark:text-white">
            <Clock size={14} />
            {summary.totalLaborMinutes}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Minutes</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.overdueDevices}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Overdue</div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{overdue.length} maintenance item(s) overdue.</span>
        </div>
      )}

      <div className="space-y-2">
        {devices.map((device) => (
          <DeviceLogCard key={device.id} device={device} onUpdate={(patch) => updateDevice(device.id, patch)} />
        ))}
      </div>
    </section>
  );
}

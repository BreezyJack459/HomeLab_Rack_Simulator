import {
  Download,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  X,
  DollarSign,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { PowerBillEntry } from '../types/rack';
import {
  detectAnomalies,
  exportPowerBillCsv,
  exportPowerBillMarkdown,
  summarizePowerBills,
} from '../utils/powerBill';

function BillRow({
  entry,
  onUpdate,
  onRemove,
  isAnomaly,
}: {
  entry: PowerBillEntry;
  onUpdate: (patch: Partial<PowerBillEntry>) => void;
  onRemove: () => void;
  isAnomaly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md border text-sm"
      style={{
        borderColor: isAnomaly
          ? 'var(--theme-error, #ef4444)'
          : 'var(--theme-border)',
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
        <span className="text-[10px] opacity-60 w-16">{entry.month}</span>
        <span className="flex-1 font-mono text-xs">{entry.actualKwh} kWh</span>
        {entry.actualCost != null && (
          <span className="text-[10px] opacity-70">
            ${entry.actualCost.toFixed(2)}
          </span>
        )}
        {isAnomaly && (
          <AlertTriangle size={13} className="shrink-0 text-amber-500" />
        )}
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
              Month
            </div>
            <input
              type="month"
              value={entry.month}
              onChange={(e) => onUpdate({ month: e.target.value })}
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
              Actual kWh
            </div>
            <input
              type="number"
              min={0}
              step={0.1}
              value={entry.actualKwh}
              onChange={(e) =>
                onUpdate({ actualKwh: Number(e.target.value) })
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
              Actual Cost ($)
            </div>
            <input
              type="number"
              min={0}
              step={0.01}
              value={entry.actualCost ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onUpdate({ actualCost: val });
              }}
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
              Notes
            </div>
            <input
              type="text"
              value={entry.notes ?? ''}
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
        </div>
      )}
    </div>
  );
}

export function PowerBillPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<PowerBillEntry>>({
    month: new Date().toISOString().slice(0, 7),
    actualKwh: 0,
  });

  const entries = layout.powerBillHistory ?? [];
  const summary = useMemo(
    () => summarizePowerBills(entries, layout.devices, layout.electricityRatePerKwh),
    [entries, layout.devices, layout.electricityRatePerKwh]
  );
  const anomalies = useMemo(
    () => detectAnomalies(entries, summary.estimatedMonthlyKwh),
    [entries, summary.estimatedMonthlyKwh]
  );

  const anomalyIds = useMemo(
    () => new Set(anomalies.map((a) => a.entryId)),
    [anomalies]
  );

  function addEntry() {
    if (!form.month || form.actualKwh == null) return;
    const newEntry: PowerBillEntry = {
      id: `bill-${Date.now()}`,
      month: form.month,
      actualKwh: Number(form.actualKwh),
      actualCost: form.actualCost != null ? Number(form.actualCost) : undefined,
      notes: form.notes,
    };
    updateRack({ powerBillHistory: [...entries, newEntry] });
    setForm({
      month: new Date().toISOString().slice(0, 7),
      actualKwh: 0,
    });
    setShowForm(false);
  }

  function updateEntry(id: string, patch: Partial<PowerBillEntry>) {
    updateRack({
      powerBillHistory: entries.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      ),
    });
  }

  function removeEntry(id: string) {
    updateRack({
      powerBillHistory: entries.filter((e) => e.id !== id),
    });
  }

  const variancePositive = summary.varianceKwh > 0;

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
          <DollarSign size={15} />
          Power Bill
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportPowerBillCsv(entries);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'power-bills.csv';
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
              const md = exportPowerBillMarkdown(
                entries,
                layout.devices,
                layout.electricityRatePerKwh
              );
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'power-bills.md';
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
            {entries.length}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Entries
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
            {summary.avgMonthlyKwh.toFixed(0)}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Avg kWh/mo
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
            {summary.estimatedMonthlyKwh.toFixed(0)}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Est. kWh/mo
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div
            className={`text-lg font-bold ${
              variancePositive
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {variancePositive ? '+' : ''}
            {summary.variancePercent}%
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Variance
          </div>
        </div>
      </div>

      {entries.length > 0 && (
        <div
          className="mb-3 rounded-md border p-2 text-xs"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="flex items-center gap-2">
            {variancePositive ? (
              <TrendingUp size={14} className="text-red-500" />
            ) : (
              <TrendingDown size={14} className="text-emerald-500" />
            )}
            <span>
              Actual usage is {Math.abs(summary.variancePercent)}%{' '}
              {variancePositive ? 'above' : 'below'} estimate (
              {summary.avgMonthlyKwh.toFixed(0)} vs{' '}
              {summary.estimatedMonthlyKwh.toFixed(0)} kWh/mo).{' '}
              {variancePositive &&
                'Check for phantom loads or missing devices.'}
            </span>
          </div>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="mb-3 space-y-1">
          {anomalies.map((a) => (
            <div
              key={a.entryId}
              className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-100"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div
          className="mb-3 flex flex-col gap-2 rounded-md border p-2"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="month"
              value={form.month}
              onChange={(e) =>
                setForm((f) => ({ ...f, month: e.target.value }))
              }
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              min={0}
              step={0.1}
              placeholder="kWh"
              value={form.actualKwh ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  actualKwh: e.target.value
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
          </div>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="Cost ($)"
            value={form.actualCost ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                actualCost: e.target.value
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addEntry}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Bill
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
          Add monthly bill
        </button>
      )}

      <div className="space-y-1">
        {[...entries]
          .sort((a, b) => b.month.localeCompare(a.month))
          .map((entry) => (
            <BillRow
              key={entry.id}
              entry={entry}
              onUpdate={(patch) => updateEntry(entry.id, patch)}
              onRemove={() => removeEntry(entry.id)}
              isAnomaly={anomalyIds.has(entry.id)}
            />
          ))}
      </div>
    </section>
  );
}

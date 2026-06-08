import { Download, Ruler, AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { CableLengthAuditEntry } from '../types/rack';
import {
  compareCableLengths,
  exportCableLengthAuditCsv,
  exportCableLengthAuditMarkdown,
  findExcessCables,
  summarizeCableLengthAudits,
} from '../utils/cableLengthAudit';

const statusColors: Record<string, string> = {
  exact: 'text-emerald-600 dark:text-emerald-400',
  close: 'text-cyan-600 dark:text-cyan-400',
  mismatch: 'text-red-600 dark:text-red-400',
  'missing-planned': 'text-amber-600 dark:text-amber-400',
  'missing-actual': 'text-slate-500 dark:text-slate-400',
  'both-missing': 'text-slate-500 dark:text-slate-400',
};

const statusLabels: Record<string, string> = {
  exact: 'Exact',
  close: 'Close',
  mismatch: 'Mismatch',
  'missing-planned': 'No Plan',
  'missing-actual': 'Not Audited',
  'both-missing': 'Unknown',
};

export function CableLengthAuditPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const [filter, setFilter] = useState<'all' | 'audited' | 'issues'>('all');

  const audits = layout.cableLengthAudits ?? [];

  const comparisons = useMemo(
    () => compareCableLengths(layout.cables, audits, layout.devices),
    [layout.cables, audits, layout.devices]
  );

  const excessCables = useMemo(
    () => findExcessCables(layout.cables, audits),
    [layout.cables, audits]
  );

  const summary = useMemo(
    () => summarizeCableLengthAudits(comparisons),
    [comparisons]
  );

  const filteredComparisons = useMemo(() => {
    if (filter === 'audited') {
      return comparisons.filter((c) => c.actualLengthMm != null);
    }
    if (filter === 'issues') {
      return comparisons.filter((c) => c.status === 'mismatch' || c.status === 'missing-planned');
    }
    return comparisons;
  }, [comparisons, filter]);

  function updateAudit(cableId: string, actualLengthMm: number | undefined) {
    const current = audits;
    const existingIndex = current.findIndex((a) => a.cableId === cableId);

    let next: CableLengthAuditEntry[];
    if (actualLengthMm == null) {
      next = current.filter((a) => a.cableId !== cableId);
    } else if (existingIndex >= 0) {
      next = current.map((a, i) =>
        i === existingIndex ? { ...a, actualLengthMm } : a
      );
    } else {
      next = [
        ...current,
        { cableId, actualLengthMm, measuredAt: new Date().toISOString().split('T')[0] },
      ];
    }

    updateRack({ cableLengthAudits: next });
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
          <Ruler size={15} />
          Cable Length Audit
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportCableLengthAuditCsv(comparisons);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cable-length-audit.csv';
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
              const md = exportCableLengthAuditMarkdown(comparisons, excessCables);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cable-length-audit.md';
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
            {summary.totalCables}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Cables
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
            {summary.exactCount + summary.closeCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            OK
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
            {summary.mismatchCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Mismatch
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-500 dark:text-slate-400">
            {summary.missingActualCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Not Audited
          </div>
        </div>
      </div>

      {summary.mismatchCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-800 dark:text-red-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {summary.mismatchCount} cable(s) exceed the 10% tolerance between planned and actual length.
          </span>
        </div>
      )}

      <div className="mb-2 flex gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'all'
              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
              : 'opacity-60'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter('audited')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'audited'
              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
              : 'opacity-60'
          }`}
        >
          Audited
        </button>
        <button
          type="button"
          onClick={() => setFilter('issues')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'issues'
              ? 'bg-red-500/10 text-red-700 dark:text-red-300'
              : 'opacity-60'
          }`}
        >
          Issues
        </button>
      </div>

      <div className="space-y-1">
        {filteredComparisons.map((c) => {
          const hasIssue = c.status === 'mismatch';
          const isMissing = c.status === 'missing-actual' || c.status === 'both-missing';

          return (
            <div
              key={c.cableId}
              className="rounded-md border text-xs"
              style={{
                borderColor: hasIssue
                  ? 'var(--theme-error, #ef4444)'
                  : 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
              }}
            >
              <div className="flex items-center gap-2 p-2">
                {hasIssue ? (
                  <AlertTriangle size={12} className="shrink-0 text-red-500" />
                ) : isMissing ? (
                  <Minus size={12} className="shrink-0 opacity-40" />
                ) : (
                  <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                )}
                <span className="text-[10px] opacity-60 w-16 truncate">
                  {c.cableId}
                </span>
                <span className="flex-1 truncate text-[11px]">
                  {c.fromDeviceName} &rarr; {c.toDeviceName}
                </span>
                <span className="text-[10px] opacity-60">
                  {c.plannedLengthDisplay}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="mm"
                  value={c.actualLengthMm ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    updateAudit(c.cableId, val);
                  }}
                  className="w-16 rounded border px-1 py-0.5 text-right text-[11px]"
                  style={{
                    borderColor: 'var(--theme-border)',
                    backgroundColor: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                  }}
                />
              </div>
              <div
                className="flex items-center gap-2 border-t px-2 py-1 text-[10px]"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <span className={`font-semibold ${statusColors[c.status]}`}>
                  {statusLabels[c.status]}
                </span>
                {c.differenceMm != null && c.differencePercent != null && (
                  <span className="opacity-60">
                    diff {c.differenceMm}mm ({c.differencePercent}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredComparisons.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          {filter === 'issues'
            ? 'No length mismatches found.'
            : 'No cables in this rack.'}
        </div>
      )}

      {excessCables.length > 0 && (
        <div
          className="mt-3 rounded-md border p-2.5"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-60">
            Excess Cable Inventory
          </div>
          <div className="flex flex-wrap gap-1.5">
            {excessCables.map((excess) => {
              const display =
                excess.lengthMm >= 1000
                  ? `${(excess.lengthMm / 1000).toFixed(1)}m`
                  : `${excess.lengthMm}mm`;
              return (
                <span
                  key={excess.lengthMm}
                  className="rounded border px-1.5 py-0.5 text-[10px]"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  {display} &times;{excess.count}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

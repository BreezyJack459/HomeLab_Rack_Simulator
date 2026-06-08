import { Download, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import {
  detectLabelInconsistencies,
  exportCableLabelsCsv,
  exportCableLabelsMarkdown,
  generateAllCableLabels,
} from '../utils/cableLabeling';

export function CableLabelPanel() {
  const layout = useRackStore((state) => state.layout);
  const [filter, setFilter] = useState<'all' | 'inconsistent'>('all');

  const labels = useMemo(
    () => generateAllCableLabels(layout.cables, layout.devices, layout.name),
    [layout.cables, layout.devices, layout.name]
  );

  const inconsistencies = useMemo(
    () => detectLabelInconsistencies(layout.cables, layout.devices),
    [layout.cables, layout.devices]
  );

  const inconsistentIds = useMemo(
    () => new Set(inconsistencies.map((i) => i.cableId)),
    [inconsistencies]
  );

  const filteredLabels = useMemo(() => {
    if (filter === 'inconsistent') {
      return labels.filter((l) => inconsistentIds.has(l.cableId));
    }
    return labels;
  }, [labels, filter, inconsistentIds]);

  const inconsistencyByCable = useMemo(() => {
    const map = new Map<string, typeof inconsistencies>();
    for (const issue of inconsistencies) {
      const existing = map.get(issue.cableId) ?? [];
      existing.push(issue);
      map.set(issue.cableId, existing);
    }
    return map;
  }, [inconsistencies]);

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
          <Tag size={15} />
          Cable Labels
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportCableLabelsCsv(labels);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cable-labels.csv';
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
              const md = exportCableLabelsMarkdown(labels, inconsistencies);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cable-labels.md';
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

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {labels.length}
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
          <div
            className={`text-lg font-bold ${
              inconsistencies.length > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {inconsistencies.length}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Issues
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
            {inconsistentIds.size}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Affected
          </div>
        </div>
      </div>

      {inconsistencies.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {inconsistencies.length} labeling issue(s) detected across{' '}
            {inconsistentIds.size} cable(s).
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
          onClick={() => setFilter('inconsistent')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'inconsistent'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'opacity-60'
          }`}
        >
          Issues Only
        </button>
      </div>

      <div className="space-y-1">
        {filteredLabels.map((label) => {
          const issues = inconsistencyByCable.get(label.cableId) ?? [];
          const hasIssues = issues.length > 0;

          return (
            <div
              key={label.cableId}
              className="rounded-md border text-xs"
              style={{
                borderColor: hasIssues
                  ? 'var(--theme-error, #ef4444)'
                  : 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
              }}
            >
              <div className="flex items-center gap-2 p-2">
                {hasIssues ? (
                  <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                ) : (
                  <CheckCircle2
                    size={12}
                    className="shrink-0 text-emerald-500"
                  />
                )}
                <span className="text-[10px] opacity-60 w-16 truncate">
                  {label.cableId}
                </span>
                <span className="flex-1 truncate font-mono text-[11px]">
                  {label.bothEnds}
                </span>
                <span
                  className="text-[10px] opacity-60"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {label.type}
                </span>
              </div>
              {hasIssues && (
                <div
                  className="border-t px-3 py-1.5 text-[10px] text-amber-700 dark:text-amber-300"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  {issues.map((i) => i.message).join('; ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredLabels.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          {filter === 'inconsistent'
            ? 'No inconsistent cables found.'
            : 'No cables in this rack.'}
        </div>
      )}
    </section>
  );
}

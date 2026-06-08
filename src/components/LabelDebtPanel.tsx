import { Download, Tag, AlertTriangle, CheckCircle2, ChevronDown, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { LabelDebtIssue } from '../utils/labelDebt';
import {
  calculateLabelDebt,
  exportLabelDebtCsv,
  exportLabelDebtMarkdown,
} from '../utils/labelDebt';

const severityColors: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-slate-500 dark:text-slate-400',
};

const severityBg: Record<string, string> = {
  high: 'bg-red-500/10',
  medium: 'bg-amber-500/10',
  low: 'bg-slate-500/10',
};

function IssueRow({ issue }: { issue: LabelDebtIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-md border text-sm ${severityBg[issue.severity] ?? ''}`}
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="opacity-70 transition hover:opacity-100"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        {issue.severity === 'high' ? (
          <AlertTriangle size={12} className="shrink-0 text-red-500" />
        ) : issue.severity === 'medium' ? (
          <AlertTriangle size={12} className="shrink-0 text-amber-500" />
        ) : (
          <Minus size={12} className="shrink-0 opacity-40" />
        )}
        <span className={`text-[10px] font-semibold uppercase ${severityColors[issue.severity]}`}>
          {issue.severity}
        </span>
        <span className="flex-1 truncate text-xs">{issue.message}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ backgroundColor: 'var(--theme-bg-hover)' }}
        >
          {issue.zone}
        </span>
      </div>
      {expanded && (
        <div
          className="border-t px-3 py-2 text-xs"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <div className="grid grid-cols-2 gap-1">
            <span className="opacity-60">Entity:</span>
            <span>{issue.entityType} ({issue.entityId})</span>
            <span className="opacity-60">Issue type:</span>
            <span>{issue.type}</span>
            <span className="opacity-60">Zone:</span>
            <span className="capitalize">{issue.zone}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function LabelDebtPanel() {
  const layout = useRackStore((state) => state.layout);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const report = useMemo(() => calculateLabelDebt(layout), [layout]);

  const filteredIssues = useMemo(() => {
    if (filter === 'all') return report.issues;
    return report.issues.filter((i) => i.severity === filter);
  }, [report.issues, filter]);

  const scoreColor =
    report.overallScore >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : report.overallScore >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

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
          Label Debt
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportLabelDebtCsv(report);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'label-debt.csv';
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
              const md = exportLabelDebtMarkdown(report, layout.name);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'label-debt.md';
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

      {/* Overall Score */}
      <div
        className="mb-3 rounded-md border p-3 text-center"
        style={{
          borderColor: 'var(--theme-border)',
          backgroundColor: 'var(--theme-bg-primary)',
        }}
      >
        <div className={`text-3xl font-bold ${scoreColor}`}>
          {report.overallScore}
        </div>
        <div
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          Label Score / 100
        </div>
      </div>

      {/* Zone Heatmap */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {report.zoneScores.map((zs) => {
          const zoneColor =
            zs.score >= 80
              ? 'text-emerald-600 dark:text-emerald-400'
              : zs.score >= 50
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
          return (
            <div
              key={zs.zone}
              className="rounded-md border p-2 text-center"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
              }}
            >
              <div className={`text-lg font-bold ${zoneColor}`}>{zs.score}</div>
              <div
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {zs.zone}
              </div>
              <div className="mt-1 text-[10px] opacity-60">
                {zs.issueCount}/{zs.totalEntities} issues
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {report.deviceCount}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Devices
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
            {report.cableCount}
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
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {report.totalIssues}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Issues
          </div>
        </div>
      </div>

      {report.totalIssues === 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-100">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>All labels are complete. Great documentation discipline!</span>
        </div>
      )}

      {/* Filter */}
      <div className="mb-2 flex gap-1">
        {(['all', 'high', 'medium', 'low'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
              filter === f
                ? f === 'high'
                  ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                  : f === 'medium'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'opacity-60'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Issue List */}
      <div className="space-y-1">
        {filteredIssues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>

      {filteredIssues.length === 0 && report.totalIssues > 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          No issues match this filter.
        </div>
      )}
    </section>
  );
}

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ValidationIssue } from '../types/rack';
import { recommendationForIssue } from '../utils/validationRecommendations';

interface IssueBarProps {
  issues: ValidationIssue[];
  selectedIssueId: string | null;
  onIssueSelect: (issue: ValidationIssue) => void;
}

export function IssueBar({ issues, selectedIssueId, onIssueSelect }: IssueBarProps) {
  const [open, setOpen] = useState(false);

  const counts = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };

  return (
    <div
      className={`mt-2 rounded-lg border px-2.5 py-1.5 ${
        issues.length
          ? 'border-sky-500/35 bg-sky-500/10'
          : 'border-emerald-500/30 bg-emerald-500/10'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold hover:opacity-80"
          style={{
            backgroundColor: 'var(--theme-bg-primary)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        >
          {issues.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {issues.length ? `${issues.length} layout alerts` : 'Layout clear'}
        </button>
        <span className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-800 dark:text-red-100">
          {counts.critical} critical
        </span>
        <span className="rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-800 dark:text-amber-100">
          {counts.warning} warning
        </span>
        <span className="rounded bg-sky-500/15 px-2 py-1 text-xs text-sky-800 dark:text-sky-100">
          {counts.info} info
        </span>
        {selectedIssueId && (
          <span
            className="min-w-0 flex-1 truncate text-xs"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            {issues.find((i) => i.id === selectedIssueId)?.title ?? 'Selected issue'}
          </span>
        )}
      </div>

      {open && issues.length > 0 && (
        <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto pr-1 thin-scrollbar md:grid-cols-2">
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onIssueSelect(issue)}
              className={`rounded-md border p-2 text-left text-xs transition ${
                selectedIssueId === issue.id ? 'border-cyan-300 bg-cyan-300/10' : ''
              }`}
              style={
                selectedIssueId === issue.id
                  ? {}
                  : {
                      backgroundColor: 'var(--theme-bg-primary)',
                      borderColor: 'var(--theme-border)',
                    }
              }
            >
              <div className="flex items-start gap-2">
                <Info size={13} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-300" />
                <div className="min-w-0">
                  <div className="truncate font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                    {issue.title}
                  </div>
                  <div className="mt-1 line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>
                    {recommendationForIssue(issue)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

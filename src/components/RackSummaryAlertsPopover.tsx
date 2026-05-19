import type { ValidationIssue } from '../types/rack';
import { recommendationForIssue } from '../utils/validationRecommendations';

interface RackSummaryAlertsPopoverProps {
  issues: ValidationIssue[];
  selectedIssueId: string | null;
  onIssueSelect: (issue: ValidationIssue) => void;
}

export function RackSummaryAlertsPopover({
  issues,
  selectedIssueId,
  onIssueSelect,
}: RackSummaryAlertsPopoverProps) {
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const infoCount = issues.filter((issue) => issue.severity === 'info').length;

  return (
    <div className="absolute right-3 top-full z-40 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          Alerts
        </span>
        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
          {criticalCount} critical
        </span>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {warningCount} warning
        </span>
        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
          {infoCount} info
        </span>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-4 text-sm text-emerald-700 dark:text-emerald-300">
          No active layout alerts. The current rack looks clear.
        </div>
      ) : (
        <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 thin-scrollbar md:grid-cols-2">
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onIssueSelect(issue)}
              className={`rounded-xl border p-3 text-left text-xs transition ${
                selectedIssueId === issue.id
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : issue.severity === 'critical'
                    ? 'border-red-500/25 bg-red-500/8'
                    : issue.severity === 'warning'
                      ? 'border-amber-500/25 bg-amber-500/8'
                      : 'border-sky-500/20 bg-sky-500/8'
              }`}
            >
              <div className="font-semibold text-slate-900 dark:text-white">{issue.title}</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">{recommendationForIssue(issue)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

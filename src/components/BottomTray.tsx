import { AlertTriangle, Activity, ChevronDown } from 'lucide-react';
import { IssueBar } from './IssueBar';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import type { ValidationIssue } from '../types/rack';
import type { AppWorkspace } from '../types/appShell';

interface BottomTrayProps {
  issues: ValidationIssue[];
  selectedIssueId: string | null;
  statusMessage: string | null;
  currentWorkspace: AppWorkspace;
  onIssueSelect: (issue: ValidationIssue) => void;
  onOpenAudit: () => void;
}

export function BottomTray({
  issues,
  selectedIssueId,
  statusMessage,
  currentWorkspace,
  onIssueSelect,
  onOpenAudit,
}: BottomTrayProps) {
  const bottomTrayOpen = useLayoutPrefsStore((state) => state.bottomTrayOpen);
  const toggleBottomTray = useLayoutPrefsStore((state) => state.toggleBottomTray);
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const activityPreview = statusMessage ?? 'Workspace ready';

  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-950/95">
      <button
        type="button"
        data-testid="toggle-bottom-tray"
        aria-expanded={bottomTrayOpen}
        onClick={toggleBottomTray}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-slate-100/80 dark:hover:bg-slate-900/80"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <AlertTriangle size={12} />
            Issues & activity
          </span>
          {!bottomTrayOpen && (
            <>
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {issues.length} issues
              </span>
              <span className="max-w-[min(24rem,50vw)] truncate text-xs text-slate-500 dark:text-slate-400">
                {activityPreview}
              </span>
            </>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${bottomTrayOpen ? 'rotate-180' : ''}`} />
      </button>

      {bottomTrayOpen && (
        <div className="grid gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              <AlertTriangle size={12} />
              Issue Tray
            </div>
            <IssueBar issues={issues} selectedIssueId={selectedIssueId} onIssueSelect={onIssueSelect} className="mt-0" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              <Activity size={12} />
              Activity
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{activityPreview}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                Active issues: {issues.length}
              </div>
              {criticalCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-700 dark:text-red-300">
                  {criticalCount} critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {warningCount} warning
                </span>
              )}
            </div>
            {issues.length > 0 && currentWorkspace !== 'audit' && (
              <button
                type="button"
                onClick={onOpenAudit}
                className="mt-3 inline-flex h-8 items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-500/15 dark:text-cyan-300"
              >
                Open audit workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

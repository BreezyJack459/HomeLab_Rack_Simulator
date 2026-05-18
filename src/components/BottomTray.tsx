import { AlertTriangle, Activity, ChevronRight } from 'lucide-react';
import { IssueBar } from './IssueBar';
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
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return (
    <div className="border-t border-slate-200 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <AlertTriangle size={12} />
            Issue Tray
          </div>
          <IssueBar issues={issues} selectedIssueId={selectedIssueId} onIssueSelect={onIssueSelect} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <Activity size={12} />
            Activity
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {statusMessage ?? 'Workspace ready. Use the command bar or switch workspaces to continue.'}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <ChevronRight size={12} />
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
    </div>
  );
}

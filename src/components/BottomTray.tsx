import { AlertTriangle, Activity, ChevronDown } from 'lucide-react';
import { IssueBar } from './IssueBar';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import { summarizeFindings } from '../utils/findingSummary';
import { FindingSummaryBadges } from './FindingSummaryBadges';
import type { RackLayout, ValidationIssue } from '../types/rack';
import type { AppWorkspace } from '../types/appShell';

interface BottomTrayProps {
  issues: ValidationIssue[];
  layout?: Pick<RackLayout, 'findingExceptions'>;
  selectedIssueId: string | null;
  statusMessage: string | null;
  currentWorkspace: AppWorkspace;
  onIssueSelect: (issue: ValidationIssue) => void;
  onOpenAudit: () => void;
}

export function BottomTray({
  issues,
  layout,
  selectedIssueId,
  statusMessage,
  currentWorkspace,
  onIssueSelect,
  onOpenAudit,
}: BottomTrayProps) {
  const bottomTrayOpen = useLayoutPrefsStore((state) => state.bottomTrayOpen);
  const toggleBottomTray = useLayoutPrefsStore((state) => state.toggleBottomTray);
  const summary = summarizeFindings(issues, layout);
  const activityPreview = statusMessage ?? 'Workspace ready';

  return (
    <div className="shrink-0 border-t border-edge bg-fill-subtle/95 dark:border-edge dark:bg-surface/95">
      <button
        type="button"
        data-testid="toggle-bottom-tray"
        aria-expanded={bottomTrayOpen}
        onClick={toggleBottomTray}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-fill/80 dark:hover:bg-surface-raised/80"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-content-faint">
            <AlertTriangle size={12} />
            Issues & activity
          </span>
          {!bottomTrayOpen && (
            <>
              <span className="rounded-full bg-fill-strong/80 px-2 py-0.5 text-xs text-content-secondary dark:bg-fill dark:text-content-secondary">
                {summary.counts.attention} root causes need attention
              </span>
              <span className="max-w-[min(24rem,50vw)] truncate text-xs text-content-muted">
                {activityPreview}
              </span>
            </>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-content-faint transition ${bottomTrayOpen ? 'rotate-180' : ''}`} />
      </button>

      {bottomTrayOpen && (
        <div className="grid gap-3 border-t border-edge px-4 py-3 dark:border-edge lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-content-faint">
              <AlertTriangle size={12} />
              Issue Tray
            </div>
            <IssueBar layout={layout} issues={issues} selectedIssueId={selectedIssueId} onIssueSelect={onIssueSelect} className="mt-0" />
          </div>
          <div className="rounded-2xl border border-edge bg-surface/80 p-3 dark:border-edge dark:bg-surface-raised/70">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-content-faint">
              <Activity size={12} />
              Activity
            </div>
            <div className="text-sm text-content-secondary">{activityPreview}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FindingSummaryBadges counts={summary.counts} />
            </div>
            {issues.length > 0 && currentWorkspace !== 'audit' && (
              <button
                type="button"
                onClick={onOpenAudit}
                className="mt-3 inline-flex h-8 items-center rounded-full border border-accent/30 bg-accent-solid/10 px-3 text-xs font-medium text-accent-fg hover:bg-accent-solid-hover/15 dark:text-accent-fg"
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

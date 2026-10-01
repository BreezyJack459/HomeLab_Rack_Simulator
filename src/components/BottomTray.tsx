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
    <div className="shrink-0 border-t border-edge bg-surface">
      <button
        type="button"
        data-testid="toggle-bottom-tray"
        aria-expanded={bottomTrayOpen}
        aria-controls="rack-activity-tray"
        onClick={toggleBottomTray}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-fill"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-content-secondary">
            <AlertTriangle size={12} />
            Checks & activity
          </span>
          {!bottomTrayOpen && (
            <>
              <span className={`border-l border-edge pl-2 text-xs ${summary.counts.confirmed ? 'text-red-500' : summary.counts.verification ? 'text-amber-600' : 'text-content-secondary'}`}>
                {summary.counts.attention ? `${summary.counts.confirmed} confirmed · ${summary.counts.verification} to verify` : 'No confirmed issues or verification tasks'}
              </span>
              <span className="hidden max-w-[min(24rem,50vw)] truncate border-l border-edge pl-2 text-xs text-content-muted sm:inline">
                {activityPreview}
              </span>
            </>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-content-muted transition-transform motion-reduce:transition-none ${bottomTrayOpen ? 'rotate-180' : ''}`} />
      </button>

      <div id="rack-activity-tray" hidden={!bottomTrayOpen}>
      {bottomTrayOpen && (
        <div className="grid max-h-[40dvh] gap-4 overflow-y-auto border-t border-edge px-4 py-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-content-secondary">
              <AlertTriangle size={12} />
              Findings
            </div>
            <IssueBar layout={layout} issues={issues} selectedIssueId={selectedIssueId} onIssueSelect={onIssueSelect} className="mt-0" />
          </div>
          <div className="min-w-0 border-t border-edge pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-content-secondary">
              <Activity size={12} />
              Activity
            </div>
            <div role="status" className="break-words text-sm leading-6 text-content-secondary">{activityPreview}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FindingSummaryBadges counts={summary.counts} />
            </div>
            {issues.length > 0 && currentWorkspace !== 'audit' && (
              <button
                type="button"
                onClick={onOpenAudit}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-accent bg-accent-subtle px-3 text-xs font-semibold text-accent-fg hover:bg-fill-strong"
              >
                Open audit workspace
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

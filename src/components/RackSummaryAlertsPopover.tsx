import type { RackLayout, ValidationIssue } from '../types/rack';
import { recommendationForIssue } from '../utils/validationRecommendations';
import { summarizeFindings, findingSectionLabels } from '../utils/findingSummary';
import { FindingSummaryBadges } from './FindingSummaryBadges';
import { issueGroupTitle } from '../utils/checkWorkflow';

interface RackSummaryAlertsPopoverProps {
  issues: ValidationIssue[];
  layout?: Pick<RackLayout, 'findingExceptions'>;
  selectedIssueId: string | null;
  onIssueSelect: (issue: ValidationIssue) => void;
}

export function RackSummaryAlertsPopover({ issues, layout, selectedIssueId, onIssueSelect }: RackSummaryAlertsPopoverProps) {
  const summary = summarizeFindings(issues, layout);
  const titles = findingSectionLabels;
  return (
    <div className="absolute right-3 top-full z-40 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-edge bg-surface p-3 shadow-xl">
      <div className="mb-3 text-xs text-content-secondary" aria-label="Finding summary">
        <FindingSummaryBadges counts={summary.counts} />
      </div>
      {summary.groups.length === 0 ? <p className="rounded-xl border border-edge px-3 py-4 text-sm text-content-secondary">No reported layout checks. This does not verify the physical installation.</p> : (
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1 thin-scrollbar">
          {(['confirmed', 'verification', 'information', 'accepted'] as const).map(section => {
            const groups = summary.groups.filter(group => group.section === section);
            if (!groups.length) return null;
            return <section key={section} aria-label={titles[section]}>
              <h3 className="mb-2 text-xs font-semibold">{titles[section]} · {groups.length}</h3>
              <div className="space-y-2">{groups.map(group => <details key={group.key}
                open={group.issues.some(issue => issue.id === selectedIssueId)} className="rounded-xl border border-edge p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-content">{issueGroupTitle(group.representative)} · {group.issues.length} {group.issues.length === 1 ? 'check' : 'checks'}{group.acceptance === 'reopened' ? ' · Reopened' : ''}</summary>
                <p className="mt-2 text-content-muted">{group.status === 'unknown' ? 'Unverified' : group.status} · {group.severity} · {group.deviceIds.length} devices · {group.cableIds.length} cables</p>
                {group.exception && <p className="mt-1 text-content-muted">{group.acceptance === 'reopened' ? 'Previous exception' : 'Exception'}: {group.exception.reason}</p>}
                <p className="mt-1 text-content-muted">{recommendationForIssue(group.representative)}</p>
                {group.issues.map(issue => <button key={issue.id} type="button" aria-pressed={selectedIssueId === issue.id}
                  onClick={() => onIssueSelect(issue)} className="mt-2 w-full rounded border border-edge p-2 text-left hover:bg-fill">
                  <span className="block font-semibold">{issue.title}</span>
                  <span className="block text-content-muted">Result: {issue.status ?? 'unknown'} · {issue.severity}</span>
                  <span className="block text-content-muted">{issue.detail}</span>
                  <span className="mt-1 block text-accent-fg">Inspect check & actions</span>
                </button>)}
              </details>)}</div>
            </section>;
          })}
          <p className="text-xs text-content-muted">Accepted exceptions retain their evidence. Raw checks and assumptions remain available in each root cause.</p>
        </div>
      )}
    </div>
  );
}

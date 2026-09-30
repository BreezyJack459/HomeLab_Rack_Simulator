import { FindingSummaryBadges } from "./FindingSummaryBadges";
import { useEffect, useRef } from "react";
import { issueGroupTitle } from "../utils/checkWorkflow";
import { issueMatchesCategory, summarizeFindings, findingSectionLabels, type FindingSection } from "../utils/findingSummary";
import type { RackLayout, ValidationIssue } from "../types/rack";
import type { AuditLens } from "../types/appShell";

export type FindingFilter = 'attention' | ValidationIssue['severity'] | 'all' | FindingSection;

export function CheckSidebar({
  issues,
  layout,
  selectedId,
  onSelect,
  lens,
  onLens,
  severity,
  onSeverity,
  category,
  onCategory,
  strictCabling,
  onStrictCabling,
}: {
  issues: ValidationIssue[];
  layout?: Pick<RackLayout, 'findingExceptions'>;
  selectedId: string | null;
  onSelect: (issue: ValidationIssue) => void;
  lens: AuditLens;
  onLens: (lens: AuditLens) => void;
  severity: FindingFilter;
  onSeverity: (severity: FindingFilter) => void;
  category: 'overview' | 'thermal' | 'power' | 'capacity' | 'weight' | 'cable';
  onCategory: (category: 'overview' | 'thermal' | 'power' | 'capacity' | 'weight' | 'cable') => void;
  strictCabling: boolean;
  onStrictCabling: (strict: boolean) => void;
}) {
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedButton.current?.scrollIntoView?.({ block: 'nearest' }); }, [selectedId]);
  const summary = summarizeFindings(issues, layout);
  const visibleGroups = summary.groups.filter(group => group.issues.some(issue => issueMatchesCategory(issue, category)))
    .filter(group => severity === 'all' || (severity === 'attention'
      ? group.section === 'confirmed' || group.section === 'verification'
      : (['confirmed', 'verification', 'information', 'accepted'] as string[]).includes(severity) ? group.section === severity : group.issues.some(issue => issue.severity === severity)));
  const sectionTitles = findingSectionLabels;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 max-h-[55%] shrink-0 space-y-3 overflow-y-auto border-b border-edge p-3">
        <h2 className="text-sm font-semibold">
          Check · {visibleGroups.length} of {summary.counts.roots} root causes
        </h2>
        <FindingSummaryBadges counts={summary.counts} />
        <label className="block text-xs text-content-muted">
          Show
          <select aria-label="Issue severity" value={severity} onChange={(event) => onSeverity(event.target.value as typeof severity)} className="mt-1 h-9 w-full rounded-lg border border-edge bg-fill px-2 text-xs">
            <option value="attention">Action & verification</option>
            {(['confirmed', 'verification', 'information', 'accepted'] as const).map(section => <option key={section} value={section}>{findingSectionLabels[section]}</option>)}
            <option value="critical">Raw critical severity</option>
            <option value="warning">Raw warning severity</option>
            <option value="info">Raw info severity</option>
            <option value="all">All checks & accepted exceptions</option>
          </select>
        </label>
        <label className="block text-xs text-content-muted">
          Issue topic
          <select aria-label="Issue topic" value={category} onChange={(event) => onCategory(event.target.value as typeof category)} className="mt-1 h-9 w-full rounded-lg border border-edge bg-fill px-2 text-xs">
            <option value="overview">All topics</option>
            <option value="thermal">Thermal & airflow</option>
            <option value="power">Power</option>
            <option value="capacity">Rack fit & capacity</option>
            <option value="weight">Weight</option>
            <option value="cable">Cables & ports</option>
          </select>
        </label>
        <details className="rounded-lg border border-edge p-2">
          <summary className="cursor-pointer text-xs font-semibold">Cabling rules</summary>
          <label className="mt-2 block text-xs text-content-muted">
          Direct switch connections
          <select aria-label="Direct switch connections" value={strictCabling ? 'strict' : 'homelab'} onChange={(event) => onStrictCabling(event.target.value === 'strict')} className="mt-1 h-9 w-full rounded-lg border border-edge bg-fill px-2 text-xs">
            <option value="homelab">Homelab — allowed</option>
            <option value="strict">Structured cabling — flag direct links</option>
          </select>
          </label>
        </details>
        <label className="block text-xs text-content-muted">
          Inspection view
          <select
            aria-label="Check category"
            value={lens}
            onChange={(e) => onLens(e.target.value as AuditLens)}
            className="mt-1 h-9 w-full rounded-lg border border-edge bg-fill px-2 text-xs"
          >
            {Object.entries({
              overview: "Rack overview",
              issues: "Issue queue",
              serviceability: "Serviceability",
              documentation: "Documentation",
              thermal: "Thermal & airflow",
              domains: "Failure domains",
            }).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        {(severity !== 'attention' || category !== 'overview') && (
          <div className="text-xs text-content-secondary">
            <p>Filtered by: {category === 'overview' ? 'all topics' : category} · {severity}</p>
            <button type="button" onClick={() => { onCategory('overview'); onSeverity('attention'); }} className="mt-2 rounded-lg border border-edge px-3 py-2 hover:bg-fill">Reset issue filters</button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {(['confirmed', 'verification', 'information', 'accepted'] as const).map(section => {
          const sectionGroups = visibleGroups.filter(group => group.section === section);
          if (!sectionGroups.length) return null;
          return <section key={section} aria-label={sectionTitles[section]} className="space-y-2">
            <h3 className="px-1 pt-2 text-xs font-semibold">{sectionTitles[section]} · {sectionGroups.length}</h3>
            {section === 'verification' && <p className="px-1 text-xs leading-5 text-content-muted">Missing or unreviewed evidence. Unknown checks do not confirm either a conflict or a pass.</p>}
            {section === 'accepted' && <p className="px-1 text-xs leading-5 text-content-muted">Recorded exceptions remain inspectable. Acceptance does not verify the installation or resolve a conflict.</p>}
            {sectionGroups.map(group => <details key={group.key}
              open={group.issues.some(issue => issue.id === selectedId) || group.issues.length === 1}
              className="rounded-lg border border-edge p-2">
              <summary className="cursor-pointer text-xs font-semibold">
                <span className={group.severity === 'critical' ? 'text-red-500' : group.status === 'unknown' ? 'text-content-secondary' : group.severity === 'warning' ? 'text-amber-500' : 'text-content-muted'}>{group.status === 'unknown' ? 'unverified' : group.severity}</span>
                {' · '}{issueGroupTitle(group.representative)}{' '}
                <span className="text-content-muted">({group.issues.length} {group.issues.length === 1 ? 'check' : 'checks'})</span>
                {group.acceptance === 'reopened' && <span className="ml-1 text-amber-500">Reopened</span>}
              </summary>
              {group.exception && <p className="mt-2 text-xs text-content-muted">{group.acceptance === 'reopened' ? 'Previous exception' : 'Exception'}: {group.exception.reason}</p>}
              <p className="mt-2 text-xs text-content-muted">Affected: {group.deviceIds.length} devices · {group.cableIds.length} cables</p>
              <div className="mt-2 space-y-1">{group.issues.map(issue => <button key={issue.id}
                ref={issue.id === selectedId ? selectedButton : undefined}
                type="button" aria-pressed={issue.id === selectedId}
                onClick={() => onSelect(issue)}
                className={`w-full rounded p-2 text-left text-xs leading-5 ${issue.id === selectedId ? 'bg-accent-subtle text-accent-fg' : 'hover:bg-fill text-content-secondary'}`}>
                <span className="mb-1 block font-semibold">{issue.title}</span>
                {!!issue.cableIds?.length && <span className="mb-1 block text-content-muted">Cable: {issue.cableIds.join(', ')}</span>}
                {!!issue.deviceIds?.length && <span className="mb-1 block text-content-muted">Device: {issue.deviceIds.join(', ')}</span>}
                <span className="mb-1 block text-content-muted">Result: {issue.status ?? 'unknown'} · Raw severity: {issue.severity}</span>
                {issue.detail}
              </button>)}</div>
            </details>)}
          </section>;
        })}
        {visibleGroups.length === 0 && (
          <p className="p-3 text-xs text-content-muted">
            {issues.length === 0 ? "No reported checks. This does not verify the physical installation." : "No issues match these filters. Choose All checks & accepted exceptions or another topic to inspect more."}
          </p>
        )}
      </div>
    </div>
  );
}

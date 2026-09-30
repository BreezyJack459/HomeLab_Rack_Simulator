import { useEffect, useRef } from "react";
import { issueGroupTitle } from "../utils/checkWorkflow";
import { isThermalIssue } from "../utils/issueCategories";
import type { ValidationIssue } from "../types/rack";
import type { AuditLens } from "../types/appShell";

export function CheckSidebar({
  issues,
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
  selectedId: string | null;
  onSelect: (issue: ValidationIssue) => void;
  lens: AuditLens;
  onLens: (lens: AuditLens) => void;
  severity: 'attention' | ValidationIssue['severity'] | 'all';
  onSeverity: (severity: 'attention' | ValidationIssue['severity'] | 'all') => void;
  category: 'overview' | 'thermal' | 'power' | 'capacity' | 'weight' | 'cable';
  onCategory: (category: 'overview' | 'thermal' | 'power' | 'capacity' | 'weight' | 'cable') => void;
  strictCabling: boolean;
  onStrictCabling: (strict: boolean) => void;
}) {
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedButton.current?.scrollIntoView?.({ block: 'nearest' }); }, [selectedId]);
  const groups = new Map<string, ValidationIssue[]>();
  const categoryIssues = issues.filter((issue) => {
    if (category === 'cable') return !!issue.cableIds?.length || /^(cable-|patch-|structured-|duplicate-port-|invalid-port-|stale-endpoint-|outlet-|endpoint-switch-)/.test(issue.id);
    if (category === 'thermal') return isThermalIssue(issue);
    if (category === 'power') return /^(power-|circuit-|redundancy-|dual-psu-|pdu-|outlet-)/.test(issue.id);
    if (category === 'weight') return /^(weight-|heavy-|center-of-gravity)/.test(issue.id);
    if (category === 'capacity') return /^(installation-|bounds-|overlap-|width-|depth-|reservation-|physical-height-|tray-height-|zone-)/.test(issue.id);
    return true;
  });
  const visibleIssues = categoryIssues.filter((issue) => severity === 'all' ||
    (severity === 'attention' ? issue.severity !== 'info' : issue.severity === severity));
  const sorted = [...visibleIssues].sort(
    (a, b) =>
      ["critical", "warning", "info"].indexOf(a.severity) -
      ["critical", "warning", "info"].indexOf(b.severity),
  );
  for (const issue of sorted) {
    const key = `${issue.evidence ?? "issue"}:${issue.severity}:${issueGroupTitle(issue)}`;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-edge p-3">
        <h2 className="text-sm font-semibold">
          Check · {visibleIssues.length} of {issues.length} issues
        </h2>
        <p className="text-xs text-content-secondary">
          {issues.filter((issue) => issue.severity === 'critical').length} critical · {issues.filter((issue) => issue.severity === 'warning').length} warnings · {issues.filter((issue) => issue.severity === 'info').length} suggestions
        </p>
        <label className="block text-xs text-content-muted">
          Show
          <select aria-label="Issue severity" value={severity} onChange={(event) => onSeverity(event.target.value as typeof severity)} className="mt-1 h-9 w-full rounded-lg border border-edge bg-fill px-2 text-xs">
            <option value="attention">Critical & warnings</option>
            <option value="critical">Critical only</option>
            <option value="warning">Warnings only</option>
            <option value="info">Suggestions only</option>
            <option value="all">All issues & suggestions</option>
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
        {(['issues', 'unverified'] as const).map((section) => {
          const sectionGroups = [...groups].filter(([, group]) => (group[0].evidence === 'unverified') === (section === 'unverified'));
          const count = sectionGroups.reduce((sum, [, group]) => sum + group.length, 0);
          if (!count) return null;
          return <section key={section} aria-label={section === 'unverified' ? 'Needs verification' : 'Issues to address'} className="space-y-2">
            <h3 className="px-1 pt-2 text-xs font-semibold">{section === 'unverified' ? 'Needs verification' : 'Issues to address'} · {count}</h3>
            {section === 'unverified' && <p className="px-1 text-xs leading-5 text-content-muted">Missing or unreviewed information. These checks remain unverified; warning levels are unchanged.</p>}
            {sectionGroups.map(([key, group]) => (
          <details
            key={key}
            open={group.some((i) => i.id === selectedId) || group.length === 1}
            className="rounded-lg border border-edge p-2"
          >
            <summary className="cursor-pointer text-xs font-semibold">
              <span
                className={
                  group[0].severity === "critical"
                    ? "text-red-500"
                    : group[0].severity === "warning"
                      ? "text-amber-500"
                      : "text-content-muted"
                }
              >
                {group[0].severity}
              </span>{" "}
              · {issueGroupTitle(group[0])}{" "}
              <span className="text-content-muted">({group.length})</span>
            </summary>
            <div className="mt-2 space-y-1">
              {group.map((issue) => (
                <button
                  key={issue.id}
                  ref={issue.id === selectedId ? selectedButton : undefined}
                  type="button"
                  aria-pressed={issue.id === selectedId}
                  onClick={() => onSelect(issue)}
                  className={`w-full rounded p-2 text-left text-xs leading-5 ${issue.id === selectedId ? "bg-accent-subtle text-accent-fg" : "hover:bg-fill text-content-secondary"}`}
                >
                  {group.length > 1 && issue.title !== issueGroupTitle(issue) && <span className="mb-1 block font-semibold">{issue.title}{' '}</span>}
                  {issue.id.startsWith('cable-strain-') && issue.cableIds?.length && <span className="mb-1 block text-content-muted">Cable: {issue.cableIds.join(', ')}{' '}</span>}
                  {issue.detail}
                </button>
              ))}
            </div>
          </details>
        ))}</section>;
        })}
        {visibleIssues.length === 0 && (
          <p className="p-3 text-xs text-content-muted">
            {issues.length === 0 ? "No issues found." : "No issues match these filters. Choose All issues & suggestions or another topic to see more."}
          </p>
        )}
      </div>
    </div>
  );
}

import type { ValidationIssue } from "../types/rack";
import type { AuditLens } from "../types/appShell";

export function CheckSidebar({
  issues,
  selectedId,
  onSelect,
  lens,
  onLens,
}: {
  issues: ValidationIssue[];
  selectedId: string | null;
  onSelect: (issue: ValidationIssue) => void;
  lens: AuditLens;
  onLens: (lens: AuditLens) => void;
}) {
  const groups = new Map<string, ValidationIssue[]>();
  const sorted = [...issues].sort(
    (a, b) =>
      ["critical", "warning", "info"].indexOf(a.severity) -
      ["critical", "warning", "info"].indexOf(b.severity),
  );
  for (const issue of sorted) {
    const key = `${issue.severity}:${issue.title}`;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-edge p-3">
        <h2 className="text-sm font-semibold">
          Check · {issues.length} issues
        </h2>
        <label className="block text-xs text-content-muted">
          Check category
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
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {[...groups].map(([key, group]) => (
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
              · {group[0].title}{" "}
              <span className="text-content-muted">({group.length})</span>
            </summary>
            <div className="mt-2 space-y-1">
              {group.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  aria-pressed={issue.id === selectedId}
                  onClick={() => onSelect(issue)}
                  className={`w-full rounded p-2 text-left text-xs leading-5 ${issue.id === selectedId ? "bg-accent-subtle text-accent-fg" : "hover:bg-fill text-content-secondary"}`}
                >
                  {issue.detail}
                </button>
              ))}
            </div>
          </details>
        ))}
        {issues.length === 0 && (
          <p className="p-3 text-xs text-content-muted">
            No issues found. Explore the check categories for more detail.
          </p>
        )}
      </div>
    </div>
  );
}

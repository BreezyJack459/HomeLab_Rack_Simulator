import type { ValidationIssue } from "../types/rack";
import { recommendationForIssue } from "../utils/validationRecommendations";
import { explainIssue } from "../utils/validationExplanations";

export function CheckIssueDetails({
  issue,
  onEdit,
}: {
  issue: ValidationIssue | null;
  onEdit: () => void;
}) {
  if (!issue)
    return (
      <p className="text-sm leading-6 text-content-muted">
        Select an issue from the left to see the affected equipment and how to
        fix it.
      </p>
    );
  const explanation = explainIssue(issue.id);
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-content-muted">
        {issue.severity}
      </p>
      <h3 className="font-semibold">{issue.title}</h3>
      <p className="text-sm leading-6 text-content-secondary">{issue.detail}</p>
      <div className="rounded-lg border border-edge bg-fill p-3">
        <h4 className="text-xs font-semibold">Suggested fix</h4>
        <p className="mt-2 text-xs leading-5 text-content-secondary">
          {recommendationForIssue(issue)}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-lg bg-accent-solid px-3 py-2 text-sm text-accent-on"
      >
        {issue.cableIds?.length ? "Open in Cable" : "Open in Build"}
      </button>
      {explanation && (
        <details className="rounded-lg border border-edge p-3">
          <summary className="cursor-pointer text-xs font-semibold">
            Why this matters
          </summary>
          <p className="mt-2 text-xs leading-5 text-content-muted">
            {explanation.whyItMatters}
          </p>
          <p className="mt-2 text-xs leading-5 text-content-muted">
            {explanation.whenAcceptableToIgnore}
          </p>
        </details>
      )}
    </div>
  );
}

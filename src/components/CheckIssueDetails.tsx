import type { ValidationIssue } from "../types/rack";
import { recommendationForIssue } from "../utils/validationRecommendations";
import { explainIssue } from "../utils/validationExplanations";
import { PlanningGoalsControls } from './PlanningGoalsControls';
import { FindingExceptionControls } from './FindingExceptionControls';
import { useRackStore } from '../store/rackStore';

export type CheckEditTarget = { deviceId?: string; cableId?: string };

export function CheckIssueDetails({
  issue,
  onEdit,
  onEditRack,
  reviewedTitle,
  onEditTarget,
}: {
  issue: ValidationIssue | null;
  onEdit: () => void;
  onEditRack: () => void;
  reviewedTitle?: string;
  onEditTarget?: (target: CheckEditTarget) => void;
}) {
  const layout = useRackStore(state => state.layout);
  if (!issue)
    return (
      <div className="space-y-3">
      <PlanningGoalsControls />
      <p className="text-sm leading-6 text-content-muted">
        {reviewedTitle ? `“${reviewedTitle}” is no longer reported in the current rack. Review the remaining issues on the left; this does not verify the physical installation.` : 'Select an issue from the left to see the affected equipment and how to fix it.'}
      </p>
      </div>
    );
  const explanation = explainIssue(issue.id);
  return (
    <div className="space-y-3">
      <PlanningGoalsControls />
      <p className="text-xs font-semibold uppercase text-content-muted">
        {issue.status === 'fail' ? `${issue.severity} · Recorded conflict` : issue.status === 'pass' ? 'Recorded check passed' : 'Needs verification'}
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
        onClick={issue.editTarget || issue.cableIds?.length || issue.deviceIds?.length ? onEdit : onEditRack}
        className="w-full rounded-lg bg-accent-solid px-3 py-2 text-sm text-accent-on"
      >
        {issue.editTarget ? "Edit device" : issue.cableIds?.length ? "Edit cable" : issue.deviceIds?.length ? "Edit device" : "Adjust rack settings"}
      </button>
      {!!issue.deviceIds?.length && !issue.cableIds?.length && (
        <button type="button" onClick={onEditRack} className="w-full rounded-lg border border-edge px-3 py-2 text-sm hover:bg-fill">Adjust rack settings</button>
      )}
      {onEditTarget && ((issue.deviceIds?.length ?? 0) + (issue.cableIds?.length ?? 0) > 1) && <details className="rounded-lg border border-edge p-3">
        <summary className="cursor-pointer text-xs font-semibold">Affected equipment and routes</summary>
        <div className="mt-2 flex flex-col gap-2">
          {(issue.deviceIds ?? []).map(id => <button key={`device-${id}`} type="button" onClick={() => onEditTarget({ deviceId: id })} className="rounded-lg border border-edge p-2 text-left text-xs hover:bg-fill">Edit device: {layout.devices.find(device => device.id === id)?.name ?? id}</button>)}
          {(issue.cableIds ?? []).map(id => <button key={`cable-${id}`} type="button" onClick={() => onEditTarget({ cableId: id })} className="rounded-lg border border-edge p-2 text-left text-xs hover:bg-fill">Edit cable: {layout.cables.find(cable => cable.id === id)?.label ?? id}</button>)}
        </div>
      </details>}
      <FindingExceptionControls issue={issue} />
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

import { ArrowLeftRight, AlertTriangle, CheckCircle2, ChevronDown, History, ShieldAlert, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { buildChangeReview } from '../utils/changeRisk';
import { diffLayouts } from '../utils/layoutDiff';
import type { RollbackStep } from '../utils/changeRisk';
import type { RiskLevel } from '../utils/changeRisk';

const riskColor: Record<RiskLevel, string> = {
  low: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  high: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

const riskBg: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/10 border-emerald-500/30',
  medium: 'bg-amber-500/10 border-amber-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  critical: 'bg-red-500/10 border-red-500/30',
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${riskBg[level]} ${riskColor[level]}`}>
      {level} Risk
    </span>
  );
}

function RollbackStepItem({ step }: { step: RollbackStep }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 shrink-0 rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
        {step.order}
      </span>
      <div>
        <div className="font-medium">{step.action}</div>
        <div className="opacity-70">{step.description}</div>
      </div>
    </div>
  );
}

export function ChangeReviewPanel() {
  const layout = useRackStore((state) => state.layout);
  const baseline = layout.goldenBaseline;
  const [showRollback, setShowRollback] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showValidationDelta, setShowValidationDelta] = useState(false);

  const review = useMemo(() => {
    if (!baseline) return null;
    const beforeLayout: typeof layout = {
      ...baseline.snapshot,
      id: baseline.snapshot.name,
      updatedAt: baseline.capturedAt,
    };
    const diff = diffLayouts(beforeLayout, layout);
    return buildChangeReview(diff, beforeLayout, layout);
  }, [baseline, layout]);

  if (!baseline) {
    return (
      <section
        className="rounded-lg border p-4"
        style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <ArrowLeftRight size={15} />
          Change Review
        </div>
        <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          <History size={14} className="mt-0.5 shrink-0 opacity-60" />
          No golden baseline captured. Capture a baseline in the Golden Baseline panel to enable change risk review.
        </div>
      </section>
    );
  }

  if (!review || review.diff.changes.length === 0) {
    return (
      <section
        className="rounded-lg border p-4"
        style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <ArrowLeftRight size={15} />
          Change Review
        </div>
        <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
          No changes detected vs baseline ({new Date(baseline.capturedAt).toLocaleDateString()}).
        </div>
      </section>
    );
  }

  const { diff, risk, rollback, affectedServices, validationIssuesBefore, validationIssuesAfter } = review;
  const validationDelta = validationIssuesAfter.length - validationIssuesBefore.length;

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <ArrowLeftRight size={15} />
          Change Review
        </div>
        <RiskBadge level={risk.level} />
      </div>

      {/* Score */}
      <div className="mb-3 rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${riskColor[risk.level]}`}>{risk.score}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Risk Score / 100</div>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full ${risk.level === 'critical' ? 'bg-red-500' : risk.level === 'high' ? 'bg-orange-500' : risk.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${risk.score}%` }}
          />
        </div>
      </div>

      {/* Diff summary */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[
          { label: 'Devices', value: diff.addedDevices.length + diff.removedDevices.length + diff.movedDevices.length },
          { label: 'Cables', value: diff.addedCables.length + diff.removedCables.length + diff.rewiredCables.length },
          { label: 'Properties', value: diff.layoutPropertyChanges.length },
          { label: 'Issues Δ', value: validationDelta > 0 ? `+${validationDelta}` : validationDelta },
        ].map((s) => (
          <div key={s.label} className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Risk reasons */}
      {risk.reasons.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Risk Factors</div>
          {risk.reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
              <ShieldAlert size={13} className={`mt-0.5 shrink-0 ${riskColor[reason.severity]}`} />
              <span style={{ color: 'var(--theme-text-secondary)' }}>{reason.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Affected services */}
      {affectedServices.length > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowServices((v) => !v)}
            className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <ChevronDown size={12} className={`transition-transform ${showServices ? '' : '-rotate-90'}`} />
            Affected Services ({affectedServices.length})
          </button>
          {showServices && (
            <div className="flex flex-wrap gap-1.5">
              {affectedServices.map((svc) => (
                <span
                  key={svc}
                  className="rounded border px-2 py-0.5 text-[10px]"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)', color: 'var(--theme-text-secondary)' }}
                >
                  {svc}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rollback plan */}
      {rollback.steps.length > 0 && (
        <div className="mb-3 rounded-md border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <button
            type="button"
            onClick={() => setShowRollback((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <Wrench size={13} />
            Rollback Plan ({rollback.steps.length} steps, ~{rollback.estimatedDowntimeMin} min)
            <ChevronDown size={12} className={`ml-auto transition-transform ${showRollback ? '' : '-rotate-90'}`} />
          </button>
          {showRollback && (
            <div className="space-y-2 border-t px-3 py-2.5" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="space-y-2">
                {rollback.steps.map((step) => (
                  <RollbackStepItem key={step.order} step={step} />
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t pt-2 text-[10px]" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="font-medium uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Pre-change checklist</div>
                {rollback.preChecklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 size={11} className="mt-0.5 shrink-0 opacity-50" />
                    <span style={{ color: 'var(--theme-text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1 border-t pt-2 text-[10px]" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="font-medium uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Post-change checklist</div>
                {rollback.postChecklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 size={11} className="mt-0.5 shrink-0 opacity-50" />
                    <span style={{ color: 'var(--theme-text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation delta */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setShowValidationDelta((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <ChevronDown size={12} className={`transition-transform ${showValidationDelta ? '' : '-rotate-90'}`} />
          Validation Issues: {validationIssuesBefore.length} → {validationIssuesAfter.length}
          {validationDelta > 0 && <span className="ml-1 text-red-500">(+{validationDelta})</span>}
          {validationDelta < 0 && <span className="ml-1 text-emerald-500">({validationDelta})</span>}
        </button>
        {showValidationDelta && (
          <div className="mt-1.5 space-y-1">
            {validationIssuesAfter.map((issue) => (
              <div key={issue.id} className="flex items-start gap-1.5 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
                <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-500" />
                <span style={{ color: 'var(--theme-text-secondary)' }}>{issue.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

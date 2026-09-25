import type { RackLayout, ValidationIssue } from '../types/rack';
import type { getRackTotals } from '../utils/validation';

type RackTotals = ReturnType<typeof getRackTotals>;
type StripLayout = Pick<RackLayout, 'heightU' | 'powerBudgetW' | 'weightLimitKg'>;

export type HealthChipStatus = 'good' | 'warn' | 'critical' | 'unconfigured';

const STATUS_CLASSES: Record<HealthChipStatus, { dot: string; bar: string }> = {
  good: { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  warn: { dot: 'bg-amber-500', bar: 'bg-amber-500' },
  critical: { dot: 'bg-red-500', bar: 'bg-red-500' },
  unconfigured: { dot: 'bg-content-faint', bar: 'bg-content-faint' },
};

// Capacity fills up faster than it can be re-planned, so it warns earlier
// (85%) than power/weight (80%); everything turns red at 100%.
const statusForPercent = (percent: number, warnAt: number): HealthChipStatus =>
  percent >= 100 ? 'critical' : percent >= warnAt ? 'warn' : 'good';

const percentOf = (value: number, denominator: number) =>
  denominator > 0 ? (value / denominator) * 100 : 0;

const HEAT_ISSUE_PATTERN = /heat|airflow|thermal/i;

export const countHeatIssues = (issues: ValidationIssue[]) =>
  issues.filter((issue) => HEAT_ISSUE_PATTERN.test(`${issue.id} ${issue.title}`)).length;

interface RackHealthStripProps {
  totals: RackTotals;
  layout: StripLayout;
  issues: ValidationIssue[];
}

function HealthChip({
  label,
  valueText,
  percent,
  status,
  testId,
  onClick,
}: {
  label: string;
  valueText: string;
  percent: number;
  status: HealthChipStatus;
  testId: string;
  onClick?: () => void;
}) {
  const colors = STATUS_CLASSES[status];
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="flex min-w-[7.5rem] items-center gap-2 rounded-full border border-edge bg-surface/70 px-2.5 py-1 dark:border-edge dark:bg-surface-raised/60"
      data-testid={testId}
      data-status={status}
      title={`${label}: ${valueText}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} aria-hidden />
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-content-faint">
        {label}
      </span>
      <span className="whitespace-nowrap text-xs font-medium text-content-secondary dark:text-content-secondary">
        {valueText}
      </span>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-fill dark:bg-fill" aria-hidden>
        <span
          className={`block h-full rounded-full ${colors.bar}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </span>
    </Component>
  );
}

export function RackHealthStrip({
  totals,
  layout,
  issues,
  onOpenCheck,
}: RackHealthStripProps & { onOpenCheck?: () => void }) {
  const capacityPct = percentOf(totals.occupiedU, layout.heightU);
  const powerPct = percentOf(totals.powerW, layout.powerBudgetW);
  const weightPct = percentOf(totals.weightKg, layout.weightLimitKg);
  const heatCount = countHeatIssues(issues);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-testid="rack-health-strip"
      aria-label="Rack health summary"
    >
      <HealthChip
        label="Capacity"
        valueText={`${totals.occupiedU}/${layout.heightU}U`}
        percent={capacityPct}
        status={statusForPercent(capacityPct, 85)}
        testId="health-chip-capacity"
        onClick={onOpenCheck}
      />
      <HealthChip
        label="Power"
        valueText={layout.powerBudgetW > 0 ? `${totals.powerW}/${layout.powerBudgetW}W` : 'Not configured'}
        percent={powerPct}
        status={layout.powerBudgetW > 0 ? statusForPercent(powerPct, 80) : 'unconfigured'}
        testId="health-chip-power"
        onClick={onOpenCheck}
      />
      <HealthChip
        label="Weight"
        valueText={layout.weightLimitKg > 0 ? `${totals.weightKg}/${layout.weightLimitKg}kg` : 'Not configured'}
        percent={weightPct}
        status={layout.weightLimitKg > 0 ? statusForPercent(weightPct, 80) : 'unconfigured'}
        testId="health-chip-weight"
        onClick={onOpenCheck}
      />
      <HealthChip
        label="Heat"
        valueText={`${heatCount}`}
        percent={Math.min(heatCount * 25, 100)}
        status={heatCount > 0 ? 'warn' : 'good'}
        testId="health-chip-heat"
        onClick={onOpenCheck}
      />
    </div>
  );
}

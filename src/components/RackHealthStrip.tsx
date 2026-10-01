import { issueMatchesCategory, summarizeFindings, type FindingGroup, type FindingTopic } from '../utils/findingSummary';
import type { RackLayout, ValidationIssue } from '../types/rack';
import type { getRackTotals } from '../utils/validation';

type RackTotals = ReturnType<typeof getRackTotals>;
type StripLayout = Pick<RackLayout, 'heightU' | 'powerBudgetW' | 'weightLimitKg' | 'findingExceptions'>;

export type HealthCheckCategory = 'overview' | 'thermal' | 'power' | 'capacity' | 'weight' | 'cable';

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

export const countHeatIssues = (issues: ValidationIssue[]) =>
  summarizeFindings(issues).groups.filter(group => group.issues.some(issue => issueMatchesCategory(issue, 'thermal')) && (group.status === 'fail' || group.applicability === 'active') && group.status !== 'pass').length;

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
  percent?: number;
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
      className="studio-health-chip flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-2 text-left hover:bg-fill"
      data-testid={testId}
      data-status={status}
      title={`${label}: ${valueText}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} aria-hidden />
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-content-muted">
        {label}
      </span>
      <span className="whitespace-nowrap text-xs font-medium text-content-secondary dark:text-content-secondary">
        {valueText}
      </span>
      {percent !== undefined && <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-fill xl:block" aria-hidden>
        <span
          className={`block h-full rounded-full ${colors.bar}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </span>}
    </Component>
  );
}

export function RackHealthStrip({
  totals,
  layout,
  issues,
  onOpenCheck,
}: RackHealthStripProps & { onOpenCheck?: (category?: HealthCheckCategory) => void }) {
  const capacityPct = percentOf(totals.occupiedU, layout.heightU);
  const powerPct = percentOf(totals.powerW, layout.powerBudgetW);
  const weightPct = percentOf(totals.weightKg, layout.weightLimitKg);
  const groups = summarizeFindings(issues, layout).groups;
  // Exceptions remove queue actions, not unresolved facts from planning health.
  const topicGroups = (topic: FindingTopic) => groups.filter(group => (group.status === 'fail' || group.applicability === 'active') && group.status !== 'pass' && group.issues.some(issue => issueMatchesCategory(issue, topic)));
  const statusWithFindings = (base: HealthChipStatus, matching: FindingGroup[]): HealthChipStatus =>
    base === 'critical' || matching.some(group => group.status === 'fail' && group.severity === 'critical') ? 'critical'
      : matching.length ? 'warn' : base;
  const thermalGroups = topicGroups('thermal');
  const heatCount = thermalGroups.length;
  const thermalUnknown = thermalGroups.filter(group => group.status === 'unknown').length;
  const powerGroups = topicGroups('power');
  const powerReview = totals.powerInputUnverified || powerGroups.some(group => group.status === 'unknown');

  return (
    <div
      className="studio-health-strip grid w-full grid-cols-2 gap-x-3 gap-y-0 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2"
      data-testid="rack-health-strip"
      aria-label="Rack health summary"
    >
      <HealthChip
        label="Capacity"
        valueText={`${totals.occupiedU} / ${layout.heightU} U`}
        percent={capacityPct}
        status={statusWithFindings(statusForPercent(capacityPct, 85), topicGroups('capacity'))}
        testId="health-chip-capacity"
        onClick={onOpenCheck ? () => onOpenCheck('capacity') : undefined}
      />
      <HealthChip
        label="Power"
        valueText={layout.powerBudgetW > 0 ? `${Number(totals.powerW.toFixed(1))} / ${Number(layout.powerBudgetW.toFixed(1))} W${powerReview ? ' · Review' : ''}` : 'Not configured'}
        percent={powerPct}
        status={statusWithFindings(layout.powerBudgetW > 0 ? (powerPct >= 100 ? 'critical' : powerReview ? 'warn' : statusForPercent(powerPct, 80)) : 'unconfigured', powerGroups)}
        testId="health-chip-power"
        onClick={onOpenCheck ? () => onOpenCheck('power') : undefined}
      />
      <HealthChip
        label="Weight"
        valueText={layout.weightLimitKg > 0 ? `${totals.weightKg.toFixed(2)} / ${layout.weightLimitKg.toFixed(2)} kg` : 'Not configured'}
        percent={weightPct}
        status={statusWithFindings(layout.weightLimitKg > 0 ? statusForPercent(weightPct, 80) : 'unconfigured', topicGroups('weight'))}
        testId="health-chip-weight"
        onClick={onOpenCheck ? () => onOpenCheck('weight') : undefined}
      />
      <HealthChip
        label="Thermal"
        valueText={heatCount ? `${heatCount} root ${heatCount === 1 ? 'cause' : 'causes'}${thermalUnknown ? ' · Review' : ''}` : 'No reported issues'}
        status={statusWithFindings('good', thermalGroups)}
        testId="health-chip-heat"
        onClick={onOpenCheck ? () => onOpenCheck('thermal') : undefined}
      />
    </div>
  );
}

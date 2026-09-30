import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import { summarizeFindings } from '../utils/findingSummary';
import { FindingSummaryBadges } from './FindingSummaryBadges';
import { getRackTotals, validateRackLayout } from '../utils/validation';

interface RackHealthDashboardProps {
  layout: RackLayout;
}

type HealthStatus = 'good' | 'warning' | 'critical';

interface HealthMetric {
  label: string;
  value: number;
  max: number;
  unit: string;
  percent: number;
  status: HealthStatus;
}

function statusForPercent(percent: number): HealthStatus {
  if (percent >= 95) return 'critical';
  if (percent >= 80) return 'warning';
  return 'good';
}

const STATUS_COLORS: Record<HealthStatus, { bg: string; text: string; bar: string }> = {
  good: { bg: 'bg-emerald-500/15', text: 'text-emerald-100', bar: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-500/15', text: 'text-amber-100', bar: 'bg-amber-500' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-100', bar: 'bg-red-500' },
};

export function RackHealthDashboard({ layout }: RackHealthDashboardProps) {
  const workspace = useRackStore(state => state.workspace);
  const totals = getRackTotals(layout, workspace);
  const issues = validateRackLayout(layout, workspace);
  const summary = summarizeFindings(issues, layout);
  const unresolved = summary.groups.filter(group => group.status === 'fail' || (group.status === 'unknown' && group.applicability === 'active'));
  const criticalIssues = unresolved.filter(group => group.status === 'fail' && group.severity === 'critical').length;
  const reviewIssues = unresolved.length;

  const spacePct = layout.heightU > 0 ? (totals.occupiedU / layout.heightU) * 100 : 0;
  const powerPct = layout.powerBudgetW > 0 ? (totals.powerW / layout.powerBudgetW) * 100 : 0;
  const weightPct = layout.weightLimitKg > 0 ? (totals.weightKg / layout.weightLimitKg) * 100 : 0;
  const cableMax = Math.max(layout.heightU * 2, layout.cables.length, 1);
  const cablePct = (layout.cables.length / cableMax) * 100;

  const metrics: HealthMetric[] = [
    {
      label: 'Space',
      value: totals.occupiedU,
      max: layout.heightU,
      unit: 'U',
      percent: Math.round(spacePct),
      status: statusForPercent(spacePct),
    },
    {
      label: 'Power',
      value: totals.powerW,
      max: layout.powerBudgetW,
      unit: 'W',
      percent: Math.round(powerPct),
      status: powerPct >= 100 || unresolved.some(group => group.status === 'fail' && group.severity === 'critical' && group.issues.some(issue => issue.id.startsWith('power-poe-'))) ? 'critical' : totals.powerInputUnverified ? 'warning' : statusForPercent(powerPct),
    },
    {
      label: 'Weight',
      value: totals.weightKg,
      max: layout.weightLimitKg,
      unit: 'kg',
      percent: Math.round(weightPct),
      status: statusForPercent(weightPct),
    },
    {
      label: 'Cables',
      value: layout.cables.length,
      max: cableMax,
      unit: '',
      percent: Math.round(cablePct),
      status: statusForPercent(cablePct),
    },
  ];

  const overallStatus: HealthStatus =
    criticalIssues > 0 || metrics.some((m) => m.status === 'critical')
      ? 'critical'
      : reviewIssues > 0 || metrics.some((m) => m.status === 'warning')
        ? 'warning'
        : 'good';

  const overall = STATUS_COLORS[overallStatus];

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          Rack Health
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${overall.bg} ${overall.text}`}>
          {overallStatus === 'good' ? 'No applicable issues detected' : overallStatus === 'warning' ? 'Attention' : 'Critical'}
        </span>
      </div>

      <div className="space-y-3">
        {metrics.map((metric) => {
          const colors = STATUS_COLORS[metric.status];
          return (
            <div key={metric.label}>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--theme-text-secondary)' }}>{metric.label}</span>
                <span style={{ color: 'var(--theme-text-primary)' }}>
                  {Number(metric.value.toFixed(2))}
                  {metric.unit ? `${metric.unit}` : ''} / {metric.max}
                  {metric.unit ? `${metric.unit}` : ''}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--theme-bg-primary)' }}>
                <div
                  className={`h-full rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${Math.min(metric.percent, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3"><FindingSummaryBadges counts={summary.counts} /></div>
    </section>
  );
}

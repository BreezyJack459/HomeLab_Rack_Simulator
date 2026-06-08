import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Lightbulb,
  ListChecks,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import {
  SCENARIO_PRESETS,
  getOverallReadinessScore,
  runAllScenarios,
  runScenario,
  type ScenarioPreset,
  type ScenarioSeverity,
} from '../utils/scenarioPlanner';
import { exportScenarioReportText } from '../utils/exporters';

const severityConfig: Record<
  ScenarioSeverity,
  { colorClass: string; bgClass: string; label: string }
> = {
  critical: {
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500/10 border-red-500/30',
    label: 'Critical',
  },
  warning: {
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    label: 'Warning',
  },
  info: {
    colorClass: 'text-sky-600 dark:text-sky-400',
    bgClass: 'bg-sky-500/10 border-sky-500/30',
    label: 'Info',
  },
};

const assumptionStatusConfig: Record<
  'pass' | 'fail' | 'unknown',
  { Icon: typeof CheckCircle2; colorClass: string }
> = {
  pass: { Icon: CheckCircle2, colorClass: 'text-emerald-600 dark:text-emerald-400' },
  fail: { Icon: XCircle, colorClass: 'text-red-600 dark:text-red-400' },
  unknown: { Icon: AlertTriangle, colorClass: 'text-amber-600 dark:text-amber-400' },
};

const priorityConfig: Record<
  'high' | 'medium' | 'low',
  { label: string; colorClass: string }
> = {
  high: { label: 'High', colorClass: 'text-red-600 dark:text-red-400' },
  medium: { label: 'Med', colorClass: 'text-amber-600 dark:text-amber-400' },
  low: { label: 'Low', colorClass: 'text-sky-600 dark:text-sky-400' },
};

const readinessConfig: Record<
  'good' | 'warning' | 'critical',
  { bgClass: string; colorClass: string; label: string }
> = {
  good: { bgClass: 'bg-emerald-500/10', colorClass: 'text-emerald-600 dark:text-emerald-400', label: 'Resilient' },
  warning: { bgClass: 'bg-amber-500/10', colorClass: 'text-amber-600 dark:text-amber-400', label: 'Gaps' },
  critical: { bgClass: 'bg-red-500/10', colorClass: 'text-red-600 dark:text-red-400', label: 'Fragile' },
};

export function ScenarioPlannerPanel() {
  const layout = useRackStore((state) => state.layout);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ScenarioPreset>('power-outage');

  const result = useMemo(() => runScenario(layout, selected), [layout, selected]);
  const overall = useMemo(() => getOverallReadinessScore(runAllScenarios(layout)), [layout]);
  const overallStyle = readinessConfig[overall.status];

  function handleExport() {
    const all = runAllScenarios(layout);
    exportScenarioReportText(layout, all, overall);
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} />
          Scenario Planner
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${overallStyle.bgClass} ${overallStyle.colorClass}`}
          >
            {overall.score}% · {overallStyle.label}
          </span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          {/* Scenario tabs */}
          <div className="grid grid-cols-2 gap-1.5">
            {SCENARIO_PRESETS.map((preset) => {
              const isSelected = preset.id === selected;
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => setSelected(preset.id)}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-left text-[11px] transition ${
                    isSelected ? 'border-current' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--theme-bg-primary)' : 'transparent',
                    borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-border-light)',
                    color: isSelected ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
                  }}
                  title={preset.description}
                >
                  <span aria-hidden>{preset.emoji}</span>
                  <span className="truncate font-medium">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div
            className="rounded-md border px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--theme-bg-primary)',
              borderColor: 'var(--theme-border-light)',
            }}
          >
            <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
              {result.presetLabel}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
              {result.presetDescription}
            </div>
            <div className="mt-2" style={{ color: 'var(--theme-text-secondary)' }}>
              {result.summary}
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div
              className="rounded border px-2 py-1.5"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border-light)',
              }}
            >
              <div style={{ color: 'var(--theme-text-muted)' }}>Impacted</div>
              <div className="text-sm font-bold text-red-600 dark:text-red-400">
                {result.metrics.impactedCount} / {result.metrics.totalDevices}
              </div>
            </div>
            <div
              className="rounded border px-2 py-1.5"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border-light)',
              }}
            >
              <div style={{ color: 'var(--theme-text-muted)' }}>Survivors</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {result.metrics.survivorCount} / {result.metrics.totalDevices}
              </div>
            </div>
            {result.metrics.estimatedRuntimeMinutes !== undefined && (
              <div
                className="rounded border px-2 py-1.5 col-span-2"
                style={{
                  backgroundColor: 'var(--theme-bg-primary)',
                  borderColor: 'var(--theme-border-light)',
                }}
              >
                <div style={{ color: 'var(--theme-text-muted)' }}>Estimated runtime</div>
                <div className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                  {isFinite(result.metrics.estimatedRuntimeMinutes)
                    ? `${Math.round(result.metrics.estimatedRuntimeMinutes)} min`
                    : '∞'}
                </div>
              </div>
            )}
          </div>

          {/* Failed assumptions */}
          {result.failedAssumptions.length > 0 && (
            <div className="space-y-1.5">
              <div
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <ListChecks size={11} />
                Assumptions
              </div>
              {result.failedAssumptions.map((a) => {
                const { Icon, colorClass } = assumptionStatusConfig[a.status];
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-[11px]"
                    style={{
                      backgroundColor: 'var(--theme-bg-primary)',
                      borderColor: 'var(--theme-border-light)',
                    }}
                  >
                    <Icon size={12} className={`mt-0.5 shrink-0 ${colorClass}`} />
                    <div className="space-y-0.5">
                      <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                        {a.title}
                      </div>
                      <div style={{ color: 'var(--theme-text-secondary)' }}>{a.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Impacted devices */}
          {result.impactedDevices.length > 0 && (
            <details className="space-y-1.5" open={result.impactedDevices.length <= 5}>
              <summary
                className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Impacted devices ({result.impactedDevices.length})
              </summary>
              <div className="space-y-1">
                {result.impactedDevices.map((d) => {
                  const s = severityConfig[d.severity];
                  return (
                    <div
                      key={d.deviceId + d.reason}
                      className={`rounded border px-2 py-1 text-[11px] ${s.bgClass}`}
                      style={{ borderColor: 'var(--theme-border-light)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                          {d.deviceName}
                        </span>
                        <span className={`text-[10px] font-semibold ${s.colorClass}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                        {d.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* Survivors */}
          {result.survivingDevices.length > 0 && (
            <details className="space-y-1.5">
              <summary
                className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Survivors ({result.survivingDevices.length})
              </summary>
              <div className="space-y-1">
                {result.survivingDevices.map((d) => (
                  <div
                    key={d.deviceId + d.reason}
                    className="rounded border px-2 py-1 text-[11px] bg-emerald-500/5"
                    style={{ borderColor: 'var(--theme-border-light)' }}
                  >
                    <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                      {d.deviceName}
                    </div>
                    <div className="mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                      {d.reason}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-1.5">
              <div
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <Lightbulb size={11} />
                Recommendations
              </div>
              {result.recommendations.map((rec) => {
                const p = priorityConfig[rec.priority];
                return (
                  <div
                    key={rec.id}
                    className="rounded border px-2 py-1.5 text-[11px]"
                    style={{
                      backgroundColor: 'var(--theme-bg-primary)',
                      borderColor: 'var(--theme-border-light)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                        {rec.title}
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${p.colorClass}`}>
                        {p.label}
                      </span>
                    </div>
                    <div className="mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                      {rec.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs transition hover:bg-opacity-50"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
              backgroundColor: 'var(--theme-bg-primary)',
            }}
          >
            <Download size={12} />
            Export full scenario report
          </button>
        </div>
      </div>
    </section>
  );
}

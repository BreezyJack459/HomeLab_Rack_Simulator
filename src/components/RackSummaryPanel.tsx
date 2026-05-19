import { ChevronDown, Settings2 } from 'lucide-react';
import type { LifecycleViewFilter, RackLayout, RackType, ValidationIssue } from '../types/rack';
import { RACK_HEIGHT_OPTIONS } from '../utils/rackMath';

type RackTotals = {
  occupiedU: number;
  powerW: number;
  heatScore: number;
};

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'warn';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-200 bg-white/80 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200';
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SummaryChip({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'warn' }) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-200 bg-white/70 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      {value}
    </span>
  );
}

interface RackSummaryPanelProps {
  open: boolean;
  onToggle: () => void;
  layout: RackLayout;
  totals: RackTotals;
  issues: ValidationIssue[];
  lifecycleFilter: LifecycleViewFilter;
  onLifecycleFilterChange: (filter: LifecycleViewFilter) => void;
  onRackTypeChange: (rackType: RackType) => void;
  onRackHeightChange: (heightU: number) => void;
  onPowerBudgetChange: (powerBudgetW: number) => void;
}

export function RackSummaryPanel({
  open,
  onToggle,
  layout,
  totals,
  issues,
  lifecycleFilter,
  onLifecycleFilterChange,
  onRackTypeChange,
  onRackHeightChange,
  onPowerBudgetChange,
}: RackSummaryPanelProps) {
  const powerTone = totals.powerW > layout.powerBudgetW ? 'danger' : 'default';
  const heatTone = totals.heatScore > 18 ? 'warn' : 'default';
  const issueTone = issues.some((issue) => issue.severity === 'critical')
    ? 'danger'
    : issues.length > 0
      ? 'warn'
      : 'default';

  return (
    <section
      className="shrink-0 rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70"
      data-testid="rack-summary"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/80"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Rack summary
          </span>
          {!open && (
            <>
              <SummaryChip label="U" value={`${totals.occupiedU}/${layout.heightU}`} />
              <SummaryChip label="Power" value={`${totals.powerW}W`} tone={powerTone} />
              <SummaryChip label="Heat" value={`${totals.heatScore}`} tone={heatTone} />
              <SummaryChip label="Issues" value={`${issues.length}`} tone={issueTone} />
            </>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Occupied" value={`${totals.occupiedU}/${layout.heightU}U`} />
            <MetricCard label="Power" value={`${totals.powerW}W`} tone={powerTone} />
            <MetricCard label="Heat" value={`${totals.heatScore}`} tone={heatTone} />
            <MetricCard label="Issues" value={`${issues.length}`} tone={issueTone} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/75">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              <Settings2 size={12} />
              Rack controls
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Rack type
                <select
                  className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={layout.rackType}
                  onChange={(event) => onRackTypeChange(event.target.value as RackType)}
                >
                  <option value="10in">10-inch rack</option>
                  <option value="19in">19-inch rack</option>
                </select>
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="rack-height-select">
                Height
                <select
                  id="rack-height-select"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={layout.heightU}
                  onChange={(event) => onRackHeightChange(Number(event.target.value))}
                >
                  {RACK_HEIGHT_OPTIONS.map((height) => (
                    <option key={height} value={height}>
                      {height}U
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Lifecycle filter
                <select
                  className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={lifecycleFilter}
                  onChange={(event) => onLifecycleFilterChange(event.target.value as LifecycleViewFilter)}
                >
                  <option value="all">All lifecycle</option>
                  <option value="changes">Changes only</option>
                  <option value="active">Active only</option>
                  <option value="planned">Planned only</option>
                  <option value="decommissioning">Decommissioning only</option>
                </select>
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Power budget
                <input
                  className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  type="number"
                  min={1}
                  value={layout.powerBudgetW}
                  onChange={(event) => onPowerBudgetChange(Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

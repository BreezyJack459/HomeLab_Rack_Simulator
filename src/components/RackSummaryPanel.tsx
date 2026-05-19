import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Settings2 } from 'lucide-react';
import type { LifecycleViewFilter, RackLayout, RackType, ValidationIssue } from '../types/rack';

type RackTotals = {
  occupiedU: number;
  powerW: number;
  heatScore: number;
};

const RackSummaryAlertsPopover = lazy(() =>
  import('./RackSummaryAlertsPopover').then((module) => ({ default: module.RackSummaryAlertsPopover }))
);
const RackSummarySettingsPanel = lazy(() =>
  import('./RackSummarySettingsPanel').then((module) => ({ default: module.RackSummarySettingsPanel }))
);

function SummaryChip({
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
  selectedIssueId: string | null;
  lifecycleFilter: LifecycleViewFilter;
  onLifecycleFilterChange: (filter: LifecycleViewFilter) => void;
  onRackTypeChange: (rackType: RackType) => void;
  onRackHeightChange: (heightU: number) => void;
  onPowerBudgetChange: (powerBudgetW: number) => void;
  onIssueSelect: (issue: ValidationIssue) => void;
}

export function RackSummaryPanel({
  open,
  onToggle,
  layout,
  totals,
  issues,
  selectedIssueId,
  lifecycleFilter,
  onLifecycleFilterChange,
  onRackTypeChange,
  onRackHeightChange,
  onPowerBudgetChange,
  onIssueSelect,
}: RackSummaryPanelProps) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const powerTone = totals.powerW > layout.powerBudgetW ? 'danger' : 'default';
  const heatTone = totals.heatScore > 18 ? 'warn' : 'default';
  const issueTone = issues.some((issue) => issue.severity === 'critical')
    ? 'danger'
    : issues.length > 0
      ? 'warn'
      : 'default';
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setAlertsOpen(false);
        if (open) onToggle();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, onToggle]);

  return (
    <section
      ref={rootRef}
      className="relative shrink-0 rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70"
      data-testid="rack-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {layout.name}
          </span>
          <SummaryChip label="Rack" value={`${layout.rackType === '10in' ? '10"' : '19"'} ${layout.viewSide}`} />
          <SummaryChip label="U" value={`${totals.occupiedU}/${layout.heightU}`} />
          <SummaryChip label="Power" value={`${totals.powerW}W`} tone={powerTone} />
          <SummaryChip label="Heat" value={`${totals.heatScore}`} tone={heatTone} />
          <SummaryChip label="Alerts" value={`${issues.length}`} tone={issueTone} />
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Lifecycle
            </span>
            <select
              className="bg-transparent text-xs font-medium text-slate-700 outline-none dark:text-slate-200"
              value={lifecycleFilter}
              onChange={(event) => onLifecycleFilterChange(event.target.value as LifecycleViewFilter)}
            >
              <option value="all">All</option>
              <option value="changes">Changes</option>
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="decommissioning">Decommissioning</option>
            </select>
          </label>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (open) onToggle();
              setAlertsOpen((value) => !value);
            }}
            aria-expanded={alertsOpen}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
              issues.length
                ? 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {issues.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {issues.length ? 'Open alerts' : 'Layout clear'}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (alertsOpen) setAlertsOpen(false);
                onToggle();
              }}
              aria-expanded={open}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
            >
              <Settings2 size={14} />
              Tune
              <ChevronDown
                size={14}
                className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {open && (
              <Suspense fallback={null}>
                <RackSummarySettingsPanel
                  layout={layout}
                  lifecycleFilter={lifecycleFilter}
                  onLifecycleFilterChange={onLifecycleFilterChange}
                  onRackTypeChange={onRackTypeChange}
                  onRackHeightChange={onRackHeightChange}
                  onPowerBudgetChange={onPowerBudgetChange}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {alertsOpen && (
        <Suspense fallback={null}>
          <RackSummaryAlertsPopover
            issues={issues}
            selectedIssueId={selectedIssueId}
            onIssueSelect={(issue) => {
              onIssueSelect(issue);
              setAlertsOpen(false);
            }}
          />
        </Suspense>
      )}
    </section>
  );
}

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Rows3, Settings2 } from 'lucide-react';
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
        : 'border-edge bg-surface/70 text-content-secondary dark:border-edge dark:bg-surface-raised/60 dark:text-content-secondary';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      {value}
    </span>
  );
}

interface RackSummaryPanelProps {
  embedded?: boolean;
  // compact: always show the small "Rack info" popover trigger and hide the
  // wide stats row (used by the new-shell CanvasHeader).
  compact?: boolean;
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
  onRackDepthChange: (rackDepthMm: number) => void;
  onFrontDoorClearanceChange: (frontDoorClearanceMm: number) => void;
  onRearDoorClearanceChange: (rearDoorClearanceMm: number) => void;
  onRearCableClearanceChange: (rearCableClearanceMm: number) => void;
  onPowerBudgetChange: (powerBudgetW: number) => void;
  onIssueSelect: (issue: ValidationIssue) => void;
}

export function RackSummaryPanel({
  embedded = false,
  compact = false,
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
  onRackDepthChange,
  onFrontDoorClearanceChange,
  onRearDoorClearanceChange,
  onRearCableClearanceChange,
  onPowerBudgetChange,
  onIssueSelect,
}: RackSummaryPanelProps) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const issueTone = issues.some((issue) => issue.severity === 'critical')
    ? 'danger'
    : issues.length > 0
      ? 'warn'
      : 'default';
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setAlertsOpen(false);
        setInfoOpen(false);
        if (open) onToggle();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, onToggle]);

  return (
    <section
      ref={rootRef}
      className={`relative shrink-0 ${
        embedded
          ? ''
          : 'rounded-2xl border border-edge bg-surface/72 dark:border-edge dark:bg-surface-raised/55'
      }`}
      data-testid="rack-summary"
    >
      <div className={`flex flex-wrap items-center justify-between gap-2 min-[1180px]:flex-nowrap ${embedded ? '' : 'px-3 py-2'}`}>
        <div className={`relative flex items-center gap-2 ${compact ? '' : 'min-[1180px]:hidden'}`}>
          {compact ? (
            <span className="whitespace-nowrap text-xs text-content-faint">
              {layout.rackType === '10in' ? '10"' : '19"'} {layout.viewSide}
              <span className="mx-1.5 opacity-50">·</span>U {totals.occupiedU}/{layout.heightU}
              <span className="mx-1.5 opacity-50">·</span>{layout.devices.length} devices
              <span className="mx-1.5 opacity-50">·</span>{layout.cables.length} cables
            </span>
          ) : null}
          <button
            type="button"
            aria-expanded={infoOpen}
            onClick={() => {
              if (alertsOpen) setAlertsOpen(false);
              if (open) onToggle();
              setInfoOpen((value) => !value);
            }}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-edge bg-surface px-3 text-xs font-medium text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
          >
            <Rows3 size={14} />
            Rack info
            <ChevronDown
              size={14}
              className={`shrink-0 text-content-faint transition ${infoOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>

          {infoOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-edge bg-surface p-3 shadow-xl dark:border-edge dark:bg-surface">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-content-faint">
                Rack summary
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <SummaryChip label="Rack" value={`${layout.rackType === '10in' ? '10"' : '19"'} ${layout.viewSide}`} />
                <SummaryChip label="U" value={`${totals.occupiedU}/${layout.heightU}`} />
                <SummaryChip label="Devices" value={`${layout.devices.length}`} />
                <SummaryChip label="Cables" value={`${layout.cables.length}`} />
              </div>
              <label className="mt-3 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-edge bg-surface/70 px-3 py-2 text-xs text-content-secondary dark:border-edge dark:bg-surface-raised/55 dark:text-content-secondary">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-content-faint">
                  Lifecycle
                </span>
                <select
                  className="min-w-0 flex-1 bg-transparent text-right text-xs font-medium text-content-secondary outline-none dark:text-content"
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
          )}
        </div>

        {!compact ? (
          <div className="hidden min-w-0 flex-1 items-center gap-3 overflow-x-auto pr-2 min-[1180px]:flex min-[1180px]:flex-nowrap">
          {/* Read-only rack stats as quiet text, not pills — borders are for
              interactive elements; this row should inform, not compete. */}
          <span className="whitespace-nowrap text-xs text-content-faint">
            {layout.rackType === '10in' ? '10"' : '19"'} {layout.viewSide}
            <span className="mx-1.5 opacity-50">·</span>U {totals.occupiedU}/{layout.heightU}
            <span className="mx-1.5 opacity-50">·</span>{layout.devices.length} devices
            <span className="mx-1.5 opacity-50">·</span>{layout.cables.length} cables
          </span>
          <label className="inline-flex items-center gap-2 rounded-full border border-edge bg-surface/70 px-3 py-1 text-xs text-content-secondary dark:border-edge dark:bg-surface-raised/55 dark:text-content-secondary">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-content-faint">
              Lifecycle
            </span>
            <select
              className="bg-transparent text-xs font-medium text-content-secondary outline-none dark:text-content"
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
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          <button
            type="button"
            onClick={() => {
              if (infoOpen) setInfoOpen(false);
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
            {issues.length ? `${issues.length}` : '0'}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (infoOpen) setInfoOpen(false);
                if (alertsOpen) setAlertsOpen(false);
                onToggle();
              }}
              aria-expanded={open}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-edge bg-surface px-3 text-xs font-medium text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
            >
              <Settings2 size={14} />
              Tune
              <ChevronDown
                size={14}
                className={`shrink-0 text-content-faint transition ${open ? 'rotate-180' : ''}`}
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
                  onRackDepthChange={onRackDepthChange}
                  onFrontDoorClearanceChange={onFrontDoorClearanceChange}
                  onRearDoorClearanceChange={onRearDoorClearanceChange}
                  onRearCableClearanceChange={onRearCableClearanceChange}
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

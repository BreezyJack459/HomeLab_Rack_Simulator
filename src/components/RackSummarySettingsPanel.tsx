import type { LifecycleViewFilter, RackLayout, RackType } from '../types/rack';
import { RACK_HEIGHT_OPTIONS } from '../utils/rackMath';

interface RackSummarySettingsPanelProps {
  layout: RackLayout;
  lifecycleFilter: LifecycleViewFilter;
  onLifecycleFilterChange: (filter: LifecycleViewFilter) => void;
  onRackTypeChange: (rackType: RackType) => void;
  onRackHeightChange: (heightU: number) => void;
  onPowerBudgetChange: (powerBudgetW: number) => void;
}

export function RackSummarySettingsPanel({
  layout,
  lifecycleFilter,
  onLifecycleFilterChange,
  onRackTypeChange,
  onRackHeightChange,
  onPowerBudgetChange,
}: RackSummarySettingsPanelProps) {
  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        Layout settings
      </div>
      <div className="grid gap-3">
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
  );
}

import type { LifecycleViewFilter, RackLayout, RackType } from '../types/rack';
import { getDepthSummary, RACK_HEIGHT_OPTIONS } from '../utils/rackMath';

interface RackSummarySettingsPanelProps {
  layout: RackLayout;
  lifecycleFilter: LifecycleViewFilter;
  onLifecycleFilterChange: (filter: LifecycleViewFilter) => void;
  onRackTypeChange: (rackType: RackType) => void;
  onRackHeightChange: (heightU: number) => void;
  onRackDepthChange: (rackDepthMm: number) => void;
  onFrontDoorClearanceChange: (frontDoorClearanceMm: number) => void;
  onRearDoorClearanceChange: (rearDoorClearanceMm: number) => void;
  onRearCableClearanceChange: (rearCableClearanceMm: number) => void;
  onPowerBudgetChange: (powerBudgetW: number) => void;
}

export function RackSummarySettingsPanel({
  layout,
  lifecycleFilter,
  onLifecycleFilterChange,
  onRackTypeChange,
  onRackHeightChange,
  onRackDepthChange,
  onFrontDoorClearanceChange,
  onRearDoorClearanceChange,
  onRearCableClearanceChange,
  onPowerBudgetChange,
}: RackSummarySettingsPanelProps) {
  const depthSummary = getDepthSummary(layout);
  const depthPresets =
    layout.rackType === '10in'
      ? [250, 350, 450, 600]
      : [450, 600, 800, 1000];
  const recommendedClearance =
    layout.rackType === '10in'
      ? { front: 10, rear: 15, cable: 25 }
      : layout.rackDepthMm <= 600
        ? { front: 20, rear: 30, cable: 50 }
        : layout.rackDepthMm <= 800
          ? { front: 20, rear: 30, cable: 70 }
          : { front: 20, rear: 30, cable: 90 };

  const applyRecommendedClearance = () => {
    onFrontDoorClearanceChange(recommendedClearance.front);
    onRearDoorClearanceChange(recommendedClearance.rear);
    onRearCableClearanceChange(recommendedClearance.cable);
  };

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
          Rack depth
          <div className="mt-1 space-y-2">
            <div className="relative">
              <input
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 pr-12 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                type="number"
                min={100}
                step={25}
                value={layout.rackDepthMm}
                onChange={(event) => onRackDepthChange(Math.max(100, Number(event.target.value) || 100))}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-xs text-slate-400 dark:text-slate-500">
                mm
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {depthPresets.map((depth) => {
                const active = layout.rackDepthMm === depth;
                return (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => onRackDepthChange(depth)}
                    className={`inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-medium transition ${
                      active
                        ? 'bg-cyan-500 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300'
                    }`}
                  >
                    {depth} mm
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Usable depth:
              </span>{' '}
              {depthSummary.usableDepthMm} mm
              <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                {layout.rackDepthMm} - front {depthSummary.frontDoorClearanceMm} - rear {depthSummary.rearDoorClearanceMm} - cable {depthSummary.rearCableClearanceMm} = {depthSummary.usableDepthMm} mm
              </div>
              {depthSummary.frontDoorClearanceMm === 0 &&
                depthSummary.rearDoorClearanceMm === 0 &&
                depthSummary.rearCableClearanceMm === 0 && (
                  <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                    No clearance reserved yet, so usable depth currently matches full rack depth.
                  </div>
                )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyRecommendedClearance}
                  className="inline-flex h-7 items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 text-[11px] font-medium text-cyan-700 hover:bg-cyan-500/15 dark:text-cyan-300"
                >
                  Apply typical
                </button>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Suggestion: front {recommendedClearance.front} / rear {recommendedClearance.rear} / cable {recommendedClearance.cable} mm
                </span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Front clearance
                <div className="relative mt-1">
                  <input
                    className="h-8 w-full rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    type="number"
                    min={0}
                    step={10}
                    value={depthSummary.frontDoorClearanceMm}
                    onChange={(event) =>
                      onFrontDoorClearanceChange(Math.max(0, Number(event.target.value) || 0))
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-[10px] text-slate-400 dark:text-slate-500">
                    mm
                  </span>
                </div>
              </label>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Rear clearance
                <div className="relative mt-1">
                  <input
                    className="h-8 w-full rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    type="number"
                    min={0}
                    step={10}
                    value={depthSummary.rearDoorClearanceMm}
                    onChange={(event) =>
                      onRearDoorClearanceChange(Math.max(0, Number(event.target.value) || 0))
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-[10px] text-slate-400 dark:text-slate-500">
                    mm
                  </span>
                </div>
              </label>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Cable reserve
                <div className="relative mt-1">
                  <input
                    className="h-8 w-full rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    type="number"
                    min={0}
                    step={10}
                    value={depthSummary.rearCableClearanceMm}
                    onChange={(event) =>
                      onRearCableClearanceChange(Math.max(0, Number(event.target.value) || 0))
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-[10px] text-slate-400 dark:text-slate-500">
                    mm
                  </span>
                </div>
              </label>
            </div>
          </div>
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

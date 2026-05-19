import { lazy, Suspense, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ActivityStatusChip } from './ActivityStatusChip';
import { IssueBar } from './IssueBar';
import { RackSummaryPanel } from './RackSummaryPanel';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import type { LifecycleViewFilter, RackLayout, RackType, ValidationIssue } from '../types/rack';

const ComponentLibrary = lazy(() => import('./ComponentLibrary').then((m) => ({ default: m.ComponentLibrary })));

type RackTotals = {
  occupiedU: number;
  powerW: number;
  heatScore: number;
};

interface ModelWorkspaceLayoutProps {
  layout: RackLayout;
  totals: RackTotals;
  issues: ValidationIssue[];
  lifecycleFilter: LifecycleViewFilter;
  onLifecycleFilterChange: (filter: LifecycleViewFilter) => void;
  onRackTypeChange: (rackType: RackType) => void;
  onRackHeightChange: (heightU: number) => void;
  onPowerBudgetChange: (powerBudgetW: number) => void;
  selectedIssueId: string | null;
  statusMessage: string | null;
  onIssueSelect: (issue: ValidationIssue) => void;
  onOpenAudit: () => void;
  canvas: ReactNode;
}

const LIBRARY_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition';

export function ModelWorkspaceLayout({
  layout,
  totals,
  issues,
  lifecycleFilter,
  onLifecycleFilterChange,
  onRackTypeChange,
  onRackHeightChange,
  onPowerBudgetChange,
  selectedIssueId,
  statusMessage,
  onIssueSelect,
  onOpenAudit,
  canvas,
}: ModelWorkspaceLayoutProps) {
  const deviceLibraryOpen = useLayoutPrefsStore((state) => state.deviceLibraryOpen);
  const rackSummaryOpen = useLayoutPrefsStore((state) => state.rackSummaryOpen);
  const toggleDeviceLibrary = useLayoutPrefsStore((state) => state.toggleDeviceLibrary);
  const toggleRackSummary = useLayoutPrefsStore((state) => state.toggleRackSummary);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="toggle-device-library"
          aria-expanded={deviceLibraryOpen}
          onClick={toggleDeviceLibrary}
          className={`${LIBRARY_BUTTON_CLASS} ${
            deviceLibraryOpen
              ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
              : 'border-slate-200 bg-white/80 text-slate-600 hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300'
          }`}
        >
          {deviceLibraryOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          Device library
        </button>
        <div className="min-w-0 flex-1">
          <RackSummaryPanel
            open={rackSummaryOpen}
            onToggle={toggleRackSummary}
            layout={layout}
            totals={totals}
            issues={issues}
            lifecycleFilter={lifecycleFilter}
            onLifecycleFilterChange={onLifecycleFilterChange}
            onRackTypeChange={onRackTypeChange}
            onRackHeightChange={onRackHeightChange}
            onPowerBudgetChange={onPowerBudgetChange}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <IssueBar
            issues={issues}
            selectedIssueId={selectedIssueId}
            onIssueSelect={onIssueSelect}
            className="mt-0"
            listMode="overlay"
          />
        </div>
        <ActivityStatusChip
          statusMessage={statusMessage}
          issues={issues}
          showOpenAudit
          onOpenAudit={onOpenAudit}
        />
      </div>

      <div
        className={`grid min-h-0 flex-1 gap-3 ${deviceLibraryOpen ? 'grid-cols-[minmax(200px,240px)_minmax(0,1fr)]' : 'grid-cols-1'}`}
      >
        {deviceLibraryOpen && (
          <aside
            className="min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white/82 dark:border-slate-800 dark:bg-slate-950/82"
            data-testid="device-library-panel"
          >
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500 dark:text-slate-400">
                  Loading device library...
                </div>
              }
            >
              <ComponentLibrary />
            </Suspense>
          </aside>
        )}

        <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white/82 dark:border-slate-800 dark:bg-slate-950/82">
          {canvas}
        </section>
      </div>
    </div>
  );
}

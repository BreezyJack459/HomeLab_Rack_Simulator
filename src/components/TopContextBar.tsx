import { Box, Cable, Command, Monitor, Network, Search, Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { AppWorkspace } from '../types/appShell';
import type { RackLayout, ViewMode, Workspace } from '../types/rack';
import { RACK_SPECS } from '../utils/rackMath';

const viewMeta: Record<ViewMode, { label: string; icon: React.ReactNode }> = {
  '2d': { label: '2D', icon: <Monitor size={14} /> },
  '3d': { label: '3D', icon: <Box size={14} /> },
  cables: { label: 'Cables', icon: <Cable size={14} /> },
  topology: { label: 'Topology', icon: <Network size={14} /> },
};

interface TopContextBarProps {
  workspace: Workspace;
  layout: RackLayout;
  currentWorkspace: AppWorkspace;
  viewMode: ViewMode;
  onOpenCommand: () => void;
  onRenameLayout: (name: string) => void;
  onToggleViewMode: (mode: ViewMode) => void;
  onSetViewSide: (side: 'front' | 'rear') => void;
}

export function TopContextBar({
  workspace,
  layout,
  currentWorkspace,
  viewMode,
  onOpenCommand,
  onRenameLayout,
  onToggleViewMode,
  onSetViewSide,
}: TopContextBarProps) {
  return (
    <div className="border-b border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <span>{currentWorkspace}</span>
            <span>•</span>
            <span>{workspace.name}</span>
            <span>•</span>
            <span>{RACK_SPECS[layout.rackType].label}</span>
            <span>•</span>
            <span>{layout.heightU}U</span>
          </div>
          <input
            className="w-full min-w-[18rem] bg-transparent text-xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-500"
            value={layout.name}
            onChange={(event) => onRenameLayout(event.target.value)}
            aria-label="Layout name"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{layout.devices.length} devices</span>
            <span>/</span>
            <span>{layout.cables.length} cables</span>
            <span>/</span>
            <span>{layout.reservations?.length ?? 0} reservations</span>
            <span>/</span>
            <span>{layout.viewSide} view</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {Object.entries(viewMeta).map(([mode, meta]) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onToggleViewMode(mode as ViewMode)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
                    active
                      ? 'bg-cyan-500 text-white'
                      : 'border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
            <ThemeToggle />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onSetViewSide('front')}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition ${
                layout.viewSide === 'front'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => onSetViewSide('rear')}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition ${
                layout.viewSide === 'rear'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Rear
            </button>
            <button
              type="button"
              onClick={onOpenCommand}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
            >
              <Search size={14} />
              Search
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Command size={10} />
                K
              </span>
            </button>
            <div className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
              <Sparkles size={12} />
              Operator workspace
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

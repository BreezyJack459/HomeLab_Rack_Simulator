import type { ReactNode } from 'react';
import { Box, Cable, Command, Monitor, Network, Search } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { AppWorkspace } from '../types/appShell';
import type { RackLayout, ViewMode, Workspace } from '../types/rack';
import { RACK_SPECS } from '../utils/rackMath';

const viewMeta: Record<ViewMode, { label: string; icon: ReactNode }> = {
  '2d': { label: '2D', icon: <Monitor size={14} /> },
  '3d': { label: '3D', icon: <Box size={14} /> },
  cables: { label: 'Cables', icon: <Cable size={14} /> },
  topology: { label: 'Topology', icon: <Network size={14} /> },
};

const workspaceLabel: Record<AppWorkspace, string> = {
  model: 'Build',
  audit: 'Check',
  operate: 'Run',
  plan: 'Plan',
  portfolio: 'Fleet',
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
  const primaryMeta = [
    workspaceLabel[currentWorkspace],
    RACK_SPECS[layout.rackType].label,
    `${layout.heightU}U`,
  ];

  return (
    <div className="border-b border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-white px-4 py-2.5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {primaryMeta.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-3">
              <input
                className="w-full min-w-0 bg-transparent text-xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-500"
                value={layout.name}
                onChange={(event) => onRenameLayout(event.target.value)}
                aria-label="Layout name"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
              {Object.entries(viewMeta).map(([mode, meta]) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onToggleViewMode(mode as ViewMode)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
                      active
                        ? 'bg-cyan-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`}
                  >
                    {meta.icon}
                    {meta.label}
                  </button>
                );
              })}
              <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="inline-flex items-center rounded-full bg-slate-100 p-1 dark:bg-slate-900">
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
              </div>
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
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}

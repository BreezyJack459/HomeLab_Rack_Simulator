import type { ReactNode } from 'react';
import { Command, LayoutGrid, Search } from 'lucide-react';
import type {
  ToolbarActionDefinition,
  ViewModeDefinition,
} from '../plugins/types';
import { ThemeToggle } from './ThemeToggle';
import type { AppWorkspace } from '../types/appShell';
import type { RackLayout, ViewMode, Workspace } from '../types/rack';
import { RACK_SPECS } from '../utils/rackMath';

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
  viewModes: ViewModeDefinition[];
  pluginToggles?: Array<{
    id: string;
    label: string;
    enabled: boolean;
    disabled?: boolean;
    onToggle: () => void;
  }>;
  toolbarActions?: ToolbarActionDefinition[];
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
  viewModes,
  pluginToggles = [],
  toolbarActions = [],
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
    <div className="border-b border-edge/80 bg-gradient-to-r from-white via-fill-subtle to-white px-4 py-2.5 dark:border-edge dark:from-surface dark:via-surface dark:to-surface-raised">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
              {primaryMeta.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-edge bg-surface/80 px-2 py-0.5 shadow-sm dark:border-edge dark:bg-surface/70"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-3">
              <input
                className="w-full min-w-0 bg-transparent text-xl font-semibold tracking-tight text-content outline-none placeholder:text-content-muted dark:text-content dark:placeholder:text-content-faint"
                value={layout.name}
                onChange={(event) => onRenameLayout(event.target.value)}
                aria-label="Layout name"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-edge/80 bg-surface/80 p-1 shadow-sm dark:border-edge dark:bg-surface/70">
              {viewModes.map((definition) => {
                const active = viewMode === definition.id;
                return (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => onToggleViewMode(definition.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
                      active
                        ? 'bg-accent-solid text-content shadow-sm'
                        : 'text-content-secondary hover:bg-fill dark:text-content-secondary dark:hover:bg-surface-raised'
                    }`}
                  >
                    {definition.icon}
                    {definition.label}
                  </button>
                );
              })}
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  onClick={() => onToggleViewMode('gallery')}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
                    viewMode === 'gallery'
                      ? 'bg-accent-solid text-content shadow-sm'
                      : 'text-content-secondary hover:bg-fill dark:text-content-secondary dark:hover:bg-surface-raised'
                  }`}
                >
                  <LayoutGrid size={14} />
                  Gallery
                </button>
              ) : null}
              {pluginToggles.length > 0 ? (
                <>
                  <div className="mx-0.5 h-5 w-px bg-fill-strong dark:bg-fill" />
                  {pluginToggles.map((plugin) => (
                    <button
                      key={plugin.id}
                      type="button"
                      disabled={plugin.disabled}
                      onClick={plugin.onToggle}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
                        plugin.disabled
                          ? 'cursor-not-allowed bg-fill text-content-faint dark:bg-surface-raised dark:text-content-faint'
                          : plugin.enabled
                            ? 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/18 dark:text-emerald-300'
                            : 'bg-fill text-content-muted hover:bg-fill-strong dark:bg-surface-raised dark:text-content-muted dark:hover:bg-fill'
                      }`}
                    >
                      {plugin.label}
                    </button>
                  ))}
                </>
              ) : null}
              {toolbarActions.length > 0 ? (
                <>
                  <div className="mx-0.5 h-5 w-px bg-fill-strong dark:bg-fill" />
                  {toolbarActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.run}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-500/12 px-3 text-xs font-medium text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
                    >
                      {action.label}
                    </button>
                  ))}
                </>
              ) : null}
              <div className="mx-0.5 h-5 w-px bg-fill-strong dark:bg-fill" />
              <div className="inline-flex items-center rounded-full bg-fill p-1 dark:bg-surface-raised">
                <button
                  type="button"
                  onClick={() => onSetViewSide('front')}
                  className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition ${
                    layout.viewSide === 'front'
                      ? 'bg-surface-raised text-content dark:bg-white dark:text-accent-on'
                      : 'bg-fill text-content-secondary hover:bg-fill-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:bg-fill'
                  }`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => onSetViewSide('rear')}
                  className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition ${
                    layout.viewSide === 'rear'
                      ? 'bg-surface-raised text-content dark:bg-white dark:text-accent-on'
                      : 'bg-fill text-content-secondary hover:bg-fill-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:bg-fill'
                  }`}
                >
                  Rear
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenCommand}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-edge bg-surface px-3 text-xs font-medium text-content-secondary shadow-sm hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
              >
                <Search size={14} />
                Search
                <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-[10px] text-content-faint dark:bg-fill dark:text-content-faint">
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

import {
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { WorkspaceContribution } from '../plugins/types';
import type { AppWorkspace } from '../types/appShell';

type NavItem = {
  id: AppWorkspace;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
  accent: string;
};

// Core workspaces are always visible; plugin packs contribute the rest via
// the workspace registry (see buildPluginRegistry).
const CORE_NAV_ITEMS: NavItem[] = [
  {
    id: 'model',
    label: 'Build',
    shortLabel: 'Rack',
    description: 'Edit rack layout, cables and ports',
    icon: <Monitor size={18} />,
    accent: 'from-accent/25 to-sky-500/10',
  },
  {
    id: 'audit',
    label: 'Check',
    shortLabel: 'Health',
    description: 'Review health, risks and validation',
    icon: <AlertTriangle size={18} />,
    accent: 'from-amber-500/25 to-orange-500/10',
  },
];

interface PrimaryNavProps {
  currentWorkspace: AppWorkspace;
  onSelectWorkspace: (workspace: AppWorkspace) => void;
  pluginWorkspaces?: WorkspaceContribution[];
}

export function PrimaryNav({ currentWorkspace, onSelectWorkspace, pluginWorkspaces = [] }: PrimaryNavProps) {
  const navItems: NavItem[] = [
    ...CORE_NAV_ITEMS,
    ...pluginWorkspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.nav.label,
      shortLabel: workspace.nav.shortLabel,
      description: workspace.nav.description,
      icon: workspace.icon,
      accent: workspace.nav.accent,
    })),
  ];

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center border-r border-edge/80 bg-gradient-to-b from-fill via-white to-fill p-2 dark:border-edge dark:from-surface dark:via-surface dark:to-surface-raised">
      <div className="mb-3 px-1 py-1 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-content-faint">
          Tasks
        </div>
        <div className="mt-1 text-[11px] leading-5 text-content-muted">
          Flow
        </div>
      </div>
      <nav className="flex flex-1 flex-col items-center gap-2.5">
        {navItems.map((item) => {
          const active = item.id === currentWorkspace;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectWorkspace(item.id)}
              // Icon-only rail: the accessible name keeps "Label ShortLabel"
              // (smoke tests match on it), the tooltip carries the description.
              aria-label={`${item.label} ${item.shortLabel}`}
              title={`${item.label} ${item.shortLabel} — ${item.description}`}
              className={`group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border transition ${
                active
                  ? 'border-accent/30 bg-surface text-content shadow-lg shadow-accent/15 dark:bg-surface-raised'
                  : 'border-edge/80 bg-surface/70 text-content-faint hover:-translate-y-0.5 hover:border-edge-strong hover:bg-surface hover:text-content hover:shadow-sm dark:border-edge dark:bg-surface/65 dark:hover:border-edge-strong dark:hover:bg-surface-raised dark:hover:text-content'
              }`}
            >
              <span
                className={`absolute inset-0 bg-gradient-to-b ${
                  active ? item.accent : 'from-transparent to-transparent'
                }`}
              />
              <span className="relative">{item.icon}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

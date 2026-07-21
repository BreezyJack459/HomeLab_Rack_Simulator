import {
  AlertTriangle,
  Briefcase,
  FolderKanban,
  Monitor,
  Network,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppWorkspace } from '../types/appShell';

type NavItem = {
  id: AppWorkspace;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
  accent: string;
};

const NAV_ITEMS: NavItem[] = [
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
  {
    id: 'operate',
    label: 'Run',
    shortLabel: 'Ops',
    description: 'Track asset, maintenance and backup data',
    icon: <Briefcase size={18} />,
    accent: 'from-emerald-500/25 to-teal-500/10',
  },
  {
    id: 'plan',
    label: 'Plan',
    shortLabel: 'Changes',
    description: 'Compare scenarios and upcoming changes',
    icon: <Network size={18} />,
    accent: 'from-indigo-500/25 to-sky-500/10',
  },
  {
    id: 'portfolio',
    label: 'Fleet',
    shortLabel: 'Rooms',
    description: 'Manage workspace, rooms and inter-rack links',
    icon: <FolderKanban size={18} />,
    accent: 'from-rose-500/20 to-fuchsia-500/10',
  },
];

interface PrimaryNavProps {
  currentWorkspace: AppWorkspace;
  onSelectWorkspace: (workspace: AppWorkspace) => void;
}

export function PrimaryNav({ currentWorkspace, onSelectWorkspace }: PrimaryNavProps) {
  return (
    <aside className="flex w-[92px] shrink-0 flex-col border-r border-edge/80 bg-gradient-to-b from-fill via-white to-fill p-3 dark:border-edge dark:from-surface dark:via-surface dark:to-surface-raised">
      <div className="mb-3 px-1.5 py-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-content-faint">
          Tasks
        </div>
        <div className="mt-1 text-[11px] leading-5 text-content-muted">
          Flow
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-2.5">
        {NAV_ITEMS.map((item) => {
          const active = item.id === currentWorkspace;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectWorkspace(item.id)}
              className={`group relative overflow-hidden rounded-[22px] border px-2 py-3 text-center transition ${
                active
                  ? 'border-accent/30 bg-surface text-content shadow-lg shadow-accent/15 dark:bg-surface-raised'
                  : 'border-edge/80 bg-surface/70 text-content-muted hover:-translate-y-0.5 hover:border-edge-strong hover:bg-surface hover:text-content hover:shadow-sm dark:border-edge dark:bg-surface/65 dark:text-content-muted dark:hover:border-edge-strong dark:hover:bg-surface-raised dark:hover:text-content'
              }`}
              title={item.description}
            >
              <span
                className={`absolute inset-x-0 top-0 h-12 bg-gradient-to-b opacity-100 ${
                  active ? item.accent : 'from-transparent to-transparent'
                }`}
              />
              <span
                className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border ${
                  active
                    ? 'border-white/10 bg-surface/10 text-content'
                    : 'border-edge bg-fill-subtle text-content-faint group-hover:border-accent group-hover:bg-accent-subtle group-hover:text-accent dark:border-edge dark:bg-surface-raised dark:group-hover:border-accent dark:group-hover:bg-accent-subtle/40 dark:group-hover:text-accent-fg'
                }`}
              >
                {item.icon}
              </span>
              <span className="relative mt-2 text-[11px] font-semibold">{item.label}</span>
              <span className={`relative text-[10px] ${active ? 'text-accent-fg-strong' : 'text-content-faint'}`}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

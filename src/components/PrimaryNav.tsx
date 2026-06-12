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
    accent: 'from-cyan-500/25 to-sky-500/10',
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
    <aside className="flex w-[92px] shrink-0 flex-col border-r border-slate-200/80 bg-gradient-to-b from-slate-100 via-white to-slate-100 p-3 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mb-3 px-1.5 py-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
          Tasks
        </div>
        <div className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
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
                  ? 'border-cyan-400/30 bg-slate-950 text-white shadow-lg shadow-cyan-500/15 dark:bg-slate-900'
                  : 'border-slate-200/80 bg-white/70 text-slate-500 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/65 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white'
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
                    ? 'border-white/10 bg-white/10 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-400 group-hover:border-cyan-200 group-hover:bg-cyan-50 group-hover:text-cyan-600 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:border-cyan-900 dark:group-hover:bg-cyan-950/40 dark:group-hover:text-cyan-300'
                }`}
              >
                {item.icon}
              </span>
              <span className="relative mt-2 text-[11px] font-semibold">{item.label}</span>
              <span className={`relative text-[10px] ${active ? 'text-cyan-100' : 'text-slate-400 dark:text-slate-500'}`}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

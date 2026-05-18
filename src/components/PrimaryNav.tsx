import {
  AlertTriangle,
  Briefcase,
  FolderKanban,
  Monitor,
  Network,
} from 'lucide-react';
import type { AppWorkspace } from '../types/appShell';

type NavItem = {
  id: AppWorkspace;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: 'model',
    label: 'Model',
    shortLabel: 'Build',
    description: 'Edit rack layout, cables and ports',
    icon: <Monitor size={18} />,
  },
  {
    id: 'operate',
    label: 'Operate',
    shortLabel: 'Run',
    description: 'Track asset, maintenance and backup data',
    icon: <Briefcase size={18} />,
  },
  {
    id: 'audit',
    label: 'Audit',
    shortLabel: 'Check',
    description: 'Review health, risks and validation',
    icon: <AlertTriangle size={18} />,
  },
  {
    id: 'plan',
    label: 'Plan',
    shortLabel: 'Plan',
    description: 'Compare scenarios and upcoming changes',
    icon: <Network size={18} />,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    shortLabel: 'Fleet',
    description: 'Manage workspace, rooms and inter-rack links',
    icon: <FolderKanban size={18} />,
  },
];

interface PrimaryNavProps {
  currentWorkspace: AppWorkspace;
  onSelectWorkspace: (workspace: AppWorkspace) => void;
}

export function PrimaryNav({ currentWorkspace, onSelectWorkspace }: PrimaryNavProps) {
  return (
    <aside className="flex w-24 shrink-0 flex-col border-r border-slate-200 bg-slate-100/85 p-3 dark:border-slate-800 dark:bg-slate-950/82">
      <div className="mb-4 px-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
          Workspaces
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const active = item.id === currentWorkspace;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectWorkspace(item.id)}
              className={`group flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${
                active
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
              title={item.description}
            >
              <span className={active ? 'text-white' : 'text-slate-400 group-hover:text-cyan-500'}>{item.icon}</span>
              <span className="text-[11px] font-semibold">{item.label}</span>
              <span className={`text-[10px] ${active ? 'text-cyan-100' : 'text-slate-400 dark:text-slate-500'}`}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface RightInspectorShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}

export function RightInspectorShell({ title, description, children, open, onToggle }: RightInspectorShellProps) {
  if (!open) {
    return (
      <aside className="hidden min-h-0 border-l border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-slate-950/90 xl:flex xl:w-[72px] xl:flex-col xl:items-center xl:py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Open inspector"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
        >
          <PanelRightOpen size={16} />
        </button>
        <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 [writing-mode:vertical-rl] dark:text-slate-500">
          Inspector
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden min-h-0 overflow-hidden border-l border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-slate-950/90 xl:flex xl:flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/90">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Inspector
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label="Collapse inspector"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}

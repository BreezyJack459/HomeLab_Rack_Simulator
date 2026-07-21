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
      <aside className="hidden min-h-0 border-l border-edge/80 bg-fill-subtle/85 dark:border-edge dark:bg-surface/90 xl:flex xl:w-[72px] xl:flex-col xl:items-center xl:py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Open inspector"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface/85 text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
        >
          <PanelRightOpen size={16} />
        </button>
        <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint [writing-mode:vertical-rl] dark:text-content-faint">
          Inspector
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden min-h-0 overflow-hidden border-l border-edge/80 bg-fill-subtle/85 dark:border-edge dark:bg-surface/90 xl:flex xl:flex-col">
      <div className="sticky top-0 z-10 border-b border-edge/70 bg-fill-subtle/90 px-4 py-3 backdrop-blur dark:border-edge/70 dark:bg-surface/90">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint">
              Inspector
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-content">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-content-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label="Collapse inspector"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-surface/85 text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}

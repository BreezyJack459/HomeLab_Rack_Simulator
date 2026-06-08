interface RightInspectorShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function RightInspectorShell({ title, description, children }: RightInspectorShellProps) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white/82 dark:border-slate-800 dark:bg-slate-950/82">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/92 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/92">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
          Inspector
        </div>
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </aside>
  );
}

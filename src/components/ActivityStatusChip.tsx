import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import type { ValidationIssue } from '../types/rack';

interface ActivityStatusChipProps {
  statusMessage: string | null;
  issues: ValidationIssue[];
  showOpenAudit?: boolean;
  onOpenAudit?: () => void;
}

export function ActivityStatusChip({
  statusMessage,
  issues,
  showOpenAudit = false,
  onOpenAudit,
}: ActivityStatusChipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const preview = statusMessage ?? 'Workspace ready';

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="activity-status-chip"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 max-w-[14rem] items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 text-xs font-medium text-slate-600 transition hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 sm:max-w-xs"
        title={preview}
      >
        <Activity size={14} className="shrink-0 text-slate-400" />
        <span className="min-w-0 truncate">{preview}</span>
        <ChevronDown size={14} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-950"
          data-testid="activity-status-popover"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            Activity
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{preview}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Active issues: {issues.length}</span>
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-700 dark:text-red-300">
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                {warningCount} warning
              </span>
            )}
          </div>
          {showOpenAudit && issues.length > 0 && onOpenAudit && (
            <button
              type="button"
              onClick={() => {
                onOpenAudit();
                setOpen(false);
              }}
              className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs font-medium text-cyan-700 hover:bg-cyan-500/15 dark:text-cyan-300"
            >
              Open audit workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}

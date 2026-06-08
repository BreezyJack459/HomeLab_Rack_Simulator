import { Download, Sparkles, AlertTriangle, CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { CleaningEnvironment, CleaningSchedule } from '../types/rack';
import {
  daysSinceCleaning,
  daysUntilCleaning,
  exportCleaningScheduleMarkdown,
  getCleaningIntervalDays,
  getNextCleaningDue,
  isCleaningOverdue,
} from '../utils/cleaningSchedule';

const environmentLabels: Record<CleaningEnvironment, string> = {
  bedroom: 'Bedroom',
  office: 'Office',
  closet: 'Closet',
  garage: 'Garage',
  basement: 'Basement',
};

export function CleaningSchedulePanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const schedule = layout.cleaningSchedule;

  const [localSchedule, setLocalSchedule] = useState<CleaningSchedule | undefined>(schedule);

  const interval = useMemo(
    () => (localSchedule ? getCleaningIntervalDays(localSchedule.environment) : 60),
    [localSchedule?.environment]
  );
  const nextDue = useMemo(
    () => getNextCleaningDue(localSchedule?.lastCleanedAt, localSchedule?.environment ?? 'bedroom'),
    [localSchedule?.lastCleanedAt, localSchedule?.environment]
  );
  const daysLeft = useMemo(
    () => daysUntilCleaning(localSchedule?.lastCleanedAt, localSchedule?.environment ?? 'bedroom'),
    [localSchedule?.lastCleanedAt, localSchedule?.environment]
  );
  const overdue = useMemo(
    () => isCleaningOverdue(localSchedule?.lastCleanedAt, localSchedule?.environment ?? 'bedroom'),
    [localSchedule?.lastCleanedAt, localSchedule?.environment]
  );
  const daysAgo = useMemo(() => daysSinceCleaning(localSchedule?.lastCleanedAt), [localSchedule?.lastCleanedAt]);

  function updateSchedule(patch: Partial<CleaningSchedule>) {
    const next: CleaningSchedule = {
      environment: localSchedule?.environment ?? 'bedroom',
      lastCleanedAt: localSchedule?.lastCleanedAt,
      notes: localSchedule?.notes,
      ...patch,
    };
    setLocalSchedule(next);
    updateRack({ cleaningSchedule: next });
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Sparkles size={15} />
          Cleaning Schedule
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportCleaningScheduleMarkdown(schedule);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cleaning-schedule.md';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
          }}
        >
          <Download size={11} />
          MD
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {localSchedule ? environmentLabels[localSchedule.environment] : '-'}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Environment
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {interval}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Days Interval
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div
            className={`text-lg font-bold ${
              overdue
                ? 'text-red-600 dark:text-red-400'
                : daysLeft != null && daysLeft <= 7
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {daysLeft != null ? Math.abs(daysLeft) : '-'}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {overdue ? 'Days Overdue' : daysLeft === 0 ? 'Due Today' : 'Days Left'}
          </div>
        </div>
      </div>

      {overdue && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-800 dark:text-red-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Cleaning is overdue by {Math.abs(daysLeft ?? 0)} day(s). Last cleaned{' '}
            {daysAgo} day(s) ago.
          </span>
        </div>
      )}

      {daysLeft != null && !overdue && daysLeft <= 7 && daysLeft > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-100">
          <CalendarDays size={14} className="mt-0.5 shrink-0" />
          <span>Cleaning is due in {daysLeft} day(s) ({nextDue}).</span>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">
            Environment
          </div>
          <select
            value={localSchedule?.environment ?? 'bedroom'}
            onChange={(e) => updateSchedule({ environment: e.target.value as CleaningEnvironment })}
            className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {(Object.keys(environmentLabels) as CleaningEnvironment[]).map((env) => (
              <option key={env} value={env}>
                {environmentLabels[env]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">
            Last Cleaned
          </div>
          <input
            type="date"
            value={localSchedule?.lastCleanedAt ?? ''}
            onChange={(e) =>
              updateSchedule({ lastCleanedAt: e.target.value || undefined })
            }
            className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          {daysAgo != null && (
            <div className="mt-0.5 text-[10px] opacity-60">
              {daysAgo} day(s) ago
            </div>
          )}
        </div>

        {nextDue && (
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Next Due
            </div>
            <div
              className="mt-0.5 rounded border px-1.5 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {nextDue}
              {overdue && (
                <span className="ml-2 text-[10px] text-red-500">(overdue)</span>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">
            Notes
          </div>
          <input
            type="text"
            value={localSchedule?.notes ?? ''}
            onChange={(e) =>
              updateSchedule({ notes: e.target.value || undefined })
            }
            className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
            placeholder="e.g. Use compressed air, check front filter"
          />
        </div>
      </div>
    </section>
  );
}

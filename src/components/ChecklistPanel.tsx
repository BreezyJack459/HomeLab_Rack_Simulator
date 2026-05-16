import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChecklistStatus } from '../types/rack';
import {
  checklistStatusLabel,
  checklistStatusTone,
  summarizeChecklist,
  type ChecklistSection
} from '../utils/checklists';

const FIELD_CLASS =
  'mt-1 h-8 w-full rounded-md border border-slate-300 bg-slate-100 px-2 text-xs text-slate-700 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200';

interface ChecklistPanelProps {
  title: string;
  icon: LucideIcon;
  sections: ChecklistSection[];
  onStatusChange: (itemId: string, status: ChecklistStatus) => void;
  onNotesChange: (itemId: string, notes: string) => void;
  onExport: () => void;
  exportLabel?: string;
}

export function ChecklistPanel({
  title,
  icon: Icon,
  sections,
  onStatusChange,
  onNotesChange,
  onExport,
  exportLabel = 'Export'
}: ChecklistPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const summary = useMemo(() => summarizeChecklist(sections), [sections]);

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)'
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <div className="flex items-center gap-2">
            <Icon size={15} />
            {title}
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
            backgroundColor: 'var(--theme-bg-primary)'
          }}
        >
          <Download size={11} />
          {exportLabel}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 text-xs">
        {([
          ['Pending', summary.pending, 'bg-amber-500/10 text-amber-700 dark:text-amber-300'],
          ['Passed', summary.passed, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
          ['Failed', summary.failed, 'bg-red-500/10 text-red-700 dark:text-red-300'],
          ['Skipped', summary.skipped, 'bg-slate-500/10 text-slate-700 dark:text-slate-300']
        ] as const).map(([label, count, tone]) => (
          <div key={label} className={`rounded-md border px-3 py-2 ${tone}`} style={{ borderColor: 'var(--theme-border)' }}>
            <div className="font-medium">{label}</div>
            <div className="mt-1 text-lg font-semibold">{count}</div>
          </div>
        ))}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          {sections.map((section) => (
            <div key={section.id} className="rounded-md border p-3" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--theme-text-muted)' }}>
                {section.title}
              </div>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.id} className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</div>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium ${checklistStatusTone(item.status)}`}>
                        {checklistStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-[140px_1fr] gap-2">
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">
                        Status
                        <select
                          className={FIELD_CLASS}
                          value={item.status}
                          onChange={(event) => onStatusChange(item.id, event.target.value as ChecklistStatus)}
                        >
                          <option value="pending">Pending</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="skipped">Skipped</option>
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-500 dark:text-slate-400">
                        Notes
                        <input
                          className={FIELD_CLASS}
                          value={item.notes ?? ''}
                          onChange={(event) => onNotesChange(item.id, event.target.value)}
                          placeholder="Operator note, result, or follow-up"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

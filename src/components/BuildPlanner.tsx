import { Boxes, ChevronDown, FileSpreadsheet, FileText, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ProcurementStatus } from '../types/rack';
import { exportProcurementCsv, exportProcurementText } from '../utils/exporters';
import {
  getProcurementCategoryLabel,
  getProcurementChecklist,
  getProcurementStatusLabel,
  procurementSummary,
  updateProcurementItem
} from '../utils/procurement';

const FIELD_CLASS =
  'mt-1 h-8 w-full rounded-md border border-slate-300 bg-slate-100 px-2 text-xs text-slate-700 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200';

const STATUS_BADGE: Record<ProcurementStatus, string> = {
  'need-to-buy': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ordered: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  printed: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  owned: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  installed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
};

export function BuildPlanner() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const [isOpen, setIsOpen] = useState(true);

  const items = useMemo(() => getProcurementChecklist(layout), [layout]);
  const summary = useMemo(() => procurementSummary(items), [items]);

  function setStatus(itemId: string, status: ProcurementStatus) {
    updateRack({ procurementItems: updateProcurementItem(layout, itemId, { status }) });
  }

  function setNotes(itemId: string, notes: string) {
    updateRack({ procurementItems: updateProcurementItem(layout, itemId, { notes }) });
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={15} />
          Build Planner
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded px-2 py-1 text-xs text-cyan-700 dark:text-cyan-300 bg-cyan-500/10">
            {items.length} items
          </span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {([
              ['need-to-buy', summary['need-to-buy']],
              ['ordered', summary.ordered],
              ['printed', summary.printed],
              ['owned', summary.owned],
              ['installed', summary.installed]
            ] as const).map(([status, count]) => (
              <div
                key={status}
                className={`rounded-md border px-3 py-2 ${STATUS_BADGE[status]}`}
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <div className="font-medium">{getProcurementStatusLabel(status)}</div>
                <div className="mt-1 text-lg font-semibold">{count}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => exportProcurementCsv(layout)}
            >
              <FileSpreadsheet size={13} />
              CSV
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => exportProcurementText(layout)}
            >
              <FileText size={13} />
              TXT
            </button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div
                className="rounded-md border p-3 text-xs"
                style={{
                  backgroundColor: 'var(--theme-bg-primary)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                No procurement items yet. Add devices, planned cables, or printed-mount reservations to build a checklist.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border p-3"
                  style={{
                    backgroundColor: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                        <Boxes size={12} className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {getProcurementCategoryLabel(item.category)} / {item.quantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium ${STATUS_BADGE[item.status]}`}>
                      {getProcurementStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-[140px_1fr] gap-2">
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">
                      Status
                      <select
                        className={FIELD_CLASS}
                        value={item.status}
                        onChange={(event) => setStatus(item.id, event.target.value as ProcurementStatus)}
                      >
                        <option value="need-to-buy">Need to buy</option>
                        <option value="ordered">Ordered</option>
                        <option value="printed">Printed</option>
                        <option value="owned">Owned</option>
                        <option value="installed">Installed</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400">
                      Notes
                      <input
                        className={FIELD_CLASS}
                        value={item.notes ?? ''}
                        onChange={(event) => setNotes(item.id, event.target.value)}
                        placeholder="Vendor, bin, part no., or checklist note"
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

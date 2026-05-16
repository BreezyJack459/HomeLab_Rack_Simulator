import { AlertTriangle, CheckCircle2, ChevronDown, Flag, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackDebtItem, RackDebtScope, RackDebtSeverity, RackDebtStatus } from '../types/rack';
import {
  debtScopeLabel,
  debtSeverityBg,
  debtSeverityColor,
  debtStatusLabel,
  debtSummary,
  topDebtItems,
  validationIssueToDebtItem,
} from '../utils/rackDebt';
import { validateRackLayout } from '../utils/validation';

const severityOptions: RackDebtSeverity[] = ['low', 'medium', 'high', 'critical'];
const statusOptions: RackDebtStatus[] = ['open', 'planned', 'fixed', 'accepted', 'ignored'];
const scopeOptions: RackDebtScope[] = ['device', 'cable', 'zone', 'layout'];

function DebtItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: RackDebtItem;
  onUpdate: (patch: Partial<RackDebtItem>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isResolved = item.status === 'fixed' || item.status === 'accepted' || item.status === 'ignored';

  return (
    <div className={`rounded-md border text-sm ${debtSeverityBg(item.severity)}`}>
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 opacity-70 transition hover:opacity-100"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <span className={`text-xs font-semibold uppercase tracking-wider ${debtSeverityColor(item.severity)}`}>
          {item.severity}
        </span>
        <span className={`flex-1 truncate ${isResolved ? 'line-through opacity-60' : ''}`}>
          {item.title}
        </span>
        <select
          value={item.status}
          onChange={(e) => onUpdate({ status: e.target.value as RackDebtStatus })}
          className="rounded border px-1.5 py-0.5 text-[11px]"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)', color: 'var(--theme-text-primary)' }}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{debtStatusLabel(s)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t px-3 py-2.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <p style={{ color: 'var(--theme-text-secondary)' }}>{item.description}</p>
          {item.notes && (
            <p className="mt-1 italic opacity-70">Notes: {item.notes}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--theme-bg-hover)' }}>
              {debtScopeLabel(item.scope)}
            </span>
            {item.category && (
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--theme-bg-hover)' }}>
                {item.category}
              </span>
            )}
            {item.createdAt && (
              <span className="text-[10px] opacity-60">
                Created {new Date(item.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>        </div>
      )}
    </div>
  );
}

export function RackDebtPanel() {
  const layout = useRackStore((state) => state.layout);
  const addDebtItem = useRackStore((state) => state.addDebtItem);
  const updateDebtItem = useRackStore((state) => state.updateDebtItem);
  const removeDebtItem = useRackStore((state) => state.removeDebtItem);
  const items = layout.debtItems ?? [];
  const summary = useMemo(() => debtSummary(items), [items]);
  const topItems = useMemo(() => topDebtItems(items), [items]);
  const issues = useMemo(() => validateRackLayout(layout), [layout]);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSeverity, setFormSeverity] = useState<RackDebtSeverity>('medium');
  const [formScope, setFormScope] = useState<RackDebtScope>('layout');
  const [formCategory, setFormCategory] = useState('');

  function addFromValidation(issue: (typeof issues)[number]) {
    const debt = validationIssueToDebtItem(issue);
    addDebtItem(debt);
  }

  function submitForm() {
    if (!formTitle.trim()) return;
    addDebtItem({
      title: formTitle.trim(),
      description: formDesc.trim(),
      severity: formSeverity,
      status: 'open',
      scope: formScope,
      category: formCategory.trim() || undefined,
    });
    setFormTitle('');
    setFormDesc('');
    setFormSeverity('medium');
    setFormScope('layout');
    setFormCategory('');
    setShowForm(false);
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <Flag size={15} />
          Rack Debt
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={11} />
          Add
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.openCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Open</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.score}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Score</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.criticalCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Critical</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.health}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Health</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <input
            type="text"
            placeholder="Debt title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
          />
          <textarea
            placeholder="Description"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            rows={2}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
          />
          <div className="flex gap-2">
            <select
              value={formSeverity}
              onChange={(e) => setFormSeverity(e.target.value as RackDebtSeverity)}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            >
              {severityOptions.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select
              value={formScope}
              onChange={(e) => setFormScope(e.target.value as RackDebtScope)}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            >
              {scopeOptions.map((s) => (
                <option key={s} value={s}>{debtScopeLabel(s)}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Category (optional)"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitForm}
              className="rounded bg-cyan-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Debt Item
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border px-3 py-1 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Convert from validation */}
      {issues.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Convert from validation issues
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {issues.slice(0, 10).map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => addFromValidation(issue)}
                className="flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] transition hover:brightness-110"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
              >
                <AlertTriangle size={11} className="shrink-0 text-amber-500" />
                <span className="truncate" style={{ color: 'var(--theme-text-secondary)' }}>{issue.title}</span>
                <Plus size={11} className="ml-auto shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 */}
      {topItems.length > 0 && (
        <div className="mb-3 rounded-md border p-2.5" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Top {topItems.length} to fix next
          </div>
          <div className="space-y-1">
            {topItems.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <span className="text-[10px] opacity-50">#{i + 1}</span>
                <span className={`font-medium ${debtSeverityColor(item.severity)}`}>{item.severity}</span>
                <span className="truncate" style={{ color: 'var(--theme-text-secondary)' }}>{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debt list */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
            No debt items tracked. Add items manually or convert validation issues above.
          </div>
        ) : (
          items.map((item) => (
            <DebtItemRow
              key={item.id}
              item={item}
              onUpdate={(patch) => updateDebtItem(item.id, patch)}
              onRemove={() => removeDebtItem(item.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

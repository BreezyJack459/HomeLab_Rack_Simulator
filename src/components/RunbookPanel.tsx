import { BookOpen, CheckCircle2, AlertTriangle, Octagon, Download, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { Runbook } from '../utils/runbookGenerator';
import { exportRunbooksMarkdown, generateAllRunbooks } from '../utils/runbookGenerator';

const categoryIcons: Record<string, string> = {
  network: '🌐',
  storage: '💾',
  power: '⚡',
  management: '🔧',
  performance: '🐢',
};

const riskIcons: Record<string, React.ReactNode> = {
  safe: <CheckCircle2 size={14} className="text-emerald-500" />,
  caution: <AlertTriangle size={14} className="text-amber-500" />,
  stop: <Octagon size={14} className="text-red-500" />,
};

const riskLabels: Record<string, string> = {
  safe: 'Safe',
  caution: 'Caution',
  stop: 'Stop',
};

const checkTypeLabels: Record<string, string> = {
  visual: 'Look',
  physical: 'Touch',
  network: 'Test',
  power: 'Power',
};

function RunbookCard({ runbook }: { runbook: Runbook }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md border text-sm"
      style={{
        borderColor: 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg-primary)',
      }}
    >
      <div
        className="flex cursor-pointer items-center gap-2 p-2.5"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
        />
        <span className="text-base">{categoryIcons[runbook.category] ?? '📋'}</span>
        <span className="flex-1 font-medium">{runbook.title}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ backgroundColor: 'var(--theme-bg-hover)' }}
        >
          ~{runbook.estimatedMinutes} min
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] capitalize"
          style={{ backgroundColor: 'var(--theme-bg-hover)' }}
        >
          {runbook.category}
        </span>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <p className="mb-2 text-xs opacity-70">{runbook.description}</p>
          <div className="space-y-1.5">
            {runbook.steps.map((step) => (
              <div
                key={step.order}
                className={`flex items-start gap-2 rounded p-1.5 text-xs ${
                  step.riskLevel === 'stop'
                    ? 'bg-red-500/10'
                    : step.riskLevel === 'caution'
                      ? 'bg-amber-500/10'
                      : ''
                }`}
              >
                <div className="mt-0.5 shrink-0">{riskIcons[step.riskLevel]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                      {checkTypeLabels[step.checkType]}
                    </span>
                    {step.deviceName && (
                      <span
                        className="rounded px-1 py-0 text-[10px]"
                        style={{ backgroundColor: 'var(--theme-bg-hover)' }}
                      >
                        {step.deviceName}
                      </span>
                    )}
                  </div>
                  <span className={step.riskLevel === 'stop' ? 'font-medium text-red-800 dark:text-red-100' : ''}>
                    {step.text}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-semibold ${
                    step.riskLevel === 'stop'
                      ? 'text-red-600 dark:text-red-400'
                      : step.riskLevel === 'caution'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {riskLabels[step.riskLevel]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RunbookPanel() {
  const layout = useRackStore((state) => state.layout);
  const [filter, setFilter] = useState<string>('all');

  const runbooks = useMemo(() => generateAllRunbooks(layout), [layout]);

  const filteredRunbooks = useMemo(() => {
    if (filter === 'all') return runbooks;
    return runbooks.filter((r) => r.category === filter);
  }, [runbooks, filter]);

  const categories = useMemo(() => {
    const cats = new Set(runbooks.map((r) => r.category));
    return Array.from(cats);
  }, [runbooks]);

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
          <BookOpen size={15} />
          Emergency Runbooks
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportRunbooksMarkdown(runbooks, layout.name);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${layout.name.replace(/\s+/g, '-').toLowerCase()}-runbooks.md`;
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
            {runbooks.length}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Runbooks
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
            {runbooks.reduce((sum, r) => sum + r.steps.length, 0)}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Total Steps
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {runbooks.reduce((sum, r) => sum + r.steps.filter((s) => s.riskLevel === 'stop').length, 0)}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Stop Warnings
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'all'
              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
              : 'opacity-60'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
              filter === cat
                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'opacity-60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filteredRunbooks.map((runbook) => (
          <RunbookCard key={runbook.id} runbook={runbook} />
        ))}
      </div>
    </section>
  );
}

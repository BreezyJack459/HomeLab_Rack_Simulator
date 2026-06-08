import { History, RefreshCcw } from 'lucide-react';
import { useMemo } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import { captureGoldenBaseline, getBaselineComparison } from '../utils/baseline';
import { exportGoldenBaselineMarkdown } from '../utils/exporters';

function metricTone(direction: 'better' | 'worse' | 'same') {
  if (direction === 'better') return 'text-emerald-700 dark:text-emerald-300';
  if (direction === 'worse') return 'text-red-700 dark:text-red-300';
  return 'text-slate-500 dark:text-slate-400';
}

function metricDelta(delta: number) {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : ''}${delta}`;
}

export function GoldenBaselinePanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const loadLayout = useRackStore((state) => state.loadLayout);
  const baseline = layout.goldenBaseline;
  const rows = useMemo(() => (baseline ? getBaselineComparison(layout, baseline) : []), [baseline, layout]);

  function capture() {
    updateRack({ goldenBaseline: captureGoldenBaseline(layout, `${layout.name} golden`) });
  }

  function openBaselineCopy() {
    if (!baseline) return;
    const nextLayout: RackLayout = {
      ...baseline.snapshot,
      id: `layout-${Math.random().toString(36).slice(2, 10)}`,
      name: `${baseline.snapshot.name} (baseline copy)`,
      procurementItems: [],
      readinessChecks: [],
      commissioningChecks: [],
      goldenBaseline: baseline,
      changeEvents: [],
      updatedAt: new Date().toISOString()
    };
    loadLayout(nextLayout);
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)'
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <History size={15} />
          Golden Baseline
        </div>
        <div className="flex items-center gap-2">
          {baseline && (
            <button
              type="button"
              onClick={() => exportGoldenBaselineMarkdown(layout)}
              className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              Markdown
            </button>
          )}
          <button
            type="button"
            onClick={capture}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            <RefreshCcw size={11} />
            {baseline ? 'Recapture' : 'Capture'}
          </button>
        </div>
      </div>

      {!baseline ? (
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          Save the current rack as a known-good baseline before you start large experiments, migrations, or noisy cleanup passes.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-xs" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
            <div className="font-semibold text-slate-900 dark:text-white">{baseline.name}</div>
            <div className="mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
              Captured {new Date(baseline.capturedAt).toLocaleString()}
            </div>
            <button
              type="button"
              onClick={openBaselineCopy}
              className="mt-3 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              Open baseline copy
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
              >
                <div className="font-medium text-slate-900 dark:text-white">{row.label}</div>
                <div style={{ color: 'var(--theme-text-secondary)' }}>
                  {row.current} vs {row.baseline}
                </div>
                <div className={metricTone(row.direction)}>{metricDelta(row.delta)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

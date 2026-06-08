import { Download, GitCompare, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { detectDrift, exportDriftMarkdown } from '../utils/driftDetector';

export function DriftPanel() {
  const layout = useRackStore((state) => state.layout);
  const baseline = layout.goldenBaseline?.snapshot;
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(() => {
    if (!baseline) return null;
    // Build a minimal RackLayout from snapshot for comparison
    const baselineLayout = {
      ...baseline,
      id: layout.id,
      name: baseline.name,
      updatedAt: layout.updatedAt,
    };
    return detectDrift(baselineLayout as typeof layout, layout);
  }, [baseline, layout]);

  if (!baseline) {
    return (
      <section
        className="rounded-lg border p-4"
        style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
      >
        <div
          className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <GitCompare size={15} />
          Drift Detector
        </div>
        <div className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
          No golden baseline set. Save a baseline in the Golden Baseline panel to enable drift detection.
        </div>
      </section>
    );
  }

  const hasChanges = result && result.summary.total > 0;
  const scoreColor = !hasChanges
    ? 'text-green-600 dark:text-green-400'
    : result.summary.critical > 0
      ? 'text-red-600 dark:text-red-400'
      : result.summary.review > 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <GitCompare size={15} />
          Drift Detector
        </div>
        {result && (
          <button
            type="button"
            onClick={() => {
              const md = exportDriftMarkdown(result);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'drift-report.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            <Download size={11} />
            MD
          </button>
        )}
      </div>

      {result && (
        <>
          <div
            className="mb-3 rounded-md border p-3 text-center"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <div className={`text-3xl font-bold ${scoreColor}`}>
              {result.summary.total}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              Changes from Baseline
            </div>
            <div className="mt-2 flex justify-center gap-3 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
              <span className="text-green-600 dark:text-green-400">{result.summary.harmless} harmless</span>
              <span className="text-amber-600 dark:text-amber-400">{result.summary.review} review</span>
              <span className="text-red-600 dark:text-red-400">{result.summary.critical} critical</span>
            </div>
          </div>

          {hasChanges && (
            <div className="mb-3 space-y-1">
              {result.items.slice(0, showDetails ? undefined : 3).map((item) => (
                <div
                  key={item.id}
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                    item.severity === 'critical'
                      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                      : item.severity === 'review'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                  }`}
                >
                  <ShieldAlert size={12} className="inline mr-1" />
                  <span className="font-medium">{item.title}:</span> {item.detail}
                </div>
              ))}
              {result.items.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="w-full text-center text-[10px] opacity-60 hover:opacity-100"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  {showDetails ? 'Show less' : `+${result.items.length - 3} more changes`}
                </button>
              )}
            </div>
          )}

          {!hasChanges && (
            <div
              className="rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-[11px] text-green-700 dark:text-green-300"
            >
              No drift detected. Current layout matches baseline.
            </div>
          )}
        </>
      )}
    </section>
  );
}

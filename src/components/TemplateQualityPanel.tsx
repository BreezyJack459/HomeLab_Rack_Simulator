import { Download, Info, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import {
  analyzeTemplateQuality,
  exportTemplateQualityMarkdown,
} from '../utils/templateQuality';

export function TemplateQualityPanel() {
  const result = useMemo(() => analyzeTemplateQuality(deviceCatalog), []);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const scoreColor =
    result.overallScore >= 80
      ? 'text-green-600 dark:text-green-400'
      : result.overallScore >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

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
          <Info size={15} />
          Catalog Quality
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportTemplateQualityMarkdown(result);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'catalog-quality.md';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Download size={11} />
          MD
        </button>
      </div>

      {/* Overall score */}
      <div
        className="mb-3 rounded-md border p-3 text-center"
        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
      >
        <div className={`text-3xl font-bold ${scoreColor}`}>{result.overallScore}%</div>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
          Overall Data Quality
        </div>
        <div className="mt-1 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {result.totalTemplates} templates analyzed
        </div>
      </div>

      {/* Low quality warning */}
      {result.lowQualityTemplates.length > 0 && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-700 dark:text-red-300">
          <ShieldAlert size={12} className="inline mr-1" />
          {result.lowQualityTemplates.length} template{result.lowQualityTemplates.length !== 1 ? 's' : ''} with low field coverage
        </div>
      )}

      {/* Field coverage bars */}
      <div className="mb-3 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
          Field Coverage
        </div>
        {result.fieldCoverage.map((f) => (
          <div key={f.field} className="flex items-center gap-2">
            <div className="w-32 shrink-0 truncate text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {f.label}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--theme-bg-primary)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${f.percent}%`,
                  backgroundColor:
                    f.percent >= 80 ? '#22c55e' : f.percent >= 50 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <div className="w-8 text-right text-[11px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
              {f.percent}%
            </div>
          </div>
        ))}
      </div>

      {/* Category coverage */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
          By Category
        </div>
        {result.categoryCoverage.map((c) => (
          <div
            key={c.category}
            className="rounded-md border p-2"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <button
              type="button"
              onClick={() => setExpandedCategory(expandedCategory === c.category ? null : c.category)}
              className="flex w-full items-center justify-between"
            >
              <span className="text-xs font-medium capitalize" style={{ color: 'var(--theme-text-primary)' }}>
                {c.category.replace(/-/g, ' ')}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {c.count} templates · {c.avgCoveragePercent}%
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

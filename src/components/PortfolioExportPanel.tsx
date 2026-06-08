import { Download, FileText, Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import {
  DEFAULT_PORTFOLIO_OPTIONS,
  exportPortfolioMarkdown,
  type PortfolioExportOptions,
} from '../utils/portfolioExport';

const SECTION_LABELS: { key: keyof PortfolioExportOptions; label: string }[] = [
  { key: 'includeOverview', label: 'Rack Overview' },
  { key: 'includeDevices', label: 'Device Inventory' },
  { key: 'includeTopology', label: 'Network Topology' },
  { key: 'includePower', label: 'Power & Energy' },
  { key: 'includeRedundancy', label: 'Redundancy & Resilience' },
  { key: 'includeBackup', label: 'Backup Posture' },
  { key: 'includeCables', label: 'Cable Summary' },
  { key: 'includeSkills', label: 'Skills Demonstrated' },
];

export function PortfolioExportPanel() {
  const layout = useRackStore((state) => state.layout);
  const [options, setOptions] = useState<PortfolioExportOptions>(DEFAULT_PORTFOLIO_OPTIONS);
  const [showPreview, setShowPreview] = useState(false);

  const markdown = useMemo(
    () => exportPortfolioMarkdown(layout, options),
    [layout, options]
  );

  function toggleOption(key: keyof PortfolioExportOptions) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function download() {
    const blob = new Blob([markdown], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layout.name.replace(/\s+/g, '-').toLowerCase()}-portfolio.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const enabledCount = SECTION_LABELS.filter((s) => options[s.key]).length;

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
          <FileText size={15} />
          Portfolio Export
        </div>
        <button
          type="button"
          onClick={download}
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

      <div
        className="mb-3 rounded-md border p-2 text-center"
        style={{
          borderColor: 'var(--theme-border)',
          backgroundColor: 'var(--theme-bg-primary)',
        }}
      >
        <div className="text-lg font-bold text-slate-900 dark:text-white">
          {enabledCount}
        </div>
        <div
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          Sections Enabled
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        {SECTION_LABELS.map(({ key, label }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition hover:opacity-80"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            <input
              type="checkbox"
              checked={options[key] as boolean}
              onChange={() => toggleOption(key)}
              className="h-3.5 w-3.5 accent-cyan-600"
            />
            <span className="flex-1">{label}</span>
          </label>
        ))}
      </div>

      <label
        className="mb-3 flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs transition"
        style={{
          borderColor: options.redactSensitive
            ? 'var(--theme-error, #ef4444)'
            : 'var(--theme-border)',
          backgroundColor: options.redactSensitive
            ? 'rgba(239,68,68,0.06)'
            : 'var(--theme-bg-primary)',
          color: 'var(--theme-text-primary)',
        }}
      >
        <input
          type="checkbox"
          checked={options.redactSensitive}
          onChange={() =>
            setOptions((prev) => ({ ...prev, redactSensitive: !prev.redactSensitive }))
          }
          className="h-3.5 w-3.5 accent-cyan-600"
        />
        {options.redactSensitive ? <EyeOff size={12} /> : <Eye size={12} />}
        <span className="flex-1">Redact sensitive data</span>
      </label>

      <button
        type="button"
        onClick={() => setShowPreview((v) => !v)}
        className="mb-2 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
        style={{
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
          backgroundColor: 'var(--theme-bg-primary)',
        }}
      >
        {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
        {showPreview ? 'Hide Preview' : 'Show Preview'}
      </button>

      {showPreview && (
        <div
          className="max-h-64 overflow-auto rounded-md border p-2 text-[10px] leading-relaxed"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
            color: 'var(--theme-text-secondary)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {markdown.split('\n').map((line, i) => (
            <div key={i} className="whitespace-pre">
              {line || ' '}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

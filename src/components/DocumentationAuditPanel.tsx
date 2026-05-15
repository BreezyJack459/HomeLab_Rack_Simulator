import { AlertTriangle, ChevronDown, Download, FileText, Info, Lightbulb, Tag, Unplug, Wifi } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { exportDocumentationAuditText } from '../utils/exporters';
import { getDocumentationIssues } from '../utils/documentationAudit';
import { recommendationForIssue } from '../utils/validationRecommendations';

export function DocumentationAuditPanel() {
  const layout = useRackStore((state) => state.layout);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const issues = useMemo(() => getDocumentationIssues(layout), [layout]);
  const [isOpen, setIsOpen] = useState(true);

  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  const iconForIssue = (id: string) => {
    if (id.startsWith('missing-label-')) return <Tag size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />;
    if (id.startsWith('no-power-')) return <Unplug size={13} className="shrink-0 text-red-400" />;
    if (id.startsWith('no-network-')) return <Wifi size={13} className="shrink-0 text-amber-400" />;
    if (id.startsWith('unused-power-')) return <Info size={13} className="shrink-0 text-sky-400" />;
    if (id.startsWith('missing-endpoint-labels-')) return <FileText size={13} className="shrink-0 text-cyan-400" />;
    if (id.startsWith('incomplete-port-map-')) return <Info size={13} className="shrink-0 text-violet-400" />;
    return <FileText size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />;
  };

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} />
            Documentation Audit
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportDocumentationAuditText(layout)}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
              backgroundColor: 'var(--theme-bg-primary)',
            }}
          >
            <Download size={11} />
            Export
          </button>
          {issues.length > 0 && (
            <span
              className="rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: warnings.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.15)',
                color: warnings.length > 0 ? '#f87171' : '#38bdf8',
              }}
            >
              {issues.length} issue{issues.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {issues.length === 0 ? (
            <div
              className="rounded-md border p-3 text-xs"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              Documentation looks complete. All devices have labels, power, and network connections where expected.
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-2 rounded-md border p-2.5 text-left transition hover:opacity-90"
                  style={{
                    backgroundColor:
                      issue.severity === 'warning'
                        ? 'rgba(239,68,68,0.05)'
                        : 'var(--theme-bg-primary)',
                    borderColor:
                      issue.severity === 'warning'
                        ? 'rgba(239,68,68,0.3)'
                        : 'var(--theme-border)',
                  }}
                  onClick={() => {
                    if (issue.deviceIds[0]) {
                      selectDevice(issue.deviceIds[0]);
                      return;
                    }
                    if (issue.cableIds?.[0]) {
                      selectCable(issue.cableIds[0]);
                    }
                  }}
                >
                  {issue.severity === 'warning' ? (
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-400" />
                  ) : (
                    iconForIssue(issue.id)
                  )}
                  <div className="min-w-0">
                    <div
                      className="text-xs font-medium"
                      style={{
                        color:
                          issue.severity === 'warning'
                            ? '#fca5a5'
                            : 'var(--theme-text-secondary)',
                      }}
                    >
                      {issue.title}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                      {issue.detail}
                    </div>
                    <div className="mt-1 flex items-start gap-1 text-[10px]" style={{ color: 'var(--theme-text-secondary)' }}>
                      <Lightbulb size={10} className="mt-0.5 shrink-0 text-amber-400/70" />
                      {recommendationForIssue(issue)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

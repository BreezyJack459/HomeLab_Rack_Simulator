import {
  AlertTriangle,
  Bookmark,
  Box,
  CheckCircle2,
  ChevronDown,
  Flame,
  Ruler,
  Scale,
  Search,
  Weight,
  XCircle,
  Zap
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import { useRackStore } from '../store/rackStore';
import type { DeviceTemplate } from '../types/rack';
import { shouldHideDevice } from '../utils/featureFlags';
import { checkDeviceFit, type FitCheckCategory, type FitCheckResult } from '../utils/fitCheck';

const categoryConfig: Record<
  FitCheckCategory,
  { label: string; icon: typeof Box }
> = {
  physical: { label: 'Physical', icon: Ruler },
  weight: { label: 'Weight', icon: Weight },
  power: { label: 'Power', icon: Zap },
  heat: { label: 'Heat', icon: Flame },
  stability: { label: 'Stability', icon: Scale },
  reservation: { label: 'Reservation', icon: Bookmark }
};

const statusConfig = {
  pass: { icon: CheckCircle2, colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/30' },
  warning: { icon: AlertTriangle, colorClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-500/10 border-amber-500/30' },
  fail: { icon: XCircle, colorClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-500/10 border-red-500/30' }
};

function CategoryBadge({ category, status }: { category: FitCheckCategory; status: 'pass' | 'fail' | 'warning' }) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  const s = statusConfig[status];
  const StatusIcon = s.icon;
  return (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${s.bgClass}`}>
      <Icon size={13} className={s.colorClass} />
      <span className="flex-1 font-medium" style={{ color: 'var(--theme-text-primary)' }}>{config.label}</span>
      <StatusIcon size={13} className={s.colorClass} />
    </div>
  );
}

export function FitCheckPanel() {
  const layout = useRackStore((state) => state.layout);
  const addDeviceFromTemplate = useRackStore((state) => state.addDeviceFromTemplate);

  const [isOpen, setIsOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [positionU, setPositionU] = useState<string>('');
  const [result, setResult] = useState<FitCheckResult | null>(null);

  const visibleCatalog = useMemo(() => deviceCatalog.filter((d) => !shouldHideDevice(d)), []);

  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return visibleCatalog.filter(
      (d) =>
        !normalized ||
        d.name.toLowerCase().includes(normalized) ||
        d.category.toLowerCase().includes(normalized)
    );
  }, [query, visibleCatalog]);

  const selectedTemplate = useMemo(
    () => visibleCatalog.find((d) => d.id === selectedTemplateId) ?? null,
    [selectedTemplateId, visibleCatalog]
  );

  function handleCheck() {
    if (!selectedTemplate) return;
    const pos = positionU.trim() !== '' ? Number(positionU) : undefined;
    const fitResult = checkDeviceFit(layout, selectedTemplate, pos !== undefined ? { positionU: pos } : undefined);
    setResult(fitResult);
  }

  function handleAddToRack() {
    if (!selectedTemplate || !result) return;
    const success = addDeviceFromTemplate(selectedTemplate.id, result.proposedPosition.positionU, result.proposedPosition.xMm);
    if (success) {
      setResult(null);
      setSelectedTemplateId('');
      setPositionU('');
      setQuery('');
    }
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <div className="flex items-center gap-2">
          <Search size={15} />
          Pre-Purchase Fit
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
          />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          {/* Device search */}
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
              Device
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedTemplateId('');
                  setResult(null);
                }}
                placeholder="Search catalog..."
                className="h-9 w-full rounded-md border bg-transparent px-3 pl-8 text-sm outline-none"
                style={{
                  borderColor: 'var(--theme-border-light)',
                  color: 'var(--theme-text-primary)',
                  backgroundColor: 'var(--theme-bg-input)'
                }}
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
            </div>
            {filteredCatalog.length > 0 && query.trim() !== '' && !selectedTemplate && (
              <div
                className="mt-1 max-h-40 overflow-y-auto rounded-md border"
                style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
              >
                {filteredCatalog.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setQuery(template.name);
                      setResult(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:brightness-110"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: template.color }}
                    />
                    <span className="flex-1">{template.name}</span>
                    <span style={{ color: 'var(--theme-text-muted)' }}>{template.defaultU}U</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Position input */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Position U
              </label>
              <input
                type="number"
                min={1}
                max={layout.heightU}
                value={positionU}
                onChange={(e) => {
                  setPositionU(e.target.value);
                  setResult(null);
                }}
                placeholder="Auto"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none"
                style={{
                  borderColor: 'var(--theme-border-light)',
                  color: 'var(--theme-text-primary)',
                  backgroundColor: 'var(--theme-bg-input)'
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCheck}
                disabled={!selectedTemplate}
                className="h-9 w-full rounded-md border text-xs font-medium transition disabled:opacity-40"
                style={{
                  borderColor: 'var(--theme-accent)',
                  color: 'var(--theme-accent)',
                  backgroundColor: 'transparent'
                }}
              >
                Check Fit
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {/* Verdict */}
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                  result.canFit ? statusConfig.pass.bgClass : statusConfig.fail.bgClass
                }`}
              >
                {result.canFit ? (
                  <CheckCircle2 size={16} className={statusConfig.pass.colorClass} />
                ) : (
                  <XCircle size={16} className={statusConfig.fail.colorClass} />
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {result.canFit ? 'Fits — no blocking issues' : 'Does not fit'}
                </span>
              </div>

              {/* Category grid */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(categoryConfig) as FitCheckCategory[]).map((cat) => (
                  <CategoryBadge key={cat} category={cat} status={result.checks[cat]} />
                ))}
              </div>

              {/* Before / after metrics */}
              <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                {[
                  { label: 'Weight', before: `${result.before.weightKg.toFixed(1)}`, after: `${result.after.weightKg.toFixed(1)}`, unit: 'kg' },
                  { label: 'Power', before: `${result.before.powerW}`, after: `${result.after.powerW}`, unit: 'W' },
                  { label: 'U Used', before: `${result.before.occupiedU}`, after: `${result.after.occupiedU}`, unit: '' },
                  { label: 'Heat', before: `${result.before.heatScore}`, after: `${result.after.heatScore}`, unit: '' }
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-md border px-1 py-1.5"
                    style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                  >
                    <div style={{ color: 'var(--theme-text-muted)' }}>{m.label}</div>
                    <div className="mt-0.5 font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                      {m.before}
                      <span className="mx-0.5" style={{ color: 'var(--theme-text-muted)' }}>→</span>
                      {m.after}
                      {m.unit && <span className="text-[9px]" style={{ color: 'var(--theme-text-muted)' }}>{m.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Issue list */}
              {result.issues.length > 0 && (
                <div className="space-y-1.5">
                  {result.issues.map((issue, idx) => {
                    const s = statusConfig[issue.severity === 'critical' ? 'fail' : 'warning'];
                    const Icon = s.icon;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${s.bgClass}`}
                      >
                        <Icon size={13} className={`mt-0.5 shrink-0 ${s.colorClass}`} />
                        <div>
                          <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{issue.title}</div>
                          <div className="mt-0.5 text-[11px] opacity-85" style={{ color: 'var(--theme-text-secondary)' }}>{issue.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add to Rack */}
              <button
                type="button"
                onClick={handleAddToRack}
                disabled={!result.canFit}
                className="h-9 w-full rounded-md text-xs font-medium transition disabled:opacity-40"
                style={{
                  backgroundColor: result.canFit ? 'var(--theme-accent)' : 'var(--theme-bg-hover)',
                  color: result.canFit ? 'var(--theme-accent-text)' : 'var(--theme-text-muted)'
                }}
              >
                Add to Rack
              </button>
            </div>
          )}

          {!selectedTemplate && (
            <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Search for a device to check whether it will fit in your current rack.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

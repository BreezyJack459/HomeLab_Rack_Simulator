import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Clock,
  Crosshair,
  Network,
  Zap
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { analyzeBlastRadius, type ImpactType } from '../utils/blastRadius';

const impactConfig: Record<
  ImpactType,
  { label: string; icon: typeof Zap; colorVar: string }
> = {
  power: { label: 'Power', icon: Zap, colorVar: '#f59e0b' },
  network: { label: 'Network', icon: Network, colorVar: '#3b82f6' },
  boot: { label: 'Boot', icon: Clock, colorVar: '#10b981' }
};

function getCriticalityColor(score: number): string {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

function getCriticalityLabel(score: number): string {
  if (score <= 30) return 'Low Risk';
  if (score <= 60) return 'Medium Risk';
  return 'High Risk';
}

export function BlastRadiusPanel() {
  const layout = useRackStore((state) => state.layout);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const [isOpen, setIsOpen] = useState(true);
  const [showIndirect, setShowIndirect] = useState(false);

  const analysis = useMemo(() => {
    if (!selectedDeviceId) return null;
    return analyzeBlastRadius(layout, selectedDeviceId);
  }, [layout, selectedDeviceId]);

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
          <Crosshair size={15} />
          Blast Radius
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          {!selectedDeviceId && (
            <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Select a device to see its failure impact.
            </div>
          )}

          {selectedDeviceId && !analysis && (
            <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Selected device not found in layout.
            </div>
          )}

          {analysis && (
            <>
              {/* Target device */}
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                <span className="rounded-md px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--theme-bg-hover)' }}>
                  {analysis.targetDeviceName}
                </span>
              </div>

              {/* Criticality score */}
              <div
                className="flex items-center gap-3 rounded-md border p-3"
                style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                  style={{
                    backgroundColor: `${getCriticalityColor(analysis.criticalityScore)}20`,
                    color: getCriticalityColor(analysis.criticalityScore)
                  }}
                >
                  {analysis.criticalityScore}
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                    Criticality Score
                  </div>
                  <div className="text-sm font-semibold" style={{ color: getCriticalityColor(analysis.criticalityScore) }}>
                    {getCriticalityLabel(analysis.criticalityScore)}
                  </div>
                </div>
              </div>

              {/* Impact breakdown */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(impactConfig) as ImpactType[]).map((type) => {
                  const config = impactConfig[type];
                  const Icon = config.icon;
                  const count = analysis.impactBreakdown[type];
                  return (
                    <div
                      key={type}
                      className="flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center"
                      style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                    >
                      <Icon size={14} style={{ color: config.colorVar }} />
                      <div className="text-lg font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                        {count}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                        {config.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total affected */}
              {analysis.totalAffected > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                  <span style={{ color: 'var(--theme-text-primary)' }}>
                    {analysis.totalAffected} device{analysis.totalAffected === 1 ? '' : 's'} would be affected
                  </span>
                </div>
              )}

              {/* Directly impacted */}
              {analysis.directlyImpacted.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                    Directly impacted
                  </div>
                  <div className="space-y-1">
                    {analysis.directlyImpacted.map((device) => {
                      const config = impactConfig[device.impactType];
                      const Icon = config.icon;
                      return (
                        <button
                          key={device.deviceId}
                          type="button"
                          onClick={() => selectDevice(device.deviceId)}
                          className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:brightness-110"
                          style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                        >
                          <Icon size={12} style={{ color: config.colorVar }} />
                          <span className="flex-1" style={{ color: 'var(--theme-text-primary)' }}>{device.deviceName}</span>
                          <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Indirectly impacted */}
              {analysis.indirectlyImpacted.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowIndirect((v) => !v)}
                    className="mb-1.5 flex w-full items-center justify-between text-xs font-medium transition"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    <span>Indirectly impacted ({analysis.indirectlyImpacted.length})</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${showIndirect ? '' : '-rotate-90'}`}
                    />
                  </button>
                  {showIndirect && (
                    <div className="space-y-1">
                      {analysis.indirectlyImpacted.map((device) => {
                        const config = impactConfig[device.impactType];
                        const Icon = config.icon;
                        return (
                          <button
                            key={device.deviceId}
                            type="button"
                            onClick={() => selectDevice(device.deviceId)}
                            className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:brightness-110"
                            style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                          >
                            <Icon size={12} style={{ color: config.colorVar }} />
                            <span className="flex-1" style={{ color: 'var(--theme-text-primary)' }}>{device.deviceName}</span>
                            <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                              {config.label} · d{device.distance}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Upstream dependencies */}
              {analysis.upstreamDependencies.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                    <ArrowUp size={12} />
                    This device depends on
                  </div>
                  <div className="space-y-1">
                    {analysis.upstreamDependencies.map((dep) => {
                      const config = impactConfig[dep.type];
                      const Icon = config.icon;
                      return (
                        <button
                          key={`${dep.deviceId}-${dep.type}`}
                          type="button"
                          onClick={() => selectDevice(dep.deviceId)}
                          className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:brightness-110"
                          style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                        >
                          <Icon size={12} style={{ color: config.colorVar }} />
                          <span className="flex-1" style={{ color: 'var(--theme-text-primary)' }}>{dep.deviceName}</span>
                          <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {analysis.totalAffected === 0 && analysis.upstreamDependencies.length === 0 && (
                <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  No dependencies or impact detected for this device.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

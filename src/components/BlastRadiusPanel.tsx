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
  power: { label: 'Supply loss', icon: Zap, colorVar: '#f59e0b' },
  network: { label: 'Network review', icon: Network, colorVar: '#3b82f6' },
  boot: { label: 'Restart', icon: Clock, colorVar: '#10b981' }
};

function getCriticalityColor(score: number): string {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

function getCriticalityLabel(score: number): string {
  if (score <= 30) return 'Lower recorded impact';
  if (score <= 60) return 'Moderate recorded impact';
  return 'Higher recorded impact';
}

export function BlastRadiusPanel() {
  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore(state => state.workspace);
  const switchRack = useRackStore(state => state.switchRack);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const [isOpen, setIsOpen] = useState(true);
  const [showIndirect, setShowIndirect] = useState(false);

  const analysis = useMemo(() => {
    if (!selectedDeviceId) return null;
    return analyzeBlastRadius(layout, selectedDeviceId, workspace);
  }, [layout, selectedDeviceId, workspace]);
  const openDevice = (id: string, rackId?: string) => {
    if (rackId && rackId !== layout.id) switchRack(rackId);
    selectDevice(id);
  };

  return (
    <section
      aria-label="Blast radius analysis"
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
                    Review priority (heuristic)
                  </div>
                  <div className="text-sm font-semibold" style={{ color: getCriticalityColor(analysis.criticalityScore) }}>
                    {getCriticalityLabel(analysis.criticalityScore)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-content-muted">Supply loss uses recorded wired and PoE paths across racks with remaining root supplies assumed live. Removing a UPS means its output fails, not a mains outage. Network and restart records identify dependencies to review, not confirmed service downtime. The weighted score is not a failure probability; missing records do not establish low risk.</p>
              {analysis.retainedPower.length > 0 && <p className="text-xs text-content-muted">Retained supply path: {analysis.retainedPower.map(d => d.name).join(', ')}. Capacity and actual operation still need verification.</p>}
              {analysis.untracedPower.length > 0 && <p className="text-xs text-amber-500">Supply path untraced before failure: {analysis.untracedPower.map(d => d.name).join(', ')}.</p>}
              {analysis.warnings.length > 0 && <details className="text-xs text-amber-500"><summary>Supply model warnings ({analysis.warnings.length})</summary><ul className="mt-1 space-y-1">{analysis.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
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
                    {analysis.totalAffected} device{analysis.totalAffected === 1 ? '' : 's'} with recorded impacts to review
                  </span>
                </div>
              )}

              {/* Direct records */}
              {analysis.directlyImpacted.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                    Direct records
                  </div>
                  <div className="space-y-1">
                    {analysis.directlyImpacted.map((device) => {
                      const config = impactConfig[device.impactType];
                      const Icon = config.icon;
                      return (
                        <button
                          key={`${device.rackId ?? layout.id}:${device.deviceId}`}
                          type="button"
                          onClick={() => openDevice(device.deviceId, device.rackId)}
                          className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:brightness-110"
                          style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                        >
                          <Icon size={12} style={{ color: config.colorVar }} />
                          <span className="flex-1" style={{ color: 'var(--theme-text-primary)' }}>{device.deviceName}<span className="mt-1 block text-content-muted">{device.detail}</span></span>
                          <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Indirect records */}
              {analysis.indirectlyImpacted.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowIndirect((v) => !v)}
                    className="mb-1.5 flex w-full items-center justify-between text-xs font-medium transition"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    <span>Indirect records ({analysis.indirectlyImpacted.length})</span>
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
                            key={`${device.rackId ?? layout.id}:${device.deviceId}`}
                            type="button"
                            onClick={() => openDevice(device.deviceId, device.rackId)}
                            className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:brightness-110"
                            style={{ borderColor: 'var(--theme-border-light)', backgroundColor: 'var(--theme-bg-input)' }}
                          >
                            <Icon size={12} style={{ color: config.colorVar }} />
                            <span className="flex-1" style={{ color: 'var(--theme-text-primary)' }}>{device.deviceName}<span className="mt-1 block text-content-muted">{device.detail}</span></span>
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
                    Recorded supplies, peers and boot prerequisites
                  </div>
                  <div className="space-y-1">
                    {analysis.upstreamDependencies.map((dep) => {
                      const config = impactConfig[dep.type];
                      const Icon = config.icon;
                      return (
                        <button
                          key={`${dep.rackId ?? layout.id}:${dep.deviceId}-${dep.type}`}
                          type="button"
                          onClick={() => openDevice(dep.deviceId, dep.rackId)}
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
                  No dependencies or impacts are recorded for this device. Missing data does not establish safe or uninterrupted operation.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

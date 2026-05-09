import { AlertTriangle, Cable, ChevronDown, Scale, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RackLayout } from '../types/rack';
import {
  getCableStrainRisks,
  getFrontRearCollisions,
  getHeavyOverLightIssues,
} from '../utils/serviceability';

interface ServiceabilityPanelProps {
  layout: RackLayout;
}

export function ServiceabilityPanel({ layout }: ServiceabilityPanelProps) {
  const strainRisks = useMemo(() => getCableStrainRisks(layout), [layout]);
  const collisions = useMemo(() => getFrontRearCollisions(layout), [layout]);
  const heavyLight = useMemo(() => getHeavyOverLightIssues(layout), [layout]);

  const totalIssues = strainRisks.length + collisions.length + heavyLight.length;
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <div className="flex items-center gap-2">
          <Wrench size={15} />
          Serviceability
        </div>
        <div className="flex items-center gap-2">
          {totalIssues > 0 && (
            <span
              className="rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: collisions.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: collisions.length > 0 ? '#f87171' : '#fbbf24',
              }}
            >
              {totalIssues} issue{totalIssues === 1 ? '' : 's'}
            </span>
          )}
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {totalIssues === 0 ? (
            <div
              className="rounded-md border p-3 text-xs"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              No serviceability concerns detected. All devices should be accessible for maintenance.
            </div>
          ) : (
            <div className="space-y-2">
              {collisions.map((collision) => (
                <div
                  key={`collision-${collision.frontDeviceId}-${collision.rearDeviceId}`}
                  className="rounded-md border p-2.5"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.05)',
                    borderColor: 'rgba(239,68,68,0.3)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="shrink-0 text-red-400" />
                    <span className="text-xs font-medium text-red-300">Front/rear collision</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {collision.frontDeviceName} ({collision.frontDepthMm}mm) and {collision.rearDeviceName} ({collision.rearDepthMm}mm) combine to {collision.combinedDepthMm}mm, exceeding the {collision.rackDepthMm}mm rack depth.
                  </div>
                </div>
              ))}

              {strainRisks.map((risk) => (
                <div
                  key={`strain-${risk.cableId}-${risk.deviceId}`}
                  className="rounded-md border p-2.5"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.05)',
                    borderColor: 'rgba(245,158,11,0.3)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Cable size={13} className="shrink-0 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">Cable strain</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {risk.deviceName}: cable is {risk.cableLengthMm}mm but needs {risk.requiredLengthMm}mm to pull out for service.
                  </div>
                </div>
              ))}

              {heavyLight.map((issue) => (
                <div
                  key={`heavy-${issue.upperDeviceId}-${issue.lowerDeviceId}`}
                  className="rounded-md border p-2.5"
                  style={{
                    backgroundColor: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Scale size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>Access blocked</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {issue.upperDeviceName} ({issue.upperWeightKg}kg) sits above {issue.lowerDeviceName} ({issue.lowerWeightKg}kg). Servicing the lower device requires supporting the heavy unit above.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

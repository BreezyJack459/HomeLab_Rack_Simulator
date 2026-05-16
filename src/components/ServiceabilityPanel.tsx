import { AlertTriangle, Cable, ChevronDown, Scale, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import {
  getDeviceMaintenanceChecklist,
  getCableStrainRisks,
  getFrontRearCollisions,
  getHeavyOverLightIssues,
  getServiceabilityHighlightedDeviceIds,
} from '../utils/serviceability';

interface ServiceabilityPanelProps {
  layout: RackLayout;
  overlayEnabled: boolean;
  onOverlayEnabledChange: (enabled: boolean) => void;
  onHighlightDevicesChange: (deviceIds: string[]) => void;
}

export function ServiceabilityPanel({
  layout,
  overlayEnabled,
  onOverlayEnabledChange,
  onHighlightDevicesChange,
}: ServiceabilityPanelProps) {
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const strainRisks = useMemo(() => getCableStrainRisks(layout), [layout]);
  const collisions = useMemo(() => getFrontRearCollisions(layout), [layout]);
  const heavyLight = useMemo(() => getHeavyOverLightIssues(layout), [layout]);
  const highlightedIds = useMemo(() => getServiceabilityHighlightedDeviceIds(layout), [layout]);
  const maintenanceChecklist = useMemo(
    () => (selectedDeviceId ? getDeviceMaintenanceChecklist(layout, selectedDeviceId) : []),
    [layout, selectedDeviceId]
  );

  const totalIssues = strainRisks.length + collisions.length + heavyLight.length;
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    onHighlightDevicesChange(overlayEnabled ? highlightedIds : []);
  }, [highlightedIds, onHighlightDevicesChange, overlayEnabled]);

  function focusDevices(deviceIds: string[]) {
    onHighlightDevicesChange(deviceIds);
    if (deviceIds[0]) selectDevice(deviceIds[0]);
  }

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
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOverlayEnabledChange(!overlayEnabled);
            }}
            className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
            style={{
              borderColor: overlayEnabled ? 'rgba(251,191,36,0.45)' : 'var(--theme-border)',
              backgroundColor: overlayEnabled ? 'rgba(251,191,36,0.12)' : 'transparent',
              color: overlayEnabled ? '#fbbf24' : 'var(--theme-text-muted)',
            }}
          >
            {overlayEnabled ? 'Overlay on' : 'Overlay off'}
          </button>
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
            <div className="space-y-2">
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
              {selectedDeviceId && maintenanceChecklist.length > 0 && (
                <div className="rounded-md border p-3" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                    Maintenance checklist
                  </div>
                  <div className="space-y-1.5">
                    {maintenanceChecklist.map((item) => (
                      <div key={item.id} className="rounded border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
                        <div className="font-medium" style={{ color: item.severity === 'critical' ? '#f87171' : item.severity === 'warning' ? '#fbbf24' : 'var(--theme-text-secondary)' }}>
                          {item.title}
                        </div>
                        <div className="mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {collisions.map((collision) => (
                <button
                  type="button"
                  key={`collision-${collision.frontDeviceId}-${collision.rearDeviceId}`}
                  className="w-full rounded-md border p-2.5 text-left"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.05)',
                    borderColor: 'rgba(239,68,68,0.3)',
                  }}
                  onClick={() => focusDevices([collision.frontDeviceId, collision.rearDeviceId])}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="shrink-0 text-red-400" />
                    <span className="text-xs font-medium text-red-300">Front/rear collision</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {collision.frontDeviceName} ({collision.frontDepthMm}mm) and {collision.rearDeviceName} ({collision.rearDepthMm}mm) combine to {collision.combinedDepthMm}mm, exceeding the {collision.rackDepthMm}mm rack depth.
                  </div>
                </button>
              ))}

              {strainRisks.map((risk) => (
                <button
                  type="button"
                  key={`strain-${risk.cableId}-${risk.deviceId}`}
                  className="w-full rounded-md border p-2.5 text-left"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.05)',
                    borderColor: 'rgba(245,158,11,0.3)',
                  }}
                  onClick={() => focusDevices([risk.deviceId])}
                >
                  <div className="flex items-center gap-2">
                    <Cable size={13} className="shrink-0 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">Cable strain</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {risk.deviceName}: cable is {risk.cableLengthMm}mm but needs {risk.requiredLengthMm}mm to pull out for service.
                  </div>
                </button>
              ))}

              {heavyLight.map((issue) => (
                <button
                  type="button"
                  key={`heavy-${issue.upperDeviceId}-${issue.lowerDeviceId}`}
                  className="w-full rounded-md border p-2.5 text-left"
                  style={{
                    backgroundColor: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border)',
                  }}
                  onClick={() => focusDevices([issue.upperDeviceId, issue.lowerDeviceId])}
                >
                  <div className="flex items-center gap-2">
                    <Scale size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>Access blocked</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {issue.upperDeviceName} ({issue.upperWeightKg}kg) sits above {issue.lowerDeviceName} ({issue.lowerWeightKg}kg). Servicing the lower device requires supporting the heavy unit above.
                  </div>
                </button>
              ))}

              {selectedDeviceId && maintenanceChecklist.length > 0 && (
                <div className="rounded-md border p-3" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                    Maintenance checklist
                  </div>
                  <div className="space-y-1.5">
                    {maintenanceChecklist.map((item) => (
                      <div key={item.id} className="rounded border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
                        <div className="font-medium" style={{ color: item.severity === 'critical' ? '#f87171' : item.severity === 'warning' ? '#fbbf24' : 'var(--theme-text-secondary)' }}>
                          {item.title}
                        </div>
                        <div className="mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

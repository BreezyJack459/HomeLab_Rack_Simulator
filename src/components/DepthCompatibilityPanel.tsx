import { Maximize, Minimize, Ruler } from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import { getDepthCompatibilityIssues, getDepthSummary } from '../utils/rackMath';

export function DepthCompatibilityPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const summary = getDepthSummary(layout);
  const issueDevices = getDepthCompatibilityIssues(layout);

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        <Ruler size={14} />
        Depth Compatibility
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div style={{ color: 'var(--theme-text-muted)' }}>Rack depth</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{layout.rackDepthMm} mm</div>
          </div>
          <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div style={{ color: 'var(--theme-text-muted)' }}>Usable depth</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{summary.usableDepthMm} mm</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div style={{ color: 'var(--theme-text-muted)' }}>Rail min</div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-14 rounded border px-1 py-0.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--theme-bg-input)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                value={layout.railMinDepthMm ?? 0}
                onChange={(e) => updateRack({ railMinDepthMm: Math.max(0, Number(e.target.value)) })}
                min={0}
              />
              <span style={{ color: 'var(--theme-text-secondary)' }}>mm</span>
            </div>
          </div>
          <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div style={{ color: 'var(--theme-text-muted)' }}>Rail max</div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-14 rounded border px-1 py-0.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--theme-bg-input)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                value={layout.railMaxDepthMm ?? layout.rackDepthMm}
                onChange={(e) => updateRack({ railMaxDepthMm: Math.max(0, Number(e.target.value)) })}
                min={0}
              />
              <span style={{ color: 'var(--theme-text-secondary)' }}>mm</span>
            </div>
          </div>
        </div>

        <div className="rounded border p-2 text-xs" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between" style={{ color: 'var(--theme-text-muted)' }}>
            <span className="flex items-center gap-1">
              <Maximize size={10} />
              Rear clearance
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-12 rounded border px-1 py-0.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--theme-bg-input)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                value={layout.rearClearanceMm ?? 0}
                onChange={(e) => updateRack({ rearClearanceMm: Math.max(0, Number(e.target.value)) })}
                min={0}
              />
              <span style={{ color: 'var(--theme-text-secondary)' }}>mm</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div style={{ color: 'var(--theme-text-muted)' }}>Front door</div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-12 rounded border px-1 py-0.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--theme-bg-input)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                value={layout.frontDoorClearanceMm ?? 0}
                onChange={(e) => updateRack({ frontDoorClearanceMm: Math.max(0, Number(e.target.value)) })}
                min={0}
              />
              <span style={{ color: 'var(--theme-text-secondary)' }}>mm</span>
            </div>
          </div>
          <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div style={{ color: 'var(--theme-text-muted)' }}>Rear door</div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-12 rounded border px-1 py-0.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--theme-bg-input)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                value={layout.rearDoorClearanceMm ?? 0}
                onChange={(e) => updateRack({ rearDoorClearanceMm: Math.max(0, Number(e.target.value)) })}
                min={0}
              />
              <span style={{ color: 'var(--theme-text-secondary)' }}>mm</span>
            </div>
          </div>
        </div>

        {summary.deepestMm > 0 && (
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            <span>Deepest device</span>
            <span style={{ color: 'var(--theme-text-primary)' }}>{summary.deepestMm} mm</span>
          </div>
        )}

        {summary.maxRequiredRearBendMm > 0 && (
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            <span>Largest rear bend need</span>
            <span style={{ color: 'var(--theme-text-primary)' }}>{summary.maxRequiredRearBendMm} mm</span>
          </div>
        )}

        {issueDevices.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>Depth issues ({issueDevices.length})</div>
            {issueDevices.map(({ device, reasons, requiredRearBendMm }) => (
              <button
                key={device.id}
                className="flex w-full items-center gap-2 rounded border p-2 text-left text-xs transition hover:opacity-80"
                style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}
                onClick={() => selectDevice(device.id)}
                type="button"
              >
                <Minimize size={10} className={reasons.includes('too-deep') ? 'text-red-400' : reasons.includes('rail-max') || reasons.includes('rear-bend') ? 'text-amber-400' : 'text-sky-400'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium" style={{ color: 'var(--theme-text-primary)' }}>{device.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                    {(device.mountEnvelopeMm ?? 0) > 0
                      ? `${device.depthMm}+${device.mountEnvelopeMm ?? 0}=${device.depthMm + (device.mountEnvelopeMm ?? 0)}mm`
                      : `${device.depthMm}mm`}
                    {reasons.includes('too-deep') && ` > usable ${summary.usableDepthMm}mm`}
                    {reasons.includes('rail-min') && ` < rail min ${layout.railMinDepthMm ?? 0}mm`}
                    {reasons.includes('rail-max') && ` > rail max ${layout.railMaxDepthMm ?? layout.rackDepthMm}mm`}
                    {reasons.includes('rear-bend') && ` / needs ${requiredRearBendMm}mm bend`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded border p-2 text-center text-xs" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
            All devices fit within depth and rail constraints.
          </div>
        )}
      </div>
    </section>
  );
}

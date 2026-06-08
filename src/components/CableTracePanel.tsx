import { Cable, ChevronRight, CircleDot, Unlink } from 'lucide-react';
import { useMemo } from 'react';
import { useRackStore } from '../store/rackStore';
import { traceCable } from '../utils/cableTrace';

export function CableTracePanel() {
  const layout = useRackStore((state) => state.layout);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);

  const trace = useMemo(() => {
    if (!selectedCableId) return null;
    return traceCable(layout, selectedCableId);
  }, [layout, selectedCableId]);

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        <Cable size={14} />
        Cable Trace
      </div>

      {!trace ? (
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          Select a cable to trace its full path through patch panels and devices.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs">
            {trace.complete ? (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium bg-emerald-500/15 text-emerald-100">
                <CircleDot size={10} />
                Complete path
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium bg-amber-500/15 text-amber-100">
                <Unlink size={10} />
                {trace.brokenReason ?? 'Incomplete path'}
              </span>
            )}
          </div>

          <div className="space-y-1">
            {/* Start device */}
            <button
              className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm transition hover:opacity-80"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)'
              }}
              onClick={() => selectDevice(trace.startDevice.id)}
              type="button"
            >
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--theme-text-muted)' }}>From</span>
              <span className="truncate font-medium">{trace.startDevice.name}</span>
            </button>

            {/* Hops */}
            {trace.hops.map((hop, index) => (
              <div key={`${hop.cable.id}-${index}`} className="flex flex-col gap-1">
                {hop.panelJack ? (
                  <div
                    className="flex items-center gap-2 rounded-md border p-2 text-xs"
                    style={{
                      backgroundColor: 'var(--theme-bg-primary)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <ChevronRight size={12} style={{ color: 'var(--theme-text-muted)' }} />
                    <span style={{ color: 'var(--theme-text-secondary)' }}>
                      {hop.panelJack.panel.name} — Jack {hop.panelJack.index + 1}
                    </span>
                    <span className="rounded px-1 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--theme-bg-input)', color: 'var(--theme-text-muted)' }}>
                      {hop.panelJack.entrySide} → {hop.panelJack.exitSide}
                    </span>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-2 rounded-md border p-2 text-left text-xs transition hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--theme-bg-primary)',
                      borderColor: 'var(--theme-border)',
                    }}
                    onClick={() => selectCable(hop.cable.id)}
                    type="button"
                  >
                    <ChevronRight size={12} style={{ color: 'var(--theme-text-muted)' }} />
                    <span style={{ color: 'var(--theme-text-secondary)' }}>
                      {hop.cable.type} cable
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                      ({hop.fromDevice.name} → {hop.toDevice.name})
                    </span>
                  </button>
                )}
              </div>
            ))}

            {/* End device */}
            <button
              className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm transition hover:opacity-80"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)'
              }}
              onClick={() => selectDevice(trace.endDevice.id)}
              type="button"
            >
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--theme-text-muted)' }}>To</span>
              <span className="truncate font-medium">{trace.endDevice.name}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

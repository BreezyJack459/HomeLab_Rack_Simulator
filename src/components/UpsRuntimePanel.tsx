import { Battery, BatteryCharging, BatteryWarning, Clock } from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import { calculateUpsRuntimes } from '../utils/upsRuntime';

const STATUS_STYLES = {
  ok: { bg: 'bg-emerald-500/15', text: 'text-emerald-100', border: 'border-emerald-500/20' },
  warning: { bg: 'bg-amber-500/15', text: 'text-amber-100', border: 'border-amber-500/20' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-100', border: 'border-red-500/20' },
};

const STATUS_LABELS = {
  ok: 'Good runtime',
  warning: 'Short runtime',
  critical: 'Critical runtime',
};

export function UpsRuntimePanel() {
  const layout = useRackStore((state) => state.layout);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const upses = calculateUpsRuntimes(layout);

  if (upses.length === 0) {
    return (
      <section
        className="rounded-lg border p-4"
        style={{
          backgroundColor: 'var(--theme-bg-secondary)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          UPS Runtime
        </div>
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          No UPS devices in this layout. Add a UPS to see battery runtime estimates.
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        UPS Runtime
      </div>

      <div className="space-y-3">
        {upses.map((ups) => {
          const style = STATUS_STYLES[ups.status];
          const statusIcon =
            ups.status === 'ok' ? (
              <BatteryCharging size={14} className="text-emerald-400" />
            ) : ups.status === 'warning' ? (
              <BatteryWarning size={14} className="text-amber-400" />
            ) : (
              <BatteryWarning size={14} className="text-red-400" />
            );

          return (
            <div
              key={ups.device.id}
              className={`cursor-pointer rounded-lg border p-3 transition hover:opacity-90 ${style.border} ${style.bg}`}
              onClick={() => selectDevice(ups.device.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                selectDevice(ups.device.id);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon}
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                    {ups.device.name}
                  </span>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
                  {STATUS_LABELS[ups.status]}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} style={{ color: 'var(--theme-text-muted)' }} />
                  <span className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    {ups.runtimeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Battery size={12} style={{ color: 'var(--theme-text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {ups.batteryWh} Wh
                  </span>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  <span>Load</span>
                  <span>
                    {ups.loadW}W
                    {ups.capacityW ? ` / ${ups.capacityW}W` : ''}
                    {ups.capacityW ? ` (${Math.round(ups.loadPercent)}%)` : ''}
                  </span>
                </div>
                {ups.capacityW && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
                    <div
                      className={`h-full rounded-full ${
                        ups.loadPercent > 90
                          ? 'bg-red-500'
                          : ups.loadPercent > 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, ups.loadPercent)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
        Estimates assume 85% inverter efficiency and 80% depth of discharge. Actual runtime varies by battery age and temperature.
      </div>
    </section>
  );
}

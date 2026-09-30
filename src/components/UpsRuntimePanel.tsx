import { useState } from 'react';
import { Battery, BatteryCharging, BatteryWarning, Clock, ShieldAlert } from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import { assessUpsOutage, calculateUpsRuntimes } from '../utils/upsRuntime';

const STATUS_STYLES = {
  ok: { bg: 'bg-emerald-500/15', text: 'text-emerald-100', border: 'border-emerald-500/20' },
  warning: { bg: 'bg-amber-500/15', text: 'text-amber-100', border: 'border-amber-500/20' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-100', border: 'border-red-500/20' },
};

const STATUS_LABELS = {
  ok: 'Long estimate',
  warning: 'Review estimate',
  critical: 'Short estimate',
};

export function UpsRuntimePanel() {
  const [outageMinutes, setOutageMinutes] = useState('30');
  const layout = useRackStore((state) => state.layout);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const workspace = useRackStore(state => state.workspace);
  const upses = calculateUpsRuntimes(layout, workspace);

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

      <label className="mb-3 block text-xs text-content-secondary">Outage duration to compare (minutes)
        <input type="number" min="1" step="any" className="ml-2 w-24 rounded border border-edge bg-surface p-2" value={outageMinutes} onChange={e => setOutageMinutes(e.target.value)} />
      </label>
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

              <p className="mt-2 text-xs" role="status">{assessUpsOutage(ups, Number(outageMinutes))}</p>
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
                    {ups.device.batteryWh === undefined ? 'Battery Wh unknown' : `${ups.batteryWh} Wh`}
                  </span>
                </div>
              </div>

              <div className="mt-2 rounded-md border border-white/10 bg-black/10 p-2">
                <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  <span className="inline-flex items-center gap-1">
                    <ShieldAlert size={11} />
                    Critical-only runtime
                  </span>
                  <span>
                    {ups.criticalRuntimeLabel}
                    {ups.capacityW ? ` (${Math.round(ups.criticalLoadPercent)}% load)` : ''}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  <div className="rounded border border-white/10 px-2 py-1">
                    Critical
                    <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                      {ups.groups.criticalW}W
                    </div>
                  </div>
                  <div className="rounded border border-white/10 px-2 py-1">
                    Graceful
                    <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                      {ups.groups.gracefulW}W
                    </div>
                  </div>
                  <div className="rounded border border-white/10 px-2 py-1">
                    Non-critical
                    <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                      {ups.groups.nonCriticalW}W
                    </div>
                  </div>
                  <div className="rounded border border-white/10 px-2 py-1">
                    Infra overhead
                    <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                      {ups.groups.infrastructureW}W
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  <span>Utility output load</span>
                  <span>
                    {ups.outputLoadW.toFixed(2)}W
                    {ups.capacityW ? ` / ${ups.capacityW}W` : ''}
                    {ups.capacityW ? ` (${Math.round(ups.loadPercent)}%)` : ''}
                  </span>
                </div>
                {!ups.capacityW && <p className="text-xs text-amber-400">Output capacity unverified. Enter the UPS watt rating in device properties.</p>}
                <p className="text-xs text-content-muted">Recorded battery-path load: {ups.loadW.toFixed(2)} W, including {ups.device.powerW} W UPS self-load. Surge-only outlets are excluded from battery load; unknown outlet types prevent a runtime estimate. Utility output load includes all connected outputs.</p>
                <p className="text-xs text-content-muted">Estimate uses {ups.assumptions.efficiencyPct}% efficiency, {ups.assumptions.usableCapacityPct}% usable capacity and {ups.assumptions.chargePct}% starting charge.</p>
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

              {ups.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {ups.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {ups.shutdownPlan.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--theme-text-muted)' }}>
                    Shutdown order
                  </div>
                  <div className="mt-1 space-y-1">
                    {ups.shutdownPlan.slice(0, 5).map((step, index) => (
                      <div
                        key={`${ups.device.id}-${step.device.id}`}
                        className="flex items-start justify-between gap-3 rounded border border-white/10 px-2 py-1 text-[10px]"
                      >
                        <div className="min-w-0">
                          <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            {index + 1}. {step.device.label || step.device.name}
                          </div>
                          <div style={{ color: 'var(--theme-text-muted)' }}>{step.reason}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="uppercase" style={{ color: 'var(--theme-text-secondary)' }}>
                            {step.priority}
                          </div>
                          <div style={{ color: 'var(--theme-text-muted)' }}>{step.device.powerW}W</div>
                        </div>
                      </div>
                    ))}
                    {ups.shutdownPlan.length > 5 && (
                      <div className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                        +{ups.shutdownPlan.length - 5} more device{ups.shutdownPlan.length - 5 === 1 ? '' : 's'} in plan
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
        Constant-load energy estimates use each UPS’s recorded assumptions. Explicit PoE output draw and PSE conversion efficiency are included when planning watts exclude PoE; inclusive planning watts are not increased again. PoE output follows its PSE shutdown priority, without automatic receiver shedding. Each independent wired feed carries full planning load. Transfer time, startup surge, downstream distribution ratings and battery discharge curves are not verified. Dual feeds are assessed independently at full load; battery energies are not added together.
      </div>
    </section>
  );
}

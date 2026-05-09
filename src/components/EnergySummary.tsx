import type { RackLayout } from '../types/rack';
import { calculateEnergySummary, formatBtuPerHour, formatCurrency } from '../utils/energyCalc';

interface EnergySummaryProps {
  layout: RackLayout;
  onRateChange?: (rate: number) => void;
}

export function EnergySummary({ layout, onRateChange }: EnergySummaryProps) {
  const summary = calculateEnergySummary(layout);

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        Energy & Heat
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-md border px-3 py-2"
          style={{
            backgroundColor: 'var(--theme-bg-primary)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Monthly kWh</div>
          <div className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.monthlyKwh.toFixed(1)}
          </div>
        </div>

        <div
          className="rounded-md border px-3 py-2"
          style={{
            backgroundColor: 'var(--theme-bg-primary)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Est. monthly cost</div>
          <div className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {formatCurrency(summary.monthlyCost, layout.electricityRatePerKwh ?? 0)}
          </div>
        </div>

        <div
          className="rounded-md border px-3 py-2"
          style={{
            backgroundColor: 'var(--theme-bg-primary)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Heat output</div>
          <div className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {formatBtuPerHour(summary.heatBtuPerHour)} BTU/h
          </div>
        </div>

        <div
          className="rounded-md border px-3 py-2"
          style={{
            backgroundColor: 'var(--theme-bg-primary)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Power utilization</div>
          <div className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.utilizationPercent}%
          </div>
        </div>
      </div>

      {onRateChange && (
        <label className="mt-3 block text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          Electricity rate ($/kWh)
          <input
            className="mt-1 h-9 w-full rounded-md border px-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--theme-bg-input)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)'
            }}
            type="number"
            min={0.01}
            step={0.01}
            value={layout.electricityRatePerKwh}
            onChange={(e) => onRateChange(Number(e.target.value))}
          />
        </label>
      )}
    </section>
  );
}

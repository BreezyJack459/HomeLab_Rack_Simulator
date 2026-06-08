import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Flame,
  Gauge,
  Lightbulb,
  Maximize2,
  Megaphone,
  Network,
  Plug,
  Ruler,
  Scale,
  TrendingDown,
  Volume2,
  Weight,
  XCircle,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ForecastCategory, ForecastStatus } from '../utils/capacityForecast';
import { analyzeCapacityForecast } from '../utils/capacityForecast';

const categoryConfig: Record<
  ForecastCategory,
  { label: string; icon: typeof Zap; unit: string }
> = {
  space: { label: 'Rack Space', icon: Ruler, unit: 'U' },
  power: { label: 'Power', icon: Zap, unit: 'W' },
  weight: { label: 'Weight', icon: Weight, unit: 'kg' },
  'switch-ports': { label: 'Switch Ports', icon: Network, unit: 'ports' },
  'pdu-outlets': { label: 'PDU Outlets', icon: Plug, unit: 'outlets' },
  heat: { label: 'Thermal', icon: Flame, unit: 'pts' },
  noise: { label: 'Noise', icon: Volume2, unit: 'dB' },
  'cable-density': { label: 'Cable Density', icon: Gauge, unit: 'cables' },
};

const statusConfig: Record<
  ForecastStatus,
  { icon: typeof CheckCircle2; colorClass: string; bgClass: string; barClass: string }
> = {
  good: {
    icon: CheckCircle2,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    barClass: 'bg-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    barClass: 'bg-amber-500',
  },
  critical: {
    icon: XCircle,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500/10 border-red-500/30',
    barClass: 'bg-red-500',
  },
};

function CategoryCard({
  category,
  current,
  max,
  percentUsed,
  headroom,
  estimatedDevicesUntilExhaustion,
  status,
}: {
  category: ForecastCategory;
  current: number;
  max: number;
  percentUsed: number;
  headroom: number;
  estimatedDevicesUntilExhaustion: number;
  status: ForecastStatus;
}) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  const s = statusConfig[status];
  const StatusIcon = s.icon;

  return (
    <div
      className={`rounded-md border p-2.5 ${s.bgClass}`}
      style={{ borderColor: 'var(--theme-border-light)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className={s.colorClass} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
            {config.label}
          </span>
        </div>
        <StatusIcon size={12} className={s.colorClass} />
      </div>

      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
          {current}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
          / {max} {config.unit}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--theme-bg-primary)' }}>
        <div
          className={`h-full rounded-full ${s.barClass}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <span style={{ color: 'var(--theme-text-muted)' }}>
          {percentUsed.toFixed(0)}% used
        </span>
        <span style={{ color: 'var(--theme-text-secondary)' }}>
          ~{estimatedDevicesUntilExhaustion} more
        </span>
      </div>
    </div>
  );
}

export function CapacityForecastPanel() {
  const layout = useRackStore((state) => state.layout);
  const [isOpen, setIsOpen] = useState(true);

  const forecast = useMemo(() => analyzeCapacityForecast(layout), [layout]);

  const overall = statusConfig[forecast.overallStatus];
  const OverallIcon = overall.icon;

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
          <TrendingDown size={15} />
          Capacity Forecast
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${overall.bgClass} ${overall.colorClass}`}>
            {forecast.overallStatus === 'good'
              ? 'Healthy'
              : forecast.overallStatus === 'warning'
                ? 'Tight'
                : 'Critical'}
          </span>
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
          {/* Next bottleneck */}
          {forecast.nextBottleneck && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 ${overall.bgClass}`}
            >
              <Maximize2 size={14} className={overall.colorClass} />
              <div className="text-xs">
                <span style={{ color: 'var(--theme-text-muted)' }}>Next bottleneck: </span>
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {categoryConfig[forecast.nextBottleneck].label}
                </span>
              </div>
            </div>
          )}

          {/* Category grid */}
          <div className="grid grid-cols-2 gap-2">
            {forecast.categories.map((cat) => (
              <CategoryCard
                key={cat.category}
                category={cat.category}
                current={cat.current}
                max={cat.max}
                percentUsed={cat.percentUsed}
                headroom={cat.headroom}
                estimatedDevicesUntilExhaustion={cat.estimatedDevicesUntilExhaustion}
                status={cat.status}
              />
            ))}
          </div>

          {/* Recommendations */}
          {forecast.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                <Lightbulb size={11} />
                Recommendations
              </div>
              {forecast.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-secondary)',
                  }}
                >
                  <Megaphone size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--theme-text-muted)' }} />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

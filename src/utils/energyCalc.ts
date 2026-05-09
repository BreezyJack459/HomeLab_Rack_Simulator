import type { RackLayout } from '../types/rack';

const HOURS_PER_MONTH = 730; // ~30.4 days
const WATTS_TO_BTU_PER_HOUR = 3.412;

export interface EnergySummary {
  totalPowerW: number;
  monthlyKwh: number;
  monthlyCost: number;
  heatBtuPerHour: number;
  utilizationPercent: number;
}

export function calculateEnergySummary(layout: RackLayout): EnergySummary {
  const totalPowerW = layout.devices.reduce((sum, d) => sum + d.powerW, 0);
  const monthlyKwh = (totalPowerW * HOURS_PER_MONTH) / 1000;
  const monthlyCost = monthlyKwh * (layout.electricityRatePerKwh ?? 0);
  const heatBtuPerHour = totalPowerW * WATTS_TO_BTU_PER_HOUR;
  const utilizationPercent = layout.powerBudgetW > 0
    ? Math.round((totalPowerW / layout.powerBudgetW) * 100)
    : 0;

  return {
    totalPowerW,
    monthlyKwh,
    monthlyCost,
    heatBtuPerHour,
    utilizationPercent
  };
}

export function formatCurrency(amount: number, rate: number): string {
  // Simple heuristic: rates > 1 are likely non-USD (e.g. HKD, TWD)
  const symbol = rate > 1 ? '$' : '$';
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatBtuPerHour(btu: number): string {
  if (btu >= 1000) return `${(btu / 1000).toFixed(1)}k`;
  return `${Math.round(btu)}`;
}

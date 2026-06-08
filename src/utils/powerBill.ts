import type { PlacedDevice, PowerBillEntry } from '../types/rack';

export const HOURS_PER_MONTH = 730;

export interface PowerBillSummary {
  totalEntries: number;
  totalActualKwh: number;
  totalActualCost: number;
  avgMonthlyKwh: number;
  avgMonthlyCost: number;
  estimatedMonthlyKwh: number;
  estimatedMonthlyCost: number;
  varianceKwh: number;
  varianceCost: number;
  variancePercent: number;
  anomalyCount: number;
}

export function calculateEstimatedMonthlyKwh(devices: PlacedDevice[]): number {
  const totalPowerW = devices.reduce((sum, d) => sum + (d.powerW || 0), 0);
  return (totalPowerW * HOURS_PER_MONTH) / 1000;
}

export function summarizePowerBills(
  entries: PowerBillEntry[],
  devices: PlacedDevice[],
  electricityRatePerKwh?: number
): PowerBillSummary {
  const totalEntries = entries.length;
  const totalActualKwh = entries.reduce((sum, e) => sum + (e.actualKwh || 0), 0);
  const totalActualCost = entries.reduce(
    (sum, e) => sum + (e.actualCost || 0),
    0
  );
  const avgMonthlyKwh = totalEntries > 0 ? totalActualKwh / totalEntries : 0;
  const avgMonthlyCost = totalEntries > 0 ? totalActualCost / totalEntries : 0;

  const estimatedMonthlyKwh = calculateEstimatedMonthlyKwh(devices);
  const rate = electricityRatePerKwh ?? 0.15;
  const estimatedMonthlyCost = estimatedMonthlyKwh * rate;

  const varianceKwh = avgMonthlyKwh - estimatedMonthlyKwh;
  const varianceCost = avgMonthlyCost - estimatedMonthlyCost;
  const variancePercent =
    estimatedMonthlyKwh > 0
      ? Math.round((varianceKwh / estimatedMonthlyKwh) * 100)
      : 0;

  const anomalies = detectAnomalies(entries, estimatedMonthlyKwh);

  return {
    totalEntries,
    totalActualKwh,
    totalActualCost,
    avgMonthlyKwh,
    avgMonthlyCost,
    estimatedMonthlyKwh,
    estimatedMonthlyCost,
    varianceKwh,
    varianceCost,
    variancePercent,
    anomalyCount: anomalies.length,
  };
}

export interface PowerBillAnomaly {
  entryId: string;
  month: string;
  actualKwh: number;
  expectedKwh: number;
  deviationPercent: number;
  message: string;
}

export function detectAnomalies(
  entries: PowerBillEntry[],
  estimatedMonthlyKwh: number,
  thresholdPercent = 30
): PowerBillAnomaly[] {
  if (entries.length === 0) return [];

  const anomalies: PowerBillAnomaly[] = [];
  const sorted = [...entries].sort((a, b) => a.month.localeCompare(b.month));

  // Moving average of last 3 months (excluding current)
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const prevEntries = sorted.slice(Math.max(0, i - 3), i);
    const avgKwh =
      prevEntries.length > 0
        ? prevEntries.reduce((s, e) => s + e.actualKwh, 0) / prevEntries.length
        : estimatedMonthlyKwh;

    if (avgKwh === 0) continue;

    const deviationPercent = Math.round(
      ((entry.actualKwh - avgKwh) / avgKwh) * 100
    );

    if (Math.abs(deviationPercent) > thresholdPercent) {
      anomalies.push({
        entryId: entry.id,
        month: entry.month,
        actualKwh: entry.actualKwh,
        expectedKwh: avgKwh,
        deviationPercent,
        message:
          deviationPercent > 0
            ? `${entry.month}: ${entry.actualKwh} kWh is ${deviationPercent}% above expected (${avgKwh.toFixed(0)} kWh)`
            : `${entry.month}: ${entry.actualKwh} kWh is ${Math.abs(deviationPercent)}% below expected (${avgKwh.toFixed(0)} kWh)`,
      });
    }
  }

  return anomalies;
}

function escapeCsvField(value: string | number | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportPowerBillCsv(entries: PowerBillEntry[]): string {
  const headers = ['Month', 'Actual kWh', 'Actual Cost', 'Notes'];
  const lines: string[] = [headers.join(',')];

  for (const entry of entries) {
    const row = [
      escapeCsvField(entry.month),
      escapeCsvField(entry.actualKwh),
      escapeCsvField(entry.actualCost),
      escapeCsvField(entry.notes),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function exportPowerBillMarkdown(
  entries: PowerBillEntry[],
  devices: PlacedDevice[],
  electricityRatePerKwh?: number
): string {
  const summary = summarizePowerBills(entries, devices, electricityRatePerKwh);
  const anomalies = detectAnomalies(
    entries,
    summary.estimatedMonthlyKwh
  );

  const lines: string[] = [
    '# Power Bill Reconciliation Report',
    '',
    `**Total Entries:** ${summary.totalEntries}  `,
    `**Total Actual kWh:** ${summary.totalActualKwh.toFixed(1)}  `,
    `**Total Actual Cost:** $${summary.totalActualCost.toFixed(2)}  `,
    `**Avg Monthly kWh:** ${summary.avgMonthlyKwh.toFixed(1)}  `,
    `**Estimated Monthly kWh:** ${summary.estimatedMonthlyKwh.toFixed(1)}  `,
    `**Variance:** ${summary.variancePercent > 0 ? '+' : ''}${summary.variancePercent}%`,
    '',
    '| Month | kWh | Cost | Notes |',
    '|-------|-----|------|-------|',
  ];

  for (const entry of [...entries].sort((a, b) =>
    b.month.localeCompare(a.month)
  )) {
    const cost = entry.actualCost != null ? `$${entry.actualCost.toFixed(2)}` : '-';
    lines.push(
      `| ${entry.month} | ${entry.actualKwh} | ${cost} | ${entry.notes ?? ''} |`
    );
  }

  if (anomalies.length > 0) {
    lines.push('', '## Anomalies', '');
    for (const a of anomalies) {
      lines.push(`- ${a.message}`);
    }
  }

  return lines.join('\n');
}

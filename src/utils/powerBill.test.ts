import { describe, it, expect } from 'vitest';
import type { PlacedDevice, PowerBillEntry } from '../types/rack';
import {
  calculateEstimatedMonthlyKwh,
  summarizePowerBills,
  detectAnomalies,
  exportPowerBillCsv,
  exportPowerBillMarkdown,
} from './powerBill';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    name: 'Test Device',
    category: 'server',
    positionU: 1,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 5,
    powerW: 100,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

describe('calculateEstimatedMonthlyKwh', () => {
  it('returns 0 for no devices', () => {
    expect(calculateEstimatedMonthlyKwh([])).toBe(0);
  });

  it('calculates kWh from power draw', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ powerW: 100 }),
      makeDevice({ powerW: 200 }),
    ];
    const kwh = calculateEstimatedMonthlyKwh(devices);
    expect(kwh).toBeCloseTo((300 * 730) / 1000, 1);
  });
});

describe('summarizePowerBills', () => {
  it('returns zeros for empty entries', () => {
    const s = summarizePowerBills([], [], 0.15);
    expect(s.totalEntries).toBe(0);
    expect(s.avgMonthlyKwh).toBe(0);
  });

  it('calculates averages and variance', () => {
    const entries: PowerBillEntry[] = [
      { id: 'b1', month: '2024-01', actualKwh: 200 },
      { id: 'b2', month: '2024-02', actualKwh: 220 },
    ];
    const devices: PlacedDevice[] = [makeDevice({ powerW: 200 })];
    const s = summarizePowerBills(entries, devices, 0.15);
    expect(s.totalEntries).toBe(2);
    expect(s.avgMonthlyKwh).toBe(210);
    expect(s.estimatedMonthlyKwh).toBeCloseTo((200 * 730) / 1000, 1);
  });

  it('sums total cost', () => {
    const entries: PowerBillEntry[] = [
      { id: 'b1', month: '2024-01', actualKwh: 100, actualCost: 15 },
      { id: 'b2', month: '2024-02', actualKwh: 120, actualCost: 18 },
    ];
    const s = summarizePowerBills(entries, [], 0.15);
    expect(s.totalActualCost).toBe(33);
  });
});

describe('detectAnomalies', () => {
  it('returns empty for no entries', () => {
    expect(detectAnomalies([], 100)).toEqual([]);
  });

  it('detects high usage spike', () => {
    const entries: PowerBillEntry[] = [
      { id: 'b1', month: '2024-01', actualKwh: 100 },
      { id: 'b2', month: '2024-02', actualKwh: 105 },
      { id: 'b3', month: '2024-03', actualKwh: 200 },
    ];
    const anomalies = detectAnomalies(entries, 100, 30);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].deviationPercent).toBeGreaterThan(30);
  });

  it('does not flag normal variation', () => {
    const entries: PowerBillEntry[] = [
      { id: 'b1', month: '2024-01', actualKwh: 100 },
      { id: 'b2', month: '2024-02', actualKwh: 105 },
      { id: 'b3', month: '2024-03', actualKwh: 98 },
    ];
    const anomalies = detectAnomalies(entries, 100, 30);
    expect(anomalies).toEqual([]);
  });
});

describe('exportPowerBillCsv', () => {
  it('produces header', () => {
    const csv = exportPowerBillCsv([]);
    expect(csv).toContain('Month,Actual kWh,Actual Cost');
  });

  it('includes entries', () => {
    const entries: PowerBillEntry[] = [
      { id: 'b1', month: '2024-01', actualKwh: 250, actualCost: 37.5 },
    ];
    const csv = exportPowerBillCsv(entries);
    expect(csv).toContain('2024-01');
    expect(csv).toContain('250');
    expect(csv).toContain('37.5');
  });
});

describe('exportPowerBillMarkdown', () => {
  it('includes summary', () => {
    const md = exportPowerBillMarkdown([], [], 0.15);
    expect(md).toContain('# Power Bill Reconciliation Report');
    expect(md).toContain('**Total Entries:** 0');
  });

  it('includes anomalies section', () => {
    const entries: PowerBillEntry[] = [
      { id: 'b1', month: '2024-01', actualKwh: 100 },
      { id: 'b2', month: '2024-02', actualKwh: 200 },
    ];
    const md = exportPowerBillMarkdown(entries, [], 0.15);
    expect(md).toContain('## Anomalies');
  });
});

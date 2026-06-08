import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { captureGoldenBaseline, getBaselineComparison, getBaselineMetrics } from './baseline';

const baseLayout: RackLayout = {
  id: 'layout-1',
  name: 'Lab A',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 900,
  viewSide: 'front',
  devices: [
    {
      id: 'sw1',
      category: 'switch',
      name: 'Switch',
      positionU: 1,
      sizeU: 1,
      depthMm: 200,
      widthType: '19in',
      weightKg: 2,
      powerW: 40,
      heatLevel: 2,
      ports: { ethernet: 8, power: 1 },
      color: '#0ea5e9'
    },
    {
      id: 'nas1',
      category: 'nas',
      name: 'NAS',
      positionU: 2,
      sizeU: 2,
      depthMm: 320,
      widthType: '19in',
      weightKg: 7,
      powerW: 90,
      heatLevel: 3,
      ports: { ethernet: 2, power: 2 },
      color: '#22c55e'
    }
  ],
  cables: [
    {
      id: 'c1',
      fromDeviceId: 'sw1',
      fromPort: { type: 'ethernet', index: 0 },
      toDeviceId: 'nas1',
      toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet',
      color: '#0ea5e9'
    }
  ],
  reservations: [],
  procurementItems: [],
  readinessChecks: [],
  commissioningChecks: [],
  changeEvents: [],
  updatedAt: '2026-05-16T00:00:00.000Z'
};

describe('baseline metrics', () => {
  it('captures the current layout and summary metrics', () => {
    const baseline = captureGoldenBaseline(baseLayout, 'Stable');
    expect(baseline.name).toBe('Stable');
    expect(baseline.snapshot.devices).toHaveLength(2);
    expect(baseline.metrics.powerW).toBe(130);
    expect(baseline.metrics.cableCount).toBe(1);
    expect(baseline.metrics.freeNetworkPorts).toBe(8);
    expect(baseline.metrics.freePowerPorts).toBe(3);
  });

  it('flags regressions and improvements against the baseline', () => {
    const goldenBaseline = captureGoldenBaseline(baseLayout, 'Stable');
    const changedLayout: RackLayout = {
      ...baseLayout,
      goldenBaseline,
      devices: [
        ...baseLayout.devices,
        {
          id: 'srv1',
          category: 'server',
          name: 'Server',
          positionU: 5,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 10,
          powerW: 180,
          heatLevel: 4,
          ports: { ethernet: 4, power: 2 },
          color: '#f97316'
        }
      ]
    };

    const rows = getBaselineComparison(changedLayout, goldenBaseline);
    expect(rows.find((row) => row.key === 'powerW')?.direction).toBe('worse');
    expect(rows.find((row) => row.key === 'freeNetworkPorts')?.direction).toBe('better');
    expect(getBaselineMetrics(changedLayout).deviceCount).toBe(3);
  });
});

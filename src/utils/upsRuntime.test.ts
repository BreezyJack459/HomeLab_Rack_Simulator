import { validateImportedLayout } from './layoutValidation';
import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { assessUpsOutage, calculateUpsRuntimes } from './upsRuntime';

const baseLayout: RackLayout = {
  id: 'test',
  name: 'Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  electricityRatePerKwh: 0.15,
  viewSide: 'front',
  devices: [],
  cables: [],
  updatedAt: new Date().toISOString(),
};

describe('calculateUpsRuntimes', () => {
  it('returns empty array when no UPS devices exist', () => {
    const layout = { ...baseLayout, devices: [] };
    expect(calculateUpsRuntimes(layout)).toEqual([]);
  });

  it('returns orphaned UPS with self-load only when no power cables', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          templateId: 'ups-1u',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: '1U UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 8,
          heatLevel: 2,
          batteryWh: 100,
          color: '#374151',
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result).toHaveLength(1);
    expect(result[0].device.id).toBe('ups1');
    expect(result[0].loadW).toBe(8);
    expect(result[0].batteryWh).toBe(100);
    expect(result[0].runtimeMinutes).toBeGreaterThan(0);
  });

  it('includes downstream load in runtime calculation', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          templateId: 'ups-1u',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: '1U UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 8,
          heatLevel: 2,
          batteryWh: 100,
          color: '#374151',
        },
        {
          id: 'server1',
          category: 'server',
          name: 'Server',
          positionU: 3,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 3,
          color: '#334155',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 0 },
          toDeviceId: 'server1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result).toHaveLength(1);
    expect(result[0].loadW).toBe(208); // 8W self + 200W downstream
    expect(result[0].runtimeMinutes).toBeLessThan(
      calculateUpsRuntimes({ ...baseLayout, devices: [layout.devices[0]] })[0].runtimeMinutes
    );
  });

  it('does not display a long self-load estimate as successful rack backup', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'Big UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 1,
          heatLevel: 2,
          batteryWh: 1000,
          color: '#374151',
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result[0].status).toBe('warning');
    expect(result[0].runtimeLabel).toBe('Not estimated');
  });

  it('returns critical status for very short runtime', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'Small UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 1,
          heatLevel: 2,
          batteryWh: 10,
          color: '#374151',
        },
        {
          id: 'server1',
          category: 'server',
          name: 'Power hog',
          positionU: 3,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 500,
          heatLevel: 5,
          color: '#334155',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 0 },
          toDeviceId: 'server1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result[0].status).toBe('critical');
  });

  it('returns warning status for medium-short runtime', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'Medium UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 1,
          heatLevel: 2,
          batteryWh: 40,
          color: '#374151',
        },
        {
          id: 'server1',
          category: 'server',
          name: 'Server',
          positionU: 3,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 100,
          heatLevel: 3,
          color: '#334155',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 0 },
          toDeviceId: 'server1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result[0].status).toBe('warning');
  });

  it('groups downstream load by outage priority and builds a shutdown plan', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 5,
          heatLevel: 2,
          batteryWh: 300,
          color: '#374151',
        },
        {
          id: 'router1',
          category: 'router',
          name: 'Router',
          positionU: 2,
          sizeU: 1,
          depthMm: 220,
          widthType: '19in',
          weightKg: 4,
          powerW: 15,
          heatLevel: 2,
          shutdownPriority: 'critical',
          color: '#334155',
        },
        {
          id: 'nas1',
          category: 'nas',
          name: 'NAS',
          positionU: 3,
          sizeU: 2,
          depthMm: 300,
          widthType: '19in',
          weightKg: 10,
          powerW: 120,
          heatLevel: 3,
          shutdownPriority: 'graceful',
          color: '#0f172a',
        },
        {
          id: 'lab1',
          category: 'mini-pc',
          name: 'Lab node',
          positionU: 5,
          sizeU: 1,
          depthMm: 180,
          widthType: '19in',
          weightKg: 2,
          powerW: 45,
          heatLevel: 2,
          shutdownPriority: 'non-critical',
          color: '#475569',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 0 },
          toDeviceId: 'router1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
        {
          id: 'c2',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 1 },
          toDeviceId: 'nas1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
        {
          id: 'c3',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 2 },
          toDeviceId: 'lab1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
      ],
    };

    const [result] = calculateUpsRuntimes(layout);
    expect(result.groups.criticalW).toBe(15);
    expect(result.groups.gracefulW).toBe(120);
    expect(result.groups.nonCriticalW).toBe(45);
    expect(result.shutdownPlan.map((step) => step.device.id)).toEqual(['lab1', 'nas1', 'router1']);
    expect(result.criticalRuntimeMinutes).toBeGreaterThan(result.runtimeMinutes);
  });

  it('warns when critical load alone is still too short', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 5,
          heatLevel: 2,
          batteryWh: 15,
          color: '#374151',
        },
        {
          id: 'fw1',
          category: 'firewall',
          name: 'Firewall',
          positionU: 2,
          sizeU: 1,
          depthMm: 220,
          widthType: '19in',
          weightKg: 3,
          powerW: 90,
          heatLevel: 2,
          shutdownPriority: 'critical',
          color: '#334155',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          fromPort: { type: 'power', index: 0 },
          toDeviceId: 'fw1',
          toPort: { type: 'power', index: 0 },
          type: 'power',
          color: '#000',
          nodes: [],
        },
      ],
    };

    const [result] = calculateUpsRuntimes(layout);
    expect(result.criticalLoadStatus).toBe('critical');
    expect(result.warnings.some((warning) => warning.includes('under 10 minutes'))).toBe(true);
  });

  it('keeps UPS devices with unknown battery energy visible', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'Legacy UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 8,
          heatLevel: 2,
          color: '#374151',
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result).toHaveLength(1);
    expect(result[0].runtimeLabel).toBe('Not estimated');
    expect(result[0].status).toBe('warning');
  });

  it('does not promise infinite runtime for zero load', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'ups1',
          category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } },
          name: 'Idle UPS',
          positionU: 1,
          sizeU: 1,
          depthMm: 360,
          widthType: '19in',
          weightKg: 14,
          powerW: 0,
          heatLevel: 2,
          batteryWh: 100,
          color: '#374151',
        },
      ],
    };
    const result = calculateUpsRuntimes(layout);
    expect(result[0].runtimeLabel).toBe('Not estimated');
    expect(result[0].status).toBe('warning');
  });
});


it('applies charge and usable capacity, checks output separately and compares outage duration', () => {
  const common = { sizeU: 1, positionU: 1, widthType: '19in' as const, depthMm: 100, weightKg: 1, heatLevel: 1 as const, color: '#333', powerReviewed: true };
  const layout: RackLayout = { ...baseLayout, devices: [
    { ...common, id: 'ups', name: 'UPS', category: 'ups',
          portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } }, powerW: 10, batteryWh: 200, powerCapacityW: 90,
      upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 50, chargePct: 50 } },
    { ...common, id: 'load', name: 'Load', category: 'server', powerW: 90 },
  ], cables: [{ id: 'feed', fromDeviceId: 'ups', fromPort: { type: 'power', index: 0 }, toDeviceId: 'load', type: 'power', color: '#333' }] };
  expect(validateImportedLayout(layout).valid).toBe(true);
  for (const assumptions of [{ chargePct: 101 }, { efficiencyPct: 0 }, { usableCapacityPct: -1 }]) {
    expect(validateImportedLayout({ ...layout, devices: [{ ...layout.devices[0], upsBatteryAssumptions: assumptions }] }).valid).toBe(false);
  }
  expect(validateImportedLayout({ ...layout, devices: [{ ...layout.devices[0], batteryWh: -1 }] }).valid).toBe(false);
  let result = calculateUpsRuntimes(layout)[0];
  expect(result.runtimeMinutes).toBe(30);
  expect(result.loadPercent).toBe(100); // UPS self-load affects energy, not rated output.
  expect(assessUpsOutage(result, 30)).toContain('covers 30 minutes');
  expect(assessUpsOutage(result, 31)).toContain('falls short');
  expect(assessUpsOutage({ ...result, unreviewedLoads: true }, 30)).toContain('need review');
  expect(assessUpsOutage({ ...result, topologyUnverified: true }, 30)).toContain('wiring warnings');
  expect(assessUpsOutage({ ...result, capacityW: undefined }, 30)).toContain('rating is unknown');
  layout.devices[0].powerCapacityW = 80;
  result = calculateUpsRuntimes(layout)[0];
  expect(result.loadPercent).toBe(112.5);
  expect(assessUpsOutage(result, 1)).toContain('overloaded by 10 W');
  layout.devices[0].upsBatteryAssumptions!.chargePct = 0;
  expect(calculateUpsRuntimes(layout)[0].runtimeMinutes).toBe(0);
});

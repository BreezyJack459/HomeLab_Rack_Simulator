import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { detectDrift, exportDriftMarkdown } from './driftDetector';

function makeLayout(devices: RackLayout['devices'], cables: RackLayout['cables']): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 400,
    weightLimitKg: 100,
    powerBudgetW: 500,
    viewSide: 'front',
    devices,
    cables,
    updatedAt: new Date().toISOString(),
  };
}

const baseDevices = [
  { id: 'd1', name: 'Router', category: 'router' as const, positionU: 1, sizeU: 1, depthMm: 200, widthType: '19in' as const, weightKg: 2, powerW: 20, heatLevel: 2 as const, color: '#333' },
  { id: 'd2', name: 'Switch', category: 'switch' as const, positionU: 2, sizeU: 1, depthMm: 200, widthType: '19in' as const, weightKg: 2, powerW: 30, heatLevel: 3 as const, color: '#555' },
];

const baseCables = [
  { id: 'c1', fromDeviceId: 'd1', toDeviceId: 'd2', type: 'ethernet' as const, color: '#00f' },
];

describe('detectDrift', () => {
  it('returns empty when layouts match', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout(baseDevices, baseCables);
    const result = detectDrift(baseline, current);
    expect(result.items.length).toBe(0);
    expect(result.summary.total).toBe(0);
  });

  it('detects added device', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout([...baseDevices, { id: 'd3', name: 'NAS', category: 'nas' as const, positionU: 3, sizeU: 2, depthMm: 300, widthType: '19in' as const, weightKg: 5, powerW: 50, heatLevel: 2 as const, color: '#777' }], baseCables);
    const result = detectDrift(baseline, current);
    expect(result.addedDevices.length).toBe(1);
    expect(result.items.some((i) => i.id.includes('device-added'))).toBe(true);
    expect(result.items[0].severity).toBe('review');
  });

  it('detects removed device as critical', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout([baseDevices[0]], baseCables);
    const result = detectDrift(baseline, current);
    expect(result.removedDevices.length).toBe(1);
    expect(result.items.some((i) => i.severity === 'critical' && i.id.includes('device-removed'))).toBe(true);
  });

  it('detects position change as critical', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const moved = [{ ...baseDevices[0], positionU: 5 }, baseDevices[1]];
    const current = makeLayout(moved, baseCables);
    const result = detectDrift(baseline, current);
    expect(result.changedDevices.length).toBe(1);
    expect(result.items.some((i) => i.severity === 'critical' && i.id.includes('device-changed'))).toBe(true);
  });

  it('detects name change as review', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const renamed = [{ ...baseDevices[0], name: 'Router Pro' }, baseDevices[1]];
    const current = makeLayout(renamed, baseCables);
    const result = detectDrift(baseline, current);
    expect(result.changedDevices.length).toBe(1);
    expect(result.items.some((i) => i.severity === 'review' && i.detail.includes('name'))).toBe(true);
  });

  it('detects added cable', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout(baseDevices, [...baseCables, { id: 'c2', fromDeviceId: 'd2', toDeviceId: 'd1', type: 'fiber' as const, color: '#f00' }]);
    const result = detectDrift(baseline, current);
    expect(result.addedCables.length).toBe(1);
    expect(result.items.some((i) => i.id.includes('cable-added'))).toBe(true);
  });

  it('detects removed cable as critical', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout(baseDevices, []);
    const result = detectDrift(baseline, current);
    expect(result.removedCables.length).toBe(1);
    expect(result.items.some((i) => i.severity === 'critical' && i.id.includes('cable-removed'))).toBe(true);
  });

  it('detects property changes', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout(baseDevices, baseCables);
    (current as typeof baseline).powerBudgetW = 1000;
    (current as typeof baseline).rackDepthMm = 600;
    const result = detectDrift(baseline, current);
    expect(result.items.some((i) => i.category === 'property' && i.title.includes('Power'))).toBe(true);
    expect(result.items.some((i) => i.category === 'property' && i.title.includes('depth'))).toBe(true);
  });

  it('summarizes correctly', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout([baseDevices[0]], []);
    const result = detectDrift(baseline, current);
    expect(result.summary.total).toBeGreaterThan(0);
    expect(result.summary.critical).toBeGreaterThan(0);
  });
});

describe('exportDriftMarkdown', () => {
  it('includes summary counts', () => {
    const baseline = makeLayout(baseDevices, baseCables);
    const current = makeLayout(baseDevices, baseCables);
    const result = detectDrift(baseline, current);
    const md = exportDriftMarkdown(result);
    expect(md).toContain('Configuration Drift Report');
    expect(md).toContain('Total Changes');
  });
});

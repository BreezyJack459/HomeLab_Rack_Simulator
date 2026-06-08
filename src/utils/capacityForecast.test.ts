import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { analyzeCapacityForecast } from './capacityForecast';

function createLayout(overrides?: Partial<RackLayout>): RackLayout {
  return {
    id: 'test',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1000,
    viewSide: 'front',
    devices: [],
    cables: [],
    reservations: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('analyzeCapacityForecast', () => {
  it('returns all-good for an empty rack', () => {
    const layout = createLayout();
    const result = analyzeCapacityForecast(layout);
    expect(result.overallStatus).toBe('good');
    expect(result.nextBottleneck).toBeNull();
    const space = result.categories.find((c) => c.category === 'space');
    expect(space?.status).toBe('good');
    expect(space?.estimatedDevicesUntilExhaustion).toBeGreaterThan(5);
  });

  it('reports critical space when rack is nearly full', () => {
    const devices = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`,
      category: 'server' as const,
      name: `S${i}`,
      positionU: i + 1,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in' as const,
      weightKg: 8,
      powerW: 100,
      heatLevel: 3 as const,
      color: '#ccc',
    }));
    const layout = createLayout({ devices, heightU: 12 });
    const result = analyzeCapacityForecast(layout);
    const space = result.categories.find((c) => c.category === 'space')!;
    expect(space.status).toBe('warning');
    expect(space.percentUsed).toBeGreaterThan(75);
  });

  it('reports critical power when near budget', () => {
    const devices = [
      {
        id: 'd1',
        category: 'server' as const,
        name: 'Big Server',
        positionU: 1,
        sizeU: 2,
        depthMm: 600,
        widthType: '19in' as const,
        weightKg: 15,
        powerW: 950,
        heatLevel: 4 as const,
        color: '#ccc',
      },
    ];
    const layout = createLayout({ devices, powerBudgetW: 1000 });
    const result = analyzeCapacityForecast(layout);
    const power = result.categories.find((c) => c.category === 'power')!;
    expect(power.status).toBe('critical');
    expect(power.estimatedDevicesUntilExhaustion).toBeLessThanOrEqual(2);
  });

  it('reports weight warning when near limit', () => {
    const devices = [
      {
        id: 'd1',
        category: 'ups' as const,
        name: 'Heavy UPS',
        positionU: 1,
        sizeU: 2,
        depthMm: 500,
        widthType: '19in' as const,
        weightKg: 45,
        powerW: 0,
        heatLevel: 2 as const,
        color: '#ccc',
      },
    ];
    const layout = createLayout({ devices, weightLimitKg: 50 });
    const result = analyzeCapacityForecast(layout);
    const weight = result.categories.find((c) => c.category === 'weight')!;
    expect(weight.status).toBe('warning');
  });

  it('counts switch ports and used ports', () => {
    const devices = [
      {
        id: 'sw1',
        category: 'switch' as const,
        name: '24-port Switch',
        positionU: 1,
        sizeU: 1,
        depthMm: 250,
        widthType: '19in' as const,
        weightKg: 4,
        powerW: 45,
        heatLevel: 3 as const,
        color: '#2563eb',
        ports: { ethernet: 24, fiber: 4, power: 1 },
      },
    ];
    const cables = [
      { id: 'c1', fromDeviceId: 'sw1', toDeviceId: 'sw1', fromPort: { type: 'ethernet' as const, index: 0 }, toPort: { type: 'ethernet' as const, index: 1 }, type: 'ethernet' as const, color: '#3b82f6' },
      { id: 'c2', fromDeviceId: 'sw1', toDeviceId: 'sw1', fromPort: { type: 'ethernet' as const, index: 2 }, toPort: { type: 'ethernet' as const, index: 3 }, type: 'ethernet' as const, color: '#3b82f6' },
    ];
    const layout = createLayout({ devices, cables });
    const result = analyzeCapacityForecast(layout);
    const ports = result.categories.find((c) => c.category === 'switch-ports')!;
    expect(ports.max).toBe(28);
    expect(ports.current).toBe(2);
    expect(ports.estimatedDevicesUntilExhaustion).toBe(26);
  });

  it('counts PDU outlets and used outlets', () => {
    const devices = [
      {
        id: 'pdu1',
        category: 'pdu' as const,
        name: 'PDU',
        positionU: 1,
        sizeU: 1,
        depthMm: 50,
        widthType: '19in' as const,
        weightKg: 2,
        powerW: 0,
        heatLevel: 1 as const,
        color: '#f59e0b',
        ports: { power: 8 },
      },
    ];
    const cables = [
      { id: 'c1', fromDeviceId: 'pdu1', toDeviceId: 'pdu1', fromPort: { type: 'power' as const, index: 0 }, toPort: { type: 'power' as const, index: 1 }, type: 'power' as const, color: '#f59e0b' },
    ];
    const layout = createLayout({ devices, cables });
    const result = analyzeCapacityForecast(layout);
    const outlets = result.categories.find((c) => c.category === 'pdu-outlets')!;
    expect(outlets.max).toBe(8);
    expect(outlets.current).toBe(1);
  });

  it('identifies next bottleneck correctly', () => {
    const devices = [
      {
        id: 'd1',
        category: 'server' as const,
        name: 'Server',
        positionU: 1,
        sizeU: 1,
        depthMm: 400,
        widthType: '19in' as const,
        weightKg: 5,
        powerW: 480,
        heatLevel: 3 as const,
        color: '#ccc',
        noiseDb: 20,
      },
    ];
    const layout = createLayout({ devices, powerBudgetW: 500, heightU: 24 });
    const result = analyzeCapacityForecast(layout);
    expect(result.nextBottleneck).toBe('power');
    expect(result.overallStatus).toBe('critical');
  });

  it('includes recommendations when constrained', () => {
    const devices = Array.from({ length: 11 }, (_, i) => ({
      id: `d${i}`,
      category: 'server' as const,
      name: `S${i}`,
      positionU: i + 1,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in' as const,
      weightKg: 8,
      powerW: 80,
      heatLevel: 3 as const,
      color: '#ccc',
    }));
    const layout = createLayout({ devices, heightU: 12 });
    const result = analyzeCapacityForecast(layout);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.includes('taller rack') || r.includes('consolidating'))).toBe(true);
  });

  it('accounts for reservations in space forecast', () => {
    const devices = Array.from({ length: 8 }, (_, i) => ({
      id: `d${i}`,
      category: 'server' as const,
      name: `S${i}`,
      positionU: i + 1,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in' as const,
      weightKg: 5,
      powerW: 50,
      heatLevel: 2 as const,
      color: '#ccc',
    }));
    const reservations = [
      { id: 'r1', name: 'Future NAS', positionU: 9, sizeU: 2, mountSide: 'front' as const, widthType: '19in' as const, purpose: 'future-device' as const },
    ];
    const layout = createLayout({ devices, reservations, heightU: 12 });
    const result = analyzeCapacityForecast(layout);
    const space = result.categories.find((c) => c.category === 'space')!;
    expect(space.current).toBe(10); // 8 occupied + 2 reserved
  });
});

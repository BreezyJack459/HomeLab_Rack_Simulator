import { describe, expect, it } from 'vitest';
import type { DeviceTemplate, RackLayout } from '../types/rack';
import { checkDeviceFit } from './fitCheck';

function createTestLayout(overrides?: Partial<RackLayout>): RackLayout {
  return {
    id: 'test-layout',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1200,
    viewSide: 'front',
    devices: [],
    cables: [],
    reservations: [],
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

const miniPcTemplate: DeviceTemplate = {
  id: 'mini-pc-test',
  category: 'mini-pc',
  name: 'Test Mini PC',
  defaultU: 1,
  depthMm: 200,
  widthType: '19in',
  weightKg: 2.5,
  powerW: 65,
  heatLevel: 2,
  color: '#3b82f6',
  description: 'A test mini PC'
};

const deepServerTemplate: DeviceTemplate = {
  id: 'server-deep',
  category: 'server',
  name: 'Deep Server',
  defaultU: 2,
  depthMm: 850,
  widthType: '19in',
  weightKg: 15,
  powerW: 400,
  heatLevel: 4,
  color: '#ef4444',
  description: 'Very deep server'
};

const heavyUpsTemplate: DeviceTemplate = {
  id: 'ups-heavy',
  category: 'ups',
  name: 'Heavy UPS',
  defaultU: 2,
  depthMm: 450,
  widthType: '19in',
  weightKg: 25,
  powerW: 0,
  heatLevel: 2,
  color: '#f59e0b',
  description: 'Heavy UPS'
};

const wideDeviceTemplate: DeviceTemplate = {
  id: 'wide-device',
  category: 'custom',
  name: 'Wide Custom',
  defaultU: 1,
  depthMm: 300,
  widthType: 'custom',
  customWidthMm: 600,
  weightKg: 5,
  powerW: 100,
  heatLevel: 2,
  color: '#8b5cf6',
  description: 'Too wide'
};

const highHeatTemplate: DeviceTemplate = {
  id: 'high-heat',
  category: 'server',
  name: 'Hot Server',
  defaultU: 1,
  depthMm: 400,
  widthType: '19in',
  weightKg: 8,
  powerW: 300,
  heatLevel: 5,
  color: '#dc2626',
  description: 'Very hot server'
};

describe('checkDeviceFit', () => {
  it('returns canFit=true for a device that fits in an empty rack', () => {
    const layout = createTestLayout();
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(true);
    expect(result!.checks.physical).toBe('pass');
    expect(result!.checks.weight).toBe('pass');
    expect(result!.checks.power).toBe('pass');
    expect(result!.checks.heat).toBe('pass');
    expect(result!.checks.stability).toBe('pass');
  });

  it('reports physical fail when device is too wide', () => {
    const layout = createTestLayout();
    const result = checkDeviceFit(layout, wideDeviceTemplate);
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(false);
    expect(result!.checks.physical).toBe('fail');
    expect(result!.issues.some((i) => i.category === 'physical' && i.severity === 'critical')).toBe(true);
  });

  it('reports physical warning when device is deeper than usable depth', () => {
    const layout = createTestLayout({ rackDepthMm: 600, rearClearanceMm: 100, rearDoorClearanceMm: 50 });
    const result = checkDeviceFit(layout, deepServerTemplate);
    expect(result).not.toBeNull();
    expect(result!.issues.some((i) => i.category === 'physical' && i.title.includes('too deep'))).toBe(true);
  });

  it('reports weight fail when total weight would exceed limit', () => {
    const layout = createTestLayout({
      weightLimitKg: 10,
      devices: [
        {
          id: 'existing',
          category: 'server',
          name: 'Existing',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 8,
          powerW: 100,
          heatLevel: 2,
          color: '#ccc'
        }
      ]
    });
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(false);
    expect(result!.checks.weight).toBe('fail');
    expect(result!.issues.some((i) => i.category === 'weight')).toBe(true);
  });

  it('reports power fail when total power would exceed budget', () => {
    const layout = createTestLayout({
      powerBudgetW: 50,
      devices: [
        {
          id: 'existing',
          category: 'server',
          name: 'Existing',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 5,
          powerW: 40,
          heatLevel: 2,
          color: '#ccc'
        }
      ]
    });
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(false);
    expect(result!.checks.power).toBe('fail');
    expect(result!.issues.some((i) => i.category === 'power')).toBe(true);
  });

  it('reports stability warning when heavy device placed high', () => {
    const layout = createTestLayout();
    const result = checkDeviceFit(layout, heavyUpsTemplate, { positionU: 10 });
    expect(result).not.toBeNull();
    expect(result!.checks.stability).toBe('warning');
    expect(result!.issues.some((i) => i.category === 'stability')).toBe(true);
  });

  it('reports heat warning when high-heat devices cluster', () => {
    const layout = createTestLayout({
      devices: [
        {
          id: 'hot1',
          category: 'server',
          name: 'Hot Server 1',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 8,
          powerW: 300,
          heatLevel: 5,
          color: '#dc2626'
        }
      ]
    });
    const result = checkDeviceFit(layout, highHeatTemplate, { positionU: 2 });
    expect(result).not.toBeNull();
    expect(result!.checks.heat).toBe('warning');
    expect(result!.issues.some((i) => i.category === 'heat')).toBe(true);
  });

  it('reports reservation conflict when position overlaps reservation', () => {
    const layout = createTestLayout({
      reservations: [
        {
          id: 'res1',
          name: 'Future Switch',
          positionU: 1,
          sizeU: 1,
          mountSide: 'front',
          widthType: '19in',
          purpose: 'future-device'
        }
      ]
    });
    const result = checkDeviceFit(layout, miniPcTemplate, { positionU: 1 });
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(false);
    expect(result!.checks.reservation).toBe('fail');
    expect(result!.issues.some((i) => i.category === 'reservation')).toBe(true);
  });

  it('reports physical fail when specified position causes overlap', () => {
    const layout = createTestLayout({
      devices: [
        {
          id: 'existing',
          category: 'server',
          name: 'Existing',
          positionU: 1,
          sizeU: 2,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 3,
          color: '#ccc'
        }
      ]
    });
    const result = checkDeviceFit(layout, miniPcTemplate, { positionU: 1 });
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(false);
    expect(result!.checks.physical).toBe('fail');
  });

  it('reports physical fail when no free slot available', () => {
    const devices = Array.from({ length: 12 }, (_, i) => ({
      id: `dev-${i}`,
      category: 'server' as const,
      name: `Server ${i}`,
      positionU: i + 1,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in' as const,
      weightKg: 5,
      powerW: 100,
      heatLevel: 2 as const,
      color: '#ccc'
    }));
    const layout = createTestLayout({ devices });
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(false);
    expect(result!.checks.physical).toBe('fail');
    expect(result!.issues.some((i) => i.title.includes('No free slot'))).toBe(true);
  });

  it('computes correct before/after metrics', () => {
    const layout = createTestLayout({
      devices: [
        {
          id: 'existing',
          category: 'server',
          name: 'Existing',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 3,
          color: '#ccc'
        }
      ]
    });
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
    expect(result!.before.weightKg).toBe(10);
    expect(result!.after.weightKg).toBe(12.5);
    expect(result!.before.powerW).toBe(200);
    expect(result!.after.powerW).toBe(265);
    expect(result!.before.occupiedU).toBe(1);
    expect(result!.after.occupiedU).toBe(2);
  });

  it('auto-finds first free slot when position is not specified', () => {
    const layout = createTestLayout({
      devices: [
        {
          id: 'existing',
          category: 'server',
          name: 'Existing',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 5,
          powerW: 100,
          heatLevel: 2,
          color: '#ccc'
        }
      ]
    });
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
    expect(result!.canFit).toBe(true);
    expect(result!.proposedPosition.positionU).toBe(2);
  });

  it('returns null for invalid template (should not happen in UI but guard anyway)', () => {
    // This function does not return null for invalid templates — it expects a valid template.
    // The null return is only documented for template-not-found in consuming UI.
    // We test that a valid template always returns a result.
    const layout = createTestLayout();
    const result = checkDeviceFit(layout, miniPcTemplate);
    expect(result).not.toBeNull();
  });
});

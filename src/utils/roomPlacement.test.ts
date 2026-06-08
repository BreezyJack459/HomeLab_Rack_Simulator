import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import {
  analyzeRoomPlacement,
  getDefaultRoomParams,
  type RoomParams,
} from './roomPlacement';

function makeLayout(overrides?: Partial<RackLayout>): RackLayout {
  return {
    id: 'test-layout',
    name: 'Test',
    rackType: '19in',
    heightU: 42,
    rackDepthMm: 600,
    weightLimitKg: 800,
    powerBudgetW: 3000,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeParams(overrides?: Partial<RoomParams>): RoomParams {
  return {
    ...getDefaultRoomParams(),
    ...overrides,
  };
}

describe('analyzeRoomPlacement', () => {
  it('returns basic dimensions for empty 42U rack', () => {
    const layout = makeLayout();
    const params = makeParams();
    const result = analyzeRoomPlacement(layout, params);

    expect(result.rackFootprint.widthMm).toBe(560);
    expect(result.rackFootprint.depthMm).toBe(600);
    expect(result.rackFootprint.heightMm).toBeCloseTo(42 * 44.45 + 100, 0);
    expect(result.totalWeightKg).toBe(0);
    expect(result.floorLoadingKgPerM2).toBe(0);
    expect(result.heatOutputW).toBe(0);
    expect(result.estimatedNoiseDb).toBe(0);
  });

  it('calculates total weight and floor loading', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 25,
          powerW: 300,
          heatLevel: 3,
          color: '#333',
        },
        {
          id: 'd2',
          name: 'NAS',
          category: 'nas',
          positionU: 5,
          sizeU: 4,
          depthMm: 400,
          widthType: '19in',
          weightKg: 15,
          powerW: 150,
          heatLevel: 2,
          color: '#555',
        },
      ],
    });
    const params = makeParams();
    const result = analyzeRoomPlacement(layout, params);

    expect(result.totalWeightKg).toBe(40);
    expect(result.floorLoadingKgPerM2).toBeCloseTo(40 / ((560 * 600) / 1_000_000), 1);
  });

  it('calculates heat output from device power', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 20,
          powerW: 500,
          heatLevel: 4,
          color: '#333',
        },
      ],
    });
    const result = analyzeRoomPlacement(layout, makeParams());
    expect(result.heatOutputW).toBe(500);
  });

  it('estimates noise from loudest device', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Quiet',
          category: 'nas',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 5,
          powerW: 50,
          heatLevel: 2,
          noiseDb: 35,
          color: '#333',
        },
        {
          id: 'd2',
          name: 'Loud',
          category: 'server',
          positionU: 3,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 20,
          powerW: 300,
          heatLevel: 4,
          noiseDb: 55,
          color: '#555',
        },
      ],
    });
    const result = analyzeRoomPlacement(layout, makeParams());
    expect(result.estimatedNoiseDb).toBe(55);
  });

  it('flags insufficient room width', () => {
    const layout = makeLayout();
    const params = makeParams({ roomWidthMm: 500 });
    const result = analyzeRoomPlacement(layout, params);

    const widthIssue = result.issues.find((i) => i.id === 'room-width');
    expect(widthIssue).toBeDefined();
    expect(widthIssue!.severity).toBe('critical');
    expect(widthIssue!.category).toBe('space');
  });

  it('flags insufficient room depth', () => {
    const layout = makeLayout();
    const params = makeParams({ roomDepthMm: 500 });
    const result = analyzeRoomPlacement(layout, params);

    const depthIssue = result.issues.find((i) => i.id === 'room-depth');
    expect(depthIssue).toBeDefined();
    expect(depthIssue!.severity).toBe('critical');
  });

  it('flags floor loading exceeding limit on wood', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Heavy',
          category: 'ups',
          positionU: 1,
          sizeU: 4,
          depthMm: 600,
          widthType: '19in',
          weightKg: 120,
          powerW: 0,
          heatLevel: 1,
          color: '#333',
        },
      ],
    });
    const params = makeParams({ floorType: 'wood' });
    const result = analyzeRoomPlacement(layout, params);

    const floorIssue = result.issues.find((i) => i.id === 'floor-loading');
    expect(floorIssue).toBeDefined();
    expect(floorIssue!.severity).toBe('critical');
  });

  it('flags heavy rack on wood floor', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 90,
          powerW: 400,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    const params = makeParams({ floorType: 'wood' });
    const result = analyzeRoomPlacement(layout, params);

    const woodIssue = result.issues.find((i) => i.id === 'wood-floor-heavy');
    expect(woodIssue).toBeDefined();
    expect(woodIssue!.severity).toBe('warning');
  });

  it('flags high heat without AC', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Powerhog',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 600,
          widthType: '19in',
          weightKg: 20,
          powerW: 2500,
          heatLevel: 5,
          color: '#333',
        },
      ],
    });
    const params = makeParams({ hasAc: false });
    const result = analyzeRoomPlacement(layout, params);

    const thermalIssue = result.issues.find((i) => i.id === 'thermal-no-ac');
    expect(thermalIssue).toBeDefined();
    expect(thermalIssue!.severity).toBe('warning');
  });

  it('flags noise too high for bedroom', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Loud',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 20,
          powerW: 300,
          heatLevel: 4,
          noiseDb: 60,
          color: '#333',
        },
      ],
    });
    const params = makeParams({ roomType: 'bedroom' });
    const result = analyzeRoomPlacement(layout, params);

    const noiseIssue = result.issues.find((i) => i.id === 'noise-high');
    expect(noiseIssue).toBeDefined();
    expect(noiseIssue!.severity).toBe('warning');
  });

  it('uses frontDoorClearanceMm in minimum depth calculation', () => {
    const layout = makeLayout({ frontDoorClearanceMm: 800 });
    const result = analyzeRoomPlacement(layout, makeParams());
    // front should be at least 800 + 300 = 1100
    expect(result.requiredFrontClearanceMm).toBeGreaterThanOrEqual(800);
  });

  it('uses rearClearanceMm in minimum depth calculation', () => {
    const layout = makeLayout({ rearClearanceMm: 300, rearDoorClearanceMm: 200 });
    const result = analyzeRoomPlacement(layout, makeParams());
    // rear should account for rearDoorClearance + rearClearance + 200
    expect(result.requiredRearClearanceMm).toBeGreaterThanOrEqual(500);
  });

  it('gives perfect score when everything is fine', () => {
    const layout = makeLayout();
    const params = makeParams({
      roomWidthMm: 5000,
      roomDepthMm: 5000,
      roomHeightMm: 3000,
      roomType: 'basement',
      floorType: 'concrete',
      hasAc: true,
    });
    const result = analyzeRoomPlacement(layout, params);

    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('deducts score for critical and warning issues', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Heavy',
          category: 'ups',
          positionU: 1,
          sizeU: 4,
          depthMm: 600,
          widthType: '19in',
          weightKg: 200,
          powerW: 0,
          heatLevel: 1,
          color: '#333',
        },
      ],
    });
    const params = makeParams({
      roomWidthMm: 500,
      floorType: 'wood',
    });
    const result = analyzeRoomPlacement(layout, params);

    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('recommends AC for closet with moderate heat', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 20,
          powerW: 800,
          heatLevel: 4,
          color: '#333',
        },
      ],
    });
    const params = makeParams({ roomType: 'closet', hasAc: false });
    const result = analyzeRoomPlacement(layout, params);

    const closetIssue = result.issues.find((i) => i.id === 'thermal-closet');
    expect(closetIssue).toBeDefined();
    expect(closetIssue!.severity).toBe('warning');
  });
});

describe('getDefaultRoomParams', () => {
  it('returns sensible defaults', () => {
    const defaults = getDefaultRoomParams();
    expect(defaults.roomWidthMm).toBe(3000);
    expect(defaults.roomDepthMm).toBe(3000);
    expect(defaults.roomHeightMm).toBe(2500);
    expect(defaults.roomType).toBe('basement');
    expect(defaults.floorType).toBe('concrete');
    expect(defaults.hasAc).toBe(false);
    expect(defaults.rackPosition).toBe('against-wall');
  });
});

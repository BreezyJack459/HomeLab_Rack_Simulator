import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import {
  clampDevicePosition,
  clampDeviceX,
  defaultWeightLimit,
  findFirstFreeSlot,
  formatCableLength,
  getDefaultDeviceX,
  getDeviceWidthMm,
  getDeviceXRange,
  hasOverlap,
  isDeviceWithinRack,
  isZeroU,
  RACK_SPECS,
  rangesOverlap,
  standardCableLength
} from './rackMath';

const baseLayout: RackLayout = {
  id: 'test-layout',
  name: 'Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  devices: [],
  cables: [],
  updatedAt: new Date().toISOString()
};

function makeDevice(partial: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    templateId: 'tpl-1',
    category: 'server',
    name: 'Test Device',
    mountSide: 'front',
    positionU: 1,
    xMm: undefined,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    customWidthMm: undefined,
    weightKg: 5,
    powerW: 100,
    heatLevel: 2,
    ports: {},
    color: '#334155',
    ...partial
  } as PlacedDevice;
}

describe('RACK_SPECS', () => {
  it('defines 10in rack dimensions', () => {
    expect(RACK_SPECS['10in'].usableWidthMm).toBe(254);
    expect(RACK_SPECS['10in'].defaultDepthMm).toBe(300);
  });

  it('defines 19in rack dimensions', () => {
    expect(RACK_SPECS['19in'].usableWidthMm).toBeCloseTo(482.6, 1);
    expect(RACK_SPECS['19in'].defaultDepthMm).toBe(600);
  });
});

describe('defaultWeightLimit', () => {
  it('scales with rack type and height', () => {
    expect(defaultWeightLimit('10in', 12)).toBe(89);
    expect(defaultWeightLimit('19in', 12)).toBe(236);
  });

  it('caps at maximum', () => {
    expect(defaultWeightLimit('10in', 44)).toBe(180);
    expect(defaultWeightLimit('19in', 50)).toBe(900);
  });
});

describe('getDeviceWidthMm', () => {
  it('returns rack width for full-width types', () => {
    expect(getDeviceWidthMm({ widthType: '10in' })).toBe(254);
    expect(getDeviceWidthMm({ widthType: '19in' })).toBeCloseTo(482.6, 1);
  });

  it('returns custom width when set', () => {
    expect(getDeviceWidthMm({ widthType: 'custom', customWidthMm: 200 })).toBe(200);
  });

  it('returns fallback for shelf width', () => {
    expect(getDeviceWidthMm({ widthType: 'shelf', customWidthMm: undefined })).toBeCloseTo(182.88, 1);
  });
});

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(rangesOverlap(1, 3, 2, 3)).toBe(true);
    expect(rangesOverlap(1, 3, 4, 2)).toBe(false);
  });

  it('detects edge-touching as non-overlap', () => {
    expect(rangesOverlap(1, 2, 3, 2)).toBe(false);
    expect(rangesOverlap(3, 2, 1, 2)).toBe(false);
  });
});

describe('clampDevicePosition', () => {
  it('clamps to rack bounds', () => {
    expect(clampDevicePosition(baseLayout, 2, 1)).toBe(1);
    expect(clampDevicePosition(baseLayout, 2, 11)).toBe(11);
    expect(clampDevicePosition(baseLayout, 2, 20)).toBe(11);
  });

  it('allows 0U devices anywhere in height range', () => {
    expect(clampDevicePosition(baseLayout, 0, 5)).toBe(5);
    expect(clampDevicePosition(baseLayout, 0, 15)).toBe(12);
  });
});

describe('isDeviceWithinRack', () => {
  it('accepts devices inside bounds', () => {
    expect(isDeviceWithinRack(baseLayout, { positionU: 1, sizeU: 2 })).toBe(true);
    expect(isDeviceWithinRack(baseLayout, { positionU: 11, sizeU: 2 })).toBe(true);
  });

  it('rejects devices outside bounds', () => {
    expect(isDeviceWithinRack(baseLayout, { positionU: 12, sizeU: 2 })).toBe(false);
    expect(isDeviceWithinRack(baseLayout, { positionU: 0, sizeU: 1 })).toBe(false);
  });
});

describe('hasOverlap', () => {
  it('returns false for empty rack', () => {
    const device = makeDevice({ positionU: 1, sizeU: 2 });
    expect(hasOverlap(baseLayout, [], device)).toBe(false);
  });

  it('detects U-space overlap on same side', () => {
    const existing = makeDevice({ id: 'existing', positionU: 1, sizeU: 2, mountSide: 'front' });
    const candidate = makeDevice({ id: 'candidate', positionU: 2, sizeU: 2, mountSide: 'front' });
    expect(hasOverlap(baseLayout, [existing], candidate)).toBe(true);
  });

  it('ignores devices on opposite mount sides', () => {
    const existing = makeDevice({ id: 'existing', positionU: 1, sizeU: 2, mountSide: 'front' });
    const candidate = makeDevice({ id: 'candidate', positionU: 2, sizeU: 2, mountSide: 'rear' });
    expect(hasOverlap(baseLayout, [existing], candidate)).toBe(false);
  });

  it('ignores zero-U devices', () => {
    const existing = makeDevice({ id: 'existing', positionU: 1, sizeU: 2, mountSide: 'front' });
    const candidate = makeDevice({ id: 'candidate', positionU: 1, sizeU: 0, mountSide: 'front' });
    expect(hasOverlap(baseLayout, [existing], candidate)).toBe(false);
  });
});

describe('clampDeviceX', () => {
  it('clamps normal device to rack width', () => {
    const device = makeDevice({ widthType: '19in', sizeU: 1 });
    expect(clampDeviceX(baseLayout, device, -50)).toBe(0);
    expect(clampDeviceX(baseLayout, device, 9999)).toBeCloseTo(0, 0); // 19in width == usable width, so x=0
  });

  it('locks zero-U device to rail zones', () => {
    const leftDevice = makeDevice({ sizeU: 0, mountSide0U: 'left' });
    const rightDevice = makeDevice({ sizeU: 0, mountSide0U: 'right' });
    expect(clampDeviceX(baseLayout, leftDevice, 100)).toBe(-getDeviceWidthMm(leftDevice));
    expect(clampDeviceX(baseLayout, rightDevice, 100)).toBeCloseTo(482.6, 1);
  });
});

describe('getDefaultDeviceX', () => {
  it('centers normal devices', () => {
    const device = makeDevice({ widthType: 'shelf', sizeU: 1 });
    expect(getDefaultDeviceX(baseLayout, device)).toBeCloseTo(150, 0);
  });

  it('places zero-U devices at rail zones', () => {
    const leftDevice = makeDevice({ sizeU: 0, mountSide0U: 'left' });
    const rightDevice = makeDevice({ sizeU: 0, mountSide0U: 'right' });
    expect(getDefaultDeviceX(baseLayout, leftDevice)).toBeLessThan(0);
    expect(getDefaultDeviceX(baseLayout, rightDevice)).toBeCloseTo(482.6, 1);
  });
});

describe('findFirstFreeSlot', () => {
  it('finds first slot in empty rack', () => {
    const device = makeDevice({ sizeU: 1, mountSide: 'front' });
    const slot = findFirstFreeSlot(baseLayout, device);
    expect(slot).not.toBeNull();
    expect(slot!.positionU).toBe(1);
  });

  it('finds slot after occupied units', () => {
    const existing = makeDevice({ id: 'existing', positionU: 1, sizeU: 2, mountSide: 'front' });
    const layout = { ...baseLayout, devices: [existing] };
    const device = makeDevice({ sizeU: 2, mountSide: 'front' });
    const slot = findFirstFreeSlot(layout, device);
    expect(slot).not.toBeNull();
    expect(slot!.positionU).toBe(3);
  });

  it('returns null when rack is full', () => {
    const existing = makeDevice({ id: 'existing', positionU: 1, sizeU: 12, mountSide: 'front' });
    const layout = { ...baseLayout, devices: [existing] };
    const device = makeDevice({ sizeU: 1, mountSide: 'front' });
    expect(findFirstFreeSlot(layout, device)).toBeNull();
  });

  it('places zero-U at side rail', () => {
    const device = makeDevice({ sizeU: 0, mountSide0U: 'left' });
    const slot = findFirstFreeSlot(baseLayout, device);
    expect(slot).not.toBeNull();
    expect(slot!.positionU).toBe(1);
    expect(slot!.xMm).toBeLessThan(0);
  });
});

describe('isZeroU', () => {
  it('identifies zero-U devices', () => {
    expect(isZeroU({ sizeU: 0 })).toBe(true);
    expect(isZeroU({ sizeU: 1 })).toBe(false);
  });
});

describe('standardCableLength', () => {
  it('picks smallest standard length covering estimate', () => {
    expect(standardCableLength(400)).toBe(500);
    expect(standardCableLength(500)).toBe(500);
    expect(standardCableLength(5500)).toBe(7000);
    expect(standardCableLength(10500)).toBe(10000);
  });
});

describe('formatCableLength', () => {
  it('formats mm and m correctly', () => {
    expect(formatCableLength(500)).toBe('500mm');
    expect(formatCableLength(1000)).toBe('1m');
    expect(formatCableLength(1500)).toBe('1.5m');
  });
});

describe('getDeviceXRange', () => {
  it('centers full-width device', () => {
    const device = makeDevice({ widthType: '19in', sizeU: 1 });
    const range = getDeviceXRange(baseLayout, device);
    expect(range.x).toBe(0);
    expect(range.width).toBeCloseTo(482.6, 1);
  });

  it('places zero-U at right rail', () => {
    const device = makeDevice({ sizeU: 0, mountSide0U: 'right', widthType: 'shelf' });
    const range = getDeviceXRange(baseLayout, device);
    expect(range.x).toBeCloseTo(482.6, 1);
  });
});

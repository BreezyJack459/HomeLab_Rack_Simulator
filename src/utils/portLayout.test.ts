import { describe, expect, it } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import { buildPortLayout, getPortFaceMap } from './portLayout';

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

describe('getPortFaceMap', () => {
  it('returns category defaults', () => {
    expect(getPortFaceMap('switch').ethernet).toBe('front');
    expect(getPortFaceMap('switch').power).toBe('rear');
    expect(getPortFaceMap('server').ethernet).toBe('rear');
    expect(getPortFaceMap('pdu').power).toBe('rear');
  });

  it('applies user overrides', () => {
    const map = getPortFaceMap('switch', { ethernet: 'rear', power: 'front' });
    expect(map.ethernet).toBe('rear');
    expect(map.power).toBe('front');
    expect(map.usb).toBe('front'); // unchanged default
  });

  it('defaults unknown categories to rear', () => {
    const map = getPortFaceMap('unknown-category');
    expect(map.ethernet).toBe('rear');
    expect(map.power).toBe('rear');
  });
});

describe('buildPortLayout', () => {
  it('returns empty when device has no ports', () => {
    const device = makeDevice({ ports: {} });
    expect(buildPortLayout(device, 1, 1, 'front')).toEqual([]);
  });

  it('returns empty when no ports match target face', () => {
    const device = makeDevice({
      category: 'patch-panel',
      ports: { ethernet: 4 }
    });
    expect(buildPortLayout(device, 1, 1, 'rear')).toEqual([]);
  });

  it('lays out front ports for a switch', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 8 }
    });
    const groups = buildPortLayout(device, 0.5, 0.3, 'front');
    expect(groups.length).toBe(1);
    expect(groups[0].type).toBe('ethernet');
    expect(groups[0].slots.length).toBe(8);
    expect(groups[0].slots[0].index).toBe(0);
    expect(groups[0].slots[7].index).toBe(7);
  });

  it('lays out rear power for a server', () => {
    const device = makeDevice({
      category: 'server',
      ports: { ethernet: 2, power: 2 }
    });
    const groups = buildPortLayout(device, 0.5, 0.3, 'rear');
    expect(groups.length).toBe(2);
    const powerGroup = groups.find((g) => g.type === 'power');
    expect(powerGroup).toBeDefined();
    expect(powerGroup!.slots.length).toBe(2);
  });

  it('respects portLayouts config', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 24 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 24, columns: 12, xRatio: 0.5 }]
      }
    });
    const groups = buildPortLayout(device, 0.5, 0.3, 'front');
    expect(groups[0].slots.length).toBe(24);
    // 12 columns means 2 rows
    expect(groups[0].slots[12].y).toBeLessThan(groups[0].slots[0].y);
  });

  it('limits 0U PDU power to 2 columns', () => {
    const device = makeDevice({
      category: 'pdu-0u',
      ports: { power: 8 }
    });
    const groups = buildPortLayout(device, 0.1, 1.2, 'front');
    expect(groups.length).toBe(1);
    expect(groups[0].slots.length).toBe(8);
    // Should be arranged vertically due to 0U PDU special handling
  });

  it('ignores layoutColumns port key', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 4, layoutColumns: 2 } as any
    });
    const groups = buildPortLayout(device, 0.5, 0.3, 'front');
    expect(groups.length).toBe(1);
    expect(groups[0].slots.length).toBe(4);
  });
});

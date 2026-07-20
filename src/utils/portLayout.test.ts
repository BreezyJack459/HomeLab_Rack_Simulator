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
    const groups = buildPortLayout(device, 0.1, 1.2, 'rear');
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

  it('stacks default layout groups using only ports on the requested face', () => {
    const device = makeDevice({
      category: 'custom',
      ports: { power: 1, ethernet: 2 },
      portFaceOverrides: { power: 'front', ethernet: 'rear' }
    });

    const groups = buildPortLayout(device, 0.5, 0.3, 'rear');

    expect(groups.map((group) => group.type)).toEqual(['ethernet']);
    expect(groups[0].slots[0].y).toBeGreaterThan(0);
  });

  it('does not reserve empty rows for skipped custom layout configs', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 8, fiber: 2, power: 1 },
      portLayouts: {
        front: [
          { type: 'ethernet', columns: 4, xRatio: 0.4 },
          { type: 'power', columns: 1, xRatio: 0.5 },
          { type: 'fiber', columns: 2, xRatio: 0.8 }
        ]
      }
    });

    const groups = buildPortLayout(device, 0.5, 0.3, 'front');

    expect(groups.map((group) => group.type)).toEqual(['ethernet', 'fiber']);
    expect(groups[0].slots[0].y).toBeGreaterThan(groups[1].slots[0].y);
  });

  it('places configs with the same rowIndex on the same row', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 2, usb: 2 },
      portLayouts: {
        front: [
          { type: 'ethernet', count: 2, columns: 2, rowIndex: 0 },
          { type: 'usb', count: 2, columns: 2, rowIndex: 0 }
        ]
      }
    });

    const groups = buildPortLayout(device, 1, 1, 'front');

    expect(groups.length).toBe(2);
    expect(groups[0].slots[0].y).toBeCloseTo(groups[1].slots[0].y, 6);
  });

  it('honors yRatio for explicit vertical anchoring', () => {
    const topDevice = makeDevice({
      category: 'switch',
      ports: { ethernet: 2 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 2, columns: 2, yRatio: 0 }]
      }
    });
    const bottomDevice = makeDevice({
      category: 'switch',
      ports: { ethernet: 2 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 2, columns: 2, yRatio: 1 }]
      }
    });

    const topY = buildPortLayout(topDevice, 1, 1, 'front')[0].slots[0].y;
    const bottomY = buildPortLayout(bottomDevice, 1, 1, 'front')[0].slots[0].y;

    expect(topY).toBeGreaterThan(bottomY);
  });

  it('orders slots in odd-even-vertical pairs', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 4 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 4, columns: 2, pairing: 'odd-even-vertical' }]
      }
    });

    const slots = buildPortLayout(device, 1, 1, 'front')[0].slots;

    expect(slots.map((slot) => slot.index)).toEqual([0, 1, 2, 3]);
    expect(slots[1].y).toBeLessThan(slots[0].y);
    expect(slots[2].x).toBeGreaterThan(slots[0].x);
  });

  it('preserves old stacking behavior when new row fields are absent', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 8, fiber: 2 },
      portLayouts: {
        front: [
          { type: 'ethernet', count: 8, columns: 4 },
          { type: 'fiber', count: 2, columns: 2 }
        ]
      }
    });

    const groups = buildPortLayout(device, 1, 1, 'front');

    expect(groups.map((group) => group.type)).toEqual(['ethernet', 'fiber']);
    expect(groups[0].slots[0].y).toBeGreaterThan(groups[1].slots[0].y);
  });

  it('matches default-layout coordinates for legacy templates without rowIndex/yRatio', () => {
    const defaultDevice = makeDevice({
      category: 'switch',
      ports: { ethernet: 4, fiber: 2 }
    });
    const legacyDevice = makeDevice({
      category: 'switch',
      ports: { ethernet: 4, fiber: 2 },
      portLayouts: {
        front: [
          { type: 'ethernet', count: 4 },
          { type: 'fiber', count: 2 }
        ]
      }
    });

    const defaultGroups = buildPortLayout(defaultDevice, 1, 1, 'front');
    const legacyGroups = buildPortLayout(legacyDevice, 1, 1, 'front');

    expect(legacyGroups.map((group) => group.type)).toEqual(defaultGroups.map((group) => group.type));
    legacyGroups.forEach((group, groupIdx) => {
      const expected = defaultGroups[groupIdx].slots;
      expect(group.slots.map((s) => s.x)).toEqual(expected.map((s) => s.x));
      expect(group.slots.map((s) => s.y)).toEqual(expected.map((s) => s.y));
    });
  });

  it('swaps width and height and transposes placement for vertical orientation', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 4 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 4, columns: 2, orientation: 'vertical' }]
      }
    });

    const slots = buildPortLayout(device, 1, 1, 'front')[0].slots;

    expect(slots[0].width).toBeLessThan(slots[0].height);
    expect(slots[0].x).toBe(slots[1].x);
    expect(slots[0].y).toBeGreaterThan(slots[1].y);
    expect(slots[2].x).toBeGreaterThan(slots[0].x);
    expect(slots[2].x).toBe(slots[3].x);
  });

  it('propagates groupLabel to PortGroup.label', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 4 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 4, columns: 2, groupLabel: 'WAN' }]
      }
    });

    const groups = buildPortLayout(device, 1, 1, 'front');

    expect(groups[0].label).toBe('WAN');
  });

});

import { describe, expect, it, vi } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import { deviceCatalog } from '../data/deviceCatalog';
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
describe('buildPortLayout degenerate config guards', () => {
  it('clamps explicit columns of 0 instead of producing NaN geometry', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 4 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 4, columns: 0 }]
      }
    });

    const groups = buildPortLayout(device, 482.6, 44.45, 'front');

    expect(groups[0].slots).toHaveLength(4);
    for (const slot of groups[0].slots) {
      expect(Number.isFinite(slot.x)).toBe(true);
      expect(Number.isFinite(slot.y)).toBe(true);
    }
  });

  it('treats a negative explicit rowIndex as a fallback row instead of colliding', () => {
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 2, usb: 2 },
      portLayouts: {
        front: [
          { type: 'ethernet', count: 2, columns: 2, rowIndex: -2 },
          { type: 'usb', count: 2, columns: 2 }
        ]
      }
    });

    const groups = buildPortLayout(device, 482.6, 44.45, 'front');
    const ethernet = groups.find((g) => g.type === 'ethernet')!;
    const usb = groups.find((g) => g.type === 'usb')!;

    // A negative explicit rowIndex (-2) would otherwise share the fallback
    // row key with the unindexed usb config, stacking both on the same row.
    expect(ethernet.slots[0].y).not.toBeCloseTo(usb.slots[0].y, 5);
  });

  it('clamps extreme yRatio values into the face band', () => {
    const faceHeight = 44.45;
    const device = makeDevice({
      category: 'switch',
      ports: { ethernet: 2 },
      portLayouts: {
        front: [{ type: 'ethernet', count: 2, columns: 2, yRatio: 5 }]
      }
    });

    const groups = buildPortLayout(device, 482.6, faceHeight, 'front');

    for (const slot of groups[0].slots) {
      expect(Math.abs(slot.y)).toBeLessThanOrEqual(faceHeight / 2 + 1e-6);
    }
  });

  it('warns in dev when odd-even-vertical pairing does not match the grid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const device = makeDevice({
        category: 'switch',
        ports: { ethernet: 6 },
        portLayouts: {
          front: [{ type: 'ethernet', count: 6, columns: 4, pairing: 'odd-even-vertical' }]
        }
      });

      buildPortLayout(device, 482.6, 44.45, 'front');

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('applyOddEvenVerticalPairing'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('portScale + photo-faceplate alignment', () => {
  const FACE_W = 482.6;
  const FACE_H = 44.45;

  const fracLeft = (slot: { x: number; width: number }) =>
    (slot.x - slot.width / 2 + FACE_W / 2) / FACE_W;
  const fracRight = (slot: { x: number; width: number }) =>
    (slot.x + slot.width / 2 + FACE_W / 2) / FACE_W;
  const fracTopCenter = (slot: { y: number }) => (FACE_H / 2 - slot.y) / FACE_H;

  function groupsForTemplate(templateId: string, face: 'front' | 'rear') {
    const template = deviceCatalog.find((t) => t.id === templateId);
    if (!template) throw new Error(`template ${templateId} not found`);
    const device = makeDevice({
      category: template.category,
      ports: template.ports,
      portLayouts: template.portLayouts
    });
    return buildPortLayout(device, FACE_W, FACE_H, face);
  }

  it('portScale shrinks ports and gaps proportionally', () => {
    const base = makeDevice({
      category: 'switch',
      ports: { ethernet: 24 },
      portLayouts: { front: [{ type: 'ethernet', columns: 12, xRatio: 0.5 }] }
    });
    const scaled = makeDevice({
      category: 'switch',
      ports: { ethernet: 24 },
      portLayouts: {
        front: [{ type: 'ethernet', columns: 12, xRatio: 0.5, portScale: 0.5 }]
      }
    });

    const baseSlots = buildPortLayout(base, FACE_W, FACE_H, 'front')[0].slots;
    const scaledSlots = buildPortLayout(scaled, FACE_W, FACE_H, 'front')[0].slots;

    expect(scaledSlots[0].width).toBeCloseTo(baseSlots[0].width * 0.5, 3);
    const span = (slots: typeof baseSlots) =>
      Math.max(...slots.map(fracRight)) - Math.min(...slots.map(fracLeft));
    expect(span(scaledSlots)).toBeCloseTo(span(baseSlots) * 0.5, 2);
  });

  it('aligns UniFi Pro 24 PoE ports with the photo footprint', () => {
    const front = groupsForTemplate('usw-pro-24-poe', 'front');
    const eth = front.find((g) => g.type === 'ethernet')!;
    expect(eth.slots.length).toBe(24);
    // Photo: 2x12 RJ45 block spans 0.556 -> 0.844 of the face width.
    expect(Math.min(...eth.slots.map(fracLeft))).toBeCloseTo(0.556, 1);
    expect(Math.max(...eth.slots.map(fracRight))).toBeCloseTo(0.846, 1);
    // Odd ports on the top row, even on the bottom (column-paired).
    const byIndex = new Map(eth.slots.map((s) => [s.index, s]));
    expect(byIndex.get(0)!.y).toBeGreaterThan(byIndex.get(1)!.y);

    const fiber = front.find((g) => g.type === 'fiber')!;
    expect(fiber.slots.length).toBe(2);
    // Photo: stacked SFP+ cages centered at ~0.935 of the face width.
    expect(fracLeft(fiber.slots[0])).toBeGreaterThan(0.9);

    const rear = groupsForTemplate('usw-pro-24-poe', 'rear');
    const power = rear.find((g) => g.type === 'power')!;
    // Photo: IEC inlet on the rear right (0.826 -> 0.921).
    expect(fracLeft(power.slots[0])).toBeCloseTo(0.829, 1);
  });

  it('aligns UniFi Pro 48 PoE ports with the photo footprint', () => {
    const front = groupsForTemplate('usw-pro-48-poe', 'front');
    const eth = front.find((g) => g.type === 'ethernet')!;
    expect(eth.slots.length).toBe(48);
    // Photo: 2x24 RJ45 block spans 0.082 -> 0.803 of the face width and the
    // row must fit on the face (pre-portScale it overflowed both margins).
    expect(Math.min(...eth.slots.map(fracLeft))).toBeCloseTo(0.082, 1);
    expect(Math.max(...eth.slots.map(fracRight))).toBeCloseTo(0.807, 1);

    const fiber = front.find((g) => g.type === 'fiber')!;
    expect(fiber.slots.length).toBe(4);
    // Photo: 2x2 SFP+ block starting at ~0.867 of the face width.
    expect(Math.min(...fiber.slots.map(fracLeft))).toBeCloseTo(0.868, 1);

    const rear = groupsForTemplate('usw-pro-48-poe', 'rear');
    const power = rear.find((g) => g.type === 'power')!;
    expect(fracLeft(power.slots[0])).toBeCloseTo(0.811, 1);
  });

  it('aligns UniFi Enterprise 24 PoE ports with the photo footprint', () => {
    const front = groupsForTemplate('usw-enterprise-24-poe', 'front');
    const eth = front.find((g) => g.type === 'ethernet')!;
    expect(eth.slots.length).toBe(24);
    // Photo: single row of 24 RJ45 spanning 0.086 -> 0.792 of the face width.
    expect(Math.min(...eth.slots.map(fracLeft))).toBeCloseTo(0.086, 1);
    expect(Math.max(...eth.slots.map(fracRight))).toBeCloseTo(0.792, 1);
    // Photo: row sits slightly above the vertical center (yRatio 0.43).
    const centerY =
      eth.slots.reduce((sum, s) => sum + fracTopCenter(s), 0) / eth.slots.length;
    expect(centerY).toBeCloseTo(0.43, 1);

    const fiber = front.find((g) => g.type === 'fiber')!;
    expect(fiber.slots.length).toBe(2);
    // Photo: side-by-side SFP+ cages starting at ~0.885 of the face width.
    expect(Math.min(...fiber.slots.map(fracLeft))).toBeCloseTo(0.885, 1);

    const rear = groupsForTemplate('usw-enterprise-24-poe', 'rear');
    const power = rear.find((g) => g.type === 'power')!;
    expect(fracLeft(power.slots[0])).toBeCloseTo(0.82, 1);
  });
});

describe('small-device port realism (Flex Mini + APC Gaming UPS)', () => {
  function groupsForTemplateFace(
    templateId: string,
    face: 'front' | 'rear',
    widthMm: number,
    heightMm: number
  ) {
    const template = deviceCatalog.find((t) => t.id === templateId);
    if (!template) throw new Error(`template ${templateId} not found`);
    const device = makeDevice({
      category: template.category,
      ports: template.ports,
      portLayouts: template.portLayouts,
      portFaceOverrides: template.portFaceOverrides,
      widthType: template.widthType,
      customWidthMm: template.customWidthMm
    });
    return buildPortLayout(device, widthMm, heightMm, face);
  }

  it('Flex Mini renders 5 full-size RJ45 in one centered row', () => {
    // QSG hardware overview: 5 RJ45 spanning most of the 107mm front.
    const groups = groupsForTemplateFace('usw-flex-mini', 'front', 107, 44.45);
    const eth = groups.find((g) => g.type === 'ethernet')!;
    expect(eth.slots.length).toBe(5);
    // Real RJ45 ports are ~15mm, not face-relative miniatures.
    expect(eth.slots[0].width).toBeGreaterThan(14);
    const left = Math.min(...eth.slots.map((s) => s.x - s.width / 2)) + 107 / 2;
    const right = Math.max(...eth.slots.map((s) => s.x + s.width / 2)) + 107 / 2;
    expect(left / 107).toBeCloseTo(0.12, 1);
    expect(right / 107).toBeCloseTo(0.88, 1);
    // Single row: all slots share the same vertical center.
    const ys = new Set(eth.slots.map((s) => s.y.toFixed(3)));
    expect(ys.size).toBe(1);
  });

  it('APC Gaming UPS rear has outlets in 2 columns x 5 rows', () => {
    const groups = groupsForTemplateFace('apc-gaming-ups', 'rear', 105, 7 * 44.45);
    const power = groups.find((g) => g.type === 'power')!;
    expect(power.slots.length).toBe(10);
    const xs = new Set(power.slots.map((s) => s.x.toFixed(2)));
    const ys = new Set(power.slots.map((s) => s.y.toFixed(2)));
    expect(xs.size).toBe(2);
    expect(ys.size).toBe(5);
    // Dataline protection is an in/out pair, not a single port.
    const eth = groups.find((g) => g.type === 'ethernet')!;
    expect(eth.slots.length).toBe(2);
  });

  it('APC Gaming UPS front USB charging ports stack vertically', () => {
    const groups = groupsForTemplateFace('apc-gaming-ups', 'front', 105, 7 * 44.45);
    const usb = groups.find((g) => g.type === 'usb')!;
    expect(usb.slots.length).toBe(3);
    const xs = new Set(usb.slots.map((s) => s.x.toFixed(2)));
    const ys = new Set(usb.slots.map((s) => s.y.toFixed(2)));
    expect(xs.size).toBe(1);
    expect(ys.size).toBe(3);
  });

  it('caps port size when the face is given in 3D world units', () => {
    // Regression: 3D callers (DeviceModel, cable views) pass world units
    // (~mm / 247), not mm. An unconverted absolute mm cap is a no-op there,
    // so a single port used to blow up into a face-sized square.
    const device = makeDevice({
      category: 'nas',
      ports: { power: 1 },
      widthType: 'shelf',
      customWidthMm: 329
    });
    const faceW = 329 * (3.72 / 482.6); // 3D world scale: 482.6mm == 3.72 units
    const faceH = 6 * 0.18; // 6U device in world units
    const groups = buildPortLayout(device, faceW, faceH, 'rear');
    const slot = groups[0].slots[0];
    // C13 cap is ~28mm -> ~0.22 world units; the port must not fill the face.
    expect(slot.width).toBeLessThan(faceW * 0.15);
    expect(slot.height).toBeLessThan(faceH / 2);
  });
});

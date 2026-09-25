import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { getDeviceWorldBox, getDevicePortSurfaces, getDevicePortWorldPosition, getRackWorldDimensions, PORT_FACE_OFFSET } from './rackGeometry';

const baseDevice: PlacedDevice = {
  id: 'device-1',
  templateId: 'device-template',
  name: 'Test device',
  category: 'server',
  positionU: 1,
  sizeU: 1,
  depthMm: 400,
  widthType: '19in',
  weightKg: 8,
  powerW: 120,
  heatLevel: 3,
  color: '#334155'
};

describe('getDeviceWorldBox', () => {
  it('preserves oversize depth beyond the rack body for 3D inspection', () => {
    const box = getDeviceWorldBox(
      { rackType: '19in', rackDepthMm: 600 },
      { ...baseDevice, depthMm: 900 },
      { rackWidth: 3.72, rackDepth: 2.8, rackHeight: 3.24, bottom: -1.62 }
    );

    expect(box.depth).toBeCloseTo(4.2, 5);
  });

  it('keeps standard devices proportional to rack depth', () => {
    const box = getDeviceWorldBox(
      { rackType: '19in', rackDepthMm: 600 },
      { ...baseDevice, depthMm: 300 },
      { rackWidth: 3.72, rackDepth: 2.8, rackHeight: 3.24, bottom: -1.62 }
    );

    expect(box.depth).toBeCloseTo(1.4, 5);
  });

  it('falls back to a default depth when depthMm is missing instead of producing NaN', () => {
    const box = getDeviceWorldBox(
      { rackType: '19in', rackDepthMm: 600 },
      { ...baseDevice, depthMm: undefined as unknown as number },
      { rackWidth: 3.72, rackDepth: 2.8, rackHeight: 3.24, bottom: -1.62 }
    );

    expect(Number.isNaN(box.depth)).toBe(false);
    // DEFAULT_DEVICE_DEPTH_MM (200) at depthScale 2.8 / 600
    expect(box.depth).toBeCloseTo((200 * 2.8) / 600, 5);
  });
});

describe('shared 3D sockets and cable endpoints', () => {
  const layout: RackLayout = { id: 'ports', name: 'Ports', rackType: '19in', heightU: 18, rackDepthMm: 600,
    weightLimitKg: 100, powerBudgetW: 1000, viewSide: 'front', updatedAt: '', devices: [], cables: [] };
  const dimensions = getRackWorldDimensions(layout);

  it('renders both sides of every passive patch-panel jack with matching indices', () => {
    const device = { ...baseDevice, category: 'patch-panel' as const, ports: { ethernet: 24, layoutColumns: 24 } };
    const box = getDeviceWorldBox(layout, device, dimensions);
    const [front, rear] = getDevicePortSurfaces(device, box);
    expect(front.slots).toHaveLength(24);
    expect(rear.slots).toHaveLength(24);
    for (const face of [front, rear]) for (const slot of face.slots) {
      const endpoint = getDevicePortWorldPosition(layout, device, { type: 'ethernet', index: slot.index, side: face.face });
      expect(endpoint).toEqual({ x: box.x + slot.position.x, y: box.y + slot.position.y, z: box.z + slot.position.z });
      expect(Math.abs(slot.position.z)).toBeCloseTo(box.depth / 2 + PORT_FACE_OFFSET);
    }
    expect(front.slots.map((slot) => slot.position.x)).toEqual(rear.slots.map((slot) => slot.position.x));
    expect(rear.normal.z).toBe(-1);
    expect(rear.rotationY).toBe(Math.PI);
  });

  for (const mountSide of ['front', 'rear'] as const) {
    it(`keeps rear power sockets outside a ${mountSide}-mounted device`, () => {
      const device = { ...baseDevice, mountSide, ports: { power: 2, ethernet: 2 }, portFaceOverrides: { ethernet: 'front' as const } };
      const box = getDeviceWorldBox(layout, device, dimensions);
      const [front, rear] = getDevicePortSurfaces(device, box);
      expect(front.slots.every((slot) => slot.type === 'ethernet')).toBe(true);
      expect(rear.slots.every((slot) => slot.type === 'power')).toBe(true);
      expect(getDevicePortWorldPosition(layout, device, { type: 'power', index: 1 }).z).toBeLessThan(box.z - box.depth / 2);
      expect(getDevicePortWorldPosition(layout, device, { type: 'ethernet', index: 1 }).z).toBeGreaterThan(box.z + box.depth / 2);
    });
  }

  for (const mountType of ['side-rail', 'rear-rail'] as const) for (const outletFacing of ['forward', 'outward', 'inward'] as const) {
    it(`aligns ${mountType}/${outletFacing} 0U outlets with their cable tips`, () => {
      const device: PlacedDevice = { ...baseDevice, category: 'pdu-0u', sizeU: 0, mountType, mountSide0U: 'left', outletFacing, ports: { power: 12 } };
      const box = getDeviceWorldBox(layout, device, dimensions);
      const [surface] = getDevicePortSurfaces(device, box);
      expect(surface.slots).toHaveLength(12);
      for (const slot of surface.slots) expect(getDevicePortWorldPosition(layout, device, { type: 'power', index: slot.index }))
        .toEqual({ x: box.x + slot.position.x, y: box.y + slot.position.y, z: box.z + slot.position.z });
      if (mountType === 'side-rail' || outletFacing === 'inward') expect(surface.normal.x).toBe(1);
      else expect(surface.normal.z).toBe(outletFacing === 'outward' ? -1 : 1);
    });
  }
});

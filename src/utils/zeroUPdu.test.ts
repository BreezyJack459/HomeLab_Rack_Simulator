// Model a ready library before invoking synchronous template actions.
import '../data/deviceCatalog';
import { beforeEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { useRackStore } from '../store/rackStore';
import { getDevicePortSurfaces, getDevicePortWorldPosition, getDeviceWorldBox, getRackWorldDimensions } from './rackGeometry';
import { hasOverlap, isDeviceWithinRack, occupiedUnits, zeroUBottomMm } from './rackMath';
import { buildCameraPresets, SCENE_FOV } from '../components/three/rack-scene/cameraPresets';
import { buildRackSceneModel } from './rackSceneModel';
import { validateRackLayout } from './validation';

const layout: RackLayout = { id: 'pdu-test', name: 'PDU test', rackType: '19in', heightU: 20, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1200, viewSide: 'rear', devices: [], cables: [], updatedAt: '' };
const pdu: PlacedDevice = { id: 'pdu', name: 'PDU A', category: 'pdu-0u', sizeU: 0, positionU: 1 + 80 / 44.45,
  physicalHeightMm: 700, customWidthMm: 55, widthType: 'custom', depthMm: 55, mountType: 'rear-rail', mountSide0U: 'left',
  outletFacing: 'outward', weightKg: 4, powerW: 0, heatLevel: 1, color: '#333', ports: { power: 16, layoutColumns: 1 } };

describe('0U placement and shared rendering', () => {
  it('keeps actual length and bottom offset when the rack changes height', () => {
    const a = getDeviceWorldBox(layout, pdu, getRackWorldDimensions(layout));
    const taller = { ...layout, heightU: 42 };
    const b = getDeviceWorldBox(taller, pdu, getRackWorldDimensions(taller));
    expect(a.height).toBeCloseTo(b.height);
    expect(a.y - a.height / 2 - getRackWorldDimensions(layout).bottom).toBeCloseTo(80 * .18 / 44.45);
    expect(b.y - b.height / 2 - getRackWorldDimensions(taller).bottom).toBeCloseTo(80 * .18 / 44.45);
    expect(occupiedUnits([pdu], 20).size).toBe(0);
  });

  it('rejects height overflow and same-lane overlap while allowing the opposite lane', () => {
    expect(isDeviceWithinRack(layout, pdu)).toBe(true);
    expect(isDeviceWithinRack({ ...layout, heightU: 12 }, pdu)).toBe(false);
    expect(hasOverlap(layout, [pdu], { ...pdu, id: 'other' })).toBe(true);
    expect(hasOverlap(layout, [pdu], { ...pdu, id: 'other', mountSide0U: 'right' })).toBe(false);
    expect(hasOverlap(layout, [{ ...pdu, physicalHeightMm: 300, positionU: 1 }], { ...pdu, id: 'other', physicalHeightMm: 300, positionU: 1 + 350 / 44.45 })).toBe(false);
    expect(validateRackLayout({ ...layout, devices: [pdu, { ...pdu, id: 'other' }] }).some(issue => issue.id === 'overlap-pdu')).toBe(true);
  });

  for (const side of ['left', 'right'] as const) for (const facing of ['outward', 'forward', 'inward'] as const) {
    it(`keeps every ${side}/${facing} cable tip on its visible socket after moving`, () => {
      const device = { ...pdu, mountSide0U: side, outletFacing: facing, positionU: 3 };
      const box = getDeviceWorldBox(layout, device, getRackWorldDimensions(layout));
      const [surface] = getDevicePortSurfaces(device, box);
      expect(surface.slots).toHaveLength(16);
      for (const slot of surface.slots) expect(getDevicePortWorldPosition(layout, device, { type: 'power', index: slot.index }))
        .toEqual({ x: box.x + slot.position.x, y: box.y + slot.position.y, z: box.z + slot.position.z });
      expect(buildRackSceneModel({ ...layout, devices: [device] }).devices[0].box).toEqual(box);
    });
  }

  for (const aspect of [0.45, 1, 2]) it(`frames the entire external PDU and rack at aspect ${aspect}`, () => {
    const dimensions = getRackWorldDimensions(layout);
    const box = getDeviceWorldBox(layout, pdu, dimensions);
    const points = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => ({
      x: box.x + x * box.width / 2, y: box.y + y * box.height / 2, z: box.z + z * box.depth / 2,
    }))));
    expect(points.every(p => p.x < -dimensions.rackWidth / 2)).toBe(true);
    for (const preset of Object.values(buildCameraPresets(dimensions, aspect, points))) {
      const camera = new PerspectiveCamera(SCENE_FOV, aspect, 0.1, 1000);
      camera.position.set(...preset.position); camera.lookAt(...preset.target); camera.updateMatrixWorld();
      for (const p of points) {
        const screen = new Vector3(p.x, p.y, p.z).project(camera);
        expect(Math.abs(screen.x)).toBeLessThan(1);
        expect(Math.abs(screen.y)).toBeLessThan(1);
        expect(Math.abs(screen.z)).toBeLessThan(1);
      }
    }
  });
});

describe('0U store workflow', () => {
  beforeEach(() => useRackStore.getState().loadLayout(structuredClone(layout)));
  it('copies dimensions, uses the other lane, and rejects a third overlapping PDU', () => {
    const store = useRackStore.getState();
    expect(store.addDeviceFromTemplate('pdu-0u-vertical')).toBe(true);
    expect(store.addDeviceFromTemplate('pdu-0u-vertical')).toBe(true);
    const devices = useRackStore.getState().layout.devices;
    expect(devices.map(d => d.mountSide0U)).toEqual(['left', 'right']);
    expect(devices[0]).toMatchObject({ physicalHeightMm: 700, depthMm: 55, sizeU: 0 });
    expect(store.addDeviceFromTemplate('pdu-0u-vertical')).toBe(false);
  });
  it('preserves millimetre height through undo, redo, and JSON reload', () => {
    const store = useRackStore.getState();
    store.addDeviceFromTemplate('pdu-0u-short');
    const id = useRackStore.getState().selectedDeviceId!;
    expect(store.updateDevice(id, { positionU: 1 + 130 / 44.45 })).toBe(true);
    store.undo(); expect(zeroUBottomMm(useRackStore.getState().layout.devices[0])).toBe(0);
    store.redo();
    const saved = JSON.parse(JSON.stringify(useRackStore.getState().layout)) as RackLayout;
    store.loadLayout(saved);
    expect(zeroUBottomMm(useRackStore.getState().layout.devices[0])).toBeCloseTo(130);
    expect(useRackStore.getState().layout.devices[0].physicalHeightMm).toBe(400);
    expect(store.updateDevice(id, { physicalHeightMm: 1000 })).toBe(false);
  });
});

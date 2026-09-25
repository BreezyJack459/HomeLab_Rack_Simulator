import { describe, expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import { useRackStore } from '../store/rackStore';
import { canShareShelf, hasOverlap, occupiedUnits } from './rackMath';
import { getDeviceWorldBox, getRackWorldDimensions, getDevicePortWorldPosition } from './rackGeometry';
import { validateRackLayout } from './validation';
import { buildRouteObstacles } from './routeFeasibility';
import type { PlacedDevice, RackLayout } from '../types/rack';

const base = sampleLayouts[1];
const shelf: PlacedDevice = { ...base.devices.find(device => device.category === 'shelf')!, id: 'tray', positionU: 5, sizeU: 1, widthType: '19in', xMm: 0, depthMm: 300, shelfStyle: 'tray' };
const pc: PlacedDevice = { ...base.devices.find(device => device.name.includes('UM790'))!, id: 'pc', positionU: 5, xMm: 15, sizeU: 2, physicalHeightMm: 52.3, clearanceAboveMm: 10 };
const layout: RackLayout = { ...base, heightU: 10, devices: [shelf, pc], cables: [], reservations: [] };

describe('shared-U tray shelves', () => {
  it('shares two U with equipment, preserves legacy shelves, and rejects real collisions', () => {
    expect(canShareShelf(layout, shelf, pc)).toBe(true);
    expect(hasOverlap(layout, layout.devices, pc)).toBe(false);
    expect(hasOverlap(layout, layout.devices, shelf)).toBe(false);
    expect([...occupiedUnits(layout.devices, 10)]).toEqual([5, 6]);
    expect(hasOverlap(layout, [{ ...shelf, shelfStyle: undefined }, pc], pc)).toBe(true);
    for (const patch of [{ xMm: 0 }, { depthMm: 400 }, { sizeU: 1 }, { mountSide: 'rear' as const }, { mountingSupport: 'printed-mount' as const }, { physicalHeightMm: 100 }]) {
      expect(canShareShelf(layout, shelf, { ...pc, ...patch })).toBe(false);
    }
    expect(hasOverlap(layout, [...layout.devices, { ...pc, id: 'other' }], pc)).toBe(true);
    const beside = { ...pc, id: 'beside', xMm: 220 };
    expect(hasOverlap(layout, layout.devices, beside)).toBe(false);
  });

  it('places bodies directly on the deck on both faces and keeps ports on the body', () => {
    for (const mountSide of ['front', 'rear'] as const) {
      const mounted = { ...layout, devices: layout.devices.map(device => ({ ...device, mountSide })) };
      const dims = getRackWorldDimensions(mounted);
      const tray = getDeviceWorldBox(mounted, mounted.devices[0], dims);
      const body = getDeviceWorldBox(mounted, mounted.devices[1], dims);
      expect(body.y - body.height / 2).toBeCloseTo(tray.y + tray.height / 2, 8);
      expect(body.height / 0.18 * 44.45).toBeCloseTo(52.3);
      const port = getDevicePortWorldPosition(mounted, mounted.devices[1], undefined, dims);
      expect(port.y).toBeGreaterThan(body.y - body.height / 2);
      expect(port.y).toBeLessThan(body.y + body.height / 2);
      expect(buildRouteObstacles(mounted).filter(obstacle => obstacle.owner === shelf.id && obstacle.kind === 'body')).toHaveLength(3);
    }
  });

  it('checks support and combined load rather than adding the height of neighbours', () => {
    const loaded = { ...layout, devices: [{ ...shelf, shelfLoadLimitKg: 1 }, { ...pc, weightKg: 2 }] };
    const issues = validateRackLayout(loaded);
    expect(issues.some(issue => issue.id === 'shelf-pc')).toBe(false);
    expect(issues.some(issue => issue.id === 'tray-load-tray')).toBe(true);
    expect(validateRackLayout({ ...layout, devices: [pc] }).some(issue => issue.id === 'shelf-pc')).toBe(true);
  });

  it('supports store placement, undo, persistence and rejects a tray converted under equipment', () => {
    useRackStore.getState().loadLayout({ ...layout, devices: [shelf, { ...pc, positionU: 6 }] });
    expect(useRackStore.getState().moveDevice(pc.id, 5, 15)).toBe(true);
    expect(useRackStore.getState().updateDevice(shelf.id, { shelfStyle: 'solid' })).toBe(false);
    useRackStore.getState().undo();
    expect(useRackStore.getState().layout.devices.find(device => device.id === pc.id)?.positionU).toBe(6);
    useRackStore.getState().redo();
    const saved = JSON.parse(JSON.stringify(useRackStore.getState().layout)) as RackLayout;
    useRackStore.getState().loadLayout(saved);
    expect(useRackStore.getState().layout.devices.find(device => device.id === shelf.id)).toMatchObject({ shelfStyle: 'tray' });
    expect(useRackStore.getState().layout.devices.find(device => device.id === pc.id)).toMatchObject({ positionU: 5, physicalHeightMm: 52.3, clearanceAboveMm: 10 });
  });
});

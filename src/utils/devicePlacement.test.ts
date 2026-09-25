import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { deviceCatalog } from '../data/deviceCatalog';
import { useRackStore } from '../store/rackStore';
import {
  findAvailableDeviceSlot,
  getDeviceDimensionProblems,
  getPlacementFeedback,
  placementDraft,
} from './devicePlacement';

const device: PlacedDevice = {
  id: 'draft',
  name: 'Switch',
  category: 'switch',
  widthType: '19in',
  sizeU: 1,
  positionU: 2,
  depthMm: 250,
  color: '#123456',
  weightKg: 1,
  powerW: 20,
  heatLevel: 1,
  mountSide: 'front',
};
const rack: RackLayout = {
  id: 'placement-test',
  name: 'Placement test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1000,
  devices: [],
  cables: [],
  viewSide: 'front',
  updatedAt: '',
};

describe('device placement feedback', () => {
  it('rejects too-wide and too-tall devices and explains actual dimensions', () => {
    expect(
      getPlacementFeedback({ ...rack, rackType: '10in' }, device),
    ).toMatchObject({ allowed: false, problem: { code: 'width' } });
    expect(getPlacementFeedback(rack, { ...device, sizeU: 13 })).toMatchObject({
      allowed: false,
      problem: { code: 'height' },
    });
    expect(
      getPlacementFeedback(rack, { ...device, positionU: 13 }),
    ).toMatchObject({ allowed: false, problem: { code: 'bounds' } });
  });
  it('uses the real overlap rules for side-by-side placements, rear mounting and moving the same device', () => {
    const small = {
      ...device,
      widthType: 'custom' as const,
      customWidthMm: 100,
      xMm: 0,
    };
    const layout = {
      ...rack,
      devices: [{ ...small, id: 'existing', name: 'Router' }],
    };
    expect(getPlacementFeedback(layout, small)).toMatchObject({
      allowed: false,
      problem: { code: 'overlap', message: 'Space occupied by Router.' },
    });
    expect(getPlacementFeedback(layout, { ...small, xMm: 104 }).allowed).toBe(
      true,
    );
    expect(
      getPlacementFeedback(layout, { ...small, mountSide: 'rear' }).allowed,
    ).toBe(true);
    expect(
      getPlacementFeedback(layout, { ...small, id: 'existing' }).allowed,
    ).toBe(true);
  });
  it('names reserved space and finds an unreserved automatic slot', () => {
    const layout = {
      ...rack,
      reservations: [
        {
          id: 'r',
          name: 'Future NAS',
          purpose: 'future-device' as const,
          sizeU: 2,
          positionU: 1,
          mountSide: 'front' as const,
          widthType: '19in' as const,
        },
      ],
    };
    expect(getPlacementFeedback(layout, device)).toMatchObject({
      allowed: false,
      problem: { code: 'reserved' },
    });
    expect(findAvailableDeviceSlot(layout, device)?.positionU).toBe(3);
    expect(
      findAvailableDeviceSlot({ ...layout, heightU: 2 }, device),
    ).toBeNull();
  });
  it('accounts for door clearance and mounting envelope while retaining depth as a planning warning', () => {
    const layout = {
      ...rack,
      rackDepthMm: 300,
      frontDoorClearanceMm: 10,
      rearDoorClearanceMm: 10,
      rearClearanceMm: 40,
    };
    expect(
      getDeviceDimensionProblems(layout, {
        ...device,
        depthMm: 230,
        mountEnvelopeMm: 20,
      }),
    ).toEqual([
      {
        code: 'depth',
        message: 'Depth clearance: needs 250 mm / 240 mm available.',
      },
    ]);
    expect(getPlacementFeedback(layout, device)).toMatchObject({
      allowed: true,
      warning: { code: 'depth' },
    });
  });
  it('uses the same denial for preview and store placement, without modifying history or inventory', () => {
    const template = deviceCatalog.find((d) => d.id === 'cat6-patch-24')!;
    useRackStore.getState().newLayout('10in', 6);
    useRackStore.getState().addDeviceToInventory(template.id);
    const state = useRackStore.getState();
    const feedback = getPlacementFeedback(
      state.layout,
      placementDraft(template, 'front'),
    );
    expect(state.addDeviceFromTemplate(template.id, 2)).toBe(false);
    expect(useRackStore.getState().statusMessage).toBe(
      feedback.problem?.message,
    );
    expect(
      state.placeInventoryDevice(state.layout.unplacedDevices![0].id, 2),
    ).toBe(false);
    expect(useRackStore.getState().layout).toBe(state.layout);
    expect(useRackStore.getState().historyIndex).toBe(state.historyIndex);
  });
});

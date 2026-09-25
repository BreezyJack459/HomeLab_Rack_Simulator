import { describe, expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import { useRackStore } from '../store/rackStore';
import { validateRackLayout } from './validation';
import type { RackLayout } from '../types/rack';

const compact = sampleLayouts[1].devices.find(device => device.name === 'UniFi UCG-Max')!;
const fixture: RackLayout = { ...sampleLayouts[1], devices: [{ ...compact, positionU: 5 }], cables: [], reservations: [] };
const shelfIssues = (layout: RackLayout) => validateRackLayout(layout).filter(issue => issue.id.startsWith('shelf-'));

describe('printed mounting support', () => {
  it('retains the shelf requirement for existing layouts and can explicitly replace it', () => {
    expect(shelfIssues(fixture)).toHaveLength(1);
    const mounted: RackLayout = { ...fixture, devices: [{ ...fixture.devices[0], mountingSupport: 'printed-mount' }] };
    expect(shelfIssues(mounted)).toHaveLength(0);
    mounted.devices[0].mountingSupport = 'shelf';
    expect(shelfIssues(mounted)).toHaveLength(1);
  });

  it('does not exempt neighbouring devices or bypass depth checks', () => {
    const mounted: RackLayout = { ...fixture, devices: [
      { ...fixture.devices[0], mountingSupport: 'printed-mount', depthMm: 2000 },
      { ...compact, id: 'neighbour', positionU: 9 },
    ] };
    expect(shelfIssues(mounted).map(issue => issue.deviceIds)).toEqual([['neighbour']]);
    expect(validateRackLayout(mounted).some(issue => issue.id.includes('depth') && issue.deviceIds?.includes(compact.id))).toBe(true);
  });

  it('persists the mounting method and source through store updates and JSON round trips', () => {
    const store = useRackStore.getState();
    store.loadLayout(structuredClone(fixture));
    expect(useRackStore.getState().updateDevice(compact.id, {
      mountingSupport: 'printed-mount', printedMountUrl: 'https://example.com/my-device-mount',
    })).toBe(true);
    const saved = JSON.stringify(useRackStore.getState().layout);
    useRackStore.getState().loadLayout(JSON.parse(saved) as RackLayout);
    const restored = useRackStore.getState().layout.devices[0];
    expect(restored).toMatchObject({ mountingSupport: 'printed-mount', printedMountUrl: 'https://example.com/my-device-mount', positionU: 5, widthType: compact.widthType, ports: compact.ports });
    expect(shelfIssues(useRackStore.getState().layout)).toHaveLength(0);
  });
});

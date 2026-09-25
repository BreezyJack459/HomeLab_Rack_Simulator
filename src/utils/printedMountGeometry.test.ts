import { describe, expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import type { RackLayout } from '../types/rack';
import { buildPrintedMountAssemblies } from './printedMountGeometry';
import { getDeviceWorldBox, getRackWorldDimensions, getDevicePortWorldPosition } from './rackGeometry';

const makeLayout = (): RackLayout => ({ ...sampleLayouts[1], cables: [], devices: [0, 1, 2].map(index => ({
  ...sampleLayouts[1].devices.find(device => device.name === 'UniFi UCG-Max')!,
  id: `mounted-${index}`, positionU: 10, xMm: 25 + index * 140, customWidthMm: 110, mountingSupport: 'printed-mount',
})) });

describe('shared printed mount geometry', () => {
  it('joins the same row into one panel with cradles, joiners and rail fasteners', () => {
    const layout = makeLayout();
    const assemblies = buildPrintedMountAssemblies(layout);
    expect(assemblies).toHaveLength(1);
    expect(assemblies[0].deviceIds).toEqual(['mounted-0', 'mounted-1', 'mounted-2']);
    for (const kind of ['panel', 'cradle', 'joiner', 'ear', 'bolt']) expect(assemblies[0].parts.some(part => part.kind === kind)).toBe(true);
    expect(assemblies[0].parts.filter(part => part.kind === 'joiner')).toHaveLength(2);
    const { rackWidth } = getRackWorldDimensions(layout);
    expect(assemblies[0].parts.some(part => part.kind === 'bolt' && part.center.x === rackWidth / 2)).toBe(true);
    expect(assemblies[0].parts.some(part => part.kind === 'bolt' && part.center.x === -rackWidth / 2)).toBe(true);
    layout.devices.reverse();
    expect(buildPrintedMountAssemblies(layout)).toEqual(assemblies);
  });

  it('separates rows and faces and removes supports when the option is turned off', () => {
    const layout = makeLayout();
    layout.devices[1].positionU = 11;
    layout.devices[2].mountSide = 'rear';
    expect(buildPrintedMountAssemblies(layout)).toHaveLength(3);
    layout.devices.forEach(device => { device.mountingSupport = 'shelf'; });
    expect(buildPrintedMountAssemblies(layout)).toEqual([]);
  });

  it.each(['front', 'rear'] as const)('keeps bodies and port openings clear on the %s face', side => {
    const layout = makeLayout();
    layout.devices.forEach(device => { device.mountSide = side; });
    // A non-printed neighbour must also have a panel opening.
    layout.devices[1].mountingSupport = 'shelf';
    const dimensions = getRackWorldDimensions(layout);
    for (const assembly of buildPrintedMountAssemblies(layout)) {
      for (const part of assembly.parts) {
        for (const value of [...Object.values(part.center), ...Object.values(part.size)]) expect(Number.isFinite(value)).toBe(true);
        for (const device of layout.devices) {
          const box = getDeviceWorldBox(layout, device, dimensions);
          const intersects = Math.abs(part.center.x - box.x) < (part.size.x + box.width) / 2 - 0.00001 &&
            Math.abs(part.center.y - box.y) < (part.size.y + box.height) / 2 - 0.00001 &&
            Math.abs(part.center.z - box.z) < (part.size.z + box.depth) / 2 - 0.00001;
          expect(intersects).toBe(false);
          if (part.kind === 'panel' || part.kind === 'joiner') {
            const point = getDevicePortWorldPosition(layout, device, { type: 'ethernet', index: 0, side }, dimensions);
            expect(Math.abs(point.x - part.center.x) < part.size.x / 2 && Math.abs(point.y - part.center.y) < part.size.y / 2).toBe(false);
          }
        }
      }
    }
  });
});

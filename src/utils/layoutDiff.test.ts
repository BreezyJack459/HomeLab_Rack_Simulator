import { describe, it, expect } from 'vitest';
import type { RackLayout, PlacedDevice, CableRoute } from '../types/rack';
import { diffLayouts } from './layoutDiff';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'd1',
    category: 'switch',
    name: 'Switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 4,
    powerW: 40,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

function makeCable(overrides: Partial<CableRoute> = {}): CableRoute {
  return {
    id: 'c1',
    fromDeviceId: 'd1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'd2',
    toPort: { type: 'ethernet', index: 1 },
    type: 'ethernet',
    color: '#3b82f6',
    ...overrides,
  };
}

function makeLayout(overrides: Partial<RackLayout> = {}): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1000,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('diffLayouts', () => {
  it('returns empty diff for identical layouts', () => {
    const layout = makeLayout();
    const diff = diffLayouts(layout, layout);
    expect(diff.changes).toHaveLength(0);
    expect(diff.addedDevices).toHaveLength(0);
    expect(diff.removedDevices).toHaveLength(0);
  });

  it('detects added devices', () => {
    const before = makeLayout({ devices: [] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'New Switch' })] });
    const diff = diffLayouts(before, after);
    expect(diff.addedDevices).toHaveLength(1);
    expect(diff.addedDevices[0].deviceId).toBe('d1');
    expect(diff.addedDevices[0].name).toBe('New Switch');
  });

  it('detects removed devices', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'Old Switch' })] });
    const after = makeLayout({ devices: [] });
    const diff = diffLayouts(before, after);
    expect(diff.removedDevices).toHaveLength(1);
    expect(diff.removedDevices[0].deviceId).toBe('d1');
    expect(diff.removedDevices[0].name).toBe('Old Switch');
  });

  it('detects moved devices (position change)', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', positionU: 1 })] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', positionU: 3 })] });
    const diff = diffLayouts(before, after);
    expect(diff.movedDevices).toHaveLength(1);
    expect(diff.movedDevices[0].deviceId).toBe('d1');
  });

  it('detects renamed devices', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'Switch A' })] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'Switch B' })] });
    const diff = diffLayouts(before, after);
    expect(diff.renamedDevices).toHaveLength(1);
    expect(diff.renamedDevices[0].name).toBe('Switch B');
  });

  it('detects resized devices', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', sizeU: 1 })] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', sizeU: 2 })] });
    const diff = diffLayouts(before, after);
    expect(diff.resizedDevices).toHaveLength(1);
  });

  it('detects repowered devices', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', powerW: 40, circuit: 'A' })] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', powerW: 60, circuit: 'A' })] });
    const diff = diffLayouts(before, after);
    expect(diff.deviceChanges).toHaveLength(1);
    expect(diff.deviceChanges[0].class).toBe('repowered');
  });

  it('detects added cables', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })], cables: [] });
    const after = makeLayout({
      devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })],
      cables: [makeCable()],
    });
    const diff = diffLayouts(before, after);
    expect(diff.addedCables).toHaveLength(1);
  });

  it('detects removed cables', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })], cables: [makeCable()] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })], cables: [] });
    const diff = diffLayouts(before, after);
    expect(diff.removedCables).toHaveLength(1);
  });

  it('detects rewired cables (port change)', () => {
    const before = makeLayout({
      devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })],
      cables: [makeCable({ fromPort: { type: 'ethernet', index: 0 } })],
    });
    const after = makeLayout({
      devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })],
      cables: [makeCable({ fromPort: { type: 'ethernet', index: 2 } })],
    });
    const diff = diffLayouts(before, after);
    expect(diff.rewiredCables).toHaveLength(1);
  });

  it('detects layout property changes', () => {
    const before = makeLayout({ name: 'Rack A', heightU: 12 });
    const after = makeLayout({ name: 'Rack B', heightU: 24 });
    const diff = diffLayouts(before, after);
    expect(diff.layoutPropertyChanges).toHaveLength(2);
    expect(diff.layoutPropertyChanges.some((c) => c.property === 'name')).toBe(true);
    expect(diff.layoutPropertyChanges.some((c) => c.property === 'heightU')).toBe(true);
  });

  it('prioritizes move over rename when both change', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'Switch', positionU: 1 })] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'Router', positionU: 3 })] });
    const diff = diffLayouts(before, after);
    expect(diff.movedDevices).toHaveLength(1);
    expect(diff.renamedDevices).toHaveLength(0);
  });

  it('aggregates counts correctly', () => {
    const before = makeLayout({
      devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })],
      cables: [makeCable({ id: 'c1' })],
    });
    const after = makeLayout({
      devices: [makeDevice({ id: 'd2', positionU: 5 }), makeDevice({ id: 'd3' })],
      cables: [makeCable({ id: 'c2' })],
    });
    const diff = diffLayouts(before, after);
    expect(diff.addedDevices).toHaveLength(1); // d3
    expect(diff.removedDevices).toHaveLength(1); // d1
    expect(diff.movedDevices).toHaveLength(1); // d2
    expect(diff.addedCables).toHaveLength(1); // c2
    expect(diff.removedCables).toHaveLength(1); // c1
  });
});

/**
 * Tests for portSelection.ts
 * Covers: portTypeForCableType, portKey, getUsedPorts, isPortUsed,
 *         inferCableType, portOptionsForDevice, getNextFreePort,
 *         getFreePortSummary, autoResolveCable, portChoicesForDevice,
 *         resolveCompatibleCable, sourceSupportsCableType
 */

import { describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import {
  autoResolveCable,
  getFreePortSummary,
  getNextFreePort,
  getUsedPorts,
  inferCableType,
  isPortUsed,
  portChoicesForDevice,
  portKey,
  portOptionsForDevice,
  portTypeForCableType,
  resolveCompatibleCable,
  sourceSupportsCableType,
} from './portSelection';

// ============================================================================
// Fixtures
// ============================================================================

function makeDevice(partial: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    templateId: 'tpl-1',
    category: 'server',
    name: 'Test Server',
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
    ports: { ethernet: 4 },
    color: '#334155',
    portFaceOverrides: undefined,
    label: '',
    noiseDb: undefined,
    ...partial,
  } as PlacedDevice;
}

function makeLayout(devices: PlacedDevice[] = [], cables: Partial<CableRoute>[] = []): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    depthMm: 600,
    electricityRatePerKwh: 0.1,
    devices,
    cables: cables as CableRoute[],
  };
}

function makeCable(partial: Partial<CableRoute>): CableRoute {
  return {
    id: 'cable-1',
    type: 'ethernet',
    color: '#00bcd4',
    fromDeviceId: 'dev-1',
    toDeviceId: 'dev-2',
    fromPort: { type: 'ethernet', index: 0, side: 'rear' },
    toPort: { type: 'ethernet', index: 0, side: 'rear' },
    nodes: [],
    ...partial,
  };
}

// ============================================================================
// portTypeForCableType
// ============================================================================

describe('portTypeForCableType', () => {
  it('maps structured → ethernet', () => {
    expect(portTypeForCableType('structured')).toBe('ethernet');
  });
  it('maps patch → ethernet', () => {
    expect(portTypeForCableType('patch')).toBe('ethernet');
  });
  it('passes through ethernet', () => {
    expect(portTypeForCableType('ethernet')).toBe('ethernet');
  });
  it('passes through power', () => {
    expect(portTypeForCableType('power')).toBe('power');
  });
  it('passes through fiber', () => {
    expect(portTypeForCableType('fiber')).toBe('fiber');
  });
  it('passes through usb, hdmi, atx, coax', () => {
    expect(portTypeForCableType('usb')).toBe('usb');
    expect(portTypeForCableType('hdmi')).toBe('hdmi');
    expect(portTypeForCableType('atx')).toBe('atx');
    expect(portTypeForCableType('coax')).toBe('coax');
  });
});

// ============================================================================
// portKey
// ============================================================================

describe('portKey', () => {
  it('produces stable key for typed port', () => {
    expect(portKey({ type: 'ethernet', index: 0, side: 'rear' })).toBe('ethernet:rear:0');
  });
  it('uses "any" when side is undefined', () => {
    expect(portKey({ type: 'power', index: 2 })).toBe('power:any:2');
  });
  it('different indexes produce different keys', () => {
    expect(portKey({ type: 'ethernet', index: 0 })).not.toBe(portKey({ type: 'ethernet', index: 1 }));
  });
  it('different sides produce different keys', () => {
    expect(portKey({ type: 'ethernet', index: 0, side: 'front' })).not.toBe(
      portKey({ type: 'ethernet', index: 0, side: 'rear' })
    );
  });
});

// ============================================================================
// getUsedPorts
// ============================================================================

describe('getUsedPorts', () => {
  it('returns empty set when no cables', () => {
    const layout = makeLayout([makeDevice()]);
    expect(getUsedPorts(layout, 'dev-1', 'ethernet').size).toBe(0);
  });

  it('tracks port used as fromPort', () => {
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 2, side: 'rear' } });
    const layout = makeLayout([], [cable]);
    const used = getUsedPorts(layout, 'dev-1', 'ethernet');
    expect(used.has(2)).toBe(true);
  });

  it('tracks port used as toPort', () => {
    const cable = makeCable({ toDeviceId: 'dev-1', toPort: { type: 'ethernet', index: 3, side: 'rear' } });
    const layout = makeLayout([], [cable]);
    const used = getUsedPorts(layout, 'dev-1', 'ethernet');
    expect(used.has(3)).toBe(true);
  });

  it('ignores ports on other devices', () => {
    const cable = makeCable({ fromDeviceId: 'dev-99', fromPort: { type: 'ethernet', index: 0 } });
    const layout = makeLayout([], [cable]);
    expect(getUsedPorts(layout, 'dev-1', 'ethernet').size).toBe(0);
  });

  it('ignores ports of wrong type', () => {
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'power', index: 0 } });
    const layout = makeLayout([], [cable]);
    expect(getUsedPorts(layout, 'dev-1', 'ethernet').size).toBe(0);
  });

  it('filters by side when side specified', () => {
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([], [cable]);
    expect(getUsedPorts(layout, 'dev-1', 'ethernet', 'front').size).toBe(0);
    expect(getUsedPorts(layout, 'dev-1', 'ethernet', 'rear').has(0)).toBe(true);
  });

  it('multiple cables accumulate used ports', () => {
    const c1 = makeCable({ id: 'c1', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const c2 = makeCable({ id: 'c2', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    const layout = makeLayout([], [c1, c2]);
    const used = getUsedPorts(layout, 'dev-1', 'ethernet');
    expect(used.has(0)).toBe(true);
    expect(used.has(1)).toBe(true);
    expect(used.has(2)).toBe(false);
  });
});

// ============================================================================
// isPortUsed
// ============================================================================

describe('isPortUsed', () => {
  it('returns false when no cables', () => {
    expect(isPortUsed(makeLayout(), 'dev-1', 'ethernet', 0)).toBe(false);
  });

  it('returns true for occupied fromPort', () => {
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    expect(isPortUsed(makeLayout([], [cable]), 'dev-1', 'ethernet', 1)).toBe(true);
  });

  it('returns true for occupied toPort', () => {
    const cable = makeCable({ toDeviceId: 'dev-1', toPort: { type: 'ethernet', index: 2, side: 'rear' } });
    expect(isPortUsed(makeLayout([], [cable]), 'dev-1', 'ethernet', 2)).toBe(true);
  });

  it('returns false for different port index', () => {
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    expect(isPortUsed(makeLayout([], [cable]), 'dev-1', 'ethernet', 1)).toBe(false);
  });

  it('returns false for wrong side', () => {
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    expect(isPortUsed(makeLayout([], [cable]), 'dev-1', 'ethernet', 0, 'front')).toBe(false);
  });

  it('matches when side is undefined on stored port (wildcard)', () => {
    // Cable stored without side — portClaimMatches returns true for any queried side
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0 } });
    expect(isPortUsed(makeLayout([], [cable]), 'dev-1', 'ethernet', 0, 'rear')).toBe(true);
  });
});

// ============================================================================
// inferCableType
// ============================================================================

describe('inferCableType', () => {
  const server = makeDevice({ id: 'srv', category: 'server' });
  const switchDev = makeDevice({ id: 'sw', category: 'switch' });
  const patchPanel = makeDevice({ id: 'pp', category: 'patch-panel' });
  const pdu = makeDevice({ id: 'pdu', category: 'pdu', ports: { power: 8 } });

  it('returns null for undefined devices', () => {
    expect(inferCableType(undefined, server)).toBeNull();
    expect(inferCableType(server, undefined)).toBeNull();
    expect(inferCableType(undefined, undefined)).toBeNull();
  });

  it('server → server = ethernet', () => {
    expect(inferCableType(server, server)).toBe('ethernet');
  });

  it('server → switch = ethernet', () => {
    expect(inferCableType(server, switchDev)).toBe('ethernet');
  });

  it('switch → patch-panel = patch', () => {
    expect(inferCableType(switchDev, patchPanel)).toBe('patch');
  });

  it('patch-panel → switch = patch (symmetric)', () => {
    expect(inferCableType(patchPanel, switchDev)).toBe('patch');
  });

  it('server → patch-panel = structured', () => {
    expect(inferCableType(server, patchPanel)).toBe('structured');
  });

  it('patch-panel → server = structured (symmetric)', () => {
    expect(inferCableType(patchPanel, server)).toBe('structured');
  });

  it('pdu → anything = power', () => {
    expect(inferCableType(pdu, server)).toBe('power');
    expect(inferCableType(server, pdu)).toBe('power');
    expect(inferCableType(pdu, pdu)).toBe('power');
  });

  it('pdu takes priority over patch-panel', () => {
    expect(inferCableType(pdu, patchPanel)).toBe('power');
  });
});

// ============================================================================
// portOptionsForDevice
// ============================================================================

describe('portOptionsForDevice', () => {
  it('returns empty for device with no ports', () => {
    const dev = makeDevice({ ports: {} });
    expect(portOptionsForDevice(dev, 'ethernet', makeLayout())).toHaveLength(0);
  });

  it('returns empty for undefined device', () => {
    expect(portOptionsForDevice(undefined, 'ethernet', makeLayout())).toHaveLength(0);
  });

  it('returns correct count for server ethernet', () => {
    const dev = makeDevice({ ports: { ethernet: 4 } });
    const opts = portOptionsForDevice(dev, 'ethernet', makeLayout());
    expect(opts).toHaveLength(4);
  });

  it('marks occupied ports as disabled', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 4 } });
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([dev], [cable]);
    const opts = portOptionsForDevice(dev, 'ethernet', layout);
    expect(opts[0].disabled).toBe(true);
    expect(opts[1].disabled).toBe(false);
    expect(opts[2].disabled).toBe(false);
    expect(opts[3].disabled).toBe(false);
  });

  it('patch cable only allowed on switch front ports', () => {
    const sw = makeDevice({ category: 'switch', ports: { ethernet: 4 } });
    const opts = portOptionsForDevice(sw, 'patch', makeLayout());
    expect(opts.every(o => o.side === 'front')).toBe(true);
    expect(opts).toHaveLength(4);
  });

  it('patch cable returns empty for non-switch', () => {
    const srv = makeDevice({ category: 'server', ports: { ethernet: 4 } });
    expect(portOptionsForDevice(srv, 'patch', makeLayout())).toHaveLength(0);
  });

  it('patch-panel structured cable gives rear ports only', () => {
    const pp = makeDevice({ category: 'patch-panel', ports: { ethernet: 4 } });
    const opts = portOptionsForDevice(pp, 'structured', makeLayout([pp]));
    expect(opts.every(o => o.side === 'rear')).toBe(true);
  });

  it('patch-panel patch cable gives front ports only', () => {
    const pp = makeDevice({ category: 'patch-panel', ports: { ethernet: 4 } });
    const opts = portOptionsForDevice(pp, 'patch', makeLayout([pp]));
    expect(opts.every(o => o.side === 'front')).toBe(true);
  });

  it('patch-panel ethernet cable gives both front and rear', () => {
    const pp = makeDevice({ category: 'patch-panel', ports: { ethernet: 2 } });
    const opts = portOptionsForDevice(pp, 'ethernet', makeLayout([pp]));
    const fronts = opts.filter(o => o.side === 'front');
    const rears = opts.filter(o => o.side === 'rear');
    expect(fronts).toHaveLength(2);
    expect(rears).toHaveLength(2);
  });

  it('all ports disabled when all cables used', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 2 } });
    const c1 = makeCable({ id: 'c1', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const c2 = makeCable({ id: 'c2', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    const layout = makeLayout([dev], [c1, c2]);
    const opts = portOptionsForDevice(dev, 'ethernet', layout);
    expect(opts.every(o => o.disabled)).toBe(true);
  });

  it('device with zero port count returns empty', () => {
    const dev = makeDevice({ ports: { ethernet: 0 } });
    expect(portOptionsForDevice(dev, 'ethernet', makeLayout())).toHaveLength(0);
  });

  it('negative port count returns empty', () => {
    const dev = makeDevice({ ports: { ethernet: -1 } });
    expect(portOptionsForDevice(dev, 'ethernet', makeLayout())).toHaveLength(0);
  });
});

// ============================================================================
// getNextFreePort
// ============================================================================

describe('getNextFreePort', () => {
  it('returns first port when all free', () => {
    const dev = makeDevice({ ports: { ethernet: 4 } });
    const port = getNextFreePort(dev, 'ethernet', makeLayout());
    expect(port).not.toBeNull();
    expect(port?.index).toBe(0);
  });

  it('skips used ports to return next free', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 4 } });
    const c1 = makeCable({ id: 'c1', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const c2 = makeCable({ id: 'c2', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    const layout = makeLayout([dev], [c1, c2]);
    const port = getNextFreePort(dev, 'ethernet', layout);
    expect(port?.index).toBe(2);
  });

  it('returns null when all ports used', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 2 } });
    const c1 = makeCable({ id: 'c1', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const c2 = makeCable({ id: 'c2', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    const layout = makeLayout([dev], [c1, c2]);
    expect(getNextFreePort(dev, 'ethernet', layout)).toBeNull();
  });

  it('returns null for device without that port type', () => {
    const dev = makeDevice({ ports: { power: 2 } });
    expect(getNextFreePort(dev, 'ethernet', makeLayout())).toBeNull();
  });

  it('returns null for non-switch with patch cable type', () => {
    const dev = makeDevice({ category: 'server', ports: { ethernet: 4 } });
    expect(getNextFreePort(dev, 'patch', makeLayout())).toBeNull();
  });

  it('works for power port type', () => {
    const dev = makeDevice({ category: 'pdu', ports: { power: 8 } });
    const port = getNextFreePort(dev, 'power', makeLayout());
    expect(port?.index).toBe(0);
  });

  it('single port device, port used → returns null', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 1 } });
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    expect(getNextFreePort(dev, 'ethernet', makeLayout([dev], [cable]))).toBeNull();
  });
});

// ============================================================================
// getFreePortSummary
// ============================================================================

describe('getFreePortSummary', () => {
  it('returns empty for device with no ports', () => {
    const dev = makeDevice({ ports: {} });
    expect(getFreePortSummary(dev, makeLayout())).toHaveLength(0);
  });

  it('returns summary for server with ethernet ports', () => {
    const dev = makeDevice({ ports: { ethernet: 4 } });
    const summary = getFreePortSummary(dev, makeLayout());
    const eth = summary.find(s => s.type === 'ethernet');
    expect(eth).toBeDefined();
    expect(eth?.free).toBeGreaterThan(0);
  });

  it('omits fully-used port types', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 1 } });
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([dev], [cable]);
    const summary = getFreePortSummary(dev, layout);
    expect(summary.find(s => s.type === 'ethernet')).toBeUndefined();
  });

  it('returns multiple types for multi-port device', () => {
    const dev = makeDevice({ ports: { ethernet: 4, power: 2 } });
    const summary = getFreePortSummary(dev, makeLayout());
    const types = summary.map(s => s.type);
    expect(types).toContain('ethernet');
    expect(types).toContain('power');
  });

  it('free count decrements as ports are used', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 4 } });
    const c1 = makeCable({ id: 'c1', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const c2 = makeCable({ id: 'c2', fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    const layout = makeLayout([dev], [c1, c2]);
    const summary = getFreePortSummary(dev, layout);
    const eth = summary.find(s => s.type === 'ethernet');
    expect(eth?.free).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// autoResolveCable
// ============================================================================

describe('autoResolveCable', () => {
  const server1 = makeDevice({ id: 'srv-1', category: 'server', ports: { ethernet: 4 } });
  const server2 = makeDevice({ id: 'srv-2', category: 'server', ports: { ethernet: 4 } });
  const switchDev = makeDevice({ id: 'sw-1', category: 'switch', ports: { ethernet: 24 } });
  const patchPanel = makeDevice({ id: 'pp-1', category: 'patch-panel', ports: { ethernet: 24 } });
  const pdu = makeDevice({ id: 'pdu-1', category: 'pdu', ports: { power: 8 } });
  const noPortServer = makeDevice({ id: 'empty', category: 'server', ports: {} });

  it('resolves ethernet between two servers', () => {
    const result = autoResolveCable(server1, server2, makeLayout([server1, server2]));
    expect(result).not.toBeNull();
    expect(result?.cableType).toBe('ethernet');
    expect(result?.fromPort.index).toBe(0);
    expect(result?.toPort.index).toBe(0);
  });

  it('resolves power between pdu and server', () => {
    const srv = makeDevice({ id: 'srv-p', category: 'server', ports: { power: 2 } });
    const result = autoResolveCable(pdu, srv, makeLayout([pdu, srv]));
    expect(result?.cableType).toBe('power');
    expect(result?.fromPort.type).toBe('power');
    expect(result?.toPort.type).toBe('power');
  });

  it('resolves patch between switch and patch panel', () => {
    const result = autoResolveCable(switchDev, patchPanel, makeLayout([switchDev, patchPanel]));
    expect(result?.cableType).toBe('patch');
  });

  it('resolves structured between server and patch panel', () => {
    const result = autoResolveCable(server1, patchPanel, makeLayout([server1, patchPanel]));
    expect(result?.cableType).toBe('structured');
  });

  it('returns null when source has no free ports', () => {
    const dev = makeDevice({ id: 'full', category: 'server', ports: { ethernet: 1 } });
    const cable = makeCable({ fromDeviceId: 'full', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([dev, server2], [cable]);
    expect(autoResolveCable(dev, server2, layout)).toBeNull();
  });

  it('returns null when destination has no free ports', () => {
    const full = makeDevice({ id: 'full', category: 'server', ports: { ethernet: 1 } });
    const cable = makeCable({ id: 'c2', fromDeviceId: 'full', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([server1, full], [cable]);
    expect(autoResolveCable(server1, full, layout)).toBeNull();
  });

  it('returns null when device has no relevant port type', () => {
    expect(autoResolveCable(server1, noPortServer, makeLayout([server1, noPortServer]))).toBeNull();
  });

  it('picks next available port when earlier ports used', () => {
    const src = makeDevice({ id: 'src', category: 'server', ports: { ethernet: 4 } });
    const dst = makeDevice({ id: 'dst', category: 'server', ports: { ethernet: 4 } });
    const c1 = makeCable({ id: 'c1', fromDeviceId: 'src', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const c2 = makeCable({ id: 'c2', fromDeviceId: 'src', fromPort: { type: 'ethernet', index: 1, side: 'rear' } });
    const layout = makeLayout([src, dst], [c1, c2]);
    const result = autoResolveCable(src, dst, layout);
    expect(result?.fromPort.index).toBe(2);
  });

  it('fromPort and toPort are independent (different indexes when dest partially used)', () => {
    const src = makeDevice({ id: 'src2', category: 'server', ports: { ethernet: 4 } });
    const dst = makeDevice({ id: 'dst2', category: 'server', ports: { ethernet: 4 } });
    const cable = makeCable({ id: 'cx', fromDeviceId: 'dst2', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([src, dst], [cable]);
    const result = autoResolveCable(src, dst, layout);
    expect(result?.fromPort.index).toBe(0);
    expect(result?.toPort.index).toBe(1);
  });

  it('color is a non-empty string', () => {
    const result = autoResolveCable(server1, server2, makeLayout([server1, server2]));
    expect(typeof result?.color).toBe('string');
    expect(result?.color.length).toBeGreaterThan(0);
  });

  it('same device does not crash (no guard at this level)', () => {
    const result = autoResolveCable(server1, server1, makeLayout([server1]));
    expect(result === null || typeof result?.cableType === 'string').toBe(true);
  });
});

// ============================================================================
// portChoicesForDevice
// ============================================================================

describe('portChoicesForDevice', () => {
  it('returns choices for each port', () => {
    const dev = makeDevice({ ports: { ethernet: 4 } });
    const choices = portChoicesForDevice(dev, makeLayout());
    expect(choices.length).toBeGreaterThan(0);
    choices.forEach(c => {
      expect(c.deviceId).toBe(dev.id);
      expect(c.deviceName).toBe(dev.name);
    });
  });

  it('returns empty for device with no ports', () => {
    const dev = makeDevice({ ports: {} });
    expect(portChoicesForDevice(dev, makeLayout())).toHaveLength(0);
  });

  it('marks used ports as disabled', () => {
    const dev = makeDevice({ id: 'dev-1', ports: { ethernet: 2 } });
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([dev], [cable]);
    const choices = portChoicesForDevice(dev, layout);
    const port0 = choices.find(c => c.index === 0 && c.side === 'rear');
    expect(port0?.disabled).toBe(true);
  });

  it('aggregates multiple cable types for the same physical port', () => {
    const sw = makeDevice({ category: 'switch', ports: { ethernet: 4 } });
    const choices = portChoicesForDevice(sw, makeLayout());
    const port0 = choices.find(c => c.index === 0);
    expect(port0?.cableTypes.length).toBeGreaterThan(1);
  });

  it('sorts front before rear', () => {
    const pp = makeDevice({ category: 'patch-panel', ports: { ethernet: 2 } });
    const choices = portChoicesForDevice(pp, makeLayout([pp]));
    const sides = choices.map(c => c.side);
    const firstRear = sides.indexOf('rear');
    const lastFront = sides.lastIndexOf('front');
    expect(lastFront < firstRear || firstRear === -1).toBe(true);
  });
});

// ============================================================================
// sourceSupportsCableType
// ============================================================================

describe('sourceSupportsCableType', () => {
  it('returns true when source port is free and matches cable type', () => {
    const dev = makeDevice({ id: 'dev-1', category: 'server', ports: { ethernet: 4 } });
    const source = { port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    expect(sourceSupportsCableType(source, dev, 'ethernet', makeLayout([dev]))).toBe(true);
  });

  it('returns false when port is occupied', () => {
    const dev = makeDevice({ id: 'dev-1', category: 'server', ports: { ethernet: 4 } });
    const cable = makeCable({ fromDeviceId: 'dev-1', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([dev], [cable]);
    const source = { port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    expect(sourceSupportsCableType(source, dev, 'ethernet', layout)).toBe(false);
  });

  it('returns false for wrong cable type (patch on non-switch)', () => {
    const dev = makeDevice({ id: 'dev-1', category: 'server', ports: { ethernet: 4 } });
    const source = { port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    expect(sourceSupportsCableType(source, dev, 'patch', makeLayout([dev]))).toBe(false);
  });
});

// ============================================================================
// resolveCompatibleCable
// ============================================================================

describe('resolveCompatibleCable', () => {
  const srv1 = makeDevice({ id: 'srv-1', category: 'server', ports: { ethernet: 4 } });
  const srv2 = makeDevice({ id: 'srv-2', category: 'server', ports: { ethernet: 4 } });

  function makeChoice(
    deviceId: string,
    type: 'ethernet' | 'power' | 'fiber',
    index: number,
    side: 'front' | 'rear' = 'rear',
    disabled = false
  ) {
    return {
      deviceId,
      deviceName: 'Device',
      type,
      index,
      side,
      label: `${type} ${index + 1}`,
      cableTypes: ['ethernet' as const],
      disabled,
    };
  }

  it('resolves when source and choice are compatible', () => {
    const layout = makeLayout([srv1, srv2]);
    const source = { deviceId: 'srv-1', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('srv-2', 'ethernet', 0, 'rear');
    const result = resolveCompatibleCable(layout, source, choice);
    expect(result).not.toBeNull();
    expect(result?.cableType).toBe('ethernet');
  });

  it('returns null when source is null', () => {
    const layout = makeLayout([srv1, srv2]);
    const choice = makeChoice('srv-2', 'ethernet', 0);
    expect(resolveCompatibleCable(layout, null, choice)).toBeNull();
  });

  it('returns null when same device', () => {
    const layout = makeLayout([srv1]);
    const source = { deviceId: 'srv-1', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('srv-1', 'ethernet', 1);
    expect(resolveCompatibleCable(layout, source, choice)).toBeNull();
  });

  it('returns null when choice is disabled', () => {
    const layout = makeLayout([srv1, srv2]);
    const source = { deviceId: 'srv-1', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('srv-2', 'ethernet', 0, 'rear', true);
    expect(resolveCompatibleCable(layout, source, choice)).toBeNull();
  });

  it('returns null when dest port is already used', () => {
    const cable = makeCable({ id: 'cx', fromDeviceId: 'srv-2', fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    const layout = makeLayout([srv1, srv2], [cable]);
    const source = { deviceId: 'srv-1', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('srv-2', 'ethernet', 0);
    expect(resolveCompatibleCable(layout, source, choice)).toBeNull();
  });

  it('returns null when inferred cable type mismatches source port type', () => {
    const pdu = makeDevice({ id: 'pdu-1', category: 'pdu', ports: { power: 8 } });
    const layout = makeLayout([pdu, srv2]);
    // Source is a PDU, inferred cable is 'power', but source port says 'ethernet' — mismatch
    const source = { deviceId: 'pdu-1', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('srv-2', 'ethernet', 0);
    expect(resolveCompatibleCable(layout, source, choice)).toBeNull();
  });

  it('returns null when source device not in layout', () => {
    const layout = makeLayout([srv2]);
    const source = { deviceId: 'ghost-device', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('srv-2', 'ethernet', 0);
    expect(resolveCompatibleCable(layout, source, choice)).toBeNull();
  });

  it('returns null when dest device not in layout', () => {
    const layout = makeLayout([srv1]);
    const source = { deviceId: 'srv-1', port: { type: 'ethernet' as const, index: 0, side: 'rear' as const } };
    const choice = makeChoice('ghost-device', 'ethernet', 0);
    expect(resolveCompatibleCable(layout, source, choice)).toBeNull();
  });
});

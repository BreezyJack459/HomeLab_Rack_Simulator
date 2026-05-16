import { describe, it, expect } from 'vitest';
import type { CableRoute, PlacedDevice, PortReservation, PortType } from '../types/rack';
import {
  getPortReservationsForDevice,
  isPortReserved,
  findReservation,
  summarizePortReservations,
  validatePortReservations,
  exportPortReservationsMarkdown,
  exportPortReservationsCsv,
} from './portReservations';

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

function makeReservation(overrides: Partial<PortReservation> = {}): PortReservation {
  return {
    id: 'pr-1',
    deviceId: 'd1',
    portType: 'ethernet' as PortType,
    portIndex: 0,
    purpose: 'Uplink',
    ...overrides,
  };
}

function makeCable(overrides: Partial<CableRoute> = {}): CableRoute {
  return {
    id: 'c1',
    fromDeviceId: 'd1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'd2',
    toPort: { type: 'ethernet', index: 0 },
    type: 'ethernet',
    color: '#3b82f6',
    ...overrides,
  };
}

describe('getPortReservationsForDevice', () => {
  it('returns reservations for the given device', () => {
    const reservations: PortReservation[] = [
      makeReservation({ id: 'r1', deviceId: 'd1' }),
      makeReservation({ id: 'r2', deviceId: 'd2' }),
      makeReservation({ id: 'r3', deviceId: 'd1' }),
    ];
    const result = getPortReservationsForDevice(reservations, 'd1');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain('r1');
    expect(result.map((r) => r.id)).toContain('r3');
  });

  it('returns empty array when no reservations', () => {
    const result = getPortReservationsForDevice([], 'd1');
    expect(result).toHaveLength(0);
  });
});

describe('isPortReserved', () => {
  it('returns true when port is reserved', () => {
    const reservations: PortReservation[] = [
      makeReservation({ deviceId: 'd1', portType: 'ethernet', portIndex: 5 }),
    ];
    expect(isPortReserved(reservations, 'd1', 'ethernet', 5)).toBe(true);
  });

  it('returns false when port is not reserved', () => {
    const reservations: PortReservation[] = [
      makeReservation({ deviceId: 'd1', portType: 'ethernet', portIndex: 5 }),
    ];
    expect(isPortReserved(reservations, 'd1', 'ethernet', 3)).toBe(false);
    expect(isPortReserved(reservations, 'd1', 'power', 5)).toBe(false);
    expect(isPortReserved(reservations, 'd2', 'ethernet', 5)).toBe(false);
  });
});

describe('findReservation', () => {
  it('finds matching reservation', () => {
    const reservations: PortReservation[] = [
      makeReservation({ id: 'r1', deviceId: 'd1', portType: 'ethernet', portIndex: 0 }),
    ];
    const found = findReservation(reservations, 'd1', 'ethernet', 0);
    expect(found?.id).toBe('r1');
  });

  it('returns undefined when no match', () => {
    const reservations: PortReservation[] = [
      makeReservation({ id: 'r1', deviceId: 'd1', portType: 'ethernet', portIndex: 0 }),
    ];
    const found = findReservation(reservations, 'd1', 'ethernet', 1);
    expect(found).toBeUndefined();
  });
});

describe('summarizePortReservations', () => {
  it('returns zeros for empty list', () => {
    const summary = summarizePortReservations([]);
    expect(summary.totalCount).toBe(0);
    expect(summary.expiredCount).toBe(0);
  });

  it('counts by device and port type', () => {
    const reservations: PortReservation[] = [
      makeReservation({ deviceId: 'd1', portType: 'ethernet' }),
      makeReservation({ deviceId: 'd1', portType: 'power' }),
      makeReservation({ deviceId: 'd2', portType: 'ethernet' }),
    ];
    const summary = summarizePortReservations(reservations);
    expect(summary.totalCount).toBe(3);
    expect(summary.byDevice['d1']).toBe(2);
    expect(summary.byDevice['d2']).toBe(1);
    expect(summary.byPortType['ethernet']).toBe(2);
    expect(summary.byPortType['power']).toBe(1);
  });

  it('counts expired reservations', () => {
    const pastDate = '2020-01-01';
    const reservations: PortReservation[] = [
      makeReservation({ expiryDate: pastDate }),
      makeReservation(),
    ];
    const summary = summarizePortReservations(reservations);
    expect(summary.expiredCount).toBe(1);
  });
});

describe('validatePortReservations', () => {
  it('returns empty for valid reservations with no cables', () => {
    const devices = [makeDevice({ id: 'd1' })];
    const reservations = [makeReservation({ deviceId: 'd1' })];
    const issues = validatePortReservations(reservations, devices, []);
    expect(issues).toHaveLength(0);
  });

  it('flags missing device', () => {
    const reservations = [makeReservation({ deviceId: 'missing', purpose: 'Test' })];
    const issues = validatePortReservations(reservations, [], []);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].title).toContain('missing device');
  });

  it('flags cable conflict on reserved port', () => {
    const devices = [makeDevice({ id: 'd1', name: 'Switch' })];
    const reservations = [makeReservation({ deviceId: 'd1', portType: 'ethernet', portIndex: 0 })];
    const cables = [makeCable({ fromDeviceId: 'd1', fromPort: { type: 'ethernet', index: 0 } })];
    const issues = validatePortReservations(reservations, devices, cables);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].title).toContain('Reserved port is already used');
  });

  it('flags expired reservation', () => {
    const devices = [makeDevice({ id: 'd1', name: 'Switch' })];
    const reservations = [makeReservation({ deviceId: 'd1', expiryDate: '2020-01-01' })];
    const issues = validatePortReservations(reservations, devices, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('info');
    expect(issues[0].title).toContain('expired');
  });
});

describe('exportPortReservationsMarkdown', () => {
  it('includes header and table', () => {
    const devices = [makeDevice({ id: 'd1', name: 'Switch' })];
    const reservations = [makeReservation({ deviceId: 'd1', purpose: 'Uplink' })];
    const md = exportPortReservationsMarkdown(reservations, devices);
    expect(md).toContain('# Port Reservations');
    expect(md).toContain('| Device | Port | Purpose |');
    expect(md).toContain('Switch');
    expect(md).toContain('Uplink');
  });
});

describe('exportPortReservationsCsv', () => {
  it('produces header row', () => {
    const devices = [makeDevice({ id: 'd1', name: 'Switch' })];
    const csv = exportPortReservationsCsv([], devices);
    expect(csv).toContain('ID,Device,Port Type,Port Index,Purpose,Expected Device,Owner,Expiry,Notes');
  });

  it('includes reservation data', () => {
    const devices = [makeDevice({ id: 'd1', name: 'Switch' })];
    const reservations = [makeReservation({ id: 'pr-1', deviceId: 'd1', purpose: 'Test' })];
    const csv = exportPortReservationsCsv(reservations, devices);
    expect(csv).toContain('pr-1');
    expect(csv).toContain('Switch');
    expect(csv).toContain('Test');
  });
});

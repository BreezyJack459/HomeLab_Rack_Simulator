import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout, RackReservation } from '../types/rack';
import { validateRackLayout } from './validation';
import { deviceOverlapsReservations, normalizeReservation, reservationOverlapsDevice } from './reservations';

const baseLayout: RackLayout = {
  id: 'layout-reservations',
  name: 'Reservations',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  devices: [],
  cables: [],
  reservations: [],
  updatedAt: new Date().toISOString()
};

function makeDevice(partial: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    category: 'server',
    name: 'Server',
    mountSide: 'front',
    positionU: 4,
    sizeU: 2,
    depthMm: 450,
    widthType: '19in',
    weightKg: 8,
    powerW: 120,
    heatLevel: 3,
    ports: {},
    color: '#334155',
    ...partial
  } as PlacedDevice;
}

function makeReservation(partial: Partial<RackReservation> = {}): RackReservation {
  return {
    id: 'res-1',
    name: 'Future NAS',
    positionU: 4,
    sizeU: 2,
    mountSide: 'front',
    widthType: '19in',
    purpose: 'future-device',
    ...partial
  };
}

describe('rack reservations', () => {
  it('normalizes reservations to rack bounds', () => {
    const reservation = normalizeReservation(baseLayout, {
      id: 'res-1',
      name: '',
      positionU: 99,
      sizeU: 99,
      mountSide: 'front',
      widthType: '19in',
      purpose: 'future-device'
    });

    expect(reservation.name).toBe('Reserved space');
    expect(reservation.positionU).toBe(1);
    expect(reservation.sizeU).toBe(12);
  });

  it('detects reservation and device overlap on the same side', () => {
    expect(reservationOverlapsDevice(baseLayout, makeReservation(), makeDevice())).toBe(true);
  });

  it('ignores opposite-side and zero-U device overlaps', () => {
    expect(reservationOverlapsDevice(baseLayout, makeReservation(), makeDevice({ mountSide: 'rear' }))).toBe(false);
    expect(reservationOverlapsDevice(baseLayout, makeReservation(), makeDevice({ sizeU: 0 }))).toBe(false);
  });

  it('finds the first reservation blocking a device', () => {
    const layout = {
      ...baseLayout,
      reservations: [makeReservation({ id: 'res-clear', positionU: 9 }), makeReservation()]
    };

    expect(deviceOverlapsReservations(layout, makeDevice())?.id).toBe('res-1');
  });

  it('adds validation issues when imported layouts already occupy reserved space', () => {
    const layout = {
      ...baseLayout,
      devices: [makeDevice()],
      reservations: [makeReservation()]
    };

    const issues = validateRackLayout(layout);
    expect(issues.some((issue) => issue.id === 'reservation-overlap-res-1-dev-1')).toBe(true);
  });
});

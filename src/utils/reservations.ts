import type { PlacedDevice, RackLayout, RackReservation } from '../types/rack';
import { clampDevicePosition, clampDeviceX, getDeviceMountSide, getDeviceXRange, isZeroU, rangesOverlap } from './rackMath';

type ReservationDraft = Omit<RackReservation, 'id'> | RackReservation;

export function normalizeReservation(layout: RackLayout, reservation: ReservationDraft): RackReservation {
  const sizeU = Math.max(1, Math.min(layout.heightU, Number(reservation.sizeU) || 1));
  const widthType = reservation.widthType ?? layout.rackType;
  const normalized = {
    ...reservation,
    name: reservation.name.trim() || 'Reserved space',
    positionU: clampDevicePosition(layout, sizeU, Number(reservation.positionU) || 1),
    sizeU,
    mountSide: reservation.mountSide ?? layout.viewSide,
    widthType,
    purpose: reservation.purpose ?? 'future-device'
  };

  return {
    ...normalized,
    xMm: clampDeviceX(
      layout,
      {
        widthType: normalized.widthType,
        customWidthMm: normalized.customWidthMm,
        sizeU: normalized.sizeU
      },
      normalized.xMm ?? 0
    )
  } as RackReservation;
}

export function reservationWithinRack(layout: RackLayout, reservation: RackReservation): boolean {
  return reservation.positionU >= 1 && reservation.positionU + reservation.sizeU - 1 <= layout.heightU;
}

export function getReservationXRange(layout: RackLayout, reservation: RackReservation) {
  return getDeviceXRange(layout, {
    sizeU: reservation.sizeU,
    widthType: reservation.widthType,
    customWidthMm: reservation.customWidthMm,
    xMm: reservation.xMm
  });
}

export function reservationOverlapsDevice(
  layout: RackLayout,
  reservation: RackReservation,
  device: PlacedDevice
): boolean {
  if (isZeroU(device)) return false;
  if (reservation.mountSide !== getDeviceMountSide(device)) return false;
  if (!rangesOverlap(reservation.positionU, reservation.sizeU, device.positionU, device.sizeU)) return false;

  const reservationX = getReservationXRange(layout, reservation);
  const deviceX = getDeviceXRange(layout, device);
  return rangesOverlap(reservationX.x, reservationX.width, deviceX.x, deviceX.width);
}

export function deviceOverlapsReservations(
  layout: RackLayout,
  device: PlacedDevice,
  reservations: RackReservation[] = layout.reservations ?? []
): RackReservation | null {
  return reservations.find((reservation) => reservationOverlapsDevice(layout, reservation, device)) ?? null;
}

import type { CableRoute } from '../types/rack';

/** Resolve the socket on this endpoint; outletIndex is legacy, cable-wide data. */
export const powerOutletIndex = (cable: CableRoute, deviceId: string): number | undefined => {
  if (cable.type !== 'power') return undefined;
  const port = cable.fromDeviceId === deviceId ? cable.fromPort
    : cable.toDeviceId === deviceId ? cable.toPort : undefined;
  if (cable.fromDeviceId !== deviceId && cable.toDeviceId !== deviceId) return undefined;
  return port?.type === 'power' ? port.index : cable.outletIndex;
};

export const hasPowerOutletConflict = (cable: CableRoute, deviceId: string): boolean =>
  cable.outletIndex !== undefined && powerOutletIndex(cable, deviceId) !== undefined &&
  powerOutletIndex(cable, deviceId) !== cable.outletIndex;

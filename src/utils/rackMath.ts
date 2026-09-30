import type { CableType, PlacedDevice, RackLayout, RackType, SpatialZone, ViewSide } from '../types/rack';

export const RACK_HEIGHT_OPTIONS = Array.from({ length: 44 }, (_, index) => index + 2);

export const RACK_SPECS: Record<
  RackType,
  {
    label: string;
    usableWidthMm: number;
    outerWidthMm: number;
    defaultDepthMm: number;
    visualWidthPx: number;
  }
> = {
  '10in': {
    label: '10-inch',
    usableWidthMm: 254,
    outerWidthMm: 300,
    defaultDepthMm: 300,
    visualWidthPx: 336
  },
  '19in': {
    label: '19-inch',
    usableWidthMm: 482.6,
    outerWidthMm: 560,
    defaultDepthMm: 600,
    visualWidthPx: 560
  }
};

export function defaultWeightLimit(rackType: RackType, heightU: number) {
  const base = rackType === '10in' ? 7 : 18;
  const cap = rackType === '10in' ? 180 : 900;
  return Math.min(cap, Math.round(base * heightU + (rackType === '19in' ? 20 : 5)));
}

export function getDeviceWidthMm(device: Pick<PlacedDevice, 'widthType' | 'customWidthMm'>) {
  if (device.widthType === '10in') return RACK_SPECS['10in'].usableWidthMm;
  if (device.widthType === '19in') return RACK_SPECS['19in'].usableWidthMm;
  if (device.widthType === 'custom') return device.customWidthMm ?? RACK_SPECS['10in'].usableWidthMm;
  return device.customWidthMm ?? RACK_SPECS['10in'].usableWidthMm * 0.72;
}

export function getDeviceMountSide(device: Pick<PlacedDevice, 'mountSide'>): ViewSide {
  return device.mountSide ?? 'front';
}

export function isZeroU(device: Pick<PlacedDevice, 'sizeU'>): boolean {
  return device.sizeU === 0;
}

type SpatialDeviceInput = Pick<PlacedDevice, 'sizeU'> &
  Partial<Pick<PlacedDevice, 'mountSide' | 'spatialZone' | 'xMm' | 'mountType' | 'mountSide0U'>>;

/** Derive the spatial zone for a device.
 *  - 0U devices → determined by mountType + mountSide0U (not inferred from xMm)
 *  - Regular devices → front or rear based on mountSide
 */
export function getDeviceSpatialZone(device: SpatialDeviceInput): SpatialZone {
  if (device.spatialZone) return device.spatialZone;
  if (isZeroU(device)) {
    const side = device.mountSide0U ?? ((device.xMm ?? 0) < 0 ? 'left' : 'right');
    if (device.mountType === 'side-rail') {
      return side === 'left' ? 'side-left' : 'side-right';
    }
    // Default to rear-rail for legacy 0U devices without mountType
    return side === 'left' ? 'rear-left' : 'rear-right';
  }
  return (device.mountSide ?? 'front') === 'rear' ? 'rear' : 'front';
}

/** Is this device in a side zone (side-left or side-right)? */
export function isSideZone(device: SpatialDeviceInput): boolean {
  const zone = getDeviceSpatialZone(device);
  return zone === 'side-left' || zone === 'side-right';
}

/** Is this device in a rear zone (rear-left or rear-right)? */
export function isRearZone(device: SpatialDeviceInput): boolean {
  const zone = getDeviceSpatialZone(device);
  return zone === 'rear-left' || zone === 'rear-right';
}

export function getZeroUEarSide(device: SpatialDeviceInput): 'left' | 'right' {
  const zone = getDeviceSpatialZone(device);
  return zone.includes('left') ? 'left' : 'right';
}

export function clampDeviceX(
  layout: Pick<RackLayout, 'rackType'>,
  device: Pick<PlacedDevice, 'widthType' | 'customWidthMm' | 'sizeU' | 'mountType' | 'mountSide0U'>,
  xMm: number
) {
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const width = getDeviceWidthMm(device);
  // Zero-U devices live in locked rail zones, independent of rack U-space.
  if (isZeroU(device)) {
    return getZeroUEarSide(device) === 'right' ? usableWidth : -width;
  }
  const clampedWidth = Math.min(width, usableWidth);
  return Math.max(0, Math.min(xMm, usableWidth - clampedWidth));
}

export function getDeviceXRange(
  layout: Pick<RackLayout, 'rackType'>,
  device: Pick<PlacedDevice, 'widthType' | 'customWidthMm' | 'xMm' | 'sizeU' | 'mountType' | 'mountSide0U'>
) {
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const width = getDeviceWidthMm(device);
  // Zero-U devices use separate locked rail zones; xMm is an anchor only.
  if (isZeroU(device)) {
    const x = getZeroUEarSide(device) === 'right' ? usableWidth : -width;
    return { x, width };
  }
  const centeredX = (usableWidth - Math.min(width, usableWidth)) / 2;
  const x = clampDeviceX(layout, device, device.xMm ?? centeredX);
  return { x, width };
}

export function getDefaultDeviceX(
  layout: Pick<RackLayout, 'rackType'>,
  device: Pick<PlacedDevice, 'widthType' | 'customWidthMm' | 'sizeU' | 'mountType' | 'mountSide0U'>
) {
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const width = getDeviceWidthMm(device);
  if (isZeroU(device)) {
    return getZeroUEarSide(device) === 'right' ? usableWidth : -width;
  }
  return (usableWidth - Math.min(width, usableWidth)) / 2;
}

export function rangesOverlap(aStart: number, aSize: number, bStart: number, bSize: number) {
  const aEnd = aStart + aSize;
  const bEnd = bStart + bSize;
  return aStart < bEnd && bStart < aEnd;
}

export const U_HEIGHT_MM = 44.45;
type ShelfDevice = Pick<PlacedDevice, 'id' | 'positionU' | 'sizeU' | 'widthType' | 'customWidthMm' | 'xMm' | 'mountSide'> & Partial<PlacedDevice>;
export const isTrayShelf = (device: Partial<PlacedDevice>) => device.category === 'shelf' && device.shelfStyle === 'tray';
export const shelfThickness = (device: Partial<PlacedDevice>) => Math.max(1, device.shelfThicknessMm ?? 2);
export const shelfDeckHeight = (device: Partial<PlacedDevice>) => Math.max(0, device.shelfDeckOffsetMm ?? 0) + shelfThickness(device);
export const deviceBodyHeightMm = (device: ShelfDevice) => Math.max(1, device.physicalHeightMm ?? device.sizeU * U_HEIGHT_MM - 4.445);
export const canShareShelf = (layout: Pick<RackLayout, 'rackType'>, shelf: ShelfDevice, device: ShelfDevice) => {
  if (!isTrayShelf(shelf) || device.category === 'shelf' || device.sizeU === 0 ||
    !['shelf', 'custom'].includes(device.widthType) || device.mountingSupport === 'printed-mount' ||
    getDeviceMountSide(shelf) !== getDeviceMountSide(device) || shelf.positionU !== device.positionU) return false;
  const base = getDeviceXRange(layout, shelf);
  const body = getDeviceXRange(layout, device);
  // Leave space for the tray's side walls; only fully supported equipment shares U.
  return body.x >= base.x + 3 && body.x + body.width <= base.x + base.width - 3 &&
    (device.depthMm ?? Infinity) <= (shelf.depthMm ?? 0) &&
    shelfDeckHeight(shelf) + deviceBodyHeightMm(device) + Math.max(0, device.clearanceAboveMm ?? 0) <= device.sizeU * U_HEIGHT_MM;
};
export const getSupportingTray = (layout: Pick<RackLayout, 'rackType'> & Partial<Pick<RackLayout, 'devices'>>, device: ShelfDevice) =>
  layout.devices?.find(shelf => shelf.id !== device.id && canShareShelf(layout, shelf, device));

export function clampDevicePosition(layout: RackLayout, sizeU: number, positionU: number) {
  if (sizeU === 0) return Math.max(1, Math.min(positionU, layout.heightU));
  return Math.max(1, Math.min(positionU, layout.heightU - sizeU + 1));
}

/** Legacy 0U layouts had no length; retain their approximate 88% height until edited. */
export const zeroUHeightMm = (layout: Pick<RackLayout, 'heightU'>, device: Partial<PlacedDevice>) =>
  device.physicalHeightMm ?? layout.heightU * U_HEIGHT_MM * 0.88;
export const zeroUBottomMm = (device: Pick<PlacedDevice, 'positionU'>) => (device.positionU - 1) * U_HEIGHT_MM;
export const zeroUDepthMm = (device: Partial<PlacedDevice>) => device.physicalHeightMm === undefined ? 55 : device.depthMm ?? 55;

export function isDeviceWithinRack(layout: RackLayout, device: Pick<PlacedDevice, 'positionU' | 'sizeU'> & Partial<PlacedDevice>) {
  if (isZeroU(device)) {
    const height = zeroUHeightMm(layout, device);
    return Number.isFinite(height) && height > 0 && Number.isFinite(device.positionU) &&
      zeroUBottomMm(device) >= 0 && zeroUBottomMm(device) + height <= layout.heightU * U_HEIGHT_MM + 0.001;
  }
  return device.positionU >= 1 && device.positionU + device.sizeU - 1 <= layout.heightU;
}

export function hasOverlap(
  layout: RackLayout,
  devices: PlacedDevice[],
  candidate: ShelfDevice
) {
  // 0U uses independent mounting lanes, but two bodies in the same lane cannot intersect.
  if (isZeroU(candidate)) return devices.some(device => device.id !== candidate.id && isZeroU(device) &&
    getDeviceSpatialZone(device) === getDeviceSpatialZone(candidate) &&
    rangesOverlap(zeroUBottomMm(candidate), zeroUHeightMm(layout, candidate), zeroUBottomMm(device), zeroUHeightMm(layout, device)));
  const candidateX = getDeviceXRange(layout, candidate);
  const candidateSide = getDeviceMountSide(candidate);
  return devices.some((device) => {
    if (device.id === candidate.id) return false;
    if (isZeroU(device)) return false;
    if (getDeviceMountSide(device) !== candidateSide) return false;
    if (canShareShelf(layout, device, candidate) || canShareShelf(layout, candidate, device)) return false;
    const deviceX = getDeviceXRange(layout, device);
    return (
      rangesOverlap(device.positionU, device.sizeU, candidate.positionU, candidate.sizeU) &&
      rangesOverlap(deviceX.x, deviceX.width, candidateX.x, candidateX.width)
    );
  });
}

export function occupiedUnits(devices: PlacedDevice[], heightU: number) {
  const units = new Set<number>();
  devices.forEach((device) => {
    if (isZeroU(device)) return;
    for (let unit = device.positionU; unit < device.positionU + device.sizeU; unit += 1) {
      if (unit >= 1 && unit <= heightU) units.add(unit);
    }
  });
  return units;
}

export function findFirstFreeSlot(
  layout: RackLayout,
  device: Pick<PlacedDevice, 'id' | 'positionU' | 'sizeU' | 'widthType' | 'customWidthMm' | 'xMm' | 'mountSide'> & Partial<PlacedDevice>
) {
  // Zero-U devices don't need a free U slot; place at side
  if (isZeroU(device)) {
    const xMm = device.xMm ?? getDefaultDeviceX(layout, device);
    const candidate = { ...device, positionU: 1 };
    return isDeviceWithinRack(layout, candidate) && !hasOverlap(layout, layout.devices, candidate)
      ? { positionU: 1, xMm: clampDeviceX(layout, device, xMm) } : null;
  }
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const width = Math.min(getDeviceWidthMm(device), usableWidth);
  for (let unit = 1; unit <= layout.heightU - device.sizeU + 1; unit += 1) {
    const blockers = layout.devices
      .filter(
        (placed) =>
          !isZeroU(placed) &&
          getDeviceMountSide(placed) === getDeviceMountSide(device) &&
          rangesOverlap(placed.positionU, placed.sizeU, unit, device.sizeU)
      )
      .map((placed) => getDeviceXRange(layout, placed))
      .sort((a, b) => a.x - b.x);
    const candidates = [0, (usableWidth - width) / 2];
    blockers.forEach((blocker) => candidates.push(blocker.x + blocker.width + 4));
    for (const xMm of candidates) {
      const candidate = { ...device, positionU: unit, xMm: clampDeviceX(layout, device, xMm) };
      if (!hasOverlap(layout, layout.devices, candidate)) return { positionU: unit, xMm: candidate.xMm };
    }
  }
  return null;
}

export function unitsForDevice(device: Pick<PlacedDevice, 'positionU' | 'sizeU'>) {
  if (isZeroU(device)) return [];
  return Array.from({ length: device.sizeU }, (_, index) => device.positionU + index);
}

const STANDARD_U_MM = 44.45;

export function getDeviceFaceSizeMm(
  device: Pick<PlacedDevice, 'widthType' | 'customWidthMm' | 'sizeU'>
): { width: number; height: number } {
  const width = getDeviceWidthMm(device);
  const height = Math.max(device.sizeU, 1) * STANDARD_U_MM;
  return { width, height };
}

export function formatCableLength(mm: number): string {
  if (mm < 1000) return `${mm}mm`;
  const m = mm / 1000;
  return m % 1 === 0 ? `${m}m` : `${m.toFixed(1)}m`;
}

export interface DepthSummary {
  usableDepthMm: number;
  deepestMm: number;
  frontDoorClearanceMm: number;
  rearDoorClearanceMm: number;
  rearCableClearanceMm: number;
  maxRequiredRearBendMm: number;
}

export type DepthCompatibilityReason = 'too-deep' | 'rail-min' | 'rail-max' | 'rear-bend';

export type DepthCompatibilityIssue = {
  device: PlacedDevice;
  reasons: DepthCompatibilityReason[];
  requiredRearBendMm: number;
};

const CABLE_BEND_ALLOWANCE_MM: Record<CableType, number> = {
  ethernet: 35,
  patch: 35,
  structured: 35,
  usb: 35,
  hdmi: 35,
  atx: 45,
  coax: 45,
  fiber: 55,
  power: 60
};

function connectedCableBendAllowance(layout: RackLayout, deviceId: string): number {
  return (layout.cables ?? []).reduce((max, cable) => {
    if (cable.fromDeviceId !== deviceId && cable.toDeviceId !== deviceId) return max;
    return Math.max(max, CABLE_BEND_ALLOWANCE_MM[cable.type] ?? 35);
  }, 0);
}

function portBendAllowance(device: PlacedDevice): number {
  const ports = device.ports;
  if (!ports) return 0;
  if ((ports.power ?? 0) > 0) return CABLE_BEND_ALLOWANCE_MM.power;
  if ((ports.fiber ?? 0) > 0) return CABLE_BEND_ALLOWANCE_MM.fiber;
  if ((ports.atx ?? 0) > 0 || (ports.coax ?? 0) > 0) return CABLE_BEND_ALLOWANCE_MM.coax;
  if ((ports.ethernet ?? 0) > 0 || (ports.usb ?? 0) > 0 || (ports.hdmi ?? 0) > 0) return CABLE_BEND_ALLOWANCE_MM.ethernet;
  return 0;
}

export function getRequiredRearBendMm(layout: RackLayout, device: PlacedDevice): number {
  if (isZeroU(device) || device.category === 'blank' || device.category === 'cable-management') return 0;
  return Math.max(connectedCableBendAllowance(layout, device.id), portBendAllowance(device));
}

export function getDepthSummary(layout: RackLayout): DepthSummary {
  const devices = layout.devices.filter((d) => d.sizeU > 0);
  const frontDoorClearanceMm = layout.frontDoorClearanceMm ?? 0;
  const rearDoorClearanceMm = layout.rearDoorClearanceMm ?? 0;
  const rearCableClearanceMm = layout.rearClearanceMm ?? 0;
  const usableDepthMm = Math.max(0, layout.rackDepthMm - frontDoorClearanceMm - rearDoorClearanceMm - rearCableClearanceMm);
  const deepestMm = devices.reduce((max, d) => Math.max(max, d.depthMm + (d.mountEnvelopeMm ?? 0)), 0);
  const maxRequiredRearBendMm = devices.reduce((max, device) => Math.max(max, getRequiredRearBendMm(layout, device)), 0);
  return { usableDepthMm, deepestMm, frontDoorClearanceMm, rearDoorClearanceMm, rearCableClearanceMm, maxRequiredRearBendMm };
}

export function getDepthCompatibilityIssues(layout: RackLayout): DepthCompatibilityIssue[] {
  const summary = getDepthSummary(layout);

  return layout.devices
    .filter((device) => !isZeroU(device))
    .map((device) => {
      const requiredRearBendMm = getRequiredRearBendMm(layout, device);
      const effectiveDepth = device.depthMm + (device.mountEnvelopeMm ?? 0);
      const reasons: DepthCompatibilityReason[] = [];
      if (effectiveDepth > summary.usableDepthMm) reasons.push('too-deep');
      const rails = device.installationRequirements;
      const spacing = layout.mountingPostSpacingMm;
      if (rails?.support === 'rails' && spacing !== undefined) {
        if (rails.railMinMm !== undefined && spacing < rails.railMinMm) reasons.push('rail-min');
        if (rails.railMaxMm !== undefined && spacing > rails.railMaxMm) reasons.push('rail-max');
      }
      if (requiredRearBendMm > summary.rearCableClearanceMm) reasons.push('rear-bend');
      return { device, reasons, requiredRearBendMm };
    })
    .filter((issue) => issue.reasons.length > 0);
}

export function getCenterOfGravityU(layout: RackLayout): { cgU: number; totalWeightKg: number } | null {
  const rackMounted = layout.devices.filter((d) => d.sizeU > 0);
  const totalWeightKg = rackMounted.reduce((sum, d) => sum + d.weightKg, 0);
  if (totalWeightKg === 0) return null;
  const totalMoment = rackMounted.reduce((sum, d) => {
    const centerU = d.positionU + (d.sizeU - 1) / 2;
    return sum + d.weightKg * centerU;
  }, 0);
  return { cgU: totalMoment / totalWeightKg, totalWeightKg };
}

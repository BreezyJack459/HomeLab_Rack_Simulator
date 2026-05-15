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

export function clampDevicePosition(layout: RackLayout, sizeU: number, positionU: number) {
  if (sizeU === 0) return Math.max(1, Math.min(positionU, layout.heightU));
  return Math.max(1, Math.min(positionU, layout.heightU - sizeU + 1));
}

export function isDeviceWithinRack(layout: RackLayout, device: Pick<PlacedDevice, 'positionU' | 'sizeU'>) {
  if (isZeroU(device)) return device.positionU >= 1 && device.positionU <= layout.heightU;
  return device.positionU >= 1 && device.positionU + device.sizeU - 1 <= layout.heightU;
}

export function hasOverlap(
  layout: RackLayout,
  devices: PlacedDevice[],
  candidate: Pick<PlacedDevice, 'id' | 'positionU' | 'sizeU' | 'widthType' | 'customWidthMm' | 'xMm' | 'mountSide'>
) {
  // Zero-U devices never overlap with anything
  if (isZeroU(candidate)) return false;
  const candidateX = getDeviceXRange(layout, candidate);
  const candidateSide = getDeviceMountSide(candidate);
  return devices.some((device) => {
    if (device.id === candidate.id) return false;
    if (isZeroU(device)) return false;
    if (getDeviceMountSide(device) !== candidateSide) return false;
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
  device: Pick<PlacedDevice, 'id' | 'positionU' | 'sizeU' | 'widthType' | 'customWidthMm' | 'xMm' | 'mountSide'>
) {
  // Zero-U devices don't need a free U slot; place at side
  if (isZeroU(device)) {
    const xMm = device.xMm ?? getDefaultDeviceX(layout, device);
    return { positionU: 1, xMm: clampDeviceX(layout, device, xMm) };
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

export function findFirstFreePosition(layout: RackLayout, sizeU: number) {
  const device = {
    id: '__candidate__',
    positionU: 1,
    sizeU,
    widthType: layout.rackType,
    mountSide: layout.viewSide,
    xMm: 0
  } satisfies Pick<PlacedDevice, 'id' | 'positionU' | 'sizeU' | 'widthType' | 'mountSide' | 'xMm'>;
  return findFirstFreeSlot(layout, device)?.positionU ?? null;
}

export function unitsForDevice(device: Pick<PlacedDevice, 'positionU' | 'sizeU'>) {
  if (isZeroU(device)) return [];
  return Array.from({ length: device.sizeU }, (_, index) => device.positionU + index);
}

const STANDARD_U_MM = 44.45;
const CABLE_SLACK_MM = 300;
const STANDARD_LENGTHS_MM = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000];

export function standardCableLength(estimatedMm: number): number {
  for (const length of STANDARD_LENGTHS_MM) {
    if (estimatedMm <= length) return length;
  }
  return STANDARD_LENGTHS_MM[STANDARD_LENGTHS_MM.length - 1];
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
  const deepestMm = devices.reduce((max, d) => Math.max(max, d.depthMm), 0);
  const maxRequiredRearBendMm = devices.reduce((max, device) => Math.max(max, getRequiredRearBendMm(layout, device)), 0);
  return { usableDepthMm, deepestMm, frontDoorClearanceMm, rearDoorClearanceMm, rearCableClearanceMm, maxRequiredRearBendMm };
}

export function getDepthCompatibilityIssues(layout: RackLayout): DepthCompatibilityIssue[] {
  const summary = getDepthSummary(layout);
  const railMinDepthMm = layout.railMinDepthMm ?? 0;
  const railMaxDepthMm = layout.railMaxDepthMm ?? layout.rackDepthMm;

  return layout.devices
    .filter((device) => !isZeroU(device))
    .map((device) => {
      const requiredRearBendMm = getRequiredRearBendMm(layout, device);
      const reasons: DepthCompatibilityReason[] = [];
      if (device.depthMm > summary.usableDepthMm) reasons.push('too-deep');
      if (device.depthMm < railMinDepthMm) reasons.push('rail-min');
      if (device.depthMm > railMaxDepthMm) reasons.push('rail-max');
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

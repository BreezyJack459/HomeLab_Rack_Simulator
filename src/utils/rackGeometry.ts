import type { PlacedDevice, PortRef, RackLayout } from '../types/rack';
import { buildPortLayout, resolvePortFace, type PortGroup, type PortSlot } from './portLayout';
import { getDeviceMountSide, getDeviceXRange, getDeviceWidthMm, getZeroUEarSide, RACK_SPECS, zeroUHeightMm, zeroUBottomMm, zeroUDepthMm } from './rackMath';
import { isTrayShelf, shelfThickness, shelfDeckHeight, getSupportingTray, deviceBodyHeightMm, U_HEIGHT_MM } from './rackMath';

export const RACK_3D_U_HEIGHT = 0.18;
export const RACK_3D_POST_SIZE = 0.045;
// Fallback device depth when a template omits depthMm; avoids NaN geometry.
export const DEFAULT_DEVICE_DEPTH_MM = 200;
export const ZERO_U_SIDE_GAP = 0.16;
export const ZERO_U_SIDE_WIDTH = 0.16;
export const ZERO_U_SIDE_DEPTH = 0.78;
export const ZERO_U_REAR_GAP = 0.08;
export const ZERO_U_REAR_WIDTH = 0.085;
export const ZERO_U_REAR_DEPTH = 0.04;
export const ZERO_U_REAR_HEIGHT_RATIO = 0.88;
export const ZERO_U_REAR_SIDE_OFFSET = 0.08;

export type RackWorldDimensions = {
  rackWidth: number;
  rackDepth: number;
  rackHeight: number;
  bottom: number;
};

export type RackGeometryLayout = Pick<RackLayout, 'rackType' | 'rackDepthMm'> & Partial<Pick<RackLayout, 'devices'>>;

/** Tray deck and front mounting ears, relative to the thin deck's centre. */
export const getShelfBodyParts = (device: PlacedDevice, box: DeviceWorldBox) => {
  const earHeight = Math.max(box.height, device.sizeU * RACK_3D_U_HEIGHT - 0.018);
  const earWidth = box.width * 2 / Math.max(1, getDeviceWidthMm(device));
  const sign = box.isRearMounted ? -1 : 1;
  return [
    { center: { x: 0, y: 0, z: 0 }, size: { x: box.width, y: box.height, z: box.depth } },
    ...[-1, 1].map(side => ({
      center: { x: side * (box.width - earWidth) / 2, y: (earHeight - box.height) / 2, z: sign * (box.depth / 2 - 0.01) },
      size: { x: earWidth, y: earHeight, z: 0.02 },
    })),
  ];
};

export type WorldPoint = {
  x: number;
  y: number;
  z: number;
};

export type DeviceWorldBox = WorldPoint & {
  width: number;
  depth: number;
  height: number;
  isZeroU: boolean;
  isRearRail0U: boolean;
  isRearMounted: boolean;
};

/** Local solid members around a cable manager's pass-through opening. */
export const getCableManagerBodyParts = (box: DeviceWorldBox): { center: WorldPoint; size: WorldPoint }[] => {
  const lip = Math.min(0.012, box.height * 0.1);
  const ear = Math.min(0.04, box.width * 0.06);
  return [
    ...[-1, 1].map((side) => ({ center: { x: 0, y: side * (box.height - lip) / 2, z: 0 }, size: { x: box.width, y: lip, z: box.depth } })),
    ...[-1, 1].map((side) => ({ center: { x: side * (box.width - ear) / 2, y: 0, z: 0 }, size: { x: ear, y: box.height, z: box.depth } })),
  ];
};

export function getRackWorldDimensions(layout: RackLayout): RackWorldDimensions {
  const rackHeight = layout.heightU * RACK_3D_U_HEIGHT;
  const rackWidth = layout.rackType === '10in' ? 1.95 : 3.72;
  const rackDepth = Math.max(1.4, Math.min(3.3, layout.rackDepthMm / 210));
  return {
    rackWidth,
    rackDepth,
    rackHeight,
    bottom: -rackHeight / 2
  };
}

export function getDeviceWorldBox(
  layout: RackGeometryLayout,
  device: PlacedDevice,
  dimensions: RackWorldDimensions
): DeviceWorldBox {
  const { rackWidth, rackDepth, rackHeight } = dimensions;
  const isZeroU = device.sizeU === 0;
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const range = getDeviceXRange(layout, device);
  const rackDeviceWidth = rackWidth * Math.min(1, Math.max(0.08, range.width / usableWidth));
  const isRearRail0U = isZeroU && device.mountType !== 'side-rail';
  const width = isZeroU ? (getDeviceWidthMm(device) / usableWidth) * rackWidth : rackDeviceWidth;
  const depthScale = layout.rackDepthMm > 0 ? rackDepth / layout.rackDepthMm : rackDepth;
  const depth = isZeroU
    ? zeroUDepthMm(device) * depthScale
    : Math.max(0.12, (device.depthMm ?? DEFAULT_DEVICE_DEPTH_MM) * depthScale);

  let x: number;
  let z: number;

  if (isZeroU) {
    const earSide = getZeroUEarSide(device);
    if (isRearRail0U) {
      x = (earSide === 'left' ? -1 : 1) * (rackWidth / 2 + width / 2 + ZERO_U_REAR_SIDE_OFFSET);
      z = -rackDepth / 2 - depth / 2 - ZERO_U_REAR_GAP;
    } else {
      x = (earSide === 'left' ? -1 : 1) * (rackWidth / 2 + ZERO_U_SIDE_GAP + width / 2);
      z = 0;
    }
  } else {
    x = -rackWidth / 2 + ((range.x + Math.min(range.width, usableWidth) / 2) / usableWidth) * rackWidth;
    z = getDeviceMountSide(device) === 'rear'
      ? -rackDepth / 2 + depth / 2 - 0.012
      : rackDepth / 2 - depth / 2 + 0.012;
  }

  const tray = getSupportingTray(layout, device);
  const scaleY = RACK_3D_U_HEIGHT / U_HEIGHT_MM;
  const offset = isTrayShelf(device) ? Math.max(0, device.shelfDeckOffsetMm ?? 0) : tray ? shelfDeckHeight(tray) : 0;
  const height = isTrayShelf(device) ? shelfThickness(device) * scaleY : isZeroU
    ? zeroUHeightMm({ heightU: rackHeight / RACK_3D_U_HEIGHT }, device) * scaleY
    : Math.max(0.055, deviceBodyHeightMm(device) * scaleY);
  const y = isZeroU ? -rackHeight / 2 + zeroUBottomMm(device) * scaleY + height / 2 : -rackHeight / 2 + (device.positionU - 1) * RACK_3D_U_HEIGHT + offset * scaleY + height / 2;

  return {
    x,
    y,
    z,
    width,
    depth,
    height,
    isZeroU,
    isRearRail0U,
    isRearMounted: !isZeroU && getDeviceMountSide(device) === 'rear'
  };
}

export function getCablePortFace(device: PlacedDevice, portRef?: PortRef): 'front' | 'rear' {
  return resolvePortFace(device, portRef);
}

export function getPortZSign(device: PlacedDevice, portRef?: PortRef): number {
  return getCablePortFace(device, portRef) === 'front' ? 1 : -1;
}

/** Outer socket plane, shared by visible sockets and cable endpoints. */
export const PORT_FACE_OFFSET = 0.018;
export const PORT_SOCKET_DEPTH = 0.012;

export type DevicePortSlot = PortSlot & { position: WorldPoint; color: string; emissive: string; key: string };
export type DevicePortSurface = {
  face: 'front' | 'rear';
  normal: WorldPoint;
  rotationY: number;
  slots: DevicePortSlot[];
};

/** Passive panels have two sides of the same numbered jacks. 0U outlets use
 * a physical mounting plane instead of the normal front/rear category plane.
 * Keep those adaptations here; logical face resolution still uses resolvePortFace.
 */
const buildPhysicalPortLayout = (device: PlacedDevice, width: number, height: number, face: 'front' | 'rear'): PortGroup[] => {
  if (device.category !== 'patch-panel' && device.sizeU !== 0) return buildPortLayout(device, width, height, face);
  const otherFace = face === 'front' ? 'rear' : 'front';
  const portFaceOverrides = Object.fromEntries(Object.keys(device.ports ?? {}).filter((key) => key !== 'layoutColumns').map((key) => [key, face]));
  return buildPortLayout({
    ...device,
    portFaceOverrides,
    portLayouts: { ...device.portLayouts, [face]: device.portLayouts?.[face] ?? device.portLayouts?.[otherFace] },
  }, width, height, face);
};

/** Local socket positions. Renderers place these relative to the device box;
 * cable endpoints add the same box origin. Never mirror slot X on rear faces.
 */
export const getDevicePortSurfaces = (device: PlacedDevice, box: DeviceWorldBox): DevicePortSurface[] => {
  const sideFacing = box.isZeroU && (!box.isRearRail0U || device.outletFacing === 'inward');
  const sideSign = getZeroUEarSide(device) === 'left' ? 1 : -1;
  const faces: ('front' | 'rear')[] = box.isZeroU ? ['front'] : ['front', 'rear'];
  return faces.map((face) => {
    const zSign = box.isZeroU ? (device.outletFacing === 'outward' ? -1 : 1) : (face === 'front' ? 1 : -1);
    const normal = sideFacing ? { x: sideSign, y: 0, z: 0 } : { x: 0, y: 0, z: zSign };
    const width = sideFacing ? box.depth : box.isZeroU ? box.width * 0.9 : box.width;
    const groups = buildPhysicalPortLayout(device, width, box.height, face);
    return {
      face,
      normal,
      rotationY: sideFacing ? sideSign * Math.PI / 2 : zSign < 0 ? Math.PI : 0,
      slots: groups.flatMap((group) => group.slots.map((slot) => ({
        ...slot,
        key: `${group.key ?? group.type}-${slot.index}`,
        color: group.color,
        emissive: group.emissive,
        position: sideFacing
          ? { x: sideSign * (box.width / 2 + 0.02), y: slot.y, z: slot.x }
          : { x: slot.x, y: slot.y, z: zSign * (box.depth / 2 + PORT_FACE_OFFSET) },
      }))),
    };
  });
};

export function getDevicePortWorldPosition(
  layout: RackLayout,
  device: PlacedDevice,
  portRef?: PortRef,
  dimensions: RackWorldDimensions = getRackWorldDimensions(layout)
): WorldPoint {
  const box = getDeviceWorldBox(layout, device, dimensions);
  const face = box.isZeroU ? 'front' : getCablePortFace(device, portRef);
  const surface = getDevicePortSurfaces(device, box).find((item) => item.face === face);
  const slot = surface?.slots.find((item) => item.type === (portRef?.type ?? 'ethernet') && item.index === (portRef?.index ?? 0));
  if (slot) return { x: box.x + slot.position.x, y: box.y + slot.position.y, z: box.z + slot.position.z };
  return fallbackPortPosition(layout, device, portRef, dimensions, box);
}

function fallbackPortPosition(
  layout: RackLayout,
  device: PlacedDevice,
  portRef: PortRef | undefined,
  dimensions: RackWorldDimensions,
  box: DeviceWorldBox
): WorldPoint {
  const portType = portRef?.type ?? 'ethernet';
  const portIndex = portRef?.index ?? 0;
  const portCount = (device.ports as Record<string, number | undefined>)?.[portType] ?? 1;
  let columns = device.ports?.layoutColumns;
  if (columns === undefined) {
    columns = portType === 'power' ? Math.min(portCount, 4) : 1;
  }
  columns = Math.max(1, Math.min(columns ?? 1, portCount));
  const row = Math.floor(portIndex / columns);
  const col = portIndex % columns;
  const totalRows = Math.ceil(portCount / columns);
  const fallbackWidth = box.isZeroU && box.isRearRail0U ? box.width * 0.9 : box.width;
  const xMargin = fallbackWidth * 0.14;
  const xSpread = Math.max(0.01, fallbackWidth - xMargin * 2);
  const xOffset = columns <= 1 ? 0 : ((col / (columns - 1)) - 0.5) * xSpread;
  const yMargin = box.height * 0.14;
  const ySpread = Math.max(0.01, box.height - yMargin * 2);
  const yOffset = totalRows <= 1 ? 0 : ((row / (totalRows - 1)) - 0.5) * ySpread;

  if (box.isZeroU) {
    const outletFacing = device.outletFacing ?? 'forward';
    if (box.isRearRail0U && outletFacing !== 'inward') {
      return {
        x: box.x + xOffset,
        y: box.y + yOffset,
        z: box.z + (outletFacing === 'outward' ? -box.depth / 2 - 0.018 : box.depth / 2 + 0.018)
      };
    }
    const isLeft = getZeroUEarSide(device) === 'left';
    const portX = isLeft ? box.width / 2 + 0.02 : -box.width / 2 - 0.02;
    return { x: box.x + portX, y: box.y + yOffset, z: box.z + xOffset };
  }

  const sign = getPortZSign(device, portRef);
  return {
    x: box.x + xOffset,
    y: box.y + yOffset,
    z: box.z + sign * (box.depth / 2 + 0.018)
  };
}

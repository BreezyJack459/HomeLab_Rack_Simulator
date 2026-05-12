import type { PlacedDevice, PortRef, PortType, RackLayout } from '../types/rack';
import { buildPortLayout, getPortFaceMap } from './portLayout';
import { getDeviceMountSide, getDeviceXRange, getZeroUEarSide, RACK_SPECS } from './rackMath';

export const RACK_3D_U_HEIGHT = 0.18;
export const RACK_3D_POST_SIZE = 0.045;
export const ZERO_U_SIDE_GAP = 0.16;
export const ZERO_U_SIDE_WIDTH = 0.16;
export const ZERO_U_SIDE_DEPTH = 0.78;
export const ZERO_U_REAR_GAP = 0.9;
export const ZERO_U_REAR_WIDTH = 0.085;
export const ZERO_U_REAR_DEPTH = 0.04;
export const ZERO_U_REAR_HEIGHT_RATIO = 0.88;
export const ZERO_U_REAR_SIDE_OFFSET = 0.62;

export type RackWorldDimensions = {
  rackWidth: number;
  rackDepth: number;
  rackHeight: number;
  bottom: number;
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
  layout: RackLayout,
  device: PlacedDevice,
  dimensions: RackWorldDimensions = getRackWorldDimensions(layout)
): DeviceWorldBox {
  const { rackWidth, rackDepth, rackHeight } = dimensions;
  const isZeroU = device.sizeU === 0;
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const range = getDeviceXRange(layout, device);
  const rackDeviceWidth = rackWidth * Math.min(1, Math.max(0.08, range.width / usableWidth));
  const isRearRail0U = isZeroU && device.mountType !== 'side-rail';
  const width = isZeroU ? (isRearRail0U ? ZERO_U_REAR_WIDTH : ZERO_U_SIDE_WIDTH) : rackDeviceWidth;
  const depth = isZeroU
    ? (isRearRail0U ? ZERO_U_REAR_DEPTH : Math.min(rackDepth * 0.72, ZERO_U_SIDE_DEPTH))
    : Math.max(0.12, Math.min(rackDepth - 0.08, (device.depthMm / layout.rackDepthMm) * rackDepth));

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

  const height = isZeroU
    ? (isRearRail0U ? rackHeight * ZERO_U_REAR_HEIGHT_RATIO : rackHeight - 0.02)
    : Math.max(0.055, device.sizeU * RACK_3D_U_HEIGHT - 0.018);
  const y = isZeroU ? 0 : -rackHeight / 2 + (device.positionU - 1) * RACK_3D_U_HEIGHT + height / 2;

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
  if (device.category === 'patch-panel') {
    // Explicit side wins; missing side: ethernet/fiber = front, structured/patch = rear
    if (portRef?.side) return portRef.side;
    const frontTypes: PortType[] = ['ethernet', 'fiber'];
    return frontTypes.includes(portRef?.type ?? 'ethernet') ? 'front' : 'rear';
  }
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  return (faceMap[portRef?.type ?? 'ethernet'] ?? 'rear') as 'front' | 'rear';
}

export function getPortZSign(device: PlacedDevice, portRef?: PortRef): number {
  return getCablePortFace(device, portRef) === 'front' ? 1 : -1;
}

export function getDevicePortWorldPosition(
  layout: RackLayout,
  device: PlacedDevice,
  portRef?: PortRef,
  dimensions: RackWorldDimensions = getRackWorldDimensions(layout)
): WorldPoint {
  const box = getDeviceWorldBox(layout, device, dimensions);
  const portType = portRef?.type ?? 'ethernet';
  const portIndex = portRef?.index ?? 0;
  const face = box.isZeroU ? 'front' : getCablePortFace(device, portRef);
  const zeroUPortFaceWidth = box.isRearRail0U ? box.width * 0.9 : box.depth;
  const groups = buildPortLayout(device, box.isZeroU ? zeroUPortFaceWidth : box.width, box.height, face);

  for (const group of groups) {
    if (group.type !== portType) continue;
    const slot = group.slots.find((item) => item.index === portIndex);
    if (!slot) continue;

    if (box.isZeroU) {
      const outletFacing = device.outletFacing ?? 'forward';
      if (box.isRearRail0U && outletFacing !== 'inward') {
        return {
          x: box.x + slot.x,
          y: box.y + slot.y,
          z: box.z + (outletFacing === 'outward' ? -box.depth / 2 - 0.018 : box.depth / 2 + 0.018)
        };
      }
      const isLeft = getZeroUEarSide(device) === 'left';
      const portX = isLeft ? box.width / 2 + 0.02 : -box.width / 2 - 0.02;
      return {
        x: box.x + portX,
        y: box.y + slot.y,
        z: box.z + slot.x
      };
    }

    const sign = getPortZSign(device, portRef);
    return {
      x: box.x + slot.x,
      y: box.y + slot.y,
      z: box.z + sign * (box.depth / 2 + 0.018)
    };
  }

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

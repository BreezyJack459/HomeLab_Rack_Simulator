import type {
  DeviceTemplate,
  PlacedDevice,
  RackLayout,
  ViewSide,
} from '../types/rack';
import {
  findFirstFreeSlot,
  getDepthSummary,
  getDeviceWidthMm,
  hasOverlap,
  isDeviceWithinRack,
  RACK_SPECS,
  zeroUHeightMm,
  zeroUDepthMm,
  U_HEIGHT_MM,
} from './rackMath';
import { deviceOverlapsReservations } from './reservations';

type PlacementProblem = {
  code:
    | 'external'
    | 'width'
    | 'height'
    | 'depth'
    | 'bounds'
    | 'overlap'
    | 'reserved';
  message: string;
};
export type PlacementFeedback = {
  allowed: boolean;
  problem?: PlacementProblem;
  warning?: PlacementProblem;
};

// Preview data only: placement still creates or moves devices through rackStore.
export const placementDraft = (
  device: DeviceTemplate | PlacedDevice,
  side: ViewSide,
): PlacedDevice =>
  'defaultU' in device
    ? {
        ...device,
        id: `preview:${device.id}`,
        sizeU: device.defaultU,
        positionU: 1,
        mountSide: side,
      }
    : { ...device, mountSide: side };

export const getDeviceDimensionProblems = (
  layout: RackLayout,
  device: DeviceTemplate | PlacedDevice,
): PlacementProblem[] => {
  const problems: PlacementProblem[] = [];
  const sizeU = 'defaultU' in device ? device.defaultU : device.sizeU;
  if (device.rackMountable === false)
    problems.push({
      code: 'external',
      message: 'External device — keep it in My devices.',
    });
  const width = getDeviceWidthMm(device);
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  if (sizeU > 0 && width > usableWidth)
    problems.push({
      code: 'width',
      message: `Too wide: ${width} mm device / ${usableWidth} mm rack.`,
    });
  if (sizeU === 0 && zeroUHeightMm(layout, device) > layout.heightU * U_HEIGHT_MM)
    problems.push({ code: 'height', message: `PDU length exceeds the ${Math.round(layout.heightU * U_HEIGHT_MM)} mm mounting height.` });
  if (sizeU > layout.heightU)
    problems.push({
      code: 'height',
      message: `Too tall: ${sizeU}U device / ${layout.heightU}U rack.`,
    });
  const depth = (sizeU === 0 ? zeroUDepthMm(device) : device.depthMm) + (device.mountEnvelopeMm ?? 0);
  const usableDepth = getDepthSummary(layout).usableDepthMm;
  if (depth > usableDepth)
    problems.push({
      code: 'depth',
      message: `Depth clearance: needs ${depth} mm / ${usableDepth} mm available.`,
    });
  return problems;
};

export const getPlacementFeedback = (
  layout: RackLayout,
  device: PlacedDevice,
): PlacementFeedback => {
  const dimensions = getDeviceDimensionProblems(layout, device);
  const problem = dimensions.find((p) => p.code !== 'depth');
  if (problem) return { allowed: false, problem };
  if (!isDeviceWithinRack(layout, device))
    return {
      allowed: false,
      problem: {
        code: 'bounds',
        message: 'Outside the rack height. Choose a position inside the rack.',
      },
    };
  if (hasOverlap(layout, layout.devices, device)) {
    const blocker = layout.devices.find((d) => hasOverlap(layout, [d], device));
    return {
      allowed: false,
      problem: {
        code: 'overlap',
        message: `Space occupied by ${blocker?.label || blocker?.name || 'another device'}.`,
      },
    };
  }
  const reservation = deviceOverlapsReservations(layout, device);
  if (reservation)
    return {
      allowed: false,
      problem: {
        code: 'reserved',
        message: `Space reserved for “${reservation.name}”. Choose another position.`,
      },
    };
  return { allowed: true, warning: dimensions.find((p) => p.code === 'depth') };
};

export const findAvailableDeviceSlot = (
  layout: RackLayout,
  device: PlacedDevice,
) => {
  if (
    getDeviceDimensionProblems(layout, device).some((p) => p.code !== 'depth')
  )
    return null;
  // Reuse the rack's existing side-by-side slot search, treating reservations
  // as occupied footprints. Depth remains an audit warning during planning.
  const reservations = (layout.reservations ?? []).map((r) => ({
    ...device,
    ...r,
    id: `reservation:${r.id}`,
    widthType: r.widthType ?? layout.rackType,
    sizeU: r.sizeU,
    mountSide: r.mountSide,
    customWidthMm: r.customWidthMm,
    xMm: r.xMm,
    category: 'custom' as const,
  }));
  return findFirstFreeSlot(
    { ...layout, devices: [...layout.devices, ...reservations] },
    device,
  );
};

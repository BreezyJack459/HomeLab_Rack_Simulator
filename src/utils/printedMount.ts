import type { PlacedDevice, RackLayout, ValidationIssue } from '../types/rack';
import { getDeviceWidthMm, RACK_SPECS } from './rackMath';

export type PrintedPartShape = 'l-bracket' | 'tray' | 'din-clip' | 'vertical-strip' | 'rail-pair' | 'custom';

export interface PrintedMountMeta {
  shape: PrintedPartShape;
  material?: string;
  infillPercent?: number;
  wallThicknessMm?: number;
  loadRatingKg?: number;
  printOrientation?: 'flat' | 'vertical' | 'on-side';
  sourceUrl?: string;
  clearanceMm?: number;
}

export function isPrintedMount(device: PlacedDevice): boolean {
  return device.category === 'printed-mount';
}

export function getPrintedMountMeta(device: PlacedDevice): PrintedMountMeta {
  const defaults: Record<string, PrintedMountMeta> = {
    'printed-bracket-l': { shape: 'l-bracket', loadRatingKg: 2, printOrientation: 'vertical' },
    'printed-tray-mini': { shape: 'tray', loadRatingKg: 1.5, printOrientation: 'flat' },
    'printed-tray-19in': { shape: 'tray', loadRatingKg: 3, printOrientation: 'flat' },
    'printed-din-rail-clip': { shape: 'din-clip', loadRatingKg: 0.5, printOrientation: 'vertical' },
    'printed-vertical-strip': { shape: 'vertical-strip', loadRatingKg: 1, printOrientation: 'vertical' },
    'printed-rail-pair': { shape: 'rail-pair', loadRatingKg: 4, printOrientation: 'on-side' },
  };
  return defaults[device.templateId ?? ''] ?? { shape: 'custom' };
}

export function getPrintedMountClearanceEnvelope(device: PlacedDevice): {
  widthMm: number;
  depthMm: number;
  heightMm: number;
} {
  const meta = getPrintedMountMeta(device);
  const baseWidth = getDeviceWidthMm(device) ?? 200;
  const baseDepth = device.depthMm ?? 100;
  const baseHeight = (device.sizeU || 1) * 44.45;
  const clearance = meta.clearanceMm ?? 5;
  return {
    widthMm: baseWidth + clearance * 2,
    depthMm: baseDepth + clearance,
    heightMm: baseHeight + clearance * 2,
  };
}

export function validatePrintedMountFit(
  device: PlacedDevice,
  layout: RackLayout
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isPrintedMount(device)) return issues;

  const meta = getPrintedMountMeta(device);
  const rackWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const deviceWidth = getDeviceWidthMm(device) ?? 0;

  // Width overflow
  if (deviceWidth > rackWidth) {
    issues.push({
      id: `printed-width-${device.id}`,
      severity: 'critical',
      title: 'Printed mount too wide for rack',
      detail: `${device.name} is ${deviceWidth}mm wide, but the ${layout.rackType} rack inner width is ${rackWidth}mm.`,
      deviceIds: [device.id],
    });
  }

  // Depth overflow
  const maxDepth = RACK_SPECS[layout.rackType]?.defaultDepthMm ?? 600;
  if ((device.depthMm ?? 0) > maxDepth) {
    issues.push({
      id: `printed-depth-${device.id}`,
      severity: 'warning',
      title: 'Printed mount exceeds rack depth',
      detail: `${device.name} depth (${device.depthMm}mm) may not fit inside the rack (${maxDepth}mm max).`,
      deviceIds: [device.id],
    });
  }

  // Load rating sanity check
  const loadRating = meta.loadRatingKg ?? 1;
  if (loadRating < (device.weightKg ?? 0)) {
    issues.push({
      id: `printed-load-${device.id}`,
      severity: 'warning',
      title: 'Printed mount may be undersized for weight',
      detail: `${device.name} is rated for ${loadRating}kg but weighs ${device.weightKg}kg. Consider thicker walls or higher infill.`,
      deviceIds: [device.id],
    });
  }

  // Collision with other devices (simple bounding-box check)
  const envelope = getPrintedMountClearanceEnvelope(device);
  for (const other of layout.devices) {
    if (other.id === device.id) continue;
    if (isPrintedMount(other)) continue; // printed parts can overlap in some setups
    const overlap = checkEnvelopeOverlap(device, other, envelope);
    if (overlap) {
      issues.push({
        id: `printed-collision-${device.id}-${other.id}`,
        severity: 'critical',
        title: 'Printed mount clearance conflicts with device',
        detail: `${device.name} clearance envelope overlaps ${other.name} at U${other.positionU}.`,
        deviceIds: [device.id, other.id],
      });
    }
  }

  return issues;
}

function checkEnvelopeOverlap(
  printed: PlacedDevice,
  other: PlacedDevice,
  envelope: { widthMm: number; depthMm: number; heightMm: number }
): boolean {
  const pu = printed.positionU ?? 0;
  const su = printed.sizeU ?? 1;
  const ou = other.positionU ?? 0;
  const osu = other.sizeU ?? 1;

  // Vertical overlap (U position)
  const pBottom = pu;
  const pTop = pu + su;
  const oBottom = ou;
  const oTop = ou + osu;
  if (pTop <= oBottom || pBottom >= oTop) return false;

  // Horizontal overlap (X position, simplified)
  const pw = envelope.widthMm;
  const px = printed.xMm ?? 0;
  const ow = getDeviceWidthMm(other) ?? 200;
  const ox = other.xMm ?? 0;
  if (px + pw / 2 <= ox - ow / 2 || px - pw / 2 >= ox + ow / 2) return false;

  return true;
}

export function getPrintedMountColor(device: PlacedDevice): string {
  return device.color || '#f59e0b';
}

export function formatPrintTimeEstimate(volumeCm3: number, infill = 20): string {
  const minutes = volumeCm3 * (1 + infill / 100) * 12; // rough heuristic
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

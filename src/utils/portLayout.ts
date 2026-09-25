import type { PlacedDevice, PortRef, PortTypeConfig } from '../types/rack';
import { getDeviceWidthMm } from './rackMath';

/** Subset of PlacedDevice required by port layout calculations.
 *  Width fields are optional: when present they anchor the real-world port
 *  size cap to the device's actual face width, letting callers pass face
 *  dimensions in any unit (mm for SVG/validation, world units for 3D). */
export type PortLayoutDevice = Pick<
  PlacedDevice,
  'category' | 'ports' | 'portFaceOverrides' | 'portLayouts'
> &
  Partial<Pick<PlacedDevice, 'widthType' | 'customWidthMm'>>;

export interface PortSlot {
  type: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: import('../types/rack').PortSpeed;
  mediaType?: import('../types/rack').MediaType;
}

export interface PortGroup {
  type: string;
  slots: PortSlot[];
  color: string;
  emissive: string;
  short: string;
  key?: string;
  label?: string;
}

export const PORT_META: Record<string, { color: string; emissive: string; short: string }> = {
  ethernet: { color: '#38bdf8', emissive: '#0284c7', short: 'E' },
  fiber: { color: '#c084fc', emissive: '#7c3aed', short: 'F' },
  power: { color: '#fb923c', emissive: '#ea580c', short: 'P' },
  usb: { color: '#facc15', emissive: '#ca8a04', short: 'U' },
  hdmi: { color: '#22c55e', emissive: '#16a34a', short: 'H' },
  atx: { color: '#f43f5e', emissive: '#dc2626', short: 'A' },
  coax: { color: '#a3e635', emissive: '#65a30d', short: 'C' },
};

/** Aspect ratio (width / height) for each port type */
const PORT_ASPECT: Record<string, number> = {
  ethernet: 1.14,  // RJ45: ~16mm x 14mm
  fiber: 1.0,      // LC duplex: ~14mm x 14mm
  power: 1.45,     // IEC C13: ~27mm x 19mm (front face)
  usb: 1.75,       // USB-A: ~14mm x 8mm
  hdmi: 2.0,       // HDMI: ~16mm x 8mm
  atx: 1.0,        // ATX/EPS: ~9mm x 9mm (small pins)
  coax: 1.0,       // Coaxial: ~10mm x 10mm
};

function getDefaultPortFaceMap(category: string): Record<string, 'front' | 'rear'> {
  switch (category) {
    case 'patch-panel':
      return { ethernet: 'front', fiber: 'front', coax: 'front' };
    case 'switch':
      return { ethernet: 'front', fiber: 'front', usb: 'front', power: 'rear' };
    case 'pdu':
      return { power: 'rear' };
    case 'pdu-0u':
      // 0U PDU outlets face inward (toward rack center) per ADR-012.
      // For cable routing consistency they map to the same face as standard PDU.
      return { power: 'rear' };
    case 'server':
      return { ethernet: 'rear', fiber: 'rear', usb: 'rear', hdmi: 'rear', power: 'rear' };
    case 'nas':
      return { ethernet: 'rear', fiber: 'rear', usb: 'rear', hdmi: 'rear', power: 'rear' };
    case 'router':
      return { ethernet: 'front', fiber: 'front', usb: 'front', power: 'rear' };
    case 'firewall':
      return { ethernet: 'front', fiber: 'front', usb: 'front', power: 'rear' };
    case 'modem':
      return { ethernet: 'rear', coax: 'rear', fiber: 'rear', power: 'rear' };
    case 'mini-pc':
      return { ethernet: 'rear', usb: 'rear', hdmi: 'rear', power: 'rear' };
    case 'sbc':
      return { ethernet: 'rear', usb: 'rear', hdmi: 'rear', power: 'rear' };
    case 'ip-kvm':
      return { ethernet: 'rear', usb: 'rear', hdmi: 'rear', atx: 'rear' };
    case 'poe-injector':
      return { ethernet: 'front', power: 'rear' };
    case 'ups':
      return { power: 'rear', ethernet: 'rear', usb: 'rear', coax: 'rear' };
    case 'access-point':
      return { ethernet: 'rear' };
    default:
      return { ethernet: 'rear', fiber: 'rear', usb: 'rear', hdmi: 'rear', power: 'rear', coax: 'rear', atx: 'rear' };
  }
}

/** Which face does each port type live on, by device category.
 *  User overrides take precedence over category defaults.
 */
/** Look up the speed and mediaType for a specific port on a device face.
 *  Returns undefined if the device has no portLayouts config for that face.
 */
export function getPortMetadata(
  device: PortLayoutDevice,
  face: 'front' | 'rear',
  portType: string,
  portIndex: number
): { speed?: import('../types/rack').PortSpeed; mediaType?: import('../types/rack').MediaType } | undefined {
  const faceLayout = device.portLayouts?.[face];
  if (!faceLayout) return undefined;
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  if ((faceMap[portType] ?? 'rear') !== face) return undefined;

  let accumulated = 0;
  for (const config of faceLayout) {
    if (config.type !== portType) continue;
    const count = config.count ?? (device.ports?.[portType] ?? 0);
    if (portIndex >= accumulated && portIndex < accumulated + count) {
      return { speed: config.speed, mediaType: config.mediaType };
    }
    accumulated += count;
  }
  return undefined;
}

export function getPortFaceMap(category: string, overrides?: Record<string, 'front' | 'rear'>): Record<string, 'front' | 'rear'> {
  const defaults = getDefaultPortFaceMap(category);
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}

/** Single source of truth for which face a cable port lives on.
 *  Explicit patch-panel side wins; otherwise the category face map
 *  (with user overrides) decides, defaulting to 'rear'.
 */
export function resolvePortFace(device: PortLayoutDevice, portRef?: PortRef): 'front' | 'rear' {
  if (device.category === 'patch-panel' && portRef?.side) {
    return portRef.side;
  }
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  return (faceMap[portRef?.type ?? 'ethernet'] ?? 'rear') as 'front' | 'rear';
}

/** Build port layout for a specific face of a device */
export function buildPortLayout(
  device: PortLayoutDevice,
  faceWidth: number,
  faceHeight: number,
  targetFace: 'front' | 'rear'
): PortGroup[] {
  const ports = device.ports;
  if (!ports) return [];

  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);

  const entries = Object.entries(ports).filter(
    ([type, count]) => {
      if (type === 'layoutColumns') return false;
      if (typeof count !== 'number' || count <= 0) return false;
      return (faceMap[type] ?? 'rear') === targetFace;
    }
  ) as [string, number][];

  if (entries.length === 0) return [];

  // Check for device-specific port layout for this face. Only configs that can
  // render on the requested face should reserve vertical group space; skipped
  // configs used to leave visible ports compressed or offset into empty rows.
  const faceLayout = device.portLayouts?.[targetFace];
  if (faceLayout && faceLayout.length > 0) {
    const typeConsumed: Record<string, number> = {};
    const renderableConfigs = faceLayout.flatMap((config, sourceIndex) => {
      const totalForType = ports[config.type];
      if (typeof totalForType !== 'number' || totalForType <= 0) return [];
      if ((faceMap[config.type] ?? 'rear') !== targetFace) return [];

      const alreadyUsed = typeConsumed[config.type] ?? 0;
      const remaining = totalForType - alreadyUsed;
      if (remaining <= 0) return [];

      const count = Math.min(config.count ?? remaining, remaining);
      typeConsumed[config.type] = alreadyUsed + count;
      return [{ config, sourceIndex, count, startIndex: alreadyUsed }];
    });

    const rowMap = new Map<number, typeof renderableConfigs>();
    let fallbackIndex = -renderableConfigs.length;
    for (const item of renderableConfigs) {
      // Negative explicit rowIndex would collide with internal fallback row
      // keys; treat it as absent (fallback).
      const explicitRow = item.config.rowIndex;
      const idx = explicitRow !== undefined && explicitRow >= 0 ? explicitRow : fallbackIndex++;
      if (!rowMap.has(idx)) rowMap.set(idx, []);
      rowMap.get(idx)!.push(item);
    }
    // Fallback rows use negative indices; map them to values just below
    // Number.MAX_SAFE_INTEGER so explicit (>=0) rows sort first while
    // preserving the original order among fallback rows.
    const sortedRows = Array.from(rowMap.entries()).sort((a, b) => {
      const ai = a[0] >= 0 ? a[0] : Number.MAX_SAFE_INTEGER + a[0];
      const bi = b[0] >= 0 ? b[0] : Number.MAX_SAFE_INTEGER + b[0];
      return ai - bi;
    });
    return sortedRows.flatMap(([, items], rowIdx) =>
      layoutPortRow(
        items,
        device,
        faceWidth,
        faceHeight,
        sortedRows.length,
        rowIdx,
        sortedRows.map(([, r]) => r[0]?.config.yRatio)
      )
    );
  }

  // Default behavior
  const sorted = sortPortTypes(entries, device.category);
  return sorted.map(([type, count], groupIndex) =>
    layoutPortGroup(type, count, device, faceWidth, faceHeight, sorted.length, undefined, groupIndex)
  );
}

function sortPortTypes(
  entries: [string, number][],
  category: string
): [string, number][] {
  const order = getPortTypeOrder(category);
  return [...entries].sort((a, b) => {
    const idxA = order.indexOf(a[0]);
    const idxB = order.indexOf(b[0]);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function getPortTypeOrder(category: string): string[] {
  switch (category) {
    case 'switch':
      return ['ethernet', 'fiber', 'usb', 'power'];
    case 'patch-panel':
      return ['ethernet', 'fiber', 'coax'];
    case 'pdu':
    case 'pdu-0u':
      return ['power'];
    case 'server':
    case 'nas':
      return ['ethernet', 'fiber', 'usb', 'hdmi', 'power'];
    case 'router':
    case 'firewall':
      return ['ethernet', 'fiber', 'usb', 'power'];
    case 'mini-pc':
    case 'sbc':
      return ['ethernet', 'usb', 'hdmi', 'power'];
    case 'ups':
      return ['power', 'ethernet', 'usb', 'coax'];
    default:
      return ['ethernet', 'fiber', 'usb', 'hdmi', 'power', 'coax', 'atx'];
  }
}

type RenderableConfig = {
  config: PortTypeConfig;
  sourceIndex: number;
  count: number;
  startIndex: number;
};

function layoutPortRow(
  items: RenderableConfig[],
  device: PortLayoutDevice,
  faceWidth: number,
  faceHeight: number,
  totalRows: number,
  rowIdx: number,
  rowYRatios: (number | undefined)[]
): PortGroup[] {
  const isZeroUPduPower = device.category === 'pdu-0u' && items.every((item) => item.config.type === 'power');
  const isPowerOnly = totalRows === 1 && items.every((item) => item.config.type === 'power');
  const rowUsesNewFields = items.some(
    (item) => item.config.rowIndex !== undefined || item.config.yRatio !== undefined
  );
  const topMargin = faceHeight * (isPowerOnly ? 0.02 : 0.15);
  const bottomMargin = faceHeight * (isPowerOnly ? 0.06 : 0.04);
  const availableH = Math.max(0.01, faceHeight - topMargin - bottomMargin);
  const groupH = availableH / totalRows;

  const explicitY = rowYRatios[rowIdx];
  let rowY: number;
  if (explicitY !== undefined) {
    // Clamp into the [0, 1] face band so extreme values can't push slots off-face.
    const clampedY = Math.min(1, Math.max(0, explicitY));
    rowY = faceHeight / 2 - clampedY * faceHeight;
  } else if (isZeroUPduPower) {
    rowY = 0;
  } else if (isPowerOnly) {
    rowY = -availableH / 2 + bottomMargin + groupH / 2;
  } else {
    rowY = availableH / 2 - topMargin - rowIdx * groupH;
  }

  return items.map(({ config, sourceIndex, count, startIndex }) => {
    const group = layoutPortGroup(
      config.type,
      count,
      device,
      faceWidth,
      faceHeight,
      totalRows,
      config.xRatio,
      rowIdx,
      startIndex,
      config.columns,
      config.speed,
      config.mediaType,
      config.orientation,
      config.portScale
    );
    group.key = `${config.type}-${sourceIndex}`;
    group.label = config.groupLabel;

    if (config.pairing === 'odd-even-vertical') {
      group.slots = applyOddEvenVerticalPairing(group.slots, config.columns ?? group.slots.length);
    }

    // Only recenter rows that use the new row positioning fields. Fallback
    // rows (unindexed configs with no yRatio) keep the classic layoutPortGroup
    // output exactly.
    if (!isZeroUPduPower && rowUsesNewFields && group.slots.length > 0) {
      const ys = group.slots.map((s) => s.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const centerY = (minY + maxY) / 2;
      const delta = rowY - centerY;
      for (const slot of group.slots) slot.y += delta;
    }

    return group;
  });
}

// Renumber slot indices for odd-even-vertical pairing without moving slot
// geometry; the visual positions stay the same and only the index order changes.
function applyOddEvenVerticalPairing(slots: PortSlot[], columns: number): PortSlot[] {
  if (slots.length === 0) return slots;
  const rows = Math.ceil(slots.length / columns);
  if (rows !== 2 || slots.length % columns !== 0) {
    if (import.meta.env.DEV) {
      console.warn(
        `applyOddEvenVerticalPairing: skipped; ${slots.length} slots over ${columns} columns does not form an even 2-row grid.`
      );
    }
    return slots;
  }

  const baseIndex = slots[0].index;
  const ordered = slots
    .map((slot, i) => {
      const oldRow = Math.floor(i / columns);
      const oldCol = i % columns;
      const newIndex = Math.floor(oldRow / 2) * 2 * columns + oldCol * 2 + (oldRow % 2);
      return { slot, newIndex };
    })
    .sort((a, b) => a.newIndex - b.newIndex);

  return ordered.map((o, i) => ({ ...o.slot, index: baseIndex + i }));
}

function layoutPortGroup(
  type: string,
  count: number,
  device: PortLayoutDevice,
  faceWidth: number,
  faceHeight: number,
  totalGroups: number,
  xRatio?: number,
  groupIndex?: number,
  startIndex?: number,
  explicitColumns?: number,
  speed?: import('../types/rack').PortSpeed,
  mediaType?: import('../types/rack').MediaType,
  orientation?: 'horizontal' | 'vertical',
  portScale?: number
): PortGroup {
  const meta = PORT_META[type] ?? PORT_META.ethernet;
  const aspect = PORT_ASPECT[type] ?? 1.14;
  const isZeroUPduPower = device.category === 'pdu-0u' && type === 'power';
  const isVertical = orientation === 'vertical';

  // Determine columns: explicit from portLayouts config, then layoutColumns, then default
  const requestedColumns = explicitColumns ?? (device.ports?.layoutColumns as number) ?? getDefaultColumns(type, count, device.category);
  const layoutColumns = isZeroUPduPower ? Math.min(requestedColumns, 2) : requestedColumns;
  // Clamp degenerate explicit columns (0/negative) to avoid Infinity/NaN geometry.
  const cols = Math.max(1, Math.min(count, layoutColumns));
  const rows = Math.ceil(count / cols);

  // Side margins
  const sideMargin = faceWidth * 0.03;
  const availableW = Math.max(0.01, faceWidth - sideMargin * 2);

  // Top margin (leave room for label), bottom margin
  // Power ports (inlets/outlets) are physically on the lower part of the rear face
  const isPowerOnly = type === 'power' && totalGroups === 1;
  const topMargin = faceHeight * (isPowerOnly ? 0.02 : 0.15);
  const bottomMargin = faceHeight * (isPowerOnly ? 0.06 : 0.04);
  const availableH = Math.max(0.01, faceHeight - topMargin - bottomMargin);

  // Allocate vertical space per group
  const groupH = availableH / totalGroups;

  // Find group index
  let idx: number;
  if (groupIndex !== undefined) {
    idx = groupIndex;
  } else {
    const entries = Object.entries(device.ports ?? {}).filter(
      ([t, c]) => t !== 'layoutColumns' && typeof c === 'number' && c > 0
    ) as [string, number][];
    const sorted = sortPortTypes(entries, device.category);
    idx = sorted.findIndex(([t]) => t === type);
  }

  let groupY: number;
  if (isZeroUPduPower) {
    // 0U PDUs are vertical strips: outlets run along the full length, not a bottom row.
    groupY = 0;
  } else if (isPowerOnly) {
    // Single power group (PDU/UPS): anchor to bottom of face
    groupY = -availableH / 2 + bottomMargin + groupH / 2;
  } else {
    // Multi-group: stack from top down
    groupY = (availableH / 2) - topMargin - idx * groupH;
  }

  // Port size: fill width, maintain aspect ratio
  const gapRatio = 0.08; // gap as ratio of port width
  const totalGapW = (cols - 1) * gapRatio;
  const portW = availableW / (cols + totalGapW);
  const gapW = portW * gapRatio;
  const portH = portW / aspect;

  // Cap size to real-world proportions. Ratios are defined against a 19"
  // rack face (482.6mm usable), but the cap itself is an ABSOLUTE mm size:
  // an RJ45 port is ~16mm wide whether the device face is 482mm or 107mm.
  // C13 ~27mm = 5.6%, RJ45 ~16mm = 3.3%, USB ~14mm = 2.9%
  const RACK_REFERENCE_WIDTH_MM = 482.6;
  const MAX_PORT_RATIO: Record<string, number> = {
    power: 0.058,    // IEC C13 ~28mm / 482mm
    ethernet: 0.036, // RJ45 ~16mm / 482mm (was 8% — 2x too big)
    fiber: 0.032,    // LC ~15mm / 482mm
    usb: 0.032,      // USB-A ~14mm / 482mm
    hdmi: 0.036,     // HDMI ~16mm / 482mm
    atx: 0.025,
    coax: 0.024,
  };
  // Callers pass face dimensions in different units: mm (SVG faceplates,
  // validation) vs 3D world units (DeviceModel, cable views). Convert the
  // absolute mm cap into the caller's unit space via the device's real face
  // width; without it the cap is a no-op in world units and single ports
  // blow up to face-sized squares.
  const deviceFaceWidthMm =
    device.widthType !== undefined || device.customWidthMm !== undefined
      ? getDeviceWidthMm({ widthType: device.widthType ?? 'custom', customWidthMm: device.customWidthMm })
      : undefined;
  const maxPortW =
    deviceFaceWidthMm !== undefined && deviceFaceWidthMm > 0
      ? (MAX_PORT_RATIO[type] ?? 0.04) * RACK_REFERENCE_WIDTH_MM * (faceWidth / deviceFaceWidthMm)
      : (MAX_PORT_RATIO[type] ?? 0.04) * faceWidth;
  const finalPortW = Math.min(portW, maxPortW);
  const finalPortH = finalPortW / aspect;
  const finalGapW = Math.min(gapW, faceWidth * 0.01);

  // Optional per-group scale (portScale) shrinks ports and gaps together so
  // dense rows (e.g. 2x24 on a photo faceplate) fit their real footprint.
  const scale = portScale !== undefined ? Math.min(1, Math.max(0.2, portScale)) : 1;
  const scaledPortW = finalPortW * scale;
  const scaledPortH = finalPortH * scale;
  const scaledGapW = finalGapW * scale;

  const slotW = isVertical ? scaledPortH * 0.9 : scaledPortW * 0.9;
  const slotH = isVertical ? scaledPortW * 0.9 : scaledPortH * 0.9;
  const rowPitch = isVertical ? slotH + scaledGapW * 0.5 : scaledPortH + scaledGapW * 0.5;
  const displayCols = isVertical ? Math.ceil(count / rows) : cols;

  // Horizontal placement
  const rowW = displayCols * slotW + (displayCols - 1) * scaledGapW;
  let startX: number;
  if (xRatio !== undefined) {
    // xRatio 0 = left edge, 0.5 = center, 1 = right edge
    const leftEdge = -availableW / 2 + slotW / 2;
    const rightEdge = availableW / 2 - rowW + slotW / 2;
    startX = leftEdge + xRatio * (rightEdge - leftEdge);
  } else {
    startX = -rowW / 2 + slotW / 2;
  }

  // Stack rows from top of group area downward
  const startY = isZeroUPduPower
    ? Math.min(availableH / 2 - scaledPortH / 2, ((rows - 1) * rowPitch) / 2)
    : groupY + (rows * rowPitch) / 2 - slotH / 2;

  const slots: PortSlot[] = [];
  const baseIndex = startIndex ?? 0;
  for (let i = 0; i < count; i++) {
    let col: number;
    let row: number;
    if (isVertical) {
      col = Math.floor(i / rows);
      row = i % rows;
    } else {
      col = i % displayCols;
      row = Math.floor(i / displayCols);
    }
    slots.push({
      type,
      index: baseIndex + i,
      x: startX + col * (slotW + scaledGapW),
      y: startY - row * rowPitch,
      width: slotW,
      height: slotH,
      speed,
      mediaType,
    });
  }

  return { type, slots, color: meta.color, emissive: meta.emissive, short: meta.short };
}

function getDefaultColumns(type: string, count: number, category: string): number {
  if (type === 'power') {
    if (category === 'pdu-0u') return Math.min(count, 2);
    if (category === 'pdu') return Math.min(count, 8);
    if (category === 'ups') return Math.min(count, 4);
    return Math.min(count, 2);
  }
  if (type === 'ethernet') {
    if (count <= 8) return count;
    if (count <= 16) return 8;
    if (count <= 24) return 12;
    return 24;
  }
  if (type === 'fiber') {
    if (count <= 6) return count;
    if (count <= 12) return 6;
    return 12;
  }
  if (type === 'usb') {
    return Math.min(count, 4);
  }
  return Math.min(count, 4);
}

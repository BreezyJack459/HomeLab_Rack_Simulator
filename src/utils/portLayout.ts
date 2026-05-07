import type { PlacedDevice } from '../types/rack';

export interface PortSlot {
  type: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PortGroup {
  type: string;
  slots: PortSlot[];
  color: string;
  emissive: string;
  short: string;
  key?: string;
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
      return { power: 'front' };
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
export function getPortFaceMap(category: string, overrides?: Record<string, 'front' | 'rear'>): Record<string, 'front' | 'rear'> {
  const defaults = getDefaultPortFaceMap(category);
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}

/** Build port layout for a specific face of a device */
export function buildPortLayout(
  device: PlacedDevice,
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

    return renderableConfigs.map(({ config, sourceIndex, count, startIndex }, groupIndex) => {
      const group = layoutPortGroup(
        config.type,
        count,
        device,
        faceWidth,
        faceHeight,
        renderableConfigs.length,
        config.xRatio,
        groupIndex,
        startIndex,
        config.columns
      );
      group.key = `${config.type}-${sourceIndex}`;
      return group;
    });
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

function layoutPortGroup(
  type: string,
  count: number,
  device: PlacedDevice,
  faceWidth: number,
  faceHeight: number,
  totalGroups: number,
  xRatio?: number,
  groupIndex?: number,
  startIndex?: number,
  explicitColumns?: number
): PortGroup {
  const meta = PORT_META[type] ?? PORT_META.ethernet;
  const aspect = PORT_ASPECT[type] ?? 1.14;
  const isZeroUPduPower = device.category === 'pdu-0u' && type === 'power';

  // Determine columns: explicit from portLayouts config, then layoutColumns, then default
  const requestedColumns = explicitColumns ?? (device.ports?.layoutColumns as number) ?? getDefaultColumns(type, count, device.category);
  const layoutColumns = isZeroUPduPower ? Math.min(requestedColumns, 2) : requestedColumns;
  const cols = Math.min(count, layoutColumns);
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

  // Cap size to real-world proportions on a 19" rack face (482mm usable)
  // C13 ~27mm = 5.6%, RJ45 ~16mm = 3.3%, USB ~14mm = 2.9%
  const MAX_PORT_RATIO: Record<string, number> = {
    power: 0.058,    // IEC C13 ~28mm / 482mm
    ethernet: 0.036, // RJ45 ~16mm / 482mm (was 8% — 2x too big)
    fiber: 0.032,    // LC ~15mm / 482mm
    usb: 0.032,      // USB-A ~14mm / 482mm
    hdmi: 0.036,     // HDMI ~16mm / 482mm
    atx: 0.025,
    coax: 0.024,
  };
  const maxPortW = (MAX_PORT_RATIO[type] ?? 0.04) * faceWidth;
  const finalPortW = Math.min(portW, maxPortW);
  const finalPortH = finalPortW / aspect;
  const finalGapW = Math.min(gapW, faceWidth * 0.01);

  // Horizontal placement
  const rowW = cols * finalPortW + (cols - 1) * finalGapW;
  let startX: number;
  if (xRatio !== undefined) {
    // xRatio 0 = left edge, 0.5 = center, 1 = right edge
    const leftEdge = -availableW / 2 + finalPortW / 2;
    const rightEdge = availableW / 2 - rowW + finalPortW / 2;
    startX = leftEdge + xRatio * (rightEdge - leftEdge);
  } else {
    startX = -rowW / 2 + finalPortW / 2;
  }

  // Stack rows from top of group area downward
  const rowH = isZeroUPduPower && rows > 1
    ? Math.max(finalPortH * 1.35, (availableH - finalPortH) / (rows - 1))
    : finalPortH + finalGapW * 0.5;
  const startY = isZeroUPduPower
    ? Math.min(availableH / 2 - finalPortH / 2, ((rows - 1) * rowH) / 2)
    : groupY + (rows * rowH) / 2 - finalPortH / 2;

  const slots: PortSlot[] = [];
  const baseIndex = startIndex ?? 0;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    slots.push({
      type,
      index: baseIndex + i,
      x: startX + col * (finalPortW + finalGapW),
      y: startY - row * rowH,
      width: finalPortW * 0.9,
      height: finalPortH * 0.9,
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

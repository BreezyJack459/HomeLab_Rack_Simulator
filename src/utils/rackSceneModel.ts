import type {
  CablePlan,
  CableRoute,
  CableRoutingDiscipline,
  CableType,
  PlacedDevice,
  RackLayout
} from '../types/rack';
import { DEFAULT_CABLE_COLORS, getCableDisplayColor } from './cableColors';
import { CHANNEL_X_OFFSET, CHANNEL_Z_OFFSET, manualRoutePoints } from './manualCableRoute';
export { CHANNEL_X_OFFSET, CHANNEL_Z_OFFSET } from './manualCableRoute';
import { calculateCablePlan } from './routing';
import { getZeroUEarSide } from './rackMath';
import { getRouteObstacles, overlapsObstacle, routeIsClear, routeLength } from './routeFeasibility';
import {
  getCablePortFace,
  getDevicePortWorldPosition,
  getDeviceWorldBox,
  getDevicePortSurfaces,
  getRackWorldDimensions,
  RACK_3D_POST_SIZE,
  ZERO_U_SIDE_GAP,
  type DeviceWorldBox,
  type RackWorldDimensions,
  type WorldPoint
} from './rackGeometry';

/**
 * Canonical rack-scene model.
 *
 * Pure data layer between the rack store and the Three.js mesh components:
 * converts a `RackLayout` into opaque frame members, device solids, cable
 * management channels, and per-cable managed route paths. No three.js imports
 * — components turn `points` into curves/tubes. Everything here is
 * deterministic for a given layout so lanes and geometry survive filtering.
 */

export type CableRoutingMode = 'clean' | 'realistic';

export type SceneBox = {
  center: WorldPoint;
  size: WorldPoint;
};

export type RackFrameModel = {
  posts: SceneBox[];
  crossbars: SceneBox[];
  mountingRails: SceneBox[];
};

export type TrayChannelId = 'front-left' | 'front-right' | 'rear-left' | 'rear-right';

export type TrayChannel = {
  id: TrayChannelId;
  separation: 'partitioned';
  side: 'left' | 'right';
  face: 'front' | 'rear';
  /** Cable centerline inside the duct. */
  laneCenter: WorldPoint;
  /** Duct member solids: back plate + two lips, opening faces the rack. */
  members: SceneBox[];
  accentColor: string;
  label: string;
};

export type DeviceSolidKind = 'device' | 'hcm' | 'zero-u-side' | 'zero-u-rear';

export type DeviceSolid = {
  deviceId: string;
  kind: DeviceSolidKind;
  box: DeviceWorldBox;
  color: string;
  faceColor: string;
  label: string;
  mountSide: 'front' | 'rear';
};

export type RouteLane = {
  /** Deterministic rank of the cable within its separation group. */
  index: number;
  offsetX: number;
  offsetZ: number;
};

export type ManagedRoute = {
  cableId: string;
  cable: CableRoute;
  plan: CablePlan;
  fromPort: WorldPoint;
  toPort: WorldPoint;
  points: WorldPoint[];
  color: string;
  radiusMm: number;
  separation: 'data' | 'power';
  discipline: CableRoutingDiscipline;
  /** True when the route runs through a side channel/trunk (not a direct manager path). */
  usesTrunk: boolean;
  lane: RouteLane;
  rearGuides: RearCableGuide[];
  crossovers: CableCrossover[];
  routingDecision: { kind: 'manual' | 'direct' | 'drop' | 'side' | 'manager' | 'blocked' | 'front'; reason: string };
};

export type CableCrossover = {
  id: string;
  /** Support bar and brackets connected to the rear rack posts. */
  members: SceneBox[];
  clips: WorldPoint[];
  center: WorldPoint;
};

export type RearCableGuide = {
  id: string;
  support: SceneBox;
  tie: WorldPoint;
};

export type RackSceneModel = {
  dimensions: RackWorldDimensions;
  frame: RackFrameModel;
  channels: TrayChannel[];
  devices: DeviceSolid[];
  routes: ManagedRoute[];
  rearGuides: RearCableGuide[];
  crossovers: CableCrossover[];
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Horizontal distance from rack post center to the side-channel centerline. */

/** Distance from the rack front/rear face plane to the channel centerline. */

/** Short port lead-out length before a route enters managed space. */
export const PORT_LEAD_OUT = 0.06;
/** Duct cross-section (x by z). */
export const CHANNEL_DUCT_WIDTH = 0.16;
export const CHANNEL_DUCT_DEPTH = 0.14;

const DATA_ACCENT = '#38bdf8';
const POWER_ACCENT = '#fb923c';
const FRAME_COLOR = '#2e3c4f';
const RAIL_COLOR = '#3b4a61';

const CABLE_RADIUS_MM: Record<CableType, number> = {
  ethernet: 9,
  fiber: 7,
  power: 12,
  usb: 8,
  hdmi: 11,
  atx: 8,
  coax: 10,
  structured: 8,
  patch: 9
};

/* ------------------------------------------------------------------ */
/*  Small point helpers (three-free)                                   */
/* ------------------------------------------------------------------ */

const MIN_POINT_DISTANCE = 0.001;
const MIN_POINT_DISTANCE_SQ = MIN_POINT_DISTANCE * MIN_POINT_DISTANCE;

const pt = (x: number, y: number, z: number): WorldPoint => ({ x, y, z });

const distSq = (a: WorldPoint, b: WorldPoint) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

function pushPoint(points: WorldPoint[], x: number, y: number, z: number): void {
  const previous = points[points.length - 1];
  if (!previous || distSq(previous, pt(x, y, z)) > MIN_POINT_DISTANCE_SQ) {
    points.push(pt(x, y, z));
  }
}

const dist = (a: WorldPoint, b: WorldPoint) => Math.sqrt(distSq(a, b));

/** Gentle gravity sag on long interior spans (realistic mode only). */
function insertGravitySag(points: WorldPoint[], amount: number, dimensions: RackWorldDimensions): WorldPoint[] {
  if (points.length < 3 || amount <= 0) return points;
  const result: WorldPoint[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = dist(a, b);
    const outsideFace = Math.abs(a.z - b.z) < 0.001 && Math.min(Math.abs(a.z), Math.abs(b.z)) > dimensions.rackDepth / 2 + 0.06;
    const outsideSide = Math.abs(a.x - b.x) < 0.001 && Math.min(Math.abs(a.x), Math.abs(b.x)) > dimensions.rackWidth / 2 + 0.04;
    if (length > 0.24 && i > 0 && i < points.length - 2 && (outsideFace || outsideSide)) {
      const sagScale = Math.min(1.4, length / 0.6);
      const mid = pt((a.x + b.x) / 2, (a.y + b.y) / 2 - amount * sagScale, (a.z + b.z) / 2);
      result.push(mid);
    }
    result.push(b);
  }
  return result;
}

/** Deterministic lane offset for a cable rank inside a channel/trunk. */
export function laneOffsetForIndex(index: number): { offsetX: number; offsetZ: number } {
  return {
    offsetX: ((index % 3) - 1) * 0.03,
    offsetZ: ((Math.floor(index / 3) % 4) - 1.5) * 0.028
  };
}

/* ------------------------------------------------------------------ */
/*  Frame + channels                                                   */
/* ------------------------------------------------------------------ */

function buildFrame(dimensions: RackWorldDimensions): RackFrameModel {
  const { rackWidth, rackDepth, rackHeight } = dimensions;
  const postY = rackHeight / 2;
  const posts: SceneBox[] = [];
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      posts.push({
        center: pt((xSide * rackWidth) / 2, 0, (zSide * rackDepth) / 2),
        size: pt(RACK_3D_POST_SIZE, rackHeight, RACK_3D_POST_SIZE)
      });
    }
  }

  const crossbars: SceneBox[] = [];
  for (const ySide of [-1, 1]) {
    const y = ySide * postY;
    // Front + rear cross members
    for (const zSide of [-1, 1]) {
      crossbars.push({
        center: pt(0, y, (zSide * rackDepth) / 2),
        size: pt(rackWidth + RACK_3D_POST_SIZE, 0.05, RACK_3D_POST_SIZE)
      });
    }
    // Left + right cross members
    for (const xSide of [-1, 1]) {
      crossbars.push({
        center: pt((xSide * rackWidth) / 2, y, 0),
        size: pt(RACK_3D_POST_SIZE, 0.05, rackDepth - RACK_3D_POST_SIZE)
      });
    }
  }

  // Full-height inner mounting rails just behind the front posts.
  const mountingRails: SceneBox[] = [-1, 1].map((xSide) => ({
    center: pt((xSide * (rackWidth - 0.06)) / 2, 0, rackDepth / 2 - 0.02),
    size: pt(0.018, rackHeight - 0.06, 0.012)
  }));

  return { posts, crossbars, mountingRails };
}

function buildChannels(dimensions: RackWorldDimensions): TrayChannel[] {
  const { rackWidth, rackDepth, rackHeight } = dimensions;
  const channels: TrayChannel[] = [];
  const plate = 0.018;
  const lip = 0.02;

  for (const face of ['front', 'rear'] as const) {
    const zSign = face === 'front' ? 1 : -1;
    for (const side of ['left', 'right'] as const) {
      const xSign = side === 'left' ? -1 : 1;
      const cx = xSign * (rackWidth / 2 + CHANNEL_X_OFFSET);
      const cz = zSign * (rackDepth / 2 + CHANNEL_Z_OFFSET);
      const halfW = CHANNEL_DUCT_WIDTH / 2;
      const halfD = CHANNEL_DUCT_DEPTH / 2;

      // U-channel opening toward the rack: outer back plate + front/rear lips.
      const members: SceneBox[] = [
        {
          center: pt(cx + xSign * (halfW - plate / 2), 0, cz),
          size: pt(plate, rackHeight, CHANNEL_DUCT_DEPTH)
        },
        {
          center: pt(cx, 0, cz + halfD - lip / 2),
          size: pt(CHANNEL_DUCT_WIDTH, rackHeight, lip)
        },
        {
          center: pt(cx, 0, cz - halfD + lip / 2),
          size: pt(CHANNEL_DUCT_WIDTH, rackHeight, lip)
        }
      ];

      channels.push({
        id: `${face}-${side}` as TrayChannelId,
        separation: 'partitioned',
        side,
        face,
        laneCenter: pt(cx, 0, cz),
        members,
        accentColor: DATA_ACCENT,
        label: side === 'left' ? 'LEFT' : 'RIGHT'
      });
    }
  }
  return channels;
}

/* ------------------------------------------------------------------ */
/*  Device solids                                                      */
/* ------------------------------------------------------------------ */

/** Darken a hex color toward the frame tone for opaque faceplates. */
function faceplateColor(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return '#1f2a3a';
  const mix = (channel: number, target: number) =>
    Math.round(channel * 0.55 + target * 0.45)
      .toString(16)
      .padStart(2, '0');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `#${mix(r, 0x16)}${mix(g, 0x20)}${mix(b, 0x2e)}`;
}

function buildDeviceSolids(layout: RackLayout, dimensions: RackWorldDimensions): DeviceSolid[] {
  return layout.devices.map((device) => {
    const box = getDeviceWorldBox(layout, device, dimensions);
    const kind: DeviceSolidKind = device.category === 'cable-management'
      ? 'hcm'
      : box.isZeroU
        ? box.isRearRail0U
          ? 'zero-u-rear'
          : 'zero-u-side'
        : 'device';
    const color = device.category === 'cable-management' ? '#5b6b80' : device.color;
    return {
      deviceId: device.id,
      kind,
      box,
      color,
      faceColor: faceplateColor(color),
      label: device.label || device.name,
      mountSide: box.isRearMounted ? 'rear' : 'front'
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Managed route paths                                                */
/* ------------------------------------------------------------------ */

type RouteEndpoint = {
  port: WorldPoint;
  face: 'front' | 'rear';
  /** Unit direction the cable leaves the port. */
  lead: WorldPoint;
  /** Column x the cable uses to reach the trunk (channel or 0U side gap). */
  columnX: number;
  /** Free-space z at which the column runs (front/rear channel plane). */
  channelZ: number;
  /** Row-local clearance plane for turning sideways near the device. */
  lateralZ: number;
  isSideZeroU: boolean;
  drop: number;
  rearBundle?: { id: string; x: number; y: number; rank: number; width: number };
};

/** A shared free-space plane beyond every normal device face. Recessed
 * ports must reach this plane before a cable crosses neighbouring equipment.
 */
const exteriorFaceZ = (layout: RackLayout, dimensions: RackWorldDimensions, face: 'front' | 'rear'): number => {
  const sign = face === 'front' ? 1 : -1;
  let extent = dimensions.rackDepth / 2;
  for (const device of layout.devices) {
    const box = getDeviceWorldBox(layout, device, dimensions);
    extent = Math.max(extent, sign * box.z + box.depth / 2);
  }
  return sign * (extent + 0.12);
};

function buildEndpoint(
  layout: RackLayout,
  device: PlacedDevice,
  portRef: CableRoute['fromPort'],
  separation: 'data' | 'power',
  dimensions: RackWorldDimensions,
  lane: RouteLane,
  channelSideSign: number
): RouteEndpoint {
  const { rackWidth } = dimensions;
  const port = getDevicePortWorldPosition(layout, device, portRef, dimensions);
  const box = getDeviceWorldBox(layout, device, dimensions);
  const channelX = channelSideSign * (rackWidth / 2 + CHANNEL_X_OFFSET);

  const drop = device.category === 'pdu' || device.category === 'pdu-0u' ? Math.max(0.04, Math.min(0.1, box.height * 0.25)) : 0;

  if (box.isZeroU && (!box.isRearRail0U || device.outletFacing === 'inward')) {
    // Side-rail 0U: ports face the rack interior; lead into the side gap,
    // which is free along the whole rack depth. The z-align target stays in
    // front free space so crossovers never cut through device volumes.
    const earSign = getZeroUEarSide(device) === 'left' ? -1 : 1;
    return {
      port,
      face: 'front',
      lead: pt(-earSign, 0, 0),
      columnX: earSign * (rackWidth / 2 + ZERO_U_SIDE_GAP / 2) + lane.offsetX,
      channelZ: exteriorFaceZ(layout, dimensions, 'front') + 0.04 + lane.offsetZ,
      lateralZ: port.z,
      isSideZeroU: true,
      drop
    };
  }

  const face = box.isZeroU
    ? ((device.outletFacing ?? 'forward') === 'outward' ? 'rear' : 'front')
    : getCablePortFace(device, portRef);
  const zSign = face === 'front' ? 1 : -1;
  const rearPatch = device.category === 'patch-panel' && face === 'rear';
  const side = rearPatch ? (port.x < 0 ? -1 : 1) : channelSideSign;
  const columnX = (box.isRearRail0U
    ? (getZeroUEarSide(device) === 'left' ? -1 : 1) * (Math.abs(box.x) + box.width / 2 + 0.12)
    : rearPatch ? side * (rackWidth / 2 + CHANNEL_X_OFFSET) : channelX) + lane.offsetX;
  let rearBundle: RouteEndpoint['rearBundle'];
  if (rearPatch && portRef) {
    const slots = getDevicePortSurfaces(device, box).find((surface) => surface.face === 'rear')!.slots
      .filter((slot) => (box.x + slot.position.x < 0 ? -1 : 1) === side
        && Math.abs(box.y + slot.position.y - port.y) < 0.001)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const index = slots.findIndex((slot) => slot.type === portRef.type && slot.index === portRef.index);
    if (index >= 0) {
      const group = Math.floor(index / 4);
      const members = slots.slice(group * 4, group * 4 + 4);
      const xs = members.map((slot) => box.x + slot.position.x);
      rearBundle = {
        id: `${device.id}:rear:${side}:${port.y.toFixed(4)}:${group}`,
        x: (Math.min(...xs) + Math.max(...xs)) / 2 + side * 0.12,
        y: box.y + members.reduce((sum, slot) => sum + slot.position.y, 0) / members.length,
        rank: index % 4,
        width: Math.max(0.18, Math.max(...xs) - Math.min(...xs) + 0.08)
      };
    }
  }
  // Only equipment in the lateral corridor can force a deeper exit. A deep
  // server elsewhere in the rack must not drag every shallow device's cable
  // all the way to the rear before it can turn towards a side channel.
  let lateralExtent = zSign * port.z + PORT_LEAD_OUT;
  // Advance only past solids intersecting the current lateral plane. A rear
  // brush panel with open space between it and this socket must not force a
  // cable all the way across that space before it can turn sideways.
  for (let pass = 0; pass < layout.devices.length; pass++) {
    const previousExtent = lateralExtent;
    for (const neighbour of layout.devices) {
      if (neighbour.id === device.id) continue;
      const obstacle = getDeviceWorldBox(layout, neighbour, dimensions);
      const inRow = obstacle.y + obstacle.height / 2 + 0.06 > port.y - drop
        && obstacle.y - obstacle.height / 2 - 0.06 < port.y;
      const corridorStart = rearBundle ? rearBundle.x - side * (rearBundle.width / 2 + 0.12) : port.x;
      const inCorridor = obstacle.x + obstacle.width / 2 + 0.06 > Math.min(corridorStart, columnX)
        && obstacle.x - obstacle.width / 2 - 0.06 < Math.max(corridorStart, columnX);
      const intersectsPlane = lateralExtent > zSign * obstacle.z - obstacle.depth / 2 - 0.06
        && lateralExtent < zSign * obstacle.z + obstacle.depth / 2 + 0.06;
      if (inRow && inCorridor && intersectsPlane) lateralExtent = Math.max(lateralExtent, zSign * obstacle.z + obstacle.depth / 2 + 0.1);
    }
    if (lateralExtent === previousExtent) break;
  }
  // Data and power occupy separate depth lanes on either side (ADR-008:
  // the source port chooses the rail, never the cable type).
  const separationOffset = (separation === 'power' ? -0.035 : 0.035) + lane.offsetZ * 0.35;
  return {
    port,
    face,
    lead: pt(0, 0, zSign),
    columnX,
    channelZ: zSign * Math.max(zSign * exteriorFaceZ(layout, dimensions, face) + 0.02, zSign * port.z + PORT_LEAD_OUT) + separationOffset,
    lateralZ: zSign * lateralExtent,
    rearBundle,
    isSideZeroU: false,
    drop
  };
}

const exitPoint = (endpoint: RouteEndpoint): WorldPoint =>
  pt(
    endpoint.port.x + endpoint.lead.x * PORT_LEAD_OUT,
    endpoint.port.y + endpoint.lead.y * PORT_LEAD_OUT,
    endpoint.port.z + endpoint.lead.z * PORT_LEAD_OUT
  );

/**
 * Side-channel trunk path: short port exit -> row-local lateral run ->
 * depth run at the side -> vertical trunk -> destination approach.
 * Side-mounted 0U outlets first leave through their side gap in X.
 */
function appendBezier(points: WorldPoint[], a: WorldPoint, b: WorldPoint, c: WorldPoint, d: WorldPoint): void {
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const s = 1 - t;
    pushPoint(points,
      s ** 3 * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t ** 3 * d.x,
      s ** 3 * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t ** 3 * d.y,
      s ** 3 * a.z + 3 * s * s * t * b.z + 3 * s * t * t * c.z + t ** 3 * d.z);
  }
}

/** Curved four-port fan-out. Geometry stays local to the panel; only the
 * gathered bundle travels in depth at the rack side. */
function buildRearBundleLeg(endpoint: RouteEndpoint, mode: CableRoutingMode, boxes: DeviceWorldBox[], obstacles: ReturnType<typeof getRouteObstacles>): { points: WorldPoint[]; guide: RearCableGuide } | null {
  const bundle = endpoint.rearBundle;
  if (!bundle) return null;
  const side = endpoint.columnX < 0 ? -1 : 1;
  const loose = mode === 'realistic' ? 1.5 : 1;
  const strand = (bundle.rank - 1.5) * 0.014;
  let safeDrop = 0.12;
  // All four strands share clearance and a tie position, including ports
  // whose cables are currently hidden or not connected yet.
  const innerX = bundle.x - side * (bundle.width / 2 + 0.12);
  for (const box of boxes) {
    if (box.x + box.width / 2 < Math.min(innerX, endpoint.columnX) || box.x - box.width / 2 > Math.max(innerX, endpoint.columnX)) continue;
    if (box.z - box.depth / 2 > endpoint.lateralZ || box.z + box.depth / 2 < endpoint.lateralZ - 0.65) continue;
    if (box.y + box.height / 2 < bundle.y) safeDrop = Math.min(safeDrop, Math.max(0, bundle.y - box.y - box.height / 2 - 0.055));
  }
  for (const drop of [safeDrop, 0]) {
    const points = [endpoint.port, exitPoint(endpoint)];
    const exit = points[1];
    pushPoint(points, exit.x, exit.y, endpoint.lateralZ);
    const start = points[points.length - 1];
    const tie = pt(bundle.x, bundle.y - drop, endpoint.lateralZ - 0.22);
    const gathered = pt(tie.x, tie.y + strand, tie.z + strand);
    appendBezier(points, start, pt(start.x, start.y, start.z - 0.13 * loose),
      pt(gathered.x - side * 0.15, gathered.y, gathered.z), gathered);
    const sideEntry = pt(endpoint.columnX, gathered.y, gathered.z - 0.15);
    appendBezier(points, gathered,
      pt(gathered.x + (sideEntry.x - gathered.x) * 0.45, gathered.y - 0.035 * loose, gathered.z),
      pt(sideEntry.x, sideEntry.y, sideEntry.z + 0.12 * loose), sideEntry);
    pushPoint(points, endpoint.columnX, sideEntry.y, Math.min(endpoint.channelZ, sideEntry.z - 0.04));
    // A crowded row can prohibit downward slack. Keep the horizontal fan-out
    // in that case, rather than pushing the entire harness through equipment.
    // The socket itself is deliberately on the face, so test after lead-out.
    const bodyBlocked = points.slice(2).some((p) => boxes.some((box) =>
      Math.abs(p.x - box.x) < box.width / 2 + 0.025 &&
      Math.abs(p.y - box.y) < box.height / 2 + 0.025 &&
      Math.abs(p.z - box.z) < box.depth / 2 + 0.025));
    const guide = { id: bundle.id, tie, support: { center: pt(tie.x, tie.y - 0.085, tie.z), size: pt(bundle.width, 0.025, 0.12) } };
    const hardwareBlocked = [guide.support, { center: tie, size: pt(0.025, 0.14, 0.14) }]
      .some((part) => obstacles.some((obstacle) => overlapsObstacle(part, obstacle, 0.01)));
    if (!bodyBlocked && !hardwareBlocked) return { points, guide };
  }
  return null;
}

/** A supported crossing behind the equipment, attached to both rear posts.
 * Prefer a nearby rear cable manager; otherwise use the receiving row. */
function buildCrossover(
  layout: RackLayout,
  dimensions: RackWorldDimensions,
  b: WorldPoint
): CableCrossover | null {
  const managers = layout.devices
    .filter((device) => device.category === 'cable-management' && device.mountSide === 'rear')
    .map((device) => ({ id: device.id, box: getDeviceWorldBox(layout, device, dimensions) }))
    .sort(
      (first, second) =>
        Math.abs(first.box.y - b.y) - Math.abs(second.box.y - b.y) || first.id.localeCompare(second.id)
    );
  const limit = Math.max(0, dimensions.rackHeight / 2 - 0.12);
  const rowHeight = dimensions.rackHeight / Math.max(1, layout.heightU);
  const rows = Array.from(
    { length: layout.heightU },
    (_, index) => dimensions.bottom + (index + 0.5) * rowHeight
  ).sort((a, c) => Math.abs(a - b.y) - Math.abs(c - b.y) || a - c);
  const heights = [...managers.map((manager) => manager.box.y), ...rows];
  const obstacles = getRouteObstacles(layout);
  for (const height of heights) {
    const y = Math.max(-limit, Math.min(limit, height));
    const z = exteriorFaceZ(layout, dimensions, 'rear') - 0.1;
    const rearPostZ = -dimensions.rackDepth / 2;
    const barZ = z - 0.08;
    const halfWidth = dimensions.rackWidth / 2;
    const members: SceneBox[] = [
      {
        center: pt(0, y, barZ),
        size: pt(dimensions.rackWidth + 2 * (CHANNEL_X_OFFSET + 0.08), 0.045, 0.05)
      }
    ];
    for (const sign of [-1, 1]) {
      members.push(
        { center: pt(sign * halfWidth, y, rearPostZ), size: pt(0.09, 0.14, 0.06) },
        { center: pt(sign * halfWidth, y, (rearPostZ + barZ) / 2), size: pt(0.045, 0.045, rearPostZ - barZ) }
      );
    }
    const clips = [-0.9, -0.45, 0, 0.45, 0.9].map((fraction) => pt(fraction * halfWidth, y, z));
    const envelopes = [...members, ...clips.map((center) => ({ center, size: pt(0.03, 0.18, 0.18) }))];
    if (envelopes.some((part) => obstacles.some((obstacle) => overlapsObstacle(part, obstacle, 0.015))))
      continue;
    return {
      id: `rear-crossing:${y.toFixed(4)}`,
      center: pt(0, y, z),
      members,
      clips
    };
  }
  return null;
}

function buildTrunkPoints(from: RouteEndpoint, to: RouteEndpoint, layout: RackLayout, dimensions: RackWorldDimensions, mode: CableRoutingMode, rearGuides: RearCableGuide[], crossovers: CableCrossover[], lane: RouteLane): WorldPoint[] {
  const boxes = layout.devices.map((device) => getDeviceWorldBox(layout, device, dimensions));
  const leg = (endpoint: RouteEndpoint): WorldPoint[] => {
    const bundled = buildRearBundleLeg(endpoint, mode, boxes, getRouteObstacles(layout));
    if (bundled) {
      rearGuides.push(bundled.guide);
      return bundled.points;
    }
    const points = [endpoint.port, exitPoint(endpoint)];
    const exit = points[1];
    if (endpoint.isSideZeroU) {
      pushPoint(points, endpoint.columnX, exit.y, exit.z);
      pushPoint(points, endpoint.columnX, exit.y, endpoint.channelZ);
    } else {
      pushPoint(points, exit.x, exit.y, endpoint.lateralZ);
    }
    const last = points[points.length - 1];
    if (endpoint.drop > 0) pushPoint(points, last.x, exit.y - endpoint.drop, last.z);
    pushPoint(points, endpoint.columnX, exit.y - endpoint.drop, last.z);
    pushPoint(points, endpoint.columnX, exit.y - endpoint.drop, endpoint.channelZ);
    return points;
  };
  const fromLeg = leg(from);
  const toLeg = leg(to);
  const a = fromLeg[fromLeg.length - 1];
  const b = toLeg[toLeg.length - 1];
  const points = [...fromLeg];
  if (a.x * b.x < 0 && (from.rearBundle || to.rearBundle)) {
    const support = buildCrossover(layout, dimensions, b);
    if (!support) return [];
    crossovers.push(support);
    // All strands pass through the clip openings; the support is shared and
    // stable regardless of visibility. No crossing rises above the rack.
    const y = support.center.y + ((lane.index % 5) - 2) * 0.018;
    const z = support.center.z + lane.offsetZ * 0.3;
    pushPoint(points, a.x, y, a.z);
    pushPoint(points, a.x, y, z);
    pushPoint(points, b.x, y, z);
    pushPoint(points, b.x, y, b.z);
    pushPoint(points, b.x, b.y, b.z);
    for (const point of [...toLeg].reverse()) pushPoint(points, point.x, point.y, point.z);
    return points;
  }
  pushPoint(points, a.x, b.y, a.z);
  pushPoint(points, b.x, b.y, a.z);
  for (const point of [...toLeg].reverse()) pushPoint(points, point.x, point.y, point.z);
  return points;
}

/**
 * Direct same-face path (patch cords and short jumpers): drops out of the
 * port, runs through the horizontal-manager space, and rises back in.
 */
function buildManagerPoints(
  layout: RackLayout,
  plan: CablePlan,
  from: RouteEndpoint,
  to: RouteEndpoint,
  dimensions: RackWorldDimensions,
  lane: RouteLane,
  routingMode: CableRoutingMode,
  roundedPatch: boolean
): WorldPoint[] {
  const { rackWidth, rackDepth, rackHeight } = dimensions;
  const points: WorldPoint[] = [];
  const faceSign = from.face === 'front' ? 1 : -1;
  const fromExit = exitPoint(from);
  const toExit = exitPoint(to);

  const managerWaypoint = plan.waypoints.find((waypoint) => waypoint.role === 'horizontal-manager' && waypoint.deviceId);
  const managerDevice = managerWaypoint?.deviceId
    ? layout.devices.find((device) => device.id === managerWaypoint.deviceId)
    : undefined;
  const managerBox = managerDevice
    ? getDeviceWorldBox(layout, managerDevice, { rackWidth, rackDepth, rackHeight, bottom: -rackHeight / 2 })
    : null;

  const proposedLaneZ = managerBox
    ? managerBox.z + faceSign * (managerBox.depth / 2) + faceSign * (0.05 + (lane.index % 6) * 0.02)
    : fromExit.z + faceSign * (0.09 + (lane.index % 6) * 0.02);
  const managerY = (managerBox ? managerBox.y : (from.port.y + to.port.y) / 2) + lane.offsetZ * 0.5;
  const exitZ = faceSign * Math.max(faceSign * fromExit.z, faceSign * toExit.z, faceSign * exteriorFaceZ(layout, dimensions, from.face));
  const laneZ = faceSign * Math.max(faceSign * proposedLaneZ, faceSign * exitZ);

  if (roundedPatch) {
    // Half-ellipse out in front of the rack, with a gentle U-shaped drape.
    // Both ends leave their sockets in +Z before any downward/sideways bend.
    const verticalGap = Math.abs(from.port.y - to.port.y);
    const horizontalGap = Math.abs(to.port.x - from.port.x);
    const loose = routingMode === 'realistic' ? 1.25 : 1;
    const sag = Math.min(0.35, 0.08 + verticalGap * 0.3) * loose;
    const bulge = Math.min(0.5, Math.max(0.18, Math.hypot(horizontalGap, verticalGap) * 0.4)) * loose;
    const sideBow = horizontalGap < 0.15 ? (from.port.x + to.port.x < 0 ? -1 : 1) * (0.1 + (lane.index % 3) * 0.025) : 0;
    const loopZ = Math.max(exitZ, laneZ) + (lane.index % 4) * 0.015;
    pushPoint(points, from.port.x, from.port.y, from.port.z);
    pushPoint(points, fromExit.x, fromExit.y, fromExit.z);
    pushPoint(points, from.port.x, from.port.y, loopZ);
    for (let i = 1; i < 32; i++) {
      const angle = Math.PI * i / 32;
      const mix = (1 - Math.cos(angle)) / 2;
      const bow = Math.sin(angle) ** 2;
      pushPoint(points,
        from.port.x + (to.port.x - from.port.x) * mix + sideBow * bow,
        from.port.y + (to.port.y - from.port.y) * mix - sag * bow,
        loopZ + bulge * Math.sin(angle));
    }
    pushPoint(points, to.port.x, to.port.y, loopZ);
    pushPoint(points, toExit.x, toExit.y, toExit.z);
    pushPoint(points, to.port.x, to.port.y, to.port.z);
    return points;
  }

  pushPoint(points, from.port.x, from.port.y, from.port.z);
  pushPoint(points, fromExit.x, fromExit.y, fromExit.z);
  pushPoint(points, fromExit.x, fromExit.y, exitZ);
  pushPoint(points, fromExit.x, managerY, exitZ);
  pushPoint(points, fromExit.x, managerY, laneZ);
  pushPoint(points, toExit.x, managerY, laneZ);
  pushPoint(points, toExit.x, managerY, exitZ);
  pushPoint(points, toExit.x, toExit.y, exitZ);
  pushPoint(points, toExit.x, toExit.y, toExit.z);
  pushPoint(points, to.port.x, to.port.y, to.port.z);
  return points;
}

export type ManagedRouteOptions = {
  routingMode?: CableRoutingMode;
  /**
   * Precomputed deterministic lane ranks per cable id (from
   * `buildLaneAssignments`). When omitted, ranks are computed per call — fine
   * for single-route previews.
   */
  laneIndexById?: Map<string, number>;
};

/**
 * Deterministic lane ranks: cables are grouped by plan separation (data/power),
 * sorted by id inside each group, and numbered. Independent of filter state,
 * so hiding cables never reshuffles the remaining lanes.
 */
export function buildLaneAssignments(
  layout: RackLayout,
  plans?: Map<string, CablePlan>
): Map<string, number> {
  const groups = new Map<'data' | 'power', string[]>();
  for (const cable of layout.cables) {
    const plan = plans?.get(cable.id) ?? calculateCablePlan(cable, layout);
    if (!plan) continue;
    const list = groups.get(plan.separation) ?? [];
    list.push(cable.id);
    groups.set(plan.separation, list);
  }
  const lanes = new Map<string, number>();
  for (const list of groups.values()) {
    list.sort();
    list.forEach((id, index) => lanes.set(id, index));
  }
  return lanes;
}

type RearCandidate = {
  points: WorldPoint[];
  rearGuides: RearCableGuide[];
  crossovers: CableCrossover[];
  usesTrunk: boolean;
  kind: 'manual' | 'direct' | 'drop' | 'side' | 'manager';
  reason: string;
};

function directRearPoints(
  from: RouteEndpoint,
  to: RouteEndpoint,
  pocket: number,
  mode: CableRoutingMode
): WorldPoint[] {
  const start = exitPoint(from);
  const end = exitPoint(to);
  const points = [from.port, start];
  const a = pt(start.x, start.y - from.drop, start.z);
  const b = pt(end.x, end.y - to.drop, end.z);
  pushPoint(points, a.x, a.y, a.z);
  const z = Math.min(a.z, b.z) - pocket;
  const slack = mode === 'realistic' ? 0.065 : 0.025;
  appendBezier(points, a, pt(a.x, a.y - slack, z), pt(b.x, b.y - slack, z), b);
  pushPoint(points, end.x, end.y, end.z);
  pushPoint(points, to.port.x, to.port.y, to.port.z);
  return points;
}

/** Choose once from Clean geometry. Realistic may add clearance-tested slack,
 * but cannot silently choose a different rail, support, or route family. */
function chooseRearRoute(
  layout: RackLayout,
  dimensions: RackWorldDimensions,
  cable: CableRoute,
  from: RouteEndpoint,
  to: RouteEndpoint,
  lane: RouteLane,
  mode: CableRoutingMode
): RearCandidate | null {
  const allObstacles = getRouteObstacles(layout);
  const obstacles = allObstacles.filter(
    (obstacle) =>
      obstacle.kind === 'body' ||
      (obstacle.owner !== cable.fromDeviceId && obstacle.owner !== cable.toDeviceId)
  );
  const radius = Math.min(0.015, CABLE_RADIUS_MM[cable.type] / 1000);
  const clear = (candidate: RearCandidate) => {
    if (!routeIsClear(candidate.points, obstacles, radius)) return false;
    const supports = candidate.rearGuides.flatMap((guide) => [
      guide.support,
      { center: guide.tie, size: pt(0.025, 0.14, 0.14) }
    ]);
    return !supports.some((support) =>
      allObstacles.some((obstacle) => overlapsObstacle(support, obstacle, 0.01))
    );
  };
  const factories: ((style: CableRoutingMode) => RearCandidate)[] = [];
  // Short free spans and gravity drops do not automatically need hardware.
  // The limit is a conservative visual heuristic in this approximate scene.
  if (dist(from.port, to.port) <= 2.4 && Math.abs(from.port.x - to.port.x) <= 1.5) {
    const drop = Math.abs(from.port.y - to.port.y) > Math.abs(from.port.x - to.port.x) + 0.15;
    for (const pocket of [0.12, 0.28, 0.5])
      factories.push((style) => ({
        points: directRearPoints(from, to, pocket, style),
        rearGuides: [],
        crossovers: [],
        usesTrunk: false,
        kind: drop ? 'drop' : 'direct',
        reason: drop ? 'Natural drop · no added support' : 'Direct rear connection · no added support'
      }));
  }
  for (const manager of layout.devices
    .filter((device) => device.category === 'cable-management' && device.mountSide === 'rear')
    .sort((a, b) => a.id.localeCompare(b.id))) {
    factories.push(() => {
      const box = getDeviceWorldBox(layout, manager, dimensions);
      const a = exitPoint(from);
      const b = exitPoint(to);
      const z = exteriorFaceZ(layout, dimensions, 'rear');
      return {
        points: [
          from.port,
          a,
          pt(a.x, a.y - from.drop, z),
          pt(a.x, box.y, z),
          pt(a.x, box.y, box.z),
          pt(b.x, box.y, box.z),
          pt(b.x, box.y, z),
          pt(b.x, b.y - to.drop, z),
          b,
          to.port
        ],
        rearGuides: [],
        crossovers: [],
        usesTrunk: false,
        kind: 'manager',
        reason: `Via ${manager.label || manager.name}`
      };
    });
  }
  const preferred = from.port.x < 0 ? -1 : 1;
  for (const side of [preferred, -preferred])
    for (const bundled of [true, false])
      factories.push((style) => {
        const columnX = side * (dimensions.rackWidth / 2 + CHANNEL_X_OFFSET) + lane.offsetX;
        const fromDevice = layout.devices.find((device) => device.id === cable.fromDeviceId)!;
        const toDevice = layout.devices.find((device) => device.id === cable.toDeviceId)!;
        const separation = cable.type === 'power' ? 'power' : 'data';
        // Recompute lateral clearance for the candidate side, rather than reusing
        // the opposite corridor's obstacles. Panel fan-outs keep their local side.
        const a = buildEndpoint(layout, fromDevice, cable.fromPort, separation, dimensions, lane, side);
        const b = buildEndpoint(layout, toDevice, cable.toPort, separation, dimensions, lane, side);
        if (!bundled) {
          a.rearBundle = undefined;
          b.rearBundle = undefined;
        }
        if (!a.rearBundle) a.columnX = columnX;
        if (!b.rearBundle) b.columnX = columnX;
        const rearGuides: RearCableGuide[] = [];
        const crossovers: CableCrossover[] = [];
        const points = buildTrunkPoints(a, b, layout, dimensions, style, rearGuides, crossovers, lane);
        return {
          points,
          rearGuides,
          crossovers,
          usesTrunk: true,
          kind: 'side',
          reason: `Via ${side < 0 ? 'left' : 'right'} side channel`
        };
      });
  const candidates = factories
    .map((build, index) => ({ build, index, candidate: build('clean') }))
    .filter(({ candidate }) => clear(candidate))
    .map((item) => ({
      ...item,
      score:
        routeLength(item.candidate.points) +
        item.candidate.crossovers.length * 0.8 +
        item.candidate.rearGuides.length * 0.15 +
        (item.candidate.usesTrunk ? 0.2 : 0)
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const best = candidates[0];
  if (!best) return null;
  if (mode === 'clean') return best.candidate;
  const realistic = best.build('realistic');
  const sameSupports =
    JSON.stringify([realistic.crossovers, realistic.rearGuides]) ===
    JSON.stringify([best.candidate.crossovers, best.candidate.rearGuides]);
  return sameSupports && clear(realistic) ? realistic : best.candidate;
}

function buildManagedRoute(
  cable: CableRoute,
  plan: CablePlan,
  layout: RackLayout,
  dimensions: RackWorldDimensions,
  lane: RouteLane,
  routingMode: CableRoutingMode
): ManagedRoute | null {
  const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
  const to = layout.devices.find((device) => device.id === cable.toDeviceId);
  if (!from || !to) return null;

  const hasRailNodes = plan.nodes.some((node) => node.type === 'v-rail-left' || node.type === 'v-rail-right');
  const sourcePort = getDevicePortWorldPosition(layout, from, cable.fromPort, dimensions);
  const channelSideSign = sourcePort.x < 0 ? -1 : 1;
  const fromEndpoint = buildEndpoint(layout, from, cable.fromPort, plan.separation, dimensions, lane, channelSideSign);
  const toEndpoint = buildEndpoint(layout, to, cable.toPort, plan.separation, dimensions, lane, channelSideSign);
  const sameFace = fromEndpoint.face === toEndpoint.face;
  // Rear jumpers also use the side channels; direct manager paths are only
  // useful for visible front patching, not a web across the rear access area.
  let usesTrunk = hasRailNodes || !sameFace || fromEndpoint.face === 'rear';

  const roundedPatch = !usesTrunk && fromEndpoint.face === 'front' && toEndpoint.face === 'front'
    && (plan.discipline === 'patch' || from.category === 'patch-panel' || to.category === 'patch-panel');
  let rearGuides: RearCableGuide[] = [];
  let crossovers: CableCrossover[] = [];
  let points = usesTrunk
    ? buildTrunkPoints(fromEndpoint, toEndpoint, layout, dimensions, routingMode, rearGuides, crossovers, lane)
    : buildManagerPoints(layout, plan, fromEndpoint, toEndpoint, dimensions, lane, routingMode, roundedPatch);

  if (routingMode === 'realistic' && !roundedPatch && rearGuides.length === 0) {
    points = insertGravitySag(points, plan.render.sagMm / 1000, dimensions);
  }

  let routingDecision: ManagedRoute['routingDecision'] = { kind: usesTrunk ? 'side' : 'front', reason: usesTrunk ? 'Managed side route' : 'Front patching' };
  if (fromEndpoint.face === 'rear' && toEndpoint.face === 'rear' && from.sizeU > 0 && to.sizeU > 0) {
    const chosen = chooseRearRoute(layout, dimensions, cable, fromEndpoint, toEndpoint, lane, routingMode);
    points = chosen?.points ?? [];
    rearGuides = chosen?.rearGuides ?? [];
    crossovers = chosen?.crossovers ?? [];
    usesTrunk = chosen?.usesTrunk ?? false;
    routingDecision = chosen ? { kind: chosen.kind, reason: chosen.reason }
      : { kind: 'blocked', reason: 'No clear rear route. Review device spacing or cable management.' };
  } else if (points.length < 2) {
    rearGuides = [];
    crossovers = [];
    routingDecision = { kind: 'blocked', reason: 'No clear position for a rear support. Review PDU and connector clearance.' };
  }

  if (cable.manualPath !== undefined) {
    const manual = manualRoutePoints(cable, layout);
    const obstacles = getRouteObstacles(layout).filter(o => o.kind === 'body' || (o.owner !== from.id && o.owner !== to.id));
    const clear = routeIsClear(manual, obstacles);
    points = clear ? manual : [];
    rearGuides = [];
    crossovers = [];
    usesTrunk = Array.isArray(cable.manualPath) && cable.manualPath.some(anchor => anchor?.kind === 'channel');
    routingDecision = clear
      ? { kind: 'manual', reason: `Custom route · ${cable.manualPath.length} routing points` }
      : { kind: 'blocked', reason: 'Custom route is obstructed or a routing point is missing. Redraw the route.' };
  }

  return {
    cableId: cable.id,
    cable,
    plan,
    fromPort: fromEndpoint.port,
    toPort: toEndpoint.port,
    points,
    color: getCableDisplayColor(cable.type, cable.color || DEFAULT_CABLE_COLORS[cable.type]),
    radiusMm: Math.max(CABLE_RADIUS_MM[cable.type], plan.render.cableRadiusMm),
    separation: plan.separation,
    discipline: plan.discipline,
    usesTrunk,
    lane,
    rearGuides,
    crossovers,
    routingDecision
  };
}

/**
 * Build a single managed route — used for the planner preview cable, where
 * the lane rank is supplied by the caller (e.g. count of visible same-group
 * routes).
 */
export function buildPreviewRoute(
  cable: CableRoute,
  layout: RackLayout,
  laneIndex: number,
  routingMode: CableRoutingMode = 'clean'
): ManagedRoute | null {
  const plan = calculateCablePlan(cable, layout);
  if (!plan) return null;
  const dimensions = getRackWorldDimensions(layout);
  const lane: RouteLane = { index: laneIndex, ...laneOffsetForIndex(laneIndex) };
  return buildManagedRoute(cable, plan, layout, dimensions, lane, routingMode);
}

/* ------------------------------------------------------------------ */
/*  Scene model entry point                                            */
/* ------------------------------------------------------------------ */

export function buildRackSceneModel(
  layout: RackLayout,
  options: ManagedRouteOptions = {}
): RackSceneModel {
  const routingMode = options.routingMode ?? 'clean';
  const dimensions = getRackWorldDimensions(layout);

  const plans = new Map<string, CablePlan>();
  for (const cable of layout.cables) {
    const plan = calculateCablePlan(cable, layout);
    if (plan) plans.set(cable.id, plan);
  }
  const laneIndexById = options.laneIndexById ?? buildLaneAssignments(layout, plans);

  const routes: ManagedRoute[] = [];
  for (const cable of layout.cables) {
    const plan = plans.get(cable.id);
    if (!plan) continue;
    const index = laneIndexById.get(cable.id) ?? 0;
    const lane: RouteLane = { index, ...laneOffsetForIndex(index) };
    const route = buildManagedRoute(cable, plan, layout, dimensions, lane, routingMode);
    if (route) routes.push(route);
  }

  return {
    dimensions,
    frame: buildFrame(dimensions),
    channels: buildChannels(dimensions),
    devices: buildDeviceSolids(layout, dimensions),
    routes,
    rearGuides: [...new Map(routes.flatMap((route) => route.rearGuides).map((guide) => [guide.id, guide])).values()].sort((a, b) => a.id.localeCompare(b.id)),
    crossovers: [...new Map(routes.flatMap((route) => route.crossovers).map((support) => [support.id, support])).values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}

export const SCENE_COLORS = {
  frame: FRAME_COLOR,
  rail: RAIL_COLOR,
  dataAccent: DATA_ACCENT,
  powerAccent: POWER_ACCENT
};

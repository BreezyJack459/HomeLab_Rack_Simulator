import type {
  CableNode,
  CablePlan,
  CableRoute,
  CableRoutingDiscipline,
  CableRoutingWarning,
  CableSegment,
  CableType,
  CableWaypoint,
  PlacedDevice,
  PortRef,
  RackLayout
} from '../types/rack';
import { ENABLE_ZERO_U_PDU } from './featureFlags';
import { getPortFaceMap } from './portLayout';
import { getDeviceXRange } from './rackMath';

const STANDARD_U_MM = 44.45;
const CABLE_SLACK_MM = 300;
const FACE_EXIT_MM = 120;
const MANAGER_HOP_MM = 180;
const SIDE_TRAY_CLEARANCE_MM = 260;
const FRONT_SERVICE_LOOP_MM = 180;
const POWER_DRIP_LOOP_MM = 280;
const STRUCTURED_SLACK_MM = 380;
const DATA_SLACK_MM = 300;
const PATCH_SLACK_MM = 180;
const STANDARD_CABLE_LENGTHS_MM = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000];
const RACK_USABLE_WIDTH_MM: Record<RackLayout['rackType'], number> = {
  '10in': 254,
  '19in': 482.6
};

const TYPE_LANE: Record<CableType, number> = {
  ethernet: 0,
  patch: 0,
  fiber: 1,
  power: 2,
  usb: 3,
  hdmi: 4,
  atx: 5,
  coax: 6,
  structured: 7
};

const CABLE_RADIUS_MM: Record<CableType, number> = {
  ethernet: 5,
  patch: 5,
  fiber: 3,
  power: 7,
  usb: 4,
  hdmi: 6,
  atx: 4,
  coax: 5,
  structured: 4
};

const BEND_RADIUS_MM: Record<CableType, number> = {
  ethernet: 28,
  patch: 24,
  fiber: 45,
  power: 55,
  usb: 24,
  hdmi: 48,
  atx: 24,
  coax: 40,
  structured: 32
};

export function isPdu(device: PlacedDevice): boolean {
  return device.category === 'pdu' || (ENABLE_ZERO_U_PDU && device.category === 'pdu-0u');
}

function isPatchPanel(device: PlacedDevice): boolean {
  return device.category === 'patch-panel';
}

function isSwitch(device: PlacedDevice): boolean {
  return device.category === 'switch';
}

function isCableManager(device: PlacedDevice): boolean {
  return device.category === 'cable-management';
}

function isNetworkCable(type: CableType): boolean {
  return type === 'ethernet' || type === 'fiber' || type === 'patch' || type === 'structured';
}

function portFace(device: PlacedDevice, portRef?: PortRef): 'front' | 'rear' {
  if (device.category === 'patch-panel' && portRef?.side) {
    return portRef.side;
  }
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  return (faceMap[portRef?.type ?? 'ethernet'] ?? 'rear') as 'front' | 'rear';
}

function deviceCenterXMm(layout: RackLayout, device: PlacedDevice): number {
  const range = getDeviceXRange(layout, device);
  return range.x + range.width / 2;
}

function deviceCenterUMm(device: PlacedDevice): number {
  if (device.sizeU === 0) return device.positionU * STANDARD_U_MM;
  return (device.positionU + (device.sizeU - 1) / 2) * STANDARD_U_MM;
}

function deviceRoutingFace(device: PlacedDevice): 'front' | 'rear' {
  if (device.spatialZone === 'rear' || device.spatialZone === 'rear-left' || device.spatialZone === 'rear-right') return 'rear';
  return device.mountSide ?? 'front';
}

function nearestHorizontalManager(
  layout: RackLayout,
  from: PlacedDevice,
  to: PlacedDevice,
  face: 'front' | 'rear'
): PlacedDevice | null {
  const midpointU = (deviceCenterUMm(from) + deviceCenterUMm(to)) / 2;
  const managers = layout.devices
    .filter((device) => isCableManager(device) && device.sizeU > 0 && deviceRoutingFace(device) === face)
    .sort((a, b) => {
      const aDistance = Math.abs(deviceCenterUMm(a) - midpointU);
      const bDistance = Math.abs(deviceCenterUMm(b) - midpointU);
      return aDistance - bDistance || a.positionU - b.positionU;
    });
  return managers[0] ?? null;
}

function zeroUEarSide(device: PlacedDevice): 'left' | 'right' {
  if (device.spatialZone) {
    return device.spatialZone.includes('left') ? 'left' : 'right';
  }
  if (device.mountSide0U) return device.mountSide0U;
  return (device.xMm ?? 0) < 0 ? 'left' : 'right';
}

export function standardCableLength(estimatedMm: number): number {
  for (const length of STANDARD_CABLE_LENGTHS_MM) {
    if (estimatedMm <= length) return length;
  }
  return STANDARD_CABLE_LENGTHS_MM[STANDARD_CABLE_LENGTHS_MM.length - 1];
}

export function estimateCableLength(
  layout: RackLayout,
  cable: Pick<CableRoute, 'fromDeviceId' | 'toDeviceId' | 'lengthMm'>
): number {
  if (cable.lengthMm && cable.lengthMm > 0) return cable.lengthMm;

  if ('id' in cable && 'type' in cable) {
    const plan = calculateCablePlan(cable as CableRoute, layout);
    if (plan) return standardCableLength(plan.estimatedLengthMm);
  }

  const from = layout.devices.find((d) => d.id === cable.fromDeviceId);
  const to = layout.devices.find((d) => d.id === cable.toDeviceId);
  if (!from || !to) return 0;

  const fromCenterU = from.positionU + (from.sizeU - 1) / 2;
  const toCenterU = to.positionU + (to.sizeU - 1) / 2;
  const verticalMm = Math.abs(fromCenterU - toCenterU) * STANDARD_U_MM;

  const fromRange = getDeviceXRange(layout, from);
  const toRange = getDeviceXRange(layout, to);
  const fromCenterX = fromRange.x + fromRange.width / 2;
  const toCenterX = toRange.x + toRange.width / 2;
  const horizontalMm = Math.abs(fromCenterX - toCenterX);

  return standardCableLength(verticalMm + horizontalMm + CABLE_SLACK_MM);
}

function classifyDiscipline(cable: CableRoute, from: PlacedDevice, to: PlacedDevice): CableRoutingDiscipline {
  if (cable.type === 'power') return 'power';
  if (cable.type === 'structured') return 'structured';
  if (cable.type === 'patch') return 'patch';
  if ((isPatchPanel(from) && isSwitch(to)) || (isSwitch(from) && isPatchPanel(to))) {
    const fromFace = portFace(from, cable.fromPort);
    const toFace = portFace(to, cable.toPort);
    if (fromFace === 'front' && toFace === 'front') return 'patch';
  }
  return 'data';
}

function directFrontPath(cable: CableRoute, from: PlacedDevice, to: PlacedDevice): boolean {
  if (cable.type === 'power' || cable.type === 'structured') return false;
  const fromFace = portFace(from, cable.fromPort);
  const toFace = portFace(to, cable.toPort);
  if (fromFace !== 'front' || toFace !== 'front') return false;
  const uDistance = Math.abs(
    from.positionU + (from.sizeU - 1) / 2 - (to.positionU + (to.sizeU - 1) / 2)
  );
  return cable.type === 'patch' || uDistance <= 4;
}

function consumerDeviceForRouting(discipline: CableRoutingDiscipline, from: PlacedDevice, to: PlacedDevice): PlacedDevice {
  if (discipline === 'power') {
    if (isPdu(from) && !isPdu(to)) return to;
    if (isPdu(to) && !isPdu(from)) return from;
  }
  return isPatchPanel(from) ? to : isPatchPanel(to) ? from : from;
}

function nearestRailForDevice(layout: RackLayout, device: PlacedDevice): 'left' | 'right' {
  if (device.sizeU === 0) return zeroUEarSide(device);
  return deviceCenterXMm(layout, device) < RACK_USABLE_WIDTH_MM[layout.rackType] / 2 ? 'left' : 'right';
}

function densityRailForCable(layout: RackLayout, cable: CableRoute, rail: 'left' | 'right' | null): 'left' | 'right' | null {
  const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
  const to = layout.devices.find((device) => device.id === cable.toDeviceId);
  if (!from || !to) return rail;
  const discipline = classifyDiscipline(cable, from, to);
  if (directFrontPath(cable, from, to)) return null;
  const pdu = discipline === 'power' ? (isPdu(from) ? from : isPdu(to) ? to : null) : null;
  if (pdu?.sizeU === 0) return zeroUEarSide(pdu);
  return nearestRailForDevice(layout, consumerDeviceForRouting(discipline, from, to));
}

// ── Rail stats cache for O(1) density / same-rail lookups ──

interface RailStats {
  deviceById: Map<string, PlacedDevice>;
  cableDensityRails: Map<string, 'left' | 'right' | null>;
  cablePreferredRails: Map<string, 'left' | 'right' | null>;
  cableSeparations: Map<string, 'data' | 'power'>;
  densityCounts: Map<string, number>; // key: `${rail}-${separation}`
  preferredCounts: Map<string, number>; // key: `${rail}-${separation}`
}

const railStatsCache = new Map<string, RailStats>();
const MAX_RAIL_CACHE = 8;

function getRailStats(layout: RackLayout): RailStats {
  const key = `${layout.id}:${layout.updatedAt}`;
  const cached = railStatsCache.get(key);
  if (cached) return cached;

  const stats = computeRailStats(layout);
  railStatsCache.set(key, stats);
  if (railStatsCache.size > MAX_RAIL_CACHE) {
    const first = railStatsCache.keys().next().value;
    if (first) railStatsCache.delete(first);
  }
  return stats;
}

function computeRailStats(layout: RackLayout): RailStats {
  const deviceById = new Map<string, PlacedDevice>();
  for (const device of layout.devices) {
    deviceById.set(device.id, device);
  }

  const cableDensityRails = new Map<string, 'left' | 'right' | null>();
  const densityCounts = new Map<string, number>();

  // First pass: densityRail for each cable (used by railDensity)
  for (const cable of layout.cables) {
    const from = deviceById.get(cable.fromDeviceId);
    const to = deviceById.get(cable.toDeviceId);
    if (!from || !to) {
      cableDensityRails.set(cable.id, null);
      continue;
    }
    const discipline = classifyDiscipline(cable, from, to);
    if (directFrontPath(cable, from, to)) {
      cableDensityRails.set(cable.id, null);
      continue;
    }
    const pdu = discipline === 'power' ? (isPdu(from) ? from : isPdu(to) ? to : null) : null;
    const rail = pdu?.sizeU === 0 ? zeroUEarSide(pdu) : nearestRailForDevice(layout, consumerDeviceForRouting(discipline, from, to));
    cableDensityRails.set(cable.id, rail);
    const separation = discipline === 'power' ? 'power' : 'data';
    if (rail) {
      const key = `${rail}-${separation}`;
      densityCounts.set(key, (densityCounts.get(key) ?? 0) + 1);
    }
  }

  const cablePreferredRails = new Map<string, 'left' | 'right' | null>();
  const cableSeparations = new Map<string, 'data' | 'power'>();
  const preferredCounts = new Map<string, number>();

  // Second pass: preferredRail for each cable (used by sameRailCount)
  for (const cable of layout.cables) {
    const from = deviceById.get(cable.fromDeviceId);
    const to = deviceById.get(cable.toDeviceId);
    if (!from || !to) {
      cablePreferredRails.set(cable.id, null);
      continue;
    }
    const discipline = classifyDiscipline(cable, from, to);
    if (directFrontPath(cable, from, to)) {
      cablePreferredRails.set(cable.id, null);
      continue;
    }

    let preferred: 'left' | 'right' | null = null;

    if (discipline === 'power') {
      const pdu = isPdu(from) ? from : isPdu(to) ? to : null;
      if (pdu?.sizeU === 0) {
        preferred = zeroUEarSide(pdu);
      }
    }

    const separation = discipline === 'power' ? 'power' : 'data';
    cableSeparations.set(cable.id, separation);

    if (preferred === null) {
      const naturalRail = nearestRailForDevice(layout, consumerDeviceForRouting(discipline, from, to));
      const candidates = (['left', 'right'] as const).map((rail) => {
        const rawLength = candidateLengthForRail(layout, cable, discipline, from, to, rail);
        const densityKey = `${rail}-${separation}`;
        const totalDensity = densityCounts.get(densityKey) ?? 0;
        const thisDensityRail = cableDensityRails.get(cable.id);
        const density = thisDensityRail === rail ? totalDensity - 1 : totalDensity;
        return {
          rail,
          rawLength,
          standardLength: standardCableLength(rawLength),
          density,
          naturalPenalty: rail === naturalRail ? 0 : 1
        };
      });
      candidates.sort((a, b) => (
        a.standardLength - b.standardLength ||
        a.rawLength - b.rawLength ||
        a.naturalPenalty - b.naturalPenalty ||
        a.density - b.density
      ));
      preferred = candidates[0].rail;
    }

    cablePreferredRails.set(cable.id, preferred);
    if (preferred) {
      const key = `${preferred}-${separation}`;
      preferredCounts.set(key, (preferredCounts.get(key) ?? 0) + 1);
    }
  }

  return { deviceById, cableDensityRails, cablePreferredRails, cableSeparations, densityCounts, preferredCounts };
}

function railDensity(layout: RackLayout, targetCable: CableRoute, rail: 'left' | 'right', separation: 'data' | 'power'): number {
  const stats = getRailStats(layout);
  const key = `${rail}-${separation}`;
  const total = stats.densityCounts.get(key) ?? 0;
  const thisRail = stats.cableDensityRails.get(targetCable.id);
  return thisRail === rail ? total - 1 : total;
}

function candidateLengthForRail(
  layout: RackLayout,
  cable: CableRoute,
  discipline: CableRoutingDiscipline,
  from: PlacedDevice,
  to: PlacedDevice,
  rail: 'left' | 'right'
): number {
  const { baseLengthMm } = segmentLengthForWaypoints(layout, cable, discipline, from, to, rail, []);
  return baseLengthMm + slackForDiscipline(discipline);
}

function preferredRail(layout: RackLayout, discipline: CableRoutingDiscipline, cable: CableRoute, from: PlacedDevice, to: PlacedDevice): 'left' | 'right' | null {
  if (directFrontPath(cable, from, to)) return null;

  if (discipline === 'power') {
    const pdu = isPdu(from) ? from : isPdu(to) ? to : null;
    if (pdu?.sizeU === 0) return zeroUEarSide(pdu);
  }

  const separation = discipline === 'power' ? 'power' : 'data';
  const naturalRail = nearestRailForDevice(layout, consumerDeviceForRouting(discipline, from, to));
  const candidates = (['left', 'right'] as const).map((rail) => {
    const rawLength = candidateLengthForRail(layout, cable, discipline, from, to, rail);
    return {
      rail,
      rawLength,
      standardLength: standardCableLength(rawLength),
      density: railDensity(layout, cable, rail, separation),
      naturalPenalty: rail === naturalRail ? 0 : 1
    };
  });
  candidates.sort((a, b) => (
    a.standardLength - b.standardLength ||
    a.rawLength - b.rawLength ||
    a.naturalPenalty - b.naturalPenalty ||
    a.density - b.density
  ));
  return candidates[0].rail;
}

function waypoint(id: string, role: CableWaypoint['role'], label: string, patch: Partial<CableWaypoint> = {}): CableWaypoint {
  return { id, role, label, ...patch };
}

function buildWaypoints(
  layout: RackLayout,
  cable: CableRoute,
  discipline: CableRoutingDiscipline,
  from: PlacedDevice,
  to: PlacedDevice,
  fromFace: 'front' | 'rear',
  toFace: 'front' | 'rear',
  rail: 'left' | 'right' | null
): CableWaypoint[] {
  const items: CableWaypoint[] = [
    waypoint('from-port', 'port', `${from.name} port`, {
      deviceId: from.id,
      port: cable.fromPort,
      nodeType: 'device',
      face: fromFace
    })
  ];

  if (discipline === 'patch' || rail === null) {
    const manager = nearestHorizontalManager(layout, from, to, 'front');
    const managerDeviceId = manager?.id ?? from.id;
    const managerLabel = manager ? `${manager.name} front manager` : 'front manager bus';
    items.push(
      waypoint('from-service-loop', 'service-loop', 'front port dress loop', { deviceId: from.id, face: 'front' }),
      waypoint('front-manager-entry', 'horizontal-manager', managerLabel, {
        deviceId: managerDeviceId,
        nodeType: 'h-manager',
        face: 'front'
      }),
      waypoint('front-manager-exit', 'horizontal-manager', managerLabel, {
        deviceId: managerDeviceId,
        nodeType: 'h-manager',
        face: 'front'
      }),
      waypoint('to-service-loop', 'service-loop', 'front port dress loop', { deviceId: to.id, face: 'front' })
    );
  } else {
    const railNode: CableNode['type'] = rail === 'left' ? 'v-rail-left' : 'v-rail-right';
    if (discipline !== 'power') {
      items.push(waypoint('from-face-exit', 'face-exit', `${fromFace} face exit`, { deviceId: from.id, face: fromFace }));
      items.push(waypoint('from-h-manager', 'horizontal-manager', 'horizontal cable manager', {
        deviceId: from.id,
        nodeType: 'h-manager',
        face: fromFace
      }));
    } else {
      items.push(waypoint('from-drip-loop', 'drip-loop', 'power drip loop', { deviceId: from.id, face: fromFace }));
      items.push(waypoint('from-strain-relief', 'strain-relief', 'power strain relief', { deviceId: from.id, face: fromFace }));
    }
    items.push(
      waypoint('from-side-tray', 'side-tray', `${rail} side tray entry`, {
        deviceId: from.id,
        nodeType: railNode,
        rail
      }),
      waypoint('vertical-manager', 'vertical-manager', `${rail} vertical manager`, {
        deviceId: from.id,
        nodeType: railNode,
        rail
      }),
      waypoint('to-side-tray', 'side-tray', `${rail} side tray exit`, {
        deviceId: to.id,
        nodeType: railNode,
        rail
      })
    );
    if (discipline !== 'power') {
      items.push(waypoint('to-h-manager', 'horizontal-manager', 'horizontal cable manager', {
        deviceId: to.id,
        nodeType: 'h-manager',
        face: toFace
      }));
    } else {
      items.push(waypoint('to-strain-relief', 'strain-relief', 'power strain relief', { deviceId: to.id, face: toFace }));
    }
  }

  items.push(
    waypoint('to-port', 'port', `${to.name} port`, {
      deviceId: to.id,
      port: cable.toPort,
      nodeType: 'device',
      face: toFace
    })
  );

  return items;
}

function buildNodes(waypoints: CableWaypoint[]): CableNode[] {
  const nodes: CableNode[] = [];
  waypoints.forEach((item) => {
    if (!item.nodeType || !item.deviceId) return;
    const last = nodes[nodes.length - 1];
    if (last && last.type === item.nodeType && last.deviceId === item.deviceId) return;
    nodes.push({
      type: item.nodeType,
      deviceId: item.deviceId,
      port: item.nodeType === 'device' ? item.port : undefined
    });
  });
  return nodes;
}

function segmentLengthForWaypoints(
  layout: RackLayout,
  cable: CableRoute,
  discipline: CableRoutingDiscipline,
  from: PlacedDevice,
  to: PlacedDevice,
  rail: 'left' | 'right' | null,
  waypoints: CableWaypoint[]
): { baseLengthMm: number; segments: CableSegment[] } {
  const fromX = deviceCenterXMm(layout, from);
  const toX = deviceCenterXMm(layout, to);
  const fromY = deviceCenterUMm(from);
  const toY = deviceCenterUMm(to);
  const verticalMm = Math.abs(fromY - toY);
  const horizontalMm = Math.abs(fromX - toX);
  const minBendRadiusMm = BEND_RADIUS_MM[cable.type];
  const separation = discipline === 'power' ? 'power' : rail === null ? 'front' : 'data';

  if (rail === null) {
    const managerWaypoint = waypoints.find((point) => point.role === 'horizontal-manager' && point.deviceId);
    const manager = managerWaypoint
      ? layout.devices.find((device) => device.id === managerWaypoint.deviceId && isCableManager(device))
      : null;
    const managerY = manager ? deviceCenterUMm(manager) : (fromY + toY) / 2;
    const fromDrop = Math.abs(fromY - managerY);
    const toDrop = Math.abs(toY - managerY);
    const managerRun = horizontalMm + MANAGER_HOP_MM;
    const serviceLoopMm = discipline === 'patch' ? FRONT_SERVICE_LOOP_MM : FRONT_SERVICE_LOOP_MM * 0.7;
    const loopSegment = serviceLoopMm + Math.min(horizontalMm * 0.25, MANAGER_HOP_MM);
    return {
      baseLengthMm: fromDrop + managerRun + toDrop + loopSegment,
      segments: [
        { from: 'from-port', to: 'from-service-loop', kind: 'service-loop', separation: 'front', minBendRadiusMm, lengthMm: loopSegment / 2 },
        { from: 'from-service-loop', to: 'front-manager-entry', kind: 'manager-hop', separation: 'front', minBendRadiusMm, lengthMm: fromDrop + managerRun / 2 },
        { from: 'front-manager-exit', to: 'to-service-loop', kind: 'manager-hop', separation: 'front', minBendRadiusMm, lengthMm: toDrop + managerRun / 2 },
        { from: 'to-service-loop', to: 'to-port', kind: 'device-entry', separation: 'front', minBendRadiusMm, lengthMm: loopSegment / 2 }
      ]
    };
  }

  const rackWidth = RACK_USABLE_WIDTH_MM[layout.rackType];
  const railX = rail === 'left' ? 0 : rackWidth;
  const fromLateral = Math.abs(fromX - railX) + FACE_EXIT_MM;
  const toLateral = Math.abs(toX - railX) + FACE_EXIT_MM;
  const trayAllowance = discipline === 'power' ? SIDE_TRAY_CLEARANCE_MM * 1.15 : SIDE_TRAY_CLEARANCE_MM;
  const verticalManager = verticalMm + trayAllowance;
  const segments: CableSegment[] = [
    { from: 'from-port', to: discipline === 'power' ? 'from-drip-loop' : 'from-face-exit', kind: 'port-exit', separation, minBendRadiusMm, lengthMm: FACE_EXIT_MM },
    { from: discipline === 'power' ? 'from-drip-loop' : 'from-h-manager', to: 'from-side-tray', kind: 'tray-run', separation, minBendRadiusMm, lengthMm: fromLateral },
    { from: 'from-side-tray', to: 'to-side-tray', kind: 'vertical-drop', separation, minBendRadiusMm, lengthMm: verticalManager },
    { from: 'to-side-tray', to: discipline === 'power' ? 'to-strain-relief' : 'to-h-manager', kind: 'tray-run', separation, minBendRadiusMm, lengthMm: toLateral },
    { from: discipline === 'power' ? 'to-strain-relief' : 'to-h-manager', to: 'to-port', kind: 'device-entry', separation, minBendRadiusMm, lengthMm: FACE_EXIT_MM }
  ];
  return {
    baseLengthMm: segments.reduce((sum, item) => sum + item.lengthMm, 0),
    segments
  };
}

function slackForDiscipline(discipline: CableRoutingDiscipline): number {
  if (discipline === 'power') return POWER_DRIP_LOOP_MM;
  if (discipline === 'patch') return PATCH_SLACK_MM;
  if (discipline === 'structured') return STRUCTURED_SLACK_MM;
  return DATA_SLACK_MM;
}

function renderHints(
  cable: CableRoute,
  discipline: CableRoutingDiscipline,
  rail: 'left' | 'right' | null
): CablePlan['render'] {
  const bendRadiusMm = BEND_RADIUS_MM[cable.type];
  const tray = rail === null ? 'front' : rail === 'left' ? 'side-left' : 'side-right';
  return {
    sagMm: discipline === 'power' ? 105 : discipline === 'patch' ? 32 : 68,
    serviceLoopMm: discipline === 'power' ? POWER_DRIP_LOOP_MM : discipline === 'patch' ? FRONT_SERVICE_LOOP_MM : DATA_SLACK_MM * 0.35,
    bendRadiusMm,
    lane: TYPE_LANE[cable.type],
    cableRadiusMm: CABLE_RADIUS_MM[cable.type],
    bundleKey: `${discipline}-${rail ?? 'front'}-${cable.type}`,
    tray
  };
}

function sameRailCount(layout: RackLayout, targetCable: CableRoute, targetRail: 'left' | 'right' | null, targetSeparation: 'data' | 'power'): number {
  if (targetRail === null) return 0;
  const stats = getRailStats(layout);
  const key = `${targetRail}-${targetSeparation}`;
  const total = stats.preferredCounts.get(key) ?? 0;
  const thisRail = stats.cablePreferredRails.get(targetCable.id);
  const thisSep = stats.cableSeparations.get(targetCable.id);
  return thisRail === targetRail && thisSep === targetSeparation ? total - 1 : total;
}

function mixedSeparationOnRail(layout: RackLayout, targetCable: CableRoute, rail: 'left' | 'right' | null, separation: 'data' | 'power'): boolean {
  if (rail === null) return false;
  const stats = getRailStats(layout);
  const thisRail = stats.cablePreferredRails.get(targetCable.id);
  const thisSep = stats.cableSeparations.get(targetCable.id);
  const dataKey = `${rail}-data`;
  const powerKey = `${rail}-power`;
  const dataTotal = stats.preferredCounts.get(dataKey) ?? 0;
  const powerTotal = stats.preferredCounts.get(powerKey) ?? 0;
  const dataCount = dataTotal - (thisRail === rail && thisSep === 'data' ? 1 : 0);
  const powerCount = powerTotal - (thisRail === rail && thisSep === 'power' ? 1 : 0);
  return separation === 'data' ? powerCount > 0 : dataCount > 0;
}

function planWarnings(
  layout: RackLayout,
  cable: CableRoute,
  discipline: CableRoutingDiscipline,
  from: PlacedDevice,
  to: PlacedDevice,
  rail: 'left' | 'right' | null,
  estimatedLengthMm: number
): CableRoutingWarning[] {
  const warnings: CableRoutingWarning[] = [];
  const managerCount = layout.devices.filter((device) => device.category === 'cable-management').length;
  const routeCount = layout.cables.length + (layout.cables.some((item) => item.id === cable.id) ? 0 : 1);
  const separation = discipline === 'power' ? 'power' : 'data';

  if ((discipline === 'patch' || discipline === 'structured' || routeCount >= 8) && managerCount === 0) {
    warnings.push({
      code: 'missing-manager',
      severity: routeCount >= 8 ? 'warning' : 'info',
      message: 'Technician routing expects a horizontal or vertical cable manager for this route density.',
      deviceIds: [from.id, to.id]
    });
  }

  if (mixedSeparationOnRail(layout, cable, rail, separation)) {
    warnings.push({
      code: 'power-data-separation',
      severity: discipline === 'power' ? 'warning' : 'info',
      message: `${rail} side tray carries both power and data. Keep separate trays or add physical spacing.`,
      deviceIds: [from.id, to.id]
    });
  }

  if (sameRailCount(layout, cable, rail, separation) >= 8) {
    warnings.push({
      code: 'tray-density',
      severity: 'warning',
      message: `${rail ?? 'front'} cable path is dense. Add lacing bars or another manager before stacking more cables.`,
      deviceIds: [from.id, to.id]
    });
  }

  if (cable.lengthMm && cable.lengthMm > 0 && cable.lengthMm < estimatedLengthMm) {
    warnings.push({
      code: 'bend-radius-risk',
      severity: 'warning',
      message: 'Manual cable length is shorter than the technician route with service slack.',
      deviceIds: [from.id, to.id]
    });
  }

  if (discipline === 'patch' && !((isPatchPanel(from) && isSwitch(to)) || (isSwitch(from) && isPatchPanel(to)))) {
    warnings.push({
      code: 'patch-discipline',
      severity: 'critical',
      message: 'Patch cables should run only between patch panel front ports and switch ports.',
      deviceIds: [from.id, to.id]
    });
  }

  if (discipline === 'power') {
    const pdu = isPdu(from) ? from : isPdu(to) ? to : null;
    if (!pdu) {
      warnings.push({
        code: 'pdu-side',
        severity: 'info',
        message: 'Power routes should terminate at a PDU or UPS distribution outlet.',
        deviceIds: [from.id, to.id]
      });
    }
  }

  return warnings;
}

export function calculateCablePlan(cable: CableRoute, layout: RackLayout): CablePlan | null {
  const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
  const to = layout.devices.find((device) => device.id === cable.toDeviceId);
  if (!from || !to) return null;

  const discipline = classifyDiscipline(cable, from, to);
  const fromFace = portFace(from, cable.fromPort);
  const toFace = portFace(to, cable.toPort);
  const rail = preferredRail(layout, discipline, cable, from, to);
  const waypoints = buildWaypoints(layout, cable, discipline, from, to, fromFace, toFace, rail);
  const nodes = buildNodes(waypoints);
  const { baseLengthMm, segments } = segmentLengthForWaypoints(layout, cable, discipline, from, to, rail, waypoints);
  const slackMm = slackForDiscipline(discipline);
  const estimatedLengthMm = baseLengthMm + slackMm;
  const standardLengthMm = standardCableLength(estimatedLengthMm);
  const separation = discipline === 'power' ? 'power' : 'data';

  return {
    cableId: cable.id,
    discipline,
    fromFace,
    toFace,
    rail,
    separation,
    nodes,
    waypoints,
    segments,
    baseLengthMm,
    estimatedLengthMm,
    standardLengthMm,
    slackMm,
    render: renderHints(cable, discipline, rail),
    warnings: planWarnings(layout, cable, discipline, from, to, rail, estimatedLengthMm),
    pathLabel: waypoints.map((item) => item.label).join(' -> ')
  };
}

export function calculateCableNodes(cable: CableRoute, layout: RackLayout): CableNode[] {
  return calculateCablePlan(cable, layout)?.nodes ?? [];
}

export function pathDescription(cable: CableRoute, nodes: CableNode[], layout: RackLayout, plan?: CablePlan | null): string {
  const activePlan = plan ?? calculateCablePlan(cable, layout);
  if (activePlan) {
    return activePlan.waypoints
      .filter((point) => point.nodeType || point.role === 'service-loop' || point.role === 'drip-loop')
      .map((point) => {
        if (point.role === 'port') {
          const device = layout.devices.find((item) => item.id === point.deviceId);
          const port = point.port ? `${point.port.type}${point.port.index + 1}` : '';
          const side = point.port?.side ? `(${point.port.side})` : '';
          return `${device?.name ?? point.deviceId}${port ? '.' + port : ''}${side}`;
        }
        if (point.role === 'horizontal-manager') return 'H-mgr';
        if (point.role === 'vertical-manager') return `V-mgr-${point.rail?.toUpperCase() ?? ''}`;
        if (point.role === 'side-tray') return `Tray-${point.rail?.toUpperCase() ?? ''}`;
        if (point.role === 'service-loop') return 'service-loop';
        if (point.role === 'drip-loop') return 'drip-loop';
        return point.label;
      })
      .join(' -> ');
  }

  if (nodes.length === 0) return 'No path';
  return nodes
    .map((node) => {
      const device = layout.devices.find((d) => d.id === node.deviceId);
      const name = device?.name ?? node.deviceId;
      if (node.type === 'device') {
        const port = node.port ? `${node.port.type}${node.port.index + 1}` : '';
        const side = node.port?.side ? `(${node.port.side})` : '';
        return `${name}${port ? '.' + port : ''}${side}`;
      }
      if (node.type === 'h-manager') return `H-mgr(${name})`;
      if (node.type === 'v-rail-left') return 'V-rail-L';
      if (node.type === 'v-rail-right') return 'V-rail-R';
      return node.type;
    })
    .join(' -> ');
}

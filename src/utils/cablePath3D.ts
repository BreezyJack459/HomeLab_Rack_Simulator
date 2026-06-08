import { CatmullRomCurve3, Vector3 } from 'three';
import type { CablePlan, CableRoute, RackLayout } from '../types/rack';
import {
  getCablePortFace,
  getDevicePortWorldPosition,
  getDeviceWorldBox,
  getPortZSign,
  RACK_3D_U_HEIGHT as U_HEIGHT
} from './rackGeometry';
import { getZeroUEarSide } from './rackMath';

type CableRoutingMode = 'clean' | 'realistic';

const MIN_POINT_DISTANCE = 0.001;
const MIN_POINT_DISTANCE_SQ = MIN_POINT_DISTANCE * MIN_POINT_DISTANCE;

function distanceSq(a: Vector3, x: number, y: number, z: number): number {
  const dx = a.x - x;
  const dy = a.y - y;
  const dz = a.z - z;
  return dx * dx + dy * dy + dz * dz;
}

function pushPoint(points: Vector3[], x: number, y: number, z: number): void {
  const previous = points[points.length - 1];
  if (!previous || distanceSq(previous, x, y, z) > MIN_POINT_DISTANCE_SQ) {
    points.push(new Vector3(x, y, z));
  }
}

function devicePosition(
  layout: RackLayout,
  deviceId: string,
  rackWidth: number,
  rackDepth: number,
  rackHeight: number
) {
  const device = layout.devices.find((item) => item.id === deviceId);
  return device
    ? getDeviceWorldBox(layout, device, {
        rackWidth,
        rackDepth,
        rackHeight,
        bottom: -rackHeight / 2
      })
    : null;
}

function insertGravitySag(points: Vector3[], amount: number, realistic: boolean): Vector3[] {
  if (points.length < 2 || amount <= 0) return points;
  const result: Vector3[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = a.distanceTo(b);
    if (dist > 0.18 && i > 0 && i < points.length - 2) {
      const sagScale = Math.min(realistic ? 1.65 : 1.2, dist / 0.55);
      if (realistic && dist > 0.28) {
        const first = new Vector3().lerpVectors(a, b, 0.33);
        const second = new Vector3().lerpVectors(a, b, 0.66);
        first.y -= amount * sagScale * 0.72;
        second.y -= amount * sagScale;
        result.push(first, second);
      } else {
        const mid = new Vector3().lerpVectors(a, b, 0.5);
        mid.y -= amount * sagScale;
        result.push(mid);
      }
    }
    result.push(b);
  }
  return result;
}

export function buildCablePath3D(
  cable: CableRoute,
  plan: CablePlan,
  layout: RackLayout,
  rackWidth: number,
  rackDepth: number,
  rackHeight: number,
  cableIndex: number,
  cableRoutingMode: CableRoutingMode
): CatmullRomCurve3 | null {
  const from = layout.devices.find((d) => d.id === cable.fromDeviceId);
  const to = layout.devices.find((d) => d.id === cable.toDeviceId);
  if (!from || !to) return null;

  const dimensions = { rackWidth, rackDepth, rackHeight, bottom: -rackHeight / 2 };
  const fromPort = getDevicePortWorldPosition(layout, from, cable.fromPort, dimensions);
  const toPort = getDevicePortWorldPosition(layout, to, cable.toPort, dimensions);

  const nodes = plan.nodes;
  const hasRailNodes = nodes.some((n) => n.type === 'v-rail-left' || n.type === 'v-rail-right');
  const fromFace = getCablePortFace(from, cable.fromPort);
  const toFace = getCablePortFace(to, cable.toPort);
  const isDirectPath = !hasRailNodes && fromFace === toFace;
  const points: Vector3[] = [];

  if (isDirectPath) {
    const midX = (fromPort.x + toPort.x) / 2;
    const midY = (fromPort.y + toPort.y) / 2;
    const fromFace = getCablePortFace(from, cable.fromPort);
    const toFace = getCablePortFace(to, cable.toPort);
    const stagger = (cableIndex % 7) * 0.012;

    if (fromFace === 'front' && toFace === 'front') {
      const managerWaypoint = plan.waypoints.find((point) => point.role === 'horizontal-manager' && point.deviceId);
      const managerBox = managerWaypoint?.deviceId
        ? devicePosition(layout, managerWaypoint.deviceId, rackWidth, rackDepth, rackHeight)
        : null;
      const baseZ = Math.max(fromPort.z, toPort.z);
      const laneZ = (managerBox ? managerBox.z + managerBox.depth / 2 : baseZ) + 0.075 + stagger;
      const laneSpread = ((cableIndex % 6) - 2.5) * 0.012;
      const managerY = managerBox ? managerBox.y + laneSpread : midY + laneSpread;
      const exitZ = baseZ + 0.035 + stagger;
      pushPoint(points, fromPort.x, fromPort.y, fromPort.z);
      pushPoint(points, fromPort.x, fromPort.y, exitZ);
      pushPoint(points, fromPort.x, managerY, exitZ);
      pushPoint(points, fromPort.x, managerY, laneZ);
      pushPoint(points, midX, managerY, laneZ);
      pushPoint(points, toPort.x, managerY, laneZ);
      pushPoint(points, toPort.x, managerY, exitZ);
      pushPoint(points, toPort.x, toPort.y, exitZ);
      pushPoint(points, toPort.x, toPort.y, toPort.z);
    } else if (fromFace === 'rear' && toFace === 'rear') {
      const baseZ = Math.min(fromPort.z, toPort.z);
      const cableZ = baseZ - 0.04 - stagger;
      const arcZ = baseZ - 0.14 - stagger;
      pushPoint(points, fromPort.x, fromPort.y, fromPort.z);
      pushPoint(points, fromPort.x, fromPort.y, cableZ);
      pushPoint(points, midX, midY, arcZ);
      pushPoint(points, toPort.x, toPort.y, cableZ);
      pushPoint(points, toPort.x, toPort.y, toPort.z);
    } else {
      const midZ = (fromPort.z + toPort.z) / 2;
      const lateral = ((cableIndex % 5) - 2) * 0.018;
      const fromExitZ = fromFace === 'front' ? fromPort.z + 0.04 : fromPort.z - 0.04;
      const toExitZ = toFace === 'front' ? toPort.z + 0.04 : toPort.z - 0.04;
      pushPoint(points, fromPort.x, fromPort.y, fromPort.z);
      pushPoint(points, fromPort.x, fromPort.y, fromExitZ);
      pushPoint(points, midX + lateral, midY, midZ);
      pushPoint(points, toPort.x, toPort.y, toExitZ);
      pushPoint(points, toPort.x, toPort.y, toPort.z);
    }
  } else {
    const isPower = cable.type === 'power';
    const useLeftRail = plan.rail === 'left';
    const railX = useLeftRail ? -rackWidth / 2 - 0.08 : rackWidth / 2 + 0.08;
    const railOffX = ((cableIndex % 8) - 3.5) * 0.028;
    const railOffZ = ((cableIndex % 5) - 2) * 0.035;

    const fromIsZeroU = from.sizeU === 0;
    const toIsZeroU = to.sizeU === 0;
    const fromIsRearRail0U = fromIsZeroU && from.mountType !== 'side-rail';
    const toIsRearRail0U = toIsZeroU && to.mountType !== 'side-rail';
    const fromSign = getPortZSign(from, cable.fromPort);
    const toSign = getPortZSign(to, cable.toPort);
    const fromRearRailSign = (from.outletFacing ?? 'forward') === 'outward' ? -1 : 1;
    const toRearRailSign = (to.outletFacing ?? 'forward') === 'outward' ? -1 : 1;
    const fromExitZ = fromIsRearRail0U ? fromPort.z + fromRearRailSign * 0.05 + railOffZ : fromPort.z + fromSign * 0.04 + railOffZ;
    const toExitZ = toIsRearRail0U ? toPort.z + toRearRailSign * 0.05 + railOffZ : toPort.z + toSign * 0.04 + railOffZ;
    const fromExitX = fromIsZeroU && !fromIsRearRail0U
      ? fromPort.x + (getZeroUEarSide(from) === 'left' ? 0.05 : -0.05)
      : fromPort.x;
    const toExitX = toIsZeroU && !toIsRearRail0U
      ? toPort.x + (getZeroUEarSide(to) === 'left' ? 0.05 : -0.05)
      : toPort.x;

    const hasHManager = nodes.some((n) => n.type === 'h-manager');
    const fromIsPdu = from.category === 'pdu' || from.category === 'pdu-0u';
    const toIsPdu = to.category === 'pdu' || to.category === 'pdu-0u';
    const fromDropY = fromIsPdu && cableRoutingMode === 'realistic'
      ? fromPort.y - Math.max(0.035, from.sizeU * U_HEIGHT * 0.25)
      : fromPort.y;
    const toDropY = toIsPdu && cableRoutingMode === 'realistic'
      ? toPort.y - Math.max(0.035, to.sizeU * U_HEIGHT * 0.25)
      : toPort.y;

    pushPoint(points, fromPort.x, fromPort.y, fromPort.z);
    if (isPower) pushPoint(points, fromPort.x, fromDropY, fromPort.z);
    if (fromIsZeroU && !fromIsRearRail0U) {
      pushPoint(points, fromExitX, fromDropY, fromPort.z);
    } else {
      pushPoint(points, fromPort.x, fromDropY, fromExitZ);
    }
    if (hasHManager && !fromIsZeroU) pushPoint(points, 0, fromDropY, fromExitZ);
    if (fromIsZeroU && !fromIsRearRail0U) {
      pushPoint(points, railX + railOffX, fromDropY, fromPort.z);
    } else {
      pushPoint(points, railX + railOffX, fromDropY, fromExitZ);
    }

    const midY = (fromDropY + toDropY) / 2;
    if (fromIsZeroU && !fromIsRearRail0U) {
      pushPoint(points, railX + railOffX, midY, fromPort.z);
    } else {
      pushPoint(points, railX + railOffX, midY, fromExitZ);
    }

    const targetZ = toIsZeroU && !toIsRearRail0U ? toPort.z : toExitZ;
    const sourceZ = fromIsZeroU && !fromIsRearRail0U ? fromPort.z : fromExitZ;
    if (Math.abs(targetZ - sourceZ) > 0.02) {
      pushPoint(points, railX + railOffX, midY, targetZ);
    }

    if (toIsZeroU && !toIsRearRail0U) {
      pushPoint(points, railX + railOffX, toDropY, toPort.z);
    } else {
      pushPoint(points, railX + railOffX, toDropY, toExitZ);
    }
    if (hasHManager && !toIsZeroU) pushPoint(points, 0, toDropY, toExitZ);
    if (toIsZeroU && !toIsRearRail0U) {
      pushPoint(points, toExitX, toDropY, toPort.z);
      pushPoint(points, toPort.x, toDropY, toPort.z);
    } else {
      pushPoint(points, toPort.x, toDropY, toExitZ);
      if (isPower) pushPoint(points, toPort.x, toDropY, toPort.z);
    }
    pushPoint(points, toPort.x, toPort.y, toPort.z);
  }

  if (points.length < 2) return null;

  const realistic = cableRoutingMode === 'realistic';
  const sagAmount = realistic ? plan.render.sagMm / 1000 : (plan.render.sagMm / 1000) * 0.35;
  const withSag = insertGravitySag(points, sagAmount, realistic);
  const totalLength = withSag.reduce((sum, p, i) => (i > 0 ? sum + p.distanceTo(withSag[i - 1]) : sum), 0);
  const tension = Math.max(0.08, Math.min(0.35, 0.15 + totalLength * 0.02));

  return new CatmullRomCurve3(withSag, false, 'centripetal', tension);
}

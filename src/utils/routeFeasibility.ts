import type { RackLayout } from '../types/rack';
import {
  getCableManagerBodyParts,
  getShelfBodyParts,
  getDevicePortSurfaces,
  getDeviceWorldBox,
  getRackWorldDimensions,
  type WorldPoint
} from './rackGeometry';
import { isTrayShelf } from './rackMath';

export type RouteObstacle = {
  owner: string;
  kind: 'body' | 'access';
  center: WorldPoint;
  size: WorldPoint;
};

/** Approximate connector working envelopes in the canonical 3D coordinates.
 * These are clearance heuristics, not manufacturer installation dimensions. */
export const buildRouteObstacles = (layout: RackLayout): RouteObstacle[] => {
  const dimensions = getRackWorldDimensions(layout);
  return layout.devices.flatMap((device) => {
    const box = getDeviceWorldBox(layout, device, dimensions);
    const parts =
      isTrayShelf(device) ? getShelfBodyParts(device, box) : device.category === 'cable-management'
        ? getCableManagerBodyParts(box)
        : [{ center: { x: 0, y: 0, z: 0 }, size: { x: box.width, y: box.height, z: box.depth } }];
    const obstacles: RouteObstacle[] = parts.map((part) => ({
      owner: device.id,
      kind: 'body',
      center: { x: box.x + part.center.x, y: box.y + part.center.y, z: box.z + part.center.z },
      size: part.size
    }));
    for (const surface of getDevicePortSurfaces(device, box))
      for (const slot of surface.slots) {
        const depth = slot.type === 'power' ? 0.24 : 0.14;
        const side = Math.abs(surface.normal.x) > 0.5;
        obstacles.push({
          owner: device.id,
          kind: 'access',
          center: {
            x: box.x + slot.position.x + (surface.normal.x * depth) / 2,
            y: box.y + slot.position.y,
            z: box.z + slot.position.z + (surface.normal.z * depth) / 2
          },
          size: {
            x: side ? depth : slot.width + 0.02,
            y: slot.height + 0.03,
            z: side ? slot.width + 0.02 : depth
          }
        });
      }
    return obstacles;
  });
};

export const overlapsObstacle = (
  part: Pick<RouteObstacle, 'center' | 'size'>,
  obstacle: RouteObstacle,
  margin = 0
): boolean =>
  (['x', 'y', 'z'] as const).every(
    (axis) =>
      Math.abs(part.center[axis] - obstacle.center[axis]) <
      (part.size[axis] + obstacle.size[axis]) / 2 + margin
  );

/** Slab intersection checks whole segments, including thin obstacles between samples. */
const segmentHits = (a: WorldPoint, b: WorldPoint, obstacle: RouteObstacle, margin: number): boolean => {
  let low = 0;
  let high = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const min = obstacle.center[axis] - obstacle.size[axis] / 2 - margin;
    const max = obstacle.center[axis] + obstacle.size[axis] / 2 + margin;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) {
      if (a[axis] <= min || a[axis] >= max) return false;
    } else {
      const t1 = (min - a[axis]) / delta;
      const t2 = (max - a[axis]) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (low >= high) return false;
    }
  }
  return low < high;
};

const distance = (a: WorldPoint, b: WorldPoint): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const routeLength = (points: WorldPoint[]): number =>
  points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);

export const routeIsClear = (points: WorldPoint[], obstacles: RouteObstacle[], radius = 0.012): boolean => {
  if (points.length < 2 || points.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))) return false;
  const hits = (a: WorldPoint, b: WorldPoint) =>
    obstacles.some((obstacle) => segmentHits(a, b, obstacle, radius));
  for (let i = 1; i < points.length; i++) if (hits(points[i - 1], points[i])) return false;
  // Check the same local fillets as ManagedCable3D, not just sharp polylines.
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i];
    const left = distance(corner, points[i - 1]);
    const right = distance(corner, points[i + 1]);
    if (left < 1e-9 || right < 1e-9) continue;
    const trim = Math.min(0.06, left * 0.25, right * 0.25);
    const entry = { ...corner };
    const exit = { ...corner };
    for (const axis of ['x', 'y', 'z'] as const) {
      entry[axis] += ((points[i - 1][axis] - corner[axis]) * trim) / left;
      exit[axis] += ((points[i + 1][axis] - corner[axis]) * trim) / right;
    }
    let previous = entry;
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const point = { x: 0, y: 0, z: 0 };
      for (const axis of ['x', 'y', 'z'] as const)
        point[axis] = (1 - t) ** 2 * entry[axis] + 2 * (1 - t) * t * corner[axis] + t * t * exit[axis];
      if (hits(previous, point)) return false;
      previous = point;
    }
  }
  return true;
};

const obstacleCache = new WeakMap<RackLayout, RouteObstacle[]>();
export const getRouteObstacles = (layout: RackLayout): RouteObstacle[] => {
  let obstacles = obstacleCache.get(layout);
  if (!obstacles) {
    obstacles = buildRouteObstacles(layout);
    obstacleCache.set(layout, obstacles);
  }
  return obstacles;
};

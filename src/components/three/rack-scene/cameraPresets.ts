import type { RackWorldDimensions, WorldPoint } from '../../../utils/rackGeometry';

export const SCENE_FOV = 43;

export type CableCameraPreset = 'overview' | 'rear-angle' | 'top' | 'front' | 'rear' | 'left' | 'right';

export type CameraPresetValue = {
  position: [number, number, number];
  target: [number, number, number];
};

const directions: Record<CableCameraPreset, [number, number, number]> = {
  overview: [1, 0.65, 1.4], 'rear-angle': [-1, 0.55, -1.6], top: [0, 1, 0.0001], front: [0, 0, 1], rear: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
};

/** Fit every point in camera space, including depth, using the actual canvas aspect. */
export const fitCameraToPoints = (points: WorldPoint[], direction: [number, number, number], aspect = 1.6): CameraPresetValue => {
  const valid = points.filter((p) => [p.x, p.y, p.z].every(Number.isFinite));
  if (valid.length === 0) valid.push({ x: 0, y: 0, z: 0 });
  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  const zs = valid.map((p) => p.z);
  const target: [number, number, number] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  ];
  const length = Math.hypot(...direction) || 1;
  const [dx, dy, dz] = direction.map((v) => v / length);
  const horizontal = Math.hypot(dx, dz) || 1;
  const rx = dz / horizontal;
  const rz = -dx / horizontal;
  const ux = dy * rz;
  const uy = dz * rx - dx * rz;
  const uz = -dy * rx;
  const tanY = Math.tan((SCENE_FOV * Math.PI) / 360);
  const tanX = tanY * Math.max(0.1, Number.isFinite(aspect) ? aspect : 1.6);
  let distance = 0.8;
  for (const point of valid) {
    const x = point.x - target[0];
    const y = point.y - target[1];
    const z = point.z - target[2];
    const depth = x * dx + y * dy + z * dz;
    distance = Math.max(distance,
      depth + (Math.abs(x * rx + z * rz) + 0.08) * 1.14 / tanX,
      depth + (Math.abs(x * ux + y * uy + z * uz) + 0.08) * 1.14 / tanY);
  }
  return { position: [target[0] + dx * distance, target[1] + dy * distance, target[2] + dz * distance], target };
};

export const buildCameraPresets = (dimensions: RackWorldDimensions, aspect = 1.6, extraPoints: WorldPoint[] = []): Record<CableCameraPreset, CameraPresetValue> => {
  const { rackWidth, rackDepth, rackHeight } = dimensions;
  const points = [...extraPoints];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    points.push({ x: x * (rackWidth / 2 + 0.25), y: y * (rackHeight / 2 + 0.3), z: z * (rackDepth / 2 + 0.15) });
  }
  return Object.fromEntries(Object.entries(directions).map(([preset, direction]) =>
    [preset, fitCameraToPoints(points, direction, aspect)])) as Record<CableCameraPreset, CameraPresetValue>;
};

export const orbitLimits = (dimensions: RackWorldDimensions): { min: number; max: number } => ({
  min: 0.4,
  max: Math.max(16, Math.max(dimensions.rackHeight, dimensions.rackWidth, dimensions.rackDepth) * 4),
});

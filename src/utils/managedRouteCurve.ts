import type { WorldPoint } from './rackGeometry';

export type RouteCurveSegment =
  | { kind: 'line'; from: WorldPoint; to: WorldPoint }
  | { kind: 'quadratic'; from: WorldPoint; control: WorldPoint; to: WorldPoint };

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const toward = (from: WorldPoint, to: WorldPoint, length: number): WorldPoint => {
  const ratio = length / distance(from, to);
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio, z: from.z + (to.z - from.z) * ratio };
};

/** Same bounded local fillets for rendering and physical-length measurement. */
export const managedRouteCurve = (points: WorldPoint[]): RouteCurveSegment[] => {
  const vertices = points.filter((point, index, all) => index === 0 || distance(point, all[index - 1]) ** 2 > 1e-10);
  if (vertices.length < 2) return [];
  const segments: RouteCurveSegment[] = [];
  let previous = vertices[0];
  for (let i = 1; i < vertices.length - 1; i++) {
    const corner = vertices[i];
    const trim = Math.min(0.06, distance(corner, vertices[i - 1]) * 0.25, distance(corner, vertices[i + 1]) * 0.25);
    const entry = toward(corner, vertices[i - 1], trim);
    const exit = toward(corner, vertices[i + 1], trim);
    segments.push({ kind: 'line', from: previous, to: entry }, { kind: 'quadratic', from: entry, control: corner, to: exit });
    previous = exit;
  }
  segments.push({ kind: 'line', from: previous, to: vertices[vertices.length - 1] });
  return segments;
};

/** Sample only curved spans; straight spans retain exact endpoint distances. */
export const sampleManagedRouteCurve = (segments: RouteCurveSegment[]): WorldPoint[] => {
  if (!segments.length) return [];
  const points = [segments[0].from];
  for (const segment of segments) {
    if (segment.kind === 'line') points.push(segment.to);
    else for (let i = 1; i <= 32; i++) {
      const t = i / 32;
      const u = 1 - t;
      points.push({
        x: u * u * segment.from.x + 2 * u * t * segment.control.x + t * t * segment.to.x,
        y: u * u * segment.from.y + 2 * u * t * segment.control.y + t * t * segment.to.y,
        z: u * u * segment.from.z + 2 * u * t * segment.control.z + t * t * segment.to.z,
      });
    }
  }
  return points;
};

/**
 * Frame-rate independent exponential damping factor for use with vector / scalar
 * lerp APIs (e.g. `Vector3.lerp`, `THREE.MathUtils.lerp`).
 *
 * Given a continuous approach rate `speed` (per second), this returns the
 * discrete factor `t` such that:
 *   newValue = current + (target - current) * t
 * yields the same observable motion regardless of how long `delta` is — so the
 * camera (or any animated value) eases at the same speed at 30fps, 60fps, or
 * 144fps. Without delta-aware damping, a fixed lerp factor moves faster on
 * high-refresh displays.
 *
 * Returns 0 for non-positive `speed` or `delta`. Bounded to [0, 1].
 */
export function damp(speed: number, delta: number): number {
  if (delta <= 0 || speed <= 0) return 0;
  // For positive speed and delta, 1 - Math.exp(-x) is always in (0, 1)
  return 1 - Math.exp(-speed * delta);
}

import { describe, expect, it } from 'vitest';
import { damp } from './animationMath';

describe('damp', () => {
  it('returns 0 when delta is 0 (no time elapsed)', () => {
    expect(damp(5, 0)).toBe(0);
  });

  it('returns 0 when speed is 0 (no easing)', () => {
    expect(damp(0, 1 / 60)).toBe(0);
  });

  it('returns 0 for negative delta or negative speed', () => {
    expect(damp(-1, 1 / 60)).toBe(0);
    expect(damp(5, -1)).toBe(0);
  });

  it('returns a value in (0, 1) for typical frame deltas', () => {
    const result = damp(5, 1 / 60);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('is bounded above by 1 even for large deltas', () => {
    expect(damp(5, 1000)).toBe(1);
  });

  it('approaches 1 as delta grows', () => {
    const small = damp(5, 0.01);
    const medium = damp(5, 0.1);
    const large = damp(5, 1);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
  });

  it('is frame-rate independent: composing two 60fps steps equals one 30fps step', () => {
    const speed = 5;
    const dt60 = 1 / 60;
    const dt30 = 1 / 30;

    let value60 = 0;
    const target = 1;
    value60 += (target - value60) * damp(speed, dt60);
    value60 += (target - value60) * damp(speed, dt60);

    let value30 = 0;
    value30 += (target - value30) * damp(speed, dt30);

    expect(Math.abs(value60 - value30)).toBeLessThan(1e-9);
  });

  it('matches the legacy fixed-factor behavior at 60fps', () => {
    // Legacy SmoothCameraRig used a fixed lerp factor of 0.09 per frame at ~60fps.
    // The equivalent continuous rate is k = -ln(1 - 0.09) * 60.
    const legacyFactor = 0.09;
    const fps = 60;
    const equivalentSpeed = -Math.log(1 - legacyFactor) * fps;
    const dampValue = damp(equivalentSpeed, 1 / fps);
    expect(Math.abs(dampValue - legacyFactor)).toBeLessThan(1e-9);
  });
});

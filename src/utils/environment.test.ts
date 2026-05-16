import { describe, expect, it } from 'vitest';
import { exportEnvironmentMarkdown, getEnvironmentStatus } from './environment';

describe('getEnvironmentStatus', () => {
  it('returns good for ideal conditions', () => {
    const result = getEnvironmentStatus({
      roomTempC: 22,
      roomHumidityPercent: 50,
      ambientNoiseDb: 35,
    });
    expect(result.tempStatus).toBe('good');
    expect(result.humidityStatus).toBe('good');
    expect(result.noiseStatus).toBe('good');
    expect(result.recommendations.length).toBe(0);
  });

  it('warns on high temperature', () => {
    const result = getEnvironmentStatus({ roomTempC: 30 });
    expect(result.tempStatus).toBe('warning');
    expect(result.recommendations.some((r) => r.includes('elevated'))).toBe(true);
  });

  it('critical on very high temperature', () => {
    const result = getEnvironmentStatus({ roomTempC: 35 });
    expect(result.tempStatus).toBe('critical');
    expect(result.recommendations.some((r) => r.includes('very high'))).toBe(true);
  });

  it('warns on high humidity', () => {
    const result = getEnvironmentStatus({ roomHumidityPercent: 70 });
    expect(result.humidityStatus).toBe('warning');
  });

  it('critical on very high humidity', () => {
    const result = getEnvironmentStatus({ roomHumidityPercent: 85 });
    expect(result.humidityStatus).toBe('critical');
  });

  it('warns on low humidity', () => {
    const result = getEnvironmentStatus({ roomHumidityPercent: 25 });
    expect(result.humidityStatus).toBe('warning');
    expect(result.recommendations.some((r) => r.includes('static'))).toBe(true);
  });

  it('warns on high noise', () => {
    const result = getEnvironmentStatus({ ambientNoiseDb: 45 });
    expect(result.noiseStatus).toBe('warning');
  });

  it('critical on very high noise', () => {
    const result = getEnvironmentStatus({ ambientNoiseDb: 55 });
    expect(result.noiseStatus).toBe('critical');
  });

  it('handles undefined environment', () => {
    const result = getEnvironmentStatus(undefined);
    expect(result.tempStatus).toBe('good');
    expect(result.recommendations.length).toBe(0);
  });
});

describe('exportEnvironmentMarkdown', () => {
  it('includes all fields', () => {
    const md = exportEnvironmentMarkdown({
      roomTempC: 24,
      roomHumidityPercent: 55,
      ambientNoiseDb: 38,
      recordedAt: '2026-05-17',
      notes: 'Normal conditions',
    });
    expect(md).toContain('Rack Environment Report');
    expect(md).toContain('24°C');
    expect(md).toContain('55%');
    expect(md).toContain('38 dB');
    expect(md).toContain('Normal conditions');
  });

  it('includes recommendations when present', () => {
    const md = exportEnvironmentMarkdown({ roomTempC: 35 });
    expect(md).toContain('Recommendations');
  });
});

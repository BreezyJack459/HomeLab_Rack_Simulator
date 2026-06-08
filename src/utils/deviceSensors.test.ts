import { describe, expect, it } from 'vitest';
import { exportSensorReadingsMarkdown, getSensorAlerts, summarizeSensorReadings } from './deviceSensors';
import type { DeviceSensorReading, PlacedDevice } from '../types/rack';

const devices: PlacedDevice[] = [
  { id: 'd1', name: 'Server A', templateId: 'srv', sizeU: 2, xMm: 0, powerW: 250 } as PlacedDevice,
  { id: 'd2', name: 'Switch B', templateId: 'sw', sizeU: 1, xMm: 0, powerW: 50 } as PlacedDevice,
  { id: 'd3', name: 'Blank', templateId: 'blank', sizeU: 1, xMm: 0, powerW: 0 } as PlacedDevice,
];

const readings: DeviceSensorReading[] = [
  { id: 'r1', deviceId: 'd1', powerActualW: 310, powerPlannedW: 250, tempActualC: 55, tempPlannedC: 50, recordedAt: '2026-05-17' },
  { id: 'r2', deviceId: 'd2', powerActualW: 45, powerPlannedW: 50, tempActualC: 40, tempPlannedC: 45 },
  { id: 'r3', deviceId: 'd1', fanActualRpm: 1200, fanPlannedRpm: 1000, recordedAt: '2026-05-16' },
];

describe('summarizeSensorReadings', () => {
  it('counts total readings', () => {
    const s = summarizeSensorReadings(readings);
    expect(s.total).toBe(3);
  });

  it('counts readings with power', () => {
    const s = summarizeSensorReadings(readings);
    expect(s.withPower).toBe(2);
  });

  it('counts readings with temperature', () => {
    const s = summarizeSensorReadings(readings);
    expect(s.withTemp).toBe(2);
  });

  it('counts readings with fan', () => {
    const s = summarizeSensorReadings(readings);
    expect(s.withFan).toBe(1);
  });

  it('handles empty array', () => {
    const s = summarizeSensorReadings([]);
    expect(s.total).toBe(0);
    expect(s.withPower).toBe(0);
    expect(s.withTemp).toBe(0);
    expect(s.withFan).toBe(0);
  });
});

describe('getSensorAlerts', () => {
  it('flags over-power when actual exceeds planned by >20%', () => {
    const alerts = getSensorAlerts(readings, devices);
    const overPower = alerts.filter((a) => a.type === 'over-power');
    expect(overPower.length).toBe(1);
    expect(overPower[0].deviceName).toBe('Server A');
  });

  it('flags over-temp when actual exceeds planned', () => {
    const alerts = getSensorAlerts(readings, devices);
    const overTemp = alerts.filter((a) => a.type === 'over-temp');
    expect(overTemp.length).toBe(1);
    expect(overTemp[0].deviceName).toBe('Server A');
  });

  it('does not flag power within 20% of planned', () => {
    const r: DeviceSensorReading[] = [
      { id: 'r', deviceId: 'd2', powerActualW: 59, powerPlannedW: 50 },
    ];
    const alerts = getSensorAlerts(r, devices);
    expect(alerts.some((a) => a.type === 'over-power')).toBe(false);
  });

  it('flags missing readings for powered devices', () => {
    const r: DeviceSensorReading[] = [];
    const alerts = getSensorAlerts(r, devices);
    const missing = alerts.filter((a) => a.type === 'missing-reading');
    expect(missing.length).toBe(2);
    expect(missing.map((a) => a.deviceName).sort()).toEqual(['Server A', 'Switch B']);
  });

  it('ignores devices with zero power for missing readings', () => {
    const r: DeviceSensorReading[] = [];
    const alerts = getSensorAlerts(r, devices);
    expect(alerts.some((a) => a.deviceId === 'd3')).toBe(false);
  });
});

describe('exportSensorReadingsMarkdown', () => {
  it('includes header and summary', () => {
    const md = exportSensorReadingsMarkdown(readings, devices);
    expect(md).toContain('Device Sensor Readings');
    expect(md).toContain('**Total Readings:** 3');
  });

  it('includes device names and readings', () => {
    const md = exportSensorReadingsMarkdown(readings, devices);
    expect(md).toContain('Server A');
    expect(md).toContain('Switch B');
    expect(md).toContain('310W');
    expect(md).toContain('55°C');
  });
});

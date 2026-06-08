import { describe, it, expect } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import {
  compareVersions,
  getFirmwareStatus,
  firmwareStatusLabel,
  summarizeFirmware,
  exportFirmwareMarkdown,
  exportFirmwareCsv,
} from './firmwareTracker';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'd1',
    category: 'switch',
    name: 'Switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 4,
    powerW: 40,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

describe('compareVersions', () => {
  it('compares equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.5', '2.5')).toBe(0);
  });

  it('compares different major versions', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('compares different minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
  });

  it('handles different length versions', () => {
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0);
  });

  it('normalizes separators', () => {
    expect(compareVersions('1_0_0', '1.0.0')).toBe(0);
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
  });

  it('handles string suffixes', () => {
    expect(compareVersions('1.0a', '1.0b')).toBeLessThan(0);
  });
});

describe('getFirmwareStatus', () => {
  it('returns not-applicable when no firmware fields', () => {
    const device = makeDevice();
    expect(getFirmwareStatus(device)).toBe('not-applicable');
  });

  it('returns current when versions match', () => {
    const device = makeDevice({ firmwareVersion: '1.0.0', firmwareLatest: '1.0.0' });
    expect(getFirmwareStatus(device)).toBe('current');
  });

  it('returns current when installed is newer', () => {
    const device = makeDevice({ firmwareVersion: '2.0.0', firmwareLatest: '1.5.0' });
    expect(getFirmwareStatus(device)).toBe('current');
  });

  it('returns update-available when latest is newer', () => {
    const device = makeDevice({ firmwareVersion: '1.0.0', firmwareLatest: '2.0.0' });
    expect(getFirmwareStatus(device)).toBe('update-available');
  });

  it('returns unknown when only one version is set', () => {
    const device = makeDevice({ firmwareVersion: '1.0.0' });
    expect(getFirmwareStatus(device)).toBe('unknown');
  });
});

describe('firmwareStatusLabel', () => {
  it('returns human-readable labels', () => {
    expect(firmwareStatusLabel('current')).toBe('Current');
    expect(firmwareStatusLabel('update-available')).toBe('Update Available');
    expect(firmwareStatusLabel('unknown')).toBe('Unknown');
    expect(firmwareStatusLabel('not-applicable')).toBe('Not Tracked');
  });
});

describe('summarizeFirmware', () => {
  it('returns zeros for empty devices', () => {
    const summary = summarizeFirmware([]);
    expect(summary.trackedCount).toBe(0);
    expect(summary.currentCount).toBe(0);
    expect(summary.updateAvailableCount).toBe(0);
  });

  it('counts statuses correctly', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ id: 'd1', firmwareVersion: '1.0.0', firmwareLatest: '1.0.0' }),
      makeDevice({ id: 'd2', firmwareVersion: '1.0.0', firmwareLatest: '2.0.0' }),
      makeDevice({ id: 'd3', firmwareVersion: '1.0.0' }),
      makeDevice({ id: 'd4' }),
    ];
    const summary = summarizeFirmware(devices);
    expect(summary.trackedCount).toBe(3);
    expect(summary.currentCount).toBe(1);
    expect(summary.updateAvailableCount).toBe(1);
    expect(summary.unknownCount).toBe(1);
    expect(summary.notApplicableCount).toBe(1);
  });

  it('lists outdated devices', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ id: 'd1', firmwareVersion: '2.0.0', firmwareLatest: '3.0.0' }),
      makeDevice({ id: 'd2', firmwareVersion: '1.0.0', firmwareLatest: '2.0.0' }),
    ];
    const summary = summarizeFirmware(devices);
    expect(summary.outdatedDevices).toHaveLength(2);
    expect(summary.outdatedDevices[0].id).toBe('d2'); // sorted by version
  });
});

describe('exportFirmwareMarkdown', () => {
  it('includes header and table', () => {
    const md = exportFirmwareMarkdown([makeDevice({ firmwareVersion: '1.0.0', firmwareLatest: '1.0.0' })]);
    expect(md).toContain('# Firmware Tracker');
    expect(md).toContain('| Device | Current | Latest | Status | Notes |');
    expect(md).toContain('Switch');
  });

  it('skips not-applicable devices', () => {
    const md = exportFirmwareMarkdown([makeDevice()]);
    expect(md).not.toContain('Switch');
  });
});

describe('exportFirmwareCsv', () => {
  it('produces header row', () => {
    const csv = exportFirmwareCsv([]);
    expect(csv).toContain('Device ID,Device Name,Category,Current Version,Latest Version,Status,Notes');
  });

  it('includes tracked devices', () => {
    const csv = exportFirmwareCsv([makeDevice({ firmwareVersion: '1.0.0', firmwareLatest: '1.0.0' })]);
    expect(csv).toContain('d1');
    expect(csv).toContain('Switch');
    expect(csv).toContain('Current');
  });
});

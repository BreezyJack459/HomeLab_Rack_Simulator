import { describe, it, expect } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import {
  daysSince,
  isRestoreOverdue,
  isBackupStale,
  summarizeBackups,
  deviceBackupHealth,
  formatBackupDate,
} from './backupTracking';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    name: 'Test Device',
    category: 'server',
    positionU: 1,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 5,
    powerW: 100,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

describe('daysSince', () => {
  it('returns null for undefined date', () => {
    expect(daysSince(undefined)).toBeNull();
  });

  it('returns 0 for today', () => {
    const today = new Date().toISOString();
    expect(daysSince(today)).toBe(0);
  });

  it('returns positive number for past date', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(past)).toBe(3);
  });
});

describe('isRestoreOverdue', () => {
  it('returns true when no restore test date', () => {
    expect(isRestoreOverdue({ id: 'b1', destination: 'NAS' })).toBe(true);
  });

  it('returns true when restore test is old', () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRestoreOverdue({ id: 'b1', destination: 'NAS', lastRestoreTestDate: oldDate })).toBe(true);
  });

  it('returns false when restore test is recent', () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRestoreOverdue({ id: 'b1', destination: 'NAS', lastRestoreTestDate: recent })).toBe(false);
  });
});

describe('isBackupStale', () => {
  it('returns true when no backup date', () => {
    expect(isBackupStale({ id: 'b1', destination: 'NAS' })).toBe(true);
  });

  it('returns true when backup is older than RPO', () => {
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(isBackupStale({ id: 'b1', destination: 'NAS', lastBackupDate: oldDate }, 24)).toBe(true);
  });

  it('returns false when backup is within RPO', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    expect(isBackupStale({ id: 'b1', destination: 'NAS', lastBackupDate: recent }, 24)).toBe(false);
  });
});

describe('summarizeBackups', () => {
  it('returns zeros for empty devices', () => {
    const summary = summarizeBackups([]);
    expect(summary.totalDevices).toBe(0);
    expect(summary.totalBackups).toBe(0);
    expect(summary.passRate).toBe(0);
  });

  it('counts backups correctly', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        backups: [
          { id: 'b1', destination: 'NAS', lastRestoreTestResult: 'pass', lastRestoreTestDate: new Date().toISOString() },
          { id: 'b2', destination: 'B2', lastRestoreTestResult: 'fail' },
        ],
      }),
      makeDevice({ backups: [] }),
    ];
    const summary = summarizeBackups(devices);
    expect(summary.totalDevices).toBe(2);
    expect(summary.devicesWithBackups).toBe(1);
    expect(summary.totalBackups).toBe(2);
    expect(summary.failedRestoreCount).toBe(1);
    expect(summary.backupsWithRecentRestore).toBe(1);
  });

  it('counts overdue restores', () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const devices: PlacedDevice[] = [
      makeDevice({
        backups: [{ id: 'b1', destination: 'NAS', lastRestoreTestDate: oldDate }],
      }),
    ];
    const summary = summarizeBackups(devices);
    expect(summary.overdueRestoreCount).toBe(1);
  });
});

describe('deviceBackupHealth', () => {
  it('returns unknown when no backups', () => {
    expect(deviceBackupHealth(makeDevice())).toBe('unknown');
  });

  it('returns good when all backups are healthy', () => {
    const device = makeDevice({
      backups: [
        { id: 'b1', destination: 'NAS', lastRestoreTestResult: 'pass', lastRestoreTestDate: new Date().toISOString(), lastBackupDate: new Date().toISOString() },
      ],
    });
    expect(deviceBackupHealth(device)).toBe('good');
  });

  it('returns critical when any restore failed', () => {
    const device = makeDevice({
      backups: [
        { id: 'b1', destination: 'NAS', lastRestoreTestResult: 'fail' },
      ],
    });
    expect(deviceBackupHealth(device)).toBe('critical');
  });

  it('returns warning when restore is overdue', () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const device = makeDevice({
      backups: [
        { id: 'b1', destination: 'NAS', lastRestoreTestDate: oldDate },
      ],
    });
    expect(deviceBackupHealth(device)).toBe('warning');
  });
});

describe('formatBackupDate', () => {
  it('returns Never for undefined', () => {
    expect(formatBackupDate(undefined)).toBe('Never');
  });

  it('returns Today for current date', () => {
    expect(formatBackupDate(new Date().toISOString())).toBe('Today');
  });

  it('returns Yesterday for 1 day ago', () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatBackupDate(date)).toBe('Yesterday');
  });

  it('returns days ago for recent dates', () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatBackupDate(date)).toBe('5 days ago');
  });
});

import { describe, it, expect } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import {
  summarizeMaintenance,
  isDeviceMaintenanceOverdue,
  upcomingMaintenance,
  exportMaintenanceLogMarkdown,
  exportMaintenanceLogCsv,
} from './maintenanceLog';

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

describe('summarizeMaintenance', () => {
  it('returns zeros for empty devices', () => {
    const s = summarizeMaintenance([]);
    expect(s.totalDevices).toBe(0);
    expect(s.totalEntries).toBe(0);
    expect(s.totalLaborMinutes).toBe(0);
  });

  it('counts entries and labor', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        maintenanceLog: [
          { id: 'm1', date: '2024-01-01', type: 'cleaning', description: 'Dust removal', laborMinutes: 30 },
          { id: 'm2', date: '2024-02-01', type: 'firmware', description: 'BIOS update', laborMinutes: 15 },
        ],
      }),
      makeDevice(),
    ];
    const s = summarizeMaintenance(devices);
    expect(s.devicesWithLogs).toBe(1);
    expect(s.totalEntries).toBe(2);
    expect(s.totalLaborMinutes).toBe(45);
    expect(s.entriesByType.cleaning).toBe(1);
    expect(s.entriesByType.firmware).toBe(1);
  });
});

describe('isDeviceMaintenanceOverdue', () => {
  it('returns false for no logs', () => {
    expect(isDeviceMaintenanceOverdue(makeDevice())).toBe(false);
  });

  it('returns false for recent cleaning', () => {
    const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const device = makeDevice({
      maintenanceLog: [{ id: 'm1', date: recent, type: 'cleaning', description: 'Dusted' }],
    });
    expect(isDeviceMaintenanceOverdue(device)).toBe(false);
  });

  it('returns true for overdue cleaning (>90 days)', () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const device = makeDevice({
      maintenanceLog: [{ id: 'm1', date: old, type: 'cleaning', description: 'Dusted' }],
    });
    expect(isDeviceMaintenanceOverdue(device)).toBe(true);
  });

  it('returns true for overdue firmware (>180 days)', () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const device = makeDevice({
      maintenanceLog: [{ id: 'm1', date: old, type: 'firmware', description: 'Updated' }],
    });
    expect(isDeviceMaintenanceOverdue(device)).toBe(true);
  });
});

describe('upcomingMaintenance', () => {
  it('returns empty when no logs', () => {
    expect(upcomingMaintenance([])).toEqual([]);
  });

  it('lists overdue items', () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const devices: PlacedDevice[] = [
      makeDevice({
        name: 'Server',
        maintenanceLog: [{ id: 'm1', date: old, type: 'cleaning', description: 'Dusted' }],
      }),
    ];
    const list = upcomingMaintenance(devices);
    expect(list.length).toBe(1);
    expect(list[0].deviceName).toBe('Server');
    expect(list[0].type).toBe('cleaning');
    expect(list[0].daysOverdue).toBeGreaterThan(0);
  });
});

describe('exportMaintenanceLogMarkdown', () => {
  it('includes summary', () => {
    const md = exportMaintenanceLogMarkdown([]);
    expect(md).toContain('# Maintenance Log Report');
    expect(md).toContain('**Total Devices:** 0');
  });

  it('includes device entries', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        name: 'NAS',
        maintenanceLog: [
          { id: 'm1', date: '2024-01-15', type: 'inspection', description: 'Checked drives' },
        ],
      }),
    ];
    const md = exportMaintenanceLogMarkdown(devices);
    expect(md).toContain('## NAS');
    expect(md).toContain('inspection: Checked drives');
  });
});

describe('exportMaintenanceLogCsv', () => {
  it('produces header', () => {
    const csv = exportMaintenanceLogCsv([]);
    expect(csv).toContain('Device Name,Date,Type');
  });

  it('includes entries', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        name: 'Router',
        maintenanceLog: [
          { id: 'm1', date: '2024-03-01', type: 'firmware', description: 'Upgraded OS', laborMinutes: 20 },
        ],
      }),
    ];
    const csv = exportMaintenanceLogCsv(devices);
    expect(csv).toContain('Router');
    expect(csv).toContain('firmware');
    expect(csv).toContain('20');
  });
});

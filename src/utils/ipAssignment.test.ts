import { describe, it, expect } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import {
  detectIpConflicts,
  summarizeIpAssignments,
  exportIpTableCsv,
  exportIpTableMarkdown,
} from './ipAssignment';

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

describe('detectIpConflicts', () => {
  it('returns empty for no devices', () => {
    expect(detectIpConflicts([])).toEqual([]);
  });

  it('detects duplicate IPs', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        id: 'd1',
        name: 'Server A',
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '192.168.1.10' },
        ],
      }),
      makeDevice({
        id: 'd2',
        name: 'Server B',
        networkInterfaces: [
          { id: 'i2', name: 'eth0', staticIp: '192.168.1.10' },
        ],
      }),
    ];
    const conflicts = detectIpConflicts(devices);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('duplicate-ip');
    expect(conflicts[0].value).toBe('192.168.1.10');
  });

  it('detects duplicate MACs', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        id: 'd1',
        networkInterfaces: [
          { id: 'i1', name: 'eth0', macAddress: '00:11:22:33:44:55' },
        ],
      }),
      makeDevice({
        id: 'd2',
        networkInterfaces: [
          { id: 'i2', name: 'eth0', macAddress: '00:11:22:33:44:55' },
        ],
      }),
    ];
    const conflicts = detectIpConflicts(devices);
    expect(conflicts.some((c) => c.kind === 'duplicate-mac')).toBe(true);
  });

  it('detects invalid IP', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '999.999.999.999' },
        ],
      }),
    ];
    const conflicts = detectIpConflicts(devices);
    expect(conflicts.some((c) => c.kind === 'invalid-ip')).toBe(true);
  });

  it('detects invalid MAC', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        networkInterfaces: [
          { id: 'i1', name: 'eth0', macAddress: 'not-a-mac' },
        ],
      }),
    ];
    const conflicts = detectIpConflicts(devices);
    expect(conflicts.some((c) => c.kind === 'invalid-mac')).toBe(true);
  });

  it('detects invalid VLAN', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        networkInterfaces: [
          { id: 'i1', name: 'eth0', vlanId: 5000 },
        ],
      }),
    ];
    const conflicts = detectIpConflicts(devices);
    expect(conflicts.some((c) => c.kind === 'invalid-vlan')).toBe(true);
  });

  it('allows valid entries without conflicts', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '192.168.1.10', macAddress: '00:11:22:33:44:55', vlanId: 10 },
        ],
      }),
    ];
    expect(detectIpConflicts(devices)).toEqual([]);
  });
});

describe('summarizeIpAssignments', () => {
  it('returns zeros for empty devices', () => {
    const s = summarizeIpAssignments([]);
    expect(s.totalDevices).toBe(0);
    expect(s.totalInterfaces).toBe(0);
  });

  it('counts interfaces correctly', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '192.168.1.10', dhcpReservation: true, vlanId: 10, macAddress: '00:11:22:33:44:55' },
          { id: 'i2', name: 'eth1', staticIp: '192.168.1.11' },
        ],
      }),
      makeDevice(),
    ];
    const s = summarizeIpAssignments(devices);
    expect(s.devicesWithInterfaces).toBe(1);
    expect(s.totalInterfaces).toBe(2);
    expect(s.withStaticIp).toBe(2);
    expect(s.withDhcp).toBe(1);
    expect(s.withVlan).toBe(1);
    expect(s.withMac).toBe(1);
  });

  it('counts duplicate IPs', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        id: 'd1',
        networkInterfaces: [{ id: 'i1', name: 'eth0', staticIp: '10.0.0.1' }],
      }),
      makeDevice({
        id: 'd2',
        networkInterfaces: [{ id: 'i2', name: 'eth0', staticIp: '10.0.0.1' }],
      }),
    ];
    const s = summarizeIpAssignments(devices);
    expect(s.duplicateIps).toBe(1);
  });
});

describe('exportIpTableCsv', () => {
  it('produces header row', () => {
    const csv = exportIpTableCsv([]);
    expect(csv).toContain('Device Name,Interface,MAC Address');
  });

  it('includes device data', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        name: 'Router',
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '192.168.1.1', macAddress: '00:11:22:33:44:55', vlanId: 1 },
        ],
      }),
    ];
    const csv = exportIpTableCsv(devices);
    expect(csv).toContain('Router');
    expect(csv).toContain('192.168.1.1');
    expect(csv).toContain('00:11:22:33:44:55');
  });
});

describe('exportIpTableMarkdown', () => {
  it('includes summary', () => {
    const md = exportIpTableMarkdown([]);
    expect(md).toContain('# IP Address & VLAN Assignment Table');
    expect(md).toContain('**Total Devices:** 0');
  });

  it('includes interface table', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        name: 'NAS',
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '192.168.1.50', vlanId: 20 },
        ],
      }),
    ];
    const md = exportIpTableMarkdown(devices);
    expect(md).toContain('| NAS | eth0 |');
    expect(md).toContain('192.168.1.50');
  });

  it('includes conflicts section', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        networkInterfaces: [
          { id: 'i1', name: 'eth0', staticIp: '999.999.999.999' },
        ],
      }),
    ];
    const md = exportIpTableMarkdown(devices);
    expect(md).toContain('## Conflicts & Issues');
  });
});

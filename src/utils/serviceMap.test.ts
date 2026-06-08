import { describe, it, expect } from 'vitest';
import type { RackLayout, PlacedDevice, RackService } from '../types/rack';
import {
  getServiceStatus,
  servicesForDevice,
  summarizeServices,
  findSinglePointsOfFailure,
  criticalityLabel,
  exportServiceMapMarkdown,
  exportServiceMapCsv,
} from './serviceMap';

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

function makeService(overrides: Partial<RackService> = {}): RackService {
  return {
    id: 'svc-1',
    name: 'DNS',
    criticality: 'high',
    ...overrides,
  };
}

function makeLayout(overrides: Partial<RackLayout> = {}): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1000,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getServiceStatus', () => {
  it('returns healthy for service with no dependencies', () => {
    const layout = makeLayout();
    const service = makeService();
    const status = getServiceStatus(service, layout);
    expect(status.healthy).toBe(true);
    expect(status.singlePointOfFailure).toBe(false);
  });

  it('returns healthy when host device exists', () => {
    const layout = makeLayout({ devices: [makeDevice({ id: 'srv1', name: 'Server' })] });
    const service = makeService({ hostDeviceId: 'srv1' });
    const status = getServiceStatus(service, layout);
    expect(status.healthy).toBe(true);
  });

  it('returns unhealthy when host device is missing', () => {
    const layout = makeLayout();
    const service = makeService({ hostDeviceId: 'missing' });
    const status = getServiceStatus(service, layout);
    expect(status.healthy).toBe(false);
    expect(status.missingDevices).toContain('missing');
  });

  it('detects SPOF for critical service with single network dependency', () => {
    const layout = makeLayout({ devices: [makeDevice({ id: 'sw1', name: 'Switch' })] });
    const service = makeService({ criticality: 'critical', networkDeviceIds: ['sw1'] });
    const status = getServiceStatus(service, layout);
    expect(status.singlePointOfFailure).toBe(true);
    expect(status.spoFDevices).toContain('sw1');
  });

  it('does not flag SPOF for low criticality service', () => {
    const layout = makeLayout({ devices: [makeDevice({ id: 'sw1', name: 'Switch' })] });
    const service = makeService({ criticality: 'low', networkDeviceIds: ['sw1'] });
    const status = getServiceStatus(service, layout);
    expect(status.singlePointOfFailure).toBe(false);
  });

  it('does not flag SPOF when multiple devices of same type', () => {
    const layout = makeLayout({
      devices: [
        makeDevice({ id: 'sw1', name: 'Switch A' }),
        makeDevice({ id: 'sw2', name: 'Switch B' }),
      ],
    });
    const service = makeService({ criticality: 'critical', networkDeviceIds: ['sw1', 'sw2'] });
    const status = getServiceStatus(service, layout);
    expect(status.singlePointOfFailure).toBe(false);
  });
});

describe('servicesForDevice', () => {
  it('finds services hosted on device', () => {
    const services: RackService[] = [
      makeService({ id: 's1', hostDeviceId: 'd1' }),
      makeService({ id: 's2', hostDeviceId: 'd2' }),
    ];
    const result = servicesForDevice(services, 'd1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('finds services that depend on device via network', () => {
    const services: RackService[] = [
      makeService({ id: 's1', networkDeviceIds: ['d1'] }),
    ];
    const result = servicesForDevice(services, 'd1');
    expect(result).toHaveLength(1);
  });

  it('finds services that depend on device via storage', () => {
    const services: RackService[] = [
      makeService({ id: 's1', storageDeviceIds: ['d1'] }),
    ];
    const result = servicesForDevice(services, 'd1');
    expect(result).toHaveLength(1);
  });

  it('finds services that depend on device via power', () => {
    const services: RackService[] = [
      makeService({ id: 's1', powerDeviceIds: ['d1'] }),
    ];
    const result = servicesForDevice(services, 'd1');
    expect(result).toHaveLength(1);
  });

  it('finds services that use device as backup', () => {
    const services: RackService[] = [
      makeService({ id: 's1', backupDeviceId: 'd1' }),
    ];
    const result = servicesForDevice(services, 'd1');
    expect(result).toHaveLength(1);
  });
});

describe('summarizeServices', () => {
  it('returns zeros for empty services', () => {
    const layout = makeLayout();
    const summary = summarizeServices([], layout);
    expect(summary.totalCount).toBe(0);
    expect(summary.healthyCount).toBe(0);
    expect(summary.spoFCount).toBe(0);
  });

  it('counts by criticality', () => {
    const services: RackService[] = [
      makeService({ id: 's1', criticality: 'critical' }),
      makeService({ id: 's2', criticality: 'high' }),
      makeService({ id: 's3', criticality: 'medium' }),
      makeService({ id: 's4', criticality: 'low' }),
    ];
    const layout = makeLayout();
    const summary = summarizeServices(services, layout);
    expect(summary.criticalCount).toBe(1);
    expect(summary.highCount).toBe(1);
    expect(summary.mediumCount).toBe(1);
    expect(summary.lowCount).toBe(1);
  });

  it('counts healthy and SPOF correctly', () => {
    const layout = makeLayout({
      devices: [makeDevice({ id: 'sw1' })],
    });
    const services: RackService[] = [
      makeService({ id: 's1', criticality: 'critical', networkDeviceIds: ['sw1'] }),
      makeService({ id: 's2', criticality: 'low' }),
    ];
    const summary = summarizeServices(services, layout);
    expect(summary.healthyCount).toBe(2);
    expect(summary.unhealthyCount).toBe(0);
    expect(summary.spoFCount).toBe(1);
  });
});

describe('findSinglePointsOfFailure', () => {
  it('returns empty when no SPOFs', () => {
    const layout = makeLayout();
    const services: RackService[] = [makeService({ criticality: 'low' })];
    const result = findSinglePointsOfFailure(services, layout);
    expect(result).toHaveLength(0);
  });

  it('finds critical services with single dependencies', () => {
    const layout = makeLayout({ devices: [makeDevice({ id: 'sw1' })] });
    const services: RackService[] = [
      makeService({ criticality: 'critical', networkDeviceIds: ['sw1'] }),
    ];
    const result = findSinglePointsOfFailure(services, layout);
    expect(result).toHaveLength(1);
    expect(result[0].service.id).toBe('svc-1');
    expect(result[0].spoFDevices).toContain('sw1');
  });
});

describe('criticalityLabel', () => {
  it('returns human-readable labels', () => {
    expect(criticalityLabel('critical')).toBe('Critical');
    expect(criticalityLabel('high')).toBe('High');
    expect(criticalityLabel('medium')).toBe('Medium');
    expect(criticalityLabel('low')).toBe('Low');
  });
});

describe('exportServiceMapMarkdown', () => {
  it('includes header and table', () => {
    const layout = makeLayout();
    const md = exportServiceMapMarkdown([makeService()], layout);
    expect(md).toContain('# Service Map');
    expect(md).toContain('| Service | Criticality | Host | Network | Storage | Power | Backup | Status |');
    expect(md).toContain('DNS');
  });

  it('includes SPOF section when present', () => {
    const layout = makeLayout({ devices: [makeDevice({ id: 'sw1', name: 'Switch' })] });
    const services: RackService[] = [
      makeService({ criticality: 'critical', networkDeviceIds: ['sw1'] }),
    ];
    const md = exportServiceMapMarkdown(services, layout);
    expect(md).toContain('## Single Points of Failure');
    expect(md).toContain('Switch');
  });
});

describe('exportServiceMapCsv', () => {
  it('produces header row', () => {
    const layout = makeLayout();
    const csv = exportServiceMapCsv([], layout);
    expect(csv).toContain('ID,Name,Criticality,Host,Network,Storage,Power,Backup,Healthy,SPOF');
  });

  it('includes services', () => {
    const layout = makeLayout();
    const csv = exportServiceMapCsv([makeService()], layout);
    expect(csv).toContain('svc-1');
    expect(csv).toContain('DNS');
    expect(csv).toContain('High');
  });
});

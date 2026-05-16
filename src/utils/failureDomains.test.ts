import { describe, expect, it } from 'vitest';
import type { CableRoute, DomainAssignment, FailureDomain, PlacedDevice, RackService } from '../types/rack';
import {
  DOMAIN_COLORS,
  exportDomainsMarkdown,
  getDomainAssignment,
  getDomainsForCable,
  getDomainsForDevice,
  getDomainTypeLabel,
  getUnassignedCables,
  getUnassignedDevices,
  summarizeDomains,
  validateDomains,
} from './failureDomains';

const domains: FailureDomain[] = [
  { id: 'd1', name: 'Circuit A', type: 'power', color: DOMAIN_COLORS[0] },
  { id: 'd2', name: 'Switch A', type: 'network', color: DOMAIN_COLORS[1] },
  { id: 'd3', name: 'Room 1', type: 'site', color: DOMAIN_COLORS[2] },
];

const assignments: DomainAssignment[] = [
  { domainId: 'd1', deviceIds: ['dev1', 'dev2'], cableIds: ['c1'] },
  { domainId: 'd2', deviceIds: ['dev2'], serviceIds: ['svc1'] },
];

const devices: PlacedDevice[] = [
  { id: 'dev1', name: 'Router', category: 'router', positionU: 1, sizeU: 1, depthMm: 200, widthType: '19in', weightKg: 2, powerW: 20, heatLevel: 2, color: '#333' },
  { id: 'dev2', name: 'Switch', category: 'switch', positionU: 2, sizeU: 1, depthMm: 200, widthType: '19in', weightKg: 2, powerW: 30, heatLevel: 3, color: '#555' },
  { id: 'dev3', name: 'NAS', category: 'nas', positionU: 3, sizeU: 2, depthMm: 300, widthType: '19in', weightKg: 5, powerW: 50, heatLevel: 2, color: '#777' },
];

const cables: CableRoute[] = [
  { id: 'c1', fromDeviceId: 'dev1', toDeviceId: 'dev2', type: 'ethernet', color: '#00f' },
  { id: 'c2', fromDeviceId: 'dev2', toDeviceId: 'dev3', type: 'ethernet', color: '#00f' },
];

const services: RackService[] = [
  { id: 'svc1', name: 'DNS', criticality: 'critical', hostDeviceId: 'dev1' },
  { id: 'svc2', name: 'Backup', criticality: 'high', hostDeviceId: 'dev3' },
];

describe('getDomainTypeLabel', () => {
  it('returns correct labels', () => {
    expect(getDomainTypeLabel('power')).toBe('Power');
    expect(getDomainTypeLabel('network')).toBe('Network');
    expect(getDomainTypeLabel('storage')).toBe('Storage');
    expect(getDomainTypeLabel('site')).toBe('Site / Room');
    expect(getDomainTypeLabel('management')).toBe('Management');
    expect(getDomainTypeLabel('cooling')).toBe('Cooling');
  });
});

describe('getDomainsForDevice', () => {
  it('returns domains assigned to a device', () => {
    expect(getDomainsForDevice(domains, assignments, 'dev1').map((d) => d.id)).toEqual(['d1']);
    expect(getDomainsForDevice(domains, assignments, 'dev2').map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(getDomainsForDevice(domains, assignments, 'dev3')).toEqual([]);
  });
});

describe('getDomainsForCable', () => {
  it('returns domains assigned to a cable', () => {
    expect(getDomainsForCable(domains, assignments, 'c1').map((d) => d.id)).toEqual(['d1']);
    expect(getDomainsForCable(domains, assignments, 'c2')).toEqual([]);
  });
});

describe('getUnassignedDevices', () => {
  it('returns devices not in any assignment', () => {
    const result = getUnassignedDevices(devices, assignments);
    expect(result.map((d) => d.id)).toEqual(['dev3']);
  });
});

describe('getUnassignedCables', () => {
  it('returns cables not in any assignment', () => {
    const result = getUnassignedCables(cables, assignments);
    expect(result.map((c) => c.id)).toEqual(['c2']);
  });
});

describe('getDomainAssignment', () => {
  it('returns assignment for domain', () => {
    expect(getDomainAssignment(assignments, 'd1')?.deviceIds).toEqual(['dev1', 'dev2']);
    expect(getDomainAssignment(assignments, 'd3')).toBeUndefined();
  });
});

describe('summarizeDomains', () => {
  it('summarizes correctly', () => {
    const s = summarizeDomains(domains, assignments, devices, cables);
    expect(s.totalDomains).toBe(3);
    expect(s.byType).toEqual({ power: 1, network: 1, site: 1 });
    expect(s.assignedDevices).toBe(2);
    expect(s.assignedCables).toBe(1);
    expect(s.unassignedDevices).toBe(1);
    expect(s.unassignedCables).toBe(1);
  });
});

describe('validateDomains', () => {
  it('warns on missing domain references', () => {
    const badAssignments: DomainAssignment[] = [
      { domainId: 'missing', deviceIds: ['dev1'] },
    ];
    const issues = validateDomains(domains, badAssignments, devices, cables, services);
    expect(issues.some((i) => i.id.includes('domain-missing'))).toBe(true);
  });

  it('info on orphaned device references', () => {
    const badAssignments: DomainAssignment[] = [
      { domainId: 'd1', deviceIds: ['ghost'] },
    ];
    const issues = validateDomains(domains, badAssignments, devices, cables, services);
    expect(issues.some((i) => i.id.includes('domain-orphan-device'))).toBe(true);
  });

  it('info on orphaned cable references', () => {
    const badAssignments: DomainAssignment[] = [
      { domainId: 'd1', cableIds: ['ghost'] },
    ];
    const issues = validateDomains(domains, badAssignments, devices, cables, services);
    expect(issues.some((i) => i.id.includes('domain-orphan-cable'))).toBe(true);
  });

  it('info on orphaned service references', () => {
    const badAssignments: DomainAssignment[] = [
      { domainId: 'd1', serviceIds: ['ghost'] },
    ];
    const issues = validateDomains(domains, badAssignments, devices, cables, services);
    expect(issues.some((i) => i.id.includes('domain-orphan-service'))).toBe(true);
  });

  it('critical on single-domain critical service', () => {
    const singleDomainAssignments: DomainAssignment[] = [
      { domainId: 'd1', serviceIds: ['svc1'] },
    ];
    const issues = validateDomains(domains, singleDomainAssignments, devices, cables, services);
    const critical = issues.find((i) => i.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical?.title).toContain('single failure domain');
  });

  it('ignores non-critical services for SPOF', () => {
    const lowService: RackService[] = [
      { id: 'svc-low', name: 'Low Service', criticality: 'low' },
    ];
    const singleDomainAssignments: DomainAssignment[] = [
      { domainId: 'd1', serviceIds: ['svc-low'] },
    ];
    const issues = validateDomains(domains, singleDomainAssignments, devices, cables, lowService);
    expect(issues.some((i) => i.severity === 'critical')).toBe(false);
  });

  it('passes when critical service spans multiple domains', () => {
    const multiDomainAssignments: DomainAssignment[] = [
      { domainId: 'd1', serviceIds: ['svc1'] },
      { domainId: 'd2', serviceIds: ['svc1'] },
    ];
    const issues = validateDomains(domains, multiDomainAssignments, devices, cables, services);
    expect(issues.some((i) => i.severity === 'critical')).toBe(false);
  });
});

describe('exportDomainsMarkdown', () => {
  it('includes domain names and assignments', () => {
    const md = exportDomainsMarkdown(domains, assignments, devices, cables);
    expect(md).toContain('# Failure Domains');
    expect(md).toContain('Circuit A');
    expect(md).toContain('Switch A');
    expect(md).toContain('Router');
    expect(md).toContain('Switch');
  });
});

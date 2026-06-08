import type {
  CableRoute,
  DomainAssignment,
  FailureDomain,
  PlacedDevice,
  RackService,
  ValidationIssue,
} from '../types/rack';

export const DOMAIN_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export function getDomainTypeLabel(type: FailureDomain['type']): string {
  switch (type) {
    case 'power':
      return 'Power';
    case 'network':
      return 'Network';
    case 'storage':
      return 'Storage';
    case 'site':
      return 'Site / Room';
    case 'management':
      return 'Management';
    case 'cooling':
      return 'Cooling';
  }
}

export function getDomainsForDevice(
  domains: FailureDomain[],
  assignments: DomainAssignment[],
  deviceId: string
): FailureDomain[] {
  const domainIds = assignments
    .filter((a) => a.deviceIds?.includes(deviceId))
    .map((a) => a.domainId);
  return domains.filter((d) => domainIds.includes(d.id));
}

export function getDomainsForCable(
  domains: FailureDomain[],
  assignments: DomainAssignment[],
  cableId: string
): FailureDomain[] {
  const domainIds = assignments
    .filter((a) => a.cableIds?.includes(cableId))
    .map((a) => a.domainId);
  return domains.filter((d) => domainIds.includes(d.id));
}

export function getUnassignedDevices(
  devices: PlacedDevice[],
  assignments: DomainAssignment[]
): PlacedDevice[] {
  const assignedIds = new Set<string>();
  for (const a of assignments) {
    a.deviceIds?.forEach((id) => assignedIds.add(id));
  }
  return devices.filter((d) => !assignedIds.has(d.id));
}

export function getUnassignedCables(
  cables: CableRoute[],
  assignments: DomainAssignment[]
): CableRoute[] {
  const assignedIds = new Set<string>();
  for (const a of assignments) {
    a.cableIds?.forEach((id) => assignedIds.add(id));
  }
  return cables.filter((c) => !assignedIds.has(c.id));
}

export function getDomainAssignment(
  assignments: DomainAssignment[],
  domainId: string
): DomainAssignment | undefined {
  return assignments.find((a) => a.domainId === domainId);
}

export function summarizeDomains(
  domains: FailureDomain[],
  assignments: DomainAssignment[],
  devices: PlacedDevice[],
  cables: CableRoute[]
): {
  totalDomains: number;
  byType: Record<string, number>;
  assignedDevices: number;
  assignedCables: number;
  unassignedDevices: number;
  unassignedCables: number;
} {
  const byType: Record<string, number> = {};
  for (const d of domains) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
  }

  const assignedDeviceIds = new Set<string>();
  const assignedCableIds = new Set<string>();
  for (const a of assignments) {
    a.deviceIds?.forEach((id) => assignedDeviceIds.add(id));
    a.cableIds?.forEach((id) => assignedCableIds.add(id));
  }

  return {
    totalDomains: domains.length,
    byType,
    assignedDevices: assignedDeviceIds.size,
    assignedCables: assignedCableIds.size,
    unassignedDevices: devices.length - assignedDeviceIds.size,
    unassignedCables: cables.length - assignedCableIds.size,
  };
}

export function validateDomains(
  domains: FailureDomain[],
  assignments: DomainAssignment[],
  devices: PlacedDevice[],
  cables: CableRoute[],
  services: RackService[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for devices assigned to non-existent domains
  for (const a of assignments) {
    if (!domains.some((d) => d.id === a.domainId)) {
      issues.push({
        id: `domain-missing-${a.domainId}`,
        severity: 'warning',
        title: 'Assignment references deleted domain',
        detail: `An assignment references domain ${a.domainId} which no longer exists.`,
      });
    }
  }

  // Check for orphaned device references
  for (const a of assignments) {
    for (const deviceId of a.deviceIds ?? []) {
      if (!devices.some((d) => d.id === deviceId)) {
        issues.push({
          id: `domain-orphan-device-${a.domainId}-${deviceId}`,
          severity: 'info',
          title: 'Domain assignment references missing device',
          detail: `Domain assignment references device ${deviceId} which no longer exists.`,
        });
      }
    }
    for (const cableId of a.cableIds ?? []) {
      if (!cables.some((c) => c.id === cableId)) {
        issues.push({
          id: `domain-orphan-cable-${a.domainId}-${cableId}`,
          severity: 'info',
          title: 'Domain assignment references missing cable',
          detail: `Domain assignment references cable ${cableId} which no longer exists.`,
        });
      }
    }
    for (const serviceId of a.serviceIds ?? []) {
      if (!services.some((s) => s.id === serviceId)) {
        issues.push({
          id: `domain-orphan-service-${a.domainId}-${serviceId}`,
          severity: 'info',
          title: 'Domain assignment references missing service',
          detail: `Domain assignment references service ${serviceId} which no longer exists.`,
        });
      }
    }
  }

  // Check for critical services in single domain
  const serviceDomainMap = new Map<string, string[]>();
  for (const a of assignments) {
    for (const serviceId of a.serviceIds ?? []) {
      const list = serviceDomainMap.get(serviceId) ?? [];
      list.push(a.domainId);
      serviceDomainMap.set(serviceId, list);
    }
  }
  for (const service of services) {
    if (service.criticality !== 'critical' && service.criticality !== 'high') continue;
    const domainIds = serviceDomainMap.get(service.id) ?? [];
    if (domainIds.length === 1) {
      const domain = domains.find((d) => d.id === domainIds[0]);
      issues.push({
        id: `domain-spof-service-${service.id}`,
        severity: 'critical',
        title: 'Critical service depends on single failure domain',
        detail: `Service "${service.name}" is assigned to only one failure domain (${domain?.name ?? domainIds[0]}). Consider adding redundancy across domains.`,
        deviceIds: [service.hostDeviceId].filter(Boolean) as string[],
      });
    }
  }

  return issues;
}

export function exportDomainsMarkdown(
  domains: FailureDomain[],
  assignments: DomainAssignment[],
  devices: PlacedDevice[],
  cables: CableRoute[]
): string {
  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;
  const cableName = (id: string) => {
    const c = cables.find((x) => x.id === id);
    if (!c) return id;
    const from = devices.find((d) => d.id === c.fromDeviceId)?.name ?? c.fromDeviceId;
    const to = devices.find((d) => d.id === c.toDeviceId)?.name ?? c.toDeviceId;
    return `${from} → ${to}`;
  };

  const lines: string[] = [
    '# Failure Domains',
    '',
    `**Total Domains:** ${domains.length}`,
    '',
  ];

  for (const d of domains) {
    const a = getDomainAssignment(assignments, d.id);
    lines.push(`## ${d.name} (${getDomainTypeLabel(d.type)})`, '');
    if (d.notes) lines.push(d.notes, '');
    if ((a?.deviceIds?.length ?? 0) > 0) {
      lines.push('**Devices:**', '');
      for (const id of a?.deviceIds ?? []) {
        lines.push(`- ${deviceName(id)}`);
      }
      lines.push('');
    }
    if ((a?.cableIds?.length ?? 0) > 0) {
      lines.push('**Cables:**', '');
      for (const id of a?.cableIds ?? []) {
        lines.push(`- ${cableName(id)}`);
      }
      lines.push('');
    }
  }

  lines.push('---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}

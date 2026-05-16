import type { CableRoute, PlacedDevice, RackLayout, RackReservation } from '../types/rack';
import { detectLabelInconsistencies } from './cableLabeling';

export interface LabelDebtIssue {
  id: string;
  type: 'device-missing-label' | 'device-missing-serial' | 'device-missing-asset-tag' |
        'cable-missing-port' | 'cable-self-loop' | 'cable-orphaned' |
        'cable-duplicate-source' | 'reservation-missing-name';
  message: string;
  entityId: string;
  entityType: 'device' | 'cable' | 'reservation';
  severity: 'low' | 'medium' | 'high';
  zone: 'upper' | 'middle' | 'lower';
}

export interface ZoneScore {
  zone: 'upper' | 'middle' | 'lower';
  totalEntities: number;
  issueCount: number;
  score: number; // 0-100
}

export interface LabelDebtReport {
  overallScore: number;
  totalIssues: number;
  issues: LabelDebtIssue[];
  zoneScores: ZoneScore[];
  deviceCount: number;
  cableCount: number;
  reservationCount: number;
}

function getZone(positionU: number, heightU: number): 'upper' | 'middle' | 'lower' {
  const third = heightU / 3;
  if (positionU > heightU - third) return 'upper';
  if (positionU > heightU - 2 * third) return 'middle';
  return 'lower';
}

function deviceZone(device: PlacedDevice, heightU: number): 'upper' | 'middle' | 'lower' {
  return getZone(device.positionU, heightU);
}

export function calculateLabelDebt(layout: RackLayout): LabelDebtReport {
  const issues: LabelDebtIssue[] = [];
  const heightU = layout.heightU;

  // Device checks
  for (const device of layout.devices) {
    const zone = deviceZone(device, heightU);

    if (!device.label || device.label.trim() === '') {
      issues.push({
        id: `dev-label-${device.id}`,
        type: 'device-missing-label',
        message: `${device.name} has no label set`,
        entityId: device.id,
        entityType: 'device',
        severity: 'medium',
        zone,
      });
    }

    if (!device.serialNumber || device.serialNumber.trim() === '') {
      issues.push({
        id: `dev-serial-${device.id}`,
        type: 'device-missing-serial',
        message: `${device.name} has no serial number`,
        entityId: device.id,
        entityType: 'device',
        severity: 'low',
        zone,
      });
    }

    if (!device.assetTag || device.assetTag.trim() === '') {
      issues.push({
        id: `dev-asset-${device.id}`,
        type: 'device-missing-asset-tag',
        message: `${device.name} has no asset tag`,
        entityId: device.id,
        entityType: 'device',
        severity: 'low',
        zone,
      });
    }
  }

  // Cable checks
  const inconsistencies = detectLabelInconsistencies(layout.cables, layout.devices);
  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));

  for (const cable of layout.cables) {
    const fromDevice = deviceMap.get(cable.fromDeviceId);
    const zone = fromDevice ? deviceZone(fromDevice, heightU) : 'middle';

    if (!cable.fromPort || !cable.toPort) {
      issues.push({
        id: `cable-port-${cable.id}`,
        type: 'cable-missing-port',
        message: `Cable ${cable.id} is missing ${!cable.fromPort && !cable.toPort ? 'both' : 'one'} port assignment`,
        entityId: cable.id,
        entityType: 'cable',
        severity: 'high',
        zone,
      });
    }
  }

  for (const inconsistency of inconsistencies) {
    const cable = layout.cables.find((c) => c.id === inconsistency.cableId);
    const fromDevice = cable ? deviceMap.get(cable.fromDeviceId) : undefined;
    const zone = fromDevice ? deviceZone(fromDevice, heightU) : 'middle';

    let type: LabelDebtIssue['type'] = 'cable-missing-port';
    let severity: LabelDebtIssue['severity'] = 'medium';

    switch (inconsistency.issue) {
      case 'self-loop':
        type = 'cable-self-loop';
        severity = 'medium';
        break;
      case 'orphaned-device':
        type = 'cable-orphaned';
        severity = 'high';
        break;
      case 'duplicate-source':
        type = 'cable-duplicate-source';
        severity = 'high';
        break;
      case 'missing-port':
        type = 'cable-missing-port';
        severity = 'high';
        break;
    }

    issues.push({
      id: `cable-${inconsistency.issue}-${inconsistency.cableId}`,
      type,
      message: inconsistency.message,
      entityId: inconsistency.cableId,
      entityType: 'cable',
      severity,
      zone,
    });
  }

  // Reservation checks
  for (const res of layout.reservations ?? []) {
    const zone = getZone(res.positionU, heightU);
    if (!res.name || res.name.trim() === '') {
      issues.push({
        id: `res-name-${res.id}`,
        type: 'reservation-missing-name',
        message: `Reservation at U${res.positionU} has no name`,
        entityId: res.id,
        entityType: 'reservation',
        severity: 'low',
        zone,
      });
    }
  }

  // Calculate zone scores
  const zones: ('upper' | 'middle' | 'lower')[] = ['upper', 'middle', 'lower'];
  const zoneScores: ZoneScore[] = zones.map((zone) => {
    const zoneDevices = layout.devices.filter((d) => deviceZone(d, heightU) === zone);
    const zoneCables = layout.cables.filter((c) => {
      const fromDevice = deviceMap.get(c.fromDeviceId);
      return fromDevice ? deviceZone(fromDevice, heightU) === zone : false;
    });
    const zoneReservations = (layout.reservations ?? []).filter((r) => getZone(r.positionU, heightU) === zone);

    const totalEntities = zoneDevices.length + zoneCables.length + zoneReservations.length;
    const issueCount = issues.filter((i) => i.zone === zone).length;
    const score = totalEntities > 0 ? Math.max(0, Math.round(100 - (issueCount / totalEntities) * 100)) : 100;

    return { zone, totalEntities, issueCount, score };
  });

  const totalEntities = layout.devices.length + layout.cables.length + (layout.reservations ?? []).length;
  const overallScore = totalEntities > 0 ? Math.max(0, Math.round(100 - (issues.length / totalEntities) * 100)) : 100;

  return {
    overallScore,
    totalIssues: issues.length,
    issues: issues.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity)),
    zoneScores,
    deviceCount: layout.devices.length,
    cableCount: layout.cables.length,
    reservationCount: (layout.reservations ?? []).length,
  };
}

function severityOrder(severity: string): number {
  switch (severity) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

export function exportLabelDebtMarkdown(report: LabelDebtReport, layoutName: string): string {
  const lines: string[] = [
    `# Label Debt Report — ${layoutName}`,
    '',
    `**Overall Score:** ${report.overallScore}/100`,
    `**Total Issues:** ${report.totalIssues}`,
    '',
    '## Zone Breakdown',
    '',
    '| Zone | Entities | Issues | Score |',
    '|------|----------|--------|-------|',
  ];

  for (const zs of report.zoneScores) {
    const bar = '█'.repeat(Math.round(zs.score / 10)) + '░'.repeat(10 - Math.round(zs.score / 10));
    lines.push(`| ${zs.zone} | ${zs.totalEntities} | ${zs.issueCount} | ${bar} ${zs.score}% |`);
  }

  lines.push('', '## Issues by Severity', '');

  const bySeverity: Record<string, LabelDebtIssue[]> = {};
  for (const issue of report.issues) {
    bySeverity[issue.severity] = bySeverity[issue.severity] ?? [];
    bySeverity[issue.severity].push(issue);
  }

  for (const severity of ['high', 'medium', 'low'] as const) {
    const list = bySeverity[severity] ?? [];
    if (list.length === 0) continue;
    lines.push(`### ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${list.length})`, '');
    for (const issue of list) {
      lines.push(`- **${issue.entityType}** \`${issue.entityId}\` — ${issue.message} (${issue.zone})`);
    }
    lines.push('');
  }

  lines.push(
    '---',
    '',
    '*Generated by Homelab Rack Simulator*',
    ''
  );

  return lines.join('\n');
}

export function exportLabelDebtCsv(report: LabelDebtReport): string {
  const headers = ['ID', 'Type', 'Severity', 'Entity Type', 'Entity ID', 'Message', 'Zone'];
  const lines: string[] = [headers.join(',')];

  for (const issue of report.issues) {
    const row = [
      issue.id,
      issue.type,
      issue.severity,
      issue.entityType,
      issue.entityId,
      `"${issue.message.replace(/"/g, '""')}"`,
      issue.zone,
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

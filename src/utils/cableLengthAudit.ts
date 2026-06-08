import type { CableLengthAuditEntry, CableRoute, PlacedDevice } from '../types/rack';

export interface CableLengthComparison {
  cableId: string;
  fromDeviceName: string;
  toDeviceName: string;
  plannedLengthMm: number | null;
  plannedLengthDisplay: string;
  actualLengthMm: number | null;
  actualLengthDisplay: string;
  differenceMm: number | null;
  differencePercent: number | null;
  status: 'exact' | 'close' | 'mismatch' | 'missing-planned' | 'missing-actual' | 'both-missing';
}

export interface ExcessCable {
  lengthMm: number;
  count: number;
}

const TOLERANCE_PERCENT = 10;

export function compareCableLengths(
  cables: CableRoute[],
  auditEntries: CableLengthAuditEntry[],
  devices: PlacedDevice[]
): CableLengthComparison[] {
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const auditMap = new Map(auditEntries.map((e) => [e.cableId, e]));

  return cables.map((cable) => {
    const fromDevice = deviceMap.get(cable.fromDeviceId);
    const toDevice = deviceMap.get(cable.toDeviceId);
    const audit = auditMap.get(cable.id);

    const plannedLengthMm = cable.lengthMm ?? null;
    const actualLengthMm = audit?.actualLengthMm ?? null;

    let differenceMm: number | null = null;
    let differencePercent: number | null = null;
    let status: CableLengthComparison['status'] = 'both-missing';

    if (plannedLengthMm != null && actualLengthMm != null) {
      differenceMm = Math.abs(actualLengthMm - plannedLengthMm);
      if (plannedLengthMm > 0) {
        differencePercent = Math.round((differenceMm / plannedLengthMm) * 100);
      }

      if (differencePercent != null && differencePercent <= TOLERANCE_PERCENT) {
        status = differencePercent === 0 ? 'exact' : 'close';
      } else {
        status = 'mismatch';
      }
    } else if (plannedLengthMm != null) {
      status = 'missing-actual';
    } else if (actualLengthMm != null) {
      status = 'missing-planned';
    }

    return {
      cableId: cable.id,
      fromDeviceName: fromDevice?.name ?? cable.fromDeviceId,
      toDeviceName: toDevice?.name ?? cable.toDeviceId,
      plannedLengthMm,
      plannedLengthDisplay: formatLength(plannedLengthMm),
      actualLengthMm,
      actualLengthDisplay: formatLength(actualLengthMm),
      differenceMm,
      differencePercent,
      status,
    };
  });
}

function formatLength(lengthMm: number | null): string {
  if (lengthMm == null) return '-';
  if (lengthMm >= 1000) {
    return `${(lengthMm / 1000).toFixed(2)}m`;
  }
  return `${lengthMm}mm`;
}

export function findExcessCables(
  cables: CableRoute[],
  auditEntries: CableLengthAuditEntry[]
): ExcessCable[] {
  const auditMap = new Map(auditEntries.map((e) => [e.cableId, e]));
  const lengthCounts = new Map<number, number>();

  for (const cable of cables) {
    const audit = auditMap.get(cable.id);
    if (audit?.actualLengthMm != null) {
      const roundedMm = Math.round(audit.actualLengthMm / 100) * 100;
      lengthCounts.set(roundedMm, (lengthCounts.get(roundedMm) ?? 0) + 1);
    }
  }

  return Array.from(lengthCounts.entries())
    .map(([lengthMm, count]) => ({ lengthMm, count }))
    .sort((a, b) => b.count - a.count);
}

export function summarizeCableLengthAudits(
  comparisons: CableLengthComparison[]
): {
  totalCables: number;
  auditedCount: number;
  exactCount: number;
  closeCount: number;
  mismatchCount: number;
  missingPlannedCount: number;
  missingActualCount: number;
} {
  return {
    totalCables: comparisons.length,
    auditedCount: comparisons.filter((c) => c.actualLengthMm != null).length,
    exactCount: comparisons.filter((c) => c.status === 'exact').length,
    closeCount: comparisons.filter((c) => c.status === 'close').length,
    mismatchCount: comparisons.filter((c) => c.status === 'mismatch').length,
    missingPlannedCount: comparisons.filter((c) => c.status === 'missing-planned').length,
    missingActualCount: comparisons.filter((c) => c.status === 'missing-actual').length,
  };
}

function escapeCsvField(value: string | number | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCableLengthAuditCsv(comparisons: CableLengthComparison[]): string {
  const headers = [
    'Cable ID',
    'From',
    'To',
    'Planned',
    'Actual',
    'Difference',
    'Difference %',
    'Status',
  ];
  const lines: string[] = [headers.join(',')];

  for (const c of comparisons) {
    const row = [
      escapeCsvField(c.cableId),
      escapeCsvField(c.fromDeviceName),
      escapeCsvField(c.toDeviceName),
      escapeCsvField(c.plannedLengthDisplay),
      escapeCsvField(c.actualLengthDisplay),
      escapeCsvField(c.differenceMm != null ? `${c.differenceMm}mm` : '-'),
      escapeCsvField(c.differencePercent != null ? `${c.differencePercent}%` : '-'),
      escapeCsvField(c.status),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function exportCableLengthAuditMarkdown(
  comparisons: CableLengthComparison[],
  excessCables: ExcessCable[]
): string {
  const summary = summarizeCableLengthAudits(comparisons);

  const lines: string[] = [
    '# Cable Length Audit',
    '',
    `**Total Cables:** ${summary.totalCables}  `,
    `**Audited:** ${summary.auditedCount}  `,
    `**Exact Match:** ${summary.exactCount}  `,
    `**Within Tolerance:** ${summary.closeCount}  `,
    `**Mismatch:** ${summary.mismatchCount}  `,
    `**Missing Planned:** ${summary.missingPlannedCount}  `,
    `**Missing Actual:** ${summary.missingActualCount}`,
    '',
    '| Cable ID | From | To | Planned | Actual | Diff | Status |',
    '|----------|------|----|---------|--------|------|--------|',
  ];

  for (const c of comparisons) {
    const diff =
      c.differenceMm != null && c.differencePercent != null
        ? `${c.differenceMm}mm (${c.differencePercent}%)`
        : '-';
    lines.push(
      `| ${c.cableId} | ${c.fromDeviceName} | ${c.toDeviceName} | ${c.plannedLengthDisplay} | ${c.actualLengthDisplay} | ${diff} | ${c.status} |`
    );
  }

  if (excessCables.length > 0) {
    lines.push('', '## Excess Cable Inventory', '');
    for (const excess of excessCables) {
      const lengthDisplay = excess.lengthMm >= 1000
        ? `${(excess.lengthMm / 1000).toFixed(1)}m`
        : `${excess.lengthMm}mm`;
      lines.push(`- ${lengthDisplay}: ${excess.count} cable(s)`);
    }
  }

  return lines.join('\n');
}

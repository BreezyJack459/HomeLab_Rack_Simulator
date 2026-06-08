import type { CableRoute, PlacedDevice, PortRef } from '../types/rack';

export interface CableLabel {
  cableId: string;
  fromLabel: string;
  toLabel: string;
  bothEnds: string;
  type: string;
  length: string;
}

export interface LabelInconsistency {
  cableId: string;
  issue: 'duplicate-source' | 'missing-port' | 'self-loop' | 'orphaned-device';
  message: string;
}

export function generatePortLabel(deviceName: string, port?: PortRef): string {
  if (!port) return `${deviceName}:?`;
  const typeUpper = port.type.toUpperCase();
  const index = port.index + 1;
  return `${deviceName}:${typeUpper}${index}`;
}

export function generateCableLabel(
  cable: CableRoute,
  deviceMap: Map<string, PlacedDevice>,
  rackName: string
): CableLabel {
  const fromDevice = deviceMap.get(cable.fromDeviceId);
  const toDevice = deviceMap.get(cable.toDeviceId);

  const fromName = fromDevice?.name ?? cable.fromDeviceId;
  const toName = toDevice?.name ?? cable.toDeviceId;

  const fromLabel = generatePortLabel(fromName, cable.fromPort);
  const toLabel = generatePortLabel(toName, cable.toPort);

  return {
    cableId: cable.id,
    fromLabel,
    toLabel,
    bothEnds: `${rackName}-${fromLabel} <-> ${rackName}-${toLabel}`,
    type: cable.type,
    length: cable.length ?? '-',
  };
}

export function generateAllCableLabels(
  cables: CableRoute[],
  devices: PlacedDevice[],
  rackName: string
): CableLabel[] {
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  return cables.map((c) => generateCableLabel(c, deviceMap, rackName));
}

export function detectLabelInconsistencies(
  cables: CableRoute[],
  devices: PlacedDevice[]
): LabelInconsistency[] {
  const issues: LabelInconsistency[] = [];
  const deviceMap = new Map(devices.map((d) => [d.id, d]));

  // Track source labels to detect duplicates
  const sourceLabels = new Map<string, string[]>();

  for (const cable of cables) {
    const fromDevice = deviceMap.get(cable.fromDeviceId);
    const toDevice = deviceMap.get(cable.toDeviceId);

    // Self-loop check
    if (cable.fromDeviceId === cable.toDeviceId) {
      issues.push({
        cableId: cable.id,
        issue: 'self-loop',
        message: `Cable connects ${fromDevice?.name ?? cable.fromDeviceId} to itself`,
      });
    }

    // Orphaned device check
    if (!fromDevice) {
      issues.push({
        cableId: cable.id,
        issue: 'orphaned-device',
        message: `Source device ${cable.fromDeviceId} not found in rack`,
      });
    }
    if (!toDevice) {
      issues.push({
        cableId: cable.id,
        issue: 'orphaned-device',
        message: `Destination device ${cable.toDeviceId} not found in rack`,
      });
    }

    // Missing port check
    if (!cable.fromPort || !cable.toPort) {
      issues.push({
        cableId: cable.id,
        issue: 'missing-port',
        message: `Cable is missing ${!cable.fromPort ? 'source' : ''}${!cable.fromPort && !cable.toPort ? ' and ' : ''}${!cable.toPort ? 'destination' : ''} port assignment`,
      });
    }

    // Track for duplicate detection
    if (cable.fromPort && fromDevice) {
      const sourceKey = `${fromDevice.name}:${cable.fromPort.type}${cable.fromPort.index + 1}`;
      const existing = sourceLabels.get(sourceKey) ?? [];
      existing.push(cable.id);
      sourceLabels.set(sourceKey, existing);
    }
  }

  // Detect duplicate sources
  for (const [sourceKey, cableIds] of sourceLabels) {
    if (cableIds.length > 1) {
      for (const cableId of cableIds) {
        issues.push({
          cableId,
          issue: 'duplicate-source',
          message: `Port ${sourceKey} is used by ${cableIds.length} cables`,
        });
      }
    }
  }

  return issues;
}

function escapeCsvField(value: string | undefined): string {
  if (value == null) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCableLabelsCsv(labels: CableLabel[]): string {
  const headers = ['Cable ID', 'From', 'To', 'Both Ends', 'Type', 'Length'];
  const lines: string[] = [headers.join(',')];

  for (const label of labels) {
    const row = [
      escapeCsvField(label.cableId),
      escapeCsvField(label.fromLabel),
      escapeCsvField(label.toLabel),
      escapeCsvField(label.bothEnds),
      escapeCsvField(label.type),
      escapeCsvField(label.length),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function exportCableLabelsMarkdown(
  labels: CableLabel[],
  inconsistencies: LabelInconsistency[]
): string {
  const lines: string[] = [
    '# Cable Label Protocol',
    '',
    `**Total Cables:** ${labels.length}`,
    `**Inconsistencies:** ${inconsistencies.length}`,
    '',
    '| Cable ID | From | To | Type | Length |',
    '|----------|------|----|------|--------|',
  ];

  for (const label of labels) {
    lines.push(
      `| ${label.cableId} | ${label.fromLabel} | ${label.toLabel} | ${label.type} | ${label.length} |`
    );
  }

  if (inconsistencies.length > 0) {
    lines.push('', '## Inconsistencies', '');
    for (const issue of inconsistencies) {
      lines.push(`- **${issue.cableId}** (${issue.issue}): ${issue.message}`);
    }
  }

  lines.push(
    '',
    '## Label Printer Notes',
    '',
    '- Print one label per cable end',
    '- Both-end format: `Rack-Device:PORT <-> Rack-Device:PORT`',
    '- Trim to fit your label printer width',
    ''
  );

  return lines.join('\n');
}

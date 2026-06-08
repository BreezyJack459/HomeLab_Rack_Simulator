import type { PlacedDevice, SparePart } from '../types/rack';

export interface SparePartsSummary {
  totalParts: number;
  totalQuantity: number;
  byCondition: Record<string, number>;
  byCategory: Record<string, number>;
  missingCompatibleDevices: number;
}

export function summarizeSpareParts(parts: SparePart[], devices: PlacedDevice[]): SparePartsSummary {
  let totalQuantity = 0;
  const byCondition: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let missingCompatibleDevices = 0;

  const deviceIds = new Set(devices.map((d) => d.id));

  for (const part of parts) {
    totalQuantity += part.quantity;
    byCondition[part.condition] = (byCondition[part.condition] ?? 0) + part.quantity;
    byCategory[part.category] = (byCategory[part.category] ?? 0) + part.quantity;

    if (part.compatibleDeviceIds && part.compatibleDeviceIds.length > 0) {
      const hasMatch = part.compatibleDeviceIds.some((id) => deviceIds.has(id));
      if (!hasMatch) missingCompatibleDevices += 1;
    }
  }

  return {
    totalParts: parts.length,
    totalQuantity,
    byCondition,
    byCategory,
    missingCompatibleDevices,
  };
}

export interface CompatiblePartInfo {
  part: SparePart;
  deviceId: string;
  deviceName: string;
}

export function findCompatibleParts(parts: SparePart[], devices: PlacedDevice[]): CompatiblePartInfo[] {
  const result: CompatiblePartInfo[] = [];
  for (const part of parts) {
    if (!part.compatibleDeviceIds || part.compatibleDeviceIds.length === 0) continue;
    for (const deviceId of part.compatibleDeviceIds) {
      const device = devices.find((d) => d.id === deviceId);
      if (device) {
        result.push({ part, deviceId, deviceName: device.name });
      }
    }
  }
  return result;
}

export function exportSparePartsCsv(parts: SparePart[]): string {
  const headers = ['Name', 'Category', 'Quantity', 'Condition', 'Storage Location', 'Compatible Devices', 'Notes'];
  const lines: string[] = [headers.join(',')];

  function escape(value: string | number | undefined): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  for (const part of parts) {
    const compat = part.compatibleDeviceIds?.join('; ') ?? '';
    const row = [
      escape(part.name),
      escape(part.category),
      escape(part.quantity),
      escape(part.condition),
      escape(part.storageLocation),
      escape(compat),
      escape(part.notes),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function exportSparePartsMarkdown(parts: SparePart[], devices: PlacedDevice[]): string {
  const summary = summarizeSpareParts(parts, devices);
  const compatibles = findCompatibleParts(parts, devices);

  const lines: string[] = [
    '# Spare Parts Inventory',
    '',
    `**Total Parts:** ${summary.totalParts}  `,
    `**Total Quantity:** ${summary.totalQuantity}  `,
    `**Orphaned Parts:** ${summary.missingCompatibleDevices}`,
    '',
    '## Inventory',
    '',
    '| Name | Category | Qty | Condition | Storage | Notes |',
    '|------|----------|-----|-----------|---------|-------|',
  ];

  for (const part of parts) {
    lines.push(
      `| ${part.name} | ${part.category} | ${part.quantity} | ${part.condition} | ${part.storageLocation ?? '-'} | ${part.notes ?? ''} |`
    );
  }

  if (Object.keys(summary.byCondition).length > 0) {
    lines.push('', '## By Condition', '');
    for (const [condition, qty] of Object.entries(summary.byCondition)) {
      lines.push(`- ${condition}: ${qty}`);
    }
  }

  if (Object.keys(summary.byCategory).length > 0) {
    lines.push('', '## By Category', '');
    for (const [category, qty] of Object.entries(summary.byCategory)) {
      lines.push(`- ${category}: ${qty}`);
    }
  }

  if (compatibles.length > 0) {
    lines.push('', '## Compatible With Rack Devices', '');
    for (const info of compatibles) {
      lines.push(`- ${info.part.name} → ${info.deviceName}`);
    }
  }

  return lines.join('\n');
}

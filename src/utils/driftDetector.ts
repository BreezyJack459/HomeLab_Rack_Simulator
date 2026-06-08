import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';

export type DriftSeverity = 'harmless' | 'review' | 'critical';

export interface DriftItem {
  id: string;
  severity: DriftSeverity;
  category: 'device' | 'cable' | 'property';
  title: string;
  detail: string;
  deviceIds?: string[];
  cableIds?: string[];
}

export interface DriftResult {
  items: DriftItem[];
  addedDevices: PlacedDevice[];
  removedDevices: PlacedDevice[];
  addedCables: CableRoute[];
  removedCables: CableRoute[];
  changedDevices: { before: PlacedDevice; after: PlacedDevice; changes: string[] }[];
  changedCables: { before: CableRoute; after: CableRoute; changes: string[] }[];
  summary: {
    total: number;
    harmless: number;
    review: number;
    critical: number;
  };
}

function deviceKey(d: PlacedDevice): string {
  return d.id;
}

function cableKey(c: CableRoute): string {
  return c.id;
}

function compareDevice(before: PlacedDevice, after: PlacedDevice): string[] {
  const changes: string[] = [];
  if (before.positionU !== after.positionU) changes.push(`position ${before.positionU}U → ${after.positionU}U`);
  if (before.sizeU !== after.sizeU) changes.push(`size ${before.sizeU}U → ${after.sizeU}U`);
  if (before.name !== after.name) changes.push(`name changed`);
  if (before.depthMm !== after.depthMm) changes.push(`depth ${before.depthMm}mm → ${after.depthMm}mm`);
  if (before.powerW !== after.powerW) changes.push(`power ${before.powerW}W → ${after.powerW}W`);
  if (before.weightKg !== after.weightKg) changes.push(`weight ${before.weightKg}kg → ${after.weightKg}kg`);
  if (before.category !== after.category) changes.push(`category ${before.category} → ${after.category}`);
  return changes;
}

function compareCable(before: CableRoute, after: CableRoute): string[] {
  const changes: string[] = [];
  if (before.fromDeviceId !== after.fromDeviceId) changes.push(`from device changed`);
  if (before.toDeviceId !== after.toDeviceId) changes.push(`to device changed`);
  if (before.type !== after.type) changes.push(`type ${before.type} → ${after.type}`);
  if (before.color !== after.color) changes.push(`color changed`);
  return changes;
}

export function detectDrift(baseline: RackLayout, current: RackLayout): DriftResult {
  const items: DriftItem[] = [];

  const beforeDevices = new Map(baseline.devices.map((d) => [deviceKey(d), d]));
  const afterDevices = new Map(current.devices.map((d) => [deviceKey(d), d]));
  const beforeCables = new Map(baseline.cables.map((c) => [cableKey(c), c]));
  const afterCables = new Map(current.cables.map((c) => [cableKey(c), c]));

  const addedDevices: PlacedDevice[] = [];
  const removedDevices: PlacedDevice[] = [];
  const changedDevices: DriftResult['changedDevices'] = [];

  for (const [id, d] of afterDevices) {
    if (!beforeDevices.has(id)) {
      addedDevices.push(d);
      items.push({
        id: `drift-device-added-${id}`,
        severity: 'review',
        category: 'device',
        title: `Device added: ${d.name}`,
        detail: `${d.name} (${d.category}, ${d.sizeU}U) is present in current layout but not in baseline.`,
        deviceIds: [id],
      });
    }
  }

  for (const [id, d] of beforeDevices) {
    if (!afterDevices.has(id)) {
      removedDevices.push(d);
      items.push({
        id: `drift-device-removed-${id}`,
        severity: 'critical',
        category: 'device',
        title: `Device removed: ${d.name}`,
        detail: `${d.name} (${d.category}, ${d.sizeU}U) was in baseline but is missing from current layout.`,
        deviceIds: [id],
      });
    }
  }

  for (const [id, before] of beforeDevices) {
    const after = afterDevices.get(id);
    if (!after) continue;
    const changes = compareDevice(before, after);
    if (changes.length > 0) {
      changedDevices.push({ before, after, changes });
      const isCritical = changes.some((c) => c.includes('position') || c.includes('size'));
      items.push({
        id: `drift-device-changed-${id}`,
        severity: isCritical ? 'critical' : 'review',
        category: 'device',
        title: `Device changed: ${before.name}`,
        detail: changes.join('; '),
        deviceIds: [id],
      });
    }
  }

  const addedCables: CableRoute[] = [];
  const removedCables: CableRoute[] = [];
  const changedCables: DriftResult['changedCables'] = [];

  for (const [id, c] of afterCables) {
    if (!beforeCables.has(id)) {
      addedCables.push(c);
      items.push({
        id: `drift-cable-added-${id}`,
        severity: 'review',
        category: 'cable',
        title: `Cable added`,
        detail: `New cable from ${c.fromDeviceId} to ${c.toDeviceId} (${c.type}).`,
        cableIds: [id],
      });
    }
  }

  for (const [id, c] of beforeCables) {
    if (!afterCables.has(id)) {
      removedCables.push(c);
      items.push({
        id: `drift-cable-removed-${id}`,
        severity: 'critical',
        category: 'cable',
        title: `Cable removed`,
        detail: `Cable from ${c.fromDeviceId} to ${c.toDeviceId} (${c.type}) was in baseline but is missing.`,
        cableIds: [id],
      });
    }
  }

  for (const [id, before] of beforeCables) {
    const after = afterCables.get(id);
    if (!after) continue;
    const changes = compareCable(before, after);
    if (changes.length > 0) {
      changedCables.push({ before, after, changes });
      items.push({
        id: `drift-cable-changed-${id}`,
        severity: 'critical',
        category: 'cable',
        title: `Cable changed`,
        detail: changes.join('; '),
        cableIds: [id],
      });
    }
  }

  // Property drift
  if (baseline.rackDepthMm !== current.rackDepthMm) {
    items.push({
      id: 'drift-property-depth',
      severity: 'harmless',
      category: 'property',
      title: 'Rack depth changed',
      detail: `Depth ${baseline.rackDepthMm}mm → ${current.rackDepthMm}mm`,
    });
  }
  if (baseline.powerBudgetW !== current.powerBudgetW) {
    items.push({
      id: 'drift-property-power',
      severity: 'review',
      category: 'property',
      title: 'Power budget changed',
      detail: `Budget ${baseline.powerBudgetW}W → ${current.powerBudgetW}W`,
    });
  }
  if (baseline.weightLimitKg !== current.weightLimitKg) {
    items.push({
      id: 'drift-property-weight',
      severity: 'harmless',
      category: 'property',
      title: 'Weight limit changed',
      detail: `Limit ${baseline.weightLimitKg}kg → ${current.weightLimitKg}kg`,
    });
  }

  const summary = {
    total: items.length,
    harmless: items.filter((i) => i.severity === 'harmless').length,
    review: items.filter((i) => i.severity === 'review').length,
    critical: items.filter((i) => i.severity === 'critical').length,
  };

  return {
    items,
    addedDevices,
    removedDevices,
    addedCables,
    removedCables,
    changedDevices,
    changedCables,
    summary,
  };
}

export function exportDriftMarkdown(result: DriftResult): string {
  const lines: string[] = [
    '# Configuration Drift Report',
    '',
    `**Total Changes:** ${result.summary.total}`,
    `- Harmless: ${result.summary.harmless}`,
    `- Needs Review: ${result.summary.review}`,
    `- Critical: ${result.summary.critical}`,
    '',
  ];

  if (result.addedDevices.length > 0) {
    lines.push('## Added Devices', '');
    for (const d of result.addedDevices) {
      lines.push(`- ${d.name} (${d.category}, ${d.sizeU}U)`);
    }
    lines.push('');
  }

  if (result.removedDevices.length > 0) {
    lines.push('## Removed Devices', '');
    for (const d of result.removedDevices) {
      lines.push(`- ${d.name} (${d.category}, ${d.sizeU}U)`);
    }
    lines.push('');
  }

  if (result.changedDevices.length > 0) {
    lines.push('## Changed Devices', '');
    for (const c of result.changedDevices) {
      lines.push(`- ${c.before.name}: ${c.changes.join('; ')}`);
    }
    lines.push('');
  }

  if (result.addedCables.length > 0) {
    lines.push('## Added Cables', '');
    for (const c of result.addedCables) {
      lines.push(`- ${c.fromDeviceId} → ${c.toDeviceId} (${c.type})`);
    }
    lines.push('');
  }

  if (result.removedCables.length > 0) {
    lines.push('## Removed Cables', '');
    for (const c of result.removedCables) {
      lines.push(`- ${c.fromDeviceId} → ${c.toDeviceId} (${c.type})`);
    }
    lines.push('');
  }

  if (result.changedCables.length > 0) {
    lines.push('## Changed Cables', '');
    for (const c of result.changedCables) {
      lines.push(`- ${c.changes.join('; ')}`);
    }
    lines.push('');
  }

  lines.push('---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}

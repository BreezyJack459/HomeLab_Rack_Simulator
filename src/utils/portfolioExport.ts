import type { PlacedDevice, RackLayout } from '../types/rack';
import { calculateEnergySummary } from './energyCalc';
import { getRackTotals, validateRackLayout } from './validation';

export interface PortfolioExportOptions {
  includeOverview: boolean;
  includeDevices: boolean;
  includeTopology: boolean;
  includePower: boolean;
  includeRedundancy: boolean;
  includeBackup: boolean;
  includeCables: boolean;
  includeSkills: boolean;
  redactSensitive: boolean;
}

export const DEFAULT_PORTFOLIO_OPTIONS: PortfolioExportOptions = {
  includeOverview: true,
  includeDevices: true,
  includeTopology: true,
  includePower: true,
  includeRedundancy: true,
  includeBackup: true,
  includeCables: true,
  includeSkills: true,
  redactSensitive: true,
};

function redact(value: string | undefined): string {
  if (!value) return '-';
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '***' + value.slice(-2);
}

function deviceCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    router: '🌐',
    switch: '🔀',
    firewall: '🛡️',
    'access-point': '📡',
    nas: '💾',
    server: '🖥️',
    ups: '🔋',
    pdu: '⚡',
    'patch-panel': '🔌',
    modem: '📶',
    'mini-pc': '🖥️',
    'poe-injector': '🔌',
    shelf: '📦',
    sbc: '🖥️',
    'ip-kvm': '🖥️',
    'cable-management': '🔗',
    blank: '⬜',
  };
  return icons[category] ?? '📦';
}

function categorizeDevices(devices: PlacedDevice[]): Record<string, PlacedDevice[]> {
  const groups: Record<string, PlacedDevice[]> = {};
  for (const d of devices) {
    groups[d.category] = groups[d.category] ?? [];
    groups[d.category].push(d);
  }
  return groups;
}

function redundancySummary(layout: RackLayout): {
  upsCount: number;
  dualPsuCount: number;
  circuitSplitCount: number;
  hasRedundantNetwork: boolean;
} {
  const upsCount = layout.devices.filter((d) => d.category === 'ups').length;
  // Devices with bootDependsOn or multiple power connections suggest dual PSU
  const dualPsuCount = layout.devices.filter(
    (d) => d.bootDependsOn && d.bootDependsOn.length > 0
  ).length;
  const circuitSplitCount = layout.devices.filter(
    (d) => d.circuit != null
  ).length;
  // Check if any device has multiple cable connections (redundant network)
  const deviceCableCounts = new Map<string, number>();
  for (const c of layout.cables) {
    deviceCableCounts.set(c.fromDeviceId, (deviceCableCounts.get(c.fromDeviceId) ?? 0) + 1);
    deviceCableCounts.set(c.toDeviceId, (deviceCableCounts.get(c.toDeviceId) ?? 0) + 1);
  }
  const hasRedundantNetwork = Array.from(deviceCableCounts.values()).some((count) => count > 2);

  return { upsCount, dualPsuCount, circuitSplitCount, hasRedundantNetwork };
}

function backupSummary(layout: RackLayout): {
  devicesWithBackups: number;
  totalBackups: number;
  recentTests: number;
  staleTests: number;
} {
  let devicesWithBackups = 0;
  let totalBackups = 0;
  let recentTests = 0;
  let staleTests = 0;

  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  for (const d of layout.devices) {
    if (d.backups && d.backups.length > 0) {
      devicesWithBackups++;
      totalBackups += d.backups.length;
      for (const b of d.backups) {
        if (b.lastRestoreTestDate) {
          const testDate = new Date(b.lastRestoreTestDate).getTime();
          if (now - testDate <= ninetyDays) {
            recentTests++;
          } else {
            staleTests++;
          }
        }
      }
    }
  }

  return { devicesWithBackups, totalBackups, recentTests, staleTests };
}

function cableTypeSummary(layout: RackLayout): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of layout.cables) {
    counts[c.type] = (counts[c.type] ?? 0) + 1;
  }
  return counts;
}

function detectSkills(layout: RackLayout): string[] {
  const skills: string[] = [];
  const categories = new Set(layout.devices.map((d) => d.category));
  const cableTypes = new Set(layout.cables.map((c) => c.type));

  if (categories.has('router') || categories.has('switch')) {
    skills.push('Network design (VLANs, routing, switching)');
  }
  if (categories.has('firewall')) {
    skills.push('Network security (firewall segmentation)');
  }
  if (categories.has('nas') || categories.has('server')) {
    skills.push('Server administration (NAS, virtualization, storage)');
  }
  if (categories.has('ups') || categories.has('pdu')) {
    skills.push('Power planning (UPS sizing, circuit design)');
  }
  if (cableTypes.has('fiber')) {
    skills.push('Fiber optic cabling');
  }
  if (layout.cables.length > 10) {
    skills.push('Structured cabling and cable management');
  }
  if (layout.devices.some((d) => d.backups && d.backups.length > 0)) {
    skills.push('Backup strategy and disaster recovery');
  }
  if (categories.has('access-point')) {
    skills.push('Wireless network design');
  }
  if (layout.devices.some((d) => d.networkInterfaces && d.networkInterfaces.length > 0)) {
    skills.push('IP address management and subnetting');
  }
  if (categories.has('patch-panel')) {
    skills.push('Patch panel documentation and port management');
  }
  if (layout.goldenBaseline) {
    skills.push('Change management and baseline tracking');
  }
  if (layout.devices.some((d) => d.lifecycleStatus === 'planned')) {
    skills.push('Infrastructure capacity planning');
  }

  return skills;
}

export function generatePortfolioMarkdown(
  layout: RackLayout,
  options: PortfolioExportOptions = DEFAULT_PORTFOLIO_OPTIONS
): string {
  const totals = getRackTotals(layout);
  const energy = calculateEnergySummary(layout);
  const redundancy = redundancySummary(layout);
  const backup = backupSummary(layout);
  const cableCounts = cableTypeSummary(layout);
  const deviceGroups = categorizeDevices(layout.devices);
  const skills = detectSkills(layout);

  const lines: string[] = [`# ${layout.name} — Homelab Portfolio`, ''];

  lines.push(
    `> Generated on ${new Date().toISOString().split('T')[0]}`,
    '>',
    '> This document summarizes the design, capabilities, and operational posture of a physical homelab rack.',
    ''
  );

  // Overview
  if (options.includeOverview) {
    lines.push(
      '## Rack Overview',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Rack Type | ${layout.rackType === '19in' ? '19-inch' : '10-inch'} |`,
      `| Height | ${layout.heightU}U |`,
      `| Devices | ${layout.devices.length} |`,
      `| Space Used | ${totals.occupiedU}/${layout.heightU}U (${Math.round((totals.occupiedU / layout.heightU) * 100)}%) |`,
      `| Power Draw | ${totals.powerW}W / ${layout.powerBudgetW}W budget |`,
      `| Weight | ${totals.weightKg.toFixed(1)} kg / ${layout.weightLimitKg} kg limit |`,
      `| Cables | ${layout.cables.length} |`,
      `| Validation Issues | ${validateRackLayout(layout).length} |`,
      ''
    );
  }

  // Devices
  if (options.includeDevices) {
    lines.push('## Device Inventory', '');
    for (const [category, devices] of Object.entries(deviceGroups).sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${deviceCategoryIcon(category)} ${category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} (${devices.length})`, '');
      for (const d of devices.sort((a, b) => a.positionU - b.positionU)) {
        const name = options.redactSensitive ? redact(d.name) : d.name;
        const serial = options.redactSensitive ? redact(d.serialNumber) : (d.serialNumber ?? '-');
        const assetTag = options.redactSensitive ? redact(d.assetTag) : (d.assetTag ?? '-');
        lines.push(`- **${name}** @ U${d.positionU} — ${d.powerW}W, ${d.sizeU}U`);
        if (d.serialNumber || d.assetTag) {
          lines.push(`  - Serial: ${serial}, Asset: ${assetTag}`);
        }
      }
      lines.push('');
    }
  }

  // Topology
  if (options.includeTopology) {
    lines.push(
      '## Network Topology',
      '',
      `**Devices:** ${layout.devices.length}  `,
      `**Cable Connections:** ${layout.cables.length}  `,
      `**Cable Types:** ${Object.keys(cableCounts).join(', ') || 'none'}`,
      ''
    );

    if (Object.keys(cableCounts).length > 0) {
      lines.push('### Cable Breakdown', '');
      for (const [type, count] of Object.entries(cableCounts).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${type}: ${count}`);
      }
      lines.push('');
    }
  }

  // Power
  if (options.includePower) {
    lines.push(
      '## Power & Energy',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Draw | ${energy.totalPowerW}W |`,
      `| Monthly kWh | ${energy.monthlyKwh.toFixed(1)} |`,
      `| Monthly Cost | $${energy.monthlyCost.toFixed(2)} |`,
      `| Heat Output | ${formatBtu(energy.heatBtuPerHour)} BTU/h |`,
      `| Budget Utilization | ${energy.utilizationPercent}% |`,
      ''
    );
  }

  // Redundancy
  if (options.includeRedundancy) {
    lines.push(
      '## Redundancy & Resilience',
      '',
      `| Component | Status |`,
      `|-----------|--------|`,
      `| UPS Units | ${redundancy.upsCount} |`,
      `| Dual-PSU Devices | ${redundancy.dualPsuCount} |`,
      `| Circuit Split (A/B) | ${redundancy.circuitSplitCount} devices |`,
      `| Redundant Network | ${redundancy.hasRedundantNetwork ? 'Yes' : 'No'} |`,
      ''
    );
  }

  // Backup
  if (options.includeBackup) {
    lines.push(
      '## Backup Posture',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Devices with Backups | ${backup.devicesWithBackups} / ${layout.devices.length} |`,
      `| Total Backup Jobs | ${backup.totalBackups} |`,
      `| Recent Restore Tests (<90d) | ${backup.recentTests} |`,
      `| Stale Restore Tests | ${backup.staleTests} |`,
      ''
    );
  }

  // Cables
  if (options.includeCables) {
    lines.push(
      '## Cable Summary',
      '',
      `**Total Cables:** ${layout.cables.length}  `,
      `**Bundle Groups:** ${new Set(layout.cables.map((c) => c.bundleId).filter(Boolean)).size}`,
      ''
    );
  }

  // Skills
  if (options.includeSkills) {
    lines.push('## Skills Demonstrated', '');
    for (const skill of skills) {
      lines.push(`- ${skill}`);
    }
    lines.push('');
  }

  // Footer
  lines.push(
    '---',
    '',
    `*Generated by Homelab Rack Simulator*  `,
    options.redactSensitive ? '*Sensitive values redacted*' : '*Full data export*',
    ''
  );

  return lines.join('\n');
}

function formatBtu(btu: number): string {
  if (btu >= 1000) return `${(btu / 1000).toFixed(1)}k`;
  return `${Math.round(btu)}`;
}

export function exportPortfolioMarkdown(
  layout: RackLayout,
  options: PortfolioExportOptions = DEFAULT_PORTFOLIO_OPTIONS
): string {
  return generatePortfolioMarkdown(layout, options);
}

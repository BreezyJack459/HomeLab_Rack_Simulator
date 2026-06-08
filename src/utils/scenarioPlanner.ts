import type { PlacedDevice, RackLayout } from '../types/rack';
import { analyzeBlastRadius } from './blastRadius';
import { calculateUpsRuntimes } from './upsRuntime';
import { isPowerSource } from './powerChain';
import { buildTopologyGraph } from './topologyGraph';

export type ScenarioPreset =
  | 'power-outage'
  | 'isp-down'
  | 'switch-reboot'
  | 'nas-disk-failure'
  | 'ups-battery-weak'
  | 'summer-heatwave'
  | 'ap-offline'
  | 'management-network-down';

export type ScenarioSeverity = 'critical' | 'warning' | 'info';

export interface ScenarioImpact {
  deviceId: string;
  deviceName: string;
  category: PlacedDevice['category'];
  reason: string;
  severity: ScenarioSeverity;
}

export interface ScenarioSurvivor {
  deviceId: string;
  deviceName: string;
  category: PlacedDevice['category'];
  reason: string;
}

export interface ScenarioAssumption {
  id: string;
  title: string;
  status: 'pass' | 'fail' | 'unknown';
  detail: string;
}

export interface ScenarioRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

export interface ScenarioMetrics {
  totalDevices: number;
  impactedCount: number;
  survivorCount: number;
  estimatedRuntimeMinutes?: number;
  affectedPowerW?: number;
}

export interface ScenarioResult {
  preset: ScenarioPreset;
  presetLabel: string;
  presetDescription: string;
  summary: string;
  impactedDevices: ScenarioImpact[];
  survivingDevices: ScenarioSurvivor[];
  failedAssumptions: ScenarioAssumption[];
  recommendations: ScenarioRecommendation[];
  metrics: ScenarioMetrics;
}

export interface ScenarioPresetMeta {
  id: ScenarioPreset;
  label: string;
  description: string;
  emoji: string;
}

export const SCENARIO_PRESETS: ScenarioPresetMeta[] = [
  {
    id: 'power-outage',
    label: 'Power Outage',
    description: 'Whole-room utility power loss. Only UPS-backed devices survive.',
    emoji: '⚡',
  },
  {
    id: 'isp-down',
    label: 'ISP Down',
    description: 'WAN uplink fails. Local services keep running, internet stops.',
    emoji: '🌐',
  },
  {
    id: 'switch-reboot',
    label: 'Core Switch Reboot',
    description: 'Largest aggregation switch goes offline for ~3 minutes.',
    emoji: '🔌',
  },
  {
    id: 'nas-disk-failure',
    label: 'NAS Failure',
    description: 'Primary NAS drops entirely (disk array failure or panic).',
    emoji: '💾',
  },
  {
    id: 'ups-battery-weak',
    label: 'Weak UPS Battery',
    description: 'UPS battery degrades to 50% of rated capacity.',
    emoji: '🔋',
  },
  {
    id: 'summer-heatwave',
    label: 'Summer Heatwave',
    description: 'Ambient temperature climbs ~5°C above normal.',
    emoji: '🌡️',
  },
  {
    id: 'ap-offline',
    label: 'All APs Offline',
    description: 'All wireless access points go down (controller issue, PoE fault).',
    emoji: '📶',
  },
  {
    id: 'management-network-down',
    label: 'Management Network Down',
    description: 'OOB / management VLAN unreachable. Remote console lost.',
    emoji: '🛠️',
  },
];

const PRESET_LOOKUP: Record<ScenarioPreset, ScenarioPresetMeta> = SCENARIO_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<ScenarioPreset, ScenarioPresetMeta>,
);

const NON_DEVICE_CATEGORIES = new Set<PlacedDevice['category']>([
  'blank',
  'cable-management',
  'shelf',
  'printed-mount',
]);

function isOperationalDevice(d: PlacedDevice): boolean {
  return !NON_DEVICE_CATEGORIES.has(d.category);
}

function impact(
  d: PlacedDevice,
  reason: string,
  severity: ScenarioSeverity = 'critical',
): ScenarioImpact {
  return {
    deviceId: d.id,
    deviceName: d.name,
    category: d.category,
    reason,
    severity,
  };
}

function survivor(d: PlacedDevice, reason: string): ScenarioSurvivor {
  return {
    deviceId: d.id,
    deviceName: d.name,
    category: d.category,
    reason,
  };
}

function buildBaseMetrics(layout: RackLayout, impacted: ScenarioImpact[]): ScenarioMetrics {
  const total = layout.devices.filter(isOperationalDevice).length;
  return {
    totalDevices: total,
    impactedCount: impacted.length,
    survivorCount: Math.max(0, total - impacted.length),
  };
}

function getDevicesPoweredByCircuit(layout: RackLayout, circuit: 'A' | 'B' | 'both'): PlacedDevice[] {
  return layout.devices.filter((d) => {
    if (!isOperationalDevice(d)) return false;
    if (isPowerSource(d)) return false;
    if (circuit === 'both') return true;
    return d.circuit === circuit;
  });
}

function getUpsBackedDeviceIds(layout: RackLayout): Set<string> {
  const upsIds = new Set(layout.devices.filter((d) => d.category === 'ups').map((d) => d.id));
  if (upsIds.size === 0) return new Set();

  const backed = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const cable of layout.cables) {
    if (cable.type !== 'power') continue;
    const list = adj.get(cable.fromDeviceId) ?? [];
    list.push(cable.toDeviceId);
    adj.set(cable.fromDeviceId, list);
  }

  const queue: string[] = [...upsIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (backed.has(current)) continue;
    backed.add(current);
    const next = adj.get(current);
    if (!next) continue;
    for (const id of next) {
      if (!backed.has(id)) queue.push(id);
    }
  }

  // Remove the UPS itself from "backed downstream" set for clarity
  for (const upsId of upsIds) backed.delete(upsId);
  return backed;
}

function simulatePowerOutage(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['power-outage'];
  const upsBackedIds = getUpsBackedDeviceIds(layout);
  const upsRuntimes = calculateUpsRuntimes(layout);

  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'ups') {
      survivors.push(survivor(device, 'UPS runs from battery during outage.'));
      continue;
    }
    if (upsBackedIds.has(device.id)) {
      const priority = device.shutdownPriority ?? 'non-critical';
      const message =
        priority === 'critical'
          ? 'Critical service — should survive entire UPS runtime.'
          : priority === 'graceful'
          ? 'Graceful shutdown — survives only until orchestrated stop.'
          : 'Non-critical load — should be shed early to extend runtime.';
      survivors.push(survivor(device, `UPS-backed (circuit ${device.circuit ?? '?'}). ${message}`));
    } else {
      impacted.push(impact(device, 'Not connected to UPS — drops immediately on outage.'));
    }
  }

  const totalRuntime = upsRuntimes.reduce((min, ups) => {
    if (!isFinite(ups.runtimeMinutes)) return min;
    return min === Infinity ? ups.runtimeMinutes : Math.min(min, ups.runtimeMinutes);
  }, Infinity);

  const affectedPowerW = impacted.reduce((sum, imp) => {
    const device = layout.devices.find((d) => d.id === imp.deviceId);
    return sum + (device?.powerW ?? 0);
  }, 0);

  const assumptions: ScenarioAssumption[] = [];
  if (upsRuntimes.length === 0) {
    assumptions.push({
      id: 'no-ups',
      title: 'A UPS is installed and connected',
      status: 'fail',
      detail: 'No UPS detected in the rack. Every device drops the moment power fails.',
    });
  } else {
    assumptions.push({
      id: 'ups-present',
      title: 'A UPS is installed and connected',
      status: 'pass',
      detail: `${upsRuntimes.length} UPS unit(s) detected.`,
    });

    const weakUps = upsRuntimes.filter((u) => u.criticalRuntimeMinutes < 5);
    if (weakUps.length > 0) {
      assumptions.push({
        id: 'ups-runtime-min',
        title: 'UPS runtime ≥ 5 minutes for critical load',
        status: 'fail',
        detail: `${weakUps.length} UPS unit(s) have <5 minutes for critical load — not enough time to graceful-shutdown.`,
      });
    }
  }

  const orphanCritical = impacted.filter((i) => {
    const device = layout.devices.find((d) => d.id === i.deviceId);
    return device?.shutdownPriority === 'critical';
  });
  if (orphanCritical.length > 0) {
    assumptions.push({
      id: 'critical-on-ups',
      title: 'All critical devices are UPS-backed',
      status: 'fail',
      detail: `${orphanCritical.length} device(s) marked critical have no UPS path — they will lose power immediately.`,
    });
  } else if (impacted.length === 0) {
    assumptions.push({
      id: 'critical-on-ups',
      title: 'All critical devices are UPS-backed',
      status: 'pass',
      detail: 'Every operational device is on UPS-backed power.',
    });
  }

  const recommendations: ScenarioRecommendation[] = [];
  if (upsRuntimes.length === 0) {
    recommendations.push({
      id: 'add-ups',
      priority: 'high',
      title: 'Install a UPS',
      detail: 'Add at least one UPS sized for the critical load. Target ≥10 minutes runtime to allow safe shutdown.',
    });
  }
  if (orphanCritical.length > 0) {
    recommendations.push({
      id: 'rewire-critical',
      priority: 'high',
      title: `Reroute ${orphanCritical.length} critical device(s) to UPS power`,
      detail: 'Move critical devices off raw mains and onto the UPS output PDU.',
    });
  }
  if (impacted.length > 0 && upsRuntimes.length > 0) {
    recommendations.push({
      id: 'shutdown-priority',
      priority: 'medium',
      title: 'Configure shutdown priorities',
      detail: 'Tag non-critical loads (lab gear, decorative lights, dev workstations) to shed first and extend runtime for critical services.',
    });
  }
  if (totalRuntime < 10 && upsRuntimes.length > 0) {
    recommendations.push({
      id: 'extend-runtime',
      priority: 'medium',
      title: 'Extend UPS runtime',
      detail: 'Total runtime is below 10 minutes. Add an extended battery module or move non-critical devices off the UPS.',
    });
  }

  const summary =
    impacted.length === 0
      ? `All ${survivors.length} operational devices are UPS-backed. Runtime ≈ ${isFinite(totalRuntime) ? `${Math.round(totalRuntime)}m` : '∞'}.`
      : `${impacted.length} device(s) drop immediately. ${survivors.length} ride out on UPS for ≈ ${isFinite(totalRuntime) ? `${Math.round(totalRuntime)}m` : '∞'}.`;

  return {
    preset: 'power-outage',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: {
      ...buildBaseMetrics(layout, impacted),
      estimatedRuntimeMinutes: isFinite(totalRuntime) ? totalRuntime : undefined,
      affectedPowerW,
    },
  };
}

function simulateIspDown(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['isp-down'];
  const wanDevices = layout.devices.filter(
    (d) => d.category === 'modem' || (d.category === 'router' && !d.bootDependsOn?.length),
  );

  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'modem') {
      impacted.push(impact(device, 'WAN uplink down — modem cannot reach ISP.', 'critical'));
      continue;
    }
    if (device.category === 'router' || device.category === 'firewall') {
      impacted.push(impact(device, 'No upstream internet path — routing/NAT remains but external traffic fails.', 'warning'));
      continue;
    }
    if (device.category === 'access-point') {
      survivors.push(survivor(device, 'AP still serves local Wi-Fi; just no internet.'));
      continue;
    }
    if (device.category === 'nas' || device.category === 'server' || device.category === 'mini-pc' || device.category === 'sbc') {
      survivors.push(survivor(device, 'Local service — keeps serving LAN clients.'));
      continue;
    }
    if (device.category === 'switch') {
      survivors.push(survivor(device, 'Switching keeps working at L2/L3.'));
      continue;
    }
    survivors.push(survivor(device, 'Not internet-dependent.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'has-wan',
    title: 'A WAN device exists',
    status: wanDevices.length > 0 ? 'pass' : 'fail',
    detail:
      wanDevices.length > 0
        ? `${wanDevices.length} WAN device(s) detected.`
        : 'No modem or edge router detected — cannot simulate ISP loss accurately.',
  });

  const hasBackupWan = layout.devices.filter((d) => d.category === 'modem').length >= 2 || layout.devices.some((d) => d.label?.toLowerCase().includes('4g') || d.label?.toLowerCase().includes('lte'));
  assumptions.push({
    id: 'backup-wan',
    title: 'Backup WAN path available',
    status: hasBackupWan ? 'pass' : 'fail',
    detail: hasBackupWan
      ? 'Secondary modem or LTE failover detected.'
      : 'No secondary modem / 4G failover detected.',
  });

  const localOnlyServices = survivors.filter((s) =>
    ['nas', 'server', 'mini-pc', 'sbc'].includes(s.category),
  );
  assumptions.push({
    id: 'local-services',
    title: 'Local-only services keep working',
    status: localOnlyServices.length > 0 ? 'pass' : 'unknown',
    detail:
      localOnlyServices.length > 0
        ? `${localOnlyServices.length} local server(s) survive (NAS, mini-PC, SBC, etc.).`
        : 'No local servers detected — outage takes down everything user-facing.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (!hasBackupWan) {
    recommendations.push({
      id: 'add-failover',
      priority: 'high',
      title: 'Add a backup WAN (LTE / second ISP)',
      detail: 'A USB LTE dongle or second-ISP modem with router-level failover keeps critical services reachable.',
    });
  }
  if (localOnlyServices.length === 0) {
    recommendations.push({
      id: 'local-cache',
      priority: 'medium',
      title: 'Host critical services locally',
      detail: 'Pi-hole, local DNS, local home automation hub, and media servers survive ISP loss when self-hosted.',
    });
  }
  recommendations.push({
    id: 'comms-fallback',
    priority: 'low',
    title: 'Document the offline-mode plan',
    detail: 'Note which devices keep working (local Wi-Fi, NAS, smart-home) so household members know what still works.',
  });

  const summary = `${impacted.length} device(s) lose internet path; ${survivors.length} continue serving the LAN.`;

  return {
    preset: 'isp-down',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: buildBaseMetrics(layout, impacted),
  };
}

function simulateSwitchReboot(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['switch-reboot'];
  const switches = layout.devices.filter((d) => d.category === 'switch');

  if (switches.length === 0) {
    return {
      preset: 'switch-reboot',
      presetLabel: meta.label,
      presetDescription: meta.description,
      summary: 'No switches in this rack — scenario is not applicable.',
      impactedDevices: [],
      survivingDevices: [],
      failedAssumptions: [
        {
          id: 'no-switch',
          title: 'At least one switch is installed',
          status: 'fail',
          detail: 'Rack has no switch device, so the reboot scenario cannot run.',
        },
      ],
      recommendations: [
        {
          id: 'add-switch',
          priority: 'high',
          title: 'Add a managed switch',
          detail: 'A homelab without a switch limits cabling and growth. Add at least one PoE-capable switch.',
        },
      ],
      metrics: buildBaseMetrics(layout, []),
    };
  }

  // Find the switch with the most connections (the "core" switch)
  const switchDegree = new Map<string, number>();
  for (const cable of layout.cables) {
    if (cable.type !== 'ethernet' && cable.type !== 'fiber' && cable.type !== 'patch' && cable.type !== 'structured') continue;
    const fromSw = switches.find((s) => s.id === cable.fromDeviceId);
    const toSw = switches.find((s) => s.id === cable.toDeviceId);
    if (fromSw) switchDegree.set(fromSw.id, (switchDegree.get(fromSw.id) ?? 0) + 1);
    if (toSw) switchDegree.set(toSw.id, (switchDegree.get(toSw.id) ?? 0) + 1);
  }
  let coreSwitch = switches[0];
  let maxDegree = switchDegree.get(coreSwitch.id) ?? 0;
  for (const sw of switches) {
    const d = switchDegree.get(sw.id) ?? 0;
    if (d > maxDegree) {
      maxDegree = d;
      coreSwitch = sw;
    }
  }

  const blast = analyzeBlastRadius(layout, coreSwitch.id);
  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];
  const impactedIds = new Set<string>([coreSwitch.id]);

  impacted.push(impact(coreSwitch, 'Core switch is rebooting — entire L2 segment down.', 'critical'));

  if (blast) {
    for (const dev of blast.directlyImpacted) {
      impactedIds.add(dev.deviceId);
      const placed = layout.devices.find((d) => d.id === dev.deviceId);
      if (!placed) continue;
      impacted.push(impact(placed, `Directly connected to ${coreSwitch.name} — link drops on reboot.`, 'critical'));
    }
    for (const dev of blast.indirectlyImpacted) {
      impactedIds.add(dev.deviceId);
      const placed = layout.devices.find((d) => d.id === dev.deviceId);
      if (!placed) continue;
      impacted.push(impact(placed, `Routes through ${coreSwitch.name} — connectivity disrupted.`, 'warning'));
    }
  }

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (impactedIds.has(device.id)) continue;
    if (isPowerSource(device)) {
      survivors.push(survivor(device, 'Power infrastructure — unaffected by network reboot.'));
      continue;
    }
    survivors.push(survivor(device, 'Not downstream of the rebooting switch.'));
  }

  const graph = buildTopologyGraph(layout);
  const singleUplinkSwitches = graph.edges.filter((e) => e.sourceId === coreSwitch.id || e.targetId === coreSwitch.id).length;

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'multiple-switches',
    title: 'Redundant switch path exists',
    status: switches.length > 1 ? 'unknown' : 'fail',
    detail:
      switches.length > 1
        ? `${switches.length} switches in rack — verify uplink redundancy in the topology view.`
        : 'Only one switch in rack — single point of failure.',
  });
  assumptions.push({
    id: 'core-uplinks',
    title: 'Core switch fan-out is manageable',
    status: maxDegree <= 16 ? 'pass' : 'fail',
    detail: `${coreSwitch.name} has ${maxDegree} link(s). ${maxDegree > 16 ? 'High concentration — reboot blast radius is large.' : 'Acceptable concentration.'}`,
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (switches.length === 1) {
    recommendations.push({
      id: 'add-second-switch',
      priority: 'high',
      title: 'Add a second managed switch',
      detail: 'A second switch (even an unmanaged 5-port) lets critical devices keep working through a core reboot.',
    });
  }
  if (singleUplinkSwitches > 8) {
    recommendations.push({
      id: 'split-load',
      priority: 'medium',
      title: 'Spread devices across switches',
      detail: 'Move bulk endpoints (workstations, IoT) onto a secondary switch; keep server/NAS on the core only.',
    });
  }
  recommendations.push({
    id: 'config-backup',
    priority: 'medium',
    title: 'Back up switch config off-rack',
    detail: 'Export running-config to a Git repo or NAS so a bricked switch can be restored quickly.',
  });

  const summary = `Core switch ${coreSwitch.name} reboot drops ${impacted.length - 1} downstream device(s) for ~3 minutes.`;

  return {
    preset: 'switch-reboot',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: buildBaseMetrics(layout, impacted),
  };
}

function simulateNasFailure(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['nas-disk-failure'];
  const nasDevices = layout.devices.filter((d) => d.category === 'nas');

  if (nasDevices.length === 0) {
    return {
      preset: 'nas-disk-failure',
      presetLabel: meta.label,
      presetDescription: meta.description,
      summary: 'No NAS in this rack — scenario is not applicable.',
      impactedDevices: [],
      survivingDevices: [],
      failedAssumptions: [
        {
          id: 'no-nas',
          title: 'A NAS is installed',
          status: 'fail',
          detail: 'No NAS detected. Storage failure modeling skipped.',
        },
      ],
      recommendations: [
        {
          id: 'add-nas',
          priority: 'medium',
          title: 'Consider centralised storage',
          detail: 'A small NAS centralises backups, media, and shared volumes — and gives a single failure domain to plan around.',
        },
      ],
      metrics: buildBaseMetrics(layout, []),
    };
  }

  // Pick the first NAS as "primary"
  const primaryNas = nasDevices[0];
  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];
  const impactedIds = new Set<string>([primaryNas.id]);

  impacted.push(impact(primaryNas, 'Storage array failure — entire NAS offline.', 'critical'));

  // Find downstream services via bootDependsOn
  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.id === primaryNas.id) continue;
    if (device.bootDependsOn?.includes(primaryNas.id)) {
      impactedIds.add(device.id);
      impacted.push(impact(device, `Boot-depends on ${primaryNas.name} — service unavailable until NAS recovers.`, 'warning'));
    }
  }

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (impactedIds.has(device.id)) continue;
    survivors.push(survivor(device, 'No boot dependency on the failed NAS.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'second-nas',
    title: 'Secondary NAS or backup target exists',
    status: nasDevices.length > 1 ? 'pass' : 'fail',
    detail:
      nasDevices.length > 1
        ? `${nasDevices.length} NAS unit(s) detected. Verify replication is configured.`
        : 'Only one NAS in rack — single point of storage failure.',
  });

  const dependentsCount = impacted.length - 1;
  assumptions.push({
    id: 'dependents-tracked',
    title: 'Services depending on NAS are documented',
    status: dependentsCount > 0 ? 'pass' : 'unknown',
    detail:
      dependentsCount > 0
        ? `${dependentsCount} device(s) declare a bootDependsOn on this NAS.`
        : 'No boot dependencies declared. Either the NAS is standalone or dependencies are undocumented.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  recommendations.push({
    id: 'verify-raid',
    priority: 'high',
    title: 'Verify RAID and SMART monitoring',
    detail: 'Confirm rebuild paths, hot-spare availability, and that SMART alerts reach your phone/email.',
  });
  if (nasDevices.length === 1) {
    recommendations.push({
      id: 'second-nas',
      priority: 'medium',
      title: 'Add an off-rack backup target',
      detail: 'A second NAS, USB cold-backup, or cloud sync (B2 / S3) covers full-array failure.',
    });
  }
  recommendations.push({
    id: '3-2-1-backup',
    priority: 'medium',
    title: 'Apply 3-2-1 backup rule',
    detail: '3 copies of data, on 2 media types, with 1 copy off-site.',
  });

  const summary = `Primary NAS ${primaryNas.name} fails. ${dependentsCount} dependent service(s) impacted.`;

  return {
    preset: 'nas-disk-failure',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: buildBaseMetrics(layout, impacted),
  };
}

function simulateUpsBatteryWeak(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['ups-battery-weak'];
  // Build a synthetic "half capacity" layout in-memory for runtime estimation
  const weakLayout: RackLayout = {
    ...layout,
    devices: layout.devices.map((d) => {
      if (d.category !== 'ups') return d;
      const reduced = d.batteryWh ? Math.round(d.batteryWh * 0.5) : undefined;
      return { ...d, batteryWh: reduced };
    }),
  };

  const runtimes = calculateUpsRuntimes(weakLayout);
  const baselineRuntimes = calculateUpsRuntimes(layout);
  const upsBackedIds = getUpsBackedDeviceIds(weakLayout);

  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  if (runtimes.length === 0) {
    return {
      preset: 'ups-battery-weak',
      presetLabel: meta.label,
      presetDescription: meta.description,
      summary: 'No UPS in rack — battery degradation scenario not applicable.',
      impactedDevices: [],
      survivingDevices: [],
      failedAssumptions: [
        {
          id: 'no-ups',
          title: 'A UPS is installed',
          status: 'fail',
          detail: 'No UPS in rack to degrade.',
        },
      ],
      recommendations: [
        {
          id: 'install-ups',
          priority: 'high',
          title: 'Install a UPS',
          detail: 'Battery degradation only matters if a UPS exists. See power-outage scenario for sizing.',
        },
      ],
      metrics: buildBaseMetrics(layout, []),
    };
  }

  let minRuntime = Infinity;
  const criticalAtRisk: PlacedDevice[] = [];
  for (const runtime of runtimes) {
    if (isFinite(runtime.criticalRuntimeMinutes)) {
      minRuntime = Math.min(minRuntime, runtime.criticalRuntimeMinutes);
    }
    if (runtime.criticalRuntimeMinutes < 5) {
      // Find critical devices downstream of this UPS
      for (const step of runtime.shutdownPlan) {
        if (step.priority === 'critical') {
          criticalAtRisk.push(step.device);
        }
      }
    }
  }

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'ups') {
      survivors.push(survivor(device, 'UPS itself stays up — but battery runtime is reduced.'));
      continue;
    }
    if (!upsBackedIds.has(device.id)) {
      survivors.push(survivor(device, 'Not UPS-backed — battery degradation does not change its status.'));
      continue;
    }
    if (criticalAtRisk.some((d) => d.id === device.id)) {
      impacted.push(impact(device, 'Critical service — degraded battery cannot guarantee safe shutdown.', 'critical'));
    } else if (device.shutdownPriority === 'non-critical') {
      impacted.push(impact(device, 'Non-critical load on UPS — should be shed early under reduced capacity.', 'warning'));
    } else {
      survivors.push(survivor(device, 'UPS still provides reduced runtime — graceful shutdown possible.'));
    }
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'battery-age',
    title: 'UPS battery age is tracked',
    status: 'unknown',
    detail: 'Layout does not record battery age. Plan a replacement every 3–5 years.',
  });
  assumptions.push({
    id: 'runtime-after-degradation',
    title: 'Critical runtime remains ≥ 5 minutes at 50% capacity',
    status: isFinite(minRuntime) && minRuntime >= 5 ? 'pass' : 'fail',
    detail: isFinite(minRuntime)
      ? `Min critical runtime at degraded capacity: ${Math.round(minRuntime)}m.`
      : 'Cannot compute runtime — no load assigned to UPS.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (criticalAtRisk.length > 0) {
    recommendations.push({
      id: 'replace-battery',
      priority: 'high',
      title: 'Schedule battery replacement',
      detail: `${criticalAtRisk.length} critical device(s) cannot reach safe shutdown at 50% capacity. Replace UPS battery now.`,
    });
  }
  recommendations.push({
    id: 'shed-noncritical',
    priority: 'medium',
    title: 'Shed non-critical loads earlier',
    detail: 'Tag dev/lab gear as non-critical so the UPS sheds them first. Extends runtime for the critical tier.',
  });
  if (baselineRuntimes.some((u) => u.runtimeMinutes < 15)) {
    recommendations.push({
      id: 'add-battery-module',
      priority: 'low',
      title: 'Consider an extended battery module (EBM)',
      detail: 'Even on a healthy battery, total runtime is below 15 minutes. An EBM doubles or triples this.',
    });
  }

  const summary = isFinite(minRuntime)
    ? `Critical runtime drops to ${Math.round(minRuntime)} minute(s) at 50% battery health. ${criticalAtRisk.length} critical service(s) at risk.`
    : 'UPS exists but has no measurable load.';

  return {
    preset: 'ups-battery-weak',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: {
      ...buildBaseMetrics(layout, impacted),
      estimatedRuntimeMinutes: isFinite(minRuntime) ? minRuntime : undefined,
    },
  };
}

function simulateHeatwave(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['summer-heatwave'];
  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  let totalHeat = 0;
  let highHeatDevices = 0;
  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    const heat = device.heatLevel ?? 1;
    totalHeat += heat;
    if (heat >= 4) highHeatDevices += 1;

    if (heat >= 5) {
      impacted.push(impact(device, 'Heat level 5 — at thermal throttle threshold under +5°C ambient.', 'critical'));
    } else if (heat >= 4) {
      impacted.push(impact(device, 'Heat level 4 — performance may degrade under heatwave.', 'warning'));
    } else if (heat >= 3 && (device.category === 'server' || device.category === 'nas')) {
      impacted.push(impact(device, 'High-duty workload device — fan noise & power draw will increase.', 'info'));
    } else {
      survivors.push(survivor(device, 'Low heat output — tolerates +5°C ambient.'));
    }
  }

  const avgHeat = layout.devices.length > 0 ? totalHeat / layout.devices.length : 0;

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'rack-ventilation',
    title: 'Rack has front-to-back airflow',
    status: 'unknown',
    detail: 'Layout does not encode airflow — confirm fans, blanking panels, and door perforation cover the path.',
  });
  assumptions.push({
    id: 'rack-cooling',
    title: 'Ambient cooling is sufficient',
    status: avgHeat < 3 ? 'pass' : 'fail',
    detail:
      avgHeat < 3
        ? `Average heat level ${avgHeat.toFixed(1)} — passive cooling likely OK.`
        : `Average heat level ${avgHeat.toFixed(1)} — likely needs active cooling under heatwave.`,
  });
  assumptions.push({
    id: 'temp-monitoring',
    title: 'Temperature monitoring is in place',
    status: 'unknown',
    detail: 'No temp sensors modeled. Add a 1-Wire / SNMP probe to alert before throttling.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (highHeatDevices >= 2) {
    recommendations.push({
      id: 'separate-heat',
      priority: 'high',
      title: 'Separate high-heat devices vertically',
      detail: 'Stack high-heat servers/NAS with U-gaps in between, or split across rack zones.',
    });
  }
  recommendations.push({
    id: 'fan-tray',
    priority: 'medium',
    title: 'Add an active 1U exhaust fan tray',
    detail: 'A top-mounted fan tray pulls heat out and lowers internal rack temperature 3–7°C.',
  });
  recommendations.push({
    id: 'temp-alert',
    priority: 'medium',
    title: 'Install temperature alerting',
    detail: 'A cheap ESP32 + DHT22 sensor + ntfy/email alert catches a runaway thermal event before damage.',
  });
  if (avgHeat >= 3) {
    recommendations.push({
      id: 'aircon',
      priority: 'low',
      title: 'Add room-level cooling',
      detail: 'Portable AC unit or split AC for the rack room is the highest-impact cooling upgrade.',
    });
  }

  const summary = `${highHeatDevices} high-heat device(s) at risk under heatwave. Average heat level ${avgHeat.toFixed(1)}/5.`;

  return {
    preset: 'summer-heatwave',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: buildBaseMetrics(layout, impacted),
  };
}

function simulateApOffline(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['ap-offline'];
  const aps = layout.devices.filter((d) => d.category === 'access-point');
  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  if (aps.length === 0) {
    return {
      preset: 'ap-offline',
      presetLabel: meta.label,
      presetDescription: meta.description,
      summary: 'No access points in rack — wireless scenario not applicable.',
      impactedDevices: [],
      survivingDevices: [],
      failedAssumptions: [
        {
          id: 'no-aps',
          title: 'At least one AP exists',
          status: 'fail',
          detail: 'Layout has no access-point device.',
        },
      ],
      recommendations: [
        {
          id: 'plan-wifi',
          priority: 'low',
          title: 'Plan wireless coverage',
          detail: 'If wireless is in scope, add AP(s) to the layout to model coverage and PoE budget.',
        },
      ],
      metrics: buildBaseMetrics(layout, []),
    };
  }

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'access-point') {
      impacted.push(impact(device, 'Wireless AP offline — clients lose Wi-Fi.', 'critical'));
      continue;
    }
    survivors.push(survivor(device, 'Wired infrastructure — unaffected by AP outage.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'multiple-aps',
    title: 'Multiple APs for redundancy',
    status: aps.length > 1 ? 'pass' : 'fail',
    detail:
      aps.length > 1
        ? `${aps.length} APs detected — partial wireless coverage continues if one fails.`
        : 'Only one AP — full wireless outage if it fails.',
  });
  assumptions.push({
    id: 'wired-fallback',
    title: 'Critical clients have wired fallback',
    status: 'unknown',
    detail: 'Layout does not model client devices. Verify critical workstations have an Ethernet drop.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (aps.length === 1) {
    recommendations.push({
      id: 'add-ap',
      priority: 'medium',
      title: 'Add a second AP',
      detail: 'Mesh / roaming-capable second AP gives partial coverage during firmware updates or hardware failure.',
    });
  }
  recommendations.push({
    id: 'wired-critical',
    priority: 'medium',
    title: 'Wire critical clients',
    detail: 'Keep desktop/work-from-home machines on Ethernet — only mobile devices truly need Wi-Fi.',
  });
  recommendations.push({
    id: 'config-backup-wifi',
    priority: 'low',
    title: 'Back up wireless controller config',
    detail: 'Export Unifi/Omada controller config; firmware bricking is a common cause of AP-fleet outages.',
  });

  const summary = `${aps.length} AP(s) offline. ${survivors.length} wired device(s) keep working.`;

  return {
    preset: 'ap-offline',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: buildBaseMetrics(layout, impacted),
  };
}

function simulateManagementDown(layout: RackLayout): ScenarioResult {
  const meta = PRESET_LOOKUP['management-network-down'];
  const ipKvms = layout.devices.filter((d) => d.category === 'ip-kvm');
  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'ip-kvm') {
      impacted.push(impact(device, 'IP-KVM unreachable — remote console lost.', 'critical'));
      continue;
    }
    // Managed devices (server/nas/switch) are reachable but lose OOB access
    if (
      device.category === 'switch' ||
      device.category === 'router' ||
      device.category === 'firewall' ||
      device.category === 'server' ||
      device.category === 'nas'
    ) {
      survivors.push(
        survivor(device, 'Service stays up; only management/OOB access is lost. Physical console still possible.'),
      );
      continue;
    }
    survivors.push(survivor(device, 'No management interface — unaffected.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'has-ip-kvm',
    title: 'Out-of-band console exists',
    status: ipKvms.length > 0 ? 'pass' : 'fail',
    detail:
      ipKvms.length > 0
        ? `${ipKvms.length} IP-KVM detected.`
        : 'No IP-KVM in rack. Remote recovery from production VLAN failure may be impossible.',
  });
  assumptions.push({
    id: 'separate-mgmt-vlan',
    title: 'Management VLAN separate from production',
    status: 'unknown',
    detail: 'VLAN topology not modeled. Confirm management interfaces are not on the same broadcast as production.',
  });
  assumptions.push({
    id: 'physical-console',
    title: 'Physical console / KVM is accessible',
    status: 'unknown',
    detail: 'Verify the rack is within reach (e.g. not in a sealed colo space without escort).',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (ipKvms.length === 0) {
    recommendations.push({
      id: 'add-ip-kvm',
      priority: 'medium',
      title: 'Add an IP-KVM (PiKVM, JetKVM)',
      detail: 'A cheap PiKVM gives BIOS-level recovery when the production VLAN melts.',
    });
  }
  recommendations.push({
    id: 'mgmt-out-of-band',
    priority: 'medium',
    title: 'Run management on its own VLAN/switch',
    detail: 'A dedicated unmanaged switch + cheap router for the management VLAN survives production-VLAN failures.',
  });
  recommendations.push({
    id: 'serial-console',
    priority: 'low',
    title: 'Wire a serial console / console-over-USB',
    detail: 'A Pi with USB-serial cables gives last-resort access when the network is fully down.',
  });

  const summary = `Management network offline. ${impacted.length} IP-KVM(s) lost; ${survivors.length} device(s) keep serving, but require physical recovery.`;

  return {
    preset: 'management-network-down',
    presetLabel: meta.label,
    presetDescription: meta.description,
    summary,
    impactedDevices: impacted,
    survivingDevices: survivors,
    failedAssumptions: assumptions,
    recommendations,
    metrics: buildBaseMetrics(layout, impacted),
  };
}

export function runScenario(layout: RackLayout, preset: ScenarioPreset): ScenarioResult {
  switch (preset) {
    case 'power-outage':
      return simulatePowerOutage(layout);
    case 'isp-down':
      return simulateIspDown(layout);
    case 'switch-reboot':
      return simulateSwitchReboot(layout);
    case 'nas-disk-failure':
      return simulateNasFailure(layout);
    case 'ups-battery-weak':
      return simulateUpsBatteryWeak(layout);
    case 'summer-heatwave':
      return simulateHeatwave(layout);
    case 'ap-offline':
      return simulateApOffline(layout);
    case 'management-network-down':
      return simulateManagementDown(layout);
  }
}

export function runAllScenarios(layout: RackLayout): ScenarioResult[] {
  return SCENARIO_PRESETS.map((preset) => runScenario(layout, preset.id));
}

export function getOverallReadinessScore(results: ScenarioResult[]): {
  score: number;
  status: 'good' | 'warning' | 'critical';
  failedAssumptionCount: number;
} {
  if (results.length === 0) {
    return { score: 0, status: 'critical', failedAssumptionCount: 0 };
  }

  let failed = 0;
  let total = 0;
  for (const result of results) {
    for (const assumption of result.failedAssumptions) {
      total += 1;
      if (assumption.status === 'fail') failed += 1;
    }
  }

  const pct = total === 0 ? 100 : Math.round(((total - failed) / total) * 100);
  const status: 'good' | 'warning' | 'critical' = pct >= 80 ? 'good' : pct >= 50 ? 'warning' : 'critical';
  return { score: pct, status, failedAssumptionCount: failed };
}

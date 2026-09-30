import type { PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { assessSwitchRemoval, bootDependents } from './scenarioNetwork';
import { scenarioPowerContext } from './scenarioPower';
import { getShutdownPriority } from './upsRuntime';
import { isPowerSource } from './powerChain';

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
    description: 'Whole-room utility power loss; assess recorded battery paths and energy assumptions.',
    emoji: '⚡',
  },
  {
    id: 'isp-down',
    label: 'ISP Down',
    description: 'WAN loss review; local service continuity and failover require recorded configuration and testing.',
    emoji: '🌐',
  },
  {
    id: 'switch-reboot',
    label: 'Core Switch Reboot',
    description: 'Remove the switch with the most recorded network links; recovery time is not predicted.',
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
    description: 'What-if: halve recorded battery energy; this is not a battery-health diagnosis.',
    emoji: '🔋',
  },
  {
    id: 'summer-heatwave',
    label: 'Summer Heatwave',
    description: 'Review higher ambient temperature; no temperature rise or throttling is calculated.',
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
    description: 'Review loss of the management network; console paths and service separation need verification.',
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

function simulatePowerOutage(layout: RackLayout, workspace?: Workspace): ScenarioResult {
  const meta = PRESET_LOOKUP['power-outage'];
  const power = scenarioPowerContext(layout, workspace);
  const upsBackedIds = power.backedIds;
  const upsRuntimes = power.runtimes;

  const impacted: ScenarioImpact[] = [];
  const survivors: ScenarioSurvivor[] = [];

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'ups') {
      survivors.push(survivor(device, 'UPS battery operation is assumed; energy, rating and transfer behavior need review.'));
      continue;
    }
    if (upsBackedIds.has(device.id)) {
      const priority = getShutdownPriority(device);
      const message =
        priority === 'critical'
          ? 'Critical service — continued operation depends on verified energy, capacity and transfer behavior.'
          : priority === 'graceful'
          ? 'Graceful shutdown requires an external shutdown procedure; this planner does not execute it.'
          : 'Non-critical load — should be shed early to extend runtime.';
      survivors.push(survivor(device, `UPS-backed (circuit ${device.circuit ?? '?'}). ${message}`));
    } else {
      impacted.push(impact(device, 'No confirmed battery-backed UPS path is recorded. Check UPS outlet backup types, wiring and PoE roles; surge-only and unknown outlets do not establish backup power.'));
    }
  }

  const totalRuntime = upsRuntimes.some(u => !Number.isFinite(u.runtimeMinutes) || !u.hasDownstream) ? NaN : upsRuntimes.reduce((min, ups) => {
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
      detail: 'No local or connected remote UPS path was found. Verify wiring and PoE roles.',
    });
  } else {
    assumptions.push({
      id: 'ups-present',
      title: 'A UPS is installed and connected',
      status: upsRuntimes.every(u => u.hasDownstream && Number.isFinite(u.runtimeMinutes) && u.capacityW !== undefined && !u.topologyUnverified && !u.unreviewedLoads && u.outputLoadW <= u.capacityW) ? 'pass' : 'unknown',
      detail: `${upsRuntimes.length} UPS unit(s) detected. Presence alone does not verify usable battery operation.`,
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
      detail: `${orphanCritical.length} device(s) marked critical have no recorded UPS path — verify their backup supply.`,
    });
  } else if (impacted.length === 0) {
    assumptions.push({
      id: 'critical-on-ups',
      title: 'All critical devices are UPS-backed',
      status: upsRuntimes.every(u => !u.topologyUnverified && Number.isFinite(u.runtimeMinutes) && u.capacityW !== undefined && u.outputLoadW <= u.capacityW) ? 'pass' : 'unknown',
      detail: 'Every operational device has a recorded UPS path; actual backup operation remains conditional.',
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

  const runtimeText = upsRuntimes.length > 0 && upsRuntimes.every(u => Number.isFinite(u.runtimeMinutes) && u.hasDownstream) ? `${Math.floor(totalRuntime)}m under recorded assumptions` : 'unverified';
  const summary = `${impacted.length} device(s) lack a modeled UPS path. ${survivors.length} have a modeled battery path. Minimum energy estimate: ${runtimeText}; actual transfer and continued operation are not verified.`;

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
    (d) => d.category === 'modem' || d.category === 'router' || d.category === 'firewall',
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
      impacted.push(impact(device, 'WAN loss may affect this gateway. Actual uplink selection, routing, NAT and failover are not modeled.', 'warning'));
      continue;
    }
    if (device.category === 'access-point') {
      survivors.push(survivor(device, 'AP power, controller, authentication and client dependencies are not verified; local Wi-Fi continuity is unknown.'));
      continue;
    }
    if (device.category === 'nas' || device.category === 'server' || device.category === 'mini-pc' || device.category === 'sbc') {
      survivors.push(survivor(device, 'Local hardware does not establish offline service capability. Verify DNS, authentication, cloud and client-network dependencies.'));
      continue;
    }
    if (device.category === 'switch') {
      survivors.push(survivor(device, 'No switch hardware failure is assumed; configured network and service continuity remain unverified.'));
      continue;
    }
    survivors.push(survivor(device, 'Internet dependency is not recorded. Category alone does not establish offline operation.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'has-wan',
    title: 'A WAN-class device is recorded',
    status: wanDevices.length > 0 ? 'pass' : 'fail',
    detail:
      wanDevices.length > 0
        ? `${wanDevices.length} modem/router/firewall device(s) recorded. Their actual WAN roles and configured uplinks need verification.`
        : 'No modem or edge router detected — cannot simulate ISP loss accurately.',
  });

  const hasBackupWan = layout.devices.filter((d) => d.category === 'modem').length >= 2 || layout.devices.some((d) => d.label?.toLowerCase().includes('4g') || d.label?.toLowerCase().includes('lte'));
  assumptions.push({
    id: 'backup-wan',
    title: 'Backup WAN path available',
    status: 'unknown',
    detail: hasBackupWan
      ? 'Multiple modems or an LTE/4G label suggest a candidate backup. Cabling, provider independence and configured/tested failover are unverified.'
      : 'No backup candidate was identified from device metadata. External links and failover configuration may be undocumented.',
  });

  const localOnlyServices = survivors.filter((s) =>
    ['nas', 'server', 'mini-pc', 'sbc'].includes(s.category),
  );
  assumptions.push({
    id: 'local-services',
    title: 'Local-only services keep working',
    status: 'unknown',
    detail:
      localOnlyServices.length > 0
        ? `${localOnlyServices.length} local compute/storage device(s) recorded; offline service dependencies have not been verified.`
        : 'No local compute/storage devices recorded. User-facing service dependencies are unknown.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (!hasBackupWan) {
    recommendations.push({
      id: 'add-failover',
      priority: 'high',
      title: 'Add a backup WAN (LTE / second ISP)',
      detail: 'If continuity is required, document an independent uplink, compatible gateway configuration and a tested failover path. A second modem alone does not prove reachability.',
    });
  }
  if (localOnlyServices.length === 0) {
    recommendations.push({
      id: 'local-cache',
      priority: 'medium',
      title: 'Host critical services locally',
      detail: 'For services that must work offline, document and test local DNS, authentication, storage and client access without the WAN.',
    });
  }
  recommendations.push({
    id: 'comms-fallback',
    priority: 'low',
    title: 'Document the offline-mode plan',
    detail: 'Note which devices keep working (local Wi-Fi, NAS, smart-home) so household members know what still works.',
  });

  const summary = `WAN loss is assumed. ${impacted.length} WAN-class device(s) are flagged for review; offline service continuity and backup WAN operation are unverified.`;

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

  const removal = assessSwitchRemoval(layout, coreSwitch.id);
  const impacted: ScenarioImpact[] = [impact(coreSwitch, 'Selected switch is unavailable. Reboot and recovery duration are not modeled.', 'critical')];
  const survivors: ScenarioSurvivor[] = [];
  for (const device of layout.devices) {
    if (!isOperationalDevice(device) || device.id === coreSwitch.id) continue;
    const lostGatewayPath = removal.before.has(device.id) && !removal.after.has(device.id);
    if (removal.adjacent.has(device.id)) {
      impacted.push(impact(device, removal.after.has(device.id)
        ? `Link to ${coreSwitch.name} is lost; another recorded physical gateway path remains. VLANs, routing and failover are unverified.`
        : `Link to ${coreSwitch.name} is lost.${lostGatewayPath ? ' No recorded physical gateway path remains.' : ' No baseline gateway path was established.'} Service impact needs verification.`,
      removal.after.has(device.id) ? 'info' : 'warning'));
    } else if (lostGatewayPath) {
      impacted.push(impact(device, `Removing ${coreSwitch.name} breaks its recorded physical gateway path. Protocol and service behavior are unverified.`, 'warning'));
    } else {
      survivors.push(survivor(device, removal.after.has(device.id)
        ? 'A recorded physical gateway path remains; this does not establish configured failover or service continuity.'
        : 'No gateway path was established for this device. Absence of a modeled impact is not proof of continued operation.'));
    }
  }
  const singleUplinkSwitches = removal.linkCount;

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
    title: 'Switch recovery and alternate paths are verified',
    status: 'unknown',
    detail: `${coreSwitch.name} was selected because it has the most recorded network links (${maxDegree}). Link count does not verify acceptable downtime, VLANs, routing or failover. ${removal.hasGateway ? 'Physical paths are compared before and after removal.' : 'No gateway device is recorded, so gateway reachability cannot be compared.'}`,
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (switches.length === 1) {
    recommendations.push({
      id: 'add-second-switch',
      priority: 'high',
      title: 'Add a second managed switch',
      detail: 'If continuity is required, design independent endpoint/uplink paths and compatible failover configuration, then test them. A second switch alone does not establish redundancy.',
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

  const summary = `Selected switch ${coreSwitch.name} is removed from recorded network links. ${impacted.length - 1} other device(s) lose a direct link or physical gateway path. Alternate paths do not prove service continuity; recovery time is unknown.`;

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

  const bootAffected = bootDependents(layout, primaryNas.id);
  const storageServices = (layout.services ?? []).filter(service => service.hostDeviceId === primaryNas.id || service.storageDeviceIds?.includes(primaryNas.id));
  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.id === primaryNas.id) continue;
    const services = storageServices.filter(service => service.hostDeviceId === device.id);
    if (bootAffected.has(device.id) || services.length) {
      impactedIds.add(device.id);
      impacted.push(impact(device, [
        bootAffected.has(device.id) ? `Recorded boot dependency reaches ${primaryNas.name}; restart order is affected. This alone does not establish a running-service outage.` : '',
        services.length ? `Recorded services depend on the failed NAS: ${services.map(service => service.name).join(', ')}. Storage availability and recovery need verification.` : '',
      ].filter(Boolean).join(' '), 'warning'));
    }
  }

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (impactedIds.has(device.id)) continue;
    survivors.push(survivor(device, 'No recorded boot or service-storage dependency reaches the failed NAS. Undocumented dependencies and continued operation remain unverified.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'second-nas',
    title: 'Recoverable NAS backup is verified',
    status: 'unknown',
    detail:
      nasDevices.length > 1
        ? `${nasDevices.length} NAS units are recorded, but their count does not establish replication, independent backups or a tested restore.`
        : 'One NAS is recorded. External backups may exist; verify backup scope, freshness and a tested restore.',
  });

  const dependentsCount = impacted.length - 1;
  assumptions.push({
    id: 'dependents-tracked',
    title: 'NAS dependency inventory is complete',
    status: 'unknown',
    detail:
      dependentsCount > 0
        ? `${bootAffected.size} transitive boot-dependent device(s) and ${storageServices.length} recorded hosted/storage-dependent service(s). These records do not prove inventory completeness.`
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
      detail: 'Choose an independent backup target, confirm the required data is included and test restoration. A second device or sync job alone does not prove recoverability.',
    });
  }
  recommendations.push({
    id: '3-2-1-backup',
    priority: 'medium',
    title: 'Apply 3-2-1 backup rule',
    detail: '3 copies of data, on 2 media types, with 1 copy off-site.',
  });

  const summary = `Selected NAS ${primaryNas.name} (first NAS in the layout) is assumed offline. ${dependentsCount} device(s) have recorded boot or service-storage dependencies; ${storageServices.length} hosted/storage-dependent service(s) need review. Running-service continuity and restore success are unverified.`;

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

function simulateUpsBatteryWeak(layout: RackLayout, workspace?: Workspace): ScenarioResult {
  const meta = PRESET_LOOKUP['ups-battery-weak'];
  const weaken = (rack: RackLayout): RackLayout => ({ ...rack, devices: rack.devices.map(d => d.category === 'ups' ? { ...d, batteryWh: d.batteryWh === undefined ? undefined : d.batteryWh * 0.5 } : d) });
  const weakLayout = weaken(layout);
  const weakWorkspace = workspace ? { ...workspace, racks: workspace.racks.map(weaken) } : undefined;
  const power = scenarioPowerContext(weakLayout, weakWorkspace);
  const runtimes = power.runtimes;
  const baselineRuntimes = scenarioPowerContext(layout, workspace).runtimes;
  const upsBackedIds = power.backedIds;

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
      const ids = power.paths.find(p => p.runtime === runtime)?.deviceIds ?? [];
      for (const device of layout.devices) {
        if (ids.includes(device.id) && getShutdownPriority(device) === 'critical' && !criticalAtRisk.some(d => d.id === device.id)) criticalAtRisk.push(device);
      }
    }
  }

  for (const device of layout.devices) {
    if (!isOperationalDevice(device)) continue;
    if (device.category === 'ups') {
      survivors.push(survivor(device, 'Battery operation is assumed; reduced usable energy and transfer behavior need review.'));
      continue;
    }
    if (!upsBackedIds.has(device.id)) {
      survivors.push(survivor(device, 'No confirmed battery-backed path. Battery degradation alone does not change utility operation; outage survival remains unverified.'));
      continue;
    }
    if (criticalAtRisk.some((d) => d.id === device.id)) {
      impacted.push(impact(device, 'Critical service — estimated energy is below the 5-minute planning target at half the recorded battery energy.', 'critical'));
    } else if (device.shutdownPriority === 'non-critical') {
      impacted.push(impact(device, 'Non-critical load on UPS — should be shed early under reduced capacity.', 'warning'));
    } else {
      survivors.push(survivor(device, 'Modeled UPS path remains; verify degraded energy and shutdown time before relying on it.'));
    }
  }

  const incompleteRuntime = runtimes.some(u => !Number.isFinite(u.criticalRuntimeMinutes) || !u.hasDownstream || u.topologyUnverified);
  if (incompleteRuntime) minRuntime = NaN;
  const outputOverloaded = runtimes.some(u => u.capacityW !== undefined && u.outputLoadW > u.capacityW);
  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'battery-age',
    title: 'UPS battery age is tracked',
    status: 'unknown',
    detail: 'This scenario halves recorded battery energy. It does not predict aging; follow the battery manufacturer’s service and test guidance.',
  });
  assumptions.push({
    id: 'runtime-after-degradation',
    title: 'Critical runtime remains ≥ 5 minutes at 50% capacity',
    status: outputOverloaded ? 'fail' : incompleteRuntime || runtimes.some(u => u.capacityW === undefined || u.unreviewedLoads) ? 'unknown' : minRuntime >= 5 ? 'pass' : 'fail',
    detail: isFinite(minRuntime)
      ? `Minimum critical-load energy estimate: ${Math.floor(minRuntime)}m at half recorded battery energy. Output ratings, reviewed loads and actual transfer behavior must also be checked.${outputOverloaded ? ' A recorded output rating is exceeded.' : ''}`
      : 'Cannot compute an overall runtime — battery, outlet backup or downstream-load data is missing or unresolved.',
  });

  const recommendations: ScenarioRecommendation[] = [];
  if (criticalAtRisk.length > 0) {
    recommendations.push({
      id: 'replace-battery',
      priority: 'high',
      title: 'Review usable energy and shutdown requirements',
      detail: `${criticalAtRisk.length} critical device(s) are below the 5-minute planning target in this what-if calculation. Verify actual battery condition and required shutdown time before choosing load reduction, compatible expansion or replacement.`,
    });
  }
  recommendations.push({
    id: 'shed-noncritical',
    priority: 'medium',
    title: 'Shed non-critical loads earlier',
    detail: 'Use priority tags to plan a shedding order. Actual shutdown requires configured external automation and testing; this planner does not control the UPS or devices.',
  });
  if (baselineRuntimes.some((u) => u.runtimeMinutes < 15)) {
    recommendations.push({
      id: 'add-battery-module',
      priority: 'low',
      title: 'Consider an extended battery module (EBM)',
      detail: 'The recorded baseline estimate is below 15 minutes. Check compatible battery expansion and manufacturer runtime data.',
    });
  }

  const summary = isFinite(minRuntime)
    ? `Critical-load energy estimate: ${Math.floor(minRuntime)} minute(s) at half recorded battery energy. ${criticalAtRisk.length} critical service(s) below the 5-minute planning target. Actual battery health and transfer are unverified.`
    : 'Degraded runtime is unverified: battery or downstream-load data is missing.';

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
      impacted.push(impact(device, 'Heat level 5 — highest review priority. Inlet temperature and throttling thresholds are not modeled.', 'critical'));
    } else if (heat >= 4) {
      impacted.push(impact(device, 'Heat level 4 — review cooling under the planned workload; performance loss is not predicted.', 'warning'));
    } else if (heat >= 3 && (device.category === 'server' || device.category === 'nas')) {
      impacted.push(impact(device, 'Heat level 3 — check measured temperature, fan behavior and power under the planned workload.', 'info'));
    } else {
      survivors.push(survivor(device, 'Lower recorded heat score; temperature tolerance and continued operation are unverified.'));
    }
  }

  const operationalCount = layout.devices.filter(isOperationalDevice).length;
  const avgHeat = operationalCount > 0 ? totalHeat / operationalCount : 0;

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'rack-ventilation',
    title: 'Rack has front-to-back airflow',
    status: 'unknown',
    detail: 'Recorded airflow directions do not establish delivered airflow. Check inlet/exhaust paths, fans, blanking panels and door restrictions.',
  });
  assumptions.push({
    id: 'rack-cooling',
    title: 'Ambient cooling is sufficient',
    status: 'unknown',
    detail: `Average recorded heat score ${avgHeat.toFixed(1)}/5 is a review heuristic, not a temperature or cooling-capacity calculation. Measure inlet temperatures and compare the exact hardware limits.`,
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
      detail: 'Review adjacent high-heat devices against their airflow and installation requirements. Measure temperatures before deciding on spacing or blanking panels.',
    });
  }
  recommendations.push({
    id: 'fan-tray',
    priority: 'medium',
    title: 'Evaluate rack airflow and cooling',
    detail: 'Measure intake/exhaust temperatures and airflow restrictions under load before selecting additional fans. This model does not predict a temperature reduction.',
  });
  recommendations.push({
    id: 'temp-alert',
    priority: 'medium',
    title: 'Install temperature alerting',
    detail: 'Monitor representative inlet temperatures and set alerts against documented hardware limits. Verify sensor placement and alert delivery.',
  });
  if (avgHeat >= 3) {
    recommendations.push({
      id: 'aircon',
      priority: 'low',
      title: 'Add room-level cooling',
      detail: 'If measured inlet temperatures exceed documented limits, assess room heat removal and suitable cooling capacity.',
    });
  }

  const summary = `${highHeatDevices} high-heat device(s) prioritized for review. Average recorded heat score ${avgHeat.toFixed(1)}/5; heatwave survival and cooling capacity are unverified.`;

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
          detail: 'If wireless is in scope, record APs and their power/network links. Radio coverage and client association are not simulated.',
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
    survivors.push(survivor(device, 'No direct AP failure is assigned to this device. Wireless client and service dependencies remain unverified.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'multiple-aps',
    title: 'A recorded AP remains online',
    status: 'fail',
    detail: `This preset removes all ${aps.length} recorded AP(s). Having multiple APs does not provide a surviving AP in this scenario; external coverage is unknown.`,
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
      detail: 'For a separate single-AP failure plan, assess coverage overlap, capacity and independent power/uplinks. This all-APs-offline preset does not validate that plan.',
    });
  }
  recommendations.push({
    id: 'wired-critical',
    priority: 'medium',
    title: 'Wire critical clients',
    detail: 'Record and test wired fallback for clients that need it, including their switch, addressing and authentication dependencies.',
  });
  recommendations.push({
    id: 'config-backup-wifi',
    priority: 'low',
    title: 'Back up wireless controller config',
    detail: 'Keep a controller configuration backup and test a compatible restore procedure before changes.',
  });

  const summary = `All ${aps.length} recorded AP(s) are assumed offline. Wireless coverage, client fallback and other services are unverified.`;

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
      impacted.push(impact(device, 'If this IP-KVM uses the failed management network, remote console access is lost. Its actual network and fallback path are unverified.', 'warning'));
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
        survivor(device, 'Management and production dependencies are not fully recorded. Service continuity and physical console access need verification.'),
      );
      continue;
    }
    survivors.push(survivor(device, 'Management-interface and service dependencies are unknown; category alone does not establish an unaffected device.'));
  }

  const assumptions: ScenarioAssumption[] = [];
  assumptions.push({
    id: 'has-ip-kvm',
    title: 'Out-of-band console exists',
    status: 'unknown',
    detail:
      ipKvms.length > 0
        ? `${ipKvms.length} IP-KVM device(s) recorded. Console wiring, independent reachability, power and recovery access are unverified.`
        : 'No IP-KVM recorded. Other console or remote recovery methods may exist but are undocumented.',
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
      detail: 'If remote console recovery is required, verify host compatibility, console wiring and independent power/network access.',
    });
  }
  recommendations.push({
    id: 'mgmt-out-of-band',
    priority: 'medium',
    title: 'Run management on its own VLAN/switch',
    detail: 'Document management separation, routing and shared failure dependencies, then test access during a production-network outage. Separate equipment alone does not prove isolation.',
  });
  recommendations.push({
    id: 'serial-console',
    priority: 'low',
    title: 'Wire a serial console / console-over-USB',
    detail: 'Where supported, record console wiring and test local access with the management network unavailable.',
  });

  const summary = `Management network loss is assumed; ${impacted.length} IP-KVM device(s) are flagged for access review. Production service continuity and recovery access are unverified.`;

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

export function runScenario(layout: RackLayout, preset: ScenarioPreset, workspace?: Workspace): ScenarioResult {
  switch (preset) {
    case 'power-outage':
      return simulatePowerOutage(layout, workspace);
    case 'isp-down':
      return simulateIspDown(layout);
    case 'switch-reboot':
      return simulateSwitchReboot(layout);
    case 'nas-disk-failure':
      return simulateNasFailure(layout);
    case 'ups-battery-weak':
      return simulateUpsBatteryWeak(layout, workspace);
    case 'summer-heatwave':
      return simulateHeatwave(layout);
    case 'ap-offline':
      return simulateApOffline(layout);
    case 'management-network-down':
      return simulateManagementDown(layout);
  }
}

export function runAllScenarios(layout: RackLayout, workspace?: Workspace): ScenarioResult[] {
  return SCENARIO_PRESETS.map((preset) => runScenario(layout, preset.id, workspace));
}

export function getOverallReadinessScore(results: ScenarioResult[]): {
  score: number;
  status: 'good' | 'warning' | 'critical';
  failedAssumptionCount: number;
  passedAssumptionCount: number;
  unknownAssumptionCount: number;
  totalAssumptionCount: number;
} {
  let failed = 0;
  let passed = 0;
  let unknown = 0;
  let total = 0;
  for (const result of results) {
    for (const assumption of result.failedAssumptions) {
      total += 1;
      if (assumption.status === 'fail') failed += 1;
      else if (assumption.status === 'pass') passed += 1;
      else unknown += 1;
    }
  }

  const pct = total === 0 ? 0 : Math.floor((passed / total) * 100);
  const status = total > 0 && passed === total ? 'good' : failed > 0 && pct < 50 ? 'critical' : 'warning';
  return { score: pct, status, failedAssumptionCount: failed, passedAssumptionCount: passed, unknownAssumptionCount: unknown, totalAssumptionCount: total };
}

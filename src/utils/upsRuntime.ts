import { projectPoeInputLoads } from './poeLoad';
import { batterySupplyLayout } from './upsOutletBackup';
import { needsPowerReview } from './powerAssumptions';
import type { RackLayout, PlacedDevice, ShutdownPriority, Workspace } from '../types/rack';
import { buildPowerChains, buildPowerTopology, getUpsCapacityW, isPowerSource, type PowerChainNode } from './powerChain';

export interface UpsShutdownStep {
  device: PlacedDevice;
  priority: ShutdownPriority;
  reason: string;
}

export interface UpsLoadGroups {
  criticalW: number;
  gracefulW: number;
  nonCriticalW: number;
  infrastructureW: number;
}

export interface UpsRuntimeInfo {
  device: PlacedDevice;
  loadW: number;
  capacityW: number | undefined;
  loadPercent: number;
  batteryWh: number;
  assumptions: { efficiencyPct: number; usableCapacityPct: number; chargePct: number };
  hasDownstream: boolean;
  unreviewedLoads: boolean;
  topologyUnverified: boolean;
  outputLoadW: number;
  runtimeMinutes: number;
  runtimeLabel: string;
  criticalRuntimeMinutes: number;
  criticalRuntimeLabel: string;
  groups: UpsLoadGroups;
  shutdownPlan: UpsShutdownStep[];
  criticalLoadPercent: number;
  criticalLoadStatus: 'ok' | 'warning' | 'critical';
  warnings: string[];
  status: 'ok' | 'warning' | 'critical';
}

export const getUpsBatteryAssumptions = (device: PlacedDevice) => ({
  efficiencyPct: device.upsBatteryAssumptions?.efficiencyPct ?? 85,
  usableCapacityPct: device.upsBatteryAssumptions?.usableCapacityPct ?? 80,
  chargePct: device.upsBatteryAssumptions?.chargePct ?? 100,
});

function calculateRuntimeMinutes(device: PlacedDevice, loadW: number): number {
  if (device.batteryWh === undefined || !Number.isFinite(device.batteryWh) || device.batteryWh < 0 || loadW <= 0) return NaN;
  const a = getUpsBatteryAssumptions(device);
  if (Object.values(a).some(v => !Number.isFinite(v) || v < 0 || v > 100) || a.efficiencyPct === 0) return NaN;
  return device.batteryWh * a.efficiencyPct / 100 * a.usableCapacityPct / 100 * a.chargePct / 100 / loadW * 60;
}

function formatRuntime(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'Not estimated';
  const total = Math.floor(minutes); // Never round an estimate up across the target.
  if (minutes > 0 && total === 0) return '<1m';
  if (total >= 60) return `${Math.floor(total / 60)}h${total % 60 ? ` ${total % 60}m` : ''}`;
  return `${total}m`;
}

function runtimeStatus(minutes: number): 'ok' | 'warning' | 'critical' {
  if (!Number.isFinite(minutes)) return 'warning';
  if (minutes >= 30) return 'ok';
  if (minutes >= 10) return 'warning';
  return 'critical';
}

export function assessUpsOutage(ups: UpsRuntimeInfo, minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Enter a positive outage duration.';
  if (ups.capacityW !== undefined && ups.outputLoadW > ups.capacityW) return `Output overloaded by ${Math.ceil(ups.outputLoadW - ups.capacityW)} W; battery operation is not supported by the recorded rating.`;
  if (ups.topologyUnverified) return 'Not assessed: resolve power wiring warnings before relying on the battery estimate.';
  if (!ups.hasDownstream) return 'Not assessed: connect downstream equipment first.';
  if (!Number.isFinite(ups.runtimeMinutes)) return 'Not assessed: battery energy or load data is missing or invalid.';
  if (ups.capacityW === undefined) return 'Not assessed: UPS output rating is unknown.';
  if (ups.runtimeMinutes < minutes) return `Estimated energy falls short of ${minutes} minutes. Reduce load or increase verified usable battery energy.`;
  if (ups.unreviewedLoads) return 'Energy estimate reaches the target, but planning loads still need review.';
  return `Estimated energy covers ${minutes} minutes under the recorded assumptions; transfer behavior is not verified.`;
}

export function getShutdownPriority(device: PlacedDevice): ShutdownPriority {
  if (device.shutdownPriority) return device.shutdownPriority;

  switch (device.category) {
    case 'router':
    case 'firewall':
    case 'modem':
    case 'switch':
    case 'access-point':
    case 'ip-kvm':
      return 'critical';
    case 'nas':
    case 'server':
    case 'mini-pc':
    case 'sbc':
      return 'graceful';
    default:
      return 'non-critical';
  }
}

function flattenConsumers(node: PowerChainNode, items: PlacedDevice[] = []): PlacedDevice[] {
  for (const child of node.children) {
    if (isPowerSource(child.device)) {
      flattenConsumers(child, items);
      continue;
    }
    items.push(child.device);
    flattenConsumers(child, items);
  }
  return [...new Map(items.map(device => [device.id, device])).values()];
}

function collectLoadGroups(node: PowerChainNode): UpsLoadGroups {
  const groups: UpsLoadGroups = {
    criticalW: 0,
    gracefulW: 0,
    nonCriticalW: 0,
    infrastructureW: 0,
  };

  const seen = new Set([node.device.id]);
  const visit = (current: PowerChainNode) => {
    for (const child of current.children) {
      if (seen.has(child.device.id)) continue;
      seen.add(child.device.id);
      if (isPowerSource(child.device)) {
        groups.infrastructureW += child.loadW;
        visit(child);
        continue;
      }

      const priority = getShutdownPriority(child.device);
      if (priority === 'critical') groups.criticalW += child.loadW;
      else if (priority === 'graceful') groups.gracefulW += child.loadW;
      else groups.nonCriticalW += child.loadW;
      visit(child);
    }
  };

  visit(node);
  return groups;
}

function buildShutdownPlan(node: PowerChainNode): UpsShutdownStep[] {
  const consumers = flattenConsumers(node);
  return consumers
    .slice()
    .sort((a, b) => {
      const priorityOrder = { 'non-critical': 0, graceful: 1, critical: 2 } as const;
      const priorityDelta = priorityOrder[getShutdownPriority(a)] - priorityOrder[getShutdownPriority(b)];
      if (priorityDelta !== 0) return priorityDelta;
      return b.powerW - a.powerW;
    })
    .map((device) => {
      const priority = getShutdownPriority(device);
      const reason =
        priority === 'non-critical'
          ? 'Shed first to preserve battery for the rest of the rack.'
          : priority === 'graceful'
            ? 'Allow time for a clean shutdown before battery is exhausted.'
            : 'Keep online as long as possible during an outage.';
      return { device, priority, reason };
    });
}

function loadPercent(loadW: number, capacityW: number | undefined): number {
  if (!capacityW || capacityW <= 0) return 0;
  return (loadW / capacityW) * 100;
}

function buildWarnings(
  groups: UpsLoadGroups,
  criticalRuntimeMinutes: number,
  criticalLoadPercent: number,
  shutdownPlan: UpsShutdownStep[]
): string[] {
  const warnings: string[] = [];
  if (groups.criticalW <= 0) {
    warnings.push('No devices are currently classified as critical on this UPS.');
  }
  if (groups.nonCriticalW <= 0 && groups.gracefulW <= 0) {
    warnings.push('Everything on this UPS is marked as stay-online load, so there is no staged shedding plan yet.');
  }
  if (criticalRuntimeMinutes < 10) {
    warnings.push('Critical load runtime is under 10 minutes even after shedding non-critical devices.');
  }
  if (criticalLoadPercent > 80) {
    warnings.push('Critical load alone exceeds the 80% planning headroom threshold; this is not a safety rating.');
  }
  if (groups.gracefulW <= 0 && shutdownPlan.length > 0) {
    warnings.push('No devices are marked for graceful shutdown, so outage handling is all-or-nothing after non-critical loads are shed.');
  }
  return warnings;
}

export function calculateUpsRuntimes(layout: RackLayout, workspace?: Workspace): UpsRuntimeInfo[] {
  const projection = projectPoeInputLoads(layout, workspace);
  layout = projection.layout;
  const chains = layout.devices.filter(d => d.category === 'ups').flatMap(d => buildPowerChains(layout, d.id));
  const results: UpsRuntimeInfo[] = [];
  const topologyWarnings = buildPowerTopology(layout).warnings;
  const battery = batterySupplyLayout(layout);

  for (const chain of chains) {
    const utilityRoot = chain.root;
    const root = buildPowerChains(battery.layout, utilityRoot.device.id)[0].root;
    if (root.device.category !== 'ups') continue;


    const capacityW = getUpsCapacityW(root.device);
    const loadW = root.totalW;
    const descendantIds = new Set<string>();
    const collectIds = (node: PowerChainNode) => { descendantIds.add(node.device.id); node.children.forEach(collectIds); };
    collectIds(utilityRoot);
    const backupWarnings = battery.unknowns.filter(w => descendantIds.has(w.sourceId)).map(w => w.detail);
    const poeWarnings = [...descendantIds].flatMap(id => projection.warnings.get(id) ?? []);
    const runtimeMinutes = (backupWarnings.length || poeWarnings.length || topologyWarnings.length) ? NaN : calculateRuntimeMinutes(root.device, loadW);
    const groups = collectLoadGroups(root);
    const criticalSustainW = root.device.powerW + groups.infrastructureW + groups.criticalW;
    const criticalRuntimeMinutes = (backupWarnings.length || poeWarnings.length || topologyWarnings.length) ? NaN : calculateRuntimeMinutes(root.device, criticalSustainW);
    const shutdownPlan = buildShutdownPlan(root);
    const hasUnreviewedLoad = (node: PowerChainNode): boolean => needsPowerReview(node.device) || node.children.some(hasUnreviewedLoad);
    const criticalLoadPercent = loadPercent(groups.infrastructureW + groups.criticalW, capacityW);

    results.push({
      device: root.device,
      loadW,
      capacityW,
      loadPercent: loadPercent(utilityRoot.downstreamW, capacityW),
      batteryWh: root.device.batteryWh ?? 0,
      assumptions: getUpsBatteryAssumptions(root.device),
      hasDownstream: root.children.length > 0,
      unreviewedLoads: hasUnreviewedLoad(root),
      topologyUnverified: topologyWarnings.length > 0 || poeWarnings.length > 0 || backupWarnings.length > 0,
      outputLoadW: utilityRoot.downstreamW,
      runtimeMinutes,
      runtimeLabel: root.children.length ? formatRuntime(runtimeMinutes) : 'Not estimated',
      criticalRuntimeMinutes,
      criticalRuntimeLabel: root.children.length ? formatRuntime(criticalRuntimeMinutes) : 'Not estimated',
      groups,
      shutdownPlan,
      criticalLoadPercent,
      criticalLoadStatus: root.children.length ? runtimeStatus(criticalRuntimeMinutes) : 'warning',
      warnings: [
        ...topologyWarnings,
        ...backupWarnings,
        ...poeWarnings,
        ...buildWarnings(groups, criticalRuntimeMinutes, criticalLoadPercent, shutdownPlan),
        ...(!root.children.length ? ['No recorded battery-backed downstream equipment is connected. Self-load estimates do not model your rack outage.'] : []),
        ...(root.device.batteryWh === undefined ? ['Battery energy is unknown. Enter battery Wh in device properties.'] : []),
      ],
      status: root.children.length ? runtimeStatus(runtimeMinutes) : 'warning',
    });
  }

  return results;
}

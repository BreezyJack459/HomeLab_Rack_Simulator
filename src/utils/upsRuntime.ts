import type { RackLayout, PlacedDevice, ShutdownPriority } from '../types/rack';
import { buildPowerChains, getUpsCapacityW, isPowerSource, type PowerChainNode } from './powerChain';

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

const UPS_EFFICIENCY = 0.85;
const DEPTH_OF_DISCHARGE = 0.8;

function calculateRuntimeMinutes(batteryWh: number, loadW: number): number {
  if (loadW <= 0) return Infinity;
  const usableWh = batteryWh * UPS_EFFICIENCY * DEPTH_OF_DISCHARGE;
  return (usableWh / loadW) * 60;
}

function formatRuntime(minutes: number): string {
  if (!isFinite(minutes)) return '∞';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(minutes)}m`;
}

function runtimeStatus(minutes: number): 'ok' | 'warning' | 'critical' {
  if (!isFinite(minutes)) return 'ok';
  if (minutes >= 30) return 'ok';
  if (minutes >= 10) return 'warning';
  return 'critical';
}

function getShutdownPriority(device: PlacedDevice): ShutdownPriority {
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
  return items;
}

function collectLoadGroups(node: PowerChainNode): UpsLoadGroups {
  const groups: UpsLoadGroups = {
    criticalW: 0,
    gracefulW: 0,
    nonCriticalW: 0,
    infrastructureW: 0,
  };

  const visit = (current: PowerChainNode) => {
    for (const child of current.children) {
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
  return Math.min(100, (loadW / capacityW) * 100);
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
    warnings.push('Critical load alone exceeds the recommended 80% safe UPS capacity target.');
  }
  if (groups.gracefulW <= 0 && shutdownPlan.length > 0) {
    warnings.push('No devices are marked for graceful shutdown, so outage handling is all-or-nothing after non-critical loads are shed.');
  }
  return warnings;
}

export function calculateUpsRuntimes(layout: RackLayout): UpsRuntimeInfo[] {
  const chains = buildPowerChains(layout);
  const results: UpsRuntimeInfo[] = [];

  for (const chain of chains) {
    const root = chain.root;
    if (root.device.category !== 'ups') continue;
    if (!root.device.batteryWh) continue;

    const capacityW = getUpsCapacityW(root.device);
    const loadW = root.totalW;
    const runtimeMinutes = calculateRuntimeMinutes(root.device.batteryWh, loadW);
    const groups = collectLoadGroups(root);
    const criticalSustainW = root.device.powerW + groups.infrastructureW + groups.criticalW;
    const criticalRuntimeMinutes = calculateRuntimeMinutes(root.device.batteryWh, criticalSustainW);
    const shutdownPlan = buildShutdownPlan(root);
    const criticalLoadPercent = loadPercent(criticalSustainW, capacityW);

    results.push({
      device: root.device,
      loadW,
      capacityW,
      loadPercent: loadPercent(loadW, capacityW),
      batteryWh: root.device.batteryWh,
      runtimeMinutes,
      runtimeLabel: formatRuntime(runtimeMinutes),
      criticalRuntimeMinutes,
      criticalRuntimeLabel: formatRuntime(criticalRuntimeMinutes),
      groups,
      shutdownPlan,
      criticalLoadPercent,
      criticalLoadStatus: runtimeStatus(criticalRuntimeMinutes),
      warnings: buildWarnings(groups, criticalRuntimeMinutes, criticalLoadPercent, shutdownPlan),
      status: runtimeStatus(runtimeMinutes),
    });
  }

  // Also include UPSes with no power cables (orphaned) — show as 0 load, full runtime
  const upsInChains = new Set(results.map((r) => r.device.id));
  for (const device of layout.devices) {
    if (device.category !== 'ups') continue;
    if (upsInChains.has(device.id)) continue;
    if (!device.batteryWh) continue;

    const capacityW = getUpsCapacityW(device);
    const runtimeMinutes = calculateRuntimeMinutes(device.batteryWh, device.powerW);
    const criticalRuntimeMinutes = runtimeMinutes;
    results.push({
      device,
      loadW: device.powerW,
      capacityW,
      loadPercent: loadPercent(device.powerW, capacityW),
      batteryWh: device.batteryWh,
      runtimeMinutes,
      runtimeLabel: formatRuntime(runtimeMinutes),
      criticalRuntimeMinutes,
      criticalRuntimeLabel: formatRuntime(criticalRuntimeMinutes),
      groups: {
        criticalW: 0,
        gracefulW: 0,
        nonCriticalW: 0,
        infrastructureW: 0,
      },
      shutdownPlan: [],
      criticalLoadPercent: loadPercent(device.powerW, capacityW),
      criticalLoadStatus: runtimeStatus(criticalRuntimeMinutes),
      warnings: ['This UPS has no downstream load yet. Add power cables to model outage behavior.'],
      status: runtimeStatus(runtimeMinutes),
    });
  }

  return results;
}

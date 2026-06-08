import type { CableRoute, PlacedDevice, RackLayout, ValidationIssue } from '../types/rack';
import type { LayoutChange, LayoutDiff } from './layoutDiff';
import { validateRackLayout } from './validation';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChangeRiskDetail {
  category: 'device' | 'cable' | 'power' | 'dependency' | 'serviceability' | 'layout';
  message: string;
  severity: RiskLevel;
  affectedDeviceIds?: string[];
  affectedCableIds?: string[];
}

export interface ChangeRiskScore {
  level: RiskLevel;
  score: number; // 0-100
  reasons: ChangeRiskDetail[];
}

export interface RollbackStep {
  order: number;
  action: string;
  targetType: 'device' | 'cable' | 'layout';
  targetId?: string;
  description: string;
}

export interface RollbackPlan {
  steps: RollbackStep[];
  estimatedDowntimeMin: number;
  preChecklist: string[];
  postChecklist: string[];
}

export interface ChangeReview {
  diff: LayoutDiff;
  risk: ChangeRiskScore;
  rollback: RollbackPlan;
  affectedServices: string[];
  validationIssuesBefore: ValidationIssue[];
  validationIssuesAfter: ValidationIssue[];
}

const MAX_SCORE = 100;
const CRITICAL_THRESHOLD = 75;
const HIGH_THRESHOLD = 50;
const MEDIUM_THRESHOLD = 25;

function deviceById(layout: RackLayout): Map<string, PlacedDevice> {
  return new Map(layout.devices.map((d) => [d.id, d]));
}

function isCriticalDevice(device: PlacedDevice): boolean {
  return device.category === 'router' || device.category === 'firewall' || device.category === 'ups' || device.shutdownPriority === 'critical';
}

function isNetworkCore(device: PlacedDevice): boolean {
  return device.category === 'switch' || device.category === 'router' || device.category === 'firewall';
}

function networkDownstreamDevices(layout: RackLayout, deviceId: string): string[] {
  const downstream = new Set<string>();
  for (const cable of layout.cables) {
    if (cable.fromDeviceId === deviceId && cable.type === 'ethernet') {
      downstream.add(cable.toDeviceId);
    }
  }
  return Array.from(downstream);
}

function powerDownstreamDevices(layout: RackLayout, deviceId: string): string[] {
  const downstream = new Set<string>();
  for (const cable of layout.cables) {
    if (cable.fromDeviceId === deviceId && cable.type === 'power') {
      downstream.add(cable.toDeviceId);
    }
  }
  return Array.from(downstream);
}

export function calculateChangeRisk(diff: LayoutDiff, beforeLayout: RackLayout, afterLayout: RackLayout): ChangeRiskScore {
  const reasons: ChangeRiskDetail[] = [];
  let score = 0;

  const beforeDevices = deviceById(beforeLayout);
  const afterDevices = deviceById(afterLayout);

  // Critical device changes
  for (const change of diff.deviceChanges) {
    const device = afterDevices.get(change.deviceId) ?? beforeDevices.get(change.deviceId);
    if (!device) continue;

    if (isCriticalDevice(device)) {
      if (change.class === 'removed') {
        reasons.push({
          category: 'device',
          message: `Removing critical device: ${device.name}`,
          severity: 'critical',
          affectedDeviceIds: [device.id],
        });
        score += 25;
      } else if (change.class === 'moved') {
        reasons.push({
          category: 'device',
          message: `Moving critical device: ${device.name}`,
          severity: 'high',
          affectedDeviceIds: [device.id],
        });
        score += 15;
      } else if (change.class === 'repowered') {
        reasons.push({
          category: 'power',
          message: `Changing power config for critical device: ${device.name}`,
          severity: 'high',
          affectedDeviceIds: [device.id],
        });
        score += 15;
      }
    }

    if (isNetworkCore(device) && (change.class === 'removed' || change.class === 'moved')) {
      const downstream = networkDownstreamDevices(beforeLayout, device.id);
      if (downstream.length > 0) {
        reasons.push({
          category: 'dependency',
          message: `${device.name} is a network core — ${downstream.length} device(s) may lose connectivity`,
          severity: 'high',
          affectedDeviceIds: [device.id, ...downstream],
        });
        score += downstream.length * 5;
      }
    }
  }

  // Cable changes
  for (const change of diff.cableChanges) {
    if (change.class === 'removed') {
      const fromId = change.before?.fromDeviceId as string | undefined;
      const toId = change.before?.toDeviceId as string | undefined;
      if (fromId && toId) {
        const fromDev = beforeDevices.get(fromId);
        const toDev = beforeDevices.get(toId);
        if (fromDev && isCriticalDevice(fromDev)) {
          reasons.push({
            category: 'cable',
            message: `Removing cable to/from critical device: ${fromDev.name}`,
            severity: 'high',
            affectedDeviceIds: [fromId, toId],
            affectedCableIds: [change.cableId],
          });
          score += 10;
        }
      }
    } else if (change.class === 'rewired') {
      score += 8;
      reasons.push({
        category: 'cable',
        message: `Cable rewired: ${change.cableId}`,
        severity: 'medium',
        affectedCableIds: [change.cableId],
      });
    }
  }

  // Power path changes
  const powerChanges = diff.cableChanges.filter(
    (c) => c.class === 'removed' || c.class === 'added' || c.class === 'rewired'
  );
  for (const change of powerChanges) {
    const cable = change.before ?? change.after;
    if (cable && (cable as Partial<CableRoute>).type === 'power') {
      const affected = [(cable as Partial<CableRoute>).fromDeviceId, (cable as Partial<CableRoute>).toDeviceId].filter(Boolean) as string[];
      reasons.push({
        category: 'power',
        message: `Power cable ${change.class}: ${change.cableId}`,
        severity: 'high',
        affectedDeviceIds: affected,
        affectedCableIds: [change.cableId],
      });
      score += 12;
    }
  }

  // Layout property changes
  for (const change of diff.layoutPropertyChanges) {
    if (change.property === 'heightU' || change.property === 'rackDepthMm') {
      reasons.push({
        category: 'layout',
        message: `Rack dimension changed (${change.property})`,
        severity: 'medium',
      });
      score += 10;
    }
    if (change.property === 'powerBudgetW') {
      reasons.push({
        category: 'power',
        message: 'Power budget changed',
        severity: 'medium',
      });
      score += 8;
    }
  }

  // Serviceability: heavy devices moved high
  for (const change of diff.movedDevices) {
    const device = afterDevices.get(change.deviceId);
    if (device && device.weightKg > 15 && device.positionU > (afterLayout.heightU / 2)) {
      reasons.push({
        category: 'serviceability',
        message: `${device.name} is heavy (${device.weightKg}kg) and placed in upper half of rack`,
        severity: 'medium',
        affectedDeviceIds: [device.id],
      });
      score += 5;
    }
  }

  score = Math.min(MAX_SCORE, score);

  let level: RiskLevel = 'low';
  if (score >= CRITICAL_THRESHOLD) level = 'critical';
  else if (score >= HIGH_THRESHOLD) level = 'high';
  else if (score >= MEDIUM_THRESHOLD) level = 'medium';

  return { level, score, reasons };
}

export function generateRollbackPlan(diff: LayoutDiff, beforeLayout: RackLayout): RollbackPlan {
  const steps: RollbackStep[] = [];
  let order = 1;

  // Reverse order: add → remove, remove → re-add, move → move back, rewire → rewire back
  // 1. Restore removed devices first (so cables can reconnect)
  for (const change of diff.removedDevices) {
    if (change.before) {
      steps.push({
        order: order++,
        action: 'Re-add device',
        targetType: 'device',
        targetId: change.deviceId,
        description: `Restore ${change.name} to U${change.before.positionU ?? '?'}`,
      });
    }
  }

  // 2. Move devices back
  for (const change of diff.movedDevices) {
    if (change.before) {
      steps.push({
        order: order++,
        action: 'Move device back',
        targetType: 'device',
        targetId: change.deviceId,
        description: `Move ${change.name} back to U${change.before.positionU ?? '?'}`,
      });
    }
  }

  // 3. Restore removed cables
  for (const change of diff.removedCables) {
    if (change.before) {
      const b = change.before as Partial<CableRoute>;
      steps.push({
        order: order++,
        action: 'Re-add cable',
        targetType: 'cable',
        targetId: change.cableId,
        description: `Reconnect cable from ${b.fromDeviceId ?? '?'} to ${b.toDeviceId ?? '?'}`,
      });
    }
  }

  // 4. Rewire cables back
  for (const change of diff.rewiredCables) {
    if (change.before) {
      const b = change.before as Partial<CableRoute>;
      steps.push({
        order: order++,
        action: 'Restore cable wiring',
        targetType: 'cable',
        targetId: change.cableId,
        description: `Restore cable endpoints for ${change.cableId}`,
      });
    }
  }

  // 5. Remove added cables
  for (const change of diff.addedCables) {
    steps.push({
      order: order++,
      action: 'Remove added cable',
      targetType: 'cable',
      targetId: change.cableId,
      description: `Remove newly added cable ${change.cableId}`,
    });
  }

  // 6. Remove added devices
  for (const change of diff.addedDevices) {
    steps.push({
      order: order++,
      action: 'Remove added device',
      targetType: 'device',
      targetId: change.deviceId,
      description: `Remove newly added device ${change.name}`,
    });
  }

  const estimatedDowntimeMin = steps.length * 2; // rough heuristic

  const preChecklist = [
    'Export current layout JSON as backup',
    'Notify users of planned maintenance window',
    'Verify all affected devices are accessible via out-of-band if available',
    'Confirm rollback steps are understood by the operator',
  ];

  const postChecklist = [
    'Verify all devices power on and respond to ping',
    'Check switch port status lights / management GUI',
    'Validate internet connectivity from multiple VLANs',
    'Test NAS / storage access',
    'Confirm UPS reports normal battery and load',
  ];

  return { steps, estimatedDowntimeMin, preChecklist, postChecklist };
}

export function affectedServices(diff: LayoutDiff, beforeLayout: RackLayout, afterLayout: RackLayout): string[] {
  const services = new Set<string>();
  const beforeDevices = deviceById(beforeLayout);
  const afterDevices = deviceById(afterLayout);

  for (const change of diff.deviceChanges) {
    const device = afterDevices.get(change.deviceId) ?? beforeDevices.get(change.deviceId);
    if (!device) continue;

    if (device.category === 'router' || device.category === 'firewall') services.add('Internet access');
    if (device.category === 'switch') services.add('Local network');
    if (device.category === 'nas') services.add('File storage / backups');
    if (device.category === 'access-point') services.add('Wi-Fi');
    if (device.category === 'ups') services.add('Battery backup');
    if (device.category === 'pdu' || device.category === 'pdu-0u') services.add('Power distribution');
    if (device.category === 'ip-kvm') services.add('Remote management');
  }

  for (const change of diff.cableChanges) {
    if (change.class === 'removed' || change.class === 'rewired') {
      const c = change.before ?? change.after;
      if (c && (c as Partial<CableRoute>).type === 'ethernet') {
        services.add('Network connectivity');
      }
      if (c && (c as Partial<CableRoute>).type === 'power') {
        services.add('Power delivery');
      }
    }
  }

  return Array.from(services);
}

export function buildChangeReview(
  diff: LayoutDiff,
  beforeLayout: RackLayout,
  afterLayout: RackLayout
): ChangeReview {
  const risk = calculateChangeRisk(diff, beforeLayout, afterLayout);
  const rollback = generateRollbackPlan(diff, beforeLayout);
  const services = affectedServices(diff, beforeLayout, afterLayout);

  return {
    diff,
    risk,
    rollback,
    affectedServices: services,
    validationIssuesBefore: validateRackLayout(beforeLayout),
    validationIssuesAfter: validateRackLayout(afterLayout),
  };
}

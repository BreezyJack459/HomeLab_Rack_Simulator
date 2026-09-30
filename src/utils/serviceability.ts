import type { RackLayout, ValidationIssue } from '../types/rack';
import { getDeviceMountSide, getDeviceSpatialZone, isZeroU, rangesOverlap } from './rackMath';
import { getCableLengthRequirements } from './cableLengthRequirements';

const SERVICE_SLACK_MM = 300;

export interface CableStrainRisk {
  cableId: string;
  deviceId: string;
  deviceName: string;
  cableLengthMm: number | null;
  requiredLengthMm: number | null;
  status: 'short' | 'unverified';
  detail: string;
}

export interface FrontRearCollision {
  frontDeviceId: string;
  frontDeviceName: string;
  frontDepthMm: number;
  rearDeviceId: string;
  rearDeviceName: string;
  rearDepthMm: number;
  combinedDepthMm: number;
  rackDepthMm: number;
}

export interface HeavyOverLightIssue {
  upperDeviceId: string;
  upperDeviceName: string;
  upperWeightKg: number;
  lowerDeviceId: string;
  lowerDeviceName: string;
  lowerWeightKg: number;
  gapU: number;
}

export interface DeviceMaintenanceChecklistItem {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'ok';
  title: string;
  detail: string;
}

export function getCableStrainRisks(layout: RackLayout): CableStrainRisk[] {
  const risks: CableStrainRisk[] = [];

  for (const cable of layout.cables) {
    const requirement = getCableLengthRequirements(layout).get(cable.id);
    const lengthMm = cable.lengthMm && cable.lengthMm > 0 ? cable.lengthMm : null;
    const devices = layout.devices.filter(device => device.id === cable.fromDeviceId || device.id === cable.toDeviceId);
    // Conservative one-device travel allowance, not a moving cable-arm simulation.
    for (const device of devices) {
      const allowanceMm = Math.max(SERVICE_SLACK_MM, requirement?.slackMm ?? 0);
      const requiredLengthMm = requirement?.centrelineMm != null && device.depthMm > 0
        ? Math.ceil(requirement.centrelineMm + device.depthMm + allowanceMm) : null;
      if (lengthMm === null || requiredLengthMm === null || lengthMm < requiredLengthMm) {
        const unverified = lengthMm === null || requiredLengthMm === null;
        const detail = [
          lengthMm === null ? 'Actual cable length is not recorded.' : `Recorded cable: ${lengthMm}mm.`,
          requiredLengthMm === null ? 'Route or device depth is unresolved; maintenance length is not estimated.'
            : `Assumed maintenance requirement: ${requiredLengthMm}mm (3D centreline ${Math.ceil(requirement!.centrelineMm!)}mm + chassis-depth travel ${device.depthMm}mm + ${allowanceMm}mm allowance).`,
          'Assumes one device moves by its chassis depth; cable arms, release points and moving clearances are not verified.',
        ].join(' ');
        risks.push({ cableId: cable.id, deviceId: device.id, deviceName: device.name,
          cableLengthMm: lengthMm, requiredLengthMm, status: unverified ? 'unverified' : 'short', detail });
      }
    }
  }

  return risks;
}

export function getFrontRearCollisions(layout: RackLayout): FrontRearCollision[] {
  const collisions: FrontRearCollision[] = [];
  const frontDevices = layout.devices.filter((d) => !isZeroU(d) && getDeviceMountSide(d) === 'front');
  const rearDevices = layout.devices.filter((d) => !isZeroU(d) && getDeviceMountSide(d) === 'rear');

  for (const front of frontDevices) {
    for (const rear of rearDevices) {
      const overlap = rangesOverlap(
        front.positionU,
        front.sizeU,
        rear.positionU,
        rear.sizeU
      );
      if (!overlap) continue;

      const combinedDepth = front.depthMm + rear.depthMm;
      if (combinedDepth > layout.rackDepthMm) {
        collisions.push({
          frontDeviceId: front.id,
          frontDeviceName: front.name,
          frontDepthMm: front.depthMm,
          rearDeviceId: rear.id,
          rearDeviceName: rear.name,
          rearDepthMm: rear.depthMm,
          combinedDepthMm: combinedDepth,
          rackDepthMm: layout.rackDepthMm,
        });
      }
    }
  }

  return collisions;
}

export function getHeavyOverLightIssues(layout: RackLayout): HeavyOverLightIssue[] {
  const issues: HeavyOverLightIssue[] = [];
  const rackMounted = layout.devices
    .filter((d) => !isZeroU(d))
    .sort((a, b) => a.positionU - b.positionU);

  for (let i = 0; i < rackMounted.length; i += 1) {
    const upper = rackMounted[i];
    if (upper.weightKg < 10) continue;

    for (let j = i + 1; j < rackMounted.length; j += 1) {
      const lower = rackMounted[j];
      if (getDeviceMountSide(upper) !== getDeviceMountSide(lower)) continue;
      if (upper.weightKg <= lower.weightKg) continue;

      const gapU = lower.positionU - (upper.positionU + upper.sizeU);
      if (gapU < 0) continue; // overlapping or out of order
      if (gapU > 1) break; // lower is too far down; all subsequent devices are even farther

      issues.push({
        upperDeviceId: upper.id,
        upperDeviceName: upper.name,
        upperWeightKg: upper.weightKg,
        lowerDeviceId: lower.id,
        lowerDeviceName: lower.name,
        lowerWeightKg: lower.weightKg,
        gapU,
      });
    }
  }

  return issues;
}

export function getServiceabilityIssues(layout: RackLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const strainRisks = getCableStrainRisks(layout);
  for (const risk of strainRisks) {
    issues.push({
      id: `cable-strain-${risk.cableId}-${risk.deviceId}`,
      evidence: risk.status === 'unverified' ? 'unverified' : undefined,
      severity: 'warning',
      title: risk.status === 'unverified' ? `${risk.deviceName} service cable needs review` : `${risk.deviceName} cable may be too short for service`,
      detail: risk.detail,
      deviceIds: [risk.deviceId],
      cableIds: [risk.cableId],
    });
  }

  const collisions = getFrontRearCollisions(layout);
  for (const collision of collisions) {
    issues.push({
      id: `front-rear-collision-${collision.frontDeviceId}-${collision.rearDeviceId}`,
      severity: 'critical',
      title: 'Front and rear devices collide inside the rack',
      detail: `${collision.frontDeviceName} (${collision.frontDepthMm}mm front) and ${collision.rearDeviceName} (${collision.rearDepthMm}mm rear) combine to ${collision.combinedDepthMm}mm, exceeding the ${collision.rackDepthMm}mm rack depth. One device will block the other from sliding out.`,
      deviceIds: [collision.frontDeviceId, collision.rearDeviceId],
    });
  }

  const heavyLight = getHeavyOverLightIssues(layout);
  for (const issue of heavyLight) {
    issues.push({
      id: `heavy-over-light-${issue.upperDeviceId}-${issue.lowerDeviceId}`,
      severity: 'info',
      title: `${issue.lowerDeviceName} is hard to access under heavy ${issue.upperDeviceName}`,
      detail: `${issue.upperDeviceName} (${issue.upperWeightKg}kg) sits directly above ${issue.lowerDeviceName} (${issue.lowerWeightKg}kg) with only ${issue.gapU}U gap. Servicing the lower device requires supporting or removing the heavy unit above.`,
      deviceIds: [issue.upperDeviceId, issue.lowerDeviceId],
    });
  }

  return issues;
}

export interface PullOutBlocker {
  deviceId: string;
  deviceName: string;
  depthMm: number;
  reason: 'same-u-deeper' | 'front-rear-collision' | 'door-clearance';
}

export interface PullOutSimulation {
  deviceId: string;
  deviceName: string;
  mountSide: 'front' | 'rear';
  deviceDepthMm: number;
  mountEnvelopeMm: number;
  requiredSlideMm: number;
  availableSlideMm: number;
  frontDoorClearanceMm: number;
  rearDoorClearanceMm: number;
  doorBlocked: boolean;
  canPullOut: boolean;
  blockers: PullOutBlocker[];
}

export function getPullOutSimulation(layout: RackLayout, deviceId: string): PullOutSimulation | null {
  const device = layout.devices.find((d) => d.id === deviceId);
  if (!device || isZeroU(device)) return null;

  const mountSide = getDeviceMountSide(device);
  const deviceDepth = device.depthMm + (device.mountEnvelopeMm ?? 0);
  const requiredSlideMm = deviceDepth + SERVICE_SLACK_MM;
  const frontDoorClearanceMm = layout.frontDoorClearanceMm ?? 0;
  const rearDoorClearanceMm = layout.rearDoorClearanceMm ?? 0;
  const availableSlideMm = Math.max(0, layout.rackDepthMm - frontDoorClearanceMm - rearDoorClearanceMm);
  const doorBlocked = mountSide === 'front'
    ? deviceDepth > layout.rackDepthMm - rearDoorClearanceMm
    : deviceDepth > layout.rackDepthMm - frontDoorClearanceMm;

  const blockers: PullOutBlocker[] = [];

  // Front/rear collision at same U blocks both devices
  const counterpart = layout.devices.find(
    (d) =>
      d.id !== device.id &&
      !isZeroU(d) &&
      getDeviceMountSide(d) !== mountSide &&
      rangesOverlap(device.positionU, device.sizeU, d.positionU, d.sizeU)
  );
  if (counterpart) {
    const counterpartDepth = counterpart.depthMm + (counterpart.mountEnvelopeMm ?? 0);
    if (deviceDepth + counterpartDepth > layout.rackDepthMm) {
      blockers.push({
        deviceId: counterpart.id,
        deviceName: counterpart.name,
        depthMm: counterpartDepth,
        reason: 'front-rear-collision',
      });
    }
  }

  // Door clearance blocker
  if (doorBlocked) {
    blockers.push({
      deviceId: 'door',
      deviceName: mountSide === 'front' ? 'Rear door/clearance' : 'Front door/clearance',
      depthMm: mountSide === 'front' ? rearDoorClearanceMm : frontDoorClearanceMm,
      reason: 'door-clearance',
    });
  }

  const canPullOut = blockers.length === 0 && requiredSlideMm <= availableSlideMm;

  return {
    deviceId: device.id,
    deviceName: device.name,
    mountSide,
    deviceDepthMm: device.depthMm,
    mountEnvelopeMm: device.mountEnvelopeMm ?? 0,
    requiredSlideMm,
    availableSlideMm,
    frontDoorClearanceMm,
    rearDoorClearanceMm,
    doorBlocked,
    canPullOut,
    blockers,
  };
}

export function getServiceabilityHighlightedDeviceIds(layout: RackLayout): string[] {
  return Array.from(
    new Set([
      ...getCableStrainRisks(layout).map((risk) => risk.deviceId),
      ...getFrontRearCollisions(layout).flatMap((collision) => [collision.frontDeviceId, collision.rearDeviceId]),
      ...getHeavyOverLightIssues(layout).flatMap((issue) => [issue.upperDeviceId, issue.lowerDeviceId]),
    ])
  );
}

export function getDeviceMaintenanceChecklist(layout: RackLayout, deviceId: string): DeviceMaintenanceChecklistItem[] {
  const device = layout.devices.find((candidate) => candidate.id === deviceId);
  if (!device) return [];

  const items: DeviceMaintenanceChecklistItem[] = [];
  const strainRisks = getCableStrainRisks(layout).filter((risk) => risk.deviceId === deviceId);
  const collisions = getFrontRearCollisions(layout).filter(
    (collision) => collision.frontDeviceId === deviceId || collision.rearDeviceId === deviceId
  );
  const heavyIssues = getHeavyOverLightIssues(layout).filter(
    (issue) => issue.upperDeviceId === deviceId || issue.lowerDeviceId === deviceId
  );

  if (collisions.length === 0) {
    items.push({
      id: `${deviceId}-depth-clear`,
      severity: 'ok',
      title: 'Depth clearance',
      detail: 'No front/rear depth collision detected for this device.',
    });
  } else {
    for (const collision of collisions) {
      const counterpart =
        collision.frontDeviceId === deviceId ? collision.rearDeviceName : collision.frontDeviceName;
      items.push({
        id: `collision-${collision.frontDeviceId}-${collision.rearDeviceId}`,
        severity: 'critical',
        title: 'Resolve front/rear collision',
        detail: `Conflicts with ${counterpart}. Combined depth is ${collision.combinedDepthMm}mm in a ${collision.rackDepthMm}mm rack.`,
      });
    }
  }

  if (strainRisks.length === 0) {
    items.push({
      id: `${deviceId}-strain-clear`,
      severity: 'ok',
      title: 'Service slack',
      detail: layout.cables.some(cable => cable.fromDeviceId === deviceId || cable.toDeviceId === deviceId)
        ? 'Recorded lengths cover the 3D route plus assumed chassis-depth travel and allowance. Cable arms, release points and moving clearances remain unverified.'
        : 'No attached cables to assess.',
    });
  } else {
    for (const risk of strainRisks) {
      items.push({
        id: `strain-${risk.cableId}-${risk.deviceId}`,
        severity: 'warning',
        title: risk.status === 'unverified' ? 'Review service cable' : 'Lengthen service cable',
        detail: risk.detail,
      });
    }
  }

  if (heavyIssues.length === 0) {
    items.push({
      id: `${deviceId}-access-clear`,
      severity: 'ok',
      title: 'Access path',
      detail: 'No nearby heavy-over-light access hazard detected.',
    });
  } else {
    for (const issue of heavyIssues) {
      const counterpart = issue.upperDeviceId === deviceId ? issue.lowerDeviceName : issue.upperDeviceName;
      const action =
        issue.upperDeviceId === deviceId
          ? `Document a safe removal/support plan before servicing ${counterpart}.`
          : `Plan to support or remove ${counterpart} before servicing this device.`;
      items.push({
        id: `heavy-${issue.upperDeviceId}-${issue.lowerDeviceId}`,
        severity: 'info',
        title: 'Heavy device access hazard',
        detail: `${action} Current gap: ${issue.gapU}U.`,
      });
    }
  }

  // Pull-out simulation
  const sim = getPullOutSimulation(layout, deviceId);
  if (sim) {
    if (sim.canPullOut) {
      items.push({
        id: `${deviceId}-pullout-ok`,
        severity: 'ok',
        title: 'Pull-out simulation',
        detail: `${sim.deviceName} (${sim.deviceDepthMm}mm${sim.mountEnvelopeMm > 0 ? ` + ${sim.mountEnvelopeMm}mm envelope` : ''}) can slide out ${sim.mountSide}-side. Needs ${sim.requiredSlideMm}mm travel, ${sim.availableSlideMm}mm available.`,
      });
    } else {
      const blockerNames = sim.blockers.map((b) => b.deviceName).join(', ');
      items.push({
        id: `${deviceId}-pullout-blocked`,
        severity: sim.blockers.some((b) => b.reason === 'front-rear-collision') ? 'critical' : 'warning',
        title: 'Pull-out blocked',
        detail: `${sim.deviceName} needs ${sim.requiredSlideMm}mm ${sim.mountSide}-side travel but only ${sim.availableSlideMm}mm is available. ${blockerNames ? `Blocked by: ${blockerNames}.` : 'Rack depth or door clearance is insufficient.'}`,
      });
    }
  }

  return items;
}

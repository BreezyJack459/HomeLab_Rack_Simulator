import type { RackLayout, ValidationIssue } from '../types/rack';
import { getDeviceMountSide, getDeviceSpatialZone, isZeroU, rangesOverlap } from './rackMath';
import { estimateCableLength } from './rackMath';

const SERVICE_SLACK_MM = 300;

export interface CableStrainRisk {
  cableId: string;
  deviceId: string;
  deviceName: string;
  cableLengthMm: number;
  requiredLengthMm: number;
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

export function getCableStrainRisks(layout: RackLayout): CableStrainRisk[] {
  const risks: CableStrainRisk[] = [];

  for (const cable of layout.cables) {
    const lengthMm = estimateCableLength(layout, cable);
    const fromDevice = layout.devices.find((d) => d.id === cable.fromDeviceId);
    const toDevice = layout.devices.find((d) => d.id === cable.toDeviceId);
    if (!fromDevice || !toDevice) continue;

    // Check both ends: the cable must be long enough for either device to be pulled out
    for (const device of [fromDevice, toDevice]) {
      const requiredLengthMm = device.depthMm + SERVICE_SLACK_MM;
      if (lengthMm < requiredLengthMm) {
        risks.push({
          cableId: cable.id,
          deviceId: device.id,
          deviceName: device.name,
          cableLengthMm: lengthMm,
          requiredLengthMm,
        });
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
      severity: 'warning',
      title: `${risk.deviceName} cable may be too short for service`,
      detail: `Cable length is ${risk.cableLengthMm}mm but ${risk.deviceName} needs ${risk.requiredLengthMm}mm (${risk.deviceName} depth ${risk.deviceName}mm + ${SERVICE_SLACK_MM}mm service slack) to pull out for maintenance.`,
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

import type { RackLayout, ValidationSeverity } from '../types/rack';
import { RACK_SPECS } from './rackMath';

export type RoomType = 'bedroom' | 'office' | 'closet' | 'garage' | 'basement';
export type FloorType = 'wood' | 'concrete' | 'tile' | 'carpet';
export type RackPosition = 'against-wall' | 'center' | 'corner';

export interface RoomParams {
  roomWidthMm: number;
  roomDepthMm: number;
  roomHeightMm: number;
  roomType: RoomType;
  floorType: FloorType;
  hasAc: boolean;
  rackPosition: RackPosition;
}

export interface RoomPlacementIssue {
  id: string;
  severity: ValidationSeverity;
  category: 'space' | 'floor' | 'thermal' | 'noise' | 'access';
  title: string;
  detail: string;
}

export interface RoomPlacementResult {
  rackFootprint: { widthMm: number; depthMm: number; heightMm: number };
  totalWeightKg: number;
  floorLoadingKgPerM2: number;
  minRoomWidthMm: number;
  minRoomDepthMm: number;
  requiredFrontClearanceMm: number;
  requiredRearClearanceMm: number;
  requiredSideClearanceMm: number;
  heatOutputW: number;
  estimatedNoiseDb: number;
  issues: RoomPlacementIssue[];
  recommendations: string[];
  score: number;
}

const STANDARD_U_MM = 44.45;
const RACK_BASE_HEIGHT_MM = 100; // feet/base

// Minimum clearances for service access (mm)
const MIN_FRONT_ACCESS_MM = 600;
const MIN_REAR_ACCESS_MM = 400;
const MIN_SIDE_ACCESS_MM = 150;
const MIN_SIDE_ACCESS_HEAVY_MM = 300;

// Floor loading limits (kg/m²)
const FLOOR_LOAD_LIMITS: Record<FloorType, number> = {
  wood: 150,
  carpet: 150,
  tile: 300,
  concrete: 800,
};

// Noise thresholds by room type (dB)
const NOISE_THRESHOLDS: Record<RoomType, number> = {
  bedroom: 45,
  office: 55,
  closet: 60,
  garage: 70,
  basement: 65,
};

function getRackHeightMm(heightU: number): number {
  return heightU * STANDARD_U_MM + RACK_BASE_HEIGHT_MM;
}

function getRackOuterWidthMm(rackType: RackLayout['rackType']): number {
  return RACK_SPECS[rackType].outerWidthMm;
}

function totalWeight(devices: RackLayout['devices']): number {
  return devices.reduce((sum, d) => sum + d.weightKg, 0);
}

function totalPowerW(devices: RackLayout['devices']): number {
  return devices.reduce((sum, d) => sum + d.powerW, 0);
}

function estimateNoiseDb(devices: RackLayout['devices']): number {
  if (devices.length === 0) return 0;
  const noiseLevels = devices
    .map((d) => d.noiseDb ?? 0)
    .filter((db) => db > 0)
    .sort((a, b) => b - a);
  if (noiseLevels.length === 0) return 0;
  // Loudest device dominates; add ~3dB for each additional significant source
  let total = noiseLevels[0];
  for (let i = 1; i < noiseLevels.length; i += 1) {
    if (noiseLevels[i] >= total - 10) {
      total += 3;
    }
  }
  return total;
}

function getRequiredClearances(layout: RackLayout): {
  front: number;
  rear: number;
  side: number;
} {
  const front = Math.max(
    MIN_FRONT_ACCESS_MM,
    (layout.frontDoorClearanceMm ?? 0) + 300
  );
  const rear = Math.max(
    MIN_REAR_ACCESS_MM,
    (layout.rearDoorClearanceMm ?? 0) + (layout.rearClearanceMm ?? 0) + 200
  );
  const heatScore = layout.devices.reduce(
    (sum, d) => sum + d.heatLevel * Math.max(1, d.sizeU),
    0
  );
  const side = heatScore > 30 ? MIN_SIDE_ACCESS_HEAVY_MM : MIN_SIDE_ACCESS_MM;
  return { front, rear, side };
}

export function getDefaultRoomParams(): RoomParams {
  return {
    roomWidthMm: 3000,
    roomDepthMm: 3000,
    roomHeightMm: 2500,
    roomType: 'basement',
    floorType: 'concrete',
    hasAc: false,
    rackPosition: 'against-wall',
  };
}

export function analyzeRoomPlacement(
  layout: RackLayout,
  roomParams: RoomParams
): RoomPlacementResult {
  const rackWidthMm = getRackOuterWidthMm(layout.rackType);
  const rackDepthMm = layout.rackDepthMm || RACK_SPECS[layout.rackType].defaultDepthMm;
  const rackHeightMm = getRackHeightMm(layout.heightU);

  const weightKg = totalWeight(layout.devices);
  const footprintM2 = (rackWidthMm * rackDepthMm) / 1_000_000;
  const floorLoadingKgPerM2 = footprintM2 > 0 ? weightKg / footprintM2 : 0;

  const clearances = getRequiredClearances(layout);
  const minRoomWidthMm = rackWidthMm + clearances.side * 2;
  const minRoomDepthMm = rackDepthMm + clearances.front + clearances.rear;

  const heatOutputW = totalPowerW(layout.devices);
  const estimatedNoiseDb = estimateNoiseDb(layout.devices);

  const issues: RoomPlacementIssue[] = [];
  const recommendations: string[] = [];

  // Space checks
  if (roomParams.roomWidthMm < minRoomWidthMm) {
    issues.push({
      id: 'room-width',
      severity: 'critical',
      category: 'space',
      title: 'Room width is insufficient',
      detail: `Room is ${(roomParams.roomWidthMm / 1000).toFixed(1)}m wide; minimum ${(minRoomWidthMm / 1000).toFixed(1)}m required for side clearance and access.`,
    });
  } else if (roomParams.roomWidthMm < minRoomWidthMm * 1.2) {
    issues.push({
      id: 'room-width-tight',
      severity: 'warning',
      category: 'space',
      title: 'Room width is tight',
      detail: `Only ${((roomParams.roomWidthMm - minRoomWidthMm) / 1000).toFixed(1)}m of extra width beyond minimum clearance.`,
    });
  }

  if (roomParams.roomDepthMm < minRoomDepthMm) {
    issues.push({
      id: 'room-depth',
      severity: 'critical',
      category: 'space',
      title: 'Room depth is insufficient',
      detail: `Room is ${(roomParams.roomDepthMm / 1000).toFixed(1)}m deep; minimum ${(minRoomDepthMm / 1000).toFixed(1)}m required for front/rear access.`,
    });
  }

  if (roomParams.roomHeightMm < rackHeightMm + 200) {
    issues.push({
      id: 'room-height',
      severity: 'warning',
      category: 'space',
      title: 'Ceiling height may be too low',
      detail: `Rack height is ${(rackHeightMm / 1000).toFixed(1)}m; recommend at least ${((rackHeightMm + 200) / 1000).toFixed(1)}m ceiling for top-U access and airflow.`,
    });
  }

  // Floor loading checks
  const floorLimit = FLOOR_LOAD_LIMITS[roomParams.floorType];
  if (floorLoadingKgPerM2 > floorLimit) {
    issues.push({
      id: 'floor-loading',
      severity: 'critical',
      category: 'floor',
      title: 'Floor loading exceeds safe limit',
      detail: `Rack loads ${floorLoadingKgPerM2.toFixed(0)} kg/m² on ${roomParams.floorType} flooring rated for ~${floorLimit} kg/m². Risk of structural damage.`,
    });
    recommendations.push('Distribute weight across multiple racks or move to a concrete floor.');
  } else if (floorLoadingKgPerM2 > floorLimit * 0.8) {
    issues.push({
      id: 'floor-loading-near',
      severity: 'warning',
      category: 'floor',
      title: 'Floor loading is near the safe limit',
      detail: `Rack loads ${floorLoadingKgPerM2.toFixed(0)} kg/m², over 80% of ${roomParams.floorType} rating (${floorLimit} kg/m²).`,
    });
  }

  if (weightKg > 80 && roomParams.floorType === 'wood') {
    issues.push({
      id: 'wood-floor-heavy',
      severity: 'warning',
      category: 'floor',
      title: 'Heavy rack on wood floor',
      detail: `Total weight is ${weightKg.toFixed(1)}kg. Wood floors may deflect or creak under sustained point loads. Consider load-spreading feet or a plywood base.`,
    });
  }

  // Thermal checks
  if (heatOutputW > 2000 && !roomParams.hasAc) {
    issues.push({
      id: 'thermal-no-ac',
      severity: 'warning',
      category: 'thermal',
      title: 'High heat output without dedicated cooling',
      detail: `Rack outputs ~${heatOutputW}W. Without AC, ambient temperature will rise significantly. Ensure adequate ventilation or add cooling.`,
    });
    recommendations.push('Install a portable AC unit or ensure cross-ventilation with intake and exhaust fans.');
  } else if (heatOutputW > 500 && !roomParams.hasAc && roomParams.roomType === 'closet') {
    issues.push({
      id: 'thermal-closet',
      severity: 'warning',
      category: 'thermal',
      title: 'Closet placement with significant heat output',
      detail: `Closets have poor natural ventilation. ${heatOutputW}W in an enclosed space will overheat quickly.`,
    });
  }

  if (heatOutputW > 1000 && roomParams.roomType === 'bedroom') {
    issues.push({
      id: 'thermal-bedroom',
      severity: 'info',
      category: 'thermal',
      title: 'Rack will noticeably warm the bedroom',
      detail: `${heatOutputW}W is like running a space heater on low. Expect elevated room temperature, especially in summer.`,
    });
  }

  // Noise checks
  const noiseThreshold = NOISE_THRESHOLDS[roomParams.roomType];
  if (estimatedNoiseDb > noiseThreshold + 10) {
    issues.push({
      id: 'noise-high',
      severity: 'warning',
      category: 'noise',
      title: `Noise level is very high for a ${roomParams.roomType}`,
      detail: `Estimated ${estimatedNoiseDb}dB exceeds comfortable threshold of ~${noiseThreshold}dB for ${roomParams.roomType}s.`,
    });
    recommendations.push('Consider fanless devices, noise-dampening panels, or relocating to a garage/basement.');
  } else if (estimatedNoiseDb > noiseThreshold) {
    issues.push({
      id: 'noise-elevated',
      severity: 'info',
      category: 'noise',
      title: `Noise level is elevated for a ${roomParams.roomType}`,
      detail: `Estimated ${estimatedNoiseDb}dB is above the ${noiseThreshold}dB typical threshold.`,
    });
  }

  // Access checks
  const hasRearDevices = layout.devices.some((d) => d.mountSide === 'rear');
  if (roomParams.rackPosition === 'against-wall' && hasRearDevices && clearances.rear > 300) {
    issues.push({
      id: 'access-wall',
      severity: 'info',
      category: 'access',
      title: 'Against-wall placement limits rear access',
      detail: 'Rear-mounted devices and cable management will be difficult to reach. Consider a pull-out rail kit or corner placement.',
    });
  }

  if (roomParams.rackPosition === 'corner' && (clearances.side > 200 || clearances.front > 500)) {
    issues.push({
      id: 'access-corner',
      severity: 'info',
      category: 'access',
      title: 'Corner placement limits side access',
      detail: 'Two sides are blocked by walls. Ensure the open sides face the primary work area.',
    });
  }

  // Rack-level weight vs limit
  if (weightKg > layout.weightLimitKg) {
    issues.push({
      id: 'rack-weight-exceeded',
      severity: 'critical',
      category: 'floor',
      title: 'Rack weight limit exceeded',
      detail: `Devices total ${weightKg.toFixed(1)}kg, above the rack's ${layout.weightLimitKg}kg rating.`,
    });
  }

  // Generate positive recommendations
  if (issues.length === 0) {
    recommendations.push('This rack configuration is well-suited for the selected room and placement.');
  }
  if (roomParams.hasAc && heatOutputW > 1000) {
    recommendations.push('With AC present, thermal management is adequate. Ensure cold air reaches the rack front intake.');
  }
  if (roomParams.floorType === 'concrete' && floorLoadingKgPerM2 < 400) {
    recommendations.push('Concrete floor easily supports this load. No additional spreading needed.');
  }
  if (roomParams.roomType === 'basement' && estimatedNoiseDb < 60) {
    recommendations.push('Basement placement is ideal for this noise level. Sound transmission to living areas will be minimal.');
  }

  // Suitability score: 100 base, deductions per issue severity
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 25;
    else if (issue.severity === 'warning') score -= 10;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    rackFootprint: { widthMm: rackWidthMm, depthMm: rackDepthMm, heightMm: rackHeightMm },
    totalWeightKg: weightKg,
    floorLoadingKgPerM2,
    minRoomWidthMm,
    minRoomDepthMm,
    requiredFrontClearanceMm: clearances.front,
    requiredRearClearanceMm: clearances.rear,
    requiredSideClearanceMm: clearances.side,
    heatOutputW,
    estimatedNoiseDb,
    issues,
    recommendations,
    score,
  };
}

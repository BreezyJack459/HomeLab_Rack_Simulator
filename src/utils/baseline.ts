import type { LayoutBaselineMetrics, RackGoldenBaseline, RackLayout, RackLayoutSnapshot } from '../types/rack';
import { calculateNoiseSummary } from './noiseCalc';
import { getDocumentationIssues } from './documentationAudit';
import { portTypeForCableType } from './portSelection';
import { occupiedUnits } from './rackMath';
import { validateRackLayout } from './validation';

type SnapshotLike = RackLayout | RackLayoutSnapshot;

export interface BaselineComparisonRow {
  key: keyof LayoutBaselineMetrics;
  label: string;
  current: number;
  baseline: number;
  delta: number;
  direction: 'better' | 'worse' | 'same';
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function countFreePorts(layout: SnapshotLike, type: 'ethernet' | 'fiber' | 'power') {
  const capacity = layout.devices.reduce((sum, device) => sum + (device.ports?.[type] ?? 0), 0);
  const used = layout.cables.reduce((sum, cable) => {
    const portType = portTypeForCableType(cable.type);
    if (portType !== type) return sum;
    return sum + (cable.fromPort?.type === type ? 1 : 0) + (cable.toPort?.type === type ? 1 : 0);
  }, 0);
  return Math.max(0, capacity - used);
}

function riskScore(layout: SnapshotLike) {
  return validateRackLayout(layout as RackLayout).reduce((score, issue) => {
    if (issue.severity === 'critical') return score + 5;
    if (issue.severity === 'warning') return score + 2;
    return score + 1;
  }, 0);
}

function documentationScore(layout: SnapshotLike) {
  const issues = getDocumentationIssues(layout as RackLayout);
  const penalty = issues.reduce((score, issue) => score + (issue.severity === 'warning' ? 12 : 5), 0);
  return Math.max(0, 100 - penalty);
}

export function createLayoutSnapshot(layout: RackLayout): RackLayoutSnapshot {
  return cloneSnapshot({
    name: layout.name,
    rackType: layout.rackType,
    heightU: layout.heightU,
    rackDepthMm: layout.rackDepthMm,
    weightLimitKg: layout.weightLimitKg,
    powerBudgetW: layout.powerBudgetW,
    viewSide: layout.viewSide,
    devices: layout.devices,
    cables: layout.cables,
    reservations: layout.reservations ?? [],
    rearClearanceMm: layout.rearClearanceMm,
    frontDoorClearanceMm: layout.frontDoorClearanceMm,
    rearDoorClearanceMm: layout.rearDoorClearanceMm,
    railMinDepthMm: layout.railMinDepthMm,
    railMaxDepthMm: layout.railMaxDepthMm,
    electricityRatePerKwh: layout.electricityRatePerKwh
  });
}

export function getBaselineMetrics(layout: SnapshotLike): LayoutBaselineMetrics {
  const occupiedU = occupiedUnits(layout.devices, layout.heightU).size;
  const reservedU = occupiedUnits(
    (layout.reservations ?? []).map((reservation) => ({
      id: reservation.id,
      positionU: reservation.positionU,
      sizeU: reservation.sizeU
    })) as RackLayout['devices'],
    layout.heightU
  ).size;

  return {
    deviceCount: layout.devices.length,
    cableCount: layout.cables.length,
    occupiedU,
    freeU: Math.max(0, layout.heightU - occupiedU),
    reservedU,
    powerW: layout.devices.reduce((sum, device) => sum + device.powerW, 0),
    heatScore: layout.devices.reduce((sum, device) => sum + device.heatLevel * Math.max(1, device.sizeU), 0),
    noiseDb: calculateNoiseSummary(layout as RackLayout).totalDb,
    freeNetworkPorts: countFreePorts(layout, 'ethernet') + countFreePorts(layout, 'fiber'),
    freePowerPorts: countFreePorts(layout, 'power'),
    validationIssues: validateRackLayout(layout as RackLayout).length,
    documentationIssues: getDocumentationIssues(layout as RackLayout).length,
    riskScore: riskScore(layout),
    documentationScore: documentationScore(layout)
  };
}

export function captureGoldenBaseline(layout: RackLayout, name = 'Golden baseline'): RackGoldenBaseline {
  const snapshot = createLayoutSnapshot(layout);
  return {
    name,
    capturedAt: new Date().toISOString(),
    snapshot,
    metrics: getBaselineMetrics(snapshot)
  };
}

export function getBaselineComparison(layout: RackLayout, baseline: RackGoldenBaseline): BaselineComparisonRow[] {
  const current = getBaselineMetrics(layout);
  const base = baseline.metrics;
  const rows: Array<{ key: keyof LayoutBaselineMetrics; label: string; lowerIsBetter?: boolean }> = [
    { key: 'powerW', label: 'Power draw', lowerIsBetter: true },
    { key: 'heatScore', label: 'Heat score', lowerIsBetter: true },
    { key: 'noiseDb', label: 'Noise', lowerIsBetter: true },
    { key: 'freeU', label: 'Free U headroom' },
    { key: 'freeNetworkPorts', label: 'Free network ports' },
    { key: 'freePowerPorts', label: 'Free power ports' },
    { key: 'cableCount', label: 'Cable count', lowerIsBetter: true },
    { key: 'validationIssues', label: 'Validation issues', lowerIsBetter: true },
    { key: 'riskScore', label: 'Risk score', lowerIsBetter: true },
    { key: 'documentationScore', label: 'Documentation score' }
  ];

  return rows.map(({ key, label, lowerIsBetter }) => {
    const delta = current[key] - base[key];
    const direction = delta === 0 ? 'same' : lowerIsBetter ? (delta < 0 ? 'better' : 'worse') : (delta > 0 ? 'better' : 'worse');
    return {
      key,
      label,
      current: current[key],
      baseline: base[key],
      delta,
      direction
    };
  });
}

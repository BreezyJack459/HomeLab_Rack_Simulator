import type { RackLayout } from '../types/rack';
import { deviceCatalog } from '../data/deviceCatalog';
import { getRackTotals } from './validation';
import { calculateNoiseSummary, suitabilityLabel } from './noiseCalc';

export type ForecastCategory =
  | 'space'
  | 'power'
  | 'weight'
  | 'switch-ports'
  | 'pdu-outlets'
  | 'heat'
  | 'noise'
  | 'cable-density';

export type ForecastStatus = 'good' | 'warning' | 'critical';

export interface CategoryForecast {
  category: ForecastCategory;
  label: string;
  current: number;
  max: number;
  unit: string;
  percentUsed: number;
  headroom: number;
  estimatedDevicesUntilExhaustion: number;
  status: ForecastStatus;
}

export interface CapacityForecast {
  categories: CategoryForecast[];
  nextBottleneck: ForecastCategory | null;
  overallStatus: ForecastStatus;
  recommendations: string[];
}

interface AverageDevice {
  sizeU: number;
  powerW: number;
  weightKg: number;
  heatLevel: number;
  noiseDb: number;
}

function getAverageDevice(): AverageDevice {
  const rackable = deviceCatalog.filter(
    (d) =>
      d.rackMountable !== false &&
      d.category !== 'blank' &&
      d.category !== 'cable-management' &&
      d.category !== 'printed-mount'
  );
  if (rackable.length === 0) {
    return { sizeU: 1, powerW: 50, weightKg: 3, heatLevel: 2, noiseDb: 35 };
  }
  const mid = Math.floor(rackable.length / 2);
  const sortedU = rackable.map((d) => d.defaultU).sort((a, b) => a - b);
  const sortedPower = rackable.map((d) => d.powerW).sort((a, b) => a - b);
  const sortedWeight = rackable.map((d) => d.weightKg).sort((a, b) => a - b);
  const sortedHeat = rackable.map((d) => d.heatLevel).sort((a, b) => a - b);

  return {
    sizeU: sortedU[mid] ?? 1,
    powerW: sortedPower[mid] ?? 50,
    weightKg: sortedWeight[mid] ?? 3,
    heatLevel: sortedHeat[mid] ?? 2,
    noiseDb: 35,
  };
}

function countSwitchPorts(layout: RackLayout): { total: number; used: number } {
  const switches = layout.devices.filter((d) => d.category === 'switch');
  const total = switches.reduce(
    (sum, d) => sum + (d.ports?.ethernet ?? 0) + (d.ports?.fiber ?? 0),
    0
  );
  const used = layout.cables.filter(
    (c) => c.type === 'ethernet' || c.type === 'fiber'
  ).length;
  return { total, used };
}

function countPduOutlets(layout: RackLayout): { total: number; used: number } {
  const pdus = layout.devices.filter((d) => d.category === 'pdu' || d.category === 'pdu-0u');
  const total = pdus.reduce((sum, d) => sum + (d.ports?.power ?? 0), 0);
  const used = layout.cables.filter((c) => c.type === 'power').length;
  return { total, used };
}

function statusForPercent(percent: number): ForecastStatus {
  if (percent >= 95) return 'critical';
  if (percent >= 80) return 'warning';
  return 'good';
}

function makeForecast(
  category: ForecastCategory,
  label: string,
  current: number,
  max: number,
  unit: string,
  avgConsumption: number
): CategoryForecast {
  const clampedMax = Math.max(max, 0.001);
  const percentUsed = clampedMax > 0 ? Math.min((current / clampedMax) * 100, 100) : 0;
  const headroom = Math.max(max - current, 0);
  const estimatedDevicesUntilExhaustion =
    avgConsumption > 0 ? Math.floor(headroom / avgConsumption) : headroom > 0 ? 999 : 0;
  return {
    category,
    label,
    current: Math.round(current * 10) / 10,
    max: Math.round(max * 10) / 10,
    unit,
    percentUsed: Math.round(percentUsed * 10) / 10,
    headroom: Math.round(headroom * 10) / 10,
    estimatedDevicesUntilExhaustion,
    status: statusForPercent(percentUsed),
  };
}

export function analyzeCapacityForecast(layout: RackLayout): CapacityForecast {
  const totals = getRackTotals(layout);
  const avg = getAverageDevice();
  const noise = calculateNoiseSummary(layout);
  const switchPorts = countSwitchPorts(layout);
  const pduOutlets = countPduOutlets(layout);

  const categories: CategoryForecast[] = [];

  // Space
  const freeU = Math.max(layout.heightU - totals.occupiedU - totals.reservedU, 0);
  categories.push(
    makeForecast('space', 'Rack Space', totals.occupiedU + totals.reservedU, layout.heightU, 'U', avg.sizeU)
  );

  // Power
  categories.push(
    makeForecast('power', 'Power Budget', totals.powerW, layout.powerBudgetW, 'W', avg.powerW)
  );

  // Weight
  categories.push(
    makeForecast('weight', 'Weight Limit', totals.weightKg, layout.weightLimitKg, 'kg', avg.weightKg)
  );

  // Switch ports
  if (switchPorts.total > 0) {
    categories.push(
      makeForecast(
        'switch-ports',
        'Switch Ports',
        switchPorts.used,
        switchPorts.total,
        'ports',
        1
      )
    );
  }

  // PDU outlets
  if (pduOutlets.total > 0) {
    categories.push(
      makeForecast(
        'pdu-outlets',
        'PDU Outlets',
        pduOutlets.used,
        pduOutlets.total,
        'outlets',
        1
      )
    );
  }

  // Heat
  const heatPerU = layout.heightU > 0 ? totals.heatScore / layout.heightU : 0;
  const heatMax = layout.heightU * 3; // heuristic: 3 heat units per U is "full"
  categories.push(
    makeForecast('heat', 'Thermal Load', totals.heatScore, heatMax, 'pts', avg.heatLevel * avg.sizeU)
  );

  // Noise
  const noiseThresholds: Record<string, number> = {
    bedroom: 35,
    office: 45,
    closet: 55,
    garage: 70,
    basement: 80,
    unknown: 55,
  };
  const noiseLimit = noiseThresholds[noise.suitability] ?? 55;
  categories.push(
    makeForecast('noise', 'Noise Budget', noise.totalDb, noiseLimit, 'dB', avg.noiseDb)
  );

  // Cable density
  const cableDensityMax = Math.max(layout.heightU * 3, 10);
  categories.push(
    makeForecast(
      'cable-density',
      'Cable Density',
      layout.cables.length,
      cableDensityMax,
      'cables',
      1
    )
  );

  // Determine next bottleneck (lowest headroom in percent, or highest percent used)
  const sorted = [...categories].sort((a, b) => b.percentUsed - a.percentUsed);
  const nextBottleneck = sorted.length > 0 && sorted[0].percentUsed > 0 ? sorted[0].category : null;

  const overallStatus: ForecastStatus =
    categories.some((c) => c.status === 'critical')
      ? 'critical'
      : categories.some((c) => c.status === 'warning')
        ? 'warning'
        : 'good';

  const recommendations = generateRecommendations(categories, layout, freeU, noise);

  return {
    categories,
    nextBottleneck,
    overallStatus,
    recommendations,
  };
}

function generateRecommendations(
  categories: CategoryForecast[],
  layout: RackLayout,
  freeU: number,
  noise: ReturnType<typeof calculateNoiseSummary>
): string[] {
  const recs: string[] = [];
  const byCat = (cat: ForecastCategory) => categories.find((c) => c.category === cat);

  const space = byCat('space');
  const power = byCat('power');
  const weight = byCat('weight');
  const switchPorts = byCat('switch-ports');
  const pduOutlets = byCat('pdu-outlets');
  const heat = byCat('heat');
  const noiseCat = byCat('noise');
  const cableDensity = byCat('cable-density');

  if (space && space.status !== 'good' && freeU <= 2) {
    recs.push('Consider a taller rack or consolidating devices onto shared shelves.');
  }
  if (power && power.status !== 'good' && power.headroom < 200) {
    recs.push('Add a PDU circuit or upgrade UPS capacity before adding high-draw devices.');
  }
  if (weight && weight.status !== 'good') {
    recs.push('Mount heavy devices lower to improve stability and check floor loading.');
  }
  if (switchPorts && switchPorts.status !== 'good' && switchPorts.headroom < 4) {
    recs.push('Add a switch or use a higher-density model to free up ports.');
  }
  if (pduOutlets && pduOutlets.status !== 'good' && pduOutlets.headroom < 3) {
    recs.push('Add a PDU or use a higher-outlet model for future power needs.');
  }
  if (heat && heat.status !== 'good') {
    recs.push('Improve airflow with blanking panels, cable management, or active cooling.');
  }
  if (noiseCat && noiseCat.status !== 'good') {
    recs.push(`Current noise level (${noise.totalDb} dB) is approaching ${suitabilityLabel(noise.suitability)} limit. Consider fanless devices or acoustic treatment.`);
  }
  if (cableDensity && cableDensity.status !== 'good') {
    recs.push('Cable tray is getting dense. Add horizontal cable managers or re-route bundles.');
  }
  if (recs.length === 0) {
    recs.push('All capacity metrics look healthy. You have room to grow.');
  }

  return recs;
}

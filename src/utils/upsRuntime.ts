import type { RackLayout, PlacedDevice } from '../types/rack';
import { buildPowerChains, getUpsCapacityW } from './powerChain';

export interface UpsRuntimeInfo {
  device: PlacedDevice;
  loadW: number;
  capacityW: number | undefined;
  loadPercent: number;
  batteryWh: number;
  runtimeMinutes: number;
  runtimeLabel: string;
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

    results.push({
      device: root.device,
      loadW,
      capacityW,
      loadPercent: capacityW ? Math.min(100, (loadW / capacityW) * 100) : 0,
      batteryWh: root.device.batteryWh,
      runtimeMinutes,
      runtimeLabel: formatRuntime(runtimeMinutes),
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
    results.push({
      device,
      loadW: device.powerW,
      capacityW,
      loadPercent: capacityW ? Math.min(100, (device.powerW / capacityW) * 100) : 0,
      batteryWh: device.batteryWh,
      runtimeMinutes: calculateRuntimeMinutes(device.batteryWh, device.powerW),
      runtimeLabel: formatRuntime(calculateRuntimeMinutes(device.batteryWh, device.powerW)),
      status: runtimeStatus(calculateRuntimeMinutes(device.batteryWh, device.powerW)),
    });
  }

  return results;
}

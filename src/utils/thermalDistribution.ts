import type { PlacedDevice, ThermalZone } from '../types/rack';

const W_TO_BTU_H = 3.412;

export function wattsToBtuH(watts: number): number {
  return watts * W_TO_BTU_H;
}

export interface DeviceHeatEntry {
  deviceId: string;
  deviceName: string;
  startU: number;
  endU: number;
  powerW: number;
  btuH: number;
}

export function getDeviceHeatEntries(devices: PlacedDevice[]): DeviceHeatEntry[] {
  return devices
    .filter((d) => d.powerW && d.powerW > 0)
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      startU: d.positionU,
      endU: d.positionU + d.sizeU,
      powerW: d.powerW,
      btuH: wattsToBtuH(d.powerW),
    }))
    .sort((a, b) => b.btuH - a.btuH);
}

export interface UHeatEntry {
  u: number;
  totalPowerW: number;
  totalBtuH: number;
  deviceCount: number;
}

export function getHeatByU(devices: PlacedDevice[], heightU: number): UHeatEntry[] {
  const entries: UHeatEntry[] = [];
  for (let u = 0; u < heightU; u++) {
    let totalPowerW = 0;
    const seenDevices = new Set<string>();
    for (const d of devices) {
      if (!d.powerW || d.powerW <= 0) continue;
      const startU = d.positionU;
      const endU = startU + d.sizeU;
      if (u >= startU && u < endU) {
        totalPowerW += d.powerW;
        seenDevices.add(d.id);
      }
    }
    entries.push({
      u,
      totalPowerW,
      totalBtuH: wattsToBtuH(totalPowerW),
      deviceCount: seenDevices.size,
    });
  }
  return entries;
}

export interface HotSpot {
  u: number;
  powerW: number;
  btuH: number;
  deviceCount: number;
  severity: 'critical' | 'warning' | 'info';
}

export function findHotSpots(
  devices: PlacedDevice[],
  heightU: number,
  thresholdW: number = 300
): HotSpot[] {
  const byU = getHeatByU(devices, heightU);
  return byU
    .filter((e) => e.totalPowerW > 0)
    .map((e) => {
      const ratio = e.totalPowerW / thresholdW;
      const severity: HotSpot['severity'] =
        ratio >= 2 ? 'critical' : ratio >= 1 ? 'warning' : 'info';
      return {
        u: e.u,
        powerW: e.totalPowerW,
        btuH: e.totalBtuH,
        deviceCount: e.deviceCount,
        severity,
      };
    })
    .filter((h) => h.severity !== 'info')
    .sort((a, b) => b.powerW - a.powerW);
}

export function summarizeThermalDistribution(
  devices: PlacedDevice[],
  thermalZones: ThermalZone[]
) {
  const heatEntries = getDeviceHeatEntries(devices);
  const totalPowerW = heatEntries.reduce((sum, e) => sum + e.powerW, 0);
  const totalBtuH = wattsToBtuH(totalPowerW);
  const totalCoolingW = thermalZones.reduce(
    (sum, z) => sum + (z.coolingCapacityW ?? 0),
    0
  );
  const hottestDevice = heatEntries[0] ?? null;
  return {
    totalPowerW,
    totalBtuH,
    totalCoolingW,
    coolingDeficitW: Math.max(0, totalPowerW - totalCoolingW),
    deviceCount: heatEntries.length,
    hottestDevice,
  };
}

export function getZoneHeatLoad(
  zone: ThermalZone,
  devices: PlacedDevice[]
): { zonePowerW: number; zoneBtuH: number; deviceCount: number } {
  let zonePowerW = 0;
  const seen = new Set<string>();
  for (const d of devices) {
    if (!d.powerW || d.powerW <= 0) continue;
    const startU = d.positionU;
    const endU = startU + d.sizeU;
    if (startU < zone.endU && endU > zone.startU) {
      zonePowerW += d.powerW;
      seen.add(d.id);
    }
  }
  return { zonePowerW, zoneBtuH: wattsToBtuH(zonePowerW), deviceCount: seen.size };
}

export function exportThermalDistributionMarkdown(
  devices: PlacedDevice[],
  thermalZones: ThermalZone[],
  heightU: number
): string {
  const summary = summarizeThermalDistribution(devices, thermalZones);
  const hotspots = findHotSpots(devices, heightU);
  const lines: string[] = [
    '# Thermal Distribution Report',
    '',
    `**Total Heat Load:** ${summary.totalPowerW.toFixed(0)}W (${summary.totalBtuH.toFixed(0)} BTU/h)`,
    `**Cooling Capacity:** ${summary.totalCoolingW.toFixed(0)}W`,
    `**Deficit:** ${summary.coolingDeficitW.toFixed(0)}W`,
    `**Heating Devices:** ${summary.deviceCount}`,
    '',
  ];

  if (summary.hottestDevice) {
    lines.push(
      `**Hottest Device:** ${summary.hottestDevice.deviceName} — ${summary.hottestDevice.powerW}W`,
      ''
    );
  }

  if (thermalZones.length > 0) {
    lines.push('## Thermal Zones', '');
    for (const z of thermalZones) {
      const load = getZoneHeatLoad(z, devices);
      const status =
        z.coolingCapacityW && load.zonePowerW > z.coolingCapacityW
          ? '⚠️ OVER'
          : '✅ OK';
      lines.push(
        `### ${z.name} (U${z.startU}–U${z.endU - 1})`,
        `**Target:** ${z.targetTempC}°C · **Load:** ${load.zonePowerW.toFixed(0)}W · **Capacity:** ${z.coolingCapacityW?.toFixed(0) ?? '—'}W ${status}`,
        ''
      );
    }
  }

  if (hotspots.length > 0) {
    lines.push('## Hot Spots', '');
    for (const h of hotspots) {
      const icon = h.severity === 'critical' ? '🔴' : '🟡';
      lines.push(
        `${icon} **U${h.u}** — ${h.powerW.toFixed(0)}W (${h.btuH.toFixed(0)} BTU/h) · ${h.deviceCount} device(s)`
      );
    }
    lines.push('');
  }

  lines.push('---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}

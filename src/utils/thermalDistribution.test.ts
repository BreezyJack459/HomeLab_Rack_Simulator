import { describe, expect, it } from 'vitest';
import {
  exportThermalDistributionMarkdown,
  findHotSpots,
  getDeviceHeatEntries,
  getHeatByU,
  getZoneHeatLoad,
  summarizeThermalDistribution,
  wattsToBtuH,
} from './thermalDistribution';
import type { PlacedDevice, ThermalZone } from '../types/rack';

const devices: PlacedDevice[] = [
  { id: 'd1', name: 'Server A', templateId: 'srv', sizeU: 2, y: 10, powerW: 250 } as PlacedDevice,
  { id: 'd2', name: 'Switch B', templateId: 'sw', sizeU: 1, y: 12, powerW: 50 } as PlacedDevice,
  { id: 'd3', name: 'Blank', templateId: 'blank', sizeU: 1, y: 13, powerW: 0 } as PlacedDevice,
  { id: 'd4', name: 'Server C', templateId: 'srv', sizeU: 2, y: 10, powerW: 350 } as PlacedDevice,
];

const zones: ThermalZone[] = [
  { id: 'z1', name: 'Lower', startU: 0, endU: 20, targetTempC: 22, coolingCapacityW: 500 },
  { id: 'z2', name: 'Upper', startU: 20, endU: 42, targetTempC: 24, coolingCapacityW: 400 },
];

describe('wattsToBtuH', () => {
  it('converts watts to BTU/h', () => {
    expect(wattsToBtuH(100)).toBeCloseTo(341.2, 1);
  });
});

describe('getDeviceHeatEntries', () => {
  it('returns only powered devices sorted by heat', () => {
    const entries = getDeviceHeatEntries(devices);
    expect(entries.length).toBe(3);
    expect(entries[0].deviceName).toBe('Server C');
    expect(entries[0].powerW).toBe(350);
  });

  it('includes U range for each device', () => {
    const entries = getDeviceHeatEntries(devices);
    const serverA = entries.find((e) => e.deviceId === 'd1');
    expect(serverA?.startU).toBe(10);
    expect(serverA?.endU).toBe(12);
  });
});

describe('getHeatByU', () => {
  it('aggregates power per U position', () => {
    const byU = getHeatByU(devices, 15);
    const u10 = byU.find((e) => e.u === 10);
    expect(u10?.totalPowerW).toBe(600); // 250 + 350
    expect(u10?.deviceCount).toBe(2);
  });

  it('returns zero for empty U positions', () => {
    const byU = getHeatByU(devices, 15);
    const u0 = byU.find((e) => e.u === 0);
    expect(u0?.totalPowerW).toBe(0);
  });
});

describe('findHotSpots', () => {
  it('flags U positions exceeding threshold', () => {
    const hotspots = findHotSpots(devices, 15, 300);
    const u10 = hotspots.find((h) => h.u === 10);
    expect(u10).toBeDefined();
    expect(u10?.severity).toBe('critical');
  });

  it('returns empty when no devices exceed threshold', () => {
    const noPower: PlacedDevice[] = [
      { id: 'd', name: 'Blank', templateId: 'blank', sizeU: 1, y: 0, powerW: 0 } as PlacedDevice,
    ];
    const hotspots = findHotSpots(noPower, 5, 300);
    expect(hotspots.length).toBe(0);
  });
});

describe('summarizeThermalDistribution', () => {
  it('calculates total power and BTU/h', () => {
    const s = summarizeThermalDistribution(devices, zones);
    expect(s.totalPowerW).toBe(650); // 250 + 50 + 350
    expect(s.totalBtuH).toBeCloseTo(650 * 3.412, 1);
  });

  it('calculates cooling deficit', () => {
    const s = summarizeThermalDistribution(devices, zones);
    expect(s.totalCoolingW).toBe(900); // 500 + 400
    expect(s.coolingDeficitW).toBe(0); // 650 < 900
  });

  it('identifies hottest device', () => {
    const s = summarizeThermalDistribution(devices, zones);
    expect(s.hottestDevice?.deviceName).toBe('Server C');
  });
});

describe('getZoneHeatLoad', () => {
  it('calculates heat load for a zone', () => {
    const load = getZoneHeatLoad(zones[0], devices);
    expect(load.zonePowerW).toBe(650); // all devices at U10-13
    expect(load.deviceCount).toBe(3);
  });

  it('returns zero for non-overlapping zone', () => {
    const emptyZone: ThermalZone = { id: 'z', name: 'Empty', startU: 0, endU: 5, targetTempC: 20 };
    const load = getZoneHeatLoad(emptyZone, devices);
    expect(load.zonePowerW).toBe(0);
  });
});

describe('exportThermalDistributionMarkdown', () => {
  it('includes header and summary', () => {
    const md = exportThermalDistributionMarkdown(devices, zones, 15);
    expect(md).toContain('Thermal Distribution Report');
    expect(md).toContain('Total Heat Load:');
  });

  it('includes thermal zones', () => {
    const md = exportThermalDistributionMarkdown(devices, zones, 15);
    expect(md).toContain('Lower');
    expect(md).toContain('Upper');
  });

  it('includes hot spots when present', () => {
    const md = exportThermalDistributionMarkdown(devices, zones, 15);
    expect(md).toContain('Hot Spots');
  });
});

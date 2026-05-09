import type { RackLayout } from '../types/rack';

export interface NoiseSummary {
  totalDb: number;
  maxDeviceDb: number;
  loudestDeviceName: string;
  deviceCountWithNoise: number;
  suitability: 'bedroom' | 'office' | 'closet' | 'garage' | 'basement' | 'unknown';
}

const DEFAULT_NOISE_DB: Record<string, number> = {
  server: 55,
  switch: 48,
  router: 35,
  firewall: 35,
  nas: 38,
  pdu: 0,
  'pdu-0u': 0,
  ups: 40,
  shelf: 0,
  blank: 0,
  'cable-management': 0,
  'patch-panel': 0,
  'access-point': 25,
  modem: 28,
  'mini-pc': 32,
  sbc: 28,
  'poe-injector': 25,
  'ip-kvm': 30,
};

function getDeviceNoiseDb(device: RackLayout['devices'][number]): number {
  if (device.noiseDb !== undefined) return device.noiseDb;
  return DEFAULT_NOISE_DB[device.category] ?? 35;
}

function combineDb(levels: number[]): number {
  if (levels.length === 0) return 0;
  const sumPower = levels.reduce((sum, db) => sum + Math.pow(10, db / 10), 0);
  return 10 * Math.log10(sumPower);
}

export function calculateNoiseSummary(layout: RackLayout): NoiseSummary {
  const devicesWithNoise = layout.devices
    .map((d) => ({ name: d.name, db: getDeviceNoiseDb(d) }))
    .filter((d) => d.db > 0);

  const totalDb = combineDb(devicesWithNoise.map((d) => d.db));
  const maxDevice = devicesWithNoise.reduce(
    (max, d) => (d.db > max.db ? d : max),
    { name: '', db: 0 }
  );

  let suitability: NoiseSummary['suitability'] = 'unknown';
  if (totalDb <= 0) suitability = 'unknown';
  else if (totalDb <= 35) suitability = 'bedroom';
  else if (totalDb <= 45) suitability = 'office';
  else if (totalDb <= 55) suitability = 'closet';
  else if (totalDb <= 70) suitability = 'garage';
  else suitability = 'basement';

  return {
    totalDb: Math.round(totalDb * 10) / 10,
    maxDeviceDb: Math.round(maxDevice.db * 10) / 10,
    loudestDeviceName: maxDevice.name,
    deviceCountWithNoise: devicesWithNoise.length,
    suitability,
  };
}

export function suitabilityLabel(suitability: NoiseSummary['suitability']): string {
  const labels: Record<string, string> = {
    bedroom: 'Suitable for bedroom',
    office: 'Suitable for office',
    closet: 'Suitable for closet',
    garage: 'Suitable for garage',
    basement: 'Basement only',
    unknown: 'No noise data',
  };
  return labels[suitability] ?? 'Unknown';
}

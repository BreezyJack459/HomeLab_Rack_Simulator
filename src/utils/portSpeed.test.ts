import { describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice } from '../types/rack';
import {
  exportPortSpeedMarkdown,
  findSpeedMismatches,
  getCableSpeedEntries,
  getDevicePortSpeeds,
  summarizePortSpeeds,
} from './portSpeed';

const devices: PlacedDevice[] = [
  {
    id: 'd1',
    name: 'Switch',
    category: 'switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 200,
    widthType: '19in',
    weightKg: 2,
    powerW: 20,
    heatLevel: 2,
    color: '#333',
    portLayouts: {
      front: [
        { type: 'ethernet', count: 8, speed: '1G', mediaType: 'rj45' },
        { type: 'fiber', count: 2, speed: '10G', mediaType: 'sfp+' },
      ],
    },
  },
  {
    id: 'd2',
    name: 'Router',
    category: 'router',
    positionU: 2,
    sizeU: 1,
    depthMm: 200,
    widthType: '19in',
    weightKg: 2,
    powerW: 15,
    heatLevel: 2,
    color: '#555',
    portLayouts: {
      front: [
        { type: 'ethernet', count: 4, speed: '1G', mediaType: 'rj45' },
      ],
    },
  },
];

const cables: CableRoute[] = [
  {
    id: 'c1',
    fromDeviceId: 'd1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'd2',
    toPort: { type: 'ethernet', index: 0 },
    type: 'ethernet',
    color: '#00f',
    speed: '1G',
    mediaType: 'rj45',
  },
  {
    id: 'c2',
    fromDeviceId: 'd1',
    fromPort: { type: 'fiber', index: 0 },
    toDeviceId: 'd2',
    toPort: { type: 'ethernet', index: 1 },
    type: 'fiber',
    color: '#f00',
    speed: '10G',
    mediaType: 'sfp+',
  },
];

describe('getDevicePortSpeeds', () => {
  it('collects port speed entries from devices', () => {
    const entries = getDevicePortSpeeds(devices);
    expect(entries.length).toBe(3);
    expect(entries.some((e) => e.speed === '1G' && e.count === 8)).toBe(true);
    expect(entries.some((e) => e.speed === '10G' && e.mediaType === 'sfp+')).toBe(true);
  });

  it('returns empty for devices without portLayouts', () => {
    const entries = getDevicePortSpeeds([{ ...devices[0], portLayouts: undefined }]);
    expect(entries.length).toBe(0);
  });
});

describe('getCableSpeedEntries', () => {
  it('maps cables with device names', () => {
    const entries = getCableSpeedEntries(cables, devices);
    expect(entries.length).toBe(2);
    expect(entries[0].fromDevice).toBe('Switch');
    expect(entries[0].speed).toBe('1G');
  });
});

describe('findSpeedMismatches', () => {
  it('finds cable-to-port speed mismatch', () => {
    const badCables: CableRoute[] = [
      {
        ...cables[0],
        speed: '10G',
      },
    ];
    const issues = findSpeedMismatches(badCables, devices);
    expect(issues.some((i) => i.title.includes('Cable speed mismatch'))).toBe(true);
  });

  it('passes when cable speed matches port speed', () => {
    const issues = findSpeedMismatches(cables, devices);
    const cableMismatches = issues.filter((i) => i.title.includes('Cable speed'));
    expect(cableMismatches.length).toBe(0);
  });

  it('returns empty when no cables have ports', () => {
    const noPortCables: CableRoute[] = [
      { id: 'c3', fromDeviceId: 'd1', toDeviceId: 'd2', type: 'ethernet', color: '#00f' },
    ];
    const issues = findSpeedMismatches(noPortCables, devices);
    expect(issues.length).toBe(0);
  });
});

describe('summarizePortSpeeds', () => {
  it('summarizes counts', () => {
    const summary = summarizePortSpeeds(devices, cables);
    expect(summary.totalPorts).toBe(14); // 8 + 2 + 4
    expect(summary.portsWithSpeed).toBe(14);
    expect(summary.totalCables).toBe(2);
    expect(summary.cablesWithSpeed).toBe(2);
    expect(summary.speedCounts['1G']).toBe(12);
    expect(summary.speedCounts['10G']).toBe(2);
  });
});

describe('exportPortSpeedMarkdown', () => {
  it('includes device ports and cables', () => {
    const md = exportPortSpeedMarkdown(devices, cables);
    expect(md).toContain('Port Speed / Media Type Report');
    expect(md).toContain('Switch');
    expect(md).toContain('1G');
    expect(md).toContain('sfp+');
  });
});

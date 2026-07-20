import { describe, expect, it } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import { getDeviceWorldBox } from './rackGeometry';

const baseDevice: PlacedDevice = {
  id: 'device-1',
  templateId: 'device-template',
  name: 'Test device',
  category: 'server',
  positionU: 1,
  sizeU: 1,
  depthMm: 400,
  widthType: '19in',
  weightKg: 8,
  powerW: 120,
  heatLevel: 3,
  color: '#334155'
};

describe('getDeviceWorldBox', () => {
  it('preserves oversize depth beyond the rack body for 3D inspection', () => {
    const box = getDeviceWorldBox(
      { rackType: '19in', rackDepthMm: 600 },
      { ...baseDevice, depthMm: 900 },
      { rackWidth: 3.72, rackDepth: 2.8, rackHeight: 3.24, bottom: -1.62 }
    );

    expect(box.depth).toBeCloseTo(4.2, 5);
  });

  it('keeps standard devices proportional to rack depth', () => {
    const box = getDeviceWorldBox(
      { rackType: '19in', rackDepthMm: 600 },
      { ...baseDevice, depthMm: 300 },
      { rackWidth: 3.72, rackDepth: 2.8, rackHeight: 3.24, bottom: -1.62 }
    );

    expect(box.depth).toBeCloseTo(1.4, 5);
  });

  it('falls back to a default depth when depthMm is missing instead of producing NaN', () => {
    const box = getDeviceWorldBox(
      { rackType: '19in', rackDepthMm: 600 },
      { ...baseDevice, depthMm: undefined as unknown as number },
      { rackWidth: 3.72, rackDepth: 2.8, rackHeight: 3.24, bottom: -1.62 }
    );

    expect(Number.isNaN(box.depth)).toBe(false);
    // DEFAULT_DEVICE_DEPTH_MM (200) at depthScale 2.8 / 600
    expect(box.depth).toBeCloseTo((200 * 2.8) / 600, 5);
  });
});

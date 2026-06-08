import { describe, it, expect } from 'vitest';
import type { PlacedDevice, SparePart } from '../types/rack';
import {
  summarizeSpareParts,
  findCompatibleParts,
  exportSparePartsCsv,
  exportSparePartsMarkdown,
} from './spareParts';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    name: 'Test Device',
    category: 'server',
    positionU: 1,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 5,
    powerW: 100,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

describe('summarizeSpareParts', () => {
  it('returns zeros for empty parts', () => {
    const s = summarizeSpareParts([], []);
    expect(s.totalParts).toBe(0);
    expect(s.totalQuantity).toBe(0);
  });

  it('counts parts and quantities', () => {
    const parts: SparePart[] = [
      { id: 's1', name: 'PSU', category: 'power', quantity: 2, condition: 'new' },
      { id: 's2', name: 'Drive', category: 'storage', quantity: 3, condition: 'used' },
    ];
    const s = summarizeSpareParts(parts, []);
    expect(s.totalParts).toBe(2);
    expect(s.totalQuantity).toBe(5);
    expect(s.byCondition.new).toBe(2);
    expect(s.byCondition.used).toBe(3);
    expect(s.byCategory.power).toBe(2);
    expect(s.byCategory.storage).toBe(3);
  });

  it('detects orphaned compatible parts', () => {
    const parts: SparePart[] = [
      { id: 's1', name: 'PSU', category: 'power', quantity: 1, condition: 'new', compatibleDeviceIds: ['missing-id'] },
    ];
    const s = summarizeSpareParts(parts, []);
    expect(s.missingCompatibleDevices).toBe(1);
  });

  it('does not count matched compatible parts as orphaned', () => {
    const parts: SparePart[] = [
      { id: 's1', name: 'PSU', category: 'power', quantity: 1, condition: 'new', compatibleDeviceIds: ['dev-1'] },
    ];
    const devices: PlacedDevice[] = [makeDevice()];
    const s = summarizeSpareParts(parts, devices);
    expect(s.missingCompatibleDevices).toBe(0);
  });
});

describe('findCompatibleParts', () => {
  it('returns empty for no parts', () => {
    expect(findCompatibleParts([], [])).toEqual([]);
  });

  it('finds compatible parts for devices', () => {
    const parts: SparePart[] = [
      { id: 's1', name: 'PSU', category: 'power', quantity: 1, condition: 'new', compatibleDeviceIds: ['dev-1'] },
    ];
    const devices: PlacedDevice[] = [makeDevice()];
    const result = findCompatibleParts(parts, devices);
    expect(result).toHaveLength(1);
    expect(result[0].deviceName).toBe('Test Device');
  });
});

describe('exportSparePartsCsv', () => {
  it('produces header', () => {
    const csv = exportSparePartsCsv([]);
    expect(csv).toContain('Name,Category,Quantity');
  });

  it('includes parts', () => {
    const parts: SparePart[] = [
      { id: 's1', name: 'PSU', category: 'power', quantity: 2, condition: 'new', storageLocation: 'Bin A' },
    ];
    const csv = exportSparePartsCsv(parts);
    expect(csv).toContain('PSU');
    expect(csv).toContain('power');
    expect(csv).toContain('Bin A');
  });
});

describe('exportSparePartsMarkdown', () => {
  it('includes summary', () => {
    const md = exportSparePartsMarkdown([], []);
    expect(md).toContain('# Spare Parts Inventory');
    expect(md).toContain('**Total Parts:** 0');
  });

  it('includes compatible parts section', () => {
    const parts: SparePart[] = [
      { id: 's1', name: 'PSU', category: 'power', quantity: 1, condition: 'new', compatibleDeviceIds: ['dev-1'] },
    ];
    const devices: PlacedDevice[] = [makeDevice()];
    const md = exportSparePartsMarkdown(parts, devices);
    expect(md).toContain('## Compatible With Rack Devices');
    expect(md).toContain('PSU → Test Device');
  });
});

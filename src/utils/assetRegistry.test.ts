import { describe, it, expect } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import {
  summarizeAssets,
  devicesMissingAssets,
  exportAssetRegistryCsv,
  exportAssetRegistryMarkdown,
} from './assetRegistry';

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

describe('summarizeAssets', () => {
  it('returns zeros for empty devices', () => {
    const s = summarizeAssets([]);
    expect(s.totalDevices).toBe(0);
    expect(s.completeCount).toBe(0);
    expect(s.totalPurchaseValue).toBe(0);
  });

  it('counts fields correctly for complete device', () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const devices: PlacedDevice[] = [
      makeDevice({
        assetTag: 'ASSET-001',
        serialNumber: 'SN123',
        purchaseDate: '2024-01-15',
        vendor: 'Dell',
        purchasePrice: 1200,
        warrantyEndDate: future,
        invoiceRef: 'INV-001',
      }),
    ];
    const s = summarizeAssets(devices);
    expect(s.withAssetTag).toBe(1);
    expect(s.withSerialNumber).toBe(1);
    expect(s.withPurchaseDate).toBe(1);
    expect(s.withVendor).toBe(1);
    expect(s.withPurchasePrice).toBe(1);
    expect(s.withWarrantyEndDate).toBe(1);
    expect(s.withInvoiceRef).toBe(1);
    expect(s.completeCount).toBe(1);
    expect(s.totalPurchaseValue).toBe(1200);
    expect(s.expiredWarrantyCount).toBe(0);
    expect(s.expiringSoonCount).toBe(0);
  });

  it('counts incomplete device', () => {
    const devices: PlacedDevice[] = [makeDevice()];
    const s = summarizeAssets(devices);
    expect(s.withAssetTag).toBe(0);
    expect(s.completeCount).toBe(0);
    expect(s.incompleteCount).toBe(1);
  });

  it('detects expired warranty', () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const devices: PlacedDevice[] = [
      makeDevice({ warrantyEndDate: past }),
    ];
    const s = summarizeAssets(devices);
    expect(s.expiredWarrantyCount).toBe(1);
    expect(s.expiringSoonCount).toBe(0);
  });

  it('detects expiring soon warranty', () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const devices: PlacedDevice[] = [
      makeDevice({ warrantyEndDate: soon }),
    ];
    const s = summarizeAssets(devices);
    expect(s.expiredWarrantyCount).toBe(0);
    expect(s.expiringSoonCount).toBe(1);
  });

  it('handles NaN purchase price', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ purchasePrice: Number.NaN }),
    ];
    const s = summarizeAssets(devices);
    expect(s.withPurchasePrice).toBe(0);
  });

  it('sums total purchase value', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ purchasePrice: 100 }),
      makeDevice({ purchasePrice: 250 }),
      makeDevice(),
    ];
    const s = summarizeAssets(devices);
    expect(s.totalPurchaseValue).toBe(350);
  });
});

describe('devicesMissingAssets', () => {
  it('returns empty for complete device', () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const devices: PlacedDevice[] = [
      makeDevice({
        assetTag: 'AT1',
        serialNumber: 'SN1',
        purchaseDate: '2024-01-01',
        vendor: 'Vendor',
        purchasePrice: 100,
        warrantyEndDate: future,
      }),
    ];
    expect(devicesMissingAssets(devices)).toEqual([]);
  });

  it('lists missing fields', () => {
    const devices: PlacedDevice[] = [makeDevice({ name: 'Partial Device' })];
    const missing = devicesMissingAssets(devices);
    expect(missing).toHaveLength(1);
    expect(missing[0].deviceName).toBe('Partial Device');
    expect(missing[0].missingFields).toContain('asset tag');
    expect(missing[0].missingFields).toContain('serial number');
  });
});

describe('exportAssetRegistryCsv', () => {
  it('produces header row', () => {
    const csv = exportAssetRegistryCsv([]);
    expect(csv).toContain('Device Name,Category,Asset Tag');
  });

  it('escapes commas and quotes', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ name: 'Device, with comma', vendor: 'Vendor "quoted"' }),
    ];
    const csv = exportAssetRegistryCsv(devices);
    expect(csv).toContain('"Device, with comma"');
    expect(csv).toContain('"Vendor ""quoted"""');
  });

  it('includes device data', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        name: 'Server',
        category: 'server',
        assetTag: 'AT-01',
        serialNumber: 'SN-01',
        purchasePrice: 500,
        positionU: 5,
      }),
    ];
    const csv = exportAssetRegistryCsv(devices);
    const rows = csv.split('\n');
    expect(rows[1]).toContain('Server');
    expect(rows[1]).toContain('AT-01');
    expect(rows[1]).toContain('500');
  });
});

describe('exportAssetRegistryMarkdown', () => {
  it('includes summary section', () => {
    const md = exportAssetRegistryMarkdown([]);
    expect(md).toContain('# Asset Registry Report');
    expect(md).toContain('**Total Devices:** 0');
  });

  it('includes device table', () => {
    const devices: PlacedDevice[] = [
      makeDevice({ name: 'NAS', category: 'nas', assetTag: 'AT-02', purchasePrice: 800 }),
    ];
    const md = exportAssetRegistryMarkdown(devices);
    expect(md).toContain('| NAS | nas | AT-02');
    expect(md).toContain('$800.00');
  });

  it('includes missing assets section', () => {
    const devices: PlacedDevice[] = [makeDevice({ name: 'Incomplete' })];
    const md = exportAssetRegistryMarkdown(devices);
    expect(md).toContain('## Missing Asset Information');
    expect(md).toContain('Incomplete');
  });
});

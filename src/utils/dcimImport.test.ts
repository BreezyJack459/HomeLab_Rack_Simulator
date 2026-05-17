import { describe, expect, it } from 'vitest';
import {
  importDcimDevices,
  matchToTemplate,
  parseGenericCsv,
  parseNetboxJson,
  summarizeImport,
} from './dcimImport';
import { deviceCatalog } from '../data/deviceCatalog';

describe('parseNetboxJson', () => {
  it('parses NetBox device list', () => {
    const json = JSON.stringify([
      {
        name: 'Core-SW-01',
        device_type: { model: '24-port switch', manufacturer: { name: 'Ubiquiti' }, u_height: 1 },
        position: 5,
        face: { value: 'front' },
        serial: 'ABC123',
      },
    ]);
    const devices = parseNetboxJson(json);
    expect(devices.length).toBe(1);
    expect(devices[0].name).toBe('Core-SW-01');
    expect(devices[0].deviceType).toBe('24-port switch');
    expect(devices[0].positionU).toBe(5);
    expect(devices[0].serial).toBe('ABC123');
  });

  it('parses NetBox paginated response', () => {
    const json = JSON.stringify({
      results: [
        { name: 'Server-01', device_type: { model: '2U server' }, position: 10 },
      ],
    });
    const devices = parseNetboxJson(json);
    expect(devices.length).toBe(1);
    expect(devices[0].name).toBe('Server-01');
  });

  it('returns empty on invalid JSON', () => {
    const devices = parseNetboxJson('not json');
    expect(devices.length).toBe(0);
  });
});

describe('parseGenericCsv', () => {
  it('parses CSV with standard headers', () => {
    const csv = 'name,type,position,height_u,power_w\nRouter-01,Router,1,1,25\nNAS-01,NAS,2,2,80';
    const devices = parseGenericCsv(csv);
    expect(devices.length).toBe(2);
    expect(devices[0].name).toBe('Router-01');
    expect(devices[0].positionU).toBe(1);
    expect(devices[0].powerW).toBe(25);
  });

  it('handles quoted values', () => {
    const csv = '"name","type","position"\n"My Server","2U Server",5';
    const devices = parseGenericCsv(csv);
    expect(devices.length).toBe(1);
    expect(devices[0].name).toBe('My Server');
  });

  it('returns empty for single line', () => {
    const devices = parseGenericCsv('name,type');
    expect(devices.length).toBe(0);
  });
});

describe('matchToTemplate', () => {
  it('matches switch by type name', () => {
    const dcim = { name: 'SW-01', deviceType: '24-port switch', heightU: 1 };
    const tmpl = matchToTemplate(dcim, deviceCatalog);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.category).toBe('switch');
  });

  it('returns null for unknown device', () => {
    const dcim = { name: 'Unknown', deviceType: 'mystery-box-9000' };
    const tmpl = matchToTemplate(dcim, deviceCatalog);
    expect(tmpl).toBeNull();
  });

  it('matches server by type', () => {
    const dcim = { name: 'SRV-01', deviceType: '2U server', heightU: 2 };
    const tmpl = matchToTemplate(dcim, deviceCatalog);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.category).toBe('server');
  });
});

describe('importDcimDevices', () => {
  it('imports NetBox JSON and creates placed devices', () => {
    const json = JSON.stringify([
      {
        name: 'Patch-01',
        device_type: { model: '24-port patch panel', u_height: 1 },
        position: 1,
      },
    ]);
    const result = importDcimDevices(json, 'netbox-json');
    expect(result.devices.length).toBe(1);
    expect(result.placedDevices.length).toBeGreaterThan(0);
    expect(result.placedDevices[0].name).toBe('Patch-01');
    expect(result.placedDevices[0].positionU).toBe(1);
  });

  it('tracks unmatched devices', () => {
    const csv = 'name,type,position\nUnknownDevice,mystery-box-9000,1';
    const result = importDcimDevices(csv, 'generic-csv');
    expect(result.unmatched.length).toBe(1);
    expect(result.placedDevices.length).toBe(0);
  });
});

describe('summarizeImport', () => {
  it('calculates import totals', () => {
    const result = importDcimDevices(
      'name,type,position,height_u,power_w,weight_kg\nSwitch,24-port switch,1,1,25,2.5\nServer,2U server,2,2,150,12',
      'generic-csv'
    );
    const summary = summarizeImport(result);
    expect(summary.total).toBe(2);
    expect(summary.matched).toBeGreaterThan(0);
    expect(summary.totalPowerW).toBeGreaterThan(0);
    expect(summary.totalWeightKg).toBeGreaterThan(0);
    expect(summary.totalU).toBeGreaterThan(0);
  });
});

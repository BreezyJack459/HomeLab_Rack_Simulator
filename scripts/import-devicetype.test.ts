import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  convertNetBoxDeviceType,
  vendorImageUrls,
  downloadElevationImage,
  importNetBoxDeviceType
} from './import-devicetype.js';

describe('convertNetBoxDeviceType', () => {
  it('maps network interfaces to ethernet/fiber groups with speed and media', () => {
    const result = convertNetBoxDeviceType({
      manufacturer: 'Cisco',
      model: 'C9200-24P Switch',
      slug: 'c9200-24p',
      u_height: 1,
      is_full_depth: true,
      front_image: true,
      rear_image: false,
      interfaces: [
        { name: 'GigabitEthernet1/0/1', type: '1000base-t' },
        { name: 'GigabitEthernet1/0/2', type: '1000base-t' },
        { name: 'TenGigabitEthernet1/1/1', type: '10gbase-x-sfpp' }
      ],
      'power-ports': [{ name: 'PS1', type: 'iec-60320-c14' }]
    });

    expect(result.vendor).toBe('Cisco');
    expect(result.model).toBe('C9200-24P Switch');
    expect(result.slug).toBe('c9200-24p');
    expect(result.category).toBe('switch');
    expect(result.defaultU).toBe(1);
    expect(result.isFullDepth).toBe(true);
    expect(result.faceplates.front).toBe('/faceplates/cisco/c9200-24p.front.png');
    expect(result.faceplates.rear).toBeUndefined();

    const ethernet = result.ports.find((p) => p.type === 'ethernet');
    expect(ethernet).toBeDefined();
    expect(ethernet?.count).toBe(2);
    expect(ethernet?.speed).toBe('1G');
    expect(ethernet?.mediaType).toBe('rj45');

    const fiber = result.ports.find((p) => p.type === 'fiber');
    expect(fiber).toBeDefined();
    expect(fiber?.count).toBe(1);
    expect(fiber?.speed).toBe('10G');
    expect(fiber?.mediaType).toBe('sfp+');

    const power = result.ports.find((p) => p.type === 'power');
    expect(power).toBeDefined();
    expect(power?.count).toBe(1);

    expect(result.portLayouts.front?.length).toBeGreaterThan(0);
  });

  it('warns about unknown interface types and still converts known ones', () => {
    const result = convertNetBoxDeviceType({
      manufacturer: 'Generic',
      model: 'Mystery Box',
      slug: 'mystery-box',
      u_height: 1,
      interfaces: [
        { name: 'eth0', type: '1000base-t' },
        { name: 'weird0', type: 'unsupported-weird-port' }
      ]
    });

    expect(result.ports).toHaveLength(1);
    expect(result.ports[0].type).toBe('ethernet');
    expect(result.warnings.some((w) => w.includes('unsupported-weird-port'))).toBe(true);
  });

  it('defaults to custom category and clamps u-height to at least 1', () => {
    const result = convertNetBoxDeviceType({
      manufacturer: 'NoName',
      model: 'Thing',
      slug: 'thing',
      u_height: 0
    });

    expect(result.category).toBe('custom');
    expect(result.defaultU).toBe(1);
  });

  it('converts weight to kg when unit is lb', () => {
    const result = convertNetBoxDeviceType({
      manufacturer: 'HeavyCo',
      model: 'Heavy Server',
      slug: 'heavy-server',
      u_height: 2,
      weight: 22,
      weight_unit: 'lb'
    });

    expect(result.weightKg).toBeCloseTo(9.979);
  });

  it('uses vendorDir override for vendor name and faceplate paths when provided', () => {
    const result = convertNetBoxDeviceType(
      {
        manufacturer: 'Cisco',
        model: 'C9200-24P Switch',
        slug: 'c9200-24p',
        u_height: 1,
        front_image: true,
        rear_image: true
      },
      'cisco-systems'
    );

    expect(result.vendor).toBe('cisco-systems');
    expect(result.faceplates.front).toBe('/faceplates/cisco-systems/c9200-24p.front.png');
    expect(result.faceplates.rear).toBe('/faceplates/cisco-systems/c9200-24p.rear.png');
  });
});

describe('vendorImageUrls', () => {
  it('normalizes vendor name and returns png and jpg candidates', () => {
    const urls = vendorImageUrls('Cisco Systems', 'c9200-24p', 'front');
    expect(urls).toEqual([
      'https://raw.githubusercontent.com/netbox-community/devicetype-library/master/elevation-images/cisco-systems/c9200-24p.front.png',
      'https://raw.githubusercontent.com/netbox-community/devicetype-library/master/elevation-images/cisco-systems/c9200-24p.front.jpg'
    ]);
  });
});

describe('downloadElevationImage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'faceplates-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('downloads a PNG and returns the public path', async () => {
    const fetchImpl = async (): Promise<Response> =>
      ({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new ArrayBuffer(4)
      }) as unknown as Response;

    const result = await downloadElevationImage('Cisco', 'c9200-24p', 'front', tempDir, fetchImpl);
    expect(result).toBe('/faceplates/cisco/c9200-24p.front.png');

    const written = await fs.readFile(path.join(tempDir, 'cisco', 'c9200-24p.front.png'));
    expect(written).toBeDefined();
  });

  it('falls back to jpg when png returns non-ok', async () => {
    let callCount = 0;
    const fetchImpl = async (): Promise<Response> => {
      callCount += 1;
      if (callCount === 1) {
        return { ok: false, status: 404 } as unknown as Response;
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new ArrayBuffer(4)
      } as unknown as Response;
    };

    const result = await downloadElevationImage('Cisco', 'c9200-24p', 'rear', tempDir, fetchImpl);
    expect(result).toBe('/faceplates/cisco/c9200-24p.rear.jpg');
    expect(callCount).toBe(2);
  });

  it('returns undefined when both candidates fail', async () => {
    const fetchImpl = async (): Promise<Response> => ({ ok: false, status: 404 } as unknown as Response);
    const result = await downloadElevationImage('Cisco', 'missing', 'front', tempDir, fetchImpl);
    expect(result).toBeUndefined();
  });

  it('sanitizes slugs to prevent path traversal', async () => {
    const fetchImpl = async (): Promise<Response> =>
      ({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new ArrayBuffer(4)
      }) as unknown as Response;

    const result = await downloadElevationImage('Cisco', '../../../etc/passwd', 'front', tempDir, fetchImpl);
    expect(result).toBe('/faceplates/cisco/etc-passwd.front.png');

    const written = await fs.readFile(path.join(tempDir, 'cisco', 'etc-passwd.front.png'));
    expect(written).toBeDefined();
  });
});

describe('importNetBoxDeviceType', () => {
  let tempDir: string;
  let yamlPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-test-'));
    yamlPath = path.join(tempDir, 'device.yaml');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('reads yaml, converts ports, and downloads only flagged images', async () => {
    const yaml = `
manufacturer: Aruba
model: 6200F 24G 4SFP+ Switch
slug: 6200f-24g-4sfpp
u_height: 1
is_full_depth: true
front_image: true
rear_image: false
interfaces:
  - name: '1/1/1'
    type: 1000base-t
  - name: '1/1/2'
    type: 1000base-t
  - name: '1/1/24'
    type: 10gbase-x-sfpp
power-ports:
  - name: RPS
    type: iec-60320-c14
`;
    await fs.writeFile(yamlPath, yaml);

    const fetchImpl = async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('.front.png')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
          arrayBuffer: async () => new ArrayBuffer(4)
        } as unknown as Response;
      }
      return { ok: false, status: 404 } as unknown as Response;
    };

    const result = await importNetBoxDeviceType(yamlPath, { outDir: path.join(tempDir, 'faceplates'), fetchImpl });

    expect(result.vendor).toBe('Aruba');
    expect(result.model).toBe('6200F 24G 4SFP+ Switch');
    expect(result.category).toBe('switch');
    expect(result.ports.find((p) => p.type === 'ethernet')?.count).toBe(2);
    expect(result.ports.find((p) => p.type === 'fiber')?.count).toBe(1);
    expect(result.ports.find((p) => p.type === 'power')?.count).toBe(1);
    expect(result.faceplates.front).toBe('/faceplates/aruba/6200f-24g-4sfpp.front.png');
    expect(result.faceplates.rear).toBeUndefined();
  });

  it('throws when required YAML fields are missing', async () => {
    await fs.writeFile(yamlPath, 'u_height: 1\n');
    await expect(importNetBoxDeviceType(yamlPath)).rejects.toThrow('manufacturer, model, or slug');
  });

  it('uses vendorDir override for faceplate download paths when provided', async () => {
    const yaml = `
manufacturer: Aruba
model: 6200F 24G 4SFP+ Switch
slug: 6200f-24g-4sfpp
u_height: 1
is_full_depth: true
front_image: true
rear_image: false
interfaces:
  - name: '1/1/1'
    type: 1000base-t
`;
    await fs.writeFile(yamlPath, yaml);

    const fetchImpl = async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/aruba-custom/')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
          arrayBuffer: async () => new ArrayBuffer(4)
        } as unknown as Response;
      }
      return { ok: false, status: 404 } as unknown as Response;
    };

    const result = await importNetBoxDeviceType(yamlPath, {
      vendorDir: 'aruba-custom',
      outDir: path.join(tempDir, 'faceplates'),
      fetchImpl
    });

    expect(result.vendor).toBe('aruba-custom');
    expect(result.faceplates.front).toBe('/faceplates/aruba-custom/6200f-24g-4sfpp.front.png');

    const written = await fs.readFile(path.join(tempDir, 'faceplates', 'aruba-custom', '6200f-24g-4sfpp.front.png'));
    expect(written).toBeDefined();
  });
});

#!/usr/bin/env npx tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';

type PortType = 'ethernet' | 'fiber' | 'usb' | 'hdmi' | 'power' | 'atx' | 'coax';
type PortSpeed = '100M' | '1G' | '2.5G' | '5G' | '10G' | '25G' | '40G' | '100G';
type MediaType = 'rj45' | 'sfp' | 'sfp+' | 'sfp28' | 'qsfp+' | 'dac' | 'fiber' | 'usb2' | 'usb3';
type DeviceCategory =
  | 'patch-panel'
  | 'switch'
  | 'router'
  | 'firewall'
  | 'modem'
  | 'access-point'
  | 'poe-injector'
  | 'mini-pc'
  | 'nas'
  | 'server'
  | 'ups'
  | 'pdu'
  | 'pdu-0u'
  | 'shelf'
  | 'cable-management'
  | 'blank'
  | 'sbc'
  | 'ip-kvm'
  | 'printed-mount'
  | 'custom';

const NETBOX_TO_OUR_TYPE: Record<string, string> = {
  '1000base-t': 'ethernet',
  '2.5gbase-t': 'ethernet',
  '5gbase-t': 'ethernet',
  '10gbase-t': 'ethernet',
  '10gbase-x-sfpp': 'fiber',
  '25gbase-x-sfp28': 'fiber',
  '40gbase-x-qsfpp': 'fiber',
  'iec-60320-c14': 'power',
  'iec-60320-c13': 'power',
  'dc-terminal': 'power',
  'usb-a': 'usb',
  'usb-c': 'usb',
  'hdmi': 'hdmi'
};

const NETBOX_TO_MEDIA: Record<string, MediaType> = {
  '10gbase-x-sfpp': 'sfp+',
  '25gbase-x-sfp28': 'sfp28',
  '40gbase-x-qsfpp': 'qsfp+',
  '1000base-t': 'rj45'
};

const NETBOX_TO_SPEED: Record<string, PortSpeed> = {
  '1000base-t': '1G',
  '2.5gbase-t': '2.5G',
  '5gbase-t': '5G',
  '10gbase-t': '10G',
  '10gbase-x-sfpp': '10G',
  '25gbase-x-sfp28': '25G',
  '40gbase-x-qsfpp': '40G'
};

const ELEVATION_BASE_URL = 'https://raw.githubusercontent.com/netbox-community/devicetype-library/master/elevation-images';

interface NetBoxInterface {
  name: string;
  type: string;
  mgmt_only?: boolean;
}

interface NetBoxPowerPort {
  name: string;
  type: string;
}

interface NetBoxConsolePort {
  name: string;
  type: string;
}

interface NetBoxDeviceType {
  manufacturer: string;
  model: string;
  slug: string;
  u_height: number;
  is_full_depth?: boolean;
  front_image?: boolean;
  rear_image?: boolean;
  weight?: number;
  weight_unit?: string;
  interfaces?: NetBoxInterface[];
  'power-ports'?: NetBoxPowerPort[];
  'console-ports'?: NetBoxConsolePort[];
}

export interface PortTypeConfig {
  type: PortType;
  count?: number;
  columns?: number;
  xRatio?: number;
  rowIndex?: number;
  yRatio?: number;
  orientation?: 'horizontal' | 'vertical';
  pairing?: 'sequential' | 'odd-even-vertical';
  groupLabel?: string;
  speed?: PortSpeed;
  mediaType?: MediaType;
}

export interface ImportedPortGroup {
  type: PortType;
  count: number;
  speed?: PortSpeed;
  mediaType?: MediaType;
}

export interface ImportedFaceplates {
  front?: string;
  rear?: string;
}

export interface ImportResult {
  vendor: string;
  model: string;
  slug: string;
  category: DeviceCategory;
  defaultU: number;
  isFullDepth: boolean;
  weightKg: number | undefined;
  ports: ImportedPortGroup[];
  portLayouts: {
    front?: PortTypeConfig[];
    rear?: PortTypeConfig[];
  };
  faceplates: ImportedFaceplates;
  warnings: string[];
}

function toPortType(netboxType: string): PortType | undefined {
  const normalized = netboxType.toLowerCase().trim();
  const mapped = NETBOX_TO_OUR_TYPE[normalized];
  if (!mapped) return undefined;
  const valid: PortType[] = ['ethernet', 'fiber', 'usb', 'hdmi', 'power', 'atx', 'coax'];
  return valid.includes(mapped as PortType) ? (mapped as PortType) : undefined;
}

function inferCategory(netbox: NetBoxDeviceType): DeviceCategory {
  const modelLower = netbox.model.toLowerCase();
  if (modelLower.includes('switch')) return 'switch';
  if (modelLower.includes('router')) return 'router';
  if (modelLower.includes('firewall')) return 'firewall';
  if (modelLower.includes('access point') || modelLower.includes('ap')) return 'access-point';
  if (modelLower.includes('nas') || modelLower.includes('diskstation') || modelLower.includes('synology')) return 'nas';
  if (modelLower.includes('server')) return 'server';
  if (modelLower.includes('ups')) return 'ups';
  if (modelLower.includes('pdu')) return 'pdu';
  if (modelLower.includes('mini pc') || modelLower.includes('nuc')) return 'mini-pc';
  if (modelLower.includes('kvm')) return 'ip-kvm';
  return 'custom';
}

function convertWeightToKg(weight: number | undefined, unit: string | undefined): number | undefined {
  if (weight === undefined || Number.isNaN(weight)) return undefined;
  switch (unit?.toLowerCase()) {
    case 'kg':
      return weight;
    case 'g':
      return weight / 1000;
    case 'lb':
      return weight * 0.453592;
    case 'oz':
      return weight * 0.0283495;
    default:
      return weight;
  }
}

function normalizeVendor(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeFilename(value: string): string {
  // Strip path separators and other unsafe filesystem characters, collapse runs,
  // and trim leading/trailing separators.
  return value
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

export function convertNetBoxDeviceType(netbox: NetBoxDeviceType, vendorDir?: string): ImportResult {
  const warnings: string[] = [];
  const typeCounts = new Map<PortType, { count: number; netboxType: string }>();

  function ingest(items: { name: string; type: string }[] | undefined, label: string) {
    if (!items) return;
    for (const item of items) {
      const portType = toPortType(item.type);
      if (!portType) {
        warnings.push(`Unknown ${label} type "${item.type}" for "${item.name}"; skipping.`);
        continue;
      }
      const existing = typeCounts.get(portType);
      if (existing) {
        existing.count += 1;
      } else {
        typeCounts.set(portType, { count: 1, netboxType: item.type.toLowerCase() });
      }
    }
  }

  ingest(netbox.interfaces, 'interface');
  ingest(netbox['power-ports'], 'power-port');
  ingest(netbox['console-ports'], 'console-port');

  const ports: ImportedPortGroup[] = [];
  const frontPortConfigs: PortTypeConfig[] = [];

  for (const [type, { count, netboxType }] of Array.from(typeCounts.entries())) {
    ports.push({
      type,
      count,
      speed: NETBOX_TO_SPEED[netboxType],
      mediaType: NETBOX_TO_MEDIA[netboxType]
    });

    frontPortConfigs.push({
      type,
      count,
      columns: Math.min(count, 12),
      xRatio: type === 'power' ? 0.5 : 0.5,
      yRatio: 0.85,
      orientation: 'horizontal',
      pairing: 'sequential',
      groupLabel: `${type.toUpperCase()} ports`
    });
  }

  const vendor = vendorDir ?? netbox.manufacturer;

  return {
    vendor,
    model: netbox.model,
    slug: netbox.slug,
    category: inferCategory(netbox),
    defaultU: Math.max(1, netbox.u_height ?? 1),
    isFullDepth: netbox.is_full_depth ?? true,
    weightKg: convertWeightToKg(netbox.weight, netbox.weight_unit),
    ports,
    portLayouts: {
      front: frontPortConfigs.length > 0 ? frontPortConfigs : undefined
    },
    faceplates: {
      front: netbox.front_image ? vendorFaceplatePath(vendor, netbox.slug, 'front') : undefined,
      rear: netbox.rear_image ? vendorFaceplatePath(vendor, netbox.slug, 'rear') : undefined
    },
    warnings
  };
}

function vendorFaceplatePath(vendor: string, slug: string, side: 'front' | 'rear'): string {
  return `/faceplates/${normalizeVendor(vendor)}/${sanitizeFilename(slug)}.${side}.png`;
}

function assertWithinBase(base: string, target: string): void {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error(`Path traversal detected: ${target} is outside ${base}`);
  }
}

function localFaceplatePath(outDir: string, vendor: string, slug: string, side: 'front' | 'rear', ext: string): string {
  const target = path.join(outDir, normalizeVendor(vendor), `${sanitizeFilename(slug)}.${side}.${ext}`);
  assertWithinBase(outDir, target);
  return target;
}

function publicFaceplatePath(vendor: string, slug: string, side: 'front' | 'rear', ext: string): string {
  return `/faceplates/${normalizeVendor(vendor)}/${sanitizeFilename(slug)}.${side}.${ext}`;
}

export function vendorImageUrls(vendor: string, slug: string, side: 'front' | 'rear'): string[] {
  const normalizedVendor = normalizeVendor(vendor);
  const safeSlug = sanitizeFilename(slug);
  return [
    `${ELEVATION_BASE_URL}/${normalizedVendor}/${safeSlug}.${side}.png`,
    `${ELEVATION_BASE_URL}/${normalizedVendor}/${safeSlug}.${side}.jpg`
  ];
}

export async function downloadElevationImage(
  vendor: string,
  slug: string,
  side: 'front' | 'rear',
  outDir: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | undefined> {
  const vendorDir = path.join(outDir, normalizeVendor(vendor));
  await fs.mkdir(vendorDir, { recursive: true });

  for (const url of vendorImageUrls(vendor, slug, side)) {
    try {
      const response = await fetchImpl(url);
      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') ?? '';
      const ext = contentType.includes('image/jpeg') ? 'jpg' : 'png';
      const localPath = localFaceplatePath(outDir, vendor, slug, side, ext);
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(localPath, buffer);
      return publicFaceplatePath(vendor, slug, side, ext);
    } catch {
      // Try next extension / report failure after loop.
    }
  }

  return undefined;
}

export async function importNetBoxDeviceType(
  yamlPath: string,
  options: { vendorDir?: string; outDir?: string; fetchImpl?: typeof fetch } = {}
): Promise<ImportResult> {
  const outDir = options.outDir ?? path.resolve(process.cwd(), 'public', 'faceplates');
  const raw = await fs.readFile(yamlPath, 'utf8');
  const parsed = yaml.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`NetBox YAML did not parse to an object: ${yamlPath}`);
  }
  const netbox = parsed as NetBoxDeviceType;

  if (!netbox.manufacturer || !netbox.model || !netbox.slug) {
    throw new Error('NetBox YAML is missing required fields: manufacturer, model, or slug.');
  }

  const vendor = options.vendorDir ?? netbox.manufacturer;
  const result = convertNetBoxDeviceType(netbox, options.vendorDir);
  const fetchImpl = options.fetchImpl ?? fetch;

  if (netbox.front_image) {
    const frontPath = await downloadElevationImage(vendor, netbox.slug, 'front', outDir, fetchImpl);
    result.faceplates.front = frontPath;
    if (!frontPath) result.warnings.push(`Could not download front elevation image for ${netbox.slug}.`);
  }

  if (netbox.rear_image) {
    const rearPath = await downloadElevationImage(vendor, netbox.slug, 'rear', outDir, fetchImpl);
    result.faceplates.rear = rearPath;
    if (!rearPath) result.warnings.push(`Could not download rear elevation image for ${netbox.slug}.`);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: import-devicetype.ts <path-to-netbox-yaml> [vendor-dir] [output-dir]');
    process.exit(1);
  }

  const [yamlPath, vendorDirArg, outDirArg] = args;
  const vendorDir = vendorDirArg;
  const outDir = outDirArg ? path.resolve(outDirArg) : undefined;

  try {
    const result = await importNetBoxDeviceType(yamlPath, { vendorDir, outDir });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

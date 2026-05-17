import type { DeviceTemplate, PlacedDevice } from '../types/rack';
import { deviceCatalog } from '../data/deviceCatalog';

export type DcimFormat = 'netbox-json' | 'generic-csv';

export interface DcimDevice {
  name: string;
  deviceType: string;
  manufacturer?: string;
  positionU?: number;
  heightU?: number;
  depthMm?: number;
  widthType?: string;
  weightKg?: number;
  powerW?: number;
  serial?: string;
  assetTag?: string;
  face?: string;
  rack?: string;
}

export interface DcimImportResult {
  devices: DcimDevice[];
  matched: { dcim: DcimDevice; template: DeviceTemplate }[];
  unmatched: DcimDevice[];
  placedDevices: PlacedDevice[];
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scoreMatch(dcim: DcimDevice, template: DeviceTemplate): number {
  let score = 0;
  const dcimTypeNorm = normalizeName(dcim.deviceType);
  const tmplNameNorm = normalizeName(template.name);
  const tmplCatNorm = normalizeName(template.category);

  if (dcimTypeNorm.includes(tmplNameNorm) || tmplNameNorm.includes(dcimTypeNorm)) {
    score += 10;
  }
  if (dcimTypeNorm.includes(tmplCatNorm)) {
    score += 5;
  }
  if (dcim.heightU && dcim.heightU === template.defaultU) {
    score += 3;
  }
  if (dcim.depthMm && Math.abs(dcim.depthMm - template.depthMm) < 50) {
    score += 2;
  }
  if (dcim.manufacturer) {
    const mfrNorm = normalizeName(dcim.manufacturer);
    if (tmplNameNorm.includes(mfrNorm) || tmplNameNorm.includes(mfrNorm)) {
      score += 1;
    }
  }
  return score;
}

export function matchToTemplate(dcim: DcimDevice, catalog: DeviceTemplate[] = deviceCatalog): DeviceTemplate | null {
  let best: DeviceTemplate | null = null;
  let bestScore = 0;
  for (const t of catalog) {
    const score = scoreMatch(dcim, t);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 3 ? best : null;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function convertToPlacedDevice(dcim: DcimDevice, template: DeviceTemplate, positionU: number): PlacedDevice {
  const mountSide = dcim.face === 'rear' ? 'rear' : 'front';
  return {
    id: newId('dev'),
    templateId: template.id,
    category: template.category,
    name: dcim.name || template.name,
    mountSide,
    positionU,
    xMm: 0,
    sizeU: dcim.heightU ?? template.defaultU,
    depthMm: dcim.depthMm ?? template.depthMm,
    widthType: template.widthType,
    customWidthMm: template.customWidthMm,
    weightKg: dcim.weightKg ?? template.weightKg,
    powerW: dcim.powerW ?? template.powerW,
    heatLevel: template.heatLevel,
    ports: template.ports,
    portFaceOverrides: template.portFaceOverrides,
    portLayouts: template.portLayouts,
    mountType: template.category === 'pdu-0u' ? (template.mountType ?? 'rear-rail') : template.mountType,
    mountSide0U: template.mountSide0U,
    outletFacing: template.outletFacing,
    mountEnvelopeMm: template.mountEnvelopeMm,
    color: template.color,
    description: template.description,
    serialNumber: dcim.serial,
    assetTag: dcim.assetTag,
  };
}

export function parseNetboxJson(jsonText: string): DcimDevice[] {
  try {
    const data = JSON.parse(jsonText);
    const devices: DcimDevice[] = [];
    const arr = Array.isArray(data) ? data : data.results ?? [];
    for (const item of arr) {
      const dt = item.device_type ?? {};
      const rack = item.rack ?? {};
      devices.push({
        name: item.name ?? item.display ?? 'Unnamed',
        deviceType: dt.model ?? dt.display ?? 'Unknown',
        manufacturer: dt.manufacturer?.name,
        positionU: item.position ? parseInt(item.position, 10) : undefined,
        heightU: dt.u_height ? parseInt(dt.u_height, 10) : undefined,
        depthMm: dt.depth ? parseInt(dt.depth, 10) : undefined,
        weightKg: item?.device_type?.weight ? parseFloat(item.device_type.weight) : undefined,
        powerW: item?.device_type?.maximum_draw ? parseFloat(item.device_type.maximum_draw) : undefined,
        serial: item.serial,
        assetTag: item.asset_tag,
        face: item.face?.value ?? item.face,
        rack: rack.name,
      });
    }
    return devices;
  } catch {
    return [];
  }
}

export function parseGenericCsv(csvText: string): DcimDevice[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const idx = (name: string) => {
    const i = headers.findIndex((h) => h === name.toLowerCase());
    return i >= 0 ? i : undefined;
  };
  const nameIdx = idx('name') ?? -1;
  const typeIdx = (idx('type') ?? idx('device_type') ?? idx('model') ?? -1);
  const mfrIdx = (idx('manufacturer') ?? idx('mfr') ?? idx('vendor') ?? -1);
  const posIdx = (idx('position') ?? idx('u_position') ?? idx('positionu') ?? -1);
  const heightIdx = (idx('height') ?? idx('height_u') ?? idx('u_height') ?? -1);
  const depthIdx = (idx('depth') ?? idx('depth_mm') ?? -1);
  const weightIdx = (idx('weight') ?? idx('weight_kg') ?? -1);
  const powerIdx = (idx('power') ?? idx('power_w') ?? idx('draw') ?? -1);
  const serialIdx = idx('serial') ?? -1;
  const assetIdx = (idx('asset_tag') ?? idx('asset') ?? -1);
  const faceIdx = idx('face') ?? -1;
  const rackIdx = idx('rack') ?? -1;

  const devices: DcimDevice[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;
    const parseNum = (idxVal: number) => (idxVal >= 0 && cols[idxVal] ? parseFloat(cols[idxVal]) : undefined);
    devices.push({
      name: nameIdx >= 0 ? cols[nameIdx] : `Device ${i}`,
      deviceType: typeIdx >= 0 ? cols[typeIdx] : 'Unknown',
      manufacturer: mfrIdx >= 0 ? cols[mfrIdx] : undefined,
      positionU: parseNum(posIdx),
      heightU: parseNum(heightIdx) ? Math.round(parseNum(heightIdx)!) : undefined,
      depthMm: parseNum(depthIdx) ? Math.round(parseNum(depthIdx)!) : undefined,
      weightKg: parseNum(weightIdx),
      powerW: parseNum(powerIdx),
      serial: serialIdx >= 0 ? cols[serialIdx] : undefined,
      assetTag: assetIdx >= 0 ? cols[assetIdx] : undefined,
      face: faceIdx >= 0 ? cols[faceIdx] : undefined,
      rack: rackIdx >= 0 ? cols[rackIdx] : undefined,
    });
  }
  return devices;
}

export function importDcimDevices(text: string, format: DcimFormat): DcimImportResult {
  const devices = format === 'netbox-json' ? parseNetboxJson(text) : parseGenericCsv(text);
  const matched: DcimImportResult['matched'] = [];
  const unmatched: DcimDevice[] = [];
  const placedDevices: PlacedDevice[] = [];

  for (const dcim of devices) {
    const template = matchToTemplate(dcim);
    if (template) {
      matched.push({ dcim, template });
      const pos = dcim.positionU ?? 1;
      placedDevices.push(convertToPlacedDevice(dcim, template, pos));
    } else {
      unmatched.push(dcim);
    }
  }

  return { devices, matched, unmatched, placedDevices };
}

export function summarizeImport(result: DcimImportResult) {
  return {
    total: result.devices.length,
    matched: result.matched.length,
    unmatched: result.unmatched.length,
    totalPowerW: result.placedDevices.reduce((s, d) => s + d.powerW, 0),
    totalWeightKg: result.placedDevices.reduce((s, d) => s + d.weightKg, 0),
    totalU: result.placedDevices.reduce((s, d) => s + d.sizeU, 0),
  };
}

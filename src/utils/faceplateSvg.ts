import type { DeviceTemplate, PlacedDevice, ViewSide } from '../types/rack';
import { getDeviceFaceSizeMm } from './rackMath';
import { buildPortLayout, type PortGroup } from './portLayout';

export interface PortHitRegion {
  type: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export type FaceplateArtifact =
  | { kind: 'svg'; svg: string }
  | { kind: 'image'; path: string };

export interface FaceplateTexture {
  canvas: HTMLCanvasElement;
  ready: Promise<void>;
}

export const SVG_CACHE = new Map<string, string>();
export const TEXTURE_CACHE = new Map<string, FaceplateTexture>();
const IN_FLIGHT_TEXTURES = new Map<string, FaceplateTexture>();

function svgCacheKey(template: DeviceTemplate, face: ViewSide): string {
  return `${template.id}:${face}`;
}

function textureCacheKey(template: DeviceTemplate, face: ViewSide, resolution: number): string {
  return `${template.id}:${face}:${resolution}`;
}

/** Narrow subset of PlacedDevice fields needed for faceplate math. */
function faceplateDeviceFromTemplate(
  template: DeviceTemplate
): Pick<
  PlacedDevice,
  | 'widthType'
  | 'customWidthMm'
  | 'sizeU'
  | 'category'
  | 'ports'
  | 'portFaceOverrides'
  | 'portLayouts'
> {
  return {
    widthType: template.widthType,
    customWidthMm: template.customWidthMm,
    sizeU: template.defaultU,
    category: template.category,
    ports: template.ports,
    portFaceOverrides: template.portFaceOverrides,
    portLayouts: template.portLayouts,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getFaceplateArtifact(
  template: DeviceTemplate,
  face: ViewSide
): FaceplateArtifact {
  const path = template.faceplate?.[face];

  if (path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return { kind: 'image', path };
    }
    if (lower.endsWith('.svg')) {
      const key = svgCacheKey(template, face);
      let svg = SVG_CACHE.get(key);
      if (!svg) {
        svg = loadHandTracedSvg(path);
        SVG_CACHE.set(key, svg);
      }
      return { kind: 'svg', svg };
    }
  }

  const key = svgCacheKey(template, face);
  let svg = SVG_CACHE.get(key);
  if (!svg) {
    svg = generateProceduralSvg(template, face);
    SVG_CACHE.set(key, svg);
  }
  return { kind: 'svg', svg };
}

export function getFaceplateSvg(template: DeviceTemplate, face: ViewSide): string {
  const artifact = getFaceplateArtifact(template, face);
  if (artifact.kind === 'svg') {
    return artifact.svg;
  }
  // Raster images have no SVG representation; fall back to the procedural faceplate.
  const key = svgCacheKey(template, face);
  let svg = SVG_CACHE.get(key);
  if (!svg) {
    svg = generateProceduralSvg(template, face);
    SVG_CACHE.set(key, svg);
  }
  return svg;
}

export function getFaceplateTexture(
  template: DeviceTemplate,
  face: ViewSide,
  resolution = 2
): FaceplateTexture {
  const key = textureCacheKey(template, face, resolution);

  const cached = TEXTURE_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const inFlight = IN_FLIGHT_TEXTURES.get(key);
  if (inFlight) {
    return inFlight;
  }

  const { width, height } = getDeviceFaceSizeMm(faceplateDeviceFromTemplate(template));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * resolution));
  canvas.height = Math.max(1, Math.round(height * resolution));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Could not get 2D context for faceplate texture ${template.id}/${face}`);
  }

  const artifact = getFaceplateArtifact(template, face);
  let objectUrl: string | undefined;

  const ready = new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      TEXTURE_CACHE.set(key, { canvas, ready: Promise.resolve() });
      IN_FLIGHT_TEXTURES.delete(key);
      resolve();
    };
    img.onerror = () => {
      IN_FLIGHT_TEXTURES.delete(key);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(
        new Error(
          `Failed to load faceplate texture for ${template.id}/${face}`
        )
      );
    };

    if (artifact.kind === 'svg') {
      const blob = new Blob([artifact.svg], { type: 'image/svg+xml;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
    } else {
      img.src = artifact.path;
    }
  });

  const texture = { canvas, ready };
  IN_FLIGHT_TEXTURES.set(key, texture);
  return texture;
}

export function getHitRegions(template: DeviceTemplate, face: ViewSide): PortHitRegion[] {
  const path = template.faceplate?.[face];
  if (path && path.toLowerCase().endsWith('.svg')) {
    const svg = loadHandTracedSvg(path);
    return parseHitRegionsFromSvg(svg);
  }
  return buildHitRegionsFromLayout(template, face);
}

function buildHitRegionsFromLayout(
  template: DeviceTemplate,
  face: ViewSide
): PortHitRegion[] {
  const device = faceplateDeviceFromTemplate(template);
  const { width, height } = getDeviceFaceSizeMm(device);
  const groups = buildPortLayout(device, width, height, face);
  const regions: PortHitRegion[] = [];

  for (const group of groups) {
    for (const slot of group.slots) {
      const cx = width / 2 + slot.x;
      const cy = height / 2 - slot.y;
      regions.push({
        type: group.type,
        index: slot.index,
        x: cx - slot.width / 2,
        y: cy - slot.height / 2,
        width: slot.width,
        height: slot.height,
        label: `${group.type} ${slot.index + 1}`,
      });
    }
  }

  return regions;
}

const svgModules = import.meta.glob('/src/assets/faceplates/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function loadHandTracedSvg(path: string): string {
  const fileName = path.replace('/src/assets/faceplates/', '');
  const key = Object.keys(svgModules).find((k) => k.endsWith(fileName));
  if (!key) throw new Error(`Faceplate SVG not found: ${path}`);
  return svgModules[key] as string;
}

export function parseHitRegionsFromSvg(_svg: string): PortHitRegion[] {
  // Hand-traced SVG hit region parsing is deferred to Task 15.
  return [];
}

export function generateProceduralSvg(template: DeviceTemplate, face: ViewSide): string {
  const device = faceplateDeviceFromTemplate(template);
  const { width, height } = getDeviceFaceSizeMm(device);
  const groups = buildPortLayout(device, width, height, face);

  const borderWidth = Math.max(1, height * 0.01);
  const labelFontSize = Math.max(3, height * 0.045);
  const portLabelFontSize = Math.max(2, height * 0.028);

  let body = '';

  for (const group of groups) {
    if (group.slots.length === 0) continue;

    // Group label above the first (top-most) slot.
    const firstSlot = group.slots[0];
    const firstTop = height / 2 - firstSlot.y - firstSlot.height / 2;
    const labelY = Math.max(labelFontSize, firstTop - labelFontSize * 0.3);
    const labelX = width / 2 + firstSlot.x;
    const label = `${group.type} ${group.slots.length}`;

    body += `<text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" text-anchor="middle" fill="#94a3b8" font-size="${labelFontSize.toFixed(2)}">${escapeXml(label)}</text>`;

    for (const slot of group.slots) {
      body += renderPortSlot(slot, width, height, portLabelFontSize);
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}">` +
    `<rect x="0" y="0" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="#0f172a" stroke="#334155" stroke-width="${borderWidth.toFixed(2)}"/>` +
    body +
    `</svg>`
  );
}

function renderPortSlot(
  slot: PortGroup['slots'][number],
  faceWidth: number,
  faceHeight: number,
  labelFontSize: number
): string {
  const cx = faceWidth / 2 + slot.x;
  const cy = faceHeight / 2 - slot.y;
  const x = cx - slot.width / 2;
  const y = cy - slot.height / 2;
  const rx = Math.min(slot.width, slot.height) * 0.15;

  const labelText = String(slot.index + 1);

  switch (slot.type) {
    case 'fiber': {
      return (
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${slot.width.toFixed(2)}" height="${slot.height.toFixed(2)}" rx="${rx.toFixed(2)}" fill="#1e293b" stroke="#c084fc" stroke-width="${Math.max(1, slot.height * 0.12).toFixed(2)}"/>` +
        `<text x="${cx.toFixed(2)}" y="${(cy + labelFontSize * 0.35).toFixed(2)}" text-anchor="middle" fill="#e2e8f0" font-size="${labelFontSize.toFixed(2)}">${labelText}</text>`
      );
    }
    case 'power': {
      const inset = slot.width * 0.12;
      const points = [
        [x, y],
        [x + slot.width, y],
        [x + slot.width - inset, y + slot.height],
        [x + inset, y + slot.height],
      ]
        .map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`)
        .join(' ');
      return (
        `<polygon points="${points}" fill="#fb923c" stroke="#ea580c" stroke-width="${Math.max(1, slot.height * 0.08).toFixed(2)}"/>` +
        `<text x="${cx.toFixed(2)}" y="${(cy + labelFontSize * 0.35).toFixed(2)}" text-anchor="middle" fill="#0f172a" font-size="${labelFontSize.toFixed(2)}">${labelText}</text>`
      );
    }
    case 'usb':
    case 'hdmi': {
      const fill = slot.type === 'usb' ? '#facc15' : '#22c55e';
      const stroke = slot.type === 'usb' ? '#ca8a04' : '#16a34a';
      const w = slot.width * 0.7;
      const h = slot.height * 0.55;
      const lx = cx - w / 2;
      const ly = cy - h / 2;
      const lrx = Math.min(w, h) * 0.2;
      return (
        `<rect x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${lrx.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1, h * 0.08).toFixed(2)}"/>` +
        `<text x="${cx.toFixed(2)}" y="${(cy + labelFontSize * 0.35).toFixed(2)}" text-anchor="middle" fill="#0f172a" font-size="${labelFontSize.toFixed(2)}">${labelText}</text>`
      );
    }
    case 'ethernet':
    default: {
      return (
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${slot.width.toFixed(2)}" height="${slot.height.toFixed(2)}" rx="${rx.toFixed(2)}" fill="#38bdf8" stroke="#0ea5e9" stroke-width="${Math.max(1, slot.height * 0.08).toFixed(2)}"/>` +
        `<text x="${cx.toFixed(2)}" y="${(cy + labelFontSize * 0.35).toFixed(2)}" text-anchor="middle" fill="#0f172a" font-size="${labelFontSize.toFixed(2)}">${labelText}</text>`
      );
    }
  }
}

import type { CableType, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS } from './cableColors';
import { estimateCableLength, formatCableLength, getDeviceSpatialZone, getDeviceXRange, isZeroU, RACK_SPECS } from './rackMath';

const cableColors: Record<CableType, string> = DEFAULT_CABLE_COLORS;

export function downloadTextFile(filename: string, text: string, mimeType = 'application/json') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportLayoutJson(layout: RackLayout) {
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}.json`,
    JSON.stringify(layout, null, 2)
  );
}

export function exportRackPng(layout: RackLayout) {
  const unitHeight = 38;
  const rackWidth = RACK_SPECS[layout.rackType].visualWidthPx;
  const labelWidth = 52;
  const padding = 26;
  const width = rackWidth + labelWidth * 2 + padding * 2;
  const height = layout.heightU * unitHeight + padding * 2 + 56;
  const canvas = document.createElement('canvas');
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 18px Inter, sans-serif';
  ctx.fillText(layout.name, padding, 28);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U / ${layout.rackDepthMm}mm depth`, padding, 48);

  const rackX = padding + labelWidth;
  const rackY = padding + 48;
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.fillRect(rackX, rackY, rackWidth, layout.heightU * unitHeight);
  ctx.strokeRect(rackX, rackY, rackWidth, layout.heightU * unitHeight);

  for (let index = 0; index < layout.heightU; index += 1) {
    const unit = layout.heightU - index;
    const y = rackY + index * unitHeight;
    ctx.strokeStyle = '#243042';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rackX, y);
    ctx.lineTo(rackX + rackWidth, y);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`U${unit}`, padding + 10, y + unitHeight / 2 + 4);
    ctx.fillText(`U${unit}`, rackX + rackWidth + 14, y + unitHeight / 2 + 4);
  }

  layout.devices.forEach((device) => {
    if (isZeroU(device)) {
      const zone = getDeviceSpatialZone(device);
      const side = zone.includes('left') ? 'left' : 'right';
      const x = side === 'left' ? rackX - 34 : rackX + rackWidth + 12;
      const y = rackY + 3;
      const w = 22;
      const h = layout.heightU * unitHeight - 6;
      ctx.fillStyle = device.color;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(device.name, 0, 4);
      ctx.restore();
      return;
    }
    const topIndex = layout.heightU - (device.positionU + device.sizeU - 1);
    const y = rackY + topIndex * unitHeight;
    const h = device.sizeU * unitHeight;
    const range = getDeviceXRange(layout, device);
    const x = rackX + (range.x / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth;
    const w = (Math.min(range.width, RACK_SPECS[layout.rackType].usableWidthMm) / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth;
    ctx.fillStyle = device.color;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x, y + 3, w, h - 6);
    ctx.globalAlpha = 1;
    ctx.strokeRect(x, y + 3, w, h - 6);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillText(device.name, x + 10, y + Math.min(20, h - 8));
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${device.sizeU}U / ${device.depthMm}mm / ${device.powerW}W`, x + 10, y + Math.min(38, h - 8));
  });

  layout.cables.forEach((cable, index) => {
    const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
    const to = layout.devices.find((device) => device.id === cable.toDeviceId);
    if (!from || !to) return;
    const fromRange = getDeviceXRange(layout, from);
    const toRange = getDeviceXRange(layout, to);
    const fromX = rackX + ((fromRange.x + fromRange.width) / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth - 8;
    const toX = rackX + ((toRange.x + toRange.width) / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth - 8;
    const fromY = rackY + (layout.heightU - (from.positionU + from.sizeU / 2)) * unitHeight;
    const toY = rackY + (layout.heightU - (to.positionU + to.sizeU / 2)) * unitHeight;
    const routeX = rackX + rackWidth + 24 + (index % 3) * 10;
    ctx.strokeStyle = cable.color || cableColors[cable.type];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(routeX, fromY, routeX, toY, toX, toY);
    ctx.stroke();
  });

  const anchor = document.createElement('a');
  anchor.download = `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-diagram'}.png`;
  anchor.href = canvas.toDataURL('image/png');
  anchor.click();
}

export interface BomLine {
  type: CableType;
  lengthMm: number;
  count: number;
}

export function buildBom(layout: RackLayout): BomLine[] {
  const map = new Map<string, BomLine>();
  layout.cables.forEach((cable) => {
    const lengthMm = estimateCableLength(layout, cable);
    const key = `${cable.type}-${lengthMm}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { type: cable.type, lengthMm, count: 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.lengthMm - b.lengthMm;
  });
}

export function exportBomCsv(layout: RackLayout) {
  const lines = buildBom(layout);
  const headers = ['Type', 'Length', 'Quantity'];
  const rows = lines.map((line) => [line.type, formatCableLength(line.lengthMm), String(line.count)]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-bom.csv`,
    csv,
    'text/csv'
  );
}

export function exportBomText(layout: RackLayout) {
  const lines = buildBom(layout);
  const totalCables = lines.reduce((sum, line) => sum + line.count, 0);
  const textLines = [
    `Cable BOM: ${layout.name}`,
    `${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Total cable routes: ${totalCables}`,
    '',
    ...lines.map((line) => `${line.type.padEnd(10)} ${formatCableLength(line.lengthMm).padStart(6)} × ${line.count}`),
    '',
    'Generated by Homelab Rack Simulator'
  ];
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-bom.txt`,
    textLines.join('\n'),
    'text/plain'
  );
}

export function readJsonFile(file: File) {
  return new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const outDir = resolve('artifacts/smoke');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(outDir, 'desktop-routing-2d.png'), fullPage: true });

  await page.getByRole('button', { name: 'Cables', exact: true }).click();
  await page.waitForSelector('[data-testid="cable-map-svg"]', { timeout: 10_000 });
  await page.screenshot({ path: resolve(outDir, 'desktop-routing-map.png'), fullPage: true });

  await page.getByRole('button', { name: /3D routing/i }).click();
  await page.waitForSelector('[data-testid="cable-routing-3d"]', { timeout: 20_000 });
  await page.waitForTimeout(1800);

  const canvas = page.locator('canvas').last();
  const canvasPng = await canvas.screenshot();
  const nonBlankPixels = countPixelsDifferentFromCorner(canvasPng);

  if (nonBlankPixels < 50) {
    throw new Error(`3D cable canvas appears blank (${nonBlankPixels} sampled pixels)`);
  }

  await writeFile(resolve(outDir, 'desktop-routing-3d-canvas.png'), canvasPng);
  await page.screenshot({ path: resolve(outDir, 'desktop-routing-3d.png'), fullPage: true });
} finally {
  await browser.close();
}

function countPixelsDifferentFromCorner(pngBuffer) {
  const png = decodePng(pngBuffer);
  const data = png.data;
  const r0 = data[0];
  const g0 = data[1];
  const b0 = data[2];
  let hits = 0;
  for (let i = 0; i < data.length; i += 64) {
    const delta = Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0);
    if (delta > 24 && data[i + 3] > 0) hits += 1;
  }
  return hits;
}

function decodePng(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Canvas screenshot is not a PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8Array(width * height * 4);
  let input = 0;
  let output = 0;
  const prev = new Uint8Array(stride);
  const scan = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[input];
    input += 1;
    scan.set(raw.subarray(input, input + stride));
    input += stride;
    unfilterScanline(scan, prev, channels, filter);
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      data[output] = scan[source];
      data[output + 1] = scan[source + 1];
      data[output + 2] = scan[source + 2];
      data[output + 3] = colorType === 6 ? scan[source + 3] : 255;
      output += 4;
    }
    prev.set(scan);
  }

  return { width, height, data };
}

function unfilterScanline(scan, prev, bpp, filter) {
  for (let i = 0; i < scan.length; i += 1) {
    const left = i >= bpp ? scan[i - bpp] : 0;
    const up = prev[i] ?? 0;
    const upLeft = i >= bpp ? prev[i - bpp] : 0;
    if (filter === 1) {
      scan[i] = (scan[i] + left) & 255;
    } else if (filter === 2) {
      scan[i] = (scan[i] + up) & 255;
    } else if (filter === 3) {
      scan[i] = (scan[i] + Math.floor((left + up) / 2)) & 255;
    } else if (filter === 4) {
      scan[i] = (scan[i] + paeth(left, up, upLeft)) & 255;
    }
  }
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

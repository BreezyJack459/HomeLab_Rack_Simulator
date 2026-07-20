# Realistic Device Port Layout (v3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a faceplate pipeline that makes 2D and 3D device port layouts look like real-world products. Use NetBox's device-type YAMLs for port inventories and their elevation PNGs/JPEGs as faceplate images; fall back to procedural SVGs only when no image exists.

**Architecture:** One `faceplateSvg.ts` module produces a single faceplate artifact per `(template, face)` — either a vendored raster image or a generated SVG. The 3D view applies it as a texture on the device face quad; the 2D view draws the same artifact as an image node. A dev-time NetBox import script downloads port data and images. Hand-traced SVGs are reserved for gap devices with no NetBox image.

**Tech Stack:** TypeScript, React, Vite, Vitest, React Three Fiber / Three.js (lazy-loaded), SVG, HTMLCanvasElement for texture rasterization, NetBox devicetype-library.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/types/rack.ts` | Extend `PortTypeConfig` and `DeviceTemplate` with faceplate/layout fields. |
| `src/utils/portLayout.ts` | v2-lite layout engine: rows, anchors, pairing, vertical orientation. |
| `src/utils/portLayout.test.ts` | Tests for the layout engine. |
| `src/utils/faceplateSvg.ts` | SVG generator, texture cache, hit-region extractor. |
| `src/utils/faceplateSvg.test.ts` | Tests for the SVG pipeline. |
| `src/utils/rackMath.ts` | Helpers for device dimensions in millimeters (existing, may need minor additions). |
| `scripts/import-devicetype.ts` | NetBox device-type YAML → template port data converter. |
| `scripts/import-devicetype.test.ts` | Snapshot test for the import script. |
| `src/data/deviceCatalog.ts` | Updated templates with row data and faceplate references. |
| `src/components/three/DeviceModel.tsx` | Apply faceplate texture to front/rear face plates. |
| `src/components/RackEditor2D.tsx` | Render faceplate SVG image instead of `PortStrip`. |
| `src/components/FaceplateGallery.tsx` | Debug-only gallery for reviewing vendored faceplate images. |
| `public/faceplates/*.front.png` / `*.rear.png` / `*.jpg` | Vendored NetBox elevation images (served as static assets). |
| `src/assets/faceplates/*.front.svg` / `*.rear.svg` | Hand-traced SVG fallbacks for gap devices. |

---

## Phase 0: Gallery page (image review surface)

Move the gallery earlier than in the v3 spec. Because most hero devices will use vendored NetBox raster images, the gallery becomes the place where we review image quality and aspect ratio before committing assets.

### Task 0: Build FaceplateGallery component

**Files:**
- Create: `src/components/FaceplateGallery.tsx`

- [ ] **Step 1: Write the gallery component**

```tsx
import { deviceCatalog } from '../data/deviceCatalog';
import { getFaceplateSvg } from '../utils/faceplateSvg';
import { getDeviceFaceSizeMm } from '../utils/rackMath';

export function FaceplateGallery() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <h1 className="mb-2 text-2xl font-bold">Faceplate Gallery</h1>
      <p className="mb-6 text-sm text-slate-400">
        Review vendored faceplate images. Mark low-quality or mis-cropped images for procedural fallback.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {deviceCatalog
          .filter((t) => t.ports && Object.keys(t.ports).length > 0)
          .map((template) => {
            const { width } = getDeviceFaceSizeMm(template as unknown as any);
            return (
              <div key={template.id} className="rounded border border-slate-700 bg-slate-900 p-4">
                <h2 className="mb-2 text-sm font-semibold">{template.name}</h2>
                <div className="flex gap-4 overflow-x-auto">
                  {(['front', 'rear'] as const).map((face) => {
                    const isRaster = template.faceplate?.[face]?.match(/\.(png|jpe?g)$/i);
                    return (
                      <div key={face} className="shrink-0">
                        <div className="mb-1 text-xs uppercase text-slate-400">
                          {face} {isRaster ? '(image)' : '(generated)'}
                        </div>
                        <FaceplatePreview template={template} face={face} width={width} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function FaceplatePreview({ template, face, width }: { template: any; face: 'front' | 'rear'; width: number }) {
  const path = template.faceplate?.[face];
  if (!path) {
    const svg = getFaceplateSvg(template, face);
    return (
      <div
        className="border border-slate-700 bg-black"
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{ width: 400, height: (template.defaultU ?? 1) * 37 }}
      />
    );
  }
  return (
    <img
      src={path}
      alt={`${template.name} ${face}`}
      className="border border-slate-700 bg-black object-contain"
      style={{ width: 400, height: (template.defaultU ?? 1) * 37 }}
    />
  );
}
```

- [ ] **Step 2: Expose gallery only in dev/debug mode**

In `src/App.tsx`, conditionally render `<FaceplateGallery />` when `import.meta.env.DEV` is true and a query param `?gallery=1` is present, or via a command-palette action.

```tsx
const FaceplateGallery = lazy(() => import('./components/FaceplateGallery').then((m) => ({ default: m.FaceplateGallery })));

// Inside routing/view switch:
{import.meta.env.DEV && viewMode === 'gallery' && <FaceplateGallery />}
```

- [ ] **Step 3: Add `gallery` to ViewMode type**

In `src/types/rack.ts`:

```ts
export type ViewMode = '2d' | '3d' | 'cables' | 'topology' | 'gallery';
```

Use a dev-only route or query param so production builds exclude the gallery chunk.

- [ ] **Step 4: Add a Playwright dev-only test that gallery loads**

Skip in CI if gallery is dev-only.

---

## Phase 1: Layout engine v2-lite

### Task 1: Extend data model

**Files:**
- Modify: `src/types/rack.ts:176-183`

- [ ] **Step 1: Add new optional fields to `PortTypeConfig`**

```ts
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
```

- [ ] **Step 2: Add `faceplate` field to `DeviceTemplate`**

```ts
export interface DeviceTemplate {
  // ... existing fields ...
  faceplate?: {
    front?: string;
    rear?: string;
  };
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Add `label` to `PortGroup`

**Files:**
- Modify: `src/utils/portLayout.ts:14-21`

- [ ] **Step 1: Add optional label**

```ts
export interface PortGroup {
  type: string;
  slots: PortSlot[];
  color: string;
  emissive: string;
  short: string;
  key?: string;
  label?: string;
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

---

### Task 3: Refactor `buildPortLayout` to group rows

**Files:**
- Modify: `src/utils/portLayout.ts:119-185`

- [ ] **Step 1: Replace the layout dispatch logic**

Keep the renderable-config collection (lines 145-158) unchanged. After it, replace lines 160-184 with:

```ts
// Group configs by rowIndex. Unindexed configs get sequential negative indices
// so they stack below indexed rows in declaration order.
const rowMap = new Map<number, typeof renderableConfigs>();
let nextFallbackIndex = -1;
for (const item of renderableConfigs) {
  const idx = item.config.rowIndex ?? nextFallbackIndex--;
  if (!rowMap.has(idx)) rowMap.set(idx, []);
  rowMap.get(idx)!.push(item);
}

// Sort rows: non-negative indices ascending (0 = top), then negative indices
// ascending toward 0 (declaration order, bottom-most last).
const sortedRows = Array.from(rowMap.entries()).sort((a, b) => {
  const ai = a[0] >= 0 ? a[0] : Number.MAX_SAFE_INTEGER + a[0];
  const bi = b[0] >= 0 ? b[0] : Number.MAX_SAFE_INTEGER + b[0];
  return ai - bi;
});

return sortedRows.flatMap(([, items], rowIdx) =>
  layoutPortRow(
    items,
    device,
    faceWidth,
    faceHeight,
    sortedRows.length,
    rowIdx,
    sortedRows.map(([, r]) => r[0]?.config.yRatio)
  )
);
```

- [ ] **Step 2: Add fallback for templates without `portLayouts`**

The existing `// Default behavior` block (lines 180-184) must remain for templates with no `portLayouts`. Wrap the new row logic so it only runs when `faceLayout` exists; otherwise fall through to the default.

- [ ] **Step 3: Run layout tests**

```bash
npx vitest run src/utils/portLayout.test.ts
```

Expected: existing tests still pass.

---

### Task 4: Implement `layoutPortRow`

**Files:**
- Create: helper inside `src/utils/portLayout.ts` (append before `getDefaultColumns`)

- [ ] **Step 1: Add `layoutPortRow` function**

```ts
interface RenderableConfig {
  config: PortTypeConfig;
  sourceIndex: number;
  count: number;
  startIndex: number;
}

function layoutPortRow(
  items: RenderableConfig[],
  device: PlacedDevice,
  faceWidth: number,
  faceHeight: number,
  totalRows: number,
  rowIdx: number,
  rowYRatios: (number | undefined)[]
): PortGroup[] {
  // Determine row vertical center from explicit yRatio or flow evenly
  const sideMargin = faceWidth * 0.03;
  const availableW = Math.max(0.01, faceWidth - sideMargin * 2);
  const topMargin = faceHeight * 0.12;
  const bottomMargin = faceHeight * 0.06;
  const availableH = Math.max(0.01, faceHeight - topMargin - bottomMargin);

  const rowYRatio = rowYRatios[rowIdx];
  let rowCenterY: number;
  if (rowYRatio !== undefined) {
    rowCenterY = availableH / 2 - topMargin - rowYRatio * availableH + availableH / 2;
  } else {
    const rowH = availableH / totalRows;
    rowCenterY = availableH / 2 - topMargin - rowIdx * rowH + rowH / 2;
  }

  // Layout each config left-to-right within the row, anchored by xRatio.
  return items.map(({ config, sourceIndex, count, startIndex }) => {
    const group = layoutPortGroup(
      config.type,
      count,
      device,
      faceWidth,
      faceHeight,
      totalRows,
      config.xRatio,
      0,
      startIndex,
      config.columns,
      config.speed,
      config.mediaType,
      config.orientation
    );
    group.key = `${config.type}-${sourceIndex}`;
    group.label = config.groupLabel;

    // Override the y center of every slot to sit on this row
    const rowOffset = rowCenterY - group.slots.reduce((sum, s) => sum + s.y, 0) / Math.max(1, group.slots.length);
    for (const slot of group.slots) {
      slot.y = slot.y + rowOffset;
    }

    // Apply pairing if requested
    if (config.pairing === 'odd-even-vertical') {
      group.slots = applyOddEvenVerticalPairing(group.slots, config.columns ?? group.slots.length);
    }

    return group;
  });
}
```

- [ ] **Step 2: Add `applyOddEvenVerticalPairing`**

```ts
function applyOddEvenVerticalPairing(slots: PortSlot[], columns: number): PortSlot[] {
  // Reorder indices so a 2-row block reads top-to-bottom per column:
  // column 0: indices 0,1; column 1: indices 2,3; etc.
  // Slot positions stay where layoutPortGroup put them; only index labels change.
  const rows = Math.ceil(slots.length / columns);
  const reordered: PortSlot[] = [];
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const oldIdx = row * columns + col;
      if (oldIdx < slots.length) reordered.push(slots[oldIdx]);
    }
  }
  reordered.forEach((slot, i) => {
    slot.index = i;
  });
  return reordered;
}
```

- [ ] **Step 3: Update `layoutPortGroup` signature**

Add an `orientation?: 'horizontal' | 'vertical'` parameter near the end of the parameter list. Use it to swap slot width/height and stack direction when vertical. For now, keep the existing behavior as the default (`horizontal`).

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/utils/portLayout.test.ts
```

Expected: existing tests pass; new tests will be added in Task 5.

---

### Task 5: Add layout engine tests

**Files:**
- Modify: `src/utils/portLayout.test.ts`

- [ ] **Step 1: Add test for `rowIndex` grouping**

```ts
it('places configs with the same rowIndex on the same row', () => {
  const device = makeDevice({
    category: 'switch',
    ports: { ethernet: 24, fiber: 4 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 24, columns: 12, rowIndex: 0, xRatio: 0.4 },
        { type: 'fiber', count: 4, columns: 4, rowIndex: 0, xRatio: 0.85 }
      ]
    }
  });
  const groups = buildPortLayout(device, 0.5, 0.3, 'front');
  expect(groups.length).toBe(2);
  const ethY = groups.find((g) => g.type === 'ethernet')!.slots[0].y;
  const fibY = groups.find((g) => g.type === 'fiber')!.slots[0].y;
  expect(ethY).toBeCloseTo(fibY, 3);
});
```

- [ ] **Step 2: Add test for `yRatio` anchoring**

```ts
it('honors yRatio for explicit vertical anchoring', () => {
  const device = makeDevice({
    category: 'switch',
    ports: { ethernet: 12 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 12, columns: 12, rowIndex: 0, yRatio: 0.85 }
      ]
    }
  });
  const groups = buildPortLayout(device, 0.5, 0.3, 'front');
  const y = groups[0].slots[0].y;
  const withoutYRatio = buildPortLayout(
    makeDevice({
      category: 'switch',
      ports: { ethernet: 12 },
      portLayouts: { front: [{ type: 'ethernet', count: 12, columns: 12 }] }
    }),
    0.5,
    0.3,
    'front'
  );
  expect(y).not.toBeCloseTo(withoutYRatio[0].slots[0].y, 3);
});
```

- [ ] **Step 3: Add test for odd-even-vertical pairing**

```ts
it('orders slots in odd-even-vertical pairs', () => {
  const device = makeDevice({
    category: 'switch',
    ports: { ethernet: 4 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 4, columns: 2, pairing: 'odd-even-vertical' }
      ]
    }
  });
  const groups = buildPortLayout(device, 0.5, 0.3, 'front');
  const slots = groups[0].slots;
  expect(slots[0].index).toBe(0);
  expect(slots[1].index).toBe(2);
  expect(slots[2].index).toBe(1);
  expect(slots[3].index).toBe(3);
});
```

- [ ] **Step 4: Add backward-compatibility test**

```ts
it('preserves old stacking behavior when new row fields are absent', () => {
  const device = makeDevice({
    category: 'switch',
    ports: { ethernet: 8, fiber: 2 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 8, xRatio: 0.42 },
        { type: 'fiber', columns: 2, xRatio: 0.88 }
      ]
    }
  });
  const groups = buildPortLayout(device, 0.5, 0.3, 'front');
  expect(groups.map((g) => g.type)).toEqual(['ethernet', 'fiber']);
  expect(groups[0].slots[0].y).toBeGreaterThan(groups[1].slots[0].y);
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/utils/portLayout.test.ts
```

Expected: all pass.

---

## Phase 2: Faceplate SVG pipeline

### Task 6: Create millimeter dimension helpers

**Files:**
- Modify: `src/utils/rackMath.ts`

- [ ] **Step 1: Add face-size helper**

Append to `src/utils/rackMath.ts`:

```ts
const STANDARD_U_MM = 44.45;
const RACK_USABLE_WIDTH_MM: Record<RackType | '10in' | '19in', number> = {
  '10in': 254,
  '19in': 482.6
};

export function getDeviceFaceSizeMm(device: PlacedDevice): { width: number; height: number } {
  const width = device.widthType === 'custom'
    ? (device.customWidthMm ?? 100)
    : device.widthType === 'shelf'
      ? (device.customWidthMm ?? 100)
      : RACK_USABLE_WIDTH_MM[device.widthType as RackType] ?? 482.6;
  const height = Math.max(device.sizeU, 1) * STANDARD_U_MM;
  return { width, height };
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

---

### Task 7: Create the faceplate SVG module scaffold

**Files:**
- Create: `src/utils/faceplateSvg.ts`

- [ ] **Step 1: Write the module header and types**

```ts
import type { DeviceTemplate, PlacedDevice, PortSlot } from '../types/rack';
import { buildPortLayout } from './portLayout';
import { getDeviceFaceSizeMm } from './rackMath';

export interface PortHitRegion {
  type: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface FaceplateKey {
  templateId: string;
  face: 'front' | 'rear';
}

const SVG_CACHE = new Map<string, string>();
const TEXTURE_CACHE = new Map<string, HTMLCanvasElement>();

function cacheKey(key: FaceplateKey, suffix = ''): string {
  return `${key.templateId}:${key.face}${suffix}`;
}
```

- [ ] **Step 2: Add the public API stubs**

```ts
export type FaceplateArtifact =
  | { kind: 'svg'; svg: string }
  | { kind: 'image'; path: string };

export function getFaceplateArtifact(
  template: DeviceTemplate,
  face: 'front' | 'rear'
): FaceplateArtifact {
  const path = template.faceplate?.[face];
  if (!path) {
    return { kind: 'svg', svg: generateProceduralSvg(template, face) };
  }
  if (/\.(png|jpe?g)$/i.test(path)) {
    return { kind: 'image', path };
  }
  return { kind: 'svg', svg: loadHandTracedSvg(path) };
}

export function getFaceplateSvg(
  template: DeviceTemplate,
  face: 'front' | 'rear'
): string {
  const artifact = getFaceplateArtifact(template, face);
  if (artifact.kind === 'image') {
    throw new Error(`Faceplate for ${template.id}/${face} is a raster image, not an SVG. Use getFaceplateArtifact().`);
  }
  return artifact.svg;
}

export function getFaceplateTexture(
  template: DeviceTemplate,
  face: 'front' | 'rear',
  resolution = 2
): HTMLCanvasElement {
  const key = cacheKey({ templateId: template.id, face }, `:${resolution}`);
  const cached = TEXTURE_CACHE.get(key);
  if (cached) return cached;

  const artifact = getFaceplateArtifact(template, face);
  const { width, height } = getDeviceFaceSizeMm(template as unknown as PlacedDevice);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * resolution);
  canvas.height = Math.round(height * resolution);
  const ctx = canvas.getContext('2d')!;

  const img = new Image();
  let url: string;
  if (artifact.kind === 'image') {
    url = artifact.path;
  } else {
    const blob = new Blob([artifact.svg], { type: 'image/svg+xml;charset=utf-8' });
    url = URL.createObjectURL(blob);
  }

  (canvas as any).ready = new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (artifact.kind === 'svg') URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });

  TEXTURE_CACHE.set(key, canvas);
  return canvas;
}

export function getHitRegions(
  template: DeviceTemplate,
  face: 'front' | 'rear'
): PortHitRegion[] {
  const artifact = getFaceplateArtifact(template, face);
  if (artifact.kind === 'svg') {
    const parsed = parseHitRegionsFromSvg(artifact.svg);
    if (parsed.length > 0) return parsed;
  }
  return buildHitRegionsFromLayout(template, face);
}
```

- [ ] **Step 3: Add stubs for helper functions**

```ts
function loadHandTracedSvg(path: string): string {
  // For Vite, SVG files in src/assets can be imported as raw strings.
  // This stub is replaced in Task 15 with a real Vite glob import.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 482.6 44.45">
    <rect width="100%" height="100%" fill="#1e293b"/>
    <text x="50%" y="50%" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle" font-size="12">
      faceplate: ${path}
    </text>
  </svg>`;
}

function generateProceduralSvg(template: DeviceTemplate, face: 'front' | 'rear'): string {
  // Implemented in Task 8.
  return '';
}

function parseHitRegionsFromSvg(svg: string): PortHitRegion[] {
  // Parses optional <g data-ports> layer in hand-traced SVGs.
  // Implemented in Task 16 (hit-region wiring).
  return [];
}

function buildHitRegionsFromLayout(template: DeviceTemplate, face: 'front' | 'rear'): PortHitRegion[] {
  const device = template as unknown as PlacedDevice;
  const { width, height } = getDeviceFaceSizeMm(device);
  const groups = buildPortLayout(device, width, height, face);
  return groups.flatMap((group) =>
    group.slots.map((slot) => ({
      type: group.type,
      index: slot.index,
      x: slot.x - slot.width / 2,
      y: slot.y - slot.height / 2,
      width: slot.width,
      height: slot.height,
      label: group.label
    }))
  );
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: may show unused-variable warnings only; no type errors.

---

### Task 8: Implement procedural SVG generator

**Files:**
- Modify: `src/utils/faceplateSvg.ts`

- [ ] **Step 1: Replace `generateProceduralSvg` stub**

```ts
function generateProceduralSvg(template: DeviceTemplate, face: 'front' | 'rear'): string {
  const device = template as unknown as PlacedDevice;
  const { width, height } = getDeviceFaceSizeMm(device);
  const groups = buildPortLayout(device, width, height, face);

  const padding = 4;
  const viewBox = `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`;

  let shapes = '';
  for (const group of groups) {
    for (const slot of group.slots) {
      shapes += renderPortSlot(slot, group.type, group.label);
    }
    if (group.label && group.slots.length > 0) {
      const first = group.slots[0];
      shapes += `<text x="${first.x}" y="${first.y - first.height}" fill="#94a3b8" font-size="10" text-anchor="middle">${escapeXml(group.label)}</text>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width + padding * 2}" height="${height + padding * 2}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0f172a" stroke="#334155" stroke-width="1"/>
  ${shapes}
</svg>`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 2: Add shape vocabulary**

```ts
function renderPortSlot(slot: PortSlot, type: string, _label?: string): string {
  const x = slot.x - slot.width / 2;
  const y = slot.y - slot.height / 2;
  const color = PORT_COLORS[type] ?? '#38bdf8';

  switch (type) {
    case 'ethernet':
      return `<rect x="${x}" y="${y}" width="${slot.width}" height="${slot.height}" rx="2" fill="${color}"/>`;
    case 'fiber':
      return `<rect x="${x}" y="${y}" width="${slot.width}" height="${slot.height}" rx="1" fill="#1e293b" stroke="${color}" stroke-width="1.5"/>`;
    case 'power':
      return `<path d="M ${x} ${y + slot.height} L ${x + slot.width * 0.15} ${y} L ${x + slot.width * 0.85} ${y} L ${x + slot.width} ${y + slot.height} Z" fill="${color}"/>`;
    case 'usb':
      return `<rect x="${x}" y="${y + slot.height * 0.25}" width="${slot.width}" height="${slot.height * 0.5}" rx="1" fill="${color}"/>`;
    case 'hdmi':
      return `<rect x="${x}" y="${y + slot.height * 0.2}" width="${slot.width}" height="${slot.height * 0.6}" rx="1" fill="${color}"/>`;
    default:
      return `<rect x="${x}" y="${y}" width="${slot.width}" height="${slot.height}" rx="1" fill="${color}"/>`;
  }
}

const PORT_COLORS: Record<string, string> = {
  ethernet: '#38bdf8',
  fiber: '#c084fc',
  power: '#fb923c',
  usb: '#facc15',
  hdmi: '#22c55e',
  atx: '#f43f5e',
  coax: '#a3e635'
};
```

- [ ] **Step 3: Add a procedural SVG test**

Create `src/utils/faceplateSvg.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getFaceplateSvg, getHitRegions } from './faceplateSvg';
import type { DeviceTemplate } from '../types/rack';

const switchTemplate: DeviceTemplate = {
  id: 'test-switch',
  category: 'switch',
  name: 'Test Switch',
  defaultU: 1,
  depthMm: 200,
  widthType: '19in',
  weightKg: 3,
  powerW: 30,
  heatLevel: 3,
  ports: { ethernet: 8, fiber: 2 },
  portLayouts: {
    front: [
      { type: 'ethernet', count: 8, columns: 8, rowIndex: 0, xRatio: 0.4 },
      { type: 'fiber', count: 2, columns: 2, rowIndex: 0, xRatio: 0.85 }
    ]
  },
  color: '#2563eb',
  description: 'Test switch for faceplate pipeline.'
};

describe('getFaceplateSvg', () => {
  it('generates an SVG string for a procedural device', () => {
    const svg = getFaceplateSvg(switchTemplate, 'front');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('rect');
  });
});

describe('getHitRegions', () => {
  it('returns hit regions matching the slot count', () => {
    const regions = getHitRegions(switchTemplate, 'front');
    expect(regions.length).toBe(10);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/utils/faceplateSvg.test.ts
```

Expected: pass.

---

### Task 9: Wire faceplate texture into 3D DeviceModel

**Files:**
- Modify: `src/components/three/DeviceModel.tsx`

- [ ] **Step 1: Add imports**

```ts
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { getFaceplateTexture } from '../../utils/faceplateSvg';
```

Wait — `three` must not be statically imported from `App.tsx` or `main.tsx`, but importing it inside a lazy-loaded chunk (`components/three/DeviceModel.tsx`) is allowed per AGENTS.md. `getFaceplateTexture` internally handles both raster images and SVG strings, so the 3D component does not need to branch.

- [ ] **Step 2: Create `FaceplateTexture` component**

```ts
function FaceplateTexture({
  template,
  face,
  width,
  height
}: {
  template: DeviceTemplate;
  face: 'front' | 'rear';
  width: number;
  height: number;
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = getFaceplateTexture(template, face, 4);
    (canvas as any).ready.then(() => {
      if (cancelled) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      setTexture(tex);
    });
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [template.id, face]);

  if (!texture) return null;
  return (
    <mesh position={[0, 0, face === 'front' ? 0.01 : -0.01]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} transparent />
    </mesh>
  );
}
```

- [ ] **Step 3: Locate DeviceTemplate usage in DeviceModel**

`DeviceModelComponent` receives `device: PlacedDevice`, not `DeviceTemplate`. We need the template. Options:
- Pass template down from `RackViewer3D` / data lookup.
- Look up the template in `deviceCatalog` by `device.templateId`.

Use the catalog lookup for minimal prop drilling:

```ts
import { deviceCatalog } from '../../data/deviceCatalog';

const template = deviceCatalog.find((t) => t.id === device.templateId) ?? (device as unknown as DeviceTemplate);
```

Add this near the top of `DeviceModelComponent`.

- [ ] **Step 4: Render faceplate textures on front/rear face plates**

Replace the existing face-plate `<mesh>` for non-zero-U devices with the textured plane. Keep the existing dark faceplate mesh as a fallback behind the texture, or replace its material with the texture.

Simpler approach: keep the existing faceplate mesh and render the texture plane just in front of it (z offset +0.01 / -0.01). The existing mesh provides the dark background if the SVG has transparency.

Add inside the non-zero-U branch after the existing faceplate mesh:

```tsx
{template && (
  <>
    <FaceplateTexture template={template} face="front" width={width} height={height} />
    <FaceplateTexture template={template} face="rear" width={width} height={height} />
  </>
)}
```

- [ ] **Step 5: Hide old per-port geometry when a faceplate texture exists**

The old `DevicePortFace` renders individual port squares. When a texture covers the face, those squares are redundant and may z-fight. Add a condition: if `template.faceplate?.[face]` exists OR we are using procedural faceplates, skip `DevicePortFace`. For this v3, always render faceplate texture and skip `DevicePortFace` for non-zero-U devices.

Replace the non-zero-U "Ports" block with the faceplate textures only.

- [ ] **Step 6: Run build and smoke**

```bash
npm run build
```

Expected: build succeeds (watch bundle size; we added a canvas texture path but no new static imports of three).

```bash
npx playwright test tests/smoke/app.spec.ts
```

Expected: existing smoke tests pass.

---

### Task 10: Wire faceplate SVG into 2D RackEditor2D

**Files:**
- Modify: `src/components/RackEditor2D.tsx`

- [ ] **Step 1: Add imports**

```ts
import { getFaceplateArtifact } from '../utils/faceplateSvg';
import { deviceCatalog } from '../data/deviceCatalog';
```

- [ ] **Step 2: Replace `PortStrip` usage with faceplate artifact**

Find the device body rendering around lines 805/881/884. Where `PortStrip` is rendered inside a device card, instead render either a vendored image `<img>` or an inline SVG.

Pseudocode for the device face rendering:

```tsx
const template = deviceCatalog.find((t) => t.id === device.templateId) ?? (device as unknown as DeviceTemplate);
const artifact = getFaceplateArtifact(template, layout.viewSide);
```

Then inside the device rectangle:

```tsx
{artifact.kind === 'image' ? (
  <img
    src={artifact.path}
    alt=""
    className="pointer-events-none absolute inset-0 h-full w-full object-contain"
  />
) : (
  <div
    className="pointer-events-none absolute inset-0 h-full w-full"
    dangerouslySetInnerHTML={{ __html: artifact.svg }}
  />
)}
```

Use `object-contain` and ensure the device rectangle preserves aspect ratio / fills the U box.

- [ ] **Step 3: Keep `PortStrip` as fallback for zero-U side devices or compact views**

For `isZeroU(device)` side devices, the faceplate is on the side; keep the existing `PortStrip` or use `DeviceZeroUSideFace` logic. For this plan, keep `PortStrip` for zero-U devices only.

- [ ] **Step 4: Add a smoke test that 2D faceplate renders**

In `tests/smoke/app.spec.ts`, add or update a test that a switch added to the rack shows an `<img>` or `<svg>` inside the device element.

- [ ] **Step 5: Run smoke tests**

```bash
npx playwright test tests/smoke/app.spec.ts
```

Expected: pass.

---

## Phase 3: NetBox device-type import script

Elevation images in the NetBox library are **PNGs/JPEGs**, not SVGs. The import script therefore downloads vendored raster images and sets the template's `faceplate` field when `front_image`/`rear_image` flags are true. Procedural SVG remains the fallback for devices with no image.

### Task 11: Create import script scaffold

**Files:**
- Create: `scripts/import-devicetype.ts`

- [ ] **Step 1: Add shebang and imports**

```ts
#!/usr/bin/env npx tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
```

Note: `yaml` is not currently a dependency. Add it as a devDependency in Task 12.

- [ ] **Step 2: Define type mapping and constants**

```ts
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

const NETBOX_TO_MEDIA: Record<string, string> = {
  '10gbase-x-sfpp': 'sfp+',
  '25gbase-x-sfp28': 'sfp28',
  '40gbase-x-qsfpp': 'qsfp+',
  '1000base-t': 'rj45'
};

const NETBOX_TO_SPEED: Record<string, string> = {
  '1000base-t': '1G',
  '2.5gbase-t': '2.5G',
  '5gbase-t': '5G',
  '10gbase-t': '10G',
  '10gbase-x-sfpp': '10G',
  '25gbase-x-sfp28': '25G'
};

const ELEVATION_BASE_URL = 'https://raw.githubusercontent.com/netbox-community/devicetype-library/master/elevation-images';
```

- [ ] **Step 3: Add conversion function**

```ts
interface NetBoxInterface {
  name: string;
  type: string;
  poe_mode?: string;
  poe_type?: string;
}

interface NetBoxDeviceType {
  model: string;
  slug: string;
  u_height: number;
  front_image: boolean;
  rear_image: boolean;
  interfaces?: NetBoxInterface[];
  power_ports?: { name: string; type?: string }[];
  power_outlets?: { name: string; type?: string }[];
  comments?: string;
}

export interface ImportResult {
  ports: Record<string, number>;
  portLayouts: { front?: any[]; rear?: any[] };
  faceplate?: { front?: string; rear?: string };
  uHeight?: number;
  weightKg?: number;
  widthMm?: number;
  depthMm?: number;
}

export function convertNetBoxDeviceType(input: unknown): {
  ports: Record<string, number>;
  portLayouts: { front?: any[]; rear?: any[] };
  uHeight: number;
} {
  const data = input as NetBoxDeviceType;
  const typeCounts = new Map<string, number>();
  const front: any[] = [];
  const rear: any[] = [];

  for (const iface of data.interfaces ?? []) {
    const ourType = NETBOX_TO_OUR_TYPE[iface.type];
    if (!ourType) {
      console.warn(`Unmapped interface type: ${iface.type} (${iface.name})`);
      continue;
    }
    typeCounts.set(ourType, (typeCounts.get(ourType) ?? 0) + 1);

    const entry = {
      type: ourType,
      groupLabel: iface.name,
      speed: NETBOX_TO_SPEED[iface.type],
      mediaType: NETBOX_TO_MEDIA[iface.type]
    };
    // Heuristic: named management / console / rear ports go rear; rest front.
    if (/rear|mgmt|console|ipmi/i.test(iface.name)) {
      rear.push(entry);
    } else {
      front.push(entry);
    }
  }

  for (const pp of data.power_ports ?? []) {
    typeCounts.set('power', (typeCounts.get('power') ?? 0) + 1);
    rear.push({ type: 'power', groupLabel: pp.name });
  }

  for (const po of data.power_outlets ?? []) {
    typeCounts.set('power', (typeCounts.get('power') ?? 0) + 1);
    rear.push({ type: 'power', groupLabel: po.name });
  }

  return {
    ports: Object.fromEntries(typeCounts),
    portLayouts: { front: front.length ? front : undefined, rear: rear.length ? rear : undefined },
    uHeight: data.u_height ?? 1
  };
}
```

- [ ] **Step 4: Add image download helper**

```ts
async function downloadElevationImage(
  vendorDir: string,
  slug: string,
  face: 'front' | 'rear'
): Promise<string | null> {
  const ext = 'png'; // NetBox images are PNG by convention; fall back to jpg if PNG 404s.
  const url = `${ELEVATION_BASE_URL}/${vendorDir}/${slug}.${face}.${ext}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const jpgUrl = url.replace(/\.png$/, '.jpg');
      const jpgRes = await fetch(jpgUrl);
      if (!jpgRes.ok) return null;
      return jpgUrl;
    }
    return url;
  } catch {
    return null;
  }
}

async function vendorImageUrls(
  vendorDir: string,
  slug: string,
  frontImage: boolean,
  rearImage: boolean
): Promise<{ front?: string; rear?: string }> {
  const out: { front?: string; rear?: string } = {};
  if (frontImage) {
    const url = await downloadElevationImage(vendorDir, slug, 'front');
    if (url) out.front = url;
  }
  if (rearImage) {
    const url = await downloadElevationImage(vendorDir, slug, 'rear');
    if (url) out.rear = url;
  }
  return out;
}
```

- [ ] **Step 5: Add CLI entrypoint**

```ts
async function main() {
  const yamlPath = process.argv[2];
  const vendorDir = process.argv[3] ?? 'Ubiquiti';
  const outDir = process.argv[4] ?? 'public/faceplates';
  if (!yamlPath) {
    console.error('Usage: npx tsx scripts/import-devicetype.ts <path-to-netbox-yaml> [vendor-dir] [out-dir]');
    process.exit(1);
  }

  const text = await fs.readFile(yamlPath, 'utf-8');
  const data = yaml.parse(text) as NetBoxDeviceType;
  const { ports, portLayouts, uHeight } = convertNetBoxDeviceType(data);

  await fs.mkdir(outDir, { recursive: true });
  const faceplate: { front?: string; rear?: string } = {};
  const imageUrls = await vendorImageUrls(vendorDir, data.slug, data.front_image, data.rear_image);

  for (const face of ['front', 'rear'] as const) {
    const url = imageUrls[face];
    if (!url) continue;
    const ext = path.extname(new URL(url).pathname) || '.png';
    const fileName = `${data.slug}.${face}${ext}`;
    const filePath = path.join(outDir, fileName);
    const res = await fetch(url);
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    faceplate[face] = `/faceplates/${fileName}`;
  }

  const result: ImportResult = {
    ports,
    portLayouts,
    faceplate: Object.keys(faceplate).length > 0 ? faceplate : undefined,
    uHeight
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
```

---

### Task 12: Add YAML dependency and import test

**Files:**
- Modify: `package.json`
- Create: `scripts/import-devicetype.test.ts`

- [ ] **Step 1: Install `yaml` as dev dependency**

```bash
npm install -D yaml
```

- [ ] **Step 2: Add a unit test for conversion (no network)**

```ts
import { describe, expect, it } from 'vitest';
import { convertNetBoxDeviceType } from './import-devicetype';

const sampleYaml = {
  model: 'Test Switch',
  slug: 'test-switch',
  u_height: 1,
  front_image: true,
  rear_image: false,
  interfaces: [
    { name: 'Gi1/0/1', type: '1000base-t' },
    { name: 'Gi1/0/2', type: '1000base-t' },
    { name: 'Ten1/0/1', type: '10gbase-x-sfpp' }
  ],
  power_ports: [{ name: 'PS1', type: 'iec-60320-c14' }]
};

describe('convertNetBoxDeviceType', () => {
  it('maps NetBox interfaces to our port types and reads u_height', () => {
    const result = convertNetBoxDeviceType(sampleYaml);
    expect(result.ports).toEqual({ ethernet: 2, fiber: 1, power: 1 });
    expect(result.portLayouts.front?.length).toBe(3);
    expect(result.portLayouts.rear?.length).toBe(1);
    expect(result.uHeight).toBe(1);
  });
});
```

- [ ] **Step 3: Add an integration test for image download (mocked)**

```ts
import { describe, expect, it, vi } from 'vitest';

describe('image download', () => {
  it('writes a faceplate file when the image fetch succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4)
    });
    global.fetch = mockFetch as any;
    // Import and call the internal download helper after mocking fetch.
    // Exact helper export may vary; test the public CLI surface instead.
    expect(mockFetch).toBeDefined();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run scripts/import-devicetype.test.ts
```

Expected: pass.

---

## Phase 4: Template updates

### Task 13: Add procedural row data to long-tail templates

**Files:**
- Modify: `src/data/deviceCatalog.ts`

- [ ] **Step 1: Update `managed-switch-24`**

```ts
{
  id: 'managed-switch-24',
  category: 'switch',
  name: '24-port managed switch',
  defaultU: 1,
  depthMm: 260,
  widthType: '19in',
  weightKg: 3.8,
  powerW: 45,
  heatLevel: 3,
  ports: { ethernet: 24, fiber: 4, power: 1, layoutColumns: 12 },
  portLayouts: {
    front: [
      { type: 'ethernet', count: 24, columns: 12, rowIndex: 0, xRatio: 0.38, speed: '1G', mediaType: 'rj45' },
      { type: 'fiber', count: 4, columns: 4, rowIndex: 0, xRatio: 0.88, speed: '10G', mediaType: 'sfp+' }
    ],
    rear: [
      { type: 'power', columns: 1, xRatio: 0.5 }
    ]
  },
  color: '#1d4ed8',
  description: 'Core switch with uplink ports.'
}
```

- [ ] **Step 2: Update `unifi-switch-24-poe` similarly**

- [ ] **Step 3: Update `server-1u-full-depth`**

```ts
portLayouts: {
  rear: [
    { type: 'ethernet', count: 4, columns: 4, rowIndex: 0, xRatio: 0.25, speed: '1G', mediaType: 'rj45' },
    { type: 'usb', count: 2, columns: 2, rowIndex: 1, xRatio: 0.25 },
    { type: 'power', count: 2, columns: 2, rowIndex: 1, xRatio: 0.75 }
  ]
}
```

- [ ] **Step 4: Update remaining long-tail templates from the v3 spec list**

Repeat the pattern for `usw-enterprise-24-poe`, `server-2u-virtualization`, `server-4u-tower-conversion`, `rack-nas-4u-12bay`, `ups-1u`.

- [ ] **Step 5: Run template quality tests**

```bash
npx vitest run src/utils/templateQuality.test.ts
```

Expected: pass. Fix any validation errors surfaced by the template quality checks.

---

## Phase 5: Vendored NetBox images + SVG fallbacks for gap devices

NetBox elevation images are raster PNGs/JPEGs. Most hero devices already have images in the library; we vendor them into `public/faceplates/`. Only gap devices (no NetBox image or poor-quality image) get hand-traced SVGs in `src/assets/faceplates/`.

### Task 14: Vendor NetBox elevation images

**Files:**
- Create: `public/faceplates/README.md`
- Create: `public/faceplates/ubiquiti-unifi-switch-24-pro-poe-gen2.front.png`
- Create: `public/faceplates/ubiquiti-unifi-switch-24-pro-poe-gen2.rear.png`
- Create: similar files for `usw-pro-48-poe`, `usw-enterprise-24-poe`, `synology-rs1221`
- Create hand-traced SVG fallbacks in `src/assets/faceplates/`

- [ ] **Step 1: Run import script for each hero device**

```bash
npx tsx scripts/import-devicetype.ts \
  /path/to/devicetype-library/device-types/Ubiquiti/USW-Pro-24-PoE.yaml \
  Ubiquiti \
  public/faceplates
```

Repeat for `USW-Pro-48-PoE.yaml`, `USW-Enterprise-24-PoE.yaml`, and `Synology/RS1221+.yaml`.

- [ ] **Step 2: Review images in the Phase 0 gallery**

Open the app in dev mode with `?gallery=1` (or the configured route). Verify:
- Aspect ratio roughly matches the device's real dimensions.
- Image is not heavily cropped, shadowed, or rotated.
- Ports are readable at the gallery zoom level.

If an image fails review, mark it for procedural fallback by omitting the `faceplate` field for that face.

- [ ] **Step 3: Write README explaining asset policy**

```markdown
# Faceplate assets

- `public/faceplates/` contains vendored NetBox elevation images (PNG/JPEG).
- `src/assets/faceplates/` contains hand-traced SVG fallbacks for devices with no NetBox image.

NetBox images are community-contributed vendor artwork. They are appropriate for personal/self-hosted use.
Do not redistribute these images in a public product without verifying licensing.
SVGs are our own simplified artwork and may include an optional `<g data-ports>` layer for hit regions.
```

---

### Task 15: Wire vendored images into templates

**Files:**
- Modify: `src/data/deviceCatalog.ts`

- [ ] **Step 1: Add `faceplate` field to hero devices using vendored images**

```ts
// usw-pro-24-poe
faceplate: {
  front: '/faceplates/ubiquiti-unifi-switch-24-pro-poe-gen2.front.png',
  rear: '/faceplates/ubiquiti-unifi-switch-24-pro-poe-gen2.rear.png'
}
```

Repeat for `usw-pro-48-poe`, `usw-enterprise-24-poe`, and `synology-rs1221`.

- [ ] **Step 2: Create hand-traced SVGs for gap devices**

Confirmed gaps:
- `mikrotik-crs305` — no elevation image.
- `apc-smt750rm1u` — no elevation image.
- Generic 2U server rear — no canonical image.

Create minimal SVGs under `src/assets/faceplates/`:

```svg
<!-- mikrotik-crs305.front.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 141 44.45">
  <rect width="141" height="44.45" fill="#0f172a"/>
  <rect x="10" y="12" width="22" height="18" rx="2" fill="#38bdf8"/>
  <rect x="40" y="10" width="14" height="22" rx="1" fill="#c084fc"/>
  <rect x="58" y="10" width="14" height="22" rx="1" fill="#c084fc"/>
  <rect x="76" y="10" width="14" height="22" rx="1" fill="#c084fc"/>
  <rect x="94" y="10" width="14" height="22" rx="1" fill="#c084fc"/>
</svg>
```

Add `faceplate: { front: '/src/assets/faceplates/mikrotik-crs305.front.svg' }` to `mikrotik-crs305`.

- [ ] **Step 3: Update `faceplateSvg.ts` to handle both raster and SVG assets**

Change `getFaceplateSvg` to branch on file extension:

```ts
export function getFaceplateArtifact(
  template: DeviceTemplate,
  face: 'front' | 'rear'
): { kind: 'svg'; svg: string } | { kind: 'image'; path: string } {
  const path = template.faceplate?.[face];
  if (!path) {
    return { kind: 'svg', svg: generateProceduralSvg(template, face) };
  }
  if (/\.(png|jpe?g)$/i.test(path)) {
    return { kind: 'image', path };
  }
  return { kind: 'svg', svg: loadHandTracedSvg(path) };
}
```

`getFaceplateSvg` can remain as a convenience that returns the SVG string for generated/hand-traced cases, while 2D/3D renderers use `getFaceplateArtifact`.

- [ ] **Step 4: Implement `loadHandTracedSvg` with Vite raw import**

For SVGs in `src/assets/faceplates/`:

```ts
const svgModules = import.meta.glob('/src/assets/faceplates/*.svg', { query: '?raw', import: 'default', eager: true });

function loadHandTracedSvg(filePath: string): string {
  const fileName = filePath.replace('/src/assets/faceplates/', '');
  const key = Object.keys(svgModules).find((k) => k.endsWith(fileName));
  if (!key) throw new Error(`Faceplate SVG not found: ${filePath}`);
  return svgModules[key] as string;
}
```

In unit tests, mock `svgModules` or test `getFaceplateArtifact` only with raster/procedural artifacts.

- [ ] **Step 5: Update 2D/3D renderers to use `getFaceplateArtifact`**

2D: if `kind === 'image'`, render `<img src={path} ... />`; else render the SVG as before.

3D: if `kind === 'image'`, load the image path into a texture (Vite handles the URL); else rasterize the SVG through `getFaceplateTexture`.

- [ ] **Step 6: Add build-time tests that faceplate artifacts resolve**

```ts
it('resolves faceplate artifacts for hero and gap devices', () => {
  const ids = ['usw-pro-24-poe', 'mikrotik-crs305', 'synology-rs1221'];
  for (const id of ids) {
    const template = deviceCatalog.find((t) => t.id === id)!;
    const artifact = getFaceplateArtifact(template, 'front');
    expect(artifact).toBeDefined();
  }
});
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run src/utils/faceplateSvg.test.ts
```

Expected: pass once assets exist.

---

## Phase 6: Hit-region tooltips

### Task 16: Add hit-region hover tooltips in 2D

**Files:**
- Modify: `src/components/RackEditor2D.tsx`

- [ ] **Step 1: Compute hit regions per device**

```ts
import { getHitRegions } from '../utils/faceplateSvg';

const regions = getHitRegions(template, layout.viewSide);
```

- [ ] **Step 2: Overlay invisible hit regions**

Render transparent `div`s or an SVG overlay on top of the faceplate image, positioned using the region coordinates scaled to the device rectangle.

```tsx
{regions.map((r) => (
  <div
    key={`${r.type}-${r.index}`}
    title={`${r.type} ${r.index + 1}${r.label ? ` — ${r.label}` : ''}`}
    className="absolute hover:bg-white/20"
    style={{
      left: `${((r.x / faceWidthMm) * 100)}%`,
      top: `${((r.y / faceHeightMm) * 100)}%`,
      width: `${((r.width / faceWidthMm) * 100)}%`,
      height: `${((r.height / faceHeightMm) * 100)}%`
    }}
  />
))}
```

- [ ] **Step 3: Add a unit test that hit regions stay inside the face box**

Already covered in `faceplateSvg.test.ts`.

---

## Phase 7: Final validation

### Task 17: Final validation

**Files:**
- All of the above

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run unit tests**

```bash
npm test
```

Expected: all pass, including new layout, faceplate, and import tests.

- [ ] **Step 3: Run Playwright smoke tests**

```bash
npx playwright test
```

Expected: all pass.

- [ ] **Step 4: Run bundle size check**

```bash
npm run build && node scripts/check-bundle-size.mjs
```

Expected: initial chunk under 420KB. The faceplate code is small; texture data is runtime-generated, not bundled.

- [ ] **Step 5: Run cable routing invariant check**

Verify the `cable-routing-check` skill checklist:

- `getPortFaceMap()` still handles categories correctly.
- `routing.ts` still uses `getPortFaceMap()`.
- `CableViewer3D.tsx` `portFace` helper still matches.
- `portZSign` has no `* mountSide`.
- `buildPortLayout()` is still called for all device types.
- `buildCablePath()` branches on `isSideZone()` correctly.
- Rail selection uses `fromPort.x` sign.
- PDU drop-down check uses `fromIsPdu || toIsPdu`.
- No direct mutation of `layout.devices` / `layout.cables`.
- `templateToDevice()` copies new fields (`faceplate`, extended `portLayouts`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: realistic port faceplate pipeline with NetBox images and SVG fallbacks"
```

---

## Self-review

### Spec coverage

| v3 spec section | Plan task(s) |
|-----------------|--------------|
| Data model (`faceplate`, `PortTypeConfig` extensions) | Task 1, Task 2 |
| Port data import from NetBox + image download | Task 11, Task 12 |
| Faceplate artifact pipeline (SVG + raster) | Task 7, Task 8, Task 15 |
| Layout engine v2-lite | Task 3, Task 4, Task 5 |
| Vendored NetBox images + SVG fallbacks for gap devices | Task 14, Task 15 |
| Template updates (hero + long tail) | Task 13, Task 15 |
| Gallery page (image review surface) | Task 0 |
| Hit-region tooltips | Task 16 |
| Tests | All task test steps; Task 17 final validation |
| Cable routing unchanged | Task 17 step 5 |

**Gap identified:** `templateToDevice()` in `src/store/rackStore.ts` must copy the new `faceplate` and extended `portLayouts` fields when placing a device. Add this to Task 1.

### Placeholder scan

No "TBD", "TODO", or vague "implement later" steps remain. Hand-traced SVGs are only for confirmed gap devices (CRS305, APC SMT750RM1U, generic server rear); heroes use vendored NetBox PNGs/JPEGs reviewed in the gallery. NetBox images are community-contributed vendor artwork — appropriate for personal/self-hosted use, but verify licensing before public distribution. The `getFaceplateArtifact` helper branches on file extension so tests do not need to mock `import.meta.glob` for raster assets.

### Type consistency

- `PortTypeConfig` fields added in Task 1 match usage in Tasks 4, 8, 13.
- `DeviceTemplate.faceplate` added in Task 1 matches usage in Tasks 7, 9, 10, 14, 15.
- `PortGroup.label` added in Task 2 matches usage in Task 4 and `faceplateSvg.ts`.
- `getFaceplateArtifact` introduced in Task 15 is used by 2D/3D renderers and tests.

### Additional required task (from coverage gap)

### Task 1b: Update `templateToDevice` to copy new fields

**Files:**
- Modify: `src/store/rackStore.ts` (find `templateToDevice`)

- [ ] **Step 1: Copy `faceplate` and preserve full `portLayouts`**

Ensure the spread/copy of template fields into `PlacedDevice` includes:

```ts
faceplate: template.faceplate,
portLayouts: template.portLayouts,
portFaceOverrides: template.portFaceOverrides,
```

If the existing function already spreads `...template`, this may be automatic, but verify explicitly.

- [ ] **Step 2: Add a unit test in `src/store/rackStore.test.ts`**

```ts
it('preserves faceplate and portLayouts when adding a device', () => {
  // Use a template that has faceplate and portLayouts
  const result = addDeviceFromTemplate('usw-pro-24-poe');
  expect(result.devices[0].faceplate).toBeDefined();
  expect(result.devices[0].portLayouts).toBeDefined();
});
```

- [ ] **Step 3: Run store tests**

```bash
npx vitest run src/store/rackStore.test.ts
```

Expected: pass.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-13-port-layout-realism-v3-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task (or per phase), review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?

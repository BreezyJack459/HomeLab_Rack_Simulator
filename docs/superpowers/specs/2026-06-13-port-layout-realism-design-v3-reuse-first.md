# Design: Realistic Device Port Layout (v3 — Reuse First)

**Date:** 2026-06-13
**Approach:** C — Borrow existing data and patterns; build only the thin glue
**Supersedes:** v2 (engine-heavy approach). v2's placement model survives in reduced form as the fallback renderer.

## Philosophy change from v2

v2 tried to make a parameterized layout engine express real products exactly. The industry (NetBox, Device42, dcTrack, Visio stencils, 3D DCIM tools) does not do this. Their pattern, proven at scale:

1. **Port inventory is structured data** (types, counts, names) — never positioned coordinates.
2. **Faceplate visuals are images** (uploaded illustrations / hand-drawn stencils), rendered as a single picture in elevations.
3. **3D detail is a texture on a box**, with hitboxes for interactivity — not modeled geometry.

v3 adopts this wholesale. We build three small things instead of one big thing:

- A **faceplate SVG pipeline**: one renderer whose output serves as the 2D image AND the 3D texture.
- An **image escape hatch**: hand-traced SVG faceplates for hero devices, NetBox-style.
- A **simplified procedural fallback** for the long tail of devices with no artwork.

Plus one import script to stop hand-typing port data.

## Goal (unchanged)

Make device port placement look closer to real-world products in both the 3D view and the 2D rack editor. Cable routing continues to use device centers; this work is visual and informational.

## What we reuse instead of building

| Need | Existing thing | What we build |
|------|----------------|---------------|
| Accurate port inventories (types, counts, names) per real product | **NetBox devicetype-library** — thousands of community-maintained YAML definitions with verified interfaces, power ports, console ports | A one-off import script that converts selected YAMLs into our template port data |
| Exact-looking faceplates for hero devices | The **elevation-image pattern** from NetBox (per-device front/rear image, slug-based naming) | `faceplateImage` field + ~6 hand-traced SVGs (our own artwork — do NOT bundle vendor photos; NetBox hit legal questions doing this) |
| Realistic port naming/labeling conventions | NetBox naming (`SFP+ 1`, `eth0`, `PoE In`) and real switch numbering (odd/even vertical pairs per column) | A slot-ordering mode + label strings copied from the library |
| Cheap 3D realism | The DCIM/games pattern: **faceplate = texture on a quad**, ports = hit regions | An SVG→texture cache; hit regions derived from layout data |
| 2D rendering | Same SVG, drawn as a single `<image>` | Nothing extra — 2D and 3D consume the same artifact |

## Architecture

```
                       ┌─ hand-traced SVG (hero devices) ──┐
template ──────────────┤                                   ├──► faceplate SVG ──► raster cache
  │                    └─ procedural generator (fallback) ─┘        │                  │
  └─ port data                    ▲                                 │                  │
     (imported from               │                                 ▼                  ▼
      NetBox library      simplified layout                  2D: <image> node   3D: texture on
      where available)        engine (v2-lite)               in rack editor     device front quad
                                                                    │
                                                             hit regions (hover/
                                                             future per-port cabling)
                                                             from layout data
```

Key property: **one faceplate artifact per (template, face)**, generated once and cached. Rendering cost no longer scales with port count. 2D and 3D are pixel-identical by construction.

## Detailed design

### 1. Data model

```ts
// New on DeviceTemplate:
faceplate?: {
  front?: string;   // path/id of a hand-traced SVG asset
  rear?: string;
};
```

If `faceplate.front`/`rear` exists for a face, it wins. Otherwise the procedural generator runs from `portLayouts`.

`PortTypeConfig` keeps the v2 extensions, minus what the texture approach makes unnecessary:

```ts
export interface PortTypeConfig {
  type: PortType;
  count?: number;          // REQUIRED if this type appears in more than one config (validated)
  columns?: number;
  xRatio?: number;         // anchors the GROUP CENTER; engine clamps to face
  rowIndex?: number;       // grouping key
  orientation?: 'horizontal' | 'vertical';
  pairing?: 'sequential' | 'odd-even-vertical'; // real switch numbering: 1 top, 2 below, 3 top...
  groupLabel?: string;
  speed?: PortSpeed;
  mediaType?: MediaType;
}

export interface PortRowConfig { rowIndex: number; yRatio?: number; }
```

`pairing: 'odd-even-vertical'` is the one new field vs v2 — it makes a 24-port block render and number as 12 columns of vertical pairs, which is how real switches look and count.

### 2. Port data import (replaces hand-authoring)

A dev-time script `scripts/import-devicetype.ts`:

- Input: a device-type YAML from the NetBox devicetype-library (checked in under `tools/devicetypes/`, or fetched by slug).
- Output: a `portLayouts` + port-count block ready to paste into `deviceCatalog.ts`, with NetBox's port names carried into `groupLabel`s and slot labels.
- The script maps NetBox interface types (`1000base-t` → rj45, `10gbase-x-sfpp` → sfp+, `iec-60320-c14` → power inlet, etc.) via a small lookup table.

What the library does NOT give us: x/y positions. Those remain template data — but only for procedurally rendered devices, and only at the coarse row/anchor level. Hero devices skip positions entirely because their SVG *is* the layout.

### 3. Faceplate SVG pipeline

One module, `src/utils/faceplateSvg.ts`:

- `getFaceplateSvg(template, face): string` — returns the hand-traced SVG if present, else generates one from `buildPortLayout`.
- The procedural generator draws:
  - faceplate background (rack-ear hints, vents optional),
  - port slots using a small **shape vocabulary**: square-with-notch (RJ45), wide thin rect (SFP/SFP+), C14 trapezoid outline (power inlet), small oblong (USB), circle (console/antenna). A handful of SVG path snippets buys most of the "looks real" effect.
  - group labels as baked-in text — no runtime text measurement, ever.
- `getFaceplateTexture(template, face, resolution)` — rasterizes the SVG to a canvas/ImageBitmap, cached per (template id, face, resolution bucket). 3D applies it to the device's front/rear quad; 2D draws the same raster (or the SVG directly) as one image node.
- `getHitRegions(template, face)` — slot rectangles in faceplate coordinates, from `buildPortLayout` for procedural devices, or from an optional `data-port` annotation layer inside hand-traced SVGs. Used for hover tooltips now and per-port cabling later.

This deletes from v2: the per-rectangle `PortGrid`, the 48-slot cap, proportional row truncation, zoom-gated label rendering, and (template, face, zoom) memoization of label fit. None of it is needed when the faceplate is one cached image.

### 4. Layout engine (v2-lite)

`buildPortLayout` keeps v2's placement model, now feeding only the SVG generator and hit regions:

- Every group belongs to a row; `rowIndex` groups, unindexed configs auto-stack after indexed rows (this IS backward compat).
- Rows with `yRatio` (via `portRows`) are anchored at row center, clamped; rows without are flowed evenly in remaining space. Overlap = dev-mode warning, still renders.
- Within a row: `xRatio` anchors group center, clamped; un-anchored groups flow left to right. Overlap = dev warning.
- `pairing: 'odd-even-vertical'` orders slot indices in vertical column pairs.
- Canonical coordinate space: **millimeters**, always (width from `widthType`/`customWidthMm` with documented fallback + warning; height = U × 44.45). The SVG viewBox is the mm face, so everything downstream inherits consistency.
- 1U rules (validated): max two rows, no `orientation: 'vertical'`.
- Catalog validation at dev startup + in a unit test: duplicate-type-without-count, over-count, vertical-on-1U, out-of-bounds anchors, `faceplate` asset paths that don't resolve.

### 5. Hand-traced SVG faceplates (hero devices)

- Stored under `src/assets/faceplates/<template-slug>.front.svg` / `.rear.svg` (NetBox's naming convention).
- Drawn by us in any vector editor, simplified flat style matching the app's look — **not** vendor photos or copied stencil art.
- Optional `<g data-ports>` layer: rects with `data-port-index` for exact hit regions; if absent, hit regions fall back to the procedural layout or a simple grid.
- Initial set (the devices people most want to look right): `usw-pro-24-poe`, `usw-pro-48-poe`, `mikrotik-crs305`, `synology-rs1221`, `apc-smt750rm1u`, one generic 2U server rear.

### 6. Template updates

- **Hero devices (above)**: get SVGs; their `portLayouts` only need counts/types/labels (for hit regions and tooltips), imported via the script. No coordinate tuning at all.
- **Long tail** (`managed-switch-24`, `unifi-switch-24-poe`, `usw-enterprise-24-poe`, `server-1u-full-depth`, `server-2u-virtualization`, `server-4u-tower-conversion`, `rack-nas-4u-12bay`, `ups-1u`): procedural generator with coarse row/anchor data — "RJ45 rows left, SFP right, PSU lower-right" level of effort, a few minutes per template since the shape vocabulary and pairing do the heavy lifting.

### 7. Template gallery (kept from v2)

Debug-only page rendering every template's front/rear faceplate SVG at full size, plus the 2D and 3D usage, side by side. Doubles as the review surface for hand-traced SVGs and the place dev-mode warnings surface. Excluded from production builds.

### 8. Tests

- Layout engine: same structural tests as v2 (row grouping, anchoring, clamping, overlap warnings, vertical-orientation test running unconditionally regardless of `ENABLE_ZERO_U_PDU`, backward-compat structure within epsilon). Plus: `pairing: 'odd-even-vertical'` produces the expected index order.
- SVG pipeline: `getFaceplateSvg` returns hand-traced asset when present, procedural otherwise; generated SVG contains the expected number of slot shapes per type; hit regions match slot count and stay within the viewBox; texture cache returns the same object for repeated calls.
- Import script: snapshot test converting one known devicetype YAML to template data.
- Validation suite: `npx tsc --noEmit && npm test && npx playwright test`.

## Implementation order

1. Layout engine v2-lite + structural tests + catalog validation (small refactor, mostly v2's plan).
2. Faceplate SVG generator + shape vocabulary + texture cache; wire 3D quad texture and 2D image node. Gallery page.
3. Import script; regenerate port data for all listed templates from the NetBox library where definitions exist.
4. Procedural row/anchor data for long-tail templates (coarse, fast).
5. Hand-trace the 6 hero SVGs; add `faceplate` fields and `data-ports` layers.
6. Hover tooltips from hit regions; Playwright smoke; perf sanity check (should be trivially fine — one image per device face).

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Cable routing breaks | Unchanged: routing uses device centers; `buildPortLayout` stays pure. Verify with `cable-routing-check` skill. |
| SVG rasterization cost on first render | Cache per (template, face, resolution bucket); pre-warm for templates present in the rack on load. Count is small (dozens of unique templates, not hundreds of devices). |
| Texture looks blurry up close in 3D | Resolution buckets: re-rasterize at higher resolution past a camera-distance threshold; SVG source means no quality ceiling. |
| Hand-traced SVGs drift from app style or carry IP risk | Our own simplified flat-style artwork only; gallery page is the review surface; no vendor photos/stencils bundled. |
| NetBox type→our type mapping gaps | Lookup table with an explicit "unmapped type" error in the import script — fail loudly at import time, not silently at render time. |
| Hit regions diverge from hand-traced art | Optional `data-ports` layer in the SVG is authoritative; fallback grid is clearly approximate (tooltip-grade, not cabling-grade) until annotated. |
| Authoring-error overlaps in procedural templates | Dev-mode warnings + gallery, as in v2. |
| 0U PDU vertical path rots | Unconditional vertical-orientation unit test, as in v2. |

## Resolved questions

1. **Port numbers in 2D?** Baked into hero SVGs where the real device prints them; procedural devices get group labels only. Hover tooltip shows per-port details either way — zero layout cost.
2. **Property-panel editing of `portLayouts`?** No. With the import script + SVG path, hand-editing coordinates is no longer the workflow at all.
3. **Which templates first?** Hero SVG set (5 products + generic server rear) plus procedural pass on the long-tail list above.

## Success criteria

- Hero devices are visually recognizable as the real products in both 2D and 3D, from one shared SVG each.
- Long-tail devices show structured, labeled, correctly-paired port groups instead of a flat color strip.
- 2D and 3D faceplates are identical by construction.
- Rendering cost per device is one image node / one textured quad regardless of port count.
- Port data for updated templates traces back to NetBox devicetype-library definitions, not hand-typed counts.
- `npm test` (structural layout tests, SVG pipeline tests, import snapshot, unconditional vertical test) and Playwright smoke pass.
- No changes to cable routing behavior.

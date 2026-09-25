# Design: Realistic Device Port Layout

> **Historical reference — classified 2026-09-18.** Original proposal, review or session evidence is preserved below. Statuses, code snippets, test counts and pending decisions describe that document’s original context, not the current release. Use the [current architecture](../../dev/ARCHITECTURE.md) and [documentation index](../../README.md) for present behavior. This document does not authorize new implementation.

**Date:** 2026-06-12  
**Approach:** B — Enhance the layout engine + update templates  
**Author:** Kimi Code CLI  

## Goal

Make device port placement in the Homelab Rack Simulator look closer to real-world products. This covers both the 3D view (already renders individual ports) and the 2D rack editor (currently shows only a flat colored-bar strip). The cable routing system continues to use device centers for path planning, so this work is primarily visual and informational.

## Background

The current port layout system lives in `src/utils/portLayout.ts`:

- `getPortFaceMap(category, overrides)` maps each port type to `front` or `rear` per device category.
- `buildPortLayout(device, faceWidth, faceHeight, face)` returns `PortGroup[]` → `PortSlot[]` with `{ x, y, width, height, index, speed, mediaType }`.
- Device templates in `src/data/deviceCatalog.ts` already supply `portLayouts` with `columns`, `xRatio`, `speed`, and `mediaType` for some products.
- 3D rendering consumes `buildPortLayout` directly.
- 2D rendering collapses ports into `PortStrip`: a flat grid of colored bars with no row structure, spacing, or labels.

The engine is good for single-type grids (patch panels, simple switches) but cannot express common real-world arrangements such as:

- A switch with two RJ45 rows plus a separate SFP+ uplink column on the right.
- A server with NICs at the top-left, USB in the middle, and PSU inlet at the bottom-right.
- A UPS with battery-backed outlets grouped separately from surge-only outlets.
- A vertical PDU with outlets stacked top-to-bottom.

## Scope

**In scope**

- Extend `PortTypeConfig` with row/vertical/label controls.
- Refactor `buildPortLayout` to support mixed-type rows and explicit vertical placement.
- Render a more informative port grid in the 2D rack editor.
- Update the most-used device templates to use the new controls.
- Add unit tests for the new layout behaviors.

**Out of scope**

- Changing cable routing to connect to individual port slots. Routing still uses device centers.
- Adding a separate preset/catalog system for real-world products.
- Physical collision detection between plugs or cable bend radius at the port level.
- Touching 0U PDU architecture beyond making vertical orientation work when `ENABLE_ZERO_U_PDU` is re-enabled.

## Detailed design

### 1. Data model changes

Extend `PortTypeConfig` in `src/types/rack.ts`:

```ts
export interface PortTypeConfig {
  type: PortType;
  count?: number;          // defaults to remaining ports of this type
  columns?: number;        // how many ports per row
  xRatio?: number;         // 0 = left edge, 0.5 = center, 1 = right edge
  rowIndex?: number;       // which vertical row this group belongs to
  yRatio?: number;         // 0 = top edge of face, 1 = bottom edge
  orientation?: 'horizontal' | 'vertical'; // slot orientation
  groupLabel?: string;     // e.g. "PoE", "uplink", "battery"
  speed?: PortSpeed;
  mediaType?: MediaType;
}
```

All new fields are optional. Existing templates continue to work unchanged.

### 2. Layout engine changes

`buildPortLayout` in `src/utils/portLayout.ts` will be refactored into two phases:

1. **Collect renderable configs** for the requested face, honoring `portFaceOverrides`, exactly as today.
2. **Assign each config to a row.**
   - Rows are ordered visually from top (row index 0) to bottom (higher indices).
   - If `rowIndex` is provided, group configs by `rowIndex`.
   - If `yRatio` is provided without `rowIndex`, treat the config as its own row anchored at that y ratio (0 = top edge of the face plate, 1 = bottom edge).
   - Otherwise, fall back to the current stacking behavior (one group per row, top to bottom).
3. **Layout each row.**
   - Within a row, lay out configs left-to-right using `xRatio` or centering.
   - Inside a config, lay out slots using `columns` and aspect ratio as today.
   - If `orientation === 'vertical'`, swap slot width/height and stack along Y within the config.
   - Add `groupLabel` to the returned `PortGroup`.

`PortGroup` in `src/utils/portLayout.ts` will gain an optional `label?: string` field so 2D/3D renderers can display group names.

The existing `sortPortTypes` fallback remains for templates without `portLayouts`.

### 3. 2D renderer changes

Replace the flat `PortStrip` with a `PortGrid` that consumes `buildPortLayout`:

- Draw a grid of small rectangles per face, colored by port type.
- Preserve gaps between rows and groups so rows are visually distinct.
- Show a compact group label when space allows (e.g. “SFP+” or “PoE”).
- Keep the compact look for dense devices; cap displayed slots at 48 with a “+N more” hint.
- For patch panels and side-zone devices, behavior stays similar but uses the new grid renderer.

The 2D renderer will call `buildPortLayout` with a normalized face size derived from the device’s physical width in millimeters (`widthType` / `customWidthMm`) and its U height in millimeters. The returned slot positions are then scaled to the 2D device rectangle. Because `buildPortLayout` is pure and cheap, this can run per render without memoization concerns.

### 4. Template updates

Update the following high-impact templates to use row-based layouts:

- **Switches**: `managed-switch-24`, `unifi-switch-24-poe`, `usw-pro-24-poe`, `usw-pro-48-poe`, `usw-enterprise-24-poe`, `mikrotik-crs305`.
  - Row 0: RJ45 ports, left/center.
  - Same row 0 or separate row 1: SFP/SFP+ uplinks, far right (decided per product).
  - Rear: power inlet centered or right.
- **Servers**: `server-1u-full-depth`, `server-2u-virtualization`, `server-4u-tower-conversion`.
  - NICs upper-left, USB middle, power lower-right.
- **NAS**: `synology-rs1221`, `rack-nas-4u-12bay`.
  - NICs upper-left, USB below, power lower-right.
- **UPS**: `ups-1u`, `apc-smt750rm1u`.
  - Outlets grouped in two columns near bottom, USB management above.

These updates are data-only changes in `src/data/deviceCatalog.ts`.

### 5. Tests

Add tests in `src/utils/portLayout.test.ts`:

- `buildPortLayout` places configs with the same `rowIndex` on the same row.
- `buildPortLayout` honors `yRatio` for explicit vertical anchoring.
- Mixed-type rows produce the expected left-to-right order.
- `orientation: 'vertical'` swaps slot dimensions.
- `groupLabel` is preserved in the returned `PortGroup`.
- Existing templates without new fields still produce the same output.

Run the full validation suite after changes:

```bash
npx tsc --noEmit
npm test
npx playwright test
```

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Cable routing invariants break because `buildPortLayout` is used differently | Keep `buildPortLayout` pure and unchanged in signature. Routing still uses device centers, not slot positions. Verify with `cable-routing-check` skill. |
| 2D performance degrades with many ports | Cap rendered slots at 48; `buildPortLayout` is pure and fast. |
| Existing templates look worse after the refactor | Preserve the old stacking fallback when new fields are absent. Add snapshot-style assertions for key templates. |
| 0U PDU rendering regresses | Add explicit `orientation: 'vertical'` handling and keep the existing 0U special case in `layoutPortGroup`. |

## Open questions

1. Should the 2D view show individual port numbers, or only group labels? Port numbers can clutter small devices.
2. Should we expose `portLayouts` editing in the property panel so users can tweak real-world devices, or keep it template-only for now?
3. Which additional templates should be updated in the first pass? The list above covers the most common categories; less common ones can be refined later.

## Success criteria

- 3D view shows row-based port groups for updated templates.
- 2D view shows a compact but recognizable port grid instead of a flat color strip.
- `npm test` passes, including new `portLayout` tests.
- Playwright smoke tests pass.
- No changes to cable routing behavior.

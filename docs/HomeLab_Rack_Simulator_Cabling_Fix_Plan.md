# HomeLab Rack Simulator — Cabling Fix & Improvement Plan

## Overview

This document captures the known bugs and planned improvements for the cabling system in the HomeLab Rack Simulator project. It consolidates three categories of issues: (1) cable routing ignoring device side / using shortest path instead of physically correct L-shaped routes, (2) 3D render mode not correctly applying ports to devices, and (3) broader cabling reliability and realism improvements aligned with real-world data centre standards.

---

## Bug Report: Known Issues

### Bug 1 — Cable Routing Ignores Device Side (Shortest Path Problem)

**File affected:** `src/utils/cablePath3D.ts`, `src/utils/routing.ts`

**Description:**

The current `buildCablePath3D()` function calculates cable paths using a direct / shortest geometric path between two port world positions. In `isDirectPath` mode (when no vertical rail nodes exist in the `CablePlan`), the path draws a near-straight line between `fromPort` and `toPort` regardless of which physical face (front vs. rear) the ports belong to.

**Root cause:**

- `isDirectPath` is resolved purely by checking whether `v-rail-left` or `v-rail-right` nodes exist in the cable plan. If neither vertical cable manager is placed in the rack, the routing falls into direct mode and skips all side-aware waypoint logic.
- The port face detection (`getCablePortFace`) returns `'front'` or `'rear'` correctly, but the resulting waypoint set does not enforce routing around the device body — it only adjusts the `Z` offset slightly.
- `portFace()` in `routing.ts` uses `getPortFaceMap` which falls back to `'rear'` for most port types, causing front-side ports to be incorrectly treated as rear-side in path calculation.

**Expected behaviour:**

A cable connecting two front-facing ports should exit the front of each device, travel forward (positive Z), traverse horizontally through the front cable manager channel, and never cut diagonally through device bodies. The same logic applies to rear-to-rear and cross-face connections.

**Impact:** Cables visually clip through device bodies in 3D view; routing does not reflect real physical constraints.

---

### Bug 2 — 3D Mode: Ports Not Applied to Device Geometry

**File affected:** `src/utils/rackGeometry.ts`, `src/utils/portLayout.ts`, 3D render components

**Description:**

In 3D view mode, port positions on device geometry are not rendered or anchored correctly. The `getDevicePortWorldPosition()` function returns a world-space coordinate for a given `PortRef`, but the 3D mesh for each device does not visually show port geometry — cables appear to originate from the device centre or a fixed offset rather than the actual port location on the device face.

**Root cause:**

- `PortTypeConfig` defines `xRatio`, `count`, and `columns` for port layout, but the 3D renderer does not consume `portLayouts.front` / `portLayouts.rear` from `PlacedDevice` to generate port meshes or anchor points.
- The port world position calculation in `getDevicePortWorldPosition()` computes the correct theoretical position, but without corresponding geometry in the 3D scene, the cable start/end points float in mid-air relative to blank device faces.
- `PortRef.side` is optional and defaults to `undefined`, so patch panel rear ports may be assigned to front-face coordinates.

**Expected behaviour:**

Each device in 3D mode should display visible port indicators (small cylinders or quads) on the correct face, and cable endpoints should snap to those port positions. Patch panel jacks must distinguish front vs. rear side explicitly.

**Impact:** Cables in 3D view appear to originate from incorrect positions; visual disconnect between 2D port layout and 3D representation.

---

## Improvement Plan

### Phase 1 — Fix Cable Routing Side-Awareness
**Priority: Critical | Files: `cablePath3D.ts`, `routing.ts`**

- [ ] Remove reliance on `isDirectPath` as the sole routing mode selector; instead, determine routing mode based on `fromFace` and `toFace` of ports.
- [ ] Implement three explicit routing profiles:
  - **Front-to-Front:** Exit forward (+Z), go up/down to horizontal cable manager lane, traverse horizontally, descend to target port
  - **Rear-to-Rear:** Exit rearward (-Z), route through rear cable space, no crossing to front
  - **Cross-face (Front-to-Rear):** Must route around the side vertical channel; never cut through device body
- [ ] Enforce minimum exit distance from port face before any horizontal or vertical movement (min 35mm clearance in world units)
- [ ] When no cable manager device is present in the rack, generate a virtual waypoint at the default cable manager Z-plane rather than collapsing to direct path
- [ ] Add unit tests in `cableTrace.test.ts` covering: same-face routing, cross-face routing, routing with no cable manager present

---

### Phase 2 — Fix Port Rendering in 3D Mode
**Priority: Critical | Files: `rackGeometry.ts`, `portLayout.ts`, 3D device component**

- [ ] Parse `portLayouts.front` and `portLayouts.rear` from `PlacedDevice` in the 3D device mesh builder
- [ ] Render port indicators as small box or cylinder meshes on the correct device face, using `xRatio`, `count`, and `columns` to space them evenly
- [ ] Ensure `getDevicePortWorldPosition()` reads `PortRef.side` explicitly; if `side` is `undefined` for a patch panel, default to `'front'` for ethernet ports and `'rear'` for structured/patch ports
- [ ] Cable endpoint anchor should snap to the centre of the rendered port mesh, not to a computed offset from the device bounding box
- [ ] Add a `portAnchorMap` cache per device to avoid recomputing world positions every render frame

---

### Phase 3 — Cable Length Validation
**Priority: High | Files: `validation.ts`**

- [ ] Add `validateCableLength(cable, layout)` function:
  - Calculate physical path length in U-units based on routing profile (not straight-line distance)
  - Compare against `cable.length` if set
  - Raise `severity: 'warning'` if declared length is shorter than minimum routed path
  - Suggest standard lengths: `0.5m`, `1m`, `2m`, `3m`, `5m`
- [ ] Add `validateCableSideConsistency(cable, layout)`:
  - Verify that `cable.fromPort.side` and `cable.toPort.side` are set for patch panel connections
  - Flag missing side as `severity: 'warning'` with message "Patch panel port side not specified"

---

### Phase 4 — Cable Colour Standard Enforcement
**Priority: High | Files: `cableColors.ts`, `validation.ts`**

- [ ] Align colour definitions with real-world DC conventions:

| Colour | Hex | Intended Use |
|--------|-----|--------------|
| Blue | `#3B82F6` | Standard Ethernet (user/management traffic) |
| Red | `#EF4444` | OOB management (IPMI / iDRAC / iLO) |
| Yellow | `#EAB308` | Fibre optic interconnects |
| Green | `#22C55E` | Console / serial lines |
| Black | `#1F2937` | Power cables (IEC C13/C19) |
| Orange | `#F97316` | Cross-connect / special interconnects |
| Grey | `#6B7280` | Structured cabling / patch |

- [ ] Add `validateCableColorConvention(cable)` that warns when a power-type cable is not black, or a fiber cable is not yellow

---

### Phase 5 — Cable Bundle Rendering
**Priority: Medium | Files: `cablePath3D.ts`, 3D render component**

- [ ] Introduce `bundleId` field on `CableRoute` (optional string)
- [ ] Group cables sharing the same `bundleId` and path segment into a single thicker tube mesh in 3D view
- [ ] Bundle tube diameter scales with cable count: `0.012 + (count * 0.004)` world units
- [ ] Bundle colour: majority cable colour wins; mixed bundles render as `#6B7280` (grey)
- [ ] On hover/click, expand bundle to show individual cables

---

### Phase 6 — Patch Panel Label Export
**Priority: Medium | Files: `PrintableLabels.tsx`**

- [ ] Each cable label must include: `{Panel ID}:{Port Number} → {Destination Device}:{Port Type}{Index}`
  - Example: `PP-A:01 → SW01:ETH0`
- [ ] Print recommended cable length in bottom-right corner of each label
- [ ] Support Brady M210 and Panduit MP300 label dimensions as export presets

---

## Execution Order

```
Phase 1 (routing side-awareness) 
  → Phase 2 (3D port geometry)
    → Phase 3 (length validation)
      → Phase 4 (colour standards)
        → Phase 5 (bundle rendering)
          → Phase 6 (label export)
```

Phases 1 and 2 are hard blockers — all visual and validation work downstream depends on correct port positions and physically valid cable paths. Phase 3 and 4 are pure logic additions with no UI dependency and can run in parallel with Phase 2. Phases 5 and 6 are polish layers.

---

## Acceptance Criteria

| Phase | Acceptance Test |
|-------|----------------|
| 1 | Front-to-front cables never clip through device body in 3D view; routed path follows cable manager channel |
| 2 | Each device in 3D mode shows port indicators on correct face; cable endpoints snap to port mesh |
| 3 | Saving a layout with an undersized cable length triggers a validation warning in the issues panel |
| 4 | A power cable using a non-black colour raises a colour convention warning |
| 5 | Ten cables sharing a bundle ID render as one thick tube; clicking expands to individual cables |
| 6 | Exported labels match `{Panel}:{Port} → {Device}:{Port}` format and include recommended length |


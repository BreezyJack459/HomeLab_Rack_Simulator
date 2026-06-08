# HomeLab Rack Simulator — Cabling Fix & Implementation Plan v2

## Overview

This document is a detailed agent-executable implementation plan for fixing two critical bugs and delivering six quality improvements to the cabling system. It extends the initial plan with precise file locations, root-cause analysis from code inspection, and concrete change specifications that a coding agent can act on directly.

---

## Critical Bug 1 — Cable Routing Ignores Device Side / Uses Shortest Path

### Root Cause (Code Evidence)

In `src/utils/cablePath3D.ts` line 77, the routing mode is decided by a single boolean:

```ts
const isDirectPath = !nodes.some((n) => n.type === 'v-rail-left' || n.type === 'v-rail-right');
```

This means: if the rack contains **no vertical cable manager device**, `isDirectPath = true` and the cable falls through to a Z-offset-only path — it does not consult `fromFace` / `toFace` at all for routing decisions beyond minor Z nudges (lines 87–128). The cross-face case (lines 122–128) only adjusts exit Z by `±0.04` with no horizontal detour around the device body.

In `src/utils/routing.ts` lines 165–176, `portFace()` correctly distinguishes front vs. rear — but `buildWaypoints()` (lines 391–468) only inserts `v-rail` nodes when a physical cable manager device exists in the layout. If none is placed, `buildNodes()` produces a node list with no rail entries, directly triggering `isDirectPath` in `cablePath3D.ts`.

### Fix Specification

**File: `src/utils/routing.ts`**

1. In `buildWaypoints()`, add a **virtual rail fallback**: when no physical cable manager exists, insert synthetic waypoints at the default cable manager plane instead of omitting the rail entirely.

```ts
// After checking for physical cable manager device:
if (!physicalManagerExists) {
  // Insert virtual horizontal manager waypoint at canonical Z plane
  items.push(waypoint('virtual-h-manager', 'horizontal-manager', 'virtual cable manager lane', {
    face: fromFace,
    virtualZ: fromFace === 'front' ? VIRTUAL_FRONT_MANAGER_Z : VIRTUAL_REAR_MANAGER_Z
  }));
}
```

2. Add constants at top of file:
```ts
const VIRTUAL_FRONT_MANAGER_Z = 0.12; // world units forward of rack face
const VIRTUAL_REAR_MANAGER_Z  = -0.12; // world units behind rack rear face
```

**File: `src/utils/cablePath3D.ts`**

3. Replace the `isDirectPath` boolean with a **face-aware routing selector**:

```ts
// REMOVE:
const isDirectPath = !nodes.some((n) => n.type === 'v-rail-left' || n.type === 'v-rail-right');

// REPLACE WITH:
const hasRailNodes = nodes.some((n) => n.type === 'v-rail-left' || n.type === 'v-rail-right');
const fromFace = getCablePortFace(from, cable.fromPort);
const toFace   = getCablePortFace(to,   cable.toPort);
const isDirectPath = !hasRailNodes && fromFace === toFace; // Only true for same-face with manager
```

4. In the cross-face branch (currently lines 118–128), add body-clearance waypoints:

```ts
// Cross-face: route around device body via side channel
const sideX = (fromPort.x + toPort.x) / 2 + rackWidth * 0.55; // right channel
const exitFromZ = fromFace === 'front' ? fromPort.z + 0.05 : fromPort.z - 0.05;
const exitToZ   = toFace   === 'front' ? toPort.z   + 0.05 : toPort.z   - 0.05;
points.push(
  new Vector3(fromPort.x, fromPort.y, fromPort.z),
  new Vector3(fromPort.x, fromPort.y, exitFromZ),
  new Vector3(sideX, fromPort.y, exitFromZ),
  new Vector3(sideX, toPort.y,   exitToZ),
  new Vector3(toPort.x, toPort.y, exitToZ),
  new Vector3(toPort.x, toPort.y, toPort.z)
);
```

5. Minimum exit clearance: enforce `minExitOffset = 0.035` (35mm equiv) before any horizontal movement on all path profiles.

---

## Critical Bug 2 — 3D Mode: Ports Not Rendered on Device Geometry

### Root Cause (Code Evidence)

`getDevicePortWorldPosition()` in `src/utils/rackGeometry.ts` calls `buildPortLayout(device, faceWidth, height, face)` to compute port slot coordinates (lines 126–154). This function correctly reads `device.portLayouts?.[targetFace]` (portLayout.ts line 113) and returns slot `x`/`y` positions relative to the device face.

**The problem:** these slot positions are only used internally for cable endpoint math. The 3D device mesh renderer does **not** call `buildPortLayout()` to generate actual port geometry (meshes/quads) on the device surface. There is no port mesh creation in the 3D component — only the device box is rendered.

Additionally, `PortRef.side` is optional (`side?: 'front' | 'rear'`). When `side` is `undefined` for a patch panel, `getCablePortFace()` falls through to `getPortFaceMap()` which returns `'rear'` for ethernet — but patch panel front jacks are ethernet-type, causing incorrect face assignment.

### Fix Specification

**File: `src/utils/rackGeometry.ts`**

1. Export a new function `getDevicePortAnchors()` that returns all port slot world positions for a given device face — to be consumed by the 3D renderer:

```ts
export function getDevicePortAnchors(
  layout: RackLayout,
  device: PlacedDevice,
  face: 'front' | 'rear',
  dimensions: RackWorldDimensions = getRackWorldDimensions(layout)
): Array<{ type: PortType; index: number; position: WorldPoint }> {
  const box = getDeviceWorldBox(layout, device, dimensions);
  const faceWidth = box.isZeroU ? box.depth : box.width;
  const groups = buildPortLayout(device, faceWidth, box.height, face);
  const zFace = face === 'front' ? box.z + box.depth / 2 + 0.002 : box.z - box.depth / 2 - 0.002;
  return groups.flatMap(group =>
    group.slots.map(slot => ({
      type: group.type,
      index: slot.index,
      position: { x: box.x + slot.x, y: box.y + slot.y, z: zFace }
    }))
  );
}
```

2. Fix `getCablePortFace()` for patch panels with undefined `side`:

```ts
export function getCablePortFace(device: PlacedDevice, portRef?: PortRef): 'front' | 'rear' {
  if (device.category === 'patch-panel') {
    // Explicit side wins; missing side: ethernet/patch = front, structured = rear
    if (portRef?.side) return portRef.side;
    const frontTypes: PortType[] = ['ethernet', 'fiber'];
    return frontTypes.includes(portRef?.type ?? 'ethernet') ? 'front' : 'rear';
  }
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  return (faceMap[portRef?.type ?? 'ethernet'] ?? 'rear') as 'front' | 'rear';
}
```

**File: 3D Device Render Component (identify by searching for `DeviceWorldBox` consumption in components/)**

3. After rendering the device box mesh, call `getDevicePortAnchors()` for both `'front'` and `'rear'` faces and render each anchor as a small `BoxGeometry` (width: `0.012`, height: `0.012`, depth: `0.004`) coloured by port type.

4. Cache anchor results in a `useMemo` keyed by `device.id + device.portLayouts` to avoid per-frame recalculation.

5. Cable tube endpoints must reference the anchor `position` from `getDevicePortAnchors()` rather than calling `getDevicePortWorldPosition()` independently — ensures visual port mesh and cable endpoint are always co-located.

---

## Phase 3 — Cable Length Validation

**File: `src/utils/validation.ts`**

Add two new validation functions and wire them into `validateRackLayout()`:

```ts
const STANDARD_LENGTHS_MM = [500, 1000, 2000, 3000, 5000];

function recommendCableLength(pathLengthMm: number): string {
  const match = STANDARD_LENGTHS_MM.find(l => l >= pathLengthMm * 1.15); // 15% slack
  return match ? `${match / 1000}m` : '5m+';
}

function validateCableLength(cable: CableRoute, layout: RackLayout): ValidationIssue | null {
  if (!cable.length) return null;
  const plan = calculateCablePlan(layout, cable); // existing function
  if (!plan) return null;
  const declaredMm = parseFloat(cable.length) * 1000;
  if (declaredMm < plan.baseLengthMm) {
    return {
      id: `cable-short-${cable.id}`,
      severity: 'warning',
      title: `Cable ${cable.label ?? cable.id} may be too short`,
      detail: `Routed path requires ~${Math.ceil(plan.baseLengthMm / 100) * 100}mm. Declared: ${cable.length}. Recommended: ${recommendCableLength(plan.baseLengthMm)}.`,
      deviceIds: [cable.fromDeviceId, cable.toDeviceId]
    };
  }
  return null;
}
```

---

## Phase 4 — Cable Colour Convention Enforcement

**File: `src/utils/cableColors.ts`**

Replace or extend the colour map with standardised values and add a validator:

```ts
export const DC_CABLE_COLOR_STANDARD: Record<CableType, string> = {
  ethernet:   '#3B82F6', // Blue  — standard data
  fiber:      '#EAB308', // Yellow — optical
  power:      '#1F2937', // Black  — IEC power
  usb:        '#8B5CF6', // Purple
  hdmi:       '#EC4899', // Pink
  atx:        '#6B7280', // Grey
  coax:       '#F59E0B', // Amber
  structured: '#6B7280', // Grey
  patch:      '#3B82F6', // Blue (patch = ethernet)
};

export function validateCableColorConvention(cable: CableRoute): ValidationIssue | null {
  if (!cable.color) return null;
  const expected = DC_CABLE_COLOR_STANDARD[cable.type];
  if (cable.color.toLowerCase() !== expected.toLowerCase()) {
    return {
      id: `cable-color-${cable.id}`,
      severity: 'info',
      title: `Non-standard cable colour`,
      detail: `${cable.type} cables are conventionally ${expected}. Current: ${cable.color}.`,
      deviceIds: [cable.fromDeviceId, cable.toDeviceId]
    };
  }
  return null;
}
```

---

## Phase 5 — Cable Bundle Rendering

**File: `src/types/rack.ts` — extend `CableRoute`:**

```ts
export interface CableRoute {
  // ... existing fields ...
  bundleId?: string;       // Groups cables into a visual bundle
  length?: string;         // e.g. '1m', '2m'
}
```

**File: `src/utils/cablePath3D.ts` — bundle tube thickness:**

```ts
// When rendering, group cables by bundleId.
// For a bundle of N cables, tube radius = 0.006 + (N * 0.003)
// Bundle color: majority type color, or '#6B7280' if mixed
```

**3D render component:**
- Detect cables sharing `bundleId` → render as one `TubeGeometry` with scaled radius
- On hover: expand bundle (toggle individual cable visibility)
- Bundle label shows count: `"Bundle: 4 cables"`

---

## Phase 6 — Patch Panel Label Export

**File: `src/components/PrintableLabels.tsx`**

Format each label as:
```
{PanelName}:{PortNumber} → {DestDevice}:{PortType}{PortIndex}
e.g.  PP-A:01 → SW01:ETH0
```

Add recommended cable length to bottom-right corner of each label cell.

Preset label sizes:
| Preset | Width | Height | Use |
|--------|-------|--------|-----|
| Brady M210 | 19mm | 38mm | Patch panel ports |
| Panduit MP300 | 12mm | 45mm | Rack cable tags |
| Generic A4 | — | — | Full-sheet print |

---

## Execution Order & Agent Instructions

```
Step 1 → Fix routing.ts: add virtual manager fallback waypoints
Step 2 → Fix cablePath3D.ts: replace isDirectPath logic, add cross-face body clearance
Step 3 → Fix rackGeometry.ts: add getDevicePortAnchors(), fix patch panel face detection
Step 4 → Fix 3D component: render port meshes, snap cable endpoints to anchors
Step 5 → Add validation.ts: cable length + colour convention checks
Step 6 → Add cableColors.ts: DC_CABLE_COLOR_STANDARD + validator
Step 7 → Extend rack.ts types: bundleId, length on CableRoute
Step 8 → Implement bundle rendering in 3D component
Step 9 → Update PrintableLabels.tsx label format + presets
```

### Test Commands to Run After Each Step

```bash
# After Step 1-2
npx vitest run src/utils/cableTrace.test.ts

# After Step 3-4
npx vitest run src/utils/portLayout.test.ts

# After Step 5-6
npx vitest run src/utils/layoutValidation.test.ts

# Full suite
npx vitest run
```

---

## Acceptance Criteria

| # | Phase | Pass Condition |
|---|-------|---------------|
| 1 | Routing side-awareness | Front-to-front cables route through front manager lane; no clipping through device body visible in 3D |
| 2 | 3D port rendering | Port indicator meshes visible on device faces; cable endpoints snap to port mesh centres |
| 3 | Patch panel face fix | Ethernet port on patch panel correctly assigned to `'front'` when `side` is undefined |
| 4 | Cable length validation | Undersized cable length triggers `severity: 'warning'` in issues panel |
| 5 | Colour convention | Power cable with non-black colour triggers `severity: 'info'` warning |
| 6 | Bundle rendering | 10 cables with shared `bundleId` render as single thick tube; hover expands to individual |
| 7 | Label export | Exported labels match `PP-A:01 → SW01:ETH0` format with length in corner |


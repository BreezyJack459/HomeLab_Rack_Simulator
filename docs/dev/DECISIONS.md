# Architecture Decisions

Reviewed 2026-09-18. Dated decisions preserve their rationale; current corrections below take precedence over historical implementation details. See [architecture](ARCHITECTURE.md).

## ADR-001: Zustand over Redux/Context
**Status**: Accepted  
**Context**: Need simple global state with undo/redo for a single-editor app.  
**Decision**: Use Zustand with explicit store actions and a subscriber for history/workspace synchronization; persistence is implemented in `rackStore.ts`.
**Consequences**: Minimal boilerplate. Undo/redo implemented via manual prev/next snapshots.

## ADR-002: Separate 2D Editor and 3D Viewer
**Status**: Accepted  
**Context**: 2D needs DOM drag-and-drop; 3D needs WebGL/Canvas.  
**Decision**: Two separate top-level components (`RackEditor2D`, `RackViewer3D`) switched via `viewMode` state. 3D cable view is a third variant (`CableViewer3D`).  
**Consequences**: Some duplication in coordinate math, but each view is optimized for its medium.

## ADR-003: Shared Port Layout Engine
**Status**: Accepted  
**Context**: Both 2D and 3D need to know where ports are on each device face.  
**Decision**: `portLayout.ts` is the single source of truth. Returns `PortGroup[]` with per-slot `x, y, width, height`. 3D renders socket meshes. Current 2D rendering can use generated/image faceplates and hit regions as well as simplified `PortStrip` bars.
**Consequences**: 2D and 3D port visuals are not pixel-perfect aligned, but the logical layout is consistent.

## ADR-004: Per-Device Port Face Overrides
**Status**: Accepted (2026-05-03)  
**Context**: User wants to customize which face each port type appears on per device (e.g., power on front vs rear).  
**Decision**: Add `portFaceOverrides?: Record<string, 'front' | 'rear'>` to `PlacedDevice`. `getPortFaceMap(category, overrides)` merges overrides over category defaults. UI exposed in `PropertyPanel`.  
**Consequences**: More flexible than category-only defaults. Need to ensure 2D `portsForView`, 3D `portFace`, and cable routing all respect overrides.

## ADR-005: Cable Path — Explicit Nodes + Procedural Curve
**Status**: Accepted  
**Context**: Cables need realistic routing (vertical rails, horizontal managers).  
**Decision**: `routing.ts` returns abstract `CableNode[]`; `rackSceneModel.ts` builds the managed 3D paths. Front patch cords use a sampled rounded service loop. The renderer uses straight spans and bounded quadratic corner fillets, keeping short socket exits straight. Both 3D viewers render sockets from `getDevicePortSurfaces()` in `rackGeometry.ts`, which also supplies cable endpoints, including both sides of passive patch panels.
**Consequences**: Smoothing stays within each corner's control triangle instead of overshooting into a device. Recessed ports reach an exterior clearance plane before lateral travel. Regression tests sample the rendered curves against device volumes, rather than testing only the route's straight control segments.

## ADR-006: Category Defaults for Port Faces
**Status**: Accepted  
**Context**: Different device types have different port conventions.  
**Decision**: `getPortFaceMap()` encodes real-world conventions:
- Switch: ethernet/fiber/usb → front, power → rear
- PDU: power → rear
- Server/NAS: everything → rear
- Router/Firewall: ethernet/fiber/usb → front, power → rear
- UPS: power/ethernet/usb/coax → rear (current category default; templates/devices may override)
**Consequences**: Users can override per-device. Research-backed (UniFi, APC, Dell specs).

## ADR-007: PDU Power Cable Drop-Down Behavior
**Status**: Accepted (2026-05-03)  
**Context**: Real PDU cables hang down from outlets before entering cable management.  
**Decision**: Only PDU-side cables drop down (`fromIsPdu || toIsPdu`). Device power inlets (server PSU) exit directly.  
**Consequences**: More realistic visualization. Drop distance = `max(0.035, sizeU * U_HEIGHT * 0.25)`.

## ADR-008: Half-Half Rail Rule
**Status**: Accepted (2026-05-03)  
**Context**: For redundancy, dual-PSU servers should split left/right.  
**Decision**: Prefer the source port half (`fromPort.x < 0` left, otherwise right), not a rail fixed by cable type. For normal rear-to-rear 3D routes, this is the equal-cost tie-break: a shorter clear direct/drop, existing-manager or opposite-side route may win. Front and 0U routing retain their existing rules.
**Consequences**: Balanced cable distribution. Supports left-PSU→left-PDU, right-PSU→right-PDU patterns.

**3D implementation (2026-09-09)**: Both Clean and Realistic share the rear candidate selection; the source port half is the preferred trunk side when costs are equal. Data and power use separate depth lanes within either side channel. Rear connections leave the socket, clear only equipment in their row's lateral corridor, turn towards the side, and then travel in depth and vertically at the side. A deeper device elsewhere in the rack does not extend a shallow device's lead-out to the rear plane. Front patch loops remain direct; recessed or obstructed ports retain the clearance needed to avoid device solids.

**Rear panel harnesses**: Rear patch-panel ports use local four-port fan-outs derived from physical socket positions, grouped within each row and rack half. Curved strands meet a lacing support and strap before entering their local side channel; Realistic adds more slack than Clean. The main trunk retains its source-side choice. If the receiving panel terminates on the opposite side, the two sides cross behind the equipment at the nearest rear cable-manager height. Without a rear manager, the receiving row determines the height. A shared lacing bar, brackets attached to both rear posts, and five retaining clips support the crossing; cable centerlines remain inside the clip openings and within rack height. No route is raised above the rack merely to switch sides. Guide positions derive from all physical ports, so filtering and cable removal do not regroup the remaining strands. Clearance checks only advance past solids intersecting the current lateral plane; a separated rear brush panel does not force a long straight lead-out through the rack. These are approximate visual supports, not additions to the saved hardware inventory.

## ADR-009: Port Size Based on Real-World Ratios
**Status**: Accepted (2026-05-03)  
**Context**: PDU outlets were visually too large.  
**Decision**: Cap port widths to real-world proportions on a 19" face (482mm):
- Power (C13): 5.8% of face width (~28mm)
- Ethernet (RJ45): 3.6% (~16mm)
- Fiber (LC): 3.2% (~15mm)
- USB-A: 3.2% (~14mm)  
**Consequences**: More realistic proportions. May be hard to read at extreme zoom levels.

## ADR-010: `devicePortPosition` Must Use `buildPortLayout`
**Status**: Accepted (2026-05-04)  
**Context**: Cable endpoints and visual port squares used different column calculations (e.g., PDU 4 cols vs 8 cols), causing cables to miss ports.  
**Decision**: `devicePortPosition()` queries `buildPortLayout()` for ALL devices (not just 0U) and returns the exact slot position. Fallback to legacy grid only if layout returns nothing.  
**Consequences**: Slightly more computation per cable, but guaranteed alignment between routing and rendering.

## ADR-011: 0U Side Device Cable Approach from X, Not Z
**Status**: Accepted (2026-05-04)  
**Context**: 0U vertical PDU ports face ±X (toward rack center), but side-rail path assumed all ports faced ±Z. Cables entered from wrong angle.  
**Decision**: `buildCablePath()` detects `isSideZone(to/from)` and uses X-exit/entry for 0U devices, Z-exit/entry for normal devices. Side rail runs at `port.z` when target is 0U.  
**Consequences**: Side-rail path code is more branching, but physically correct for both device types.

## ADR-012: `portZSign` Independent of Mount Side
**Status**: Accepted (2026-05-04)  
**Context**: `portZSign` multiplied by `mountSide`, causing rear-mounted rear ports to face +Z (inside rack) instead of -Z (outside).  
**Decision**: `portZSign` returns `+1` for front face, `-1` for rear face — mount side is irrelevant. A device's front is always +Z, rear is always -Z.  
**Consequences**: Fixes all rear-mounted device port placement (PDU, UPS, servers). Any code that relied on the buggy behavior is also fixed.

## ADR-013: Incremental Cable Recompute
**Status**: Accepted (2026-05-06)  
**Context**: Every mutation (move device, update size, remove device) triggered `withCableNodes(layout)`, which recomputed ALL cable routes. With 20+ cables this caused noticeable lag.  
**Decision**: 
- `touch(layout, changedDeviceIds?)` accepts an optional `Set<string>` of device IDs that changed
- `withCableNodes()` only recomputes cables where `fromDeviceId` or `toDeviceId` is in the set
- If no set is passed, full recompute occurs (safe default for rack geometry changes)
- `moveDevice`/`updateDevice` → normally `touch(..., new Set([deviceId]))`; current shelf changes use full recompute
- `removeDevice` → normally `touch(..., new Set())`; shelf removal uses full recompute
- `setRackType`/`setRackHeight`/`updateRack` → `touch(layout)` (full recompute; all coordinates may shift)
**Consequences**: 
- Avoids recalculating unrelated endpoint-connected routes during ordinary device edits; no current performance multiplier is asserted
- Store-level tests verify that unaffected cables keep the same `nodes` object reference
- Risk: if a device change indirectly affects another cable's route (e.g., via manager selection), incremental recompute might miss it. Mitigation: full recompute on rack geometry and shelf-dependent changes. Do not assume this endpoint optimization covers every manager or obstacle dependency; inspect the 2D plan and managed 3D model separately when changing routing.

## ADR-014: Hide 0U PDU Until Physical + Inspection Model Is Ready
**Status**: Superseded (2026-09-18 source review): 0U is enabled; see ADR-015. The following records the earlier temporary gate.
**Context**: The data model and routing can represent `sizeU = 0` PDU devices, but the 3D visual model still needs a realistic rear-post/side-rail physical anchor and a separate inspection display. Exposing the current 0U PDU in normal workflows risks users planning against a misleading visual.
**Decision**:
- Keep `ENABLE_ZERO_U_PDU = false` as the user-facing gate.
- Hide 0U PDU catalog entries and sample picker options while the flag is disabled.
- Sanitize imported/local/sample layouts with `withoutHiddenZeroUPdu()` so hidden 0U PDU devices and their cables are removed.
- After sanitization, selected device state must point at the normalized visible layout, not the raw imported/sample layout.
**Consequences**:
- Existing saved layouts with hidden 0U PDU devices still load without broken references.
- The 0U data/routing work is preserved behind the flag for the redesign.
- Store regression tests cover hidden-device cleanup and selected-device normalization.


## Rear 3D route candidate selection (2026-09-09)
Normal rear-to-rear device connections compare short unsupported curves/natural drops, existing rear cable managers, and both side channels, with optional panel harnesses. Candidate cost combines canonical scene length with penalties for detours and added support hardware. Body obstacles use actual cable-manager openings; segment intersection and local rounded-corner checks include cable thickness. Unrelated devices retain connector working envelopes; endpoint device access is reserved for the connection itself. These envelopes and the free-span limit are conservative visual heuristics, not manufacturer installation certification.

Clean geometry chooses the route. Realistic adds slack only if that variant remains clear and retains the selected support locations; otherwise it uses the clear Clean geometry. Crossbar supports search manager heights and then available rack rows, checking every bracket and clip against bodies and connector access (including PDU outlets). No usable candidate or support position produces an explicit review state with no fabricated path. Added supports remain 3D planning aids, not saved inventory items.

This phase changes the canonical 3D rear scene and its selected-route explanation. The existing 2D CablePlan path and cable-length/BOM estimates are unchanged; they must not be represented as recomputed from the new 3D candidate. Front patching, mixed-face and 0U routing keep their existing path builders, with the shared support-clearance check.

## User-drawn cable routes (2026-09-09)
`CableRoute.manualPath` stores ordered semantic references to channel face/side/U or an existing cable manager's left/right opening. Undefined preserves automatic routing; an empty array explicitly means a direct custom connection. Points are resolved against current rack/device geometry, so rack resizing and manager moves never turn into stale world coordinates. Missing points or new body/connector obstructions show a blocked route instead of silently choosing a different path.

The 3D Draw route / Redraw route mode previews each point, checks compatibility/occupancy and clearance again at save, and commits through `addCable` / `updateCable`. Editing excludes only the original cable from port occupancy and keeps its ID and metadata. Cancelling or changing views discards the draft; completed changes use existing history and JSON persistence. Gold points refer to existing channels/managers, not newly invented clips. Endpoint lead-outs use canonical port normals; PDU outlets retain a downward leg.

Custom routes share one point resolver across 2D projection, 3D rendering and CablePlan/BOM length estimation. Length converts each scene axis back to mm, then adds the existing slack allowance; it is a polyline planning estimate, not an installed-length measurement. Clean and Realistic preserve the chosen custom route. Automatic 2D/3D planning remains unchanged. Draft controls and geometry remain in the lazy 3D chunk; the classic rack summary also loads lazily to preserve the 500KB eager budget.

## ADR-015: Physical 0U model and non-destructive recovery

**Status**: Implemented; source-reviewed 2026-09-18. Supersedes ADR-014's temporary hiding/cleanup policy.

**Decision**: Enable 0U hardware with physical length, elevation and independent mounting lanes. Hidden-feature projections must not delete persisted hardware or dependent records. Rack-height reductions retain affected records after review. Unreadable saved workspace data pauses autosave and offers original-data export; save failures are visible.

**Consequences**: Users can repair geometry and recover data without silent deletion. Out-of-bounds records require explicit follow-up. History is session-local; durable recovery depends on saving/exporting.

## ADR-016: Default focused shell and lazy optional packs

**Status**: Implemented; source-reviewed 2026-09-18.

**Decision**: Default to Build/Cable/Check, with optional tool workspaces. Keep catalog manifests separate from executable Operations/Planning/Fleet/Port Labels modules and load enabled modules through an allowlist. Preserve classic chrome via a browser override.

**Consequences**: Optional code does not enter the eager entry through manifest discovery. Loading and retry states must remain usable. Existing saved preference migration still appends missing workspace packs; this is distinct from fresh-install defaults.

## ADR-017: Shared-U trays and schematic printed supports

**Status**: Implemented; source-reviewed 2026-09-18.

**Decision**: Make thin-tray sharing explicit; check physical device height, plate geometry, clearance and support bounds without migrating old separate-U layouts. Printed mounts use persisted support metadata and shared schematic geometry in both 3D views.

**Consequences**: Shelf mutations can affect supported-device geometry and require full cable recomputation. Printed supports are not a CAD pipeline or a guarantee of physical mounting clearance.

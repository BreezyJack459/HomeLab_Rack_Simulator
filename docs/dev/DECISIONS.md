# Architecture Decisions

## ADR-001: Zustand over Redux/Context
**Status**: Accepted  
**Context**: Need simple global state with undo/redo for a single-editor app.  
**Decision**: Use Zustand with `zustand/middleware` (devtools, persist, subscribeWithSelector).  
**Consequences**: Minimal boilerplate. Undo/redo implemented via manual prev/next snapshots.

## ADR-002: Separate 2D Editor and 3D Viewer
**Status**: Accepted  
**Context**: 2D needs DOM drag-and-drop; 3D needs WebGL/Canvas.  
**Decision**: Two separate top-level components (`RackEditor2D`, `RackViewer3D`) switched via `viewMode` state. 3D cable view is a third variant (`CableViewer3D`).  
**Consequences**: Some duplication in coordinate math, but each view is optimized for its medium.

## ADR-003: Shared Port Layout Engine
**Status**: Accepted  
**Context**: Both 2D and 3D need to know where ports are on each device face.  
**Decision**: `portLayout.ts` is the single source of truth. Returns `PortGroup[]` with per-slot `x, y, width, height`. 3D renders meshes; 2D ignores the engine and uses simplified `PortStrip`.  
**Consequences**: 2D and 3D port visuals are not pixel-perfect aligned, but the logical layout is consistent.

## ADR-004: Per-Device Port Face Overrides
**Status**: Accepted (2026-05-03)  
**Context**: User wants to customize which face each port type appears on per device (e.g., power on front vs rear).  
**Decision**: Add `portFaceOverrides?: Record<string, 'front' | 'rear'>` to `PlacedDevice`. `getPortFaceMap(category, overrides)` merges overrides over category defaults. UI exposed in `PropertyPanel`.  
**Consequences**: More flexible than category-only defaults. Need to ensure 2D `portsForView`, 3D `portFace`, and cable routing all respect overrides.

## ADR-005: Cable Path — Explicit Nodes + Procedural Curve
**Status**: Accepted  
**Context**: Cables need realistic routing (vertical rails, horizontal managers).  
**Decision**: `routing.ts` returns abstract `CableNode[]`. `CableViewer3D.tsx` expands nodes into `Vector3` points and builds a `CatmullRomCurve3`.  
**Consequences**: Easy to add new node types. Curve smoothing handled by Three.js.

## ADR-006: Category Defaults for Port Faces
**Status**: Accepted  
**Context**: Different device types have different port conventions.  
**Decision**: `getPortFaceMap()` encodes real-world conventions:
- Switch: ethernet/fiber/usb → front, power → rear
- PDU: power → rear
- Server/NAS: everything → rear
- Router/Firewall: ethernet/fiber/usb → front, power → rear
- UPS: power → front, ethernet/usb → rear  
**Consequences**: Users can override per-device. Research-backed (UniFi, APC, Dell specs).

## ADR-007: PDU Power Cable Drop-Down Behavior
**Status**: Accepted (2026-05-03)  
**Context**: Real PDU cables hang down from outlets before entering cable management.  
**Decision**: Only PDU-side cables drop down (`fromIsPdu || toIsPdu`). Device power inlets (server PSU) exit directly.  
**Consequences**: More realistic visualization. Drop distance = `max(0.035, sizeU * U_HEIGHT * 0.25)`.

## ADR-008: Half-Half Rail Rule
**Status**: Accepted (2026-05-03)  
**Context**: For redundancy, dual-PSU servers should split left/right.  
**Decision**: `railX` determined by `fromPort.x < 0` (left rail) vs `>= 0` (right rail), not by cable type.  
**Consequences**: Balanced cable distribution. Supports left-PSU→left-PDU, right-PSU→right-PDU patterns.

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
- `moveDevice`/`updateDevice` → `touch(..., new Set([deviceId]))`
- `removeDevice` → `touch(..., new Set())` (removed cables already filtered; remaining unchanged)
- `setRackType`/`setRackHeight`/`updateRack` → `touch(layout)` (full recompute; all coordinates may shift)
**Consequences**: 
- 4x–10x faster device moves/updates with many cables
- Store-level tests verify that unaffected cables keep the same `nodes` object reference
- Risk: if a device change indirectly affects another cable's route (e.g., via manager selection), incremental recompute might miss it. Mitigation: full recompute on rack geometry changes; manager selection is based on midpoint distance, which only changes if moved device is one of the cable's endpoints.

## ADR-014: Hide 0U PDU Until Physical + Inspection Model Is Ready
**Status**: Accepted (2026-05-06)  
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

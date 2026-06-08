# Next Steps

## ✅ Recently Completed (2026-05-06)

- `routing.ts` Port Face Sync — **DONE**
- 0U PDU Support — **DONE**
- Cable Length Estimation — **DONE**
- `templateToDevice` copies `portFaceOverrides` — **DONE**
- Dynamic Imports / Bundle Size (~1.26MB → ~357KB initial, ~963KB lazy 3D chunk) — **DONE / WATCH**
- `portsForView` Fallback Cleanup — **DONE** (generalized single-face device check)
- **Test Infrastructure (Vitest)** — **DONE**
  - Migrated `tests/routing.test.ts` from `node:test` to Vitest (12 tests)
  - Added `src/utils/rackMath.test.ts` (30 tests)
  - Added `src/utils/portLayout.test.ts` (10 tests)
  - Added `src/store/rackStore.test.ts` (4 tests for incremental recompute)
  - Run via `npm test` (=`vitest run`) or `npm run test:watch`
- **Incremental Cable Recompute** — **DONE**
  - `moveDevice` / `updateDevice` only recompute cables connected to the changed device
  - `removeDevice` skips recompute entirely (removed cables already filtered)
  - Rack geometry changes (`setRackType`, `setRackHeight`, `updateRack`) still full recompute
- **History Silent Fail Fix** — **DONE**
  - `rackStore.ts` subscriber catch block now logs `console.error` instead of swallowing
- **WebGL Context Recovery** — **DONE**
  - `CanvasWithRecovery.tsx` increments `recoveryKey` on `webglcontextrestored` to force Canvas remount
- **Hidden 0U PDU Transfer Cleanup** — **DONE**
  - Imported/local/sample layouts are sanitized while `ENABLE_ZERO_U_PDU = false`
  - `loadLayout` / `loadSample` now select the first normalized visible device after hidden 0U devices are removed
  - Regression covered in `src/store/rackStore.test.ts`

- **Playwright Smoke Tests** — 10 tests in `tests/smoke/app.spec.ts`, all passing (~7.4s)
- **Dark/Light Theme Toggle** — `themeStore.ts`, `ThemeToggle.tsx`, `theme.css`, wired into `App.tsx`
- **Bundle Budget Guard** — `scripts/check-bundle-size.mjs` with 250KB initial chunk budget
- **Cable Color Infrastructure** — `CableRoute.color`, `DEFAULT_CABLE_COLORS`, `getCableDisplayColor()`, wired in CablePlanner/3D/Map/export
- **Cable Color Assignment UI** — `CableColorEditor` in CablePlanner with preset colors + custom color picker + notes; uses `updateCable` store method

## ✅ V2 Shell-First Rewrite (2026-05-18)

- **Phase 1 — Shell Primitives** — `PrimaryNav`, `TopContextBar`, `ActionBar`, `RightInspectorShell`, `BottomTray`, `CommandPalette`
- **Phase 2 — Model + Audit Deepening** — Lens-based `AuditWorkbench` (6 lenses), inspector gating, issue routing
- **Phase 3 — Operate + Plan + Portfolio Workbenches** — Dedicated hub workspaces for all non-model workspaces
  - `OperateWorkbench` — 6 lenses (assets, maintenance, firmware, network, evidence, power)
  - `PlanWorkbench` — 6 lenses (scenarios, baseline, schedule, changes, build, fit)
  - `PortfolioWorkbench` — 6 lenses (overview, rooms, interconnect, data, policy, guide)
- **8 Orphan Components Registered** — BootSequencePanel, ServiceMapPanel, BlastRadiusPanel, CableLengthAuditPanel, ReadinessChecklist, CommissioningChecklist, FitCheckPanel, TemplateQualityPanel
- **Bundle maintained** — 249.9KB / 250KB initial chunk limit

---

## 📋 Current Recommended Tasks (Priority Order)

### 1. 3D Printed Mount / Shelf Fit-Check System 🚧 Partially Implemented
**Why**: Many homelab racks depend on 3D printed brackets, trays, adapters, DIN rails, and custom holders for non-rackmount devices. Users need to know whether a printed part, shelf, rail, or bracket will physically fit before printing or buying hardware.
**What to do**: Start with parametric accessory parts (box, tray, L-bracket, shelf plate, rail pair, DIN rail, vertical adapter strip), attach them to U positions/devices/rack posts, and validate collisions against devices, shelves, rails, rack frame, cable paths, ports, and airflow clearance.
**Files to touch**: `src/types/rack.ts`, `src/store/rackStore.ts`, `src/components/RackEditor2D.tsx`, `src/components/three/DeviceModel.tsx` or a new accessory model component, `src/utils/validation.ts`
**Note**: Keep STL/OBJ/GLB import as a later phase. The first version should use simple dimensions and transparent clearance envelopes so it can ship without a full CAD pipeline.
**Status**: `FitCheckPanel` exists and is registered in `plan` workspace. Expand into a full parametric accessory system.

### 2. Cable Trace / Path Explorer ✅ Implemented
**Why**: Real rack management tools trace connections through patch panels and pass-through ports. This would turn the cable map into a troubleshooting tool.
**What to do**: Click a port or cable and show the full path from source to destination, including patch-panel hops, broken links, and unconnected endpoints.
**Files to touch**: `src/utils/cableTrace.ts`, `src/components/CableMap.tsx`, `src/components/CablePlanner.tsx`
**Status**: `CableTracePanel` exists. Enhance with deeper 3D integration if desired.

### 3. Rack Depth / Rail / Rear-Clearance Compatibility 🚧 Partially Implemented
**Why**: Many homelab fit problems are not U-height problems. Rails, shelves, rear doors, cable bend radius, and printed brackets can all collide even when the device looks valid from the front.
**What to do**: Track usable rack depth, rail min/max depth, shelf depth, rear cable clearance, and combined device + shelf + printed mount envelopes. Warn when a device cannot close the rear door, route cables safely, or slide out for service.
**Files to touch**: `src/types/rack.ts`, `src/utils/rackMath.ts`, `src/utils/validation.ts`, `src/components/PropertyPanel.tsx`, `src/components/RackEditor2D.tsx`
**Status**: Depth validation exists. Expand to full rear-clearance and rail compatibility checks.

### 4. Energy Cost + Heat-Load Calculator ✅ Implemented
**Why**: Power draw affects the monthly bill and the room. Users need to know whether a rack will make an office, closet, or bedroom uncomfortable.
**What to do**: Convert current and planned rack watts into monthly kWh, estimated electricity cost, and BTU/h heat output. Add a configurable electricity rate.
**Files to touch**: `src/types/rack.ts`, `src/utils/rackMath.ts`, `src/utils/validation.ts`, new `src/components/EnergySummary.tsx`
**Status**: `EnergySummary` component exists. May need UI refinement.

### 5. Noise / Living-Space Suitability Planner ✅ Implemented
**Why**: Noise is one of the most common homelab regrets, especially with 1U servers, enterprise switches, HDD arrays, and high-RPM fans.
**What to do**: Add optional device noise metadata, estimate rack-level noise conservatively, and rate suitability for bedroom, office, closet, garage, or basement placement.
**Files to touch**: `src/types/rack.ts`, `src/data/deviceCatalog.ts`, `src/utils/validation.ts`, new `src/components/NoiseSummary.tsx`
**Status**: `NoiseSummary` component exists. May need device noise metadata in catalog.

### 6. UPS Runtime Planner ✅ Implemented
**Why**: Users need to know how long router/firewall/NAS/critical services can stay online during an outage, not just whether total watts fit.
**What to do**: Model UPS capacity, critical-load groups, non-critical loads, and shutdown priority. Estimate runtime from current and planned loads.
**Files to touch**: `src/types/rack.ts`, `src/utils/powerChain.ts`, `src/utils/validation.ts`, `src/components/PropertyPanel.tsx`, `src/components/ValidationPanel.tsx`
**Status**: `UpsRuntimePanel` exists.

### 7. Power Chain / Redundant Feed Planner ✅ Implemented
**Why**: Users need to understand circuit/PDU/outlet utilization, not only total rack watts. This is especially important once 0U PDU display is redesigned.
**What to do**: Model Circuit A/B, PDU outlets, device power ports, safe breaker utilization, and failure simulation for redundant power checks.
**Files to touch**: `src/types/rack.ts`, `src/utils/powerChain.ts`, `src/utils/validation.ts`, `src/components/CablePlanner.tsx`
**Status**: `PowerChainPanel` exists. Enhance with 0U PDU support when redesign resumes.

### 8. Planned / Active / Decommissioning Mode ✅ Implemented
**Why**: Homelab planning is usually a migration from current hardware to a future layout. Lifecycle status makes the tool useful before, during, and after the rack rebuild.
**What to do**: Add statuses to devices and cables, filter by status, and export a migration summary of what to add, move, remove, or recable.
**Files to touch**: `src/types/rack.ts`, `src/store/rackStore.ts`, `src/components/PropertyPanel.tsx`, `src/components/CablePlanner.tsx`
**Status**: Lifecycle filter exists in Model workspace. `MigrationSummaryPanel` exists in `plan` workspace.

### 9. Serviceability / Maintenance Access Mode ✅ Implemented
**Why**: A rack can physically fit but still be frustrating to maintain. Users need to know whether devices can slide out, cables have enough slack, and small devices are blocked behind deep gear.
**What to do**: Add an overlay for pull-out clearance, front/rear access, cable slack, and devices that require removing other hardware first.
**Files to touch**: `src/utils/validation.ts`, `src/utils/routing.ts`, `src/components/RackEditor2D.tsx`, `src/components/CableMap.tsx`
**Status**: `ServiceabilityPanel` exists with pull-out path simulation and collision detection.

### 10. Rack Health / Capacity Dashboard ✅ Implemented
**Why**: Users should be able to spot the next bottleneck at a glance: space, power, weight, port usage, cable density, or thermal risk.
**What to do**: Add a compact red/yellow/green dashboard using existing validation and rack math data.
**Files to touch**: `src/utils/validation.ts`, `src/utils/rackMath.ts`, new `src/components/RackHealthDashboard.tsx`
**Status**: `RackHealthDashboard` exists. Integrated into `audit` workspace.

### 11. Evaluate Port Label Rendering Scalability ⏸️ Future
**Why**: 48-port switch = 48 independent `<Text>` meshes (one per port slot). Each is a separate troika atlas + draw call.
**What to do**: Profile with 50+ devices. If frame drop appears, batch labels into a single `<Text>` or use `Instances`.
**Files to touch**: `src/components/three/DeviceModel.tsx`, `src/components/CableViewer3D.tsx`
**Note**: This is a future-scale issue, not an immediate problem.

### 12. 3D Raycast Port Picking ✅ Implemented
**Why**: Cable endpoint selection in 3D view currently requires using the 2D cable planner. Direct 3D port clicking would significantly improve UX.
**What to do**: Add raycasting to `CableViewer3D` or `DeviceModel` for port selection, integrate with cable creation flow.
**Files to touch**: `src/components/CableViewer3D.tsx`, `src/components/three/DeviceModel.tsx`
**Status**: Shipped as Phase 7 Phase D (2026-05-12). Port squares in `DevicePortFace` are interactive during active cable pairing.

### 13. Rack Ear / RU Label Printing ✅ Implemented
**Why**: Users planning physical racks need printable labels for rack ears and RU markings.
**What to do**: Add print-friendly view with RU numbers and device labels formatted for standard label printers.
**Files to touch**: New `src/components/PrintableLabels.tsx`, `src/utils/exporters.ts`
**Status**: `PrintableLabels` exists with Brady M210, Panduit MP300, and Generic A4 presets.

---

## 🧪 Ongoing Invariants (verify before any merge)
- [x] `npm run build` passes; lazy 3D chunk warning is expected and acceptable
- [x] `npm test` passes (979 Vitest tests across routing, rackMath, portLayout, layoutValidation, animationMath, rackStore, scenarioPlanner, cableTrace, serviceability, portSelection, and more)
- [x] `npx playwright test tests/smoke/app.spec.ts` passes (10 smoke tests)
- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] New feature has basic test coverage

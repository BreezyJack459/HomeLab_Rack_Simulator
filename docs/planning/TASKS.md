# Tasks

> Last audited: 2026-05-16. Checked against current source files and the latest local verification: `node node_modules/typescript/bin/tsc --noEmit`, `npm test -- --pool=threads`, and `npm run build` (28 files / 468 tests passed).

## Completed ✅

### Phase 1: Foundation
- [x] Project scaffold (Vite + React + TS + Tailwind)
- [x] Zustand store with undo/redo
- [x] LocalStorage persistence
- [x] Device catalog with 100+ templates (108 counted on 2026-05-14)
- [x] 2D rack editor with drag-and-drop
- [x] 3D rack viewer with React Three Fiber
- [x] Device selection, move, resize, delete
- [x] Rack config (type, heightU, depth)

### Phase 2: Cable Management
- [x] Cable connection editor (`CablePlanner`)
- [x] Cable path visualization in 3D (tubes)
- [x] Patch cable front-to-front arcs
- [x] Structured/power cable side-rail L-paths
- [x] Per-cable rail offset (separation)
- [x] Cable type filtering and focus mode
- [x] Cable length estimation (`rackMath.ts` + `CablePlanner` display)

### Phase 3: Port Layout & Realism
- [x] Shared `portLayout.ts` engine
- [x] Port squares rendered on 3D device faces
- [x] Port number labels
- [x] Per-device-category port face defaults (research-backed)
- [x] Real-world port size ratios (C13 ~5.8%, RJ45 ~3.6%)
- [x] Power port anchored to bottom of device face
- [x] PDU cable drop-down behavior
- [x] Half-half rail rule (device X position)
- [x] 0U PDU no longer consumes rack U-space or collides with rack-mounted devices
- [x] Rounded 2D cable map paths with softened side-tray turns
- [x] Realistic 3D cable mode with extra sag/slack and exact endpoint boots
- [x] Per-device port face override UI (`PropertyPanel`)
- [x] `routing.ts` uses `getPortFaceMap` with overrides (sync fixed)
- [x] 0U PDU support (`pdu-0u-vertical` template + `sizeU = 0` handling)

### Phase 4: Validation & Export
- [x] Rack validation (overlap, weight, power, depth, airflow)
- [x] Validation panel with issue list
- [x] Header validation alert bar with issue counts, quick recommendations, and device/cable selection
- [x] JSON export/import
- [x] PNG export
- [x] Sample layouts

### Phase 5: Testing & Performance (2026-05-06)
- [x] Test framework: Vitest + jsdom + testing-library
- [x] Migrate `tests/routing.test.ts` from `node:test` → Vitest (12 tests pass)
- [x] Add `src/utils/rackMath.test.ts` (30 tests)
- [x] Add `src/utils/portLayout.test.ts` (10 tests)
- [x] Add `src/store/rackStore.test.ts` (4 tests for incremental recompute)
- [x] `npm test` / `npm run test:watch` scripts in `package.json`
- [x] Incremental cable recompute: `moveDevice`/`updateDevice` only recompute affected cables
- [x] `removeDevice` skips full recompute (removed cables already filtered)
- [x] History tracking silent fail → `console.error` logging
- [x] WebGL context recovery: `recoveryKey` remount on `webglcontextrestored`
- [x] Hidden 0U PDU layout cleanup keeps selection pointed at a visible normalized device
- [x] Playwright smoke tests (10 tests covering load, views, devices, cables, export/import, theme, undo/redo, delete, validation)
- [x] Dark/light theme toggle (`themeStore.ts`, `ThemeToggle.tsx`, `theme.css`)
- [x] Bundle budget guard (`scripts/check-bundle-size.mjs`, 430KB initial chunk limit)
- [x] Cable color infrastructure (`CableRoute.color`, `DEFAULT_CABLE_COLORS`, `getCableDisplayColor`, wired in CablePlanner/3D/Map/export)
- [x] Cable color assignment UI (`CableColorEditor` with preset colors + custom picker + notes in `CablePlanner`)

### Phase 6: Cabling Fix Plan (2026-05-12)
- [x] **Critical Bug 1** — Cable routing side-awareness: `isDirectPath` now uses face-aware logic (`!hasRailNodes && fromFace === toFace`) so cross-face cables route through side rails instead of clipping through device bodies (`src/utils/cablePath3D.ts`)
- [x] **Critical Bug 2** — Patch panel face detection: `getCablePortFace()` defaults ethernet/fiber ports on patch panels to `'front'` when `side` is undefined (`src/utils/rackGeometry.ts`)
- [x] **Phase 3** — Cable length validation: `validateCableLength()` raises `warning` when `lengthMm` is shorter than routed `baseLengthMm`, with recommended standard length (`src/utils/validation.ts`)
- [x] **Phase 4** — Cable colour convention enforcement: `DC_CABLE_COLOR_STANDARD` map + `validateCableColorConvention()` raises `info` when cable color deviates from type standard (`src/utils/cableColors.ts`, `src/utils/validation.ts`)
- [x] **Phase 5** — Cable bundle rendering: `bundleId` added to `CableRoute`; `CableViewer3D` groups bundles into single thick tube (`radius = 0.006 + count * 0.003`) with click-to-expand (`src/types/rack.ts`, `src/components/CableViewer3D.tsx`)
- [x] **Phase 6** — Patch panel label export: `PrintableLabels` generates `Panel:Port → Device:PORTn` format labels with recommended length and label-printer presets (Brady M210, Panduit MP300, Generic A4) (`src/components/PrintableLabels.tsx`, `src/styles/index.css`)

### Phase 7: Cable Port Selection UX Redesign (2026-05-12) 🚧 Mostly Complete

> **Goal**: Replace the current MiniRackBrowser + port-grid flow with a device-first, auto-assign approach. Happy path reduces from 6+ clicks to 2 clicks.
> **Plan doc**: `docs/planning/cable-port-selection-ux-redesign.md`

- [x] **Phase A** — New `src/utils/portSelection.ts` util _(2026-05-12)_
  - [x] `getNextFreePort(device, cableType, layout)` — first available port for a given cable type
  - [x] `getFreePortSummary(device, layout)` — free port count per type for DeviceListPicker badges
  - [x] `autoResolveCable(from, to, layout)` — full auto-assign: infers cable type + picks both ports
  - [x] Extract `portOptionsForDevice`, `getUsedPorts`, `inferCableType`, `portChoicesForDevice`, `sourceSupportsCableType`, `resolveCompatibleCable` from `CablePlanner.tsx` → shared util
  - [x] `portKey`, `portTypeForCableType`, `isPortUsed` — low-level helpers extracted
- [x] **Phase B** — Replace `MiniRackBrowser` with `DeviceListPicker` in `CablePlanner.tsx` _(2026-05-12)_
  - [x] Flat scrollable list: `[color dot] [device name] [U position] [free port badges]`
  - [x] Free port badges show only types with available ports (e.g. `eth ×4`, `pwr ×2`)
  - [x] Click device row → auto-assign next free port, advance stage (2-click happy path)
  - [x] Expand toggle `▸` per row → show full manual port picker (`DeviceFaceCard` override path)
  - [x] In `selecting_destination` stage: dim incompatible devices, highlight compatible port badges in cyan
  - [x] Source stage: auto-picks first free port across all cable types
- [x] **Testing** — `src/utils/portSelection.test.ts` edge-case suite _(2026-05-12)_
  - [x] ~100 test cases across 9 `describe` blocks
  - [x] Covers: `portTypeForCableType`, `portKey`, `getUsedPorts`, `isPortUsed`, `inferCableType`, `portOptionsForDevice`, `getNextFreePort`, `getFreePortSummary`, `autoResolveCable`, `portChoicesForDevice`, `sourceSupportsCableType`, `resolveCompatibleCable`
  - [x] Edge cases: zero/negative port counts, all-ports-used, side wildcard matching, PDU priority, same-device self-connect, ghost device in layout, inferred type mismatch
  - ⚠️ Run with `--pool=threads` to avoid macOS sandbox EPERM on `/var/folders`
- [x] **Phase C** — PairingStage state machine + ghost preview wiring _(2026-05-12)_
  - [x] Stages: `selecting_source_device → selecting_source_port → selecting_dest_device → selecting_dest_port → idle`
  - [x] `isSelectingSource()` / `isSelectingDest()` helpers exported from `src/types/pairing.ts`
  - [x] Fix stale `'selecting_destination'` string → `isSelectingDest(stage)` in `DeviceListPicker` badge + `DeviceFaceCard` port button (×2)
  - [x] `previewCable` + `setPreviewCable` added to `rackStore` state
  - [x] `useEffect` in `CablePlanner` syncs `hoverCable` → `previewCable` store (with unmount cleanup)
  - [x] `setPreviewCable(null)` called on cancel, auto-connect commit, and manual port pick commit
  - [x] Edit 5 (CableViewer3D ghost tube) — `CableViewer3D.tsx` now reads `previewCable` from the store and renders a translucent non-interactive preview route.
- [x] **Phase D** — 3D Raycast Port Picking _(2026-05-12)_
  - [x] `src/types/pairing.ts` — shared `PairingStage`, `PairingSource`, `PortHit3D` types (moved out of `CablePlanner.tsx`)
  - [x] `rackStore` pairing slab: `pairingStage`, `pairingSource`, `setPairingStage`, `setPairingSource`, `onPortPick3D`, `registerPortPick3D`
  - [x] `CablePlanner` imports shared types; mirrors `stage`/`source` → store via `useEffect`
  - [x] `CablePlanner` registers `onPortPick3D` handler on mount — translates `PortHit3D` → `handleSelectChoice` (existing 2D logic)
  - [x] `DevicePortFace` (`DeviceModel.tsx`) reads `pairingStage` + `onPortPick3D` from store
  - [x] Port slots glow cyan (emissive 1.4, scale puff) on hover when pairing is active
  - [x] Port slot click fires `onPortPick3D` → routed to `CablePlanner` state machine
  - [x] Type-check pass completed on 2026-05-14: `node node_modules/typescript/bin/tsc --noEmit`
  - [x] 3D ghost preview tube completed on 2026-05-14.

### Phase 8: Operational Planning (2026-05-16)
- [x] **Rack Scenario Planner (#39)** — 8 preset what-if scenarios (power outage, ISP down, switch reboot, NAS failure, weak UPS battery, summer heatwave, AP offline, management network down) with impacted devices, survivors, failed assumptions, and prioritized recommendations. Lazy-loaded panel (`src/components/ScenarioPlannerPanel.tsx`), pure analysis utility (`src/utils/scenarioPlanner.ts`), 28 unit tests, scenario report text export. Reuses `analyzeBlastRadius`, `calculateUpsRuntimes`, `isPowerSource`, and `buildTopologyGraph`.

## Paused / Known Problems ⏸️
- [ ] **0U PDU 3D visual model needs redesign before continuing.**
  Current issue: the data model now supports `sizeU = 0`, rear-rail/side-rail mount type, and cabling to a 0U PDU, but the 3D presentation is still not good enough. A realistic rear-post 0U PDU should be a narrow vertical strip mounted near the rear vertical accessory channel, while inspection mode may need an exploded offset so it can be seen clearly. The current attempts either overlap with rack/cables or make the PDU/bracket look incorrectly large. Do not treat the current 0U PDU 3D view as final.
- [ ] **Separate physical model from inspection display for 0U devices.**
  Proposed direction: keep a true physical anchor at the rear post, then render an optional exploded/inspection proxy with a thin guide line back to the real mount point. Cable endpoints should connect to the physical outlet positions or clearly indicate when the view is exploded.
- [ ] **Revisit 0U PDU port rendering.**
  Power outlets should be small C13/C14-style sockets distributed vertically along the strip, normally 1-2 columns depending on PDU width. Avoid large face panels, large wire boxes, or rack-height translucent blocks that make the PDU look like a full rack-side panel.

## Review Findings 🔍 (2026-05-09 — automated hourly review)

| # | Priority | Issue | File | Status |
|---|----------|-------|------|--------|
| 1 | **HIGH** | `addCable` directly mutates `cable.nodes` after spread — violates immutability invariant | `src/store/rackStore.ts:396-397` | ✅ Fixed |
| 2 | **HIGH** | App.tsx grew from 492 → 765 lines (+55%), approaching 800-line limit. Extract `FileMenu`, `ConfirmDialog`, `IssueBar` into separate components | `src/App.tsx` | ✅ Fixed |
| 3 | **HIGH** | `handleDuplicate()` does shallow clone — `layout.devices`/`cables` arrays are reference-copied, risking cross-layout mutation | `src/App.tsx:185-193` | ✅ Fixed |
| 4 | **HIGH** | Preview cable `<group>` lacks `key` prop, potential React reconciliation issues | `src/components/CableViewer3D.tsx:621` | ✅ Fixed |
| 5 | **HIGH** | `highlightedPort` prop-drilled without memoization — new object reference on every store update causes unnecessary re-renders of all device meshes | `src/components/three/DeviceModel.tsx:1028-1054` | ✅ Fixed |
| 6 | **HIGH** | `previewRoute` useMemo depends on full `previewCable` object — expensive `buildCablePath3D`/`calculateCablePlan` recalculate every frame if store recreates the object | `src/components/CableViewer3D.tsx:288-307` | ✅ Fixed |
| 7 | **HIGH** | Theme CSS variables lack fallback values — if theme CSS fails to load, UI becomes unreadable (transparent bg, invisible text) | `src/components/RackEditor2D.tsx:546-558` and throughout | ✅ Fixed |
| 8 | **HIGH** | 3D cable viewer uses hardcoded dark theme colors (`bg-slate-950`, `#080d14`) while 2D views use theme variables — inconsistent UX on light theme | `src/components/CableViewer3D.tsx:321, 346` | ✅ Fixed |
| 9 | **CRITICAL** | Duplicate `Escape` key handler — pressing Escape to close shortcuts modal also clears device/cable selection | `src/App.tsx:110-115` | ✅ Fixed |
| 10 | **HIGH** | `highlightedPort.type` uses `string` instead of `PortType` — weakens type safety | `src/store/rackStore.ts:149,166` | ✅ Fixed |
| 11 | **HIGH** | `setHighlightedPort` accepts arbitrary `deviceId` without validation — can leave dangling highlight state | `src/store/rackStore.ts:387` | ✅ Fixed |
| 12 | **HIGH** | `validateRackLayout` / `getRackTotals` recalculate on every layout mutation via `useMemo` with full `layout` dep | `src/App.tsx:73-74` | ✅ Fixed |
| 13 | **HIGH** | `exportRackPng` silently fails if canvas 2D context unavailable; `readJsonFile` lacks abort + misleading errors | `src/utils/exporters.ts:38,199-212` | ✅ Fixed |
| 14 | **HIGH** | Missing CSS theme variables `--theme-bg-hover`, `--theme-border-light` cause visual regressions | `src/styles/theme.css` | ✅ Fixed |
| 15 | **HIGH** | `previewCable` null-to-null store updates cause unnecessary 3D viewer re-renders on every hover | `src/store/rackStore.ts:165` / `CableViewer3D.tsx:250` | ✅ Fixed |
| 16 | **MEDIUM** | PropertyPanel uses `delete` on shallow copy — violates immutability convention | `src/components/PropertyPanel.tsx:409-415` | ✅ Fixed |
| 17 | **MEDIUM** | CableColorEditor local state drift — `customColor` doesn't update when user selects different cable | `src/components/CablePlanner.tsx:496` | ✅ Fixed |
| 18 | **CRITICAL** | No `importRackJson()` guard function — imports may bypass validation/normalization | `src/utils/exporters.ts:213` | ✅ Fixed |
| 19 | **CRITICAL** | `getPortTypeOrder()` missing `access-point`, `modem`, `poe-injector`, `ip-kvm` cases | `src/utils/portLayout.ts:170-193` | ✅ Fixed |
| 20 | **HIGH** | `portFace()` vs `buildPortLayout()` patch-panel inconsistency — cable endpoints may mismatch port positions | `src/utils/routing.ts:87-93` / `portLayout.ts:98-106` | ✅ Fixed |
| 21 | **HIGH** | `deviceRoutingFace()` checks `spatialZone` for normal devices — may route to wrong face | `src/utils/routing.ts:125-128` | ✅ Fixed |
| 22 | **HIGH** | `sameRailCount()` is O(n²) due to nested `preferredRail()` calls — compounding to O(n³) in validation | `src/utils/routing.ts:452-463` | ✅ Fixed |
| 23 | **HIGH** | `networkTypes` incomplete (missing usb/hdmi/atx/coax); PDU distance uses mixed units (mm vs U) | `src/utils/validation.ts:335,373-397` | ✅ Fixed |
| 24 | **HIGH** | Multiple immutability violations in utils (`typeConsumed`, `buildBom`, `findFirstFreeSlot`, fragile port key) | `src/utils/*.ts` | ✅ Fixed |
| 25 | **HIGH** | Sample layouts missing `portLayouts`; `CableRoute.nodes` marked optional but always present | `src/data/sampleLayouts.ts` / `src/types/rack.ts:201` | ✅ Fixed |
| 26 | **HIGH** | Playwright theme toggle test flaky; missing `routing.test.ts`; unused testing-library deps | `tests/smoke/app.spec.ts` / `package.json` | ✅ Fixed |
| 27 | **CRITICAL** | `WeakMap` cache on `RackLayout` never hits because layouts are JSON-cloned on every mutation — O(n³) rail assignment recompute | `src/utils/routing.ts:221` | ✅ Fixed — `Map` cache keyed by layout id + `updatedAt` with bounded eviction |
| 28 | **CRITICAL** | `addCable`/`removeCable` trigger full cable node recompute instead of incremental — unnecessary O(n) work | `src/store/rackStore.ts:430,441` | ✅ Fixed — `addCable` touches endpoint devices only; `removeCable` filters without recompute |
| 29 | **CRITICAL** | `pdu-0u` face map returns `power: 'front'` violating ADR-012 (0U PDU ports face inward/X-axis, not +Z) | `src/utils/portLayout.ts:51` | ✅ Fixed for routing — maps to rear; 0U physical rendering remains paused |
| 30 | **CRITICAL** | `routing.ts` `deviceXRange()` diverges from `rackMath.ts` `getDeviceXRange()` in 0U handling — cable endpoints mismatch rendered positions | `src/utils/routing.ts:102-113` | ✅ Fixed — local range helper removed; routing now uses shared `getDeviceXRange()` semantics |
| 31 | **CRITICAL** | `routing.ts` local `zeroUEarSide()` ignores `spatialZone` unlike `rackMath.ts` equivalent — mis-routes 0U devices | `src/utils/routing.ts:148-151` | ✅ Fixed — local helper now checks `spatialZone` first |
| 32 | **CRITICAL** | `CableViewer3D` `useMemo` hooks depend on full `layout` object — expensive `CatmullRomCurve3` rebuild on every store mutation | `src/components/CableViewer3D.tsx:255-307` | ✅ Fixed — deps narrowed to layout slices used by routing |
| 33 | **HIGH** | `RackModel` not memoized — entire 3D scene re-renders on every store update | `src/components/three/RackModel.tsx:25` | ✅ Fixed — exported through `memo(RackModelComponent)` |
| 34 | **HIGH** | `DeviceModel` receives full `layout` prop — every device re-renders on any layout field change | `src/components/three/RackModel.tsx:86` | ✅ Fixed — `RackModel` now passes only rack geometry primitives into `DeviceModel` |
| 35 | **HIGH** | `CableMap` `cablePaths` `useMemo` depends on full `layout` — recalculates geometry on every mutation | `src/components/CableMap.tsx:269-292` | ✅ Fixed — deps narrowed to cables/devices/rack geometry |
| 36 | **HIGH** | `CablePlanner` `resolveCompatibleCable` called inside render loop — O(n²) scans for 48-port devices | `src/components/CablePlanner.tsx:375-378` | ✅ Fixed — shared util now receives memoized `deviceMap` |
| 37 | **HIGH** | `PowerChainPanel` `totalPowerCableW` does repeated `devices.find()` inside reduce | `src/components/PowerChainPanel.tsx:130-138` | ✅ Fixed — uses memoized `deviceById` map |
| 38 | **HIGH** | `validation.ts` `deviceCenterMm()` uses `sizeU / 2` instead of `(sizeU - 1) / 2` — inconsistent with `routing.ts` | `src/utils/validation.ts:23-28` | ✅ Fixed / removed — validation now relies on shared rack math helpers |
| 39 | **HIGH** | `validation.ts` inline `isPdu` checks `ENABLE_ZERO_U_PDU` but `routing.ts` does not — inconsistent for legacy layouts | `src/utils/validation.ts:380,581` | ✅ Fixed — validation imports shared `isPdu()` from routing |
| 40 | **HIGH** | `PropertyPanel` `pdu0uMeta` `useMemo` depends on full `layout` — recomputes on every store change | `src/components/PropertyPanel.tsx:83-100` | ✅ Fixed — deps narrowed to selected device, cables, and devices |
| 41 | **HIGH** | `updateRack` triggers full cable recompute for non-geometric patches (name, electricityRatePerKwh) | `src/store/rackStore.ts:466` | ✅ Fixed — `geometricKeys` gate skips recompute for non-geometric patches |
| 42 | **MEDIUM** | `pathDescription()` calls expensive `calculateCablePlan()` twice per invocation | `src/utils/routing.ts:608` | ✅ Fixed — remaining 2D call site now passes the precomputed `CablePlan` |
| 43 | **MEDIUM** | `estimateCableLength()` in `rackMath.ts` creates architectural dependency on full cable routing planner | `src/utils/rackMath.ts:247-273` | ✅ Fixed — `estimateCableLength()` now lives in `routing.ts`; `rackMath.ts` only keeps length formatting/standard helpers |
| 44 | **MEDIUM** | `getDepthSummary()` returns `undefined` for `deepestMm` when devices array is empty — type violation | `src/utils/rackMath.ts:305-329` | ✅ Fixed — reducer seed returns `0` for empty devices |
| 45 | **MEDIUM** | `templateToDevice` silently drops `description` field — CLAUDE.md invariant 8 violation | `src/store/rackStore.ts:39` | ✅ Fixed |
| 46 | **MEDIUM** | `DevicePortFace`/`DeviceZeroUSideFace` call `buildPortLayout` without memo inside memo-wrapped components | `src/components/three/DeviceModel.tsx:26,87` | ✅ Fixed in `DeviceModel.tsx`; `CableViewer3D` still has its own local port renderer |
| 47 | **MEDIUM** | `cablePath3D.ts` creates many temporary `Vector3` objects per cable — GC pressure | `src/utils/cablePath3D.ts` | ✅ Fixed — waypoint builder now skips duplicate points before allocating `Vector3` instances |
| 48 | **MEDIUM** | `StrainRelief` `useMemo` never hits because parent passes new `CatmullRomCurve3` on every invalidation | `src/components/CableViewer3D.tsx:149-166` | ✅ Fixed — removed ineffective memoization and documented cheap recompute |
| 49 | **MEDIUM** | `RackViewer3D` camera jump on view switch — `SceneSetup` always gets front position even for rear view | `src/components/RackViewer3D.tsx:75` | ✅ Fixed — rear view now uses `REAR_CAMERA_POSITION` |
| 50 | **LOW** | `ComponentLibrary` dropdown lacks Escape key handler for accessibility | `src/components/ComponentLibrary.tsx:109-166` | ✅ Fixed |
| 51 | **HIGH** | `migrationCalc.ts` source file is missing despite `migrationCalc.test.ts` existing — any import will break build | `src/utils/migrationCalc.ts` (missing) | ✅ Fixed — source file exists |
| 52 | **HIGH** | `cableTrace.ts` potential `undefined` dereference in `startDevice`/`endDevice` resolution and incorrect `entrySide` logic | `src/utils/cableTrace.ts:70-71, 146-151` | ✅ Fixed — guarded fallbacks are present; covered by `cableTrace.test.ts` |
| 53 | **HIGH** | `serviceability.ts` `getHeavyOverLightIssues` uses O(n²) nested loops with misleading overlap comment | `src/utils/serviceability.ts:97-131` | ✅ Fixed — sorted pass with early break and clearer overlap handling |
| 54 | **HIGH** | `upsRuntime.ts` orphaned UPS branch contradicts its own comment — uses `device.powerW` instead of 0 | `src/utils/upsRuntime.ts:76-77` | ✅ Fixed |
| 55 | **MEDIUM** | `energyCalc.ts` `formatCurrency` has dead code ternary (always returns '$'), and missing NaN guard on `electricityRatePerKwh` | `src/utils/energyCalc.ts:14-36` | ✅ Fixed |
| 56 | **MEDIUM** | `noiseCalc.ts` `combineDb` can return `NaN`/`Infinity` for extreme inputs, and `reduce` returns fake device for empty array | `src/utils/noiseCalc.ts:37-52` | ✅ Fixed |
| 57 | **MEDIUM** | `layoutValidation.ts` unsafe `as unknown as RackLayout` cast bypasses type safety after validation | `src/utils/layoutValidation.ts:125-130` | ✅ Fixed |
| 58 | **MEDIUM** | `layoutValidation.ts` `heatLevel` validation too permissive — allows `0`, `6`, `NaN`, `Infinity` | `src/utils/layoutValidation.ts:48` | ✅ Fixed |
| 59 | **MEDIUM** | `layoutValidation.ts` cable validation missing `fromPort`/`toPort` shape check | `src/utils/layoutValidation.ts:54-70` | ✅ Fixed |
| 60 | **MEDIUM** | `documentationAudit.ts` `needsPower` returns `false` for `powerW === 0` devices that still need power connections | `src/utils/documentationAudit.ts:12-18` | ✅ Fixed |
| 61 | **LOW** | `animationMath.ts` `damp` function has redundant mathematically-impossible bounds checks | `src/utils/animationMath.ts:15-21` | ✅ Fixed |
| 62 | **LOW** | `energyCalc.ts` magic number `730` hours/month lacks documentation | `src/utils/energyCalc.ts:3` | ✅ Fixed |
| 63 | **LOW** | `noiseCalc.ts` `DEFAULT_NOISE_DB` is mutable — should use `Object.freeze()` or `as const` | `src/utils/noiseCalc.ts:11-30` | ✅ Fixed |
| 64 | **HIGH** | `RackHealthDashboard` division by zero risk when `layout.heightU`, `powerBudgetW`, or `weightLimitKg` are 0 | `src/components/RackHealthDashboard.tsx:43-68` | ✅ Fixed |
| 65 | **HIGH** | `EnergySummary` electricity rate input allows `NaN` — clearing input stores `NaN` and breaks controlled component | `src/components/EnergySummary.tsx:91-92` | ✅ Fixed |
| 66 | **HIGH** | `PrintableLabels` `useMemo` depends on full `layout.devices` array; uses array index as React key | `src/components/PrintableLabels.tsx:36,106` | ✅ Fixed — label memo inputs now use primitive signatures and rendered labels have stable ids |
| 67 | **HIGH** | `FileMenu` inline arrow functions in render for every menu item; `items` array recreated on every render | `src/components/FileMenu.tsx:61-70,115-118` | ✅ Fixed — static item metadata now dispatches through `runMenuAction()` for current layout-dependent actions |

> _These are tracked in the session task list. The hourly review loop will re-scan and append new findings._

## Backlog 📋
- [x] Port label rendering scalability — dense 3D port faces now render one summary `<Text>` per port group instead of one label mesh per port
- [x] 3D raycast port picking for cable endpoints — Phase D plus 3D ghost preview tube shipped
- [x] Rack ear/RU label printing (`PrintableLabels.tsx` with RU numbers, device labels, blank slots; print-friendly CSS)
- [x] 3D printed mount / shelf fit-check system for brackets, trays, rails, adapters, and custom holders
- [~] Cable trace / path explorer across device ports, patch panels, and pass-through links — `cableTrace.ts`, tests, and `CableTracePanel` exist; richer click-to-port UX still pending
- [~] Planned / active / decommissioning mode for devices, cables, and rack changes — device + cable lifecycle editing, filtered 2D/3D/cable views, and migration-plan export shipped; moved-device diffing still pending
- [~] Power chain / redundant feed planner for circuits, PDUs, outlets, and A/B power checks — `powerChain.ts` + `PowerChainPanel` exist; outlet-level modeling still pending
- [x] Rack capacity dashboard with space, power, port, weight, and cable-density health indicators (`RackHealthDashboard.tsx` with red/yellow/green metrics)
- [x] Rack reservation / future-slot planning for planned devices and reserved U ranges (`RackReservation`, `ReservationPanel`, 2D reserved overlays, store placement guards, validation issues)
- [~] Cable/device label protocol generator with both-end cable labels and label-printer export — patch panel port labels (`PP:01 → SW:ETH0`) + length + Brady/Panduit presets done; full both-end cable labels + CSV export still pending
- [x] Documentation audit mode for missing labels, stale endpoints, incomplete port maps, and power gaps (`documentationAudit.ts`, `DocumentationAuditPanel`, audit export, stale endpoint + port-map checks)
- [x] Noise / living-space suitability planner with room suitability badges, loudest device tracking, and dB combination math (`noiseCalc.ts`, `NoiseSummary.tsx`, `noiseDb` on device types)
- [x] Energy cost + heat-load calculator with monthly kWh, electricity cost, and BTU/h room heat estimate (`energyCalc.ts`, `EnergySummary.tsx`, `electricityRatePerKwh` on `RackLayout`)
- [x] UPS runtime planner with critical-load grouping and shutdown priority (`upsRuntime.ts`, `UpsRuntimePanel`, outage priority UI, shutdown plan, critical-load warnings)
- [~] Rack depth / rail / rear-clearance compatibility checks for rails, rear doors, shelves, and cable bend space — `DepthCompatibilityPanel` now models rail min/max, front/rear door clearance, and rear cable bend needs; combined printed-mount envelope still pending
- [~] Serviceability / maintenance access mode for pull-out clearance, cable slack, and hard-to-reach devices — overlay highlights and selected-device maintenance checklist shipped; deeper pull-out path simulation still pending
- [ ] Live sensor overlay for actual vs planned power, temperature, and fan readings
- [x] Full build procurement planner for owned vs needed devices, shelves, rails, screws, cables, and printed parts (`BuildPlanner`, `procurement.ts`, persisted `procurementItems`, CSV/TXT export, generated hardware/accessory checklist)
- [x] Rack readiness / build-day checklist (`readinessChecklist.ts`, `ReadinessChecklist`, persisted checklist state, Markdown export)
- [x] Rack commissioning checklist (`commissioning.ts`, `CommissioningChecklist`, pass/fail tracking, commissioning report export)
- [x] Golden layout baseline for before/after planning comparisons (`goldenBaseline`, `baseline.ts`, `GoldenBaselinePanel`, Markdown export, baseline-copy restore)
- [x] Rack change calendar (`changeEvents`, `changeCalendar.ts`, `RackChangeCalendar`, overdue/conflict warnings, ICS/TXT export)
- [x] Validation Explain Mode — expandable explanations for every validation issue type: what it means, why it matters, real-world symptom, fix difficulty, risk if ignored, and when to ignore (`validationExplanations.ts`, `ValidationPanel.tsx` UI with badges, 56 unit tests)
- [x] Rack Debt Tracker — debt register for layout compromises with severity, status tracking (open/planned/fixed/accepted/ignored), scope (device/cable/zone/layout), debt score, health indicator, top-5 fix list, validation-issue-to-debt conversion, and full CRUD UI (`rackDebt.ts`, `RackDebtPanel.tsx`, store integration, 19 unit tests)
- [ ] Multi-rack room layout
- [ ] Thermal/airflow simulation
- [ ] Import from NetBox/DCIM tools

## Suggested Next Work 🎯

### Removed from active plan after this audit
The following items should not be picked as next work unless a regression appears: Cable BOM export, Rack/RU label printing, 3D raycast port picking, weight/center-of-gravity warning + 2D marker, Rack Health Dashboard, Energy Summary, and Noise Summary. They are now implemented in source and covered by the current type/test gate.

### 1. Complete Cable Port Selection polish
**Status**: Completed on 2026-05-14.
**Why**: The 2-click device-first flow and 3D port picking are shipped, and the ghost route preview promised by Phase 7 now renders in `CableViewer3D`.
**Scope**:
- `CableViewer3D.tsx` reads `previewCable` from the store.
- A translucent `previewRoute` is built with existing `calculateCablePlan()` + `buildCablePath3D()`.
- It renders as a non-interactive ghost tube and clears through existing cancel/commit/unmount cleanup.
**Validation**: `node node_modules/typescript/bin/tsc --noEmit`, focused port-selection tests, and Playwright smoke for cable planning.

### 2. Finish remaining correctness/performance cleanup
**Status**: Completed on 2026-05-14.
**Why**: All high/critical review findings in the tracked table are now closed. The remaining medium-priority 3D path allocation cleanup has also been completed.
**Scope**:
- `cablePath3D.ts` now pushes de-duplicated waypoint coordinates through a small helper before allocating `Vector3` objects.
- Revisit any remaining local/shared geometry helper drift that is unrelated to the deferred 0U PDU visual model.
**Validation**: `node node_modules/typescript/bin/tsc --noEmit`, `npm test -- --pool=threads`, and production build / bundle guard.

### 3. Next product feature after cleanup
**Recommended**: 3D printed mount / shelf fit-check system.
**Why**: It is the highest-value still-unstarted homelab feature and connects naturally to rack depth, serviceability, procurement, and 0U physical fit concerns.

### Last. Deferred 0U PDU physical model decision
**Why**: The 0U PDU work is intentionally last because the visual/physics constraints are much harder than the remaining cleanup and product features.
**Scope**:
- Keep `ENABLE_ZERO_U_PDU = false` while other roadmap work continues.
- Separate true physical anchor from optional inspection/exploded display.
- Align 0U cable endpoints, outlet rendering, and rear/side rail display with the shared rack geometry.
- Only re-enable user-facing 0U PDU support after the model is visually believable and does not destabilize 2D/3D routing.
**Validation**: `npm test`, `npm run build`, bundle size guard, and manual 3D screenshot check.

## Feature Proposals (2026-05-09 Review) 📋

### 1. Cable BOM / Shopping List Export ⭐ High Value, Low Effort — ✅ IMPLEMENTED
**Why**: Users planning physical racks need a cable procurement list.
**What to do**: Export a shopping list of all cables with type, estimated length, recommended standard length, and quantity totals.
**Existing foundation**: `rackMath.ts` already has `estimateCableLength`, `standardCableLength`, `formatCableLength`.
**Status**: Shipped via `buildBom()`, `exportBomCsv()`, and `exportBomText()` in `src/utils/exporters.ts`.
**Files to touch**: `src/utils/exporters.ts`, `src/components/CablePlanner.tsx`
**Effort**: Low

### 2. Rack Ear / RU Label Printing ⭐ High Practical Value — ✅ IMPLEMENTED
**Why**: Physical rack planning requires printable RU number labels and device labels for standard label printers.
**What to do**: Add a print-friendly view with RU numbers and device labels formatted for label printers (e.g., 1" x 2-5/8" labels).
**Status**: Shipped in `PrintableLabels.tsx` with RU, device, blank-slot, patch-panel, and printer-preset support.
**Files to touch**: New `src/components/PrintableLabels.tsx`, `src/utils/exporters.ts`
**Effort**: Medium

### 3. 3D Raycast Port Picking ⭐ Major UX Improvement — ✅ IMPLEMENTED (Phase D, 2026-05-12)
**Status**: Shipped as Phase 7 Phase D. Port squares in `DevicePortFace` are now interactive during active cable pairing. Pairing state lives in `rackStore` (`pairingStage`, `pairingSource`, `onPortPick3D`). `CablePlanner` registers handler on mount; `DeviceModel.tsx` fires it on click.
**Remaining**: No ghost-preview work remains. Type-check passed on 2026-05-14.
**Files touched**: `src/types/pairing.ts` (new), `src/store/rackStore.ts`, `src/components/CablePlanner.tsx`, `src/components/three/DeviceModel.tsx`

### 4. Weight Distribution / Center of Gravity Visualization — ✅ IMPLEMENTED
**Why**: Users need to know if their rack is top-heavy and at risk of tipping. Currently only a static heavy-device-above-mid-height warning exists.
**What to do**: Calculate rack center of gravity from device weights and positions. Show a visual indicator in 2D view (e.g., a vertical marker showing CG position, with a safe zone band).
**Status**: Shipped via `getCenterOfGravityU()` in `rackMath.ts`, validation warning `center-of-gravity-high`, and a 2D CG marker in `RackEditor2D.tsx`.
**Files to touch**: `src/utils/validation.ts`, `src/components/RackEditor2D.tsx`
**Effort**: Medium

### 5. Fix Pending Review Findings — ✅ IMPLEMENTED
**Why**: Review findings from the 2026-05-09 audit are now closed, including the final medium-priority 3D allocation cleanup before large 3D feature work.
**Completed quick wins**:
- CSS theme variable fallbacks (`src/styles/theme.css`)
- `getPortTypeOrder()` missing cases (`src/utils/portLayout.ts`)
- `FileMenu`, `ConfirmDialog`, `IssueBar` extraction from `App.tsx`
- `importRackJson()` guard with validation/normalization (`src/utils/exporters.ts`)
- Immutability fixes in `typeConsumed`, `buildBom`, `findFirstFreeSlot`
- `sameRailCount()` O(n²) path replaced with rail stats cache
**Final cleanup**:
- `cablePath3D.ts` temporary `Vector3` allocation pressure reduced by skipping duplicate waypoint allocations up front.
**Files to touch**: Multiple — see Review Findings table above
**Effort**: Low-Medium (mostly quick wins)

## Feature Proposals (2026-05-09 DCIM / Real-World Rack Research) 📋

### 6. 3D Printed Mount / Shelf Fit-Check System ⭐ High Homelab Value
**Why**: Many homelab devices are not standard rackmount gear. Users often design or download 3D printed brackets, trays, DIN-rail adapters, mini-PC mounts, PSU holders, and shelf inserts, then need to know whether the part conflicts with rack posts, shelves, rails, cables, airflow, or neighboring devices before printing.
**What to do**: Add a custom accessory model type for printed parts and rack hardware. Let users define dimensions, mount face, U position, x/y/z offset, material/clearance notes, and optional STL/OBJ/GLB preview later. Validate collisions against devices, shelves, rails, rack frame, rear clearance, and cable trays.
**MVP scope**:
- Add simple parametric printed parts first: box, tray, L-bracket, rail pair, shelf plate, DIN rail, vertical adapter strip.
- Attach parts to a rack U, device, shelf, side rail, rear post, or free 3D offset.
- Show transparent clearance envelopes in 2D/3D so users can see fit before printing.
- Warn when a printed part blocks ports, cable bend radius, airflow, or another device footprint.
**Later scope**:
- Import STL/OBJ/GLB for visual fit checks.
- Store print metadata: material, print orientation, screw hole spacing, heat tolerance, load rating, source URL.
- Link a printed mount to the device it supports and include it in export/checklists.
**Files to touch**: `src/types/rack.ts`, `src/store/rackStore.ts`, `src/components/RackEditor2D.tsx`, `src/components/three/DeviceModel.tsx` or a new accessory model component, `src/utils/validation.ts`, `src/data/deviceCatalog.ts` or a new accessory catalog.
**Effort**: Medium-High

### 7. Cable Trace / Path Explorer ⭐ Major Troubleshooting Value — 🔄 PARTIAL
**Why**: DCIM tools commonly let users trace a connection from one endpoint through patch panels and pass-through ports to the far endpoint. This would make the current cable map more useful for debugging, not just visualization.
**What to do**: Let users click a device port or cable and see the full signal path, including patch panel front/rear hops, disconnected endpoints, and broken chains.
**Status**: Core tracing exists in `src/utils/cableTrace.ts`, is covered by `src/utils/cableTrace.test.ts`, and is surfaced by `CableTracePanel`.
**Remaining**: Port-level click targets and richer visual highlighting in cable map / rack views.
**Files to touch**: `src/utils/routing.ts` or new `src/utils/cableTrace.ts`, `src/components/CableMap.tsx`, `src/components/CablePlanner.tsx`
**Effort**: Medium

### 8. Planned / Active / Decommissioning Mode — 🔄 PARTIAL
**Why**: Rack planning is often about migration: what exists now, what is planned, and what should be removed. Real DCIM systems track lifecycle/status so users can compare current and future states.
**What to do**: Add `status` to devices and cables, then support filtered views and a change summary: additions, removals, moved devices, and new cable runs.
**Status**: Device lifecycle editing in `PropertyPanel`, cable lifecycle editing in `CablePlanner`, lifecycle-filtered 2D/3D/cable views in `App.tsx`, and Markdown migration-plan export are now shipped. `migrationCalc.ts` also exposes filtered-layout helpers for the view mode.
**Remaining**: Richer moved-device diffing / change detection beyond lifecycle buckets.
**Files to touch**: `src/types/rack.ts`, `src/utils/migrationCalc.ts`, `src/store/rackStore.ts`, `src/components/CablePlanner.tsx`, `src/App.tsx`, `src/utils/exporters.ts`
**Effort**: Medium

### 9. Power Chain / Redundant Feed Planner — 🔄 PARTIAL
**Why**: Current power validation uses device draw, but real rack planning also needs circuits, PDUs, outlets, breaker utilization, and A/B redundancy.
**What to do**: Model Circuit A/B, PDU outlets, device power ports, safe utilization thresholds, and failure simulation. Warn when dual-PSU devices are not split across redundant feeds.
**Status**: `powerChain.ts`, circuit load checks, redundancy checks, and `PowerChainPanel` exist.
**Remaining**: Outlet-level assignment, failure simulation UX, and stricter A/B feed workflows.
**Files to touch**: `src/types/rack.ts`, `src/utils/powerChain.ts`, `src/utils/validation.ts`, `src/components/CablePlanner.tsx`, `src/components/ValidationPanel.tsx`
**Effort**: Medium-High

### 10. Rack Health / Capacity Dashboard — ✅ IMPLEMENTED
**Why**: Commercial DCIM tools surface capacity through red/yellow/green overlays for space, power, cooling, weight, and port availability. A homelab version would help users quickly see the next bottleneck.
**What to do**: Add a compact dashboard showing RU utilization, power budget, weight, port usage, cable density, thermal risk, and remaining usable slots.
**Status**: Shipped as `RackHealthDashboard.tsx`; zero-budget division guards are in place.
**Files to touch**: `src/utils/validation.ts`, `src/utils/rackMath.ts`, new `src/components/RackHealthDashboard.tsx`
**Effort**: Medium

### 11. Rack Reservation / Future Slot Planning
**Why**: Users often reserve space for future NAS, UPS, patch panels, shelves, or printed mounts. Reservations prevent accidental placement conflicts before the hardware exists.
**What to do**: Let users reserve U ranges and physical volumes, then validate planned devices and accessories against those reservations.
**Status**: Shipped on 2026-05-14. Layouts now support `RackReservation` records with front/rear side, U range, purpose, width/x footprint, 2D reserved overlays, a `ReservationPanel`, store placement guards, import preservation, and validation for occupied reserved space.
**Validation**: `node node_modules/typescript/bin/tsc --noEmit`, `npm test -- --pool=threads` (14 files / 264 tests passed).
**Files touched**: `src/types/rack.ts`, `src/store/rackStore.ts`, `src/components/RackEditor2D.tsx`, `src/components/ReservationPanel.tsx`, `src/utils/reservations.ts`, `src/utils/validation.ts`, `src/utils/layoutValidation.ts`
**Effort**: Medium

### 12. Cable / Device Label Protocol Generator
**Why**: Real rack maintenance depends on consistent labels at both cable ends. This is separate from RU label printing: it is about endpoint naming, port IDs, rack IDs, and label export.
**What to do**: Generate labels such as `R1-SW1:P24 <-> R1-PP1:F24`, detect inconsistent names, preview both cable-end labels, and export CSV for label printers.
**Files to touch**: `src/utils/exporters.ts`, `src/components/CablePlanner.tsx`, new `src/utils/labeling.ts`
**Effort**: Low-Medium

### 13. Documentation Audit Mode — ✅ IMPLEMENTED
**Why**: Rack diagrams become unreliable when labels, ports, power, and cable documentation drift. An audit mode can turn the app into a maintenance checklist.
**What to do**: Flag devices missing labels/asset tags/notes, cables missing endpoint labels or colors, patch panels with only one side connected, powered devices without power paths, and imported layouts with stale schema fields.
**Status**: Shipped on 2026-05-15. `documentationAudit.ts` now flags stale cable endpoints, missing endpoint port labels, out-of-range port references, incomplete custom port maps, and existing label/power/network gaps. `DocumentationAuditPanel` supports issue targeting plus audit export via `exportDocumentationAuditText()`.
**Validation**: Latest local verification included `node node_modules/typescript/bin/tsc --noEmit`, `npm test -- --pool=threads`, and `npm run build` (14 files / 274 tests passed).
**Files touched**: `src/utils/documentationAudit.ts`, `src/components/DocumentationAuditPanel.tsx`, `src/utils/exporters.ts`, `src/utils/layoutValidation.ts`, `src/utils/validationRecommendations.ts`, `src/utils/documentationAudit.test.ts`
**Effort**: Low-Medium

## Feature Proposals (2026-05-09 Homelab Pain Point Coverage) 📋

### 14. Rack Depth / Rail / Rear-Clearance Compatibility ⭐ High Practical Value — 🔄 PARTIAL
**Why**: A common homelab failure mode is buying or printing hardware that technically fits in U height but fails in real life because rails are too long, rear doors cannot close, power cables need bend space, shelves collide with rear posts, or a short device sits awkwardly behind a deep device.
**What to do**: Track usable rack depth, rail min/max depth, rear cable clearance, front/rear door clearance, shelf depth, and printed-part depth envelopes. Warn when a device, shelf, rail, bracket, or cable bend radius conflicts with the rack volume.
**MVP scope**:
- Add per-device rail/shelf depth metadata and rack usable-depth checks.
- Warn when rear cable clearance is below a configurable threshold.
- Combine device + shelf + printed mount depth into one fit envelope.
- Flag devices that cannot be serviced because they cannot slide or be removed without conflicts.
**Status**: `DepthCompatibilityPanel`, depth summary helpers, rail min/max checks, front/rear door clearance, and inferred rear cable bend checks exist.
**Remaining**: Combined printed-mount envelope and per-device rail/shelf metadata beyond inferred bend needs.
**Files to touch**: `src/types/rack.ts`, `src/utils/rackMath.ts`, `src/utils/validation.ts`, `src/components/PropertyPanel.tsx`, `src/components/RackEditor2D.tsx`
**Effort**: Medium

### 15. Energy Cost + Heat-Load Calculator ⭐ High Homelab Value — ✅ IMPLEMENTED
**Why**: Homelab users often care as much about monthly power cost and room heat as rack fit. A 300-500W rack can noticeably warm an office or closet and change what hardware is practical.
**What to do**: Convert rack watts into monthly kWh, estimated electricity cost, and BTU/h heat output. Support idle/typical/peak power values when available, and show how planned devices change the monthly cost.
**MVP scope**:
- Add electricity-rate setting in rack config.
- Calculate monthly cost from current `powerW`.
- Show BTU/h heat output and simple room-impact notes.
- Highlight high-cost devices and planned additions.
**Status**: Shipped via `energyCalc.ts`, `EnergySummary.tsx`, and `electricityRatePerKwh` on `RackLayout`; NaN input guard is in place.
**Files to touch**: `src/types/rack.ts`, `src/utils/rackMath.ts`, `src/utils/validation.ts`, new `src/components/EnergySummary.tsx`
**Effort**: Low-Medium

### 16. Noise / Living-Space Suitability Planner — ✅ IMPLEMENTED
**Why**: Noise is one of the biggest homelab pain points. Enterprise switches, 1U servers, high-RPM fans, and HDD arrays can make an office or bedroom layout unacceptable even when the rack is technically valid.
**What to do**: Add optional noise metadata and rate whether the rack is suitable for bedroom, office, closet, garage, or basement placement. Include warnings that fan swaps and acoustic dampening can increase thermal risk.
**MVP scope**:
- Add optional `noiseDb` and `noiseProfile` fields to templates/devices.
- Estimate combined rack noise conservatively.
- Show placement suitability labels rather than pretending exact acoustics are guaranteed.
- Add notes for HDD vibration, 1U chassis, fanless/passive gear, and fan-swap risk.
**Status**: Shipped via `noiseCalc.ts`, `NoiseSummary.tsx`, and `noiseDb` device metadata; invalid/extreme dB guards are in place.
**Files to touch**: `src/types/rack.ts`, `src/data/deviceCatalog.ts`, `src/utils/validation.ts`, new `src/components/NoiseSummary.tsx`
**Effort**: Medium

### 17. UPS Runtime Planner — ✅ IMPLEMENTED
**Why**: Power planning is incomplete without knowing how long the rack survives during an outage and which devices should stay up. Homelab users usually care about router/firewall/NAS shutdown order.
**What to do**: Model UPS capacity, load groups, critical vs non-critical devices, and estimated runtime. Generate shutdown priority recommendations.
**MVP scope**:
- Add UPS capacity fields such as VA, watts, and battery Wh.
- Let users mark devices as critical, graceful-shutdown, or non-critical.
- Estimate runtime from current and planned loads.
- Warn when critical load exceeds UPS safe capacity.
**Status**: Shipped on 2026-05-15. Devices can now be marked as `critical`, `graceful`, or `non-critical`; `upsRuntime.ts` computes grouped loads, critical-only runtime, shutdown order, and capacity warnings; `UpsRuntimePanel` shows those recommendations and summaries.
**Validation**: Latest local verification included `node node_modules/typescript/bin/tsc --noEmit`, `npm test -- --pool=threads`, and `npm run build` (14 files / 274 tests passed).
**Files touched**: `src/types/rack.ts`, `src/components/PropertyPanel.tsx`, `src/utils/upsRuntime.ts`, `src/components/UpsRuntimePanel.tsx`, `src/utils/upsRuntime.test.ts`, `src/utils/layoutValidation.ts`
**Effort**: Medium

### 18. Serviceability / Maintenance Access Mode — 🔄 PARTIAL
**Why**: A rack can fit on paper but still be painful to maintain. Users need to know whether devices can slide out, whether cable slack is enough, and whether small devices are blocked behind deeper equipment.
**What to do**: Add a serviceability overlay that simulates access paths, pull-out clearance, cable slack, and likely maintenance blockers.
**MVP scope**:
- Check front/rear access clearance for selected device.
- Warn when cable length/slack is too short for pull-out service.
- Highlight devices that require removing another device or shelf first.
- Add a maintenance checklist for risky devices.
**Status**: `serviceability.ts` now also exposes highlighted-device and per-device maintenance-checklist helpers; `ServiceabilityPanel` can drive an interactive overlay and show a selected-device checklist; `RackEditor2D.tsx` renders overlay highlights for risky hardware.
**Remaining**: More physical pull-out path simulation beyond the current issue-driven overlay.
**Files to touch**: `src/utils/serviceability.ts`, `src/components/ServiceabilityPanel.tsx`, `src/components/RackEditor2D.tsx`, `src/App.tsx`
**Effort**: Medium

### 19. Live Sensor Overlay
**Why**: After the rack is built, planned values drift from reality. Homelab users often already have Home Assistant, Prometheus, Grafana, SNMP, or smart plugs tracking power and temperature.
**What to do**: Add an optional imported-data layer for actual power, temperature, fan, and UPS readings, then compare them with planned values.
**MVP scope**:
- Start with manual CSV/JSON import of sensor readings.
- Map readings to devices by name or asset ID.
- Show actual vs planned watts and temperatures in the rack view.
- Keep network/API integrations as later plugins.
**Files to touch**: `src/types/rack.ts`, `src/utils/exporters.ts`, `src/utils/validation.ts`, new `src/components/SensorOverlay.tsx`
**Effort**: Medium-High

### 20. Full Build Procurement Planner
**Why**: Users do not only buy devices and cables. A real rack build needs shelves, rails, brackets, cage nuts, screws, Velcro, labels, printed parts, PDUs, UPS hardware, and sometimes fan trays.
**What to do**: Extend BOM thinking into a full build checklist with owned, need-to-buy, planned, and printed items.
**MVP scope**:
- Add item categories for hardware, rack accessories, cables, printed parts, labels, and power parts.
- Let users mark items as owned, need-to-buy, ordered, printed, or installed.
- Generate a build-ready checklist from the rack layout.
- Include printed mount metadata from the 3D printed fit-check feature.
**Files to touch**: `src/types/rack.ts`, `src/utils/exporters.ts`, new `src/utils/procurement.ts`, new `src/components/BuildPlanner.tsx`
**Effort**: Medium

## Feature Proposals (Beyond Listed — 2026-05-10) 📋

### 21. Network Topology Auto-Generator ⭐ New Dimension, High Value — ✅ IMPLEMENTED
**Why**: The app currently covers only the physical layer (rack U positions, cable routes). Homelab users equally care about the logical layer: which switch is the core, how the router connects to the firewall, whether the NAS is isolated in a VLAN, and if there are single points of failure. Auto-generating a network topology from existing cable data lets users verify their network design without drawing it twice.
**What to do**: Add a new `topology` view mode that renders a logical network graph from `RackLayout.cables` and `DeviceCategory` roles.
**MVP scope**:
- Hierarchical or force-directed graph layout with device roles visually differentiated (router = gateway, switch = hub, firewall = barrier, NAS/server = leaf, AP = wireless leaf).
- Edges styled by `CableType` (ethernet = solid, fiber = dashed, power = dotted/faded).
- Basic VLAN overlay by parsing VLAN tags from `CableRoute.notes` (e.g., "VLAN 10") and coloring edges accordingly.
- Port-speed mismatch warnings (e.g., 10GbE device connected to 1GbE switch highlighted in red).
- Redundant-uplink detection: flag switches with only one upstream link.
**Later scope**:
- L2/L3 boundary visualization (router-on-a-stick vs dedicated L3 switch).
- VLAN filtering and isolated broadcast-domain highlighting.
- Export topology as PNG/SVG.
**Files to touch**: New `src/components/NetworkTopology.tsx`, `src/utils/topologyGraph.ts`, `src/types/rack.ts` (optional `portSpeed` metadata), `src/App.tsx` (new view mode)
**Effort**: Medium
**Dependencies**: None — reuses existing `cables` and `devices` data entirely.

### 22. Port Speed / Media Type Overlay
**Why**: Users often accidentally plan 10GbE connections over Cat5e or forget to account for SFP+ DAC compatibility. Visible port speed and cable media type prevents procurement mistakes.
**What to do**: Add optional `portSpeed` and `mediaType` metadata to ports/cables, then overlay speed badges in 2D/3D views and warn on mismatches.
**MVP scope**:
- Add `portSpeed` (`1G` | `2.5G` | `10G` | `25G` | `40G` | `100G`) and `mediaType` (`rj45` | `sfp+` | `qsfp+` | `dac` | `fiber`) to `PortLayout` / `CableRoute`.
- Render speed badges on 3D port faces and 2D port strips.
- Warning when a cable connects mismatched speeds or incompatible media (e.g., SFP+ to RJ45 without adapter).
**Files to touch**: `src/types/rack.ts`, `src/data/deviceCatalog.ts`, `src/utils/validation.ts`, `src/components/three/DeviceModel.tsx`, `src/components/RackEditor2D.tsx`
**Effort**: Low-Medium

### 23. Boot Dependency Planner
**Why**: After a power outage, devices must come online in the right order (UPS first, then router, then switch, then APs, then NAS). Users currently track this mentally or in spreadsheets.
**What to do**: Model power-on dependencies between devices and generate a recommended boot sequence with critical-path analysis.
**MVP scope**:
- Add optional `bootDependsOn` (device IDs) and `bootDelaySeconds` to `PlacedDevice`.
- Visualize dependency graph (tree or layered layout).
- Calculate total time to full service recovery.
- Flag circular dependencies.
**Files to touch**: `src/types/rack.ts`, `src/store/rackStore.ts`, new `src/utils/bootOrder.ts`, new `src/components/BootSequencePanel.tsx`
**Effort**: Medium

### 24. Rack Shopping / Pre-Purchase Fit Checker
**Why**: The #1 real-world pain point is buying a rack (or devices) that don't physically fit. Users check chassis depth but forget rails, rear cable clearance, door thickness, and power-plug bend radius. This mode lets users validate fit before spending money.
**What to do**: Add a guided fit-check flow that focuses on physical compatibility without requiring cable planning.
**MVP scope**:
- Quick-switch rack depth/height templates (600mm/800mm/1000mm/1200mm deep; 12U/24U/42U) to see if all devices fit.
- Visual rear-clearance indicator: show remaining mm after deepest device + cable bend radius + door thickness.
- Non-rackmount device auto-flag: NUCs, towers, SBCs trigger "needs shelf/bracket/3D-printed mount" warnings.
- Door-closure check: warn when rear devices or power plugs would block the door.
- Weight distribution preview: simple top-heavy warning based on device weights and positions.
**Files to touch**: `src/components/RackEditor2D.tsx`, `src/utils/validation.ts`, `src/utils/rackMath.ts`, `src/components/PropertyPanel.tsx`
**Effort**: Medium
**Dependencies**: Reuses existing validation and rack-math infrastructure.

### 25. Room Placement Advisor ⭐ High Practical Value, Novel
**Why**: "Where do I put this rack?" is one of the most common homelab questions. Bedroom? Too noisy. Closet? Overheats. Garage? Too dusty/cold. Basement? Good but cable run is long. Existing noise/heat calculators only show static badges ("suitable for garage"). This advisor turns those numbers into spatial recommendations.
**What to do**: Collect room constraints and suggest optimal rack placement, connecting existing noise, heat, weight, and cable data into a cohesive spatial decision tool.
**MVP scope**:
- Constraint questionnaire: room type (bedroom/office/closet/garage/basement), dimensions, floor type (wood/concrete/tile), ventilation (window/AC/none), network ingress location, power outlet count/circuit capacity, door width.
- Scored placement report per candidate location:
  - Noise compatibility (reuse `noiseCalc.ts`)
  - Heat dissipation capacity vs BTU/h output (reuse `energyCalc.ts`)
  - Floor load warning for old wood floors vs heavy racks
  - Backbone cable length estimate from ISP ingress point to rack
  - Door-fit warning (will the rack even fit through the door/stairs?)
- Simple heatmap visualization: noise propagation zone + hot-air accumulation zone in the room.
**Later scope**:
- Upload floor-plan image (PNG/SVG) and mark walls, doors, windows, network entry, power outlets.
- Visual drag-and-drop rack placement on floor plan with real-time score updates.
- Multi-rack room layout (overlaps with existing backlog item).
**Files to touch**: New `src/components/RoomPlacementAdvisor.tsx`, `src/utils/roomAdvisor.ts`, `src/utils/noiseCalc.ts`, `src/utils/energyCalc.ts`, `src/types/rack.ts` (room constraints type)
**Effort**: Medium
**Dependencies**: Builds on existing `NoiseSummary.tsx` and `EnergySummary.tsx` data.

### 26. Zero-to-Homelab Interactive Guide ⭐ Onboarding & Education, Highly Differentiating
**Why**: Most homelab beginners don't know where to start. They either buy too much at once ("endgame at start") or buy incompatible gear. There is no built-in guidance inside rack planning tools that teaches *how* to think about building a homelab. A guided questionnaire and roadmap turns the app from a planning tool into a long-term companion.
**What to do**: Add an interactive onboarding guide that asks about the user's goals, budget, constraints, and experience level, then generates a personalized "grow into it" roadmap instead of pushing an expensive full build.
**MVP scope**:
- **Questionnaire wizard** (~10 questions):
  1. What is your primary goal? (learn networking / self-host apps / NAS / Plex / Kubernetes / game server)
  2. What is your budget tier? (hobby <$200 / enthusiast $500-1500 / serious $2000+)
  3. Are you comfortable buying used/enterprise gear? (yes / no / only certain parts)
  4. How much noise can you tolerate? (silent / low / don't care)
  5. Where will the rack live? (bedroom / office / closet / garage / basement)
  6. Do you have existing hardware to reuse? (old PC / Pi / nothing)
  7. What is your networking knowledge level? (beginner / intermediate / advanced)
  8. Do you need WAF (Wife Acceptance Factor) considerations? (yes / no)
  9. Growth mindset check: "Do you want to build everything now or grow incrementally?" (nudge toward incremental)
  10. Power/cooling constraints? (shared meter / limited outlets / no AC)
- **Personalized report**:
  - Recommended starter rack size and type (10" vs 19", 9U vs 12U vs 24U).
  - Suggested first 3-5 devices in priority order (e.g., router → switch → NAS → server).
  - New vs used recommendations per device category (e.g., "Buy switch used, buy NAS new for warranty").
  - Incremental growth phases: Phase 1 (network), Phase 2 (storage), Phase 3 (compute), Phase 4 (advanced).
  - Specific warnings based on answers (e.g., "You chose bedroom + enterprise switch = 60dB. Consider fanless switch or closet placement.")
- **Pre-built starter layouts**: Auto-generate or suggest sample layouts matching the report (e.g., "Budget Bedroom Starter", "Garage Lab Grower").
**Later scope**:
- Community-submitted build stories / cost breakdowns.
- Integration with `RoomPlacementAdvisor` so the guide's room answer feeds directly into placement analysis.
- "Next upgrade" nudge: when a user hits capacity limits, suggest the logical next device based on their original goal.
**Files to touch**: New `src/components/HomelabGuide.tsx`, `src/components/GuideQuestionnaire.tsx`, new `src/utils/homelabGuide.ts`, `src/data/starterLayouts.ts` or extend `sampleLayouts.ts`
**Effort**: Medium
**Dependencies**: Independent feature, but synergizes with `RoomPlacementAdvisor` and existing sample layouts.
**Key principle**: The guide must *never* encourage "buy everything now." Default messaging should emphasize starting small, buying used where safe, and upgrading in phases. Each phase should have a "stop and enjoy" checkpoint.

### 27. Multi-Rack Workspace with Inter-Rack Connection Tracking ⭐ Major Architectural Extension, High Value
**Why**: Most serious homelabbers eventually outgrow one rack. They have a main rack, a secondary test rack, a wall-mounted mini rack, or even a remote site rack at a family member's house. Today they track inter-rack connections with hand-drawn network diagrams or spreadsheets, and easily forget which physical port on Rack A connects to which port on Rack B. A unified workspace that manages multiple racks and their cross-rack links turns the app from a single-rack planner into a whole-lab management system.
**What to do**: Upgrade from a single `RackLayout` to a `Workspace` that contains multiple rack layouts, plus a new inter-rack connection layer for cables that run between racks.
**MVP scope**:
- **Workspace model**: a container holding multiple named `RackLayout` instances (e.g., "Main Rack", "Garage Lab", "Test Bench").
- **Rack manager UI**: switch between racks, create/delete/duplicate racks within the workspace, see a summary list of all racks with health indicators.
- **Inter-rack cables**: a new connection type that links a port on a device in Rack A to a port on a device in Rack B. These cables are stored at the workspace level, not inside either rack's `cables` array, to preserve per-rack independence.
- **Inter-rack cable properties**: length, type (fiber/SFP+/Cat6a/DAC), label/ID, color, notes.
- **Global search**: search across all racks by device name, port number, cable label, or asset tag. Results show which rack the item lives in and how to navigate to it.
- **Inter-rack connection map**: a site-level diagram showing racks as nodes and inter-rack cables as edges. Click an edge to see endpoint details (Rack A / Device X / Port 24 → Rack B / Device Y / Port 12).
- **Port identification / labeling**: each port can have a user-defined searchable alias (e.g., "ISP-IN", "CORE-UPLINK", "NAS-LAN1"). The global search indexes these aliases.
**Later scope**:
- Remote site attributes: physical address, timezone, ISP, power circuit, latency notes.
- Cross-site power dependency: UPS in Site A backing up device in Site B.
- Site-level health dashboard: aggregate all racks' power, weight, noise, heat into one view.
- Inter-rack cable length standardization (e.g., "use 10m OM4 fiber" instead of guessing).
- Export entire workspace as a unified network diagram (PNG/SVG/PDF).
- Import/sync from multiple JSON files (one per rack) into one workspace.
**Files to touch**: `src/types/rack.ts` (new `Workspace` type, `InterRackCable` type), `src/store/rackStore.ts` or new `src/store/workspaceStore.ts`, new `src/components/WorkspaceManager.tsx`, new `src/components/InterRackMap.tsx`, new `src/components/GlobalSearch.tsx`, `src/utils/exporters.ts`
**Effort**: Medium-High
**Dependencies**: Touches core data model. Best implemented after the store and export/import formats are stable. Synergizes with Network Topology Auto-Generator (#21) — inter-rack edges become the top-level links in the logical topology.
**Differentiation note**: This is distinct from the existing backlog item "Multi-rack room layout," which is about placing multiple racks inside a single physical room. This feature is about managing multiple racks as a connected system, potentially across rooms or buildings, with tracked inter-rack cabling.

### 28. Rack Dependency Graph / Blast Radius Map ⭐ High Operational Value
**Why**: Physical cabling shows what is connected, but users also need to know what breaks when one device, power feed, cable, switch uplink, or NAS goes down. Commercial DCIM tools treat impact analysis as a first-class operations workflow; a homelab version would make outage planning much more concrete.
**What to do**: Build a dependency graph across power, network, storage, management access, and services. Let users simulate a failed device/cable/PDU/UPS and see impacted devices, unreachable services, and suggested recovery order.
**MVP scope**:
- Add optional dependency metadata: `provides`, `dependsOn`, `criticality`, and `serviceTags` for devices.
- Infer simple dependencies from existing cables and power paths.
- Show "blast radius" from a selected device/cable with impacted items highlighted in 2D, 3D, cable map, and topology views.
- Generate an outage summary: "If Switch-01 fails, 7 devices lose network, NAS backups remain powered, remote VPN is lost."
**Later scope**:
- Model degraded states, not just down/up: single uplink lost, redundant PSU lost, storage reachable but slow, management plane unavailable.
- Export an incident-response diagram for outages.
**Files to touch**: `src/types/rack.ts`, new `src/utils/dependencyGraph.ts`, `src/utils/validation.ts`, new `src/components/BlastRadiusPanel.tsx`, `src/components/CableMap.tsx`, optional integration with `NetworkTopology.tsx`
**Effort**: Medium-High
**Dependencies**: Builds on Cable Trace / Path Explorer (#7), Power Chain / Redundant Feed Planner (#9), Network Topology Auto-Generator (#21), and Boot Dependency Planner (#23).

### 29. Layout Policy Rules Engine ⭐ Turns Validation Into Governance
**Why**: Built-in validation catches generic problems, but every homelab has personal rules: "UPS always bottom-mounted," "critical devices must have redundant power," "leave 20% switch ports free," "no noisy gear in bedroom mode," or "power draw must stay under 80% of circuit capacity."
**What to do**: Add user-configurable policies that run alongside validation and produce actionable warnings.
**MVP scope**:
- Define policy presets: safe bedroom rack, low-power rack, redundant network rack, learning lab, media/NAS rack.
- Support simple rule fields: target, metric, operator, threshold, severity, message.
- Let users enable/disable policies per layout.
- Show policy violations in the existing validation surfaces.
**Later scope**:
- Import/export policy packs as JSON.
- Add a policy tester so users can preview which rules a layout violates before enabling enforcement.
**Files to touch**: `src/types/rack.ts`, new `src/utils/policyEngine.ts`, `src/utils/validation.ts`, new `src/components/PolicyPanel.tsx`
**Effort**: Medium
**Dependencies**: Reuses existing validation and rack health metrics.

### 30. Rack Change Risk Score + Rollback Plan Generator
**Why**: Adding a cable or moving a switch can be trivial or can take the whole house offline. Users need an at-a-glance risk score and a rollback plan before applying layout changes.
**What to do**: Compare current layout vs planned layout and calculate change risk based on affected critical devices, number of cable changes, power-path changes, dependency impact, and serviceability difficulty.
**MVP scope**:
- Diff two layouts and classify changes: added, removed, moved, rewired, repowered, renamed.
- Score risk from low/medium/high/critical with reasons.
- Generate rollback steps: restore device position, reconnect previous cable endpoints, return power feed, validate affected services.
- Attach expected downtime and "must test before/after" checklist.
**Later scope**:
- Link to Change Request / Approval Workflow (#48).
- Store completed change records with actual downtime and lessons learned.
**Files to touch**: `src/types/rack.ts`, new `src/utils/layoutDiff.ts`, new `src/utils/changeRisk.ts`, new `src/components/ChangeReviewPanel.tsx`, `src/store/rackStore.ts`
**Effort**: Medium
**Dependencies**: Strongly pairs with Planned / Active / Decommissioning Mode (#8) and Rack Dependency Graph (#28).

### 31. Emergency Troubleshooting Runbook Generator
**Why**: When "the internet is down," the user should not have to mentally reconstruct the topology while standing beside the rack. The app already knows enough to generate a first-pass runbook.
**What to do**: Generate guided troubleshooting flows for common incidents: internet down, NAS unreachable, Wi-Fi down, UPS beeping, no management access, and "everything is slow."
**MVP scope**:
- Create runbook templates that reference actual device names, cable endpoints, power feeds, and labels.
- Sort checks by likely root cause and ease of inspection.
- Provide mobile-friendly steps: inspect LED, verify cable label, check PDU outlet, confirm upstream device.
- Include "stop here and do not unplug" warnings for high-risk actions.
**Later scope**:
- Record runbook outcomes and use them to tune future suggestions.
- Generate printable emergency cards with QR links to the live layout.
**Files to touch**: new `src/utils/runbookGenerator.ts`, new `src/components/RunbookPanel.tsx`, `src/utils/dependencyGraph.ts`, `src/utils/exporters.ts`
**Effort**: Low-Medium
**Dependencies**: Benefits from Cable Trace / Path Explorer (#7), QR label workflows, and Blast Radius Map (#28).

### 32. Rack Debt Tracker
**Why**: Homelabs are full of "temporary" compromises: unlabeled cables, single-PSU critical devices, unsupported firmware, a tower on a shelf, no cable slack, and notes that say "fix later." If the app tracks the debt, the user can pay it down intentionally.
**What to do**: Add a debt register for layout compromises, with severity, owner, due date, reason, and recommended fix.
**MVP scope**:
- Convert selected validation warnings into debt items.
- Let users manually add debt items linked to devices, cables, rack zones, or the whole layout.
- Track status: accepted, planned, fixed, intentionally ignored.
- Show a debt score and "top 5 things to fix next."
**Later scope**:
- Auto-create debt from policy violations and documentation gaps.
- Generate monthly maintenance plan from debt items.
**Files to touch**: `src/types/rack.ts`, `src/utils/validation.ts`, new `src/utils/rackDebt.ts`, new `src/components/RackDebtPanel.tsx`
**Effort**: Low-Medium
**Dependencies**: Builds on Documentation Audit Mode (#13), Policy Rules Engine (#29), and Validation Explain Mode (#34).

### 33. Command Palette + Universal Rack Search
**Why**: As layouts grow, clicking through panels becomes slower than searching. Commercial inventory tools emphasize searchable databases; a homelab planner should let users find any device, port, cable, VLAN, IP, serial number, label, warning, or note instantly.
**What to do**: Add a `Cmd+K` / `Ctrl+K` command palette with search and quick actions.
**MVP scope**:
- Search devices, cables, ports, labels, notes, validation issues, and rack settings.
- Jump to a result and select/highlight it in the current view.
- Quick actions: add device, export JSON, open validation panel, open cable planner, toggle theme.
- Rank exact label/asset/IP matches above fuzzy name matches.
**Later scope**:
- Natural-language commands can reuse the same action registry.
- Global search across Multi-Rack Workspace (#27).
**Files to touch**: new `src/components/CommandPalette.tsx`, new `src/utils/searchIndex.ts`, `src/App.tsx`, `src/store/rackStore.ts`
**Effort**: Medium
**Dependencies**: Independent, but becomes more valuable after asset tags, labels, VLANs, and multi-rack support.

### 34. Validation Explain Mode
**Why**: A warning is useful only if the user understands why it matters. Beginner homelab users need explanations, tradeoffs, and safe fixes, not just red text.
**What to do**: Add expandable explanations for validation and policy issues.
**MVP scope**:
- For each warning type, provide: what it means, why it matters, likely real-world symptom, suggested fix, and when it might be acceptable to ignore.
- Link warnings to affected devices/cables and relevant runbook steps.
- Include "fix difficulty" and "risk if ignored" labels.
**Later scope**:
- Beginner/advanced explanation modes.
- Auto-generate a "learning report" after a validation scan.
**Files to touch**: `src/utils/validation.ts`, new `src/utils/validationExplanations.ts`, `src/components/ValidationPanel.tsx`
**Effort**: Low-Medium
**Dependencies**: Pairs with Policy Rules Engine (#29) and Rack Debt Tracker (#32).

### 35. Rack Readiness / Build-Day Checklist
**Why**: A finished plan is not the same as a build-ready rack. Users still need tools, labels, screws, cables, backups, shutdown order, rollback steps, and physical access.
**What to do**: Generate a build-day checklist from the current layout and planned changes.
**Status**: Shipped on 2026-05-16. The app now generates a persisted readiness checklist with build-kit, cabling, change-window, risk, and closeout sections derived from BOM/procurement, migration, UPS runtime, serviceability, and documentation data, plus Markdown export.
**MVP scope**:
- Checklist sections: tools, labels, cable inventory, screws/cage nuts, shelves/rails, backup config, shutdown order, install order, smoke tests, cleanup.
- Pull required cables and hardware from BOM/procurement data.
- Include risk-specific checks: heavy device mounting, UPS battery, grounding, cable slack, door clearance.
- Export as printable PDF/Markdown.
**Later scope**:
- Step-by-step mobile build mode with progress checkboxes.
- Post-build audit that compares planned vs actual state.
**Files to touch**: new `src/utils/readinessChecklist.ts`, new `src/components/ReadinessChecklist.tsx`, `src/utils/exporters.ts`
**Effort**: Low-Medium
**Dependencies**: Builds on Full Build Procurement Planner (#20), Change Risk Score (#30), and Serviceability Mode (#18).

### 36. Device Template Confidence / Data Quality Score
**Why**: The device catalog may contain estimated dimensions, power draw, port maps, noise values, and thermal assumptions. Users should know which data is measured, vendor-sourced, estimated, or missing.
**What to do**: Add metadata quality flags to device templates and surface a confidence score.
**MVP scope**:
- Track source and confidence for dimensions, power, weight, ports, depth, noise, and thermal data.
- Show low-confidence warnings when planning depends on estimated values.
- Add catalog filter: "only show templates with verified depth/power/port data."
- Let users override values and mark them as measured for their own layout.
**Later scope**:
- Community template verification workflow.
- Versioned template updates with migration notes for existing layouts.
**Files to touch**: `src/types/rack.ts`, `src/data/deviceCatalog.ts`, `src/components/ComponentLibrary.tsx`, `src/components/PropertyPanel.tsx`, `src/utils/validation.ts`
**Effort**: Medium
**Dependencies**: Improves Rack Shopping / Pre-Purchase Fit Checker (#24), Noise Planner (#16), and Energy Calculator (#15).

### 37. Thermal Camera / Photo Overlay Import
**Why**: Planned thermal models are useful, but real racks have surprises: blocked intakes, hot exhaust recirculation, dusty filters, and devices running hotter than expected. A photo/thermal overlay helps reconcile plan vs reality.
**What to do**: Let users attach front/rear rack photos or thermal-camera images and align them against the rack elevation.
**MVP scope**:
- Upload a front or rear image and manually align it to rack bounds.
- Pin hot spots, blocked intakes, cable mess, and physical labels to devices.
- Compare annotated hot spots against validation thermal warnings.
- Store image references in layout export.
**Later scope**:
- FLIR/thermal palette parsing and approximate temperature extraction where metadata is available.
- Computer-vision assist for detecting device labels and port numbers.
**Files to touch**: `src/types/rack.ts`, new `src/components/RackPhotoOverlay.tsx`, new `src/utils/photoOverlay.ts`, `src/utils/exporters.ts`
**Effort**: Medium-High
**Dependencies**: Complements Live Sensor Overlay (#19), Thermal/Airflow Simulation, and Documentation Audit Mode (#13).

### 38. Homelab Portfolio / Resume Export
**Why**: A well-documented homelab can demonstrate networking, storage, virtualization, automation, monitoring, and operational discipline. Users may want a polished export for a blog, portfolio, job interview, or project archive.
**What to do**: Generate a portfolio-ready report from the layout and documentation.
**MVP scope**:
- Include rack overview, topology, power/energy summary, redundancy notes, monitoring sources, backup posture, and before/after improvements.
- Redact sensitive values by default: public IPs, serials, MAC addresses, credentials, home address, exact hostnames.
- Export as Markdown, PDF, or static HTML.
- Include optional "skills demonstrated" section: VLANs, UPS planning, backup validation, cable documentation, automation.
**Later scope**:
- Public share page with read-only sanitized layout.
- GitHub README generator for homelab repos.
**Files to touch**: new `src/utils/portfolioExport.ts`, new `src/components/PortfolioExportPanel.tsx`, `src/utils/exporters.ts`
**Effort**: Low-Medium
**Dependencies**: Benefits from Network Topology (#21), Documentation Audit Mode (#13), and Asset Registry (#45).

### 39. Rack Scenario Planner — ✅ IMPLEMENTED (2026-05-16)
**Why**: Users need to know how their rack behaves under specific real-world events, not just whether the current static layout is valid. Scenario planning turns validation into operational rehearsal.
**What to do**: Add predefined scenarios that run dependency, power, thermal, and serviceability checks against simulated conditions.
**Status**: Shipped with 8 preset scenarios (power outage, ISP down, switch reboot, NAS failure, UPS battery weak, summer heatwave, AP offline, management network unavailable), impacted-device/survivor breakdown, failed-assumption tracking, prioritized recommendations, overall readiness score, and a Markdown scenario-report export. Lazy-loaded panel keeps the initial bundle under the 250 KB budget.
**MVP scope**:
- Scenario presets: power outage, ISP down, switch reboot, NAS disk failure, UPS battery weak, summer heatwave, AP offline, management network unavailable.
- For each scenario, show impacted devices/services, surviving paths, failed assumptions, and recommended next action.
- Reuse existing validation, power, UPS, topology, and blast-radius logic where possible.
- Save scenario results as layout notes or exportable reports.
**Later scope**:
- User-authored custom scenarios.
- Scenario comparison across planned layouts.
**Files touched**: `src/utils/scenarioPlanner.ts`, `src/utils/scenarioPlanner.test.ts`, `src/components/ScenarioPlannerPanel.tsx`, `src/utils/exporters.ts`, `src/App.tsx`
**Effort**: Medium
**Dependencies**: Builds on Rack Dependency Graph (#28), Power Chain (#9), UPS Runtime Planner (#17), and Service Map Overlay (#47).

### 40. Port Reservation System
**Why**: Space reservations are useful, but serious planning also needs reserved switch ports, patch-panel ports, PDU outlets, and uplinks. Without reservations, future growth gets accidentally consumed by today's quick fixes.
**What to do**: Let users reserve individual ports/outlets or port ranges for future services, uplinks, devices, or maintenance access.
**MVP scope**:
- Add reservation records for switch ports, patch-panel ports, PDU outlets, and device interfaces.
- Show reserved ports in CablePlanner and prevent accidental use unless overridden.
- Include reservation reason, owner, expected device/service, and expiry/review date.
- Validate that planned devices do not consume reserved resources.
**Later scope**:
- Capacity forecast that treats reserved ports as unavailable.
- Reservation templates for core uplinks, spare PoE, management ports, and out-of-band access.
**Files to touch**: `src/types/rack.ts`, `src/components/CablePlanner.tsx`, `src/utils/validation.ts`, new `src/utils/reservations.ts`, new `src/components/ReservationPanel.tsx`
**Effort**: Medium
**Dependencies**: Complements Rack Reservation / Future Slot Planning (#11), Rack Health Dashboard (#10), and Capacity Forecasting (#44).

### 41. Cable Slack Budget Calculator
**Why**: A cable can be long enough to connect two ports but still too short for service loops, pull-out rails, rear-door clearance, or safe bend radius. Length alone is not enough.
**What to do**: Extend cable planning from estimated path length to required slack budget.
**Status**: Shipped on 2026-05-16. Cable details now show routed path vs slack budget, BOM exports include slack/service-loop/bend-radius notes, and validation warns against manual lengths that cover only the geometric path but not the service slack.
**MVP scope**:
- Calculate minimum recommended slack by cable type and device serviceability requirements.
- Warn when a device cannot be pulled forward or serviced without disconnecting cables.
- Track planned slack vs actual cable length.
- Add bend-radius and service-loop notes to cable BOM export.
**Later scope**:
- Visual slack loops in 2D/3D.
- Per-cable "field measured" override after installation.
**Files to touch**: `src/utils/rackMath.ts`, `src/utils/routing.ts`, `src/utils/validation.ts`, `src/components/CablePlanner.tsx`, `src/utils/exporters.ts`
**Effort**: Low-Medium
**Dependencies**: Builds on Cable BOM (#1), Serviceability Mode (#18), and Rack Depth / Clearance Checks (#14).

### 42. Rack Commissioning Checklist
**Why**: After building or changing a rack, users need to prove it is actually ready: labels installed, UPS tested, backup restored, firmware logged, and basic network paths verified.
**What to do**: Generate a commissioning checklist for new builds and major changes.
**Status**: Shipped on 2026-05-16. The app now includes a persisted commissioning checklist with pass/fail/skipped tracking, device-aware validation prompts, and Markdown report export with sign-off fields.
**MVP scope**:
- Checklist sections: physical install, labels, power, network, backup, monitoring, documentation, photos, rollback verification.
- Include device-specific checks based on category: UPS runtime test, NAS restore test, switch config backup, firewall failover check.
- Let users mark items passed/failed/skipped with notes.
- Export a commissioning certificate/report for the layout.
**Later scope**:
- Compare commissioning results across rack versions.
- Require commissioning before marking a planned layout active.
**Files to touch**: new `src/utils/commissioning.ts`, new `src/components/CommissioningChecklist.tsx`, `src/types/rack.ts`, `src/utils/exporters.ts`
**Effort**: Low-Medium
**Dependencies**: Builds on Readiness Checklist (#35), Documentation Audit (#13), Backup Verification Log (#53), and Change Workflow (#48).

### 43. Golden Layout Baseline — ✅ IMPLEMENTED (2026-05-16)
**Why**: Users often have a known-good state before experimenting. A baseline makes it easy to see whether a new plan improves or degrades power, ports, noise, heat, validation score, or risk.
**What to do**: Let users mark a layout snapshot as the golden baseline and compare future states against it.
**Status**: Shipped with persisted `goldenBaseline` snapshots, summary metrics, regression/improvement comparison rows, Markdown export, and baseline-copy restore for new planning branches.
**MVP scope**:
- Save baseline snapshot metadata and summary metrics.
- Compare current vs baseline: power, heat, noise, free U, free ports, validation issues, cable count, risk score, documentation score.
- Highlight regressions and improvements.
- Restore or duplicate the baseline as a new layout.
**Later scope**:
- Multiple named baselines: stable, low-power, travel mode, upgrade plan.
- Baseline-aware change risk and rollback planning.
**Files touched**: `src/types/rack.ts`, `src/store/rackStore.ts`, new `src/utils/baseline.ts`, new `src/components/GoldenBaselinePanel.tsx`, `src/utils/exporters.ts`
**Effort**: Medium
**Dependencies**: Complements Layout Diff (#30), Rack Health Dashboard (#10), and Rack Debt Tracker (#32).

### 44. Rack Health Budget Forecast
**Why**: Dashboards show current headroom, but users need to know when they will run out of U-space, ports, power, UPS runtime, cooling, storage, or noise tolerance.
**What to do**: Forecast capacity exhaustion from current usage, planned devices, historical additions, and reservations.
**MVP scope**:
- Forecast categories: U-space, switch ports, PDU outlets, power budget, UPS runtime, thermal load, noise, and cable tray density.
- Show "next bottleneck" and estimated time/number of devices until exhaustion.
- Include reserved resources from Port Reservation System (#40).
- Provide recommended mitigation options: consolidate, replace, expand, relocate, or stop buying hardware.
**Later scope**:
- Scenario-based forecasts: summer mode, all-new-used build, 10GbE expansion, storage-heavy growth.
- Trend import from layout history and sensor data.
**Files to touch**: new `src/utils/capacityForecast.ts`, new `src/components/CapacityForecastPanel.tsx`, `src/utils/rackMath.ts`, `src/utils/validation.ts`
**Effort**: Medium
**Dependencies**: Builds on Rack Health Dashboard (#10), Port Reservation System (#40), and Live Sensor Overlay (#19).

### 45. Configuration Drift Detector
**Why**: Planned layouts drift from the real rack when cables move, firmware changes, ports are repurposed, or power readings differ from estimates. Drift detection keeps documentation trustworthy.
**What to do**: Compare planned layout data against imported or manually observed actual state.
**MVP scope**:
- Import observed state from CSV/JSON or manual audit sessions.
- Detect moved devices, cable endpoint mismatches, unexpected port usage, firmware drift, power draw variance, missing sensors, and changed labels.
- Classify drift as harmless, needs review, or critical.
- Generate reconciliation tasks.
**Later scope**:
- Integrate with Rack Reality Reconciliation (#130 in BRAINSTORM.md) as a guided mobile audit workflow.
- Track drift over time by rack zone and device category.
**Files to touch**: `src/types/rack.ts`, new `src/utils/driftDetector.ts`, new `src/components/DriftPanel.tsx`, `src/utils/exporters.ts`
**Effort**: Medium-High
**Dependencies**: Builds on Live Sensor Overlay (#19), Documentation Audit (#13), Photo Overlay (#37), and Golden Layout Baseline (#43).

### 46. Failure Domain Designer
**Why**: Redundancy is only real if dependencies are separated across failure domains. A dual-PSU server is not redundant if both PSUs feed the same overloaded PDU.
**What to do**: Let users define and visualize failure domains for power, network, storage, room/site, cooling, and management access.
**MVP scope**:
- Define named domains: Circuit A/B, PDU A/B, Switch A/B, Storage Pool A/B, Room/Site, ISP, management plane.
- Assign devices, cables, power paths, or services to domains.
- Validate that critical services do not depend entirely on one domain.
- Simulate loss of a domain and show impacted devices/services.
**Later scope**:
- Domain-aware auto-layout recommendations.
- Failure-domain score for each service.
**Files to touch**: `src/types/rack.ts`, new `src/utils/failureDomains.ts`, new `src/components/FailureDomainPanel.tsx`, `src/utils/dependencyGraph.ts`, `src/utils/validation.ts`
**Effort**: Medium-High
**Dependencies**: Builds on Power Chain (#9), Rack Dependency Graph (#28), and Service Map Overlay (#47).

### 47. Service Map Overlay
**Why**: Devices are not the goal; services are. Users care whether DNS, DHCP, VPN, Home Assistant, NAS, NVR, Plex, backups, and monitoring survive changes and failures.
**What to do**: Add a service layer that maps logical services to hosts, storage, network paths, power dependencies, and backup targets.
**MVP scope**:
- Add service records: name, criticality, host device, storage dependency, network dependency, power dependency, backup target, notes.
- Show service badges on devices and a service-centric dependency view.
- Validate single points of failure for critical services.
- Include services in blast-radius, runbook, and scenario reports.
**Later scope**:
- Import service lists from Proxmox, Unraid, TrueNAS, Docker Compose, or Home Assistant.
- Service-level RTO/RPO tracking.
**Files to touch**: `src/types/rack.ts`, new `src/utils/serviceMap.ts`, new `src/components/ServiceMapPanel.tsx`, `src/utils/dependencyGraph.ts`, `src/utils/validation.ts`
**Effort**: Medium
**Dependencies**: Builds on Hypervisor Config Sync (#38 in BRAINSTORM.md), Blast Radius Map (#28), and Backup Verification Log (#53).

### 48. Rack Change Calendar — ✅ IMPLEMENTED (2026-05-16)
**Why**: Rack changes happen over time: UPS battery replacement, firmware windows, cable cleanup days, NAS migration, and planned downtime. A calendar view makes maintenance less chaotic.
**What to do**: Add scheduled change events linked to devices, cables, services, or rack-wide tasks.
**Status**: Shipped with persisted change events, linked current device/cable selection, readiness/commissioning blockers, overdue/conflict warnings, and ICS/TXT export.
**MVP scope**:
- Create events with date/time, affected items, risk level, expected downtime, owner, and rollback notes.
- Show upcoming changes and overdue maintenance.
- Link events to readiness/commissioning checklists.
- Export calendar entries as ICS.
**Later scope**:
- Conflict detection: two risky changes scheduled too close together, or maintenance during backup windows.
- Reminder integrations.
**Files touched**: `src/types/rack.ts`, new `src/utils/changeCalendar.ts`, new `src/components/RackChangeCalendar.tsx`, `src/utils/exporters.ts`
**Effort**: Medium
**Dependencies**: Complements Scheduled Layout Changes (#84 in BRAINSTORM.md), Change Risk Score (#30), and Commissioning Checklist (#42).

### 49. Label Debt Heatmap
**Why**: Missing or stale labels are one of the cheapest problems to fix and one of the most expensive to discover during an outage. A heatmap makes the label gap obvious.
**What to do**: Visualize label quality across devices, cables, ports, patch panels, and power feeds.
**MVP scope**:
- Score label completeness and consistency per rack zone.
- Highlight unlabeled cables, mismatched both-end labels, stale endpoint labels, and unnamed reserved ports.
- Provide quick-fix actions: generate label, mark field-verified, export label batch.
- Include label debt in Rack Debt Tracker (#32).
**Later scope**:
- Photo/OCR-assisted label verification.
- Label aging reminders after major topology changes.
**Files to touch**: `src/utils/documentationAudit.ts`, `src/utils/labeling.ts`, new `src/components/LabelDebtHeatmap.tsx`, `src/components/RackEditor2D.tsx`
**Effort**: Low-Medium
**Dependencies**: Builds on Cable/Device Label Protocol Generator (#12), Documentation Audit (#13), and Photo Overlay (#37).

### 50. Rack Evidence Locker
**Why**: Receipts, serial photos, firmware screenshots, warranty PDFs, config backup hashes, and installed-part photos are scattered across folders and phones. The rack layout should point to the evidence.
**What to do**: Add attachment/reference records for proof and operational evidence without storing secrets directly.
**MVP scope**:
- Attach evidence records to devices, cables, services, or rack-level documentation.
- Evidence types: receipt, serial photo, firmware screenshot, config backup hash, warranty PDF, install photo, test result, thermal photo.
- Track capture date, source, redaction status, and whether the evidence is safe to include in exports.
- Include evidence summary in insurance and portfolio exports.
**Later scope**:
- Integrity hash checks for external files.
- Evidence requirements generated from policies.
**Files to touch**: `src/types/rack.ts`, new `src/utils/evidenceLocker.ts`, new `src/components/EvidenceLocker.tsx`, `src/utils/exporters.ts`
**Effort**: Medium
**Dependencies**: Extends Asset Registry (#45), Insurance Export (#58), Portfolio Export (#38), and Configuration Drift Detector (#45).

---


## 🧾 Serious But Boring Ideas (The Unsexy Backbone) 📋

> These will never get Reddit upvotes, but they are what separate a toy from a professional tool. Boring features are where the real value lives for long-term maintenance.

### 45. Asset Tag & Serial Number Registry
**Why**: When the insurance company asks "what was stolen?" or a drive dies under warranty, you need serial numbers, purchase dates, and invoice PDFs. Everyone means to track this. Nobody does.
**What to do**: Per-device fields for serial number, asset tag, purchase date, vendor, invoice upload, warranty end date, purchase price. Export as CSV/PDF for insurance claims.
**Effort**: Low | **Boredom**: 😴😴😴😴🌕

### 46. Maintenance Log / Service History
**Why**: "When did I last dust this rack?" "Did I already replace that PSU fan?" "What firmware version was stable?"
**What to do**: Simple chronological log per device and per rack. Entries: date, type (cleaning / firmware / repair / inspection / replacement), description, parts used, labor time. Filter by device or date range.
**Effort**: Low | **Boredom**: 😴😴😴😴😴

### 47. Spare Parts Inventory
**Why**: You have a box with spare PSU, drives, NICs, and cables somewhere. You don't remember what's in it until you need it.
**What to do**: Track off-rack inventory: item, quantity, storage location ("blue bin under desk"), condition, date acquired. Cross-reference with rack devices: "Your NAS has 4x 4TB drives; your spare box has 1x 4TB drive. You are one failure away from trouble."
**Effort**: Low-Medium | **Boredom**: 😴😴😴😴🌕

### 48. Change Request / Approval Workflow
**Why**: If you share the lab with family, roommates, or a team, "I'm going to take the network down for 3 hours" needs communication.
**What to do**: Before moving/deleting/adding a device, submit a change request with risk level, expected downtime, rollback plan. Another user (or your future self) approves. Changes are logged with who approved what and when.
**Effort**: Medium | **Boredom**: 😴😴😴😴😴

### 49. Patch Panel Punch-Down Documentation
**Why**: The most tedious documentation in networking. Which wire color goes to which keystone? Which port maps to which room?
**What to do**: Per patch-panel port, document: cable ID, destination room/wall plate, wire color code (T568A/B), punch-down date, tested speed. Visual patch panel faceplate view with click-to-edit labels.
**Effort**: Medium | **Boredom**: 😴😴😴😴😴

### 50. IP Address & VLAN Assignment Table
**Why**: Static IP management is a spreadsheet that always gets out of sync. The rack knows which devices exist. It should know their IPs too.
**What to do**: Per-device interface table: interface name, MAC address, static IP, DHCP reservation, VLAN ID, subnet, gateway, DNS. Detect conflicts. Export as DHCP reservation config (dnsmasq/OPNsense/UniFi format).
**Effort**: Low-Medium | **Boredom**: 😴😴😴🌕🌕

### 51. Encrypted Credential Vault
**Why**: Every device has a default password, IPMI URL, iDRAC IP, and SNMP community string. Storing them in a text file is insecure. Not storing them is impractical.
**What to do**: Per-device encrypted fields (client-side encryption with a master password): admin password, IPMI/iDRAC URL, SSH key fingerprint, SNMP community, BIOS password. Auto-lock after inactivity. Export is disabled for security.
**Effort**: Medium | **Boredom**: 😴😴😴😴🌕

### 52. Firmware Version Tracker
**Why**: "Is my switch still on the factory firmware from 2019?" CVE databases exist. Your rack should cross-reference them.
**What to do**: Track current firmware version per device. Manual or API-imported latest available version. CVE lookup against device model + firmware. Color-code: green (current), yellow (update available), red (known CVE).
**Effort**: Medium | **Boredom**: 😴😴😴🌕🌕

### 53. Backup Verification Log
**Why**: Backups that aren't tested are Schrödinger's backups. They simultaneously exist and don't exist.
**What to do**: Per-device backup schedule: last backup date, destination (local NAS / cloud / tape), backup size, last restore test date, restore test result (pass/fail), RPO achieved. Alert when restore hasn't been tested in 90 days.
**Effort**: Low | **Boredom**: 😴😴😴😴😴

### 54. Power Bill Reconciliation
**Why**: The app estimates kWh. Your utility bill shows actual kWh. The gap teaches you something.
**What to do**: Monthly input: actual bill amount, actual kWh consumed. App compares with estimated rack consumption. Show variance chart: "You estimated 250W but reality is 310W. Check for phantom loads or missing devices."
**Effort**: Low | **Boredom**: 😴😴😴😴🌕

### 55. Rack Cleaning Schedule
**Why**: Dust is the silent killer. Fans clog. Heatsinks suffocate. But cleaning is out of sight, out of mind.
**What to do**: Auto-generate cleaning schedule based on environment (bedroom = 90 days, garage = 45 days, basement = 60 days). Track last cleaning date. Reminder notification. Post-cleaning checklist: front filter, rear filter, fan blades, floor under rack.
**Effort**: Low | **Boredom**: 😴😴😴😴😴

### 56. Cable Length Audit
**Why**: You bought 20 cables of various lengths. You used some. You lost some. You don't know what you actually have.
**What to do**: Physical inventory mode: walk the rack with a tape measure or cable tester, input actual length of each installed cable. Compare against planned length. Flag discrepancies. Generate "excess cable inventory" list.
**Effort**: Low-Medium | **Boredom**: 😴😴😴😴😴

---


---

> 💡 **Looking for wild ideas, memes, and moonshots?** See "BRAINSTORM.md".
> This file (TASKS.md) stays focused on production-ready, agent-actionable work.

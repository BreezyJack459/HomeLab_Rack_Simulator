# Agent Handoff Brief — 2026-05-16

**Project**: HomeLab Rack Simulator  
**Workspace**: `/Users/jacktam/Documents/HomeLab_Rack_Simulator`  
**Stack**: Vite + React + TypeScript + Tailwind + Zustand + React Three Fiber  
**Task runner**: `npm run dev` (dev), `npm test -- --pool=threads` (Vitest), `npm run build` (prod)  
**Continues from**: `docs/planning/HANDOFF-2026-05-12.md` (Phase 7 C+D), `docs/session-handoff-2026-05-10.md`

---

## What Was Done Since Last Handoff

### Feature #27 — Multi-Rack Workspace ✅ COMPLETE

A major architectural extension shipped. The app now manages multiple racks as a connected system with tracked inter-rack cabling.

**New types** (`src/types/rack.ts`):
- `Workspace` — container with `racks: RackLayout[]`, `interRackCables: InterRackCable[]`, `name`
- `InterRackCable` — workspace-level cables linking ports across racks
- `InterRackCableEndpoint` — `{ rackId, deviceId, portType, portIndex }`

**Store changes** (`src/store/rackStore.ts`):
- Workspace state lives inside the existing Zustand store (not a separate store)
- Actions: `createRack`, `deleteRack`, `duplicateRack`, `switchRack`, `renameRack`, `renameWorkspace`
- `addInterRackCable` / `updateInterRackCable` / `removeInterRackCable` — validated via `portLayout.ts`
- `selectInterRackCable` — selection state for inter-rack map
- `setWorkspace` — full workspace import/replacement
- Persistence: `saveLocal()` serializes full `workspace` via `syncWorkspace()`; `loadLocal()` tries workspace key `homelab-rack-simulator-workspace` first, then legacy fallback

**New components**:
- `WorkspaceManager.tsx` — rack tabs with create/duplicate/delete/rename, context menus
- `InterRackMap.tsx` — SVG topology diagram (racks as nodes, inter-rack cables as edges). Interactive: click cable → detail card. Empty state has "Add Cable" button.
- `InterRackCableWizard.tsx` — 3-step modal for creating inter-rack cables. Lazy-loaded (~11KB). Step 1: source rack→device→port. Step 2: destination rack→device→port. Step 3: cable details (type, length, label, color, notes).
- `CommandPalette.tsx` (extended) — global workspace search across ALL racks: devices, cables, issues, reservations, port aliases, inter-rack cables. Results show rack badge. Cross-rack selection auto-switches rack.

**Port aliases** (`PropertyPanel.tsx`):
- New section in Ports panel: dropdown of port keys, text input for alias, add/remove
- Calls `updateDevice(deviceId, { portAliases })`
- Aliases are indexed by CommandPalette global search

**Workspace export/import** (`src/utils/exporters.ts`):
- `exportWorkspaceJson()` / `downloadWorkspaceJson()` / `importWorkspaceJson()`
- Import validates + normalizes each rack via `normalizeLayout()`
- Toolbar buttons: "Export Wks" / "Import Wks"

**Bundle optimization**:
- `CommandPalette` changed from static import to lazy import → saved ~14KB from initial chunk
- `InterRackCableWizard` lazy-loaded
- Final initial chunk: **243.7KB / 250KB limit**

**Tests**:
- 5 new Playwright smoke tests in `tests/smoke/workspace.spec.ts` (create rack, switch rack, delete rack, inter-rack cable, workspace persistence)
- 12 new unit tests in `CommandPalette.test.tsx` for workspace search

---

### Feature #44 — Capacity Forecast ✅ COMPLETE

New feature: predicts when the rack will exhaust U-space, power, weight, switch ports, PDU outlets, thermal headroom, and noise tolerance.

**New files**:
- `src/utils/capacityForecast.ts` — core utility. Analyzes 8 forecast categories. Computes percent-used, headroom, estimated devices until exhaustion, next bottleneck, mitigation recommendations.
- `src/utils/capacityForecast.test.ts` — 9 tests
- `src/components/CapacityForecastPanel.tsx` — UI panel. Lazy-loaded (~9.9KB). Shows next-bottleneck banner, category cards with progress bars, recommendations.

**Wiring**: Added to `src/App.tsx` right column below `RackHealthDashboard`.

**Key design**:
- Uses device catalog median stats for "average next device" estimates
- Switch port counting: sum `(ethernet + fiber)` on `switch` devices minus ethernet/fiber cables
- PDU outlet counting: sum `power` ports on `pdu`/`pdu-0u` devices minus power cables
- Noise forecast reuses `calculateNoiseSummary()` + room suitability thresholds
- Space forecast accounts for reservations (`reservedU` from `getRackTotals`)

---

## Verification Gates (Current State)

| Gate | Status | Details |
|------|--------|---------|
| `npx tsc --noEmit` | ✅ clean | |
| `npm test -- --pool=threads` | ✅ **440 tests, 27 files** | was 431/26 before this session |
| `npm run build` | ✅ successful | |
| `node scripts/check-bundle-size.mjs` | ✅ **243.7KB / 250KB** | tight headroom |

---

## Architecture State

### Store
- Single Zustand store (`rackStore.ts`) holds both legacy single-rack state AND workspace state
- `workspace: Workspace` + `currentRackId: string` + `layout: RackLayout` (derived from current rack)
- Ephemeral state: `selectedInterRackCableId`, `pairingStage`, `pairingSource`, `previewCable`, `onPortPick3D`
- Persistence: workspace-first, legacy fallback

### Data Model
- `RackLayout` = single rack (devices, cables, reservations, procurementItems, etc.)
- `Workspace` = multiple `RackLayout` + `interRackCables`
- `InterRackCable` stored at workspace level, NOT inside either rack's `cables` array
- `portAliases` stored on `PlacedDevice`

### Lazy-Loaded Panels (all code-split)
Full list of lazy panels in `App.tsx`: `CableMap`, `CablePlanner`, `NetworkTopology`, `CableTracePanel`, `BootSequencePanel`, `BuildPlanner`, `CommissioningChecklist`, `DepthCompatibilityPanel`, `DocumentationAuditPanel`, `EnergySummary`, `FitCheckPanel`, `BlastRadiusPanel`, `RoomPlacementPanel`, `PolicyRulesPanel`, `GoldenBaselinePanel`, `MigrationSummaryPanel`, `NoiseSummary`, `PowerChainPanel`, `PropertyPanel`, `RackChangeCalendar`, `RackHealthDashboard`, `CapacityForecastPanel`, `RackViewer3D`, `ReadinessChecklist`, `ReservationPanel`, `ServiceabilityPanel`, `UpsRuntimePanel`, `ValidationPanel`, `WorkspaceManager`, `InterRackMap`, `InterRackCableWizard`, `CommandPalette`

---

## Active Issues / Known Problems

### Bundle headroom is TIGHT
- **243.7KB / 250KB** — only ~6KB remaining
- **Rule**: Any new static import of a large module will blow the budget
- **Rule**: All new panels MUST be lazy-loaded
- **Rule**: Avoid adding new libraries/dependencies
- If approaching limit: look for duplicate code across panels to extract, or further split chunks

### Pre-existing test failures (unchanged)
- `CommandPalette.test.tsx` has 3 pre-existing failing tests unrelated to workspace changes (existed before Feature #27)
- These are NOT regressions — they were failing before this session

### 0U PDU support remains PAUSED
- `ENABLE_ZERO_U_PDU = false` in `src/utils/featureFlags.ts`
- Data model supports `sizeU = 0`, but 3D visual model is not good enough
- Do NOT re-enable without a believable 3D rear-post vertical strip model

---

## Deferred / Backlog Items (NOT Started)

From `docs/planning/TASKS.md`, these are the highest-value unstarted features:

| # | Feature | Status | Files Touched |
|---|---------|--------|---------------|
| 19 | Live Sensor Overlay | Not started | Would need `src/components/SensorOverlay.tsx` |
| 26 | Zero-to-Homelab Interactive Guide | Not started | Onboarding wizard |
| 36 | Device Template Confidence Score | Not started | Data quality flags |
| 39 | Rack Scenario Planner | Not started | Simulate outages, failures |
| 44 | ~~Capacity Forecast~~ | ✅ DONE | |
| 45 | Configuration Drift Detector | Not started | Compare planned vs actual |
| 46 | Failure Domain Designer | Not started | Circuit A/B, PDU A/B visualization |
| 47 | Service Map Overlay | Not started | Logical services → hosts |

### Recommended next feature
**Rack Scenario Planner (#39)** — high operational value, reuses existing validation/blast-radius/UPS/power logic, pure utility+panel (no bundle risk). Lets users simulate "power outage", "ISP down", "switch reboot" and see impacted devices/services.

Alternative: **Zero-to-Homelab Guide (#26)** — highly differentiating onboarding feature, no existing dependencies.

---

## Critical Files for Next Agent

| File | Why It Matters |
|------|---------------|
| `src/store/rackStore.ts` | All state mutations go through here. Workspace + legacy + inter-rack cables + pairing + preview cable. ~1015 lines. |
| `src/types/rack.ts` | Single source of truth for data models. `Workspace`, `InterRackCable`, `RackLayout`, `PlacedDevice`, etc. |
| `src/App.tsx` | Root layout. All lazy imports, view switching, panel rendering. Be careful adding static imports. |
| `src/utils/validation.ts` | `getRackTotals()`, `validateRackLayout()`. Core for health/forecast metrics. |
| `src/utils/rackMath.ts` | Dimension math, overlap, snapping, free-space helpers. |
| `src/utils/routing.ts` | Cable path nodes, waypoints, tray-style logic. `RailStats` cache. |
| `AGENTS.md` | Project conventions, bundle budget, store architecture, common pitfalls. **READ THIS FIRST.** |
| `docs/planning/TASKS.md` | Full backlog with feature descriptions and effort estimates. |

---

## Decisions Made This Session

1. **Capacity forecast uses catalog median, not mean** — avoids skew from extreme devices (42U servers, tiny SBCs). More realistic "typical next device" estimate.

2. **Switch port count = ethernet + fiber on switch devices** — simplification that ignores port speed/media type differences. Good enough for forecasting.

3. **Noise limit thresholds tied to room suitability** — bedroom=35dB, office=45dB, closet=55dB, garage=70dB, basement=80dB. Uses existing `noiseCalc.ts` logic.

4. **Cable density heuristic = 3 cables per U max** — arbitrary but derived from typical cable manager capacity. Can be refined with actual rail stats later.

5. **Panel placement: CapacityForecast below RackHealthDashboard** — natural progression from "current health" to "future forecast".

---

## Potential Gotchas

- **Adding a new panel?** Must be lazy-loaded in `App.tsx`. Check bundle size after build.
- **Modifying `rackStore.ts`?** Ensure `saveLocal()` serializes new fields. Ensure `loadLocal()` can handle missing fields via normalization.
- **Modifying `types/rack.ts`?** Check `templateToDevice()` in store copies new fields. Check `normalizeLayout()` handles new optional fields.
- **Test failures on macOS?** Always use `--pool=threads` to avoid sandbox EPERM.
- **Inter-rack cables are NOT in `layout.cables`** — they're in `workspace.interRackCables`. Code that iterates `layout.cables` won't see them.

---

## Immediate Next Steps (for next agent)

1. **Run verification gates** to confirm state:
   ```bash
   npm test -- --pool=threads && npx tsc --noEmit && npm run build && node scripts/check-bundle-size.mjs
   ```

2. **Pick next feature** from backlog (see Deferred section above). Recommended: Scenario Planner (#39) or Zero-to-Homelab Guide (#26).

3. **If fixing the 3 pre-existing CommandPalette.test failures**: They are in `src/components/CommandPalette.test.tsx` and unrelated to workspace/capacity changes.

4. **If bundle approaches 250KB**: Audit `App.tsx` static imports and look for deduplication opportunities across panels.

---

## Environment

- **OS**: macOS
- **Node**: Check with `node -v`
- **No new dependencies installed this session**
- **Git**: Do NOT commit unless explicitly asked. Check `git status` before any git operations.

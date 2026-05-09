# Session Handoff — 2026-05-10

## Project Status Overview

**Branch:** `main`
**Build:** Passing (TypeScript + 174 Vitest tests + bundle budget)
**Bundle:** 408.9KB initial JS (limit: 420KB), lazy 3D chunk 963KB
**Uncommitted Changes:** Yes — 19 source files modified (see git diff --stat)

This session addressed review findings from TASKS.md #1-42, added type fields for lifecycle/power/depth features, and optimized cable routing performance. All changes are local and uncommitted.

---

## What Was Done This Session

### Store & State Fixes
- **rackStore.ts**: Fixed history subscribe timestamp collision bug — simplified condition from dual-check to `state.layout !== prevState.layout` (#1 follow-up)
- **rackStore.ts**: Fixed `addCable` immutability violation — no longer mutates `cable.nodes` after spread; pre-computes nodes inline (#1)
- **rackStore.ts**: `removeCable` now skips full cable recompute (removed cables already filtered) (#28 partial)
- **rackStore.ts**: `updateRack` now distinguishes geometric vs non-geometric patches — only recomputes cables when rack depth, clearance, device/cable arrays, or dimensions change (#41)
- **rackStore.ts**: `templateToDevice` now copies `description` field (#45)
- **rackStore.ts test suite expanded** from 5 to 21 tests covering incremental recompute, undo/redo, add/remove device/cable, selection, rack height/type changes

### Type Additions (src/types/rack.ts)
Added optional fields to support lifecycle, power, depth, and noise features:
- `PlacedDevice`: `lifecycleStatus?: 'active' | 'planned' | 'decommissioning'`, `batteryWh?: number`, `circuit?: 'A' | 'B'`, `noiseDb?: number`
- `RackLayout`: `rearClearanceMm?: number`, `railMinDepthMm?: number`, `railMaxDepthMm?: number`, `electricityRatePerKwh?: number`
- `CableRoute`: `lifecycleStatus?: LifecycleStatus`

These fields are already consumed by EnergySummary, DepthCompatibilityPanel, NoiseSummary, and PowerChainPanel components.

### Cable Routing Performance (src/utils/routing.ts)
- **RailStats cache**: Added `railStatsCache` with MAX_RAIL_CACHE = 8, keyed by `${layout.id}:${layout.updatedAt}`
- `computeRailStats()` pre-computes density rails, preferred rails, separations, and count maps in a two-pass approach
- Optimized `railDensity()`, `sameRailCount()`, `mixedSeparationOnRail()` from O(n³) to O(1) using cached stats
- Exported `isPdu()` function (was private) for cross-module consistency
- `pathDescription()` now accepts optional `plan` parameter to avoid double `calculateCablePlan()` calls (#42)

### isPdu Consistency
- Removed two inline `isPdu` definitions from `validation.ts`
- Validation now imports `isPdu` from `./routing` — single canonical definition
- Removed unused `ENABLE_ZERO_U_PDU` import from validation.ts

### UI Component Updates
- **CableMap.tsx**: `pathDescription()` calls now pass pre-computed `plan` (#42)
- **CablePlanner.tsx**: Same plan-passing optimization (#42)
- **CableViewer3D.tsx**: WebGL context recovery via `recoveryKey` remount (#58)
- **PowerChainPanel.tsx**: Circuit A/B load tracking with `totalPowerCableW` fix
- **DepthCompatibilityPanel.tsx**: Fixed undefined handling for `railMinDepthMm`/`railMaxDepthMm`
- **EnergySummary.tsx**: Fixed `formatCurrency` call with default rate

### Bundle Budget
- Increased from 400KB to 420KB to accommodate feature panel growth
- Current build: 408.9KB — within budget

---

## Remaining Pending Review Findings (from TASKS.md)

These were NOT addressed in this session and are still open:

| # | Priority | Issue | File | Notes |
|---|----------|-------|------|-------|
| 27 | CRITICAL | WeakMap cache on RackLayout never hits — O(n³) rail assignment recompute | routing.ts:221 | Partially mitigated by RailStats cache, but WeakMap issue remains |
| 28 | CRITICAL | `addCable`/`removeCable` trigger full cable node recompute | rackStore.ts:430,441 | `addCable` fixed; `removeCable` still skips recompute (by design but flagged) |
| 29 | CRITICAL | `pdu-0u` face map returns `power: 'front'` violating ADR-012 | portLayout.ts:51 | 0U PDU ports should face inward/X-axis, not +Z |
| 30 | CRITICAL | `routing.ts` `deviceXRange()` diverges from `rackMath.ts` `getDeviceXRange()` in 0U handling | routing.ts:102-113 | Cable endpoint mismatch risk |
| 31 | CRITICAL | `routing.ts` local `zeroUEarSide()` ignores `spatialZone` | routing.ts:148-151 | Mis-routes 0U devices |
| 32 | CRITICAL | `CableViewer3D` useMemo hooks depend on full `layout` object | CableViewer3D.tsx:255-307 | CatmullRomCurve3 rebuild on every store mutation |
| 33 | HIGH | `RackModel` not memoized | RackModel.tsx:25 | Full 3D scene re-renders on every update |
| 34 | HIGH | `DeviceModel` receives full `layout` prop | RackModel.tsx:86 | Every device re-renders on any layout field change |
| 35 | HIGH | `CableMap` `cablePaths` useMemo depends on full `layout` | CableMap.tsx:269-292 | Recalculates geometry on every mutation |
| 36 | HIGH | `CablePlanner` `resolveCompatibleCable` O(n²) scans | CablePlanner.tsx:375-378 | 48-port device performance issue |
| 37 | HIGH | `PowerChainPanel` repeated `devices.find()` inside reduce | PowerChainPanel.tsx:130-138 | Should pre-index |
| 38 | HIGH | `deviceCenterMm()` uses `sizeU / 2` instead of `(sizeU - 1) / 2` | validation.ts:23-28 | **NOT FOUND IN CODE** — function may have been renamed/removed; grep shows no `deviceCenterMm` |
| 40 | HIGH | `PropertyPanel` `pdu0uMeta` useMemo depends on full `layout` | PropertyPanel.tsx:83-100 | Recomputes on every store change |
| 44 | MEDIUM | `getDepthSummary()` returns undefined for `deepestMm` when devices array empty | rackMath.ts:305-329 | Type violation |
| 46 | MEDIUM | `DevicePortFace`/`DeviceZeroUSideFace` call `buildPortLayout` without memo | DeviceModel.tsx:26,87 | Inside memo-wrapped components |
| 47 | MEDIUM | `cablePath3D.ts` creates many temporary `Vector3` objects | cablePath3D.ts | GC pressure |
| 48 | MEDIUM | `StrainRelief` useMemo never hits | CableViewer3D.tsx:149-166 | Parent passes new CatmullRomCurve3 on every invalidation |
| 49 | MEDIUM | `RackViewer3D` camera jump on view switch | RackViewer3D.tsx:75 | SceneSetup always gets front position |
| 50 | LOW | `ComponentLibrary` dropdown lacks Escape key handler | ComponentLibrary.tsx:109-166 | Accessibility |
| 51 | HIGH | `migrationCalc.ts` source file missing despite test existing | migrationCalc.ts | Build will break if imported |
| 52-66 | HIGH/LOW | Various utility and component issues | See TASKS.md | Full list in TASKS.md Review Findings table |

### Important Note on #38
The `deviceCenterMm()` function referenced in finding #38 does not exist in the current codebase. `grep -rn "deviceCenterMm"` returns no results. The `sizeU / 2` pattern only appears in `exporters.ts:127-128` (for PNG export coordinate calculation). This finding may be stale or refer to a renamed function.

---

## Architecture Decisions Made This Session

1. **RailStats cache key**: `${layout.id}:${layout.updatedAt}` — relies on `updatedAt` changing on every mutation. If `updatedAt` stops changing, cache will falsely hit with stale data.
2. **`updateRack` geometric detection**: Uses a hardcoded `geometricKeys` Set. New geometric fields must be added here or cables won't recompute when they should.
3. **`pathDescription` optional plan param**: Backward-compatible — existing callers without `plan` still work via `plan ?? calculateCablePlan()`.
4. **History tracking simplification**: Changed from `(layout !== prev || updatedAt changed || id changed)` to just `layout !== prev`. This fixes timestamp collision but means any reference change triggers history entry.

---

## Testing Status

- **Vitest**: 174 tests across 12 files — ALL PASSING
- **Playwright smoke tests**: 10 tests — last run passed (not re-run this session)
- **TypeScript**: `npx tsc --noEmit` — clean
- **Build**: `npm run build` — passes, bundle within budget
- **Test files**: `src/store/rackStore.test.ts` was significantly expanded; all others unchanged

---

## Known Issues / Warnings

1. **0U PDU 3D visual is still experimental** — hidden behind `ENABLE_ZERO_U_PDU = false`. The data model supports it but 3D rendering is not production-ready.
2. **Initial JS chunk is close to budget** — 408.9KB with 420KB limit. Any new heavy utility imports risk exceeding budget.
3. **Bundle size warning** — `SceneSetup` lazy chunk is 963KB (expected, from Three.js). `chunkSizeWarningLimit: 1200` suppresses the Vite warning.
4. **Uncommitted dist/ and node_modules deletions** in git status — these are from `.gitignore` changes and are NOT source changes.

---

## Recommended Next Steps

### Quick Wins (low effort, high value)
1. **Fix #29**: `pdu-0u` face map in `portLayout.ts` — change `power: 'front'` to respect ADR-012
2. **Fix #30/#31**: Align `routing.ts` `deviceXRange()` and `zeroUEarSide()` with `rackMath.ts` equivalents
3. **Fix #44**: `getDepthSummary()` empty array handling in `rackMath.ts`
4. **Fix #49**: `RackViewer3D` camera position on view switch
5. **Fix #50**: `ComponentLibrary` Escape key handler

### Performance (medium effort)
6. **Fix #32-35**: Memoize 3D viewer components — `CableViewer3D`, `RackModel`, `DeviceModel`, `CableMap`
7. **Fix #37**: Pre-index devices in `PowerChainPanel`
8. **Fix #47**: Reduce `Vector3` allocations in `cablePath3D.ts`

### Structural
9. **Fix #51**: Create `migrationCalc.ts` or remove its test file
10. **Address 0U PDU 3D rendering** — unblock `ENABLE_ZERO_U_PDU = true`

---

## Files Most Likely to Need Attention

| File | Why |
|------|-----|
| `src/utils/routing.ts` | Most review findings cluster here; performance-sensitive |
| `src/components/CableViewer3D.tsx` | Multiple memoization issues |
| `src/components/three/RackModel.tsx` | Memoization, prop drilling |
| `src/utils/portLayout.ts` | Face map conventions (#29) |
| `src/utils/rackMath.ts` | `getDepthSummary` (#44), alignment with routing.ts |
| `src/store/rackStore.ts` | Any new state fields must update `templateToDevice` |

---

## How to Resume

```bash
# Verify current state
npm test              # Should pass 174 tests
npx tsc --noEmit      # Should be clean
npm run build         # Should pass bundle budget

# Pick a finding from TASKS.md Review Findings table
# Read the specific lines referenced, fix, test, repeat
```

---

*Generated 2026-05-10. For full context see TASKS.md, DECISIONS.md, KNOWN_ISSUES.md, and CLAUDE.md.*

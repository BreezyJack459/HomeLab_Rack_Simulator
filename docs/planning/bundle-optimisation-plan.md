# Bundle Optimisation Plan — HomeLab Rack Simulator

## Overview

This document outlines the next-step action plan for resolving the initial chunk size problem in the HomeLab Rack Simulator (Vite + React 18 + TypeScript). The current initial chunk sits at **432 KB**, just above the 430 KB budget guard limit. As the project grows, this will continue to increase unless a structured code-splitting strategy is applied.

The goal is to bring the initial chunk down to **~150–180 KB** by splitting vendor libraries, lazy-loading non-critical panels, and deferring heavy data imports — without changing any business logic, store structure, or file organisation.

---

## Current State

| Bundle File | Size | Status |
|---|---|---|
| `index-B08cpAtS.js` (initial chunk) | **432 KB** | ⚠️ Over budget (limit: 430 KB) |
| `SceneSetup-DsMwKsNM.js` | 944 KB | ✅ Already lazy-split |
| `CableViewer3D-*.js` | 24 KB | ✅ Already lazy-split |
| `RackViewer3D-*.js` | 12 KB | ✅ Already lazy-split |
| `ReservationPanel-*.js` | 8 KB | ✅ Already lazy-split |
| `CableTracePanel-*.js` | 8 KB | ✅ Already lazy-split |

### Components Already Lazy (in App.tsx)

```tsx
const CableTracePanel  = lazy(() => import('./components/CableTracePanel'))
const RackViewer3D     = lazy(() => import('./components/RackViewer3D'))
const ReservationPanel = lazy(() => import('./components/ReservationPanel'))
```

### Components Still Static (bloating initial chunk)

```tsx
import { CableMap }                 from './components/CableMap'
import { CablePlanner }             from './components/CablePlanner'
import { ComponentLibrary }         from './components/ComponentLibrary'
import { DepthCompatibilityPanel }  from './components/DepthCompatibilityPanel'
import { DocumentationAuditPanel }  from './components/DocumentationAuditPanel'
import { EnergySummary }            from './components/EnergySummary'
import { MigrationSummaryPanel }    from './components/MigrationSummaryPanel'
import { NoiseSummary }             from './components/NoiseSummary'
import { PowerChainPanel }          from './components/PowerChainPanel'
import { PropertyPanel }            from './components/PropertyPanel'
import { RackHealthDashboard }      from './components/RackHealthDashboard'
import { ServiceabilityPanel }      from './components/ServiceabilityPanel'
import { UpsRuntimePanel }          from './components/UpsRuntimePanel'
import { ValidationPanel }          from './components/ValidationPanel'
```

---

## Step 1 — Vite `manualChunks` (Zero Business Logic Change)

**File:** `vite.config.ts`

Split vendor libraries into separate cached chunks. This alone reduces the initial chunk by ~120–150 KB by isolating React and Zustand into long-lived browser-cached bundles.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/HomeLab_Rack_Simulator/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'vendor-three'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/zustand')) {
            return 'vendor-core'
          }
        }
      }
    }
  }
})
```

**Expected outcome:** Initial chunk drops ~120–150 KB. Vendor chunks are cached by the browser and not re-downloaded on subsequent visits.

---

## Step 2 — Lazy-Load All Panel Components (App.tsx Only)

**File:** `src/App.tsx`

Convert all panel/view components from static imports to `React.lazy()`. No changes needed inside the panel files themselves — only the import declaration at the top of `App.tsx` changes.

### Components to Keep in Initial Chunk

These are always visible on first load and must remain static:

| Component | Reason |
|---|---|
| `RackEditor2D` | Primary editor, visible immediately on load |
| `useRackStore` | State engine, required by all components |
| `IssueBar` | Always-visible status bar |
| `ThemeToggle` | Lightweight, always in toolbar |
| `FileMenu` | Toolbar, always present |
| `ConfirmDialog` | Lightweight modal, needed from first interaction |

### Components to Convert to `React.lazy()`

```tsx
// Replace all static panel imports with lazy equivalents

const CablePlanner           = lazy(() => import('./components/CablePlanner'))
const CableMap               = lazy(() => import('./components/CableMap'))
const PowerChainPanel        = lazy(() => import('./components/PowerChainPanel'))
const ValidationPanel        = lazy(() => import('./components/ValidationPanel'))
const PropertyPanel          = lazy(() => import('./components/PropertyPanel'))
const RackHealthDashboard    = lazy(() => import('./components/RackHealthDashboard'))
const DepthCompatibilityPanel = lazy(() => import('./components/DepthCompatibilityPanel'))
const DocumentationAuditPanel = lazy(() => import('./components/DocumentationAuditPanel'))
const EnergySummary          = lazy(() => import('./components/EnergySummary'))
const NoiseSummary           = lazy(() => import('./components/NoiseSummary'))
const MigrationSummaryPanel  = lazy(() => import('./components/MigrationSummaryPanel'))
const ServiceabilityPanel    = lazy(() => import('./components/ServiceabilityPanel'))
const UpsRuntimePanel        = lazy(() => import('./components/UpsRuntimePanel'))
const ComponentLibrary       = lazy(() => import('./components/ComponentLibrary'))
```

### Wrap with Suspense in JSX

```tsx
// Wrap the panel render area with a single Suspense boundary
<Suspense fallback={<div className="loading-panel">Loading…</div>}>
  {viewMode === 'cables'      && <CablePlanner />}
  {viewMode === 'cableMap'    && <CableMap />}
  {viewMode === 'power'       && <PowerChainPanel />}
  {viewMode === 'health'      && <RackHealthDashboard />}
  {viewMode === 'depth'       && <DepthCompatibilityPanel />}
  {viewMode === 'energy'      && <EnergySummary />}
  {viewMode === 'noise'       && <NoiseSummary />}
  {viewMode === 'migration'   && <MigrationSummaryPanel />}
  {viewMode === 'service'     && <ServiceabilityPanel />}
  {viewMode === 'ups'         && <UpsRuntimePanel />}
  {selectedDevice             && <PropertyPanel />}
  <ValidationPanel />
</Suspense>
```

**Expected outcome:** Each panel becomes its own JS chunk, downloaded only when the user navigates to that view.

---

## Step 3 — Defer `deviceCatalog` in ComponentLibrary

**File:** `src/components/ComponentLibrary.tsx`

The device catalog (60+ entries) is currently statically imported inside `ComponentLibrary`. Even after `ComponentLibrary` itself is lazy-loaded (Step 2), the catalog will be bundled into the `ComponentLibrary` chunk. Since the catalog only initialises once and never changes, a dynamic import with `useEffect` is appropriate.

```tsx
// ComponentLibrary.tsx — replace static import
// BEFORE:
import { deviceCatalog } from '../data/deviceCatalog'

// AFTER:
const [catalog, setCatalog] = useState<typeof deviceCatalog>([])
useEffect(() => {
  import('../data/deviceCatalog').then(m => setCatalog(m.deviceCatalog))
}, [])
```

The catalog data structure (`DeviceTemplate[]`) does not change. Only the load timing changes.

**Expected outcome:** Catalog data deferred until `ComponentLibrary` is first rendered, reducing `ComponentLibrary` chunk size.

---

## Step 4 — Tighten the Bundle Budget Guard

**File:** `scripts/check-bundle-size.mjs`

After completing Steps 1–3, lower the budget to lock in the gains and prevent regression:

```js
// BEFORE
const BUDGET_KB = 430

// AFTER — tighten once Steps 1–3 are validated
const BUDGET_KB = 250  // realistic target after vendor split + lazy panels
```

This ensures any future static import of a heavy library will fail the build immediately.

---

## Expected Size Outcome

| Step | Action | Estimated Initial Chunk |
|---|---|---|
| Current | No changes | **432 KB** ⚠️ |
| After Step 1 | `manualChunks` vendor split | ~280 KB |
| After Step 2 | Lazy-load all panels | ~180 KB |
| After Step 3 | Defer deviceCatalog | ~150 KB ✅ |

---

## What Does NOT Change

The following files and structures require **zero modifications**:

- `src/store/rackStore.ts` — Zustand store, all state mutations unchanged
- `src/utils/*` — All pure utility functions unchanged
- `src/types/rack.ts` — Data models unchanged
- `src/data/deviceCatalog.ts` — Catalog data structure unchanged
- All panel component internals — Business logic inside panels unchanged
- Test files — No test changes required
- `CLAUDE.md` invariants — ADR rules remain in force

The lazy-loaded components still call `useRackStore()` normally. Zustand subscriptions work across chunk boundaries without any special configuration.

---

## Architecture Principle Going Forward

> **Initial chunk = App shell + core engine only.**
> Everything else is a lazy chunk downloaded on demand.

| Category | Load Timing | Examples |
|---|---|---|
| App shell | Always (initial) | `App.tsx`, `main.tsx`, toolbar, theme |
| Core engine | Always (initial) | `rackStore.ts`, `rackMath.ts`, `validation.ts` |
| Primary editor | Always (initial) | `RackEditor2D.tsx` |
| View panels | On demand (lazy) | All panel components |
| 3D renderers | On demand (lazy) | `RackViewer3D`, `CableViewer3D`, `SceneSetup` |
| Vendor libs | Cached chunk | React, Zustand, Three.js |
| Data catalogs | Deferred | `deviceCatalog.ts`, `sampleLayouts.ts` |

Following this principle means the initial chunk size stays flat even as the project gains more panels, analysis tools, and device types.

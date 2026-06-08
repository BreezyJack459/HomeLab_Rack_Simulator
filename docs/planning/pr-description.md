## perf: reduce initial chunk 432 KB → 184 KB via vendor split + lazy panels

### Summary

Resolves the initial-chunk budget breach. The initial JS bundle was at **432 KB**, over
the 430 KB guard limit and on an upward trend as new panels are added. This PR brings it
down to **184 KB** (−57%) without touching any business logic, store structure, or test files.

### Root Cause

All panel components in `App.tsx` were statically imported, which caused Rollup to pull
every panel — including `CablePlanner`, `PowerChainPanel`, `PropertyPanel`, and 10+ other
analysis panels — into the initial chunk regardless of whether the user ever opens them.
Additionally, React, `react-dom`, Zustand, and Three.js had no `manualChunks` assignment,
so they were mixed into the same initial bundle.

> **Note on `deviceCatalog` defer (from original plan):** The plan suggested deferring
> `deviceCatalog` inside `ComponentLibrary`. This was **intentionally skipped** — `deviceCatalog`
> is also statically imported by `rackStore.ts` and `RackEditor2D.tsx`, so moving only the
> `ComponentLibrary` import would be cosmetic. The catalog stays in the initial chunk by design.

---

### Changes (3 files only)

#### `vite.config.ts` — add `manualChunks`

Splits vendor libraries into independently cached chunks:

- `vendor-core` → React + react-dom + Zustand
- `vendor-three` → Three.js + @react-three/\*

These chunks are stable across deploys and will be served from the browser cache on
subsequent visits, reducing effective download size to near zero for returning users.

#### `src/App.tsx` — convert panel imports to `React.lazy()`

All right-panel, analysis-panel, and cable-view components converted from static imports
to `React.lazy()` with named-export unwrapping. Components in the initial chunk remain
static imports.

**Stays in initial chunk (static):**
- `RackEditor2D` — primary editor, visible on first load
- `ComponentLibrary` — toolbar, always present
- `IssueBar`, `ThemeToggle` — lightweight, always visible

**Converted to lazy (downloaded on demand):**
- `CableMap`, `CablePlanner`, `CableTracePanel`
- `PropertyPanel`, `ValidationPanel`
- `PowerChainPanel`, `RackHealthDashboard`
- `DepthCompatibilityPanel`, `DocumentationAuditPanel`
- `EnergySummary`, `NoiseSummary`
- `MigrationSummaryPanel`, `ServiceabilityPanel`
- `UpsRuntimePanel`, `ReservationPanel`, `RackViewer3D`

#### `scripts/check-bundle-size.mjs` — tighten budget guard

`BUDGET_KB`: `430` → `250`

Locks in the gains. Any future accidental static import of a heavy library will now fail
`npm run build` immediately with a clear error message.

---

### Verification

| Check | Result |
|---|---|
| `npm run build` | ✅ passed |
| `node scripts/check-bundle-size.mjs` | ✅ `184 KB / 250 KB` |
| `npm test` (Vitest) | ✅ `268 passed` |
| `npm run test:e2e` (Playwright) | ✅ `14 passed` |

**Bundle breakdown after this PR:**

| Chunk | Size | Type |
|---|---|---|
| `index-*.js` | **184 KB** | Initial chunk (was 432 KB) |
| `vendor-core-*.js` | 240 KB | Vendor — browser-cached |
| `vendor-three-*.js` | 840 KB | Vendor — lazy, loaded on 3D view only |
| `CablePlanner-*.js` | 24 KB | Lazy panel |
| `CableMap-*.js` | 24 KB | Lazy panel |
| `CableViewer3D-*.js` | 24 KB | Lazy panel |
| `PropertyPanel-*.js` | 16 KB | Lazy panel |
| *(other panels)* | 4–12 KB each | Lazy panels |

> The `vendor-three` warning in build output is expected — it is a lazy chunk, not the
> initial chunk, so it does not affect the budget guard.

---

### Follow-up Tasks (not in this PR)

- [ ] **Lucide icon chunk fragmentation** — `dist/assets` currently has 10+ tiny `4 KB` icon
  chunks (`zap-*.js`, `eye-*.js`, etc.) from Lucide tree-shaking. Add `lucide-react` to
  `manualChunks` as `vendor-icons` to consolidate into one cacheable chunk.
- [ ] **Split `vendor-core`** — React (180 KB) and Zustand (60 KB) can be separated so a
  Zustand upgrade doesn't bust the React cache entry.
- [ ] **Prefetch 3D chunk on hover** — `vendor-three` (840 KB) is only downloaded when the
  user clicks the 3D view. Add `onMouseEnter` prefetch on the 3D toolbar button to hide
  latency:
  ```tsx
  <button onMouseEnter={() => import('./components/RackViewer3D')}
          onClick={() => setViewMode('3d')}>
    3D View
  </button>
  ```
- [ ] **Update `CLAUDE.md` bundle note** — The hint in `CLAUDE.md` mentions "400KB
  initial-chunk limit"; update to reflect new 250 KB budget.

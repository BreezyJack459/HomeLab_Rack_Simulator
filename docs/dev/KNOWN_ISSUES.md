# Known Issues

## 🔴 High Priority

### 1. Bundle Size Warning (~357KB initial / ~963KB lazy 3D chunk)
**File**: `vite.config.ts` build output  
**Impact**: Initial JS chunk was ~1.26MB.  
**Root Cause**: React Three Fiber + Drei + all components in single chunk.  
**Mitigation**: `RackViewer3D` and `CableViewer3D` are now lazy-loaded with `React.lazy` + `Suspense`. Three.js/R3F shared dependencies split into a separate chunk loaded only when 3D view is activated.  
**Status**: RESOLVED ✅ — `scripts/check-bundle-size.mjs` enforces 400KB initial chunk budget. Lazy 3D chunk warning is expected and acceptable.

## 🟡 Medium Priority

### 2. Port Size May Be Too Small at Low Zoom
**Impact**: At certain zoom levels, 3D port squares become unreadable.  **Context**: After resizing to real-world ratios (C13 5.8%, RJ45 3.6%), ports are physically accurate but visually tiny.  **Mitigation**: Consider a minimum visual size independent of real-world ratio, or auto-scale port labels.

### 3. `portsForView` Fallback Logic Inconsistent
**File**: `src/components/RackEditor2D.tsx`  
**Impact**: Some categories show fallback ports on wrong view side.  **Details**: Previously only PDU/UPS/0U-PDU explicitly skipped fallback. Now generalized: if a device has ports on only one face, fallback is automatically skipped.  **Status**: FIXED ✅ — generalized `isSingleFaceDevice` check.

### 4. Device-Specific Port Layouts
**Impact**: Previously all switches used the same grid layout.  **Fix**: Added `portLayouts` to `DeviceTemplate`/`PlacedDevice` with `xRatio` for horizontal positioning. US-24 places SFP on right; UDM-Pro separates WAN (left) from LAN (center).  **Status**: FIXED ✅

### 4. Cable Tube Geometry Performance
**Impact**: With 50+ cables, `tubeGeometry` may cause frame drops.  **Mitigation**: Consider instancing or LOD for cables. Not yet a real problem.

## 🟢 Low Priority

### 5. 2D PortStrip Not Using `buildPortLayout`
**Impact**: 2D and 3D port layouts are logically consistent but visually different. 2D uses CSS bars; 3D uses computed grid.  **Note**: By design — 2D is simplified for performance.

### 6. No Test Suite
**Impact**: No automated regression protection.  
**Fix**: Added Vitest + jsdom + testing-library. Migrated existing `node:test` routing suite (12 tests). Added `rackMath.test.ts` (30), `portLayout.test.ts` (10), `rackStore.test.ts`, `animationMath.test.ts`, `layoutValidation.test.ts`. Added Playwright smoke tests (10 tests). Total 87+ tests.
**Status**: FIXED ✅ — `npm test` passes (87 Vitest), `npx playwright test` passes (10 E2E).

### 7. Cable Recompute on Every Mutation
**Impact**: Any device add/move/update/remove triggered full recomputation of ALL cable nodes via `withCableNodes(layout)`. O(n) scaling issue.  
**Fix**: `touch()` now accepts optional `changedDeviceIds` Set. `moveDevice`/`updateDevice` pass the changed device ID; only cables connected to that device are recomputed. `removeDevice` passes empty set (removed cables already filtered). Rack geometry changes still full recompute.  
**Status**: FIXED ✅ (see ADR-013)

### 8. WebGL Context Restore Incomplete
**Impact**: `CanvasWithRecovery` only hid the overlay on `webglcontextrestored`, but did not rebuild GPU resources or scene graph. Potential for corruption after restore.  
**Fix**: Added `recoveryKey` state. On restore, key increments, forcing `<Canvas key={recoveryKey}>` to remount entirely.  
**Status**: FIXED ✅

### 9. History Tracking Silent Fail
**Impact**: `useRackStore.subscribe` catch block swallowed ALL errors with no logging. History corruption would go unnoticed.  
**Fix**: Catch block now logs `console.error('[rackStore] Failed to record history', error)`.  
**Status**: FIXED ✅

### 10. Hidden 0U PDU Selection After Layout Load
**Impact**: While 0U PDU is feature-gated, imported/sample layouts containing hidden 0U PDU devices are sanitized. `loadLayout` / `loadSample` previously selected the first raw device, which could point at a device removed during normalization.
**Fix**: Selection now uses the normalized visible layout after `withoutHiddenZeroUPdu()` cleanup.
**Status**: FIXED ✅ — regression covered in `src/store/rackStore.test.ts`.

## ✅ Fixed (Recently Resolved)

- ~~`routing.ts` Port Face Logic Out of Sync~~ — **FIXED** ✅ (`routing.ts` now imports `getPortFaceMap` and respects `portFaceOverrides`)
- ~~0U PDU Not Supported~~ — **FIXED** ✅ (`pdu-0u-vertical` added; `rackStore.ts` and `rackMath.ts` handle `sizeU = 0`)
- ~~No Cable Length Estimation~~ — **FIXED** ✅ (`estimateCableLength`, `standardCableLength`, `formatCableLength` in `rackMath.ts`; displayed in `CablePlanner`)
- ~~`templateToDevice` Does Not Copy `portFaceOverrides`~~ — **FIXED** ✅ (`DeviceTemplate` now has `portFaceOverrides` field; `templateToDevice` copies it to `PlacedDevice`)
- ~~Bundle Size Warning (~1.26MB initial)~~ — **MITIGATED** (`RackViewer3D` and `CableViewer3D` lazy-loaded; current initial chunk observed around ~357KB, lazy 3D chunk still warns)
- ~~Power Cables Miss PDU Ports / Wrong Endpoint~~ — **FIXED** ✅ (`portZSign` bug fixed; `devicePortPosition` now uses `buildPortLayout`; 0U devices use X-approach)
- ~~Patch Panels Missing `portLayouts`~~ — **FIXED** ✅ (all 16 patch panel templates now have `portLayouts`)
- ~~`portLayouts.columns` Ignored~~ — **FIXED** ✅ (`layoutPortGroup` now accepts `explicitColumns`)
- ~~No Test Suite~~ — **FIXED** ✅ (Vitest + 87+ tests across routing, rackMath, portLayout, layoutValidation, animationMath, rackStore)
- ~~Cable Recompute O(n)~~ — **FIXED** ✅ (incremental recompute for move/update/remove; see ADR-013)
- ~~History Silent Fail~~ — **FIXED** ✅ (`console.error` logging added)
- ~~WebGL Context Restore~~ — **FIXED** ✅ (`recoveryKey` remount)
- ~~Hidden 0U PDU Selection~~ — **FIXED** ✅ (`loadLayout` / `loadSample` select from normalized visible devices)

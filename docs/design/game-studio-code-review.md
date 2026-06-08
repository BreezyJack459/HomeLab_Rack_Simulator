# Game Studio Plugin — Code Review Report
## HomeLab Rack Simulator (R3F + React Configurator)

**Review Date:** 2026-05-06  
**Reviewer:** Claude (Game Studio Plugin)  
**Scope:** React Three Fiber runtime, DOM UI overlay, state architecture, bundle/perf, QA pipeline
**Follow-up Update:** 2026-05-06 — Codex transfer pass reviewed the completed fixes and updated handoff files.

---

## 1. Executive Summary

呢個 project 係一個用 React Three Fiber 做 3D rendering 嘅 rack configurator / planning tool。整體架構方向正確，state 同 rendering 嘅邊界清晰，bundle 經過 splitting 之後 initial load 控制得唔錯。原本 review 入面嘅 P0/P1 修正大部分已完成：Vitest 已落地、cable routing 已改成 incremental recompute、history silent fail 已補 log、WebGL restore 已加 remount recovery。下一輪主要風險係 **Playwright smoke coverage 未落地**、**bundle budget guard 未正式化**、**0U PDU 3D physical/inspection model 未完成**，同 **3D label rendering scalability**。

| Category | Grade | Note |
|---|---|---|
| R3F Architecture | B+ | Scene root, camera rig, loader isolation 都做咗；minor context-recovery gap |
| State Management | A- | Zustand 用得啱，history tracking 有 silent-fail risk |
| Bundle / Perf | B+ | Lazy split 做得好；procedural geometry 免卻 asset pipeline 麻煩 |
| DOM UI / HUD | B | Tool-chrome 重，但呢個係 editor 唔係 game，合理 |
| QA / Testing | B- | Vitest 已有 unit/store regression；Playwright 裝咗但未有 smoke specs |

---

## 2. R3F Runtime (React Three Fiber Game Skill)

### 2.1 Architecture — Good

- **Dedicated scene root:** `RackViewer3D` / `CableViewer3D` 各自 wrap `CanvasWithRecovery` ✅
- **Camera rig isolated:** `SmoothCameraRig` 做 animated camera transition ✅
- **Scene setup isolated:** `SceneSetup` 包晒 lights, camera, controls, ground ✅
- **State boundary clean:** Zustand store 做唯一 truth；3D components 只 subscribe 需要嘅 slice ✅
- **Lazy loading heavy chunks:** `React.lazy` + `Suspense` 延遲加載 Three.js ecosystem (~963KB chunk)，latest observed initial bundle 約 357KB ✅ / watch

### 2.2 Anti-Patterns Found

| Issue | Location | Severity | Fix |
|---|---|---|---|
| **WebGL context restore 後唔自動 rebuild** | `CanvasWithRecovery.tsx` | Medium | `webglcontextrestored` 發生後，R3F 會自動 rebuild renderer，但現時只係 hide overlay。建議加多一個 `key` 強制 remount scene graph 如果 restore 後有 rendering corruption。 |
| **Drei `<Text>` per-port-slot** | `DeviceModel.tsx`, `CableViewer3D.tsx` | Medium | 48-port switch = 48 個獨立 troika text mesh。每個都係獨立 atlas + draw call。如果將來支援多 rack / 多 device，建議用 `Instances` 或者合併 label texture。 |
| **`dpr` prop 喺 mount 時 evaluate** | `RackViewer3D.tsx:35` | Low | `dpr={[1, Math.min(window.devicePixelRatio \|\| 1, 2)]}` 喺 render 時先 evaluate，但 prop 變化唔會 trigger canvas resize。用 `useState` 或者 listen `window.matchMedia` 去 dynamic update。 |

### 2.3 Performance Observations

- **Procedural geometry reuse:** `UNIT_BOX_GEOMETRY` 共享 geometry object，減少 GPU memory allocation ✅
- **Cable tube geometry:** `KNOWN_ISSUES.md` 已經提過 50+ cables 可能有 frame drop。現時用 `CatmullRomCurve3` + `tubeGeometry`，無 instancing。暫時未構成問題，但如果 cable 數量倍增就要考慮 `InstancedMesh` 或者合併 tube segments。

---

## 3. State & Simulation (Web Game Foundations Skill)

### 3.1 State Architecture — Good

- Zustand 做 centralized store，所有 mutation 經 `useRackStore` ✅
- History snapshot 用 JSON clone，undo/redo 可靠 ✅
- `templateToDevice` 明確複製所有 template field（包括 `portFaceOverrides`, `portLayouts`）✅

### 3.2 Performance Risks

| Issue | Location | Severity | Explanation |
|---|---|---|---|
| **O(n) cable recompute on every mutation** | `rackStore.ts:touch()` → `withCableNodes()` | **High** | 任何 device 移動、resize、add、remove 都會 call `withCableNodes`，即係 `calculateCableNodes` 跑晒所有 cables。20 條 cable 可能 OK，但 100 條就會 lag。 |
| **JSON.parse(JSON.stringify) deep clone** | `rackStore.ts:cloneLayout()` | Medium | 單一 layout 細應該冇問題，但如果將來支援 multi-rack 或者大量 cables，structured clone 會係瓶頸。可考慮用 immer（Zustand 原生支援）或者按需 clone。 |
| **History tracking silently swallow errors** | `rackStore.ts:subscribe` (bottom) | Medium | `try/catch` 包晒整個 subscriber，如果 history push 失敗（例如 cyclic object），完全冇 log。起碼 `console.error` 或者 report 去 UI。 |

### 3.3 Recommended Fix for Cable Recompute

```typescript
// 現時：任何 layout 改動都 recompute 所有 cables
function touch(layout: RackLayout): RackLayout {
  return { ...withCableNodes(layout), updatedAt: ... };
}

// 建議：只 recompute 受影響嘅 cables（from/to device 改變咗嘅）
function touchIncremental(prev: RackLayout, next: RackLayout): RackLayout {
  const changedDeviceIds = new Set(/* diff prev vs next devices */);
  const cables = next.cables.map(c => {
    if (changedDeviceIds.has(c.fromDeviceId) || changedDeviceIds.has(c.toDeviceId)) {
      return { ...c, nodes: calculateCableNodes(c, next) };
    }
    return c;
  });
  return { ...next, cables, updatedAt: ... };
}
```

---

## 4. DOM UI / HUD (Game UI Frontend Skill)

### 4.1 Assessment

呢個係 editor tool 唔係 game，所以 "HUD" 概念唔完全適用。不過以 **browser product with embedded 3D surface** 嘅標準嚟評：

- **Toolbar chrome 重** but acceptable for a productivity tool
- **View mode switcher** (2D / 3D / Cables) 清晰，button 有 active state ✅
- **Property panel** 喺右側，collapsed sections by default（如果係）會更好
- **Status message** 用 transient toast pattern ✅

### 4.2 Minor Issues

- `App.tsx` 行數 (~493) 合理，但 header 嘅 button group 可以抽出做 `Toolbar.tsx`
- Validation alert bar 喺 header 下方永遠顯示， dense layout 時佔用垂直空間。可考慮 float 或者 collapse。

---

## 5. QA & Playtest (Game Playtest Skill)

### 5.1 Current State: Partially Closed ✅ / Pending E2E

| Requirement | Status | Detail |
|---|---|---|
| Unit test framework | **Done** | Vitest + jsdom + testing-library 已安裝；`npm test` = `vitest run` |
| Unit/store regression test | **Done** | `routing`, `rackMath`, `portLayout`, `rackStore` tests cover current fix path |
| E2E / smoke test | **Partial** | Playwright 喺 devDependencies，但冇 test files |
| Visual regression | **Missing** | 冇 screenshot comparison |
| Automated cable routing validation | **Improved** | Existing routing tests migrated into Vitest; legacy `npm run test:routing` still exists |

### 5.2 Recommended QA Pipeline

1. **Vitest + @testing-library/react** 做 unit / integration test
   - 優先測試：`rackMath.ts`, `portLayout.ts`, `routing.ts`（pure functions，易測）
   - Store logic 用 Zustand 嘅 standalone store pattern 測（唔使 mount component）
2. **Playwright smoke test**
   - 開 app → load sample layout → switch 2D/3D/Cables → export JSON → validate file exists
   - 用 `npm run dev` 起 local server，跑 3-5 個 critical path test
3. **Bundle budget guard**
   - `vite-bundle-analyzer` 或者 `bundlesize` CI check，防止 Three.js 意外被 statically import

---

## 6. Asset Pipeline (Web 3D Asset Pipeline Skill)

### 6.1 Assessment

呢個 project 用 **100% procedural geometry**（box, cylinder, plane），冇 GLB / glTF / texture 載入。呢個係設計決定，優點係：

- 冇 asset loading 失敗風險 ✅
- 冇 texture memory 壓力 ✅
- 零維護 asset pipeline ✅

缺點：
- 視覺上冇法做到 photo-realistic（但呢個係 technical diagram tool，唔需要）
- 如果將來想加真實設備 model，就要補返 asset pipeline

### 6.2 Current Recommendation

維持 procedural。如果將來加 GLB device models，先至啟動 `web-3d-asset-pipeline` skill。

---

## 7. Priority Action Items

| Priority | Task | Skill | Effort |
|---|---|---|---|
| **Done** | 加 Vitest + 寫 `rackMath.ts` / `portLayout.ts` unit tests | `game-playtest` | Completed |
| **Done** | 優化 cable recompute：incremental update 取代全量 | `web-game-foundations` | Completed |
| **Done** | `CanvasWithRecovery` 加強 context restore 處理 | `react-three-fiber-game` | Completed |
| **P1** | 加 Playwright smoke test（3 critical paths） | `game-playtest` | 2-3 hrs |
| **P2** | 評估 port label rendering scalability（Instances vs merged） | `react-three-fiber-game` | 4-6 hrs |
| **Done** | History tracking error logging（唔再 silent fail） | `web-game-foundations` | Completed |
| **P3** | Bundle analyzer 加去 build pipeline | `web-game-foundations` | 30 min |

---

## 8. Conclusion

呢個 codebase 嘅 R3F 架構同 state 管理都係 solid，顯示團隊理解 React + Three.js 嘅邊界。原本最大嘅 test-suite / O(n) recompute 風險已經收窄。建議下一個 sprint 專注 Playwright smoke tests、bundle budget guard，同 0U PDU 物理模型/inspection display 重新設計。

# HomeLab Rack Simulator — Code Review Report

**Review date:** 2026-05-07  
**Stack:** Vite + React 18 + TypeScript + React Three Fiber + Zustand + Tailwind CSS  
**Reviewer perspective:** Game Studio 3D + React track

---

## 1. 整體印象 (Overall Assessment)

呢個 project 嘅架構相當紮實，明顯係經過深思熟慮嘅設計。作為一個 3D 互動工具（而唔係傳統遊戲），你嘅技術選型同埋代碼組織都係正確嘅方向。

**強項：**
- Single source of truth 做得好（Zustand store 係唯一狀態修改點）
- 3D chunk lazy loading 減少 initial bundle（~357KB initial / ~963KB lazy）
- WebGL context loss recovery 機制（CanvasWithRecovery）
- TypeScript 類型定義完整，domain model 清晰
- ADR 文件化（DECISIONS.md、KNOWN_ISSUES.md）

---

## 2. 架構評估 (Architecture)

### 2.1 狀態管理 (State Management)

**Zustand store** 嘅設計正確：
- 所有 mutation 集中喺 `rackStore.ts`
- JSON clone 做 history snapshot，undo/redo 機制穩妥
- `normalizeLayout()` 喺 load/import 時統一 sanitize data

**潛在風險：**
```typescript
// App.tsx line 69-73
useEffect(() => {
  if (layoutUsesHiddenZeroUPdu(layout)) {
    loadLayout(layout);
  }
}, [layout, loadLayout]);
```
呢個 effect 依賴 `layout` 但係又 call `loadLayout`（會改變 `layout`），雖然有 `layoutUsesHiddenZeroUPdu` gate，但理論上係一個 feedback loop 風險。建議用 ref 或者將 sanitize logic 搬入 store action 入面做一次性處理。

### 2.2 3D 渲染架構

React Three Fiber 嘅使用正確：
- `RackViewer3D` 同 `CableViewer3D` 透過 `React.lazy` + `Suspense` 載入
- `CanvasWithRecovery` 處理 WebGL context lost——呢個喺 browser game 入面係必須嘅
- shared geometries（`UNIT_BOX_GEOMETRY` 等）減少 GPU memory allocation

**建議改進：**
- `SceneSetup` 入面嘅 `gridHelper` 同 ground plane 可以考慮用 `useMemo` 或者抽離做 static component，避免 re-render 時重建
- `DeviceModel.tsx` 入面每個 device 都用 `<Text>` component（@react-three/drei），如果 rack 有幾十個 device，文字 texture generation 可能會有性能開支。可以考慮用 `Billboard` 或者 DOM overlay 取代 3D text

---

## 3. 性能評估 (Performance)

### 3.1 Bundle Size

| Chunk | Size | Status |
|-------|------|--------|
| Initial | ~357KB | 可接受 |
| 3D lazy | ~963KB | 偏厚，但可以接受 |

**建議：**
- `@react-three/drei` 係 tree-shakeable，但 `Text` component 會引入 troika-three-text（額外 ~100KB+）。如果設備數量多，可以考慮自製 sprite-based label
- `lucide-react` 只 import 有用嘅 icons，你而家嘅做法正確（tree-shaking 應該會處理）

### 3.2 3D 場景優化

**現況問題：**
- `RackModel.tsx` 入面用 `Array.from({ length: layout.heightU + 1 })` 生成 rail mesh，每個 U 位都係獨立 mesh。對於 42U rack，呢個會係 40+ 個獨立 draw call
- `DeviceModel` 每個 device 都有多個 `<mesh>`（ chassis + ports + labels）

**建議：**
- Rack frame 可以合併做單一個 `InstancedMesh` 或者至少合併 geometry
- 考慮用 `useFrame` 做 culling：如果 device 喺 camera frustum 外面，可以暫停更新 port labels
- CableViewer3D 入面嘅 `CatmullRomCurve3` 同 `TubeGeometry` 係性能殺手。如果 cable 數量多（20+），建議改用 `Line` 或者自製 shader-based cable rendering

### 3.3 State Selector 優化

`App.tsx` 入面有 15+ 個獨立 `useRackStore` selector：
```typescript
const layout = useRackStore((state) => state.layout);
const viewMode = useRackStore((state) => state.viewMode);
// ... etc
```

Zustand 嘅 shallow comparison 會處理，但如果 `layout` object reference 變咗（即使內容一樣），所有依賴 `layout` 嘅 component 都會 re-render。建議：
- 用 `useShallow`（Zustand v5 內置）或者 `useMemo` 穩定 reference
- 將大 component（App.tsx 490+ 行）拆細，避免成個 app re-render

---

## 4. 代碼質量 (Code Quality)

### 4.1 TypeScript

- 類型定義清晰，`rack.ts` 嘅 domain model 做得好
- 但有幾處 `as` type assertion：
  ```typescript
  loadLayout(imported as typeof layout); // App.tsx:93
  ```
  建議用 `zod` 或者 `valibot` 做 runtime validation，唔好淨係靠 TypeScript compile-time check

### 4.2 Magic Numbers

`routing.ts` 入面有大量常數：
```typescript
const FACE_EXIT_MM = 120;
const MANAGER_HOP_MM = 180;
const SIDE_TRAY_CLEARANCE_MM = 260;
// ...
```

建議抽離做 configuration object 或者 JSON config，方便調校同埋非技術人員修改。

### 4.3 測試覆蓋率

現有測試：
- `rackStore.test.ts` — store regression
- `rackMath.test.ts` — rack math
- `portLayout.test.ts` — port layout

**缺口：**
- 冇 component-level 測試（React Testing Library）
- 冇 3D rendering 測試（可以理解，R3F 測試比較麻煩）
- Playwright 已裝但「still has no smoke specs」——呢個應該係優先項

---

## 5. 3D / WebGL 專項 (Game Studio Perspective)

### 5.1 Camera 控制

`SmoothCameraRig` 用 `useFrame` + `lerp`：
```typescript
camera.position.lerp(targetPosition, 0.09);
```

**問題：** `lerp` 用固定 factor（0.09）而唔係 delta-time compensated，喺高 refresh rate 屏幕（120Hz/144Hz）上面會快過 60Hz。建議：
```typescript
const SPEED = 2.5; // units per second
useFrame((_, delta) => {
  camera.position.lerp(targetPosition, 1 - Math.exp(-SPEED * delta));
});
```

### 5.2 Lighting

`SceneSetup` 用兩盞 directional light：
- `[4, 7, 5]` intensity 1.15（cast shadow）
- `[-5, 3, -4]` intensity 0.35（fill light）

**建議：**
- 考慮加 environment map（HDRI）或者 `Environment` component（drei）提升金屬質感
- Shadow map size 1024x1024 可以，但如果 rack 夠大，可以考慮用 `ContactShadows` 取代傳統 shadow map，效果更好同埋更易控制

### 5.3 Asset Pipeline

現況冇 external 3D assets（全部 procedural geometry），呢個係優點——冇 asset loading 問題。

但如果將來要加真實 device model（GLB）：
- 建議用 `useGLTF` with `draco` compression
- 用 `Suspense` + fallback UI（你已經有）
- 考慮用 `Instances` 或者 `Merged` 處理重複出現嘅 device type

---

## 6. UI / UX 評估

### 6.1 HUD / Overlay 設計

`App.tsx` 嘅 toolbar 同 property panel 設計合理：
- DOM HUD over WebGL canvas——正確做法
- Tailwind 用 `grid-cols-[320px_minmax(620px,1fr)_380px]` 做 fixed sidebar layout

**建議：**
- 考慮加 `pointer-events-none` 喺 canvas container，然後喺 interactive elements 加 `pointer-events-auto`，避免 mouse event 穿透問題
- 3D view switcher（front/rear）可以做得更明顯，現況係一個小 button

### 6.2 Responsive

固定 320px + 620px + 380px = 1320px minimum width。喺 laptop（1366px）上面啱啱夠，但 tablet 或者更小屏幕會有問題。建議：
- 加 breakpoint 處理（collapsible sidebar / drawer pattern）
- 或者加 `min-width` warning message

---

## 7. 安全性同 Robustness

### 7.1 Error Handling

`main.tsx` 有 RootErrorBoundary + global error listener：
```typescript
window.addEventListener('error', (event) => { ... });
window.addEventListener('unhandledrejection', (event) => { ... });
```

呢個做得好，但可以改進：
- error overlay 用 `createElement` + `appendChild` 係 valid 但建議用 React portal 統一管理
- 考慮用 Sentry 或者類似服務收集 production error

### 7.2 localStorage

`STORAGE_KEY = 'homelab-rack-simulator-layout'`——冇 version migration 機制。如果 schema 改變，舊 data 可能會 corrupt。

**建議：**
```typescript
const STORAGE_VERSION = 'v2';
function loadWithMigration(data: any) {
  if (!data._version) return migrateV1ToV2(data);
  return data;
}
```

---

## 8. 優先建議清單 (Prioritized Recommendations)

### 高優先 (High)

1. **Add Playwright smoke tests** — 你已有 dependency，冇 test。至少覆蓋：load app → switch views → add device → add cable → export/import
2. **Fix lerp delta-time dependency** — `SmoothCameraRig.tsx` 用 fixed lerp factor
3. **Add runtime schema validation** — 用 zod 驗證 imported JSON，防止 corrupt data crash app
4. **State re-render optimization** — App.tsx 依賴 `layout` object 導致頻繁 re-render，考慮用 `useShallow` 或者 split selectors

### 中優先 (Medium)

5. **Rack rail instancing** — 42U rack 有 40+ 獨立 rail mesh，合併做 instanced geometry
6. **Cable rendering optimization** — 大量 cable 用 TubeGeometry 性能差，考慮 Line + custom shader
7. **Responsive layout** — 加 tablet/mobile 支援或者 minimum width warning
8. **localStorage version migration** — 防止 schema change 後舊 data corrupt

### 低優先 (Low)

9. **Environment lighting** — 加 HDRI 或者 `Environment`（drei）提升金屬質感
10. **Text label optimization** — 大量 device 時 troika-three-text 可能 heavy，考慮 HTML overlay
11. **Bundle analysis** — 用 `vite-bundle-visualizer` 搵埋 hidden heavy dependencies
12. **Keyboard shortcuts** — 加更多 hotkey（undo/redo 有，但 delete device、duplicate 等可以加）

---

## 9. Game Studio 技能路由建議

如果你打算繼續深化呢個 project：

- **3D 深化** → 用 `skill:three-webgl-game` 或者 `skill:react-three-fiber-game` 做低層優化（custom shader、instancing、LOD）
- **Asset 導入** → 用 `skill:web-3d-asset-pipeline` 處理 GLB device model import
- **前端 QA** → 用 `skill:game-playtest` 做 browser smoke test 同 screenshot regression
- **UI 設計** → 用 `skill:game-ui-frontend` 優化 HUD 同 responsive layout

---

## 總結

呢個 project 嘅 code quality 高於平均水平，架構設計合理，文件化做得好。主要問題集中喺：
1. **性能優化**（3D draw calls、state re-render、cable rendering）
2. **測試覆蓋率**（尤其係 E2E / smoke tests）
3. **Edge case handling**（schema migration、context recovery 後嘅狀態同步）

推薦優先處理 smoke tests 同 performance bottleneck，其餘可以逐步改善。

# 🖥️ Homelab Rack Simulator（機架模擬器）

> 🧰 以互動式 React 原型規劃 **10 吋與 19 吋** 機架佈局，在採購或搬遷設備前先行模擬。

---

## 🗺️ 概覽

在 2D 環境中規劃機架佈局、以 3D 視角檢視，並繪製每條線材走向 —— 全部在瀏覽器中完成，**無需後端伺服器**。模擬器內含持續擴充的社群硬體範本庫、真實世界約束條件的驗證警告、電源／噪音／續航規劃面板，以及完整的 JSON 匯入／匯出功能，讓您可以分享與反覆迭代佈局設計。

🔗 **線上展示：** https://breezyjack459.github.io/HomeLab_Rack_Simulator/

---

## 📸 截圖

### 🔲 2D 機架編輯器

從元件庫拖曳設備、對齊 U 槽，並即時管理屬性。內建重疊防止與多設備層架共用功能。

![2D 編輯器 — 10 吋 Home Cloud 範例](../artifacts/smoke/desktop-2d.png)

![2D 編輯器 — 多設備佈局](../artifacts/smoke/desktop-2d-multidevice.png)

---

### 🧊 3D 檢視模式

旋轉、縮放並比較設備深度。3D 渲染器使用近似尺寸，讓您在採購硬體前進行快速視覺驗證。

![3D 檢視 — 19 吋 18U 機架](../artifacts/smoke/desktop-3d-canvas.png)

![3D 檢視 — 多設備深度檢視](../artifacts/smoke/desktop-3d-multidevice.png)

---

### 📦 硬體範本庫

內建 90+ 範本，涵蓋 TinyMiniMicro 節點、Mini-PC、交換器、路由器、防火牆、NAS、UPS、PDU、配線架、KVM、無線基地台、數據機、SBC、線材管理配件等。可按類別篩選並一鍵加入機架。

![硬體範本庫](../artifacts/smoke/desktop-hardware-templates.png)

---

### 🔌 線材路由與線圖

規劃托盤式線材路徑，支援乙太網路、電源、光纖、USB、HDMI、ATX 與同軸電纜。線圖提供專屬檢視畫面，可在不干擾機架編輯器的情況下追蹤連接關係。

![線材路由 — 2D 檢視](../artifacts/smoke/desktop-routing-2d.png)

![線圖 — 托盤式路由](../artifacts/smoke/desktop-routing-map.png)

![線材路由 — 3D 檢視](../artifacts/smoke/desktop-routing-3d.png)

---

### 📱 行動裝置響應式

佈局庫與屬性面板會自動適應較窄的螢幕寬度，讓您隨時隨地檢視或調整機架配置。

![行動裝置檢視](../artifacts/smoke/mobile-smoke.png)

---

## ✨ 功能特色

| 功能 | 說明 |
|---------|-------------|
| 🗄️ **機架尺寸** | 10 吋與 19 吋機架寬度；高度從 2U 到 45U |
| 🖱️ **2D 編輯器** | 前視／後視圖、U 編號、拖放操作、對齊 U 槽、防止重疊 |
| 📐 **層架共用** | 當水平佔用空間足夠時，多個層架式設備可共用同一個 U |
| 🏷️ **側邊標籤** | 1U 與窄型設備顯示側邊標籤，即使圖塊擁擠也能讀取名稱 |
| ⚙️ **設備屬性** | 尺寸、深度、寬度類型、重量、功耗、熱量等級、顏色與連接埠數量 |
| 🔲 **連接埠欄配置** | 真實的前面板規劃 — 例如將 24 埠配線架排成單列 |
| ⚠️ **驗證警告** | 寬度、重疊、深度、機架重量、UPS 擺放、重型設備、熱群聚、風流與電源預算 |
| 🩺 **機架健康面板** | 一目了然的利用率、能源成本、噪音估算、UPS 續航、深度相容性、維護性與文件稽核 |
| ⚡ **電源鏈規劃** | 建立 UPS／PDU／設備電源關係模型並追蹤負載路徑 |
| 🔎 **線材追蹤** | 檢視端點到端點的線材走向，包含跳線、結構化線材、電源、光纖、USB、HDMI、ATX 與同軸電纜 |
| 🗺️ **線圖** | 專屬分頁，以托盤式路徑顯示各類線材的走向 |
| 🧊 **3D 檢視** | 近似機架與設備尺寸，支援完整相機控制 |
| 💾 **儲存／載入／匯出** | 本地儲存、JSON 匯入／匯出、2D 圖表 PNG 匯出 |
| 🌱 **種子佈局** | 精簡 10 吋邊緣實驗室、現有設備佈局、4 區域路由測試佈局，以及 19 吋家用雲端機架等快速入門範本 |

---

## 🛠️ 技術棧

- ⚛️ **React 18** 搭配 TypeScript
- ⚡ **Vite** 用於開發與正式環境建置
- 🐻 **Zustand** 純前端狀態管理（復原／重做 + localStorage 持久化）
- 🧊 **React Three Fiber / Three.js** 用於 3D 檢視（延遲載入以縮小初始 bundle）
- 🎨 **Tailwind CSS** 用於樣式設計
- 🧪 **Vitest** 用於單元測試與儲存庫迴歸測試
- 🎭 **Playwright** 用於煙霧測試截圖與瀏覽器層級檢查

---

## 🚀 快速開始

```bash
npm install
npm run dev
```

開啟終端機顯示的 Vite 網址，通常為：

```text
http://127.0.0.1:5173/
```

建置正式環境 bundle：

```bash
npm run build
```

執行迴歸測試：

```bash
npm test
```

啟動開發伺服器後，重新整理線材路由截圖：

```bash
npm run smoke:cables
```

---

## 📁 專案結構

```text
homelab-rack-simulator/
├── src/
│   ├── App.tsx                          ← 工具列、檢視切換器、頂層佈局
│   ├── main.tsx                         ← Vite 進入點
│   │
│   ├── components/                      ← 所有 UI 元件
│   │   ├── CableMap.tsx                 ← 托盤式線圖分頁
│   │   ├── CablePlanner.tsx             ← 線材連接編輯器
│   │   ├── CableTracePanel.tsx          ← 端點到端點追蹤詳情
│   │   ├── CableViewer3D.tsx            ← 延遲載入 3D 線材路由場景
│   │   ├── CanvasWithRecovery.tsx       ← Three.js 畫布與錯誤邊界
│   │   ├── ComponentLibrary.tsx         ← 拖曳來源 — 設備範本庫
│   │   ├── ConfirmDialog.tsx            ← 通用確認／刪除對話框
│   │   ├── DepthCompatibilityPanel.tsx  ← 各設備深度符合性檢查
│   │   ├── DocumentationAuditPanel.tsx  ← 標示／文件完整性稽核
│   │   ├── EnergySummary.tsx            ← 功耗與電費面板
│   │   ├── FileMenu.tsx                 ← 儲存、載入、JSON 匯入／匯出、PNG
│   │   ├── IssueBar.tsx                 ← 編輯器上方的內聯警告列
│   │   ├── KeyboardShortcuts.tsx        ← 鍵盤快捷鍵說明覆蓋層
│   │   ├── MigrationSummaryPanel.tsx    ← 遷移規劃摘要
│   │   ├── NoiseSummary.tsx             ← 聲學／噪音等級估算
│   │   ├── PowerChainPanel.tsx          ← UPS／PDU／設備負載路徑分析
│   │   ├── PrintableLabels.tsx          ← 可列印機架標籤頁
│   │   ├── PropertyPanel.tsx            ← 選取設備的屬性編輯器
│   │   ├── RackEditor2D.tsx             ← 2D 前視／後視編輯器、拖放與對齊
│   │   ├── RackHealthDashboard.tsx      ← 機架利用率／健康狀態摘要
│   │   ├── RackViewer3D.tsx             ← React Three Fiber 場景載入器
│   │   ├── ServiceabilityPanel.tsx      ← 前後方存取與間隙檢查
│   │   ├── ThemeToggle.tsx              ← 深色／淺色主題切換按鈕
│   │   ├── UpsRuntimePanel.tsx          ← UPS 續航時間估算面板
│   │   ├── ValidationPanel.tsx          ← 完整約束條件問題清單
│   │   │
│   │   └── three/                       ← Three.js 場景基本物件
│   │       ├── DeviceModel.tsx          ← 設備幾何與連接埠方塊
│   │       ├── RackModel.tsx            ← 機架框架幾何
│   │       ├── SceneSetup.tsx           ← 光源、環境、相機預設值
│   │       ├── SmoothCameraRig.tsx      ← 相機動畫轉場
│   │       └── sharedGeometries.ts      ← 可重複使用的 Three.js 幾何快取
│   │
│   ├── data/
│   │   ├── deviceCatalog.ts             ← 90+ 硬體範本（範本庫的資料來源）
│   │   └── sampleLayouts.ts             ← 快速入門的種子佈局
│   │
│   ├── store/
│   │   ├── rackStore.ts                 ← Zustand 儲存庫：狀態、變更、復原／重做
│   │   ├── rackStore.test.ts            ← 儲存庫單元測試
│   │   └── themeStore.ts                ← 深色／淺色主題狀態
│   │
│   ├── styles/
│   │   ├── index.css                    ← 全域重置與基礎樣式
│   │   └── theme.css                    ← Tailwind CSS 自訂主題 token
│   │
│   ├── types/
│   │   ├── rack.ts                      ← 核心資料模型：RackLayout、PlacedDevice、CableRoute
│   │   └── fileSystemAccess.d.ts        ← File System Access API 型別宣告
│   │
│   └── utils/                           ← 純函式（無 React 依賴）
│       ├── animationMath.ts             ← 緩動與插值輔助函式
│       ├── cableColors.ts               ← 線材類型 → 顏色對應
│       ├── cablePath3D.ts               ← 3D 線材曲線路徑生成
│       ├── cableTrace.ts                ← 端點到端點線材追蹤
│       ├── documentationAudit.ts        ← 文件／標籤完整性評分
│       ├── energyCalc.ts                ← 功耗與電費輔助函式
│       ├── exporters.ts                 ← JSON 與 PNG 匯出邏輯
│       ├── featureFlags.ts              ← 執行期功能旗標輔助函式
│       ├── fileSystem.ts                ← File System Access API 包裝器
│       ├── layoutValidation.ts          ← 高階佈局約束檢查
│       ├── migrationCalc.ts             ← 遷移規劃計算
│       ├── noiseCalc.ts                 ← 聲學噪音等級估算
│       ├── patchPanel.ts                ← 配線架連接埠分配輔助函式
│       ├── portLayout.ts                ← 各設備面的連接埠定位
│       ├── powerChain.ts                ← UPS／PDU／設備負載路徑分析
│       ├── rackGeometry.ts              ← 機架實體尺寸輔助函式
│       ├── rackMath.ts                  ← 對齊、重疊、空間輔助函式
│       ├── routing.ts                   ← 線材路徑節點與托盤路由
│       ├── serviceability.ts            ← 間隙與存取性評分
│       ├── upsRuntime.ts                ← UPS 續航時間估算
│       ├── validation.ts                ← 核心驗證規則與機架總計
│       └── validationRecommendations.ts ← 各問題的具體修正建議
│
├── tests/                               ← Playwright 瀏覽器層級測試
│   ├── smoke/
│   │   └── app.spec.ts                  ← 煙霧測試：載入應用程式、截圖
│   ├── routing.test.ts                  ← 線材路由整合測試
│   └── setup.ts                         ← Playwright 全域設定
│
├── scripts/                             ← 開發輔助指令碼
│   ├── check-bundle-size.mjs            ← 確保 bundle 維持在預算內
│   ├── run-routing-tests.mjs            ← 獨立執行路由測試
│   └── smoke-cable-routing.mjs          ← 擷取線材路由截圖
│
├── docs/                                ← 專案文件
│   ├── design/                          ← 設計決策與 UI 研究
│   │   ├── cable-port-selection-redesign.md
│   │   └── game-studio-code-review.md
│   ├── dev/                             ← 程式碼品質與已知問題
│   │   ├── CODE_REVIEW.md
│   │   ├── DECISIONS.md
│   │   ├── KNOWN_ISSUES.md
│   │   └── NEXT_STEPS.md
│   ├── planning/                        ← 腦力激盪、任務、交接筆記
│   │   ├── BRAINSTORM.md
│   │   ├── TASKS.md
│   │   └── TRANSFER_FOLLOWUP.md
│   └── *.md                             ← 其他一次性規劃與修正文件
│
├── artifacts/smoke/                     ← 自動生成的 Playwright 截圖
├── dist/                                ← 正式環境建置輸出（gitignored）
├── index.html                           ← Vite HTML 進入點
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

### 🗝️ 關鍵檔案

| 檔案 | 用途 |
|------|---------|
| `src/types/rack.ts` | 📐 核心資料模型：`RackLayout`、`PlacedDevice`、`CableRoute`、`PortLayout` |
| `src/data/deviceCatalog.ts` | 📦 90+ 可重複使用的設備範本，顯示於左側邊欄 |
| `src/data/sampleLayouts.ts` | 🌱 10 吋與 19 吋入門佈局種子 |
| `src/store/rackStore.ts` | 🐻 Zustand 儲存庫 — 佈局狀態、變更、復原／重做、localStorage 持久化 |
| `src/store/themeStore.ts` | 🌗 深色／淺色主題狀態 |
| `src/utils/rackMath.ts` | 📏 機架尺寸、對齊、重疊、空間輔助函式 |
| `src/utils/portLayout.ts` | 🔌 各設備面的連接埠定位（3D 與線材路由共用） |
| `src/utils/routing.ts` | 🗺️ 線材路徑節點與托盤式路由邏輯 |
| `src/utils/validation.ts` | ✅ 核心佈局驗證規則與機架總計 |
| `src/utils/layoutValidation.ts` | ⚠️ 高階約束檢查（重量、風流、UPS 擺放） |
| `src/utils/validationRecommendations.ts` | 💡 各問題搭配的具體修正建議 |
| `src/utils/powerChain.ts` | ⚡ UPS／PDU／設備負載路徑分析 |
| `src/utils/upsRuntime.ts` | 🔋 UPS 供電負載的續航時間估算 |
| `src/utils/serviceability.ts` | 🔧 後方／前方存取與維護間隙評分 |
| `src/utils/documentationAudit.ts` | 📋 文件與標示完整性檢查 |
| `src/utils/migrationCalc.ts` | 🚚 遷移規劃成本與工時計算 |
| `src/utils/featureFlags.ts` | 🚩 執行期功能旗標輔助函式 |
| `src/utils/exporters.ts` | 📤 JSON 與 PNG 匯出邏輯 |
| `src/components/RackEditor2D.tsx` | 🖱️ 2D 編輯器，支援拖放與對齊 U 槽 |
| `src/components/RackViewer3D.tsx` | 🧊 React Three Fiber 場景載入器 |
| `src/components/CableMap.tsx` | 🗺️ 線圖分頁與路由 SVG 追蹤檢視 |
| `src/components/CableViewer3D.tsx` | 🔌 延遲載入的 3D 線材路由場景 |
| `src/components/MigrationSummaryPanel.tsx` | 🚚 遷移規劃 UI 面板 |
| `src/components/PrintableLabels.tsx` | 🖨️ 可列印機架標籤頁 |
| `src/components/three/RackModel.tsx` | 🗄️ 機架框架幾何 |
| `src/components/three/DeviceModel.tsx` | 📦 設備幾何與連接埠方塊 |
| `src/components/three/SceneSetup.tsx` | 💡 Three.js 光源、環境與相機預設值 |
| `src/components/three/SmoothCameraRig.tsx` | 🎥 相機動畫轉場 |

---

## ➕ 新增設備類型

將新的 `DeviceTemplate` 物件加入 `src/data/deviceCatalog.ts`。

重要欄位：

- `category`：`src/types/rack.ts` 中支援的設備類別之一
- `defaultU`：預設機架高度（以 U 為單位）
- `rackMountable`：對於外部設備（例如天花板 AP）設為 `false`，這類設備應保留在範本庫中但無法放入機架內
- `depthMm`：設備近似深度，用於驗證與 3D 顯示
- `widthType`：`10in`、`19in`、`shelf` 或 `custom`
- `customWidthMm`：當需要真實符合性檢查時，自訂寬度或層架式設備必填
- `xMm`：已儲存設備的選擇性擺放欄位；可用機架寬度內的左側偏移量
- `weightKg`、`powerW`、`heatLevel`：驗證時使用
- `ports`：2D／3D 提示用的選擇性前面板連接埠數量。使用 `layoutColumns` 控制前面板的換行
- `color`：2D 與 3D 都會使用

範例：

```ts
{
  id: 'my-lab-node',
  category: 'mini-pc',
  name: 'Lab node',
  defaultU: 1,
  depthMm: 140,
  widthType: 'shelf',
  customWidthMm: 130,
  weightKg: 0.9,
  powerW: 28,
  heatLevel: 3,
  ports: { ethernet: 2, usb: 4, power: 1, layoutColumns: 2 },
  color: '#0891b2',
  description: 'Shelf-mounted compute node.'
}
```

左側範本庫、2D 編輯器、驗證系統、JSON 匯出與 3D 檢視器會自動識別新設備。

---

## 🔬 範本研究筆記

內含的硬體範本為**規劃用設定檔**，非 CAD 精確模型。尺寸、功耗與重量均為概略值，用於佈局驗證與粗略的風流／電源規劃。

內建熱門硬體的參考資料來源：

- ServeTheHome Project TinyMiniMicro 報導，涵蓋 Dell Micro、HP Mini 與 Lenovo Tiny 類別的 homelab 節點：https://www.servethehome.com/introducing-project-tinyminimicro-home-lab-revolution/
- Minisforum MS-01 官方規格：https://store.minisforum.com/products/minisforum-ms-01
- Protectli Vault VP2420 規格：https://eu.protectli.com/product/vp2420/
- MikroTik CRS305 規格：https://mikrotik.com/product/crs305_1g_4s_in
- Ubiquiti UniFi Dream Machine Pro 技術規格：https://techspecs.ui.com/unifi/cloud-gateways/udm-pro
- Ubiquiti UniFi Cloud Gateway Max 技術規格：https://techspecs.ui.com/unifi/cloud-gateways/ucg-max
- Ubiquiti UniFi U7 Pro 技術規格：https://techspecs.ui.com/unifi/wifi/u7-pro
- Ubiquiti 2.5G PoE+ 變壓器技術規格：https://techspecs.ui.com/unifi/accessories/uacc-poe-plus-2-5g
- Ubiquiti UniFi Flex 2.5G 8 埠交換器技術規格：https://techspecs.ui.com/unifi/switching/usw-flex-2-5g-8
- Minisforum UM790 Pro 官方規格：https://store.minisforum.com/products/minisforum-um790-pro
- Synology DS923+ 產品規格：https://global.download.synology.com/download/Document/Hardware/ProductSpec/DiskStation/23-year/DS923%2B/enu/Product_Spec_DS923%2B_enu.pdf
- APC 1U Smart-UPS 產品系列：https://www.apc.com/us/en/product/SCL500RM1UC/
- APC Back-UPS Pro Gaming BGM1500B-US 產品頁面：https://www.apc.com/us/en/product/BGM1500B-US/apc-backups-pro-for-gaming-1500va-900w-tower-120v-10x-nema-515r-outlets-rgb-lights-pure-sine-wave-midnight-black/
- Sipeed NanoKVM 文件：https://wiki.sipeed.com/hardware/en/kvm/NanoKVM/introduction.html
- Sipeed NanoKVM PCIe 文件：https://wiki.sipeed.com/hardware/en/kvm/NanoKVM_PCIe/introduction.html
- JetKVM 文件與規格：https://jetkvm.com/docs 與 https://jetkvm.com/products/jetkvm
- 寶藏盒 Pro NAS 規劃尺寸來自使用者提供的產品圖片。

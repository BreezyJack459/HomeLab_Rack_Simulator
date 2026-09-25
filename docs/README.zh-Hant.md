# Homelab Rack Simulator

喺瀏覽器規劃 10 吋或 19 吋 homelab 機架：用 2D 放設備、3D 睇深度同插口、規劃接線，再檢查空間、重量、電力同維護需要。

[English](../README.md) · [使用指南](USER_GUIDE.zh-Hant.md) · [文件索引](README.md) · [線上示範](https://breezyjack459.github.io/HomeLab_Rack_Simulator/)

本文件以 **2026-09-18 工作目錄嘅程式**為準；線上示範由 `main` 部署，未必包含未提交改動。

## 開始使用

```bash
npm ci
npm run dev
```

開啟 [本機應用](http://127.0.0.1:5173/HomeLab_Rack_Simulator/)。Vite 固定用 5173 埠，並監聽本機所有網絡介面。同一個可信任 LAN 嘅裝置可開 `http://YOUR_LAN_IP:5173/HomeLab_Rack_Simulator/`。`npm run dev:lan` 會明確指定 LAN 模式；每個瀏覽器有獨立儲存資料。

## 而家嘅工作流程

| 位置 | 用途 |
|---|---|
| **Build** | 用 Library 搵範本、My devices 管理未上架設備、2D 拖放、3D 檢視同修改屬性。 |
| **Cable** | 建立接線、篩選線材、睇 2D map／3D routing／Topology／Table，同自訂繪線。依賴預設啟用嘅 Cable Management。 |
| **Check** | 按問題檢視相關設備同修正建議。 |
| **Tools** | 啟用 Operations、Planning、Fleet；Settings 入面管理機架、插件同外觀。 |

新介面預設開啟。Operations、Planning、Fleet 同 Port Labels 係可選功能，按需載入；有舊設定嘅使用者會經過功能包遷移，唔一定同全新安裝顯示一樣。

## 實際介面預覽

以下係 **2026-09-18** 用本機程式同內置範例重新擷取嘅畫面；範例本身嘅警告亦有保留。[完整截圖導覽](SCREENSHOTS.md)另有庫存、Topology、自訂繪線、薄托盤、0U PDU、插件同平板畫面。

### Build：2D 佈局

左邊搜尋設備，中間安排 U 位，右邊修改所選設備。

![Build 工作區：19 吋機架、設備庫同交換器屬性](images/build-2d.png)

### 3D 檢視

用視角選單檢查設備深度、插口同前後空間。

![3D 機架檢視及交換器選取標示](images/build-3d.png)

### Cable：3D 走線

從後方檢查資料線同電源線，旁邊保留線材清單同連接操作。

![Cable 工作區：機架後方嘅電源及資料走線](images/cable-3d.png)

### Check：問題詳情

揀選問題後，右邊會顯示相關設備同建議處理方式。

![Check 工作區：PDU 插座未分配問題及詳細說明](images/check.png)

## 已有功能

- 前後面 2D 拖放、U 位吸附、重疊／保留位檢查、深度警告，以及設備尺寸篩選。
- 每個機架嘅 **My devices** 庫存；未上架设备唔計入機架用電、重量同 U 位。
- 薄托盤同設備共用 U、實際設備高度、頂部淨空，以及簡化 3D 打印支架。
- 0U PDU 嘅實際長度、離底高度、安裝區同插座方向。
- 自動接線、側線槽、配線架束線、自訂 Draw route／Redraw route，同 blocked 路線提示。
- 3D 相機視角、選取聚焦、面板材質同插口；Clean／Realistic 線材顯示。
- 電力、重量、散熱、深度、層板承托、UPS 同可維護性檢查。
- 可選嘅營運、變更規劃、多機架／跨機架連線，以及 Port Labels 標籤同 CSV。
- 自動儲存、當次工作階段 undo／redo、機架 JSON 匯入／匯出、2D PNG，同儲存錯誤復原提示。Fleet 支援完整 workspace 匯入／匯出。

詳細路徑、薄層板例子、繪線步驟同資料復原請睇[使用指南](USER_GUIDE.zh-Hant.md)。

## 資料同限制

呢個係純前端應用，冇共用後端或帳戶同步；轉裝置需要 JSON。機架 JSON 同完整 workspace JSON 範圍唔同，備份多機架資料要用 workspace 匯出。

設備尺寸、用電、重量、散熱同噪音都係規劃輸入。請按實物確認通用範本同自訂數值；[裝置規格核對表](DEVICE_SPEC_AUDIT.zh-Hant.md)保留之前核對嘅來源、日期同未確認項目。更新範本唔會覆蓋已儲存設備。

打印支架只係示意，唔會產生或匯入 STL／CAD。自動 3D 路線同自動 2D／BOM 長度估算有各自計算，唔應視為實際安裝線長。[已知限制](dev/KNOWN_ISSUES.md)有更完整說明。

## 開發同驗證

技術：React 18、TypeScript 5.7、Vite 6、Zustand 5、Tailwind CSS 3、Three.js 0.171、React Three Fiber 8、Drei 9。

```bash
npm test
npm run test:plugins
npx playwright install chromium
npx playwright test
npm run build
node scripts/check-bundle-size.mjs
npm run preview
```

`npm run smoke:cables` 要先開 dev server，用嚟更新走線截圖。eager JavaScript 上限係 500 KB（壓縮前，入口加 modulepreload）；3D 同可選功能按需載入。呢次文件更新唔代表已重新跑過所有測試或量度 bundle。

[開發指南](dev/DEVELOPMENT.md)列出測試範圍同 CI；[架構](dev/ARCHITECTURE.md)解釋 store、走線同插件。GitHub Pages 會喺推送 `main` 或手動觸發時部署 `dist/`，預設 base path 係 `/HomeLab_Rack_Simulator/`。

# Homelab 設備庫擴充（2026-09-27）

首兩輪合共新增 32 款設備（115 → 147），補齊現有 UDM Pro／SE、UCG Max、UniFi Pro／Enterprise switch、MS-01、Mini PC、Raspberry Pi、UPS 同 NAS 以外嘅常見使用場景。呢份係實用型號選集，唔係銷量排行，亦唔代表完整收錄所有 UniFi SKU。

## 規格來源

尺寸統一用 **闊 × 深 × 高（mm）**。以下係今次查閱嘅官方頁面；功耗採用頁面注明嘅量度口徑。`powerW` 仍然只有單一數值，唔代表所有型號都係日常平均耗電。新增項目嘅 description 已經註明係 maximum 或 access measurement；PoE 輸出、電源供應器額定容量唔會混入機身耗電。

| 新增型號／官方來源 | 尺寸 mm | 重量 kg | powerW 口徑 | 主要連接埠 |
|---|---|---:|---|---|
| [UCG-Ultra](https://techspecs.ui.com/unifi/cloud-gateways/ucg-ultra) | 141.8 × 127.6 × 30 | 0.52 | 6.2W max | 4×1G + 1×2.5G |
| [UCG-Fiber](https://techspecs.ui.com/unifi/cloud-gateways/ucg-fiber) | 212.8 × 127.6 × 30 | 0.675，無 SSD | 29.4W max，唔包 PoE 輸出 | 4×2.5G + 1×10G RJ45 + 2×SFP+ |
| [UXG-Fiber](https://techspecs.ui.com/unifi/cloud-gateways/uxg-fiber) | 212.8 × 127.6 × 30 | 0.605 | 25W max，唔包 PoE 輸出 | 4×2.5G + 1×10G RJ45 + 2×SFP+ |
| [UDM-Pro-Max](https://techspecs.ui.com/unifi/cloud-gateways/udm-pro-max) | 442.4 × 285.6 × 43.7 | 4.7 | 60W max | 8×1G + 1×2.5G + 2×SFP+ |
| [USW-Pro-Max-16-PoE](https://techspecs.ui.com/unifi/switching/usw-pro-max-16-poe) | 325.1 × 160 × 43.7 | 2.1 | 25W max，唔包 180W PoE 輸出 | 12×1G + 4×2.5G + 2×SFP+ |
| [USW-Pro-Max-24-PoE](https://techspecs.ui.com/unifi/switching/usw-pro-max-24-poe) | 442 × 325 × 44 | 5.2，連支架 | 50W max，唔包 400W PoE 輸出 | 16×1G + 8×2.5G + 2×SFP+ |
| [USW-Pro-Max-24](https://techspecs.ui.com/unifi/switching/usw-pro-max-24) | 442 × 325 × 44 | 4.3，連支架 | 50W max，無 PoE | 16×1G + 8×2.5G + 2×SFP+ |
| [USW-Aggregation](https://techspecs.ui.com/unifi/switching/usw-aggregation) | 442 × 120 × 43.7 | 2.7，連支架 | 36W max，包 SFP 模組 | 8×10G SFP+，無 RJ45 |
| [USW-Lite-16-PoE](https://techspecs.ui.com/unifi/switching/usw-lite-16-poe) | 192 × 185 × 44 | 1.2 | 15W max，唔包 45W PoE 輸出 | 16×1G，8 個 PoE+ |
| [USW-Ultra](https://techspecs.ui.com/unifi/switching/usw-ultra) | 203 × 76 × 33 | 0.32 | PoE 輸入時 9W max，唔包輸出；DC 為 8W | 8×1G，7 個 PoE+ 輸出 |
| [USW-Flex-2.5G-5](https://techspecs.ui.com/unifi/switching/usw-flex-2-5g-5) | 117.1 × 90 × 21.2 | 0.206 | PoE 輸入時 6.4W max；USB-C 為 5W | 5×2.5G，無 PoE 輸出 |
| [U6+](https://techspecs.ui.com/unifi/wifi/u6-plus) | 160 × 160 × 33，圓形包絡 | 0.338，機身 | 9W max | 1×1G PoE |
| [U7 Lite](https://techspecs.ui.com/unifi/wifi/u7-lite) | 171.5 × 171.5 × 33，圓形包絡 | 0.313 | 13W max | 1×2.5G PoE |
| [MikroTik CRS310-8G+2S+IN](https://mikrotik.com/product/crs310_8g_2s_in) | 200 × 206.1 × 44 | **1.0 估算** | 21W max，無附件；連附件最高 34W | 8×2.5G + 2×SFP+ + USB |
| [TP-Link ER605 V2](https://www.omadanetworks.com/us/business-networking/omada-router-wired-router/er605/) | 158 × 101 × 25 | **0.4 估算** | 7.94W max | 5×1G + USB 2.0 |
| [Synology DS224+](https://www.synology.com/en-br/products/DS224%2B) | 108 × 232.2 × 165 | 1.3，未加硬碟 | 14.69W access measurement，唔係最大值 | 2×1G + 2×USB 3.2 Gen 1 |

MikroTik 同 TP-Link 所引用頁面未提供機身重量，所以暫用明確標示嘅規劃估算，唔當成官方數值。實際硬碟、收發模組、外置電源同安裝配件重量要按配置調整。USW-Pro-Max-16-PoE 用查閱當日官方頁面嘅 25W；舊 datasheet 曾列 30W，唔應混用。

## 第二輪：現代 Mini PC／NAS

| 型號／來源 | 闊 × 深 × 高 mm | 重量 kg | powerW 口徑 | 主要連接埠 |
|---|---|---:|---|---|
| [Minisforum MS-A2](https://store.minisforum.com/products/minisforum-ms-a2-workstation) | 196 × 189 × 48 | 1.4 | **60W 規劃估算** | 2×2.5G、2×10G SFP+、7×USB、HDMI |
| [MS-02 Ultra 285HX / 25GbE](https://store.minisforum.com/products/minisforum-ms-02-ultra-workstation) | 225 × 221.5 × 97，橫放 | 3.45 | 22W，官方 Windows idle 測試，**唔係負載預算** | 2.5G + 10G RJ45、2×25G SFP28、7×USB、HDMI |
| [Beelink ME mini N200](https://doc.bee-link.com.cn/books/3988c/page/me-mini) | 99 × 99 × 98.3 | 0.78 | **20W 規劃估算** | 2×2.5G、3×USB、HDMI |
| [UGREEN DXP4800 Pro](https://ai.ugreen.com/products/ugreen-nasync-dxp4800-pro-4-bay-nas) | 177.8 × 256.54 × 177.8 | **5.0 估算** | 42.36W，官方存取測試 | 2.5G + 10G RJ45、5×USB、HDMI |
| [Synology DS925+](https://www.synology.com/en-us/products/DS925%2B) | 199 × 223 × 166 | 2.26，無硬碟 | 37.91W，官方存取測試 | 2×2.5G、2×一般 USB |
| [ZimaBoard 2](https://shop.zimaspace.com/products/zimaboard2-single-board-server) | 140 × 83 × 31 | 0.407 | **12W 規劃估算** | 2×2.5G、2×USB；Mini DP 未建模 |
| [UniFi UNAS Pro](https://techspecs.ui.com/unifi/integrations/unas-pro) | 442.4 × 325 × 87.4 | 9.5，連支架 | 160W max | 1G RJ45、10G SFP+、AC + RPS |
| [UniFi UNAS Pro 4](https://techspecs.ui.com/unifi/integrations/unas-pro-4) | 442.4 × 400 × 43.7 | 6.7，連支架 | 150W max | 1G RJ45、2×10G SFP+、AC + RPS |
| [UniFi UNAS Pro 8](https://techspecs.ui.com/unifi/integrations/unas-pro-8) | 442.4 × 480 × 87.4 | 11.5，連支架 | 250W max | 10G RJ45、2×10G SFP+、雙 AC |
| [UniFi UNAS 2](https://techspecs.ui.com/unifi/integrations/unas-2) | 135 × 129 × 223.7 | 1.3，無硬碟 | 60W max | 2.5G PoE++ 輸入、USB-C 資料埠；無獨立電源插口 |

MS-02 Ultra 尺寸／重量依據 [日本代理商規格表](https://www.links.co.jp/item/minisforum-ms-02-ultra/)，將直放闊 97、高 225 轉為橫放闊 225、高 97；功耗依據 [廠方技術文件](https://github.com/minisforum-docs/MS-02-Ultra/blob/main/Docs/English/02-Ultra-BaseGuide.md) 嘅 285HX + 25G NIC Windows idle 數據。此模板唔適用於冇 25G NIC 嘅 NS 版本。UGREEN 尺寸由廠方四捨五入英吋數值換算，4U 只係機身包絡，實際架板、腳墊同散熱空間要另外預留。

MS-A2、ME mini、ZimaBoard 2 暫用明確標示嘅整機規劃估算；唔會將 CPU TDP 或變壓器容量當成日常耗電。ME mini 採用官方知識庫嘅 N200 / 雙 2.5GbE SKU，唔混入其他 N150／5GbE 版本。

USB 正背面分佈暫時一併用背面示意；USB4／Thunderbolt 用現有通用 USB 資料埠表達，唔模擬全部協議。DS925+ 專用 DX525 擴充插口、SD、SATA、PCIe 同 Mini DisplayPort 未有相應 cable type，唔會冒充一般 USB 或 HDMI。UNAS 安裝導軌深度要求寫入 description，現時唔會自動驗證；PoE++ 電源相容性亦需要用戶另行確認。

## 第二輪：你已儲存機櫃嘅六款機箱配置

以下係本地 JSON 內嘅配置快照，**全部唔係廠方標準規格**。型號名稱加咗 `(saved build)`，description 提醒按主機板、PSU、硬碟同 GPU 修改。高度採用原有 U 包絡；連接埠位置係示意，冇推測網絡速度。

| 模板 | U／深度 mm | 重量 kg／功耗 W | Ethernet／USB／Power | 本地來源 |
|---|---|---|---|---|
| EDNSE ED408H40 8-bay NAS | 4U／400 | 14／140 | 2／2／1 | `usub-fsr22u-v3-ed408h40.json` |
| EDNSE ED412H40 12-bay NAS | 4U／400 | 18／180 | 4／2／2 | `usub-fsr22u-v3-ed412h40.json` |
| JMCD 12E5 NAS | 6U／415 | 25／150 | 2／2／1 | `tests/junchen-22u-jmcd-f4811.json` |
| 拓普龍 F4811 VM server | 4U／480 | 18／350 | 2／4／1 | 同上 |
| 鼎翔 4U400-12 NAS | 4U／400 | 12／120 | 2／2／1 | `tests/junchen-22u-dx400-dx450.json` |
| 鼎翔 4U450 VM server | 4U／450 | 10／300 | 2／4／1 | 同上 |

呢次只新增可重用模板，唔會改寫原有 JSON 或用戶已儲存嘅設備。

## 模型同擺位

- 全部沿用現有 `DeviceTemplate`、store 同共享 port geometry；無新增 schema 或更改已有設備 ID。設備庫隨 library／editor 延遲載入，store 只引用輕量 lookup registry；所有提供模板擺位嘅 UI 都會先載入 catalog。直接程式呼叫同步模板 action 前，亦需要先 import `deviceCatalog`。
- 桌面型號用真實機身闊深、`physicalHeightMm` 同向上取整嘅 U 包絡。DS224+ 為 4U；架板同散熱空間需另外預留。
- Pro Max 16 PoE 同 CRS310 預設係架板安裝嘅機身尺寸，唔會假設已裝可選 19 吋支架。全闊 rackmount 型號沿用 app 嘅 19 吋有效闊度模型。
- U6+／U7 Lite 同現有 AP 一樣係 external-only：可以存入 My devices，唔可以放入機櫃，亦唔計入已安裝 rack 嘅耗電／重量。
- Port 數目同速度有分組；位置係示意圖，唔係量度過嘅面板複製品，亦無新增照片材質。
- 現有模型每種 port type 只能指定一個正／背面。DS224+ 嘅兩個 USB 暫時一併顯示喺背面，description 已標明實機有正背面分佈。
- USB-C 供電插口用 `power` 表示，唔會虛增 USB 資料埠。RPS 係專用 DC 接口，暫用一般 power 圖示；呢個唔代表佢同 IEC 插頭兼容。
- PoE 能力／預算寫入 description；呢次無加入每個埠嘅 PoE 配電模擬。

## 驗證入口

`src/data/deviceCatalog.additions.test.ts` 覆蓋新增型號嘅擺位／inventory、JSON import、2D／3D port 數目、混合速度邊界及重複 ID。`tests/smoke/catalog-additions.spec.ts` 覆蓋 library 搜尋、新設備擺位同兩個 3D viewer。

### 今次執行結果

- `npm test`：105 個檔案、1,407 個測試通過；新增模板測試共 35 個，包括 JSON round-trip、port 數目／速度、2D／3D 一致性同插口防重疊。
- `npm run build`：成功，包含 TypeScript 檢查。
- Production preview Playwright：`catalog-additions.spec.ts` 同 `three-inspection.spec.ts`，4 個流程通過；包括初始關閉 library 後開啟／搜尋／新增、reload 保留設備、兩個 3D viewer 同連線。
- 已目視檢查新模板嘅 2D、3D inspection 同 3D cable routing 擷取畫面。
- `node scripts/check-bundle-size.mjs`：447.7KB／500KB，通過。第一輪曾為 510.4KB；第二輪將 catalog 從 store 首載依賴分離，冇提高預算。延遲載入只減少首載 bundle，唔代表設備資料唔需要下載。
- `git diff --check`：通過。

上述係包含當時工作目錄其他未提交修改嘅結果；未執行完整 Playwright suite。Vite 仍然提示大型延遲 3D chunk，唔影響首載 guard 結果。未 commit 或 push。

第三輪新增 20 款指定型號，目錄增至 167 款；詳見 [Mini PC 同其他型號擴充](HOMELAB_CATALOG_MODELS.zh-Hant.md)。

# 裝置功耗及重量核對表

> 文件整理日期：2026-09-18。以下保留 2026-09-13 嘅核對證據、統計同來源；今次只整理文件，冇重新查閱原廠資料，亦唔將當日數字當成永久有效嘅 catalog 統計。現行使用方式見[使用指南](USER_GUIDE.zh-Hant.md)。

核對日期：2026-09-13。範圍：`src/data/deviceCatalog.ts` 嘅全部內置範本；唔包括瀏覽器內你自行改過嘅 layout。

共 **114 款**：**24 款兩個欄位有原廠依據**、**17 款仍有欄位／版本待確認**、**73 款通用或自訂範本跳過原廠比對**。今次更正 **18 款** 嘅數值；「已核實」只表示符合下列指定口徑，唔代表你實物當刻用電。

## 點樣計先唔會重複或漏計

- 總重量 = 每部實際安裝裝置嘅重量相加，再加未包括嘅 HDD、SSD、火牛、導軌、托盤及其他配件。機架外 AP 唔計入機架承重。
- 交換器功耗採用原廠「唔包括 PoE 輸出」數字；PoE 端點計一次。機架外嘅 PoE 負載亦要計入供電來源，另外仲有轉換及線路損耗。
- UPS、RPS、PoE injector 額定輸出容量唔係自身耗電。計整套設備用電，要用下游負載加供電損耗，唔好將輸出額度再加一次。USB／PCIe 供電 KVM 如已包含喺主機實測輸入，亦唔好重複計。
- 最大功耗、Apple maximum continuous power、Synology Access 測試功耗、NanoKVM 約值係唔同口徑。現時只有一個 powerW 欄位；用呢啲值計出嚟係規劃估算，唔係準確平均耗電，亦唔係統一條件嘅最大負載。
- 現有 `totalPower`／`totalWeight` 直接加總裝置欄位，唔會自動補返硬碟重量、未放入 layout 嘅 PoE 裝置或者電源損耗。
- 更新範本只影響之後新增嘅裝置。已有 layout 保留你原本嘅值；先匯出 JSON 備份，再喺 Properties 按下表改。今次無自動覆蓋既有／自訂 layout。

## 已核實（按列明嘅配置及量度口徑）

| 裝置／ID | 功耗 W（原 → 核對後） | 重量 kg（原 → 核對後） | 口徑及原廠來源 |
|---|---:|---:|---|
| UniFi Switch Lite 8 PoE<br>`unifi-switch-lite-8-poe` | 60 → **8** | 0.8 → **0.295** | 自身最大功耗，唔包括 52W PoE 輸出額度；機身重量，外置火牛另計。 [來源1](https://techspecs.ui.com/unifi/switching/usw-lite-8-poe) |
| UniFi Dream Machine Pro<br>`unifi-dream-machine-pro` | 35 → **33** | 3.9 | 原廠最大功耗；新增 HDD 重量另計。 [來源1](https://techspecs.ui.com/unifi/cloud-gateways/udm-pro) |
| UniFi UCG-Max<br>`unifi-ucg-max` | 16.1 | 0.52 → **0.519** | 採用連 SSD 版本 519g；無 SSD 版本係 460g，按實際配置改。 [來源1](https://techspecs.ui.com/unifi/cloud-gateways/ucg-max) |
| Protectli Vault VP2420<br>`protectli-vp2420` | 24 | 0.8 | 原廠機身 0.80kg，1.47kg 係運輸重量；24W 為最大功耗。 [來源1](https://protectli.com/product/vp2420/) |
| Apple Mac mini M4<br>`apple-mac-mini-m4` | 155 | 0.67 | 155W 係 maximum continuous power 規劃上限，唔係日常平均耗電。 [來源1](https://support.apple.com/en-hk/121555) |
| Apple Mac mini M4 Pro<br>`apple-mac-mini-m4-pro` | 155 | 0.73 | 155W 係 maximum continuous power 規劃上限，唔係日常平均耗電。 [來源1](https://support.apple.com/en-hk/121555) |
| UniFi U7-Pro<br>`unifi-u7-pro` | 21 | 0.68 | 原廠列出重量及最大功耗；放喺機架以外嘅 AP 唔應計入機架承重。 [來源1](https://techspecs.ui.com/unifi/wifi/u7-pro) |
| UniFi Flex 2.5G 8-port<br>`unifi-flex-2-5g-8` | 14 | 0.4 → **0.395** | 對應 non-PoE 型號，唔係 567g 嘅 PoE 版本。原廠最大功耗。 [來源1](https://techspecs.ui.com/unifi/switching/usw-flex-2-5g-8) |
| PiKVM V4 Mini<br>`pikvm-v4-mini` | 10 → **12** | 0.25 → **0.35** | 原廠 datasheet 列峰值 up to 12W、機身 0.35kg。 [來源1](https://docs.pikvm.org/v4/v4mini_datasheet.pdf) |
| Synology DS923+<br>`synology-ds923` | 36 → **35.51** | 2.2 → **2.24** | 重量未連硬碟；35.51W 係原廠 Access 測試功耗，唔係保證最大值；唔可直接當成所有 HDD 配置嘅功耗。 [來源1](https://global.download.synology.com/download/Document/Hardware/ProductSpec/DiskStation/23-year/DS923%2B/enu/Product_Spec_DS923%2B_enu.pdf) [來源2](https://kb.synology.com/en-sg/HIGs/DS923p_HIG/1) |
| Synology RS1221+ 2U NAS<br>`synology-rs1221` | 75 → **49.89** | 6.9 | RS1221+（唔係 RP+）；重量未連硬碟；49.89W 為裝滿 WD10EFRX 嘅 Access 測試值，唔係最大值。 [來源1](https://www.synology.com/en-us/products/RS1221%2B) |
| UniFi Switch Pro 24 PoE<br>`usw-pro-24-poe` | 50 | 4.4 | 連安裝耳重量；最大功耗唔包括 PoE 輸出。 [來源1](https://dl.ui.com/ds/usw-pro-24-poe_ds.pdf) |
| UniFi Switch Pro 48 PoE<br>`usw-pro-48-poe` | 60 | 6.3 | 採用原廠較新 datasheet 嘅連安裝耳重量 6.3kg；舊 QSG 為 6.34kg。最大功耗唔包括 PoE 輸出。 [來源1](https://dl.ui.com/ds/usw-pro-48-poe_ds.pdf) |
| UniFi Switch Enterprise 24 PoE<br>`usw-enterprise-24-poe` | 100 → **60** | 5.2 | 連安裝耳；目前原廠頁列自身最大 60W、連 PoE 460W；550W 係 PSU 額定值，唔可代入自身耗電。 [來源1](https://techspecs.ui.com/unifi/switching/usw-enterprise-24-poe) |
| UniFi Switch Flex Mini<br>`usw-flex-mini` | 2.5 | 0.15 | 原廠最大功耗；機身重量。 [來源1](https://techspecs.ui.com/unifi/switching/usw-flex-mini) |
| UniFi Switch 16 PoE<br>`usw-16-poe` | 25 → **18** | 2.8 → **2.9** | 連安裝耳重量；自身最大功耗唔包括 42W PoE 額度。 [來源1](https://techspecs.ui.com/unifi/switching/usw-16-poe) |
| UniFi Dream Machine Special Edition<br>`udm-se` | 50 | 4.95 → **5** | 採用目前原廠頁重量；功耗唔包括 PoE 輸出，新增 HDD 重量另計。 [來源1](https://techspecs.ui.com/unifi/cloud-gateways/udm-se) |
| UniFi Next-Gen Gateway Pro<br>`uxg-pro` | 35 → **30** | 3.5 → **3.42** | 原廠機身重量及最大功耗。 [來源1](https://dl.ubnt.com/ds/uxg-pro_ds.pdf) |
| UniFi Security Gateway Pro 4<br>`usg-pro-4` | 40 | 2.3 | 原廠最大功耗及機身重量。 [來源1](https://dl.ui.com/qsg/USG-PRO-4/USG-PRO-4_EN.html) |
| UniFi Security Gateway<br>`usg` | 7 | 0.37 → **0.366** | 原廠最大功耗及機身重量。 [來源1](https://dl.ui.com/qsg/USG/USG_EN.html) |
| UniFi U6-Pro<br>`u6-pro` | 13 | 0.58 | 機身 580g；如用原廠 mount，總重係 720g。功耗為最大值。 [來源1](https://techspecs.ui.com/unifi/wifi/u6-pro) |
| UniFi U6-Lite<br>`u6-lite` | 12 | 0.3 | 機身 300g；連原廠 mount 315g。功耗為最大值。 [來源1](https://techspecs.ui.com/unifi/wifi/u6-lite) |
| UniFi Protect NVR<br>`unvr` | 100 | 5.2 | 連安裝耳，HDD 重量另加；100W 係整機最大功耗，包含最高 75W 硬碟功耗額度，唔好再重複加硬碟功耗。 [來源1](https://techspecs.ui.com/unifi/door-access/unvr?subcategory=all-door-access) |
| UniFi Cloud Key Gen2 Plus<br>`cloud-key-gen2-plus` | 13 → **12.95** | 0.58 → **0.582** | 原廠連預裝 1TB HDD 配置，最大功耗。 [來源1](https://techspecs.ui.com/unifi/physical-security/uck-g2-plus) |

## 仍需確認（唔可以當成全部正確）

下表未有替代值嘅欄位保留原值，並非通過驗證。粗體箭嘴只代表已修正嗰個欄位。

| 裝置／ID | 功耗 W（原 → 目前） | 重量 kg（原 → 目前） | 未確認原因及來源 |
|---|---:|---:|---|
| MikroTik CRS305 10G switch<br>`mikrotik-crs305` | 18 | 0.5 | 最大 18W（RJ10 模組配置）；原廠頁另列無附件 10W。今次未搵到可靠原廠淨重，0.5kg 保留待磅。 [來源1](https://mikrotik.com/product/crs305_1g_4s_in) [來源2](https://help.mikrotik.com/docs/spaces/UM/pages/17498183/CRS305-1G-4S%2BIN) |
| UniFi 24-port PoE switch<br>`unifi-switch-24-poe` | 95 | 4.5 | 範本無 SKU，而且深度／SFP+ 與 USW-24-PoE 唔一致；USW-24-PoE 係 25W 自身＋95W PoE 額度。現有 95W／4.5kg 不可當已核實。 [來源1](https://dl.ui.com/ds/usw_poe_ds.pdf) |
| MikroTik RB5009 router<br>`mikrotik-rb5009` | 20 | 0.7 | RB5009 無完整後綴，未確認 UG 定 UPr。UG+S+IN 目前原廠列最大 25W、無附件 14W；現有 20W／0.7kg 未確認，需完整 SKU。 [來源1](https://mikrotik.com/product/rb5009ug_s_in) |
| Minisforum UM790 Pro<br>`minisforum-um790-pro` | 65 | 0.7 | 原廠產品頁未提供足以核實 65W 整機功耗及 0.7kg 淨重嘅文字資料；RAM／SSD／效能模式會改變結果。保留待確認，唔用 CPU TDP 代替整機耗電。 [來源1](https://store.minisforum.com/products/minisforum-um790-pro-mini-pc) |
| Minisforum MS-01<br>`minisforum-ms01` | 65 | 1.4 | 有 i5/i9、RAM／SSD／PCIe 選配；原廠頁未足以核實現有 65W／1.4kg，需配置及整機量度。 [來源1](https://store.minisforum.com/products/minisforum-ms-01-workstation) |
| Apple Mac mini M1/M2<br>`apple-mac-mini-m1-m2` | 150 | 1.2 | 混合型號，M1 1.2kg／150W；M2 1.18kg，唔能夠用同一重量聲稱兩者都精確。保留待揀型號。 [來源1](https://support.apple.com/en-us/111894) [來源2](https://support.apple.com/en-us/111837) |
| Apple Mac Studio<br>`apple-mac-studio-2025` | 370 → **480** | 2.7 | 2025 原廠 maximum continuous power 480W；M4 Max 2.74kg、M3 Ultra 3.64kg。原有 2.7kg 未能代表所有版本，重量保留待揀晶片。 [來源1](https://support.apple.com/en-hk/122211) |
| Raspberry Pi 5<br>`raspberry-pi-5-single` | 12 | 0.15 | 原廠 typical bare-board active current 800mA；27W 係建議火牛額度。12W／150g 無明確機殼、散熱器及附件配置，保留估算，需實測。 [來源1](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html) |
| UniFi PoE Injector 2.5G<br>`unifi-poe-injector-2-5g` | 30 | 0.16 → **0.156** | 重量已確認；現有 30W 係 PoE 輸出額度，唔係自身耗電！自身損耗未有直接規格，保留待實測，唔可當準確功耗。 [來源1](https://store.ui.com/us/en/category/accessories-poe-power/collections/pro-store-poe-and-power-adapters/products/uacc-poe-plus-2-5g?search=poe+switch) |
| JetKVM<br>`jetkvm` | 2 | 0.13 | 已查原廠 FAQ、供電文件；未確認 2W／130g。原廠舊版 RJ11 與市售新版有分別，需機身版本及量度，唔以其他版本資料覆蓋。 [來源1](https://jetkvm.com/docs/getting-started/faq) [來源2](https://jetkvm.com/docs/peripheral-devices/alternative-power-sources) |
| Sipeed NanoKVM Full<br>`sipeed-nanokvm-full` | 1 | 0.08 | 原廠約 1W；今次讀到嘅原廠資料無淨重，80g 未確認。 [來源1](https://wiki.sipeed.com/hardware/en/kvm/NanoKVM/quick_start.html) |
| Sipeed NanoKVM Lite<br>`sipeed-nanokvm-lite` | 1 | 0.04 | 原廠約 1W；今次讀到嘅原廠資料無淨重，40g 未確認。 [來源1](https://wiki.sipeed.com/hardware/en/kvm/NanoKVM/quick_start.html) |
| Sipeed NanoKVM PCIe<br>`sipeed-nanokvm-pcie` | 1 | 0.1 | 原廠 0.2A × 5V = 約 1W；Wi-Fi／PoE 選配或會改變功耗，100g 重量未確認。 [來源1](https://wiki.sipeed.com/hardware/en/kvm/NanoKVM_PCIe/introduction.html) |
| APC Smart-UPS 500VA Li-ion 1U<br>`apc-scl500rm1u` | 8 | 8.1 → **4.18** | SCL500RM1U 原廠淨重 4.18kg；400W／500VA 係輸出容量。現有自身 8W 未獲證實，需量度損耗及充電狀態。 [來源1](https://iportal.se.com/Contents/docs/SCL500RM1U_DATA%20SHEET.PDF) |
| APC Smart-UPS 750VA 1U<br>`apc-smt750rm1u` | 10 | 18 → **15.8** | 原廠 2023 datasheet（第三方鏡像）淨重 15.8kg；600W 為輸出容量、28.8W 為充電額定功率，均唔等同自身常態耗電；現有 10W 未確認。 [來源1](https://manuals.plus/m/4fd634c300ce2afeff6bbdb90369f4de4bf796890f2024e368b9a8cb37020fc3) |
| APC Gaming UPS<br>`apc-gaming-ups` | 12 | 11.5 | 程式註解對應 BGM1500B；原廠規格表鏡像確認 11.5kg。現有自身 12W 未確認；要按充電／負載實測。 [來源1](https://img.cartimex.com/v2/pdf/BGM1500B.pdf) |
| UniFi SmartPower RPS<br>`usp-rps` | 0 | 5 → **5.6** | 連安裝耳 5.6kg；現有 0W 係未建模佔位，唔代表零耗電。995W 包括向下游供電，唔可直接當自身損耗；需實測待機／負載損耗。 [來源1](https://techspecs.ui.com/unifi/accessories/usp-rps) |

## 今次跳過嘅通用／自訂範本（完整名單）

以下數字無指定原廠產品可比對，全部保留。唔係刪除裝置，亦唔代表計總數時可以當成零。

| 裝置／ID | 功耗 W | 重量 kg | 原因 |
|---|---:|---:|---|
| 12-port patch panel<br>`cat6-patch-12` | 0 | 0.8 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 24-port patch panel<br>`cat6-patch-24` | 0 | 1.7 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 8-port 10-inch patch panel<br>`cat6-patch-8-10in` | 0 | 0.6 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 6-port 10-inch patch panel<br>`cat6-patch-6-10in` | 0 | 0.45 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 12-port 10-inch patch panel, 2-row<br>`cat6-patch-12-10in-two-row` | 0 | 0.75 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 12-port 19-inch patch panel<br>`cat6-patch-12-19in` | 0 | 1.1 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 16-port 19-inch patch panel<br>`cat6-patch-16-19in` | 0 | 1.3 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 24-port patch panel, 2-row<br>`cat6-patch-24-two-row` | 0 | 1.8 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 24-port Cat6A shielded patch panel<br>`cat6a-shielded-patch-24` | 0 | 2.3 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 24-port feedthrough patch panel<br>`cat6-patch-24-feedthrough` | 0 | 1.2 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 48-port 2U patch panel<br>`cat6-patch-48-2u` | 0 | 3.2 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 48-port 1U patch panel<br>`cat6-patch-48-1u` | 0 | 3 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 12-port LC fiber patch panel<br>`fiber-patch-12-lc` | 0 | 1.4 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 6-port LC fiber 10-inch panel<br>`fiber-patch-6-lc-10in` | 0 | 0.6 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 24-port LC fiber patch panel<br>`fiber-patch-24-lc` | 0 | 1.8 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 24-port blank keystone panel<br>`blank-keystone-24` | 0 | 0.9 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 8-port PoE switch<br>`managed-switch-8` | 60 | 1.3 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 24-port managed switch<br>`managed-switch-24` | 45 | 3.8 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| TP-Link Omada 8-port PoE switch<br>`tp-link-omada-8-poe` | 80 | 1.5 | 只有 Omada 系列及 port 數，無 SG/TL 型號與硬件版本；80W 可能混入 PoE 額度，今次跳過，未確認。  |
| Edge router<br>`edge-router` | 18 | 0.9 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| Firewall appliance<br>`firewall-appliance` | 25 | 1.5 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| ISP Modem<br>`isp-modem` | 12 | 0.6 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| ISP Fiber ONT<br>`isp-modem-fiber-ont` | 10 | 0.4 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| N100 4-port firewall box<br>`n100-4port-firewall` | 18 | 0.9 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| Mini PC node<br>`mini-pc-nuc` | 35 | 0.7 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| TinyMiniMicro 1L PC<br>`tinyminimicro-1l-node` | 45 | 1.3 | 只有產品系列，無代數／CPU／RAM／SSD SKU，今次跳過；需完整型號及配置。  |
| Dell OptiPlex Micro<br>`dell-optiplex-micro` | 45 | 1.2 | 只有產品系列，無代數／CPU／RAM／SSD SKU，今次跳過；需完整型號及配置。  |
| Lenovo ThinkCentre Tiny<br>`lenovo-thinkcentre-tiny` | 45 | 1.3 | 只有產品系列，無代數／CPU／RAM／SSD SKU，今次跳過；需完整型號及配置。  |
| HP EliteDesk Mini<br>`hp-elitedesk-mini` | 45 | 1.3 | 只有產品系列，無代數／CPU／RAM／SSD SKU，今次跳過；需完整型號及配置。  |
| N100 mini PC node<br>`beelink-n100-node` | 16 | 0.6 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| Raspberry Pi tray<br>`raspberry-pi-cluster` | 18 | 0.5 | 自訂多板 SBC tray，欠各板型號、附件及托盤重量，今次跳過。  |
| 4-bay NAS<br>`nas-4bay` | 70 | 6.5 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 寶藏盒 Pro NAS<br>`bao-zang-he-pro-nas` | 120 | 8 | 自訂 NAS 機殼配置；欠主機板、CPU、PSU、硬碟數及型號。8kg／120W 只係估算，今次跳過。  |
| 2U rack NAS<br>`rack-nas-2u` | 110 | 12 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 4U 12-bay rack NAS<br>`rack-nas-4u-12bay` | 180 | 18 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 4U short-depth NAS<br>`rack-nas-4u-short-depth` | 140 | 14 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 6U 24-bay storage NAS<br>`rack-nas-6u-24bay` | 260 | 30 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 1U short-depth server<br>`server-1u-short-depth` | 120 | 8 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 1U full-depth server<br>`server-1u-full-depth` | 220 | 14 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 2U virtualization server<br>`server-2u-virtualization` | 260 | 18 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 3U GPU server<br>`server-3u-gpu` | 420 | 22 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 4U tower-conversion server<br>`server-4u-tower-conversion` | 300 | 20 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 6U workstation server<br>`server-6u-workstation` | 500 | 28 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 1U UPS<br>`ups-1u` | 8 | 14 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| Compact UPS<br>`compact-ups` | 6 | 7.5 | 通用範本，無品牌及完整 SKU；功耗／重量保留為規劃估算。  |
| 1U PDU<br>`pdu-1u` | 0 | 1.8 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 0U Vertical PDU<br>`pdu-0u-vertical` | 0 | 4.2 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| Vented shelf<br>`shelf-1u` | 0 | 2.1 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U shallow vented shelf<br>`shelf-1u-shallow` | 0 | 1.5 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U deep vented shelf<br>`shelf-1u-deep` | 0 | 3.5 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 2U heavy-duty shelf<br>`shelf-2u-heavy` | 0 | 5 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U sliding shelf<br>`shelf-1u-sliding` | 0 | 4.2 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| Half-width device tray<br>`half-width-device-tray` | 0 | 1.2 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 10-inch shelf<br>`shelf-10in` | 0 | 1.1 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 10-inch deep shelf<br>`shelf-10in-deep` | 0 | 1.6 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U Raspberry Pi tray<br>`pi-tray-1u` | 0 | 1 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| Cable manager<br>`cable-manager-1u` | 0 | 0.9 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 10-inch brush pass-through panel<br>`brush-panel-10in` | 0 | 0.45 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 19-inch brush pass-through panel<br>`brush-panel-19in` | 0 | 0.8 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U D-ring cable manager<br>`d-ring-cable-manager-1u` | 0 | 1 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U rear lacing bar<br>`lacing-bar-1u` | 0 | 0.5 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U blank panel<br>`blank-1u` | 0 | 0.5 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 10-inch 1U blank panel<br>`blank-10in-1u` | 0 | 0.25 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 2U blank panel<br>`blank-2u` | 0 | 0.8 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 1U vented blank panel<br>`vented-blank-1u` | 0 | 0.55 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 2U vented blank panel<br>`vented-blank-2u` | 0 | 0.9 | 被動配件範本，自身 0W 合理；無指定產品，重量屬估算。  |
| 3D-printed L-bracket<br>`printed-bracket-l` | 0 | 0.15 | 自訂 3D 打印件；重量取決於材料、填充率及切片結果，自身 0W，今次跳過重量驗證。  |
| 3D-printed mini tray<br>`printed-tray-mini` | 0 | 0.25 | 自訂 3D 打印件；重量取決於材料、填充率及切片結果，自身 0W，今次跳過重量驗證。  |
| 3D-printed 19-inch tray<br>`printed-tray-19in` | 0 | 0.4 | 自訂 3D 打印件；重量取決於材料、填充率及切片結果，自身 0W，今次跳過重量驗證。  |
| 3D-printed DIN rail clip<br>`printed-din-rail-clip` | 0 | 0.08 | 自訂 3D 打印件；重量取決於材料、填充率及切片結果，自身 0W，今次跳過重量驗證。  |
| 3D-printed vertical adapter strip<br>`printed-vertical-strip` | 0 | 0.12 | 自訂 3D 打印件；重量取決於材料、填充率及切片結果，自身 0W，今次跳過重量驗證。  |
| 3D-printed rail pair<br>`printed-rail-pair` | 0 | 0.3 | 自訂 3D 打印件；重量取決於材料、填充率及切片結果，自身 0W，今次跳過重量驗證。  |
| Custom device<br>`custom-device` | 20 | 2 | 完全自訂裝置，2kg／20W 只係佔位；今次跳過，請填入實物數值。  |

## 點樣補齊待確認項目

提供完整型號／硬件版本、CPU、RAM、硬碟數量型號、是否連火牛或安裝配件；自訂機箱同打印件可直接磅重。量度耗電時，分別記錄閒置、正常負載、最高常用負載；UPS 要另外記錄充電狀態。要計你嗰個 rack 嘅實際總量，需要你匯出嘅 layout JSON 同呢啲配置。

來源以今次可讀到嘅原廠頁面／原廠 datasheet 為準；APC SMT750RM1U、BGM1500B 使用原廠文件嘅第三方鏡像。無用運輸重量、其他 SKU 或 CPU TDP 直接替代整機數值。

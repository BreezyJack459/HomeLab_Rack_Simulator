# Homelab Rack Simulator 使用指南

本指南按 2026-09-18 工作目錄核對。 [English](USER_GUIDE.md) · [文件索引](README.md)

本指南記錄目前程式提供嘅工作流程。模擬器是純前端應用：每個瀏覽器會以 localStorage 保存自己的機架資料；要在裝置之間帶走同一份佈局，請使用 File 的 JSON 匯出／匯入。

以下截圖喺 2026-09-18 用本機程式同範例資料擷取。[完整截圖導覽](SCREENSHOTS.md)。

## 1. 工作區

頂部主導覽把工作分成三個主要地方：

| 工作區 | 用途 | 主要內容 |
|---|---|---|
| **Build** | 放置和檢視設備 | 硬體庫、我的設備、2D 機架、3D 檢視、設備屬性 |
| **Cable** | 建立、追蹤和調整連線 | Cable list、2D map、3D routing、Topology、Table、線材詳情與 BOM |
| **Check** | 處理機架問題 | 容量、電源、重量、散熱、深度與維護性等驗證問題 |

**Tools** 內放置可選的 Operations、Planning、Fleet 和其他功能包，避免平日佈局工作被進階功能淹沒。

## 2. Build：設備庫與我的設備

左邊的 **Library** 是設備範本庫。你可以用類別、尺寸相容性等篩選器找設備，拖進 2D 機架或用新增功能放置。拖曳時：綠色代表可放置、紅色會指出衝突的設備或保留位置、橙色代表仍可放置但有深度警告。

**My devices** 是同一個機架內已擁有、但尚未上架的設備庫存。將設備加入庫存不會計入 U 位、功率、重量或走線；拖入機架後會保留設備身份、屬性及文件資料。已接線的設備需要先移除連線，才可回到庫存。

Build 可切換 2D 和 3D。2D 用於精準 U 位與拖放；3D 用於檢查前後面、深度、插口和實體空間。

![My devices 顯示兩部未上架設備，機架佈局保留喺中央](images/inventory.png)

*庫存設備同已上架設備分開記錄。*

### 用 3D 打印支架代替層板

選取小型設備，打開 **Properties → Dimensions & placement → Mounting support**，由 **Shelf support** 改為 **3D-printed rack mount**。設備會保留原本 U 位、尺寸和連線，2D 外框改為虛線，屬性摘要顯示打印支架標記；Check 不再要求這部設備下方必須有層板。已有的層板不會自動刪除，以免影響同一層的其他設備。

可在 **Printed mount model URL** 保存適用的模型連結；安裝方式和連結會隨佈局自動儲存及 JSON 匯出／匯入。改回 **Shelf support** 後會恢復層板檢查。

**3D Inspect** 和 **3D routing** 都會顯示簡化打印支架，包括底托、側壁、前板和機架固定螺絲。同一面、同一起始 U 位的打印支架會自動組成一組模組化面板；設備之間有足夠空隙時會顯示接駁片。不同面或不同 U 位會分開。移動設備或切回層板承托後，支架會跟著更新；前板亦會為同列其他設備保留開孔，避免遮住設備面板。

面板提供 [Rack Mount Generator](https://github.com/leprachuan/rack-mount-generator) 和 [CageMaker PRCG](https://github.com/WebMaka/CageMakerPRCG) 的入口。前者提供瀏覽器內的支架預覽和 STL 匯出，後者是參數化 OpenSCAD 支架工具。兩者都是外部工具；模擬器的支架是視覺示意，不會匯入 STL、產生可打印 CAD 或自動預留支架額外空間，亦不是新增的走線障礙物。實際安裝仍須核對支架和線材淨空。

請按所選模型核對設備型號、組裝尺寸和承重。例如 UCG-Fiber 支架不應直接視為 UCG-Max 相容款；多部設備共用同一 U 時，亦要計及連接件和支架邊框的空間。

### 薄層板與設備共用 U 空間

揀選層板，在 **Properties → Dimensions & placement → Shelf placement** 選 **Thin tray — share U with devices**。舊佈局預設仍使用 **Separate U**，不會自動移動設備。

薄托盤預設板厚 2 mm、板底位於起始 U 的下邊界。可修改板厚、板底偏移和承重上限；承重填 0 代表未指定，並非無限承重。2D 會顯示薄板及兩側安裝耳，Build 3D 和 Cable 3D 都會顯示相同的托盤，走線避障亦包含板身和安裝耳。

將小型設備放到托盤的**同一起始 U、同一安裝面**，設備就會放在板面上。設備左右各需留至少 3 mm，深度不能超過托盤；「板面高度＋設備高度＋上方預留空間」必須放得入設備的 **Rack size U**。可在設備屬性輸入 **Actual device height mm** 和 **Clearance above mm**；未填實際高度時使用 U 高度推算的示意值，並非廠商尺寸。

例如：1U 薄托盤在 U15，52.3 mm 高的 Mini PC 設成 2U、起始 U15，加上 2 mm 板厚和 10 mm 上方預留，整組可佔 U15–U16，共 2U。同層並排設備共用 U；設備互相重疊仍然會被阻止。不支援自動疊機或移動整組：移動／移除托盤後，設備位置保留，Check 會重新檢查是否有承托。設定支援復原／重做、自動儲存及 JSON 匯出／匯入。

![薄托盤同 Mini PC 共用起始 U，右側顯示實際設備高度同頂部淨空](images/thin-tray.png)

*8U 示範佈局：薄托盤同 2U Mini PC 共用 U3，唔係預設範例。*

## 3. Cable：快速連接與受管理走線

Cable 工作區把 Cable list 放在左邊，中央可切換：

- **2D map**：快速閱讀線路和托盤式走向。
- **3D routing**：檢查插口、線槽、後方纜線、配線架與支撐位置。
- **Topology / Table**：分別查看連接關係與可篩選的線材資料。

原有的 **Add cable** 適合快速建立連線；它會選擇相容的空閒插口。3D 的 Clean 和 Realistic 是兩種展示方式：Clean 用簡潔幾何檢查走線，Realistic 只在不影響淨空時加入自然下垂。它們不會把沒有淨空的路線假裝畫出來；被機身、PDU 或插口工作空間阻擋時，畫面會要求你檢閱路線。

後方資料線會優先使用側線槽及現有理線設備，並同電源線分開。PDU 的出線會保留向下的落線；配線架後方會以分組束線及支撐位置呈現。這些支撐是 3D 規劃輔助，不會自動加入你的設備庫存。

![2D Cable Map 顯示資料線、電源線同線材清單](images/cable-map.png)

## 4. 自訂繪線：Draw route / Redraw route

在 **Cable → 3D routing** 按 **Draw route**，或先揀一條已存在的線再按 **Redraw route**。

1. 選擇前面或後面插口，然後在裝置清單選起點。綠色代表可用插口，灰色代表不可用。
2. 可直接選相容的終點完成，也可先選金色理線點：左右側線槽或現有 cable manager 的開口。
3. 每一步都會顯示預覽。移到可用終點時，面板會顯示路徑長度、包含預留鬆位的估算，以及建議購買線長。
4. 按終點儲存。會再檢查插口是否被其他操作佔用，以及整條線是否會穿過設備或阻擋其他插口。

操作提示：

- **Backspace** 或 **Step back**：退回上一個理線點；在起點時會清除起點。
- **Esc** 或 **Cancel drawing**：放棄草稿，不會改動現有連線。
- 點 3D 中的編號或清單中的理線點：保留該點之前的路線，重新繪製後面一段。
- **A / B**：分別代表起點和目前預覽的終點。

自訂理線點儲存的是「哪個線槽／理線設備」而不是固定 3D 座標。因此機架改高、設備移位或理線設備移動後，路線會跟隨新幾何重新計算。找不到理線點或發現新阻擋時，該線會顯示為 blocked，讓你重繪，而不會自動改成一條不同的路徑。

![兩部伺服器之間嘅自訂走線草稿，包含兩個線槽理線點同線長預覽](images/draw-route.png)

*呢張係儲存前嘅草稿預覽，未完成接線。*

## 5. Check：驗證與修正

Check 把問題按嚴重程度整理。它涵蓋機架容量、重量、功率、散熱、深度、UPS、空氣流動及可維護性。揀選問題後，中央和右邊面板會顯示受影響設備與建議修正方式；完成調整後會自動重新計算。

## 6. 儲存、匯出與 LAN 開發

瀏覽器會自動保存目前機架，並支援 JSON 匯出／匯入和 2D PNG 匯出。這個應用沒有共享後端，所以手機、平板或另一部電腦打開同一個網址後，會有各自獨立的本地資料；要分享佈局請使用 JSON。

在開發機上執行：

```bash
npm run dev
```

Vite 會監聽 LAN。從同一個可信任網絡的其他裝置開啟：

```text
http://YOUR_MAC_LAN_IP:5173/HomeLab_Rack_Simulator/
```

例如：`http://192.168.1.119:5173/HomeLab_Rack_Simulator/`。如要明確指定 LAN 模式，可執行 `npm run dev:lan`。Mac 換網絡後 IP 有可能不同；此模式只供可信任 LAN 使用，不能當成公網部署方案。

## 7. Tools、功能包同 Port Labels

**Tools → Operations／Planning／Fleet** 未啟用時會顯示 **Enable & open**。**Tools → Settings** 有 **Rack settings**、**Manage plugins** 同外觀設定。Cable 依賴預設啟用嘅 Cable Management；如果唔見咗 Cable，可以先檢查插件設定。

可選功能按需下載；載入失敗可停用再啟用重試。新安裝預設關閉 Operations、Planning、Fleet 同 Port Labels；舊使用者已有嘅插件設定會經遷移補回 workspace packs，所以重新載入後可能再見到之前關閉嘅功能包。

啟用 **Port Labels** 後，喺 Tools／Settings 打開佢嘅 view，揀交換器、編輯 physical label，再按 **Save labels**；**CSV** 匯出插口文件。未儲存嘅標籤修改會另外提示。

Fleet 提供機架／房間管理、跨機架連線，同 **Export workspace JSON／Import workspace JSON**。File 入面嘅機架 JSON 只係單一機架；要備份所有機架同跨機架連線，請匯出完整 workspace。

![插件管理視窗，顯示預設及可選功能包](images/plugins.png)

## 8. 儲存錯誤、復原同縮細機架

如果 **Layout recovery** 提示未能儲存，關頁或重新整理之前先按 **Download workspace JSON**；清出瀏覽器空間後，喺有提供嘅情況下按 **Retry save**。

如果原有資料讀唔到，自動儲存會暫停，避免覆蓋原檔。按 **Download original saved data** 保留原始資料；**Download workspace JSON** 係另一份目前工作狀態，唔能夠代替損壞原檔。先保留原檔作修復，唔好第一步就清除 localStorage。

縮細機架而影響設備或保留位時，會開 **Review rack height reduction**。按 **Cancel** 取消，或者 **Resize and retain all data** 保留全部資料；超出新高度嘅記錄仍會存在，要增加高度或重新放置，再用 Check 檢查。Undo 只喺重新載入前有效；資料能否跨重新載入保留，取決於自動儲存有冇成功。

## 9. 3D 視角同線長解讀

3D 可拖曳旋轉、滾輪縮放、右鍵拖曳平移。**Camera view** 有 Overview、Front、Rear、Rear angle · PDU、Top、Left、Right；**Fit rack** 會重新框住機架。

自動 3D 路線候選唔會直接取代自動 2D／BOM 線長計算。自訂路線則共用語意理線點做 2D、3D 同長度估算，但仍然係折線加鬆位嘅規劃估算，唔係實際施工量度。

新 shell 預設開啟；開發排查可設 `localStorage["rack-simulator-new-shell"] = "0"` 再載入，移除該鍵就恢復預設。

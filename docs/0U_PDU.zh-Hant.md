# 0U PDU 安裝及檢視

按 2026-09-18 工作目錄整理；0U 功能目前預設啟用。[技術說明](0u-pdu-3d-positioning.md) · [完整使用指南](USER_GUIDE.zh-Hant.md)

1. 喺 Device library 搜尋 `0U`，選擇 700 mm Vertical PDU 或 400 mm Short PDU，再按 Add to rack。預設安裝喺左後柱；左邊已被佔用時會嘗試右邊。
2. 選取 PDU，喺 Dimensions & placement 設定 PDU length mm、Height above base mm、Mount type、Side 同 Outlet facing。左右方向以站喺機櫃正面望入去為準。
3. 2D 切換 Rear 可見垂直插座；Front 會標示後方設備。Fit 會包括左右側邊安裝區。窄畫面可先收起 Inspector。
4. 3D 選取 PDU 會切換至 Rear angle · PDU；亦可選 Top 檢查側邊位置。Fit rack 包含 PDU 嘅完整外框。
5. Cable 工作區可連接 PDU power 插座同設備電源，3D routing 使用相同插座座標。

0U 唔佔一般設備嘅 U 空間，但仍然有實際長度。同一安裝區唔可以互相重疊，長度加離底高度亦唔可以超過機櫃高度。儲存、JSON 匯出／匯入同 undo／redo 會保留長度同位置。

舊檔冇實際長度嘅 PDU 暫用機櫃高度嘅 88% 顯示，深度用 55 mm；請按實物資料設定長度及深度。安裝支架同機櫃外殼間隙屬近似示意，唔係實物安裝相容性保證。

## 實際畫面

![Home Cloud 範例加入 0U PDU 後嘅後方 3D 檢視](images/zero-u-pdu.png)

2026-09-18 本機截圖：內置 Home Cloud 範例加入 catalog 嘅 0U PDU；使用 Rear angle · PDU 視角。

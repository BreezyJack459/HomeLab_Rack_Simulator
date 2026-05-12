# Cable Port Selection Redesign — First Principles Analysis

## 1. 核心結論（由第一性原則推導）

### 1.1 已鎖定嘅設計方向

| 決定 | 選項 | 原因 |
|------|------|------|
| Interaction model | **Click-to-pair** | Drag-to-connect 同現有 device drag-to-move 有 mouse-down 衝突；click-to-pair 最 clean |
| 揀 port 位置 | **CablePlanner side panel** | 2D rack view 專注 drag-and-drop + info，唔搞 cable |
| 設備揀選方式 | **Visual mini-rack browser** | Dropdown 係 form-based，違反「直接操作」原則 |
| Cable type 決定 | **Port type 自動推斷** | Eth port → eth cable，power port → power cable，用戶零決策 |
| Destination 過濾 | **自動 dim 唔兼容 port** | 只 highlight 同類型 port，用戶一眼知道邊啲揀得 |
| Ghost preview | **Optional toggle（開關）** | 高階用戶開，新手關，平衡性能同體驗 |

### 1.2 第一性原則清單

1. **人眼分辨下限**：Clickable target 最少 ~24px，port grid 必須有足夠空間展開
2. **短期記憶限制**：4±1 items，pairing flow 唔可以有 scrolling 或 view 切換導致 lose context
3. **真實 world caballing 順序**：行到設備 → 睇 face → 插線，UI 必須 mirror 呢個順序
4. **零 form-based**：用戶唔應該讀 label、記 port number、揀 dropdown
5. **Auto route 係 killer feature**：必須保留，唔可以因為 redesign 而妥協

---

## 2. 現狀問題（CablePlanner.tsx 分析）

### 2.1 現有 Flow

```
Dropdown 揀 From 設備 → Dropdown 揀 To 設備 → Click "Select port" button →
Modal 彈出 visual face → Click port → Modal 閂 → Click "Add cable route"
```

### 2.2 違反咗咩第一性原則

- **違反原則 3**：真實 world 係「睇到 port → 插線」，而家係「揀設備 → 記住 → 揀設備 → 記住 → 揀 port」
- **違反原則 4**：Dropdown + modal + button = 三重 form-based abstraction
- **Context switch 開支**：Modal 打斷 flow，用戶由 side panel 跳去 modal，lose spatial context
- **雙 port 選擇割裂**：From port 同 To port 嘅 modal 係分開彈出，用戶記唔住自己揀咗咩

---

## 3. 新建議 Flow（Zero Form-Based）

### 3.1 Side Panel 結構

```
┌─────────────────────────────┐
│ Cables (24 routes)          │  ← Header，可 collapse
├─────────────────────────────┤
│ [Add Cable]                 │  ← Primary action button
├─────────────────────────────┤
│ ┌─────────────────────┐     │
│ │ Mini Rack Browser   │     │  ← 縮細版 rack，顯示所有設備位置
│ │ ▓▓░░▓░░▓▓▓░░       │     │    用顏色代表設備類別
│ │ ▓▓░░▓░░▓▓▓░░       │     │    Click 設備 → 展開 face card
│ └─────────────────────┘     │
├─────────────────────────────┤
│ ┌─────────────────────┐     │
│ │ Switch-A (eth)      │     │  ← 展開嘅 face card
│ │ ┌───┐ ┌───┐ ┌───┐  │     │    Front / Rear tabs
│ │ │ 1 │ │ 2 │ │ 3 │  │     │    Port = visual button
│ │ └───┘ └───┘ └───┘  │     │    Used = greyed out
│ │ ┌───┐ ┌───┐        │     │    Selected = cyan ring
│ │ │ 4 │ │ 5 │        │     │    Compatible hover = glow
│ │ └───┘ └───┘        │     │
│ └─────────────────────┘     │
├─────────────────────────────┤
│ ┌─────────────────────┐     │
│ │ Ghost Preview       │     │  ← Toggle switch
│ │ [●────────] On      │     │    Default: Off
│ └─────────────────────┘     │
├─────────────────────────────┤
│ Route List                  │  ← 現有 cable list（保留）
│ ● Switch-A → Patch-1        │
│ ● Server-1 → PDU-1          │
└─────────────────────────────┘
```

### 3.2 Pairing Flow（Step-by-step）

**Step 1 — 進入 Pairing Mode**
- User click [Add Cable] button
- 系統進入 `cablePairingMode`
- Mini rack browser 內所有設備：compatible ports 開始 pulse / glow

**Step 2 — 揀 Source Port**
- User click 設備 thumbnail → face card inline 展開
- User click 一個 port → port 變 cyan highlight，系統記住 `pendingSourcePort`
- 其他設備嘅 face card 自動 collapse（保持 context 清爽）
- 底部出現 floating bar：「eth 3 (Switch-A) → ?」+ [Cancel] button

**Step 3 — 揀 Destination Port**
- 系統自動 scan 全 rack，只保留 `compatiblePorts`（同類型、未 used）
- 其他 port dimmed / disabled
- User click 第二個設備 thumbnail → face card 展開
- User click destination port → cable 建立

**Step 4 — Auto Route**
- `addCable()` 觸發（現有 store action，唔使改）
- `calculateCableNodes()` 計算 routing（現有邏輯，唔使改）
- Route list 即時更新，新 cable 條目 animation fade in

**Step 5 — 連續 Pairing（Premium UX）**
- 建立完一條 cable 後，系統問：「Continue from same source?」或「Start new」
- 如果揀 continue：保持 source port，只等 destination → 大幅加速 patch panel → switch 嘅大量 caballing

---

## 4. Ghost Preview（Premium Toggle）

### 4.1 行為

| 狀態 | 表現 |
|------|------|
| Toggle OFF | Hover compatible port → 只顯示 glow highlight，冇 preview cable |
| Toggle ON | Hover compatible port → 即時計算並畫一條半透明 ghost cable（opacity 0.4） |

### 4.2 性能策略

- Ghost preview 用 **debounced recomputation**（hover 穩定 150ms 後先計算）
- 唔 store 落 state，純粹 SVG overlay，mouse leave 即時清除
- 用現有 `calculateCablePlan()` 但只取 `nodes` 畫 path，唔需要 full plan
- 上限：只 preview 前 20 nodes，超過就截斷

### 4.3 視覺設計

```
Ghost cable: 1px dashed white, opacity 0.35, no shadow
Hover port:  ring-2 ring-cyan-400/50, scale 1.1
Source port: ring-2 ring-cyan-300, bg-cyan-300/15
```

---

## 5. 需要改嘅 Files（Impact Analysis）

### 5.1 主要改動

| File | 改動內容 |
|------|---------|
| `src/components/CablePlanner.tsx` | 完全重寫 UI flow：remove dropdowns/modal，加入 mini rack browser + face card + pairing state machine |
| `src/store/rackStore.ts` | 加入 `cablePairingMode` state：`idle` \| `selecting_source` \| `selecting_destination` \| `pending_source` |
| `src/types/rack.ts` | 可能唔使改（現有 `PortRef` / `CableRoute` 夠用） |

### 5.2 可重用現有 Logic（唔使改）

- `buildPortLayout()` — face card 畫 port grid 直接用
- `portOptionsForDevice()` — 過濾 used / available ports
- `inferCableType()` — auto detect cable type
- `calculateCableNodes()` / `calculateCablePlan()` — auto route 保留
- `addCable()` — store action 保留
- `isPortUsed()` — disable used ports

### 5.3 新增 Components 建議

```
src/components/cable-planner/
├── MiniRackBrowser.tsx      # 縮細 rack，設備 thumbnail grid
├── DeviceFaceCard.tsx        # 展開嘅 face card，visual port grid
├── PairingStatusBar.tsx      # 「eth 3 → ?」floating bar
├── GhostPreviewOverlay.tsx   # SVG ghost cable layer
└── useCablePairing.ts        # Pairing state machine hook
```

---

## 6. 最小驗證實驗（24 小時內可做）

1. **Mock Mini Rack Browser**：喺 CablePlanner 入面畫一個 320×80px 嘅 rectangle，用 5-6 個 colored div 代表設備，click 一個 div → console.log device ID
2. **Inline Face Card**：click 設備 div 之後，喺下面展開一個 320×100px 嘅 face card，用 `buildPortLayout` 畫 6 個 port button
3. **Port Click Test**：click port → console.log `{ deviceId, portIndex, portType }`
4. **Pairing State**：click 兩個 port → console.log 一條完整嘅 `CableRoute` object

如果以上 mock 做到，就證明 interaction model 可行，可以進入正式 implementation。

---

## 7. 反對觀點（自己質疑自己）

### 反對 1：Mini rack browser 會唔會太細，睇唔清楚設備？
> 回應：設備只係 thumbnail（顏色 + 簡短 label），目的係「定位」，唔係「詳情」。詳情喺 face card 展開後先顯示。

### 反對 2：大量 port（48-port switch）展開會好長？
> 回應：Face card 用 scrollable container（max-height: 200px），group by face（front/rear），唔需要一次過 show 晒。

### 反對 3：Click-to-pair 對 keyboard user 唔友好？
> 回應：保留 Tab navigation 同 Enter/Space select，port grid 用 `grid-cols-6` 已有 implicit 順序。

### 反對 4：Ghost preview 性能差？
> 回應：Debounce + 只畫 path + 上限 nodes。Toggle default OFF，用戶自己開。

---

## 8. 總結：Redesign 嘅核心槓桿點

| 現狀問題 | Redesign 解法 | Leverage |
|---------|--------------|----------|
| Dropdown + Modal = 三重抽象 | Mini rack + Inline face = 零抽象 | 用戶唔使記住、對照、切換 |
| From/To 割裂 | Pairing state machine + visual feedback | Context 不流失 |
| Port 靠 label 識別 | Visual port grid，顏色區分 type | 直覺，唔使讀字 |
| Cable type 要手動揀 | Port type 自動推斷 | 零決策負荷 |
| 每條 cable 都重新嚟過 | Continue from same source | Batch caballing 加速 3-5x |
| 冇 preview | Ghost preview toggle | Confirm 之前睇到結果 |

---

*Generated by first-principles analysis. 所有建議基於物理事實（空間、記憶、視覺）同現有 codebase 嘅真實 constraints。*

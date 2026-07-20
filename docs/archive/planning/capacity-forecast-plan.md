# Capacity Forecast Feature Plan

## 🔒 SCOPE LOCK
本轮唯一目标：实现 Rack Capacity Forecast（机架容量预测），回答「下一個瓶頸是什麼、還能裝多少設備」
禁止事項：
- 重構無關代碼
- 修改未批准的文件
- 新增 dependency
- 更改架構設計

## Goal
Add a capacity forecast panel that predicts when the rack will exhaust U-space, power, weight, switch ports, PDU outlets, thermal headroom, and noise tolerance. Shows "next bottleneck" with estimated devices until exhaustion and mitigation recommendations.

## Files to Create

### 1. `src/utils/capacityForecast.ts` (~150 lines)
Core utility functions:
- `analyzeCapacityForecast(layout: RackLayout): CapacityForecast`
- Forecast categories: `space`, `power`, `weight`, `switch-ports`, `pdu-outlets`, `heat`, `noise`, `cable-density`
- Per-category: `current`, `max`, `percentUsed`, `headroom`, `estimatedDevicesUntilExhaustion`, `status` ('good' | 'warning' | 'critical')
- `getNextBottleneck(forecast)` — returns the category with lowest headroom
- `getMitigationRecommendations(forecast)` — actionable suggestions per bottleneck
- Uses device catalog median stats for "average next device" estimates
- Accounts for reservations and planned procurement items

### 2. `src/utils/capacityForecast.test.ts` (~80 lines)
Tests for:
- Empty rack forecast (all green, high headroom)
- Near-full rack forecast (critical space)
- Near-power-limit forecast (critical power)
- Weight-limit forecast
- Switch port exhaustion
- Next bottleneck detection
- Mitigation recommendations

### 3. `src/components/CapacityForecastPanel.tsx` (~200 lines)
- Collapsible panel (follow existing panel pattern)
- Shows "Next Bottleneck" card prominently
- Grid of forecast category cards with progress bars
- Color-coded: green ≤80%, amber 80-95%, red >95%
- "Estimated devices remaining" per category
- Mitigation recommendations list
- Works with multi-rack workspace (per-rack forecast)

## Files to Modify

### 4. `src/App.tsx` (+3 lines)
- Add lazy import for `CapacityForecastPanel`
- Add panel to right column after `RackHealthDashboard`

## Key Design Decisions

1. **Average next device**: Calculate median sizeU, powerW, weightKg, heatLevel from the device catalog (excluding blanks, cable-management, printed-mounts). Use this as the "typical next device" for exhaustion estimates.

2. **Switch port counting**: Count total RJ45/SFP ports across all switch devices, minus used ports from cables. Simple heuristic — not full port topology.

3. **PDU outlet counting**: Count power ports on all PDU devices, minus power cables.

4. **Noise**: Reuse `combineDb` from `noiseCalc.ts` to estimate how many more "average" devices before exceeding room suitability thresholds.

5. **Cable density**: Use existing cable count per side rail from routing data if available; fallback to total cable count vs rack height heuristic.

6. **Reservations**: Include `reservedU` from `getRackTotals()` in space calculation. Include planned procurement items in forecasts.

## Risk Assessment
- **Low risk**: Pure utility + panel, no store/core changes
- **No bundle risk**: No new dependencies, lazy-loaded panel
- **No 3D changes**: No WebGL impact
- **Test coverage**: New utility has dedicated test file

## Verification Plan
1. `npm test -- src/utils/capacityForecast.test.ts --pool=threads`
2. `npx tsc --noEmit`
3. `npm test -- --pool=threads`
4. `npm run build`
5. `node scripts/check-bundle-size.mjs`

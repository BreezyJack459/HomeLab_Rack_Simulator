# Cable Port Selection UX Redesign Plan

**Created**: 2026-05-12  
**Last updated**: 2026-05-12 17:00 HKT  
**Status**: Phase D — store plumbing complete; `DevicePortFace` interactive layer remaining  
**Priority**: High  
**Scope**: `CablePlanner.tsx`, `portSelection.ts`, `types/pairing.ts`, `rackStore.ts`, `CableViewer3D.tsx`, `DeviceModel.tsx`

---

## Problem Statement

The original cable creation flow forced users through too many manual steps:

```
[Add Cable]
  → Mini Rack Browser (tiny 188px canvas, device buttons overlap)
    → Click device to expand DeviceFaceCard
      → See Front / Rear face sections
        → See port type groups (ethernet, power, fiber...)
          → Click a numbered port button (index only, e.g. "1", "2", "3")
            → Repeat for destination device
              → Cable created
```

**Pain points identified:**
- MiniRackBrowser was a 188px canvas with absolute-positioned tiny buttons — unusable on dense racks
- Port selection showed raw index numbers with no spatial context
- User had to manually understand front/rear face split per device category
- No auto-suggestion of next free port — every connection required full manual selection
- No indication of what cable type would be used before committing
- Port grid showed disabled (used) ports as struck-through clutter

---

## Design Goals

1. **Minimize required clicks** — happy path is 2 clicks max
2. **Auto-assign port** — system picks the next free port by default; user overrides only when needed
3. **Device-first, port-second** — select devices first, ports are an optional refinement
4. **Show only actionable options** — filter out used/incompatible ports entirely
5. **Cable type inference is invisible** — user never has to manually pick cable type
6. **3D-native** — eventually, ports can be clicked directly in the 3D viewer (Phase D)

---

## Reference: How Modern Tools Do It

| Tool | Interaction Model | Key Idea |
|------|-------------------|----------|
| Cisco Packet Tracer | Click device → rubber-band line → click destination port | Visual click-to-click, port shown spatially |
| NetBox | Dropdown search: device + port in one typeahead | Search-driven, no visual map needed |
| draw.io (network) | Click device connector dot → drag to target | Connector-dots on device boundary |
| Lucidchart | Hover device → port handles appear → drag | Progressive disclosure of ports |
| Nautobot | Autocomplete: "Switch-01 eth1" → suggests compatible targets | Fuzzy search across all endpoints |

**Takeaway**: Visual click-to-click (Packet Tracer style) + auto-assign (Lucidchart style) is the best fit. The rack is small enough to show all devices as a flat list.

---

## Flows

### Happy Path (Auto-assign, 2 clicks) ✅ Shipped in Phase B

```
[Add Cable]
  → Device List: flat list of all devices with free port counts
    → Click Device A  (system highlights it, shows "will use eth 1 rear")
      → Click Device B  (system auto-assigns compatible port)
        → Cable created ✓
```

### Override Path (Manual port pick, 4 clicks) ✅ Shipped in Phase B

```
[Add Cable]
  → Device List → Click Device A → expand port picker
    → Click specific port (e.g. "eth 3 rear")
      → Device List → Click Device B → expand port picker
        → Click specific port
          → Cable created ✓
```

### 3D Raycast Path (click port in 3D viewer) ⏳ Phase D in progress

```
[pairing active in sidebar]
  → Hover port square in 3D viewer → port glows white
    → Click port → PortHit3D dispatched to store
      → CablePlanner receives hit → resolves to PortChoice → commits cable
        → Ghost tube disappears, real cable tube appears ✓
```

---

## Implementation Status

### Phase A — Logic Layer ✅ Complete
**File**: `src/utils/portSelection.ts`

| Function | Status | Notes |
|----------|--------|-------|
| `portTypeForCableType` | ✅ | Maps `CableType` → `PortType` |
| `portKey` | ✅ | Stable string key for a `PortRef` |
| `getUsedPorts` | ✅ | Returns set of occupied port keys per device |
| `isPortUsed` | ✅ | Boolean check against used set |
| `inferCableType` | ✅ | `PortType` → most likely `CableType` |
| `portOptionsForDevice` | ✅ | All port options on a device (all faces) |
| `portChoicesForDevice` | ✅ | Enriched with deviceId/deviceName/cableTypes |
| `sourceSupportsCableType` | ✅ | Guards source→dest compatibility |
| `resolveCompatibleCable` | ✅ | Returns `{ fromPort, toPort, cableType, color }` |
| `getNextFreePort` | ✅ | First available port for a given cable type |
| `getFreePortSummary` | ✅ | `{ type, free, total }[]` for badge display |
| `autoResolveCable` | ✅ | Full 2-click auto-assign between two devices |

**Tests**: `src/utils/portSelection.test.ts` — ~100 cases across 9 `describe` blocks. Run with `--pool=threads`.

---

### Phase B — DeviceListPicker ✅ Complete
**File**: `src/components/CablePlanner.tsx`

`MiniRackBrowser` (tiny canvas) replaced with `DeviceListPicker` (flat scrollable list).

- Flat list: color dot · device name · U position · free port badges (`eth ×4`, `pwr ×2`)
- Click device row → `handleAutoConnect()` → 2-click happy path
- `▸` expand toggle → `DeviceFaceCard` for manual port override
- Destination stage: dims incompatible devices; highlights compatible port badges in cyan
- Source stage: auto-picks first free port across all cable types

---

### Phase C — Ghost Preview Wiring ✅ Complete
**Files**: `src/components/CablePlanner.tsx`, `src/store/rackStore.ts`, `src/components/CableViewer3D.tsx`

| Item | Status |
|------|--------|
| Fix stale `'selecting_destination'` → `isSelectingDest(stage)` in badge className | ✅ |
| Fix stale `'selecting_destination'` → `isSelectingDest(stage)` in DeviceFaceCard (×2) | ✅ |
| `previewCable: CableRoute \| null` + `setPreviewCable` added to `rackStore` | ✅ |
| `useEffect` in `CablePlanner` syncs `hoverCable` → store (`ghostPreview` gated) | ✅ |
| Cleanup on unmount: `setPreviewCable(null)` in effect return | ✅ |
| `setPreviewCable(null)` on `cancelPairing()` | ✅ |
| `setPreviewCable(null)` on `handleAutoConnect` cable commit | ✅ |
| `setPreviewCable(null)` on `handleSelectChoice` cable commit | ✅ |
| `CableViewer3D` reads `previewCable` from store | ✅ |
| Ghost tube rendered as raw `<tubeGeometry>` with `transparent opacity={0.45} depthWrite={false}` | ✅ |

---

### Phase D — 3D Raycast Port Picking 🚧 In Progress
**Files**: `src/types/pairing.ts` (new), `src/store/rackStore.ts`, `src/components/CablePlanner.tsx`, `src/components/three/DeviceModel.tsx`

#### Architecture

The pairing state is lifted from local `CablePlanner` component state into `rackStore` so that `DeviceModel.tsx` can read it without prop-drilling. `CablePlanner` registers a callback (`onPortPick3D`) via the store. When a port is clicked in 3D, `DevicePortFace` fires the callback with a `PortHit3D`, which `CablePlanner` translates into the existing `handleSelectChoice` / `handleAutoConnect` flow.

```
CablePlanner (2D sidebar)
  ├── registers onPortPick3D handler via store on mount
  ├── mirrors local stage/source → store via useEffect
  └── handleSelectChoice3D(choice) — same logic as handleSelectChoice

rackStore
  ├── pairingStage: PairingStage
  ├── pairingSource: PairingSource | null
  ├── onPortPick3D: ((hit: PortHit3D) => void) | null
  └── previewCable: CableRoute | null

DevicePortFace (inside CableViewer3D scene)
  ├── reads pairingStage, onPortPick3D from store
  ├── onPointerOver → port glow (emissiveIntensity 1.2, white)
  └── onClick → fires onPortPick3D({ deviceId, portType, portIndex, face, cableTypes })
```

#### Shared Types — `src/types/pairing.ts` ✅

```ts
export type PairingStage =
  | 'idle'
  | 'selecting_source_device'
  | 'selecting_source_port'
  | 'selecting_dest_device'
  | 'selecting_dest_port';

export function isSelectingSource(stage: PairingStage): boolean
export function isSelectingDest(stage: PairingStage): boolean

export type PairingSource = { deviceId, deviceName, port, label }
export type PortHit3D = { deviceId, portType, portIndex, face, cableTypes }
```

#### Store additions — `src/store/rackStore.ts` ✅

```ts
pairingStage: PairingStage          // mirrored from CablePlanner
pairingSource: PairingSource | null  // mirrored from CablePlanner
setPairingStage / setPairingSource
onPortPick3D: ((hit: PortHit3D) => void) | null
registerPortPick3D(handler)          // called by CablePlanner on mount
```

#### CablePlanner changes ✅

- `PairingStage`, `PairingSource`, `isSelectingDest/Source` → imported from `types/pairing`
- `setPairingStage`, `setPairingSource`, `registerPortPick3D` store slices added
- `useEffect` mirrors `stage` → `setPairingStage`, `source` → `setPairingSource`
- `registerPortPick3D` effect translates `PortHit3D` → `PortChoice` → `handleSelectChoice3D`

#### DeviceModel.tsx changes ⏳ Remaining

```ts
// In DevicePortFace — add:
const pairingStage = useRackStore((s) => s.pairingStage);
const onPortPick3D = useRackStore((s) => s.onPortPick3D);
const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
const isPairing = pairingStage !== 'idle';

// On each port <mesh>:
onPointerOver={isPairing ? (e) => { e.stopPropagation(); setHoveredSlot(`${group.type}-${slot.index}`); } : undefined}
onPointerOut={isPairing ? () => setHoveredSlot(null) : undefined}
onClick={isPairing && onPortPick3D ? (e) => {
  e.stopPropagation();
  onPortPick3D({ deviceId: device.id, portType: group.type as PortType, portIndex: slot.index, face, cableTypes: [] });
} : undefined}

// Material glow during pairing hover:
emissive={hoveredSlot === `${group.type}-${slot.index}` && isPairing ? '#ffffff' : group.emissive}
emissiveIntensity={hoveredSlot === `${group.type}-${slot.index}` && isPairing ? 1.2 : 0.35}
```

Also apply to `DeviceZeroUSideFace`.

#### handleSelectChoice3D — `CablePlanner.tsx` ⏳ Remaining

```ts
// Thin wrapper — same logic as handleSelectChoice but callable from useEffect closure
function handleSelectChoice3D(choice: PortChoice) {
  if (isSelectingDest(stage)) {
    const compatible = resolveCompatibleCable(layout, source, choice);
    if (!source || !compatible) return;
    addCable({ ... });
    setPreviewCable(null);
    setStage('idle');
    // ... reset state
  } else {
    setSource({ deviceId: choice.deviceId, deviceName: choice.deviceName, port: portRefFromChoice(choice), label: ... });
    setStage('selecting_dest_device');
  }
}
```

---

## File Touch Summary

| File | Change | Status |
|------|--------|--------|
| `src/utils/portSelection.ts` | New — all port logic extracted here | ✅ Done |
| `src/utils/portSelection.test.ts` | New — ~100 tests | ✅ Done |
| `src/types/pairing.ts` | New — shared pairing types | ✅ Done |
| `src/store/rackStore.ts` | `previewCable`, pairing slab (6 fields) | ✅ Done |
| `src/components/CablePlanner.tsx` | DeviceListPicker, ghost preview, Phase D store wiring | ✅ Done (D handler remaining) |
| `src/components/CableViewer3D.tsx` | Ghost tube render, `previewCable` store slice | ✅ Done |
| `src/components/three/DeviceModel.tsx` | Interactive ports during pairing (Phase D) | ⏳ Remaining |

---

## Verification

After Phase D `DeviceModel.tsx` changes:

```bash
npx tsc --noEmit          # must be zero errors
npm test                  # portSelection.test.ts must pass
```

Manual test checklist:
- [ ] Click "Add Cable" in sidebar → device list appears
- [ ] Click a device row → source confirmed, stage advances
- [ ] Hover another device in list → ghost tube appears in 3D viewer
- [ ] Click destination device → cable committed, ghost disappears
- [ ] Escape key → pairing cancelled, ghost disappears
- [ ] While pairing active: hover a port square in 3D → port glows white
- [ ] Click a port square in 3D → cable committed via 3D path
- [ ] Expand `▸` in sidebar → `DeviceFaceCard` appears; click port → manual override works

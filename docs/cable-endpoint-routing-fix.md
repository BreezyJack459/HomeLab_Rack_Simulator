# Cable Endpoint & Routing Fix (2026-05-04)

## Problem Summary

Power cables were connecting to the wrong positions on devices — appearing to attach to the flat device surface rather than to specific outlet ports. Three root causes were identified and fixed.

---

## Root Cause 1: `portZSign` Bug — Rear-Mounted Device Ports Faced Wrong Direction

**File**: `src/components/CableViewer3D.tsx`  
**Function**: `portZSign()`

### Bug
```typescript
// OLD — incorrect
return (portOnDeviceFace === 'front' ? 1 : -1) * (mountSide === 'front' ? 1 : -1);
```

For a **rear-mounted** device (e.g., PDU mounted on rear posts) with a **rear port** (e.g., PSU inlet):
- `portOnDeviceFace = 'rear'` → factor = -1
- `mountSide = 'rear'` → factor = -1
- Result: `(-1) * (-1) = +1` → port placed on **+Z (front face)** ❌

This placed rear ports on the **front face** of rear-mounted devices, causing cables to start from inside the rack instead of outside.

### Fix
```typescript
// NEW — correct
return portOnDeviceFace === 'front' ? 1 : -1;
```

A device's **front face is always its +Z side**; its **rear face is always its -Z side** — regardless of how the device is mounted in the rack.

---

## Root Cause 2: Routing & Rendering Used Different Column Counts

**Files**: `src/components/CableViewer3D.tsx`, `src/utils/portLayout.ts`

### Bug
`devicePortPosition()` (cable endpoint) and `DeviceFacePorts` / `buildPortLayout()` (visual rendering) computed port positions with **different grid columns**:

| Device | `devicePortPosition` columns | `buildPortLayout` columns |
|--------|------------------------------|---------------------------|
| `pdu-1u` (8 outlets) | `Math.min(8, 4) = 4` | `getDefaultColumns(power, 8, pdu) = 8` |

Example mismatch for `pdu-1u` outlet #1:
- Cable endpoint: x = **-0.42** (4-col layout)
- Visual port box: x = **-0.90** (8-col layout)

Cables connected to empty space — missing the visible orange port squares entirely.

### Fix

**`devicePortPosition()`** now uses `buildPortLayout()` for **all devices** (not just 0U):

```typescript
const groups = buildPortLayout(device, isZeroU ? pos.depth : deviceWidth, deviceHeight, face);
for (const group of groups) {
  if (group.type !== portType) continue;
  const slot = group.slots.find((s) => s.index === portIndex);
  if (slot) {
    return {
      x: pos.x + slot.x,
      y: pos.y + slot.y,
      z: pos.z + sign * (pos.depth / 2 + 0.018),
    };
  }
}
```

**`layoutPortGroup()`** now accepts an `explicitColumns` parameter so `portLayouts` configs like `{ type: 'power', columns: 2 }` are actually respected:

```typescript
const layoutColumns = explicitColumns ?? (device.ports?.layoutColumns as number) ?? getDefaultColumns(type, count, device.category);
```

---

## Root Cause 3: 0U Side Devices Approached from Z Instead of X

**File**: `src/components/CableViewer3D.tsx`  
**Function**: `buildCablePath()` — side-rail path

### Bug
The side-rail L-path assumed **all ports face ±Z** (front/rear). For **0U side-mounted devices** (e.g., `pdu-0u-vertical`), ports face **±X** (toward rack center). The cable approached from the Z direction:

```typescript
// OLD — wrong for 0U side devices
points.push(new Vector3(toPort.x, toDropY, toExitZ));   // approach from Z
points.push(new Vector3(toPort.x, toDropY, toPort.z));  // move in Z to port
```

This caused cables to enter 0U PDU ports from the wrong angle — looking like they pierced through the device.

### Fix
Side-rail path now detects 0U devices (`isSideZone`) and uses **X-exit/entry** instead of Z:

```typescript
const fromIsSide = isSideZone(from);
const toIsSide = isSideZone(to);

// Exit: Z for normal devices, X for 0U side devices
if (fromIsSide) {
  points.push(new Vector3(fromExitX, fromDropY, fromPort.z));
} else {
  points.push(new Vector3(fromPort.x, fromDropY, fromExitZ));
}

// Side rail runs at target's Z for 0U targets
const targetZ = toIsSide ? toPort.z : toExitZ;

// Enter target: X approach for 0U side devices
if (toIsSide) {
  points.push(new Vector3(toExitX, toDropY, toPort.z));
  points.push(new Vector3(toPort.x, toDropY, toPort.z));
} else {
  points.push(new Vector3(toPort.x, toDropY, toExitZ));
  if (isPower) points.push(new Vector3(toPort.x, toDropY, toPort.z));
}
```

---

## Additional Cable Realism Improvements

| Improvement | File | Change |
|-------------|------|--------|
| **Gravity sag** | `CableViewer3D.tsx` | `insertGravitySag()` adds natural droop to long spans; skips first/last segments to preserve port connections |
| **Cable material** | `CableViewer3D.tsx` | `roughness: 0.72` / `metalness: 0.02` — rubber jacket instead of plastic tube |
| **Cable shadows** | `CableViewer3D.tsx` | `castShadow` on cable mesh; floor plane enlarged to `12×10` |
| **Strain relief boots** | `CableViewer3D.tsx` | Small tapered cylinders at both ends (`t = 0.008/0.992`, height `radius * 2.5`) |
| **Adaptive tension** | `CableViewer3D.tsx` | CatmullRom tension = `0.15 + totalLength * 0.02` (longer cables = gentler curves) |
| **Rear-to-rear arc** | `CableViewer3D.tsx` | Direct path now handles `front→front`, `rear→rear`, and mixed cases |

---

## Files Modified

- `src/components/CableViewer3D.tsx` — `portZSign`, `devicePortPosition`, `buildCablePath`, `insertGravitySag`, `StrainRelief`, `CableTube`
- `src/utils/routing.ts` — power cable node calculation (kept side-rail routing)
- `src/utils/portLayout.ts` — `layoutPortGroup` `explicitColumns` parameter
- `src/data/deviceCatalog.ts` — added `portLayouts` to all 16 patch panel templates

## Verification

- TypeScript: `tsc --noEmit` passes ✅
- Build: `npm run build` passes ✅
- HMR: dev server hot-reloads correctly ✅

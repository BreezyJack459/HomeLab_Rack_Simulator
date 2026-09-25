---
name: cable-routing-check
description: Validate cable routing and rack math changes against ADR invariants. Checks port face logic consistency, approach rules, rail rules, and PDU drop-down behavior.
---

# Cable Routing Invariant Check

Use this skill after modifying any of the following files:
- `src/utils/routing.ts`
- `src/utils/portLayout.ts`
- `src/utils/rackMath.ts`
- `src/utils/validation.ts`
- `src/components/three/CableViewer3D.tsx`
- `src/components/three/DeviceModel.tsx`

## Critical Invariants (Must Verify)

### 1. Port Face Logic Consistency (ADR-003 / ADR-012)

Port face conventions must match across **three** locations:
- `getPortFaceMap()` in `portLayout.ts`
- `routing.ts` (uses `getPortFaceMap`)
- `CableViewer3D.tsx` (`portFace` helper)

**Check**: Each must respect `PlacedDevice.portFaceOverrides`.

### 2. portZSign Independence (ADR-012)

Front face is **always** `+Z`, rear is **always** `−Z`.

**Check**: `portZSign` does **NOT** depend on `mountSide`. Reintroducing `* mountSide` re-breaks all rear-mounted device port placement (PDU/UPS/server PSUs).

### 3. devicePortPosition() Queries buildPortLayout() for ALL Devices (ADR-010)

`devicePortPosition()` must call `buildPortLayout()` for **all** devices (not just 0U).

**Check**: No separate grid calculation fallback. `portLayouts.columns` must match between renderer and router.

### 4. 0U vs Normal Device Approach Rule (ADR-011)

- **0U side devices** → X-approach (vertical 0U PDUs face ±X toward rack center)
- **Normal devices** → Z-approach (horizontal devices face ±Z)

**Check**: `buildCablePath()` branches on `isSideZone(...)` correctly.

### 5. Half-Half Rail Rule (ADR-008)

The source port half is the preferred rail, **not** a rail fixed by cable type. The rear 3D candidate planner may select the opposite rail when it provides a shorter clear route; equal-cost candidates prefer the source half. Front and 0U routing keep their existing rules.

**Check**: Compare direct/drop, existing-manager and side candidates; reject body/access collisions, preserve endpoint approach directions, and keep the selected route family and rail identical across Clean and Realistic. Added support hardware must clear device bodies and connector access envelopes. If no candidate is clear, report a blocked route instead of drawing an unchecked fallback.

### 6. PDU Drop-Down Behavior (ADR-007)

`fromIsPdu || toIsPdu` triggers a vertical drop before entering cable management.

**Check**: Device PSU inlets exit directly (no drop).

### 7. State Mutation Path (Store Only)

Never mutate `layout.devices` / `layout.cables` in components.

**Check**: All paths go through `useRackStore().updateDevice()`, `addCable()`, etc.

### 8. templateToDevice() Field Copying

Any new `DeviceTemplate` field must be copied to `PlacedDevice`.

**Check**: `portFaceOverrides`, `portLayouts`, etc. are preserved.

## Verification Commands

After making changes, run:

```bash
# Type check
npx tsc --noEmit

# Unit tests (includes routing, rack math, port layout tests)
npm test

# E2E smoke tests
npx playwright test

# Standalone cable routing smoke test
npm run smoke:cables
```

## Quick Review Checklist

- [ ] `getPortFaceMap()` handles the modified device category correctly
- [ ] `routing.ts` uses `getPortFaceMap()` (not hardcoded faces)
- [ ] `CableViewer3D.tsx` `portFace` helper matches `getPortFaceMap()` output
- [ ] `portZSign` calculation has no `* mountSide` multiplication
- [ ] `buildPortLayout()` is called for all device types in `devicePortPosition()`
- [ ] `buildCablePath()` branches on `isSideZone()` correctly for 0U devices
- [ ] Rear route selection compares clear candidates and uses the source half as its tie-break (not cable type)
- [ ] PDU drop-down check uses `fromIsPdu || toIsPdu`
- [ ] No direct mutation of `layout.devices` / `layout.cables` in components
- [ ] `templateToDevice()` copies all relevant fields

## When to Escalate

If any invariant is intentionally being changed:
1. Update the corresponding ADR in `docs/dev/DECISIONS.md`
2. Update this skill's invariant list
3. Notify that **all three** port face locations must change together

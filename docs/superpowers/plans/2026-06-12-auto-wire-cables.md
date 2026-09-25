# Auto-wire Cables Implementation Plan

> **Historical reference — classified 2026-09-18.** Original proposal, review or session evidence is preserved below. Statuses, code snippets, test counts and pending decisions describe that document’s original context, not the current release. Use the [current architecture](../../dev/ARCHITECTURE.md) and [documentation index](../../README.md) for present behavior. This document does not authorize new implementation.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click Auto-wire button that generates power and network cables for the current rack layout.

**Architecture:** A new pure utility (`src/utils/autoWire.ts`) proposes cables using existing port-selection helpers; the store gets a bulk `addCables` action for a single undo step; the Cable Planner panel gets an Auto-wire button.

**Tech Stack:** TypeScript, Zustand, Vitest, React + Tailwind.

---

## Files

- **Create:** `src/utils/autoWire.ts`
- **Create:** `src/utils/autoWire.test.ts`
- **Modify:** `src/store/rackStore.ts`
- **Modify:** `src/store/rackStore.test.ts`
- **Modify:** `src/components/CablePlanner.tsx`

---

## Task 1: Create `src/utils/autoWire.ts`

**Files:**
- Create: `src/utils/autoWire.ts`

- [ ] **Step 1: Write the utility**

```ts
import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS } from './cableColors';
import { autoResolveCable, inferCableType, portTypeForCableType } from './portSelection';

export interface AutoWireOptions {
  connectPower?: boolean;
  connectNetwork?: boolean;
}

export interface AutoWireResult {
  cables: Omit<CableRoute, 'id'>[];
  created: number;
  skipped: number;
}

const INFRA_CATEGORIES = new Set([
  'pdu',
  'ups',
  'switch',
  'patch-panel',
  'cable-management',
  'blank'
]);

function isInfrastructure(device: PlacedDevice): boolean {
  return INFRA_CATEGORIES.has(device.category);
}

function deviceCenterU(device: PlacedDevice): number {
  return device.positionU + (device.sizeU - 1) / 2;
}

function nearestDevice(
  source: PlacedDevice,
  candidates: PlacedDevice[]
): PlacedDevice | null {
  if (candidates.length === 0) return null;
  const sourceU = deviceCenterU(source);
  return candidates.reduce((best, current) => {
    const bestDist = Math.abs(deviceCenterU(best) - sourceU);
    const currentDist = Math.abs(deviceCenterU(current) - sourceU);
    return currentDist < bestDist ? current : best;
  });
}

function hasExistingCable(
  layout: RackLayout,
  fromId: string,
  toId: string,
  cableType: string
): boolean {
  return layout.cables.some(
    (c) =>
      ((c.fromDeviceId === fromId && c.toDeviceId === toId) ||
        (c.fromDeviceId === toId && c.toDeviceId === fromId)) &&
      c.type === cableType
  );
}

export function autoWireLayout(
  layout: RackLayout,
  options: AutoWireOptions = {}
): AutoWireResult {
  const { connectPower = true, connectNetwork = true } = options;
  const cables: Omit<CableRoute, 'id'>[] = [];
  let skipped = 0;

  const pdus = layout.devices.filter((d) => d.category === 'pdu');
  const switches = layout.devices.filter((d) => d.category === 'switch');
  const patchPanels = layout.devices.filter((d) => d.category === 'patch-panel');

  const endpoints = layout.devices.filter((d) => !isInfrastructure(d));

  for (const endpoint of endpoints) {
    if (connectPower && pdus.length > 0 && (endpoint.ports?.power ?? 0) > 0) {
      const target = nearestDevice(endpoint, pdus);
      if (target) {
        if (hasExistingCable(layout, endpoint.id, target.id, 'power')) {
          skipped++;
        } else {
          const resolved = autoResolveCable(endpoint, target, layout);
          if (resolved && resolved.cableType === 'power') {
            cables.push({
              fromDeviceId: endpoint.id,
              fromPort: resolved.fromPort,
              toDeviceId: target.id,
              toPort: resolved.toPort,
              type: resolved.cableType,
              color: resolved.color
            });
          } else {
            skipped++;
          }
        }
      }
    }

    if (connectNetwork && (endpoint.ports?.ethernet ?? 0) + (endpoint.ports?.fiber ?? 0) > 0) {
      const targets = switches.length > 0 ? switches : patchPanels;
      if (targets.length > 0) {
        const target = nearestDevice(endpoint, targets);
        if (target) {
          const cableType = inferCableType(endpoint, target);
          if (!cableType || hasExistingCable(layout, endpoint.id, target.id, cableType)) {
            skipped++;
          } else {
            const resolved = autoResolveCable(endpoint, target, layout);
            if (resolved) {
              cables.push({
                fromDeviceId: endpoint.id,
                fromPort: resolved.fromPort,
                toDeviceId: target.id,
                toPort: resolved.toPort,
                type: resolved.cableType,
                color: resolved.color
              });
            } else {
              skipped++;
            }
          }
        }
      }
    }
  }

  if (connectNetwork && patchPanels.length > 0) {
    for (const sw of switches) {
      if ((sw.ports?.ethernet ?? 0) + (sw.ports?.fiber ?? 0) === 0) continue;
      const target = nearestDevice(sw, patchPanels);
      if (!target) continue;
      const cableType = inferCableType(sw, target);
      if (!cableType || hasExistingCable(layout, sw.id, target.id, cableType)) {
        skipped++;
        continue;
      }
      const resolved = autoResolveCable(sw, target, layout);
      if (resolved) {
        cables.push({
          fromDeviceId: sw.id,
          fromPort: resolved.fromPort,
          toDeviceId: target.id,
          toPort: resolved.toPort,
          type: resolved.cableType,
          color: resolved.color
        });
      } else {
        skipped++;
      }
    }
  }

  return { cables, created: cables.length, skipped };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/autoWire.ts
git commit -m "feat: add autoWireLayout utility"
```

---

## Task 2: Add unit tests for `autoWireLayout`

**Files:**
- Create: `src/utils/autoWire.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { autoWireLayout } from './autoWire';

function layoutWith(devices: PlacedDevice[]): RackLayout {
  return {
    id: 'layout-1',
    name: 'Test',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1000,
    viewSide: 'front',
    devices,
    cables: [],
    updatedAt: new Date().toISOString()
  };
}

function makeDevice(id: string, category: string, positionU: number, ports: Record<string, number>): PlacedDevice {
  return {
    id,
    category: category as any,
    name: id,
    positionU,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 5,
    powerW: 50,
    heatLevel: 2,
    ports,
    color: '#ccc'
  } as PlacedDevice;
}

describe('autoWireLayout', () => {
  it('wires a server to a PDU and a switch', () => {
    const pdu = makeDevice('pdu', 'pdu', 1, { power: 8 });
    const sw = makeDevice('sw', 'switch', 6, { ethernet: 8 });
    const server = makeDevice('srv', 'server', 8, { power: 1, ethernet: 2 });
    const layout = layoutWith([pdu, sw, server]);
    const result = autoWireLayout(layout);
    expect(result.created).toBe(2);
    expect(result.cables.some((c) => c.type === 'power')).toBe(true);
    expect(result.cables.some((c) => c.type === 'ethernet')).toBe(true);
  });

  it('wires a switch to a patch panel', () => {
    const sw = makeDevice('sw', 'switch', 2, { ethernet: 8 });
    const patch = makeDevice('patch', 'patch-panel', 6, { ethernet: 24 });
    const layout = layoutWith([sw, patch]);
    const result = autoWireLayout(layout);
    expect(result.created).toBe(1);
    expect(result.cables[0].type).toBe('patch');
  });

  it('skips duplicate cables', () => {
    const pdu = makeDevice('pdu', 'pdu', 1, { power: 8 });
    const server = makeDevice('srv', 'server', 8, { power: 1 });
    const layout = layoutWith([pdu, server]);
    layout.cables = [{
      id: 'existing',
      fromDeviceId: server.id,
      toDeviceId: pdu.id,
      type: 'power',
      color: '#fb923c'
    }];
    const result = autoWireLayout(layout);
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('does nothing when no infrastructure is present', () => {
    const server = makeDevice('srv', 'server', 8, { power: 1, ethernet: 2 });
    const layout = layoutWith([server]);
    const result = autoWireLayout(layout);
    expect(result.created).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/utils/autoWire.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/autoWire.test.ts
git commit -m "test: autoWireLayout coverage"
```

---

## Task 3: Add `addCables` bulk action to `rackStore.ts`

**Files:**
- Modify: `src/store/rackStore.ts`

- [ ] **Step 1: Add `addCables` to `RackState` interface**

Insert after `addCable: (route: Omit<CableRoute, 'id'>) => void;`:

```ts
addCables: (routes: Omit<CableRoute, 'id'>[]) => void;
```

- [ ] **Step 2: Implement `addCables` in the store object**

Insert after the `addCable` implementation:

```ts
addCables: (routes) => {
  const layout = get().layout;
  const newCables: CableRoute[] = [];
  const changedIds = new Set<string>();

  for (const route of routes) {
    if (route.fromDeviceId === route.toDeviceId) continue;
    const from = layout.devices.find((d) => d.id === route.fromDeviceId);
    const to = layout.devices.find((d) => d.id === route.toDeviceId);
    if (!from || !to) continue;
    const cableId = newId('cable');
    const cable: CableRoute = {
      ...route,
      id: cableId,
      nodes: calculateCableNodes({ ...route, id: cableId }, layout)
    };
    newCables.push(cable);
    changedIds.add(route.fromDeviceId);
    changedIds.add(route.toDeviceId);
  }

  if (newCables.length === 0) {
    set({ statusMessage: 'Auto-wire found no new cables to add.' });
    return;
  }

  set({
    layout: touch({ ...layout, cables: [...layout.cables, ...newCables] }, changedIds),
    selectedCableId: newCables[newCables.length - 1].id,
    selectedDeviceId: null,
    statusMessage: `Auto-wired ${newCables.length} cable route(s).`
  });
},
```

- [ ] **Step 3: Commit**

```bash
git add src/store/rackStore.ts
git commit -m "feat: add addCables bulk store action"
```

---

## Task 4: Test `addCables` in `rackStore.test.ts`

**Files:**
- Modify: `src/store/rackStore.test.ts`

- [ ] **Step 1: Add a test**

Add a new test case (use the existing store test patterns):

```ts
it('addCables creates multiple cables and undoes in one step', () => {
  const { result } = renderHook(() => useRackStore());
  act(() => {
    result.current.newLayout('19in', 12);
    result.current.addDeviceFromTemplate('some-pdu-template', 1);
    result.current.addDeviceFromTemplate('some-server-template', 8);
  });
  const pduId = result.current.layout.devices.find((d) => d.category === 'pdu')!.id;
  const serverId = result.current.layout.devices.find((d) => d.category === 'server')!.id;

  act(() => {
    result.current.addCables([
      {
        fromDeviceId: serverId,
        toDeviceId: pduId,
        type: 'power',
        color: '#fb923c'
      }
    ]);
  });

  expect(result.current.layout.cables.length).toBe(1);
  expect(result.current.canUndo()).toBe(true);

  act(() => result.current.undo());
  expect(result.current.layout.cables.length).toBe(0);
});
```

Adapt template IDs to real IDs from `deviceCatalog.ts`.

- [ ] **Step 2: Run store tests**

```bash
npx vitest run src/store/rackStore.test.ts
```

Expected: tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/store/rackStore.test.ts
git commit -m "test: addCables bulk action"
```

---

## Task 5: Add Auto-wire button to `CablePlanner.tsx`

**Files:**
- Modify: `src/components/CablePlanner.tsx`

- [ ] **Step 1: Import `autoWireLayout` and add button**

Add import:

```ts
import { autoWireLayout } from '../utils/autoWire';
```

In the component, read the new action:

```ts
const addCables = useRackStore((state) => state.addCables);
```

Add an `handleAutoWire` function inside `CablePlanner`:

```ts
function handleAutoWire() {
  const result = autoWireLayout(layout);
  if (result.cables.length === 0) {
    setStatusMessage(`Auto-wire: no new routes created (${result.skipped} skipped).`);
    return;
  }
  addCables(result.cables);
}
```

Add the button next to the existing **Add cable** button in the Cable flow card:

```tsx
<button
  type="button"
  onClick={handleAutoWire}
  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-cyan-500 bg-white/80 px-3 text-sm font-semibold text-cyan-600 shadow-sm hover:bg-cyan-50 dark:border-cyan-400 dark:bg-slate-950/70 dark:text-cyan-300 dark:hover:bg-slate-900"
>
  <Cable size={15} />
  Auto-wire
</button>
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/CablePlanner.tsx
git commit -m "feat: add Auto-wire button to CablePlanner"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run build and bundle check**

```bash
npm run build
node scripts/check-bundle-size.mjs
```

Expected: build succeeds and initial chunk is under the 420 KB budget.

- [ ] **Step 2: Run smoke tests (optional)**

```bash
npx playwright test tests/smoke/app.spec.ts
```

Expected: smoke tests pass.

- [ ] **Step 3: Commit any final fixes**

---

## Self-Review Checklist

- [ ] Spec coverage: every success criterion has a corresponding task.
- [ ] No placeholders: every step includes concrete code or commands.
- [ ] Type consistency: `CableRoute`, `Omit<CableRoute, 'id'>`, and store action signatures match.

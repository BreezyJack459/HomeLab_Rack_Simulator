# Auto-wire Cables — Design Spec

> **Historical reference — classified 2026-09-18.** Original proposal, review or session evidence is preserved below. Statuses, code snippets, test counts and pending decisions describe that document’s original context, not the current release. Use the [current architecture](../../dev/ARCHITECTURE.md) and [documentation index](../../README.md) for present behavior. This document does not authorize new implementation.

## Goal
Add a one-click **Auto-wire** button to the Cable Planner that generates sensible cable routes for the current rack layout.

## User Story
As a homelab planner, I want the app to automatically connect my devices with one click so I don’t have to manually create every power and network cable.

## Scope
- One-click action from the Cable Planner panel.
- Creates power and network cables only.
- Uses existing ports, cable types, and routing logic.
- Leaves manually created cables untouched.
- Undoable as a single history step.

## Out of Scope
- USB/HDMI/ATX/Coax auto-wiring (too device-specific).
- Inter-rack auto-wiring.
- Topology optimization beyond nearest-infrastructure heuristic.
- User-configurable auto-wire rules (future iteration).

## Assumptions
- A typical rack has infrastructure devices (PDU, switch, patch panel) and endpoint devices (server, NAS, mini-PC, SBC, access point, IP-KVM, router, firewall, modem).
- Endpoint devices should connect to the nearest suitable infrastructure device.
- Existing cables of the same type between the same pair should not be duplicated.
- The lowest-numbered free port on each end is the best default choice.

## Design

### 1. New utility: `src/utils/autoWire.ts`

```ts
export interface AutoWireOptions {
  connectPower?: boolean;   // default true
  connectNetwork?: boolean; // default true
}

export interface AutoWireResult {
  cables: CableRoute[];
  created: number;
  skipped: number;
  reasons: string[];
}

export function autoWireLayout(
  layout: RackLayout,
  options?: AutoWireOptions
): AutoWireResult;
```

Behavior:
1. Build helper maps of device categories.
2. Identify infrastructure candidates:
   - Power targets: PDU devices.
   - Network targets: switch devices first; if none, patch-panel devices.
3. For each endpoint device (excluding `blank`, `pdu`, `ups`, `switch`, `patch-panel`, `cable-management`):
   - If `connectPower` is true and the device has power ports, find the nearest PDU by U distance. If both ends have a free power port and no power cable already exists between them, create a `power` cable.
   - If `connectNetwork` is true and the device has ethernet/fiber ports, find the nearest switch by U distance. If no switch exists, fall back to the nearest patch panel. Create `ethernet`, `patch`, or `structured` cable using `inferCableType` and `autoResolveCable`.
4. For each switch:
   - If a patch panel exists and the switch has free ethernet/fiber ports, create patch cables to the nearest patch panel until one side runs out of ports.
5. Skip any pair that already has a cable of the inferred type.
6. Return the list of new `CableRoute` objects plus counts.

Nearest-neighbor logic uses vertical U distance between device centers.

### 2. Store action: `addCables(cables[])`

Add to `RackState` and `useRackStore`:

```ts
addCables: (routes: Omit<CableRoute, 'id'>[]) => void;
```

Implementation:
- Validate each route (different devices, ports exist, ports are still free).
- Generate IDs and compute nodes for each cable.
- Append all valid cables to `layout.cables` in one update.
- Call `touch(layout, changedDeviceIds)` once so cable nodes are recomputed and history records a single undo step.
- Set `statusMessage` summarizing how many cables were added and how many were rejected.

### 3. UI change: `CablePlanner.tsx`

Add an **Auto-wire** button next to the existing **Add cable** button. On click:
- Call `autoWireLayout(layout)`.
- Call `addCables(result.cables)`.
- If no new cables are created, show a status message explaining why (e.g., “No free ports left to auto-wire.”).

### 4. Tests

- `src/utils/autoWire.test.ts`: unit tests covering:
  - Power endpoint → PDU.
  - Network endpoint → switch.
  - Switch → patch panel.
  - Duplicate skip.
  - No suitable target.
- `src/store/rackStore.test.ts`: verify `addCables` adds multiple cables and is undone in one step.

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Creates unexpected mesh of cables | Restrict to endpoint-to-infrastructure; skip duplicates. |
| Runs out of free ports | Status message reports how many were skipped. |
| Violates patch-discipline validation | Use `inferCableType` / `autoResolveCable`, which already produce the correct cable type for patch-panel ↔ switch pairs. |
| One cable failure prevents bulk add | `addCables` validates each route individually and only appends valid ones. |

## Success Criteria
- Clicking **Auto-wire** creates power cables from endpoints to PDUs and network cables from endpoints to switches/patch panels.
- No duplicate cables of the same type are created between the same pair.
- The action is undone with a single undo.
- Existing tests continue to pass.

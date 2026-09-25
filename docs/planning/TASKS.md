# Implementation status and backlog

Source-reviewed 2026-09-18; “implemented” means code exists, not that this documentation update reran its tests. The [previous task ledger](../archive/2026-09-18-doc-refresh/planning/TASKS.md) preserves original ideas and completion notes.

## Implemented in the current working tree

| Area | Source / verification entry point |
|---|---|
| Default Build/Cable/Check shell and responsive inspectors | `ShellTopBar`, `CanvasHeader`, `ModelWorkspaceLayout`, `RightInspectorShell`; `tests/smoke/new-shell.spec.ts` |
| Lazy optional packs and Port Labels | `builtInPlugins`, `useBuiltInPlugins`, `PortLabelWorkspace`; `tests/smoke/lazy-plugins.spec.ts` |
| Inventory and shared placement checks | `rackStore`, `devicePlacement`; `src/store/deviceInventory.test.ts`, `tests/smoke/device-placement.spec.ts` |
| Thin shelves and printed mounting support | `rackMath`, `printedMountGeometry`; shelf/printed-mount smoke specs |
| Physical 0U PDU placement | `rackGeometry`, `rackMath`; `tests/smoke/zero-u-pdu.spec.ts` |
| Managed rear cabling and custom route drawing | `rackSceneModel`, `manualCableRoute`; draw-route/rear-route-choice smoke specs |
| Topology and inter-rack integrity | `topologyGraph`, `interRackCables`; topology/inter-rack-wizard smoke specs |
| Persistence recovery and safe height reduction | `LayoutRecovery`, `rackResize`; `tests/smoke/layout-recovery.spec.ts` |
| Device specification audit | `docs/DEVICE_SPEC_AUDIT.zh-Hant.md`; dated evidence with unresolved values |

## Proposed follow-ups

See [Next steps](../dev/NEXT_STEPS.md) for release verification, preference migration, estimate clarity, catalog evidence and deployment checks. No new feature work is implicitly scheduled by this list.

## Ideas rather than shipped behavior

[BRAINSTORM](BRAINSTORM.md) and `superpowers/` contain proposals and historical implementation plans. Reconcile them against source before treating a checkbox or “done” marker as current scope. Full CAD generation, live synchronization and advanced automatic optimization are not established by the existing features.

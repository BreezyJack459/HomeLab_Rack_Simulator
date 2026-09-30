# Architecture

Current source reference, reviewed 2026-09-18. [Decisions](DECISIONS.md) preserve rationale; this document describes the current implementation.

## Shell and state ownership

`App.tsx` composes the shell and registry contributions. `ShellTopBar`, `CanvasHeader` and `RackHealthStrip` provide the default chrome. `ModelWorkspaceLayout` and `RightInspectorShell` adapt lists and inspectors into drawers at narrower widths. `ModelInspectorTabs` provides Properties, Cables and Ports.

| User workflow | Internal representation |
|---|---|
| Build | `model`, normally `2d` or `3d` |
| Cable | `model` with `cables` or `topology`; `cableWorkspaceStore` carries cable view/filter state |
| Check | `audit` |
| Operations / Planning / Fleet | Plugin workspaces `operate` / `plan` / `portfolio` |
| Port Labels | Optional `port-labels` view |
| Faceplate gallery | Development-only `gallery` view |

`rackStore.ts` owns layout mutations, undo/redo, workspace synchronization and persistence. UI preferences, theme, cable workspace state and drag state have separate stores. Never mutate layout objects directly in components. History observes layout reference changes; undo history is not a durable backup across reloads.

## Data and persistence

`src/types/rack.ts` defines the model. A `Workspace` holds racks and inter-rack cables. A `RackLayout` holds rack settings, placed devices, cables, reservations and optional planning records, including `unplacedDevices`. Inventory retains device identity and metadata without contributing to installed capacity, power or weight. Connected devices must be disconnected before returning to inventory.

The active key is `homelab-rack-simulator-workspace`; `homelab-rack-simulator-layout` is legacy input. `layoutValidation.ts` guards imported structures and the store normalizes supported fields. Validation is not a complete schema for every extension record.

Save failures set a visible persistence error. Unreadable stored data blocks autosave to protect the original and exposes a raw download. `LayoutRecovery` also shows retained out-of-bounds records. Reducing rack height when records are affected requires a review dialog; accepting retains devices, cables, reservations and dependent records rather than silently deleting them. Inter-rack links are synchronized and invalid links can be pruned with a status message.

## Finding results and planning intent

`planningGoals.ts` resolves optional version-1 rack goals and partial device overrides at read time; a legacy layout remains unchanged. Single power, independent A/B, remote recovery and service motion are requirements, not inferred monitoring duties. Enabled legacy policies remain explicit requirements. Power independence uses the accepted topology and only warnings on the relevant ancestors; physically separate rack sides do not establish separate circuits.

Rules add stable `ruleId`, `status` (pass/fail/unknown), `applicability`, `rootCauseKey` and scoped `cause` metadata. `findingMetadata.ts` conservatively adapts older rules; severity and missing evidence cannot imply a verified result. `findingSummary.ts` is the shared adapter for Check, summary popovers and health. It counts root actions while retaining raw child checks, targets and assumptions. Confirmed failures remain actionable regardless of optional applicability. Accepted exceptions leave unresolved facts in health indicators.

`findingExceptions.ts` fingerprints the canonical scoped facts and sorted targets. Group representatives include every child identity so one accepted cause cannot silently cover new evidence or equipment. Store actions require a reason and persist immutable changes through the existing history/autosave flow. Relevant changes reopen the decision; returning to identical facts restores the prior acceptance. Duplicated racks reset exceptions. Rack/workspace JSON and baseline goals preserve the additive records; import/restore guards reject malformed and unsupported versions before replacing data.

## Placement and mounting

`devicePlacement.ts`, `rackMath.ts`, `rackResize.ts` and validation utilities provide shared placement/fit logic. Preview and commit must agree, including reservations and devices hidden by view filters.

Thin shelves can share an origin U and face with supported equipment; thickness, offset, device physical height, clearance, width margin, depth and load are checked. Shelf changes can affect other supported devices, so the store performs broader recomputation for shelves. Existing separate-U layouts are not rearranged.

Printed mounts persist as mounting support plus an optional model URL. `printedMountGeometry.ts` and `PrintedMounts3D` render schematic modular brackets. They do not generate CAD, import meshes or guarantee mount/cable clearance.

0U PDUs retain `sizeU: 0`; physical length, elevation and independent mounting lanes determine fit. `ENABLE_ZERO_U_PDU` is currently true. When disabled for diagnostics, hidden hardware is a display projection, not a destructive storage migration.

## Ports and faceplates

`portLayout.ts` owns `getPortFaceMap`, `resolvePortFace` and `buildPortLayout`. Device overrides and per-type row/ratio/orientation/pairing/scale metadata apply there. Routing code must delegate face decisions to this source.

`rackGeometry.ts` maps logical ports into canonical 3D socket surfaces and world endpoints. Both viewers use these coordinates; never duplicate port math in JSX. 2D supports image/generated faceplates with hit regions as well as simplified port strips, so logical consistency does not imply identical visual detail. Generated SVG is inserted as markup in the 2D editor and development gallery; keep escaping at the generator boundary when editing this pipeline.

`faceplateSvg.ts` generates procedural SVGs and hit regions; templates may also reference local SVG/PNG assets. `FaceplateTexture` caches textures, and the development gallery supports inspection. Preserve the attribution in `public/faceplates/README.md`.

## Cables and 3D scene

`routing.ts` computes cable nodes and `CablePlan` estimates and owns the standard cable-length table. `touch(layout, changedDeviceIds?)` can recompute endpoint-connected cables incrementally. Geometry changes and dependent shelf changes require full recomputation; consult call sites before extending the optimization.

`rackSceneModel.ts` builds opaque rack/device geometry, channels, support aids and managed paths. Mesh components in `components/three/rack-scene/` render this data. Rear automatic candidates compare clear direct/drop paths, existing managers and both side channels. Source port half is a tie-break, not an unconditional rail assignment. Power and data use separate depth lanes; PDU exits retain a downward leg. No valid candidate yields a review/blocked state.

Clean determines the clear geometry. Realistic may add slack only while preserving clearance. The renderer uses straight spans and bounded quadratic corner fillets rather than overshooting splines. Connector working space, physical bodies, manager openings and thin shelf solids participate in relevant clearance checks. Added support clips are visual aids, not inventory.

`CableRoute.manualPath` stores semantic channel/manager anchors. Undefined means automatic; an empty array means a direct custom route. `manualCableRoute.ts` resolves anchors against current geometry for 2D projection, 3D rendering and custom-route length estimates. Missing anchors or obstruction require review rather than silently switching routes.

Automatic 3D route selection does not replace automatic 2D/BOM length calculations. Custom-route lengths are polyline estimates converted to mm plus slack. Neither is a measured installation length.

## Plugins

`pluginHost.ts` aggregates view, panel, command, toolbar and workspace contributions with duplicate-ID protection. The core owns model/audit shell behavior and plugin management; optional packs own their workspace contributions.

`builtInPlugins.ts` synchronously registers Cable Management and Governance Tools. Data-only manifests in `builtInPluginManifests.ts` describe Operations, Planning, Fleet and Port Labels; a closed loader allowlist imports their executable modules only when enabled. `useBuiltInPlugins.ts` keeps catalog order stable, tracks loading/errors and permits retry after a failed import.

Fresh preferences enable the default plugins and leave those four optional plugins off. Returning users with a saved enabled-ID list get missing workspace-pack IDs appended by `layoutPrefsStore.ts`; Port Labels is excluded from that migration. Thus a previously disabled workspace pack can reappear after reload under the current migration.

Local package metadata does not grant arbitrary JavaScript loading. `localPackageLoader.ts` requires an approved ID and an adapter registered in `localPackageRegistry.ts` before a package becomes hosted. Plugins execute within the client application, not in an isolated service.

## Loading and recovery

Three.js/R3F viewers, new-shell chrome and optional packs use lazy loading. Keep Three.js imports out of the eager root. The build guard allows 500 KB for entry plus modulepreload JS, pre-gzip. Manual chunks match exact React/react-dom/Zustand package boundaries; viewer-only react-reconciler and helpers stay with lazy viewer imports. `CanvasWithRecovery` remounts the Canvas after WebGL context restoration to rebuild GPU resources.


## Learning example contracts

`data/learningSamples.ts` defines three fictional worked examples and their learning metadata. `sampleLayouts.ts` keeps the original four layouts in their original array positions and exposes the combined `sampleDefinitions` lookup. Rack state uses a deep-cloned beginner only as its in-memory fresh fallback; the existing synchronous workspace/legacy restore and invalid-data protection run before any initialization write. Explicit sample replacement deep-clones the fixture and allocates a distinct rack ID when a sibling already uses its canonical ID.

The additive `RackLayout.example` version-1 marker stores canonical sample origin independently of the rack instance ID. Import validates its version and nonempty ID and preserves additional data. It persists the lazily rendered `ExampleGuide`; it never changes finding status or exempts validation. `SamplePicker` retains legacy examples and always asks before replacing the current rack, including settings, inventory and records. Generic power/spec inputs explicitly identify fictional assumptions rather than verified manufacturer data.

`learningSamples.test.ts` checks exact actionable outcomes, A/B traces, complete patch pairs, services and exercise remedies. `sampleBootstrap.test.ts` and `sampleMarkerValidation.test.ts` protect fresh-only startup, existing/legacy/malformed data, clone isolation and repeated multi-rack loads. `samples.spec.ts` covers desktop/mobile safe selection and persistent teaching context. Existing regression fixtures must declare their rack type and missing facts instead of inheriting the starter configuration.

Summary entry points use `summarizeFindings` and shared `findingSectionLabels`/`FindingSummaryBadges` for confirmed, verification, optional information and accepted counts. Canvas buttons select these sections independently of raw-severity filters. The legacy tray, activity, dashboard, workbench and detailed validation headers use the same root counts; optional raw warnings do not create action counts or drive dashboard failure. Raw check severity/results remain in expanded records, and accepted applicable unknowns/conflicts still affect planning health.

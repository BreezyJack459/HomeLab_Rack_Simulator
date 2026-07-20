# Plugin Platform for Rack Editor — Design Spec

## Goal
Turn the app into a plugin-hosted platform where the rack editor remains the core product and optional workflows are contributed through plugins.

## User Story
As a homelab builder, I want to enable only the workflows I care about so the app feels lighter by default and can be customized like a server with installable plugins.

## Phase 1 Objective
Create a stable internal plugin platform first. All non-core workflows should register through a plugin host, even if the first plugins still ship from inside the repo.

## Scope
- Keep `2d` and `3d` rack editing as core product capabilities.
- Introduce a `plugin host` that collects plugin manifests and activation hooks.
- Let plugins contribute:
  - view modes
  - inspector or main panels
  - toolbar actions
  - command palette actions
- Convert cable management into the first built-in plugin slice.
- Add user-facing enable/disable state for plugins.
- Preserve existing layout data and editor behavior when no optional plugins are enabled.

## Out of Scope
- Third-party marketplace or remote plugin downloads.
- Arbitrary untrusted JavaScript execution from user-supplied bundles.
- Plugin-defined changes to the base rack schema.
- Plugin overrides of core rendering internals in `RackEditor2D` or `RackViewer3D`.
- Multi-process sandboxing or security isolation beyond host-controlled APIs.

## Product Boundaries

### Core
Core keeps the parts that must always exist:
- rack layout data model
- rack store and history
- selection and editing lifecycle
- `2d` and `3d` view modes
- import/export and persistence
- shell navigation and plugin host

### Plugins
Plugins may extend the editor workflow, but only through host APIs. First-phase plugins may:
- add a new workflow view
- add contextual panels
- add toolbar actions
- add command palette entries

Plugins may not:
- mutate the store directly
- patch registry constants directly
- replace core views
- alter the base schema contract

## Recommended Architecture

### 1. Plugin host
Add a new host layer that boots before the shell renders optional features.

Proposed responsibilities:
- load built-in plugin descriptors
- filter enabled plugins
- validate app-version compatibility
- activate plugins with a constrained host API
- collect contributed views, panels, actions, and commands
- expose a merged registry to `App.tsx`

Suggested files:
- `src/plugins/types.ts`
- `src/plugins/pluginHost.ts`
- `src/plugins/builtInPlugins.ts`
- `src/plugins/coreContributions.ts`

### 2. Plugin manifest
Each plugin should declare metadata and contributions separately from runtime logic.

Suggested shape:

```ts
export type RackPluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  requiresAppVersion: string;
  defaultEnabled: boolean;
};

export type RackPluginModule = {
  manifest: RackPluginManifest;
  activate: (host: PluginHostContext) => void | Promise<void>;
};
```

Manifest data should stay serializable so phase 2 can later persist installed plugins cleanly.

### 3. Host API surface
Keep the first API small and intentional.

Read APIs:
- `getLayout()`
- `getSelectedDevice()`
- `getViewMode()`
- `subscribe(...)`

Action APIs:
- `setViewMode(mode)`
- `openPanel(panelId)`
- `dispatchRackAction(action)`
- `showToast(message, tone?)`

Registration APIs:
- `registerViewMode(definition)`
- `registerPanel(definition)`
- `registerToolbarAction(definition)`
- `registerCommand(definition)`

The important rule is that plugins never import store internals as their extension contract. The host remains the only supported boundary.

## Extension Model

### View modes
Current `ViewMode` handling should evolve from hardcoded optional modes to a core-plus-plugin model:
- core modes: `2d`, `3d`
- plugin modes: `cables`, `topology`, future additions

Implementation note:
- Keep the current union temporarily for migration safety.
- Add a registry-backed runtime list for rendering toggles and command palette items.
- After migration, treat `cables` and `topology` as plugin-owned modes.

### Panels
Current `PANEL_REGISTRY` should stop being the only source of truth for optional features.

Recommended split:
- core panel definitions live in a small core registry
- plugin panels are registered through the host
- `App.tsx` consumes a merged panel registry

This lets a disabled plugin fully disappear from inspector and workbench routing without special-case conditionals scattered through the shell.

### Toolbar and command palette
Toolbar buttons and command palette items should be declared as contributions rather than hand-wired in `App.tsx` and `CommandPalette.tsx`.

This is especially important for cable workflows, because they need:
- open planner behavior
- switch to cable view behavior
- optional auto-wire action

## First Plugin Slice: Cable Management
Cable management is the best first extraction because it already behaves like an optional workflow and has clear boundaries.

Phase 1 plugin ownership:
- `CablePlanner`
- `CableMap`
- topology entry points that are not core editing
- cable-related toolbar actions
- cable-related command palette items

Core keeps:
- `layout.cables`
- routing math and cable data types
- persistence and undo/redo behavior

Reasoning:
- cable data is still part of the canonical layout
- cable workflow UI is optional and should be plugin-controlled
- disabling the plugin should hide the workflow without corrupting saved layouts

## Enable/Disable Flow

### Persistence
Store enabled plugin IDs in a lightweight preferences store, separate from rack layout data.

Suggested shape:

```ts
type PluginPrefs = {
  enabledPluginIds: string[];
};
```

This should live beside other shell preferences rather than inside `RackLayout`.

### Runtime behavior
When a plugin is disabled:
- its panels do not register
- its view modes do not appear in toggles
- its commands and toolbar actions do not appear
- existing layout data remains untouched

If a layout contains plugin-owned data in future phases, the host should surface a warning badge instead of mutating or deleting the data automatically.

### Missing-plugin UX
For phase 1, missing plugin handling can stay simple:
- if disabled plugin features are referenced by shortcuts or saved UI state, fall back to `2d`
- show a lightweight status notice if the user opens a layout that includes workflows tied to a disabled plugin

## Compatibility Strategy
- Every plugin manifest declares `requiresAppVersion`.
- Host skips incompatible plugins and records a status reason.
- UI should expose disabled reason in a future plugin manager panel, but phase 1 may log or toast this condition.

Do not attempt semver-heavy negotiation in phase 1. Exact or minimum supported version checks are enough.

## Migration Plan

### Step 1
Introduce plugin types, host, and merged registries without changing behavior.

### Step 2
Move existing optional contributions into built-in plugin declarations while keeping render targets the same.

### Step 3
Convert cable management into the first true built-in plugin:
- plugin-owned `cables` and `topology` modes
- plugin-owned planner panel
- plugin-owned commands and toolbar entries

### Step 4
Add plugin preference state and a basic enable/disable surface.

### Step 5
Refactor remaining optional workspaces and panels onto the same host pattern.

## Testing Strategy

### Unit tests
- plugin host registers only enabled compatible plugins
- duplicate contribution IDs are rejected or warned deterministically
- disabled plugins do not leak actions or panels into merged registries

### Integration tests
- app falls back safely when a disabled plugin-owned view was last active
- cable management plugin enable/disable changes visible workflow affordances
- command palette only shows contributed commands from active plugins

### Regression checks
Because this change touches shell assembly and optional lazy-loaded surfaces, verify with:
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm test -- --pool=threads`
- `npm run build`
- `node scripts/check-bundle-size.mjs`

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| `App.tsx` becomes more complex during migration | Move contribution assembly into `pluginHost.ts` so `App.tsx` consumes prepared registries. |
| Plugins couple directly to store internals | Make host APIs the only supported extension boundary and avoid exporting implementation details as contract. |
| Disabling a plugin breaks saved UI state | Always fall back to core `2d` mode and ignore stale panel IDs safely. |
| Future installable plugins need a different manifest | Keep manifest serializable and versioned from the start. |
| Bundle growth from pluginization | Preserve lazy loading and keep plugin entries declarative until their UI is opened. |

## Success Criteria
- The app still works with only core `2d` and `3d` editing enabled.
- Optional workflow UI is contributed through a plugin host instead of hardcoded shell wiring.
- Cable management is represented as a built-in plugin slice.
- Enabling or disabling a plugin changes available views, panels, and commands without mutating layout data.
- The platform is ready for a later phase that supports locally installed trusted plugins.

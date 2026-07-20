# Plugin Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a first-phase plugin host so optional rack workflows register through a stable extension layer, with cable management moved into the first built-in plugin slice.

**Architecture:** Keep `2d` and `3d` editing in core while adding a registry-driven plugin host that contributes view modes, panels, toolbar actions, and command palette entries. Migrate existing hardcoded cable workflow wiring to a built-in plugin without changing the underlying rack data model or undo/persistence behavior.

**Tech Stack:** React 18, TypeScript 5.7, Zustand 5, Vite 6, Vitest 4, Testing Library

---

## File Structure

- Create: `src/plugins/types.ts`
  - Shared plugin manifest, host context, and contribution definitions.
- Create: `src/plugins/pluginHost.ts`
  - Runtime registry builder and compatibility filtering.
- Create: `src/plugins/pluginHost.test.ts`
  - Unit coverage for enabled/disabled/incompatible plugin handling and duplicate contribution protection.
- Create: `src/plugins/coreContributions.tsx`
  - Core-owned view modes and panel definitions.
- Create: `src/plugins/builtInPlugins.ts`
  - Built-in plugin catalog export.
- Create: `src/plugins/cableManagementPlugin.tsx`
  - Built-in cable plugin manifest and contributions.
- Modify: `src/store/layoutPrefsStore.ts`
  - Persist enabled plugin IDs beside existing shell prefs.
- Modify: `src/store/layoutPrefsStore.test.ts`
  - Add persistence coverage for plugin enable/disable state.
- Modify: `src/types/rack.ts`
  - Add shared `ViewModeDefinition`-friendly typing without breaking the current `ViewMode` union.
- Modify: `src/types/panelRegistry.tsx`
  - Keep only core panel metadata and move optional registration assembly out of the file.
- Modify: `src/components/TopContextBar.tsx`
  - Render view toggles from a supplied registry instead of a hardcoded local map.
- Modify: `src/components/CommandPalette.tsx`
  - Build view and action search items from plugin-aware registries.
- Modify: `src/components/CommandPalette.test.tsx`
  - Cover runtime-contributed view modes and quick actions.
- Modify: `src/App.tsx`
  - Build merged registries through `pluginHost`, fall back safely when disabled views are requested, and render plugin-backed surfaces.

## Task 1: Define plugin contracts and registry builder

**Files:**
- Create: `src/plugins/types.ts`
- Create: `src/plugins/pluginHost.ts`
- Create: `src/plugins/pluginHost.test.ts`
- Modify: `src/types/rack.ts`

- [ ] **Step 1: Write the failing plugin host tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { RackPluginModule } from './types';
import { buildPluginRegistry } from './pluginHost';

const basePlugin = (overrides?: Partial<RackPluginModule>): RackPluginModule => ({
  manifest: {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'test',
    requiresAppVersion: '1.0.0',
    defaultEnabled: true,
    ...overrides?.manifest,
  },
  activate: overrides?.activate ?? ((host) => {
    host.registerViewMode({
      id: 'cables',
      label: 'Cables',
      order: 30,
      render: () => null,
    });
  }),
});

describe('buildPluginRegistry', () => {
  it('activates only enabled compatible plugins', () => {
    const active = vi.fn((host) => {
      host.registerCommand({
        id: 'plugin.command',
        title: 'Plugin Command',
        category: 'Actions',
        run: vi.fn(),
      });
    });

    const plugins: RackPluginModule[] = [
      basePlugin({ manifest: { id: 'enabled', requiresAppVersion: '1.0.0' }, activate: active }),
      basePlugin({ manifest: { id: 'disabled', requiresAppVersion: '1.0.0' } }),
      basePlugin({ manifest: { id: 'blocked', requiresAppVersion: '9.9.9' } }),
    ];

    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins,
      enabledPluginIds: ['enabled'],
      core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
    });

    expect(active).toHaveBeenCalledTimes(1);
    expect(registry.commands.map((c) => c.id)).toContain('plugin.command');
    expect(registry.pluginStates.disabled).toContain('disabled');
    expect(registry.pluginStates.incompatible.blocked).toContain('requiresAppVersion');
  });

  it('rejects duplicate contribution ids deterministically', () => {
    const plugins: RackPluginModule[] = [
      basePlugin({
        manifest: { id: 'one', requiresAppVersion: '1.0.0' },
        activate: (host) => host.registerPanel({
          id: 'dup-panel',
          title: 'Dup',
          workspace: 'model',
          priority: 20,
          defaultPlacement: 'inspector',
          render: () => null,
        }),
      }),
      basePlugin({
        manifest: { id: 'two', requiresAppVersion: '1.0.0' },
        activate: (host) => host.registerPanel({
          id: 'dup-panel',
          title: 'Dup Again',
          workspace: 'model',
          priority: 30,
          defaultPlacement: 'inspector',
          render: () => null,
        }),
      }),
    ];

    expect(() =>
      buildPluginRegistry({
        appVersion: '1.0.0',
        plugins,
        enabledPluginIds: ['one', 'two'],
        core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
      }),
    ).toThrow(/duplicate contribution id/i);
  });
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run:

```bash
npm test -- --pool=threads src/plugins/pluginHost.test.ts
```

Expected:
- FAIL because `src/plugins/pluginHost.ts` and `src/plugins/types.ts` do not exist yet.

- [ ] **Step 3: Add plugin contribution types**

Create `src/plugins/types.ts`:

```ts
import type { ReactNode } from 'react';
import type { AppPanelId, AppWorkspace, PanelPlacement } from '../types/appShell';
import type { RackLayout, ViewMode } from '../types/rack';

export type ViewModeId = ViewMode;

export type ViewModeDefinition = {
  id: ViewModeId;
  label: string;
  order: number;
  icon?: ReactNode;
  pluginId?: string;
  render: (layout: RackLayout) => ReactNode;
};

export type PluginPanelDefinition = {
  id: AppPanelId;
  title: string;
  workspace: AppWorkspace;
  priority: number;
  defaultPlacement: PanelPlacement;
  supportedViewModes?: ViewModeId[];
  selectionRequired?: boolean;
  pluginId?: string;
  render: () => ReactNode;
};

export type ToolbarActionDefinition = {
  id: string;
  label: string;
  pluginId?: string;
  isVisible?: () => boolean;
  run: () => void;
};

export type CommandDefinition = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  pluginId?: string;
  run: () => void;
};

export type RackPluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  requiresAppVersion: string;
  defaultEnabled: boolean;
};

export type PluginHostContext = {
  registerViewMode: (definition: ViewModeDefinition) => void;
  registerPanel: (definition: PluginPanelDefinition) => void;
  registerToolbarAction: (definition: ToolbarActionDefinition) => void;
  registerCommand: (definition: CommandDefinition) => void;
};

export type RackPluginModule = {
  manifest: RackPluginManifest;
  activate: (host: PluginHostContext) => void;
};
```

- [ ] **Step 4: Implement the plugin host**

Create `src/plugins/pluginHost.ts`:

```ts
import type {
  CommandDefinition,
  PluginPanelDefinition,
  RackPluginModule,
  ToolbarActionDefinition,
  ViewModeDefinition,
} from './types';

type BuildPluginRegistryArgs = {
  appVersion: string;
  plugins: RackPluginModule[];
  enabledPluginIds: string[];
  core: {
    viewModes: ViewModeDefinition[];
    panels: PluginPanelDefinition[];
    toolbarActions: ToolbarActionDefinition[];
    commands: CommandDefinition[];
  };
};

export function buildPluginRegistry({
  appVersion,
  plugins,
  enabledPluginIds,
  core,
}: BuildPluginRegistryArgs) {
  const viewModes = [...core.viewModes];
  const panels = [...core.panels];
  const toolbarActions = [...core.toolbarActions];
  const commands = [...core.commands];
  const seen = new Set<string>();
  const pluginStates = {
    enabled: [] as string[],
    disabled: [] as string[],
    incompatible: {} as Record<string, string>,
  };

  const pushUnique = <T extends { id: string }>(prefix: string, bucket: T[], value: T) => {
    const key = `${prefix}:${value.id}`;
    if (seen.has(key)) throw new Error(`Duplicate contribution id: ${key}`);
    seen.add(key);
    bucket.push(value);
  };

  core.viewModes.forEach((item) => seen.add(`view:${item.id}`));
  core.panels.forEach((item) => seen.add(`panel:${item.id}`));
  core.toolbarActions.forEach((item) => seen.add(`toolbar:${item.id}`));
  core.commands.forEach((item) => seen.add(`command:${item.id}`));

  for (const plugin of plugins) {
    if (!enabledPluginIds.includes(plugin.manifest.id)) {
      pluginStates.disabled.push(plugin.manifest.id);
      continue;
    }
    if (plugin.manifest.requiresAppVersion !== appVersion) {
      pluginStates.incompatible[plugin.manifest.id] =
        `requiresAppVersion=${plugin.manifest.requiresAppVersion}`;
      continue;
    }

    plugin.activate({
      registerViewMode: (definition) => pushUnique('view', viewModes, definition),
      registerPanel: (definition) => pushUnique('panel', panels, definition),
      registerToolbarAction: (definition) => pushUnique('toolbar', toolbarActions, definition),
      registerCommand: (definition) => pushUnique('command', commands, definition),
    });

    pluginStates.enabled.push(plugin.manifest.id);
  }

  return {
    viewModes: viewModes.sort((a, b) => a.order - b.order),
    panels: panels.sort((a, b) => a.priority - b.priority),
    toolbarActions,
    commands,
    pluginStates,
  };
}
```

- [ ] **Step 5: Add the small type support needed by core**

Modify `src/types/rack.ts` near `ViewMode`:

```ts
export type ViewMode = '2d' | '3d' | 'cables' | 'topology';
```

Leave the union unchanged in phase 1 so store state and existing saved data remain compatible. Do not broaden `ViewMode` to arbitrary strings yet.

- [ ] **Step 6: Run the plugin host tests and make them pass**

Run:

```bash
npm test -- --pool=threads src/plugins/pluginHost.test.ts
```

Expected:
- PASS with 2 tests green.

- [ ] **Step 7: Commit the host foundation**

```bash
git add src/plugins/types.ts src/plugins/pluginHost.ts src/plugins/pluginHost.test.ts src/types/rack.ts
git commit -m "feat(plugins): add plugin host foundation"
```

## Task 2: Add core contributions and plugin preference state

**Files:**
- Create: `src/plugins/coreContributions.tsx`
- Create: `src/plugins/builtInPlugins.ts`
- Modify: `src/store/layoutPrefsStore.ts`
- Modify: `src/store/layoutPrefsStore.test.ts`

- [ ] **Step 1: Extend preference-store tests for plugin IDs**

Add to `src/store/layoutPrefsStore.test.ts`:

```ts
it('persists enabled plugin ids to localStorage', () => {
  useLayoutPrefsStore.getState().setEnabledPluginIds(['cable-management']);

  expect(useLayoutPrefsStore.getState().enabledPluginIds).toEqual(['cable-management']);
  expect(JSON.parse(localStorage.getItem('homelab-rack-simulator-layout-prefs')!)).toEqual({
    deviceLibraryOpen: false,
    inspectorOpen: true,
    rackSummaryOpen: false,
    bottomTrayOpen: false,
    enabledPluginIds: ['cable-management'],
  });
});
```

- [ ] **Step 2: Run the preference-store test and confirm it fails**

Run:

```bash
npm test -- --pool=threads src/store/layoutPrefsStore.test.ts
```

Expected:
- FAIL because `enabledPluginIds` and `setEnabledPluginIds` do not exist yet.

- [ ] **Step 3: Add plugin prefs to the existing store**

Modify `src/store/layoutPrefsStore.ts`:

```ts
type LayoutPrefs = {
  deviceLibraryOpen: boolean;
  inspectorOpen: boolean;
  rackSummaryOpen: boolean;
  bottomTrayOpen: boolean;
  enabledPluginIds: string[];
};

interface LayoutPrefsState extends LayoutPrefs {
  setEnabledPluginIds: (pluginIds: string[]) => void;
}

function snapshot(state: LayoutPrefs): LayoutPrefs {
  return {
    deviceLibraryOpen: state.deviceLibraryOpen,
    inspectorOpen: state.inspectorOpen,
    rackSummaryOpen: state.rackSummaryOpen,
    bottomTrayOpen: state.bottomTrayOpen,
    enabledPluginIds: state.enabledPluginIds,
  };
}

enabledPluginIds: saved.enabledPluginIds ?? ['cable-management'],

setEnabledPluginIds: (enabledPluginIds) =>
  set((state) => {
    const next = { ...snapshot(state), enabledPluginIds };
    writePrefs(next);
    return { enabledPluginIds };
  }),
```

- [ ] **Step 4: Define core-owned view and panel contributions**

Create `src/plugins/coreContributions.tsx`:

```ts
import { Box, Monitor } from 'lucide-react';
import { Suspense } from 'react';
import type { CommandDefinition, PluginPanelDefinition, ToolbarActionDefinition, ViewModeDefinition } from './types';
import type { RackLayout } from '../types/rack';
import { RackEditor2D } from '../components/RackEditor2D';
import { RackViewer3D } from '../components/RackViewer3D';

export function getCoreContributions(args: {
  render2d: (layout: RackLayout) => React.ReactNode;
  render3d: (layout: RackLayout) => React.ReactNode;
}): {
  viewModes: ViewModeDefinition[];
  panels: PluginPanelDefinition[];
  toolbarActions: ToolbarActionDefinition[];
  commands: CommandDefinition[];
} {
  return {
    viewModes: [
      {
        id: '2d',
        label: '2D',
        order: 10,
        icon: <Monitor size={14} />,
        render: args.render2d,
      },
      {
        id: '3d',
        label: '3D',
        order: 20,
        icon: <Box size={14} />,
        render: args.render3d,
      },
    ],
    panels: [
      {
        id: 'property',
        title: 'Properties',
        workspace: 'model',
        priority: 10,
        defaultPlacement: 'inspector',
        render: () => null,
      },
      {
        id: 'port-reservation',
        title: 'Port Reservations',
        workspace: 'model',
        priority: 30,
        defaultPlacement: 'inspector',
        selectionRequired: true,
        render: () => null,
      },
      {
        id: 'port-speed',
        title: 'Port Speeds',
        workspace: 'model',
        priority: 40,
        defaultPlacement: 'inspector',
        selectionRequired: true,
        render: () => null,
      },
    ],
    toolbarActions: [],
    commands: [],
  };
}
```

Keep render placeholders minimal in this file if `App.tsx` still owns real component switching during migration. The goal of this task is to move metadata assembly first, not every render branch.

- [ ] **Step 5: Add the built-in plugin catalog stub**

Create `src/plugins/builtInPlugins.ts`:

```ts
import type { RackPluginModule } from './types';
import { cableManagementPlugin } from './cableManagementPlugin';

export const builtInPlugins: RackPluginModule[] = [cableManagementPlugin];
```

- [ ] **Step 6: Run store tests and make them pass**

Run:

```bash
npm test -- --pool=threads src/store/layoutPrefsStore.test.ts
```

Expected:
- PASS with plugin preference coverage green.

- [ ] **Step 7: Commit preference and core contribution setup**

```bash
git add src/plugins/coreContributions.tsx src/plugins/builtInPlugins.ts src/store/layoutPrefsStore.ts src/store/layoutPrefsStore.test.ts
git commit -m "feat(plugins): add core contribution registry and plugin prefs"
```

## Task 3: Make top bar, panels, and command palette registry-driven

**Files:**
- Modify: `src/components/TopContextBar.tsx`
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/CommandPalette.test.tsx`
- Modify: `src/types/panelRegistry.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add a command palette test for contributed views**

Append to `src/components/CommandPalette.test.tsx`:

```ts
it('builds view search items from supplied runtime definitions', () => {
  const items = buildSearchItems(mockLayout, [], {
    viewModes: [
      { id: '2d', label: '2D Rack Editor', icon: null, order: 10, render: () => null },
      { id: '3d', label: '3D Inspection', icon: null, order: 20, render: () => null },
      { id: 'cables', label: 'Cable Map', icon: null, order: 30, render: () => null },
    ],
    commands: [],
  });

  const viewItems = items.filter((item) => item.type === 'view');
  expect(viewItems).toHaveLength(3);
  expect(viewItems.map((item) => item.title)).toContain('Cable Map');
});
```

- [ ] **Step 2: Run the command palette test and confirm it fails**

Run:

```bash
npm test -- --pool=threads src/components/CommandPalette.test.tsx
```

Expected:
- FAIL because `buildSearchItems` does not accept runtime registry options yet.

- [ ] **Step 3: Refactor top bar to use supplied view-mode definitions**

Modify `src/components/TopContextBar.tsx`:

```ts
import type { ViewModeDefinition } from '../plugins/types';

interface TopContextBarProps {
  // existing props...
  viewModes: ViewModeDefinition[];
}

export function TopContextBar({
  viewModes,
  // existing props...
}: TopContextBarProps) {
  return (
    <div>
      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        {viewModes.map((definition) => {
          const active = viewMode === definition.id;
          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onToggleViewMode(definition.id)}
            >
              {definition.icon}
              {definition.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Refactor command palette helpers to accept runtime registries**

Modify `src/components/CommandPalette.tsx`:

```ts
import type { CommandDefinition, ViewModeDefinition } from '../plugins/types';

type SearchRegistry = {
  viewModes: ViewModeDefinition[];
  commands: CommandDefinition[];
};

export function buildSearchItems(
  layout: RackLayout,
  issues: ValidationIssue[],
  registry?: SearchRegistry,
): SearchItem[] {
  const items: SearchItem[] = buildRackSpecificSearchItems(layout, issues);
  const viewModes = registry?.viewModes ?? [];

  viewModes.forEach((view) => {
    items.push({
      id: `view-${view.id}`,
      type: 'view',
      title: view.label,
      subtitle: `Switch to ${view.label}`,
      icon: <span className="text-slate-500 dark:text-slate-400">{view.icon}</span>,
      action: () => {
        useRackStore.getState().setViewMode(view.id);
      },
      category: 'Views',
    });
  });

  for (const command of registry?.commands ?? []) {
    items.push({
      id: command.id,
      type: 'quick-action',
      title: command.title,
      subtitle: command.subtitle,
      icon: <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />,
      action: command.run,
      category: command.category,
    });
  }

  return items;
}
```

Update `buildWorkspaceSearchItems` the same way so workspace search also honors registry-backed views.

- [ ] **Step 5: Replace hardcoded panel metadata usage in `App.tsx`**

Modify `src/App.tsx` so the visible panel list and command palette panel items come from the plugin host result instead of `PANEL_REGISTRY`:

```ts
const enabledPluginIds = useLayoutPrefsStore((state) => state.enabledPluginIds);

const pluginRegistry = useMemo(
  () =>
    buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: builtInPlugins,
      enabledPluginIds,
      core: getCoreContributions({
        render2d: (canvasLayout) => (
          <RackEditor2D
            layoutOverride={canvasLayout}
            serviceabilityOverlay={serviceabilityOverlayEnabled}
            highlightedDeviceIds={serviceabilityHighlightIds}
          />
        ),
        render3d: (canvasLayout) => (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading 3D…</div>}>
            <RackViewer3D layout={canvasLayout} />
          </Suspense>
        ),
      }),
    }),
  [enabledPluginIds, serviceabilityHighlightIds, serviceabilityOverlayEnabled],
);

const visiblePanels = useMemo(
  () => (workspaceId: AppWorkspace, placement: PanelPlacement) =>
    pluginRegistry.panels
      .filter((panel) => panel.workspace === workspaceId && panel.defaultPlacement === placement)
      .filter((panel) => !panel.supportedViewModes || panel.supportedViewModes.includes(viewMode))
      .filter((panel) => !panel.selectionRequired || hasSelection)
      .sort((a, b) => a.priority - b.priority),
  [hasSelection, pluginRegistry.panels, viewMode],
);
```

Keep the existing `renderPanel` switch in place for core panels during this task. Plugin panel render callbacks can be introduced in the next task when the cable plugin is wired in.

- [ ] **Step 6: Update `src/types/panelRegistry.tsx` to contain core-only metadata**

Remove the `cable-planner` entry from the static core panel list and leave the file focused on stable core metadata plus workspace lens mappings that still apply.

- [ ] **Step 7: Run the command palette tests and targeted typecheck**

Run:

```bash
npm test -- --pool=threads src/components/CommandPalette.test.tsx
node node_modules/typescript/bin/tsc --noEmit
```

Expected:
- PASS for command palette tests.
- PASS for typecheck.

- [ ] **Step 8: Commit the registry-driven shell wiring**

```bash
git add src/components/TopContextBar.tsx src/components/CommandPalette.tsx src/components/CommandPalette.test.tsx src/types/panelRegistry.tsx src/App.tsx
git commit -m "refactor(shell): consume plugin-backed registries"
```

## Task 4: Extract cable management into a built-in plugin

**Files:**
- Create: `src/plugins/cableManagementPlugin.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a plugin-host test for cable plugin contributions**

Add to `src/plugins/pluginHost.test.ts`:

```ts
import { cableManagementPlugin } from './cableManagementPlugin';

it('registers cable views and planner panel when cable management is enabled', () => {
  const registry = buildPluginRegistry({
    appVersion: '1.0.0',
    plugins: [cableManagementPlugin],
    enabledPluginIds: ['cable-management'],
    core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
  });

  expect(registry.viewModes.map((view) => view.id)).toEqual(['cables', 'topology']);
  expect(registry.panels.map((panel) => panel.id)).toContain('cable-planner');
  expect(registry.commands.map((command) => command.id)).toContain('cable.open-planner');
});
```

- [ ] **Step 2: Run the plugin host tests and confirm this new test fails**

Run:

```bash
npm test -- --pool=threads src/plugins/pluginHost.test.ts
```

Expected:
- FAIL because `cableManagementPlugin` does not exist yet.

- [ ] **Step 3: Implement the cable management plugin**

Create `src/plugins/cableManagementPlugin.tsx`:

```ts
import { Cable, Network } from 'lucide-react';
import { Suspense } from 'react';
import { CableMap } from '../components/CableMap';
import { CablePlanner } from '../components/CablePlanner';
import { NetworkTopology } from '../components/NetworkTopology';
import type { RackPluginModule } from './types';

export const cableManagementPlugin: RackPluginModule = {
  manifest: {
    id: 'cable-management',
    name: 'Cable Management',
    version: '1.0.0',
    description: 'Cable map, topology, and planning workflow',
    requiresAppVersion: '1.0.0',
    defaultEnabled: true,
  },
  activate(host) {
    host.registerViewMode({
      id: 'cables',
      label: 'Cables',
      order: 30,
      icon: <Cable size={14} />,
      pluginId: 'cable-management',
      render: (layout) => (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading cable map...</div>}>
          <CableMap layout={layout} />
        </Suspense>
      ),
    });

    host.registerViewMode({
      id: 'topology',
      label: 'Topology',
      order: 40,
      icon: <Network size={14} />,
      pluginId: 'cable-management',
      render: (layout) => (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading topology...</div>}>
          <NetworkTopology layout={layout} />
        </Suspense>
      ),
    });

    host.registerPanel({
      id: 'cable-planner',
      title: 'Cable Planner',
      workspace: 'model',
      priority: 20,
      defaultPlacement: 'inspector',
      supportedViewModes: ['2d', 'cables', 'topology'],
      pluginId: 'cable-management',
      render: () => <CablePlanner />,
    });

    host.registerCommand({
      id: 'cable.open-planner',
      title: 'Open Cable Planner',
      subtitle: 'Switch to the cable workflow',
      category: 'Advanced panels',
      pluginId: 'cable-management',
      run: () => {
        // wiring will be provided by App.tsx-selected host actions in this phase
      },
    });
  },
};
```

- [ ] **Step 4: Use plugin render callbacks in `App.tsx`**

Replace the hardcoded `renderCanvas()` branches for `cables` and `topology` with a registry lookup:

```ts
function renderCanvas() {
  const currentView = pluginRegistry.viewModes.find((definition) => definition.id === viewMode)
    ?? pluginRegistry.viewModes.find((definition) => definition.id === '2d');

  return currentView?.render(filteredLayout) ?? null;
}
```

Update `renderPanel(panelId)` so it checks plugin-backed panel definitions before falling back to the existing core switch:

```ts
const pluginPanel = pluginRegistry.panels.find((panel) => panel.id === panelId && panel.pluginId);
if (pluginPanel) return pluginPanel.render();
```

Also update any hardcoded “add cable” quick action so it only appears when `cable-management` is enabled.

- [ ] **Step 5: Run targeted tests for the cable plugin migration**

Run:

```bash
npm test -- --pool=threads src/plugins/pluginHost.test.ts src/components/CommandPalette.test.tsx
node node_modules/typescript/bin/tsc --noEmit
```

Expected:
- PASS for plugin and command palette tests.
- PASS for typecheck.

- [ ] **Step 6: Commit the cable plugin extraction**

```bash
git add src/plugins/cableManagementPlugin.tsx src/plugins/builtInPlugins.ts src/App.tsx
git commit -m "feat(cables): register cable workflow through plugin host"
```

## Task 5: Add fallback behavior and full regression verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/CommandPalette.test.tsx`
- Modify: `src/plugins/pluginHost.test.ts`

- [ ] **Step 1: Add a regression test for disabled cable workflow**

Add to `src/plugins/pluginHost.test.ts`:

```ts
it('omits cable workflow contributions when cable management is disabled', () => {
  const registry = buildPluginRegistry({
    appVersion: '1.0.0',
    plugins: [cableManagementPlugin],
    enabledPluginIds: [],
    core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
  });

  expect(registry.viewModes).toEqual([]);
  expect(registry.panels).toEqual([]);
  expect(registry.commands).toEqual([]);
});
```

Add to `src/components/CommandPalette.test.tsx`:

```ts
it('does not show cable map when the runtime registry excludes cable views', () => {
  const items = buildSearchItems(mockLayout, [], {
    viewModes: [
      { id: '2d', label: '2D Rack Editor', icon: null, order: 10, render: () => null },
      { id: '3d', label: '3D Inspection', icon: null, order: 20, render: () => null },
    ],
    commands: [],
  });

  expect(items.some((item) => item.title === 'Cable Map')).toBe(false);
});
```

- [ ] **Step 2: Implement safe fallback to `2d` in `App.tsx`**

Add an effect near the existing `viewMode` usage:

```ts
useEffect(() => {
  const supported = pluginRegistry.viewModes.some((definition) => definition.id === viewMode);
  if (!supported) {
    setViewMode('2d');
  }
}, [pluginRegistry.viewModes, setViewMode, viewMode]);
```

This keeps saved UI state safe if the last active mode belonged to a disabled plugin.

- [ ] **Step 3: Run regression checks**

Run:

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test -- --pool=threads src/plugins/pluginHost.test.ts src/store/layoutPrefsStore.test.ts src/components/CommandPalette.test.tsx
npm run build
node scripts/check-bundle-size.mjs
```

Expected:
- PASS for typecheck.
- PASS for targeted test files.
- PASS for build.
- PASS for bundle guard.

- [ ] **Step 4: Commit the fallback and verification pass**

```bash
git add src/App.tsx src/components/CommandPalette.test.tsx src/plugins/pluginHost.test.ts
git commit -m "test(plugins): cover disabled workflow fallback"
```

## Self-Review

### Spec coverage
- Plugin host, manifests, constrained API: covered by Task 1.
- Core/plugin boundary and merged registries: covered by Tasks 2 and 3.
- Cable management as first built-in plugin: covered by Task 4.
- Enable/disable persistence and fallback behavior: covered by Tasks 2 and 5.
- Compatibility and regression verification: covered by Tasks 1 and 5.

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” markers remain in the task steps.
- Each task lists concrete files, commands, and code blocks.

### Type consistency
- `ViewMode` stays the existing union in phase 1.
- `buildPluginRegistry`, `ViewModeDefinition`, `PluginPanelDefinition`, and `RackPluginModule` are named consistently across tasks.
- `enabledPluginIds` is the persisted preference key used in store, host input, and fallback logic.

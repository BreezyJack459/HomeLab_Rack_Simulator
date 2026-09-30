import { describe, expect, it } from 'vitest';
import { builtInPlugins, builtInPackPluginIds, builtInPluginManifests, loadBuiltInPlugin } from './builtInPlugins';
import { operationsPackPlugin } from './operationsPackPlugin';
import { planningPackPlugin } from './planningPackPlugin';
import { fleetPackPlugin } from './fleetPackPlugin';
import { buildPluginRegistry } from './pluginHost';
import type { RackPluginModule } from './types';

const emptyCore = {
  viewModes: [],
  panels: [],
  toolbarActions: [],
  commands: [],
};

const workspacePlugin = (
  id: string,
  workspaceId: 'operate' | 'plan' | 'portfolio',
): RackPluginModule => ({
  manifest: {
    id,
    name: id,
    version: '1.0.0',
    description: 'test',
    requiresAppVersion: '1.0.0',
    defaultEnabled: true,
    origin: 'built-in',
    trustLevel: 'trusted',
    capabilities: ['workspaces'],
  },
  activate: (host) =>
    host.registerWorkspace({
      id: workspaceId,
      title: id,
      description: 'test workspace',
      icon: null,
      nav: {
        label: id,
        shortLabel: id,
        description: 'test workspace',
        accent: 'from-transparent to-transparent',
      },
      lenses: [{ id: 'overview', label: 'Overview', panelIds: [] }],
    }),
});

describe('workspace contributions', () => {
  it('registers workspaces from enabled plugins in contribution order', () => {
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [
        workspacePlugin('pack-a', 'operate'),
        workspacePlugin('pack-b', 'plan'),
      ],
      enabledPluginIds: ['pack-a', 'pack-b'],
      core: emptyCore,
    });

    expect(registry.workspaces.map((workspace) => workspace.id)).toEqual([
      'operate',
      'plan',
    ]);
    expect(registry.workspaces[0]?.lenses[0]?.id).toBe('overview');
  });

  it('rejects duplicate workspace ids deterministically', () => {
    expect(() =>
      buildPluginRegistry({
        appVersion: '1.0.0',
        plugins: [
          workspacePlugin('pack-a', 'operate'),
          workspacePlugin('pack-b', 'operate'),
        ],
        enabledPluginIds: ['pack-a', 'pack-b'],
        core: emptyCore,
      }),
    ).toThrow(/duplicate contribution id/i);
  });

  it('omits workspace contributions when the plugin is disabled', () => {
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [workspacePlugin('pack-a', 'operate')],
      enabledPluginIds: [],
      core: emptyCore,
    });

    expect(registry.workspaces).toEqual([]);
  });
});

describe('built-in workspace packs', () => {
  it('marks all packs as opt-in (defaultEnabled: false)', () => {
    for (const pack of [
      operationsPackPlugin,
      planningPackPlugin,
      fleetPackPlugin,
    ]) {
      expect(pack.manifest.defaultEnabled).toBe(false);
    }
    expect(builtInPackPluginIds).toEqual([
      'operations-pack',
      'planning-pack',
      'fleet-pack',
    ]);
  });

  it('contributes no workspaces or pack panels when packs are disabled', async () => {
    const packs = await Promise.all(builtInPackPluginIds.map(loadBuiltInPlugin));
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [...builtInPlugins, ...packs.filter((pack): pack is RackPluginModule => Boolean(pack))],
      enabledPluginIds: [],
      core: emptyCore,
    });

    expect(registry.workspaces).toEqual([]);
    expect(registry.panels.map((panel) => panel.id)).not.toContain(
      'workspace-manager',
    );
    expect(registry.pluginStates.disabled).toEqual(
      expect.arrayContaining(builtInPackPluginIds),
    );
  });

  it('registers operate/plan/portfolio workspaces when packs are enabled', async () => {
    const packs = await Promise.all(builtInPackPluginIds.map(loadBuiltInPlugin));
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: packs.filter((pack): pack is RackPluginModule => Boolean(pack)),
      enabledPluginIds: [...builtInPackPluginIds],
      core: emptyCore,
    });

    expect(registry.workspaces.map((workspace) => workspace.id)).toEqual([
      'operate',
      'plan',
      'portfolio',
    ]);

    const operate = registry.workspaces.find(
      (workspace) => workspace.id === 'operate',
    );
    expect(operate?.lenses.map((lens) => lens.id)).toEqual([
      'assets',
      'maintenance',
      'firmware',
      'network',
      'evidence',
      'power',
    ]);
    expect(operate?.renderWorkbench).toBeDefined();

    const plan = registry.workspaces.find(
      (workspace) => workspace.id === 'plan',
    );
    expect(plan?.renderInspector).toBeDefined();

    const portfolio = registry.workspaces.find(
      (workspace) => workspace.id === 'portfolio',
    );
    expect(portfolio?.renderInspector).toBeDefined();

    const panelIds = registry.panels.map((panel) => panel.id);
    expect(panelIds).toEqual(
      expect.arrayContaining([
        'asset-registry',
        'scenario-planner',
        'workspace-manager',
        'inter-rack-map',
        'rack-photo',
      ]),
    );

    const commandIds = registry.commands.map((command) => command.id);
    expect(commandIds).toEqual(
      expect.arrayContaining([
        'fleet.add-inter-rack-cable',
        'fleet.export-workspace',
        'fleet.import-workspace',
        'fleet.export-migration-plan',
      ]),
    );
    expect(registry.toolbarActions.map((action) => action.id)).toContain(
      'fleet.add-inter-rack-cable',
    );
  });
});

describe('lazy built-in registration', () => {
  it('keeps executable opt-in packs out of the synchronous modules but keeps serializable manifests', () => {
    expect(builtInPlugins.map((plugin) => plugin.manifest.id)).toEqual([
      'cable-management', 'governance-tools',
    ]);
    expect(JSON.parse(JSON.stringify(builtInPluginManifests))).toEqual(builtInPluginManifests);
    expect(builtInPluginManifests.map((manifest) => manifest.id)).toEqual([
      'cable-management', 'governance-tools', ...builtInPackPluginIds, 'port-labels', 'cable-labels',
    ]);
  });

  it('deduplicates loads and uses the synchronous manifest as the module manifest', async () => {
    const first = loadBuiltInPlugin('fleet-pack');
    expect(loadBuiltInPlugin('fleet-pack')).toBe(first);
    const plugin = await first;
    expect(plugin?.manifest).toBe(builtInPluginManifests.find((manifest) => manifest.id === 'fleet-pack'));
    const disabled = buildPluginRegistry({
      appVersion: '1.0.0', plugins: [plugin!], enabledPluginIds: [], core: emptyCore,
    });
    expect(disabled.workspaces).toEqual([]);
    expect(disabled.panels).toEqual([]);
    expect(disabled.commands).toEqual([]);
    expect(disabled.toolbarActions).toEqual([]);
  });

  it('never loads local packages or unknown ids via the built-in loader', async () => {
    for (const id of ['rack-reports-local', '../localPackageRegistry', 'toString', '__proto__']) {
      expect(await loadBuiltInPlugin(id)).toBeUndefined();
    }
  });
});

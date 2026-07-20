import { describe, expect, it, vi } from 'vitest';
import { cableManagementPlugin } from './cableManagementPlugin';
import { governanceToolsPlugin } from './governanceToolsPlugin';
import type { RackPluginManifest, RackPluginModule } from './types';
import { buildPluginRegistry } from './pluginHost';

type PluginOverrides = {
  manifest?: Partial<RackPluginManifest>;
  activate?: RackPluginModule['activate'];
};

const basePlugin = (
  overrides?: PluginOverrides,
): RackPluginModule => ({
  manifest: {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'test',
    requiresAppVersion: '1.0.0',
    defaultEnabled: true,
    origin: 'built-in',
    trustLevel: 'trusted',
    capabilities: ['view-modes', 'panels', 'commands', 'toolbar-actions'],
    ...overrides?.manifest,
  },
  activate:
    overrides?.activate ??
    ((host) => {
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
        subtitle: 'Command from plugin',
        category: 'Actions',
        run: vi.fn(),
      });
    });

    const plugins: RackPluginModule[] = [
      basePlugin({
        manifest: { id: 'enabled', requiresAppVersion: '1.0.0' },
        activate: active,
      }),
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
    expect(registry.pluginStates.incompatible.blocked).toContain(
      'requiresAppVersion',
    );
  });

  it('records activation failures in plugin states and continues with remaining plugins', () => {
    const healthy = vi.fn((host) => {
      host.registerCommand({
        id: 'healthy.command',
        title: 'Healthy Command',
        subtitle: 'Command from a healthy plugin',
        category: 'Actions',
        run: vi.fn(),
      });
    });

    const plugins: RackPluginModule[] = [
      basePlugin({
        manifest: { id: 'boom', requiresAppVersion: '1.0.0' },
        activate: () => {
          throw new Error('kaboom');
        },
      }),
      basePlugin({
        manifest: { id: 'healthy', requiresAppVersion: '1.0.0' },
        activate: healthy,
      }),
    ];

    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins,
      enabledPluginIds: ['boom', 'healthy'],
      core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
    });

    expect(registry.pluginStates.errored.boom).toContain('kaboom');
    expect(registry.pluginStates.enabled).not.toContain('boom');
    expect(registry.pluginStates.enabled).toContain('healthy');
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(registry.commands.map((c) => c.id)).toContain('healthy.command');
  });

  it('rejects duplicate contribution ids deterministically', () => {    const plugins: RackPluginModule[] = [
      basePlugin({
        manifest: { id: 'one', requiresAppVersion: '1.0.0' },
        activate: (host) =>
          host.registerPanel({
            id: 'cable-planner',
            title: 'Dup',
            workspace: 'model',
            priority: 20,
            defaultPlacement: 'inspector',
            render: () => null,
          }),
      }),
      basePlugin({
        manifest: { id: 'two', requiresAppVersion: '1.0.0' },
        activate: (host) =>
          host.registerPanel({
            id: 'cable-planner',
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

  it('registers cable views and planner panel when cable management is enabled', () => {
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [cableManagementPlugin],
      enabledPluginIds: ['cable-management'],
      core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
    });

    expect(registry.viewModes.map((view) => view.id)).toEqual([
      'cables',
      'topology',
    ]);
    expect(registry.panels.map((panel) => panel.id)).toContain('cable-planner');
    expect(registry.commands.map((command) => command.id)).toContain(
      'cable.open-planner',
    );
    expect(registry.toolbarActions.map((action) => action.id)).toContain(
      'cable.quick-open',
    );
  });

  it('routes cable command through host shell actions instead of store internals', () => {
    const setViewMode = vi.fn();
    const setCurrentWorkspace = vi.fn();
    const setInspectorOpen = vi.fn();
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [cableManagementPlugin],
      enabledPluginIds: ['cable-management'],
      shell: {
        getLayout: () => {
          throw new Error('not used');
        },
        getViewMode: () => '2d',
        setViewMode,
        setCurrentWorkspace,
        setInspectorOpen,
      },
      core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
    });

    registry.commands.find((command) => command.id === 'cable.open-planner')?.run();

    expect(setViewMode).toHaveBeenCalledWith('cables');
    expect(setCurrentWorkspace).toHaveBeenCalledWith('model');
    expect(setInspectorOpen).toHaveBeenCalledWith(true);
  });

  it('routes cable toolbar action through host shell actions', () => {
    const setViewMode = vi.fn();
    const setCurrentWorkspace = vi.fn();
    const setInspectorOpen = vi.fn();
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [cableManagementPlugin],
      enabledPluginIds: ['cable-management'],
      shell: {
        getLayout: () => {
          throw new Error('not used');
        },
        getViewMode: () => '2d',
        setViewMode,
        setCurrentWorkspace,
        setInspectorOpen,
      },
      core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
    });

    registry.toolbarActions.find((action) => action.id === 'cable.quick-open')?.run();

    expect(setViewMode).toHaveBeenCalledWith('cables');
    expect(setCurrentWorkspace).toHaveBeenCalledWith('model');
    expect(setInspectorOpen).toHaveBeenCalledWith(true);
  });

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
    expect(registry.toolbarActions).toEqual([]);
  });

  it('registers governance panels when governance tools are enabled', () => {
    const registry = buildPluginRegistry({
      appVersion: '1.0.0',
      plugins: [governanceToolsPlugin],
      enabledPluginIds: ['governance-tools'],
      core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
    });

    expect(registry.panels.map((panel) => panel.id)).toEqual([
      'policy-rules',
      'homelab-guide',
    ]);
  });
});

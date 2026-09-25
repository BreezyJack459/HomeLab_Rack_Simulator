import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInPluginManifests, loadBuiltInPlugin } from './builtInPlugins';
import { buildPluginRegistry } from './pluginHost';
import { useBuiltInPlugins } from './useBuiltInPlugins';
import type { RackPluginModule } from './types';

vi.mock('./builtInPlugins', async (importOriginal) => ({
  ...await importOriginal<typeof import('./builtInPlugins')>(),
  loadBuiltInPlugin: vi.fn(),
}));
const loader = vi.mocked(loadBuiltInPlugin);
const fleet: RackPluginModule = {
  manifest: builtInPluginManifests.find((manifest) => manifest.id === 'fleet-pack')!,
  activate: (host) => host.registerCommand({
    id: 'fleet.test', title: 'Fleet', subtitle: '', category: 'Fleet', run: () => {},
  }),
};
const registryFor = (plugins: RackPluginModule[], enabledPluginIds: string[]) => buildPluginRegistry({
  appVersion: '1.0.0', plugins, enabledPluginIds,
  core: { viewModes: [], panels: [], toolbarActions: [], commands: [] },
});

beforeEach(() => {
  loader.mockReset();
  loader.mockResolvedValue(undefined);
});

describe('useBuiltInPlugins', () => {
  it('loads only enabled built-ins and makes contributions available without remounting', async () => {
    let finish!: (plugin: RackPluginModule) => void;
    loader.mockImplementation((id) => id === 'fleet-pack'
      ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(undefined));
    const { result, rerender } = renderHook(({ ids }) => useBuiltInPlugins(ids), {
      initialProps: { ids: [] as string[] },
    });
    expect(loader).not.toHaveBeenCalled();
    rerender({ ids: ['fleet-pack', 'rack-reports-local', '__proto__'] });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith('fleet-pack');
    expect(result.current.pendingPluginIds).toEqual(['fleet-pack']);
    expect(result.current.loadError).toBe('');
    expect(registryFor(result.current.plugins, ['fleet-pack']).commands).toEqual([]);
    await act(async () => { finish(fleet); });
    expect(registryFor(result.current.plugins, ['fleet-pack']).commands[0]?.id).toBe('fleet.test');
    expect(result.current.pendingPluginIds).toEqual([]);
    rerender({ ids: [] });
    expect(registryFor(result.current.plugins, []).commands).toEqual([]);
  });

  it('ignores a stale completion after disabling and can enable again', async () => {
    let finish!: (plugin: RackPluginModule) => void;
    const pending = new Promise<RackPluginModule>((resolve) => { finish = resolve; });
    loader.mockReturnValue(pending);
    const { result, rerender } = renderHook(({ ids }) => useBuiltInPlugins(ids), {
      initialProps: { ids: ['fleet-pack'] },
    });
    rerender({ ids: [] });
    await act(async () => { finish(fleet); });
    expect(result.current.plugins).not.toContain(fleet);
    rerender({ ids: ['fleet-pack'] });
    await waitFor(() => expect(result.current.plugins).toContain(fleet));
  });

  it('reports download failure, keeps core usable, and recovers on re-enable', async () => {
    loader.mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(({ ids }) => useBuiltInPlugins(ids), {
      initialProps: { ids: ['fleet-pack'] },
    });
    await waitFor(() => expect(result.current.loadError).toContain('Could not load Fleet Pack'));
    expect(result.current.plugins.map((plugin) => plugin.manifest.id)).toContain('cable-management');
    expect(result.current.pendingPluginIds).toEqual([]);
    loader.mockResolvedValue(fleet);
    rerender({ ids: [] });
    rerender({ ids: ['fleet-pack'] });
    await waitFor(() => expect(result.current.plugins).toContain(fleet));
    expect(result.current.loadError).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import {
  getPluginCatalogState,
  localPackageCatalog,
  type PluginCatalogEntry,
} from './pluginCatalog';

const localEntry: PluginCatalogEntry = {
  manifest: {
    id: 'rack-reports-local',
    name: 'Rack Reports',
    version: '0.1.0',
    description: 'Local package placeholder',
    requiresAppVersion: '1.0.0',
    defaultEnabled: false,
    origin: 'local-package',
    trustLevel: 'review-required',
    capabilities: ['panels', 'commands', 'layout-read'],
  },
  activationMode: 'manifest-only',
  installState: 'cataloged',
  loaderKey: 'rack-reports-local',
  statusNote: 'Manifest discovered locally.',
};

describe('getPluginCatalogState', () => {
  it('discovers at least one local package manifest entry', () => {
    expect(localPackageCatalog.length).toBeGreaterThan(0);
    expect(localPackageCatalog.some((entry) => entry.manifest.id === 'rack-reports-local')).toBe(true);
  });

  it('marks local packages as cataloged before review approval', () => {
    const state = getPluginCatalogState({
      entry: localEntry,
      enabledPluginIds: [],
      approvedLocalPluginIds: [],
      incompatibleReasons: {},
    });

    expect(state.canToggle).toBe(false);
    expect(state.runtimeStatus).toBe('cataloged');
    expect(state.summary).toContain('review approval is still required');
  });

  it('marks local packages as reviewed after approval', () => {
    const state = getPluginCatalogState({
      entry: localEntry,
      enabledPluginIds: [],
      approvedLocalPluginIds: ['rack-reports-local'],
      incompatibleReasons: {},
    });

    expect(state.canToggle).toBe(false);
    expect(state.runtimeStatus).toBe('reviewed');
    expect(state.summary).toContain('Host Adapter');
  });

  it('prefers incompatible status over review state', () => {
    const state = getPluginCatalogState({
      entry: localEntry,
      enabledPluginIds: [],
      approvedLocalPluginIds: ['rack-reports-local'],
      incompatibleReasons: {
        'rack-reports-local': 'requiresAppVersion=9.9.9',
      },
    });

    expect(state.canToggle).toBe(false);
    expect(state.runtimeStatus).toBe('incompatible');
    expect(state.summary).toBe('requiresAppVersion=9.9.9');
  });
});

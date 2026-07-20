import { describe, expect, it } from 'vitest';
import { pluginCatalogEntries } from './pluginCatalog';
import {
  resolveLocalPackagePlugins,
  sanitizeEnabledPluginIds,
} from './localPackageLoader';

describe('resolveLocalPackagePlugins', () => {
  it('does not promote local packages before review approval', () => {
    const result = resolveLocalPackagePlugins({
      catalogEntries: pluginCatalogEntries,
      approvedLocalPluginIds: [],
    });

    expect(result.loadablePlugins).toHaveLength(0);
    const localEntry = result.catalogEntries.find(
      (entry) => entry.manifest.id === 'rack-reports-local',
    );
    expect(localEntry?.activationMode).toBe('manifest-only');
    expect(localEntry?.installState).toBe('cataloged');
  });

  it('promotes reviewed local packages into hosted loadable plugins', () => {
    const result = resolveLocalPackagePlugins({
      catalogEntries: pluginCatalogEntries,
      approvedLocalPluginIds: ['rack-reports-local'],
    });

    expect(result.loadablePlugins.map((plugin) => plugin.manifest.id)).toEqual([
      'rack-reports-local',
    ]);
    const localEntry = result.catalogEntries.find(
      (entry) => entry.manifest.id === 'rack-reports-local',
    );
    expect(localEntry?.activationMode).toBe('hosted');
    expect(localEntry?.installState).toBe('installed');
    expect(localEntry?.statusNote).toContain('Rack Reports Host Adapter');
  });

  it('removes enabled ids for plugins that are no longer hosted', () => {
    const reviewed = resolveLocalPackagePlugins({
      catalogEntries: pluginCatalogEntries,
      approvedLocalPluginIds: ['rack-reports-local'],
    });
    const revoked = resolveLocalPackagePlugins({
      catalogEntries: pluginCatalogEntries,
      approvedLocalPluginIds: [],
    });

    expect(
      sanitizeEnabledPluginIds({
        catalogEntries: reviewed.catalogEntries,
        enabledPluginIds: ['cable-management', 'rack-reports-local'],
      }),
    ).toEqual(['cable-management', 'rack-reports-local']);
    expect(
      sanitizeEnabledPluginIds({
        catalogEntries: revoked.catalogEntries,
        enabledPluginIds: ['cable-management', 'rack-reports-local'],
      }),
    ).toEqual(['cable-management']);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultEnabledPluginIds } from '../plugins/builtInPlugins';
import { useLayoutPrefsStore } from './layoutPrefsStore';

describe('layoutPrefsStore', () => {
  beforeEach(() => {
    localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    useLayoutPrefsStore.setState({
      deviceLibraryOpen: false,
      inspectorOpen: true,
      rackSummaryOpen: false,
      bottomTrayOpen: false,
      enabledPluginIds: [...defaultEnabledPluginIds],
      approvedLocalPluginIds: [],
    });
  });

  it('defaults device library and rack summary closed, inspector open, and bottom tray closed', () => {
    expect(useLayoutPrefsStore.getState().deviceLibraryOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().inspectorOpen).toBe(true);
    expect(useLayoutPrefsStore.getState().rackSummaryOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().bottomTrayOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().enabledPluginIds).toEqual(
      defaultEnabledPluginIds,
    );
    expect(useLayoutPrefsStore.getState().approvedLocalPluginIds).toEqual([]);
  });

  it('persists toggles to localStorage', () => {
    useLayoutPrefsStore.getState().toggleDeviceLibrary();
    useLayoutPrefsStore.getState().toggleInspector();
    useLayoutPrefsStore.getState().toggleRackSummary();

    const raw = localStorage.getItem('homelab-rack-simulator-layout-prefs');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({
      prefsVersion: 1,
      deviceLibraryOpen: true,
      inspectorOpen: false,
      rackSummaryOpen: true,
      bottomTrayOpen: false,
      enabledPluginIds: defaultEnabledPluginIds,
      approvedLocalPluginIds: [],
    });
  });

  it('persists enabled plugin ids to localStorage', () => {
    useLayoutPrefsStore
      .getState()
      .setEnabledPluginIds(['cable-management', 'audit-tools']);

    expect(useLayoutPrefsStore.getState().enabledPluginIds).toEqual([
      'cable-management',
      'audit-tools',
    ]);
    expect(
      JSON.parse(localStorage.getItem('homelab-rack-simulator-layout-prefs')!),
    ).toEqual({
      prefsVersion: 1,
      deviceLibraryOpen: false,
      inspectorOpen: true,
      rackSummaryOpen: false,
      bottomTrayOpen: false,
      enabledPluginIds: ['cable-management', 'audit-tools'],
      approvedLocalPluginIds: [],
    });
  });

  it('persists approved local plugin ids to localStorage', () => {
    useLayoutPrefsStore
      .getState()
      .setApprovedLocalPluginIds(['rack-reports-local']);

    expect(useLayoutPrefsStore.getState().approvedLocalPluginIds).toEqual([
      'rack-reports-local',
    ]);
    expect(
      JSON.parse(localStorage.getItem('homelab-rack-simulator-layout-prefs')!),
    ).toEqual({
      prefsVersion: 1,
      deviceLibraryOpen: false,
      inspectorOpen: true,
      rackSummaryOpen: false,
      bottomTrayOpen: false,
      enabledPluginIds: defaultEnabledPluginIds,
      approvedLocalPluginIds: ['rack-reports-local'],
    });
  });
});

describe('initial plugin preference migration', () => {
  it('checkpoints fresh and unversioned preferences without re-enabling omitted packs', async () => {
    localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    vi.resetModules();
    const fresh = await import('./layoutPrefsStore');
    expect(fresh.useLayoutPrefsStore.getState().enabledPluginIds).toEqual(defaultEnabledPluginIds);
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({
      enabledPluginIds: ['cable-management', 'port-labels'],
      approvedLocalPluginIds: ['rack-reports-local'],
    }));
    vi.resetModules();
    const returning = await import('./layoutPrefsStore');
    expect(returning.useLayoutPrefsStore.getState().enabledPluginIds).toEqual([
      'cable-management', 'port-labels',
    ]);
    expect(returning.useLayoutPrefsStore.getState().approvedLocalPluginIds).toEqual(['rack-reports-local']);
    expect(JSON.parse(localStorage.getItem('homelab-rack-simulator-layout-prefs')!).prefsVersion).toBe(1);
    returning.useLayoutPrefsStore.getState().setEnabledPluginIds([]);
    vi.resetModules();
    const reloaded = await import('./layoutPrefsStore');
    expect(reloaded.useLayoutPrefsStore.getState().enabledPluginIds).toEqual([]);
    expect(reloaded.useLayoutPrefsStore.getState().approvedLocalPluginIds).toEqual(['rack-reports-local']);
    localStorage.removeItem('homelab-rack-simulator-layout-prefs');
  });
});

it('keeps a fresh install core-only after saving another preference and reloading', async () => {
  localStorage.removeItem('homelab-rack-simulator-layout-prefs');
  vi.resetModules();
  const fresh = await import('./layoutPrefsStore');
  fresh.useLayoutPrefsStore.getState().toggleInspector();
  vi.resetModules();
  const reloaded = await import('./layoutPrefsStore');
  expect(reloaded.useLayoutPrefsStore.getState().enabledPluginIds).toEqual(defaultEnabledPluginIds);
  localStorage.removeItem('homelab-rack-simulator-layout-prefs');
});

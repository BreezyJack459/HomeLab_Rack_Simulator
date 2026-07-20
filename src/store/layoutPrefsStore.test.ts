import { beforeEach, describe, expect, it } from 'vitest';
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
      deviceLibraryOpen: false,
      inspectorOpen: true,
      rackSummaryOpen: false,
      bottomTrayOpen: false,
      enabledPluginIds: defaultEnabledPluginIds,
      approvedLocalPluginIds: ['rack-reports-local'],
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { useLayoutPrefsStore } from './layoutPrefsStore';

describe('layoutPrefsStore', () => {
  beforeEach(() => {
    localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    useLayoutPrefsStore.setState({
      deviceLibraryOpen: false,
      inspectorOpen: true,
      rackSummaryOpen: false,
      bottomTrayOpen: false,
    });
  });

  it('defaults device library and rack summary closed, inspector open, and bottom tray closed', () => {
    expect(useLayoutPrefsStore.getState().deviceLibraryOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().inspectorOpen).toBe(true);
    expect(useLayoutPrefsStore.getState().rackSummaryOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().bottomTrayOpen).toBe(false);
  });

  it('persists toggles to localStorage', () => {
    useLayoutPrefsStore.getState().toggleDeviceLibrary();
    useLayoutPrefsStore.getState().toggleInspector();
    useLayoutPrefsStore.getState().toggleRackSummary();

    const raw = localStorage.getItem('homelab-rack-simulator-layout-prefs');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ deviceLibraryOpen: true, inspectorOpen: false, rackSummaryOpen: true, bottomTrayOpen: false });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { useLayoutPrefsStore } from './layoutPrefsStore';

describe('layoutPrefsStore', () => {
  beforeEach(() => {
    localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    useLayoutPrefsStore.setState({
      deviceLibraryOpen: false,
      rackSummaryOpen: false,
      bottomTrayOpen: false,
    });
  });

  it('defaults device library, rack summary, and bottom tray to closed', () => {
    expect(useLayoutPrefsStore.getState().deviceLibraryOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().rackSummaryOpen).toBe(false);
    expect(useLayoutPrefsStore.getState().bottomTrayOpen).toBe(false);
  });

  it('persists toggles to localStorage', () => {
    useLayoutPrefsStore.getState().toggleDeviceLibrary();
    useLayoutPrefsStore.getState().toggleRackSummary();

    const raw = localStorage.getItem('homelab-rack-simulator-layout-prefs');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ deviceLibraryOpen: true, rackSummaryOpen: true, bottomTrayOpen: false });
  });
});

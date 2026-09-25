import { beforeEach, describe, expect, it } from 'vitest';
import {
  cableWorkspaceStorageKey,
  defaultCableWorkspacePrefs,
  useCableWorkspaceStore,
} from './cableWorkspaceStore';
import { useRackStore } from './rackStore';

describe('cableWorkspaceStore', () => {
  beforeEach(() => {
    localStorage.removeItem(cableWorkspaceStorageKey);
    useCableWorkspaceStore.setState({ ...defaultCableWorkspacePrefs });
    useRackStore.setState({ selectedCableId: null });
  });

  it('defaults to an unfiltered 2D workspace that keeps all routes visible', () => {
    expect(useCableWorkspaceStore.getState()).toMatchObject(defaultCableWorkspacePrefs);
  });

  it('persists the shared subview, query, visibility, and focus preferences', () => {
    const state = useCableWorkspaceStore.getState();
    state.setSubview('3d');
    state.setQuery('core switch');
    state.setTypeVisible('power', false);
    state.setFocusMode('hide');

    expect(JSON.parse(localStorage.getItem(cableWorkspaceStorageKey)!)).toEqual({
      subview: '3d',
      query: 'core switch',
      hiddenTypes: ['power'],
      focusMode: 'hide',
    });
  });

  it('changes filters without touching the rack cable selection', () => {
    useRackStore.setState({ selectedCableId: 'cable-selected' });
    useCableWorkspaceStore.getState().setQuery('nas');
    useCableWorkspaceStore.getState().setTypeVisible('fiber', false);

    expect(useCableWorkspaceStore.getState().query).toBe('nas');
    expect(useCableWorkspaceStore.getState().hiddenTypes).toEqual(['fiber']);
    expect(useRackStore.getState().selectedCableId).toBe('cable-selected');
  });

  it('restores every cable type without resetting other preferences', () => {
    const state = useCableWorkspaceStore.getState();
    state.setSubview('table');
    state.setTypeVisible('power', false);
    state.setTypeVisible('fiber', false);
    state.showAllTypes();

    expect(useCableWorkspaceStore.getState()).toMatchObject({
      subview: 'table',
      hiddenTypes: [],
    });
  });
});

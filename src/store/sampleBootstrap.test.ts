import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RackLayout, Workspace } from '../types/rack';

const workspaceKey = 'homelab-rack-simulator-workspace';
const legacyKey = 'homelab-rack-simulator-layout';
const savedRack = (id = 'owned-rack'): RackLayout => ({
  id, name: 'My existing plan', rackType: '19in', heightU: 12, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'rear', devices: [], cables: [],
  policies: [{ id: 'saved-policy', type: 'dual-psu-circuit-split', enabled: false, severity: 'warning', params: {} }],
  planningGoals: { version: 1, power: 'single', remoteRecovery: 'optional', serviceMotion: 'detach-first' },
  updatedAt: '2026-09-30T00:00:00Z',
});
const savedWorkspace = (): Workspace => ({ id: 'owned-workspace', name: 'My existing lab', racks: [savedRack(), savedRack('second-owned-rack')], interRackCables: [], updatedAt: '2026-09-30T00:00:00Z' });
const boot = async () => (await import('./rackStore')).useRackStore;

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('learning sample bootstrap', () => {
  it('uses the beginner example in a fresh browser without writing storage during initialization', async () => {
    const store = await boot();
    expect(store.getState().layout.id).toBe('learn-beginner-10in');
    expect(store.getState().layout.example).toEqual({ version: 1, sampleId: 'learn-beginner-10in' });
    expect(store.getState().workspace.racks).toHaveLength(1);
    expect(store.getState().persistenceBlocked).toBe(false);
    expect(localStorage.getItem(workspaceKey)).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('restores every saved rack and planning record instead of loading the new default', async () => {
    const original = savedWorkspace();
    localStorage.setItem(workspaceKey, JSON.stringify(original));
    const store = await boot();
    expect(store.getState().workspace.id).toBe(original.id);
    expect(store.getState().workspace.name).toBe(original.name);
    expect(store.getState().workspace.racks.map(rack => rack.id)).toEqual(original.racks.map(rack => rack.id));
    expect(store.getState().layout.planningGoals).toEqual(original.racks[0].planningGoals);
    expect(store.getState().layout.policies).toEqual(original.racks[0].policies);
    expect(store.getState().layout.example).toBeUndefined();
    store.getState().saveLocal();
    vi.resetModules();
    const reloaded = await boot();
    expect(reloaded.getState().layout.id).toBe('owned-rack');
    expect(reloaded.getState().workspace.racks).toHaveLength(2);
  });

  it('migrates a saved legacy plan and keeps its original source', async () => {
    const legacy = savedRack('owned-legacy-rack');
    const raw = JSON.stringify(legacy);
    localStorage.setItem(legacyKey, raw);
    const store = await boot();
    expect(store.getState().layout.id).toBe(legacy.id);
    expect(store.getState().layout.policies).toEqual(legacy.policies);
    expect(store.getState().layout.example).toBeUndefined();
    expect(localStorage.getItem(legacyKey)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(workspaceKey)!).racks[0].id).toBe(legacy.id);
  });

  it('prefers a valid workspace when both workspace and legacy data exist', async () => {
    localStorage.setItem(workspaceKey, JSON.stringify(savedWorkspace()));
    const legacyRaw = JSON.stringify(savedRack('old-legacy-rack'));
    localStorage.setItem(legacyKey, legacyRaw);
    const store = await boot();
    expect(store.getState().layout.id).toBe('owned-rack');
    expect(localStorage.getItem(legacyKey)).toBe(legacyRaw);
  });

  it.each([workspaceKey, legacyKey])('protects unreadable saved data at %s and pauses autosave', async key => {
    const raw = '{my plan was truncated';
    localStorage.setItem(key, raw);
    const store = await boot();
    expect(store.getState().persistenceBlocked).toBe(true);
    expect(store.getState().recoverySource).toBe(raw);
    expect(store.getState().persistenceError).toContain('Autosave is paused');
    store.getState().updateRack({ name: 'Unsaved recovery view' });
    store.getState().saveLocal();
    expect(localStorage.getItem(key)).toBe(raw);
    if (key === legacyKey) expect(localStorage.getItem(workspaceKey)).toBeNull();
  });

  it('pauses saving when browser storage cannot be read', async () => {
    const original = localStorage.getItem;
    const read = vi.spyOn(localStorage, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === workspaceKey || key === legacyKey) throw new Error('Browser storage unavailable');
      return original.call(this, key);
    });
    try {
      const store = await boot();
      expect(store.getState().persistenceBlocked).toBe(true);
      store.getState().saveLocal();
      expect(localStorage.length).toBe(0);
    } finally { read.mockRestore(); }
  });

  it('does not replace unreadable workspace data with a valid legacy plan', async () => {
    const raw = '{bad workspace';
    localStorage.setItem(workspaceKey, raw);
    localStorage.setItem(legacyKey, JSON.stringify(savedRack('old-legacy-rack')));
    const store = await boot();
    expect(store.getState().persistenceBlocked).toBe(true);
    expect(store.getState().recoverySource).toBe(raw);
    expect(store.getState().layout.id).not.toBe('old-legacy-rack');
    expect(localStorage.getItem(workspaceKey)).toBe(raw);
  });

  it.each([workspaceKey, legacyKey])('protects a saved unknown example marker version at %s', async key => {
    const invalid = { ...savedRack(), example: { version: 2, sampleId: 'future-example' } };
    const raw = JSON.stringify(key === workspaceKey ? { ...savedWorkspace(), racks: [invalid] } : invalid);
    localStorage.setItem(key, raw);
    const store = await boot();
    expect(store.getState().persistenceBlocked).toBe(true);
    expect(store.getState().persistenceError).toContain('example.version');
    expect(store.getState().recoverySource).toBe(raw);
    store.getState().saveLocal();
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('loads all legacy and learning IDs without sharing canonical nested objects', async () => {
    const store = await boot();
    const { sampleLayouts, learningSampleLayouts, beginnerSample } = await import('../data/sampleLayouts');
    for (const sample of [...sampleLayouts, ...learningSampleLayouts]) {
      const canonical = JSON.stringify(sample);
      store.getState().loadSample(sample.id);
      expect(store.getState().layout.id).toBe(sample.id);
      expect(store.getState().layout.devices).not.toBe(sample.devices);
      const loadedDevice = store.getState().layout.devices.find(device => device.ports);
      expect(loadedDevice).toBeDefined();
      loadedDevice!.ports!.power = 999;
      expect(JSON.stringify(sample)).toBe(canonical);
      store.getState().loadSample(sample.id);
      expect(store.getState().layout.devices.some(device => device.ports?.power === 999)).toBe(false);
      expect(JSON.stringify(sample)).toBe(canonical);
    }
    expect(beginnerSample.id).toBe('learn-beginner-10in');
  });

  it('replaces only the current rack when loading an example and leaves unknown IDs unchanged', async () => {
    localStorage.setItem(workspaceKey, JSON.stringify(savedWorkspace()));
    const store = await boot();
    const otherRack = store.getState().workspace.racks[1];
    store.getState().loadSample('learn-beginner-10in');
    expect(store.getState().layout.id).toBe('learn-beginner-10in');
    expect(store.getState().workspace.racks).toHaveLength(2);
    expect(store.getState().workspace.racks[1]).toEqual(otherRack);
    const before = store.getState().layout;
    store.getState().loadSample('unknown-example-id');
    expect(store.getState().layout).toBe(before);
  });

  it('gives repeated example loads in distinct rack slots independent IDs and preserves siblings after edits and reload', async () => {
    const store = await boot();
    const first = store.getState().layout;
    store.getState().createRack('Second rack', '10in', 6);
    store.getState().loadSample('learn-beginner-10in');
    const second = store.getState().layout;
    expect(second.id).not.toBe(first.id);
    expect(second.example?.sampleId).toBe(first.example?.sampleId);
    expect(store.getState().workspace.racks).toHaveLength(2);
    store.getState().updateRack({ name: 'Only second rack changed' });
    store.getState().saveLocal();
    expect(store.getState().workspace.racks.find(rack => rack.id === first.id)?.name).toBe(first.name);
    vi.resetModules();
    const reloaded = await boot();
    const racks = reloaded.getState().workspace.racks;
    expect(new Set(racks.map(rack => rack.id)).size).toBe(2);
    expect(racks.find(rack => rack.id === first.id)?.name).toBe(first.name);
    expect(racks.find(rack => rack.id === second.id)?.name).toBe('Only second rack changed');
  });
});

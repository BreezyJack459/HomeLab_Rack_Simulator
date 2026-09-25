import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeWorkspace, useRackStore } from './rackStore';
import { exportWorkspaceJson, importWorkspaceJson } from '../utils/exporters';
import { getRackResizeImpact } from '../utils/rackResize';
import { validateImportedLayout } from '../utils/layoutValidation';
import type { RackLayout } from '../types/rack';

const key = 'homelab-rack-simulator-workspace';
const fixture = (): RackLayout => ({
  id: 'recovery', name: 'Recovery', rackType: '19in', heightU: 12, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'front', updatedAt: '',
  devices: [
    { id: 'zero', name: 'Unsupported PDU', category: 'pdu-0u', positionU: 1, sizeU: 0,
      xMm: -55, depthMm: 500, widthType: 'custom', customWidthMm: 55, weightKg: 2,
      powerW: 0, heatLevel: 1, color: '#333', ports: { power: 8 }, extension: { untouched: true } },
    { id: 'top', name: 'Top server', category: 'server', positionU: 10, sizeU: 2,
      depthMm: 300, widthType: '19in', weightKg: 2, powerW: 100, heatLevel: 2, color: '#333' },
  ],
  cables: [{ id: 'power', fromDeviceId: 'zero', toDeviceId: 'top', type: 'power', color: '#333',
    nodes: [{ kind: 'port', deviceId: 'zero', x: -55, y: 1, z: 1 }], extension: { routing: 'future' } }],
  reservations: [{ id: 'space', name: 'Future space', positionU: 12, sizeU: 3, mountSide: 'rear', widthType: '19in', purpose: 'other', extension: [1, 2] }],
  services: [{ id: 'service', name: 'NAS', criticality: 'high', hostDeviceId: 'top' }],
  extension: { future: ['zero'] },
} as unknown as RackLayout);

beforeEach(() => { useRackStore.setState({ persistenceError: null, recoverySource: null, persistenceBlocked: false, pendingRackResize: null }); localStorage.clear(); useRackStore.getState().newLayout(); });
afterEach(() => vi.restoreAllMocks());

describe('lossless recovery', () => {
  it('preserves disabled hardware, attached cables, reservations and extensions on import/load/export', () => {
    const input = fixture();
    useRackStore.getState().loadLayout(input);
    const loaded = useRackStore.getState().layout;
    expect(loaded.devices[0]).toEqual(input.devices[0]);
    expect(loaded.cables).toEqual(input.cables);
    expect(loaded.reservations).toEqual(input.reservations);
    expect(loaded).toMatchObject({ extension: { future: ['zero'] } });
    const workspace = useRackStore.getState().workspace;
    const imported = importWorkspaceJson(exportWorkspaceJson(workspace))!;
    expect(imported.racks[0]).toEqual(loaded);
    expect(normalizeWorkspace(imported)).toEqual(imported);
    expect(useRackStore.getState().loadWorkspace()).toBe(true);
    expect(useRackStore.getState().layout).toEqual(loaded);
  });

  it('keeps valid inter-rack links attached to disabled hardware', () => {
    const rack = fixture();
    rack.devices[0] = { ...rack.devices[0], ports: { power: 8, ethernet: 4 } };
    const other = { ...fixture(), id: 'other', devices: [{ ...fixture().devices[1], id: 'peer', ports: { ethernet: 4 } }], cables: [], reservations: [] };
    const link = { id: 'link', fromRackId: rack.id, fromDeviceId: 'zero', fromPort: { type: 'ethernet' as const, index: 0 }, toRackId: other.id, toDeviceId: 'peer', toPort: { type: 'ethernet' as const, index: 0 }, type: 'cat6a' as const };
    const ws = normalizeWorkspace({ id: 'ws', name: 'Lab', racks: [rack, other], interRackCables: [link], updatedAt: '' });
    expect(ws.interRackCables).toHaveLength(1);
    useRackStore.getState().setWorkspace(ws);
    useRackStore.getState().setRackHeight(6);
    useRackStore.getState().resolveRackResize('retain');
    useRackStore.getState().loadWorkspace();
    expect(useRackStore.getState().workspace.interRackCables[0]).toMatchObject(link);
  });

  it('preflights shrink; cancel changes neither model nor persisted JSON', () => {
    useRackStore.getState().loadLayout(fixture());
    const before = useRackStore.getState().layout;
    const saved = localStorage.getItem(key);
    useRackStore.getState().setRackHeight(6);
    expect(useRackStore.getState().layout).toBe(before);
    expect(useRackStore.getState().pendingRackResize).not.toBeNull();
    useRackStore.getState().resolveRackResize('cancel');
    expect(useRackStore.getState().layout).toBe(before);
    expect(localStorage.getItem(key)).toBe(saved);
  });

  it('retains all records outside bounds through undo, redo and reload', () => {
    useRackStore.getState().loadLayout(fixture());
    const before = useRackStore.getState().layout;
    useRackStore.getState().setRackHeight(6);
    useRackStore.getState().resolveRackResize('retain');
    expect(useRackStore.getState().layout).toMatchObject({ heightU: 6, devices: before.devices, reservations: before.reservations, services: before.services });
    expect(useRackStore.getState().layout.cables.map(({ nodes: _nodes, ...cable }) => cable))
      .toEqual(before.cables.map(({ nodes: _nodes, ...cable }) => cable));
    useRackStore.getState().undo();
    expect(useRackStore.getState().layout).toEqual(before);
    useRackStore.getState().redo();
    useRackStore.getState().loadWorkspace();
    expect(useRackStore.getState().layout).toMatchObject({ heightU: 6, devices: before.devices, reservations: before.reservations });
  });

  it('updateRack cannot bypass preflight or apply other patch fields before confirmation', () => {
    useRackStore.getState().loadLayout(fixture());
    useRackStore.getState().updateRack({ heightU: 6, name: 'Resized' });
    expect(useRackStore.getState().layout.name).toBe('Recovery');
    expect(useRackStore.getState().layout.heightU).toBe(12);
    useRackStore.getState().resolveRackResize('retain');
    expect(useRackStore.getState().layout).toMatchObject({ heightU: 6, name: 'Resized' });
  });

  it('reports quota failure without changing canonical data and clears only after successful save', () => {
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('private details', 'QuotaExceededError'); });
    useRackStore.getState().loadLayout(fixture());
    expect(useRackStore.getState().persistenceError).toBeTruthy();
    expect(JSON.stringify(useRackStore.getState().persistenceError)).not.toContain('private details');
    expect(useRackStore.getState().layout.devices).toHaveLength(2);
    write.mockRestore();
    useRackStore.getState().saveWorkspace();
    expect(useRackStore.getState().persistenceError).toBeNull();
  });

  it('preserves extensions through the shared import validator', () => {
    const result = validateImportedLayout(fixture());
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.layout).toMatchObject({ extension: { future: ['zero'] }, services: fixture().services });
  });

  it('reports oversized writes and protects oversized saved input', () => {
    useRackStore.getState().loadLayout(fixture());
    const saved = localStorage.getItem(key);
    useRackStore.getState().updateRack({ name: 'x'.repeat(10 * 1024 * 1024 + 1) });
    expect(useRackStore.getState().persistenceError).toContain('not saved');
    expect(localStorage.getItem(key)).toBe(saved);
    const raw = ' '.repeat(10 * 1024 * 1024 + 1);
    localStorage.setItem(key, raw);
    expect(useRackStore.getState().loadWorkspace()).toBe(false);
    expect(useRackStore.getState().recoverySource).toBe(raw);
    expect(useRackStore.getState().persistenceBlocked).toBe(true);
  });

  it('migrates legacy disabled data without discarding originals', () => {
    localStorage.removeItem(key);
    localStorage.setItem('homelab-rack-simulator-layout', JSON.stringify(fixture()));
    expect(useRackStore.getState().loadLocal()).toBe(true);
    expect(useRackStore.getState().layout.devices[0]).toEqual(fixture().devices[0]);
    expect(JSON.parse(localStorage.getItem(key)!).racks[0].reservations).toEqual(fixture().reservations);
  });

  it('invalid imported records fail before mutating the current layout', () => {
    const before = useRackStore.getState().layout;
    expect(() => useRackStore.getState().loadLayout({ ...fixture(), reservations: [null] } as unknown as RackLayout)).toThrow();
    expect(useRackStore.getState().layout).toBe(before);
  });

  it('identifies dependent records and inter-rack links without exposing record contents', () => {
    const layout = fixture();
    layout.credentials = [{ id: 'credential', deviceId: 'top', label: 'private', value: 'secret', type: 'password' }];
    const ws = { ...useRackStore.getState().workspace, racks: [layout], interRackCables: [{ id: 'link', fromRackId: layout.id, fromDeviceId: 'top', fromPort: { type: 'ethernet' as const, index: 0 }, toRackId: 'other', toDeviceId: 'other-device', toPort: { type: 'ethernet' as const, index: 0 }, type: 'cat6a' as const }] };
    const impact = getRackResizeImpact(layout, 6, ws);
    expect(impact.devices.map(d => d.id)).toEqual(['top']);
    expect(impact.interRackCables.map(c => c.id)).toEqual(['link']);
    expect(impact.dependentRecords).toEqual(['services[0]', 'credentials[0]']);
    expect(JSON.stringify(impact.dependentRecords)).not.toContain('private');
  });

  it('rejects stale shrink confirmation and invalid heights', () => {
    useRackStore.getState().loadLayout(fixture());
    useRackStore.getState().setRackHeight(6);
    useRackStore.getState().updateRack({ name: 'Changed while reviewing' });
    useRackStore.getState().resolveRackResize('retain');
    expect(useRackStore.getState().layout.heightU).toBe(12);
    for (const height of [NaN, Infinity, 0, -1, 1.5]) useRackStore.getState().setRackHeight(height);
    expect(useRackStore.getState().layout.heightU).toBe(12);
  });

  it.each(['{broken', '{"id":"bad","racks":[]}'])('protects unreadable saved data from autosave: %s', (raw) => {
    localStorage.setItem(key, raw);
    expect(useRackStore.getState().loadWorkspace()).toBe(false);
    expect(useRackStore.getState().persistenceError).toBeTruthy();
    useRackStore.getState().updateRack({ name: 'Unsaved changes' });
    useRackStore.getState().saveWorkspace();
    expect(localStorage.getItem(key)).toBe(raw);
    expect(useRackStore.getState().recoverySource).toBe(raw);
  });
});

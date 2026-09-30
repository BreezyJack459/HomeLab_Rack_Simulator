import { checkInterRackConnectors } from '../utils/interRackCables';
import { beforeEach, describe, expect, it } from 'vitest';
import type { InterRackCable, MediaType, PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { normalizeWorkspace, useRackStore } from './rackStore';
import { exportWorkspaceJson, importWorkspaceJson } from '../utils/exporters';

const device = (id: string): PlacedDevice => ({
  id, name: id, category: 'switch', positionU: 1, sizeU: 1, depthMm: 200,
  widthType: '19in', weightKg: 2, powerW: 20, heatLevel: 1, color: '#333',
  ports: { ethernet: 4, fiber: 2 },
});
const rack = (id: string): RackLayout => ({
  id, name: id, rackType: '19in', heightU: 12, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'front',
  devices: [device(`${id}-switch`), { ...device(`${id}-other`), positionU: 2 }], cables: [], updatedAt: '',
});
const workspace = (): Workspace => ({ id: 'ws', name: 'Lab', racks: [rack('a'), rack('b')], interRackCables: [], updatedAt: '' });
const link = (patch: Partial<InterRackCable> = {}): InterRackCable => ({
  id: 'link', fromRackId: 'a', fromDeviceId: 'a-switch', fromPort: { type: 'ethernet', index: 0 },
  toRackId: 'b', toDeviceId: 'b-switch', toPort: { type: 'ethernet', index: 0 }, type: 'cat6a', ...patch,
});
const state = () => useRackStore.getState();
beforeEach(() => { state().setWorkspace(workspace()); });

describe('inter-rack graph integrity', () => {
  it('rejects same-rack endpoints', () => {
    state().addInterRackCable(link({ toRackId: 'a', toDeviceId: 'a-other' }));
    expect(state().workspace.interRackCables).toHaveLength(0);
  });
  it('rejects duplicate and reversed occupied endpoints, including omitted faces', () => {
    state().addInterRackCable(link());
    state().addInterRackCable(link({ fromPort: { type: 'ethernet', index: 0, side: 'front' } }));
    state().addInterRackCable(link({ fromRackId: 'b', fromDeviceId: 'b-switch', toRackId: 'a', toDeviceId: 'a-switch' }));
    expect(state().workspace.interRackCables).toHaveLength(1);
  });
  it.each(['regular', 'reserved'] as const)('rejects %s endpoint claims', (claim) => {
    const ws = workspace();
    if (claim === 'regular') ws.racks[0].cables.push({ id: 'local', fromDeviceId: 'a-other', toDeviceId: 'a-switch', fromPort: { type: 'ethernet', index: 1 }, toPort: { type: 'ethernet', index: 0 }, type: 'ethernet', color: '#333' });
    else ws.racks[0].portReservations = [{ id: 'reserved', deviceId: 'a-switch', portType: 'ethernet', portIndex: 0, purpose: 'Future' }];
    state().setWorkspace(ws);
    state().addInterRackCable(link());
    expect(state().workspace.interRackCables).toHaveLength(0);
  });
  it.each(['sfp+', 'dac', 'fiber'] as const)('%s rejects Ethernet and accepts fiber ports', (type) => {
    state().addInterRackCable(link({ type }));
    expect(state().workspace.interRackCables).toHaveLength(0);
    state().addInterRackCable(link({ type, fromPort: { type: 'fiber', index: 0 }, toPort: { type: 'fiber', index: 0 } }));
    expect(state().workspace.interRackCables).toHaveLength(1);
  });
  it.each([
    ['cat6a', 'fiber', 'ethernet'], ['sfp+', 'sfp', 'fiber'], ['dac', 'fiber', 'fiber'], ['fiber', 'rj45', 'fiber'],
  ] as const)('rejects %s on explicit %s media', (type, mediaType, portType) => {
    const ws = workspace();
    ws.racks[0].devices[0].portLayouts = { front: [{ type: portType, count: portType === 'fiber' ? 2 : 4, mediaType }] };
    state().setWorkspace(ws);
    state().addInterRackCable(link({ type, fromPort: { type: portType, index: 0 }, toPort: { type: portType, index: 0 } }));
    expect(state().workspace.interRackCables).toHaveLength(0);
  });
  it('rejects mismatched DAC connector families', () => {
    const ws = workspace();
    ws.racks.forEach((r, i) => { r.devices[0].portLayouts = { front: [{ type: 'fiber', count: 2, mediaType: (i ? 'qsfp+' : 'sfp+') as MediaType }] }; });
    state().setWorkspace(ws);
    state().addInterRackCable(link({ type: 'dac', fromPort: { type: 'fiber', index: 0 }, toPort: { type: 'fiber', index: 0 } }));
    expect(state().workspace.interRackCables).toHaveLength(0);
  });
  it.each([-1, 0.5, 4, NaN])('rejects invalid port index %s', (index) => {
    state().addInterRackCable(link({ fromPort: { type: 'ethernet', index } }));
    expect(state().workspace.interRackCables).toHaveLength(0);
  });
  it('rejects invalid edits without changing the existing link', () => {
    state().addInterRackCable(link());
    const saved = state().workspace.interRackCables[0];
    state().updateInterRackCable(saved.id, { type: 'dac' });
    expect(state().workspace.interRackCables[0]).toEqual(saved);
    state().updateInterRackCable(saved.id, { label: 'Renamed' });
    expect(state().workspace.interRackCables[0].label).toBe('Renamed');
  });
  it.each(['a', 'b'])('deleting endpoint device in rack %s removes link and selection', (id) => {
    state().addInterRackCable(link());
    state().selectInterRackCable(state().workspace.interRackCables[0].id);
    state().switchRack(id);
    state().removeDevice(`${id}-switch`);
    expect(state().workspace.interRackCables).toHaveLength(0);
    expect(state().selectedInterRackCableId).toBeNull();
  });
  it.each(['a', 'b'])('deleting rack %s removes link and selection', (id) => {
    state().addInterRackCable(link());
    state().selectInterRackCable(state().workspace.interRackCables[0].id);
    state().deleteRack(id);
    expect(state().workspace.interRackCables).toHaveLength(0);
    expect(state().selectedInterRackCableId).toBeNull();
  });
  it('regular creation cannot steal an inter-rack endpoint', () => {
    state().addInterRackCable(link());
    const route = { fromDeviceId: 'a-switch', toDeviceId: 'a-other', fromPort: { type: 'ethernet' as const, index: 0 }, toPort: { type: 'ethernet' as const, index: 0 }, type: 'ethernet' as const, color: '#333' };
    state().addCable(route);
    state().addCables([route]);
    expect(state().layout.cables).toHaveLength(0);
    expect(state().workspace.interRackCables).toHaveLength(1);
  });
  it('normalizes legacy regular port faces when detecting occupied ports', () => {
    const ws = workspace();
    // Non-patch-panel faces are resolved by the category map, even if an old
    // regular cable carries a stale side field.
    ws.racks[0].cables = [{ id: 'regular', fromDeviceId: 'a-switch', toDeviceId: 'a-other',
      fromPort: { type: 'ethernet', index: 0, side: 'rear' }, toPort: { type: 'ethernet', index: 0 }, type: 'ethernet', color: '#333' }];
    state().setWorkspace(ws);
    state().addInterRackCable(link());
    expect(state().workspace.interRackCables).toHaveLength(0);
  });
  it('regular edits cannot steal an inter-rack endpoint through a stale side field', () => {
    state().addInterRackCable(link({ fromPort: { type: 'ethernet', index: 0, side: 'front' } }));
    state().addCable({ fromDeviceId: 'a-switch', toDeviceId: 'a-other', fromPort: { type: 'ethernet', index: 1 }, toPort: { type: 'ethernet', index: 0 }, type: 'ethernet', color: '#333' });
    const local = state().layout.cables[0];
    state().updateCable(local.id, { fromPort: { type: 'ethernet', index: 0, side: 'rear' } });
    expect(state().layout.cables[0]).toEqual(local);
    expect(state().workspace.interRackCables).toHaveLength(1);
  });
  it('keeps independent front and rear patch-panel jacks distinct', () => {
    const ws = workspace();
    ws.racks.forEach(r => { r.devices[0].category = 'patch-panel'; });
    state().setWorkspace(ws);
    for (const side of ['front', 'rear'] as const) {
      state().addInterRackCable(link({ fromPort: { type: 'ethernet', index: 0, side }, toPort: { type: 'ethernet', index: 0, side } }));
    }
    expect(state().workspace.interRackCables).toHaveLength(2);
    state().addInterRackCable(link());
    expect(state().workspace.interRackCables).toHaveLength(2);
  });
  it('rejects an explicit incorrect face and missing port references on import', () => {
    state().addInterRackCable(link({ fromPort: { type: 'ethernet', index: 0, side: 'rear' } }));
    expect(state().workspace.interRackCables).toHaveLength(0);
    const ws = workspace();
    ws.interRackCables = [link({ fromPort: undefined })];
    expect(importWorkspaceJson(exportWorkspaceJson(ws))!.interRackCables).toHaveLength(0);
  });
  it('clears selected links after explicit removal', () => {
    state().addInterRackCable(link());
    const id = state().workspace.interRackCables[0].id;
    state().selectInterRackCable(id);
    state().removeInterRackCable(id);
    expect(state().selectedInterRackCableId).toBeNull();
  });
  it('normalizes import/export and load round trips, retaining only valid unique links', () => {
    const ws = workspace();
    ws.interRackCables = [link({ id: 'ghost', toDeviceId: 'missing' }), link(), link({ id: 'duplicate' }), link({ id: 'same', toRackId: 'a' })];
    expect(normalizeWorkspace(ws).interRackCables.map(c => c.id)).toEqual(['link']);
    const imported = importWorkspaceJson(exportWorkspaceJson(ws))!;
    expect(imported.interRackCables.map(c => c.id)).toEqual(['link']);
    localStorage.setItem('homelab-rack-simulator-workspace', JSON.stringify(ws));
    expect(state().loadWorkspace()).toBe(true);
    expect(state().workspace.interRackCables.map(c => c.id)).toEqual(['link']);
  });
});


it('blocks known connector conflicts, preserves existing conflicts and isolates repeated device ids across racks', () => {
  const ws = workspace();
  for (const r of ws.racks) {
    r.devices[0].id = 'same-id';
    r.devices[0].portConnectionSpecs = { 'ethernet:front:0': { connector: r.id === 'a' ? 'RJ45' : 'M12', role: 'bidirectional' } };
  }
  const route = link({ fromDeviceId: 'same-id', toDeviceId: 'same-id', socketFit: { from: 'RJ45', to: 'RJ45' } });
  state().setWorkspace(ws);
  expect(state().addInterRackCable(route)).toBe(false);
  expect(checkInterRackConnectors(ws, route).conflicts.join(' ')).toContain('M12');
  const recorded = { ...route, socketFit: { from: 'RJ45', to: 'M12' } };
  expect(checkInterRackConnectors(ws, recorded).status).toBe('recorded-match');
  expect(state().addInterRackCable(recorded)).toBe(true);
  expect(importWorkspaceJson(exportWorkspaceJson(state().workspace))?.interRackCables[0].socketFit).toEqual(recorded.socketFit);
  const conflicted = normalizeWorkspace({ ...ws, interRackCables: [route] });
  expect(conflicted.interRackCables).toEqual([route]);
  expect(checkInterRackConnectors(conflicted, route).status).toBe('conflict');
  expect(checkInterRackConnectors(ws, { ...route, socketFit: undefined }).status).toBe('unverified');
});

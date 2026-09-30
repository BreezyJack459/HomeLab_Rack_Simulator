import { beforeEach, expect, it } from 'vitest';
import { useRackStore } from './rackStore';
import type { PlacedDevice, RackLayout, Workspace } from '../types/rack';

const device = (id: string): PlacedDevice => ({ id, name: id, category: 'switch', sizeU: 1, positionU: 1, widthType: '19in', depthMm: 100, weightKg: 1, powerW: 10, heatLevel: 1, color: '#333', ports: { ethernet: 1 }, powerReviewed: true });
const fixture = (): Workspace => {
  const source = { ...device('same'), poeInputMode: 'includes-poe' as const, poeBudgetW: 30, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse' as const, poeLimitW: 30, poeProfile: 'Pair' } } };
  const receiver = { ...device('same'), portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd' as const, poeRequiredW: 20, poeDrawW: 10, poeProfile: 'Pair' } } };
  const rack: RackLayout = { id: 'a', name: 'A', rackType: '19in', heightU: 12, rackDepthMm: 600, weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'front', updatedAt: '', devices: [source], cables: [] };
  return { id: 'ws', name: 'Review', updatedAt: '', racks: [rack, { ...rack, id: 'b', devices: [receiver] }, { ...rack, id: 'c', devices: [device('same')] }], interRackCables: [{ id: 'poe', fromRackId: 'a', fromDeviceId: 'same', toRackId: 'b', toDeviceId: 'same', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, type: 'cat6a', poe: true }] };
};

beforeEach(() => { expect(useRackStore.getState().setWorkspace(fixture())).toBe(true); });

it('invalidates local input changes in a single undo entry and permits explicit re-review', () => {
  const store = useRackStore.getState();
  const prior = store.history.length;
  store.updateDevice('same', { poeEfficiencyPct: 80 });
  expect(useRackStore.getState().layout.devices[0].powerReviewed).toBe(false);
  expect(useRackStore.getState().history.length).toBe(prior + 1);
  useRackStore.getState().updateDevice('same', { powerReviewed: true });
  expect(useRackStore.getState().layout.devices[0].powerReviewed).toBe(true);
  useRackStore.getState().updateDevice('same', { poeEfficiencyPct: 90 });
  useRackStore.getState().undo();
  expect(useRackStore.getState().layout.devices[0]).toMatchObject({ poeEfficiencyPct: 80, powerReviewed: true });
  useRackStore.getState().redo();
  expect(useRackStore.getState().layout.devices[0]).toMatchObject({ poeEfficiencyPct: 90, powerReviewed: false });
});

it('invalidates the remote source after receiver draw edits and persists it without touching unrelated same-id devices', () => {
  useRackStore.getState().switchRack('b');
  const receiver = useRackStore.getState().layout.devices[0];
  useRackStore.getState().updateDevice('same', { portConnectionSpecs: { 'ethernet:front:0': { ...receiver.portConnectionSpecs!['ethernet:front:0'], poeDrawW: 15 } } });
  const workspace = useRackStore.getState().workspace;
  expect(workspace.racks.map(r => r.devices[0].powerReviewed)).toEqual([false, false, true]);
  expect(JSON.parse(localStorage.getItem('homelab-rack-simulator-workspace')!).racks[0].devices[0].powerReviewed).toBe(false);
});

it('preserves reviews on cosmetic edits, but clears them on PoE link removal and keeps imported reviews', () => {
  useRackStore.getState().updateDevice('same', { name: 'Renamed', color: '#444' });
  useRackStore.getState().updateInterRackCable('poe', { label: 'New label', color: '#555' });
  expect(useRackStore.getState().workspace.racks.every(r => r.devices[0].powerReviewed)).toBe(true);
  useRackStore.getState().removeInterRackCable('poe');
  expect(useRackStore.getState().workspace.racks.map(r => r.devices[0].powerReviewed)).toEqual([false, false, true]);
  expect(useRackStore.getState().setWorkspace(fixture())).toBe(true);
  expect(useRackStore.getState().workspace.racks.every(r => r.devices[0].powerReviewed)).toBe(true);
});

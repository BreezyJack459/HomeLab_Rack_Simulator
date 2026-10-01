import { buildBom } from '../src/utils/bom';
import { beforeEach, describe, expect, it } from 'vitest';
import { planABCables, type ABRequest, abSocketKey } from '../src/utils/abCablePlanner';
import { useRackStore } from '../src/store/rackStore';
import { tidyPanelCables } from '../src/utils/panelCableTidy';
import { buildRackSceneModel } from '../src/utils/rackSceneModel';
import { getCableLengthRequirements } from '../src/utils/cableLengthRequirements';
import { autoWireLayout } from '../src/utils/autoWire';
import { abDevice, abFixture, abWorkspace } from './fixtures/abCableFixture';
import type { CableRoute, RackLayout } from '../src/types/rack';
const req = (mode: ABRequest['mode'] = 'two-panels', a = 'Switch A', b = 'Switch B'): ABRequest => ({ from: { deviceId: a, port: { type: 'ethernet', index: 0 } }, to: { deviceId: b, port: { type: 'ethernet', index: 0 } }, mode });
const plan = (l: RackLayout, r = req()) => planABCables(l, abWorkspace(l), r);
beforeEach(() => { localStorage.clear(); useRackStore.getState().loadLayout(abFixture()); });

describe('A–B graph and atomic application', () => {
  it('reuses mismatched rear jack numbers without changing the installed trunk', () => {
    const l = abFixture(), result = plan(l), first = result.plans[0];
    expect(first, result.message).toBeDefined(); expect(first.newCount).toBe(2); expect(first.reusedCount).toBe(1);
    expect(first.steps.filter(s => s.kind === 'internal')).toHaveLength(2);
    expect(first.steps.find(s => s.kind === 'reuse')?.cable).toBe(l.cables[0]);
    expect(first.steps.filter(s => s.kind === 'internal').map(s => s.from.port.index)).toEqual([2, 6]);
  });
  it('supports direct and one-panel routes without internally joining switch sockets', () => {
    const l = abFixture(); expect(plan(l, req('direct')).plans[0].steps).toHaveLength(1);
    const one = plan(l, req('one-panel', 'Server', 'Switch A')).plans[0];
    expect(one).toBeDefined(); expect(one.newCount).toBe(2);
    expect(one.steps.filter(s => s.kind === 'internal').every(s => s.from.deviceId.startsWith('Panel'))).toBe(true);
  });
  it('uses explicit patch-cord intent for server-to-switch across the installed rear backbone', () => {
    const l = abFixture(), result = plan(l, req('two-panels', 'Server', 'Switch B'));
    expect(result.plans[0].reusedCount).toBe(1);
    expect(result.plans[0].steps.filter(s => s.kind === 'new').every(s => s.cable?.installationRole === 'patch-cord')).toBe(true);
    expect(result.plans[0].steps.find(s => s.kind === 'reuse')?.cable).toBe(l.cables[0]);
  });
  it('applies all missing segments in one undo, preserves physical data and repeats harmlessly', () => {
    const state = useRackStore.getState(), initial = state.layout, first = plan(initial).plans[0], history = state.historyIndex;
    expect(state.applyABPlan(first)).toBe(true);
    expect(useRackStore.getState().layout.cables).toHaveLength(3);
    expect(useRackStore.getState().layout.cables[0]).toBe(initial.cables[0]);
    expect(useRackStore.getState().layout.cables.slice(1).every(c => c.lifecycleStatus === 'planned' && c.lengthMm === undefined)).toBe(true);
    expect(useRackStore.getState().historyIndex).toBe(history + 1);
    expect(state.applyABPlan(first)).toBe(true); expect(useRackStore.getState().layout.cables).toHaveLength(3);
    useRackStore.getState().undo(); expect(useRackStore.getState().layout.cables).toHaveLength(1);
    useRackStore.getState().redo(); expect(useRackStore.getState().layout.cables).toHaveLength(3);
    const connected = plan(useRackStore.getState().layout).plans[0]; expect(connected.newCount).toBe(0); expect(connected.reusedCount).toBe(3);
  });
  it('reconstructs full existing paths after backup JSON reload without extra cables or BOM hops', () => {
    useRackStore.getState().applyABPlan(plan(useRackStore.getState().layout).plans[0]);
    const snapshot = JSON.parse(JSON.stringify(useRackStore.getState().workspace));
    useRackStore.getState().loadLayout(snapshot.racks[0]);
    const l = useRackStore.getState().layout, existing = plan(l).plans[0];
    expect(existing.newCount).toBe(0); expect(getCableLengthRequirements(l).size).toBe(3);
    expect(buildBom(l).reduce((n, line) => n + line.count, 0)).toBe(3);
    const before = useRackStore.getState().historyIndex;
    expect(useRackStore.getState().applyABPlan(existing)).toBe(true); expect(useRackStore.getState().historyIndex).toBe(before);
  });
  it('rejects stale geometry or occupancy atomically, including double confirm after another edit', () => {
    const p = plan(useRackStore.getState().layout).plans[0];
    useRackStore.getState().updateDevice('Switch A', { positionU: 2 });
    const before = useRackStore.getState().layout;
    expect(useRackStore.getState().applyABPlan(p)).toBe(false); expect(useRackStore.getState().layout).toBe(before);
    const fresh = plan(before).plans[0]; expect(useRackStore.getState().applyABPlan(fresh)).toBe(true);
    useRackStore.getState().updateDevice('Switch A', { name: 'Renamed switch' });
    expect(useRackStore.getState().applyABPlan(fresh)).toBe(false); expect(useRackStore.getState().layout.cables).toHaveLength(3);
  });
  it('rejects tampered previews even with an unchanged fingerprint', () => {
    const p = structuredClone(plan(useRackStore.getState().layout).plans[0]); p.steps.find(s => s.kind === 'new')!.cable!.toPort!.index = 100;
    expect(useRackStore.getState().applyABPlan(p)).toBe(false); expect(useRackStore.getState().layout.cables).toHaveLength(1);
  });
  it('never silently rewires occupied endpoints and rejects ambiguous multiply claimed sockets', () => {
    const l = abFixture(); l.cables.push({ id: 'other', fromDeviceId: 'Switch A', fromPort: { type: 'ethernet', index: 0 }, toDeviceId: 'Server', toPort: { type: 'ethernet', index: 0 }, type: 'ethernet', color: '#fff' });
    expect(plan(l).plans).toHaveLength(0);
    l.cables.push({ ...l.cables[1], id: 'duplicate' }); expect(plan(l, req('direct', 'Switch A', 'Server')).plans).toHaveLength(0);
  });
  it('blocks reserved sockets and inter-rack claims including unspecified legacy faces', () => {
    const l = abFixture(); l.portReservations = [{ id: 'reserve', deviceId: 'Switch A', portType: 'ethernet', portIndex: 0, purpose: 'future' }];
    expect(plan(l).plans).toHaveLength(0); l.portReservations = [];
    const w = abWorkspace(l); w.interRackCables = [{ id: 'external', fromRackId: l.id, fromDeviceId: 'Switch A', fromPort: { type: 'ethernet', index: 0 }, toRackId: 'other', toDeviceId: 'sw', toPort: { type: 'ethernet', index: 0 }, type: 'cat6a' }];
    expect(planABCables(l, w, req()).plans).toHaveLength(0);
    w.interRackCables[0].fromDeviceId = 'Panel 1'; w.interRackCables[0].fromPort!.index = 2;
    expect(planABCables(l, w, req()).plans.every(p => p.reusedCount === 0)).toBe(true);
  });
  it('keeps unknown specs honest and rejects incompatible connectors/media without speed-only rejection', () => {
    const l = abFixture(); expect(plan(l).plans[0].unknownCount).toBeGreaterThan(0);
    l.devices[0].portConnectionSpecs = { 'ethernet:front:0': { connector: 'SFP', role: 'passive' } };
    expect(plan(l).plans).toHaveLength(0);
    l.devices[0].portConnectionSpecs = undefined;
    l.devices[0].portLayouts = { front: [{ type: 'ethernet', count: 8, speed: '1G', mediaType: 'rj45' }] }; l.devices[3].portLayouts = { front: [{ type: 'ethernet', count: 8, speed: '10G', mediaType: 'rj45' }] };
    expect(plan(l, req('direct')).plans).not.toHaveLength(0);
  });
  it('handles no path, removed sockets and loops deterministically', () => {
    const l = abFixture(); l.devices[0].ports = { ethernet: 0 }; expect(plan(l).plans).toHaveLength(0);
    l.devices[0].ports = { ethernet: 8 }; l.cables.push({ id: 'cycle', fromDeviceId: 'Panel 1', fromPort: { type: 'ethernet', index: 2, side: 'front' }, toDeviceId: 'Panel 2', toPort: { type: 'ethernet', index: 6, side: 'front' }, type: 'ethernet', color: '#fff' });
    const a = plan(l), b = plan(l); expect(a).toEqual(b);
    expect(a.plans.every(p => new Set(p.steps.flatMap(s => [abSocketKey(l, s.from), abSocketKey(l, s.to)])).size === p.steps.length + 1)).toBe(true);
  });
});

describe('routing-only panel tidy', () => {
  const identity = (c: CableRoute) => { const { nodes: _nodes, manualPath: _path, routingOrigin: _origin, ...physical } = c; return physical; };
  it('preserves every endpoint, face, installed length, status and unrelated cable identity', () => {
    const l = abFixture(); const p = plan(l).plans[0]; l.cables.push(...p.steps.filter(s => s.kind === 'new').map((s, i) => ({ ...s.cable!, id: `new-${i}` })));
    l.cables.push({ id: 'unrelated', fromDeviceId: 'Switch A', fromPort: { type: 'ethernet', index: 1 }, toDeviceId: 'Server', toPort: { type: 'ethernet', index: 1 }, type: 'ethernet', color: '#fff' });
    const result = tidyPanelCables(l, 'Panel 1');
    expect(result.cables.map(identity)).toEqual(l.cables.map(identity)); expect(result.cables[result.cables.length - 1]).toBe(l.cables[l.cables.length - 1]);
    const again = tidyPanelCables({ ...l, cables: result.cables }, 'Panel 1'); expect(again.changed).toBe(0);
    expect(buildRackSceneModel({ ...l, cables: result.cables }).routes.map(r => r.cableId)).toEqual(buildRackSceneModel(l).routes.map(r => r.cableId));
  });
  it('keeps manual routes including obstructed anchors and reports no route honestly', () => {
    const l = abFixture(); l.cables[0].manualPath = [{ kind: 'manager', deviceId: 'missing', side: 'left' }];
    const result = tidyPanelCables(l, 'Panel 1'); expect(result.manualKept).toBe(1); expect(result.cables[0]).toBe(l.cables[0]);
    expect(tidyPanelCables(l, 'missing').changed).toBe(0);
  });
  it('repairs generated blocked routes, updates both views, and undoes all improvements together', () => {
    const l = abFixture(); l.cables[0] = { ...l.cables[0], routingOrigin: 'panel-tidy', manualPath: [{ kind: 'manager', deviceId: 'missing', side: 'left' }] };
    useRackStore.getState().loadLayout(l); const before = useRackStore.getState().historyIndex;
    useRackStore.getState().tidyPatchPanel('Panel 1'); const after = useRackStore.getState().layout;
    expect(useRackStore.getState().historyIndex).toBe(before + 1);
    expect(getCableLengthRequirements(after).get('installed-trunk')?.status).toBe('estimated');
    expect(after.cables.map(identity)).toEqual(l.cables.map(identity));
    expect(buildRackSceneModel(after, { routingMode: 'clean' }).routes[0].routingDecision.kind).not.toBe('blocked');
    expect(buildRackSceneModel(after, { routingMode: 'realistic' }).routes[0].routingDecision.kind).not.toBe('blocked');
    useRackStore.getState().tidyPatchPanel('Panel 1'); expect(useRackStore.getState().historyIndex).toBe(before + 1);
    useRackStore.getState().undo(); expect(useRackStore.getState().layout.cables[0].manualPath).toEqual(l.cables[0].manualPath);
    useRackStore.getState().redo(); expect(useRackStore.getState().layout.cables[0].manualPath).toEqual(after.cables[0].manualPath);
  });
  it('settles a multi-cable panel deterministically and is idempotent', () => {
    const l = abFixture(); l.cables = [];
    l.devices = [abDevice('Panel 1', 'patch-panel', 6), ...[1, 3, 9, 11].map((u, i) => abDevice(`sw-${i}`, 'switch', u))];
    l.cables = l.devices.slice(1).map((d, i) => ({ id: `c-${i}`, fromDeviceId: d.id, fromPort: { type: 'ethernet', index: 7 - i, side: 'front' }, toDeviceId: 'Panel 1', toPort: { type: 'ethernet', index: i, side: 'front' }, type: 'patch', color: '#fff' }));
    const first = tidyPanelCables(l, 'Panel 1'); expect(first).toEqual(tidyPanelCables(l, 'Panel 1'));
    const again = tidyPanelCables({ ...l, cables: first.cables }, 'Panel 1'); expect(again.changed).toBe(0);
  });
  it('reports no feasible route instead of changing missing socket records', () => {
    const l = abFixture(); l.cables[0].fromPort = { type: 'ethernet', side: 'rear', index: 999 };
    const result = tidyPanelCables(l, 'Panel 1'); expect(result.blocked).toBe(1); expect(result.changed).toBe(0);
  });
  it('adds at most one history entry and preserves routing on backup reload', () => {
    const l = useRackStore.getState().layout, initial = JSON.parse(JSON.stringify(l.cables)); const before = useRackStore.getState().historyIndex;
    useRackStore.getState().tidyPatchPanel('Panel 1'); const after = useRackStore.getState(); expect(after.historyIndex - before).toBeLessThanOrEqual(1);
    const snapshot = JSON.parse(JSON.stringify(after.layout)); useRackStore.getState().loadLayout(snapshot); expect(useRackStore.getState().layout.cables).toEqual(snapshot.cables);
    if (after.historyIndex > before) { useRackStore.getState().loadLayout(l); useRackStore.getState().tidyPatchPanel('Panel 1'); useRackStore.getState().undo(); expect(useRackStore.getState().layout.cables).toEqual(initial); }
  });
});

it('reserves proposed switch ports and PDU outlets during batch allocation, stopping at capacity', () => {
  const l = abFixture(); l.cables = []; l.devices = [abDevice('sw', 'switch', 1, 1), { ...abDevice('pdu', 'pdu', 3), ports: { power: 1 } }, ...[5, 7].map((u, i) => ({ ...abDevice(`server-${i}`, 'server', u, 1), ports: { power: 1, ethernet: 1 } }))];
  const result = autoWireLayout(l); expect(result.created).toBe(2); expect(result.skipped).toBe(2);
  expect(new Set(result.cables.map(c => `${c.toDeviceId}:${c.toPort?.type}:${c.toPort?.index}`)).size).toBe(2);
});

it('batch allocation respects external claims and reservations', () => {
  const l = abFixture(); l.cables = []; l.devices = [abDevice('sw', 'switch', 1, 3), abDevice('server', 'server', 4, 1)];
  l.portReservations = [{ id: 'reserved', deviceId: 'sw', portType: 'ethernet', portIndex: 1, purpose: 'future' }];
  const w = abWorkspace(l); w.interRackCables = [{ id: 'outside', fromRackId: l.id, fromDeviceId: 'sw', fromPort: { type: 'ethernet', index: 0 }, toRackId: 'other', toDeviceId: 'sw2', toPort: { type: 'ethernet', index: 0 }, type: 'cat6a' }];
  expect(autoWireLayout(l, { workspace: w, connectPower: false }).cables[0].toPort?.index).toBe(2);
});

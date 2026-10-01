import { getMigrationSummary } from './migrationCalc';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { planPatchChain, validateChainApply, type ChainRequest } from './patchChain';
import { useRackStore } from '../store/rackStore';
import { validateRackLayout } from './validation';
import { validateImportedLayout } from './layoutValidation';
import { installationRoleError } from './cableInstallation';
import { tidyPanelRoutes } from './panelTidy';
import { buildRackSceneModel } from './rackSceneModel';
import { buildBom } from './bom';
import { exportWorkspaceJson, parseWorkspaceJson } from './exporters';
import { getCableLengthRequirements } from './cableLengthRequirements';

export const chainFixture = () => {
  const device = (id: string, category: PlacedDevice['category'], u: number): PlacedDevice => ({ id, name: id, category, positionU: u, sizeU: 1, depthMm: 200, widthType: '19in', weightKg: 1, powerW: 20, heatLevel: 1, ports: { ethernet: category === 'patch-panel' ? 8 : 2 }, color: '#aaa' });
  const backbone: CableRoute = { id: 'backbone', label: 'Installed P1#3–P2#7', fromDeviceId: 'P1', fromPort: { type: 'ethernet', index: 2, side: 'rear' }, toDeviceId: 'P2', toPort: { type: 'ethernet', index: 6, side: 'rear' }, type: 'structured', color: '#aaa', lifecycleStatus: 'active', lengthMm: 5000, length: '5m' };
  const layout: RackLayout = { id: 'chain', name: 'chain', rackType: '19in', heightU: 12, rackDepthMm: 600, weightLimitKg: 200, powerBudgetW: 1200, viewSide: 'front', devices: [device('A', 'server', 2), device('B', 'switch', 9), device('P1', 'patch-panel', 4), device('P2', 'patch-panel', 7)], cables: [backbone], updatedAt: '2026-09-30' };
  const workspace: Workspace = { id: 'ws', name: 'ws', racks: [layout], interRackCables: [], updatedAt: layout.updatedAt };
  const request: ChainRequest = { from: { deviceId: 'A', port: { type: 'ethernet', index: 0 } }, to: { deviceId: 'B', port: { type: 'ethernet', index: 0 } }, panels: 2 };
  return { layout, workspace, request, backbone };
};

beforeEach(() => { localStorage.clear(); });
describe('A–B passive patch chain', () => {
  it('reuses mismatched rear jack numbers for realistic server → two panels → switch', () => {
    const { layout, workspace, request, backbone } = chainFixture();
    const plan = planPatchChain(layout, workspace, request).candidates[0];
    expect(plan.newCount).toBe(2); expect(plan.reusedCount).toBe(1);
    const reuse = plan.steps.find(s => s.kind === 'reuse');
    expect(reuse && reuse.kind !== 'internal' && reuse.cable).toBe(backbone);
    const adds = plan.steps.filter(s => s.kind === 'new').map(s => s.kind === 'new' && s.cable);
    expect(adds.every(c => c && c.installationRole === 'patch-cord')).toBe(true);
    const internal = plan.steps.filter(s => s.kind === 'internal');
    expect(internal.map(s => s.from.port.index).sort()).toEqual([2, 6]);
    const next = { ...layout, cables: [...layout.cables, ...adds.filter((c): c is CableRoute => Boolean(c))] };
    expect(validateRackLayout(next).filter(i => /patch-front-endpoint|patch-rear-switch|installation-role|patch-invalid-pair/.test(i.id))).toEqual([]);
    const legacy = { ...next, cables: next.cables.map(c => ({ ...c, installationRole: undefined })) };
    expect(validateRackLayout(legacy).some(i => i.id.startsWith('patch-front-endpoint'))).toBe(true);
  });
  it('supports direct and one panel, without passive transit through switch sockets', () => {
    const { layout, workspace, request } = chainFixture();
    for (const panels of [0, 1] as const) expect(planPatchChain(layout, workspace, { ...request, panels }).candidates.length).toBeGreaterThan(0);
    expect(planPatchChain({ ...layout, devices: layout.devices.filter(d => d.category !== 'patch-panel') }, workspace, request).candidates).toEqual([]);
  });
  it('blocks occupied endpoint and never rewires a fixed link', () => {
    const { layout, workspace, request } = chainFixture();
    layout.cables.push({ id: 'occupied', fromDeviceId: 'A', fromPort: request.from.port, toDeviceId: 'B', toPort: { type: 'ethernet', index: 1 }, type: 'ethernet', color: '#aaa' });
    expect(planPatchChain(layout, workspace, request).candidates).toEqual([]);
  });
  it('blocks reservations and inter-rack occupancy including reused links', () => {
    const { layout, workspace, request } = chainFixture();
    layout.portReservations = [{ id: 'reserved', deviceId: 'A', portType: 'ethernet', portIndex: 0, purpose: 'future' }];
    expect(planPatchChain(layout, workspace, request).candidates).toEqual([]);
    layout.portReservations = [];
    workspace.interRackCables.push({ id: 'inter', fromRackId: layout.id, fromDeviceId: 'A', fromPort: request.from.port, toRackId: 'elsewhere', toDeviceId: 'outside', toPort: { type: 'ethernet', index: 0 }, type: 'cat6a' });
    expect(planPatchChain(layout, workspace, request).candidates).toEqual([]);
  });
  it('keeps unknown specs honest and rejects known connector/media conflicts', () => {
    const { layout, workspace, request } = chainFixture();
    expect(planPatchChain(layout, workspace, request).candidates[0].unknownCount).toBeGreaterThan(0);
    layout.devices[0].portConnectionSpecs = { 'ethernet:rear:0': { connector: 'LC' } };
    expect(planPatchChain(layout, workspace, request).candidates).toEqual([]);
  });
  it('rejects stale preview atomically, and repeats confirmation without duplication', () => {
    const { layout, workspace, request, backbone } = chainFixture();
    useRackStore.getState().loadLayout(layout);
    const s = useRackStore.getState();
    const plan = planPatchChain(s.layout, s.workspace, request).candidates[0];
    expect(s.applyPatchChain(plan)).toBe(true);
    const after = useRackStore.getState(); expect(after.layout.cables.length).toBe(3);
    expect(after.layout.cables.find(c => c.id === backbone.id)).toEqual(s.layout.cables[0]);
    expect(after.history.length).toBe(s.history.length + 1);
    expect(after.applyPatchChain(plan)).toBe(true); expect(useRackStore.getState().layout.cables.length).toBe(3);
    after.undo(); expect(useRackStore.getState().layout.cables.length).toBe(1);
    after.redo(); expect(useRackStore.getState().layout.cables.length).toBe(3);
    expect(planPatchChain(useRackStore.getState().layout, useRackStore.getState().workspace, request).candidates[0].newCount).toBe(0);
    const saved = JSON.parse(JSON.stringify(useRackStore.getState().layout));
    expect(validateImportedLayout(saved).valid).toBe(true);
    useRackStore.getState().loadLayout(saved);
    expect(planPatchChain(useRackStore.getState().layout, useRackStore.getState().workspace, request).candidates[0].reusedCount).toBe(3);
    expect(getCableLengthRequirements(useRackStore.getState().layout).size).toBe(3);
    const stale = planPatchChain(layout, workspace, request).candidates[0];
    const shifted = { ...layout, devices: layout.devices.map(d => d.id === 'P1' ? { ...d, positionU: 5 } : d) };
    useRackStore.getState().loadLayout(shifted);
    expect(useRackStore.getState().applyPatchChain(stale)).toBe(false);
    expect(useRackStore.getState().layout.cables.length).toBe(1);
    expect(validateChainApply(shifted, workspace, stale).status).toBe('invalid');
  });
  it('rejects malformed and falsely declared installation roles on import and store writes', () => {
    const { layout, workspace, request } = chainFixture();
    const c = planPatchChain(layout, workspace, request).candidates[0].steps.find(s => s.kind === 'new');
    if (!c || c.kind !== 'new') throw Error('missing');
    for (const installationRole of ['wrong', 'permanent-link']) {
      const bad = { ...c.cable, installationRole } as CableRoute;
      expect(installationRoleError(layout, bad)).toBeTruthy();
      expect(validateImportedLayout({ ...layout, cables: [...layout.cables, bad] }).valid).toBe(false);
      useRackStore.getState().loadLayout(layout); useRackStore.getState().addCable(bad);
      expect(useRackStore.getState().layout.cables.length).toBe(1);
    }
  });
  it('bounded deterministic search survives panel cycles and occupied no-path layouts', () => {
    const { layout, workspace, request } = chainFixture();
    layout.cables.push({ id: 'cycle', fromDeviceId: 'P1', fromPort: { type: 'ethernet', index: 2, side: 'front' }, toDeviceId: 'P2', toPort: { type: 'ethernet', index: 6, side: 'front' }, type: 'patch', color: '#aaa' });
    const a = planPatchChain(layout, workspace, request), b = planPatchChain(layout, workspace, request);
    expect(a.candidates.map(p => p.key)).toEqual(b.candidates.map(p => p.key));
    expect(a.candidates.every(p => p.steps.filter(s => s.kind === 'internal').length === 2)).toBe(true);
  });
});

describe('routing-only panel tidy', () => {
  it('preserves identities/endpoints/physical lengths and manual/unrelated routes; repeats stably', () => {
    const { layout, workspace, request } = chainFixture();
    const plan = planPatchChain(layout, workspace, request).candidates[0];
    layout.cables.push(...plan.steps.flatMap(s => s.kind === 'new' ? [{ ...s.cable, id: `new-${s.from.deviceId}` }] : []));
    const manual = { ...layout.cables[1], id: 'manual', manualPath: [] }; layout.cables.push(manual);
    const result = tidyPanelRoutes(layout, 'P1');
    expect(result.manual).toBe(1);
    const identity = (c: CableRoute) => ({ ...c, nodes: undefined, routingOrigin: undefined, manualPath: undefined });
    expect(result.cables.map(identity)).toEqual(layout.cables.map(identity));
    expect(result.cables.find(c => c.id === 'manual')).toBe(manual);
    expect(tidyPanelRoutes({ ...layout, cables: result.cables }, 'P1').changed).toBe(0);
    const next = { ...layout, cables: result.cables };
    expect(validateImportedLayout(JSON.parse(JSON.stringify(next))).valid).toBe(true);
    for (const routingMode of ['clean', 'realistic'] as const) expect(buildRackSceneModel(next, { routingMode }).routes.map(r => r.cableId)).toEqual(buildRackSceneModel(layout, { routingMode }).routes.map(r => r.cableId));
  });
});

describe('additional atomic and persistence regressions', () => {
  it('exports/restores the complete workspace backup and BOM contains physical segments only', () => {
    const { layout, request } = chainFixture();
    useRackStore.getState().loadLayout(layout);
    const s = useRackStore.getState();
    s.applyPatchChain(planPatchChain(s.layout, s.workspace, request).candidates[0]);
    const next = useRackStore.getState();
    const restored = parseWorkspaceJson(exportWorkspaceJson(next.workspace));
    const rack = restored.racks.find(r => r.id === next.layout.id)!;
    expect(rack.cables.filter(c => c.installationRole === 'patch-cord')).toHaveLength(2);
    expect(planPatchChain(rack, restored, request).candidates[0].newCount).toBe(0);
    expect(getMigrationSummary(rack).plannedCables).toHaveLength(2);
    expect(getMigrationSummary(rack).activeCables[0]).toMatchObject({ id: 'backbone', lengthMm: 5000 });
    expect(buildBom(rack).reduce((n, line) => n + line.count, 0)).toBe(3);
  });
  it('does not partially apply a preview when sockets or reservations change', () => {
    const { layout, request } = chainFixture(); useRackStore.getState().loadLayout(layout);
    const s = useRackStore.getState(), plan = planPatchChain(s.layout, s.workspace, request).candidates[0];
    useRackStore.setState({ layout: { ...s.layout, portReservations: [{ id: 'r', deviceId: 'B', portIndex: 0, portType: 'ethernet', purpose: 'reserved' }] } });
    const current = useRackStore.getState(), history = current.history.length;
    expect(current.applyPatchChain(plan)).toBe(false);
    expect(useRackStore.getState().layout.cables).toHaveLength(1);
    expect(useRackStore.getState().history.length).toBe(history);
  });
  it('routing tidy creates one undo and preserves actual length even when derived route changes', () => {
    const { layout } = chainFixture();
    layout.cables[0] = { ...layout.cables[0], routingOrigin: 'panel-tidy', manualPath: [{ kind: 'channel', side: 'left', face: 'rear', positionU: 4 }, { kind: 'channel', side: 'left', face: 'rear', positionU: 7 }] };
    useRackStore.getState().loadLayout(layout);
    const before = useRackStore.getState(); before.tidyPatchPanel('P1');
    const after = useRackStore.getState();
    expect(after.layout.cables[0].lengthMm).toBe(5000);
    expect(after.history.length).toBe(before.history.length + 1);
    const result = JSON.stringify(after.layout.cables);
    after.tidyPatchPanel('P1'); expect(JSON.stringify(useRackStore.getState().layout.cables)).toBe(result);
    expect(useRackStore.getState().history.length).toBe(after.history.length);
    after.undo(); expect(useRackStore.getState().layout.cables[0].manualPath).toEqual(before.layout.cables[0].manualPath);
    after.redo(); expect(JSON.stringify(useRackStore.getState().layout.cables)).toBe(result);
  });
  it('reports no feasible route without changing an orphan cable', () => {
    const { layout } = chainFixture(); layout.cables[0] = { ...layout.cables[0], toDeviceId: 'missing', routingOrigin: 'panel-tidy', manualPath: [{ kind: 'channel', side: 'left', face: 'rear', positionU: 4 }] };
    const result = tidyPanelRoutes(layout, 'P1');
    expect(result.blocked).toBe(1); expect(result.changed).toBe(0); expect(result.cables).toBe(layout.cables);
  });
  it('rejects explicit incompatible media and supports speed differences without claiming network verification', () => {
    const { layout, workspace, request } = chainFixture();
    layout.devices[0].portLayouts = { rear: [{ type: 'ethernet', count: 2, mediaType: 'sfp+', speed: '10G' }] };
    expect(planPatchChain(layout, workspace, request).candidates).toEqual([]);
    layout.devices[0].portLayouts!.rear![0].mediaType = 'rj45';
    layout.devices[1].portLayouts = { front: [{ type: 'ethernet', count: 2, mediaType: 'rj45', speed: '1G' }] };
    expect(planPatchChain(layout, workspace, request).candidates.length).toBeGreaterThan(0);
  });
});

describe('socket topology integrity', () => {
  it('does not invent a panel face for a legacy ambiguous physical cable', () => {
    const { layout, workspace, request } = chainFixture();
    layout.cables[0].fromPort!.side = undefined;
    const plans = planPatchChain(layout, workspace, request).candidates;
    expect(plans.every(p => p.steps.every(s => s.kind !== 'reuse'))).toBe(true);
  });
  it('rejects nonexistent custom-layout sockets and tampered preview topology', () => {
    const { layout, workspace, request } = chainFixture();
    const plan = planPatchChain(layout, workspace, request).candidates[0];
    expect(validateChainApply(layout, workspace, { ...plan, steps: [] }).status).toBe('invalid');
    layout.devices[0].portLayouts = { rear: [{ type: 'ethernet', count: 1 }] };
    expect(planPatchChain(layout, workspace, { ...request, from: { ...request.from, port: { type: 'ethernet', index: 1 } } }).candidates).toEqual([]);
  });
});

it('reports bounded search on large fully reserved panels instead of looping', () => {
  const { layout, workspace, request } = chainFixture();
  layout.portReservations = [];
  for (const d of layout.devices.filter(d => d.category === 'patch-panel')) {
    d.ports = { ethernet: 128 };
    for (let portIndex = 0; portIndex < 128; portIndex++) layout.portReservations.push({ id: `${d.id}-${portIndex}`, deviceId: d.id, portIndex, portType: 'ethernet', purpose: 'future' });
  }
  const result = planPatchChain(layout, workspace, request);
  expect(result.bounded).toBe(true); expect(result.candidates).toEqual([]);
});

it('reuses the rear backbone with valid recorded RJ45 metadata while leaving network operation unverified', () => {
  const { layout, workspace, request } = chainFixture();
  for (const d of layout.devices) {
    d.portConnectionSpecs = {};
    const count = d.ports!.ethernet!;
    for (const face of ['front', 'rear'] as const) for (let i = 0; i < count; i++) d.portConnectionSpecs[`ethernet:${face}:${i}`] = { connector: 'RJ45', role: d.category === 'patch-panel' ? 'passive' : 'bidirectional' };
    d.portLayouts = { [d.category === 'switch' || d.category === 'patch-panel' ? 'front' : 'rear']: [{ type: 'ethernet', count, mediaType: 'rj45', speed: '1G' }] };
  }
  layout.cables[0].socketFit = { from: 'RJ45', to: 'RJ45' };
  const result = planPatchChain(layout, workspace, request), first = result.candidates[0];
  expect(first.reusedCount).toBe(1); expect(first.newCount).toBe(2);
  expect(first.steps.filter(s => s.kind === 'new').every(s => s.kind === 'new' && s.cable.installationRole === 'patch-cord')).toBe(true);
  expect(result.message).toContain('network/VLAN operation is unverified');
  expect(first.steps.flatMap(s => s.kind === 'internal' ? [] : s.unknowns).some(s => s.includes('socket connector is unspecified'))).toBe(false);
});

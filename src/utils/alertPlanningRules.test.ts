import { describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice, RackLayout, PlanningGoals } from '../types/rack';
import { validateRackLayout } from './validation';
import { checkPowerRedundancy, buildPowerTopology, simulateOutletFailure } from './powerChain';
import { evaluatePolicies } from './policyEngine';
import { getCableStrainRisks, getServiceabilityIssues } from './serviceability';
import { getPlanningGoals } from './planningGoals';

const goals = (patch: Partial<PlanningGoals> = {}): PlanningGoals => ({ version: 1, power: 'unspecified', remoteRecovery: 'optional', serviceMotion: 'unspecified', ...patch });
const device = (id: string, patch: Partial<PlacedDevice> = {}): PlacedDevice => ({ id, name: id, category: 'server', positionU: 2, sizeU: 1, depthMm: 300, widthType: '19in', weightKg: 2, powerW: 100, heatLevel: 1, color: '#333', ports: { power: 2, ethernet: 24 }, ...patch });
const cable = (id: string, source: string, target: string, inlet: number): CableRoute => ({ id, type: 'power', fromDeviceId: source, toDeviceId: target, fromPort: { type: 'power', index: inlet }, toPort: { type: 'power', index: inlet }, color: '#333', lengthMm: 3000 });
const layout = (patch: Partial<RackLayout> = {}): RackLayout => ({ id: 'rack', name: 'rack', rackType: '19in', heightU: 12, rackDepthMm: 800, weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'front', updatedAt: '2026-09-30', devices: [], cables: [], ...patch });
const ab = (): RackLayout => layout({ devices: [device('server'), device('a', { category: 'pdu', powerW: 0, positionU: 8, circuit: 'A' }), device('b', { category: 'pdu', powerW: 0, positionU: 10, circuit: 'B' })], cables: [cable('a-s', 'a', 'server', 0), cable('b-s', 'b', 'server', 1)] });

describe('intent-based rack planning', () => {
  it.each(['10in', '19in'] as const)('keeps 24 idle optional network sockets neutral in %s and does not mutate a legacy layout', (rackType) => {
    const plan = layout({ rackType, devices: [device('switch', { category: 'switch', widthType: rackType })] });
    const before = JSON.stringify(plan);
    const findings = validateRackLayout(plan);
    expect(findings.filter(finding => /disconnect|unconnected|unused|redundancy|remote-recovery/.test(finding.ruleId ?? ''))).toEqual([]);
    expect(getPlanningGoals(plan)).toEqual(goals());
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('requires a second feed only when A/B intent is explicit', () => {
    const plan = ab(); plan.cables.pop();
    expect(validateRackLayout(plan).filter(finding => finding.ruleId === 'power-independent-ab')).toEqual([]);
    plan.planningGoals = goals({ power: 'single' });
    expect(validateRackLayout(plan).filter(finding => finding.ruleId === 'power-independent-ab')).toEqual([]);
    plan.planningGoals = goals({ power: 'independent-ab' });
    expect(validateRackLayout(plan).find(finding => finding.ruleId === 'power-independent-ab')?.status).toBe('fail');
  });

  it('detects an explicitly required but entirely absent feed while allowing a single-power device override', () => {
    const plan = ab(); plan.planningGoals = goals({ power: 'independent-ab' }); plan.cables = [];
    expect(validateRackLayout(plan).find(finding => finding.ruleId === 'power-independent-ab')).toMatchObject({ status: 'fail', deviceIds: ['server'] });
    plan.devices[0].planningGoals = { version: 1, power: 'single' };
    expect(validateRackLayout(plan).some(finding => finding.ruleId === 'power-independent-ab')).toBe(false);
  });

  it('accepts independently labeled feeds on the same physical rack side', () => {
    const plan = ab(); plan.planningGoals = goals({ power: 'independent-ab' });
    plan.devices[1].spatialZone = 'side-left'; plan.devices[2].spatialZone = 'side-left';
    expect(checkPowerRedundancy(plan)[0].status).toBe('pass');
    expect(validateRackLayout(plan).some(finding => finding.id.startsWith('dual-psu-split') || finding.ruleId === 'power-independent-ab')).toBe(false);
  });

  it('does not contaminate valid A/B paths with an unrelated bad outgoing source cable', () => {
    const plan = ab(); plan.planningGoals = goals({ power: 'independent-ab' });
    plan.devices.push(device('other', { ports: { power: 1 }, positionU: 4 }));
    plan.cables.push({ ...cable('bad', 'a', 'other', 0), powerSourceDeviceId: 'other' });
    expect(buildPowerTopology(plan).warningFindings.find(finding => finding.cableIds?.includes('bad'))?.status).toBe('fail');
    expect(checkPowerRedundancy(plan).find(result => result.device.id === 'server')?.status).toBe('pass');
  });

  it('keeps a blocked downstream PDU unenergized without contaminating a sibling A/B branch', () => {
    const plan = ab(); plan.planningGoals = goals({ power: 'independent-ab' });
    plan.devices[1].portConnectionSpecs = { 'power:rear:1': { role: 'output', powerKind: 'dc', nominalVoltageV: 12 } };
    plan.devices.push(device('downstream', { category: 'pdu', powerW: 0, positionU: 5, portConnectionSpecs: { 'power:rear:0': { role: 'input', powerKind: 'dc', nominalVoltageV: 24 } } }));
    plan.cables.push({ ...cable('blocked', 'a', 'downstream', 0), fromPort: { type: 'power', index: 1 } });
    const topology = buildPowerTopology(plan);
    expect(topology.roots.map(source => source.id)).toEqual(['a', 'b']);
    expect(topology.edges.some(edge => edge.targetId === 'downstream')).toBe(false);
    expect(checkPowerRedundancy(plan).find(result => result.device.id === 'server')?.status).toBe('pass');
  });

  it('scopes surviving supply capacity certainty to its own reachable load path', () => {
    const plan = ab();
    plan.devices[1].powerCapacityW = 500; plan.devices[2].powerCapacityW = 500;
    plan.devices.push(device('unrelated', { category: 'pdu', powerW: 0, positionU: 5 }), device('other', { positionU: 6 }));
    plan.cables.push({ ...cable('unrelated-bad', 'unrelated', 'other', 0), powerSourceDeviceId: 'other' });
    const result = simulateOutletFailure(plan, 'a', 0)!;
    expect(result.remainingSupplies.find(source => source.id === 'b')?.status).toBe('within-rating');
    expect(result.warnings.some(warning => warning.includes('unrelated-bad'))).toBe(true);
  });

  it('keeps missing PSU socket evidence unknown and shares goal/policy root identity', () => {
    const plan = ab(); plan.planningGoals = goals({ power: 'independent-ab' });
    plan.cables[0].toPort = undefined;
    plan.policies = [{ id: 'p', type: 'dual-psu-circuit-split', enabled: true, severity: 'critical', params: {} }];
    const core = validateRackLayout(plan).find(finding => finding.ruleId === 'power-independent-ab')!;
    const policy = evaluatePolicies(plan)[0];
    expect(core.status).toBe('unknown'); expect(policy.status).toBe('unknown');
    expect(core.rootCauseKey).toBe(policy.rootCauseKey);
  });

  it('normalizes default and explicit socket faces and rejects known invalid inlet indices', () => {
    const plan = ab(); plan.planningGoals = goals({ power: 'independent-ab' });
    plan.cables[1].toPort = { type: 'power', index: 0, side: 'rear' };
    expect(checkPowerRedundancy(plan)[0].status).toBe('fail');
    plan.cables[1].toPort = { type: 'power', index: 9, side: 'rear' };
    expect(checkPowerRedundancy(plan)[0].status).toBe('fail');
  });

  it('distinguishes disconnected service motion, unspecified motion and live cable travel', () => {
    const plan = ab(); plan.planningGoals = goals({ serviceMotion: 'detach-first' });
    plan.cables.forEach(item => { item.lengthMm = 50; });
    expect(getCableStrainRisks(plan)).toEqual([]);
    plan.planningGoals = goals();
    expect(getServiceabilityIssues(plan).filter(finding => finding.ruleId === 'service-cable-motion').every(finding => finding.status === 'unknown' && finding.applicability === 'optional')).toBe(true);
    plan.planningGoals = goals({ serviceMotion: 'live-with-cables' });
    expect(getServiceabilityIssues(plan).some(finding => finding.ruleId === 'service-cable-motion' && finding.status === 'fail')).toBe(true);
    const perCable = getServiceabilityIssues(plan).filter(finding => finding.cableIds?.includes('a-s'));
    expect(new Set(perCable.map(finding => finding.rootCauseKey)).size).toBe(1);
  });

  it('respects remote recovery overrides without inferring management from spare Ethernet ports', () => {
    const plan = layout({ planningGoals: goals(), devices: [device('server', { planningGoals: { version: 1, remoteRecovery: 'required' } })] });
    expect(validateRackLayout(plan).find(finding => finding.ruleId === 'remote-recovery-capability')).toMatchObject({ status: 'unknown', deviceIds: ['server'] });
    plan.planningGoals = goals({ remoteRecovery: 'required' }); plan.devices[0].planningGoals = { version: 1, remoteRecovery: 'optional' };
    expect(validateRackLayout(plan).some(finding => finding.ruleId === 'remote-recovery-capability')).toBe(false);
  });

  it('does not apply a rack recovery goal to passive shelves or panels', () => {
    const plan = layout({ planningGoals: goals({ remoteRecovery: 'required' }), devices: [device('server'), device('shelf', { category: 'shelf', powerW: 0 }), device('panel', { category: 'patch-panel', powerW: 0 })] });
    expect(validateRackLayout(plan).find(finding => finding.ruleId === 'remote-recovery-capability')?.deviceIds).toEqual(['server']);
    plan.devices[1].planningGoals = { version: 1, remoteRecovery: 'required' };
    expect(validateRackLayout(plan).find(finding => finding.ruleId === 'remote-recovery-capability')?.deviceIds).toEqual(['server', 'shelf']);
  });

  it('counts only valid unique Ethernet/fiber socket claims for switch headroom', () => {
    const plan = layout({ devices: [device('sw', { category: 'switch', ports: { ethernet: 4, fiber: 0, power: 20, usb: 20, hdmi: 20 } }), device('peer')], policies: [{ id: 'p', type: 'switch-port-free-percent', enabled: true, severity: 'warning', params: { minPercent: 30 } }] });
    plan.cables = [0, 1, 2, 2, 99].map((index, n) => ({ id: `c${n}`, type: 'ethernet', fromDeviceId: 'sw', toDeviceId: 'peer', fromPort: { type: 'ethernet', index }, color: '#333' }));
    plan.cables.push({ id: 'invalid-family', type: 'power', fromDeviceId: 'sw', toDeviceId: 'peer', fromPort: { type: 'ethernet', index: 3 }, color: '#333' });
    expect(evaluatePolicies(plan)[0].detail).toContain('25.0%');
    plan.cables = plan.cables.filter(item => item.fromPort?.index !== 2);
    expect(evaluatePolicies(plan)).toEqual([]);
  });

  it('never describes an unknown source rating as a passed finding', () => {
    expect(validateRackLayout(ab()).filter(finding => finding.id.startsWith('power-capacity-unknown')).every(finding => finding.status === 'unknown')).toBe(true);
  });
});

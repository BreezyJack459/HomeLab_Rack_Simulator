import { expect, it } from 'vitest';
import type { PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { summarizeFindings, issueMatchesCategory } from './findingSummary';
import { assessPoeBudgets, getPoeIssues } from './poeBudget';
import { validateImportedLayout } from './layoutValidation';

const device = (id: string): PlacedDevice => ({ id, name: id, category: 'switch', sizeU: 1, positionU: 1, widthType: '19in', depthMm: 100, weightKg: 1, powerW: 10, heatLevel: 1, color: '#333', ports: { ethernet: 2 } });
function fixture(): Workspace {
  const source = { ...device('source'), poeBudgetW: 30, portConnectionSpecs: {
    'ethernet:front:0': { poeRole: 'pse' as const, poeLimitW: 30, poeProfile: 'Recorded profile' },
    'ethernet:front:1': { poeRole: 'pse' as const, poeLimitW: 30, poeProfile: 'Recorded profile' },
  } };
  const receiver = { ...device('receiver'), portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd' as const, poeRequiredW: 20, poeProfile: 'Recorded profile' } } };
  const rack: RackLayout = { id: 'a', name: 'A', rackType: '19in', heightU: 12, rackDepthMm: 600, weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'front', updatedAt: '', devices: [source, receiver], cables: [{
    id: 'local', fromDeviceId: 'receiver', toDeviceId: 'source', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, type: 'ethernet', color: '#333', poe: true,
  }] };
  return { id: 'ws', name: 'Test', updatedAt: '', racks: [rack, { ...rack, id: 'b', devices: [structuredClone(receiver)], cables: [] }], interRackCables: [{ id: 'remote', fromRackId: 'a', fromDeviceId: 'source', fromPort: { type: 'ethernet', index: 1 }, toRackId: 'b', toDeviceId: 'receiver', toPort: { type: 'ethernet', index: 0 }, type: 'cat6a', poe: true }] };
}

it('sums explicit local and inter-rack allocations, normalizing reverse picks and rack-scoped ids', () => {
  const ws = fixture();
  const audit = assessPoeBudgets(ws);
  expect(audit.sources[0]).toMatchObject({ allocatedW: 40, budgetW: 30, status: 'overload' });
  expect(audit.links).toHaveLength(2);
  expect(audit.links.every(link => link.conflicts.length === 0 && link.unknowns.length === 0)).toBe(true);
  ws.racks[0].cables[0].poe = false;
  expect(assessPoeBudgets(ws).sources[0]).toMatchObject({ allocatedW: 20, status: 'within-budget' });
  ws.interRackCables[0].poe = false;
  expect(assessPoeBudgets(ws).links).toEqual([]);
});

it('distinguishes per-port conflict, profile conflict, unknown allocation and unknown role', () => {
  const ws = fixture();
  ws.racks[0].devices[0].portConnectionSpecs!['ethernet:front:0'].poeLimitW = 15;
  expect(assessPoeBudgets(ws).links[0].conflicts.join(' ')).toContain('5.00 W');
  ws.racks[0].devices[1].portConnectionSpecs!['ethernet:front:0'].poeProfile = 'Passive other profile';
  expect(assessPoeBudgets(ws).links[0].conflicts.join(' ')).toContain('profiles differ');
  ws.racks[0].devices[1].portConnectionSpecs!['ethernet:front:0'].poeRequiredW = undefined;
  expect(assessPoeBudgets(ws).sources[0].status).toBe('unverified');
  ws.racks[0].devices[1].portConnectionSpecs!['ethernet:front:0'].poeRole = undefined;
  expect(assessPoeBudgets(ws).links[0].unknowns.join(' ')).toContain('PSE and one PD');
  ws.racks[0].cables[0].fromPort!.index = 99;
  expect(assessPoeBudgets(ws).links[0].conflicts.join(' ')).toContain('recorded Ethernet socket');
});

it('preserves valid PoE metadata and rejects invalid imported watts or intent', () => {
  const rack = fixture().racks[0];
  expect(validateImportedLayout(JSON.parse(JSON.stringify(rack))).valid).toBe(true);
  expect(validateImportedLayout({ ...rack, cables: [{ ...rack.cables[0], poe: 'yes' }] }).valid).toBe(false);
  expect(validateImportedLayout({ ...rack, devices: [{ ...rack.devices[0], poeBudgetW: -1 }] }).valid).toBe(false);
  expect(validateImportedLayout({ ...rack, devices: [{ ...rack.devices[0], portConnectionSpecs: { 'ethernet:front:0': { poeRequiredW: Infinity } } }] }).valid).toBe(false);
});


it('surfaces cross-rack budget failures with an explicit source-rack edit target', () => {
  const ws = fixture();
  const sourceIssues = getPoeIssues(ws, 'a');
  const receiverIssues = getPoeIssues(ws, 'b');
  expect(sourceIssues.find(i => i.title === 'PoE source budget exceeded')).toMatchObject({ status: 'fail', applicability: 'active', ruleId: 'power-poe-budget', severity: 'critical', deviceIds: ['source'], editTarget: { rackId: 'a', deviceId: 'source' } });
  expect(receiverIssues.find(i => i.title === 'PoE source budget exceeded')).toMatchObject({ status: 'fail', applicability: 'active', ruleId: 'power-poe-budget', severity: 'critical', deviceIds: [], editTarget: { rackId: 'a', deviceId: 'source' } });
  expect(receiverIssues[0].detail).toContain('10.00 W');
  const powerGroups = summarizeFindings(receiverIssues).groups.filter(group => group.issues.some(issue => issueMatchesCategory(issue, 'power')));
  expect(powerGroups.some(group => group.status === 'fail' && group.severity === 'critical' && group.section === 'confirmed')).toBe(true);
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeRequiredW = undefined;
  const missing = getPoeIssues(ws, 'b');
  expect(missing.find(i => i.title === 'PoE link power is unverified')).toMatchObject({ status: 'unknown', evidence: 'unverified', editTarget: { rackId: 'b', deviceId: 'receiver' } });
  expect(missing.find(i => i.title === 'PoE source budget is unverified')?.status).toBe('unknown');
});

it('traces cross-rack PoE failure paths without inventing live sources or merging same-id receivers', async () => {
  const { simulatePoeSourceFailure, powerDeviceKey } = await import('./poeFailure');
  const ws = fixture();
  const rack = ws.racks[0];
  const ups = { ...device('ups'), category: 'ups' as const, ports: { power: 2 } };
  rack.devices.push(ups);
  rack.cables.push({ id: 'feed', fromDeviceId: 'ups', toDeviceId: 'source', type: 'power', color: '#333' });
  const result = simulatePoeSourceFailure(ws, powerDeviceKey('a', 'ups'));
  expect(result.lost.map(d => d.key)).toEqual([powerDeviceKey('a', 'receiver'), powerDeviceKey('b', 'receiver')]);
  expect(result.warnings.join(' ')).toContain('budget exceeded');
  // An independent wired feed retains only the local receiver.
  rack.devices.push({ ...ups, id: 'backup' });
  rack.cables.push({ id: 'backup-feed', fromDeviceId: 'backup', toDeviceId: 'receiver', type: 'power', color: '#333' });
  const redundant = simulatePoeSourceFailure(ws, powerDeviceKey('a', 'source'));
  expect(redundant.retained.map(d => d.key)).toEqual([powerDeviceKey('a', 'receiver')]);
  expect(redundant.lost.map(d => d.key)).toEqual([powerDeviceKey('b', 'receiver')]);
  rack.cables = rack.cables.filter(c => c.type !== 'power');
  expect(simulatePoeSourceFailure(ws, powerDeviceKey('a', 'source')).untraced).toHaveLength(2);
  // Plain data links must never imply supplied power.
  rack.cables[0].poe = false;
  expect(simulatePoeSourceFailure(ws, powerDeviceKey('a', 'source')).untraced).toHaveLength(1);
});

it('includes cross-rack PoE draw and conversion loss once in UPS loads, and blocks unknown input assumptions', async () => {
  const { calculateUpsRuntimes } = await import('./upsRuntime');
  const { projectPoeInputLoads } = await import('./poeLoad');
  const ws = fixture();
  const rack = ws.racks[0];
  const pse = rack.devices[0];
  pse.poeBudgetW = 50;
  pse.poeInputMode = 'self-only';
  pse.poeEfficiencyPct = 80;
  rack.devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  rack.devices.push({ ...device('ups'), category: 'ups', portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' } }, powerW: 5, powerCapacityW: 100, batteryWh: 100, upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 100, chargePct: 100 } });
  rack.cables.push({ id: 'feed', type: 'power', fromPort: { type: 'power', index: 0 }, fromDeviceId: 'ups', toDeviceId: 'source', color: '#333' });
  // 10 W self-load + (8+12)/0.8 output input + 5 W UPS self-load.
  const runtime = calculateUpsRuntimes(rack, ws)[0];
  expect(runtime.loadW).toBe(40);
  expect(runtime.outputLoadW).toBe(35);
  expect(runtime.runtimeMinutes).toBe(150);
  expect(runtime.topologyUnverified).toBe(false);
  expect(pse.powerW).toBe(10); // projection never mutates saved values
  pse.poeInputMode = 'includes-poe';
  pse.powerW = 35;
  expect(calculateUpsRuntimes(rack, ws)[0].loadW).toBe(40);
  pse.powerW = 1;
  expect(calculateUpsRuntimes(rack, ws)[0].runtimeLabel).toBe('Not estimated');
  pse.powerW = 35;
  pse.poeInputMode = undefined;
  expect(calculateUpsRuntimes(rack, ws)[0].runtimeLabel).toBe('Not estimated');
  pse.poeInputMode = 'self-only';
  pse.poeEfficiencyPct = undefined;
  expect(projectPoeInputLoads(rack, ws).warnings.get('source')?.join(' ')).toContain('conversion efficiency');
  pse.poeEfficiencyPct = 80;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = undefined;
  expect(calculateUpsRuntimes(rack, ws)[0].runtimeLabel).toBe('Not estimated');
});

it('validates PoE input assumptions on import', () => {
  const rack = fixture().racks[0];
  const source = rack.devices[0];
  source.poeInputMode = 'self-only';
  source.poeEfficiencyPct = 90;
  expect(validateImportedLayout(rack).valid).toBe(true);
  source.poeEfficiencyPct = 0;
  expect(validateImportedLayout(rack).valid).toBe(false);
  source.poeEfficiencyPct = 101;
  expect(validateImportedLayout(rack).valid).toBe(false);
});

it('checks surviving outlet supplies against full cross-rack PoE input and refuses unknown-load passes', async () => {
  const { simulateOutletFailure } = await import('./powerChain');
  const ws = fixture();
  const rack = ws.racks[0];
  const source = rack.devices[0];
  source.poeBudgetW = 50;
  source.poeInputMode = 'self-only';
  source.poeEfficiencyPct = 80;
  rack.devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  for (const id of ['a', 'b']) rack.devices.push({ ...device(id), category: 'pdu', powerW: 0, powerCapacityW: 30, ports: { power: 2 } });
  rack.cables.push(...['a', 'b'].map(id => ({ id: `feed-${id}`, fromDeviceId: id, toDeviceId: 'source', type: 'power' as const, color: '#333', outletIndex: 0 })));
  const result = simulateOutletFailure(rack, 'a', 0, ws)!;
  expect(result.remainingSupplies.find(s => s.id === 'b')).toMatchObject({ loadW: 35, status: 'overload' });
  expect(result.totalLostW).toBe(0);
  rack.devices.find(d => d.id === 'b')!.powerCapacityW = 35;
  expect(simulateOutletFailure(rack, 'a', 0, ws)!.remainingSupplies.find(s => s.id === 'b')?.status).toBe('within-rating');
  source.poeEfficiencyPct = undefined;
  const unknown = simulateOutletFailure(rack, 'a', 0, ws)!;
  expect(unknown.remainingSupplies.find(s => s.id === 'b')?.status).toBe('unknown');
  expect(unknown.warnings.join(' ')).toContain('conversion efficiency');
  // Missing PoE data elsewhere does not invalidate an unloaded surviving PDU.
  expect(unknown.remainingSupplies.find(s => s.id === 'a')?.status).toBe('within-rating');
});

it('uses remote UPS energy and rack-scoped PoE reachability in both outage scenarios', async () => {
  const { runScenario } = await import('./scenarioPlanner');
  const ws = fixture();
  const sourceRack = ws.racks[0];
  const receiverRack = ws.racks[1];
  sourceRack.devices[0].poeBudgetW = 50;
  sourceRack.devices[0].poeInputMode = 'self-only';
  sourceRack.devices[0].poeEfficiencyPct = 80;
  sourceRack.devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  receiverRack.devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  sourceRack.devices.push({ ...device('ups'), category: 'ups', portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' } }, powerW: 5, powerCapacityW: 100, batteryWh: 100, upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 100, chargePct: 100 } });
  sourceRack.cables.push({ id: 'feed', type: 'power', fromPort: { type: 'power', index: 0 }, fromDeviceId: 'ups', toDeviceId: 'source', color: '#333' });
  const outage = runScenario(receiverRack, 'power-outage', ws);
  expect(outage.survivingDevices.map(d => d.deviceId)).toEqual(['receiver']);
  expect(outage.impactedDevices).toEqual([]);
  expect(outage.metrics.estimatedRuntimeMinutes).toBe(150);
  expect(runScenario(receiverRack, 'ups-battery-weak', ws).metrics.estimatedRuntimeMinutes).toBe(75);
  expect(sourceRack.devices.find(d => d.id === 'ups')!.batteryWh).toBe(100);
  const upsSocket = sourceRack.devices.find(d => d.id === 'ups')!.portConnectionSpecs!['power:rear:0'];
  for (const backup of ['surge-only', undefined] as const) {
    upsSocket.upsBackup = backup;
    const withoutBackup = runScenario(receiverRack, 'power-outage', ws);
    expect(withoutBackup.survivingDevices).toEqual([]);
    expect(withoutBackup.impactedDevices.map(d => d.deviceId)).toEqual(['receiver']);
    expect(withoutBackup.metrics.estimatedRuntimeMinutes).toBeUndefined();
    // The remote UPS still exists and supplies utility power: do not report "No UPS".
    expect(runScenario(receiverRack, 'ups-battery-weak', ws).summary).toContain('unverified');
  }
  upsSocket.upsBackup = 'battery';
  // A same-id source-rack receiver must not prove backup for an unconnected remote receiver.
  ws.interRackCables[0].poe = false;
  expect(runScenario(receiverRack, 'power-outage', ws).impactedDevices.map(d => d.deviceId)).toEqual(['receiver']);
  expect(runScenario(receiverRack, 'power-outage', ws).metrics.estimatedRuntimeMinutes).toBeUndefined();
  ws.interRackCables[0].poe = true;
  sourceRack.devices.find(d => d.id === 'ups')!.batteryWh = 1;
  expect(runScenario(receiverRack, 'ups-battery-weak', ws).impactedDevices.map(d => d.deviceId)).toContain('receiver');
  sourceRack.devices[0].poeEfficiencyPct = undefined;
  const unknown = runScenario(receiverRack, 'power-outage', ws);
  expect(unknown.metrics.estimatedRuntimeMinutes).toBeUndefined();
  expect(unknown.failedAssumptions.find(a => a.id === 'critical-on-ups')?.status).toBe('unknown');
});

it('unifies outlet failure with local and cross-rack PoE impacts without counting receivers twice', async () => {
  const { simulateWorkspaceOutletFailure } = await import('./poeFailure');
  const ws = fixture();
  ws.racks[1].name = 'B';
  const rack = ws.racks[0];
  rack.devices[0].poeBudgetW = 50;
  rack.devices[0].poeInputMode = 'self-only';
  rack.devices[0].poeEfficiencyPct = 80;
  rack.devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  for (const id of ['a', 'b']) rack.devices.push({ ...device(id), category: 'pdu', powerW: 0, powerCapacityW: 100, ports: { power: 2 } });
  rack.cables.push({ id: 'feed', fromDeviceId: 'source', toDeviceId: 'a', type: 'power', color: '#333', outletIndex: 0 });
  const lost = simulateWorkspaceOutletFailure(rack, 'a', 0, ws)!;
  expect(lost.poe.lost.map(d => d.name)).toEqual(['A / receiver', 'B / receiver']);
  expect(new Set(lost.poe.lost.map(d => d.key)).size).toBe(2);
  expect(lost.totalLostW).toBe(35);
  // An independent wired feed retains the local receiver only.
  rack.cables.push({ id: 'other', fromDeviceId: 'b', toDeviceId: 'receiver', type: 'power', color: '#333', outletIndex: 0 });
  const partial = simulateWorkspaceOutletFailure(rack, 'a', 0, ws)!;
  expect(partial.poe.lost.map(d => d.key)).toEqual([JSON.stringify(['b', 'receiver'])]);
  expect(partial.poe.retained.map(d => d.key)).toEqual([JSON.stringify(['a', 'receiver'])]);
  rack.cables.push({ id: 'alternate', fromDeviceId: 'b', toDeviceId: 'source', type: 'power', color: '#333', outletIndex: 1 });
  const retained = simulateWorkspaceOutletFailure(rack, 'a', 0, ws)!;
  expect(retained.poe.lost).toEqual([]);
  expect(retained.poe.retained).toHaveLength(2);
  expect(retained.totalLostW).toBe(0);
  // A free outlet must not list unrelated receivers as survivors.
  expect(simulateWorkspaceOutletFailure(rack, 'a', 1, ws)!.poe.retained).toEqual([]);
});

it('does not list a receiver as lost when PoE retains its supply after its wired inlet fails', async () => {
  const { simulateWorkspaceOutletFailure } = await import('./poeFailure');
  const ws = fixture();
  const rack = ws.racks[0];
  for (const id of ['a', 'b']) rack.devices.push({ ...device(id), category: 'pdu', powerW: 0, ports: { power: 2 } });
  rack.cables.push({ id: 'source-feed', fromDeviceId: 'a', toDeviceId: 'source', type: 'power', color: '#333', outletIndex: 0 });
  rack.cables.push({ id: 'receiver-feed', fromDeviceId: 'b', toDeviceId: 'receiver', type: 'power', color: '#333', outletIndex: 0 });
  const result = simulateWorkspaceOutletFailure(rack, 'b', 0, ws)!;
  expect(result.affectedDevices).toEqual([]);
  expect(result.downstreamDevices).toEqual([]);
  expect(result.survivingDevices.map(d => d.id)).toContain('receiver');
  expect(result.poe.retained.map(d => d.key)).toContain(JSON.stringify(['a', 'receiver']));
});

it('attributes PoE input to source racks without counting receiver planning watts twice', async () => {
  const { getRackTotals, validateRackLayout } = await import('./validation');
  const ws = fixture();
  const source = ws.racks[0].devices[0];
  source.poeBudgetW = 50;
  source.poeInputMode = 'self-only';
  source.poeEfficiencyPct = 80;
  ws.racks[0].devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  expect(getRackTotals(ws.racks[0], ws)).toMatchObject({ powerW: 35, devicePowerW: 20, powerInputUnverified: false, poeAttributedDevices: 1 });
  expect(getRackTotals(ws.racks[1], ws)).toMatchObject({ powerW: 0, devicePowerW: 10, powerInputUnverified: false });
  ws.racks[0].powerBudgetW = 30;
  expect(validateRackLayout(ws.racks[0], ws).find(i => i.id === 'power-limit')?.severity).toBe('critical');
  source.poeEfficiencyPct = undefined;
  expect(getRackTotals(ws.racks[1], ws).powerInputUnverified).toBe(true);
  expect(validateRackLayout(ws.racks[1], ws).find(i => i.id.startsWith('power-poe-input-'))?.editTarget).toEqual({ rackId: 'a', deviceId: 'source' });
  // An independent wired feed reserves full input even when a PoE path also exists.
  const local = ws.racks[1];
  local.devices.push({ ...device('pdu'), category: 'pdu', powerW: 0 });
  local.cables.push({ id: 'feed', type: 'power', fromDeviceId: 'pdu', toDeviceId: 'receiver', color: '#333' });
  expect(getRackTotals(local, ws).powerW).toBe(10);
});

it('keeps forecasts, fit checks, energy and portfolio input consistent with workspace PoE', async () => {
  const { analyzeCapacityForecast } = await import('./capacityForecast');
  const { checkDeviceFit } = await import('./fitCheck');
  const { calculateEnergySummary } = await import('./energyCalc');
  const { generatePortfolioMarkdown } = await import('./portfolioExport');
  const ws = fixture();
  const rack = ws.racks[0];
  rack.powerBudgetW = 70;
  rack.electricityRatePerKwh = 2;
  const source = rack.devices[0];
  source.poeBudgetW = 50;
  source.poeInputMode = 'self-only';
  source.poeEfficiencyPct = 80;
  rack.devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  expect(analyzeCapacityForecast(rack, ws).categories.find(c => c.category === 'power')?.current).toBe(35);
  const template = { ...device('new'), description: 'Test device', defaultU: 1, powerW: 40 };
  expect(checkDeviceFit(rack, template, undefined, ws)?.checks.power).toBe('fail');
  expect(checkDeviceFit(rack, template, undefined, ws)?.after.powerW).toBe(75);
  const energy = calculateEnergySummary(rack, ws);
  expect(energy.monthlyKwh).toBeCloseTo(25.55);
  expect(energy.monthlyCost).toBeCloseTo(51.1);
  expect(energy.heatUnverified).toBe(true);
  expect(Number.isNaN(energy.heatBtuPerHour)).toBe(true);
  expect(calculateEnergySummary(ws.racks[1], ws).monthlyKwh).toBe(0);
  const report = generatePortfolioMarkdown(rack, undefined, ws);
  expect(report).toContain('| Attributed Input | 35W / 70W budget |');
  expect(report).toContain('Not estimated for PoE layouts');
  source.poeEfficiencyPct = undefined;
  expect(analyzeCapacityForecast(rack, ws).categories.find(c => c.category === 'power')).toMatchObject({ unverified: true, estimatedDevicesUntilExhaustion: null, status: 'warning' });
  expect(checkDeviceFit(rack, template, undefined, ws)?.checks.power).toBe('warning');
  expect(Number.isNaN(calculateEnergySummary(rack, ws).monthlyKwh)).toBe(true);
  expect(generatePortfolioMarkdown(rack, undefined, ws)).toContain('| Monthly kWh | Not estimated |');
});

it('retains unresolved wired input beside PoE and withholds capacity, energy and UPS claims', async () => {
  const { getRackPowerSummary } = await import('./rackPower');
  const { calculateEnergySummary } = await import('./energyCalc');
  const { calculateUpsRuntimes } = await import('./upsRuntime');
  const { simulateOutletFailure } = await import('./powerChain');
  const ws = fixture();
  const rack = ws.racks[0];
  const source = rack.devices[0];
  source.poeBudgetW = 50;
  source.poeInputMode = 'self-only';
  source.poeEfficiencyPct = 80;
  rack.devices[1].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 8;
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeDrawW = 12;
  const receiver = rack.devices[1];
  receiver.ports = { ...receiver.ports, power: 1 };
  receiver.portFaceOverrides = { power: 'rear' };
  receiver.portConnectionSpecs!['power:rear:0'] = { role: 'input', powerKind: 'ac', nominalVoltageV: 120 };
  rack.devices.push({ ...device('ups'), category: 'ups', powerW: 0, batteryWh: 100, powerCapacityW: 100, ports: { power: 2 }, portFaceOverrides: { power: 'rear' }, portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery', role: 'output', powerKind: 'ac', nominalVoltageV: 230 } } });
  rack.cables.push({ id: 'conflict', fromDeviceId: 'ups', toDeviceId: 'receiver', type: 'power', color: '#333', fromPort: { type: 'power', index: 0, side: 'rear' }, toPort: { type: 'power', index: 0, side: 'rear' } });
  expect(getRackPowerSummary(rack, ws)).toMatchObject({ powerW: 45, powerInputUnverified: true, poeAttributedDevices: 0 });
  expect(Number.isNaN(calculateEnergySummary(rack, ws).monthlyKwh)).toBe(true);
  expect(calculateUpsRuntimes(rack, ws)[0].runtimeLabel).toBe('Not estimated');
  expect(simulateOutletFailure(rack, 'ups', 1, ws)!.remainingSupplies[0].status).toBe('unknown');
  receiver.portConnectionSpecs!['power:rear:0'].nominalVoltageV = 230;
  expect(getRackPowerSummary(rack, ws)).toMatchObject({ powerW: 45, powerInputUnverified: false });
  expect(calculateUpsRuntimes(rack, ws)[0].runtimeLabel).not.toBe('Not estimated');
});


it('keeps known PoE link conflicts separate from missing evidence and fingerprints relevant recorded profiles', () => {
  const ws = fixture();
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeProfile = 'Passive A';
  const conflict = getPoeIssues(ws, 'b').find(issue => issue.ruleId === 'power-poe-link')!;
  expect(conflict).toMatchObject({ status: 'fail', applicability: 'active', editTarget: { rackId: 'a', deviceId: 'source' } });
  expect(conflict.cause).toMatchObject({ endpoints: [{ rackId: 'a', deviceId: 'source' }, { rackId: 'b', deviceId: 'receiver', profile: 'Passive A' }] });
  ws.racks[1].devices[0].portConnectionSpecs!['ethernet:front:0'].poeProfile = 'Passive B';
  expect(getPoeIssues(ws, 'b').find(issue => issue.ruleId === 'power-poe-link')?.cause).not.toEqual(conflict.cause);
});

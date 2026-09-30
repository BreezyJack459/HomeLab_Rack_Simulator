import type { CableRoute, PlacedDevice, PortConnectionSpec, RackLayout, RackType } from '../types/rack';

const date = '2026-09-30T00:00:00.000Z';
const source = 'Fictional learning fixture: illustrative planning assumptions, not manufacturer specifications or verified installation evidence.';
const ethernet: PortConnectionSpec = { connector: 'Illustrative RJ45', role: 'bidirectional', source };
const inlet: PortConnectionSpec = { connector: 'Illustrative AC socket', role: 'input', powerKind: 'ac', nominalVoltageV: 230, source };
const outlet: PortConnectionSpec = { ...inlet, role: 'output' };

export type SampleDefinition = {
  layout: RackLayout;
  kind: 'beginner' | 'advanced' | 'exercise' | 'legacy';
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  audience: string;
  outcomes: string[];
  assumptions: string[];
  steps?: { ruleId: string; title: string; remedy: string }[];
};

const baseDevice = (id: string, name: string, category: PlacedDevice['category'], positionU: number, rackType: RackType, powerW: number, patch: Partial<PlacedDevice> = {}): PlacedDevice => ({
  id, name, category, positionU, sizeU: 1, depthMm: 160, widthType: rackType,
  weightKg: 1, powerW, powerBasis: powerW ? 'estimated' : 'passive', powerReviewed: true,
  powerReference: { watts: powerW, basis: powerW ? 'estimated' : 'passive', source },
  powerPlanningNote: 'Reviewed only for this fictional worked example. Replace these assumptions with evidence for your own equipment.',
  heatLevel: 1, color: '#64748b', mountSide: 'front',
  installationRequirements: { support: 'front-mount', source },
  installationKit: 'Illustrative matching front brackets; fictional kit, not a purchase recommendation',
  description: source, ...patch,
});

const pdu = (id: string, name: string, positionU: number, rackType: RackType, circuit?: 'A' | 'B') => baseDevice(id, name, 'pdu', positionU, rackType, 0, {
  circuit, depthMm: 80, ports: { power: 8 }, powerCapacityW: 500,
  powerCapacityReference: { watts: 500, model: 'Fictional distribution fixture', source, checkedAt: date.slice(0, 10) },
  portConnectionSpecs: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`power:rear:${index}`, { ...outlet }])),
});

const dataSockets = (count: number, side: 'front' | 'rear') => Object.fromEntries(Array.from({ length: count }, (_, index) => [`ethernet:${side}:${index}`, { ...ethernet }]));
const powerSockets = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`power:rear:${index}`, { ...inlet }]));

const powerCable = (id: string, sourceId: string, outletIndex: number, targetId: string, inletIndex: number): CableRoute => ({
  id, label: id, type: 'power', fromDeviceId: sourceId, fromPort: { type: 'power', side: 'rear', index: outletIndex },
  toDeviceId: targetId, toPort: { type: 'power', side: 'rear', index: inletIndex },
  powerSourceDeviceId: sourceId, color: '#f97316', lengthMm: 5000,
  socketFit: { from: 'Illustrative AC socket', to: 'Illustrative AC socket' }, notes: source,
});

const dataCable = (id: string, fromDeviceId: string, fromIndex: number, fromSide: 'front' | 'rear', toDeviceId: string, toIndex: number, toSide: 'front' | 'rear', type: CableRoute['type'] = 'ethernet'): CableRoute => ({
  id, label: id, type, fromDeviceId, fromPort: { type: 'ethernet', index: fromIndex, side: fromSide },
  toDeviceId, toPort: { type: 'ethernet', index: toIndex, side: toSide },
  color: '#38bdf8', lengthMm: 3000, socketFit: { from: 'Illustrative RJ45', to: 'Illustrative RJ45' }, notes: source,
});

export const beginnerSample: RackLayout = {
  id: 'learn-beginner-10in', example: { version: 1, sampleId: 'learn-beginner-10in' },
  name: 'Beginner: a small single-feed rack', rackType: '10in', heightU: 6,
  rackDepthMm: 500, rearClearanceMm: 50, weightLimitKg: 40, powerBudgetW: 300, viewSide: 'front', updatedAt: date,
  planningGoals: { version: 1, power: 'single', remoteRecovery: 'optional', serviceMotion: 'detach-first' },
  devices: [
    pdu('learn-small-pdu', 'Generic single-feed distribution', 1, '10in'),
    baseDevice('learn-small-switch', 'Generic 8-port switch', 'switch', 3, '10in', 15, { ports: { ethernet: 8, power: 1 }, color: '#2563eb', portConnectionSpecs: { ...dataSockets(8, 'front'), ...powerSockets(1) } }),
    baseDevice('learn-small-router', 'Generic router', 'router', 5, '10in', 10, { ports: { ethernet: 2, power: 1 }, color: '#0d9488', portConnectionSpecs: { ...dataSockets(2, 'front'), ...powerSockets(1) } }),
  ],
  cables: [
    powerCable('learn-small-switch-feed', 'learn-small-pdu', 0, 'learn-small-switch', 0),
    powerCable('learn-small-router-feed', 'learn-small-pdu', 1, 'learn-small-router', 0),
    dataCable('learn-small-uplink', 'learn-small-router', 0, 'front', 'learn-small-switch', 0, 'front'),
  ],
};

const advancedDevices: PlacedDevice[] = [
  pdu('learn-pdu-a', 'Generic feed A distribution', 1, '19in', 'A'),
  pdu('learn-pdu-b', 'Generic feed B distribution', 3, '19in', 'B'),
  baseDevice('learn-storage', 'Generic dual-input storage', 'nas', 4, '19in', 40, { sizeU: 2, depthMm: 350, ports: { ethernet: 2, power: 2 }, portConnectionSpecs: { ...dataSockets(2, 'rear'), ...powerSockets(2) } }),
  baseDevice('learn-server', 'Generic dual-PSU server', 'server', 7, '19in', 90, {
    sizeU: 2, depthMm: 400, ports: { ethernet: 2, power: 2 },
    installationRequirements: { support: 'rails', railMinMm: 550, railMaxMm: 700, source },
    installationKit: 'Illustrative 550–700 mm rail kit; fictional specification',
    portConnectionSpecs: { ...dataSockets(2, 'rear'), ...powerSockets(2) },
  }),
  baseDevice('learn-switch', 'Generic dual-input 8-port switch', 'switch', 10, '19in', 15, { ports: { ethernet: 8, power: 2 }, color: '#2563eb', portConnectionSpecs: { ...dataSockets(8, 'front'), ...powerSockets(2) } }),
  baseDevice('learn-manager', 'Generic front cable manager', 'cable-management', 11, '19in', 0, { depthMm: 60 }),
  baseDevice('learn-patch', 'Generic 8-jack patch panel', 'patch-panel', 12, '19in', 0, { depthMm: 45, ports: { ethernet: 8 }, portConnectionSpecs: { ...dataSockets(8, 'front'), ...dataSockets(8, 'rear') } }),
];

export const advancedSample: RackLayout = {
  id: 'learn-advanced-19in', example: { version: 1, sampleId: 'learn-advanced-19in' },
  name: 'Advanced: independent feeds and structured cabling', rackType: '19in', heightU: 14,
  rackDepthMm: 800, mountingPostSpacingMm: 600, rearClearanceMm: 60, weightLimitKg: 150, powerBudgetW: 600, viewSide: 'front', updatedAt: date,
  planningGoals: { version: 1, power: 'independent-ab', remoteRecovery: 'optional', serviceMotion: 'detach-first' },
  devices: advancedDevices,
  cables: [
    ...['learn-switch', 'learn-server', 'learn-storage'].flatMap((id, index) => [powerCable(`${id}-feed-a`, 'learn-pdu-a', index, id, 0), powerCable(`${id}-feed-b`, 'learn-pdu-b', index, id, 1)]),
    dataCable('learn-server-home-run', 'learn-server', 0, 'rear', 'learn-patch', 0, 'rear', 'structured'),
    dataCable('learn-server-patch', 'learn-patch', 0, 'front', 'learn-switch', 0, 'front', 'patch'),
    dataCable('learn-storage-home-run', 'learn-storage', 0, 'rear', 'learn-patch', 1, 'rear', 'structured'),
    dataCable('learn-storage-patch', 'learn-patch', 1, 'front', 'learn-switch', 1, 'front', 'patch'),
  ],
  services: [{ id: 'learn-file-service', name: 'Illustrative file service', criticality: 'medium', hostDeviceId: 'learn-server', storageDeviceIds: ['learn-storage'], networkDeviceIds: ['learn-switch'], powerDeviceIds: ['learn-pdu-a', 'learn-pdu-b'], notes: 'Recorded dependencies only; this example does not prove application availability or tested failover.' }],
};

export const exerciseSample: RackLayout = structuredClone(advancedSample);
exerciseSample.id = 'learn-troubleshooting-19in';
exerciseSample.name = 'Exercise: find three planning conflicts';
exerciseSample.example = { version: 1, sampleId: exerciseSample.id };
exerciseSample.powerBudgetW = 100;
const wrongFeed = exerciseSample.cables.find(cable => cable.id === 'learn-server-feed-b')!;
wrongFeed.fromDeviceId = 'learn-pdu-a'; wrongFeed.powerSourceDeviceId = 'learn-pdu-a';
wrongFeed.fromPort = { type: 'power', side: 'rear', index: 3 };
exerciseSample.cables.find(cable => cable.id === 'learn-server-home-run')!.lengthMm = 100;

const assumptions = [
  'All devices, brackets, rail limits, loads, socket identities, voltage and output ratings are fictional worked-example inputs; they are not manufacturer specifications or verified measurements.',
  'A clean Check result is consistency within these assumptions, not electrical certification or proof that real hardware fits. Replace the assumptions before purchasing.',
  'External utility availability, breaker/current limits, site circuits, application failover and management reachability are outside this example.',
  'Disconnect cables before moving equipment; cable lengths are installation estimates. Spare Ethernet and power sockets are intentionally idle.',
];

export const learningSampleDefinitions: SampleDefinition[] = [
  { layout: beginnerSample, kind: 'beginner', title: 'Start small: one feed', titleZh: '入門：單路供電小機架', description: 'A complete generic router/switch plan with one supply and intentionally spare ports.', descriptionZh: '完整嘅通用路由器及交換器規劃，用單路供電，保留閒置插口。', audience: 'First rack plan', outcomes: ['Inspect front/rear sockets and the three intended cables.', 'See why spare ports and a single-feed goal are normal.', 'Replace illustrative dimensions and load assumptions before buying.'], assumptions },
  { layout: advancedSample, kind: 'advanced', title: 'Trace A/B and patch paths', titleZh: '進階：追蹤 A/B 及配線路徑', description: 'Independent modeled feeds, documented PSU inlets, complete front/rear patch pairs and service dependencies.', descriptionZh: '獨立供電模型、清楚標示嘅 PSU 輸入口、完整前後配線及服務依賴。', audience: 'Structured rack planning', outcomes: ['Trace each PSU to a different recorded circuit without relying on PDU side.', 'Follow a patch jack from rear home run to front switch patch.', 'Inspect rails and the recorded service dependency map.'], assumptions },
  { layout: exerciseSample, kind: 'exercise', title: 'Repair three conflicts', titleZh: '練習：修正三項規劃衝突', description: 'A deliberately changed copy of the advanced plan: budget, feed independence and cable length.', descriptionZh: '刻意改動進階範例，練習修正預算、供電獨立性及線長。', audience: 'Guided troubleshooting', outcomes: ['Find three root causes in Check.', 'Fix the cause rather than accepting or hiding a finding.', 'Compare the repaired plan with the advanced worked example.'], assumptions, steps: [
    { ruleId: 'power-limit', title: 'Power planning budget', remedy: 'Restore the illustrative rack power budget from 100 W to 600 W; its recorded device total is 145 W. For real hardware choose an evidence-based limit, not an arbitrary higher number.' },
    { ruleId: 'power-independent-ab', title: 'Both server feeds use A', remedy: 'Move learn-server-feed-b from Feed A outlet 4 to Feed B outlet 2, keeping server PSU inlet 2. Feed B should be the upstream source.' },
    { ruleId: 'cable-installation-length', title: 'Declared home-run cable is too short', remedy: 'Restore learn-server-home-run from 100 mm to the worked-example 3000 mm, or select a length meeting the modeled minimum. Verify actual connectors and route before buying.' },
  ] },
];

export const learningSampleLayouts = learningSampleDefinitions.map(definition => definition.layout);

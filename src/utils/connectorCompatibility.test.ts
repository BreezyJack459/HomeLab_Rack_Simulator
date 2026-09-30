import { beforeEach, describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice, PortConnectionSpec, RackLayout } from '../types/rack';
import { checkConnectorCompatibility, getPortConnectionSpec } from './connectorCompatibility';
import { buildPowerChains, buildPowerTopology } from './powerChain';
import { autoResolveCable, portChoicesForDevice, resolveCompatibleCable } from './portSelection';
import { validateImportedLayout } from './layoutValidation';
import { deviceCatalog, templateFromDevice } from '../data/deviceCatalog';
import { registerDeviceTemplates } from '../data/deviceTemplateRegistry';
import { useRackStore } from '../store/rackStore';

const device = (id: string, spec?: PortConnectionSpec): PlacedDevice => ({ id, name: id, category: id === 'a' ? 'pdu' : 'server', sizeU: 1, positionU: id === 'a' ? 1 : 3, depthMm: 200, widthType: '19in', powerW: id === 'a' ? 0 : 100, weightKg: 1, heatLevel: 1, color: '#000', ports: { power: 1 }, portConnectionSpecs: spec ? { 'power:rear:0': { ...spec } } : undefined });
const cable: CableRoute = { id: 'feed', fromDeviceId: 'a', toDeviceId: 'b', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index: 0 }, type: 'power', color: '#000' };
const layout = (a?: PortConnectionSpec, b?: PortConnectionSpec): RackLayout => ({ id: 'rack', name: 'Rack', rackType: '19in', heightU: 12, rackDepthMm: 600, powerBudgetW: 1000, weightLimitKg: 100, viewSide: 'front', devices: [device('a', a), device('b', b)], cables: [cable], updatedAt: '' });
const output: PortConnectionSpec = { connector: 'Socket A', role: 'output', powerKind: 'dc', nominalVoltageV: 12, polarity: 'center positive' };
const input: PortConnectionSpec = { connector: 'Socket B', role: 'input', powerKind: 'dc', nominalVoltageV: 12, polarity: 'center positive' };

beforeEach(() => useRackStore.getState().loadLayout({ ...layout(), cables: [] }));

describe('recorded socket and cable compatibility', () => {
  it('leaves generic sockets unverified and permits planning without fabricated specs', () => {
    expect(checkConnectorCompatibility(layout(), cable).status).toBe('unverified');
    const current = { ...layout(), cables: [] };
    expect(autoResolveCable(current.devices[0], current.devices[1], current)).not.toBeNull();
  });
  it('accepts different socket identities at either end of a purpose-made cable', () => {
    expect(checkConnectorCompatibility(layout(output, input), { ...cable, socketFit: { from: 'socket a', to: 'Socket B' } }).status).toBe('recorded-match');
    expect(checkConnectorCompatibility(layout(output, input), { ...cable, socketFit: { from: 'Socket B', to: 'Socket A' } }).conflicts).toHaveLength(2);
  });
  it('rejects direction, supply-kind, voltage and polarity conflicts', () => {
    for (const patch of [{ role: 'output' as const }, { powerKind: 'ac' as const }, { nominalVoltageV: 24 }, { polarity: 'center negative' }]) {
      expect(checkConnectorCompatibility(layout(output, { ...input, ...patch }), cable).status).toBe('conflict');
    }
    expect(checkConnectorCompatibility(layout(output, input), { ...cable, powerSourceDeviceId: 'b' }).status).toBe('conflict');
  });
  it('uses canonical socket faces and keeps front/rear specs separate', () => {
    const panel = { ...device('panel'), category: 'patch-panel' as const, ports: { ethernet: 1 }, portConnectionSpecs: { 'ethernet:front:0': { connector: 'RJ45 front' }, 'ethernet:rear:0': { connector: 'IDC rear' } } };
    expect(getPortConnectionSpec(panel, { type: 'ethernet', index: 0, side: 'rear' })?.connector).toBe('IDC rear');
    expect(getPortConnectionSpec(panel, { type: 'ethernet', index: 0, side: 'front' })?.connector).toBe('RJ45 front');
  });
  it('blocks conflicting creation through both picker and store, preserving imported problems for review', () => {
    const current = { ...layout(output, { ...input, nominalVoltageV: 24 }), cables: [] };
    const choices = portChoicesForDevice(current.devices[1], current);
    expect(resolveCompatibleCable(current, { deviceId: 'a', port: { type: 'power', index: 0, side: 'rear' } }, choices[0])).toBeNull();
    expect(autoResolveCable(current.devices[0], current.devices[1], current)).toBeNull();
    useRackStore.getState().loadLayout(current);
    useRackStore.getState().addCable(cable);
    expect(useRackStore.getState().layout.cables).toHaveLength(0);
    expect(useRackStore.getState().statusMessage).toContain('voltages differ');
    expect(validateImportedLayout({ ...current, cables: [cable] }).valid).toBe(true);
  });
  it('uses recorded port roles for cascades and never promotes a blocked downstream PDU to a root', () => {
    const current = layout(input, output);
    current.devices[1].category = 'pdu';
    expect(buildPowerTopology(current).edges[0].sourceId).toBe('b');
    current.devices[0].portConnectionSpecs!['power:rear:0'].nominalVoltageV = 24;
    expect(buildPowerChains(current).map(chain => chain.root.device.id)).toEqual(['b']);
    expect(buildPowerChains(current)[0].root.children).toHaveLength(0);
  });
  it('round-trips specs and rejects malformed metadata', () => {
    expect(validateImportedLayout(JSON.parse(JSON.stringify(layout(output, input)))).valid).toBe(true);
    expect(validateImportedLayout(layout({ nominalVoltageV: -12 }, input)).valid).toBe(false);
    expect(validateImportedLayout({ ...layout(), cables: [{ ...cable, socketFit: { from: 123 } }] }).valid).toBe(false);
  });
});


it('copies template socket specs without sharing mutable records', () => {
  const template = { ...deviceCatalog.find(d => d.id === 'managed-switch-24')!, id: 'specified-switch', portConnectionSpecs: { 'power:rear:0': { ...input } } };
  try {
    registerDeviceTemplates([...deviceCatalog, template]);
    useRackStore.getState().loadLayout({ ...layout(), devices: [], cables: [] });
    useRackStore.getState().addDeviceFromTemplate(template.id);
    const placed = useRackStore.getState().layout.devices[0];
    expect(placed.portConnectionSpecs).toEqual(template.portConnectionSpecs);
    expect(placed.portConnectionSpecs).not.toBe(template.portConnectionSpecs);
    expect(templateFromDevice(placed).portConnectionSpecs).toEqual(template.portConnectionSpecs);
  } finally { registerDeviceTemplates(deviceCatalog); }
});

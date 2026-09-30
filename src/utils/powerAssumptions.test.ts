import { beforeEach, describe, expect, it } from 'vitest';
import { getPowerReference, needsPowerReview, planningPowerBasis } from './powerAssumptions';
import { deviceCatalog, templateFromDevice } from '../data/deviceCatalog';
import { useRackStore } from '../store/rackStore';
import { validateImportedLayout } from './layoutValidation';
import { getRackTotals, validateRackLayout } from './validation';
import { calculateEnergySummary } from './energyCalc';
import { calculateEstimatedMonthlyKwh } from './powerBill';
import { calculateUpsRuntimes } from './upsRuntime';
import { buildPowerChains } from './powerChain';

beforeEach(() => {
  const store = useRackStore.getState();
  store.loadLayout({ ...store.layout, heightU: 42, rackType: '19in', rackDepthMm: 1000, devices: [], cables: [] });
});

const addSwitch = () => {
  useRackStore.getState().addDeviceFromTemplate('managed-switch-24');
  return useRackStore.getState().layout.devices[0];
};

describe('planning power provenance', () => {
  it('keeps output provenance separate from editable rating, self-load and battery energy', () => {
    useRackStore.getState().addDeviceFromTemplate('apc-scl500rm1u');
    const device = useRackStore.getState().layout.devices[0];
    expect(device.powerW).toBe(8);
    expect(device.powerCapacityW).toBe(400);
    expect(device.batteryWh).toBeUndefined();
    expect(device.powerCapacityReference).toMatchObject({ watts: 400, model: 'SCL500RM1U (120 V)' });
    expect(device.powerCapacityReference).not.toBe(deviceCatalog.find(d => d.id === 'apc-scl500rm1u')!.powerCapacityReference);
    useRackStore.getState().updateDevice(device.id, { powerCapacityW: 350 });
    let changed = useRackStore.getState().layout.devices[0];
    expect(changed.powerCapacityReference?.watts).toBe(400);
    expect(templateFromDevice(changed).powerCapacityReference).toEqual(device.powerCapacityReference);
    const saved = JSON.parse(JSON.stringify(useRackStore.getState().layout));
    expect(validateImportedLayout(saved).valid).toBe(true);
    useRackStore.getState().loadLayout(saved);
    expect(useRackStore.getState().layout.devices[0].powerCapacityW).toBe(350);
    useRackStore.getState().updateDevice(device.id, { powerCapacityW: undefined });
    changed = useRackStore.getState().layout.devices[0];
    expect(changed.powerCapacityW).toBeUndefined();
    expect(changed.powerCapacityReference?.watts).toBe(400);
    for (const reference of [null, {}, { ...device.powerCapacityReference, watts: -1 }, { ...device.powerCapacityReference, checkedAt: 'yesterday' }]) {
      expect(validateImportedLayout({ ...saved, devices: [{ ...changed, powerCapacityReference: reference }] }).valid).toBe(false);
    }
    useRackStore.getState().loadLayout({ ...saved, devices: [{ ...changed, powerCapacityReference: undefined }] });
    expect(useRackStore.getState().layout.devices[0].powerCapacityReference).toBeUndefined();
  });

  it('preserves the catalog reference when planning watts change and clears review', () => {
    const device = addSwitch();
    expect(device.powerReference?.watts).toBe(45);
    expect(needsPowerReview(device)).toBe(true);
    useRackStore.getState().updateDevice(device.id, { powerReviewed: true });
    useRackStore.getState().updateDevice(device.id, { powerW: 80 });
    let changed = useRackStore.getState().layout.devices[0];
    expect(changed.powerReference?.watts).toBe(45);
    expect(changed.powerReviewed).toBe(false);
    useRackStore.getState().updateDevice(device.id, { powerReviewed: true });
    useRackStore.getState().updateDevice(device.id, { powerBasis: 'maximum' });
    changed = useRackStore.getState().layout.devices[0];
    expect(changed.powerReviewed).toBe(false);
    expect(templateFromDevice(changed).powerReference?.watts).toBe(45);
  });

  it('preserves an unannotated legacy value before its first edit', () => {
    const device = addSwitch();
    const store = useRackStore.getState();
    store.loadLayout({ ...store.layout, devices: [{ ...device, powerReference: undefined, powerW: 27 }] });
    useRackStore.getState().updateDevice(device.id, { powerW: 90 });
    const changed = useRackStore.getState().layout.devices[0];
    expect(getPowerReference(changed)).toMatchObject({ watts: 27, basis: 'unspecified' });
  });

  it('distinguishes idle, measured and maximum catalog references without changing their watts', () => {
    for (const [id, watts, basis] of [
      ['minisforum-ms-02-ultra-285hx', 22, 'idle'],
      ['synology-ds224-plus', 14.69, 'measured'],
      ['qnap-ts-464', 40.536, 'typical'],
    ] as const) {
      const template = deviceCatalog.find(d => d.id === id)!;
      expect(getPowerReference(template)).toMatchObject({ watts, basis });
      expect(template.powerW).toBe(watts);
      expect(planningPowerBasis(template)).toBe(basis);
    }
    expect(deviceCatalog.some(d => d.powerReference?.basis === 'maximum')).toBe(true);
  });

  it('keeps estimates, totals, chains and energy on the same editable planning load', () => {
    const device = addSwitch();
    useRackStore.getState().updateDevice(device.id, { powerW: 80, powerBasis: 'estimated' });
    const store = useRackStore.getState();
    const layout = { ...store.layout, devices: [...store.layout.devices, { ...device, id: 'pdu', category: 'pdu' as const, powerW: 0 }], cables: [{ id: 'feed', type: 'power' as const, color: '#000', fromDeviceId: device.id, toDeviceId: 'pdu', toPort: { type: 'power' as const, index: 0 } }] };
    expect(getRackTotals(layout).powerW).toBe(80);
    expect(calculateEnergySummary(layout).totalPowerW).toBe(80);
    expect(calculateEstimatedMonthlyKwh(layout.devices)).toBeCloseTo(58.4);
    expect(buildPowerChains(layout)[0].root.totalW).toBe(80);
    const upsLayout = { ...layout, devices: layout.devices.map(d => d.id === 'pdu' ? { ...d, category: 'ups' as const, batteryWh: 100, portFaceOverrides: { power: 'rear' as const }, portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' as const } } } : d) };
    expect(calculateUpsRuntimes(upsLayout)[0].loadW).toBe(80);
    expect(calculateUpsRuntimes(upsLayout)[0].runtimeMinutes).toBeCloseTo(51);
    expect(validateRackLayout(layout).some(i => i.id === `power-assumption-${device.id}`)).toBe(true);
  });

  it('round-trips metadata and rejects malformed imported references', () => {
    addSwitch();
    const layout = useRackStore.getState().layout;
    expect(validateImportedLayout(JSON.parse(JSON.stringify(layout))).valid).toBe(true);
    for (const fields of [
      { powerBasis: 'invented' }, { powerReviewed: 'yes' },
      { powerReference: { watts: -1, basis: 'idle' } },
      { powerReference: { watts: 2, basis: 'invalid' } },
    ]) {
      expect(validateImportedLayout({ ...layout, devices: [{ ...layout.devices[0], ...fields }] }).valid).toBe(false);
    }
  });
});

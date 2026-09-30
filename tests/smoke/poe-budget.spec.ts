import { expect, test } from '@playwright/test';
import type { RackLayout } from '../../src/types/rack';
import type { useRackStore } from '../../src/store/rackStore';

test('explicit PoE allocation reports overload and preserves edited port and cable data', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const, powerW: 10, ports: { ethernet: 1 } };
    store.loadLayout({ ...store.layout, devices: [
      { ...common, id: 'pse', name: 'PoE source', category: 'switch', positionU: 1 },
      { ...common, id: 'pd', name: 'PoE receiver', category: 'switch', positionU: 3, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd', poeProfile: 'Verified pair profile', poeRequiredW: 20, poeDrawW: 12 } } },
    ], cables: [{ id: 'poe-link', label: 'PoE test link', fromDeviceId: 'pd', toDeviceId: 'pse', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, type: 'ethernet', color: '#333' }] });
    store.selectDevice('pse');
  });
  await page.getByRole('button', { name: 'Socket specifications', exact: true }).click();
  await page.getByRole('combobox', { name: 'PoE role', exact: true }).selectOption('pse');
  await page.getByRole('textbox', { name: 'PoE profile identity', exact: true }).fill('Verified pair profile');
  await page.getByRole('spinbutton', { name: 'PoE port output limit (W)', exact: true }).fill('30');
  await page.getByRole('spinbutton', { name: 'Device total PoE budget (W)', exact: true }).fill('15');
  await page.getByRole('combobox', { name: 'Planning watts include PoE?', exact: true }).selectOption('self-only');
  await page.getByRole('spinbutton', { name: 'PSE conversion efficiency (%)', exact: true }).fill('80');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().selectCable('poe-link'));
  await page.getByRole('checkbox', { name: 'Plan PoE power on this Ethernet link' }).check();
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const layout = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout;
    return [layout.devices[0]?.poeBudgetW, layout.devices[0]?.portConnectionSpecs?.['ethernet:front:0'].poeLimitW, layout.cables[0]?.poe, layout.devices[0]?.poeInputMode, layout.devices[0]?.poeEfficiencyPct];
  })).toEqual([15, 30, true, 'self-only', 80]);
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  const audit = page.getByRole('region', { name: 'PoE allocation audit' });
  await expect(audit.getByText('Budget exceeded by 5.00 W.', { exact: true })).toBeVisible();
  await expect(audit.getByText('PoE test link: 20.00 W requested at PSE', { exact: true })).toBeVisible();
  await expect(audit.getByText('Recorded per-port allocation and profile constraints match.', { exact: true })).toBeVisible();
  const sourceKey = await page.evaluate(() => JSON.stringify([(window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.id, 'pse']));
  await audit.getByRole('combobox', { name: 'Simulate supply unavailable' }).selectOption(sourceKey);
  await expect(audit.getByText(/No upstream path traced before failure: .*PoE receiver/)).toBeVisible();
  const upsKey = await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const layout = store.layout;
    store.loadLayout({ ...layout, devices: [...layout.devices.map(d => d.id === 'pse' ? { ...d, poeBudgetW: 30 } : d), { ...layout.devices[0], batteryWh: 100, powerCapacityW: 100, upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 100, chargePct: 100 }, id: 'ups', name: 'Upstream UPS', category: 'ups', positionU: 5, ports: { power: 2 }, portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' } }, poeBudgetW: undefined }], cables: [...layout.cables, { id: 'feed', fromPort: { type: 'power', index: 0 }, fromDeviceId: 'ups', toDeviceId: 'pse', type: 'power', color: '#333' }] });
    return JSON.stringify([layout.id, 'ups']);
  });
  await audit.getByRole('combobox', { name: 'Simulate supply unavailable' }).selectOption(upsKey);
  await expect(audit.getByText(/Lose recorded supply path: .*PoE receiver/)).toBeVisible();
  await expect(audit.getByText('No upstream path traced before failure: None', { exact: true })).toBeVisible();
  await expect(page.getByText('2h 51m', { exact: true }).first()).toBeVisible();
  const energy = page.getByRole('region', { name: 'Energy and heat estimate' });
  await energy.getByRole('spinbutton', { name: 'Electricity rate ($/kWh)' }).fill('2');
  await expect(energy.getByText('$51.10', { exact: true })).toBeVisible();
  await expect(energy.getByText('Heat output', { exact: true }).locator('..')).toContainText('Not estimated');
  await energy.getByRole('spinbutton', { name: 'Electricity rate ($/kWh)' }).fill('');
  await expect(energy.getByText('Est. monthly cost', { exact: true }).locator('..')).toContainText('Not estimated');

});

test('receiver-rack health opens the overloaded source in its own rack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { id: 'same-id', sizeU: 1, positionU: 1, widthType: '19in' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const, powerW: 1, powerReviewed: true, category: 'switch' as const, ports: { ethernet: 1 } };
    const racks: RackLayout[] = [
      { ...store.layout, id: 'source-rack', name: 'Source rack', devices: [{ ...common, name: 'Actual source', poeBudgetW: 10, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse' as const, poeProfile: 'Pair', poeLimitW: 30 } } }], cables: [] },
      { ...store.layout, id: 'receiver-rack', name: 'Receiver rack', devices: [{ ...common, name: 'Actual receiver', portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd' as const, poeProfile: 'Pair', poeRequiredW: 20 } } }], cables: [] },
    ];
    store.setWorkspace({ ...store.workspace, racks, interRackCables: [{ id: 'cross-poe', fromRackId: 'source-rack', fromDeviceId: 'same-id', fromPort: { type: 'ethernet', index: 0 }, toRackId: 'receiver-rack', toDeviceId: 'same-id', toPort: { type: 'ethernet', index: 0 }, type: 'cat6a', poe: true }] });
    store.switchRack('receiver-rack');
  });
  await expect(page.getByTestId('health-chip-power')).toHaveAttribute('data-status', 'critical');
  await page.getByTestId('health-chip-power').click();
  await page.getByRole('button', { name: /Source rack \/ Actual source: 20.00 W known allocation/ }).click();
  await expect(page.getByRole('heading', { name: 'PoE source budget exceeded', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit device', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Actual source');
  const budget = page.getByRole('spinbutton', { name: 'Device total PoE budget (W)' });
  if (!(await budget.isVisible())) await page.getByRole('button', { name: 'Socket specifications', exact: true }).click();
  await expect(budget).toHaveValue('10');
});

test('remaining outlet capacity includes PoE loss and never passes unknown input', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const };
    store.loadLayout({ ...store.layout, devices: [
      ...['a', 'b'].map((id, i) => ({ ...common, id, name: `Supply ${id}`, category: 'pdu' as const, positionU: i + 1, powerW: 0, powerCapacityW: 30, ports: { power: 2 } })),
      { ...common, id: 'pse', name: 'PoE switch', category: 'switch', positionU: 3, powerW: 10, ports: { power: 2, ethernet: 1 }, poeBudgetW: 30, poeInputMode: 'self-only', poeEfficiencyPct: 80, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse', poeLimitW: 30, poeProfile: 'Pair' } } },
      { ...common, id: 'pd', name: 'Receiver', category: 'switch', positionU: 4, powerW: 20, ports: { ethernet: 1 }, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd', poeRequiredW: 20, poeDrawW: 20, poeProfile: 'Pair' } } },
    ], cables: [
      ...['a', 'b'].map((id, index) => ({ id: `feed-${id}`, fromDeviceId: id, toDeviceId: 'pse', type: 'power' as const, color: '#333', fromPort: { type: 'power' as const, index: 0 }, toPort: { type: 'power' as const, index } })),
      { id: 'poe', fromDeviceId: 'pse', toDeviceId: 'pd', type: 'ethernet', color: '#333', poe: true, fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 } },
    ] });
  });
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  await page.getByTitle('Outlet 1: PoE switch · 35W', { exact: true }).first().click();
  await expect(page.getByText('Supply b: 35W output load — exceeds 30W rating by 5W', { exact: true })).toBeVisible();
  const receivers = page.getByRole('region', { name: 'PoE receivers affected by outlet failure' });
  await expect(receivers.getByText(/Retain another recorded path: .*Receiver/)).toBeVisible();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().removeCable('feed-b'));
  await expect(receivers.getByText(/Lose recorded supply path: .*Receiver/)).toBeVisible();
  await expect(receivers.getByText('Retain another recorded path: None', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().undo());

  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('pse', { poeEfficiencyPct: undefined }));
  await expect(page.getByText('Supply b: 10W output load — Load or wiring unverified; cannot confirm fit within 30W rating', { exact: true })).toBeVisible();
});

test('scenario planner uses a remote UPS for the selected rack PoE receiver', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'planning-pack'] })));
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const, powerReviewed: true };
    const racks: RackLayout[] = [
      { ...store.layout, id: 'source', name: 'Source', devices: [
        { ...common, id: 'ups', name: 'Remote UPS', category: 'ups' as const, portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' as const } }, positionU: 1, powerW: 5, powerCapacityW: 100, batteryWh: 100, upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 100, chargePct: 100 } },
        { ...common, id: 'same', name: 'Source switch', category: 'switch' as const, positionU: 2, powerW: 10, ports: { ethernet: 1 }, poeBudgetW: 30, poeInputMode: 'self-only' as const, poeEfficiencyPct: 80, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse' as const, poeLimitW: 30, poeProfile: 'Pair' } } },
      ], cables: [{ id: 'feed', fromPort: { type: 'power' as const, index: 0 }, type: 'power' as const, fromDeviceId: 'ups', toDeviceId: 'same', color: '#333' }] },
      { ...store.layout, id: 'receiver', name: 'Receiver', devices: [{ ...common, id: 'same', name: 'Remote receiver', category: 'switch' as const, positionU: 1, powerW: 20, ports: { ethernet: 1 }, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd' as const, poeRequiredW: 20, poeDrawW: 20, poeProfile: 'Pair' } } }], cables: [] },
    ];
    store.setWorkspace({ ...store.workspace, racks, interRackCables: [{ id: 'poe', fromRackId: 'source', toRackId: 'receiver', fromDeviceId: 'same', toDeviceId: 'same', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, type: 'cat6a', poe: true }] });
    store.switchRack('receiver');
  });
  await page.getByRole('button', { name: /Tools/ }).click();
  await expect(page.getByTestId('health-chip-power')).toContainText('0 /');
  await page.getByRole('button', { name: /^Planning →/ }).click();
  await page.getByRole('button', { name: /Scenario Planner/ }).click();
  await expect(page.getByText(/Minimum energy estimate: 150m under recorded assumptions/)).toBeVisible();
  await page.getByRole('button', { name: /Weak UPS Battery/ }).click();
  await expect(page.getByText(/Critical-load energy estimate: 75 minute/)).toBeVisible();
  await page.getByRole('button', { name: 'Build Rack', exact: true }).click();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().switchRack('source'));
  await expect(page.getByTestId('health-chip-power')).toContainText('40 /');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.updateDevice('same', { poeEfficiencyPct: undefined });
    store.switchRack('receiver');
  });
  await expect(page.getByTestId('health-chip-power')).toHaveAttribute('data-status', 'warn');
  await expect(page.getByTestId('health-chip-power')).toContainText('Review');
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('button', { name: /^Planning →/ }).click();
  await expect(page.getByText('Power estimate unverified', { exact: true })).toBeVisible();

});

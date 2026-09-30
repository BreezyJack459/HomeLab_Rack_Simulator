import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('output reference remains visible while current rating is edited and cleared', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByTestId('toggle-device-library')).toBeVisible();
  // Catalog registration happens when the lazy library loads, after shell chrome.
  await expect(page.getByPlaceholder('Search devices')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, rackType: '19in', rackDepthMm: 1000, heightU: 42, devices: [], cables: [] });
    if (!store.addDeviceFromTemplate('apc-scl500rm1u')) throw new Error((window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().statusMessage ?? 'Template placement failed');
    store.selectDevice((window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0].id);
  });
  await page.getByRole('button', { name: 'Power & Lifecycle', exact: true }).click();
  const reference = page.getByLabel('Output rating reference', { exact: true });
  const rating = page.getByRole('spinbutton', { name: /Rated output capacity/ });
  await expect(rating).toHaveValue('400');
  await expect(reference).toContainText('SCL500RM1U (120 V)');
  await expect(reference.getByRole('link')).toHaveAttribute('href', 'https://iportal.se.com/Contents/docs/SCL500RM1U_DATA%20SHEET.PDF');
  await rating.fill('350');
  await expect(reference).toContainText('differs from this reference');
  await expect(reference).toContainText('Recorded output reference: 400 W');
  await page.reload();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.selectDevice(store.layout.devices[0].id);
  });
  const section = page.getByRole('button', { name: 'Power & Lifecycle', exact: true });
  if (!(await rating.isVisible())) await section.click();
  await expect(rating).toHaveValue('350');
  await expect(reference).toContainText('Recorded output reference: 400 W');
  await rating.fill('');
  await expect(reference).toContainText('Current output capacity is unknown');
  await expect(rating).toHaveValue('');
});

test('rating and cascade direction remain explicit and survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, devices: ['Supply', 'Distribution'].map((name, i) => ({
      id: `pdu-${i}`, name, category: 'pdu', sizeU: 1, positionU: i + 1,
      widthType: '19in', depthMm: 100, color: '#334155', powerW: 0, weightKg: 1,
      heatLevel: 1, ports: { power: 8 },
    })), cables: [{ id: 'feed', fromDeviceId: 'pdu-1', toDeviceId: 'pdu-0', type: 'power', color: '#000' }] });
    store.selectDevice('pdu-0');
  });
  await page.getByRole('button', { name: 'Power & Lifecycle', exact: true }).click();
  const rating = page.getByRole('spinbutton', { name: /Rated output capacity/ });
  await expect(rating).toHaveValue('');
  await rating.fill('2300');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0].powerCapacityW)).toBe(2300);
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().selectCable('feed'));
  const direction = page.getByRole('combobox', { name: 'Upstream power supply' });
  await expect(direction).toHaveValue('');
  await direction.selectOption('pdu-0');
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    return [state.layout.devices[0]?.powerCapacityW, state.layout.cables[0]?.powerSourceDeviceId];
  })).toEqual([2300, 'pdu-0']);
});

test('outlet failure explains the surviving second supply path', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#334155', weightKg: 1, heatLevel: 1 as const };
    store.loadLayout({ ...store.layout, devices: [
      { ...common, id: 'a', name: 'Feed A', category: 'pdu', positionU: 1, powerW: 0, circuit: 'A', ports: { power: 8 } },
      { ...common, id: 'b', name: 'Feed B', category: 'pdu', positionU: 2, powerW: 0, powerCapacityW: 150, circuit: 'B', ports: { power: 8 } },
      { ...common, id: 'server', name: 'Dual feed server', category: 'server', positionU: 3, powerW: 200, ports: { power: 2 } },
    ], cables: ['a', 'b'].map((source, index) => ({ id: `feed-${source}`, fromDeviceId: source, toDeviceId: 'server', type: 'power', color: '#000', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index } })) });
  });
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  await page.getByTitle('Outlet 1: Dual feed server · 200W', { exact: true }).first().click();
  await expect(page.getByText('No additional devices lose their modeled wired supply.')).toBeVisible();
  await expect(page.getByText('Still reachable through another supply path: Dual feed server')).toBeVisible();
  await expect(page.getByText('Feed B: 200W output load — exceeds 150W rating by 50W')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Feed B output capacity', exact: true })).toHaveAttribute('data-status', 'critical');
  await expect(page.getByRole('group', { name: 'Feed B output capacity', exact: true })).toContainText('133% recorded load');
  await expect(page.getByText('Feed A: 0W output load — rating unknown; capacity not verified')).toBeVisible();
  await expect(page.getByText(/UPS battery hold-up, breaker and cable current limits are not verified/)).toBeVisible();
});

test('planning power review resets on edits while its original reference survives', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, powerBudgetW: 1200, devices: [{
      id: 'review-load', name: 'Review load', category: 'server', sizeU: 1, positionU: 1,
      widthType: '19in', depthMm: 100, color: '#334155', powerW: 100, weightKg: 1, heatLevel: 1,
    }], cables: [] });
    store.selectDevice('review-load');
  });
  await expect(page.getByTestId('health-chip-power')).toHaveAttribute('data-status', 'warn');
  await page.getByRole('button', { name: 'Power & Lifecycle', exact: true }).click();
  const watts = page.getByRole('spinbutton', { name: 'Planning power (W)', exact: true });
  await watts.fill('80');
  await page.getByRole('combobox', { name: 'Planning power basis', exact: true }).selectOption('typical');
  await expect(page.getByText(/Reference: 100 W/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Planning load notes / measurement source', exact: true }).fill('Meter reading under normal workload');
  const reviewed = page.getByRole('checkbox', { name: 'I reviewed this planning load for my hardware and workload', exact: true });
  await reviewed.check();
  await expect(page.getByTestId('health-chip-power')).toHaveAttribute('data-status', 'good');
  await watts.fill('90');
  await expect(reviewed).not.toBeChecked();
  await expect(page.getByTestId('health-chip-power')).toHaveAttribute('data-status', 'warn');
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const device = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0];
    return { watts: device.powerW, reference: device.powerReference?.watts, reviewed: device.powerReviewed, basis: device.powerBasis, note: device.powerPlanningNote };
  })).toEqual({ watts: 90, reference: 100, reviewed: false, basis: 'typical', note: 'Meter reading under normal workload' });
});

test('conflicting wired input keeps power visible and withholds energy until corrected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const, powerReviewed: true, ports: { power: 1 }, portFaceOverrides: { power: 'rear' as const } };
    store.loadLayout({ ...store.layout, powerBudgetW: 100, devices: [
      { ...common, id: 'ups', name: 'UPS', category: 'ups', positionU: 1, powerW: 0, powerCapacityW: 100, batteryWh: 100, portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery', role: 'output', powerKind: 'ac', nominalVoltageV: 230 } } },
      { ...common, id: 'load', name: 'Load', category: 'server', positionU: 2, powerW: 10, portConnectionSpecs: { 'power:rear:0': { role: 'input', powerKind: 'ac', nominalVoltageV: 120 } } },
    ], cables: [{ id: 'bad', type: 'power', fromDeviceId: 'ups', toDeviceId: 'load', color: '#333', fromPort: { type: 'power', index: 0, side: 'rear' }, toPort: { type: 'power', index: 0, side: 'rear' } }] });
  });
  await expect(page.getByTestId('health-chip-power')).toContainText('10 / 100 W · Review');
  await expect(page.getByTestId('health-chip-power')).toHaveAttribute('data-status', 'warn');
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  const energy = page.getByRole('region', { name: 'Energy and heat estimate' });
  await expect(energy.getByText('Monthly kWh', { exact: true }).locator('..')).toContainText('Not estimated');
  await expect(page.getByRole('group', { name: 'UPS output capacity', exact: true })).toHaveAttribute('data-status', 'unverified');
  await expect(page.getByRole('group', { name: 'UPS output capacity', exact: true })).toContainText('available capacity is not verified');
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('load', { portConnectionSpecs: { 'power:rear:0': { role: 'input', powerKind: 'ac', nominalVoltageV: 230 } } }));
  await expect(energy.getByText('Monthly kWh', { exact: true }).locator('..')).toContainText('7.3');
  await expect(page.getByText('6h 48m', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'UPS output capacity', exact: true })).toHaveAttribute('data-status', 'unverified');
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('load', { powerReviewed: true }));
  await expect(page.getByRole('group', { name: 'UPS output capacity', exact: true })).toHaveAttribute('data-status', 'recorded');
});

for (const width of [1440, 390]) {
  test(`unknown outlet count preserves recorded connections without free sockets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const };
      store.loadLayout({ ...store.layout, devices: [
        { ...common, id: 'supply', name: 'Unknown inventory', category: 'pdu', positionU: 1, powerW: 0 },
        { ...common, id: 'load', name: 'Recorded load', category: 'server', positionU: 2, powerW: 200 },
      ], cables: [{ id: 'record', type: 'power', fromDeviceId: 'supply', toDeviceId: 'load', color: '#333', outletIndex: 9 }] });
    });
    await page.getByRole('button', { name: 'Check Health', exact: true }).click();
    if (width < 1024) await page.getByRole('button', { name: 'Check issues', exact: true }).click();
    await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
    if (width < 1024) await page.getByRole('dialog', { name: 'Check issues', exact: true }).getByRole('button', { name: 'Close device library', exact: true }).click();
    await expect(page.getByText(/Outlet count unknown — free sockets unverified/)).toBeVisible();
    await expect(page.getByTitle('Outlet 10: Recorded load · 200W', { exact: true })).toBeVisible();
    await expect(page.getByTitle(/Outlet \d+ · Free/)).toHaveCount(0);
  });
}

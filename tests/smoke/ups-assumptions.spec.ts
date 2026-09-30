import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('UPS socket backup edits change runtime eligibility and survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.getByTestId('toggle-device-library')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, weightKg: 1, heatLevel: 1 as const, color: '#333', powerReviewed: true, ports: { power: 1 } };
    store.loadLayout({ ...store.layout, devices: [
      { ...common, id: 'ups', name: 'Outlet UPS', category: 'ups', positionU: 1, powerW: 10, batteryWh: 100, powerCapacityW: 500,
        upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 100, chargePct: 100 } },
      { ...common, id: 'load', name: 'Outlet load', category: 'server', positionU: 3, powerW: 90 },
    ], cables: [{ id: 'feed', fromDeviceId: 'load', toDeviceId: 'ups', type: 'power', color: '#333', toPort: { type: 'power', index: 0, side: 'rear' } }] });
    store.selectDevice('ups');
  });
  await page.getByRole('button', { name: 'Socket specifications', exact: true }).click();
  const backup = page.getByRole('combobox', { name: /^UPS outlet backup/ });
  await expect(backup).toHaveValue('');
  await backup.selectOption('battery');
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0].portConnectionSpecs?.['power:rear:0']?.upsBackup)).toBe('battery');
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  await expect(page.getByText(/Recorded battery-path load: 100.00 W/)).toBeVisible();
  for (const mode of ['surge-only', '']) {
    await page.getByRole('button', { name: 'Build Rack', exact: true }).click();
    await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().selectDevice('ups'));
    const inspector = page.getByRole('button', { name: 'Open inspector', exact: true });
    if (await inspector.isVisible()) await inspector.click();
    if (!(await backup.isVisible())) await page.getByRole('button', { name: 'Socket specifications', exact: true }).click();
    await backup.selectOption(mode);
    await page.getByRole('button', { name: 'Check Health', exact: true }).click();
    await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
    await expect(page.getByText(/Recorded battery-path load: 10.00 W/)).toBeVisible();
    if (mode === 'surge-only') await expect(page.getByText('Not assessed: connect downstream equipment first.')).toBeVisible();
    else await expect(page.getByText('Not assessed: resolve power wiring warnings before relying on the battery estimate.')).toBeVisible();
  }
});

test('UPS battery assumptions edit, persist and drive outage comparison', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, weightKg: 1, heatLevel: 1 as const, color: '#333', powerReviewed: true };
    store.loadLayout({ ...store.layout, devices: [
      { ...common, id: 'ups', name: 'Scenario UPS', category: 'ups', positionU: 1, powerW: 10, powerCapacityW: 90, portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' } } },
      { ...common, id: 'load', name: 'Scenario load', category: 'server', positionU: 3, powerW: 90 },
    ], cables: [{ id: 'feed', fromDeviceId: 'load', toDeviceId: 'ups', toPort: { type: 'power', index: 0 }, type: 'power', color: '#333' }] });
    store.selectDevice('ups');
  });
  await page.getByRole('button', { name: 'Power & Lifecycle', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Battery energy (Wh)', exact: true }).fill('200');
  await page.getByRole('spinbutton', { name: 'Inverter efficiency (%)', exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: 'Usable battery capacity (%)', exact: true }).fill('50');
  await page.getByRole('spinbutton', { name: 'Starting charge (%)', exact: true }).fill('50');
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0].upsBatteryAssumptions)).toEqual({ efficiencyPct: 100, usableCapacityPct: 50, chargePct: 50 });
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  await expect(page.getByText('Estimated energy covers 30 minutes under the recorded assumptions; transfer behavior is not verified.')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Outage duration to compare (minutes)' }).fill('31');
  await expect(page.getByText(/Estimated energy falls short of 31 minutes/)).toBeVisible();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('ups', { batteryWh: undefined }));
  await expect(page.getByText('Battery Wh unknown')).toBeVisible();
  await expect(page.getByText('Not assessed: battery energy or load data is missing or invalid.')).toBeVisible();
});

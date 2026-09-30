import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) test(`changed cable purchase retains history without fulfilling new routes at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'planning-pack'] })));
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, heightU: 18, rackDepthMm: 800, devices: [10, 6].map((positionU, i) => ({
      id: i ? 'b' : 'a', name: `Server ${i}`, category: 'server', sizeU: 1, positionU, widthType: '19in',
      depthMm: 400, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333', ports: { ethernet: 2 },
    })), cables: [{ id: 'c', type: 'ethernet', fromDeviceId: 'a', toDeviceId: 'b', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, color: '#333', lifecycleStatus: 'planned' }], procurementItems: [] });
  });
  const openPlanner = async () => {
    await page.getByRole('button', { name: /Tools/ }).click();
    await page.getByRole('button', { name: /^Planning →/ }).click();
    await page.getByRole('button', { name: 'Build', exact: true }).click();
  };
  await openPlanner();
  const panel = page.getByRole('region', { name: 'Build procurement' });
  const cable = panel.locator('[data-procurement-state="current"]').filter({ hasText: 'Ethernet cable' });
  await cable.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ordered');
  await cable.getByRole('textbox', { name: 'Notes', exact: true }).fill('PO "123"');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const { id: _id, ...existing } = store.layout.cables[0];
    store.addCable({ ...existing, fromPort: { type: 'ethernet', index: 1 }, toPort: { type: 'ethernet', index: 1 } });
  });
  const previous = panel.locator('[data-procurement-state="previous"]').filter({ hasText: 'Ethernet cable' });
  await expect(previous.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('ordered');
  await expect(previous.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('PO "123"');
  await expect(cable.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('need-to-buy');
  await expect(previous).toContainText('excluded from current requirement totals');
  await page.reload();
  await openPlanner();
  await expect(previous).toBeVisible();
  await expect(previous.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('PO "123"');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('Previous cable requirement:');
  expect(csv).toContain('PO ""123""');
  expect(csv).toContain('Longer Clean/Realistic 3D centreline');
});

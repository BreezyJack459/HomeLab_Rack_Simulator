import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) test(`fit preview preserves rail requirements and rejects stale results at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'planning-pack'] })));
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, rackType: '19in', heightU: 12, rackDepthMm: 1000, mountingPostSpacingMm: 500, weightLimitKg: 300, powerBudgetW: 1200, devices: [], cables: [] });
  });
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('button', { name: /^Planning →/ }).click();
  await page.getByRole('button', { name: 'Fit Check', exact: true }).click();
  await page.getByPlaceholder('Search catalog...').fill('UniFi UNAS Pro');
  await page.getByRole('button', { name: /^UniFi UNAS Pro 2U$/ }).click();
  await page.getByRole('button', { name: 'Check Fit', exact: true }).click();
  await expect(page.getByText('Does not fit', { exact: true })).toBeVisible();
  await expect(page.getByText(/500 mm mounting-post spacing is outside the 650–1000 mm rail range/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Rack', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateRack({ mountingPostSpacingMm: 700 }));
  await expect(page.getByText('Does not fit', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check Fit', exact: true }).click();
  await expect(page.getByText('Placement available — review warnings', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to Rack', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const d = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0];
    return [d?.templateId, d?.physicalHeightMm, d?.installationRequirements?.railMinMm, d?.powerReference?.watts];
  })).toEqual(['unifi-unas-pro', 87.4, 650, 160]);
});

import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) test(`Check separates root actions and raw evidence at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, heightU: 18, rackType: '19in', rackDepthMm: 800, devices: [{
      id: 'server', name: 'Summary server', category: 'server', sizeU: 1, positionU: 1, widthType: '19in',
      depthMm: 400, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333', ports: { ethernet: 24 },
      installationRequirements: { support: 'rails', railMinMm: 600, railMaxMm: 900, rearClearanceMm: 50 },
    }], cables: [] });
  });
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  if (width < 1024) await page.getByRole('button', { name: 'Check issues', exact: true }).click();
  const sidebar = width < 1024 ? page.getByRole('dialog', { name: 'Check issues', exact: true }) : page.getByRole('complementary', { name: 'Check issues', exact: true });
  await expect(sidebar.getByRole('region', { name: 'Needs verification' })).toBeVisible();
  await expect(sidebar.getByText('Installation needs verification', { exact: false })).toHaveCount(1);
  await expect(sidebar.getByText(/3 checks/)).toHaveCount(1);
  await sidebar.getByText('Installation needs verification', { exact: false }).click();
  await expect(sidebar.getByRole('button', { name: /Rail fit unverified/ })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /Record the installed rail/ })).toBeVisible();
  await sidebar.getByRole('combobox', { name: 'Issue severity', exact: true }).selectOption('all');
  await expect(sidebar.getByRole('heading', { name: /Check · .*root causes/ })).toBeVisible();
  // The optional 24 idle data sockets do not turn into connectivity actions.
  await expect(sidebar.getByText(/unused.*ethernet|unconnected.*port/i)).toHaveCount(0);
});

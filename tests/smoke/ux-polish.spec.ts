import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 1024, 390]) {
  test(`health filters lead to editable issue details at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      store.loadLayout({ ...store.layout, powerBudgetW: 1, devices: [{
        id: 'ux-server', name: 'UX server', category: 'server', sizeU: 1, positionU: 1,
        widthType: '19in', depthMm: 1200, color: '#334155', powerW: 100, weightKg: 1,
        heatLevel: 1, ports: { ethernet: 2 },
      }], cables: [] });
    });
    await page.getByTestId('health-chip-power').click();
    await expect(page.getByRole('combobox', { name: 'Issue topic', exact: true })).toHaveValue('power');
    await expect(page.getByRole('combobox', { name: 'Issue severity', exact: true })).toHaveValue('all');
    await page.getByRole('combobox', { name: 'Issue topic', exact: true }).selectOption('capacity');
    await page.getByRole('button', { name: /1200mm device depth exceeds/ }).click();
    await expect(page.getByRole('heading', { name: 'UX server may be too deep', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adjust rack settings', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit device', exact: true }).click();
    await expect(page.getByRole('button', { name: '2D', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('UX server');
  });
}

import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('rack inspection has readable selection labels and shared camera controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const viewer = page.getByTestId('rack-inspection-3d');
  await expect(viewer.locator('canvas')).toBeVisible();
  const label = viewer.getByTestId('scene-selection-label').first();
  await expect(label).toBeVisible({ timeout: 20000 });
  expect((await label.boundingBox())!.width).toBeGreaterThan(100);
  await viewer.getByRole('combobox', { name: 'Camera view' }).selectOption('rear');
  await viewer.getByRole('button', { name: 'Fit rack' }).click();
  await expect(viewer.getByRole('combobox')).toHaveValue('overview');
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
});

test('cable endpoints, focus controls and layers stay usable in the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  const viewer = page.getByTestId('cable-viewer-3d');
  await expect(viewer.locator('canvas')).toBeVisible();
  await page.evaluate(() => {
    const store = ((window as unknown as { __rackStore: typeof useRackStore }).__rackStore).getState();
    store.selectCable(store.layout.cables[0].id);
  });
  await expect(viewer.getByRole('button', { name: 'Fit route' })).toBeInViewport();
  for (const name of ['Fit route', 'Start A', 'End B']) {
    await viewer.getByRole('button', { name, exact: true }).click();
    await expect(viewer.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await viewer.getByRole('button', { name: 'Fit rack' }).click();
  await expect(viewer.getByRole('combobox')).toHaveValue('overview');
  await viewer.locator('summary').click();
  await viewer.getByRole('checkbox', { name: 'devices', exact: true }).uncheck();
  await expect(viewer.getByRole('checkbox', { name: 'devices', exact: true })).not.toBeChecked();
  await viewer.getByRole('checkbox', { name: 'cables', exact: true }).uncheck();
  await expect(viewer.getByTestId('scene-selection-label')).toHaveCount(0);
  await viewer.getByRole('checkbox', { name: 'cables', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(viewer.locator('details')).not.toHaveAttribute('open');
  await viewer.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(viewer.getByRole('button', { name: 'Fit route' })).toHaveCount(0);
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
});

import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('rack inspection has readable selection labels and shared camera controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  // This regression uses the original multi-device example explicitly.
  await page.evaluate(() => {
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().loadSample('sample-my-onhand-gear');
  });
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
  await expect(viewer.getByRole('checkbox', { name: 'cables', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(viewer.locator('summary')).toBeFocused();
  await expect(viewer.locator('details')).not.toHaveAttribute('open');
  await viewer.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(viewer.getByRole('button', { name: 'Fit route' })).toHaveCount(0);
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
});


test('wrapped mobile 3D display menu keeps routing styles and layers inside the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  const viewer = page.getByTestId('cable-viewer-3d');
  await expect(viewer.locator('canvas')).toBeVisible();
  await viewer.locator('summary').click();
  const popup = viewer.locator('details > div');
  const canvasBounds = (await viewer.boundingBox())!;
  const popupBounds = (await popup.boundingBox())!;
  expect(popupBounds.x).toBeGreaterThanOrEqual(canvasBounds.x);
  expect(popupBounds.x + popupBounds.width).toBeLessThanOrEqual(canvasBounds.x + canvasBounds.width);
  expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(canvasBounds.y + canvasBounds.height);
  for (const style of ['clean', 'realistic']) {
    const button = viewer.getByRole('button', { name: style, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  const cables = viewer.getByRole('checkbox', { name: 'cables', exact: true });
  await cables.scrollIntoViewIfNeeded();
  await expect(cables).toBeInViewport({ ratio: 1 });
  await cables.uncheck();
  await expect(cables).not.toBeChecked();
  await cables.check();
  await page.keyboard.press('Escape');
  await expect(viewer.locator('details')).not.toHaveAttribute('open');
  await expect(viewer.locator('summary')).toBeFocused();
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
});

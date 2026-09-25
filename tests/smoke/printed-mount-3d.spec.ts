import { expect, test } from '@playwright/test';
import { sampleLayouts } from '../../src/data/sampleLayouts';
import type { useRackStore } from '../../src/store/rackStore';

test('both 3D views render joined printed mounts and update when support is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
  const devices = ['onhand-ucg-max', 'onhand-flex-2-5g', 'onhand-poe-injector'].map((id, index) => ({
    ...sampleLayouts[1].devices.find(device => device.id === id)!, positionU: 5, xMm: [8, 158, 380][index], mountingSupport: 'printed-mount' as const,
  }));
  await page.evaluate(layout => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().loadLayout(layout);
    store.getState().selectDevice(layout.devices[layout.devices.length - 1].id);
  }, { ...sampleLayouts[1], heightU: 8, devices, cables: [], reservations: [] });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  for (const view of ['rack-inspection-3d', 'cable-viewer-3d']) {
    if (view === 'cable-viewer-3d') {
      await page.getByRole('button', { name: 'Cable', exact: true }).click();
      await page.getByRole('button', { name: '3D routing', exact: true }).click();
    }
    const viewer = page.getByTestId(view);
    await expect(viewer.locator('canvas')).toBeVisible();
    if (view === 'rack-inspection-3d') await expect(viewer.getByTestId('scene-selection-label').first()).toBeVisible({ timeout: 20000 });
    await viewer.getByRole('combobox', { name: 'Camera view' }).selectOption('front');
    await page.waitForTimeout(1200); // Let the animated camera finish before visual comparison.
    const before = await viewer.locator('canvas').screenshot({ path: `/tmp/printed-${view}-front.png` });
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
      for (const device of store.getState().layout.devices) store.getState().updateDevice(device.id, { mountingSupport: 'shelf' });
    });
    await page.waitForTimeout(300);
    const after = await viewer.locator('canvas').screenshot();
    expect(before.equals(after)).toBe(false);
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
      for (const device of store.getState().layout.devices) store.getState().updateDevice(device.id, { mountingSupport: 'printed-mount' });
    });
    await viewer.getByRole('combobox', { name: 'Camera view' }).selectOption('overview');
    await page.waitForTimeout(1200);
    await viewer.locator('canvas').screenshot({ path: `/tmp/printed-${view}-overview.png` });
    await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  }
});

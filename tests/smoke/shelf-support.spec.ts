import { expect, test } from '@playwright/test';
import { sampleLayouts } from '../../src/data/sampleLayouts';
import type { useRackStore } from '../../src/store/rackStore';

test('shares a tray U through Properties, persists it and renders both 3D views', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('rack-simulator-new-shell', '1'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
  const base = sampleLayouts[1];
  const shelf = { ...base.devices.find(device => device.category === 'shelf')!, id: 'tray', name: 'Mini PC tray', positionU: 3, sizeU: 1, xMm: 0, depthMm: 300, widthType: '19in' as const };
  const pc = { ...base.devices.find(device => device.name.includes('UM790'))!, id: 'pc', positionU: 4, sizeU: 2, xMm: 15 };
  await page.evaluate(layout => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().loadLayout(layout);
    store.getState().selectDevice('tray');
  }, { ...base, heightU: 8, devices: [shelf, pc], cables: [], reservations: [] });
  const open = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await open.isVisible()) await open.click();
  await page.getByRole('button', { name: 'Dimensions & placement', exact: true }).click();
  await page.getByRole('combobox', { name: 'Shelf placement' }).selectOption('tray');
  await expect(page.locator('[data-shelf-style="tray"]')).toBeVisible();
  await page.locator('[data-device-id="pc"]').click();
  await page.getByRole('spinbutton', { name: 'Actual device height mm' }).fill('52.3');
  await page.getByRole('spinbutton', { name: 'Clearance above mm' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Position U', exact: true }).fill('3');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices.find(device => device.id === 'pc')?.positionU)).toBe(3);
  await page.screenshot({ path: '/tmp/shelf-shared-2d.png' });
  await page.reload();
  await expect(page.locator('[data-shelf-style="tray"]')).toBeVisible();
  const saved = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices);
  expect(saved.find(device => device.id === 'pc')).toMatchObject({ positionU: 3, physicalHeightMm: 52.3, clearanceAboveMm: 10 });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  for (const view of ['rack-inspection-3d', 'cable-viewer-3d']) {
    if (view === 'cable-viewer-3d') {
      await page.getByRole('button', { name: 'Cable', exact: true }).click();
      await page.getByRole('button', { name: '3D routing', exact: true }).click();
    }
    const viewer = page.getByTestId(view);
    await expect(viewer.locator('canvas')).toBeVisible();
    await viewer.getByRole('combobox', { name: 'Camera view' }).selectOption('overview');
    await page.waitForTimeout(1500);
    await viewer.locator('canvas').screenshot({ path: `/tmp/shelf-${view}.png` });
    await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  }
});

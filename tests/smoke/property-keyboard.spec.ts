import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1082, 1932]) {
  test(`editing device dimensions keeps the device when using either Delete key at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 987 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
    const before = await page.evaluate(() => {
      const { layout, selectedDeviceId } = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      return { ids: layout.devices.map(device => device.id), selectedDeviceId };
    });
    const inspector = page.getByRole('button', { name: 'Open inspector', exact: true });
    if (await inspector.isVisible()) await inspector.click();
    await page.getByRole('button', { name: 'Dimensions & placement', exact: true }).click();
    const depth = page.getByRole('spinbutton', { name: 'Depth mm', exact: true });
    await depth.fill('550');
    await depth.press('End');
    await depth.press('Backspace'); // The key labelled Delete on Mac keyboards.
    await expect(depth).toHaveValue('55');
    await depth.press('ArrowLeft');
    await depth.press('ArrowLeft');
    await depth.press('Delete'); // Forward Delete / Fn+Delete.
    await expect(depth).toHaveValue('5');
    await depth.press('Meta+a');
    await depth.press('Backspace');
    await depth.fill('550');
    await expect(depth).toHaveValue('550');
    const after = await page.evaluate(() => {
      const { layout, selectedDeviceId } = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      return { ids: layout.devices.map(device => device.id), selectedDeviceId, depth: layout.devices.find(device => device.id === selectedDeviceId)?.depthMm };
    });
    expect(after.ids).toEqual(before.ids);
    expect(after.selectedDeviceId).toBe(before.selectedDeviceId);
    expect(after.depth).toBe(550);
  });
}

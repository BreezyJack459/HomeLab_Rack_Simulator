import { expect, test } from '@playwright/test';
import { sampleLayouts } from '../../src/data/sampleLayouts';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1093, 1932]) {
  test(`selects printed support without adding a shelf at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1234 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
    const device = sampleLayouts[1].devices.find(item => item.name === 'UniFi UCG-Max')!;
    await page.evaluate(({ layout, device }) => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
      store.getState().loadLayout({ ...layout, devices: [{ ...device, positionU: 5 }], cables: [], reservations: [] });
      store.getState().selectDevice(device.id);
    }, { layout: sampleLayouts[1], device });
    const open = page.getByRole('button', { name: 'Open inspector', exact: true });
    if (await open.isVisible()) await open.click();
    await page.getByRole('button', { name: 'Dimensions & placement', exact: true }).click();
    await page.getByRole('combobox', { name: 'Mounting support' }).selectOption('printed-mount');
    await expect(page.getByText('3D-printed mount', { exact: true })).toBeVisible();
    const source = page.getByRole('textbox', { name: 'Printed mount model URL' });
    await source.fill('https://example.com/ucg-max-mount');
    await source.press('Tab');
    await expect(page.getByRole('link', { name: 'Open bracket generator ↗' })).toHaveAttribute('target', '_blank');
    const stored = await page.evaluate(() => {
      const layout = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout;
      return { count: layout.devices.length, device: layout.devices[0] };
    });
    expect(stored.count).toBe(1);
    expect(stored.device).toMatchObject({ mountingSupport: 'printed-mount', printedMountUrl: 'https://example.com/ucg-max-mount', positionU: 5, sizeU: device.sizeU });
    await page.screenshot({ path: `/tmp/printed-mount-${width}.png` });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
    const restored = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices[0]);
    expect(restored).toMatchObject({ mountingSupport: 'printed-mount', printedMountUrl: 'https://example.com/ucg-max-mount' });
  });
}

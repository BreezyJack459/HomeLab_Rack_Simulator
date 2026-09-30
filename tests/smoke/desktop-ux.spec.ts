import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('desktop search includes the Mini PC category and keeps model names ahead of accessories', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const toggle = page.getByTestId('toggle-device-library');
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const search = page.getByRole('textbox', { name: 'Search devices', exact: true });
  await page.getByRole('combobox', { name: 'Device category', exact: true }).selectOption('mini-pc');
  const library = page.getByRole('tabpanel', { name: 'Library', exact: true });
  const categoryNames = await library.getByRole('heading').allTextContents();
  expect(categoryNames.length).toBeGreaterThan(4);
  await page.getByRole('combobox', { name: 'Device category', exact: true }).selectOption('all');
  for (const query of ['mini pc', 'MINI-PC', 'mini_pc']) {
    await search.fill(query);
    const names = await library.getByRole('heading').allTextContents();
    expect(names).toEqual(expect.arrayContaining(categoryNames));
    expect(names.indexOf('Dell OptiPlex Micro')).toBeLessThan(names.indexOf('10-inch deep shelf'));
  }
  await search.fill('MS 01');
  await expect(library.getByRole('heading').first()).toHaveText('Minisforum MS-01');
});

for (const width of [1280, 1440]) test(`desktop Check opens the depth field and returns to the filtered queue at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1280 ? 720 : 900 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, rackDepthMm: 800, devices: [{
      id: 'desktop-server', name: 'Desktop test server', category: 'server', sizeU: 1, positionU: 1,
      widthType: '19in', depthMm: 1200, color: '#334155', powerW: 100, weightKg: 1,
      heatLevel: 1, ports: { ethernet: 2 },
    }], cables: [] });
  });
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Issue topic', exact: true }).selectOption('capacity');
  await page.getByRole('combobox', { name: 'Issue severity', exact: true }).selectOption('warning');
  await page.getByRole('button', { name: /1200mm device depth exceeds/ }).click();
  await page.getByRole('button', { name: 'Edit device', exact: true }).click();
  const depth = page.getByRole('spinbutton', { name: 'Depth mm', exact: true });
  await expect(depth).toBeVisible();
  await expect(depth).toBeFocused();
  await expect(depth).toBeInViewport({ ratio: 1 });
  await depth.fill('200');
  await page.getByRole('button', { name: 'Return to check', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Issue topic', exact: true })).toHaveValue('capacity');
  await expect(page.getByRole('combobox', { name: 'Issue severity', exact: true })).toHaveValue('warning');
  await expect(page.getByRole('button', { name: /1200mm device depth exceeds/ })).toHaveCount(0);
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
});

for (const width of [1280, 1440]) test(`desktop socket selection survives cable preview at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1280 ? 720 : 900 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, devices: [1, 4].map((positionU, index) => ({
      id: index ? 'destination' : 'source', name: index ? 'Destination server' : 'Source server',
      category: 'server', sizeU: 1, positionU, widthType: '19in', depthMm: 200,
      color: '#334155', powerW: 10, weightKg: 1, heatLevel: 1, ports: { ethernet: 2 },
    })), cables: [] });
  });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  await page.getByRole('button', { name: 'Source server 2 available', exact: true }).click();
  const sourcePort = page.getByRole('button', { name: 'LAN 1 · rear · Available', exact: true });
  await expect(sourcePort).toBeInViewport();
  await sourcePort.click();
  await page.getByRole('button', { name: 'Show cable view', exact: true }).click();
  await expect(page.getByTestId('cable-viewer-3d').locator('canvas')).toBeVisible();
  await expect(page.getByText('Source: Source server · LAN 1 (rear)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to sockets', exact: true }).click();
  await page.getByRole('button', { name: 'Destination server 2 available', exact: true }).click();
  await page.getByRole('button', { name: 'LAN 2 · rear · Available', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect cable', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Show cable view', exact: true }).click();
  await expect(page.getByText('Connector compatibility unverified · Review details', { exact: true })).toBeVisible();
  const canvas = page.getByTestId('cable-viewer-3d').locator('canvas');
  await expect(canvas).toBeInViewport({ ratio: 1 });
  await page.getByRole('checkbox', { name: 'Keep connecting from this device', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Connect cable', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const cable = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables[0];
    return cable && { from: cable.fromDeviceId, to: cable.toDeviceId, fromPort: cable.fromPort, toPort: cable.toPort };
  })).toEqual({ from: 'source', to: 'destination', fromPort: { type: 'ethernet', index: 0, side: 'rear' }, toPort: { type: 'ethernet', index: 1, side: 'rear' } });
});

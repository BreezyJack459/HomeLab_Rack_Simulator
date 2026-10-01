import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1280, 390]) test(`connection review stays operable without clipped confirmation at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
  await page.goto('/');
  await page.evaluate(() => {
    const state = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    state.loadLayout({ ...state.layout, devices: [1, 3].map((positionU, index) => ({ id: index ? 'destination' : 'source', name: index ? 'Destination server' : 'Source server', category: 'server', sizeU: 1, positionU, widthType: '19in', depthMm: 200, color: '#334155', powerW: 10, weightKg: 1, heatLevel: 1, ports: { ethernet: 2 } })), cables: [] });
  });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  await page.getByRole('button', { name: 'Source server 2 available', exact: true }).click();
  await page.getByRole('button', { name: 'LAN 1 · rear · Available', exact: true }).click();
  await page.getByRole('button', { name: 'Destination server 2 available', exact: true }).click();
  await page.getByRole('button', { name: 'LAN 2 · rear · Available', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Connect cable', exact: true });
  if (width < 1024) {
    await expect(page.getByRole('dialog', { name: 'Connect device sockets' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel connection', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    expect(await page.getByRole('dialog', { name: 'Connect device sockets' }).evaluate(dialog => dialog.contains(document.activeElement))).toBeTruthy();
  }
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport();
  const bounds = await page.getByRole('region', { name: 'Visual cable connector' }).boundingBox();
  const actionBounds = await confirm.boundingBox();
  expect(bounds && actionBounds && actionBounds.y + actionBounds.height <= bounds.y + bounds.height).toBeTruthy();
  await confirm.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables.length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Visual cable connector' })).toHaveCount(0);
});

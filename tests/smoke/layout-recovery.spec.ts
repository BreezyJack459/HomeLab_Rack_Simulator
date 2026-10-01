import { expect, test, type Page, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const key = 'homelab-rack-simulator-workspace';
const fixture = {
  id: 'safe-rack', name: 'Recovery rack', rackType: '19in', heightU: 12, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1200, viewSide: 'front', updatedAt: '', extension: { future: true },
  devices: [
    { id: 'zero', name: 'Preserved PDU', category: 'pdu-0u', positionU: 1, sizeU: 0, xMm: -55,
      widthType: 'custom', customWidthMm: 55, depthMm: 500, weightKg: 2, powerW: 0, heatLevel: 1, color: '#333', ports: { power: 8 }, extra: { original: true } },
    { id: 'top', name: 'High server', category: 'server', positionU: 10, sizeU: 2, widthType: '19in',
      depthMm: 300, weightKg: 2, powerW: 100, heatLevel: 2, color: '#333', ports: { power: 1 } },
  ],
  cables: [{ id: 'power', fromDeviceId: 'zero', toDeviceId: 'top', type: 'power', color: '#333', nodes: [], extra: 'preserve' }],
  reservations: [{ id: 'future', name: 'Future shelf', positionU: 12, sizeU: 2, mountSide: 'rear', widthType: '19in', purpose: 'shelf', extra: 'keep' }],
  services: [{ id: 'svc', name: 'Service', criticality: 'high', hostDeviceId: 'top' }],
};
const saved = async (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
async function contents(download: Download) { return readFile((await download.path())!, 'utf8'); }
async function boot(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('rack-simulator-new-shell', '1'));
  await page.goto('/');
}
async function importFixture(page: Page) {
  await page.locator('input[type=file]').first().setInputFiles({ name: 'recovery.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole('dialog', { name: 'Import rack layout?', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Layout recovery' })).toContainText('Out-of-bounds planning data retained');
}
async function openShrink(page: Page) {
  await page.getByTestId('workspace-tools-trigger').click();
  await page.getByRole('button', { name: /Settings →/ }).click();
  await page.getByRole('button', { name: 'Rack settings', exact: true }).click();
  await page.locator('#rack-height-select').focus();
  await page.locator('#rack-height-select').selectOption('6');
  return page.getByRole('dialog', { name: 'Review rack height reduction' });
}

test('0U import, export and reload retain original planning data and render the PDU', async ({ page }) => {
  await boot(page);
  await importFixture(page);
  const region = page.getByRole('region', { name: 'Layout recovery' });
  await expect(region).not.toContainText('Unsupported 0U hardware');
  await expect(page.locator('[data-device-id="zero"]')).toBeVisible();
  const button = region.getByRole('button', { name: 'Download workspace JSON' });
  await button.focus();
  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const exported = JSON.parse(await contents(await download)).racks[0];
  expect(exported.devices[0]).toEqual(fixture.devices[0]);
  expect(exported.cables).toEqual(fixture.cables);
  expect(exported.reservations).toEqual(fixture.reservations);
  expect(exported.extension).toEqual(fixture.extension);
  await page.reload();
  await expect(page.locator('[data-device-id="zero"]')).toBeVisible();
  expect((await saved(page)).racks[0]).toEqual(exported);
});

test('shrink Cancel and Escape are safe; retain reports dependencies and survives undo, redo and refresh', async ({ page }) => {
  await boot(page); await importFixture(page);
  const before = await saved(page);
  let dialog = await openShrink(page);
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(dialog).toContainText('High server (top)');
  await expect(dialog).toContainText('Cables (1): power');
  await expect(dialog).toContainText('Future shelf (future)');
  await expect(dialog).toContainText('services[0]');
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  expect(await saved(page)).toEqual(before);
  await expect(page.locator('#rack-height-select')).toBeFocused();
  await page.locator('#rack-height-select').focus();
  await page.locator('#rack-height-select').selectOption('6');
  await page.keyboard.press('Escape');
  expect(await saved(page)).toEqual(before);
  await page.locator('#rack-height-select').focus();
  await page.locator('#rack-height-select').selectOption('6');
  dialog = page.getByRole('dialog', { name: 'Review rack height reduction' });
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Resize and retain all data' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Layout recovery' })).toContainText('Out-of-bounds planning data retained');
  const resized = (await saved(page)).racks[0];
  expect(resized).toMatchObject({ heightU: 6, devices: before.racks[0].devices, reservations: before.racks[0].reservations });
  // Geometry-dependent route nodes refresh after resize; cable identity and metadata survive.
  expect(resized.cables.map(({ nodes: _nodes, ...cable }: { nodes?: unknown; [key: string]: unknown }) => cable))
    .toEqual(before.racks[0].cables.map(({ nodes: _nodes, ...cable }: { nodes?: unknown; [key: string]: unknown }) => cable));
  await page.keyboard.press('ControlOrMeta+z');
  expect((await saved(page)).racks[0].heightU).toBe(12);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect((await saved(page)).racks[0].heightU).toBe(6);
  await page.reload();
  expect((await saved(page)).racks[0]).toMatchObject({ heightU: 6, reservations: fixture.reservations, services: fixture.services });
  await expect(page.getByRole('region', { name: 'Layout recovery' })).toContainText('Out-of-bounds');
});

test('quota failure exposes keyboard-downloadable current workspace; retry recovers', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) {
      if (k === 'homelab-rack-simulator-workspace' && !sessionStorage.getItem('allow-save')) throw new DOMException('secret quota detail', 'QuotaExceededError');
      return write.call(this, k, v);
    };
  });
  await importFixture(page);
  const region = page.getByRole('region', { name: 'Layout recovery' });
  await expect(region.getByRole('alert')).toContainText('Changes are not saved');
  await expect(region).not.toContainText('secret quota detail');
  const download = page.waitForEvent('download');
  await region.getByRole('button', { name: 'Download workspace JSON' }).focus();
  await page.keyboard.press('Space');
  expect(JSON.parse(await contents(await download)).racks[0].devices[0]).toEqual(fixture.devices[0]);
  await page.evaluate(() => sessionStorage.setItem('allow-save', '1'));
  await region.getByRole('button', { name: 'Retry save' }).click();
  await expect(region.getByRole('alert')).toHaveCount(0);
  await page.reload();
  expect((await saved(page)).racks[0].devices[0]).toEqual(fixture.devices[0]);
});

for (const mode of ['malformed', 'oversized'] as const) test(`${mode} saved data stays intact with original download and autosave blocked`, async ({ page }) => {
  await page.addInitScript(({ key, mode }) => {
    if (sessionStorage.getItem('seeded-recovery')) return;
    sessionStorage.setItem('seeded-recovery', '1');
    localStorage.setItem(key, mode === 'malformed' ? '{broken secret-content' : JSON.stringify({ id: 'bad', racks: [] }));
    if (mode === 'oversized') {
      const read = Storage.prototype.getItem;
      Storage.prototype.getItem = function(k) { return k === key ? ' '.repeat(10 * 1024 * 1024 + 1) : read.call(this, k); };
    }
  }, { key, mode });
  await boot(page);
  const region = page.getByRole('region', { name: 'Layout recovery' });
  await expect(region.getByRole('alert')).toContainText('Autosave is paused');
  await expect(region).not.toContainText('secret-content');
  await importFixture(page);
  const download = page.waitForEvent('download');
  await region.getByRole('button', { name: 'Download original saved data' }).click();
  const raw = await contents(await download);
  expect(raw).toBe(mode === 'malformed' ? '{broken secret-content' : ' '.repeat(10 * 1024 * 1024 + 1));
  await expect(region.getByRole('button', { name: 'Retry save' })).toHaveCount(0);
  if (mode === 'malformed') {
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
    await page.reload();
    await expect(region.getByRole('alert')).toContainText('Autosave is paused');
  }
});

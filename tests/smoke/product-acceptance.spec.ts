import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { useRackStore } from '../../src/store/rackStore';

const state = (page: Page) => page.evaluate(() => {
  const s = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
  return { layout: s.layout, workspace: s.workspace, currentRackId: s.currentRackId };
});
const fileMenu = async (page: Page) => {
  const menu = page.getByTestId('more-dropdown');
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
  return menu;
};
const importRack = async (page: Page, raw: string) => {
  const chooser = page.waitForEvent('filechooser');
  await (await fileMenu(page)).getByRole('button', { name: 'Import rack', exact: true }).click();
  await (await chooser).setFiles({ name: 'acceptance-rack.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
};
const closeSheets = async (page: Page) => {
  for (const name of ['Device library', 'Inspector']) {
    if (await page.getByRole('dialog', { name, exact: true }).isVisible()) await page.keyboard.press('Escape');
  }
};
const openLibrary = async (page: Page) => {
  if (!(await page.getByTestId('device-library-panel').isVisible())) await page.getByTestId('toggle-device-library').click();
};
const openInspector = async (page: Page) => {
  await closeSheets(page);
  const open = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await open.isVisible()) await open.click();
};

for (const width of [1440, 390]) {
  test(`replacement confirmation protects inventory, import cancellation and sibling identity at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      const s = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      const empty = { ...s.layout, id: 'target', name: 'Inventory only', devices: [], cables: [], unplacedDevices: [s.layout.devices[0]], reservations: [{ id: 'r', name: 'Future rack space', positionU: 2, sizeU: 1, mountSide: 'front' as const, widthType: '10in' as const, purpose: 'other' as const }] };
      s.setWorkspace({ ...s.workspace, racks: [empty, { ...s.layout, id: 'sibling', name: 'Preserve sibling' }], interRackCables: [] });
    });
    const before = await state(page);
    await (await fileMenu(page)).getByRole('button', { name: 'New rack layout', exact: true }).click();
    const newDialog = page.getByRole('dialog', { name: 'Start a new layout?', exact: true });
    await expect(newDialog).toContainText('inventory and records');
    await expect(newDialog).toContainText('Undo history');
    await expect(newDialog.locator(':focus')).toHaveText(/^(Cancel|Close)$/);
    await page.keyboard.press('Enter');
    expect(await state(page)).toEqual(before);
    const raw = JSON.stringify(before.workspace.racks[1]);
    await importRack(page, raw);
    const dialog = page.getByRole('dialog', { name: 'Import rack layout?', exact: true });
    await expect(dialog).toContainText('Preserve sibling');
    await expect(dialog.locator(':focus')).toHaveText(/^(Cancel|Close)$/);
    expect(await state(page)).toEqual(before);
    await page.screenshot({ path: `../evidence/import-review-${testInfo.project.name}-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    expect(await state(page)).toEqual(before);
    await expect(page.getByTestId('more-dropdown').locator('summary')).toBeFocused();
    await importRack(page, raw);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    expect(await state(page)).toEqual(before);
    await importRack(page, raw);
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    const imported = await state(page);
    expect(imported.layout.id).not.toBe('sibling');
    expect(imported.currentRackId).toBe(imported.layout.id);
    expect(imported.workspace.racks[1]).toEqual(before.workspace.racks[1]);
    expect(new Set(imported.workspace.racks.map(r => r.id)).size).toBe(2);
    await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Imported independent copy');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Layout name', exact: true })).toHaveValue('Imported independent copy');
    expect((await state(page)).workspace.racks[1]).toEqual(before.workspace.racks[1]);
    const stable = await state(page);
    await importRack(page, '{bad json');
    await expect(page.getByText('Failed to read rack layout file.', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Import rack layout?', exact: true })).toHaveCount(0);
    expect(await state(page)).toEqual(stable);
    await importRack(page, JSON.stringify({ ...stable.layout, devices: [{ id: 'invalid' }] }));
    await expect(page.getByText('Invalid rack layout JSON file. Current data has not changed.', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Import rack layout?', exact: true })).toHaveCount(0);
    expect(await state(page)).toEqual(stable);
    if (width < 1024) {
      const footer = await page.getByRole('contentinfo', { name: 'Save and backup status' }).boundingBox();
      const inspector = page.getByRole('button', { name: 'Open inspector', exact: true });
      if (await inspector.isVisible()) {
        const bounds = await inspector.boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y);
      }
    }
  });

  test(`new user completes build, manual backbone, A–B, Check and backup at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto('/');
    const fresh = await state(page);
    await (await fileMenu(page)).getByRole('button', { name: 'New rack layout', exact: true }).click();
    await page.getByRole('dialog', { name: 'Start a new layout?' }).getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Acceptance lab');
    await page.getByTestId('workspace-tools-trigger').click();
    await page.getByRole('button', { name: /Settings →/ }).click();
    await page.getByTestId('shell-top-bar').getByRole('button', { name: 'Rack settings', exact: true }).click();
    await page.getByRole('combobox', { name: 'Rack type', exact: true }).selectOption('19in');
    await page.locator('#rack-height-select').selectOption('12');
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    const add = async (template: string, name: string, position: number) => {
      await openLibrary(page);
      await page.getByRole('textbox', { name: 'Search devices', exact: true }).fill(template);
      await page.getByRole('button', { name: `Add ${template} to front`, exact: true }).click();
      await openInspector(page);
      await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await page.getByRole('spinbutton', { name: 'Position U', exact: true }).fill(String(position));
      await closeSheets(page);
      return (await state(page)).layout.devices.find(d => d.name === name)!.id;
    };
    const server = await add('1U short-depth server', 'Server A', 2);
    const p1 = await add('24-port patch panel', 'P1', 4);
    const p2 = await add('24-port patch panel', 'P2', 7);
    const sw = await add('24-port managed switch', 'Switch B', 9);
    const custom = await add('Custom device', 'My custom appliance', 11);
    await openInspector(page);
    await page.getByRole('button', { name: 'Dimensions & placement', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Depth mm', exact: true }).fill('180');
    await page.getByRole('spinbutton', { name: 'Custom width mm', exact: true }).fill('200');
    await closeSheets(page);
    expect((await state(page)).layout.devices.find(d => d.id === custom)).toMatchObject({ depthMm: 180, customWidthMm: 200 });
    // UI editing and undo keep the custom device installed.
    await page.locator(`[data-device-id="${server}"]`).click();
    await openInspector(page);
    await page.getByRole('spinbutton', { name: 'Position U', exact: true }).fill('3');
    await closeSheets(page);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await state(page)).layout.devices.find(d => d.id === server)?.positionU).toBe(2);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect((await state(page)).layout.devices.find(d => d.id === server)?.positionU).toBe(3);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('button', { name: 'Cable', exact: true }).click();
    if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
    await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
    await page.getByRole('button', { name: /^P1 \d+ available$/ }).click();
    await page.getByRole('button', { name: 'Rear face', exact: true }).click();
    await page.getByRole('button', { name: 'LAN 3 · rear · Available', exact: true }).click();
    await page.getByRole('button', { name: /^P2 \d+ available$/ }).click();
    await page.getByRole('button', { name: 'Rear face', exact: true }).click();
    await page.getByRole('button', { name: 'LAN 7 · rear · Available', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Keep connecting from this device', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Connect cable', exact: true }).click();
    const backbone = (await state(page)).layout.cables[0];
    expect(backbone).toMatchObject({ type: 'structured', fromDeviceId: p1, toDeviceId: p2, fromPort: { index: 2, side: 'rear' }, toPort: { index: 6, side: 'rear' } });
    if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
    await page.getByRole('button', { name: 'Connect A–B · 經配線架', exact: true }).click();
    await page.getByLabel('Device A', { exact: true }).selectOption(server);
    await page.getByLabel('Device B', { exact: true }).selectOption(sw);
    await page.getByLabel('Path preference', { exact: true }).selectOption('two-panels');
    await page.getByRole('button', { name: 'Preview paths · 預覽路徑', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Physical path preview' })).toContainText('Reuse existing cable');
    await page.screenshot({ path: `../evidence/journey-ab-${testInfo.project.name}-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    expect((await state(page)).layout.cables).toEqual([backbone]);
    if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
    await page.getByRole('button', { name: 'Connect A–B · 經配線架', exact: true }).click();
    await page.getByLabel('Device A', { exact: true }).selectOption(server);
    await page.getByLabel('Device B', { exact: true }).selectOption(sw);
    await page.getByLabel('Path preference', { exact: true }).selectOption('two-panels');
    await page.getByRole('button', { name: 'Preview paths · 預覽路徑', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm 2 new segment(s) · 確認', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Connection present · 已完成', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    const connected = (await state(page)).layout.cables;
    expect(connected).toHaveLength(3);
    expect(connected.filter(c => c.installationRole === 'patch-cord')).toHaveLength(2);
    expect(connected.find(c => c.id === backbone.id)).toEqual(backbone);
    // Cable undo is one complete transaction; the existing backbone remains.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await state(page)).layout.cables).toEqual([backbone]);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
    await page.getByRole('button', { name: '整理走線 · Tidy routes', exact: true }).click();
    const physical = (await state(page)).layout.cables.map(({ nodes: _n, manualPath: _m, routingOrigin: _r, ...c }) => c);
    expect(physical).toEqual(connected.map(({ nodes: _n, manualPath: _m, routingOrigin: _r, ...c }) => c));
    const tidied = (await state(page)).layout.cables;
    await page.getByRole('button', { name: '整理走線 · Tidy routes', exact: true }).click();
    expect((await state(page)).layout.cables).toEqual(tidied);
    if (width < 1024) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Check Health', exact: true }).click();
    await expect(page.getByTestId('finding-summary-confirmed')).toBeVisible();
    await expect(page.getByTestId('finding-summary-verification')).toBeVisible();
    await page.screenshot({ path: `../evidence/journey-check-${testInfo.project.name}-${width}.png`, fullPage: true });
    await (await fileMenu(page)).getByRole('button', { name: 'Save local copy', exact: true }).click();
    const saved = await state(page);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Layout name', exact: true })).toHaveValue('Acceptance lab');
    // Loading supplies empty optional collections; every saved value must survive.
    const reloaded = await state(page);
    expect(reloaded.workspace).toMatchObject({ ...saved.workspace });
    const download = page.waitForEvent('download');
    await (await fileMenu(page)).getByRole('button', { name: 'Export rack JSON', exact: true }).click();
    const raw = await readFile((await (await download).path())!, 'utf8');
    expect(JSON.parse(raw)).toEqual(reloaded.layout);
    await (await fileMenu(page)).getByRole('button', { name: 'Workspace backup and restore', exact: true }).click();
    const backup = page.getByRole('dialog', { name: 'Workspace backup and restore', exact: true });
    const fullDownload = page.waitForEvent('download');
    await backup.getByRole('button', { name: 'Download full workspace backup', exact: true }).click();
    const full = await readFile((await (await fullDownload).path())!, 'utf8');
    await backup.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Temporary change');
    const changed = await state(page);
    await (await fileMenu(page)).getByRole('button', { name: 'Workspace backup and restore', exact: true }).click();
    await backup.getByLabel('Choose workspace backup to restore').setInputFiles({ name: 'full.json', mimeType: 'application/json', buffer: Buffer.from(full) });
    await expect(backup.getByRole('button', { name: 'Restore workspace', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    expect(await state(page)).toEqual(changed);
    await (await fileMenu(page)).getByRole('button', { name: 'Workspace backup and restore', exact: true }).click();
    await backup.getByLabel('Choose workspace backup to restore').setInputFiles({ name: 'full.json', mimeType: 'application/json', buffer: Buffer.from(full) });
    await backup.getByRole('checkbox', { name: 'Replace my current workspace with this backup' }).check();
    await backup.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Layout name', exact: true })).toHaveValue('Acceptance lab');
    expect((await state(page)).workspace).toEqual(JSON.parse(full));
    expect((await state(page)).layout.id).not.toBe(fresh.layout.id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}


test('import preview cannot replace a different rack after the current rack changes', async ({ page }) => {
  await page.goto('/');
  const original = await state(page);
  await importRack(page, JSON.stringify({ ...original.layout, name: 'Incoming rack' }));
  const dialog = page.getByRole('dialog', { name: 'Import rack layout?', exact: true });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().createRack('Different current rack'));
  const different = await state(page);
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  expect(await state(page)).toEqual(different);
  await expect(page.getByText('Current rack changed. Import cancelled; choose the file again for the intended rack.', { exact: true })).toBeVisible();
});

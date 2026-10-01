import { expect, test, type Page } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

const seed = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => {
    const state = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const device = (id: string, category: 'server' | 'switch' | 'patch-panel', positionU: number) => ({ id, name: id === 'A' ? 'Server A' : id === 'B' ? 'Switch B' : id, category, positionU, sizeU: 1, depthMm: 200, widthType: '19in' as const, weightKg: 1, powerW: 20, heatLevel: 1 as const, ports: { ethernet: category === 'patch-panel' ? 8 : 2 }, color: '#64748b' });
    state.loadLayout({ ...state.layout, id: 'chain-browser', rackType: '19in', name: 'A–B Patch Studio', heightU: 12, rackDepthMm: 600, devices: [device('A', 'server', 2), device('B', 'switch', 9), device('P1', 'patch-panel', 4), device('P2', 'patch-panel', 7)], cables: [{ id: 'backbone', label: 'Installed P1#3–P2#7', fromDeviceId: 'P1', fromPort: { type: 'ethernet', index: 2, side: 'rear' }, toDeviceId: 'P2', toPort: { type: 'ethernet', index: 6, side: 'rear' }, type: 'structured', color: '#38bdf8', lifecycleStatus: 'active', lengthMm: 5000, length: '5m' }] });
  });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
};
const preview = async (page: Page) => {
  await page.getByRole('button', { name: 'Connect A–B · 經配線架', exact: true }).click();
  await page.getByLabel('Device A').selectOption('A');
  await page.getByLabel('Device B').selectOption('B');
  await page.getByLabel('Path preference').selectOption('two-panels');
  await page.getByRole('button', { name: 'Preview paths · 預覽路徑', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Physical path preview' })).toContainText('Installed P1#3–P2#7');
};
for (const width of [1440, 390]) test(`realistic A–B preview, atomic confirm and persistence at ${width}px`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
  await seed(page);
  if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
  await preview(page);
  const confirm = page.getByRole('button', { name: 'Confirm 2 new segment(s) · 確認', exact: true });
  await confirm.scrollIntoViewIfNeeded(); await expect(confirm).toBeInViewport();
  await page.screenshot({ path: `../evidence/ab-preview-${width}.png`, fullPage: true });
  await confirm.click(); await expect(page.getByRole('button', { name: 'Connection present · 已完成', exact: true })).toBeDisabled();
  const state = await page.evaluate(() => { const s = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState(); return { cables: s.layout.cables, history: s.history.length }; });
  expect(state.cables.length).toBe(3);
  expect(state.cables.filter(c => c.installationRole === 'patch-cord').length).toBe(2);
  expect(state.cables.find(c => c.id === 'backbone')).toMatchObject({ lengthMm: 5000, lifecycleStatus: 'active', fromPort: { index: 2 }, toPort: { index: 6 } });
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().undo());
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables.length)).toBe(1);
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().redo());
  await page.getByRole('button', { name: 'Cancel · 取消', exact: true }).click();
  if (width < 1024) await page.getByRole('button', { name: 'Cable list', exact: true }).click();
  await page.getByRole('button', { name: '整理走線 · Tidy routes', exact: true }).click();
  await page.screenshot({ path: `../evidence/ab-integrated-${width}.png`, fullPage: true });
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables.length)).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
test('cancel keyboard focus and stale preview reject without partial writes', async ({ page }) => {
  await seed(page); await preview(page);
  await page.getByRole('radio').first().focus(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Connect A–B · 經配線架接線', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect A–B · 經配線架', exact: true })).toBeFocused();
  await preview(page);
  await page.evaluate(() => { const s = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState(); s.updateDevice('P1', { positionU: 5 }); });
  await expect(page.getByRole('button', { name: 'Confirm 2 new segment(s) · 確認', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Layout changed');
  expect(await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables.length)).toBe(1);
});

test('panel tidy retains cable identity in 2D and both 3D route styles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await seed(page); await preview(page);
  await page.getByRole('button', { name: 'Confirm 2 new segment(s) · 確認', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel · 取消', exact: true }).click();
  const physical = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables.map(c => ({ ...c, nodes: undefined, manualPath: undefined, routingOrigin: undefined })));
  await page.getByRole('button', { name: '整理走線 · Tidy routes', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  const viewer = page.getByTestId('cable-viewer-3d'); await expect(viewer.locator('canvas')).toBeVisible();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().selectCable('backbone'));
  for (const style of ['clean', 'realistic']) {
    await viewer.locator('summary').click(); await viewer.getByRole('button', { name: style, exact: true }).click(); await viewer.locator('summary').click();
    await expect(viewer.getByRole('button', { name: 'Fit route', exact: true })).toBeVisible();
    await expect(viewer.getByLabel('3D route length')).toContainText('3D centreline');
  }
  await viewer.getByLabel('Camera view').selectOption('rear-angle');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '../evidence/panel-tidy-3d.png', fullPage: true });
  const after = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.cables.map(c => ({ ...c, nodes: undefined, manualPath: undefined, routingOrigin: undefined })));
  expect(after).toEqual(physical);
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
});

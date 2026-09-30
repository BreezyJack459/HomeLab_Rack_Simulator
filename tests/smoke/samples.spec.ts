import { expect, test, type Page } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

const layout = (page: Page) => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout);
async function openPicker(page: Page) {
  await page.locator('[data-testid="more-dropdown"] summary').click();
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  return page.getByRole('dialog', { name: 'Load sample layout', exact: true });
}
async function choose(page: Page, sampleId: string) {
  const picker = await openPicker(page);
  await picker.getByTestId(`sample-card-${sampleId}`).getByRole('button').click();
  await expect(page.getByRole('dialog', { name: 'Load sample layout?', exact: true })).toBeVisible();
}
for (const width of [1440, 390]) {
  test(`learning examples support selection, cancellation, reload and readable guides at ${width}px`, async ({ page }) => {
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Check Health', exact: true })).toBeVisible();
    await expect(page.getByTestId('example-guide')).toBeVisible();
    await expect.poll(async () => (await layout(page)).example?.sampleId).toBe('learn-beginner-10in');
    const beginner = await layout(page);
    expect(beginner.rackType).toBe('10in');
    const picker = await openPicker(page);
    for (const id of ['learn-beginner-10in', 'learn-advanced-19in', 'learn-troubleshooting-19in']) await expect(picker.getByTestId(`sample-card-${id}`)).toBeVisible();
    await expect(picker.getByText('INTENTIONAL FAULTS · 故意設置問題')).toBeVisible();
    await picker.getByText('Legacy examples / 原有示例 (4)', { exact: true }).click();
    await expect(picker.locator('[data-testid^="sample-card-"]')).toHaveCount(7);
    await expect(picker.locator('[data-testid^="sample-card-sample-"]')).toHaveCount(4);
    await picker.getByRole('button', { name: 'Close', exact: true }).click();
    expect(await layout(page)).toEqual(beginner);
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      store.loadLayout({ ...store.layout, name: 'Edited empty plan', devices: [], cables: [], powerBudgetW: 321, evidenceRecords: [{ id: 'saved-evidence', entityType: 'rack', entityId: store.layout.id, type: 'other', title: 'Preserve review', source: 'Disposable test record', notes: 'User record' }] });
    });
    const edited = await layout(page);
    await choose(page, 'learn-advanced-19in');
    const confirmation = page.getByRole('dialog', { name: 'Load sample layout?', exact: true });
    await expect(confirmation.getByText(/settings, inventory and records/)).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await layout(page)).toEqual(edited);
    await choose(page, 'learn-advanced-19in');
    await page.keyboard.press('Escape');
    await expect(confirmation).not.toBeVisible();
    expect(await layout(page)).toEqual(edited);
    await choose(page, 'learn-advanced-19in');
    await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect.poll(async () => (await layout(page)).example?.sampleId).toBe('learn-advanced-19in');
    await expect(page.getByTestId('example-guide')).toBeVisible();
    await choose(page, 'learn-troubleshooting-19in');
    await expect(confirmation.getByText(/INTENTIONAL FAULTS/)).toBeVisible();
    await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect.poll(async () => (await layout(page)).example?.sampleId).toBe('learn-troubleshooting-19in');
    const guide = page.getByTestId('example-guide');
    await expect(guide.getByText('INTENTIONAL FAULTS · 故意設置問題')).toBeVisible();
    await guide.getByText(/Troubleshooting steps/).click();
    await expect(guide.locator('ol li').first()).toBeVisible();
    await guide.getByText(/Example guide & assumptions/).click();
    await expect(guide.getByText(/Missing evidence remains unverified in Check/)).toBeVisible();
    await page.getByRole('button', { name: 'Cable', exact: true }).click();
    await expect(guide).toBeVisible();
    await page.getByRole('button', { name: 'Check Health', exact: true }).click();
    await expect(guide).toBeVisible();
    await page.reload();
    await expect(guide).toBeVisible();
    await expect.poll(async () => (await layout(page)).example?.sampleId).toBe('learn-troubleshooting-19in');
    await choose(page, 'learn-beginner-10in');
    await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect.poll(async () => (await layout(page)).example?.sampleId).toBe('learn-beginner-10in');
    expect(browserErrors).toEqual([]);
  });
}

test('beginner and advanced examples render 2D and both 3D views without runtime errors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const sampleId of ['learn-beginner-10in', 'learn-advanced-19in']) {
    await choose(page, sampleId);
    await page.getByRole('dialog', { name: 'Load sample layout?', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('button', { name: 'Build Rack', exact: true }).click();
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.getByTestId('example-guide')).toBeVisible();
    await page.screenshot({ path: `/tmp/${sampleId}-2d.png` });
    await page.getByRole('button', { name: '3D', exact: true }).click();
    const rack = page.getByTestId('rack-inspection-3d');
    await expect(rack.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Cable', exact: true }).click();
    await page.getByRole('button', { name: '3D routing', exact: true }).click();
    await expect(page.getByTestId('cable-viewer-3d').locator('canvas')).toBeVisible();
    await expect(page.getByTestId('example-guide')).toBeVisible();
    await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

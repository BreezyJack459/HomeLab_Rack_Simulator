import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) {
  test(`File actions and learning entry remain reachable by keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('example-guide')).toBeVisible();
    const original = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout);
    const menu = page.getByTestId('more-dropdown');
    const trigger = menu.locator('summary');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('open', '');
    const bounds = await menu.locator('div').first().boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const save = menu.getByRole('button', { name: 'Save local copy', exact: true });
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await save.focus();
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await menu.getByRole('button', { name: 'Load sample', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Load sample layout', exact: true });
    const beginner = dialog.getByTestId('sample-card-learn-beginner-10in');
    await expect(beginner.getByText('Start here · 入門')).toBeVisible();
    const details = beginner.locator('details');
    await details.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(details).toHaveAttribute('open', '');
    await expect(details.getByText(/Illustrative assumptions/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    const restored = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout);
    expect(restored).toEqual(original);
  });
}

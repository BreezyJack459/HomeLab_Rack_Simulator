import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`catalog filters and comparison work at ${width}px without closing the library`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const library = page.getByTestId('device-library-panel');
    const toggle = page.getByTestId('toggle-device-library');
    await expect(toggle).toBeVisible();
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await expect(library).toBeVisible();
    const search = page.getByRole('textbox', { name: 'Search devices', exact: true });
    for (const name of ['24-port patch panel', 'UniFi Flex 2.5G 8-port']) {
      await search.fill(name);
      await page.getByRole('checkbox', { name: `Compare ${name}`, exact: true }).check();
    }
    await page.getByText('Specification filters', { exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Minimum Ethernet ports' }).fill('999');
    await expect(page.getByText('0 matches', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(search).toHaveValue('');
    await page.getByRole('button', { name: 'Compare selected (2/3)', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Compare devices', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('columnheader', { name: '24-port patch panel', exact: true })).toBeVisible();
    await expect(dialog.getByRole('columnheader', { name: 'UniFi Flex 2.5G 8-port', exact: true })).toBeVisible();
    await expect(dialog.getByRole('row', { name: /Installation support/ })).toContainText('Unknown — not verified');
    await expect(dialog.getByRole('row', { name: /Power reference/ })).toContainText('Passive / no consumption');
    await expect(dialog.getByRole('row', { name: /Recorded ports/ })).not.toContainText('layoutColumns');
    await page.screenshot({ path: `/tmp/library-comparison-${width}.png` });
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(library).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare selected (2/3)', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Clear comparison', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Compare selected (0/3)', exact: true })).toBeDisabled();
  });
}

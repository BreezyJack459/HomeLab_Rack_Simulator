import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1734, height: 1234 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`plugin options stay inside Settings and remain clickable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('rack-simulator-new-shell', '1');
      localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    });
    await page.goto('/');
    const tools = page.getByTestId('workspace-tools-trigger');
    await tools.click();
    await page.getByRole('button', { name: /Settings →/ }).click();
    const plugins = page.getByRole('button', { name: /^Plugins \d/ });
    await plugins.click();
    const panel = page.locator('[aria-label="Workspace tools"]');
    const switches = page.getByRole('group', { name: 'Plugin switches' });
    const bounds = await panel.boundingBox();
    const switchBounds = await switches.boundingBox();
    expect(bounds).not.toBeNull();
    expect(switchBounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs((switchBounds!.x + switchBounds!.width / 2) - (bounds!.x + bounds!.width / 2))).toBeLessThan(2);

    // A button can exist in the DOM yet be clipped by its scroll container.
    // Trial clicks verify that every row can actually be reached and hit.
    await expect(switches.getByRole('button')).toHaveCount(6);
    for (const option of await switches.getByRole('button').all()) {
      await option.click({ trial: true });
    }
    const lastOption = switches.getByRole('button', { name: /Port Labels/ });
    await expect(lastOption).toHaveAttribute('aria-pressed', 'false');
    await lastOption.click();
    await expect(lastOption).toHaveAttribute('aria-pressed', 'true');
    await lastOption.click();
    await expect(lastOption).toHaveAttribute('aria-pressed', 'false');
    if (viewport.width === 1734) {
      await page.screenshot({ path: '/tmp/plugins-menu-fixed.png' });
    }
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(tools).toBeFocused();
    await tools.click();
    await page.getByRole('button', { name: /Settings →/ }).click();
    await plugins.click();
    await page.getByRole('button', { name: 'Build Rack', exact: true }).click();
    await expect(panel).not.toBeVisible();
  });
}

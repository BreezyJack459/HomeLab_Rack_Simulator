import { test, expect } from '@playwright/test';

async function clearLayout(page: any) {
  // Click New to clear any existing layout
  await page.getByRole('button', { name: 'New' }).click();

  // Handle confirmation dialog if it appears (layout had devices)
  const confirmButton = page.getByRole('button', { name: 'Confirm' });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }

  // Use header-specific locator to avoid duplicate matches
  await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();
}

test.describe('Rack Simulator Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Reset theme to ensure consistent dark-mode default
    await page.evaluate(() => localStorage.removeItem('rack-simulator-theme'));
    await page.reload();
    await clearLayout(page);
  });

  test('loads app with default layout', async ({ page }) => {
    await expect(page).toHaveTitle(/Homelab Rack Simulator/i);
    await expect(page.getByText('Layout clear')).toBeVisible();
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();
  });

  test('switches between 2D, 3D, and Cables views', async ({ page }) => {
    const header = page.locator('header');

    // 2D is default and active (header buttons only)
    await expect(header.getByRole('button', { name: '2D', exact: true })).toHaveClass(/bg-cyan-400/);

    // Switch to 3D view
    await header.getByRole('button', { name: '3D', exact: true }).click();
    await expect(header.getByRole('button', { name: '3D', exact: true })).toHaveClass(/bg-cyan-400/);

    // Switch to Cables view
    await header.getByRole('button', { name: 'Cables', exact: true }).click();
    await expect(header.getByRole('button', { name: 'Cables', exact: true })).toHaveClass(/bg-cyan-400/);

    // Switch back to 2D
    await header.getByRole('button', { name: '2D', exact: true }).click();
    await expect(header.getByRole('button', { name: '2D', exact: true })).toHaveClass(/bg-cyan-400/);
  });

  test('adds a device from component library', async ({ page }) => {
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();

    // Click the first device's "Add to front" button
    await page.getByRole('button', { name: /Add to/ }).first().click();

    // Verify device count increased
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();
  });

  test('cable planner shows ports after device selection', async ({ page }) => {
    // Add two devices so cable planning is possible
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/2 devices/)).toBeVisible();

    // CablePlanner "Add cable" button should be visible
    await expect(page.getByRole('button', { name: 'Add cable' })).toBeVisible();
  });

  test('exports and imports layout JSON', async ({ page }) => {
    // Add a device
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();

    // Export JSON
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'JSON' }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Clear layout
    await clearLayout(page);

    // Import the JSON back
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import' }).first().click(),
    ]);
    await fileChooser.setFiles(downloadPath!);

    // Verify layout restored
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();
  });

  test('toggles theme between dark and light', async ({ page }) => {
    // Verify dark mode default
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Click theme toggle
    await page.getByRole('button', { name: 'Light' }).click();

    // Verify light mode
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Toggle back to dark
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('loads a sample layout', async ({ page }) => {
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();

    // Open sample dropdown and select first option
    await page.getByLabel('Load sample layout').selectOption({ index: 1 });

    // If confirmation dialog appears (unlikely since layout is empty), confirm it
    const confirmButton = page.getByRole('button', { name: 'Confirm' });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Verify devices loaded (not 0 devices)
    const deviceText = page.locator('header').getByText(/devices/);
    await expect(deviceText).not.toHaveText('0 devices');
  });

  test('undo and redo after adding device', async ({ page }) => {
    // Add a device
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();

    // Undo
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();

    // Redo
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();
  });

  test('deletes a selected device', async ({ page }) => {
    // Add a device
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();

    // Click on the device in the rack to select it
    await page.locator('[data-device-id]').first().click();

    // Click "Remove component" in PropertyPanel
    await page.getByRole('button', { name: 'Remove component' }).click();

    // Verify device removed
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();
  });

  test('shows validation alerts when rack constraints are exceeded', async ({ page }) => {
    // Load a sample layout with devices
    await page.getByLabel('Load sample layout').selectOption({ index: 1 });
    const confirmButton = page.getByRole('button', { name: 'Confirm' });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Verify devices loaded
    await expect(page.locator('header').getByText(/devices/)).not.toHaveText('0 devices');

    // Reduce rack height to trigger overflow validation
    await page.getByLabel('Rack height').selectOption('6');

    // Verify validation alerts appear (not "Layout clear")
    await expect(page.getByText('Layout clear')).not.toBeVisible();
    await expect(page.locator('header').getByText(/\d+ layout alerts?/)).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

async function openDeviceLibrary(page: import('@playwright/test').Page) {
  const panel = page.getByTestId('device-library-panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByTestId('toggle-device-library').click();
    await expect(panel).toBeVisible();
  }
}

async function openFileMenu(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="more-dropdown"] summary').click();
}

async function clearLayout(page: any) {
  // Click New to clear any existing layout
  await openFileMenu(page);
  await page.getByRole('button', { name: 'New rack layout' }).click();

  // Handle confirmation dialog if it appears (layout had devices)
  const confirmButton = page.getByRole('button', { name: 'Confirm' });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }

  // Wait for device count to show 0
  await expect(page.locator('[data-testid="context-stats"]').getByText(/0 devices/)).toBeVisible();
}

test.describe('Rack Simulator Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Reset theme to ensure consistent dark-mode default
    await page.evaluate(() => {
      localStorage.removeItem('rack-simulator-theme');
      localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    });
    await page.reload();
    await clearLayout(page);
  });

  test('loads app with default layout', async ({ page }) => {
    await expect(page).toHaveTitle(/Homelab Rack Simulator/i);
    await expect(page.getByText('Layout clear')).toBeVisible();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/0 devices/)).toBeVisible();
  });

  test('switches between 2D, 3D, and Cables views', async ({ page }) => {
    const activeClass = /bg-cyan-500/;

    // 2D is default and active
    await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveClass(activeClass);

    // Switch to 3D view
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveClass(activeClass);

    // Switch to Cables view
    await page.getByRole('button', { name: 'Cables', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cables', exact: true })).toHaveClass(activeClass);

    // Switch back to 2D
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveClass(activeClass);
  });

  test('adds a device from component library', async ({ page }) => {
    await expect(page.locator('[data-testid="context-stats"]').getByText(/0 devices/)).toBeVisible();

    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();

    // Verify device count increased
    await expect(page.locator('[data-testid="context-stats"]').getByText(/1 devices/)).toBeVisible();
  });

  test('cable planner shows ports after device selection', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/2 devices/)).toBeVisible();

    // CablePlanner "Add cable" button should be visible
    await expect(page.getByRole('button', { name: 'Add cable' })).toBeVisible();
  });

  test('exports and imports layout JSON', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/1 devices/)).toBeVisible();

    // Export JSON
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openFileMenu(page);
        await page.getByRole('button', { name: 'Export rack JSON' }).click();
      })(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Clear layout
    await clearLayout(page);

    // Import the JSON back
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import rack' }).click(),
    ]);
    await fileChooser.setFiles(downloadPath!);

    // Verify layout restored
    await expect(page.locator('[data-testid="context-stats"]').getByText(/1 devices/)).toBeVisible();
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
    await expect(page.locator('[data-testid="context-stats"]').getByText(/0 devices/)).toBeVisible();

    await page.getByRole('button', { name: 'Load sample' }).click();

    // Select the first sample from the modal
    await expect(page.locator('[data-testid="sample-picker-modal"]')).toBeVisible();
    await page.locator('[data-testid="sample-picker-modal"] button').filter({ hasText: /devices/ }).first().click();

    // If confirmation dialog appears (unlikely since layout is empty), confirm it
    const confirmButton = page.getByRole('button', { name: 'Confirm' });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Verify devices loaded (not 0 devices)
    const deviceText = page.locator('[data-testid="context-stats"]').getByText(/devices/);
    await expect(deviceText).not.toHaveText('0 devices');
  });

  test('undo and redo after adding device', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/1 devices/)).toBeVisible();

    // Undo
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/0 devices/)).toBeVisible();

    // Redo
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/1 devices/)).toBeVisible();
  });

  test('deletes a selected device', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('[data-testid="context-stats"]').getByText(/1 devices/)).toBeVisible();

    // Click on the device in the rack to select it
    await page.locator('[data-device-id]').first().click();

    // Click "Remove component" in PropertyPanel
    await page.getByRole('button', { name: 'Remove component' }).click();

    // Verify device removed
    await expect(page.locator('[data-testid="context-stats"]').getByText(/0 devices/)).toBeVisible();
  });

  test('shows validation alerts when rack constraints are exceeded', async ({ page }) => {
    // Load a sample layout with devices
    await page.getByRole('button', { name: 'Load sample' }).click();

    // Select the first sample from the modal
    await expect(page.locator('[data-testid="sample-picker-modal"]')).toBeVisible();
    await page.locator('[data-testid="sample-picker-modal"] button').filter({ hasText: /devices/ }).first().click();

    const confirmButton = page.getByRole('button', { name: 'Confirm' });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Verify devices loaded
    await expect(page.locator('[data-testid="context-stats"]').getByText(/devices/)).not.toHaveText('0 devices');

    await page.getByRole('button', { name: 'Tune' }).click();
    await page.getByLabel('Height').selectOption('6');

    // Verify validation alerts appear (not "Layout clear")
    await expect(page.getByText('Layout clear')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Open alerts' })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

async function openDeviceLibrary(page: import('@playwright/test').Page) {
  const panel = page.getByTestId('device-library-panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByTestId('toggle-device-library').click();
    await expect(panel).toBeVisible();
  }
}

// The action bar groups actions into three dropdown menus:
// Create (new/sample/import), Actions (cable/alerts/undo), File & export.
async function openMenu(page: import('@playwright/test').Page, testId: string) {
  await page.locator(`[data-testid="${testId}"] summary`).click();
}

const openCreateMenu = (page: import('@playwright/test').Page) =>
  openMenu(page, 'create-dropdown');
const openActionsMenu = (page: import('@playwright/test').Page) =>
  openMenu(page, 'actions-dropdown');
const openFileMenu = (page: import('@playwright/test').Page) =>
  openMenu(page, 'more-dropdown');

// Device count is shown as a "Devices" summary chip in the rack summary bar.
function deviceCountChip(page: import('@playwright/test').Page, count: number | string) {
  return page
    .locator('[data-testid="rack-summary"]')
    .getByText(new RegExp(`^Devices\\s*${count}$`));
}

async function clearLayout(page: any) {
  // Click "New rack layout" in the Create menu to clear any existing layout
  await openCreateMenu(page);
  await page.getByRole('button', { name: 'New rack layout' }).click();

  // Handle confirmation dialog if it appears (layout had devices)
  const confirmButton = page.getByRole('button', { name: 'Confirm' });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }

  // Wait for device count to show 0
  await expect(deviceCountChip(page, 0)).toBeVisible();
}

async function loadFirstSample(page: any) {
  await openCreateMenu(page);
  await page.getByRole('button', { name: 'Load sample' }).click();

  // Select the first sample from the modal
  await expect(page.locator('[data-testid="sample-picker-modal"]')).toBeVisible();
  await page.locator('[data-testid="sample-picker-modal"] button').filter({ hasText: /devices/ }).first().click();

  // If confirmation dialog appears (layout was not empty), confirm it
  const confirmButton = page.getByRole('button', { name: 'Confirm' });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }
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
    await expect(deviceCountChip(page, 0)).toBeVisible();
    // No validation issues on an empty rack
    await expect(
      page.locator('[data-testid="rack-summary"]').getByRole('button', { name: '0' }),
    ).toBeVisible();
  });

  test('switches between 2D, 3D, and Cables views', async ({ page }) => {
    const activeClass = /bg-accent-solid/;

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
    await expect(deviceCountChip(page, 0)).toBeVisible();

    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();

    // Verify device count increased
    await expect(deviceCountChip(page, 1)).toBeVisible();
  });

  test('cable planner shows ports after device selection', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(deviceCountChip(page, 2)).toBeVisible();

    // CablePlanner "Add cable" button should be visible in the inspector
    await expect(page.getByRole('button', { name: 'Add cable' })).toBeVisible();
  });

  test('exports and imports layout JSON', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(deviceCountChip(page, 1)).toBeVisible();

    // Export JSON from the File & export menu
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

    // Import the JSON back via the Create menu
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      (async () => {
        await openCreateMenu(page);
        await page.getByRole('button', { name: 'Import rack' }).click();
      })(),
    ]);
    await fileChooser.setFiles(downloadPath!);

    // Verify layout restored
    await expect(deviceCountChip(page, 1)).toBeVisible();
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
    await expect(deviceCountChip(page, 0)).toBeVisible();

    await loadFirstSample(page);

    // Verify devices loaded (not 0 devices)
    await expect(deviceCountChip(page, '[1-9]')).toBeVisible();
  });

  test('undo and redo after adding device', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(deviceCountChip(page, 1)).toBeVisible();

    // Undo (in the Actions menu)
    await openActionsMenu(page);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(deviceCountChip(page, 0)).toBeVisible();

    // Redo
    await openActionsMenu(page);
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(deviceCountChip(page, 1)).toBeVisible();
  });

  test('deletes a selected device', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(deviceCountChip(page, 1)).toBeVisible();

    // Click on the device in the rack to select it
    await page.locator('[data-device-id]').first().click();

    // Click "Remove component" in PropertyPanel
    await page.getByRole('button', { name: 'Remove component' }).click();

    // Verify device removed
    await expect(deviceCountChip(page, 0)).toBeVisible();
  });

  test('shows validation alerts when rack constraints are exceeded', async ({ page }) => {
    // Load a sample layout with devices
    await loadFirstSample(page);

    // Verify devices loaded
    await expect(deviceCountChip(page, '[1-9]')).toBeVisible();

    // Shrink the rack to 6U so devices no longer fit
    await page.getByRole('button', { name: 'Tune' }).click();
    await page.getByLabel('Height').selectOption('6');

    // Verify the alerts button shows a non-zero issue count
    await expect(
      page.locator('[data-testid="rack-summary"]').getByRole('button', { name: /^[1-9]\d*$/ }),
    ).toBeVisible();
  });
});

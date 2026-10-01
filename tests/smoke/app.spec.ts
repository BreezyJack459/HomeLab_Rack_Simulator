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
  openMenu(page, 'more-dropdown');

const openFileMenu = (page: import('@playwright/test').Page) =>
  openMenu(page, 'more-dropdown');

// Device count is shown as quiet text ("…·N devices·…") in the rack summary bar.
// The [^0-9] guard keeps "0 devices" from matching inside "10 devices".
function deviceCountChip(page: import('@playwright/test').Page, count: number | string) {
  return page
    .locator('[data-testid="rack-device-count"]')
    .getByText(new RegExp(`(^|[^0-9])${count}\\s*devices`));
}

async function clearLayout(page: any) {
  await openCreateMenu(page);
  await page.getByRole('button', { name: 'New rack layout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start a new layout?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(deviceCountChip(page, 0)).toBeVisible();
}

async function loadFirstSample(page: any, sampleId = 'learn-beginner-10in') {
  await openCreateMenu(page);
  await page.getByRole('button', { name: 'Load sample' }).click();

  // Select the first sample from the modal
  await expect(page.locator('[data-testid="sample-picker-modal"]')).toBeVisible();
  await page.getByTestId(`sample-card-${sampleId}`).getByRole('button').click();

  // Explicit sample replacement always requires confirmation, even if empty.
  const dialog = page.getByRole('dialog', { name: 'Load sample layout?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
}

test.describe('Rack Simulator Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/');
    // Reset theme to ensure consistent dark-mode default
    await page.evaluate(() => {
      localStorage.removeItem('rack-simulator-theme');
      localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    });
    await page.reload();
    await clearLayout(page);
    // These library regressions exercise 19-inch hardware, independently of
    // the 10-inch beginner example used only on a genuinely fresh browser.
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: { getState: () => { newLayout: (rackType: '19in', heightU: number) => void } } }).__rackStore;
      store.getState().newLayout('19in', 18);
    });
  });

  test('loads app with default layout', async ({ page }) => {
    await expect(page).toHaveTitle(/Homelab Rack Simulator/i);
    await expect(deviceCountChip(page, 0)).toBeVisible();
    // No validation issues on an empty rack
    await expect(
      page.getByRole('button', { name: '0 confirmed issues',exact:true }),
    ).toBeVisible();
  });

  test('fresh install shows only core workspaces in the nav', async ({ page }) => {
    // Workspace packs (operate/plan/portfolio) are opt-in plugins, so a fresh
    // install only shows the core Build + Check workspaces.
    await expect(page.getByRole('button', { name: /Build\s*Rack/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Check\s*Health/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run\s*Ops/ })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Plan\s*Changes/ })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Fleet\s*Rooms/ })).not.toBeVisible();
  });

  test('switches between 2D, 3D, and Cables views', async ({ page }) => {
    const activeClass = /bg-accent-solid/;

    // 2D is default and active
    await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveClass(activeClass);

    // Switch to 3D view
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveClass(activeClass);

    // Switch to Cables view
    await page.getByRole('button', { name: 'Cable', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cable', exact: true })).toHaveClass(activeClass);

    // Switch back to Build, retaining its previous 3D view.
    await page.getByRole('button', {name:'Build Rack', exact:true}).click();
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveClass(activeClass);
  });

  test('adds a device from component library', async ({ page }) => {
    await expect(deviceCountChip(page, 0)).toBeVisible();

    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /^Add .* to (front|rear)$/ }).first().click();

    // Verify device count increased
    await expect(deviceCountChip(page, 1)).toBeVisible();
  });

  test('cable planner shows ports after device selection', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /^Add .* to (front|rear)$/ }).first().click();
    await page.getByRole('button', { name: /^Add .* to (front|rear)$/ }).first().click();
    await expect(deviceCountChip(page, 2)).toBeVisible();

    await page.getByRole('button', {name:'Cable', exact:true}).click();
    await page.getByRole('button', {name:'+ Connect cable', exact:true}).click();
    await expect(page.getByRole('heading', { name: '1 · Pick a source socket' })).toBeVisible();
    const connector = page.getByRole('region', { name: 'Visual cable connector' });
    await connector.getByRole('button', { name: /available$/ }).first().click();
    await expect(connector.getByRole('button', { name: /LAN 1 · front · Available/ })).toBeVisible();
  });

  test('exports and imports layout JSON', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /^Add .* to (front|rear)$/ }).first().click();
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
    await page.getByRole('dialog', { name: 'Import rack layout?', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click();

    // Verify layout restored
    await expect(deviceCountChip(page, 1)).toBeVisible();
  });

  test('toggles theme between dark and light', async ({ page }) => {
    // Verify dark mode default
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', {name:/Tools/}).click();
    await page.getByRole('button', {name:/Settings →/}).click();
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
    await page.getByRole('button', { name: /^Add .* to (front|rear)$/ }).first().click();
    await expect(deviceCountChip(page, 1)).toBeVisible();

    // Undo (in the Actions menu)
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(deviceCountChip(page, 0)).toBeVisible();

    // Redo
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(deviceCountChip(page, 1)).toBeVisible();
  });

  test('deletes a selected device', async ({ page }) => {
    await openDeviceLibrary(page);
    await page.getByRole('button', { name: /^Add .* to (front|rear)$/ }).first().click();
    await expect(deviceCountChip(page, 1)).toBeVisible();

    // Click on the device in the rack to select it
    await page.locator('[data-device-id]').first().click();

    // Click "Remove component" in PropertyPanel
    await page.getByRole('button', { name: 'Remove component' }).click();

    // Verify device removed
    await expect(deviceCountChip(page, 0)).toBeVisible();
  });

  test('shows validation alerts when rack constraints are exceeded', async ({ page }) => {
    // This resize regression needs devices above U6, independent of the starter.
    await loadFirstSample(page, 'learn-advanced-19in');

    // Verify devices loaded
    await expect(deviceCountChip(page, '[1-9]')).toBeVisible();

    // Shrink the rack to 6U so devices no longer fit
    await page.getByRole('button', {name:/Tools/}).click();
    await page.getByRole('button', {name:/Settings →/}).click();
    await page.getByRole('button', {name:'Rack settings',exact:true}).click();
    await page.getByLabel('Height').selectOption('6');
    await page.getByRole('dialog', { name: 'Review rack height reduction' })
      .getByRole('button', { name: 'Resize and retain all data' }).click();
    await page.getByRole('dialog').getByRole('button', {name:'Close',exact:true}).click();
    // Verify the alerts button shows a non-zero issue count
    await expect(
      page.getByRole('button', { name: /^[1-9]\d* confirmed issues$/ }),
    ).toBeVisible();
  });
});

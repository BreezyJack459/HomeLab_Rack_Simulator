import { test, expect } from '@playwright/test';

// Workspace/rack management lives in the Fleet workspace (Overview lens);
// adding devices happens in the Build workspace via the device library.

async function openDeviceLibrary(page: import('@playwright/test').Page) {
  const panel = page.getByTestId('device-library-panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByTestId('toggle-device-library').click();
    await expect(panel).toBeVisible();
  }
}

async function goToFleet(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Fleet\s*Rooms/ }).click();
  await expect(page.getByRole('button', { name: /My Lab/ })).toBeVisible();
}

async function goToBuild(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Build\s*Rack/ }).click();
}

async function addDeviceToCurrentRack(page: import('@playwright/test').Page) {
  await goToBuild(page);
  await openDeviceLibrary(page);
  await page.getByRole('button', { name: /Add to/ }).first().click();
}

// Rack tabs live inside the scrollable tab bar; scope queries there to
// avoid matching the bottom-tray toggle, which also shows the rack name.
function rackTab(page: import('@playwright/test').Page, name: string | RegExp) {
  return page.locator('div.thin-scrollbar').getByRole('button', { name });
}

async function createRack(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'New Rack' }).click();
  const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Rack' }).first();
  await expect(modal).toBeVisible();
  await modal.getByRole('textbox').fill(name);
  await modal.getByRole('button', { name: 'Create' }).click();
  await expect(modal).not.toBeVisible();
  await expect(rackTab(page, new RegExp(name))).toBeVisible();
}

test.describe('Multi-rack workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('rack-simulator-theme');
      localStorage.removeItem('homelab-rack-simulator-layout-prefs');
      const blankWorkspace = {
        id: `workspace-test`,
        name: 'My Lab',
        racks: [{
          id: 'rack-test',
          name: 'Test Rack',
          rackType: '19in',
          heightU: 12,
          rackDepthMm: 600,
          weightLimitKg: 300,
          powerBudgetW: 1200,
          viewSide: 'front',
          devices: [],
          cables: [],
          reservations: [],
          procurementItems: [],
          readinessChecks: [],
          commissioningChecks: [],
          changeEvents: [],
          updatedAt: new Date().toISOString()
        }],
        interRackCables: [],
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('homelab-rack-simulator-workspace', JSON.stringify(blankWorkspace));
    });
    await page.reload();
    await goToFleet(page);
    await expect(page.getByText('1 rack', { exact: true })).toBeVisible();
    await expect(page.getByText('0 devices', { exact: true })).toBeVisible();
  });

  test('creates a new rack', async ({ page }) => {
    await createRack(page, 'Test Rack 2');
    await expect(page.getByText('2 racks', { exact: true })).toBeVisible();
  });

  test('switches between racks', async ({ page }) => {
    // Add device to rack 1
    await addDeviceToCurrentRack(page);
    await goToFleet(page);
    await expect(page.getByText('1 device', { exact: true })).toBeVisible();

    // Create rack 2 — it becomes the current rack
    await createRack(page, 'Rack 2');
    await expect(page.getByLabel('Layout name')).toHaveValue('Rack 2');

    // Switch back to rack 1 (first tab in the tab bar)
    await page.locator('div.thin-scrollbar').getByRole('button').first().click();
    await expect(page.getByLabel('Layout name')).toHaveValue('Test Rack');
  });

  test('deletes a rack', async ({ page }) => {
    await createRack(page, 'Rack To Delete');

    // Right-click to open context menu and delete
    await rackTab(page, /Rack To Delete/).click({ button: 'right' });
    // Use dispatchEvent to avoid the document mousedown listener closing the menu before click fires
    await page.getByRole('button', { name: 'Delete', exact: true }).dispatchEvent('click');

    // Confirm deletion — target the button inside the full-screen modal overlay
    await page.locator('div.fixed.inset-0 button:has-text("Delete")').click();

    await expect(rackTab(page, /Rack To Delete/)).not.toBeVisible();
    await expect(page.getByText('1 rack', { exact: true })).toBeVisible();
  });

  test('adds inter-rack cable and shows it in InterRackMap', async ({ page }) => {
    // Add device to rack 1
    await addDeviceToCurrentRack(page);
    await goToFleet(page);
    await expect(page.getByText('1 device', { exact: true })).toBeVisible();

    // Create rack 2 (becomes current) and add a device to it
    await createRack(page, 'Rack 2');
    await addDeviceToCurrentRack(page);
    await goToFleet(page);
    await expect(page.getByText('2 devices', { exact: true })).toBeVisible();

    // Use exposed store to add an inter-rack cable
    const hasStore = await page.evaluate(() => !!(window as unknown as Record<string, unknown>).__rackStore);
    expect(hasStore).toBe(true);

    const cableAdded = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__rackStore as
        | { getState: () => { workspace: { racks: Array<{ id: string; devices: Array<{ id: string }> }> }; addInterRackCable: (cable: Record<string, unknown>) => void } }
        | undefined;
      if (!store) return { ok: false, reason: 'no-store' };
      const state = store.getState();
      const rack1 = state.workspace.racks[0];
      const rack2 = state.workspace.racks[1];
      const dev1 = rack1?.devices[0];
      const dev2 = rack2?.devices[0];
      if (!rack1) return { ok: false, reason: 'no-rack1' };
      if (!rack2) return { ok: false, reason: 'no-rack2' };
      if (!dev1) return { ok: false, reason: 'no-dev1', rack1Devices: rack1.devices.length };
      if (!dev2) return { ok: false, reason: 'no-dev2', rack2Devices: rack2.devices.length };
      state.addInterRackCable({
        fromRackId: rack1.id,
        fromDeviceId: dev1.id,
        fromPort: { type: 'ethernet', index: 0 },
        toRackId: rack2.id,
        toDeviceId: dev2.id,
        toPort: { type: 'ethernet', index: 0 },
        type: 'cat6a',
        label: 'Rack1-Rack2',
      });
      return { ok: true };
    });
    expect(cableAdded).toEqual({ ok: true });

    // Verify cable appears in the Interconnect lens (InterRackMap SVG)
    await page.getByRole('button', { name: 'Interconnect', exact: true }).click();
    const svg = page.locator('[data-testid="inter-rack-map-svg"]');
    await expect(svg).toBeVisible();
    await expect(svg.locator('[data-inter-rack-cable]')).toBeVisible();

    // And the workspace stats reflect it back on the Overview lens
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByText('1 inter-rack cable', { exact: true })).toBeVisible();
  });

  test('persists workspace across reloads', async ({ page }) => {
    await createRack(page, 'Persisted Rack');

    // Reload page
    await page.reload();

    // Verify rack still exists
    await goToFleet(page);
    await expect(rackTab(page, /Persisted Rack/)).toBeVisible();
    await expect(page.getByText('2 racks', { exact: true })).toBeVisible();
  });
});

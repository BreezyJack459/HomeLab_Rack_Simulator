import { test, expect } from '@playwright/test';

test.describe('Multi-rack workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
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
    await expect(page.getByText('My Lab')).toBeVisible();
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();
  });

  test('creates a new rack', async ({ page }) => {
    await page.getByRole('button', { name: 'New Rack' }).click();

    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Rack' }).first();
    await expect(modal).toBeVisible();

    await modal.getByRole('textbox').fill('Test Rack 2');
    await modal.getByRole('button', { name: 'Create' }).click();

    await expect(modal).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Test Rack 2/ })).toBeVisible();
    await expect(page.getByText(/2 racks/)).toBeVisible();
  });

  test('switches between racks', async ({ page }) => {
    // Add device to rack 1
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();

    // Create rack 2
    await page.getByRole('button', { name: 'New Rack' }).click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Rack' }).first();
    await modal.getByRole('textbox').fill('Rack 2');
    await modal.getByRole('button', { name: 'Create' }).click();

    // Rack 2 should be active and empty
    await expect(page.locator('header').getByText(/0 devices/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Rack 2/ })).toBeVisible();

    // Switch back to rack 1 (first tab in the tab bar)
    await page.locator('div.thin-scrollbar').getByRole('button').first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();
  });

  test('deletes a rack', async ({ page }) => {
    // Create rack 2
    await page.getByRole('button', { name: 'New Rack' }).click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Rack' }).first();
    await modal.getByRole('textbox').fill('Rack To Delete');
    await modal.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: /Rack To Delete/ })).toBeVisible();

    // Right-click to open context menu and delete
    await page.getByRole('button', { name: /Rack To Delete/ }).click({ button: 'right' });
    // Use dispatchEvent to avoid the document mousedown listener closing the menu before click fires
    await page.getByRole('button', { name: 'Delete', exact: true }).dispatchEvent('click');

    // Confirm deletion — target the button inside the full-screen modal overlay
    await page.locator('div.fixed.inset-0 button:has-text("Delete")').click();

    await expect(page.getByRole('button', { name: /Rack To Delete/ })).not.toBeVisible();
    await expect(page.getByText(/1 rack/)).toBeVisible();
  });

  test('adds inter-rack cable and shows it in InterRackMap', async ({ page }) => {
    // Add device to rack 1
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();

    // Create rack 2
    await page.getByRole('button', { name: 'New Rack' }).click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Rack' }).first();
    await modal.getByRole('textbox').fill('Rack 2');
    await modal.getByRole('button', { name: 'Create' }).click();

    // Add device to rack 2
    await page.getByRole('button', { name: /Add to/ }).first().click();
    await expect(page.locator('header').getByText(/1 devices/)).toBeVisible();

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

    // Verify cable appears in InterRackMap SVG
    const svg = page.locator('[data-testid="inter-rack-map-svg"]');
    await expect(svg).toBeVisible();
    await expect(svg.locator('[data-inter-rack-cable]')).toBeVisible();
    await expect(page.getByText(/1 inter-rack cable/)).toBeVisible();
  });

  test('persists workspace across reloads', async ({ page }) => {
    // Create rack 2
    await page.getByRole('button', { name: 'New Rack' }).click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Rack' }).first();
    await modal.getByRole('textbox').fill('Persisted Rack');
    await modal.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: /Persisted Rack/ })).toBeVisible();

    // Reload page
    await page.reload();

    // Verify rack still exists
    await expect(page.getByRole('button', { name: /Persisted Rack/ })).toBeVisible();
    await expect(page.getByText(/2 racks/)).toBeVisible();
  });
});

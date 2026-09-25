import { expect, test, type Page } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem(
      'homelab-rack-simulator-layout-prefs',
      JSON.stringify({
        deviceLibraryOpen: true,
        enabledPluginIds: ['cable-management'],
      }),
    );
    localStorage.setItem(
      'homelab-rack-simulator-workspace',
      JSON.stringify({
        id: 'test',
        name: 'Test',
        racks: [
          {
            id: 'rack-test',
            name: 'Placement rack',
            rackType: '19in',
            heightU: 12,
            rackDepthMm: 600,
            weightLimitKg: 200,
            powerBudgetW: 1000,
            viewSide: 'front',
            devices: [],
            cables: [],
            updatedAt: '',
          },
        ],
        interRackCables: [],
        updatedAt: '',
      }),
    );
  });
  await page.goto('/');
});

async function hoverTemplateAtU(page: Page, name: string, unit: number) {
  await page
    .getByRole('textbox', { name: 'Search devices', exact: true })
    .fill(name);
  const source = page
    .getByRole('tabpanel', { name: 'Library', exact: true })
    .locator('article')
    .first();
  await expect(source).toBeVisible();
  const from = (await source.boundingBox())!;
  const frame = (await page.getByTestId('rack-frame').boundingBox())!;
  await page.mouse.move(from.x + 10, from.y + 10);
  await page.mouse.down();
  const x = frame.x + frame.width / 2;
  const y = frame.y + ((12 - unit + 0.1) * frame.height) / 12;
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.move(x + 1, y);
  await expect(page.getByTestId('device-placement-preview')).toBeVisible();
}

test('shows a green preview with correct U and scaled horizontal placement before committing', async ({
  page,
}) => {
  await hoverTemplateAtU(page, '12-port patch panel', 4);
  const preview = page.getByTestId('device-placement-preview');
  await expect(preview).toHaveAttribute('data-placement-state', 'valid');
  await expect(preview).toHaveAttribute('data-position-u', '4');
  const previewX = Number(await preview.getAttribute('data-position-x'));
  expect(previewX).toBeGreaterThan(110);
  expect(previewX).toBeLessThan(120);
  await expect(page.getByTestId('rack-device-count')).toHaveText('0 devices');
  await page.mouse.up();
  await expect(preview).not.toBeVisible();
  const placed = await page.evaluate(
    () =>
      (
        window as unknown as { __rackStore: typeof useRackStore }
      ).__rackStore.getState().layout.devices[0],
  );
  expect(placed.positionU).toBe(4);
  expect(placed.xMm).toBeCloseTo(previewX, 4);
});

test('shows the blocking device before rejecting an occupied drop', async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
      .getState()
      .addDeviceFromTemplate('cat6-patch-24', 4),
  );
  await hoverTemplateAtU(page, '12-port patch panel', 4);
  await expect(page.getByTestId('device-placement-preview')).toHaveAttribute(
    'data-placement-state',
    'blocked',
  );
  await expect(page.getByTestId('placement-feedback')).toContainText(
    'Space occupied by 24-port patch panel',
  );
  await page.mouse.up();
  await expect(page.getByTestId('rack-device-count')).toHaveText('1 devices');
  await expect(page.getByTestId('device-placement-preview')).not.toBeVisible();
});

test('cancels a library drag without creating a device or leaving a preview', async ({
  page,
}) => {
  await hoverTemplateAtU(page, '12-port patch panel', 4);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('device-placement-preview')).not.toBeVisible();
  await expect(page.getByTestId('rack-device-count')).toHaveText('0 devices');
});

test('filters incompatible templates and owned inventory and reacts to rack dimension changes', async ({
  page,
}) => {
  const wide = page.getByRole('heading', {
    name: '24-port patch panel',
    exact: true,
  });
  await page
    .getByRole('textbox', { name: 'Search devices', exact: true })
    .fill('24-port patch panel');
  await page.getByRole('checkbox', { name: 'Fits rack dimensions' }).check();
  await expect(wide).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
      .getState()
      .setRackType('10in'),
  );
  await expect(wide).not.toBeVisible();
  await page.getByRole('checkbox', { name: 'Fits rack dimensions' }).uncheck();
  await expect(wide).toBeVisible();
  await expect(page.getByText(/Too wide:/).first()).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Save 24-port patch panel to My devices',
      exact: true,
    })
    .click();
  await page.getByRole('tab', { name: 'My devices (1)', exact: true }).click();
  await expect(wide).toBeVisible();
  await page.getByRole('checkbox', { name: 'Fits rack dimensions' }).check();
  await expect(wide).not.toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
      .getState()
      .setRackType('19in'),
  );
  await expect(wide).toBeVisible();
});

test('existing-device drags show conflicts and can be cancelled without changing placement', async ({
  page,
}) => {
  const id = await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore })
      .__rackStore;
    store.getState().addDeviceFromTemplate('cat6-patch-12', 4);
    const id = store.getState().selectedDeviceId!;
    store.getState().addDeviceFromTemplate('cat6-patch-24', 6);
    return id;
  });
  const card = page.locator(`[data-device-id="${id}"]`).first();
  const frame = (await page.getByTestId('rack-frame').boundingBox())!;
  const from = (await card.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    frame.x + frame.width / 2,
    frame.y + ((12 - 6 + 0.5) * frame.height) / 12,
    { steps: 8 },
  );
  await expect(page.getByTestId('device-placement-preview')).toHaveAttribute(
    'data-placement-state',
    'blocked',
  );
  await page.mouse.up();
  expect(
    await page.evaluate(
      (id) =>
        (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
          .getState()
          .layout.devices.find((d) => d.id === id)!.positionU,
      id,
    ),
  ).toBe(4);
  const position = (await card.boundingBox())!;
  await page.mouse.move(
    position.x + position.width / 2,
    position.y + position.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    frame.x + frame.width / 2,
    frame.y + ((12 - 8 + 0.5) * frame.height) / 12,
    { steps: 8 },
  );
  await expect(page.getByTestId('device-placement-preview')).toHaveAttribute(
    'data-placement-state',
    'valid',
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('device-placement-preview')).not.toBeVisible();
  expect(
    await page.evaluate(
      (id) =>
        (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
          .getState()
          .layout.devices.find((d) => d.id === id)!.positionU,
      id,
    ),
  ).toBe(4);
});

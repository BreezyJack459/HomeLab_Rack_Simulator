import { expect, test, type Page } from '@playwright/test';

// Seed only the starting inventory. Every link is created through the actual
// modal and store action; no injected cable or direct store mutation.
async function openMap(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('inter-rack-fixture')) return;
    sessionStorage.setItem('inter-rack-fixture', '1');
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'fleet-pack'] }));
    const racks = ['a', 'b'].map(id => ({
      id, name: `Rack ${id.toUpperCase()}`, rackType: '19in', heightU: 12, rackDepthMm: 600,
      weightLimitKg: 200, powerBudgetW: 1000, viewSide: 'front', updatedAt: '',
      devices: [{ id: `${id}-switch`, name: `Switch ${id.toUpperCase()}`, category: 'switch', positionU: 1,
        sizeU: 1, depthMm: 200, widthType: '19in', weightKg: 2, powerW: 20, heatLevel: 1, color: '#333',
        ports: { ethernet: 4, fiber: 2 }, portLayouts: { front: [{ type: 'ethernet', count: 4, mediaType: 'rj45' }, { type: 'fiber', count: 2, mediaType: 'sfp+' }] },
        portConnectionSpecs: { 'ethernet:front:0': { connector: 'RJ45', role: 'bidirectional' } },
      }], cables: [], portReservations: [{ id: `${id}-reserved`, deviceId: `${id}-switch`, portType: 'ethernet', portIndex: 3, purpose: 'Future' }],
    }));
    localStorage.setItem('homelab-rack-simulator-workspace', JSON.stringify({ id: 'ws', name: 'Lab', racks, interRackCables: [], updatedAt: '' }));
  });
  await page.goto('/');
  await navigateToMap(page);
}

async function navigateToMap(page: Page) {
  await page.getByTestId('workspace-tools-trigger').click();
  await page.getByRole('button', { name: /^Fleet/ }).click();
  await page.getByRole('button', { name: 'Interconnect', exact: true }).click();
  await expect(page.getByTestId('inter-rack-map-svg')).toBeVisible();
}

async function endpoints(page: Page, type: string) {
  const dialog = page.getByRole('dialog', { name: 'Add Inter-Rack Cable', exact: true });
  await dialog.getByRole('combobox', { name: 'Cable Type', exact: true }).selectOption(type);
  await dialog.getByRole('combobox', { name: 'Rack', exact: true }).selectOption('a');
  await dialog.getByRole('combobox', { name: 'Device', exact: true }).selectOption('a-switch');
  const port = type === 'cat6a' ? 'ethernet' : 'fiber';
  if (type === 'cat6a') await expect(dialog.getByRole('option', { name: /Ethernet 4.*reserved/ })).toHaveAttribute('disabled', '');
  await dialog.getByRole('combobox', { name: 'Port', exact: true }).selectOption(`${port}:0:front`);
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByRole('option', { name: 'Rack A', exact: true })).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Rack', exact: true }).selectOption('b');
  await dialog.getByRole('combobox', { name: 'Device', exact: true }).selectOption('b-switch');
  await dialog.getByRole('combobox', { name: 'Port', exact: true }).selectOption(`${port}:0:front`);
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByLabel('Length (m)')).toBeFocused();
  await dialog.getByLabel('Label', { exact: true }).fill(`Test ${type}`);
  await expect(dialog.getByText('Connector compatibility is not verified.', { exact: true })).toBeVisible();
  if (type === 'cat6a') {
    await dialog.getByRole('textbox', { name: 'Source cable end fits socket identity' }).fill('M12');
    await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
    await expect(dialog.getByText(/socket is RJ45/).first()).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Source cable end fits socket identity' }).fill('RJ45');
    await dialog.getByRole('textbox', { name: 'Destination cable end fits socket identity' }).fill('RJ45');
    await expect(dialog.getByText('Recorded connector constraints match.', { exact: true })).toBeVisible();
  }
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('dialog contains focus, Escape and Cancel restore focus, cable type changes reset ports', async ({ page }, testInfo) => {
  await openMap(page);
  const trigger = page.getByRole('button', { name: 'Add Cable', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Add Inter-Rack Cable', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Cable Type', exact: true })).toBeFocused();
  await dialog.screenshot({ path: testInfo.outputPath('wizard.png') });
  // Tab across both ends of the native modal, including disabled controls.
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('combobox', { name: 'Rack', exact: true }).selectOption('a');
  await dialog.getByRole('combobox', { name: 'Device', exact: true }).selectOption('a-switch');
  await dialog.getByRole('combobox', { name: 'Port', exact: true }).selectOption('ethernet:0:front');
  await dialog.getByRole('combobox', { name: 'Cable Type', exact: true }).selectOption('dac');
  await expect(dialog.getByRole('combobox', { name: 'Port', exact: true })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(trigger).toBeFocused();
});

for (const type of ['cat6a', 'sfp+', 'dac', 'fiber']) {
  test(`${type} creates through wizard, persists, blocks reused ports, and map supports pointer/Enter/Space`, async ({ page }, testInfo) => {
    await openMap(page);
    await page.getByRole('button', { name: 'Add Cable', exact: true }).click();
    await endpoints(page, type);
    if (type === 'cat6a') await page.getByTestId('inter-rack-map-svg').screenshot({ path: testInfo.outputPath('map.png') });
    const link = page.getByTestId('inter-rack-map-svg').getByRole('button', { name: new RegExp(`^Test .*Rack A, Switch A, .* to Rack B, Switch B`) });
    await expect(link).toHaveAttribute('aria-pressed', 'false');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(link).toHaveAttribute('aria-pressed', 'true');
    // Reload clears the UI selection and exercises workspace load normalization.
    await page.reload();
    await navigateToMap(page);
    await expect(link).toHaveAttribute('aria-pressed', 'false');
    await link.focus();
    await page.keyboard.press('Space');
    await expect(link).toHaveAttribute('aria-pressed', 'true');
    if (type === 'cat6a') {
      await expect(page.getByText('Recorded connector constraints match', { exact: true })).toBeVisible();
      await page.getByRole('textbox', { name: 'Source cable end fits socket identity' }).fill('M12');
      await expect(page.getByRole('button', { name: 'Save cable-end identities' })).toBeDisabled();
      await page.getByRole('textbox', { name: 'Source cable end fits socket identity' }).fill('rj45');
      await page.getByRole('button', { name: 'Save cable-end identities' }).click();
      await expect(page.getByRole('button', { name: 'Save cable-end identities' })).toBeDisabled();
    }
    await page.reload();
    await navigateToMap(page);
    await expect(link).toHaveAttribute('aria-pressed', 'false');
    await link.scrollIntoViewIfNeeded();
    const point = await link.locator('path').last().evaluate(element => {
      const path = element as SVGPathElement;
      const point = path.getPointAtLength(path.getTotalLength() * 0.25);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!);
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
    await expect(link).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('workspace-tools-trigger').click();
    await page.getByText('Additional tools', { exact: true }).click();
    await page.getByRole('button', { name: 'Add inter-rack cable', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Inter-Rack Cable', exact: true });
    await dialog.getByRole('combobox', { name: 'Cable Type', exact: true }).selectOption(type);
    await dialog.getByRole('combobox', { name: 'Rack', exact: true }).selectOption('a');
    await dialog.getByRole('combobox', { name: 'Device', exact: true }).selectOption('a-switch');
    await expect(dialog.getByRole('option', { name: /1.*already used/ })).toHaveAttribute('disabled', '');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('workspace-tools-trigger')).toBeFocused();
  });
}

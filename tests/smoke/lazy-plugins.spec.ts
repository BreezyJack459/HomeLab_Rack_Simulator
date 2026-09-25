import { expect, test } from '@playwright/test';

test('lazy packs enable and open without reload, and disappear when disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.removeItem('homelab-rack-simulator-layout-prefs');
    localStorage.setItem('rack-simulator-new-shell', '1');
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  let documents = 0;
  page.on('request', (request) => { if (request.isNavigationRequest()) documents += 1; });
  let releasePack!: () => void;
  const packDownload = new Promise<void>((resolve) => { releasePack = resolve; });
  await page.route('**/src/plugins/fleetPackPlugin.tsx*', async (route) => {
    await packDownload;
    await route.continue();
  });
  await page.goto('/');
  const initialDocuments = documents;
  const tools = page.getByTestId('workspace-tools-trigger');
  await tools.click();
  await page.getByRole('button', { name: /Settings →/ }).click();
  await page.getByRole('button', { name: 'Manage plugins', exact: true }).click();
  const manager = page.getByRole('dialog');
  for (const name of ['Operations Pack', 'Planning Pack', 'Fleet Pack', 'Port Labels']) {
    await expect(manager.getByRole('button', { name: `Enable ${name}`, exact: true })).toBeEnabled();
  }
  await expect(manager.getByRole('button', { name: 'Enable Rack Reports', exact: true })).toBeDisabled();
  await manager.getByRole('button', { name: 'Close', exact: true }).click();
  await tools.click();
  const fleet = page.getByRole('button', { name: /^Fleet/ });
  await expect(fleet).toContainText('Enable & open');
  expect(requests.some((url) => /\/(operationsPack|planningPack|fleetPack|portDocumentation)Plugin\./.test(url))).toBe(false);

  await fleet.click();
  await expect(page.getByRole('status').filter({ hasText: 'Loading workspace…' })).toBeVisible();
  releasePack();
  await expect(page.getByRole('main').getByRole('heading', { name: 'Manage fleet', exact: true })).toBeVisible();
  expect(documents).toBe(initialDocuments);
  await tools.click();
  await expect(page.getByRole('button', { name: /^Fleet/ })).toHaveAttribute('aria-current', 'page');
  await page.getByText('Additional tools', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add inter-rack cable', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Settings →/ }).click();
  await page.getByRole('button', { name: /^Plugins \d/ }).click();
  await page.getByRole('group', { name: 'Plugin switches' }).getByRole('button', { name: /Fleet Pack/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Manage fleet', exact: true })).not.toBeVisible();
  await tools.click();
  await expect(page.getByRole('button', { name: /^Fleet/ })).toContainText('Enable & open');
  await expect(page.getByRole('button', { name: 'Add inter-rack cable', exact: true })).toHaveCount(0);
  expect(documents).toBe(initialDocuments);
});


test('returning preferences load all migrated workspace packs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({
      enabledPluginIds: ['cable-management', 'governance-tools'],
    }));
  });
  await page.goto('/');
  for (const [label, title] of [
    ['Operations', 'Run operations'],
    ['Planning', 'Plan changes'],
    ['Fleet', 'Manage fleet'],
  ]) {
    await page.getByTestId('workspace-tools-trigger').click();
    const option = page.getByRole('button', { name: new RegExp(`^${label}`) });
    await expect(option).not.toContainText('Enable & open');
    await option.click();
    await expect(page.getByRole('main').getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});

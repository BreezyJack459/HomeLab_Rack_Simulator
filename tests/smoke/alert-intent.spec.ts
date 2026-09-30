import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { useRackStore } from '../../src/store/rackStore';

const currentWorkspace = (page: Page) => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().workspace);

async function seedPlan(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/');
  if (width < 1024) await page.getByTestId('toggle-device-library').click();
  await expect(page.getByRole('textbox', { name: 'Search devices', exact: true })).toBeVisible();
  if (width < 1024) await page.getByRole('button', { name: 'Close device library', exact: true }).last().click();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const server = { id: 'server', name: 'Intent server', category: 'server' as const, sizeU: 1, positionU: 1, widthType: '19in' as const,
      depthMm: 200, powerW: 10, powerBasis: 'measured' as const, powerReviewed: true, weightKg: 1, heatLevel: 1 as const, color: '#333', ports: { ethernet: 24, power: 2 },
      installationRequirements: { support: 'front-mount' as const }, installationKit: 'Fixture brackets',
      portConnectionSpecs: { 'power:rear:0': { connector: 'C14', role: 'input' as const, powerKind: 'ac' as const, nominalVoltageV: 230 } },
    };
    const supply = { ...server, id: 'supply', name: 'Intent supply', category: 'pdu' as const, positionU: 3, powerW: 0, powerCapacityW: 500, circuit: 'A' as const, ports: { power: 4 },
      portConnectionSpecs: { 'power:rear:0': { connector: 'C13', role: 'output' as const, powerKind: 'ac' as const, nominalVoltageV: 230 } } };
    const rack = { ...store.layout, id: 'intent-rack', name: 'Intent rack', heightU: 18, rackType: '19in' as const, rackDepthMm: 800, powerBudgetW: 500,
      planningGoals: { version: 1 as const, power: 'single' as const, remoteRecovery: 'optional' as const, serviceMotion: 'detach-first' as const },
      findingReviewVersion: 1 as const, findingExceptions: [], policies: [], devices: [server, supply],
      services: [{ id: 'service', name: 'Service', criticality: 'critical' as const, hostDeviceId: 'server', powerDeviceIds: ['supply'] }],
      cables: [{ id: 'feed', type: 'power' as const, color: '#333', fromDeviceId: 'supply', toDeviceId: 'server', powerSourceDeviceId: 'supply', socketFit: { from: 'C13', to: 'C14' },
        fromPort: { type: 'power' as const, index: 0, side: 'rear' as const }, toPort: { type: 'power' as const, index: 0, side: 'rear' as const } }],
    };
    store.setWorkspace({ ...store.workspace, racks: [rack], interRackCables: [] });
  });
}

async function openInspector(page: Page) {
  const library = page.getByRole('dialog', { name: 'Check issues', exact: true });
  if (await library.isVisible()) await library.getByRole('button', { name: 'Close device library', exact: true }).click();
  const opener = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await opener.isVisible()) await opener.click();
  await expect(page.getByTestId('planning-goals-controls')).toBeVisible();
  const goals = page.getByTestId('planning-goals-controls');
  if (!(await goals.getByRole('combobox', { name: 'Rack power goal', exact: true }).isVisible())) await goals.locator('summary').first().click();
}

async function openCheck(page: Page) {
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await openInspector(page);
}

async function selectCheck(page: Page, title: string, all = false) {
  await closeInspector(page);
  const openQueue = page.getByRole('button', { name: 'Check issues', exact: true });
  if (await openQueue.isVisible()) await openQueue.click();
  const queue = page.getByRole('dialog', { name: 'Check issues', exact: true });
  const sidebar = await queue.isVisible() ? queue : page.getByRole('complementary', { name: 'Check issues', exact: true });
  if (all) await sidebar.getByRole('combobox', { name: 'Issue severity', exact: true }).selectOption('all');
  await sidebar.getByRole('button', { name: new RegExp(`^${title}`) }).click();
}

async function acceptRemoteRecovery(page: Page) {
  await openCheck(page);
  await page.getByRole('combobox', { name: 'Rack remote recovery goal', exact: true }).selectOption('required');
  await selectCheck(page, 'Required remote recovery needs verification');
  const controls = page.getByTestId('finding-exception-controls');
  await expect(controls).toBeVisible();
  if (!(await controls.getByRole('textbox', { name: 'Reason for accepted exception', exact: true }).isVisible())) await controls.locator('summary').click();
  const accept = controls.getByRole('button', { name: 'Accept current facts with this reason', exact: true });
  await expect(accept).toBeDisabled();
  await controls.getByRole('textbox', { name: 'Reason for accepted exception', exact: true }).fill('Recovery method will be tested before installation');
  await accept.click();
  await expect(controls.locator('summary')).toHaveText('Accepted exception');
}

async function closeInspector(page: Page) {
  const drawer = page.getByRole('dialog', { name: 'Inspector', exact: true });
  if (await drawer.isVisible()) await drawer.getByRole('button', { name: 'Collapse inspector', exact: true }).click();
}

for (const width of [1440, 390]) {
  test(`power goals change required actions and persist at ${width}px`, async ({ page }) => {
    await seedPlan(page, width);
    await openCheck(page);
    const powerGoal = page.getByRole('combobox', { name: 'Rack power goal', exact: true });
    await expect(powerGoal).toHaveValue('single');
    await expect(page.getByRole('button', { name: /^Independent A\/B power goal is not met/, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Independent A/B power goal is not met', exact: true })).toHaveCount(0);
    await powerGoal.selectOption('independent-ab');
    await selectCheck(page, 'Independent A/B power goal is not met');
    await expect(page.getByRole('heading', { name: 'Independent A/B power goal is not met', exact: true })).toBeVisible();
    await expect(page.getByText(/Only 1 modeled power feed\(s\)/).first()).toBeVisible();
    await page.reload();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.planningGoals?.power)).toBe('independent-ab');
    await openCheck(page);
    await page.getByRole('combobox', { name: 'Rack power goal', exact: true }).selectOption('single');
    await expect(page.getByRole('button', { name: /^Independent A\/B power goal is not met/, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Independent A/B power goal is not met', exact: true })).toHaveCount(0);
    await page.reload();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.planningGoals?.power)).toBe('single');
  });

  test(`accepted recovery facts stay stable on rename and reopen on target change at ${width}px`, async ({ page }) => {
    await seedPlan(page, width);
    await acceptRemoteRecovery(page);
    await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('server', { name: 'Renamed server' }));
    await expect(page.getByTestId('finding-exception-controls').locator('summary')).toHaveText('Accepted exception');
    await page.reload();
    await openCheck(page);
    await selectCheck(page, 'Required remote recovery needs verification', true);
    await expect(page.getByTestId('finding-exception-controls').locator('summary')).toHaveText('Accepted exception');
    await page.evaluate(() => {
      const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
      store.loadLayout({ ...store.layout, devices: [...store.layout.devices, { ...store.layout.devices.find(device => device.id === 'server')!, id: 'additional-target', name: 'Additional recovery target', positionU: 5 }] });
    });
    await expect(page.getByTestId('finding-exception-controls').locator('summary')).toHaveText('Changed since acceptance — review again');
    await expect(page.getByText('Previous reason: Recovery method will be tested before installation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept current facts with this reason', exact: true })).toBeDisabled();
  });

  test(`backup and duplication preserve goals while invalid new fields leave the plan unchanged at ${width}px`, async ({ page }) => {
    await seedPlan(page, width);
    await acceptRemoteRecovery(page);
    await closeInspector(page);
    await page.locator('[data-testid="more-dropdown"] summary').click();
    await page.getByRole('button', { name: 'Workspace backup and restore', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Workspace backup and restore' });
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download full workspace backup' }).click();
    const raw = await readFile((await (await download).path())!, 'utf8');
    const original = JSON.parse(raw);
    expect(original.racks[0].planningGoals).toEqual({ version: 1, power: 'single', remoteRecovery: 'required', serviceMotion: 'detach-first' });
    expect(original.racks[0].findingExceptions).toHaveLength(1);
    expect(original.racks[0].findingExceptions[0].reason).toBe('Recovery method will be tested before installation');
    const invalid = { ...original, racks: [{ ...original.racks[0], planningGoals: { ...original.racks[0].planningGoals, power: 'automatic-ha' } }] };
    await dialog.getByLabel('Choose workspace backup to restore').setInputFiles({ name: 'invalid-goal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
    await expect(dialog.getByRole('alert')).toContainText('planningGoals.power');
    await expect(dialog.getByRole('button', { name: 'Restore workspace', exact: true })).toHaveCount(0);
    expect(await currentWorkspace(page)).toEqual(original);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('[data-testid="more-dropdown"] summary').click();
    await page.getByRole('button', { name: 'Duplicate current rack', exact: true }).click();
    const workspace = await currentWorkspace(page);
    expect(workspace.racks).toHaveLength(2);
    const oldRack = workspace.racks.find(rack => rack.id === 'intent-rack')!;
    const copy = workspace.racks.find(rack => rack.id !== 'intent-rack')!;
    expect(oldRack).toEqual(original.racks[0]);
    expect(copy.planningGoals).toEqual(oldRack.planningGoals);
    expect(copy.findingExceptions ?? []).toHaveLength(0);
    expect(copy.devices.every(device => !oldRack.devices.some(old => old.id === device.id))).toBe(true);
    expect(copy.cables[0].powerSourceDeviceId).toBe(copy.devices.find(device => device.name === 'Intent supply')!.id);
    expect(copy.services![0].hostDeviceId).toBe(copy.devices.find(device => device.name === 'Intent server')!.id);
    await page.reload();
    await expect.poll(() => currentWorkspace(page)).toEqual(workspace);
  });
}

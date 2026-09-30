import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('optional packs remain disabled after reload including a fresh preference save', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-tools-trigger')).toBeVisible();
  const openSwitches = async () => {
    await page.getByTestId('workspace-tools-trigger').click();
    await page.getByRole('button', { name: /Settings →/ }).click();
    await page.getByRole('button', { name: /^Plugins \d/ }).click();
  };
  await page.getByTestId('toggle-device-library').click();
  await page.reload();
  await openSwitches();
  const switches = page.getByRole('group', { name: 'Plugin switches' });
  for (const name of ['Operations Pack', 'Planning Pack', 'Fleet Pack']) {
    const toggle = switches.getByRole('button', { name: new RegExp(name) });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
  }
  await page.reload();
  await openSwitches();
  for (const name of ['Operations Pack', 'Planning Pack', 'Fleet Pack']) {
    await expect(switches.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-pressed', 'false');
  }
});

test('duplicate rack keeps service dependencies and supply direction after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-tools-trigger')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const device = (id: string, category: 'server' | 'ups' | 'pdu', positionU: number) => ({
      id, name: id, category, positionU, sizeU: 1, depthMm: 100, widthType: '19in' as const,
      weightKg: 1, powerW: 10, heatLevel: 1 as const, color: '#333', ports: { power: 8 },
    });
    const rack = { ...store.layout, id: 'original', devices: [device('host', 'server', 1), device('storage', 'server', 2), device('network', 'server', 3), device('ups', 'ups', 4), device('pdu', 'pdu', 5), device('backup', 'server', 6)],
      services: [{ id: 'service', name: 'Service', criticality: 'critical' as const, hostDeviceId: 'host', storageDeviceIds: ['storage'], networkDeviceIds: ['network'], powerDeviceIds: ['pdu'], backupDeviceId: 'backup' }],
      cables: [{ id: 'wire', type: 'power' as const, color: '#333', fromDeviceId: 'ups', toDeviceId: 'pdu', powerSourceDeviceId: 'ups' }],
    };
    store.setWorkspace({ ...store.workspace, racks: [rack], interRackCables: [] });
    store.duplicateRack('original', 'Reference copy');
    store.saveLocal();
  });
  await page.reload();
  const result = await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const copy = store.workspace.racks.find(r => r.name === 'Reference copy')!;
    const service = copy.services![0];
    const ids = new Set(copy.devices.map(d => d.id));
    return { allLocal: [service.hostDeviceId, ...(service.storageDeviceIds ?? []), ...(service.networkDeviceIds ?? []), ...(service.powerDeviceIds ?? []), service.backupDeviceId].every(id => ids.has(id!)),
      sourceLocal: copy.cables[0].powerSourceDeviceId === copy.devices.find(d => d.name === 'ups')!.id,
      originalHost: store.workspace.racks.find(r => r.id === 'original')!.services![0].hostDeviceId,
    };
  });
  expect(result).toEqual({ allLocal: true, sourceLocal: true, originalHost: 'host' });
});

test('malformed service backup names the field and leaves current workspace untouched', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-tools-trigger')).toBeVisible();
  const before = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().workspace);
  await page.locator('[data-testid="more-dropdown"] summary').click();
  await page.getByRole('button', { name: 'Workspace backup and restore', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workspace backup and restore' });
  const invalid = { ...before, racks: before.racks.map((r, i) => i ? r : { ...r, services: [{ id: 'bad', name: 'Bad', criticality: 'critical', storageDeviceIds: 'invalid' }] }) };
  await dialog.getByLabel('Choose workspace backup to restore').setInputFiles({ name: 'bad-services.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(dialog.getByRole('alert')).toContainText('racks[0]');
  await expect(dialog.getByRole('alert')).toContainText('services[0].storageDeviceIds');
  await expect(dialog.getByRole('button', { name: 'Restore workspace', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().workspace)).toEqual(before);
});

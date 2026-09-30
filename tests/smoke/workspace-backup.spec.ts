import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) test(`core backup restores all racks and reliability metadata without Fleet at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const device = { id: 'switch', name: 'Backup switch', category: 'switch' as const, sizeU: 1, positionU: 1, widthType: '19in' as const,
      depthMm: 100, weightKg: 2, heatLevel: 1 as const, color: '#333', powerW: 20, ports: { ethernet: 2, power: 1 },
      powerReference: { watts: 30, basis: 'maximum' as const, source: 'Recorded fixture' }, powerBasis: 'measured' as const, powerReviewed: true,
      installationRequirements: { support: 'rails' as const, railMinMm: 400, railMaxMm: 600, source: 'Fixture kit' },
      portConnectionSpecs: { 'power:rear:0': { connector: 'C14', role: 'input' as const, powerKind: 'ac' as const, nominalVoltageV: 230 } },
    };
    const supply = { ...device, id: 'supply', name: 'Backup supply', category: 'pdu' as const, positionU: 3, powerW: 0, powerCapacityW: 500, portConnectionSpecs: { 'power:rear:0': { connector: 'C13', role: 'output' as const, powerKind: 'ac' as const, nominalVoltageV: 230 } } };
    const rack = { ...store.layout, id: 'rack-a', mountingPostSpacingMm: 500, devices: [device, supply], unplacedDevices: [{ ...device, id: 'spare' }], cables: [{
      id: 'power', fromDeviceId: 'supply', toDeviceId: 'switch', type: 'power' as const, color: '#333', powerSourceDeviceId: 'supply',
      fromPort: { type: 'power' as const, index: 0 }, toPort: { type: 'power' as const, index: 0 }, socketFit: { from: 'C13', to: 'C14' },
    }] };
    store.setWorkspace({ ...store.workspace, name: 'Backup proof', racks: [rack, { ...rack, id: 'rack-b', name: 'Second rack', unplacedDevices: [] }], interRackCables: [{
      id: 'link', fromRackId: 'rack-a', fromDeviceId: 'switch', toRackId: 'rack-b', toDeviceId: 'switch', type: 'cat6a',
      fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 },
    }] });
  });
  const open = async () => {
    await page.locator('[data-testid="more-dropdown"] summary').click();
    await expect(page.getByText('Autosave is stored in this browser only.')).toBeVisible();
    await page.getByRole('button', { name: 'Workspace backup and restore', exact: true }).click();
  };
  await open();
  const dialog = page.getByRole('dialog', { name: 'Workspace backup and restore' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download full workspace backup' }).click();
  const raw = await readFile((await (await download).path())!, 'utf8');
  const original = JSON.parse(raw);
  expect(original.racks).toHaveLength(2);
  expect(original.interRackCables).toHaveLength(1);
  const file = dialog.getByLabel('Choose workspace backup to restore');
  await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(dialog.getByRole('alert')).toContainText('Invalid workspace backup');
  const current = () => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().workspace);
  expect(await current()).toEqual(original);
  const invalidLinks = { ...original, interRackCables: [{ ...original.interRackCables[0], toDeviceId: 'missing' }] };
  await file.setInputFiles({ name: 'bad-links.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidLinks)) });
  await expect(dialog.getByRole('alert')).toContainText('invalid inter-rack connections');
  expect(await current()).toEqual(original);
  await file.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(dialog.getByRole('button', { name: 'Restore workspace', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await current()).toEqual(original);
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().renameWorkspace('Changed workspace'));
  await open();
  await file.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await dialog.getByRole('checkbox', { name: 'Replace my current workspace with this backup' }).check();
  await dialog.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await current()).toEqual(original);
  await page.reload();
  await expect.poll(current).toEqual(original);
});

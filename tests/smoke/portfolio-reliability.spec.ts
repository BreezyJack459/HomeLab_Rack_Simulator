import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) test(`portfolio download matches workspace power and unknown states at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'fleet-pack'] })));
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, positionU: 1, widthType: '19in' as const, category: 'switch' as const, depthMm: 100, color: '#333', weightKg: 1, heatLevel: 1 as const, ports: { ethernet: 1 } };
    store.setWorkspace({ ...store.workspace, racks: [
      { ...store.layout, id: 'a', name: 'Supply rack', powerBudgetW: 100, electricityRatePerKwh: 2, devices: [{ ...common, id: 'source', name: 'Source', powerW: 10, poeBudgetW: 30, poeInputMode: 'self-only', poeEfficiencyPct: 80, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse', poeLimitW: 30, poeProfile: 'Pair' } } }], cables: [] },
      { ...store.layout, id: 'b', name: 'Receiver rack', devices: [{ ...common, id: 'receiver', name: 'Receiver', powerW: 20, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd', poeRequiredW: 20, poeDrawW: 20, poeProfile: 'Pair' } } }], cables: [] },
    ], interRackCables: [{ id: 'poe', fromRackId: 'a', fromDeviceId: 'source', toRackId: 'b', toDeviceId: 'receiver', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, type: 'cat6a', poe: true }] });
  });
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('button', { name: /^Fleet →/ }).click();
  const panel = page.getByRole('region', { name: 'Portfolio report' });
  await panel.getByRole('button', { name: 'Show Preview', exact: true }).click();
  const preview = panel.locator('pre');
  await expect(preview).toContainText('| Attributed Input | 35W / 100W budget |');
  await expect(preview).toContainText('| Monthly Cost | $51.10 |');
  await expect(preview).toContainText('Not estimated for PoE layouts');
  const firstDownload = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download portfolio Markdown' }).click();
  const file = await firstDownload;
  expect(file.suggestedFilename()).toBe('supply-rack-portfolio.md');
  expect(await readFile((await file.path())!, 'utf8')).toBe(await preview.textContent());
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('source', { poeEfficiencyPct: undefined }));
  await expect(preview).toContainText('| Monthly kWh | Not estimated |');
  const secondDownload = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download portfolio Markdown' }).click();
  const second = await secondDownload;
  expect(await readFile((await second.path())!, 'utf8')).toBe(await preview.textContent());
});

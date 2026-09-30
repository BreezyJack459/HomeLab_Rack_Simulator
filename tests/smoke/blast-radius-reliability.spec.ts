import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';
import type { PlacedDevice, RackLayout } from '../../src/types/rack';

for (const width of [1440, 390]) test(`blast radius retains alternate power and opens remote impacts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'operations-pack'] })));
  await page.goto('/');
  await expect(page.getByTestId('toggle-device-library')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const make = (id: string, category: PlacedDevice['category'], positionU: number): PlacedDevice => ({ id, name: id, category, positionU, sizeU: 1, widthType: '19in', depthMm: 100, weightKg: 1, powerW: 10, heatLevel: 1, color: '#333' });
    const source: RackLayout = { ...store.layout, id: 'source', name: 'Source', devices: [make('a', 'pdu', 1), make('b', 'pdu', 2), make('single', 'server', 3), make('dual', 'server', 4),
      { ...make('pse', 'switch', 5), ports: { ethernet: 1 }, poeBudgetW: 30, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse', poeLimitW: 30, poeProfile: 'pair' } } }],
      cables: [['single', 'a'], ['dual', 'a'], ['b', 'dual'], ['pse', 'a']].map(([fromDeviceId, toDeviceId], i) => ({ id: `feed-${i}`, type: 'power', fromDeviceId, toDeviceId, color: '#333' })) };
    const remote: RackLayout = { ...store.layout, id: 'remote', name: 'Remote', devices: [{ ...make('single', 'server', 1), name: 'Remote receiver', ports: { ethernet: 1 }, portFaceOverrides: { ethernet: 'front' }, portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd', poeRequiredW: 10, poeProfile: 'pair' } } }], cables: [] };
    store.setWorkspace({ ...store.workspace, racks: [source, remote], interRackCables: [{ id: 'poe', type: 'cat6a', poe: true, fromRackId: 'source', fromDeviceId: 'pse', fromPort: { type: 'ethernet', index: 0, side: 'front' }, toRackId: 'remote', toDeviceId: 'single', toPort: { type: 'ethernet', index: 0, side: 'front' } }] });
    store.switchRack('source');
    store.selectDevice('a');
  });
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('button', { name: /^Operations →/ }).click();
  const inspector = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await inspector.isVisible()) await inspector.click();
  const panel = page.getByRole('region', { name: 'Blast radius analysis' });
  await expect(panel.getByText(/Retained supply path: Source \/ dual/)).toBeVisible();
  await expect(panel.getByText('Review priority (heuristic)', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /^single.*Supply loss/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Indirect records (1)', exact: true }).click();
  await panel.getByRole('button', { name: /^Remote \/ Remote receiver/ }).click();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    return [state.layout.id, state.selectedDeviceId];
  })).toEqual(['remote', 'single']);
  await expect(panel.getByRole('button', { name: 'Source / pse Supply loss', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Source / pse Supply loss', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.id)).toBe('source');
});

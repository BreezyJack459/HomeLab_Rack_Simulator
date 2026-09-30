import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

for (const width of [1440, 390]) test(`service cable review counts the routed length and withholds unknown passes at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, heightU: 18, rackDepthMm: 800, devices: [10, 6].map((positionU, index) => ({
      id: index ? 'b' : 'a', name: `Server ${index}`, category: 'server', sizeU: 1, positionU,
      widthType: '19in', depthMm: 400, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333', ports: { ethernet: 2 },
    })), cables: [{ id: 'c', type: 'ethernet', fromDeviceId: 'a', toDeviceId: 'b', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, lengthMm: 700, color: '#333' }] });
  });
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  if (width < 1024) await page.getByRole('button', { name: 'Check issues', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  if (width < 1024) await page.getByRole('dialog', { name: 'Check issues', exact: true }).getByRole('button', { name: 'Close device library', exact: true }).click();
  const openInspector = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await openInspector.isVisible()) await openInspector.click();
  await expect(page.getByText(/Server 0: Recorded cable: 700mm/)).toContainText('chassis-depth travel 400mm');
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateCable('c', { lengthMm: undefined }));
  await expect(page.getByText(/Server 0: Actual cable length is not recorded/)).toBeVisible();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateCable('c', { lengthMm: 5000 }));
  await expect(page.getByText(/No modeled serviceability concerns detected/)).toBeVisible();
  await expect(page.getByText(/Confirm actual access, release points and moving clearances/)).toBeVisible();
});

test('rail fit uses measured mounting posts and preserves installation details', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, rackDepthMm: 1200, mountingPostSpacingMm: undefined, devices: [{
      id: 'rail-server', name: 'Rail server', category: 'server', sizeU: 1, positionU: 1,
      widthType: '19in', depthMm: 300, color: '#334155', powerW: 100, weightKg: 1, heatLevel: 1,
    }], cables: [] });
    store.selectDevice('rail-server');
  });
  await page.getByRole('button', { name: 'Installation requirements', exact: true }).click();
  await page.getByRole('combobox', { name: 'Required mounting support', exact: true }).selectOption('rails');
  await page.getByRole('spinbutton', { name: 'Rail minimum spacing (mm)', exact: true }).fill('650');
  await page.getByRole('spinbutton', { name: 'Rail maximum spacing (mm)', exact: true }).fill('1000');
  await page.getByRole('textbox', { name: 'Installed mounting kit / shelf model', exact: true }).fill('Kit R1');
  await expect(page.getByText(/Rail fit unverified: record measured/)).toBeVisible();
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await page.getByRole('combobox', { name: 'Check category', exact: true }).selectOption('serviceability');
  const spacing = page.getByRole('spinbutton', { name: /Measured mounting-post spacing/ });
  await spacing.fill('600');
  await expect(page.getByText(/post spacing 600mm below kit minimum 650mm/)).toBeVisible();
  await spacing.fill('700');
  await expect(page.getByText(/post spacing 600mm below kit minimum/)).toHaveCount(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    return { spacing: state.layout.mountingPostSpacingMm, requirements: state.layout.devices[0].installationRequirements, kit: state.layout.devices[0].installationKit };
  })).toEqual({ spacing: 700, requirements: { support: 'rails', railMinMm: 650, railMaxMm: 1000 }, kit: 'Kit R1' });
});

import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('socket editing blocks a known conflict and cable-end declarations survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const common = { sizeU: 1, widthType: '19in' as const, depthMm: 100, color: '#334155', weightKg: 1, heatLevel: 1 as const, ports: { power: 1 } };
    store.loadLayout({ ...store.layout, devices: [
      { ...common, id: 'supply', name: 'Supply', category: 'pdu', positionU: 1, powerW: 0 },
      { ...common, id: 'load', name: 'Load', category: 'server', positionU: 3, powerW: 20,
        portConnectionSpecs: { 'power:rear:0': { connector: 'DC socket B', role: 'input', powerKind: 'dc', nominalVoltageV: 24, polarity: 'center positive' } } },
    ], cables: [] });
    store.selectDevice('supply');
  });
  await page.getByRole('button', { name: 'Socket specifications', exact: true }).click();
  await page.getByRole('textbox', { name: 'Socket connector identity', exact: true }).fill('DC socket A');
  await page.getByRole('combobox', { name: 'Socket role', exact: true }).selectOption('output');
  await page.getByRole('combobox', { name: 'Supply kind', exact: true }).selectOption('dc');
  await page.getByRole('spinbutton', { name: 'Configured operating voltage (V)', exact: true }).fill('12');
  await page.getByRole('textbox', { name: 'DC polarity / pinout identity', exact: true }).fill('center positive');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  await page.getByRole('button', { name: 'Supply 1 available', exact: true }).click();
  await page.getByRole('button', { name: 'Power 1 · rear · Available', exact: true }).click();
  await page.getByText('Unavailable devices (1)', { exact: true }).click();
  await expect(page.getByText(/Recorded operating voltages differ/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load No compatible free ports', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel connection', exact: true }).click();
  await page.getByRole('button', { name: 'Build Rack', exact: true }).click();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().selectDevice('load'));
  await page.getByRole('button', { name: 'Open inspector', exact: true }).click();
  await page.getByRole('button', { name: 'Socket specifications', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Configured operating voltage (V)', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  await page.getByRole('button', { name: 'Supply 1 available', exact: true }).click();
  await page.getByRole('button', { name: 'Power 1 · rear · Available', exact: true }).click();
  await page.getByRole('button', { name: 'Load 1 available', exact: true }).click();
  await page.getByRole('button', { name: 'Power 1 · rear · Available', exact: true }).click();
  await expect(page.getByText('Connector compatibility unverified', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Keep connecting from this device', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Connect cable', exact: true }).click();
  const inspector = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await inspector.isVisible()) await inspector.click();
  await page.getByRole('textbox', { name: 'First cable end fits socket identity', exact: true }).fill('DC socket A');
  await page.getByRole('textbox', { name: 'Second cable end fits socket identity', exact: true }).fill('DC socket B');
  await expect(page.getByText('Recorded connector constraints match', { exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const layout = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout;
    return { voltage: layout.devices[0].portConnectionSpecs?.['power:rear:0'].nominalVoltageV, fits: layout.cables[0]?.socketFit };
  })).toEqual({ voltage: 12, fits: { from: 'DC socket A', to: 'DC socket B' } });
});

test('patch-panel availability separates front and rear sockets on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, devices: [{ id: 'panel', name: 'Panel', category: 'patch-panel', positionU: 1, sizeU: 1, widthType: '19in', depthMm: 50, powerW: 0, weightKg: 1, heatLevel: 1, color: '#334155', ports: { ethernet: 24 } }], cables: [] });
  });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: 'Cable list', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  const panel = page.getByRole('button', { name: 'Panel 48 available', exact: true });
  await expect(panel).toContainText('Front LAN: 24');
  await expect(panel).toContainText('Rear LAN: 24');
});

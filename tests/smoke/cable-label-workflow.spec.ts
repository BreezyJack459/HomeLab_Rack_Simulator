import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';
import { deviceCatalog } from '../../src/data/deviceCatalog';

test('occupied switch fits at 1x and zoom has consistent proportions on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(template => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, rackType: '19in', devices: [
      { ...template, id: 'switch', sizeU: template.defaultU, positionU: 3 },
      { ...template, id: 'peer', name: 'Peer', sizeU: template.defaultU, positionU: 5 },
    ], cables: Array.from({ length: 7 }, (_, index) => ({
      id: `occupied-${index}`, type: 'ethernet', color: '#fff', fromDeviceId: 'switch', toDeviceId: 'peer',
      fromPort: { type: 'ethernet', index, side: 'front' }, toPort: { type: 'ethernet', index, side: 'front' },
    })) });
    store.selectDevice(null);
  }, deviceCatalog.find(template => template.id === 'unifi-flex-2-5g-8')!);
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  await page.getByRole('button', { name: /^UniFi Flex 2.5G 8-port \d+ available/ }).click();
  const diagram = page.getByRole('region', { name: 'UniFi Flex 2.5G 8-port port diagram', exact: true });
  const face = diagram.getByTestId('port-diagram-face');
  const viewport = diagram.getByTestId('port-diagram-viewport');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => viewport.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const fit = (await face.boundingBox())!;
    await expect(diagram.getByTestId('port-in-use-mark')).toHaveCount(7);
    for (let port = 1; port <= 7; port++) {
      const occupied = diagram.getByRole('button', { name: `LAN ${port} · front · In use`, exact: true });
      await expect(occupied).toHaveAttribute('aria-disabled', 'true');
      await occupied.dispatchEvent('click');
      await expect(page.getByRole('heading', { name: '1 · Pick a source socket' })).toBeVisible();
      await expect(diagram.getByRole('button', { name: `LAN ${port} · In use`, exact: true })).toBeDisabled();
    }
    for (const scale of [2, 4, 1]) {
      await diagram.getByRole('button', { name: 'Zoom port diagram' }).click();
      await expect.poll(async () => (await face.boundingBox())!.width).toBeCloseTo(fit.width * scale, 0);
      expect((await face.boundingBox())!.height).toBeCloseTo(fit.height * scale, 0);
      if (scale === 4) await viewport.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    }
    expect(await viewport.evaluate(el => el.scrollLeft)).toBe(0);
  }
  const occupiedWidth = (await face.boundingBox())!.width;
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.layout.cables.forEach(cable => store.removeCable(cable.id));
  });
  await expect(diagram.getByTestId('port-in-use-mark')).toHaveCount(0);
  expect((await face.boundingBox())!.width).toBeCloseTo(occupiedWidth, 0);
});

test('diagram connection becomes a printable label and optional plugin can be disabled', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, devices: ['Machine A', 'Machine B'].map((name, i) => ({
      id: name, name, category: 'server', sizeU: 1, positionU: i * 3 + 1, widthType: '19in',
      depthMm: 150, color: '#334155', powerW: 10, weightKg: 1, heatLevel: 1,
      ports: { ethernet: 4, usb: 2, hdmi: 1 },
    })), cables: [] });
    store.selectDevice(null);
  });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '+ Connect cable', exact: true }).click();
  const connector = page.getByRole('region', { name: 'Visual cable connector' });
  await connector.getByRole('button', { name: /^Machine A \d+ available/ }).click();
  await connector.getByRole('button', { name: 'USB 2 · rear · Available', exact: true }).click();
  await connector.getByRole('button', { name: /^Machine B \d+ available/ }).click();
  await connector.getByRole('button', { name: 'USB 1 · rear · Available', exact: true }).click();
  await expect(connector.getByRole('heading', { name: '3 · Preview and connect' })).toBeVisible();
  await connector.getByRole('button', { name: 'Show cable view', exact: true }).click();
  await expect(page.getByTestId('connection-preview-path')).toBeVisible();
  await connector.getByRole('checkbox', { name: 'Keep connecting from this device' }).uncheck();
  await connector.getByRole('button', { name: 'Connect cable', exact: true }).click();
  await expect(connector).not.toBeVisible();
  await page.reload();
  const tools = page.getByTestId('workspace-tools-trigger');
  await tools.click();
  await page.getByRole('button', { name: /Settings →/ }).click();
  await page.getByRole('button', { name: 'Manage plugins', exact: true }).click();
  await page.getByRole('button', { name: 'Enable Cable Labels', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Search commands' }).click();
  await page.getByRole('button', { name: 'Open Cable Labels Copy cable endpoint labels for your printer', exact: true }).click();
  const labels = page.getByRole('region', { name: 'Cable labels', exact: true });
  const expected = 'Machine A · USB 2 (rear)\nMachine B · USB 1 (rear)';
  await expect(labels.getByTestId('cable-label-preview')).toHaveText(expected);
  await labels.getByRole('button', { name: /^Copy label for/ }).click();
  await expect(labels.getByRole('status')).toContainText('Copied 1 label');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await labels.getByRole('checkbox', { name: 'Select visible cables' }).check();
  const download = page.waitForEvent('download');
  await labels.getByRole('button', { name: 'Export selected CSV' }).click();
  expect((await download).suggestedFilename()).toBe('cable-labels.csv');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(labels.getByRole('button', { name: 'Copy selected labels' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await tools.click();
  await page.getByRole('button', { name: /Settings →/ }).click();
  await page.getByRole('button', { name: 'Manage plugins', exact: true }).click();
  await page.getByRole('button', { name: 'Disable Cable Labels', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(labels).not.toBeVisible();
});

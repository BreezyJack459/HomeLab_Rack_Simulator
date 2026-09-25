// Refresh documentation screenshots from a running Vite development server.
// Uses isolated browser contexts and bundled examples, never a personal profile.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.DOCS_URL ?? 'http://127.0.0.1:5173/HomeLab_Rack_Simulator/';
const outDir = resolve(process.env.DOCS_OUT_DIR ?? 'docs/images');
const browser = await chromium.launch({ headless: true });
const captures = [];
const errors = [];
await mkdir(outDir, { recursive: true });

async function openPage(width = 1600, height = 1000) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
  return page;
}
async function sample(page, id = 'sample-19in-home-cloud') {
  await page.evaluate(async ({ id, base }) => {
    const { sampleLayouts } = await import(`${base}src/data/sampleLayouts.ts`);
    const layout = sampleLayouts.find(item => item.id === id);
    if (!layout) throw new Error(`Missing example ${id}`);
    window.__rackStore.getState().loadLayout(structuredClone(layout));
  }, { id, base: new URL(baseUrl).pathname });
}
async function capture(page, name, description, three = false) {
  await page.evaluate(() => document.fonts.ready);
  if (three) {
    await expect(page.locator('canvas').last()).toBeVisible();
    await page.waitForTimeout(1800); // Camera animation, textures and WebGL frames.
    expect((await page.locator('canvas').last().screenshot()).length).toBeGreaterThan(15000);
  }
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: resolve(outDir, `${name}.png`), animations: 'disabled' });
  captures.push({ file: `${name}.png`, description, viewport: page.viewportSize() });
  console.log(`Captured ${name}`);
}

try {
  let page = await openPage();
  await sample(page);
  await page.getByPlaceholder('Search devices').fill('switch');
  await page.locator('[data-device-id="sample19-switch"]').click();
  await capture(page, 'build-2d', 'Build: bundled 19-inch home cloud, library search and selected switch properties.');

  await page.getByRole('button', { name: '3D', exact: true }).click();
  let viewer = page.getByTestId('rack-inspection-3d');
  await viewer.getByRole('button', { name: 'Fit rack', exact: true }).click();
  await capture(page, 'build-3d', 'Build: 3D overview of the bundled home cloud rack.', true);

  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await expect(page.getByTestId('cable-map-svg')).toBeVisible();
  await capture(page, 'cable-map', 'Cable: 2D map with the sample data and power connections.');
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  viewer = page.getByTestId('cable-viewer-3d');
  await viewer.getByRole('combobox', { name: 'Camera view' }).selectOption('rear-angle');
  await capture(page, 'cable-3d', 'Cable: rear-angle 3D routing, including actual review states.', true);

  await page.getByRole('button', { name: 'Topology', exact: true }).click();
  await page.waitForTimeout(500);
  await capture(page, 'topology', 'Cable: logical topology of the sample rack.');
  await page.getByRole('button', { name: 'Check Health', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Check category' })).toBeVisible();
  await page.getByRole('button', { name: /2 power cable.*not assigned/ }).click();
  await capture(page, 'check', 'Check: sample-rack issues and validation overview; warnings are intentionally retained.');

  await page.getByRole('button', { name: 'Build Rack', exact: true }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByPlaceholder('Search devices').fill('');
  await page.evaluate(() => {
    const store = window.__rackStore.getState();
    store.addDeviceToInventory('minisforum-um790-pro');
    store.addDeviceToInventory('unifi-ucg-max');
  });
  await page.getByRole('tab', { name: /^My devices/ }).click();
  await capture(page, 'inventory', 'Build: two example unplaced devices in My devices, separate from installed totals.');

  await page.getByTestId('workspace-tools-trigger').click();
  await page.getByRole('button', { name: /Settings →/ }).click();
  await page.getByRole('button', { name: 'Manage plugins', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'plugins', 'Tools / Settings: plugin management with optional packs.');
  await page.context().close();

  page = await openPage();
  await page.evaluate(async base => {
    const { sampleLayouts } = await import(`${base}src/data/sampleLayouts.ts`);
    const source = structuredClone(sampleLayouts.find(item => item.id === 'sample-my-onhand-gear'));
    const shelf = { ...source.devices.find(d => d.category === 'shelf'), id: 'docs-tray', name: 'Mini PC thin tray', positionU: 3, sizeU: 1, xMm: 0, depthMm: 300, widthType: '19in' };
    const pc = { ...source.devices.find(d => d.name.includes('UM790')), id: 'docs-pc', positionU: 4, sizeU: 2, xMm: 15 };
    window.__rackStore.getState().loadLayout({ ...source, name: 'Thin tray example', heightU: 8, devices: [shelf, pc], cables: [], reservations: [] });
    window.__rackStore.getState().selectDevice(shelf.id);
  }, new URL(baseUrl).pathname);
  await page.getByRole('button', { name: 'Dimensions & placement', exact: true }).click();
  await page.getByRole('combobox', { name: 'Shelf placement' }).selectOption('tray');
  await page.evaluate(() => window.__rackStore.getState().updateDevice('docs-pc', { physicalHeightMm: 52.3, clearanceAboveMm: 10, positionU: 3 }));
  await expect(page.locator('[data-shelf-style="tray"]')).toBeVisible();
  await capture(page, 'thin-tray', 'Illustrative 8U fixture: a 52.3 mm Mini PC plus 10 mm clearance shares its starting U with a thin tray.');
  await page.context().close();

  page = await openPage();
  await sample(page);
  await page.evaluate(() => {
    const store = window.__rackStore.getState();
    store.addDeviceFromTemplate('pdu-0u-vertical');
    const pdu = window.__rackStore.getState().layout.devices.find(d => d.category === 'pdu-0u');
    if (!pdu) throw new Error('PDU could not be placed');
    store.selectDevice(pdu.id);
  });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByTestId('rack-inspection-3d').getByRole('combobox', { name: 'Camera view' }).selectOption('rear-angle');
  await capture(page, 'zero-u-pdu', 'Bundled home cloud plus a catalog 0U PDU, viewed from the rear angle.', true);
  await page.context().close();

  page = await openPage();
  await page.evaluate(() => window.__rackStore.getState().loadLayout({
    id: 'docs-drawing', name: 'Custom route example', rackType: '19in', heightU: 18, rackDepthMm: 800,
    weightLimitKg: 500, powerBudgetW: 4000, viewSide: 'rear', updatedAt: '', cables: [],
    devices: [10, 6].map((positionU, i) => ({ id: i ? 'b' : 'a', name: i ? 'Lower server' : 'Upper server', category: 'server', positionU, sizeU: 1, depthMm: 400, widthType: '19in', ports: { ethernet: 2, power: 1 }, color: '#64748b', powerW: 10, weightKg: 1, heatLevel: 1 })),
  }));
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  viewer = page.getByTestId('cable-viewer-3d');
  await viewer.getByRole('button', { name: 'Draw route', exact: true }).click();
  const draw = page.getByTestId('route-drawing');
  await draw.getByRole('button', { name: 'ethernet 1', exact: true }).click();
  await draw.getByRole('button', { name: 'rear left · U10', exact: true }).click();
  await draw.getByLabel('Routing point height').selectOption('6');
  await draw.getByRole('button', { name: 'rear left · U6', exact: true }).click();
  await draw.getByLabel('Drawing device').selectOption('b');
  await draw.getByRole('button', { name: 'ethernet 1', exact: true }).hover();
  await expect(draw.getByTestId('drawing-length')).toContainText('Suggested cable');
  // Keep the endpoint hover so the screenshot includes the route preview.
  await page.waitForTimeout(1800);
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  await page.screenshot({ path: resolve(outDir, 'draw-route.png'), animations: 'disabled' });
  captures.push({ file: 'draw-route.png', description: 'Illustrative two-server fixture: route draft through two existing channel points, with endpoint/length preview.', viewport: page.viewportSize() });
  console.log('Captured draw-route');
  await page.context().close();

  page = await openPage(900, 1100);
  await sample(page, 'sample-10in-edge-lab');
  await capture(page, 'tablet', '900px tablet layout using the bundled 10-inch edge lab.');
  await page.context().close();
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(resolve(outDir, 'capture-manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), source: 'Local Vite working tree, isolated Chromium contexts', captures, pageErrors: errors }, null, 2) + '\n');
  console.log(`Done: ${captures.length} captures; no uncaught page errors.`);
} finally {
  await browser.close();
}

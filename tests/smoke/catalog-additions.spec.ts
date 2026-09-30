import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

test('new catalog devices are searchable, placeable and visible in both 3D viewers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({
      deviceLibraryOpen: true, enabledPluginIds: ['cable-management'],
    }));
  });
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().newLayout('19in', 18);
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const name of ['UniFi Cloud Gateway Ultra (UCG-Ultra)', 'UniFi Switch Pro Max 16 PoE', 'UniFi Switch Aggregation (USW-Aggregation)', 'Synology DiskStation DS224+']) {
    await page.getByRole('textbox', { name: 'Search devices', exact: true }).fill(name);
    await page.getByRole('button', { name: `Add ${name} to front`, exact: true }).click();
  }
  await expect(page.getByTestId('rack-device-count')).toHaveText('4 devices');
  await page.screenshot({ path: '/tmp/homelab-catalog-2d.png' });
  await page.getByRole('textbox', { name: 'Search devices', exact: true }).fill('UniFi U7 Lite');
  await expect(page.getByRole('button', { name: 'Add UniFi U7 Lite to front', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save UniFi U7 Lite to My devices', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByTestId('rack-inspection-3d').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('rack-inspection-3d').getByTestId('scene-selection-label').first()).toBeVisible();
  await page.screenshot({ path: '/tmp/homelab-catalog-3d.png' });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    const devices = store.getState().layout.devices;
    store.getState().addCable({
      fromDeviceId: devices.find(d => d.templateId === 'unifi-usw-aggregation')!.id,
      toDeviceId: devices.find(d => d.templateId === 'unifi-usw-pro-max-16-poe')!.id,
      fromPort: { type: 'fiber', index: 0 }, toPort: { type: 'fiber', index: 0 },
      type: 'fiber', color: '#c084fc',
    });
    store.getState().selectCable(store.getState().layout.cables[0].id);
  });
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  await expect(page.getByTestId('cable-viewer-3d').locator('canvas')).toBeVisible();
  await page.getByTestId('cable-viewer-3d').getByRole('button', { name: 'Fit route', exact: true }).click();
  await expect(page.getByTestId('cable-viewer-3d').getByRole('button', { name: 'Fit route', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '/tmp/homelab-catalog-cable-3d.png' });
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('saved builds and new NAS/compute models load with an initially closed library', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({
      deviceLibraryOpen: false, enabledPluginIds: ['cable-management'],
    }));
  });
  await page.goto('/');
  const toggle = page.getByTestId('toggle-device-library');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.getByRole('textbox', { name: 'Search devices', exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().newLayout('19in', 22);
  });
  for (const name of ['EDNSE ED408H40 8-bay NAS (saved build)', 'Minisforum MS-02 Ultra (285HX / 25GbE)', 'UniFi UNAS Pro 8', 'UniFi UNAS 2']) {
    await page.getByRole('textbox', { name: 'Search devices', exact: true }).fill(name);
    await page.getByRole('button', { name: `Add ${name} to front`, exact: true }).click();
  }
  await expect(page.getByTestId('rack-device-count')).toHaveText('4 devices');
  await page.screenshot({ path: '/tmp/homelab-catalog-wave2-2d.png' });
  await page.reload();
  await expect(page.getByTestId('rack-device-count')).toHaveText('4 devices');
  const ports = await page.evaluate(() => {
    const devices = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout.devices;
    return { nas: devices.find(d => d.templateId === 'unifi-unas-2')!.ports, workstation: devices.find(d => d.templateId === 'minisforum-ms-02-ultra-285hx')!.ports };
  });
  expect(ports.nas).toEqual({ ethernet: 1, usb: 1 });
  expect(ports.workstation?.fiber).toBe(2);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const inspection = page.getByTestId('rack-inspection-3d');
  await expect(inspection.locator('canvas')).toBeVisible();
  await expect(inspection.getByTestId('scene-selection-label').first()).toBeVisible();
  await inspection.getByRole('combobox', { name: 'Camera view' }).selectOption('rear');
  await page.waitForTimeout(1000); // Let the animated camera reach the rear preset before capture.
  await page.screenshot({ path: '/tmp/homelab-catalog-wave2-3d.png' });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    const devices = store.getState().layout.devices;
    store.getState().addCable({
      fromDeviceId: devices.find(d => d.templateId === 'minisforum-ms-02-ultra-285hx')!.id,
      toDeviceId: devices.find(d => d.templateId === 'unifi-unas-pro-8')!.id,
      fromPort: { type: 'ethernet', index: 1 }, toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet', color: '#38bdf8',
    });
    store.getState().selectCable(store.getState().layout.cables[0].id);
  });
  const routing = page.getByTestId('cable-viewer-3d');
  await expect(routing.locator('canvas')).toBeVisible();
  await routing.getByRole('button', { name: 'Fit route', exact: true }).click();
  await expect(routing.getByRole('button', { name: 'Fit route', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1000); // Fit the selected route before capture; floating labels can be occluded.
  await page.screenshot({ path: '/tmp/homelab-catalog-wave2-cable-3d.png' });
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('specific Mini PC generations and rack servers can be selected and cabled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({
      deviceLibraryOpen: true, enabledPluginIds: ['cable-management'],
    }));
  });
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Search devices', exact: true });
  await expect(search).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().newLayout('19in', 22);
    store.getState().updateRack({ rackDepthMm: 1000 });
  });
  for (const name of [
    'Dell OptiPlex 7050 Micro', 'Dell OptiPlex 7070 Micro', 'Dell OptiPlex 7090 Micro',
    'Lenovo ThinkCentre M720q Tiny', 'Lenovo ThinkCentre M920q Tiny', 'Lenovo ThinkCentre M90q Gen 3 Tiny',
    'HP EliteDesk 800 G3 Desktop Mini', 'HP EliteDesk 800 G4 Desktop Mini', 'HP EliteDesk 800 G6 Desktop Mini',
    'Dell PowerEdge R730 (4x1GbE / dual PSU)', 'Dell PowerEdge R740 (4x1GbE / dual PSU)',
    'HPE ProLiant MicroServer Gen10 Plus', 'QNAP TS-464', 'TerraMaster F4-425 Pro (N350)',
    'ASUSTOR Flashstor 6 Gen2 (FS6806X)', 'MikroTik CRS309-1G-8S+IN', 'MikroTik CRS326-24G-2S+RM',
    'UniFi Dream Router 7 (UDR7)', 'UniFi Express 7 (UX7)', 'UniFi Network Video Recorder Pro (UNVR-Pro)',
  ]) {
    await search.fill(name);
    await expect(page.getByRole('button', { name: `Add ${name} to front`, exact: true })).toBeEnabled();
  }
  for (const name of [
    'Dell OptiPlex 7050 Micro', 'Lenovo ThinkCentre M90q Gen 3 Tiny', 'HP EliteDesk 800 G6 Desktop Mini',
    'Dell PowerEdge R740 (4x1GbE / dual PSU)', 'TerraMaster F4-425 Pro (N350)',
    'MikroTik CRS326-24G-2S+RM', 'UniFi Dream Router 7 (UDR7)',
  ]) {
    await search.fill(name);
    await page.getByRole('button', { name: `Add ${name} to front`, exact: true }).click();
  }
  await expect(page.getByTestId('rack-device-count')).toHaveText('7 devices');
  await page.screenshot({ path: '/tmp/homelab-catalog-wave3-2d.png' });
  await page.reload();
  await expect(page.getByTestId('rack-device-count')).toHaveText('7 devices');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().selectDevice(store.getState().layout.devices.find(d => d.templateId === 'dell-poweredge-r740')!.id);
  });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const inspection = page.getByTestId('rack-inspection-3d');
  await expect(inspection.locator('canvas')).toBeVisible();
  await expect(inspection.getByTestId('scene-selection-label').first()).toBeVisible();
  await inspection.getByRole('combobox', { name: 'Camera view' }).selectOption('rear');
  await page.waitForTimeout(1000); // Camera animation before the review capture.
  await page.screenshot({ path: '/tmp/homelab-catalog-wave3-3d.png' });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    const devices = store.getState().layout.devices;
    store.getState().addCable({
      fromDeviceId: devices.find(d => d.templateId === 'dell-poweredge-r740')!.id,
      toDeviceId: devices.find(d => d.templateId === 'mikrotik-crs326-24g-2s-rm')!.id,
      fromPort: { type: 'ethernet', index: 4 }, toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet', color: '#38bdf8',
    });
    store.getState().selectCable(store.getState().layout.cables[0].id);
  });
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  const routing = page.getByTestId('cable-viewer-3d');
  await expect(routing.locator('canvas')).toBeVisible();
  await routing.getByRole('button', { name: 'Fit route', exact: true }).click();
  await expect(routing.getByRole('button', { name: 'Fit route', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/homelab-catalog-wave3-cable-3d.png' });
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});


test('Hong Kong catalog batch survives placement and reload in both 3D viewers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('rack-simulator-new-shell', '1');
    localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({
      deviceLibraryOpen: true, enabledPluginIds: ['cable-management'],
    }));
  });
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Search devices', exact: true });
  await expect(search).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().newLayout('19in', 42);
    store.getState().updateRack({ rackDepthMm: 1000 });
  });
  for (const name of [
    "Synology RackStation RS822+",
    "Synology DiskStation DS1825+",
    "TP-Link Omada ER707-M2 V1",
    "UniFi Switch Pro XG 8 PoE",
    "UniFi Switch Pro Max 48 PoE",
    "MikroTik CRS304-4XG-IN",
    "Dell OptiPlex 7060 Micro",
    "Dell OptiPlex 7080 Micro",
    "Lenovo ThinkCentre M920x Tiny",
    "Lenovo ThinkStation P330 Tiny",
    "Lenovo ThinkStation P360 Tiny",
    "HP EliteDesk 800 G5 Desktop Mini",
    "HP Elite Mini 800 G9",
    "Dell Wyse 5070",
    "Dell Wyse 5070 Extended",
    "HP t740 Thin Client",
    "Dell PowerEdge R630 (8-bay / 4x1GbE)",
    "Dell PowerEdge R230 (4-bay / base I/O)"
]) {
    await search.fill(name);
    await page.getByRole('button', { name: `Add ${name} to front`, exact: true }).click();
  }
  await expect(page.getByTestId('rack-device-count')).toHaveText('18 devices');
  await page.screenshot({ path: '/tmp/homelab-catalog-hk-2d.png' });
  await page.reload();
  await expect(page.getByTestId('rack-device-count')).toHaveText('18 devices');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().selectDevice(store.getState().layout.devices.find(d => d.templateId === 'unifi-usw-pro-max-48-poe')!.id);
  });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const inspection = page.getByTestId('rack-inspection-3d');
  await expect(inspection.locator('canvas')).toBeVisible();
  await inspection.getByRole('combobox', { name: 'Camera view' }).selectOption('rear');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/homelab-catalog-hk-3d.png' });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    const devices = store.getState().layout.devices;
    store.getState().addCable({
      fromDeviceId: devices.find(d => d.templateId === 'synology-ds1825-plus')!.id,
      toDeviceId: devices.find(d => d.templateId === 'unifi-usw-pro-max-48-poe')!.id,
      fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 32 },
      type: 'ethernet', color: '#38bdf8',
    });
    store.getState().selectCable(store.getState().layout.cables[0].id);
  });
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  const routing = page.getByTestId('cable-viewer-3d');
  await expect(routing.locator('canvas')).toBeVisible();
  await routing.getByRole('button', { name: 'Fit route', exact: true }).click();
  await expect(routing.getByRole('button', { name: 'Fit route', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/homelab-catalog-hk-cable-3d.png' });
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

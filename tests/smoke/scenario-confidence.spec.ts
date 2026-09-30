import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { useRackStore } from '../../src/store/rackStore';
import type { PlacedDevice } from '../../src/types/rack';

for (const width of [1440, 390]) test(`scenario coverage and export retain unknowns at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'planning-pack'] })));
  await page.goto('/');
  await expect(page.getByTestId('toggle-device-library')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    store.loadLayout({ ...store.layout, name: 'Scenario review', devices: [{ id: 'server', name: 'Review server', category: 'server', sizeU: 1, positionU: 1, widthType: '19in', depthMm: 100, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333' }], cables: [] });
  });
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('button', { name: /^Planning →/ }).click();
  await page.getByRole('button', { name: /Scenario Planner/ }).click();
  const coverage = page.getByRole('status', { name: 'Scenario check coverage' });
  await expect(coverage).toContainText('Unknowns earn no pass credit');
  const text = (await coverage.textContent())!;
  const counts = text.match(/Modeled checks met: (\d+)\/(\d+) \((\d+)%\)\. (\d+) failed; (\d+) unknown/)!;
  expect(counts).not.toBeNull();
  const [passed, total, score, failed, unknown] = counts.slice(1).map(Number);
  expect(unknown).toBeGreaterThan(0);
  expect(total).toBe(passed + failed + unknown);
  expect(score).toBe(Math.floor(100 * passed / total));
  await page.getByRole('button', { name: /Summer Heatwave/ }).click();
  await expect(page.getByText(/heatwave survival and cooling capacity are unverified/)).toBeVisible();
  await expect(page.getByText(/not a temperature or cooling-capacity calculation/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export.*Report/i }).click();
  const file = await download;
  const report = await readFile((await file.path())!, 'utf8');
  expect(report).toContain(`Modeled checks met: ${passed}/${total} (${score}%)`);
  expect(report).toContain(`Unknown assumptions: ${unknown}`);
  expect(report).toContain('heatwave survival and cooling capacity are unverified');
  expect(report).not.toContain('3–7°C');
  expect(report).not.toContain('Replace UPS battery now');
});

for (const width of [1440, 390]) test(`network and NAS scenarios show recorded dependencies at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('homelab-rack-simulator-layout-prefs', JSON.stringify({ enabledPluginIds: ['cable-management', 'governance-tools', 'planning-pack'] })));
  await page.goto('/');
  await expect(page.getByTestId('toggle-device-library')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
    const make = (id: string, category: PlacedDevice['category'], positionU: number): PlacedDevice => ({ id, name: id, category, positionU, sizeU: 1, widthType: '19in', depthMm: 100, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333' });
    store.loadLayout({ ...store.layout, heightU: 24, devices: [make('gateway', 'router', 1), make('core', 'switch', 2), make('alternate', 'switch', 3), make('dual', 'server', 4), make('single', 'server', 5), make('nas', 'nas', 6),
      { ...make('boot-child', 'server', 7), bootDependsOn: ['dual'] }, make('ap-a', 'access-point', 8), make('ap-b', 'access-point', 9), make('kvm', 'ip-kvm', 10),
    ].map(d => d.id === 'dual' ? { ...d, bootDependsOn: ['nas'] } : d),
    cables: [['gateway', 'core'], ['gateway', 'alternate'], ['core', 'dual'], ['core', 'single'], ['alternate', 'dual']].map(([fromDeviceId, toDeviceId], i) => ({ id: `link-${i}`, type: 'ethernet', fromDeviceId, toDeviceId, color: '#333' })),
    services: [{ id: 'files', name: 'Shared files', criticality: 'critical', hostDeviceId: 'single', storageDeviceIds: ['nas'] }] });
  });
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('button', { name: /^Planning →/ }).click();
  await page.getByRole('button', { name: /Scenario Planner/ }).click();
  await page.getByRole('button', { name: /Core Switch Reboot/ }).click();
  await expect(page.getByText(/another recorded physical gateway path remains/).first()).toBeVisible();
  await expect(page.getByText(/No recorded physical gateway path remains/)).toBeVisible();
  await page.getByRole('button', { name: /NAS Failure/ }).click();
  await expect(page.getByText(/Recorded services depend on the failed NAS: Shared files/)).toBeVisible();
  await expect(page.getByText(/restart order is affected/).first()).toBeVisible();
  await page.getByRole('button', { name: /All APs Offline/ }).click();
  await expect(page.getByText(/This preset removes all 2 recorded AP/)).toBeVisible();
  await page.getByRole('button', { name: /Management Network Down/ }).click();
  await expect(page.getByText(/Console wiring, independent reachability, power and recovery access are unverified/)).toBeVisible();
});

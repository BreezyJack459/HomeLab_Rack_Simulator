import { expect, test } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';
import type { RackLayout } from '../../src/types/rack';

const layout: RackLayout = {
  id: 'zero-u-smoke', name: '0U PDU preview', rackType: '19in', heightU: 20, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1200, viewSide: 'rear', updatedAt: '', cables: [],
  devices: [{ id: 'server', category: 'server', name: 'Test server', positionU: 12, sizeU: 2, widthType: '19in',
    depthMm: 400, weightKg: 8, powerW: 100, heatLevel: 2, color: '#334155', ports: { power: 2 } }],
};

for (const width of [1100, 1440]) test(`0U PDU remains visible in 2D and both 3D viewers at ${width}px`, async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Build Rack', exact: true })).toBeVisible();
  await page.evaluate(layout => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().loadLayout(layout), layout);
  await page.getByPlaceholder('Search devices').fill('0U');
  await page.getByRole('button', { name: 'Add 0U Vertical PDU to rear rail', exact: true }).click();
  const pdu = page.locator('[data-device-id][data-device-category="pdu-0u"]');
  await expect(pdu).toBeVisible();
  const open = page.getByRole('button', { name: 'Open inspector', exact: true });
  if (await open.isVisible()) await open.click();
  const length = page.getByRole('spinbutton', { name: 'PDU length mm', exact: true });
  await expect(length).toHaveValue('700');
  await page.getByRole('spinbutton', { name: 'Height above base mm', exact: true }).fill('80');
  if (width < 1280) await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click();
  await page.getByTestId('fit-rack-button').click();
  const rect = await pdu.boundingBox();
  const frame = await page.getByTestId('rack-frame').boundingBox();
  expect(rect!.x).toBeGreaterThan(frame!.x + frame!.width - 5); // physical left is screen-right in rear view
  expect(rect!.x + rect!.width).toBeLessThan(width);
  expect(rect!.y).toBeGreaterThan(frame!.y);
  expect(rect!.y + rect!.height).toBeLessThan(frame!.y + frame!.height);
  await page.screenshot({ path: `artifacts/zero-u-pdu/2d-${width}.png` });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const viewer = page.getByTestId('rack-inspection-3d');
  await expect(viewer.locator('canvas')).toBeVisible();
  await expect(viewer.getByLabel('Camera view')).toHaveValue('rear-angle');
  await expect(viewer.getByTestId('scene-selection-label').filter({ hasText: '0U Vertical PDU' })).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `artifacts/zero-u-pdu/3d-${width}.png` });
  await viewer.getByLabel('Camera view').selectOption('top');
  await expect(viewer.getByLabel('Camera view')).toHaveValue('top');
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    const pdu = store.getState().layout.devices.find(d => d.category === 'pdu-0u')!;
    store.getState().addCable({ fromDeviceId: pdu.id, fromPort: { type: 'power', index: 5 },
      toDeviceId: 'server', toPort: { type: 'power', index: 0 }, type: 'power', color: '#fb923c' });
  });
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: '3D routing', exact: true }).click();
  const cables = page.getByTestId('cable-viewer-3d');
  await expect(cables.locator('canvas')).toBeVisible();
  await cables.getByLabel('Camera view').selectOption('rear-angle');
  // Capture after the camera transition settles; visibility itself is covered by the projection regression.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `artifacts/zero-u-pdu/cables-${width}.png` });
  await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
  await page.reload();
  const saved = await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().layout);
  const savedPdu = saved.devices.find(d => d.category === 'pdu-0u')!;
  expect(savedPdu.physicalHeightMm).toBe(700);
  expect((savedPdu.positionU - 1) * 44.45).toBeCloseTo(80);
  expect(saved.cables.some(c => c.fromDeviceId === savedPdu.id && c.toDeviceId === 'server' && c.fromPort?.index === 5)).toBe(true);
});

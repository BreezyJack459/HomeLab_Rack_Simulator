import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { RackLayout } from '../../src/types/rack';
import type { useRackStore } from '../../src/store/rackStore';

const fixture: RackLayout = {
  id: 'rear-browser',
  name: 'Rear candidate test',
  rackType: '19in',
  heightU: 18,
  rackDepthMm: 800,
  weightLimitKg: 500,
  powerBudgetW: 4000,
  viewSide: 'rear',
  updatedAt: '2026-09-09',
  devices: [10, 6].map((positionU, index) => ({
    id: index ? 'b' : 'a',
    name: index ? 'Lower device' : 'Upper device',
    category: 'server',
    positionU,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    ports: { ethernet: 2 },
    color: '#64748b',
    powerW: 10,
    weightKg: 1,
    heatLevel: 1
  })),
  cables: [
    {
      id: 'link',
      type: 'ethernet',
      lengthMm: 1,
      color: '#38bdf8',
      fromDeviceId: 'a',
      toDeviceId: 'b',
      fromPort: { type: 'ethernet', index: 0 },
      toPort: { type: 'ethernet', index: 0 }
    }
  ]
};

for (const blocked of [false, true])
  test(`rear route ${blocked ? 'review state' : 'natural drop'} remains usable in both styles`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.evaluate(
      ({ fixture, blocked }) => {
        const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState();
        if (blocked)
          fixture.devices.push({
            ...fixture.devices[0],
            id: 'overlap',
            name: 'Conflicting imported device',
            mountSide: 'rear',
            depthMm: 800
          });
        store.loadLayout(fixture);
        store.selectCable('link');
      },
      { fixture, blocked }
    );
    await page.getByRole('button', { name: 'Cable', exact: true }).click();
    await page.getByRole('button', { name: '3D routing', exact: true }).click();
    const viewer = page.getByTestId('cable-viewer-3d');
    await expect(viewer.locator('canvas')).toBeVisible();
    let purchaseText = '';
    for (const style of ['clean', 'realistic']) {
      await viewer.locator('summary').click();
      await viewer.getByRole('button', { name: style, exact: true }).click();
      await viewer.locator('summary').click();
      if (blocked) {
        await viewer.getByRole('button', { name: /Review route: Upper device/ }).click();
        await expect(viewer.getByText(/3D route: No clear rear route/)).toBeVisible();
        await expect(viewer.getByLabel('3D route length')).toContainText('Not estimated — route blocked');
        await expect(viewer.getByText(/Recorded cable is/)).toHaveCount(0);
      } else {
        await expect(
          viewer.getByText('3D route: Natural drop · no added support', { exact: true })
        ).toBeVisible();
        await expect(viewer.getByRole('button', { name: /Review route:/ })).toHaveCount(0);
        await expect(viewer.getByLabel('3D route length')).toContainText(/3D centreline: \d+\.\d{2} m/);
        await expect(viewer.getByText(/Recorded cable is/)).toBeVisible();
      }
      await expect(page.locator('#runtime-error-overlay')).toHaveCount(0);
      const currentPurchase = await viewer.getByLabel('Cable purchase length').innerText();
      if (purchaseText) expect(currentPurchase).toBe(purchaseText);
      purchaseText = currentPurchase;
    }
    const purchaseLength = purchaseText.split('Purchase length: ')[1].split('. Uses')[0];
    const exportSection = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Export cable BOM' }) });
    if (!(await exportSection.evaluate(element => (element as HTMLDetailsElement).open))) await exportSection.locator('summary').click();
    for (const format of ['CSV', 'Text']) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: `BOM ${format}`, exact: true }).click();
      const file = await download;
      const text = await readFile((await file.path())!, 'utf8');
      expect(text).toContain(purchaseLength);
      expect(text).toContain(blocked ? 'Blocked or missing route' : 'Longer Clean/Realistic 3D centreline');
    }
  });

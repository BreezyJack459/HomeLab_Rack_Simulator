import { expect, test, type Page } from '@playwright/test';
import { sampleLayouts } from '../../src/data/sampleLayouts';
import type { useRackStore } from '../../src/store/rackStore';

const nodePositions = (page: Page) => page.locator('[data-topology-node]').evaluateAll(elements =>
  elements.map(element => ({ id: element.getAttribute('data-topology-node'), transform: element.getAttribute('transform') })));

const expectReadableNodes = async (page: Page) => {
  await expect(page.locator('[data-topology-node]')).toHaveCount(10);
  await expect(page.locator('[data-topology-node]').filter({ hasText: /shelf|cable manager|lacing bar|brush pass-through/i })).toHaveCount(0);
  await expect.poll(() => page.locator('[data-topology-node]').evaluateAll(elements => {
    const svg = (elements[0] as SVGGraphicsElement).ownerSVGElement!;
    const canvas = svg.getBoundingClientRect();
    const boxes = elements.map(el => el.getBoundingClientRect());
    return boxes.flatMap((box, index) => {
      const name = elements[index].textContent;
      if (box.left < canvas.left || box.right > canvas.right || box.top < canvas.top || box.bottom > canvas.bottom) return [`Clipped: ${name}`];
      return boxes.flatMap((other, otherIndex) => otherIndex > index && box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom ? [`${name} overlaps ${elements[otherIndex].textContent}`] : []);
    });
  })).toEqual([]);
};

test('topology separates devices and preserves positions through filtering and view changes', async ({ page }) => {
  await page.setViewportSize({ width: 1932, height: 964 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: 'Topology', exact: true }).click();
  await expectReadableNodes(page);
  const positions = await nodePositions(page);
  await page.getByRole('searchbox', { name: 'Filter cable routes' }).fill('no-such-cable-123');
  await expect(page.locator('[data-topology-route]')).toHaveCount(0);
  expect(await nodePositions(page)).toEqual(positions);
  await page.getByRole('searchbox', { name: 'Filter cable routes' }).fill('');
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await page.getByRole('button', { name: 'Topology', exact: true }).click();
  await expect.poll(() => nodePositions(page)).toEqual(positions);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expectReadableNodes(page);
  await page.screenshot({ path: '/tmp/topology-fixed.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectReadableNodes(page);
});

test('topology starts measuring after adding devices to an empty layout', async ({ page }) => {
  await page.setViewportSize({ width: 1932, height: 964 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.evaluate(() => {
    const store = (window as unknown as { __rackStore: typeof useRackStore }).__rackStore;
    store.getState().loadLayout({ ...store.getState().layout, devices: [], cables: [] });
  });
  await page.getByRole('button', { name: 'Topology', exact: true }).click();
  await expect(page.getByText('No devices with ports', { exact: true })).toBeVisible();
  await page.evaluate(layout => {
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().loadLayout(layout);
  }, sampleLayouts[1]);
  await expectReadableNodes(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectReadableNodes(page);
});

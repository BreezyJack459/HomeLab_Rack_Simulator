import { expect, test, type Page } from '@playwright/test';
import type { useRackStore } from '../../src/store/rackStore';

async function loadExample(page: Page, sampleId: string) {
  await page.locator('[data-testid="more-dropdown"] summary').click();
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  await page.getByTestId(`sample-card-${sampleId}`).getByRole('button').click();
  await page.getByRole('dialog', { name: 'Load sample layout?', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click();
}
for (const width of [1440, 390]) test(`sample summary distinguishes conflicts, uncertainty and optional raw warnings at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/');
  await expect(page.getByTestId('example-guide')).toBeVisible();
  await loadExample(page, 'learn-advanced-19in');
  await expect(page.getByTestId('finding-summary-confirmed')).toHaveText('0 Confirmed issues');
  await expect(page.getByTestId('finding-summary-verification')).toHaveText('0 Needs verification');
  await expect(page.getByTestId('finding-summary-information')).toHaveText('29 Optional information');
  await page.getByTestId('finding-summary-information').click();
  const sidebar = width < 1024 ? page.getByRole('dialog', { name: 'Check issues', exact: true }) : page.getByRole('complementary', { name: 'Check issues', exact: true });
  await expect(sidebar.getByRole('combobox', { name: 'Issue severity', exact: true })).toHaveValue('information');
  await expect(sidebar.getByRole('region', { name: 'Optional information', exact: true })).toBeVisible();
  await expect(sidebar.getByText('Result: unknown · Raw severity: warning').first()).toBeVisible();
  await expect(sidebar.getByRole('region', { name: 'Confirmed issues', exact: true })).toHaveCount(0);
  await sidebar.getByRole('button', { name: 'Reset issue filters', exact: true }).click();
  await expect(sidebar.getByRole('combobox', { name: 'Issue severity', exact: true })).toHaveValue('attention');
  await expect(sidebar.getByRole('combobox', { name: 'Issue topic', exact: true })).toHaveValue('overview');
  if (width < 1024) await sidebar.getByRole('button', { name: 'Close device library', exact: true }).click();
  await page.evaluate(() => (window as unknown as { __rackStore: typeof useRackStore }).__rackStore.getState().updateDevice('learn-server', { powerReviewed: false }));
  await expect(page.getByTestId('finding-summary-verification')).toHaveText('1 Needs verification');
  await page.getByTestId('finding-summary-verification').click();
  await expect(sidebar.getByRole('combobox', { name: 'Issue severity', exact: true })).toHaveValue('verification');
  await expect(sidebar.getByRole('region', { name: 'Needs verification', exact: true })).toBeVisible();
  await expect(sidebar.getByText(/Planning power needs review/).first()).toBeVisible();
  if (width < 1024) await sidebar.getByRole('button', { name: 'Close device library', exact: true }).click();
  await loadExample(page, 'learn-troubleshooting-19in');
  await expect(page.getByTestId('finding-summary-confirmed')).toHaveText('3 Confirmed issues');
  await expect(page.getByTestId('finding-summary-verification')).toHaveText('0 Needs verification');
  await expect(page.getByTestId('finding-summary-information')).toHaveText('30 Optional information');
  await page.getByTestId('finding-summary-confirmed').click();
  await expect(sidebar.getByRole('combobox', { name: 'Issue severity', exact: true })).toHaveValue('confirmed');
  const confirmed = sidebar.getByRole('region', { name: 'Confirmed issues', exact: true });
  await expect(confirmed.getByText('Result: fail · Raw severity: critical')).toHaveCount(1);
  await expect(confirmed.getByText('Result: fail · Raw severity: warning')).toHaveCount(3);
  await expect(sidebar.getByRole('heading', { name: /Check · 3 of .* root causes/ })).toBeVisible();
});

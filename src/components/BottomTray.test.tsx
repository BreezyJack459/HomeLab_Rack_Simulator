import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BottomTray } from './BottomTray';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import type { ValidationIssue } from '../types/rack';

afterEach(cleanup);
beforeEach(() => useLayoutPrefsStore.setState({ bottomTrayOpen: false }));
const renderTray = (issues: ValidationIssue[]) => render(<BottomTray issues={issues} selectedIssueId={null} statusMessage="Cable saved" currentWorkspace="model" onIssueSelect={vi.fn()} onOpenAudit={vi.fn()} />);

it('does not describe optional unknown findings as confirmed conflicts or verified hardware', () => {
  renderTray([{ id: 'illustrative-spec', title: 'Review optional estimate', detail: 'Illustrative only', severity: 'warning', status: 'unknown', applicability: 'optional' }]);
  expect(screen.getByText('No confirmed issues or verification tasks')).toBeVisible();
  fireEvent.click(screen.getByTestId('toggle-bottom-tray'));
  const summaries = screen.getAllByLabelText('Finding counts');
  expect(summaries).toHaveLength(2);
  summaries.forEach(summary => expect(summary).toHaveTextContent('1 Optional information'));
  expect(screen.getByRole('status')).toHaveTextContent('Cable saved');
  expect(screen.getByTestId('toggle-bottom-tray')).toHaveAttribute('aria-expanded', 'true');
});

it('keeps confirmed and unknown active root causes separate in the collapsed tray', () => {
  renderTray([
    { id: 'fail', title: 'Conflict', detail: 'Known conflict', severity: 'critical', status: 'fail', applicability: 'active' },
    { id: 'unknown', title: 'Needs evidence', detail: 'Missing evidence', severity: 'warning', status: 'unknown', applicability: 'active' },
  ]);
  expect(screen.getByText('1 confirmed · 1 to verify')).toBeVisible();
});

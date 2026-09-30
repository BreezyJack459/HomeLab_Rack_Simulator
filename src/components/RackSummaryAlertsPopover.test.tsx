import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RackSummaryAlertsPopover } from './RackSummaryAlertsPopover';
import type { ValidationIssue } from '../types/rack';

afterEach(cleanup);
it('shares root cause counts and exposes each affected check through accessible actions', () => {
  const issues: ValidationIssue[] = ['a', 'b'].map(id => ({ id, title: `Endpoint ${id}`, detail: `Unknown cable length at ${id}`, severity: 'warning', status: 'unknown', rootCauseKey: 'service-motion:cable', cableIds: ['cable'], deviceIds: [id] }));
  const onIssueSelect = vi.fn();
  render(<RackSummaryAlertsPopover issues={issues} selectedIssueId="a" onIssueSelect={onIssueSelect} />);
  expect(screen.getByLabelText('Finding summary')).toHaveTextContent('0 Confirmed issues');
  expect(screen.getByLabelText('Finding summary')).toHaveTextContent('1 Needs verification');
  const section = screen.getByRole('region', { name: 'Needs verification' });
  fireEvent.click(within(section).getByRole('button', { name: /Endpoint b/ }));
  expect(onIssueSelect).toHaveBeenCalledWith(issues[1]);
  expect(within(section).getByText(/2 devices · 1 cables/)).toBeInTheDocument();
});
it('does not call an empty finding list physically verified', () => {
  render(<RackSummaryAlertsPopover issues={[]} selectedIssueId={null} onIssueSelect={vi.fn()} />);
  expect(screen.getByText(/does not verify the physical installation/)).toBeInTheDocument();
});

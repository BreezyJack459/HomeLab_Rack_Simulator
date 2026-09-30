import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CheckSidebar } from './CheckSidebar';
import { CheckIssueDetails } from './CheckIssueDetails';
import type { ValidationIssue } from '../types/rack';

afterEach(cleanup);
const issues: ValidationIssue[] = [
  { id: 'power-limit', severity: 'critical', title: 'Power exceeded', detail: 'Reduce load' },
  { id: 'depth-device', severity: 'warning', title: 'Too deep', detail: 'Adjust depth', deviceIds: ['device'] },
  { id: 'color-cable', severity: 'info', title: 'Cable color', detail: 'Optional color' },
];
const props = { issues, selectedId: null, onSelect: vi.fn(), lens: 'issues' as const, onLens: vi.fn(), severity: 'attention' as const, onSeverity: vi.fn(), category: 'overview' as const, onCategory: vi.fn(), strictCabling: false, onStrictCabling: vi.fn() };
it('prioritizes critical and warnings while allowing suggestions explicitly', () => {
  const { rerender } = render(<CheckSidebar {...props} />);
  expect(screen.queryByText('Optional color')).not.toBeInTheDocument();
  expect(screen.getByText(/1 critical · 1 warnings · 1 suggestions/)).toBeInTheDocument();
  rerender(<CheckSidebar {...props} severity="info" />);
  expect(screen.getByText('Optional color')).toBeInTheDocument();
  expect(screen.queryByText('Reduce load')).not.toBeInTheDocument();
});
it('filters health topics and reports an empty filtered queue accurately', () => {
  const { rerender } = render(<CheckSidebar {...props} category="power" />);
  expect(screen.getByText('Reduce load')).toBeInTheDocument();
  expect(screen.queryByText('Adjust depth')).not.toBeInTheDocument();
  rerender(<CheckSidebar {...props} category="weight" />);
  expect(screen.getByText(/No issues match/)).toBeInTheDocument();
});
it('offers device and rack actions for fit issues and rack action for global issues', () => {
  const onEdit = vi.fn(); const onEditRack = vi.fn();
  const { rerender } = render(<CheckIssueDetails issue={issues[1]} onEdit={onEdit} onEditRack={onEditRack} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit device' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adjust rack settings' }));
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onEditRack).toHaveBeenCalledOnce();
  rerender(<CheckIssueDetails issue={issues[0]} onEdit={onEdit} onEditRack={onEditRack} />);
  expect(screen.queryByRole('button', { name: 'Edit device' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Adjust rack settings' }));
  expect(onEditRack).toHaveBeenCalledTimes(2);
});
it('shows thermal suggestions whose title identifies the topic', () => {
  const thermalSuggestion: ValidationIssue = { id: 'service-gap', title: 'Improve thermal clearance', detail: 'Leave rear space', severity: 'info' };
  render(<CheckSidebar {...props} issues={[...issues, thermalSuggestion]} category="thermal" severity="all" />);
  expect(screen.getByText('Leave rear space')).toBeInTheDocument();
  expect(screen.queryByText('Reduce load')).not.toBeInTheDocument();
});


it('filters cables by affected routes and resets topic and severity together', () => {
  const cableIssue: ValidationIssue = { id: 'custom-link', title: 'Link needs attention', detail: 'Select a free socket', severity: 'warning', cableIds: ['c'] };
  const onCategory = vi.fn(); const onSeverity = vi.fn();
  render(<CheckSidebar {...props} issues={[...issues, cableIssue]} category="cable" severity="all" onCategory={onCategory} onSeverity={onSeverity} />);
  expect(screen.getByText('Select a free socket')).toBeInTheDocument();
  expect(screen.queryByText('Reduce load')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset issue filters' }));
  expect(onCategory).toHaveBeenCalledWith('overview');
  expect(onSeverity).toHaveBeenCalledWith('attention');
});


it('groups missing installation evidence without merging failed checks or lowering severity', () => {
  const pending: ValidationIssue[] = ['Server A', 'Server B'].map((name, index) => ({ id: `installation-requirements-${index}`, title: `${name}: installation unverified`, detail: 'Requirements are not recorded', severity: 'warning', evidence: 'unverified' }));
  const failed: ValidationIssue = { id: 'installation-rails-failed', title: 'Server C: installation requirement not met', detail: 'Rail spacing too short', severity: 'warning' };
  const onSelect = vi.fn();
  render(<CheckSidebar {...props} issues={[...pending, failed]} selectedId={pending[1].id} onSelect={onSelect} />);
  const verification = screen.getByRole('region', { name: 'Needs verification' });
  expect(within(verification).getAllByText(/Installation requirements not recorded/)).toHaveLength(1);
  expect(within(verification).getByText('warning')).toBeInTheDocument();
  expect(within(verification).getByRole('button', { name: /Server B/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(within(verification).getByRole('button', { name: /Server A/ }));
  expect(onSelect).toHaveBeenCalledWith(pending[0]);
  expect(within(screen.getByRole('region', { name: 'Issues to address' })).getByText('Rail spacing too short')).toBeInTheDocument();
  expect(within(verification).queryByText('Rail spacing too short')).not.toBeInTheDocument();
});

it('does not classify untagged conflicts by missing or unknown words in a title', () => {
  render(<CheckSidebar {...props} issues={[{ id: 'missing-cable-device', title: 'Missing device', detail: 'Stale cable endpoint', severity: 'critical' }]} />);
  expect(screen.queryByRole('region', { name: 'Needs verification' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Issues to address' })).getByText('Stale cable endpoint')).toBeInTheDocument();
});

it('explains when the reviewed issue is no longer reported without claiming installation is verified', () => {
  render(<CheckIssueDetails issue={null} reviewedTitle="Server too deep" onEdit={vi.fn()} onEditRack={vi.fn()} />);
  expect(screen.getByText(/Server too deep.*no longer reported/)).toBeInTheDocument();
  expect(screen.getByText(/does not verify the physical installation/)).toBeInTheDocument();
});


it('groups unverified service lengths while keeping each device and cable identifiable', () => {
  const pending: ValidationIssue[] = ['cable-a', 'cable-b'].map(id => ({ id: `cable-strain-${id}-server`, title: 'Server service cable needs review', detail: 'Actual cable length is not recorded.', severity: 'warning', evidence: 'unverified', deviceIds: ['server'], cableIds: [id] }));
  const onSelect = vi.fn();
  render(<CheckSidebar {...props} issues={pending} selectedId={pending[0].id} onSelect={onSelect} />);
  const region = screen.getByRole('region', { name: 'Needs verification' });
  expect(within(region).getAllByText(/Service cable length needs review/)).toHaveLength(1);
  const cableB = within(region).getByRole('button', { name: /Server service cable needs review.*Cable: cable-b/ });
  fireEvent.click(cableB);
  expect(onSelect).toHaveBeenCalledWith(pending[1]);
});

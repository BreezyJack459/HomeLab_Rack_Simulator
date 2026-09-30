import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CheckSidebar } from './CheckSidebar';
import { CheckIssueDetails } from './CheckIssueDetails';
import type { ValidationIssue } from '../types/rack';

afterEach(cleanup);
const issues: ValidationIssue[] = [
  { id: 'power-limit', severity: 'critical', status: 'fail', title: 'Power exceeded', detail: 'Reduce load' },
  { id: 'depth-device', severity: 'warning', status: 'fail', title: 'Too deep', detail: 'Adjust depth', deviceIds: ['device'] },
  { id: 'color-cable', severity: 'info', title: 'Cable color', detail: 'Optional color' },
];
const props = { issues, selectedId: null, onSelect: vi.fn(), lens: 'issues' as const, onLens: vi.fn(), severity: 'attention' as const, onSeverity: vi.fn(), category: 'overview' as const, onCategory: vi.fn(), strictCabling: false, onStrictCabling: vi.fn() };
it('prioritizes critical and warnings while allowing suggestions explicitly', () => {
  const { rerender } = render(<CheckSidebar {...props} />);
  expect(screen.queryByText('Optional color')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Finding counts')).toHaveTextContent('2 Confirmed issues');
  expect(screen.getByLabelText('Finding counts')).toHaveTextContent('0 Needs verification');
  expect(screen.getByLabelText('Finding counts')).toHaveTextContent('1 Optional information');
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
  const failed: ValidationIssue = { id: 'installation-rails-failed', title: 'Server C: installation requirement not met', detail: 'Rail spacing too short', severity: 'warning', status: 'fail' };
  const onSelect = vi.fn();
  render(<CheckSidebar {...props} issues={[...pending, failed]} selectedId={pending[1].id} onSelect={onSelect} />);
  const verification = screen.getByRole('region', { name: 'Needs verification' });
  expect(within(verification).getAllByText(/Installation requirements not recorded/)).toHaveLength(2);
  expect(within(verification).getAllByText('unverified')[0]).toBeInTheDocument();
  expect(within(verification).getByRole('button', { name: /Server B/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(within(verification).getByRole('button', { name: /Server A/ }));
  expect(onSelect).toHaveBeenCalledWith(pending[0]);
  expect(within(screen.getByRole('region', { name: 'Confirmed issues' })).getByText('Rail spacing too short')).toBeInTheDocument();
  expect(within(verification).queryByText('Rail spacing too short')).not.toBeInTheDocument();
});

it('uses explicit failure status even when a title mentions missing evidence', () => {
  render(<CheckSidebar {...props} issues={[{ id: 'missing-cable-device', title: 'Missing device', detail: 'Stale cable endpoint', severity: 'critical', status: 'fail' }]} />);
  expect(screen.queryByRole('region', { name: 'Needs verification' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Confirmed issues' })).getByText('Stale cable endpoint')).toBeInTheDocument();
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
  expect(within(region).getAllByText(/Service cable length needs review/)).toHaveLength(2);
  const cableB = within(region).getByRole('button', { name: /Server service cable needs review.*Cable: cable-b/ });
  fireEvent.click(cableB);
  expect(onSelect).toHaveBeenCalledWith(pending[1]);
});

it('counts one root cause for two endpoint checks and leaves their actions accessible', () => {
  const grouped: ValidationIssue[] = ['a', 'b'].map(id => ({ id: `cable-strain-${id}`, title: `Endpoint ${id}`, detail: `Cable length unknown for ${id}`, severity: 'warning', status: 'unknown', rootCauseKey: 'service-motion:cable', cableIds: ['cable'], deviceIds: [id] }));
  render(<CheckSidebar {...props} issues={grouped} selectedId={grouped[0].id} />);
  expect(screen.getByRole('heading', { name: 'Check · 1 of 1 root causes' })).toBeInTheDocument();
  expect(screen.getByLabelText('Finding counts')).toHaveTextContent('0 Confirmed issues');
  expect(screen.getByLabelText('Finding counts')).toHaveTextContent('1 Needs verification');
  expect(screen.getByRole('button', { name: /Endpoint a/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Endpoint b/ })).toBeInTheDocument();
});

it('does not promote an untagged legacy warning based on severity or reassuring wording', () => {
  render(<CheckSidebar {...props} issues={[{ id: 'custom', severity: 'critical', title: 'Recorded conflict', detail: 'No evidence metadata supplied' }]} />);
  expect(screen.queryByRole('region', { name: 'Confirmed issues' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Needs verification' })).toBeInTheDocument();
});

it('keeps explicit optional and nonapplicable conflicts in the default attention queue', () => {
  const conflicts: ValidationIssue[] = ['optional', 'not-applicable'].map((applicability, index) => ({ id: `physical-${index}`, severity: 'info', status: 'fail', applicability: applicability as 'optional' | 'not-applicable', title: `Known conflict ${index}`, detail: `Resolve conflict ${index}` }));
  render(<CheckSidebar {...props} issues={conflicts} />);
  expect(screen.getByLabelText('Finding counts')).toHaveTextContent('2 Confirmed issues');
  expect(screen.getByRole('button', { name: /Resolve conflict 0/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Resolve conflict 1/ })).toBeInTheDocument();
});

it('filters by result sections independently of severity and retains raw severity filters', () => {
  const checks: ValidationIssue[] = [
    { id: 'known', status: 'fail', severity: 'warning', title: 'Known fit conflict', detail: 'Fix fit' },
    { id: 'pending', status: 'unknown', severity: 'warning', title: 'Missing rating', detail: 'Review rating' },
    { id: 'hint', status: 'unknown', applicability: 'optional', severity: 'warning', title: 'Optional advisory', detail: 'Inspect heuristic' },
  ];
  const { rerender } = render(<CheckSidebar {...props} issues={checks} severity="information" />);
  expect(screen.getByText('Inspect heuristic')).toBeInTheDocument();
  expect(screen.queryByText('Fix fit')).not.toBeInTheDocument();
  expect(screen.getByText('Result: unknown · Raw severity: warning')).toBeInTheDocument();
  rerender(<CheckSidebar {...props} issues={checks} severity="verification" />);
  expect(screen.getByText('Review rating')).toBeInTheDocument();
  expect(screen.queryByText('Inspect heuristic')).not.toBeInTheDocument();
  rerender(<CheckSidebar {...props} issues={checks} severity="warning" />);
  expect(screen.getByText('Fix fit')).toBeInTheDocument();
  expect(screen.getByText('Inspect heuristic')).toBeInTheDocument();
});

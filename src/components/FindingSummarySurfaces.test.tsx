import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RackLayout, ValidationIssue } from '../types/rack';
import { advancedSample, exerciseSample } from '../data/sampleLayouts';
import { useRackStore } from '../store/rackStore';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import { getRackTotals, validateRackLayout } from '../utils/validation';
import { summarizeFindings } from '../utils/findingSummary';
import { findingIdentity } from '../utils/findingExceptions';
import { IssueBar } from './IssueBar';
import { BottomTray } from './BottomTray';
import { ActivityStatusChip } from './ActivityStatusChip';
import { RackHealthDashboard } from './RackHealthDashboard';
import { AuditWorkbench } from './AuditWorkbench';
import { ValidationPanel } from './ValidationPanel';
import { RackSummaryAlertsPopover } from './RackSummaryAlertsPopover';

afterEach(cleanup);
beforeEach(() => useLayoutPrefsStore.setState({ bottomTrayOpen: true }));
const renderers = [
  { name: 'raw issue bar', show: (layout: RackLayout, issues: ValidationIssue[]) => <IssueBar layout={layout} issues={issues} selectedIssueId={null} onIssueSelect={vi.fn()} /> },
  { name: 'bottom tray', show: (layout: RackLayout, issues: ValidationIssue[]) => <BottomTray layout={layout} issues={issues} selectedIssueId={null} statusMessage={null} currentWorkspace="model" onIssueSelect={vi.fn()} onOpenAudit={vi.fn()} /> },
  { name: 'activity summary', show: (layout: RackLayout, issues: ValidationIssue[]) => <ActivityStatusChip layout={layout} issues={issues} statusMessage={null} />, open: () => fireEvent.click(screen.getByTestId('activity-status-chip')) },
  { name: 'health dashboard', show: (layout: RackLayout) => <RackHealthDashboard layout={layout} /> },
  { name: 'audit workbench', show: (layout: RackLayout, issues: ValidationIssue[]) => <AuditWorkbench layout={layout} issues={issues} totals={getRackTotals(layout)} selectedIssueId={null} documentationIssueCount={0} serviceabilityIssueCount={0} failureDomainIssueCount={0} openDebtCount={0} currentLens="issues" onSelectLens={vi.fn()} onIssueSelect={vi.fn()} /> },
  { name: 'validation details', show: (layout: RackLayout, issues: ValidationIssue[]) => <ValidationPanel issues={issues} totals={getRackTotals(layout)} /> },
  { name: 'summary popover', show: (layout: RackLayout, issues: ValidationIssue[]) => <RackSummaryAlertsPopover layout={layout} issues={issues} selectedIssueId={null} onIssueSelect={vi.fn()} /> },
];
for (const surface of renderers) describe(surface.name, () => {
  it.each([advancedSample, exerciseSample])('counts canonical sections for $id instead of raw warning severities', fixture => {
    const layout = structuredClone(fixture);
    useRackStore.setState({ layout, workspace: { ...useRackStore.getState().workspace, racks: [layout], interRackCables: [] } });
    const issues = validateRackLayout(layout);
    const summary = summarizeFindings(issues, layout);
    render(surface.show(layout, issues));
    surface.open?.();
    for (const [count, label] of [[summary.counts.confirmed, 'Confirmed issues'], [summary.counts.verification, 'Needs verification'], [summary.counts.information, 'Optional information']] as const) {
      expect(screen.getAllByText(new RegExp(`${count} ${label}`)).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/^9 warnings?$/i)).not.toBeInTheDocument();
    if (surface.name === 'health dashboard' && fixture.id === advancedSample.id) expect(screen.getByText('No applicable issues detected')).toBeInTheDocument();
  });
});
it('keeps every optional raw heuristic and its severity visible in the expanded issue bar', () => {
  const issues = validateRackLayout(advancedSample);
  const onIssueSelect = vi.fn();
  render(<IssueBar layout={advancedSample} issues={issues} selectedIssueId={null} onIssueSelect={onIssueSelect} />);
  fireEvent.click(screen.getByRole('button', { name: '0 root causes need attention' }));
  expect(screen.getAllByRole('button')).toHaveLength(issues.length + 1);
  expect(screen.getAllByText('Result: unknown · Raw severity: warning')).toHaveLength(9);
  fireEvent.click(screen.getAllByRole('button')[1]);
  expect(onIssueSelect).toHaveBeenCalledWith(issues[0]);
});
it('retains accepted conflicts outside the action count without treating them as healthy', () => {
  useRackStore.getState().loadLayout(structuredClone(exerciseSample));
  let layout = useRackStore.getState().layout;
  const conflict = summarizeFindings(validateRackLayout(layout), layout).groups.find(group => group.section === 'confirmed')!;
  expect(useRackStore.getState().acceptFindingException(findingIdentity(conflict.representative), 'Disposable learning exercise exception')).toBe(true);
  layout = useRackStore.getState().layout;
  render(<RackHealthDashboard layout={layout} />);
  expect(screen.getByText('2 Confirmed issues')).toBeInTheDocument();
  expect(screen.getByText('1 Accepted exceptions')).toBeInTheDocument();
  expect(screen.queryByText('No applicable issues detected')).not.toBeInTheDocument();
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { PlanningGoalsControls } from './PlanningGoalsControls';
import { FindingExceptionControls } from './FindingExceptionControls';
import { useRackStore } from '../store/rackStore';
import type { ValidationIssue, PlanningGoals } from '../types/rack';

beforeEach(() => useRackStore.getState().loadLayout({ ...useRackStore.getState().layout, devices: [], cables: [], planningGoals: undefined, findingExceptions: undefined }));
afterEach(cleanup);
it('leaves legacy goals absent until edited and preserves imported goal extensions', () => {
  const { unmount } = render(<PlanningGoalsControls />);
  expect(useRackStore.getState().layout.planningGoals).toBeUndefined();
  unmount();
  const goals = { version: 1, power: 'single', remoteRecovery: 'optional', serviceMotion: 'unspecified', futureNote: 'preserve' } as PlanningGoals;
  useRackStore.getState().updateRack({ planningGoals: goals });
  render(<PlanningGoalsControls />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Rack power goal' }), { target: { value: 'independent-ab' } });
  expect(useRackStore.getState().layout.planningGoals).toMatchObject({ ...goals, power: 'independent-ab' });
});
it('requires a reason, exposes retained facts, and allows explicit reopening', () => {
  const issue: ValidationIssue = { id: 'depth-s', ruleId: 'depth', rootCauseKey: 'depth:device:s', status: 'fail', severity: 'warning', title: 'Depth exceeded', detail: 'Device depth exceeds usable rack', deviceIds: ['s'], cause: { deviceDepth: 900, usableDepth: 800 } };
  const { rerender } = render(<FindingExceptionControls issue={issue} />);
  const accept = screen.getByRole('button', { name: 'Accept current facts with this reason' });
  expect(accept).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for accepted exception' }), { target: { value: 'Installation reviewed with rear door removed' } });
  fireEvent.click(accept);
  expect(screen.getByText('Accepted exception', { exact: true })).toBeInTheDocument();
  expect(useRackStore.getState().layout.findingExceptions).toHaveLength(1);
  act(() => useRackStore.getState().updateRack({ name: 'Unrelated rename' }));
  expect(screen.getByText('Accepted exception', { exact: true })).toBeInTheDocument();
  rerender(<FindingExceptionControls issue={{ ...issue, cause: { deviceDepth: 950, usableDepth: 800 } }} />);
  expect(screen.getByText('Changed since acceptance — review again')).toBeInTheDocument();
  expect(screen.getByText(/Previous reason: Installation reviewed/)).toBeInTheDocument();
  rerender(<FindingExceptionControls issue={issue} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reopen this exception' }));
  expect(useRackStore.getState().layout.findingExceptions).toEqual([]);
});

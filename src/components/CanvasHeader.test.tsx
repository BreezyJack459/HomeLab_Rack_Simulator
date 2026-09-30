import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { ValidationIssue } from '../types/rack';
import { sampleLayouts } from '../data/sampleLayouts';
import { getRackTotals } from '../utils/validation';
import { CanvasHeader } from './CanvasHeader';

afterEach(cleanup);
const layout = sampleLayouts[1];
const props: ComponentProps<typeof CanvasHeader> = { layout, totals: getRackTotals(layout), issues: [], deviceLibraryOpen: false, viewMode: '2d', viewModes: [], onToggleDeviceLibrary: vi.fn(), onRenameLayout: vi.fn(), onToggleViewMode: vi.fn(), onSetViewSide: vi.fn(), canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(), issueCount: 0, onAddDevice: vi.fn(), onFixAlerts: vi.fn(), onOpenSearch: vi.fn(), onNewLayout: vi.fn(), onDuplicate: vi.fn(), onSaveLocal: vi.fn(), onLoadLocal: vi.fn(), onImportLayout: vi.fn(), onLoadSample: vi.fn(), onExportJson: vi.fn(), onExportPng: vi.fn() };
it('counts canonical sections rather than turning raw advisory warnings into confirmed issues', () => {
  const issues: ValidationIssue[] = [
    { id: 'conflict', status: 'fail', severity: 'warning', title: 'Known conflict', detail: 'Recorded fit conflict' },
    ...['a', 'b'].map(id => ({ id, status: 'unknown' as const, severity: 'warning' as const, title: 'Review cable', detail: 'Unknown length', rootCauseKey: 'service-motion:one' })),
    { id: 'hint', status: 'unknown', applicability: 'optional', severity: 'warning', title: 'Optional routing hint', detail: 'Advisory' },
  ];
  const onOpenCheck = vi.fn();
  render(<CanvasHeader {...props} issues={issues} onOpenCheck={onOpenCheck} />);
  expect(screen.getByTestId('finding-summary-confirmed')).toHaveTextContent('1 Confirmed issues');
  expect(screen.getByTestId('finding-summary-verification')).toHaveTextContent('1 Needs verification');
  expect(screen.getByTestId('finding-summary-information')).toHaveTextContent('1 Optional information');
  expect(screen.getByTestId('finding-summary-accepted')).toHaveTextContent('0 Accepted exceptions');
  fireEvent.click(screen.getByTestId('finding-summary-information'));
  expect(onOpenCheck).toHaveBeenLastCalledWith('overview', 'information');
  fireEvent.click(screen.getByTestId('finding-summary-verification'));
  expect(onOpenCheck).toHaveBeenLastCalledWith('overview', 'verification');
});

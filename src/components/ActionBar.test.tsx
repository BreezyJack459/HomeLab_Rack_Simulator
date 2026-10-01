import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ActionMenus, type ActionMenusProps } from './ActionBar';

afterEach(cleanup);

function actions(): ActionMenusProps {
  return {
    canUndo: false, canRedo: false, issueCount: 0,
    onAddDevice: vi.fn(), onFixAlerts: vi.fn(), onOpenSearch: vi.fn(),
    onNewLayout: vi.fn(), onDuplicate: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn(),
    onSaveLocal: vi.fn(), onLoadLocal: vi.fn(), onImportLayout: vi.fn(),
    onLoadSample: vi.fn(), onExportJson: vi.fn(), onWorkspaceBackup: vi.fn(),
    onExportPng: vi.fn(), onExportDrawio: vi.fn(), onExportExcalidraw: vi.fn(), onExportSvg: vi.fn(),
  };
}

it('keeps every file action available in clearly separated save and export groups', () => {
  const props = actions();
  render(<ActionMenus {...props} fileOnly />);
  const menu = screen.getByTestId('more-dropdown');
  menu.setAttribute('open', '');
  expect(screen.getByText('Rack & examples · 機架與示例')).toBeVisible();
  expect(screen.getByText('Save & restore · 儲存與還原')).toBeVisible();
  expect(screen.getByText('Export & share · 匯出')).toBeVisible();
  for (const name of ['New rack layout', 'Load sample', 'Import rack', 'Duplicate current rack', 'Workspace backup and restore', 'Save local copy', 'Load local copy', 'Export rack JSON', 'Export rack PNG', 'Export draw.io', 'Export Excalidraw', 'Export diagram SVG']) {
    expect(screen.getByRole('button', { name })).toBeVisible();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Export rack JSON' }));
  expect(props.onExportJson).toHaveBeenCalledOnce();
  expect(menu).not.toHaveAttribute('open');
});

it('closes the file menu on Escape and restores keyboard focus to its trigger', () => {
  render(<ActionMenus {...actions()} fileOnly />);
  const menu = screen.getByTestId('more-dropdown');
  menu.setAttribute('open', '');
  screen.getByRole('button', { name: 'Save local copy' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(menu).not.toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'File and export options' })).toHaveFocus();
});

it('retains classic create and work menus with disabled undo and redo semantics', () => {
  render(<ActionMenus {...actions()} />);
  screen.getByTestId('actions-dropdown').setAttribute('open', '');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Check alerts' })).toBeVisible();
  expect(screen.getByTestId('create-dropdown')).toBeInTheDocument();
});

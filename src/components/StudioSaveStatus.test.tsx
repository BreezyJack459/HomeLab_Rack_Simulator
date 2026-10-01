import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRackStore } from '../store/rackStore';
import { StudioSaveStatus } from './StudioSaveStatus';
afterEach(() => { cleanup(); useRackStore.setState({ persistenceError: null, persistenceBlocked: false }); });
it('distinguishes local persistence from a portable exported backup', () => {
  useRackStore.setState({ persistenceError: null, persistenceBlocked: false });
  const onExport = vi.fn(); render(<StudioSaveStatus onExport={onExport} message={null} />);
  expect(screen.getByTestId('browser-save-status')).toHaveTextContent('Saved in this browser');
  fireEvent.click(screen.getByRole('button', { name: 'Export JSON backup' })); expect(onExport).toHaveBeenCalledOnce();
});
it('never claims saved when browser storage failed', () => {
  useRackStore.setState({ persistenceError: 'Storage full', persistenceBlocked: false });
  render(<StudioSaveStatus onExport={() => {}} message={null} />);
  expect(screen.getByTestId('browser-save-status')).toHaveTextContent('Not saved in this browser');
});
it('shows paused recovery instead of saved for unreadable workspace data', () => {
  useRackStore.setState({ persistenceError: 'Unreadable saved data', persistenceBlocked: true });
  render(<StudioSaveStatus onExport={() => {}} message={null} />);
  expect(screen.getByTestId('browser-save-status')).toHaveTextContent('Autosave paused');
});

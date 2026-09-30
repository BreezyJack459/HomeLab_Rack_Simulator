import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CableLabelPanel } from './CableLabelPanel';
import { useRackStore } from '../store/rackStore';
import type { PlacedDevice } from '../types/rack';
afterEach(cleanup);
beforeEach(() => {
  const base = useRackStore.getState().layout;
  useRackStore.getState().loadLayout({ ...base, devices: [
    { ...base.devices[0], id: 'a', name: 'Machine A', category: 'server', portAliases: { 'ethernet:0': 'LAN uplink' } },
    { ...base.devices[0], id: 'b', name: 'Machine B', category: 'switch', portAliases: {}  },
  ] as PlacedDevice[], cables: [0, 1].map(i => ({ id: `c${i}`, type: 'ethernet', color: '#fff', fromDeviceId: 'a', toDeviceId: 'b', fromPort: { type: 'ethernet', index: i, side: 'rear' }, toPort: { type: 'ethernet', index: i, side: 'front' } })) });
});
it('copies the displayed two-line label including aliases and actual newline', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<CableLabelPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy label for c0' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Machine A · LAN uplink (rear)\nMachine B · LAN 1 (front)'));
  expect(await screen.findByRole('status')).toHaveTextContent('Copied 1 label');
});
it('selects visible rows and excludes hidden selections from the batch', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<CableLabelPanel />);
  fireEvent.click(screen.getByLabelText('Select visible cables'));
  fireEvent.change(screen.getByLabelText('Search cable labels'), { target: { value: 'uplink' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy selected labels' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(writeText.mock.calls[0][0]).not.toContain('LAN 2');
});
it('provides selected manual text when the clipboard is denied', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
  render(<CableLabelPanel />);
  fireEvent.change(screen.getByLabelText('Label format'), { target: { value: 'both-ends' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy label for c0' }));
  const text = await screen.findByLabelText('Manual label copy');
  expect(text).toHaveValue('Machine A · LAN uplink (rear)\n→ Machine B · LAN 1 (front)\n\nMachine B · LAN 1 (front)\n→ Machine A · LAN uplink (rear)');
});

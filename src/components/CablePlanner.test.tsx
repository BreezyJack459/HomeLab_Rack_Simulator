import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CablePlanner } from './CablePlanner';
import { useRackStore } from '../store/rackStore';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import type { RackLayout, PlacedDevice } from '../types/rack';

const device = (id: string, positionU: number): PlacedDevice => ({ id, name: id, category: 'switch', sizeU: 1, positionU, widthType: '19in', depthMm: 100, color: '#555', powerW: 10, weightKg: 1, heatLevel: 1, ports: { ethernet: 4 } });
const layout: RackLayout = { id: 'planner-controls', name: 'Cable controls', rackType: '19in', rackDepthMm: 600, heightU: 6, powerBudgetW: 600, weightLimitKg: 100, devices: [device('Switch A', 1), device('Switch B', 3)], cables: [{ id: 'link', label: 'Uplink', fromDeviceId: 'Switch A', fromPort: { type: 'ethernet', index: 0, side: 'front' }, toDeviceId: 'Switch B', toPort: { type: 'ethernet', index: 0, side: 'front' }, type: 'ethernet', color: '#123456' }], viewSide: 'front', updatedAt: '2026-09-30T00:00:00Z' };
afterEach(cleanup);
beforeEach(() => {
  useRackStore.getState().loadLayout(structuredClone(layout));
  useRackStore.setState({ selectedCableId: null });
  useCableWorkspaceStore.getState().setQuery('');
  useCableWorkspaceStore.getState().showAllTypes();
});
it('provides a separate keyboard-focusable route inspection control and named delete action', () => {
  render(<CablePlanner />);
  const inspect = screen.getByRole('button', { name: 'Inspect Uplink cable' });
  inspect.focus();
  expect(inspect).toHaveFocus();
  fireEvent.click(inspect);
  expect(inspect).toHaveAttribute('aria-pressed', 'true');
  expect(useRackStore.getState().selectedCableId).toBe('link');
  expect(screen.getByLabelText('Cable label')).toHaveValue('Uplink');
  fireEvent.change(screen.getByLabelText('Cable label'), { target: { value: 'Renamed uplink' } });
  expect(useRackStore.getState().layout.cables[0].label).toBe('Renamed uplink');
  fireEvent.click(screen.getByRole('button', { name: 'Delete Renamed uplink cable' }));
  expect(useRackStore.getState().layout.cables).toHaveLength(0);
});
it('keeps cable search and grouped-list disclosure independently accessible', () => {
  render(<CablePlanner />);
  const group = screen.getByRole('button', { name: /ethernet.*1 routes/ });
  expect(group).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(group);
  expect(group).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Inspect Uplink cable' })).not.toBeInTheDocument();
  fireEvent.click(group);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Filter cable planner routes' }), { target: { value: 'missing route' } });
  expect(screen.getByText('No cables match the filter.')).toBeInTheDocument();
});

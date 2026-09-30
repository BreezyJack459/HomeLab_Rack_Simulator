import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ComponentLibrary } from './ComponentLibrary';
import { useRackStore } from '../store/rackStore';

vi.mock('../data/deviceCatalog', () => ({
  deviceCatalog: [
    { id: 'wide', name: 'Test wide switch', description: '', category: 'switch', defaultU: 1, widthType: '19in', depthMm: 200, powerW: 20, ports: { ethernet: 24 }, color: '#333' },
    { id: 'narrow', name: 'Test narrow switch', description: 'Alternative to Test wide switch', category: 'switch', defaultU: 1, widthType: '10in', depthMm: 100, powerW: 10, color: '#333' },
  ],
}));
afterEach(cleanup);

it('prioritizes dimension-compatible search matches without dropping other results', () => {
  useRackStore.setState((state) => ({ layout: { ...state.layout, rackType: '10in', heightU: 12, rackDepthMm: 600 } }));
  render(<ComponentLibrary />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search devices' }), { target: { value: 'Test' } });
  const panel = screen.getByRole('tabpanel', { name: 'Library' });
  expect(within(panel).getAllByRole('heading').map((node) => node.textContent)).toEqual(['Test narrow switch', 'Test wide switch']);
  expect(screen.getByText('Best matches first; similar matches that fit rack dimensions appear first. All matching devices are shown.')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Fits rack dimensions' }));
  expect(within(panel).getAllByRole('heading')).toHaveLength(1);
  expect(within(panel).getByRole('heading', { name: 'Test narrow switch' })).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Fits rack dimensions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search devices' }), { target: { value: '' } });
});

it('keeps a specific name ahead of a dimension-compatible description match', () => {
  useRackStore.setState((state) => ({ layout: { ...state.layout, rackType: '10in', heightU: 12, rackDepthMm: 600 } }));
  render(<ComponentLibrary />);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search devices' }), { target: { value: 'Test wide switch' } });
  const panel = screen.getByRole('tabpanel', { name: 'Library' });
  expect(within(panel).getAllByRole('heading').map(node => node.textContent)).toEqual(['Test wide switch', 'Test narrow switch']);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Fits rack dimensions' }));
  expect(within(panel).getAllByRole('heading').map(node => node.textContent)).toEqual(['Test narrow switch']);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
});


it('combines specification filters and restores results with clear filters', () => {
  render(<ComponentLibrary />);
  const panel = screen.getByRole('tabpanel', { name: 'Library' });
  fireEvent.click(screen.getByText('Specification filters'));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum Ethernet ports' }), { target: { value: '8' } });
  expect(within(panel).getAllByRole('heading').map(n => n.textContent)).toEqual(['Test wide switch']);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum depth (mm)' }), { target: { value: '150' } });
  expect(within(panel).queryAllByRole('heading')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(within(panel).getAllByRole('heading')).toHaveLength(2);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum initial load (W)' }), { target: { value: '10' } });
  expect(within(panel).getAllByRole('heading').map(n => n.textContent)).toEqual(['Test narrow switch']);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum U' }), { target: { value: '0' } });
  expect(within(panel).queryAllByRole('heading')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
});

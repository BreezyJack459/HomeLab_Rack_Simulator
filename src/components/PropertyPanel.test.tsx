import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PropertyPanel } from './PropertyPanel';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';

const layout: RackLayout = {
  id: 'property-layout',
  name: 'Property Layout',
  rackType: '19in',
  heightU: 22,
  rackDepthMm: 800,
  weightLimitKg: 300,
  powerBudgetW: 2400,
  viewSide: 'front',
  updatedAt: new Date().toISOString(),
  devices: [
    {
      id: 'dev-selection',
      category: 'cable-management',
      name: 'Front cable manager with an intentionally long label',
      mountSide: 'front',
      positionU: 19,
      sizeU: 1,
      xMm: 0,
      depthMm: 60,
      widthType: '19in',
      weightKg: 0.9,
      powerW: 0,
      heatLevel: 1,
      ports: {},
      color: '#334155',
    },
  ],
  cables: [],
  reservations: [],
};

describe('PropertyPanel selection summary', () => {
  beforeEach(() => {
    const state = useRackStore.getState();
    useRackStore.setState({
      ...state,
      workspace: {
        ...state.workspace,
        racks: [layout],
        updatedAt: layout.updatedAt,
      },
      currentRackId: layout.id,
      layout,
      selectedDeviceId: 'dev-selection',
      selectedCableId: null,
      selectedInterRackCableId: null,
      viewMode: '2d',
    });
  });

  it('wraps compact metadata below the device name without squeezing the name', () => {
    render(<PropertyPanel />);

    const meta = screen.getByTestId('property-selection-meta');
    expect(meta).toHaveClass('flex', 'flex-wrap');
    expect(meta).not.toHaveClass('shrink-0');
    expect(meta.parentElement).toHaveClass('flex-col');
    expect(screen.getByText('cable-management')).toBeInTheDocument();
    expect(screen.getByText('U19')).toBeInTheDocument();
    expect(screen.getByText('19in')).toBeInTheDocument();
    expect(screen.getByText('front')).toBeInTheDocument();
  });

  it('opens the relevant collapsed section and focuses the depth field from Check', async () => {
    const { rerender } = render(<PropertyPanel />);
    expect(screen.queryByRole('spinbutton', { name: 'Depth mm' })).not.toBeInTheDocument();
    rerender(<PropertyPanel focusTarget={{ section: 'Dimensions & placement', field: 'Depth mm' }} />);
    expect(screen.getByRole('button', { name: 'Dimensions & placement' })).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Depth mm' })).toHaveFocus());
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Depth mm' }), { target: { value: '80' } });
    expect(useRackStore.getState().layout.devices[0].depthMm).toBe(80);
  });

  it('lets compact equipment use a printed mount and keeps the chosen model URL', () => {
    useRackStore.setState({ layout: { ...layout, devices: [{ ...layout.devices[0], category: 'router', widthType: 'shelf', customWidthMm: 150 }] } });
    render(<PropertyPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Dimensions & placement' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Mounting support' }), { target: { value: 'printed-mount' } });
    expect(screen.getByText('3D-printed mount')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Printed mount model URL' }), { target: { value: 'https://example.com/mount' } });
    expect(useRackStore.getState().layout.devices[0]).toMatchObject({ mountingSupport: 'printed-mount', printedMountUrl: 'https://example.com/mount', category: 'router', widthType: 'shelf' });
    expect(screen.getByRole('link', { name: 'Open bracket generator ↗' })).toHaveAttribute('href', 'https://leprachuan.github.io/rack-mount-generator/');
    fireEvent.change(screen.getByRole('combobox', { name: 'Mounting support' }), { target: { value: 'shelf' } });
    expect(screen.queryByText('3D-printed mount')).not.toBeInTheDocument();
    expect(useRackStore.getState().layout.devices[0].mountingSupport).toBe('shelf');
  });
});

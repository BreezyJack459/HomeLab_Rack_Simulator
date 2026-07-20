import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
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

  it('keeps selection metadata in its own stacked grid instead of forcing a side-by-side row', () => {
    render(<PropertyPanel />);

    const meta = screen.getByTestId('property-selection-meta');
    expect(meta).toHaveClass('grid', 'grid-cols-2');
    expect(meta).not.toHaveClass('shrink-0');
    expect(meta.parentElement).toHaveClass('flex-col');
    expect(screen.getByText('cable-management')).toBeInTheDocument();
    expect(screen.getByText('U19')).toBeInTheDocument();
    expect(screen.getByText('19in')).toBeInTheDocument();
    expect(screen.getByText('front')).toBeInTheDocument();
  });
});

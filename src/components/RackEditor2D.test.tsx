import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RackEditor2D } from './RackEditor2D';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';

const fullWidthLayout: RackLayout = {
  id: 'layout-full-width',
  name: 'Full Width Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  updatedAt: new Date().toISOString(),
  devices: [
    {
      id: 'dev-full-width',
      category: 'server',
      name: 'Full-width Server',
      mountSide: 'front',
      positionU: 4,
      sizeU: 4,
      xMm: 0,
      depthMm: 560,
      widthType: '19in',
      weightKg: 20,
      powerW: 300,
      heatLevel: 3,
      ports: { ethernet: 2, power: 2 },
      color: '#4f46e5',
    }
  ],
  cables: [],
  reservations: [],
};

describe('RackEditor2D frame sizing', () => {
  beforeEach(() => {
    const state = useRackStore.getState();
    useRackStore.setState({
      ...state,
      workspace: {
        ...state.workspace,
        racks: [fullWidthLayout],
        updatedAt: fullWidthLayout.updatedAt,
      },
      currentRackId: fullWidthLayout.id,
      layout: fullWidthLayout,
      selectedDeviceId: null,
      selectedCableId: null,
      selectedInterRackCableId: null,
      viewMode: '2d',
    });
  });

  it('keeps full-width 19-inch devices inside the rack frame width budget', () => {
    render(<RackEditor2D layoutOverride={fullWidthLayout} />);

    const rackFrame = screen.getByTestId('rack-frame');
    const device = screen.getByText('Full-width Server').closest('[data-device-id]');
    if (!(device instanceof HTMLElement)) {
      throw new Error('Expected full-width device card to render');
    }

    expect(rackFrame).toHaveStyle({ width: '592px' });
    expect(device).toHaveStyle({ left: '0px', width: '560px' });
  });
});

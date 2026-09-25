import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  let resizeCallback: ResizeObserverCallback | undefined;

  function triggerResize() {
    resizeCallback?.([], {} as ResizeObserver);
  }

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {
        if (resizeCallback === this.callback) resizeCallback = undefined;
      }
      unobserve() {}
    });
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
      editorZoom: 1,
      editorPan: { x: 0, y: 0 },
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

  for (const key of ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'z', 'y']) {
    it(`leaves ${key} to focused form controls`, () => {
      useRackStore.setState({ selectedDeviceId: fullWidthLayout.devices[0].id });
      render(<>
        <RackEditor2D layoutOverride={fullWidthLayout} />
        <input aria-label="Depth" type="number" defaultValue={560} />
        <textarea aria-label="Notes" />
        <select aria-label="Mount side"><option>Front</option></select>
        <div contentEditable suppressContentEditableWarning><span data-testid="editable-text">Device name</span></div>
      </>);
      const layoutBefore = useRackStore.getState().layout;
      for (const control of [screen.getByLabelText('Depth'), screen.getByLabelText('Notes'), screen.getByLabelText('Mount side'), screen.getByTestId('editable-text')]) {
        const event = new KeyboardEvent('keydown', { key, metaKey: key === 'z' || key === 'y', bubbles: true, cancelable: true });
        fireEvent(control, event);
        expect(event.defaultPrevented).toBe(false);
        expect(useRackStore.getState().layout).toBe(layoutBefore);
      }
    });
  }

  for (const key of ['Backspace', 'Delete']) {
    it(`still removes a selected rack device with ${key} outside form controls`, () => {
      useRackStore.setState({ selectedDeviceId: fullWidthLayout.devices[0].id });
      render(<RackEditor2D layoutOverride={fullWidthLayout} />);
      fireEvent.keyDown(screen.getByTestId('rack-editor-viewport'), { key });
      expect(useRackStore.getState().layout.devices).toHaveLength(0);
    });
  }

  it('uses the available canvas width and clamps manual scale', () => {
    render(<RackEditor2D layoutOverride={fullWidthLayout} />);
    const viewport = screen.getByTestId('rack-editor-viewport');
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 4000 });

    act(() => triggerResize());

    expect(useRackStore.getState().editorZoom).toBeCloseTo(((1000 - 64) * 0.95) / 592, 4);

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 10000 });
    act(() => triggerResize());
    expect(useRackStore.getState().editorZoom).toBe(1.8);

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 100 });
    act(() => triggerResize());
    expect(useRackStore.getState().editorZoom).toBe(0.45);
  });

  it('keeps the new shell rack free of repeated side-label cards', () => {
    const oneULayout: RackLayout = {
      ...fullWidthLayout,
      id: 'layout-side-label-fit',
      devices: [{ ...fullWidthLayout.devices[0], id: 'dev-one-u', sizeU: 1 }],
    };
    render(<RackEditor2D layoutOverride={oneULayout} />);
    const viewport = screen.getByTestId('rack-editor-viewport');
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 4000 });
    act(() => triggerResize());

    expect(screen.queryByTestId('rack-side-labels')).not.toBeInTheDocument();
    expect(useRackStore.getState().editorZoom).toBeCloseTo(((1000 - 64) * 0.95) / 592, 4);
  });

  it('stops automatic fitting after manual zoom and resumes it from the Fit control', () => {
    render(<RackEditor2D layoutOverride={fullWidthLayout} />);
    const viewport = screen.getByTestId('rack-editor-viewport');
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 4000 });
    act(() => triggerResize());

    fireEvent.click(screen.getByTitle('Zoom in'));
    const manualZoom = useRackStore.getState().editorZoom;
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 700 });
    act(() => triggerResize());
    expect(useRackStore.getState().editorZoom).toBe(manualZoom);

    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(useRackStore.getState().editorZoom).toBeCloseTo(((700 - 64) * 0.95) / 592, 4);
    expect(useRackStore.getState().editorPan).toEqual({ x: 0, y: 0 });
  });
});

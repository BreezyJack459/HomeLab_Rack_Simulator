import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRackStore } from '../store/rackStore';
import { ModelInspectorTabs } from './ModelInspectorTabs';

function renderTabs(
  selectionKind: 'device' | 'cable',
  selectionKey = `${selectionKind}-1`,
) {
  return render(
    <ModelInspectorTabs
      selectionKind={selectionKind}
      selectionKey={selectionKey}
      properties={<div>Property controls</div>}
      cables={<div>Cable controls</div>}
      ports={<div>Port controls</div>}
    />,
  );
}

describe('ModelInspectorTabs', () => {
  beforeEach(() => {
    useRackStore.setState({
      selectedDeviceId: 'device-1',
      selectedCableId: null,
      selectedInterRackCableId: null,
    });
  });

  it('defaults a device selection to Properties', () => {
    renderTabs('device');

    expect(screen.getByRole('tab', { name: 'Properties' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Properties' })).toBeVisible();
  });

  it('defaults a cable selection to Cables', () => {
    renderTabs('cable');

    expect(screen.getByRole('tab', { name: 'Cables' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Cables' })).toBeVisible();
  });

  it('supports arrow, Home, and End keyboard navigation', () => {
    renderTabs('device');
    const propertiesTab = screen.getByRole('tab', { name: 'Properties' });

    propertiesTab.focus();
    fireEvent.keyDown(propertiesTab, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Ports' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Ports' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Ports' }), {
      key: 'Home',
    });
    expect(propertiesTab).toHaveFocus();

    fireEvent.keyDown(propertiesTab, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Ports' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Ports' }), {
      key: 'ArrowRight',
    });
    expect(propertiesTab).toHaveFocus();
  });

  it('does not clear rack selection when changing tabs', () => {
    renderTabs('device');

    fireEvent.click(screen.getByRole('tab', { name: 'Ports' }));

    const state = useRackStore.getState();
    expect(state.selectedDeviceId).toBe('device-1');
    expect(state.selectedCableId).toBeNull();
    expect(screen.getByRole('tabpanel', { name: 'Ports' })).toBeVisible();
  });

  it('resets to the selection-appropriate tab when selection changes', () => {
    const { rerender } = renderTabs('device', 'device-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Ports' }));

    rerender(
      <ModelInspectorTabs
        selectionKind="cable"
        selectionKey="cable-2"
        properties={<div>Property controls</div>}
        cables={<div>Cable controls</div>}
        ports={<div>Port controls</div>}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Cables' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

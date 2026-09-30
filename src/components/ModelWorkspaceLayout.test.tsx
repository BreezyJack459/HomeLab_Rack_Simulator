import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import type { RackLayout } from '../types/rack';
import { ModelWorkspaceLayout } from './ModelWorkspaceLayout';

const layout = {
  id: 'layout-responsive-library',
  name: 'Responsive library',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  updatedAt: new Date().toISOString(),
  devices: [],
  cables: [],
  reservations: [],
} satisfies RackLayout;

function setViewportMode(isBelowLg: boolean) {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: isBelowLg,
    media: '(max-width: 1023px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('ModelWorkspaceLayout device library', () => {
  beforeEach(() => {
    setViewportMode(false);
    useLayoutPrefsStore.setState({ deviceLibraryOpen: true, deviceLibraryDrawerOpen: false });
  });

  it('keeps the library as a desktop grid column at lg', () => {
    render(<ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} />);

    const panel = screen.getByRole('complementary', { name: 'Device library' });
    expect(panel).toHaveClass('lg:static', 'lg:w-auto');
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(screen.getByText('Rack canvas')).toBeInTheDocument();
  });

  it('opens an accessible drawer below lg and closes it with the backdrop', () => {
    setViewportMode(true);
    useLayoutPrefsStore.setState({ deviceLibraryDrawerOpen: true });
    render(<ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} />);

    const drawer = screen.getByRole('dialog', { name: 'Device library' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveClass('fixed', 'lg:static');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close device library' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Close device library' })[0]);
    expect(screen.queryByRole('dialog', { name: 'Device library' })).not.toBeInTheDocument();
  });

  it('resizes with the keyboard and keeps width inside usable bounds', () => {
    render(<ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} />);
    const handle = screen.getByRole('separator', { name: 'Resize device library' });
    expect(handle).toHaveAttribute('aria-valuenow', '280');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '300');
    fireEvent.keyDown(handle, { key: 'Home' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle).toHaveAttribute('aria-valuenow', '240');
    fireEvent.keyDown(handle, { key: 'End' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '400');
  });

  it('preserves custom sidebar dimensions without a library resize handle', () => {
    render(<ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} sidebar={<div>Cable controls</div>} />);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByText('Cable controls')).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the control that opened it', () => {
    setViewportMode(true);
    useLayoutPrefsStore.setState({ deviceLibraryOpen: false, deviceLibraryDrawerOpen: false });
    const trigger = document.createElement('button');
    trigger.textContent = 'Library trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} />,
    );
    useLayoutPrefsStore.getState().setDeviceLibraryDrawerOpen(true);
    rerender(<ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} />);

    expect(screen.getAllByRole('button', { name: 'Close device library' })[1]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Device library' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('does not turn the saved desktop preference into an initial mobile modal', () => {
    setViewportMode(true);
    useLayoutPrefsStore.setState({ deviceLibraryOpen: true, deviceLibraryDrawerOpen: false });

    render(<ModelWorkspaceLayout layout={layout} canvas={<div>Rack canvas</div>} />);

    expect(screen.queryByRole('dialog', { name: 'Device library' })).not.toBeInTheDocument();
    expect(screen.getByText('Rack canvas')).toBeVisible();
  });
});

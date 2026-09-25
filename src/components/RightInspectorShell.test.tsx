import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RightInspectorShell } from './RightInspectorShell';
import { ModelInspectorTabs } from './ModelInspectorTabs';

const setViewportMode = (isBelowXl: boolean) => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: isBelowXl,
    media: '(max-width: 1279px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const renderInspector = (open: boolean, onToggle = vi.fn()) => {
  render(
    <RightInspectorShell
      title="Selected device"
      description="Device details"
      open={open}
      onToggle={onToggle}
    >
      <div>Inspector content</div>
      <button type="button">Last drawer action</button>
    </RightInspectorShell>,
  );
  return onToggle;
};

function StatefulInspector() {
  const [open, setOpen] = useState(false);
  return (
    <RightInspectorShell
      title="Selected device"
      description="Device details"
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <button type="button">Last drawer action</button>
    </RightInspectorShell>
  );
}

function StatefulTabbedInspector() {
  const [open, setOpen] = useState(true);
  return (
    <RightInspectorShell
      title="Selected device"
      description="Device details"
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <ModelInspectorTabs
        selectionKind="device"
        selectionKey="device-1"
        properties={<button type="button">Visible property action</button>}
        cables={<button type="button">Hidden cable action</button>}
        ports={<button type="button">Hidden port action</button>}
      />
    </RightInspectorShell>
  );
}

describe('RightInspectorShell', () => {
  beforeEach(() => setViewportMode(false));

  it('keeps the open inspector fixed below xl and restores the desktop grid item at xl', () => {
    renderInspector(true);

    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    expect(inspector).toHaveClass('fixed', 'inset-y-0', 'right-0', 'xl:static', 'xl:w-auto');
    expect(inspector).not.toHaveClass('hidden');
    expect(screen.getByText('Inspector content')).toBeInTheDocument();
  });

  it('provides a backdrop and close control for the mobile and tablet drawer', () => {
    setViewportMode(true);
    const onToggle = renderInspector(true);

    expect(screen.getByRole('dialog', { name: 'Inspector' })).toHaveAttribute('aria-modal', 'true');
    const backdrop = screen.getAllByRole('button', { name: 'Close inspector' })[0];
    expect(backdrop).toHaveClass('fixed', 'inset-0', 'xl:hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse inspector' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(backdrop);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('keeps accessible reopen controls for mobile/tablet and desktop when closed', () => {
    const onToggle = renderInspector(false);
    const reopenControls = screen.getAllByRole('button', { name: 'Open inspector' });

    expect(reopenControls).toHaveLength(2);
    expect(reopenControls[0]).toHaveClass('fixed', 'xl:hidden');
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toHaveClass(
      'hidden',
      'xl:flex',
      'xl:w-[72px]',
    );

    fireEvent.click(reopenControls[0]);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('contains keyboard focus, closes on Escape, and restores focus to the mobile trigger', () => {
    setViewportMode(true);
    render(<StatefulInspector />);

    const openButton = screen.getAllByRole('button', { name: 'Open inspector' })[0];
    fireEvent.click(openButton);

    const closeButton = screen.getByRole('button', { name: 'Collapse inspector' });
    expect(closeButton).toHaveFocus();

    const lastAction = screen.getByRole('button', { name: 'Last drawer action' });
    lastAction.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Inspector' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open inspector' })[0]).toHaveFocus();
  });

  it('traps focus around the active inspector tab without visiting hidden panels', () => {
    setViewportMode(true);
    render(<StatefulTabbedInspector />);

    const closeButton = screen.getByRole('button', { name: 'Collapse inspector' });
    const visibleAction = screen.getByRole('button', { name: 'Visible property action' });
    expect(screen.getByRole('button', { name: 'Hidden cable action', hidden: true })).not.toBeVisible();

    visibleAction.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(visibleAction).toHaveFocus();
  });
});

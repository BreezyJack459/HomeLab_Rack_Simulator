import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceContribution } from '../plugins/types';
import { ShellTopBar } from './ShellTopBar';

const operateWorkspace: WorkspaceContribution = {
  id: 'operate',
  title: 'Run ops',
  description: 'Track asset, maintenance and backup data',
  icon: null,
  nav: {
    label: 'Run',
    shortLabel: 'Ops',
    description: 'Track asset, maintenance and backup data',
    accent: 'from-emerald-500/25 to-teal-500/10',
  },
  lenses: [],
};

describe('ShellTopBar', () => {
  it('renders core workspace buttons by accessible name', () => {
    render(
      <ShellTopBar
        currentWorkspace="model"
        onSelectWorkspace={() => undefined}
        onOpenCommand={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /Build\s*Rack/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check\s*Health/ })).toBeInTheDocument();
  });

  it('places optional workspaces in Tools', () => {
    render(
      <ShellTopBar
        currentWorkspace="model"
        pluginWorkspaces={[operateWorkspace]}
        onSelectWorkspace={() => undefined}
        onOpenCommand={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: /Operations/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tools/ }));
    expect(screen.getByRole('button', { name: /Operations/ })).toBeInTheDocument();
  });

  it('fires onSelectWorkspace when a workspace button is clicked', () => {
    const onSelectWorkspace = vi.fn();
    render(
      <ShellTopBar
        currentWorkspace="model"
        pluginWorkspaces={[operateWorkspace]}
        onSelectWorkspace={onSelectWorkspace}
        onOpenCommand={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Check\s*Health/ }));
    expect(onSelectWorkspace).toHaveBeenCalledWith('audit');

    fireEvent.click(screen.getByRole('button', { name: /Tools/ }));
    fireEvent.click(screen.getByRole('button', { name: /Operations/ }));
    expect(onSelectWorkspace).toHaveBeenCalledWith('operate');
  });

  it('marks the current workspace with the active accent class', () => {
    render(
      <ShellTopBar
        currentWorkspace="audit"
        onSelectWorkspace={() => undefined}
        onOpenCommand={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /Check\s*Health/ })).toHaveClass('bg-accent-solid');
    expect(screen.getByRole('button', { name: /Build\s*Rack/ })).not.toHaveClass('bg-accent-solid');
  });
});

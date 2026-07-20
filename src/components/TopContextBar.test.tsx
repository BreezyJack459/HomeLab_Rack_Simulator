import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TopContextBar } from './TopContextBar';
import type { Workspace } from '../types/rack';

const workspace: Workspace = {
  id: 'workspace-1',
  name: 'Test Workspace',
  racks: [],
  interRackCables: [],
  updatedAt: new Date().toISOString(),
};

const layout = {
  id: 'rack-1',
  name: 'Core Rack',
  rackType: '19in' as const,
  heightU: 24,
  rackDepthMm: 800,
  weightLimitKg: 300,
  powerBudgetW: 3000,
  viewSide: 'front' as const,
  devices: [],
  cables: [],
  updatedAt: new Date().toISOString(),
};

describe('TopContextBar', () => {
  it('renders plugin toolbar action labels in the shell chrome', () => {
    const run = vi.fn();

    const markup = renderToStaticMarkup(
      <TopContextBar
        workspace={workspace}
        layout={layout}
        currentWorkspace="model"
        viewMode="2d"
        viewModes={[]}
        pluginToggles={[]}
        toolbarActions={[
          {
            id: 'cable.quick-open',
            label: 'Cable Planner',
            run,
          },
        ]}
        onOpenCommand={() => undefined}
        onRenameLayout={() => undefined}
        onToggleViewMode={() => undefined}
        onSetViewSide={() => undefined}
      />,
    );

    expect(markup).toContain('Cable Planner');
  });
});

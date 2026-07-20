import { describe, expect, it, vi } from 'vitest';
import type {
  InterRackCable,
  RackLayout,
  ValidationIssue,
  Workspace,
} from '../types/rack';
import {
  buildSearchItems,
  buildWorkspaceSearchItems,
} from './CommandPalette';

const runtimeRegistry = {
  viewModes: [
    { id: '2d', label: '2D Rack Editor', icon: null, order: 10, render: () => null },
    { id: '3d', label: '3D Inspection', icon: null, order: 20, render: () => null },
    { id: 'cables', label: 'Cable Map', icon: null, order: 30, render: () => null },
    { id: 'topology', label: 'Network Topology', icon: null, order: 40, render: () => null },
  ],
  commands: [],
} as const;

const mockLayout: RackLayout = {
  id: 'test-layout',
  name: 'Test Rack',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  updatedAt: new Date().toISOString(),
  devices: [
    {
      id: 'dev-switch',
      category: 'switch',
      name: 'Core Switch',
      mountSide: 'front',
      positionU: 1,
      sizeU: 1,
      depthMm: 300,
      widthType: '19in',
      weightKg: 5,
      powerW: 50,
      heatLevel: 2,
      ports: { ethernet: 24 },
      color: '#334155',
      portAliases: {
        'ethernet:0': 'ISP-IN',
      },
    },
  ],
  cables: [],
};

const mockLayout2: RackLayout = {
  id: 'test-layout-2',
  name: 'Garage Rack',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  updatedAt: new Date().toISOString(),
  devices: [
    {
      id: 'dev-router',
      category: 'router',
      name: 'Edge Router',
      mountSide: 'front',
      positionU: 2,
      sizeU: 1,
      depthMm: 250,
      widthType: '19in',
      weightKg: 3,
      powerW: 30,
      heatLevel: 2,
      ports: { ethernet: 4 },
      color: '#334155',
    },
  ],
  cables: [],
};

const mockInterRackCable: InterRackCable = {
  id: 'irc-1',
  fromRackId: 'test-layout',
  fromDeviceId: 'dev-switch',
  fromPort: { type: 'ethernet', index: 0 },
  toRackId: 'test-layout-2',
  toDeviceId: 'dev-router',
  toPort: { type: 'ethernet', index: 0 },
  type: 'cat6a',
  lengthM: 10,
  label: 'Main-to-Garage',
};

const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'Test Workspace',
  racks: [mockLayout, mockLayout2],
  interRackCables: [mockInterRackCable],
  updatedAt: new Date().toISOString(),
};

const mockIssues: ValidationIssue[] = [];

describe('CommandPalette helper registry wiring', () => {
  it('includes runtime command items as quick actions', () => {
    const items = buildSearchItems(mockLayout, mockIssues, {
      ...runtimeRegistry,
      commands: [
        {
          id: 'plugin.toggle',
          title: 'Toggle Plugin',
          subtitle: 'Enable or disable a plugin',
          category: 'Plugins',
          run: vi.fn(),
        },
      ],
    });

    const quickActionItems = items.filter((item) => item.type === 'quick-action');
    expect(quickActionItems).toHaveLength(1);
    expect(quickActionItems[0].title).toBe('Toggle Plugin');
    expect(quickActionItems[0].category).toBe('Plugins');
  });

  it('includes runtime view modes once across the workspace index', () => {
    const items = buildWorkspaceSearchItems(
      mockWorkspace,
      'test-layout',
      runtimeRegistry,
    );

    const viewItems = items.filter((item) => item.type === 'view');
    expect(viewItems).toHaveLength(4);
    expect(viewItems.map((item) => item.title)).toContain('Cable Map');
    expect(viewItems.map((item) => item.title)).toContain('Network Topology');
  });

  it('omits cable map when the runtime registry excludes cable views', () => {
    const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout', {
      viewModes: runtimeRegistry.viewModes.slice(0, 2),
      commands: [],
    });

    expect(items.some((item) => item.title === 'Cable Map')).toBe(false);
  });
});

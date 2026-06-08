import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RackLayout, ValidationIssue, Workspace, InterRackCable } from '../types/rack';
import {
  buildSearchItems,
  buildWorkspaceSearchItems,
  filterItems,
  getDeviceName,
  getCableLabel,
  CommandPalette
} from './CommandPalette';
import { useRackStore } from '../store/rackStore';

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
        'ethernet:1': 'WAN-LINK'
      }
    },
    {
      id: 'dev-server',
      category: 'server',
      name: 'Web Server',
      mountSide: 'front',
      positionU: 3,
      sizeU: 2,
      depthMm: 400,
      widthType: '19in',
      weightKg: 8,
      powerW: 100,
      heatLevel: 3,
      ports: { ethernet: 2 },
      color: '#475569'
    }
  ],
  cables: [
    {
      id: 'cable-1',
      fromDeviceId: 'dev-switch',
      toDeviceId: 'dev-server',
      type: 'ethernet',
      color: '#3b82f6',
      length: '1m'
    }
  ],
  reservations: [
    {
      id: 'res-1',
      name: 'Future NAS',
      positionU: 5,
      sizeU: 2,
      mountSide: 'front',
      widthType: '19in',
      purpose: 'future-device'
    }
  ]
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
      positionU: 1,
      sizeU: 1,
      depthMm: 250,
      widthType: '19in',
      weightKg: 3,
      powerW: 30,
      heatLevel: 2,
      ports: { ethernet: 4 },
      color: '#334155'
    }
  ],
  cables: []
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
  label: 'Main-to-Garage'
};

const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'Test Workspace',
  racks: [mockLayout, mockLayout2],
  interRackCables: [mockInterRackCable],
  updatedAt: new Date().toISOString()
};

const mockIssues: ValidationIssue[] = [
  {
    id: 'issue-1',
    severity: 'warning',
    title: 'Weight limit exceeded',
    detail: 'Total weight exceeds rack limit',
    deviceIds: ['dev-server']
  }
];

describe('CommandPalette helpers', () => {
  describe('getDeviceName', () => {
    it('returns device name when found', () => {
      expect(getDeviceName(mockLayout, 'dev-switch')).toBe('Core Switch');
    });

    it('returns truncated id when not found', () => {
      expect(getDeviceName(mockLayout, 'nonexistent')).toBe('nonexist');
    });
  });

  describe('getCableLabel', () => {
    it('formats cable label with device names', () => {
      const label = getCableLabel(mockLayout.cables[0], mockLayout);
      expect(label).toBe('Core Switch → Web Server');
    });
  });

  describe('buildSearchItems', () => {
    it('creates device search items', () => {
      const items = buildSearchItems(mockLayout, []);
      const deviceItems = items.filter((i) => i.type === 'device' && i.id.startsWith('device-'));
      expect(deviceItems).toHaveLength(2);
      expect(deviceItems[0].title).toBe('Core Switch');
      expect(deviceItems[0].subtitle).toContain('switch');
      expect(deviceItems[0].subtitle).toContain('U1');
    });

    it('creates cable search items', () => {
      const items = buildSearchItems(mockLayout, []);
      const cableItems = items.filter((i) => i.type === 'cable');
      expect(cableItems).toHaveLength(1);
      expect(cableItems[0].title).toBe('Core Switch → Web Server');
      expect(cableItems[0].subtitle).toContain('ethernet');
      expect(cableItems[0].subtitle).toContain('1m');
    });

    it('creates issue search items', () => {
      const items = buildSearchItems(mockLayout, mockIssues);
      const issueItems = items.filter((i) => i.type === 'issue');
      expect(issueItems).toHaveLength(1);
      expect(issueItems[0].title).toBe('Weight limit exceeded');
    });

    it('creates reservation search items', () => {
      const items = buildSearchItems(mockLayout, []);
      const resItems = items.filter((i) => i.id.startsWith('reservation-'));
      expect(resItems).toHaveLength(1);
      expect(resItems[0].title).toBe('Future NAS');
    });

    it('creates view mode search items', () => {
      const items = buildSearchItems(mockLayout, []);
      const viewItems = items.filter((i) => i.type === 'view');
      expect(viewItems).toHaveLength(4);
      expect(viewItems.map((v) => v.title)).toContain('2D Rack Editor');
      expect(viewItems.map((v) => v.title)).toContain('3D Inspection');
    });

    it('creates quick action items', () => {
      const items = buildSearchItems(mockLayout, []);
      const actionItems = items.filter((i) => i.type === 'action');
      expect(actionItems).toHaveLength(1);
      expect(actionItems[0].title).toBe('Export Layout JSON');
    });

    it('groups items by category', () => {
      const items = buildSearchItems(mockLayout, mockIssues);
      const categories = new Set(items.map((i) => i.category));
      expect(categories.has('Devices')).toBe(true);
      expect(categories.has('Cables')).toBe(true);
      expect(categories.has('Issues')).toBe(true);
      expect(categories.has('Reservations')).toBe(true);
      expect(categories.has('Views')).toBe(true);
      expect(categories.has('Actions')).toBe(true);
    });
  });

  describe('buildWorkspaceSearchItems', () => {
    it('indexes devices from all racks', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const deviceItems = items.filter((i) => i.type === 'device' && i.id.includes('dev-'));
      expect(deviceItems).toHaveLength(3);
      expect(deviceItems.some((d) => d.title.includes('Core Switch'))).toBe(true);
      expect(deviceItems.some((d) => d.title.includes('Edge Router'))).toBe(true);
    });

    it('includes rack name in device titles', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const routerItem = items.find((i) => i.id.includes('dev-router'));
      expect(routerItem).toBeDefined();
      expect(routerItem!.title).toContain('(Garage Rack)');
      expect(routerItem!.rackName).toBe('Garage Rack');
    });

    it('indexes cables from all racks', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const cableItems = items.filter((i) => i.type === 'cable');
      expect(cableItems).toHaveLength(1);
      expect(cableItems[0].title).toBe('Core Switch → Web Server');
    });

    it('indexes port aliases', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const aliasItems = items.filter((i) => i.type === 'port-alias');
      expect(aliasItems).toHaveLength(2);
      expect(aliasItems.some((a) => a.title.includes('ISP-IN'))).toBe(true);
      expect(aliasItems.some((a) => a.title.includes('WAN-LINK'))).toBe(true);
    });

    it('indexes inter-rack cables', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const ircItems = items.filter((i) => i.type === 'inter-rack-cable');
      expect(ircItems).toHaveLength(1);
      expect(ircItems[0].title).toContain('Test Rack:Core Switch:ethernet:0');
      expect(ircItems[0].title).toContain('Garage Rack:Edge Router:ethernet:0');
      expect(ircItems[0].subtitle).toContain('cat6a');
      expect(ircItems[0].subtitle).toContain('10m');
    });

    it('indexes issues from all racks', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const issueItems = items.filter((i) => i.type === 'issue');
      expect(issueItems.length).toBeGreaterThanOrEqual(1);
    });

    it('wraps cross-rack actions with switchRack', () => {
      const switchRackSpy = vi.spyOn(useRackStore.getState(), 'switchRack').mockImplementation(() => {});
      const selectDeviceSpy = vi.spyOn(useRackStore.getState(), 'selectDevice').mockImplementation(() => {});

      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const routerItem = items.find((i) => i.id.includes('dev-router'));
      expect(routerItem).toBeDefined();
      routerItem!.action();

      expect(switchRackSpy).toHaveBeenCalledWith('test-layout-2');
      expect(selectDeviceSpy).toHaveBeenCalledWith('dev-router');

      switchRackSpy.mockRestore();
      selectDeviceSpy.mockRestore();
    });

    it('does not switch rack for current rack items', () => {
      const switchRackSpy = vi.spyOn(useRackStore.getState(), 'switchRack').mockImplementation(() => {});
      const selectDeviceSpy = vi.spyOn(useRackStore.getState(), 'selectDevice').mockImplementation(() => {});

      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const switchItem = items.find((i) => i.id.includes('dev-switch'));
      expect(switchItem).toBeDefined();
      switchItem!.action();

      expect(switchRackSpy).not.toHaveBeenCalled();
      expect(selectDeviceSpy).toHaveBeenCalledWith('dev-switch');

      switchRackSpy.mockRestore();
      selectDeviceSpy.mockRestore();
    });

    it('includes global views and actions once', () => {
      const items = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const viewItems = items.filter((i) => i.type === 'view');
      const actionItems = items.filter((i) => i.type === 'action');
      expect(viewItems).toHaveLength(4);
      expect(actionItems).toHaveLength(1);
    });
  });

  describe('filterItems', () => {
    const items = buildSearchItems(mockLayout, mockIssues);

    it('returns all items when query is empty', () => {
      expect(filterItems(items, '').length).toBe(items.length);
    });

    it('filters by device name', () => {
      const filtered = filterItems(items, 'Core');
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((i) => i.title.toLowerCase().includes('core') || i.subtitle.toLowerCase().includes('core'))).toBe(true);
    });

    it('filters by cable type', () => {
      const filtered = filterItems(items, 'ethernet');
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((i) => i.type === 'cable')).toBe(true);
    });

    it('filters by issue title', () => {
      const filtered = filterItems(items, 'weight');
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((i) => i.type === 'issue')).toBe(true);
    });

    it('filters port aliases by alias name', () => {
      const wsItems = buildWorkspaceSearchItems(mockWorkspace, 'test-layout');
      const filtered = filterItems(wsItems, 'ISP-IN');
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((i) => i.type === 'port-alias')).toBe(true);
    });

    it('returns empty array for non-matching query', () => {
      expect(filterItems(items, 'xyznonexistent')).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      const lower = filterItems(items, 'core');
      const upper = filterItems(items, 'CORE');
      expect(lower.length).toBe(upper.length);
    });
  });
});

describe('CommandPalette component', () => {
  beforeEach(() => {
    useRackStore.setState({
      workspace: mockWorkspace,
      currentRackId: 'test-layout',
      layout: mockLayout,
      viewMode: '2d',
      selectedDeviceId: null,
      selectedCableId: null,
      selectedInterRackCableId: null
    } as ReturnType<typeof useRackStore.getState>);
  });

  it('renders when open', () => {
    render(<CommandPalette open={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search tasks, devices, cables, settings...')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<CommandPalette open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('displays search results from all racks', () => {
    render(<CommandPalette open={true} onClose={() => {}} />);
    expect(screen.getByText('Core Switch')).toBeTruthy();
    expect(screen.getByText('Web Server')).toBeTruthy();
    expect(screen.getByText('Edge Router (Garage Rack)')).toBeTruthy();
  });

  it('filters results when typing', () => {
    render(<CommandPalette open={true} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search tasks, devices, cables, settings...');
    fireEvent.change(input, { target: { value: 'Core' } });
    expect(screen.getByText('Core Switch')).toBeTruthy();
    expect(screen.queryByText('Web Server')).toBeNull();
  });

  it('shows port aliases in search results', () => {
    render(<CommandPalette open={true} onClose={() => {}} />);
    expect(screen.getByText('ISP-IN')).toBeTruthy();
    expect(screen.getByText('WAN-LINK')).toBeTruthy();
  });

  it('shows inter-rack cables in search results', () => {
    render(<CommandPalette open={true} onClose={() => {}} />);
    expect(screen.getByText('Test Rack:Core Switch:ethernet:0 → Garage Rack:Edge Router:ethernet:0')).toBeTruthy();
  });

  it('shows no results message for non-matching query', () => {
    render(<CommandPalette open={true} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search tasks, devices, cables, settings...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('executes action and closes on Enter', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking an item executes its action', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    const item = screen.getByText('Core Switch');
    fireEvent.click(item);
    expect(onClose).toHaveBeenCalled();
  });
});

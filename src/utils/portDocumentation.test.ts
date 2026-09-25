import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import {
  exportSwitchPortDocumentationCsv,
  getSwitchPortDocumentation,
  mergePortLabelDrafts,
} from './portDocumentation';

const makeDevice = (
  overrides: Partial<PlacedDevice> = {},
): PlacedDevice => ({
  id: 'switch-1',
  category: 'switch',
  name: 'Core Switch',
  positionU: 1,
  sizeU: 1,
  depthMm: 300,
  widthType: '19in',
  weightKg: 5,
  powerW: 50,
  heatLevel: 2,
  color: '#334155',
  ports: { ethernet: 2, fiber: 1 },
  ...overrides,
});

const makeLayout = (): RackLayout => ({
  id: 'rack-1',
  name: 'Lab Rack',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  devices: [
    makeDevice({ portAliases: { eth0: 'AP-LIVING' } }),
    makeDevice({
      id: 'ap-1',
      category: 'access-point',
      name: 'Living Room AP',
      label: 'AP-01',
      ports: { ethernet: 1 },
      portAliases: { 'ethernet:0': 'UPLINK' },
    }),
  ],
  cables: [
    {
      id: 'cable-1',
      fromDeviceId: 'switch-1',
      fromPort: { type: 'ethernet', index: 0 },
      toDeviceId: 'ap-1',
      toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet',
      color: '#3b82f6',
    },
  ],
  updatedAt: '2026-07-29T00:00:00.000Z',
});

describe('switch port documentation', () => {
  it('combines saved aliases with connected cable endpoints', () => {
    const layout = makeLayout();
    const rows = getSwitchPortDocumentation(layout, layout.devices[0]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: 'ethernet:0',
      label: 'AP-LIVING',
      portName: 'Ethernet 1',
    });
    expect(rows[0].connections[0]).toMatchObject({
      cableId: 'cable-1',
      peerDeviceName: 'Living Room AP',
      peerDeviceLabel: 'AP-01',
      peerPortAlias: 'UPLINK',
    });
    expect(rows[0].suggestedLabel).toBe('AP-01 / UPLINK');
    expect(rows[1].connections).toEqual([]);
  });

  it('updates existing alias key formats without leaving duplicates', () => {
    const device = makeDevice({
      portAliases: {
        'ethernet:0': 'OLD',
        eth0: 'DUPLICATE',
        custom: 'KEEP',
      },
    });
    const layout = { ...makeLayout(), devices: [device] };
    const rows = getSwitchPortDocumentation(layout, device);
    const aliases = mergePortLabelDrafts(device, rows, {
      'ethernet:0': 'NEW LABEL',
      'ethernet:1': '',
      'fiber:0': '',
    });

    expect(aliases).toEqual({
      'ethernet:0': 'NEW LABEL',
      custom: 'KEEP',
    });
  });

  it('exports physical labels and connection details as escaped CSV', () => {
    const layout = makeLayout();
    const device = {
      ...layout.devices[0],
      name: 'Core, Switch',
    };
    const csv = exportSwitchPortDocumentationCsv(layout, device);

    expect(csv).toContain(
      'Switch,Switch Label,Port,Face,Port Label,Status,Connected Device',
    );
    expect(csv).toContain('"Core, Switch"');
    expect(csv).toContain('AP-LIVING');
    expect(csv).toContain('Living Room AP');
    expect(csv).toContain('cable-1');
  });
});

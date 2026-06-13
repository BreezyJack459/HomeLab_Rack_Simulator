import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { autoWireLayout } from './autoWire';

function layoutWith(devices: PlacedDevice[]): RackLayout {
  return {
    id: 'layout-1',
    name: 'Test',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1000,
    viewSide: 'front',
    devices,
    cables: [],
    updatedAt: new Date().toISOString()
  };
}

function makeDevice(
  id: string,
  category: string,
  positionU: number,
  ports: Record<string, number>
): PlacedDevice {
  return {
    id,
    category: category as PlacedDevice['category'],
    name: id,
    positionU,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 5,
    powerW: 50,
    heatLevel: 2,
    ports,
    color: '#ccc'
  } as PlacedDevice;
}

describe('autoWireLayout', () => {
  it('wires a server to a PDU and a switch', () => {
    const pdu = makeDevice('pdu', 'pdu', 1, { power: 8 });
    const sw = makeDevice('sw', 'switch', 6, { ethernet: 8 });
    const server = makeDevice('srv', 'server', 8, { power: 1, ethernet: 2 });
    const layout = layoutWith([pdu, sw, server]);
    const result = autoWireLayout(layout);
    expect(result.created).toBe(2);
    expect(result.cables.some((c) => c.type === 'power')).toBe(true);
    expect(result.cables.some((c) => c.type === 'ethernet')).toBe(true);
  });

  it('wires a switch to a patch panel', () => {
    const sw = makeDevice('sw', 'switch', 2, { ethernet: 8 });
    const patch = makeDevice('patch', 'patch-panel', 6, { ethernet: 24 });
    const layout = layoutWith([sw, patch]);
    const result = autoWireLayout(layout);
    expect(result.created).toBe(1);
    expect(result.cables[0].type).toBe('patch');
  });

  it('skips duplicate cables', () => {
    const pdu = makeDevice('pdu', 'pdu', 1, { power: 8 });
    const server = makeDevice('srv', 'server', 8, { power: 1 });
    const layout = layoutWith([pdu, server]);
    layout.cables = [
      {
        id: 'existing',
        fromDeviceId: server.id,
        toDeviceId: pdu.id,
        type: 'power',
        color: '#fb923c'
      }
    ];
    const result = autoWireLayout(layout);
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('does nothing when no infrastructure is present', () => {
    const server = makeDevice('srv', 'server', 8, { power: 1, ethernet: 2 });
    const layout = layoutWith([server]);
    const result = autoWireLayout(layout);
    expect(result.created).toBe(0);
  });

  it('respects connectPower and connectNetwork options', () => {
    const pdu = makeDevice('pdu', 'pdu', 1, { power: 8 });
    const sw = makeDevice('sw', 'switch', 6, { ethernet: 8 });
    const server = makeDevice('srv', 'server', 8, { power: 1, ethernet: 2 });
    const layout = layoutWith([pdu, sw, server]);
    expect(autoWireLayout(layout, { connectPower: false }).created).toBe(1);
    expect(autoWireLayout(layout, { connectNetwork: false }).created).toBe(1);
  });
});

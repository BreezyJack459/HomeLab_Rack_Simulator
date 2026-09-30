import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout, Workspace } from '../types/rack';
import { analyzeBlastRadius } from './blastRadius';

function createLayout(devices: RackLayout['devices'], cables: RackLayout['cables'] = []): RackLayout {
  return {
    id: 'test',
    name: 'Test',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1200,
    viewSide: 'front',
    devices,
    cables,
    updatedAt: new Date().toISOString()
  };
}

describe('analyzeBlastRadius', () => {
  const make = (id: string, category: PlacedDevice['category']): PlacedDevice => ({ id, name: id, category,
    positionU: 1, sizeU: 1, depthMm: 100, widthType: '19in', weightKg: 1, powerW: 10, heatLevel: 1, color: '#333' });

  it('resolves reverse-picked supply paths and preserves a surviving second feed', () => {
    const layout = createLayout([make('a', 'pdu'), make('b', 'pdu'), make('single', 'server'), make('dual', 'server')], [
      { id: 'reverse', type: 'power', fromDeviceId: 'single', toDeviceId: 'a', color: '#333' },
      { id: 'a-dual', type: 'power', fromDeviceId: 'dual', toDeviceId: 'a', color: '#333' },
      { id: 'b-dual', type: 'power', fromDeviceId: 'b', toDeviceId: 'dual', color: '#333' },
    ]);
    const before = JSON.stringify(layout);
    const result = analyzeBlastRadius(layout, 'a')!;
    expect(result.directlyImpacted.map(d => d.deviceId)).toEqual(['single']);
    expect(result.retainedPower.map(d => d.name)).toContain('Test / dual');
    expect(analyzeBlastRadius(layout, 'single')!.upstreamDependencies).toContainEqual({ deviceId: 'a', deviceName: 'a', type: 'power' });
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('traces supply and restart dependencies beyond the old five-hop limit', () => {
    const supplies = Array.from({ length: 7 }, (_, i) => make(`pdu-${i}`, 'pdu'));
    const layout = createLayout([...supplies, { ...make('load', 'server'), bootDependsOn: ['boot-5'] },
      ...Array.from({ length: 6 }, (_, i) => ({ ...make(`boot-${i}`, 'server'), bootDependsOn: [i === 0 ? 'pdu-0' : `boot-${i - 1}`] })),
    ], supplies.map((d, i) => ({ id: `power-${i}`, fromDeviceId: d.id, toDeviceId: i < 6 ? supplies[i + 1].id : 'load', powerSourceDeviceId: d.id, type: 'power', color: '#333' })));
    const result = analyzeBlastRadius(layout, 'pdu-0')!;
    expect(result.impactBreakdown.power).toBe(7);
    expect(result.impactBreakdown.boot).toBe(7);
    expect(result.indirectlyImpacted.find(d => d.deviceId === 'load')).toMatchObject({ impactType: 'power', distance: 7 });
  });

  it('uses rack-scoped identities for remote PoE supply loss and excludes unrelated same-id devices', () => {
    const local = createLayout([make('pdu', 'pdu'), { ...make('pse', 'switch'), ports: { ethernet: 1 }, poeBudgetW: 30,
      portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pse', poeLimitW: 30, poeProfile: 'pair' } } }, make('receiver', 'server')],
      [{ id: 'feed', type: 'power', fromDeviceId: 'pse', toDeviceId: 'pdu', color: '#333' }]);
    const remote = { ...createLayout([{ ...make('receiver', 'server'), ports: { ethernet: 1 }, portFaceOverrides: { ethernet: 'front' as const },
      portConnectionSpecs: { 'ethernet:front:0': { poeRole: 'pd' as const, poeRequiredW: 10, poeProfile: 'pair' } } }]), id: 'remote', name: 'Remote' };
    const workspace: Workspace = { id: 'w', name: 'Workspace', updatedAt: '', racks: [local, remote], interRackCables: [{ id: 'poe', type: 'cat6a', poe: true,
      fromRackId: local.id, fromDeviceId: 'pse', fromPort: { type: 'ethernet', index: 0, side: 'front' },
      toRackId: remote.id, toDeviceId: 'receiver', toPort: { type: 'ethernet', index: 0, side: 'front' } }] };
    const result = analyzeBlastRadius(local, 'pdu', workspace)!;
    expect(result.impactBreakdown.power).toBe(2);
    expect(result.indirectlyImpacted).toContainEqual(expect.objectContaining({ deviceId: 'receiver', rackId: 'remote', impactType: 'power', distance: 2 }));
    expect([...result.directlyImpacted, ...result.indirectlyImpacted].filter(d => d.deviceId === 'receiver')).toHaveLength(1);
    expect(analyzeBlastRadius(remote, 'receiver', workspace)!.upstreamDependencies).toContainEqual({ deviceId: 'pse', rackId: local.id, deviceName: 'Test / pse', type: 'power' });
  });

  it('does not promote an invalid downstream supply to a live root', () => {
    const layout = createLayout([{ ...make('up', 'ups'), portConnectionSpecs: { 'power:rear:0': { role: 'output', powerKind: 'ac', nominalVoltageV: 120 } } },
      { ...make('down', 'pdu'), portConnectionSpecs: { 'power:rear:0': { role: 'input', powerKind: 'ac', nominalVoltageV: 230 } } }, make('load', 'server')], [
      { id: 'bad', type: 'power', fromDeviceId: 'up', toDeviceId: 'down', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index: 0 }, color: '#333' },
      { id: 'out', type: 'power', fromDeviceId: 'down', toDeviceId: 'load', color: '#333' },
    ]);
    const result = analyzeBlastRadius(layout, 'down')!;
    expect(result.impactBreakdown.power).toBe(0);
    expect(result.untracedPower.map(d => d.name)).toContain('Test / load');
    expect(result.warnings.join(' ')).toContain('voltages differ');
  });
  it('returns null for non-existent device', () => {
    const layout = createLayout([]);
    expect(analyzeBlastRadius(layout, 'nonexistent')).toBeNull();
  });

  it('returns zero impact for isolated device', () => {
    const layout = createLayout([
      { id: 'd1', category: 'server', name: 'Server', positionU: 1, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 5, powerW: 100, heatLevel: 2, color: '#ccc' }
    ]);
    const result = analyzeBlastRadius(layout, 'd1');
    expect(result).not.toBeNull();
    expect(result!.totalAffected).toBe(0);
    expect(result!.criticalityScore).toBe(5);
    expect(result!.upstreamDependencies).toHaveLength(0);
  });

  it('traces power downstream from UPS', () => {
    const layout = createLayout(
      [
        { id: 'ups', category: 'ups', name: 'UPS', positionU: 1, sizeU: 2, depthMm: 450, widthType: '19in', weightKg: 20, powerW: 0, heatLevel: 2, color: '#f59e0b' },
        { id: 'pdu', category: 'pdu', name: 'PDU', positionU: 3, sizeU: 1, depthMm: 100, widthType: '19in', weightKg: 3, powerW: 0, heatLevel: 1, color: '#64748b' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 4, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' }
      ],
      [
        { id: 'c1', fromDeviceId: 'ups', toDeviceId: 'pdu', type: 'power', color: '#000' },
        { id: 'c2', fromDeviceId: 'pdu', toDeviceId: 'srv', type: 'power', color: '#000' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'ups');
    expect(result).not.toBeNull();
    expect(result!.impactBreakdown.power).toBe(2);
    expect(result!.totalAffected).toBe(2);
    expect(result!.directlyImpacted).toHaveLength(1); // PDU
    expect(result!.indirectlyImpacted).toHaveLength(1); // Server
    expect(result!.upstreamDependencies).toHaveLength(0);
  });

  it('traces power downstream from PDU', () => {
    const layout = createLayout(
      [
        { id: 'ups', category: 'ups', name: 'UPS', positionU: 1, sizeU: 2, depthMm: 450, widthType: '19in', weightKg: 20, powerW: 0, heatLevel: 2, color: '#f59e0b' },
        { id: 'pdu', category: 'pdu', name: 'PDU', positionU: 3, sizeU: 1, depthMm: 100, widthType: '19in', weightKg: 3, powerW: 0, heatLevel: 1, color: '#64748b' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 4, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' }
      ],
      [
        { id: 'c1', fromDeviceId: 'ups', toDeviceId: 'pdu', type: 'power', color: '#000' },
        { id: 'c2', fromDeviceId: 'pdu', toDeviceId: 'srv', type: 'power', color: '#000' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'pdu');
    expect(result).not.toBeNull();
    expect(result!.impactBreakdown.power).toBe(1);
    expect(result!.directlyImpacted[0].deviceId).toBe('srv');
  });

  it('traces network impact from switch', () => {
    const layout = createLayout(
      [
        { id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'srv1', category: 'server', name: 'Server 1', positionU: 2, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' },
        { id: 'srv2', category: 'server', name: 'Server 2', positionU: 3, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' }
      ],
      [
        { id: 'c1', fromDeviceId: 'sw', toDeviceId: 'srv1', type: 'ethernet', color: '#3b82f6' },
        { id: 'c2', fromDeviceId: 'sw', toDeviceId: 'srv2', type: 'ethernet', color: '#3b82f6' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'sw');
    expect(result).not.toBeNull();
    expect(result!.impactBreakdown.network).toBe(2);
    expect(result!.directlyImpacted).toHaveLength(2);
    expect(result!.indirectlyImpacted).toHaveLength(0);
  });

  it('traces boot dependency impact', () => {
    const layout = createLayout(
      [
        { id: 'router', category: 'router', name: 'Router', positionU: 1, sizeU: 1, depthMm: 200, widthType: '19in', weightKg: 2, powerW: 20, heatLevel: 1, color: '#8b5cf6' },
        { id: 'nas', category: 'nas', name: 'NAS', positionU: 2, sizeU: 1, depthMm: 300, widthType: '19in', weightKg: 5, powerW: 80, heatLevel: 2, color: '#10b981', bootDependsOn: ['router'] },
        { id: 'srv', category: 'server', name: 'Server', positionU: 3, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444', bootDependsOn: ['nas'] }
      ]
    );
    const result = analyzeBlastRadius(layout, 'router');
    expect(result).not.toBeNull();
    expect(result!.impactBreakdown.boot).toBe(2);
    expect(result!.directlyImpacted[0].deviceId).toBe('nas');
    expect(result!.indirectlyImpacted[0].deviceId).toBe('srv');
  });

  it('reports upstream power dependency', () => {
    const layout = createLayout(
      [
        { id: 'ups', category: 'ups', name: 'UPS', positionU: 1, sizeU: 2, depthMm: 450, widthType: '19in', weightKg: 20, powerW: 0, heatLevel: 2, color: '#f59e0b' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 4, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' }
      ],
      [
        { id: 'c1', fromDeviceId: 'ups', toDeviceId: 'srv', type: 'power', color: '#000' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'srv');
    expect(result).not.toBeNull();
    expect(result!.upstreamDependencies).toHaveLength(1);
    expect(result!.upstreamDependencies[0].deviceId).toBe('ups');
    expect(result!.upstreamDependencies[0].type).toBe('power');
  });

  it('reports upstream network dependency', () => {
    const layout = createLayout(
      [
        { id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 2, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' }
      ],
      [
        { id: 'c1', fromDeviceId: 'sw', toDeviceId: 'srv', type: 'ethernet', color: '#3b82f6' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'srv');
    expect(result).not.toBeNull();
    expect(result!.upstreamDependencies.some((d) => d.type === 'network' && d.deviceId === 'sw')).toBe(true);
  });

  it('reports upstream boot dependency', () => {
    const layout = createLayout(
      [
        { id: 'router', category: 'router', name: 'Router', positionU: 1, sizeU: 1, depthMm: 200, widthType: '19in', weightKg: 2, powerW: 20, heatLevel: 1, color: '#8b5cf6' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 2, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444', bootDependsOn: ['router'] }
      ]
    );
    const result = analyzeBlastRadius(layout, 'srv');
    expect(result).not.toBeNull();
    expect(result!.upstreamDependencies.some((d) => d.type === 'boot' && d.deviceId === 'router')).toBe(true);
  });

  it('deduplicates when device is affected by multiple impact types', () => {
    const layout = createLayout(
      [
        { id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 2, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444', bootDependsOn: ['sw'] }
      ],
      [
        { id: 'c1', fromDeviceId: 'sw', toDeviceId: 'srv', type: 'ethernet', color: '#3b82f6' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'sw');
    expect(result).not.toBeNull();
    // Server is affected by both network and boot — should count once in total
    expect(result!.totalAffected).toBe(1);
    // Power should take priority
    expect(result!.directlyImpacted[0].impactType).toBe('network');
  });

  it('calculates criticality score based on impact count', () => {
    const devices = Array.from({ length: 10 }, (_, i) => ({
      id: `srv${i}`,
      category: 'server' as const,
      name: `Server ${i}`,
      positionU: i + 2,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in' as const,
      weightKg: 8,
      powerW: 200,
      heatLevel: 3 as const,
      color: '#ef4444'
    }));
    const layout = createLayout(
      [
        { id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2 as const, color: '#3b82f6' },
        ...devices
      ],
      devices.map((d) => ({ id: `c-${d.id}`, fromDeviceId: 'sw', toDeviceId: d.id, type: 'ethernet' as const, color: '#3b82f6' }))
    );
    const result = analyzeBlastRadius(layout, 'sw');
    expect(result).not.toBeNull();
    expect(result!.impactBreakdown.network).toBe(10);
    // Score = 5 + 10 * 6 = 65
    expect(result!.criticalityScore).toBe(65);
  });

  it('caps criticality score at 100', () => {
    const devices = Array.from({ length: 30 }, (_, i) => ({
      id: `srv${i}`,
      category: 'server' as const,
      name: `Server ${i}`,
      positionU: i + 2,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in' as const,
      weightKg: 8,
      powerW: 200,
      heatLevel: 3 as const,
      color: '#ef4444'
    }));
    const layout = createLayout(
      [
        { id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2 as const, color: '#3b82f6' },
        ...devices
      ],
      devices.map((d) => ({ id: `c-${d.id}`, fromDeviceId: 'sw', toDeviceId: d.id, type: 'ethernet' as const, color: '#3b82f6' }))
    );
    const result = analyzeBlastRadius(layout, 'sw');
    expect(result).not.toBeNull();
    expect(result!.criticalityScore).toBe(100);
  });

  it('retains deeper network records for review rather than silently truncating at 3 hops', () => {
    const layout = createLayout(
      [
        { id: 'sw1', category: 'switch', name: 'SW1', positionU: 1, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'sw2', category: 'switch', name: 'SW2', positionU: 2, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'sw3', category: 'switch', name: 'SW3', positionU: 3, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'sw4', category: 'switch', name: 'SW4', positionU: 4, sizeU: 1, depthMm: 250, widthType: '19in', weightKg: 3, powerW: 30, heatLevel: 2, color: '#3b82f6' },
        { id: 'srv', category: 'server', name: 'Server', positionU: 5, sizeU: 1, depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#ef4444' }
      ],
      [
        { id: 'c1', fromDeviceId: 'sw1', toDeviceId: 'sw2', type: 'ethernet', color: '#3b82f6' },
        { id: 'c2', fromDeviceId: 'sw2', toDeviceId: 'sw3', type: 'ethernet', color: '#3b82f6' },
        { id: 'c3', fromDeviceId: 'sw3', toDeviceId: 'sw4', type: 'ethernet', color: '#3b82f6' },
        { id: 'c4', fromDeviceId: 'sw4', toDeviceId: 'srv', type: 'ethernet', color: '#3b82f6' }
      ]
    );
    const result = analyzeBlastRadius(layout, 'sw1');
    expect(result).not.toBeNull();
    expect(result!.impactBreakdown.network).toBe(4);
    expect(result!.indirectlyImpacted.find(d => d.deviceId === 'srv')?.detail).toContain('disruption is unverified');
  });
});

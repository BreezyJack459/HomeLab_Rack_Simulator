import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
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

  it('limits network impact to 3 hops', () => {
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
    // sw2 (dist 1), sw3 (dist 2), sw4 (dist 3) — srv at dist 4 should be excluded
    expect(result!.impactBreakdown.network).toBe(3);
    expect(result!.indirectlyImpacted.some((d) => d.deviceId === 'srv')).toBe(false);
  });
});

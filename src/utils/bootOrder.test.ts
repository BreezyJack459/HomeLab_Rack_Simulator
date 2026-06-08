import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { analyzeBootOrder, formatBootTime } from './bootOrder';

function createDevice(
  id: string,
  name: string,
  category: 'switch' | 'server' | 'nas' | 'ups' | 'router' | 'blank' | 'cable-management' = 'server',
  options: { bootDependsOn?: string[]; bootDelaySeconds?: number } = {}
) {
  return {
    id,
    category,
    name,
    mountSide: 'front' as const,
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in' as const,
    weightKg: 5,
    powerW: 50,
    heatLevel: 2 as const,
    color: '#334155',
    ...options
  };
}

const baseLayout: RackLayout = {
  id: 'test',
  name: 'Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  updatedAt: new Date().toISOString(),
  devices: [],
  cables: []
};

describe('analyzeBootOrder', () => {
  it('returns empty result for no devices', () => {
    const result = analyzeBootOrder(baseLayout);
    expect(result.sequence).toHaveLength(0);
    expect(result.totalTime).toBe(0);
    expect(result.criticalPath).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
  });

  it('returns empty result for only blank devices', () => {
    const layout = {
      ...baseLayout,
      devices: [createDevice('blank-1', 'Blank Panel', 'blank')]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(0);
  });

  it('handles single device with no dependencies', () => {
    const layout = {
      ...baseLayout,
      devices: [createDevice('ups-1', 'UPS')]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(1);
    expect(result.sequence[0].deviceId).toBe('ups-1');
    expect(result.sequence[0].level).toBe(0);
    expect(result.sequence[0].startTime).toBe(0);
    expect(result.totalTime).toBe(1);
    expect(result.criticalPath).toEqual(['ups-1']);
  });

  it('handles linear dependency chain', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('router-1', 'Router', 'router', { bootDependsOn: ['ups-1'] }),
        createDevice('switch-1', 'Switch', 'switch', { bootDependsOn: ['router-1'] })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(3);
    expect(result.sequence[0].deviceId).toBe('ups-1');
    expect(result.sequence[1].deviceId).toBe('router-1');
    expect(result.sequence[2].deviceId).toBe('switch-1');
    expect(result.sequence[0].level).toBe(0);
    expect(result.sequence[1].level).toBe(1);
    expect(result.sequence[2].level).toBe(2);
    expect(result.totalTime).toBe(3);
    expect(result.criticalPath).toEqual(['ups-1', 'router-1', 'switch-1']);
  });

  it('handles parallel dependencies (fork)', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('switch-1', 'Switch', 'switch', { bootDependsOn: ['ups-1'] }),
        createDevice('nas-1', 'NAS', 'nas', { bootDependsOn: ['ups-1'] })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(3);
    expect(result.sequence[0].deviceId).toBe('ups-1');
    // Switch and NAS should be at same level
    expect(result.sequence[1].level).toBe(1);
    expect(result.sequence[2].level).toBe(1);
    expect(result.totalTime).toBe(2);
    expect(result.criticalPath).toHaveLength(2);
  });

  it('handles merged dependencies (join)', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('router-1', 'Router', 'router', { bootDependsOn: ['ups-1'] }),
        createDevice('switch-1', 'Switch', 'switch', { bootDependsOn: ['ups-1'] }),
        createDevice('server-1', 'Server', 'server', {
          bootDependsOn: ['router-1', 'switch-1']
        })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(4);
    const server = result.sequence.find((n) => n.deviceId === 'server-1');
    expect(server).toBeDefined();
    expect(server!.level).toBe(2);
    expect(server!.startTime).toBe(2); // Both deps finish at t=2
    expect(result.totalTime).toBe(3);
  });

  it('respects bootDelaySeconds', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('router-1', 'Router', 'router', {
          bootDependsOn: ['ups-1'],
          bootDelaySeconds: 5
        })
      ]
    };
    const result = analyzeBootOrder(layout);
    const router = result.sequence.find((n) => n.deviceId === 'router-1');
    expect(router).toBeDefined();
    expect(router!.startTime).toBe(6); // UPS finishes at 1 + 5s delay
    expect(result.totalTime).toBe(7);
  });

  it('detects simple cycle', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('a', 'Device A', 'server', { bootDependsOn: ['b'] }),
        createDevice('b', 'Device B', 'server', { bootDependsOn: ['a'] })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0]).toContain('a');
    expect(result.cycles[0]).toContain('b');
    expect(result.criticalPath).toHaveLength(0);
  });

  it('detects longer cycle', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('a', 'A', 'server', { bootDependsOn: ['c'] }),
        createDevice('b', 'B', 'server', { bootDependsOn: ['a'] }),
        createDevice('c', 'C', 'server', { bootDependsOn: ['b'] })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0]).toContain('a');
    expect(result.cycles[0]).toContain('b');
    expect(result.cycles[0]).toContain('c');
  });

  it('ignores dependencies to non-existent devices', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('router-1', 'Router', 'router', {
          bootDependsOn: ['ups-1', 'non-existent']
        })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(2);
    const router = result.sequence.find((n) => n.deviceId === 'router-1');
    expect(router!.dependencies).toEqual(['ups-1']);
  });

  it('filters out blank and cable-management devices', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('blank-1', 'Blank', 'blank'),
        createDevice('cm-1', 'Cable Manager', 'cable-management')
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence).toHaveLength(1);
    expect(result.sequence[0].deviceId).toBe('ups-1');
  });

  it('sorts sequence by start time', () => {
    const layout = {
      ...baseLayout,
      devices: [
        createDevice('ups-1', 'UPS'),
        createDevice('router-1', 'Router', 'router', {
          bootDependsOn: ['ups-1'],
          bootDelaySeconds: 3
        }),
        createDevice('switch-1', 'Switch', 'switch', { bootDependsOn: ['ups-1'] })
      ]
    };
    const result = analyzeBootOrder(layout);
    expect(result.sequence[0].deviceId).toBe('ups-1');
    // Switch starts at t=1, router starts at t=5
    expect(result.sequence[1].deviceId).toBe('switch-1');
    expect(result.sequence[2].deviceId).toBe('router-1');
  });
});

describe('formatBootTime', () => {
  it('formats seconds only', () => {
    expect(formatBootTime(45)).toBe('45s');
  });

  it('formats minutes only', () => {
    expect(formatBootTime(120)).toBe('2m');
  });

  it('formats minutes and seconds', () => {
    expect(formatBootTime(125)).toBe('2m 5s');
  });

  it('formats zero', () => {
    expect(formatBootTime(0)).toBe('0s');
  });
});

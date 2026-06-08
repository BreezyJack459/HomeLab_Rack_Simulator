import { describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import {
  SCENARIO_PRESETS,
  getOverallReadinessScore,
  runAllScenarios,
  runScenario,
  type ScenarioPreset,
} from './scenarioPlanner';

function createLayout(overrides?: Partial<RackLayout>): RackLayout {
  return {
    id: 'test',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 24,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 2000,
    viewSide: 'front',
    devices: [],
    cables: [],
    reservations: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function device(overrides: Partial<PlacedDevice> & Pick<PlacedDevice, 'id' | 'category' | 'name'>): PlacedDevice {
  return {
    templateId: undefined,
    mountSide: 'front',
    positionU: 1,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 5,
    powerW: 50,
    heatLevel: 2,
    color: '#888',
    ...overrides,
  } as PlacedDevice;
}

function powerCable(from: string, to: string): CableRoute {
  return {
    id: `pc-${from}-${to}`,
    fromDeviceId: from,
    toDeviceId: to,
    type: 'power',
    color: '#000',
  };
}

function ethernetCable(from: string, to: string): CableRoute {
  return {
    id: `ec-${from}-${to}`,
    fromDeviceId: from,
    toDeviceId: to,
    type: 'ethernet',
    color: '#0a0',
  };
}

describe('SCENARIO_PRESETS', () => {
  it('exposes 8 distinct scenarios', () => {
    expect(SCENARIO_PRESETS).toHaveLength(8);
    const ids = new Set(SCENARIO_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(8);
  });

  it('every preset has label, description, emoji', () => {
    for (const p of SCENARIO_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('runScenario — power-outage', () => {
  it('flags every device when rack has no UPS', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'srv1', category: 'server', name: 'Server 1', powerW: 200 }),
        device({ id: 'sw1', category: 'switch', name: 'Switch 1', powerW: 30 }),
      ],
    });
    const result = runScenario(layout, 'power-outage');
    expect(result.preset).toBe('power-outage');
    expect(result.impactedDevices.length).toBe(2);
    expect(result.survivingDevices.length).toBe(0);
    expect(result.failedAssumptions.some((a) => a.id === 'no-ups')).toBe(true);
    expect(result.recommendations.some((r) => r.id === 'add-ups')).toBe(true);
  });

  it('marks UPS-backed devices as survivors', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ups1', category: 'ups', name: 'UPS', batteryWh: 1000, powerW: 0, ports: { power: 4 } }),
        device({ id: 'srv1', category: 'server', name: 'Server', powerW: 100, shutdownPriority: 'critical' }),
      ],
      cables: [powerCable('ups1', 'srv1')],
    });
    const result = runScenario(layout, 'power-outage');
    expect(result.survivingDevices.some((s) => s.deviceId === 'srv1')).toBe(true);
    expect(result.impactedDevices.length).toBe(0);
    expect(result.metrics.estimatedRuntimeMinutes).toBeGreaterThan(0);
  });

  it('flags orphan critical devices not on UPS', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ups1', category: 'ups', name: 'UPS', batteryWh: 1000, ports: { power: 4 } }),
        device({ id: 'srv1', category: 'server', name: 'Server', powerW: 100, shutdownPriority: 'critical' }),
      ],
      cables: [], // No power cable to UPS
    });
    const result = runScenario(layout, 'power-outage');
    expect(result.failedAssumptions.some((a) => a.id === 'critical-on-ups')).toBe(true);
    expect(result.recommendations.some((r) => r.id === 'rewire-critical')).toBe(true);
  });
});

describe('runScenario — isp-down', () => {
  it('reports no-WAN when there is no modem', () => {
    const layout = createLayout({
      devices: [device({ id: 'srv1', category: 'server', name: 'Server' })],
    });
    const result = runScenario(layout, 'isp-down');
    expect(result.failedAssumptions.some((a) => a.id === 'has-wan' && a.status === 'fail')).toBe(true);
  });

  it('survives local NAS and APs while modem fails', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'modem1', category: 'modem', name: 'Modem' }),
        device({ id: 'nas1', category: 'nas', name: 'NAS' }),
        device({ id: 'ap1', category: 'access-point', name: 'AP' }),
      ],
    });
    const result = runScenario(layout, 'isp-down');
    expect(result.impactedDevices.some((i) => i.deviceId === 'modem1')).toBe(true);
    expect(result.survivingDevices.some((s) => s.deviceId === 'nas1')).toBe(true);
    expect(result.survivingDevices.some((s) => s.deviceId === 'ap1')).toBe(true);
  });

  it('recommends LTE failover when no backup WAN exists', () => {
    const layout = createLayout({
      devices: [device({ id: 'modem1', category: 'modem', name: 'Modem' })],
    });
    const result = runScenario(layout, 'isp-down');
    expect(result.recommendations.some((r) => r.id === 'add-failover')).toBe(true);
  });
});

describe('runScenario — switch-reboot', () => {
  it('returns not-applicable when no switches exist', () => {
    const layout = createLayout({
      devices: [device({ id: 'srv1', category: 'server', name: 'Server' })],
    });
    const result = runScenario(layout, 'switch-reboot');
    expect(result.failedAssumptions.some((a) => a.id === 'no-switch')).toBe(true);
    expect(result.impactedDevices.length).toBe(0);
  });

  it('marks downstream devices as impacted when core switch reboots', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'sw1', category: 'switch', name: 'Core Switch' }),
        device({ id: 'srv1', category: 'server', name: 'Server 1' }),
        device({ id: 'srv2', category: 'server', name: 'Server 2' }),
      ],
      cables: [ethernetCable('sw1', 'srv1'), ethernetCable('sw1', 'srv2')],
    });
    const result = runScenario(layout, 'switch-reboot');
    expect(result.impactedDevices.some((i) => i.deviceId === 'sw1')).toBe(true);
    expect(result.impactedDevices.length).toBeGreaterThanOrEqual(1);
  });

  it('flags single-switch topology as risky', () => {
    const layout = createLayout({
      devices: [device({ id: 'sw1', category: 'switch', name: 'Switch' })],
    });
    const result = runScenario(layout, 'switch-reboot');
    expect(result.failedAssumptions.some((a) => a.id === 'multiple-switches' && a.status === 'fail')).toBe(true);
    expect(result.recommendations.some((r) => r.id === 'add-second-switch')).toBe(true);
  });
});

describe('runScenario — nas-disk-failure', () => {
  it('returns not-applicable when no NAS exists', () => {
    const layout = createLayout({
      devices: [device({ id: 'srv1', category: 'server', name: 'Server' })],
    });
    const result = runScenario(layout, 'nas-disk-failure');
    expect(result.failedAssumptions.some((a) => a.id === 'no-nas')).toBe(true);
  });

  it('marks the NAS as impacted and finds boot-dependents', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'nas1', category: 'nas', name: 'NAS' }),
        device({ id: 'srv1', category: 'server', name: 'Backup Server', bootDependsOn: ['nas1'] }),
        device({ id: 'srv2', category: 'server', name: 'Standalone Server' }),
      ],
    });
    const result = runScenario(layout, 'nas-disk-failure');
    expect(result.impactedDevices.some((i) => i.deviceId === 'nas1')).toBe(true);
    expect(result.impactedDevices.some((i) => i.deviceId === 'srv1')).toBe(true);
    expect(result.survivingDevices.some((s) => s.deviceId === 'srv2')).toBe(true);
  });

  it('flags single-NAS as a single point of failure', () => {
    const layout = createLayout({
      devices: [device({ id: 'nas1', category: 'nas', name: 'NAS' })],
    });
    const result = runScenario(layout, 'nas-disk-failure');
    expect(result.failedAssumptions.some((a) => a.id === 'second-nas' && a.status === 'fail')).toBe(true);
  });
});

describe('runScenario — ups-battery-weak', () => {
  it('returns not-applicable when no UPS exists', () => {
    const layout = createLayout({
      devices: [device({ id: 'srv1', category: 'server', name: 'Server' })],
    });
    const result = runScenario(layout, 'ups-battery-weak');
    expect(result.failedAssumptions.some((a) => a.id === 'no-ups')).toBe(true);
  });

  it('reports degraded runtime when battery is at 50%', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ups1', category: 'ups', name: 'UPS', batteryWh: 200, ports: { power: 4 } }),
        device({ id: 'srv1', category: 'server', name: 'Server', powerW: 200, shutdownPriority: 'critical' }),
      ],
      cables: [powerCable('ups1', 'srv1')],
    });
    const result = runScenario(layout, 'ups-battery-weak');
    expect(result.metrics.estimatedRuntimeMinutes).toBeDefined();
    expect(result.metrics.estimatedRuntimeMinutes).toBeLessThan(30);
    expect(result.metrics.estimatedRuntimeMinutes).toBeGreaterThan(0);
  });
});

describe('runScenario — summer-heatwave', () => {
  it('flags devices with heat level 4 or 5 as warnings or critical', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'srv1', category: 'server', name: 'Hot Server', heatLevel: 5 }),
        device({ id: 'srv2', category: 'server', name: 'Cool Server', heatLevel: 2 }),
        device({ id: 'sw1', category: 'switch', name: 'Switch', heatLevel: 1 }),
      ],
    });
    const result = runScenario(layout, 'summer-heatwave');
    expect(result.impactedDevices.some((i) => i.deviceId === 'srv1' && i.severity === 'critical')).toBe(true);
    expect(result.survivingDevices.some((s) => s.deviceId === 'sw1')).toBe(true);
  });

  it('recommends thermal separation when multiple high-heat devices exist', () => {
    const layout = createLayout({
      devices: [
        device({ id: 's1', category: 'server', name: 'S1', heatLevel: 4 }),
        device({ id: 's2', category: 'server', name: 'S2', heatLevel: 4 }),
      ],
    });
    const result = runScenario(layout, 'summer-heatwave');
    expect(result.recommendations.some((r) => r.id === 'separate-heat')).toBe(true);
  });
});

describe('runScenario — ap-offline', () => {
  it('returns not-applicable when no APs exist', () => {
    const layout = createLayout({
      devices: [device({ id: 'srv1', category: 'server', name: 'Server' })],
    });
    const result = runScenario(layout, 'ap-offline');
    expect(result.failedAssumptions.some((a) => a.id === 'no-aps')).toBe(true);
  });

  it('marks APs as impacted and wired devices as survivors', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ap1', category: 'access-point', name: 'AP' }),
        device({ id: 'sw1', category: 'switch', name: 'Switch' }),
      ],
    });
    const result = runScenario(layout, 'ap-offline');
    expect(result.impactedDevices.some((i) => i.deviceId === 'ap1')).toBe(true);
    expect(result.survivingDevices.some((s) => s.deviceId === 'sw1')).toBe(true);
  });

  it('recommends adding a second AP when only one exists', () => {
    const layout = createLayout({
      devices: [device({ id: 'ap1', category: 'access-point', name: 'AP' })],
    });
    const result = runScenario(layout, 'ap-offline');
    expect(result.recommendations.some((r) => r.id === 'add-ap')).toBe(true);
  });
});

describe('runScenario — management-network-down', () => {
  it('flags missing IP-KVM as a failed assumption', () => {
    const layout = createLayout({
      devices: [device({ id: 'srv1', category: 'server', name: 'Server' })],
    });
    const result = runScenario(layout, 'management-network-down');
    expect(result.failedAssumptions.some((a) => a.id === 'has-ip-kvm' && a.status === 'fail')).toBe(true);
    expect(result.recommendations.some((r) => r.id === 'add-ip-kvm')).toBe(true);
  });

  it('treats IP-KVM as impacted and other devices as survivors', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'kvm1', category: 'ip-kvm', name: 'PiKVM' }),
        device({ id: 'srv1', category: 'server', name: 'Server' }),
      ],
    });
    const result = runScenario(layout, 'management-network-down');
    expect(result.impactedDevices.some((i) => i.deviceId === 'kvm1')).toBe(true);
    expect(result.survivingDevices.some((s) => s.deviceId === 'srv1')).toBe(true);
  });
});

describe('runAllScenarios', () => {
  it('runs every preset', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ups1', category: 'ups', name: 'UPS', batteryWh: 500, ports: { power: 4 } }),
        device({ id: 'sw1', category: 'switch', name: 'Switch' }),
        device({ id: 'srv1', category: 'server', name: 'Server', powerW: 100 }),
      ],
      cables: [powerCable('ups1', 'srv1'), ethernetCable('sw1', 'srv1')],
    });
    const results = runAllScenarios(layout);
    expect(results).toHaveLength(SCENARIO_PRESETS.length);
    const ids = results.map((r) => r.preset);
    expect(new Set(ids).size).toBe(SCENARIO_PRESETS.length);
  });

  it('produces a result struct for every preset id', () => {
    const layout = createLayout();
    const ids: ScenarioPreset[] = [
      'power-outage',
      'isp-down',
      'switch-reboot',
      'nas-disk-failure',
      'ups-battery-weak',
      'summer-heatwave',
      'ap-offline',
      'management-network-down',
    ];
    for (const id of ids) {
      const result = runScenario(layout, id);
      expect(result.preset).toBe(id);
      expect(typeof result.summary).toBe('string');
      expect(Array.isArray(result.impactedDevices)).toBe(true);
      expect(Array.isArray(result.survivingDevices)).toBe(true);
      expect(Array.isArray(result.failedAssumptions)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    }
  });
});

describe('getOverallReadinessScore', () => {
  it('returns zero for empty results', () => {
    const score = getOverallReadinessScore([]);
    expect(score.score).toBe(0);
    expect(score.status).toBe('critical');
  });

  it('computes a percentage score from failed vs. passed assumptions', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ups1', category: 'ups', name: 'UPS', batteryWh: 1500, ports: { power: 8 } }),
        device({ id: 'srv1', category: 'server', name: 'Server', powerW: 100, shutdownPriority: 'critical' }),
      ],
      cables: [powerCable('ups1', 'srv1')],
    });
    const results = runAllScenarios(layout);
    const score = getOverallReadinessScore(results);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(['good', 'warning', 'critical']).toContain(score.status);
  });
});

describe('non-mutating', () => {
  it('does not mutate the input layout', () => {
    const layout = createLayout({
      devices: [
        device({ id: 'ups1', category: 'ups', name: 'UPS', batteryWh: 1000, ports: { power: 4 } }),
        device({ id: 'srv1', category: 'server', name: 'Server', powerW: 100 }),
      ],
      cables: [powerCable('ups1', 'srv1')],
    });
    const snapshot = JSON.stringify(layout);
    runAllScenarios(layout);
    expect(JSON.stringify(layout)).toBe(snapshot);
  });
});

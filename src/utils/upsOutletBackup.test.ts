import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { batterySupplyLayout, upsOutletBackup } from './upsOutletBackup';
import { calculateUpsRuntimes } from './upsRuntime';
import { buildPowerChains } from './powerChain';
import { scenarioPowerContext } from './scenarioPower';
import { runScenario } from './scenarioPlanner';
import { validateImportedLayout } from './layoutValidation';

const fixture = (): RackLayout => {
  const device = (id: string, powerW: number): PlacedDevice => ({ id, name: id, category: 'server', powerW,
    sizeU: 1, positionU: 1, widthType: '19in', depthMm: 100, weightKg: 1, heatLevel: 1, color: '#333', powerReviewed: true });
  return { id: 'rack', name: 'Rack', rackType: '19in', heightU: 12, rackDepthMm: 600, powerBudgetW: 1000,
    weightLimitKg: 100, viewSide: 'front', updatedAt: '', devices: [
      { ...device('ups', 10), category: 'ups', batteryWh: 100, powerCapacityW: 500, ports: { power: 3 },
        upsBatteryAssumptions: { efficiencyPct: 100, usableCapacityPct: 100, chargePct: 100 },
        portConnectionSpecs: { 'power:rear:0': { upsBackup: 'battery' }, 'power:rear:1': { upsBackup: 'surge-only' } } },
      { ...device('backed', 90), shutdownPriority: 'critical' }, device('surge', 200),
    ], cables: [
      { id: 'battery-feed', type: 'power', color: '#333', fromDeviceId: 'backed', toDeviceId: 'ups', toPort: { type: 'power', index: 0, side: 'rear' } },
      { id: 'surge-feed', type: 'power', color: '#333', fromDeviceId: 'ups', toDeviceId: 'surge', fromPort: { type: 'power', index: 1, side: 'rear' } },
    ] };
};

describe('UPS outlet backup semantics', () => {
  it('separates utility load from battery load and follows reverse-selected sockets', () => {
    const layout = fixture();
    const before = JSON.stringify(layout);
    expect(upsOutletBackup(layout.devices[0], layout.cables[0])).toBe('battery');
    expect(buildPowerChains(layout)[0].root.totalW).toBe(300);
    const runtime = calculateUpsRuntimes(layout)[0];
    expect(runtime.outputLoadW).toBe(290);
    expect(runtime.loadW).toBe(100);
    expect(runtime.runtimeMinutes).toBe(60);
    expect(runtime.shutdownPlan.map(s => s.device.id)).toEqual(['backed']);
    expect([...scenarioPowerContext(layout).backedIds]).toEqual(['backed']);
    const outage = runScenario(layout, 'power-outage');
    expect(outage.impactedDevices.map(d => d.deviceId)).toContain('surge');
    expect(outage.survivingDevices.map(d => d.deviceId)).toContain('backed');
    expect(runScenario(layout, 'ups-battery-weak').metrics.estimatedRuntimeMinutes).toBe(30);
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('does not infer backup for missing metadata, missing sockets or a different face', () => {
    for (const variant of ['missing-spec', 'missing-port', 'other-face'] as const) {
      const layout = fixture();
      if (variant === 'missing-spec') layout.devices[0].portConnectionSpecs = {};
      if (variant === 'missing-port') layout.cables[0].toPort = undefined;
      if (variant === 'other-face') {
        layout.devices[0].portFaceOverrides = { power: 'front' };
        layout.cables[0].toPort!.side = 'front';
      }
      expect(calculateUpsRuntimes(layout)[0].runtimeLabel).toBe('Not estimated');
      expect(calculateUpsRuntimes(layout)[0].warnings.join(' ')).toContain('backup');
      expect(scenarioPowerContext(layout).backedIds.has('backed')).toBe(false);
    }
  });

  it('preserves socket modes in JSON and rejects malformed declarations', () => {
    const layout = fixture();
    expect(validateImportedLayout(JSON.parse(JSON.stringify(layout))).valid).toBe(true);
    const invalid = { ...layout, devices: [{ ...layout.devices[0], portConnectionSpecs: { 'power:rear:0': { upsBackup: 'yes' } } }] };
    expect(validateImportedLayout(invalid).valid).toBe(false);
    expect(batterySupplyLayout(layout).layout.cables.map(c => c.id)).toEqual(['battery-feed']);
  });
});

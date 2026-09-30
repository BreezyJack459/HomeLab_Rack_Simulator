import { describe, expect, it } from 'vitest';
import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { assessSwitchRemoval, bootDependents } from './scenarioNetwork';
import { runScenario } from './scenarioPlanner';

const device = (id: string, category: PlacedDevice['category']): PlacedDevice => ({ id, name: id, category,
  sizeU: 1, positionU: 1, widthType: '19in', depthMm: 100, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333' });
const cable = (from: string, to: string, type: CableRoute['type'] = 'ethernet'): CableRoute => ({ id: `${from}-${to}`, fromDeviceId: from, toDeviceId: to, type, color: '#333' });
const rack = (devices: PlacedDevice[], cables: CableRoute[] = []): RackLayout => ({ id: 'rack', name: 'Rack', devices, cables,
  rackType: '19in', heightU: 24, rackDepthMm: 600, powerBudgetW: 1000, weightLimitKg: 100, viewSide: 'front', updatedAt: '' });

describe('recorded network and NAS scenario dependencies', () => {
  it('compares gateway paths without treating power wires or dual-NIC endpoints as switches', () => {
    const layout = rack([device('gateway', 'router'), device('core', 'switch'), device('alternate', 'switch'),
      device('dual', 'server'), device('single', 'server'), device('behind-endpoint', 'server'), device('power-only', 'pdu')],
    [cable('gateway', 'core'), cable('gateway', 'alternate'), cable('core', 'dual'), cable('alternate', 'dual'),
      cable('core', 'single'), cable('dual', 'behind-endpoint'), cable('core', 'power-only', 'power')]);
    const removal = assessSwitchRemoval(layout, 'core');
    expect(removal.before.has('single')).toBe(true);
    expect(removal.after.has('single')).toBe(false);
    expect(removal.after.has('dual')).toBe(true);
    expect(removal.before.has('behind-endpoint')).toBe(false);
    expect(removal.adjacent.has('power-only')).toBe(false);
    const result = runScenario(layout, 'switch-reboot');
    expect(result.impactedDevices.find(d => d.deviceId === 'dual')).toMatchObject({ severity: 'info' });
    expect(result.impactedDevices.find(d => d.deviceId === 'dual')?.reason).toContain('another recorded physical gateway path remains');
    expect(result.impactedDevices.find(d => d.deviceId === 'single')?.reason).toContain('No recorded physical gateway path remains');
    expect(result.summary).not.toContain('3 minutes');
  });

  it('follows transitive boot and explicit service storage dependencies without equating boot order to runtime failure', () => {
    const layout = rack([device('nas', 'nas'), { ...device('host', 'server'), bootDependsOn: ['nas', 'child'] },
      { ...device('child', 'server'), bootDependsOn: ['host'] }, device('service-host', 'server'), device('unrelated', 'server')]);
    layout.services = [{ id: 'files', name: 'Shared files', criticality: 'critical', hostDeviceId: 'service-host', storageDeviceIds: ['nas'] }];
    const snapshot = JSON.stringify(layout);
    expect([...bootDependents(layout, 'nas')].sort()).toEqual(['child', 'host']);
    const result = runScenario(layout, 'nas-disk-failure');
    expect(result.impactedDevices.map(d => d.deviceId).sort()).toEqual(['child', 'host', 'nas', 'service-host']);
    expect(result.impactedDevices.find(d => d.deviceId === 'child')?.reason).toContain('restart order');
    expect(result.impactedDevices.find(d => d.deviceId === 'service-host')?.reason).toContain('Shared files');
    expect(result.survivingDevices[0].reason).toContain('unverified');
    expect(JSON.stringify(layout)).toBe(snapshot);
  });

  it('does not infer WAN failover, storage recovery or independent management from counts and labels', () => {
    const layout = rack([device('modem-a', 'modem'), device('modem-b', 'modem'), { ...device('nas-a', 'nas'), label: 'LTE failover' },
      device('nas-b', 'nas'), device('kvm', 'ip-kvm'), device('ap-a', 'access-point'), device('ap-b', 'access-point')]);
    expect(runScenario(layout, 'isp-down').failedAssumptions.find(a => a.id === 'backup-wan')?.status).toBe('unknown');
    expect(runScenario(layout, 'nas-disk-failure').failedAssumptions.find(a => a.id === 'second-nas')?.status).toBe('unknown');
    expect(runScenario(layout, 'management-network-down').failedAssumptions.find(a => a.id === 'has-ip-kvm')?.status).toBe('unknown');
    const wireless = runScenario(layout, 'ap-offline');
    expect(wireless.failedAssumptions.find(a => a.id === 'multiple-aps')?.status).toBe('fail');
    expect(wireless.summary).toContain('All 2 recorded AP(s)');
  });
});

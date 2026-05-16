import { describe, it, expect } from 'vitest';
import type { RackLayout, PlacedDevice, CableRoute } from '../types/rack';
import { diffLayouts } from './layoutDiff';
import {
  calculateChangeRisk,
  generateRollbackPlan,
  affectedServices,
  buildChangeReview,
} from './changeRisk';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'd1',
    category: 'switch',
    name: 'Switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 4,
    powerW: 40,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

function makeCable(overrides: Partial<CableRoute> = {}): CableRoute {
  return {
    id: 'c1',
    fromDeviceId: 'd1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'd2',
    toPort: { type: 'ethernet', index: 1 },
    type: 'ethernet',
    color: '#3b82f6',
    ...overrides,
  };
}

function makeLayout(overrides: Partial<RackLayout> = {}): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1000,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateChangeRisk', () => {
  it('returns low risk for no changes', () => {
    const layout = makeLayout();
    const diff = diffLayouts(layout, layout);
    const risk = calculateChangeRisk(diff, layout, layout);
    expect(risk.level).toBe('low');
    expect(risk.score).toBe(0);
    expect(risk.reasons).toHaveLength(0);
  });

  it('returns medium risk for adding a regular device', () => {
    const before = makeLayout();
    const after = makeLayout({ devices: [makeDevice()] });
    const diff = diffLayouts(before, after);
    const risk = calculateChangeRisk(diff, before, after);
    expect(risk.level).toBe('low');
  });

  it('returns high/critical risk for removing a router', () => {
    const router = makeDevice({ id: 'r1', category: 'router', name: 'Router' });
    const before = makeLayout({ devices: [router] });
    const after = makeLayout();
    const diff = diffLayouts(before, after);
    const risk = calculateChangeRisk(diff, before, after);
    expect(risk.score).toBeGreaterThan(0);
    expect(risk.reasons.some((r) => r.message.includes('Router'))).toBe(true);
  });

  it('returns higher risk for removing a network core with downstream', () => {
    const sw = makeDevice({ id: 'sw1', category: 'switch', name: 'Core Switch' });
    const ap = makeDevice({ id: 'ap1', category: 'access-point', name: 'AP' });
    const cable = makeCable({ fromDeviceId: 'sw1', toDeviceId: 'ap1', type: 'ethernet' });
    const before = makeLayout({ devices: [sw, ap], cables: [cable] });
    const after = makeLayout({ devices: [ap], cables: [] });
    const diff = diffLayouts(before, after);
    const risk = calculateChangeRisk(diff, before, after);
    expect(risk.reasons.some((r) => r.category === 'dependency')).toBe(true);
  });

  it('flags power cable changes as high risk', () => {
    const pdu = makeDevice({ id: 'pdu1', category: 'pdu', name: 'PDU' });
    const server = makeDevice({ id: 'srv1', category: 'server', name: 'Server' });
    const powerCable = makeCable({ id: 'pwr1', fromDeviceId: 'pdu1', toDeviceId: 'srv1', type: 'power' });
    const before = makeLayout({ devices: [pdu, server], cables: [powerCable] });
    const after = makeLayout({ devices: [pdu, server], cables: [] });
    const diff = diffLayouts(before, after);
    const risk = calculateChangeRisk(diff, before, after);
    expect(risk.reasons.some((r) => r.category === 'power' && r.message.includes('Power'))).toBe(true);
  });

  it('flags rack dimension change as medium risk', () => {
    const before = makeLayout({ heightU: 12 });
    const after = makeLayout({ heightU: 24 });
    const diff = diffLayouts(before, after);
    const risk = calculateChangeRisk(diff, before, after);
    expect(risk.reasons.some((r) => r.category === 'layout')).toBe(true);
  });

  it('caps score at 100', () => {
    const devices: PlacedDevice[] = [];
    const cables: CableRoute[] = [];
    for (let i = 0; i < 20; i++) {
      devices.push(makeDevice({ id: `router-${i}`, category: 'router', name: `Router ${i}` }));
    }
    const before = makeLayout({ devices });
    const after = makeLayout();
    const diff = diffLayouts(before, after);
    const risk = calculateChangeRisk(diff, before, after);
    expect(risk.score).toBeLessThanOrEqual(100);
  });
});

describe('generateRollbackPlan', () => {
  it('returns empty plan for no changes', () => {
    const layout = makeLayout();
    const diff = diffLayouts(layout, layout);
    const plan = generateRollbackPlan(diff, layout);
    expect(plan.steps).toHaveLength(0);
    expect(plan.estimatedDowntimeMin).toBe(0);
  });

  it('generates steps to restore removed devices', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', name: 'Switch' })] });
    const after = makeLayout();
    const diff = diffLayouts(before, after);
    const plan = generateRollbackPlan(diff, before);
    expect(plan.steps.some((s) => s.action === 'Re-add device' && s.targetId === 'd1')).toBe(true);
  });

  it('generates steps to move devices back', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1', positionU: 1 })] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1', positionU: 5 })] });
    const diff = diffLayouts(before, after);
    const plan = generateRollbackPlan(diff, before);
    expect(plan.steps.some((s) => s.action === 'Move device back')).toBe(true);
  });

  it('generates steps to restore cables', () => {
    const before = makeLayout({ devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })], cables: [makeCable()] });
    const after = makeLayout({ devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })], cables: [] });
    const diff = diffLayouts(before, after);
    const plan = generateRollbackPlan(diff, before);
    expect(plan.steps.some((s) => s.action === 'Re-add cable')).toBe(true);
  });

  it('generates steps to remove added devices/cables', () => {
    const before = makeLayout();
    const after = makeLayout({ devices: [makeDevice()], cables: [makeCable()] });
    const diff = diffLayouts(before, after);
    const plan = generateRollbackPlan(diff, before);
    expect(plan.steps.some((s) => s.action === 'Remove added device')).toBe(true);
    expect(plan.steps.some((s) => s.action === 'Remove added cable')).toBe(true);
  });

  it('includes pre and post checklists', () => {
    const layout = makeLayout();
    const diff = diffLayouts(layout, layout);
    const plan = generateRollbackPlan(diff, layout);
    expect(plan.preChecklist.length).toBeGreaterThan(0);
    expect(plan.postChecklist.length).toBeGreaterThan(0);
  });
});

describe('affectedServices', () => {
  it('returns empty for no changes', () => {
    const layout = makeLayout();
    const diff = diffLayouts(layout, layout);
    const services = affectedServices(diff, layout, layout);
    expect(services).toHaveLength(0);
  });

  it('detects internet access from router change', () => {
    const router = makeDevice({ id: 'r1', category: 'router', name: 'Router' });
    const before = makeLayout({ devices: [router] });
    const after = makeLayout();
    const diff = diffLayouts(before, after);
    const services = affectedServices(diff, before, after);
    expect(services).toContain('Internet access');
  });

  it('detects Wi-Fi from AP change', () => {
    const ap = makeDevice({ id: 'ap1', category: 'access-point', name: 'AP' });
    const before = makeLayout({ devices: [ap] });
    const after = makeLayout();
    const diff = diffLayouts(before, after);
    const services = affectedServices(diff, before, after);
    expect(services).toContain('Wi-Fi');
  });

  it('detects network connectivity from ethernet cable removal', () => {
    const before = makeLayout({
      devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })],
      cables: [makeCable({ type: 'ethernet' })],
    });
    const after = makeLayout({
      devices: [makeDevice({ id: 'd1' }), makeDevice({ id: 'd2' })],
      cables: [],
    });
    const diff = diffLayouts(before, after);
    const services = affectedServices(diff, before, after);
    expect(services).toContain('Network connectivity');
  });
});

describe('buildChangeReview', () => {
  it('returns a complete review object', () => {
    const before = makeLayout();
    const after = makeLayout({ devices: [makeDevice()] });
    const review = buildChangeReview(diffLayouts(before, after), before, after);
    expect(review.diff).toBeDefined();
    expect(review.risk).toBeDefined();
    expect(review.rollback).toBeDefined();
    expect(review.affectedServices).toBeDefined();
    expect(review.validationIssuesBefore).toBeDefined();
    expect(review.validationIssuesAfter).toBeDefined();
  });
});

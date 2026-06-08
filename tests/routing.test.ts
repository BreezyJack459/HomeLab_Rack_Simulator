import { expect, test } from 'vitest';
import { sampleLayouts } from '../src/data/sampleLayouts';
import type { CablePlan, CableRoute, RackLayout } from '../src/types/rack';
import { getPatchPanelJacks, getPatchPanelLinkedCableIds, patchPanelRouteLabel } from '../src/utils/patchPanel';
import { calculateCablePlan } from '../src/utils/routing';
import { validateRackLayout } from '../src/utils/validation';

const onHand = sampleLayouts.find((layout) => layout.id === 'sample-my-onhand-gear') as RackLayout;
const testBench = sampleLayouts.find((layout) => layout.id === 'sample-4zone-test') as RackLayout;
const edgeLab = sampleLayouts.find((layout) => layout.id === 'sample-10in-edge-lab') as RackLayout;

function route(layout: RackLayout, id: string): CableRoute {
  const cable = layout.cables.find((item) => item.id === id);
  expect(cable, `Missing cable fixture ${id}`).toBeTruthy();
  return cable!;
}

function planFor(layout: RackLayout, id: string): CablePlan {
  const plan = calculateCablePlan(route(layout, id), layout);
  expect(plan, `Missing cable plan for ${id}`).toBeTruthy();
  return plan!;
}

test('front patch routes stay on the front manager with a service loop', () => {
  const plan = planFor(testBench, 'test-cable-patch');

  expect(plan.discipline).toBe('patch');
  expect(plan.rail).toBeNull();
  expect(plan.waypoints.some((point) => point.role === 'service-loop')).toBe(true);
  expect(plan.nodes.every((node) => node.type !== 'v-rail-left' && node.type !== 'v-rail-right')).toBe(true);
});

test('front patch routes prefer the nearest horizontal cable manager bus', () => {
  const plan = planFor(edgeLab, 'sample10-cable-1');
  const managerNodes = plan.nodes.filter((node) => node.type === 'h-manager');

  expect(plan.discipline).toBe('patch');
  expect(plan.rail).toBeNull();
  expect(managerNodes.length).toBe(1);
  expect(managerNodes[0].deviceId).toBe('sample10-manager');
  expect(plan.segments.some((segment) => segment.to === 'front-manager-entry')).toBe(true);
});

test('patch panel jacks pair the front patch cord with the rear home run by jack index', () => {
  const jacks = getPatchPanelJacks(testBench, 'test-patch');
  const frontOnly = jacks[0];
  const rearOnly = jacks[1];

  expect(frontOnly.state).toBe('dark-patch');
  expect(frontOnly.frontPeer?.id).toBe('test-switch');
  expect(frontOnly.rearPeer).toBeUndefined();
  expect(rearOnly.state).toBe('landed');
  expect(rearOnly.rearPeer?.id).toBe('test-mini-pc');
});

test('patch panel route labels show the real-world rear-to-front jack relationship', () => {
  const label = patchPanelRouteLabel(testBench, route(testBench, 'test-cable-patch'));

  expect(label).toBe('Jack 1: rear no rear home run -> front 24-port managed switch');
});

test('patch panel linked selection returns both rear structured and front patch cables', () => {
  const pairedLayout: RackLayout = {
    ...testBench,
    cables: [
      ...testBench.cables,
      {
        id: 'test-cable-patch-pair',
        fromDeviceId: 'test-switch',
        fromPort: { type: 'ethernet', index: 1, side: 'front' },
        toDeviceId: 'test-patch',
        toPort: { type: 'ethernet', index: 1, side: 'front' },
        type: 'patch',
        color: '#0ea5e9'
      }
    ]
  };

  expect(
    Array.from(getPatchPanelLinkedCableIds(pairedLayout, 'test-cable-structured')).sort()
  ).toEqual(['test-cable-patch-pair', 'test-cable-structured']);
  expect(
    Array.from(getPatchPanelLinkedCableIds(pairedLayout, 'test-cable-patch-pair')).sort()
  ).toEqual(['test-cable-patch-pair', 'test-cable-structured']);
});

test('structured cabling uses patch-panel rear discipline and a side tray', () => {
  const plan = planFor(testBench, 'test-cable-structured');

  expect(plan.discipline).toBe('structured');
  expect(plan.toFace).toBe('rear');
  expect(plan.rail === 'left' || plan.rail === 'right').toBe(true);
  expect(plan.nodes.some((node) => node.type === 'v-rail-left' || node.type === 'v-rail-right')).toBe(true);
  expect(plan.estimatedLengthMm > plan.slackMm).toBe(true);
});

test('power cabling adds drip/strain relief and keeps power separation metadata', () => {
  const plan = planFor(onHand, 'onhand-power-pdu-to-nas');

  expect(plan.discipline).toBe('power');
  expect(plan.separation).toBe('power');
  expect(plan.waypoints.some((point) => point.role === 'drip-loop')).toBe(true);
  expect(plan.waypoints.some((point) => point.role === 'strain-relief')).toBe(true);
  expect(plan.render.sagMm >= 100).toBe(true);
});

test('1U rear PDU power routes follow the nearest load side instead of one PDU side', () => {
  const leftLoad = planFor(onHand, 'onhand-power-pdu-to-ucg');
  const rightLoad = planFor(onHand, 'onhand-power-pdu-to-poe');
  const nasLoad = planFor(onHand, 'onhand-power-pdu-to-nas');

  expect(leftLoad.rail).toBe('left');
  expect(rightLoad.rail).toBe('right');
  expect(nasLoad.rail).toBe('right');
});

test('recommended cable lengths start at common 0.5m rack cable stock', () => {
  const plan = planFor(onHand, 'onhand-power-pdu-to-ucg');

  expect([500, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000]).toContain(plan.standardLengthMm);
  expect(plan.standardLengthMm >= 500).toBe(true);
  expect(plan.standardLengthMm >= plan.estimatedLengthMm).toBe(true);
});

test('mixed front/rear data routes leave direct-front mode and use a side tray', () => {
  const plan = planFor(testBench, 'test-cable-invalid-ethernet-pdu');

  expect(plan.discipline).toBe('data');
  expect(plan.rail === 'left' || plan.rail === 'right').toBe(true);
});

test('0U PDU fixtures choose the physical left and right rail sides', () => {
  const left = planFor(testBench, 'test-cable-power-dual-a');
  const right = planFor(testBench, 'test-cable-power-dual-b');

  expect(left.rail).toBe('left');
  expect(right.rail).toBe('right');
  expect(left.render.tray).toBe('side-left');
  expect(right.render.tray).toBe('side-right');
});

test('validation surfaces route-plan warnings alongside existing wiring rules', () => {
  const issues = validateRackLayout(testBench);
  const issueIds = new Set(issues.map((issue) => issue.id));

  expect(issueIds.has('route-power-data-separation-test-cable-invalid-ethernet-pdu')).toBe(true);
  expect(issueIds.has('endpoint-switch-direct-test-cable-invalid-ethernet-pdu')).toBe(true);
  expect(issueIds.has('network-0u-test-cable-invalid-ethernet-pdu')).toBe(true);
  expect(issueIds.has('patch-jack-dark-test-patch-0')).toBe(true);
  expect(issueIds.has('patch-jack-unpatched-test-patch-1')).toBe(true);
});

test('manual cable lengths must cover routed path plus slack budget', () => {
  const shortLayout: RackLayout = {
    ...testBench,
    devices: [
      {
        id: 'short-switch',
        category: 'switch',
        name: 'Short Switch',
        positionU: 2,
        sizeU: 1,
        depthMm: 200,
        widthType: '19in',
        weightKg: 3,
        powerW: 30,
        heatLevel: 2,
        color: '#0ea5e9',
        ports: { ethernet: 24 },
        mountSide: 'front'
      },
      {
        id: 'short-patch',
        category: 'patch-panel',
        name: 'Short Patch',
        positionU: 8,
        sizeU: 1,
        depthMm: 120,
        widthType: '19in',
        weightKg: 2,
        powerW: 0,
        heatLevel: 1,
        color: '#334155',
        ports: { ethernet: 24 },
        mountSide: 'front'
      }
    ],
    cables: [
      {
        id: 'short-cable',
        fromDeviceId: 'short-switch',
        fromPort: { type: 'ethernet', index: 0, side: 'front' },
        toDeviceId: 'short-patch',
        toPort: { type: 'ethernet', index: 0, side: 'front' },
        type: 'patch',
        color: '#0ea5e9',
        lengthMm: 200
      }
    ]
  };

  const issues = validateRackLayout(shortLayout);
  const shortCable = issues.find((issue) => issue.id === 'cable-short-short-cable');

  expect(shortCable).toBeTruthy();
  expect(shortCable?.detail).toContain('plus');
  expect(shortCable?.detail).toContain('slack');
});

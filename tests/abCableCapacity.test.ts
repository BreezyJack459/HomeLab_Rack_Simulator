import { expect, it } from 'vitest';
import { abFixture, abWorkspace } from './fixtures/abCableFixture';
import { planABCables } from '../src/utils/abCablePlanner';
it('keeps fixed mismatched jack reuse in a two-panel 48-jack rack', () => {
  const layout = abFixture();
  for (const device of layout.devices) if (device.category === 'patch-panel') device.ports = { ethernet: 48 };
  const started = performance.now();
  const result = planABCables(layout, abWorkspace(layout), { from: { deviceId: 'Switch A', port: { type: 'ethernet', index: 0 } }, to: { deviceId: 'Switch B', port: { type: 'ethernet', index: 0 } }, mode: 'two-panels' });
  expect(result.plans[0].reusedCount).toBe(1);
  expect(result.plans[0].newCount).toBe(2);
  expect(result.plans.length).toBeLessThanOrEqual(5);
  console.info(`48-jack bounded planning: ${Math.round(performance.now() - started)}ms`);
});

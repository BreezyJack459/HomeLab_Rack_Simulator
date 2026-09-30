import { expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import { validateRackLayout } from './validation';
import type { RackLayout } from '../types/rack';

const fixture = sampleLayouts.find((layout) => layout.id === 'sample-4zone-test') as RackLayout;
const issueId = 'endpoint-switch-direct-test-cable-invalid-ethernet-pdu';
it('allows homelab direct links as guidance while preserving physical validation', () => {
  const issues = validateRackLayout({ ...fixture, policies: [] });
  expect(issues.find((issue) => issue.id === issueId)?.severity).toBe('info');
  expect(issues.some((issue) => issue.severity === 'critical')).toBe(true);
});
it('honors enabled structured policy severity and ignores disabled rules', () => {
  for (const severity of ['warning', 'critical'] as const) {
    const policy = { id: 'direct', type: 'no-endpoint-switch-direct' as const, enabled: true, severity, params: {} };
    expect(validateRackLayout({ ...fixture, policies: [policy] }).find((issue) => issue.id === issueId)?.severity).toBe(severity);
    expect(validateRackLayout({ ...fixture, policies: [{ ...policy, enabled: false }] }).find((issue) => issue.id === issueId)?.severity).toBe('info');
  }
});

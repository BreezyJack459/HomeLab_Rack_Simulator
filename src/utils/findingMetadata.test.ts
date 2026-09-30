import { expect, it } from 'vitest';
import type { ValidationIssue } from '../types/rack';
import { annotateFinding } from './findingMetadata';

const finding = (id: string, patch: Partial<ValidationIssue> = {}): ValidationIssue => ({ id, severity: 'warning', title: 'Untranslated title', detail: 'Recorded inputs', ...patch });

it('keeps an unrecognized critical finding unknown rather than treating severity as certainty', () => {
  expect(annotateFinding(finding('new-rule', { severity: 'critical' }))).toMatchObject({ status: 'unknown', applicability: 'active' });
});

it('distinguishes a recorded numeric conflict from explicitly missing measurement evidence', () => {
  expect(annotateFinding(finding('depth-device', { deviceIds: ['device'] }))).toMatchObject({ ruleId: 'depth', status: 'fail', applicability: 'active' });
  expect(annotateFinding(finding('depth-device', { evidence: 'unverified', deviceIds: ['device'] }))).toMatchObject({ status: 'unknown' });
});

it('groups missing mounting evidence per device with stable identities independent of titles', () => {
  const kit = annotateFinding(finding('installation-kit-device', { evidence: 'unverified', deviceIds: ['device'] }));
  const rails = annotateFinding(finding('installation-rails-device', { evidence: 'unverified', deviceIds: ['device'] }));
  expect(kit.ruleId).toBe('installation-kit');
  expect(kit.rootCauseKey).toBe(rails.rootCauseKey);
  expect(kit.applicability).toBe('active');
});

it('keeps optional placement heuristics inspectable without turning them into confirmed failures', () => {
  expect(annotateFinding(finding('ups-high-device', { deviceIds: ['device'] }))).toMatchObject({ status: 'unknown', applicability: 'optional' });
});

it.each(['network-0u', 'patch-front-endpoint', 'patch-rear-switch', 'structured-no-panel', 'structured-front', 'patch-invalid-pair', 'patch-rear'])('preserves %s as a recorded wiring failure', (rule) => {
  expect(annotateFinding(finding(`${rule}-cable`, { cableIds: ['cable'] }))).toMatchObject({ ruleId: rule, status: 'fail', applicability: 'active' });
});

it.each(['power-near-limit', 'weight-near-limit'])('keeps the default %s threshold as an optional heuristic', (rule) => {
  expect(annotateFinding(finding(rule))).toMatchObject({ status: 'unknown', applicability: 'optional' });
});

it.each(['printed-width', 'printed-collision'])('keeps %s a known modeled conflict', (rule) => {
  expect(annotateFinding(finding(`${rule}-device`, { deviceIds: ['device'], severity: 'critical' }))).toMatchObject({ ruleId: rule, status: 'fail', applicability: 'active' });
});

it.each(['printed-depth', 'printed-load'])('keeps assumed %s specifications unknown', (rule) => {
  expect(annotateFinding(finding(`${rule}-device`, { deviceIds: ['device'] }))).toMatchObject({ ruleId: rule, status: 'unknown' });
});

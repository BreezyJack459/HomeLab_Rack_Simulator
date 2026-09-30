import { describe, expect, it } from 'vitest';
import type { ValidationIssue } from '../types/rack';
import { findingIdentity } from './findingExceptions';
import { summarizeFindings } from './findingSummary';

const issue = (id: string, patch: Partial<ValidationIssue> = {}): ValidationIssue => ({ id, title: 'Review device', detail: 'Recorded check', severity: 'warning', ...patch });

describe('shared finding summary', () => {
  it('never promotes absent status or missing evidence to a confirmed conflict or pass', () => {
    const summary = summarizeFindings([issue('legacy'), issue('known', { status: 'fail' }), issue('suggestion', { severity: 'info', applicability: 'optional' })]);
    expect(summary.counts).toMatchObject({ confirmed: 1, verification: 1, information: 1, attention: 2 });
    expect(summary.groups.find(group => group.key === 'legacy')?.status).toBe('unknown');
  });

  it('groups one cable cause across endpoints but retains raw evidence and affected targets', () => {
    const checks = ['server', 'switch'].map(device => issue(`travel-${device}`, { status: 'unknown', rootCauseKey: 'service-motion:cable', deviceIds: [device], cableIds: ['cable'], cause: { length: null, travel: 200 } }));
    const summary = summarizeFindings(checks);
    expect(summary.counts).toMatchObject({ verification: 1, raw: 2 });
    expect(summary.groups[0].deviceIds).toEqual(['server', 'switch']);
    expect(summary.groups[0].issues).toHaveLength(2);
    expect(findingIdentity(summary.groups[0].representative)).toEqual(findingIdentity(summarizeFindings([...checks].reverse()).groups[0].representative));
    expect(summarizeFindings([issue('a'), issue('b')]).counts.verification).toBe(2);
  });

  it('prioritizes a confirmed failure without dropping an unknown sibling or downgrading severity', () => {
    const summary = summarizeFindings([issue('unverified', { rootCauseKey: 'power-connection:c', status: 'unknown', severity: 'critical' }), issue('conflict', { rootCauseKey: 'power-connection:c', status: 'fail' })]);
    expect(summary.groups[0]).toMatchObject({ section: 'confirmed', status: 'fail', severity: 'critical' });
    expect(summary.groups[0].representative.id).toBe('conflict');
    expect(summary.groups[0].issues).toHaveLength(2);
  });

  it('keeps accepted unknown evidence inspectable and reopens changed child facts', () => {
    const checks = ['one', 'two'].map(device => issue(device, { status: 'unknown', rootCauseKey: 'installation-review:server', deviceIds: ['server'], cause: { field: device, value: null } }));
    const identity = findingIdentity(summarizeFindings(checks).groups[0].representative);
    const layout = { findingExceptions: [{ id: 'exception', ...identity, reason: 'Await measurements', acceptedAt: '2026-09-30T00:00:00.000Z' }] };
    const accepted = summarizeFindings(checks, layout);
    expect(accepted.counts).toMatchObject({ attention: 0, accepted: 1 });
    expect(accepted.groups[0].status).toBe('unknown');
    const changed = checks.map(check => check.id === 'two' ? { ...check, cause: { field: 'two', value: 500 } } : check);
    expect(summarizeFindings(changed, layout).groups[0]).toMatchObject({ acceptance: 'reopened', section: 'verification' });
  });

  it('does not erase a failure on acceptance and keeps nonapplicable checks inspectable', () => {
    const failed = issue('width', { status: 'fail', severity: 'critical' });
    const identity = findingIdentity(failed);
    const summary = summarizeFindings([failed, issue('goal-off', { status: 'unknown', applicability: 'not-applicable' })], { findingExceptions: [{ id: 'accepted', ...identity, reason: 'Planned replacement', acceptedAt: '2026-09-30T00:00:00.000Z' }] });
    expect(summary.counts).toMatchObject({ accepted: 1, information: 1 });
    expect(summary.groups.find(group => group.key === 'width')?.status).toBe('fail');
  });
});

it('never hides explicit conflicts behind optional or nonapplicable planning modes', () => {
  const summary = summarizeFindings(['optional', 'not-applicable'].map((applicability, index) => issue(`physical-${index}`, { status: 'fail', severity: 'info', applicability: applicability as 'optional' | 'not-applicable' })));
  expect(summary.counts).toMatchObject({ confirmed: 2, attention: 2, information: 0 });
  expect(summary.groups.every(group => group.section === 'confirmed')).toBe(true);
});

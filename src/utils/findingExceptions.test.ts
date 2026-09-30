import { describe, expect, it } from 'vitest';
import type { FindingException, ValidationIssue } from '../types/rack';
import { findingFingerprint, findingIdentity, getFindingAcceptance } from './findingExceptions';

const issue = (cause: Record<string, unknown>): ValidationIssue => ({
  id: 'power-device-a', ruleId: 'power-capacity', rootCauseKey: 'power:device-a',
  severity: 'warning', title: 'Check power', detail: 'Review supply', deviceIds: ['device-a'],
  status: 'unknown', applicability: 'active', cause,
});
const accepted = (finding: ValidationIssue): FindingException => ({
  ...findingIdentity(finding), id: 'exception-1', reason: 'Measured during commissioning',
  acceptedAt: '2026-09-30T10:00:00.000Z',
});

describe('scoped finding exceptions', () => {
  it('canonicalizes nested cause keys while preserving materially different facts', () => {
    expect(findingFingerprint({ b: 2, a: { y: 4, x: 3 } })).toBe(findingFingerprint({ a: { x: 3, y: 4 }, b: 2 }));
    expect(findingFingerprint({ watts: 500 })).not.toBe(findingFingerprint({ watts: 501 }));
  });

  it('keeps acceptance for cosmetic changes when explicit cause is unchanged', () => {
    const original = issue({ watts: 500, rating: null });
    const changed = { ...original, title: 'Renamed rack', detail: 'New display wording', id: 'presentation-id' };
    expect(getFindingAcceptance({ findingExceptions: [accepted(original)] }, findingIdentity(changed)).state).toBe('accepted');
  });

  it('reopens a changed cause and retains original accepted reason for inspection', () => {
    const exception = accepted(issue({ watts: 500 }));
    const result = getFindingAcceptance({ findingExceptions: [exception] }, findingIdentity(issue({ watts: 700 })));
    expect(result).toEqual({ state: 'reopened', exception });
  });

  it('never transfers acceptance to another rule or target', () => {
    const original = issue({ watts: 500 });
    const layout = { findingExceptions: [accepted(original)] };
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, ruleId: 'different-rule' })).state).toBe('open');
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, rootCauseKey: 'power:device-b' })).state).toBe('open');
  });

  it('reopens an aggregate finding when newly affected equipment joins the same cause', () => {
    const original = { ...issue({ goal: 'required', modelCoverage: 'unmodeled' }), rootCauseKey: 'remote-recovery:layout' };
    const layout = { findingExceptions: [accepted(original)] };
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, deviceIds: ['device-a', 'device-b'] })).state).toBe('reopened');
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, cableIds: ['new-cable'] })).state).toBe('reopened');
  });

  it('does not reopen when affected target order changes', () => {
    const original = { ...issue({ watts: 500 }), deviceIds: ['device-a', 'device-b'], cableIds: ['cable-a', 'cable-b'] };
    expect(findingIdentity({ ...original, deviceIds: ['device-b', 'device-a'], cableIds: ['cable-b', 'cable-a'] })).toEqual(findingIdentity(original));
  });

  it('reopens when certainty or applicability changes, without equating unknown with pass', () => {
    const original = issue({ watts: 500 });
    const layout = { findingExceptions: [accepted(original)] };
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, status: 'fail' })).state).toBe('reopened');
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, applicability: 'optional' })).state).toBe('reopened');
    expect(findingIdentity({ ...original, status: undefined }).fingerprint).toContain('unknown');
  });

  it('uses conservative scoped detail for rules with no cause metadata', () => {
    const original = { ...issue({}), cause: undefined };
    const layout = { findingExceptions: [accepted(original)] };
    expect(getFindingAcceptance(layout, findingIdentity({ ...original, detail: 'Changed required rating' })).state).toBe('reopened');
  });
});

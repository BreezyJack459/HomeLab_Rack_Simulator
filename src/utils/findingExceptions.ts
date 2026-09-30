import type { FindingException, RackLayout, ValidationIssue } from '../types/rack';

export interface FindingIdentity {
  ruleId: string;
  targetKey: string;
  fingerprint: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Relevant cause evidence only: callers must not include the entire layout or timestamps. */
export function findingFingerprint(evidence: unknown): string {
  // Retain the canonical evidence rather than a lossy digest: two distinct
  // causes must never share an accepted review due to a hash collision.
  return `v1:${canonical(evidence)}`;
}

export function findingIdentity(issue: ValidationIssue): FindingIdentity {
  const targets = {
    devices: [...(issue.deviceIds ?? [])].sort(),
    cables: [...(issue.cableIds ?? [])].sort(),
    rack: issue.editTarget?.rackId,
  };
  return {
    ruleId: issue.ruleId ?? issue.id,
    targetKey: issue.rootCauseKey ?? canonical(targets),
    fingerprint: findingFingerprint({
      status: issue.status ?? 'unknown',
      applicability: issue.applicability ?? 'active',
      // A stable root can gain affected equipment. An earlier review must
      // not automatically accept new targets even when its cause is equal.
      targets,
      // Legacy rules have no structured evidence. Changed scoped wording is
      // conservatively reviewed again; explicit cause avoids cosmetic edits.
      cause: issue.cause ?? { title: issue.title, detail: issue.detail },
    }),
  };
}

export function getFindingAcceptance(layout: Pick<RackLayout, 'findingExceptions'>, identity: FindingIdentity): {
  state: 'open' | 'accepted' | 'reopened';
  exception?: FindingException;
} {
  const scoped = (layout.findingExceptions ?? []).filter(record =>
    record.ruleId === identity.ruleId && record.targetKey === identity.targetKey);
  const match = scoped.find(record => record.fingerprint === identity.fingerprint);
  if (match) return { state: 'accepted', exception: match };
  if (scoped.length) return { state: 'reopened', exception: scoped[scoped.length - 1] };
  return { state: 'open' };
}

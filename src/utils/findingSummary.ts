import type { FindingException, RackLayout, ValidationIssue } from '../types/rack';
import { findingIdentity, getFindingAcceptance } from './findingExceptions';
import { isThermalIssue } from './issueCategories';

export type FindingTopic = 'overview' | 'thermal' | 'power' | 'capacity' | 'weight' | 'cable';
export type FindingSection = 'confirmed' | 'verification' | 'information' | 'accepted';
export const findingSectionLabels: Record<FindingSection, string> = { confirmed: 'Confirmed issues', verification: 'Needs verification', information: 'Optional information', accepted: 'Accepted exceptions' };
export type FindingGroup = {
  key: string;
  representative: ValidationIssue;
  issues: ValidationIssue[];
  deviceIds: string[];
  cableIds: string[];
  status: 'pass' | 'fail' | 'unknown';
  severity: ValidationIssue['severity'];
  applicability: 'active' | 'optional' | 'not-applicable';
  acceptance: 'open' | 'accepted' | 'reopened';
  exception?: FindingException;
  section: FindingSection;
};

export const issueMatchesCategory = (issue: ValidationIssue, category: FindingTopic): boolean => {
  if (category === 'cable') return !!issue.cableIds?.length || /^(cable-|patch-|structured-|duplicate-port-|invalid-port-|stale-endpoint-|outlet-|endpoint-switch-)/.test(issue.id);
  if (category === 'thermal') return isThermalIssue(issue);
  if (category === 'power') return /^(power-|circuit-|redundancy-|dual-psu-|pdu-|outlet-|no-power-|unused-power-)/.test(issue.id);
  if (category === 'weight') return /^(weight-|heavy-|center-of-gravity)/.test(issue.id);
  if (category === 'capacity') return /^(installation-|bounds-|overlap-|width-|depth-|reservation-|physical-height-|tray-height-|zone-|shelf-|front-rear-collision-)/.test(issue.id);
  return true;
};

const unique = (values: string[]) => [...new Set(values)].sort();
const statusRank = { fail: 0, unknown: 1, pass: 2 };
const severityRank = { critical: 0, warning: 1, info: 2 };
const sectionRank = { confirmed: 0, verification: 1, information: 2, accepted: 3 };

/** A queue of root actions; raw checks remain available within each group. */
export const summarizeFindings = (issues: ValidationIssue[], layout?: Pick<RackLayout, 'findingExceptions'>) => {
  const buckets = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    // Untagged checks stay independent: a shared title does not establish a cause.
    const key = issue.rootCauseKey ?? issue.id;
    buckets.set(key, [...(buckets.get(key) ?? []), issue]);
  }
  const groups: FindingGroup[] = [...buckets].map(([key, children]) => {
    const sorted = [...children].sort((a, b) => statusRank[a.status ?? 'unknown'] - statusRank[b.status ?? 'unknown'] || severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));
    const first = sorted[0];
    const severity = [...sorted].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])[0].severity;
    const deviceIds = unique(sorted.flatMap(issue => issue.deviceIds ?? []));
    const cableIds = unique(sorted.flatMap(issue => issue.cableIds ?? []));
    const status: FindingGroup['status'] = sorted.some(issue => issue.status === 'fail') ? 'fail' : sorted.every(issue => issue.status === 'pass') ? 'pass' : 'unknown';
    const applicability: FindingGroup['applicability'] = sorted.some(issue => (issue.applicability ?? (issue.severity === 'info' ? 'optional' : 'active')) === 'active') ? 'active' : sorted.some(issue => (issue.applicability ?? (issue.severity === 'info' ? 'optional' : 'active')) === 'optional') ? 'optional' : 'not-applicable';
    const representative: ValidationIssue = first.rootCauseKey ? {
      ...first, deviceIds, cableIds, status, applicability, severity, evidence: status === 'fail' ? undefined : first.evidence,
      ruleId: `group:${key.split(':')[0]}`,
      cause: { findings: sorted.map(findingIdentity).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) },
    } : { ...first, deviceIds, cableIds, status, applicability, severity };
    const review = layout ? getFindingAcceptance(layout, findingIdentity(representative)) : { state: 'open' as const };
    const acceptance = review.state;
    const section: FindingSection = acceptance === 'accepted' ? 'accepted' : status === 'fail' ? 'confirmed' : applicability !== 'active' || status === 'pass' ? 'information' : 'verification';
    return { key, representative, issues: sorted, deviceIds, cableIds, status, applicability, severity, acceptance, exception: review.exception, section };
  }).sort((a, b) => sectionRank[a.section] - sectionRank[b.section] || severityRank[a.severity] - severityRank[b.severity] || a.key.localeCompare(b.key));
  const count = (section: FindingSection) => groups.filter(group => group.section === section).length;
  const counts = { confirmed: count('confirmed'), verification: count('verification'), information: count('information'), accepted: count('accepted'), attention: count('confirmed') + count('verification'), raw: issues.length, roots: groups.length };
  return { groups, counts };
};

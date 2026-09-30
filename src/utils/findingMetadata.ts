import type { ValidationIssue } from '../types/rack';

// Explicit rule identities, independent of localized titles and device-id spelling.
const rules = [
  'missing-cable-device', 'reservation-bounds', 'reservation-overlap', 'zone-0u',
  'physical-height', 'tray-load', 'tray-height', 'weight-limit', 'weight-near-limit',
  'power-limit', 'power-near-limit', 'center-of-gravity-high', 'cable-length-review',
  'cable-short', 'duplicate-port', 'power-capacity-unknown', 'power-assumption',
  'front-rear-collision', 'heavy-over-light', 'heat-cluster', 'cable-clutter',
  'unsupported-zero-u', 'bounds', 'overlap', 'width', 'depth', 'ups-high', 'heavy-high',
  'airflow', 'shelf', 'connector', 'power-attribution', 'speed-mismatch', 'media-incompatible', 'cable-media-mismatch',
  'patch-jack-dark', 'patch-jack-unpatched', 'network-0u', 'power-no-pdu', 'power-front', 'power-nearer-pdu',
  'endpoint-switch-direct', 'patch-front-endpoint', 'patch-rear-switch', 'structured-no-panel', 'structured-front',
  'patch-invalid-pair', 'patch-rear', 'network-direct', 'printed-width', 'printed-collision', 'printed-depth', 'printed-load',
];
const recordedConflicts = new Set([
  'missing-cable-device', 'reservation-bounds', 'reservation-overlap', 'zone-0u',
  'physical-height', 'tray-load', 'tray-height', 'weight-limit',
  'power-limit', 'duplicate-port', 'front-rear-collision',
  'bounds', 'overlap', 'width', 'depth', 'media-incompatible',
  'network-0u', 'patch-front-endpoint', 'patch-rear-switch', 'structured-no-panel',
  'structured-front', 'patch-invalid-pair', 'patch-rear', 'printed-width', 'printed-collision',
]);

/** Unknown is the conservative default; severity alone never proves a conflict. */
export const annotateFinding = (issue: ValidationIssue): ValidationIssue => {
  const targetIds = [...(issue.deviceIds ?? []), ...(issue.cableIds ?? [])].sort((a, b) => b.length - a.length);
  const stableId = targetIds.reduce((id, target) => id.endsWith(`-${target}`) ? id.slice(0, -(target.length + 1)) : id, issue.id);
  const ruleId = issue.ruleId ?? rules.find(rule => issue.id === rule || issue.id.startsWith(`${rule}-`)) ?? stableId;
  const status = issue.status ?? (issue.evidence === 'unverified' ? 'unknown'
    : recordedConflicts.has(ruleId) || ruleId.startsWith('installation-') || ruleId === 'connector' ? 'fail' : 'unknown');
  const scope = issue.cableIds?.length ? `cable:${[...issue.cableIds].sort().join(',')}`
    : issue.deviceIds?.length ? `device:${[...issue.deviceIds].sort().join(',')}` : 'layout';
  return {
    ...issue, ruleId, status,
    applicability: issue.applicability ?? (issue.severity === 'info' && issue.evidence !== 'unverified' || ['ups-high', 'heavy-high', 'airflow', 'heat-cluster', 'cable-clutter', 'center-of-gravity-high', 'power-near-limit', 'weight-near-limit', 'power-front', 'power-nearer-pdu', 'speed-mismatch'].includes(ruleId) || ruleId.startsWith('route-') ? 'optional' : 'active'),
    rootCauseKey: issue.rootCauseKey ?? (ruleId.startsWith('installation-') && status === 'unknown'
      ? `installation-review:${scope}` : ruleId === 'connector' && issue.cableIds?.length === 1
        ? `power-connection:${issue.cableIds[0]}` : `${ruleId}:${scope}`),
  };
};

import type { ValidationIssue } from '../types/rack';

export type IssuePropertyTarget = { section: string; field?: string };

/** Route by validation rule identity, never by user-controlled device names. */
export const propertyTargetForIssue = (issue: ValidationIssue): IssuePropertyTarget | undefined => {
  const id = issue.id;
  if (id.startsWith('installation-')) return { section: 'Installation requirements', field: id.startsWith('installation-kit-') ? 'Installed mounting kit / shelf model' : id.startsWith('installation-rails-') ? 'Rail minimum spacing (mm)' : 'Required mounting support' };
  if (id.startsWith('power-ups-backup-')) return { section: 'Socket specifications' };
  if (id.startsWith('power-poe-')) return { section: 'Socket specifications' };
  if (/^(power-assumption-|power-capacity-unknown-)/.test(id)) return { section: 'Power & Lifecycle', field: id.startsWith('power-capacity-unknown-') ? 'Rated output capacity (W)' : id.startsWith('power-assumption-') ? 'Planning power (W)' : undefined };
  if (id.startsWith('depth-')) return { section: 'Dimensions & placement', field: 'Depth mm' };
  if (id.startsWith('width-')) return { section: 'Dimensions & placement' };
  if (/^(bounds-|overlap-|heavy-|ups-high-|tray-|physical-height-|shelf-|zone-|airflow-|heat-)/.test(id)) return { section: 'Dimensions & placement' };
  if (/^(dual-psu-|redundancy-|circuit-)/.test(id)) return { section: 'Power & Lifecycle' };
  return undefined;
};

export const issueGroupTitle = (issue: ValidationIssue): string => {
  if (issue.evidence !== 'unverified') return issue.title;
  if (issue.id.startsWith('cable-strain-')) return 'Service cable length needs review';
  if (issue.id.startsWith('cable-length-review-')) return 'Cable length needs review';
  const installationGroups: Record<string, string> = {
    requirements: 'Installation requirements not recorded',
    rails: 'Rail fit needs verification',
    kit: 'Mounting hardware not recorded',
    clearance: 'Rear cable allowance needs verification',
  };
  const rule = /^installation-(requirements|rails|kit|clearance)-/.exec(issue.id)?.[1];
  return rule ? installationGroups[rule] : issue.title;
};

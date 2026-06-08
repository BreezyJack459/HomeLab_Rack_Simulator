import type { AppWorkspace, AuditLens } from '../types/appShell';
import type { ValidationIssue } from '../types/rack';
import { WORKSPACE_META } from '../types/panelRegistry';

export function getInspectorTitle(
  currentWorkspace: AppWorkspace,
  selectedIssue: ValidationIssue | null
): string {
  if (currentWorkspace === 'audit' && selectedIssue) {
    return selectedIssue.title;
  }
  return WORKSPACE_META[currentWorkspace].title;
}

export function getInspectorDescription(
  currentWorkspace: AppWorkspace,
  currentAuditLens: AuditLens,
  hasSelection: boolean,
  selectedIssue: ValidationIssue | null
): string {
  if (currentWorkspace === 'model') {
    return hasSelection
      ? 'Selection-first inspector for the current device, cable and port context.'
      : 'Choose a device or cable to unlock focused editing controls.';
  }

  if (currentWorkspace === 'audit') {
    if (selectedIssue) {
      return 'The audit inspector is pinned to the selected issue so validation and serviceability stay in context.';
    }
    if (currentAuditLens === 'serviceability') {
      return 'Use the serviceability inspector to focus pull-out blockers, collisions and maintenance access.';
    }
    if (currentAuditLens === 'documentation') {
      return 'Use the validation inspector to work through documentation and label drift without leaving the audit view.';
    }
    if (currentAuditLens === 'thermal') {
      return 'Thermal and power checks stay visible while the main area shows the broader audit evidence.';
    }
    if (currentAuditLens === 'domains') {
      return 'Track redundancy and assignment gaps while keeping validation close at hand.';
    }
    return 'Review layout health, risks and validation issues without digging through one giant sidebar.';
  }

  return WORKSPACE_META[currentWorkspace].description;
}

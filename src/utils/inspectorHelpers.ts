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
      : 'Pick a next step, or select a device or cable to show detailed settings.';
  }

  if (currentWorkspace === 'audit') {
    if (selectedIssue) {
      return 'Focused on the selected issue, with validation and serviceability controls kept nearby.';
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
    return 'Start with the issue queue, then open deeper checks only when you need them.';
  }

  return WORKSPACE_META[currentWorkspace].description;
}

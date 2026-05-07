import type { ValidationIssue } from '../types/rack';

export function recommendationForIssue(issue: ValidationIssue): string {
  if (issue.id.startsWith('power-front-')) {
    return 'Move the powered device to the rear side, or mark its power port as rear-facing before routing to the PDU.';
  }
  if (issue.id.startsWith('endpoint-switch-direct-')) {
    return 'Replace the direct endpoint-to-switch run with endpoint -> patch panel rear, then patch panel front -> switch.';
  }
  if (issue.id.startsWith('patch-front-endpoint-')) {
    return 'Select the patch panel rear port for endpoint structured cabling.';
  }
  if (issue.id.startsWith('patch-rear-switch-')) {
    return 'Select the patch panel front port for switch patch cables.';
  }
  if (issue.id.startsWith('structured-')) {
    return 'Use a structured cable only between an endpoint and a patch panel rear port.';
  }
  if (issue.id.startsWith('patch-')) {
    return 'Use patch cables only between a patch panel front port and a switch front port.';
  }
  if (issue.id.startsWith('duplicate-port-')) {
    return 'Open the cable picker and move one route to an unused port.';
  }
  if (issue.id.startsWith('power-nearer-pdu-')) {
    return 'Reconnect this power route to the closest PDU feed, or keep it if you intentionally need feed balancing.';
  }
  if (issue.id.startsWith('width-')) {
    return 'Switch the device to shelf/custom width, use an adapter shelf, or move it to a wider rack type.';
  }
  if (issue.id.startsWith('depth-')) {
    return 'Increase configured rack depth or choose a shallower device.';
  }
  if (issue.id.startsWith('airflow-') || issue.id.startsWith('heat-cluster-')) {
    return 'Add a blank panel, cable manager, or free U gap near the hot device.';
  }
  if (issue.id.startsWith('shelf-')) {
    return 'Add a shelf in the same side and overlapping horizontal footprint.';
  }
  if (issue.id === 'power-limit') {
    return 'Raise the power budget, reduce device load, or split power across a second feed.';
  }
  if (issue.id === 'weight-limit') {
    return 'Move heavy gear lower, reduce total rack load, or raise the rack weight limit.';
  }
  return 'Select this issue to highlight the related device or cable, then adjust placement, port side, or route type.';
}

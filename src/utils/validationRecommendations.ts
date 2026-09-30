export function recommendationForIssue(issue: { id: string; severity?: string }): string {
  if (issue.id.startsWith('power-ups-backup-')) return 'Open the UPS device → Socket specifications. Select the connected output socket and record whether it is battery-backed or surge-only. Leave unknown until verified against your exact model and outlet markings.';
  if (issue.id.startsWith('power-poe-')) return 'Open the affected device → Socket specifications. Verify PoE roles, common supported profile, per-port limit, total source budget and receiver allocation at the PSE. Edit device switches to the correct rack for cross-rack supplies. Reduce assigned load or use adequately rated equipment; do not increase a rating just to clear this warning.';
  if (issue.id.startsWith('connector-')) return 'Record socket specs under device properties → Socket specifications, then record the socket type each installed cable end fits in cable details. Resolve input/output, voltage and polarity conflicts; generic port types do not prove physical compatibility.';
  if (issue.id.startsWith('installation-')) return 'Open device properties → Installation requirements. Record the required support, rail range and installed kit. In Check → Serviceability → Depth Compatibility, enter measured mounting-post spacing. Recheck cabinet depth after changing clearances.';
  if (issue.id.startsWith('power-assumption-')) return 'Open device properties → Power & Lifecycle. Set the planning watts and basis, then confirm you reviewed the value for your hardware and workload.';
  if (issue.id.startsWith('outlet-conflicting-assignment-')) {
    return 'Review the selected power socket and legacy outlet assignment. Reconnect this cable to the intended free socket to remove the conflicting legacy record.';
  }
  if (issue.id.startsWith('power-front-')) {
    return 'Move the powered device to the rear side, or mark its power port as rear-facing before routing to the PDU.';
  }
  if (issue.id.startsWith('endpoint-switch-direct-')) {
    if (issue.severity === 'info') return 'No change is required for a homelab direct link. Optionally add a patch panel to organize permanent cable runs.';
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
  if (issue.id.startsWith('overlap-')) {
    return 'Move or resize one of the overlapping components. Planned devices can overlap temporarily but must be resolved before deployment.';
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
    return 'Add a shelf on the same side and overlapping horizontal footprint, or select 3D-printed rack mount in Properties if the device has a supporting mount.';
  }
  if (issue.id.startsWith('cable-strain-')) {
    return 'Use a longer cable or add a service loop so the device can be pulled out for maintenance.';
  }
  if (issue.id.startsWith('front-rear-collision-')) {
    return 'Move one device to a different U position or mount both on the same side.';
  }
  if (issue.id.startsWith('heavy-over-light-')) {
    return 'Swap the devices so the heavier unit is below, or leave a larger gap for service access.';
  }
  if (issue.id === 'center-of-gravity-high') {
    return 'Move heavy devices to lower U positions, or add ballast near the bottom of the rack.';
  }
  if (issue.id.startsWith('missing-label-')) {
    return 'Open the Properties panel and add a descriptive label to the device.';
  }
  if (issue.id.startsWith('no-power-')) {
    return 'Add a power cable from this device to a PDU or UPS.';
  }
  if (issue.id.startsWith('no-network-')) {
    return 'Connect this device to a switch or patch panel with an Ethernet or fiber cable.';
  }
  if (issue.id.startsWith('unused-power-ports-')) {
    return 'Consider adding redundant power cables for high-availability if the device supports dual PSU.';
  }
  if (issue.id.startsWith('incomplete-port-map-')) {
    return 'Open the Properties panel and add a more accurate port count or explicit front/rear mapping for this custom device.';
  }
  if (issue.id.startsWith('missing-endpoint-labels-')) {
    return 'Edit the cable and assign both endpoint ports so future label exports and audits stay consistent.';
  }
  if (issue.id.startsWith('invalid-port-map-')) {
    return 'Fix the device port count or move the cable onto a valid port index.';
  }
  if (issue.id.startsWith('stale-endpoint-')) {
    return 'Delete the stale cable route or reconnect it to devices that still exist in the layout.';
  }
  if (issue.id === 'power-limit') {
    return 'Reduce device load or provide a suitably rated power feed. Change the configured budget only after verifying the actual supply and protection ratings.';
  }
  if (issue.id === 'weight-limit') {
    return 'Reduce the total installed weight or use a rack with a verified higher load rating. Moving equipment lower improves stability but does not reduce total weight.';
  }
  return 'Select this issue to highlight the related device or cable, then adjust placement, port side, or route type.';
}

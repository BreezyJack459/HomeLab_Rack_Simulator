import { canShareShelf, isTrayShelf, getDeviceMountSide, getDeviceXRange } from './rackMath';
import type { PlacedDevice, RackLayout, ValidationIssue } from '../types/rack';

export type InstallationCheck = { id: string; status: 'passed' | 'failed' | 'unknown'; detail: string };

export const getSupportingShelf = (layout: RackLayout, device: PlacedDevice): PlacedDevice | undefined => layout.devices.find(shelf => {
  if (shelf.category !== 'shelf' || shelf.id === device.id) return false;
  if (isTrayShelf(shelf)) return canShareShelf(layout, shelf, device);
  if (getDeviceMountSide(shelf) !== getDeviceMountSide(device) || shelf.positionU + shelf.sizeU !== device.positionU) return false;
  const base = getDeviceXRange(layout, shelf);
  const body = getDeviceXRange(layout, device);
  return body.x >= base.x && body.x + body.width <= base.x + base.width && device.depthMm + (device.mountEnvelopeMm ?? 0) <= shelf.depthMm;
});

/** Checks only recorded installation constraints; chassis fit is evaluated separately. */
export const getInstallationChecks = (layout: RackLayout, device: PlacedDevice): InstallationCheck[] => {
  const requirements = device.installationRequirements;
  if (!requirements || requirements.support === 'unknown') return [{
    id: 'requirements', status: 'unknown', detail: 'Installation requirements are not recorded. Chassis dimensions alone do not confirm rails, brackets or mounting hardware.',
  }];
  const checks: InstallationCheck[] = [];
  if (requirements.support === 'rails') {
    const min = requirements.railMinMm;
    const max = requirements.railMaxMm;
    const spacing = layout.mountingPostSpacingMm;
    if (min !== undefined && max !== undefined && min > max) {
      checks.push({ id: 'rails', status: 'failed', detail: 'The recorded rail minimum exceeds its maximum. Correct the equipment requirements.' });
    } else if (spacing === undefined || min === undefined || max === undefined) {
      checks.push({ id: 'rails', status: 'unknown', detail: `Rail fit unverified: record measured front-to-rear mounting-post spacing and both limits of the equipment rail kit${min !== undefined && max !== undefined ? ` (${min}–${max} mm)` : ''}. Cabinet depth is not post spacing.` });
    } else if (spacing > layout.rackDepthMm) {
      checks.push({ id: 'rails', status: 'failed', detail: `Recorded post spacing ${spacing} mm exceeds cabinet depth ${layout.rackDepthMm} mm. Recheck the measurements.` });
    } else if (spacing < min || spacing > max) {
      checks.push({ id: 'rails', status: 'failed', detail: `${spacing} mm mounting-post spacing is outside the ${min}–${max} mm rail range. ${spacing < min ? `Increase spacing by at least ${(min - spacing).toFixed(1)}` : `Reduce spacing by at least ${(spacing - max).toFixed(1)}`} mm, within the cabinet's adjustment limits, or choose compatible rails.` });
    } else {
      checks.push({ id: 'rails', status: 'passed', detail: `${spacing} mm mounting-post spacing fits the recorded ${min}–${max} mm rail range.` });
    }
  }
  if (requirements.support === 'shelf' || requirements.support === 'printed-mount') {
    const actual = device.mountingSupport ?? 'shelf';
    checks.push({ id: 'support', status: actual === requirements.support ? 'passed' : 'failed',
      detail: actual === requirements.support ? `Selected support matches ${requirements.support}; physical support and load checks still apply.` : `This device requires ${requirements.support}, but its selected support is ${actual}.` });
  }
  if (requirements.support === 'shelf') {
    const shelf = getSupportingShelf(layout, device);
    checks.push({ id: 'shelf', status: shelf ? 'passed' : 'failed', detail: shelf ? `The full device footprint is supported by ${shelf.name}; verify the shelf's load rating.` : 'No shelf supports the full device footprint directly below it (or at the same U for a tray). Check width, depth, mounting side and position.' });
  }
  checks.push({ id: 'kit', status: device.installationKit?.trim() ? 'passed' : 'unknown',
    detail: device.installationKit?.trim() ? `User-recorded mounting hardware: ${device.installationKit}. Kit authenticity, fasteners and load rating are not independently verified.` : 'Record the installed rail, bracket, shelf or mount model. Required mounting hardware has not been confirmed.' });
  if (requirements.rearClearanceMm !== undefined) {
    const available = layout.rearClearanceMm;
    checks.push({ id: 'clearance', status: available === undefined ? 'unknown' : available >= requirements.rearClearanceMm ? 'passed' : 'failed',
      detail: available === undefined ? `Rear cable allowance is unrecorded; this device requires ${requirements.rearClearanceMm} mm.` : available >= requirements.rearClearanceMm ? `Allocated rear cable allowance ${available} mm meets the recorded ${requirements.rearClearanceMm} mm requirement.` : `Rear cable allowance is short by ${(requirements.rearClearanceMm - available).toFixed(1)} mm (${available} / ${requirements.rearClearanceMm} mm). Increasing it reduces usable chassis depth.` });
  }
  return checks;
};

export const getInstallationIssues = (layout: RackLayout): ValidationIssue[] => layout.devices.flatMap(device =>
  getInstallationChecks(layout, device).filter(check => check.status !== 'passed').map(check => ({
    id: `installation-${check.id}-${device.id}`,
    severity: 'warning' as const,
    evidence: check.status === 'unknown' ? 'unverified' as const : undefined,
    title: check.status === 'failed' ? `${device.name}: installation requirement not met` : `${device.name}: installation unverified`,
    detail: check.detail, deviceIds: [device.id],
  }))
);

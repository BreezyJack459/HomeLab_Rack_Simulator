import type { RackLayout, Workspace } from '../types/rack';
import { isDeviceWithinRack } from './rackMath';

/** Read-only impact report. Dependent record paths expose identifiers, never record contents. */
export const getRackResizeImpact = (layout: RackLayout, heightU: number, workspace: Workspace) => {
  const devices = layout.devices.filter(d => !isDeviceWithinRack({ ...layout, heightU }, d));
  const deviceIds = new Set(devices.map(d => d.id));
  const reservations = (layout.reservations ?? []).filter(r => r.positionU + r.sizeU - 1 > heightU);
  const cables = layout.cables.filter(c => deviceIds.has(c.fromDeviceId) || deviceIds.has(c.toDeviceId) ||
    c.manualPath?.some(a => a.kind === 'manager' && deviceIds.has(a.deviceId)));
  const interRackCables = workspace.interRackCables.filter(c =>
    (c.fromRackId === layout.id && deviceIds.has(c.fromDeviceId)) ||
    (c.toRackId === layout.id && deviceIds.has(c.toDeviceId)));
  const ids = new Set([...deviceIds, ...reservations.map(r => r.id), ...cables.map(c => c.id), ...interRackCables.map(c => c.id)]);
  const dependentRecords: string[] = [];
  const references = (value: unknown): boolean => {
    if (typeof value === 'string') return ids.has(value);
    if (!value || typeof value !== 'object') return false;
    return Object.values(value).some(references);
  };
  for (const [key, value] of Object.entries(layout)) {
    if (key === 'devices') {
      layout.devices.forEach((d, i) => {
        if (!deviceIds.has(d.id) && references(d)) dependentRecords.push(`devices[${i}]`);
      });
    } else if (!['cables', 'reservations'].includes(key)) {
      if (Array.isArray(value)) value.forEach((record, i) => {
        if (references(record)) dependentRecords.push(`${key}[${i}]`);
      });
      else if (references(value)) dependentRecords.push(key);
    }
  }
  return { devices, cables, reservations, interRackCables, dependentRecords };
};

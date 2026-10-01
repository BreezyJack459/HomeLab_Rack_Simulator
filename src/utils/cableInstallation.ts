import type { CableRoute, RackLayout } from '../types/rack';

/** Legacy cables retain their inferred roles. Explicit intent never changes socket compatibility. */
export const installationRoleError = (layout: RackLayout, cable: CableRoute): string | null => {
  if (cable.installationRole === undefined) return null;
  if (!['patch-cord', 'permanent-link'].includes(cable.installationRole)) return 'Invalid cable installation role.';
  const ends = [[cable.fromDeviceId, cable.fromPort], [cable.toDeviceId, cable.toPort]] as const;
  if (ends.some(([id, port]) => { const d = layout.devices.find(d => d.id === id); return !d || !port || !Number.isInteger(port.index) || port.index < 0 || port.index >= (d.ports?.ethernet ?? 0); })) return 'Installation roles require existing Ethernet devices and socket indices.';
  const panels = ends.filter(([id]) => layout.devices.find(d => d.id === id)?.category === 'patch-panel');
  if (!ends.every(([, port]) => port?.type === 'ethernet')) return 'Installation roles require two Ethernet sockets.';
  if (cable.installationRole === 'patch-cord') {
    if (!['patch', 'ethernet'].includes(cable.type) || panels.some(([, port]) => port?.side !== 'front')) return 'Patch cords use panel front sockets and patch/Ethernet cable type.';
  } else {
    if (cable.type !== 'structured' || !panels.length || panels.some(([, port]) => port?.side !== 'rear')) return 'Permanent links require a panel rear socket and structured cable type.';
    if (ends.some(([id]) => layout.devices.find(d => d.id === id)?.category === 'switch')) return 'Switches cannot terminate permanent links on panel rear sockets.';
  }
  return null;
};

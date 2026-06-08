/**
 * Shared pairing state types — used by CablePlanner (2D) and CableViewer3D (3D raycast).
 * Kept in types/ so both components can import without circular deps.
 */

import type { CableType, PortRef, PortType } from './rack';

export type PairingStage =
  | 'idle'
  | 'selecting_source_device'
  | 'selecting_source_port'
  | 'selecting_dest_device'
  | 'selecting_dest_port';

export function isSelectingSource(stage: PairingStage): boolean {
  return stage === 'selecting_source_device' || stage === 'selecting_source_port';
}

export function isSelectingDest(stage: PairingStage): boolean {
  return stage === 'selecting_dest_device' || stage === 'selecting_dest_port';
}

export type PairingSource = {
  deviceId: string;
  deviceName: string;
  port: PortRef;
  label: string;
};

/** A resolved 3D port hit — what DevicePortFace returns on pointer down */
export type PortHit3D = {
  deviceId: string;
  portType: PortType;
  portIndex: number;
  face: 'front' | 'rear';
  cableTypes: CableType[];
};

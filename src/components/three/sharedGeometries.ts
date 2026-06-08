import { BoxGeometry, SphereGeometry, TorusGeometry } from 'three';

export const UNIT_BOX_GEOMETRY = new BoxGeometry(1, 1, 1);
export const DEBUG_SPHERE_GEOMETRY = new SphereGeometry(1, 8, 8);
export const VCM_FINGER_GEOMETRY = new TorusGeometry(0.022, 0.004, 6, 12, Math.PI);

export type RackType = '10in' | '19in';
export type WidthType = RackType | 'shelf' | 'custom';
export type ViewSide = 'front' | 'rear';
export type ViewMode = '2d' | '3d' | 'cables';
export type SpatialZone = 'front' | 'rear' | 'side-left' | 'side-right' | 'rear-left' | 'rear-right';
export type HeatLevel = 1 | 2 | 3 | 4 | 5;
export type ZeroUMountType = 'side-rail' | 'rear-rail';
export type ZeroUMountSide = 'left' | 'right';
export type OutletFacing = 'inward' | 'outward' | 'forward';
export type CableType = 'ethernet' | 'power' | 'fiber' | 'usb' | 'hdmi' | 'atx' | 'coax' | 'structured' | 'patch';

export type DeviceCategory =
  | 'patch-panel'
  | 'switch'
  | 'router'
  | 'firewall'
  | 'modem'
  | 'access-point'
  | 'poe-injector'
  | 'mini-pc'
  | 'nas'
  | 'server'
  | 'ups'
  | 'pdu'
  | 'pdu-0u'
  | 'shelf'
  | 'cable-management'
  | 'blank'
  | 'sbc'
  | 'ip-kvm'
  | 'custom';

export interface PortLayout {
  ethernet?: number;
  fiber?: number;
  usb?: number;
  power?: number;
  hdmi?: number;
  atx?: number;
  coax?: number;
  layoutColumns?: number;
}

export interface DeviceTemplate {
  id: string;
  category: DeviceCategory;
  name: string;
  defaultU: number;
  rackMountable?: boolean;
  depthMm: number;
  widthType: WidthType;
  customWidthMm?: number;
  weightKg: number;
  powerW: number;
  heatLevel: HeatLevel;
  ports?: PortLayout;
  portFaceOverrides?: Record<string, 'front' | 'rear'>;
  portLayouts?: {
    front?: PortTypeConfig[];
    rear?: PortTypeConfig[];
  };
  mountType?: ZeroUMountType;
  mountSide0U?: ZeroUMountSide;
  outletFacing?: OutletFacing;
  color: string;
  description: string;
}

export type LifecycleStatus = 'active' | 'planned' | 'decommissioning';
export type ShutdownPriority = 'critical' | 'graceful' | 'non-critical';

export interface PlacedDevice {
  id: string;
  templateId?: string;
  category: DeviceCategory;
  name: string;
  mountSide?: ViewSide;
  spatialZone?: SpatialZone;
  positionU: number;
  xMm?: number;
  sizeU: number;
  depthMm: number;
  widthType: WidthType;
  customWidthMm?: number;
  weightKg: number;
  powerW: number;
  heatLevel: HeatLevel;
  ports?: PortLayout;
  portFaceOverrides?: Record<string, 'front' | 'rear'>;
  portLayouts?: {
    front?: PortTypeConfig[];
    rear?: PortTypeConfig[];
  };
  mountType?: ZeroUMountType;
  mountSide0U?: ZeroUMountSide;
  outletFacing?: OutletFacing;
  color: string;
  label?: string;
  description?: string;
  lifecycleStatus?: LifecycleStatus;
  shutdownPriority?: ShutdownPriority;
  batteryWh?: number;
  circuit?: 'A' | 'B';
  noiseDb?: number;
}

export type PortType = 'ethernet' | 'fiber' | 'usb' | 'hdmi' | 'power' | 'atx' | 'coax';

export interface PortTypeConfig {
  type: PortType;
  count?: number;
  columns?: number;
  xRatio?: number; // 0 = left edge, 0.5 = center, 1 = right edge
}

export interface PortRef {
  type: PortType;
  index: number;
  side?: 'front' | 'rear';
}

export interface CableNode {
  type: 'device' | 'h-manager' | 'v-rail-left' | 'v-rail-right';
  deviceId: string;
  port?: PortRef;
}

export type CableRoutingDiscipline = 'patch' | 'structured' | 'power' | 'data';

export type CableWaypointRole =
  | 'port'
  | 'face-exit'
  | 'horizontal-manager'
  | 'vertical-manager'
  | 'side-tray'
  | 'service-loop'
  | 'drip-loop'
  | 'strain-relief';

export type CableRoutingWarningCode =
  | 'missing-manager'
  | 'power-data-separation'
  | 'bend-radius-risk'
  | 'tray-density'
  | 'patch-discipline'
  | 'pdu-side';

export type CableRoutingWarning = {
  code: CableRoutingWarningCode;
  severity: ValidationSeverity;
  message: string;
  deviceIds?: string[];
};

export type CableWaypoint = {
  id: string;
  role: CableWaypointRole;
  label: string;
  deviceId?: string;
  port?: PortRef;
  nodeType?: CableNode['type'];
  face?: 'front' | 'rear';
  rail?: 'left' | 'right';
};

export type CableSegment = {
  from: string;
  to: string;
  kind: 'port-exit' | 'manager-hop' | 'tray-run' | 'vertical-drop' | 'service-loop' | 'device-entry';
  separation: 'data' | 'power' | 'front' | 'rear';
  minBendRadiusMm: number;
  lengthMm: number;
};

export type CablePlan = {
  cableId: string;
  discipline: CableRoutingDiscipline;
  fromFace: 'front' | 'rear';
  toFace: 'front' | 'rear';
  rail: 'left' | 'right' | null;
  separation: 'data' | 'power';
  nodes: CableNode[];
  waypoints: CableWaypoint[];
  segments: CableSegment[];
  baseLengthMm: number;
  estimatedLengthMm: number;
  standardLengthMm: number;
  slackMm: number;
  render: {
    sagMm: number;
    serviceLoopMm: number;
    bendRadiusMm: number;
    lane: number;
    cableRadiusMm: number;
    bundleKey: string;
    tray: 'front' | 'rear' | 'side-left' | 'side-right';
  };
  warnings: CableRoutingWarning[];
  pathLabel: string;
};

export interface CableRoute {
  id: string;
  fromDeviceId: string;
  fromPort?: PortRef;
  toDeviceId: string;
  toPort?: PortRef;
  type: CableType;
  color: string;
  notes?: string;
  nodes?: CableNode[];
  lifecycleStatus?: LifecycleStatus;
  lengthMm?: number;
  length?: string; // Human-readable length e.g. '1m', '2m'
  bundleId?: string; // Groups cables into a visual bundle
}

export type RackReservationPurpose = 'future-device' | 'shelf' | 'patch-panel' | 'ups' | 'printed-mount' | 'clearance' | 'other';

export interface RackReservation {
  id: string;
  name: string;
  positionU: number;
  sizeU: number;
  mountSide: ViewSide;
  widthType: WidthType;
  customWidthMm?: number;
  xMm?: number;
  purpose: RackReservationPurpose;
  notes?: string;
}

export interface RackLayout {
  id: string;
  name: string;
  rackType: RackType;
  heightU: number;
  rackDepthMm: number;
  weightLimitKg: number;
  powerBudgetW: number;
  viewSide: ViewSide;
  devices: PlacedDevice[];
  cables: CableRoute[];
  reservations?: RackReservation[];
  updatedAt: string;
  rearClearanceMm?: number;
  frontDoorClearanceMm?: number;
  rearDoorClearanceMm?: number;
  railMinDepthMm?: number;
  railMaxDepthMm?: number;
  electricityRatePerKwh?: number;
}

export type ValidationSeverity = 'info' | 'warning' | 'critical';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  title: string;
  detail: string;
  deviceIds?: string[];
  cableIds?: string[];
}

export type RackType = '10in' | '19in';
export type WidthType = RackType | 'shelf' | 'custom';
export type ViewSide = 'front' | 'rear';
export type ViewMode = '2d' | '3d' | 'cables' | 'topology';
export type SpatialZone = 'front' | 'rear' | 'side-left' | 'side-right' | 'rear-left' | 'rear-right';
export type HeatLevel = 1 | 2 | 3 | 4 | 5;
export type ZeroUMountType = 'side-rail' | 'rear-rail';
export type ZeroUMountSide = 'left' | 'right';
export type OutletFacing = 'inward' | 'outward' | 'forward';
export type CableType = 'ethernet' | 'power' | 'fiber' | 'usb' | 'hdmi' | 'atx' | 'coax' | 'structured' | 'patch';

export type PortSpeed = '100M' | '1G' | '2.5G' | '5G' | '10G' | '25G' | '40G' | '100G';

export type MediaType = 'rj45' | 'sfp' | 'sfp+' | 'qsfp+' | 'dac' | 'fiber' | 'usb2' | 'usb3';

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
  | 'printed-mount'
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
export type LifecycleViewFilter = 'all' | 'active' | 'planned' | 'decommissioning' | 'changes';
export type ShutdownPriority = 'critical' | 'graceful' | 'non-critical';
export type ProcurementItemCategory = 'device' | 'cable' | 'rack-hardware' | 'rack-accessory' | 'power' | 'label' | 'printed-part';
export type ProcurementStatus = 'owned' | 'need-to-buy' | 'ordered' | 'printed' | 'installed';
export type ChecklistStatus = 'pending' | 'passed' | 'failed' | 'skipped';
export type ChangeRiskLevel = 'low' | 'medium' | 'high';
export type ChangeEventStatus = 'planned' | 'in-progress' | 'completed' | 'cancelled';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export type MaintenanceLogType = 'cleaning' | 'firmware' | 'repair' | 'inspection' | 'replacement' | 'other';

export interface MaintenanceLogEntry {
  id: string;
  date: string;
  type: MaintenanceLogType;
  description: string;
  partsUsed?: string;
  laborMinutes?: number;
  technician?: string;
  notes?: string;
}

export interface NetworkInterface {
  id: string;
  name: string;
  macAddress?: string;
  staticIp?: string;
  dhcpReservation?: boolean;
  vlanId?: number;
  subnet?: string;
  gateway?: string;
  dns?: string;
}

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
  bootDependsOn?: string[];
  bootDelaySeconds?: number;
  portAliases?: Record<string, string>;
  backups?: BackupRecord[];
  assetTag?: string;
  serialNumber?: string;
  purchaseDate?: string;
  vendor?: string;
  purchasePrice?: number;
  warrantyEndDate?: string;
  invoiceRef?: string;
  maintenanceLog?: MaintenanceLogEntry[];
  networkInterfaces?: NetworkInterface[];
  firmwareVersion?: string;
  firmwareLatest?: string;
  firmwareReleaseDate?: string;
  firmwareNotes?: string;
}

export interface BackupRecord {
  id: string;
  destination: string;
  lastBackupDate?: string;
  backupSizeGb?: number;
  lastRestoreTestDate?: string;
  lastRestoreTestResult?: 'pass' | 'fail' | 'skipped';
  rpoHours?: number;
  notes?: string;
}

export type PortType = 'ethernet' | 'fiber' | 'usb' | 'hdmi' | 'power' | 'atx' | 'coax';

export interface PortTypeConfig {
  type: PortType;
  count?: number;
  columns?: number;
  xRatio?: number; // 0 = left edge, 0.5 = center, 1 = right edge
  speed?: PortSpeed;
  mediaType?: MediaType;
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
  speed?: PortSpeed;
  mediaType?: MediaType;
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

export interface ProcurementItem {
  id: string;
  label: string;
  category: ProcurementItemCategory;
  quantity: number;
  unit?: string;
  status: ProcurementStatus;
  notes?: string;
  sourceKind?: 'device' | 'cable' | 'reservation' | 'generated' | 'manual';
  sourceIds?: string[];
}

export interface ChecklistRecord {
  id: string;
  status: ChecklistStatus;
  notes?: string;
  checkedAt?: string;
}

export interface LayoutBaselineMetrics {
  deviceCount: number;
  cableCount: number;
  occupiedU: number;
  freeU: number;
  reservedU: number;
  powerW: number;
  heatScore: number;
  noiseDb: number;
  freeNetworkPorts: number;
  freePowerPorts: number;
  validationIssues: number;
  documentationIssues: number;
  riskScore: number;
  documentationScore: number;
}

export interface RackLayoutSnapshot {
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
  rearClearanceMm?: number;
  frontDoorClearanceMm?: number;
  rearDoorClearanceMm?: number;
  railMinDepthMm?: number;
  railMaxDepthMm?: number;
  electricityRatePerKwh?: number;
  powerBillHistory?: PowerBillEntry[];
  spareParts?: SparePart[];
  cleaningSchedule?: CleaningSchedule;
}

export interface RackGoldenBaseline {
  name: string;
  capturedAt: string;
  snapshot: RackLayoutSnapshot;
  metrics: LayoutBaselineMetrics;
}

export interface RackChangeEvent {
  id: string;
  title: string;
  scheduledFor: string;
  riskLevel: ChangeRiskLevel;
  expectedDowntimeMin?: number;
  owner?: string;
  notes?: string;
  rollbackNotes?: string;
  status: ChangeEventStatus;
  affectedDeviceIds?: string[];
  affectedCableIds?: string[];
  requiresReadiness?: boolean;
  requiresCommissioning?: boolean;
}

export interface ChangeRequest {
  id: string;
  title: string;
  description?: string;
  riskLevel: ChangeRiskLevel;
  expectedDowntimeMin?: number;
  rollbackPlan?: string;
  status: ChangeRequestStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  affectedDeviceIds?: string[];
  affectedCableIds?: string[];
}

export type RackPolicyType =
  | 'ups-bottom-zone'
  | 'heavy-device-bottom-zone'
  | 'free-u-percent'
  | 'switch-port-free-percent'
  | 'dual-psu-circuit-split'
  | 'heat-separation'
  | 'power-budget-headroom'
  | 'no-endpoint-switch-direct';

export interface RackPolicy {
  id: string;
  type: RackPolicyType;
  enabled: boolean;
  severity: 'warning' | 'critical';
  params: Record<string, number | string>;
}

export type RackDebtSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RackDebtStatus = 'open' | 'planned' | 'fixed' | 'accepted' | 'ignored';
export type RackDebtScope = 'device' | 'cable' | 'zone' | 'layout';

export interface RackDebtItem {
  id: string;
  title: string;
  description: string;
  severity: RackDebtSeverity;
  status: RackDebtStatus;
  scope: RackDebtScope;
  deviceIds?: string[];
  cableIds?: string[];
  category?: string;
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}

export type InterRackCableType = 'fiber' | 'sfp+' | 'cat6a' | 'dac';

export interface InterRackCable {
  id: string;
  fromRackId: string;
  fromDeviceId: string;
  fromPort: PortRef;
  toRackId: string;
  toDeviceId: string;
  toPort: PortRef;
  type: InterRackCableType;
  lengthM?: number;
  label?: string;
  color?: string;
  notes?: string;
}

export interface PowerBillEntry {
  id: string;
  month: string; // YYYY-MM
  actualKwh: number;
  actualCost?: number;
  notes?: string;
}

export interface SparePart {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: 'new' | 'used' | 'refurbished' | 'unknown';
  storageLocation?: string;
  notes?: string;
  compatibleDeviceIds?: string[];
}

export type CleaningEnvironment = 'bedroom' | 'office' | 'closet' | 'garage' | 'basement';

export interface CleaningSchedule {
  environment: CleaningEnvironment;
  lastCleanedAt?: string; // ISO date
  notes?: string;
}

export interface CableLengthAuditEntry {
  cableId: string;
  actualLengthMm: number;
  measuredAt?: string; // ISO date
  notes?: string;
}

export type EvidenceType =
  | 'receipt'
  | 'serial-photo'
  | 'firmware-screenshot'
  | 'config-backup-hash'
  | 'warranty-pdf'
  | 'install-photo'
  | 'test-result'
  | 'thermal-photo'
  | 'other';

export interface EvidenceRecord {
  id: string;
  entityType: 'device' | 'cable' | 'rack';
  entityId: string;
  type: EvidenceType;
  title: string;
  source: string; // URL, file path, or description
  capturedAt?: string; // ISO date
  redacted?: boolean;
  safeToExport?: boolean;
  notes?: string;
}

export type ServiceCriticality = 'critical' | 'high' | 'medium' | 'low';

export interface RackService {
  id: string;
  name: string;
  criticality: ServiceCriticality;
  hostDeviceId?: string;
  storageDeviceIds?: string[];
  networkDeviceIds?: string[];
  powerDeviceIds?: string[];
  backupDeviceId?: string;
  notes?: string;
}

export interface Workspace {
  id: string;
  name: string;
  racks: RackLayout[];
  interRackCables: InterRackCable[];
  updatedAt: string;
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
  procurementItems?: ProcurementItem[];
  readinessChecks?: ChecklistRecord[];
  commissioningChecks?: ChecklistRecord[];
  goldenBaseline?: RackGoldenBaseline;
  changeEvents?: RackChangeEvent[];
  changeRequests?: ChangeRequest[];
  policies?: RackPolicy[];
  debtItems?: RackDebtItem[];
  updatedAt: string;
  rearClearanceMm?: number;
  frontDoorClearanceMm?: number;
  rearDoorClearanceMm?: number;
  railMinDepthMm?: number;
  railMaxDepthMm?: number;
  electricityRatePerKwh?: number;
  powerBillHistory?: PowerBillEntry[];
  spareParts?: SparePart[];
  cleaningSchedule?: CleaningSchedule;
  cableLengthAudits?: CableLengthAuditEntry[];
  evidenceRecords?: EvidenceRecord[];
  services?: RackService[];
  portReservations?: PortReservation[];
  patchPanelDocs?: PatchPanelPortDoc[];
  credentials?: DeviceCredential[];
  failureDomains?: FailureDomain[];
  domainAssignments?: DomainAssignment[];
  environment?: RackEnvironment;
  photos?: RackPhoto[];
  sensorReadings?: DeviceSensorReading[];
  roomRacks?: RoomRack[];
}

export interface RackPhoto {
  id: string;
  label: string;
  source: string; // URL, file path, or description
  capturedAt?: string;
  notes?: string;
}

export interface RackEnvironment {
  roomTempC?: number;
  roomHumidityPercent?: number;
  ambientNoiseDb?: number;
  recordedAt?: string;
  notes?: string;
}

export interface DeviceSensorReading {
  id: string;
  deviceId: string;
  powerActualW?: number;
  powerPlannedW?: number;
  tempActualC?: number;
  tempPlannedC?: number;
  fanActualRpm?: number;
  fanPlannedRpm?: number;
  recordedAt?: string;
  notes?: string;
}

export interface RoomRack {
  id: string;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  heightU: number;
  rackType: RackType;
  notes?: string;
}

export type FailureDomainType = 'power' | 'network' | 'storage' | 'site' | 'management' | 'cooling';

export interface FailureDomain {
  id: string;
  name: string;
  type: FailureDomainType;
  color: string;
  notes?: string;
}

export interface DomainAssignment {
  domainId: string;
  deviceIds?: string[];
  cableIds?: string[];
  serviceIds?: string[];
}

export interface DeviceCredential {
  id: string;
  label: string;
  value: string; // encrypted
  type: 'password' | 'url' | 'text' | 'ssh-key' | 'snmp';
}

export interface PatchPanelPortDoc {
  portIndex: number;
  cableId?: string;
  destinationRoom?: string;
  wallPlate?: string;
  wireCode?: 'T568A' | 'T568B';
  punchDownDate?: string;
  testedSpeed?: string;
  notes?: string;
}

export interface PortReservation {
  id: string;
  deviceId: string;
  portType: PortType;
  portIndex: number;
  purpose: string;
  expectedDevice?: string;
  owner?: string;
  notes?: string;
  expiryDate?: string;
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

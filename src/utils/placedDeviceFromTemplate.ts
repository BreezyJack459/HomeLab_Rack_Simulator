import type { DeviceTemplate, PlacedDevice, ViewSide } from '../types/rack';
import { templatePowerFields } from './powerAssumptions';

export function placedDeviceFromTemplate(template: DeviceTemplate, id: string, positionU: number, xMm?: number, mountSide: ViewSide = 'front'): PlacedDevice {
  return {
    id,
    templateId: template.id,
    rackMountable: template.rackMountable,
    category: template.category,
    name: template.name,
    mountSide,
    positionU,
    xMm,
    sizeU: template.defaultU,
    depthMm: template.depthMm,
    physicalHeightMm: template.physicalHeightMm,
    widthType: template.widthType,
    customWidthMm: template.customWidthMm,
    weightKg: template.weightKg,
    powerW: template.powerW,
    installationRequirements: template.installationRequirements ? { ...template.installationRequirements } : undefined,
    installationKit: template.installationKit,
    ...templatePowerFields(template),
    powerCapacityW: template.powerCapacityW,
    powerCapacityReference: template.powerCapacityReference ? { ...template.powerCapacityReference } : undefined,
    poeBudgetW: template.poeBudgetW,
    poeInputMode: template.poeInputMode,
    poeEfficiencyPct: template.poeEfficiencyPct,
    batteryWh: template.batteryWh,
    upsBatteryAssumptions: template.upsBatteryAssumptions ? { ...template.upsBatteryAssumptions } : undefined,
    heatLevel: template.heatLevel,
    ports: template.ports,
    portConnectionSpecs: template.portConnectionSpecs ? structuredClone(template.portConnectionSpecs) : undefined,
    portFaceOverrides: template.portFaceOverrides,
    portLayouts: template.portLayouts,
    faceplate: template.faceplate,
    mountType: template.category === 'pdu-0u' ? (template.mountType ?? 'rear-rail') : template.mountType,
    mountSide0U: template.mountSide0U,
    outletFacing: template.outletFacing,
    mountEnvelopeMm: template.mountEnvelopeMm,
    color: template.color,
    description: template.description
  };
}

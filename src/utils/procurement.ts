import type { CableRoute, LifecycleStatus, ProcurementItem, ProcurementItemCategory, ProcurementStatus, RackLayout } from '../types/rack';
import { calculateCablePlan, estimateCableLength } from './routing';

const STATUS_ORDER: ProcurementStatus[] = ['need-to-buy', 'ordered', 'printed', 'owned', 'installed'];

const CATEGORY_LABELS: Record<ProcurementItemCategory, string> = {
  device: 'Devices',
  cable: 'Cables',
  'rack-hardware': 'Rack hardware',
  'rack-accessory': 'Rack accessories',
  power: 'Power parts',
  label: 'Labels',
  'printed-part': 'Printed parts'
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function inferredStatus(lifecycleStatus: LifecycleStatus | undefined): ProcurementStatus {
  switch (lifecycleStatus) {
    case 'planned':
      return 'need-to-buy';
    case 'decommissioning':
      return 'owned';
    case 'active':
    default:
      return 'installed';
  }
}

function upsert(map: Map<string, ProcurementItem>, item: ProcurementItem) {
  const existing = map.get(item.id);
  if (!existing) {
    map.set(item.id, item);
    return;
  }
  map.set(item.id, {
    ...existing,
    quantity: existing.quantity + item.quantity,
    sourceIds: Array.from(new Set([...(existing.sourceIds ?? []), ...(item.sourceIds ?? [])]))
  });
}

function groupedCableItem(layout: RackLayout, cable: CableRoute): ProcurementItem {
  const plan = calculateCablePlan(cable, layout);
  const lengthMm = plan?.standardLengthMm ?? estimateCableLength(layout, cable);
  const serviceLoopMm = plan?.render.serviceLoopMm ?? 0;
  const bendRadiusMm = plan?.render.bendRadiusMm ?? 0;
  const status = inferredStatus(cable.lifecycleStatus);
  const noteParts = [
    plan ? `Route ${Math.ceil(plan.baseLengthMm / 10) * 10}mm + slack ${plan.slackMm}mm` : undefined,
    serviceLoopMm > 0 ? `service loop ${serviceLoopMm}mm` : undefined,
    bendRadiusMm > 0 ? `min bend radius ${bendRadiusMm}mm` : undefined
  ].filter(Boolean);
  return {
    id: `proc-cable-${cable.type}-${lengthMm}-${status}-${serviceLoopMm}-${bendRadiusMm}`,
    label: `${cable.type.charAt(0).toUpperCase() + cable.type.slice(1)} cable`,
    category: cable.type === 'power' ? 'power' : 'cable',
    quantity: 1,
    unit: `${lengthMm}mm`,
    status,
    notes: noteParts.join(' / '),
    sourceKind: 'cable',
    sourceIds: [cable.id]
  };
}

function plannedDevices(layout: RackLayout) {
  return layout.devices.filter((device) => device.lifecycleStatus === 'planned');
}

function plannedCables(layout: RackLayout) {
  return layout.cables.filter((cable) => cable.lifecycleStatus === 'planned');
}

function buildGeneratedItems(layout: RackLayout): ProcurementItem[] {
  const items: ProcurementItem[] = [];
  const planned = plannedDevices(layout);
  const plannedPower = planned.filter((device) => device.category === 'ups' || device.category === 'pdu' || device.category === 'pdu-0u');
  const plannedShelfDevices = planned.filter((device) => device.widthType === 'shelf');
  const plannedPrinted = (layout.reservations ?? []).filter((reservation) => reservation.purpose === 'printed-mount');
  const plannedCableCount = plannedCables(layout).length;

  const fastenerQty = planned
    .filter((device) => device.sizeU > 0)
    .reduce((sum, device) => sum + Math.max(1, device.sizeU) * 4, 0);

  if (fastenerQty > 0) {
    items.push({
      id: 'proc-generated-cage-nuts',
      label: 'Cage nuts + rack screws',
      category: 'rack-hardware',
      quantity: fastenerQty,
      unit: 'pcs',
      status: 'need-to-buy',
      notes: 'Estimated as 4 fasteners per planned rack U.',
      sourceKind: 'generated',
      sourceIds: planned.filter((device) => device.sizeU > 0).map((device) => device.id)
    });
  }

  if (plannedShelfDevices.length > 0) {
    items.push({
      id: 'proc-generated-shelf-hardware',
      label: 'Shelf support / rail accessory kits',
      category: 'rack-accessory',
      quantity: plannedShelfDevices.length,
      unit: 'kits',
      status: 'need-to-buy',
      notes: 'Planned shelf-mounted devices should have a matching tray or rail kit.',
      sourceKind: 'generated',
      sourceIds: plannedShelfDevices.map((device) => device.id)
    });
  }

  if (plannedCableCount > 0) {
    items.push({
      id: 'proc-generated-velcro',
      label: 'Velcro ties / cable wraps',
      category: 'rack-accessory',
      quantity: Math.max(2, Math.ceil(plannedCableCount * 1.5)),
      unit: 'pcs',
      status: 'need-to-buy',
      notes: 'Rough planning estimate based on planned cable count.',
      sourceKind: 'generated',
      sourceIds: plannedCables(layout).map((cable) => cable.id)
    });
  }

  if (planned.length > 0 || plannedCableCount > 0) {
    items.push({
      id: 'proc-generated-labels',
      label: 'Printed labels',
      category: 'label',
      quantity: planned.length + plannedCableCount * 2,
      unit: 'labels',
      status: 'need-to-buy',
      notes: 'Includes one device label plus both-end cable labels for planned additions.',
      sourceKind: 'generated',
      sourceIds: [...planned.map((device) => device.id), ...plannedCables(layout).map((cable) => cable.id)]
    });
  }

  if (plannedPower.length > 0) {
    items.push({
      id: 'proc-generated-power-check',
      label: 'Power feed / outlet verification',
      category: 'power',
      quantity: plannedPower.length,
      unit: 'checks',
      status: 'need-to-buy',
      notes: 'Confirm rack outlets, input cords, and breaker headroom before install.',
      sourceKind: 'generated',
      sourceIds: plannedPower.map((device) => device.id)
    });
  }

  if (plannedPrinted.length > 0) {
    items.push({
      id: 'proc-generated-printed',
      label: 'Printed mount jobs',
      category: 'printed-part',
      quantity: plannedPrinted.length,
      unit: 'parts',
      status: 'need-to-buy',
      notes: 'Derived from printed-mount reservations. Update status to Printed when fabrication is done.',
      sourceKind: 'reservation',
      sourceIds: plannedPrinted.map((reservation) => reservation.id)
    });
  }

  return items;
}

export function getProcurementCategoryLabel(category: ProcurementItemCategory) {
  return CATEGORY_LABELS[category];
}

export function getProcurementStatusLabel(status: ProcurementStatus) {
  switch (status) {
    case 'need-to-buy':
      return 'Need to buy';
    case 'ordered':
      return 'Ordered';
    case 'printed':
      return 'Printed';
    case 'owned':
      return 'Owned';
    case 'installed':
      return 'Installed';
    default:
      return status;
  }
}

export function getProcurementChecklist(layout: RackLayout): ProcurementItem[] {
  const derived = new Map<string, ProcurementItem>();

  for (const device of layout.devices) {
    const category: ProcurementItemCategory =
      device.category === 'ups' || device.category === 'pdu' || device.category === 'pdu-0u'
        ? 'power'
        : device.widthType === 'shelf' || device.category === 'shelf'
          ? 'rack-accessory'
          : 'device';
    const id = `proc-device-${device.templateId ?? slug(device.name)}-${device.lifecycleStatus ?? 'active'}`;
    upsert(derived, {
      id,
      label: device.name,
      category,
      quantity: 1,
      unit: 'pcs',
      status: inferredStatus(device.lifecycleStatus),
      notes: device.description,
      sourceKind: 'device',
      sourceIds: [device.id]
    });
  }

  for (const cable of layout.cables) {
    upsert(derived, groupedCableItem(layout, cable));
  }

  for (const reservation of layout.reservations ?? []) {
    if (reservation.purpose !== 'printed-mount') continue;
    upsert(derived, {
      id: `proc-reservation-${reservation.id}`,
      label: reservation.name,
      category: 'printed-part',
      quantity: 1,
      unit: 'part',
      status: 'need-to-buy',
      notes: reservation.notes,
      sourceKind: 'reservation',
      sourceIds: [reservation.id]
    });
  }

  for (const item of buildGeneratedItems(layout)) {
    upsert(derived, item);
  }

  const persisted = new Map((layout.procurementItems ?? []).map((item) => [item.id, item]));
  const merged = Array.from(derived.values()).map((item) => {
    const saved = persisted.get(item.id);
    return saved
      ? {
          ...item,
          status: saved.status,
          notes: saved.notes ?? item.notes
        }
      : item;
  });

  const manualItems = (layout.procurementItems ?? []).filter((item) => !derived.has(item.id));

  return [...merged, ...manualItems].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    const statusDelta = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (statusDelta !== 0) return statusDelta;
    return a.label.localeCompare(b.label);
  });
}

export function procurementSummary(items: ProcurementItem[]) {
  return items.reduce<Record<ProcurementStatus, number>>(
    (summary, item) => {
      summary[item.status] += item.quantity;
      return summary;
    },
    {
      owned: 0,
      'need-to-buy': 0,
      ordered: 0,
      printed: 0,
      installed: 0
    }
  );
}

export function updateProcurementItem(layout: RackLayout, itemId: string, patch: Partial<ProcurementItem>): ProcurementItem[] {
  return getProcurementChecklist(layout).map((item) => (item.id === itemId ? { ...item, ...patch } : item));
}

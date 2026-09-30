import { describe, expect, it } from 'vitest';
import { deviceCatalog, getTemplateById } from './deviceCatalog';
import { useRackStore } from '../store/rackStore';
import { buildPortLayout, getPortMetadata, resolvePortFace } from '../utils/portLayout';
import { getDeviceWidthMm } from '../utils/rackMath';
import { getDevicePortSurfaces, getDeviceWorldBox, getRackWorldDimensions } from '../utils/rackGeometry';
import { validateImportedLayout } from '../utils/layoutValidation';
import type { PortType } from '../types/rack';

const addedIds = [
  'synology-rs822-plus',
  'synology-ds1825-plus',
  'tp-link-er707-m2',
  'unifi-usw-pro-xg-8-poe',
  'unifi-usw-pro-max-48-poe',
  'mikrotik-crs304-4xg-in',
  'dell-optiplex-7060-micro',
  'dell-optiplex-7080-micro',
  'lenovo-thinkcentre-m920x',
  'lenovo-thinkstation-p330-tiny',
  'lenovo-thinkstation-p360-tiny',
  'hp-elitedesk-800-g5-mini',
  'hp-elite-mini-800-g9',
  'dell-wyse-5070',
  'dell-wyse-5070-extended',
  'hp-t740',
  'dell-poweredge-r630',
  'dell-poweredge-r230',

  'dell-optiplex-7050-micro',
  'dell-optiplex-7070-micro',
  'dell-optiplex-7090-micro',
  'lenovo-thinkcentre-m720q',
  'lenovo-thinkcentre-m920q',
  'lenovo-thinkcentre-m90q-gen3',
  'hp-elitedesk-800-g3-mini',
  'hp-elitedesk-800-g4-mini',
  'hp-elitedesk-800-g6-mini',
  'dell-poweredge-r730',
  'dell-poweredge-r740',
  'hpe-microserver-gen10-plus',
  'qnap-ts-464',
  'terramaster-f4-425-pro',
  'asustor-flashstor-6-gen2',
  'mikrotik-crs309-1g-8s-in',
  'mikrotik-crs326-24g-2s-rm',
  'unifi-dream-router-7',
  'unifi-express-7',
  'unifi-unvr-pro',

  'unifi-ucg-ultra', 'unifi-ucg-fiber', 'unifi-uxg-fiber', 'unifi-udm-pro-max',
  'unifi-usw-pro-max-16-poe', 'unifi-usw-pro-max-24-poe', 'unifi-usw-pro-max-24',
  'unifi-usw-aggregation', 'unifi-usw-lite-16-poe', 'unifi-usw-ultra',
  'unifi-usw-flex-mini-2-5g', 'unifi-u6-plus', 'unifi-u7-lite',
  'ednse-ed408h40', 'ednse-ed412h40', 'jmcd-12e5', 'toploong-f4811', 'dingxiang-4u400-12', 'dingxiang-4u450', 'minisforum-ms-a2', 'minisforum-ms-02-ultra-285hx', 'beelink-me-mini-n200', 'ugreen-dxp4800-pro', 'synology-ds925-plus', 'zimaboard-2', 'unifi-unas-pro', 'unifi-unas-pro-4', 'unifi-unas-pro-8', 'unifi-unas-2',
  'mikrotik-crs310-8g-2s-in', 'tp-link-er605-v2', 'synology-ds224-plus',
];

describe('expanded homelab catalog', () => {
  it('preserves Hong Kong batch connector and chassis distinctions', () => {
    const slim = getTemplateById('dell-wyse-5070')!;
    const extended = getTemplateById('dell-wyse-5070-extended')!;
    expect([slim.defaultU, extended.defaultU]).toEqual([1, 2]);
    expect(extended.physicalHeightMm).toBe(66);
    expect([slim.ports?.usb, extended.ports?.usb]).toEqual([8, 8]);
    expect(getTemplateById('synology-ds1825-plus')!.ports?.usb).toBe(3);
    expect(getTemplateById('dell-poweredge-r230')!.ports?.ethernet).toBe(2);
    expect(getTemplateById('dell-poweredge-r630')!.ports?.ethernet).toBe(5);
    expect(getTemplateById('hp-elite-mini-800-g9')!.ports?.hdmi).toBe(1);
    expect(getTemplateById('hp-elitedesk-800-g5-mini')!.ports?.hdmi).toBeUndefined();
  });

  it('preserves mixed-speed uplinks without treating PoE capacity as consumption', () => {
    const switch48 = getTemplateById('unifi-usw-pro-max-48-poe')!;
    expect(getPortMetadata(switch48, 'front', 'ethernet', 31)?.speed).toBe('1G');
    expect(getPortMetadata(switch48, 'front', 'ethernet', 32)?.speed).toBe('2.5G');
    expect(getPortMetadata(switch48, 'front', 'fiber', 3)?.speed).toBe('10G');
    expect(switch48.powerW).toBe(100);
    const crs = getTemplateById('mikrotik-crs304-4xg-in')!;
    expect(getPortMetadata(crs, 'front', 'ethernet', 3)?.speed).toBe('10G');
    expect(getPortMetadata(crs, 'front', 'ethernet', 4)?.speed).toBe('1G');
    expect(crs.ports?.power).toBe(3);
    const router = getTemplateById('tp-link-er707-m2')!;
    expect(getPortMetadata(router, 'front', 'fiber', 0)).toMatchObject({ speed: '1G', mediaType: 'sfp' });
    expect(getPortMetadata(router, 'front', 'ethernet', 2)?.speed).toBe('1G');
  });

  it('keeps every catalog id unique', () => {
    expect(new Set(deviceCatalog.map(t => t.id)).size).toBe(deviceCatalog.length);
  });

  it.each(addedIds)('%s survives placement/inventory and JSON import with all rendered ports', id => {
    const template = getTemplateById(id)!;
    expect(template).toBeDefined();
    useRackStore.getState().newLayout('19in', 12);
    useRackStore.getState().updateRack({ rackDepthMm: 1000 });
    if (template.rackMountable === false) {
      expect(useRackStore.getState().addDeviceFromTemplate(id)).toBe(false);
      useRackStore.getState().addDeviceToInventory(id);
    } else {
      expect(useRackStore.getState().addDeviceFromTemplate(id, 1)).toBe(true);
    }
    const original = useRackStore.getState().layout;
    const parsed = validateImportedLayout(JSON.parse(JSON.stringify(original)));
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) throw new Error(parsed.errors.join(', '));
    useRackStore.getState().newLayout('19in', 12);
    useRackStore.getState().loadLayout(parsed.layout);
    const layout = useRackStore.getState().layout;
    const device = [...layout.devices, ...(layout.unplacedDevices ?? [])][0];
    expect(device).toMatchObject({
      templateId: id, ports: template.ports, portLayouts: template.portLayouts,
      physicalHeightMm: template.physicalHeightMm, powerW: template.powerW,
    });
    expect(device.portFaceOverrides).toEqual(template.portFaceOverrides);
    expect(device.rackMountable).toBe(template.rackMountable);
    const width = getDeviceWidthMm(device);
    const surfaces = getDevicePortSurfaces(device, getDeviceWorldBox(layout, device, getRackWorldDimensions(layout)));
    for (const face of ['front', 'rear'] as const) {
      const slots = buildPortLayout(device, width, device.physicalHeightMm!, face).flatMap(g => g.slots);
      const actual3d = surfaces.filter(s => s.face === face).flatMap(s => s.slots);
      for (const [type, count] of Object.entries(device.ports!)) {
        const expected = resolvePortFace(device, { type: type as PortType, index: 0 }) === face ? count : 0;
        const matching = slots.filter(s => s.type === type);
        expect(matching).toHaveLength(expected);
        expect(new Set(matching.map(s => s.index)).size).toBe(expected);
        expect(actual3d.filter(s => s.type === type)).toHaveLength(expected);
      }
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i], b = slots[j];
          const overlaps = Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.1
            && Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 0.1;
          expect(overlaps, `${id}: ${face} ${a.type}${a.index}/${b.type}${b.index}`).toBe(false);
        }
      }
      for (const slot of slots) {
        expect(Number.isFinite(slot.x + slot.y + slot.width + slot.height)).toBe(true);
        expect(slot.width).toBeGreaterThan(0);
      }
    }
  });

  it('distinguishes standard Mini PC I/O from optional modules', () => {
    expect(getTemplateById('dell-optiplex-7050-micro')!.ports?.hdmi).toBe(1);
    for (const id of ['dell-optiplex-7070-micro', 'dell-optiplex-7090-micro', 'hp-elitedesk-800-g3-mini', 'hp-elitedesk-800-g4-mini', 'hp-elitedesk-800-g6-mini']) {
      expect(getTemplateById(id)!.ports?.hdmi).toBeUndefined();
      expect(getTemplateById(id)!.ports?.ethernet).toBe(1);
      expect(getTemplateById(id)!.ports?.fiber).toBeUndefined();
    }
    expect(getTemplateById('lenovo-thinkcentre-m720q')!.ports?.usb).toBe(6);
    expect(getTemplateById('lenovo-thinkcentre-m920q')!.ports?.usb).toBe(6);
    expect(getTemplateById('lenovo-thinkcentre-m90q-gen3')!.ports?.usb).toBe(7);
    expect(getTemplateById('hp-elitedesk-800-g6-mini')!.ports?.usb).toBe(7);
    for (const id of ['dell-optiplex-micro', 'lenovo-thinkcentre-tiny', 'hp-elitedesk-mini']) {
      expect(getTemplateById(id)).toBeDefined(); // Existing generic IDs still resolve.
    }
  });

  it('keeps management, console and power-only connections distinct', () => {
    const server = getTemplateById('dell-poweredge-r740')!;
    expect(server.ports?.ethernet).toBe(5);
    expect(server.portLayouts?.rear?.filter(group => group.type === 'ethernet')[1]).toMatchObject({ count: 1, groupLabel: 'iDRAC management' });
    expect(getPortMetadata(server, 'rear', 'ethernet', 4)?.speed).toBe('1G');
    expect(getTemplateById('hpe-microserver-gen10-plus')!.ports?.ethernet).toBe(4);
    expect(getTemplateById('mikrotik-crs326-24g-2s-rm')!.ports?.ethernet).toBe(24);
    expect(getTemplateById('unifi-express-7')!.ports?.usb).toBeUndefined();
    const nas = getTemplateById('terramaster-f4-425-pro')!;
    expect(getPortMetadata(nas, 'rear', 'ethernet', 1)?.speed).toBe('5G');
  });

  it('retains storage/workstation connector distinctions', () => {
    const ms = getTemplateById('minisforum-ms-02-ultra-285hx')!;
    expect(getPortMetadata(ms, 'rear', 'ethernet', 0)?.speed).toBe('2.5G');
    expect(getPortMetadata(ms, 'rear', 'ethernet', 1)?.speed).toBe('10G');
    expect(getPortMetadata(ms, 'rear', 'fiber', 1)).toMatchObject({ speed: '25G', mediaType: 'sfp28' });
    expect(getTemplateById('unifi-unas-2')!.ports).toEqual({ ethernet: 1, usb: 1 });
    expect(getTemplateById('synology-ds925-plus')!.ports?.usb).toBe(2);
    expect(getTemplateById('zimaboard-2')!.ports?.hdmi).toBeUndefined();
    expect(getTemplateById('unifi-unas-pro-8')!.powerW).toBe(250);
  });

  it('preserves mixed-speed port boundaries and avoids fictitious copper/power ports', () => {
    const ultra = getTemplateById('unifi-ucg-ultra')!;
    expect(getPortMetadata(ultra, 'rear', 'ethernet', 3)?.speed).toBe('1G');
    expect(getPortMetadata(ultra, 'rear', 'ethernet', 4)?.speed).toBe('2.5G');
    const pro = getTemplateById('unifi-usw-pro-max-16-poe')!;
    expect(getPortMetadata(pro, 'front', 'ethernet', 11)?.speed).toBe('1G');
    expect(getPortMetadata(pro, 'front', 'ethernet', 12)?.speed).toBe('2.5G');
    expect(pro.powerW).toBe(25); // Chassis maximum, not the 180W PoE budget.
    expect(getTemplateById('unifi-usw-aggregation')!.ports?.ethernet).toBeUndefined();
    expect(getTemplateById('unifi-u7-lite')!.ports?.power).toBeUndefined();
  });
});


it('keeps the saved JMCD six-U envelope consistent without floating-point rounding to seven U', () => {
  const device = getTemplateById('jmcd-12e5')!;
  expect(device.defaultU).toBe(6);
  expect(device.physicalHeightMm).toBeCloseTo(6 * 44.45);
});

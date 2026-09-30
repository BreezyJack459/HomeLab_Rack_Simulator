import type { DeviceTemplate, PlacedDevice } from '../types/rack';
import { registerDeviceTemplates } from './deviceTemplateRegistry';
export { getTemplateById } from './deviceTemplateRegistry';

// Power/weight source audit and unresolved estimates: docs/DEVICE_SPEC_AUDIT.zh-Hant.md
// powerW is device consumption, excluding downstream PoE/RPS output where specified.
export const deviceCatalog: DeviceTemplate[] = [
  {
    id: 'cat6-patch-12',
    category: 'patch-panel',
    name: '12-port patch panel',
    defaultU: 1,
    depthMm: 45,
    widthType: '10in',
    weightKg: 0.8,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 12, layoutColumns: 12 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 12, xRatio: 0.5 },
      ],
    },
    color: '#64748b',
    description: 'Compact keystone panel for a 10-inch rack.'  },
  {
    id: 'cat6-patch-24',
    category: 'patch-panel',
    name: '24-port patch panel',
    defaultU: 1,
    depthMm: 65,
    widthType: '19in',
    weightKg: 1.7,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 24, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#64748b',
    description: 'Standard 19-inch Ethernet patch panel.'  },
  {
    id: 'cat6-patch-8-10in',
    category: 'patch-panel',
    name: '8-port 10-inch patch panel',
    defaultU: 1,
    depthMm: 42,
    widthType: '10in',
    weightKg: 0.6,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 8, layoutColumns: 8 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 8, xRatio: 0.5 },
      ],
    },
    color: '#718096',
    description: 'Small keystone patch panel for compact network racks.'  },
  {
    id: 'cat6-patch-6-10in',
    category: 'patch-panel',
    name: '6-port 10-inch patch panel',
    defaultU: 1,
    depthMm: 38,
    widthType: '10in',
    weightKg: 0.45,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 6, layoutColumns: 6 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 6, xRatio: 0.5 },
      ],
    },
    color: '#718096',
    description: 'Very small keystone patch panel for compact wall racks.'  },
  {
    id: 'cat6-patch-12-10in-two-row',
    category: 'patch-panel',
    name: '12-port 10-inch patch panel, 2-row',
    defaultU: 1,
    depthMm: 45,
    widthType: '10in',
    weightKg: 0.75,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 12, layoutColumns: 6 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 6, xRatio: 0.5 },
      ],
    },
    color: '#64748b',
    description: 'Dense 10-inch keystone panel with two rows of six ports.'  },
  {
    id: 'cat6-patch-12-19in',
    category: 'patch-panel',
    name: '12-port 19-inch patch panel',
    defaultU: 1,
    depthMm: 50,
    widthType: '19in',
    weightKg: 1.1,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 12, layoutColumns: 12 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 12, xRatio: 0.5 },
      ],
    },
    color: '#64748b',
    description: 'Lower-density 19-inch keystone panel for small home drops.'  },
  {
    id: 'cat6-patch-16-19in',
    category: 'patch-panel',
    name: '16-port 19-inch patch panel',
    defaultU: 1,
    depthMm: 55,
    widthType: '19in',
    weightKg: 1.3,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 16, layoutColumns: 16 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 16, xRatio: 0.5 },
      ],
    },
    color: '#64748b',
    description: 'Mid-density patch panel for home drops without jumping to 24 ports.'  },
  {
    id: 'cat6-patch-24-two-row',
    category: 'patch-panel',
    name: '24-port patch panel, 2-row',
    defaultU: 1,
    depthMm: 65,
    widthType: '19in',
    weightKg: 1.8,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 24, layoutColumns: 12 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 12, xRatio: 0.5 },
      ],
    },
    color: '#475569',
    description: 'Alternative 24-port layout with two 12-port rows.'  },
  {
    id: 'cat6a-shielded-patch-24',
    category: 'patch-panel',
    name: '24-port Cat6A shielded patch panel',
    defaultU: 1,
    depthMm: 90,
    widthType: '19in',
    weightKg: 2.3,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 24, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#475569',
    description: 'Deeper shielded Cat6A-style panel for 10GbE copper planning.'  },
  {
    id: 'cat6-patch-24-feedthrough',
    category: 'patch-panel',
    name: '24-port feedthrough patch panel',
    defaultU: 1,
    depthMm: 45,
    widthType: '19in',
    weightKg: 1.2,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 24, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#64748b',
    description: 'Shallow RJ45 coupler panel for fast home-lab rewiring.'  },
  {
    id: 'cat6-patch-48-2u',
    category: 'patch-panel',
    name: '48-port 2U patch panel',
    defaultU: 2,
    depthMm: 80,
    widthType: '19in',
    weightKg: 3.2,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 48, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#475569',
    description: 'High-density copper patching for bigger drops.'  },
  {
    id: 'cat6-patch-48-1u',
    category: 'patch-panel',
    name: '48-port 1U patch panel',
    defaultU: 1,
    depthMm: 90,
    widthType: '19in',
    weightKg: 3,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 48, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#334155',
    description: 'Very dense 1U copper patch panel with two 24-port rows.'  },
  {
    id: 'fiber-patch-12-lc',
    category: 'patch-panel',
    name: '12-port LC fiber patch panel',
    defaultU: 1,
    depthMm: 120,
    widthType: '19in',
    weightKg: 1.4,
    powerW: 0,
    heatLevel: 1,
    ports: { fiber: 12, layoutColumns: 12 },
    portLayouts: {
      front: [
        { type: 'fiber', columns: 12, xRatio: 0.5 },
      ],
    },
    color: '#7c3aed',
    description: 'Fiber patch panel for SFP/SFP+ uplinks.'  },
  {
    id: 'fiber-patch-6-lc-10in',
    category: 'patch-panel',
    name: '6-port LC fiber 10-inch panel',
    defaultU: 1,
    depthMm: 80,
    widthType: '10in',
    weightKg: 0.6,
    powerW: 0,
    heatLevel: 1,
    ports: { fiber: 6, layoutColumns: 6 },
    portLayouts: {
      front: [
        { type: 'fiber', columns: 6, xRatio: 0.5 },
      ],
    },
    color: '#8b5cf6',
    description: 'Compact LC fiber panel for a small rack with one or two SFP uplinks.'  },
  {
    id: 'fiber-patch-24-lc',
    category: 'patch-panel',
    name: '24-port LC fiber patch panel',
    defaultU: 1,
    depthMm: 140,
    widthType: '19in',
    weightKg: 1.8,
    powerW: 0,
    heatLevel: 1,
    ports: { fiber: 24, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'fiber', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#6d28d9',
    description: 'Higher-density LC fiber patch panel for multi-switch uplink planning.'  },
  {
    id: 'blank-keystone-24',
    category: 'patch-panel',
    name: '24-port blank keystone panel',
    defaultU: 1,
    depthMm: 35,
    widthType: '19in',
    weightKg: 0.9,
    powerW: 0,
    heatLevel: 1,
    ports: { ethernet: 24, layoutColumns: 24 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 24, xRatio: 0.5 },
      ],
    },
    color: '#334155',
    description: 'Empty keystone panel placeholder for mixed copper, fiber, HDMI, or USB modules.'  },
  {
    id: 'managed-switch-8',
    category: 'switch',
    name: '8-port PoE switch',
    defaultU: 1,
    depthMm: 150,
    widthType: '10in',
    weightKg: 1.3,
    powerW: 60,
    heatLevel: 3,
    ports: { ethernet: 8, power: 1 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 8, columns: 8, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'Ports' },
      ],
      rear: [
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: 'Power' },
      ],
    },
    color: '#2563eb',
    description: 'Small managed switch with PoE budget.'  },
  {
    id: 'managed-switch-24',
    category: 'switch',
    name: '24-port managed switch',
    defaultU: 1,
    depthMm: 260,
    widthType: '19in',
    weightKg: 3.8,
    powerW: 45,
    heatLevel: 3,
    ports: { ethernet: 24, fiber: 4, power: 1, layoutColumns: 12 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 12, rowIndex: 0, xRatio: 0.38, speed: '1G', mediaType: 'rj45', groupLabel: 'Data' },
        { type: 'fiber', columns: 4, rowIndex: 0, xRatio: 0.88, speed: '10G', mediaType: 'sfp+', groupLabel: 'Uplink' },
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#1d4ed8',
    description: 'Core switch with uplink ports.'  },
  {
    id: 'mikrotik-crs305',
    category: 'switch',
    name: 'MikroTik CRS305 10G switch',
    defaultU: 1,
    depthMm: 115,
    widthType: 'shelf',
    customWidthMm: 141,
    weightKg: 0.5,
    powerW: 18,
    heatLevel: 3,
    ports: { ethernet: 1, fiber: 4, power: 2, layoutColumns: 5 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'Data' },
        { type: 'fiber', columns: 4, rowIndex: 0, xRatio: 0.72, speed: '10G', mediaType: 'sfp+', groupLabel: 'Uplink' },
      ],
      rear: [
        { type: 'power', columns: 2, xRatio: 0.5 },
      ],
    },
    faceplate: {
      front: '/src/assets/faceplates/mikrotik-crs305.front.svg',
    },
    color: '#0f766e',
    description: 'Popular compact 10G SFP+ switch template based on CRS305 dimensions. Single GbE left, four SFP+ right on front.'  },
  {
    id: 'unifi-switch-lite-8-poe',
    category: 'switch',
    name: 'UniFi Switch Lite 8 PoE',
    defaultU: 1,
    depthMm: 100,
    widthType: 'shelf',
    customWidthMm: 160,
    weightKg: 0.295,
    powerW: 8,
    heatLevel: 3,
    ports: { ethernet: 8, power: 1, layoutColumns: 8 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 8, columns: 8, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'Ports' },
      ],
      rear: [
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: 'Power' },
      ],
    },
    color: '#2563eb',
    description: 'Compact shelf-mounted UniFi access switch with PoE planning budget.'  },
  {
    id: 'unifi-switch-24-poe',
    category: 'switch',
    name: 'UniFi 24-port PoE switch',
    defaultU: 1,
    depthMm: 285,
    widthType: '19in',
    weightKg: 4.5,
    powerW: 95,
    heatLevel: 4,
    ports: { ethernet: 24, fiber: 2, power: 1, layoutColumns: 12 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 12, rowIndex: 0, xRatio: 0.38, speed: '1G', mediaType: 'rj45', groupLabel: 'Data' },
        { type: 'fiber', columns: 2, rowIndex: 0, xRatio: 0.9, speed: '10G', mediaType: 'sfp+', groupLabel: 'Uplink' }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#1d4ed8',
    description: 'Common 1U UniFi switch profile for access or core switching. SFP ports on the right.'  },
  {
    id: 'tp-link-omada-8-poe',
    category: 'switch',
    name: 'TP-Link Omada 8-port PoE switch',
    defaultU: 1,
    depthMm: 180,
    widthType: 'shelf',
    customWidthMm: 220,
    weightKg: 1.5,
    powerW: 80,
    heatLevel: 3,
    ports: { ethernet: 8, fiber: 2, power: 1, layoutColumns: 8 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 8, xRatio: 0.42, speed: '1G', mediaType: 'rj45' },
        { type: 'fiber', columns: 2, xRatio: 0.88, speed: '10G', mediaType: 'sfp+' },
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#1e40af',
    description: 'Shelf or tray-mounted Omada-style PoE switch profile.'  },
  {
    id: 'edge-router',
    category: 'router',
    name: 'Edge router',
    defaultU: 1,
    depthMm: 140,
    widthType: '10in',
    weightKg: 0.9,
    powerW: 18,
    heatLevel: 2,
    ports: { ethernet: 5, power: 1 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 5, columns: 5, rowIndex: 0, xRatio: 0.65, speed: '1G', mediaType: 'rj45', groupLabel: 'Ports' },
      ],
      rear: [
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: 'Power' },
      ],
    },
    color: '#0d9488',
    description: 'Low-power wired router.'  },
  {
    id: 'unifi-dream-machine-pro',
    category: 'router',
    name: 'UniFi Dream Machine Pro',
    defaultU: 1,
    depthMm: 286,
    widthType: '19in',
    weightKg: 3.9,
    powerW: 33,
    heatLevel: 3,
    ports: { ethernet: 9, fiber: 2, power: 1, layoutColumns: 11 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 1, columns: 1, xRatio: 0.12, speed: '1G', mediaType: 'rj45' },
        { type: 'ethernet', count: 8, columns: 8, xRatio: 0.48, speed: '1G', mediaType: 'rj45' },
        { type: 'fiber', count: 1, columns: 1, xRatio: 0.82, speed: '10G', mediaType: 'sfp+' },
        { type: 'fiber', count: 1, columns: 1, xRatio: 0.92, speed: '10G', mediaType: 'sfp+' }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#0ea5e9',
    description: 'UniFi Dream Machine Pro: WAN RJ45 left, 8x LAN center, WAN SFP+ and LAN SFP+ right on front. Power on rear.'  },
  {
    id: 'unifi-ucg-max',
    category: 'router',
    name: 'UniFi UCG-Max',
    defaultU: 1,
    depthMm: 128,
    widthType: 'shelf',
    customWidthMm: 142,
    weightKg: 0.519,
    powerW: 16.1,
    heatLevel: 3,
    ports: { ethernet: 5, power: 1, layoutColumns: 6 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 5, xRatio: 0.42, speed: '2.5G', mediaType: 'rj45' },
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#0ea5e9',
    description: 'Your compact UniFi Cloud Gateway Max with five 2.5GbE ports and USB-C power.'  },
  {
    id: 'mikrotik-rb5009',
    category: 'router',
    name: 'MikroTik RB5009 router',
    defaultU: 1,
    depthMm: 120,
    widthType: 'shelf',
    customWidthMm: 220,
    weightKg: 0.7,
    powerW: 20,
    heatLevel: 3,
    ports: { ethernet: 8, fiber: 1, power: 1, layoutColumns: 9 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 8, xRatio: 0.42, speed: '1G', mediaType: 'rj45' },
        { type: 'fiber', columns: 1, xRatio: 0.88, speed: '10G', mediaType: 'sfp+' },
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#0f766e',
    description: 'Compact fanless router often tray-mounted or adapted into 1U.'  },
  {
    id: 'firewall-appliance',
    category: 'firewall',
    name: 'Firewall appliance',
    defaultU: 1,
    depthMm: 210,
    widthType: 'shelf',
    customWidthMm: 210,
    weightKg: 1.5,
    powerW: 25,
    heatLevel: 3,
    ports: { ethernet: 6, power: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 6, columns: 6, rowIndex: 0, xRatio: 0.25, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#dc2626',
    description: 'Fanless mini firewall placed on a shelf.'  },
  {
    id: 'isp-modem',
    category: 'modem',
    name: 'ISP Modem',
    defaultU: 1,
    depthMm: 160,
    widthType: 'shelf',
    customWidthMm: 120,
    weightKg: 0.6,
    powerW: 12,
    heatLevel: 2,
    ports: { ethernet: 1, coax: 1, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'coax', count: 1, columns: 1, rowIndex: 0, xRatio: 0.12, groupLabel: 'Coax' },
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.42, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.82, groupLabel: 'Power' },
      ],
    },
    color: '#64748b',
    description: 'Generic ISP modem profile. Add twice for dual-WAN or active/backup service.'  },
  {
    id: 'isp-modem-fiber-ont',
    category: 'modem',
    name: 'ISP Fiber ONT',
    defaultU: 1,
    depthMm: 140,
    widthType: 'shelf',
    customWidthMm: 110,
    weightKg: 0.4,
    powerW: 10,
    heatLevel: 2,
    ports: { ethernet: 1, fiber: 1, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'fiber', count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, speed: '1G', mediaType: 'fiber', groupLabel: 'PON' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.82, groupLabel: 'Power' },
      ],
    },
    color: '#475569',
    description: 'Generic fiber ONT profile for FTTH layouts.'  },
  {
    id: 'protectli-vp2420',
    category: 'firewall',
    name: 'Protectli Vault VP2420',
    defaultU: 2,
    depthMm: 127,
    widthType: 'shelf',
    customWidthMm: 146,
    weightKg: 0.8,
    powerW: 24,
    heatLevel: 3,
    ports: { ethernet: 4, usb: 3, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 4, rowIndex: 0, xRatio: 0.15, speed: '2.5G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 3, columns: 3, rowIndex: 1, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.88, groupLabel: 'Power' },
      ],
    },
    color: '#b91c1c',
    description: 'Fanless 4x 2.5GbE firewall appliance profile.'  },
  {
    id: 'n100-4port-firewall',
    category: 'firewall',
    name: 'N100 4-port firewall box',
    defaultU: 2,
    depthMm: 130,
    widthType: 'shelf',
    customWidthMm: 135,
    weightKg: 0.9,
    powerW: 18,
    heatLevel: 3,
    ports: { ethernet: 4, usb: 2, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 4, rowIndex: 0, xRatio: 0.15, speed: '2.5G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 2, columns: 2, rowIndex: 1, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.88, groupLabel: 'Power' },
      ],
    },
    color: '#dc2626',
    description: 'Generic Intel N100/i226-V firewall box popular for OPNsense and pfSense labs.'  },
  {
    id: 'mini-pc-nuc',
    category: 'mini-pc',
    name: 'Mini PC node',
    defaultU: 1,
    depthMm: 130,
    widthType: 'shelf',
    customWidthMm: 120,
    weightKg: 0.7,
    powerW: 35,
    heatLevel: 3,
    ports: { ethernet: 2, usb: 4, power: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 2, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 4, columns: 4, rowIndex: 0, xRatio: 0.5, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#7c3aed',
    description: 'Compact compute node for virtualization or services.'  },
  {
    id: 'minisforum-um790-pro',
    category: 'mini-pc',
    name: 'Minisforum UM790 Pro',
    defaultU: 2,
    depthMm: 126,
    widthType: 'shelf',
    customWidthMm: 130,
    weightKg: 0.7,
    powerW: 65,
    heatLevel: 4,
    ports: { ethernet: 1, usb: 6, hdmi: 2, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.12, speed: '2.5G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 6, columns: 6, rowIndex: 0, xRatio: 0.42, groupLabel: 'USB' },
        { type: 'hdmi', count: 2, columns: 2, rowIndex: 0, xRatio: 0.72, groupLabel: 'HDMI' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#8b5cf6',
    description: 'Your UM790 Pro mini PC profile, 130 x 126 x 52.3mm with 2.5GbE, USB4, and dual HDMI.'  },
  {
    id: 'tinyminimicro-1l-node',
    category: 'mini-pc',
    name: 'TinyMiniMicro 1L PC',
    defaultU: 1,
    depthMm: 180,
    widthType: 'shelf',
    customWidthMm: 180,
    weightKg: 1.3,
    powerW: 45,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 6, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 6, columns: 4, rowIndex: 0, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#6d28d9',
    description: 'Generic Dell Micro, HP Mini, or Lenovo Tiny homelab node.'  },
  {
    id: 'dell-optiplex-micro',
    category: 'mini-pc',
    name: 'Dell OptiPlex Micro',
    defaultU: 1,
    depthMm: 180,
    widthType: 'shelf',
    customWidthMm: 180,
    weightKg: 1.2,
    powerW: 45,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 6, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 6, columns: 4, rowIndex: 0, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#7c3aed',
    description: 'Common used-market micro PC node for Proxmox, Docker, or services.'  },
  {
    id: 'lenovo-thinkcentre-tiny',
    category: 'mini-pc',
    name: 'Lenovo ThinkCentre Tiny',
    defaultU: 1,
    depthMm: 183,
    widthType: 'shelf',
    customWidthMm: 179,
    weightKg: 1.3,
    powerW: 45,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 6, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 6, columns: 4, rowIndex: 0, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#6d28d9',
    description: 'TinyMiniMicro-style Lenovo node, often used in clusters.'  },
  {
    id: 'hp-elitedesk-mini',
    category: 'mini-pc',
    name: 'HP EliteDesk Mini',
    defaultU: 1,
    depthMm: 177,
    widthType: 'shelf',
    customWidthMm: 177,
    weightKg: 1.3,
    powerW: 45,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 6, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 6, columns: 4, rowIndex: 0, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#5b21b6',
    description: 'HP Mini profile from the popular TinyMiniMicro homelab class.'  },
  {
    id: 'minisforum-ms01',
    category: 'mini-pc',
    name: 'Minisforum MS-01',
    defaultU: 2,
    depthMm: 189,
    widthType: 'shelf',
    customWidthMm: 196,
    weightKg: 1.4,
    powerW: 65,
    heatLevel: 4,
    ports: { ethernet: 2, fiber: 2, usb: 6, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 2, rowIndex: 0, xRatio: 0.18, speed: '2.5G', mediaType: 'rj45', groupLabel: '2.5GbE' },
        { type: 'fiber', count: 2, columns: 2, rowIndex: 0, xRatio: 0.4, speed: '10G', mediaType: 'sfp+', groupLabel: 'SFP+' },
        { type: 'usb', count: 6, columns: 4, rowIndex: 0, xRatio: 0.62, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#8b5cf6',
    description: 'High-end mini workstation with dual 10G SFP+ and dual 2.5GbE.'  },
  {
    id: 'apple-mac-mini-m4',
    category: 'mini-pc',
    name: 'Apple Mac mini M4',
    defaultU: 2,
    depthMm: 127,
    widthType: 'shelf',
    customWidthMm: 127,
    weightKg: 0.67,
    powerW: 155,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 5, hdmi: 1, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.12, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 5, columns: 5, rowIndex: 0, xRatio: 0.42, groupLabel: 'USB' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.72, groupLabel: 'HDMI' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#94a3b8',
    description: 'Current compact 127 x 127 x 50mm Mac mini profile with front USB-C and rear Ethernet, HDMI, Thunderbolt, and AC power.'  },
  {
    id: 'apple-mac-mini-m4-pro',
    category: 'mini-pc',
    name: 'Apple Mac mini M4 Pro',
    defaultU: 2,
    depthMm: 127,
    widthType: 'shelf',
    customWidthMm: 127,
    weightKg: 0.73,
    powerW: 155,
    heatLevel: 4,
    ports: { ethernet: 1, usb: 5, hdmi: 1, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.12, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 5, columns: 5, rowIndex: 0, xRatio: 0.42, groupLabel: 'USB' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.72, groupLabel: 'HDMI' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#64748b',
    description: 'Higher-performance M4 Pro Mac mini profile; allow more airflow than the base model in dense shelves.'  },
  {
    id: 'apple-mac-mini-m1-m2',
    category: 'mini-pc',
    name: 'Apple Mac mini M1/M2',
    defaultU: 1,
    depthMm: 197,
    widthType: 'shelf',
    customWidthMm: 197,
    weightKg: 1.2,
    powerW: 150,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 4, hdmi: 1, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, groupLabel: 'Power' },
        { type: 'usb', count: 4, columns: 4, rowIndex: 0, xRatio: 0.42, groupLabel: 'USB' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.72, groupLabel: 'HDMI' },
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.88, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
      ],
    },
    color: '#475569',
    description: 'Older 197 x 197 x 36mm Mac mini profile for common used-market M1/M2 homelab nodes.'  },
  {
    id: 'apple-mac-studio-2025',
    category: 'mini-pc',
    name: 'Apple Mac Studio',
    defaultU: 3,
    depthMm: 197,
    widthType: 'shelf',
    customWidthMm: 197,
    weightKg: 2.7,
    powerW: 480,
    heatLevel: 5,
    ports: { ethernet: 1, usb: 6, hdmi: 1, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.12, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 6, columns: 4, rowIndex: 0, xRatio: 0.42, groupLabel: 'USB' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.72, groupLabel: 'HDMI' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#334155',
    description: '2025 Mac Studio profile, roughly 197 x 197 x 95mm; high-power shelf-mounted workstation node.'  },
  {
    id: 'beelink-n100-node',
    category: 'mini-pc',
    name: 'N100 mini PC node',
    defaultU: 1,
    depthMm: 120,
    widthType: 'shelf',
    customWidthMm: 115,
    weightKg: 0.6,
    powerW: 16,
    heatLevel: 2,
    ports: { ethernet: 1, usb: 4, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 4, columns: 4, rowIndex: 0, xRatio: 0.5, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#8b5cf6',
    description: 'Low-power N100 mini PC template for light services.'  },
  {
    id: 'raspberry-pi-cluster',
    category: 'sbc',
    name: 'Raspberry Pi tray',
    defaultU: 1,
    depthMm: 95,
    widthType: 'shelf',
    customWidthMm: 180,
    weightKg: 0.5,
    powerW: 18,
    heatLevel: 2,
    ports: { ethernet: 4, usb: 4, power: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 4, rowIndex: 0, xRatio: 0.12, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 4, columns: 4, rowIndex: 0, xRatio: 0.45, groupLabel: 'USB' },
        { type: 'power', count: 4, columns: 2, rowIndex: 0, xRatio: 0.82, groupLabel: 'Power' },
      ],
    },
    color: '#be185d',
    description: 'Small SBC cluster tray.'  },
  {
    id: 'raspberry-pi-5-single',
    category: 'sbc',
    name: 'Raspberry Pi 5',
    defaultU: 1,
    depthMm: 86,
    widthType: 'shelf',
    customWidthMm: 56,
    weightKg: 0.15,
    powerW: 12,
    heatLevel: 2,
    ports: { ethernet: 1, usb: 4, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.3 },
        { type: 'usb', columns: 4, xRatio: 0.5 },
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#be185d',
    description: 'Single SBC template for tray layouts.'  },
  {
    id: 'unifi-u7-pro',
    category: 'access-point',
    name: 'UniFi U7-Pro',
    defaultU: 2,
    rackMountable: false,
    depthMm: 206,
    widthType: 'shelf',
    customWidthMm: 206,
    weightKg: 0.68,
    powerW: 21,
    heatLevel: 3,
    ports: { ethernet: 1, layoutColumns: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#38bdf8',
    description: 'External ceiling or wall-mounted WiFi 7 access point; keep it out of the rack layout.'  },
  {
    id: 'unifi-poe-injector-2-5g',
    category: 'poe-injector',
    name: 'UniFi PoE Injector 2.5G',
    defaultU: 1,
    depthMm: 93,
    widthType: 'shelf',
    customWidthMm: 62,
    weightKg: 0.156,
    powerW: 30,
    heatLevel: 2,
    ports: { ethernet: 2, power: 1, layoutColumns: 3 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 2, xRatio: 0.5 },
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#f97316',
    description: 'Your 2.5G PoE+ injector profile, 30W output for AP or small PoE devices.'  },
  {
    id: 'unifi-flex-2-5g-8',
    category: 'switch',
    name: 'UniFi Flex 2.5G 8-port',
    defaultU: 1,
    depthMm: 76,
    widthType: 'shelf',
    customWidthMm: 213,
    weightKg: 0.395,
    powerW: 14,
    heatLevel: 3,
    ports: { ethernet: 9, fiber: 1, power: 1, layoutColumns: 10 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 9, xRatio: 0.42 },
        { type: 'fiber', columns: 1, xRatio: 0.88 },
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    color: '#2563eb',
    description: 'Your non-PoE Flex 2.5G 8-port switch with 10G RJ45 and SFP+ uplinks.'  },
  {
    id: 'jetkvm',
    category: 'ip-kvm',
    name: 'JetKVM',
    defaultU: 1,
    depthMm: 60,
    widthType: 'shelf',
    customWidthMm: 43,
    weightKg: 0.13,
    powerW: 2,
    heatLevel: 1,
    ports: { ethernet: 1, usb: 1, hdmi: 1, atx: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.3 },
        { type: 'usb', columns: 1, xRatio: 0.5 },
        { type: 'hdmi', columns: 1, xRatio: 0.7 },
        { type: 'atx', columns: 1, xRatio: 0.85 },
      ],
    },
    color: '#14b8a6',
    description: 'Tiny open-source IP KVM with mini HDMI, USB-C, RJ45, and RJ11 extension.'  },
  {
    id: 'sipeed-nanokvm-full',
    category: 'ip-kvm',
    name: 'Sipeed NanoKVM Full',
    defaultU: 1,
    depthMm: 40,
    widthType: 'shelf',
    customWidthMm: 36,
    weightKg: 0.08,
    powerW: 1,
    heatLevel: 1,
    ports: { ethernet: 1, usb: 3, hdmi: 1, atx: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.3 },
        { type: 'usb', columns: 3, xRatio: 0.5 },
        { type: 'hdmi', columns: 1, xRatio: 0.7 },
        { type: 'atx', columns: 1, xRatio: 0.85 },
      ],
    },
    color: '#0d9488',
    description: 'Ultra-compact NanoKVM Full profile with Ethernet, HDMI input, USB HID/storage, OLED, and ATX control.'  },
  {
    id: 'sipeed-nanokvm-lite',
    category: 'ip-kvm',
    name: 'Sipeed NanoKVM Lite',
    defaultU: 1,
    depthMm: 37,
    widthType: 'shelf',
    customWidthMm: 23,
    weightKg: 0.04,
    powerW: 1,
    heatLevel: 1,
    ports: { ethernet: 1, usb: 1, hdmi: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.3 },
        { type: 'usb', columns: 1, xRatio: 0.5 },
        { type: 'hdmi', columns: 1, xRatio: 0.7 },
      ],
    },
    color: '#2dd4bf',
    description: 'Bare NanoKVM Lite board profile for very dense shelf layouts.'  },
  {
    id: 'sipeed-nanokvm-pcie',
    category: 'ip-kvm',
    name: 'Sipeed NanoKVM PCIe',
    defaultU: 1,
    depthMm: 66,
    widthType: 'shelf',
    customWidthMm: 57,
    weightKg: 0.1,
    powerW: 1,
    heatLevel: 1,
    ports: { ethernet: 1, usb: 2, hdmi: 1, atx: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.3 },
        { type: 'usb', columns: 2, xRatio: 0.5 },
        { type: 'hdmi', columns: 1, xRatio: 0.7 },
        { type: 'atx', columns: 1, xRatio: 0.85 },
      ],
    },
    color: '#0f766e',
    description: 'PCIe-bracket NanoKVM profile with optional WiFi/PoE and internal ATX header routing.'  },
  {
    id: 'pikvm-v4-mini',
    category: 'ip-kvm',
    name: 'PiKVM V4 Mini',
    defaultU: 1,
    depthMm: 68,
    widthType: 'shelf',
    customWidthMm: 120,
    weightKg: 0.35,
    powerW: 12,
    heatLevel: 3,
    ports: { ethernet: 1, usb: 2, hdmi: 1, atx: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.3 },
        { type: 'usb', columns: 2, xRatio: 0.5 },
        { type: 'hdmi', columns: 1, xRatio: 0.7 },
        { type: 'atx', columns: 1, xRatio: 0.85 },
      ],
    },
    color: '#0ea5e9',
    description: 'Larger PiKVM-class reference template for comparison with NanoKVM and JetKVM.'  },
  {
    id: 'nas-4bay',
    category: 'nas',
    name: '4-bay NAS',
    defaultU: 3,
    depthMm: 260,
    widthType: 'shelf',
    customWidthMm: 230,
    weightKg: 6.5,
    powerW: 70,
    heatLevel: 4,
    ports: { ethernet: 2, usb: 2, power: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.15, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.8, groupLabel: 'Power' },
      ],
    },
    color: '#f59e0b',
    description: 'Shelf-mounted NAS with hot drives.'  },
  {
    id: 'bao-zang-he-pro-nas',
    category: 'nas',
    name: '寶藏盒 Pro NAS',
    defaultU: 6,
    depthMm: 292,
    widthType: 'shelf',
    customWidthMm: 329,
    weightKg: 8,
    powerW: 120,
    heatLevel: 4,
    ports: { ethernet: 2, usb: 4, hdmi: 1, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.35, groupLabel: 'Video' },
        { type: 'usb', count: 4, columns: 2, rowIndex: 1, xRatio: 0.15, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.8, groupLabel: 'Power' },
      ],
    },
    color: '#d97706',
    description: 'Your Baozanghe Pro NAS case profile from the provided image: 228.5 x 328.5 x 292mm.'  },
  {
    id: 'synology-ds923',
    category: 'nas',
    name: 'Synology DS923+',
    defaultU: 4,
    depthMm: 223,
    widthType: 'shelf',
    customWidthMm: 199,
    weightKg: 2.24,
    powerW: 35.51,
    heatLevel: 3,
    ports: { ethernet: 2, usb: 2, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.15, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.8, groupLabel: 'Power' },
      ],
    },
    color: '#f59e0b',
    description: 'Popular 4-bay desktop NAS profile for shelf planning.'  },
  {
    id: 'synology-rs1221',
    category: 'nas',
    name: 'Synology RS1221+ 2U NAS',
    defaultU: 2,
    depthMm: 306,
    widthType: '19in',
    weightKg: 6.9,
    powerW: 49.89,
    heatLevel: 4,
    ports: { ethernet: 4, usb: 2, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 2, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: '1GbE' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.12, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#d97706',
    description: 'Short-depth 8-bay rack NAS template.'  },
  {
    id: 'rack-nas-2u',
    category: 'nas',
    name: '2U rack NAS',
    defaultU: 2,
    depthMm: 520,
    widthType: '19in',
    weightKg: 12,
    powerW: 110,
    heatLevel: 4,
    ports: { ethernet: 4, power: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 2, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'NICs' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#d97706',
    description: 'Short-depth 19-inch storage server.'  },
  {
    id: 'rack-nas-4u-12bay',
    category: 'nas',
    name: '4U 12-bay rack NAS',
    defaultU: 4,
    depthMm: 550,
    widthType: '19in',
    weightKg: 18,
    powerW: 180,
    heatLevel: 4,
    ports: { ethernet: 4, usb: 2, power: 2, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 2, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'NICs' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.12, groupLabel: 'USB' },
        { type: 'power', count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#b45309',
    description: 'Generic 4U 12-bay storage chassis for TrueNAS, Unraid, or ZFS homelabs.'  },
  {
    id: 'rack-nas-4u-short-depth',
    category: 'nas',
    name: '4U short-depth NAS',
    defaultU: 4,
    depthMm: 390,
    widthType: '19in',
    weightKg: 14,
    powerW: 140,
    heatLevel: 4,
    ports: { ethernet: 2, usb: 2, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'NICs' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.12, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#c2410c',
    description: 'Short-depth 4U NAS profile for shallow racks that cannot fit full server chassis.'  },
  {
    id: 'rack-nas-6u-24bay',
    category: 'nas',
    name: '6U 24-bay storage NAS',
    defaultU: 6,
    depthMm: 650,
    widthType: '19in',
    weightKg: 30,
    powerW: 260,
    heatLevel: 5,
    ports: { ethernet: 4, fiber: 2, usb: 2, power: 2, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 2, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'NICs' },
        { type: 'fiber', count: 2, columns: 1, rowIndex: 0, xRatio: 0.38, speed: '10G', mediaType: 'sfp+', groupLabel: 'SFP+' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.12, groupLabel: 'USB' },
        { type: 'power', count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, groupLabel: 'Power' },
      ],
    },
    color: '#92400e',
    description: 'Large 6U storage NAS template for many-drive arrays; plan airflow, rails, and weight carefully.'  },
  {
    id: 'server-1u-short-depth',
    category: 'server',
    name: '1U short-depth server',
    defaultU: 1,
    depthMm: 380,
    widthType: '19in',
    weightKg: 8,
    powerW: 120,
    heatLevel: 4,
    ports: { ethernet: 2, usb: 2, power: 1, layoutColumns: 3 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.08, speed: '1G', mediaType: 'rj45', groupLabel: 'NIC' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.08, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 2, xRatio: 0.9, groupLabel: 'PSU' },
      ],
    },
    color: '#2563eb',
    description: 'Compact 1U server for router, virtualization, or lightweight compute in shallow homelab racks.'  },
  {
    id: 'server-1u-full-depth',
    category: 'server',
    name: '1U full-depth server',
    defaultU: 1,
    depthMm: 700,
    widthType: '19in',
    weightKg: 14,
    powerW: 220,
    heatLevel: 5,
    ports: { ethernet: 4, usb: 2, power: 2, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 2, rowIndex: 0, xRatio: 0.08, speed: '1G', mediaType: 'rj45', groupLabel: 'NICs' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.08, groupLabel: 'USB' },
        { type: 'power', count: 2, columns: 2, rowIndex: 2, xRatio: 0.85, groupLabel: 'PSU' },
      ],
    },
    faceplate: {
      rear: '/src/assets/faceplates/server-rear.svg',
    },
    color: '#1d4ed8',
    description: 'Full-depth 1U rack server template; check rack depth, noise, and rear clearance.'  },
  {
    id: 'server-2u-virtualization',
    category: 'server',
    name: '2U virtualization server',
    defaultU: 2,
    depthMm: 650,
    widthType: '19in',
    weightKg: 18,
    powerW: 260,
    heatLevel: 5,
    ports: { ethernet: 4, usb: 2, power: 2, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 4, columns: 2, rowIndex: 0, xRatio: 0.15, speed: '1G', mediaType: 'rj45', groupLabel: 'NICs' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.12, groupLabel: 'USB' },
        { type: 'power', count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, groupLabel: 'PSU' },
      ],
    },
    color: '#1e40af',
    description: 'Generic 2U Proxmox/ESXi server with more cooling room and expansion than a 1U node.'  },
  {
    id: 'server-3u-gpu',
    category: 'server',
    name: '3U GPU server',
    defaultU: 3,
    depthMm: 650,
    widthType: '19in',
    weightKg: 22,
    powerW: 420,
    heatLevel: 5,
    ports: { ethernet: 2, fiber: 2, usb: 2, hdmi: 1, power: 2, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.1, speed: '1G', mediaType: 'rj45', groupLabel: 'NIC' },
        { type: 'fiber', count: 2, columns: 1, rowIndex: 0, xRatio: 0.22, speed: '10G', mediaType: 'sfp+', groupLabel: 'SFP+' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.34, groupLabel: 'Video' },
        { type: 'usb', count: 2, columns: 1, rowIndex: 1, xRatio: 0.1, groupLabel: 'USB' },
        { type: 'power', count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, groupLabel: 'PSU' },
      ],
    },
    color: '#312e81',
    description: '3U compute server template with room for GPUs or larger PCIe cards.'  },
  {
    id: 'server-4u-tower-conversion',
    category: 'server',
    name: '4U tower-conversion server',
    defaultU: 4,
    depthMm: 560,
    widthType: '19in',
    weightKg: 20,
    powerW: 300,
    heatLevel: 5,
    ports: { ethernet: 2, usb: 4, hdmi: 1, power: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.1, speed: '1G', mediaType: 'rj45', groupLabel: 'NIC' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.22, groupLabel: 'Video' },
        { type: 'usb', count: 4, columns: 2, rowIndex: 1, xRatio: 0.15, groupLabel: 'USB' },
        { type: 'power', count: 1, columns: 1, rowIndex: 2, xRatio: 0.85, groupLabel: 'ATX Power' },
      ],
    },
    color: '#3730a3',
    description: '4U ATX-style rack server for quiet fans, many drives, and standard desktop parts.'  },
  {
    id: 'server-6u-workstation',
    category: 'server',
    name: '6U workstation server',
    defaultU: 6,
    depthMm: 600,
    widthType: '19in',
    weightKg: 28,
    powerW: 500,
    heatLevel: 5,
    ports: { ethernet: 2, fiber: 2, usb: 4, hdmi: 1, power: 2, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 2, columns: 1, rowIndex: 0, xRatio: 0.1, speed: '1G', mediaType: 'rj45', groupLabel: 'NIC' },
        { type: 'fiber', count: 2, columns: 1, rowIndex: 0, xRatio: 0.22, speed: '25G', mediaType: 'sfp28', groupLabel: 'SFP28' },
        { type: 'hdmi', count: 1, columns: 1, rowIndex: 0, xRatio: 0.34, groupLabel: 'Video' },
        { type: 'usb', count: 4, columns: 2, rowIndex: 1, xRatio: 0.1, groupLabel: 'USB' },
        { type: 'power', count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, groupLabel: 'PSU' },
      ],
    },
    color: '#4338ca',
    description: 'Tall 6U workstation/server chassis template for large GPUs, quiet cooling, or lab compute.'  },
  {
    id: 'ups-1u',
    category: 'ups',
    name: '1U UPS',
    defaultU: 1,
    depthMm: 360,
    widthType: '19in',
    weightKg: 14,
    powerW: 8,
    heatLevel: 2,
    ports: { power: 6, usb: 1 },
    portLayouts: {
      rear: [
        { type: 'power', count: 6, columns: 6, rowIndex: 0, xRatio: 0.35, groupLabel: 'Outlets' },
        { type: 'usb', count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: 'Management' },
      ],
    },
    color: '#374151',
    description: 'Heavy UPS, best kept low.'  },
  {
    id: 'apc-scl500rm1u',
    category: 'ups',
    name: 'APC SCL500RM1U Smart-UPS 500VA 120V',
    defaultU: 1,
    depthMm: 232,
    widthType: '19in',
    weightKg: 4.18,
    powerW: 8,
    powerBasis: 'estimated',
    powerPlanningNote: '8 W self-load is an existing planning estimate, not a manufacturer-verified consumption value.',
    powerCapacityW: 400,
    powerCapacityReference: { watts: 400, model: 'SCL500RM1U (120 V)', source: 'https://iportal.se.com/Contents/docs/SCL500RM1U_DATA%20SHEET.PDF', checkedAt: '2026-09-29' },
    heatLevel: 2,
    ports: { power: 4, ethernet: 1, usb: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'power', count: 4, columns: 4, rowIndex: 0, xRatio: 0.25, groupLabel: 'Outlets' },
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.65, groupLabel: 'Mgmt' },
        { type: 'usb', count: 1, columns: 1, rowIndex: 0, xRatio: 0.82, groupLabel: 'USB' },
      ],
    },
    color: '#374151',
    description: 'SCL500RM1U 120 V variant: 500 VA / 400 W output, four NEMA 5-15R outlets. Manufacturer data sheet confirms 232 mm depth and 4.18 kg. Battery Wh remains unverified; VA and VAh are not substituted for stored energy. Match the exact regional model before installation.'  },
  {
    id: 'apc-smt750rm1u',
    category: 'ups',
    name: 'APC Smart-UPS 750VA 1U',
    defaultU: 1,
    depthMm: 432,
    widthType: '19in',
    weightKg: 15.8,
    powerW: 10,
    heatLevel: 2,
    ports: { power: 4, usb: 1, layoutColumns: 4 },
    portLayouts: {
      rear: [
        { type: 'power', count: 4, columns: 4, rowIndex: 0, xRatio: 0.3, groupLabel: 'Outlets' },
        { type: 'usb', count: 1, columns: 1, rowIndex: 0, xRatio: 0.82, groupLabel: 'Management' },
      ],
    },
    faceplate: {
      rear: '/src/assets/faceplates/apc-smt750rm1u.rear.svg',
    },
    color: '#334155',
    description: 'Heavier short-depth 1U UPS profile; keep near the rack bottom.'  },
  {
    id: 'apc-gaming-ups',
    category: 'ups',
    name: 'APC Gaming UPS',
    defaultU: 7,
    depthMm: 408,
    widthType: 'shelf',
    customWidthMm: 105,
    weightKg: 11.5,
    powerW: 12,
    heatLevel: 2,
    ports: { power: 10, ethernet: 2, usb: 3, coax: 2, layoutColumns: 5 },
    portFaceOverrides: { power: 'rear', ethernet: 'rear', coax: 'rear', usb: 'front' },
    portLayouts: {
      // Based on the real BGM1500B: 3 USB charging ports stacked vertically on
      // the front; rear has 10 NEMA outlets in two columns of five (6 battery
      // + 4 surge-only) with RJ45/coax dataline protection along the bottom.
      front: [
        { type: 'usb', count: 3, columns: 1, rowIndex: 0, yRatio: 0.35, xRatio: 0.55, groupLabel: 'USB' },
      ],
      rear: [
        { type: 'power', count: 10, columns: 2, rowIndex: 0, yRatio: 0.3, xRatio: 0.5, groupLabel: 'Outlets' },
        { type: 'ethernet', count: 2, columns: 2, rowIndex: 1, yRatio: 0.85, xRatio: 0.25, groupLabel: 'Data' },
        { type: 'coax', count: 2, columns: 2, rowIndex: 1, yRatio: 0.85, xRatio: 0.75, groupLabel: 'Coax' },
      ],
    },
    color: '#334155',
    description: 'APC Back-UPS Pro Gaming tower UPS. Front: USB charging ports + LCD. Rear: 10 NEMA outlets, RJ45 data protection, coax protection, AC input.'  },
  {
    id: 'compact-ups',
    category: 'ups',
    name: 'Compact UPS',
    defaultU: 2,
    depthMm: 260,
    widthType: 'shelf',
    customWidthMm: 190,
    weightKg: 7.5,
    powerW: 6,
    heatLevel: 2,
    ports: { power: 4, usb: 1 },
    portLayouts: {
      rear: [
        { type: 'power', count: 4, columns: 4, rowIndex: 0, xRatio: 0.3, groupLabel: 'Outlets' },
        { type: 'usb', count: 1, columns: 1, rowIndex: 0, xRatio: 0.82, groupLabel: 'USB' },
      ],
    },
    color: '#475569',
    description: 'Shelf-mounted mini UPS.'  },
  {
    id: 'pdu-1u',
    category: 'pdu',
    name: '1U PDU',
    defaultU: 1,
    depthMm: 70,
    widthType: '19in',
    weightKg: 1.8,
    powerW: 0,
    heatLevel: 1,
    ports: { power: 8 },
    portLayouts: {
      rear: [
        { type: 'power', columns: 8, xRatio: 0.5 },
      ],
    },
    color: '#111827',
    description: 'Horizontal power distribution unit.'  },
  {
    id: 'pdu-0u-vertical',
    category: 'pdu-0u',
    name: '0U Vertical PDU',
    defaultU: 0,
    depthMm: 55,
    physicalHeightMm: 700,
    widthType: 'custom',
    customWidthMm: 55,
    weightKg: 4.2,
    powerW: 0,
    heatLevel: 1,
    ports: { power: 16, layoutColumns: 1 },
    portLayouts: {
      front: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    mountType: 'rear-rail',
    mountSide0U: 'left',
    outletFacing: 'outward',
    color: '#1f2937',
    description: 'Vertical 0U PDU. Mounts on the rear vertical rail behind the rack, does not consume U space.'  },
  {
    id: 'pdu-0u-short',
    category: 'pdu-0u',
    name: '0U Short PDU',
    defaultU: 0,
    depthMm: 55,
    physicalHeightMm: 400,
    widthType: 'custom',
    customWidthMm: 55,
    weightKg: 2.2,
    powerW: 0,
    heatLevel: 1,
    ports: { power: 8, layoutColumns: 1 },
    portLayouts: {
      front: [
        { type: 'power', columns: 1, xRatio: 0.5 },
      ],
    },
    mountType: 'rear-rail',
    mountSide0U: 'left',
    outletFacing: 'outward',
    color: '#1f2937',
    description: 'Short 400 mm 0U PDU. Mounts on the rear vertical rail behind the rack, does not consume U space.'  },
  {
    id: 'shelf-1u',
    category: 'shelf',
    name: 'Vented shelf',
    defaultU: 1,
    depthMm: 260,
    widthType: '19in',
    weightKg: 2.1,
    powerW: 0,
    heatLevel: 1,
    color: '#52525b',
    description: 'Shelf for non-rackmount devices.'  },
  {
    id: 'shelf-1u-shallow',
    category: 'shelf',
    name: '1U shallow vented shelf',
    defaultU: 1,
    depthMm: 180,
    widthType: '19in',
    weightKg: 1.5,
    powerW: 0,
    heatLevel: 1,
    color: '#52525b',
    description: 'Short shelf for routers, tiny PCs, and small switches.'  },
  {
    id: 'shelf-1u-deep',
    category: 'shelf',
    name: '1U deep vented shelf',
    defaultU: 1,
    depthMm: 450,
    widthType: '19in',
    weightKg: 3.5,
    powerW: 0,
    heatLevel: 1,
    color: '#4b5563',
    description: 'Full-depth shelf for heavier desktop NAS or lab gear.'  },
  {
    id: 'shelf-2u-heavy',
    category: 'shelf',
    name: '2U heavy-duty shelf',
    defaultU: 2,
    depthMm: 500,
    widthType: '19in',
    weightKg: 5,
    powerW: 0,
    heatLevel: 1,
    color: '#475569',
    description: 'Heavy support shelf for desktop NAS, UPS, or lab instruments.'  },
  {
    id: 'shelf-1u-sliding',
    category: 'shelf',
    name: '1U sliding shelf',
    defaultU: 1,
    depthMm: 450,
    widthType: '19in',
    weightKg: 4.2,
    powerW: 0,
    heatLevel: 1,
    color: '#64748b',
    description: 'Pull-out shelf template for keyboard, console, or small devices.'  },
  {
    id: 'half-width-device-tray',
    category: 'shelf',
    name: 'Half-width device tray',
    defaultU: 1,
    depthMm: 220,
    widthType: 'custom',
    customWidthMm: 235,
    weightKg: 1.2,
    powerW: 0,
    heatLevel: 1,
    color: '#52525b',
    description: 'Half-rack tray so two small device zones can share the same U.'  },
  {
    id: 'shelf-10in',
    category: 'shelf',
    name: '10-inch shelf',
    defaultU: 1,
    depthMm: 200,
    widthType: '10in',
    weightKg: 1.1,
    powerW: 0,
    heatLevel: 1,
    color: '#52525b',
    description: 'Compact shelf for small racks.'  },
  {
    id: 'shelf-10in-deep',
    category: 'shelf',
    name: '10-inch deep shelf',
    defaultU: 1,
    depthMm: 280,
    widthType: '10in',
    weightKg: 1.6,
    powerW: 0,
    heatLevel: 1,
    color: '#475569',
    description: 'Deeper compact shelf for mini PCs or a small NAS.'  },
  {
    id: 'pi-tray-1u',
    category: 'shelf',
    name: '1U Raspberry Pi tray',
    defaultU: 1,
    depthMm: 160,
    widthType: '19in',
    weightKg: 1,
    powerW: 0,
    heatLevel: 1,
    color: '#64748b',
    description: 'Tray placeholder for multiple SBC boards.'  },
  {
    id: 'cable-manager-1u',
    category: 'cable-management',
    name: 'Cable manager',
    defaultU: 1,
    depthMm: 60,
    widthType: '19in',
    weightKg: 0.9,
    powerW: 0,
    heatLevel: 1,
    color: '#334155',
    description: 'Horizontal brush cable manager.'  },
  {
    id: 'brush-panel-10in',
    category: 'cable-management',
    name: '10-inch brush pass-through panel',
    defaultU: 1,
    depthMm: 45,
    widthType: '10in',
    weightKg: 0.45,
    powerW: 0,
    heatLevel: 1,
    color: '#334155',
    description: 'Compact brush panel for cable pass-through in 10-inch wall racks.'  },
  {
    id: 'brush-panel-19in',
    category: 'cable-management',
    name: '19-inch brush pass-through panel',
    defaultU: 1,
    depthMm: 50,
    widthType: '19in',
    weightKg: 0.8,
    powerW: 0,
    heatLevel: 1,
    color: '#1f2937',
    description: 'Brush strip panel for routing cables between front and rear.'  },
  {
    id: 'd-ring-cable-manager-1u',
    category: 'cable-management',
    name: '1U D-ring cable manager',
    defaultU: 1,
    depthMm: 80,
    widthType: '19in',
    weightKg: 1,
    powerW: 0,
    heatLevel: 1,
    color: '#334155',
    description: 'Front cable-management panel with horizontal D-rings.'  },
  {
    id: 'lacing-bar-1u',
    category: 'cable-management',
    name: '1U rear lacing bar',
    defaultU: 1,
    depthMm: 35,
    widthType: '19in',
    weightKg: 0.5,
    powerW: 0,
    heatLevel: 1,
    color: '#475569',
    description: 'Rear cable tie-down bar for relieving strain behind patch panels.'  },
  {
    id: 'blank-1u',
    category: 'blank',
    name: '1U blank panel',
    defaultU: 1,
    depthMm: 20,
    widthType: '19in',
    weightKg: 0.5,
    powerW: 0,
    heatLevel: 1,
    color: '#18181b',
    description: 'Blanking panel for airflow control.'  },
  {
    id: 'blank-10in-1u',
    category: 'blank',
    name: '10-inch 1U blank panel',
    defaultU: 1,
    depthMm: 18,
    widthType: '10in',
    weightKg: 0.25,
    powerW: 0,
    heatLevel: 1,
    color: '#18181b',
    description: 'Compact blanking panel for 10-inch racks.'  },
  {
    id: 'blank-2u',
    category: 'blank',
    name: '2U blank panel',
    defaultU: 2,
    depthMm: 20,
    widthType: '19in',
    weightKg: 0.8,
    powerW: 0,
    heatLevel: 1,
    color: '#111827',
    description: 'Larger blank panel for airflow control or unused rack space.'  },
  {
    id: 'vented-blank-1u',
    category: 'blank',
    name: '1U vented blank panel',
    defaultU: 1,
    depthMm: 22,
    widthType: '19in',
    weightKg: 0.55,
    powerW: 0,
    heatLevel: 1,
    color: '#27272a',
    description: 'Perforated blank panel for light airflow while covering gaps.'  },
  {
    id: 'vented-blank-2u',
    category: 'blank',
    name: '2U vented blank panel',
    defaultU: 2,
    depthMm: 24,
    widthType: '19in',
    weightKg: 0.9,
    powerW: 0,
    heatLevel: 1,
    color: '#27272a',
    description: 'Two-unit vented filler panel for rack airflow planning.'  },
  {
    id: 'usw-pro-24-poe',
    category: 'switch',
    name: 'UniFi Switch Pro 24 PoE',
    defaultU: 1,
    depthMm: 285,
    widthType: '19in',
    weightKg: 4.4,
    powerW: 50,
    heatLevel: 4,
    ports: { ethernet: 24, fiber: 2, power: 1, layoutColumns: 12 },
    portLayouts: {
      // Ratios measured from the vendored front/rear photos: RJ45 block sits
      // right-of-center (2 rows of 12), SFP+ pair stacked at the far right,
      // IEC inlet on the rear right.
      front: [
        { type: 'ethernet', columns: 12, rowIndex: 0, yRatio: 0.5, xRatio: 0.81, portScale: 0.58, pairing: 'odd-even-vertical', speed: '1G', mediaType: 'rj45', groupLabel: 'Data' },
        { type: 'fiber', columns: 1, rowIndex: 0, yRatio: 0.5, xRatio: 0.97, speed: '10G', mediaType: 'sfp+', groupLabel: 'Uplink' }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.9 }
      ]
    },
    faceplate: {
      front: '/faceplates/ubiquiti/ubiquiti-unifi-switch-24-pro-poe-gen2.front.png',
      rear: '/faceplates/ubiquiti/ubiquiti-unifi-switch-24-pro-poe-gen2.rear.png'
    },
    color: '#1d4ed8',
    description: 'UniFi Pro 24 PoE: 24x GbE (16 PoE+, 8 PoE++), 2x 10G SFP+, 400W PoE budget, Layer 3.'
  },
  {
    id: 'usw-pro-48-poe',
    category: 'switch',
    name: 'UniFi Switch Pro 48 PoE',
    defaultU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 6.3,
    powerW: 60,
    heatLevel: 4,
    ports: { ethernet: 48, fiber: 4, power: 1, layoutColumns: 24 },
    portLayouts: {
      // Ratios measured from the vendored front/rear photos: RJ45 block is a
      // left-of-center 2x24 grid (odd ports top, even bottom), 4 SFP+ in a
      // 2x2 block at the right, IEC inlet on the rear right. portScale fits
      // the 24-wide row onto the photo's real port pitch.
      front: [
        { type: 'ethernet', columns: 24, rowIndex: 0, yRatio: 0.5, xRatio: 0.23, portScale: 0.85, pairing: 'odd-even-vertical', speed: '1G', mediaType: 'rj45', groupLabel: 'Data' },
        { type: 'fiber', columns: 2, rowIndex: 0, yRatio: 0.5, xRatio: 0.96, pairing: 'odd-even-vertical', speed: '10G', mediaType: 'sfp+', groupLabel: 'Uplink' }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.88 }
      ]
    },
    faceplate: {
      front: '/faceplates/ubiquiti/ubiquiti-unifi-switch-48-pro-poe-gen2.front.png',
      rear: '/faceplates/ubiquiti/ubiquiti-unifi-switch-48-pro-poe-gen2.rear.png'
    },
    color: '#1e40af',
    description: 'UniFi Pro 48 PoE: 48x GbE (40 PoE+, 8 PoE++), 4x 10G SFP+, 600W PoE budget, Layer 3.'
  },
  {
    id: 'usw-enterprise-24-poe',
    category: 'switch',
    name: 'UniFi Switch Enterprise 24 PoE',
    defaultU: 1,
    depthMm: 325,
    widthType: '19in',
    weightKg: 5.2,
    powerW: 60,
    heatLevel: 4,
    ports: { ethernet: 24, fiber: 2, power: 1, layoutColumns: 12 },
    portLayouts: {
      // Ratios measured from the vendored front/rear photos: single row of 24
      // RJ45 across the middle, 2 SFP+ side by side at the right, IEC inlet
      // on the rear right. portScale fits the 24-wide row onto the photo's
      // real port pitch.
      front: [
        { type: 'ethernet', columns: 24, rowIndex: 0, yRatio: 0.43, xRatio: 0.24, portScale: 0.84, speed: '1G', mediaType: 'rj45', groupLabel: 'Data' },
        { type: 'fiber', columns: 2, rowIndex: 0, yRatio: 0.43, xRatio: 0.98, speed: '10G', mediaType: 'sfp+', groupLabel: 'Uplink' }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.89 }
      ]
    },
    faceplate: {
      front: '/faceplates/ubiquiti/ubiquiti-unifi-switch-enterprise-24-poe.front.png',
      rear: '/faceplates/ubiquiti/ubiquiti-unifi-switch-enterprise-24-poe.rear.png'
    },
    color: '#1d4ed8',
    description: 'UniFi Enterprise 24 PoE: 12x GbE + 12x 2.5GbE (all PoE+), 2x 10G SFP+, 400W PoE budget, Layer 3.'
  },
  {
    id: 'usw-flex-mini',
    category: 'switch',
    name: 'UniFi Switch Flex Mini',
    defaultU: 1,
    depthMm: 70,
    widthType: 'shelf',
    customWidthMm: 107,
    weightKg: 0.15,
    powerW: 2.5,
    heatLevel: 1,
    ports: { ethernet: 5, power: 1, layoutColumns: 5 },
    portLayouts: {
      // Matches the official QSG hardware overview: 5 RJ45 in one centered
      // row across the front (port 1 = PoE in), single USB-C power port
      // centered on the back.
      front: [
        { type: 'ethernet', count: 5, columns: 5, rowIndex: 0, xRatio: 0.5, speed: '1G', mediaType: 'rj45', groupLabel: 'Ports' }
      ],
      rear: [
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: 'Power' }
      ]
    },
    color: '#2563eb',
    description: 'Compact 5-port GbE desktop switch, USB-C or PoE powered.'
  },
  {
    id: 'usw-16-poe',
    category: 'switch',
    name: 'UniFi Switch 16 PoE',
    defaultU: 1,
    depthMm: 200,
    widthType: '19in',
    weightKg: 2.9,
    powerW: 18,
    heatLevel: 3,
    ports: { ethernet: 16, fiber: 2, power: 1, layoutColumns: 8 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 8, xRatio: 0.38 },
        { type: 'fiber', columns: 2, xRatio: 0.9 }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#2563eb',
    description: 'UniFi Switch 16 PoE: 16x GbE (PoE+), 2x SFP, 42W PoE budget, fanless.'
  },
  {
    id: 'udm-se',
    category: 'router',
    name: 'UniFi Dream Machine Special Edition',
    defaultU: 1,
    depthMm: 286,
    widthType: '19in',
    weightKg: 5,
    powerW: 50,
    heatLevel: 4,
    ports: { ethernet: 9, fiber: 2, power: 1, layoutColumns: 11 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 1, columns: 1, xRatio: 0.12 },
        { type: 'ethernet', count: 8, columns: 8, xRatio: 0.48 },
        { type: 'fiber', count: 1, columns: 1, xRatio: 0.82 },
        { type: 'fiber', count: 1, columns: 1, xRatio: 0.92 }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#0ea5e9',
    description: 'UDM-SE: 8x GbE LAN (PoE), 1x 2.5GbE WAN, 2x 10G SFP+, built-in controller, 130W PoE budget.'
  },
  {
    id: 'uxg-pro',
    category: 'router',
    name: 'UniFi Next-Gen Gateway Pro',
    defaultU: 1,
    depthMm: 285,
    widthType: '19in',
    weightKg: 3.42,
    powerW: 30,
    heatLevel: 3,
    ports: { ethernet: 2, fiber: 2, power: 1, layoutColumns: 4 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 1, columns: 1, xRatio: 0.15 },
        { type: 'fiber', count: 1, columns: 1, xRatio: 0.35 },
        { type: 'ethernet', count: 1, columns: 1, xRatio: 0.65 },
        { type: 'fiber', count: 1, columns: 1, xRatio: 0.85 }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#0ea5e9',
    description: 'UXG-Pro: 1x GbE WAN, 1x SFP+ WAN, 1x GbE LAN, 1x SFP+ LAN, rackmount gateway, no built-in controller.'
  },
  {
    id: 'usg-pro-4',
    category: 'router',
    name: 'UniFi Security Gateway Pro 4',
    defaultU: 1,
    depthMm: 164,
    widthType: '19in',
    weightKg: 2.3,
    powerW: 40,
    heatLevel: 3,
    ports: { ethernet: 4, fiber: 2, power: 1, layoutColumns: 4 },
    portLayouts: {
      front: [
        { type: 'ethernet', count: 2, columns: 2, xRatio: 0.25 },
        { type: 'ethernet', count: 2, columns: 2, xRatio: 0.55 },
        { type: 'fiber', count: 2, columns: 2, xRatio: 0.85 }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#0d9488',
    description: 'USG-Pro-4: 2x GbE LAN, 2x RJ45/SFP combo WAN, 1U rackmount security gateway (legacy).'
  },
  {
    id: 'usg',
    category: 'router',
    name: 'UniFi Security Gateway',
    defaultU: 1,
    depthMm: 135,
    widthType: 'shelf',
    customWidthMm: 135,
    weightKg: 0.366,
    powerW: 7,
    heatLevel: 2,
    ports: { ethernet: 3, power: 1, layoutColumns: 3 },
    portLayouts: {
      front: [
        { type: 'ethernet', columns: 3, xRatio: 0.42 }
      ],
      rear: [
        { type: 'power', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#0d9488',
    description: 'USG: 3x GbE, compact fanless security gateway, wall or shelf mount (legacy).'
  },
  {
    id: 'u6-pro',
    category: 'access-point',
    name: 'UniFi U6-Pro',
    defaultU: 1,
    rackMountable: false,
    depthMm: 197,
    widthType: 'shelf',
    customWidthMm: 197,
    weightKg: 0.58,
    powerW: 13,
    heatLevel: 2,
    ports: { ethernet: 1, layoutColumns: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#38bdf8',
    description: 'WiFi 6 access point, ceiling or wall mount, 4x4 MIMO, up to 4.8 Gbps.'
  },
  {
    id: 'u6-lite',
    category: 'access-point',
    name: 'UniFi U6-Lite',
    defaultU: 1,
    rackMountable: false,
    depthMm: 160,
    widthType: 'shelf',
    customWidthMm: 160,
    weightKg: 0.30,
    powerW: 12,
    heatLevel: 2,
    ports: { ethernet: 1, layoutColumns: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', columns: 1, xRatio: 0.5 }
      ]
    },
    color: '#38bdf8',
    description: 'WiFi 6 access point, ceiling or wall mount, 2x2 MIMO, up to 1.2 Gbps.'
  },
  {
    id: 'unvr',
    category: 'nas',
    name: 'UniFi Protect NVR',
    defaultU: 1,
    depthMm: 325,
    widthType: '19in',
    weightKg: 5.2,
    powerW: 100,
    heatLevel: 3,
    ports: { ethernet: 1, fiber: 1, power: 1, layoutColumns: 2 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'fiber', count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, speed: '10G', mediaType: 'sfp+', groupLabel: 'SFP+' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.82, groupLabel: 'Power' }
      ]
    },
    color: '#f59e0b',
    description: 'UniFi Protect 4-bay NVR, 1x GbE, 1x 10G SFP+, rackmount, up to 50 cameras.'
  },
  {
    id: 'cloud-key-gen2-plus',
    category: 'mini-pc',
    name: 'UniFi Cloud Key Gen2 Plus',
    defaultU: 1,
    depthMm: 134,
    widthType: 'shelf',
    customWidthMm: 131,
    weightKg: 0.582,
    powerW: 12.95,
    heatLevel: 2,
    ports: { ethernet: 1, power: 1, layoutColumns: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.8, groupLabel: 'Power' }
      ]
    },
    color: '#7c3aed',
    description: 'UniFi Cloud Key Gen2 Plus: controller + Protect NVR, 1TB HDD, 1x GbE, PoE or USB-C powered.'
  },
  {
    id: 'usp-rps',
    category: 'pdu',
    name: 'UniFi SmartPower RPS',
    defaultU: 1,
    depthMm: 285,
    widthType: '19in',
    weightKg: 5.6,
    powerW: 0,
    heatLevel: 1,
    ports: { power: 6, layoutColumns: 6 },
    portFaceOverrides: { power: 'front' },
    portLayouts: {
      front: [
        { type: 'power', columns: 6, xRatio: 0.5 }
      ]
    },
    color: '#111827',
    description: 'UniFi SmartPower Redundant Power System, 6x USP-RPS DC output ports, 1U rackmount.'
  },
  // Expanded homelab selection; sources and modelling limits: docs/HOMELAB_CATALOG_ADDITIONS.zh-Hant.md
  {
    id: "unifi-ucg-ultra",
    category: "router",
    name: "UniFi Cloud Gateway Ultra (UCG-Ultra)",
    defaultU: 1,
    physicalHeightMm: 30,
    depthMm: 127.6,
    widthType: "shelf",
    customWidthMm: 141.8,
    weightKg: 0.52,
    powerW: 6.2,
    powerReference: { watts: 6.2, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 5,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 4,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.05,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.95,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "WAN"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 1,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "Compact gateway: 4x GbE LAN and 1x 2.5GbE WAN. Shelf-mounted; USB-C is power only. Power: official 6.2W maximum, not typical usage."
  },
  {
    id: "unifi-ucg-fiber",
    category: "router",
    name: "UniFi Cloud Gateway Fiber (UCG-Fiber)",
    defaultU: 1,
    physicalHeightMm: 30,
    depthMm: 127.6,
    widthType: "shelf",
    customWidthMm: 212.8,
    weightKg: 0.675,
    powerW: 29.4,
    powerReference: { watts: 29.4, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 5,
      fiber: 2,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      fiber: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 4,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.05,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.95,
          speed: "10G",
          mediaType: "rj45",
          groupLabel: "WAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 1,
          xRatio: 0.3,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 1,
          xRatio: 0.9,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "Shelf-mounted 10G gateway; 4x 2.5GbE, 1x 10GbE and 2x SFP+. 30W PoE output budget. Power: official 29.4W maximum excluding PoE output. Weight without SSD."
  },
  {
    id: "unifi-uxg-fiber",
    category: "router",
    name: "UniFi Gateway Fiber (UXG-Fiber)",
    defaultU: 1,
    physicalHeightMm: 30,
    depthMm: 127.6,
    widthType: "shelf",
    customWidthMm: 212.8,
    weightKg: 0.605,
    powerW: 25,
    powerReference: { watts: 25, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 5,
      fiber: 2,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      fiber: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 4,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.05,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.95,
          speed: "10G",
          mediaType: "rj45",
          groupLabel: "WAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 1,
          xRatio: 0.3,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 1,
          xRatio: 0.9,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "Shelf-mounted 10G gateway; 4x 2.5GbE, 1x 10GbE and 2x SFP+. 30W PoE output budget. Power: official 25W maximum excluding PoE output. Requires a separate UniFi Network controller."
  },
  {
    id: "unifi-udm-pro-max",
    category: "router",
    name: "UniFi Dream Machine Pro Max (UDM-Pro-Max)",
    defaultU: 1,
    physicalHeightMm: 43.7,
    depthMm: 285.6,
    widthType: "19in",
    weightKg: 4.7,
    powerW: 60,
    powerReference: { watts: 60, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 9,
      fiber: 2,
      power: 2
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 8,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.53,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.76,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "WAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.9,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        }
      ],
      rear: [
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.6,
          groupLabel: "AC / RPS"
        }
      ]
    },
    color: "#94a3b8",
    description: "1U gateway with two HDD bays, 8x GbE LAN, 2.5GbE WAN and 2x SFP+. Power: official 60W maximum. RPS is a proprietary DC input, shown as a generic power connector."
  },
  {
    id: "unifi-usw-pro-max-16-poe",
    category: "switch",
    name: "UniFi Switch Pro Max 16 PoE",
    defaultU: 1,
    physicalHeightMm: 43.7,
    depthMm: 160,
    widthType: "shelf",
    customWidthMm: 325.1,
    weightKg: 2.1,
    powerW: 25,
    powerReference: { watts: 25, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 16,
      fiber: 2,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 12,
          columns: 6,
          rowIndex: 0,
          xRatio: 0.38,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 4,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.7,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.9,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "USW-Pro-Max-16-PoE: 12x GbE PoE+, 4x 2.5GbE PoE++, 2x SFP+; 180W PoE budget. Shelf footprint; optional 19-inch rack kit not included. Power: official 25W maximum excluding PoE output."
  },
  {
    id: "unifi-usw-pro-max-24-poe",
    category: "switch",
    name: "UniFi Switch Pro Max 24 PoE",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 325,
    widthType: "19in",
    weightKg: 5.2,
    powerW: 50,
    powerReference: { watts: 50, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 24,
      fiber: 2,
      power: 2
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 16,
          columns: 8,
          rowIndex: 0,
          xRatio: 0.35,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 8,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.69,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.91,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        }
      ],
      rear: [
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.6,
          groupLabel: "AC / RPS"
        }
      ]
    },
    color: "#94a3b8",
    description: "16x GbE, 8x 2.5GbE and 2x SFP+. Power: official 50W maximum. 400W PoE output budget; 8 PoE+ and 16 PoE++ ports. Maximum excludes PoE output. Weight includes rack brackets. RPS shown as generic power."
  },
  {
    id: "unifi-usw-pro-max-24",
    category: "switch",
    name: "UniFi Switch Pro Max 24",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 325,
    widthType: "19in",
    weightKg: 4.3,
    powerW: 50,
    powerReference: { watts: 50, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 24,
      fiber: 2,
      power: 2
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 16,
          columns: 8,
          rowIndex: 0,
          xRatio: 0.35,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 8,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.69,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.91,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        }
      ],
      rear: [
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.6,
          groupLabel: "AC / RPS"
        }
      ]
    },
    color: "#94a3b8",
    description: "16x GbE, 8x 2.5GbE and 2x SFP+. Power: official 50W maximum. Non-PoE model. Weight includes rack brackets. RPS shown as generic power."
  },
  {
    id: "unifi-usw-aggregation",
    category: "switch",
    name: "UniFi Switch Aggregation (USW-Aggregation)",
    defaultU: 1,
    physicalHeightMm: 43.7,
    depthMm: 120,
    widthType: "19in",
    weightKg: 2.7,
    powerW: 36,
    powerReference: { watts: 36, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      fiber: 8,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "fiber",
          count: 8,
          columns: 8,
          rowIndex: 0,
          xRatio: 0.6,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "Shallow 1U 10G core switch with 8x SFP+ and no RJ45 ports. Power: official 36W maximum including SFP modules. Weight includes rack brackets."
  },
  {
    id: "unifi-usw-lite-16-poe",
    category: "switch",
    name: "UniFi Switch Lite 16 PoE",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 185,
    widthType: "shelf",
    customWidthMm: 192,
    weightKg: 1.2,
    powerW: 15,
    powerReference: { watts: 15, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 16,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 16,
          columns: 8,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "USW-Lite-16-PoE: 16x GbE, 8 PoE+ ports, 45W PoE output budget. Shelf-mounted. Power: official 15W maximum excluding PoE output."
  },
  {
    id: "unifi-usw-ultra",
    category: "switch",
    name: "UniFi Switch Ultra (USW-Ultra)",
    defaultU: 1,
    physicalHeightMm: 33,
    depthMm: 76,
    widthType: "shelf",
    customWidthMm: 203,
    weightKg: 0.32,
    powerW: 9,
    powerReference: { watts: 9, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 8,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 8,
          columns: 8,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "8x GbE: 7 PoE+ outputs and 1 PoE++ input. Power: official 9W maximum with PoE input, excluding output (8W with DC adapter). PoE budget depends on input supply; adapter not included."
  },
  {
    id: "unifi-usw-flex-mini-2-5g",
    category: "switch",
    name: "UniFi Switch Flex Mini 2.5G",
    defaultU: 1,
    physicalHeightMm: 21.2,
    depthMm: 90,
    widthType: "shelf",
    customWidthMm: 117.1,
    weightKg: 0.206,
    powerW: 6.4,
    powerReference: { watts: 6.4, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 5,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "ethernet",
          count: 5,
          columns: 5,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#94a3b8",
    description: "USW-Flex-2.5G-5: 5x 2.5GbE; PoE input or USB-C power, no PoE output. Power: official 6.4W maximum via PoE (5W via USB-C). USB-C shown as power only."
  },
  {
    id: "unifi-u6-plus",
    category: "access-point",
    name: "UniFi U6+",
    defaultU: 1,
    physicalHeightMm: 33,
    depthMm: 160,
    widthType: "shelf",
    customWidthMm: 160,
    rackMountable: false,
    weightKg: 0.338,
    powerW: 9,
    powerReference: { watts: 9, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "PoE uplink"
        }
      ]
    },
    color: "#94a3b8",
    description: "External ceiling/wall AP; keep in My devices inventory, not inside the rack. One 1G PoE uplink, no separate power jack. Power: official 9W maximum. Footprint approximates the circular enclosure."
  },
  {
    id: "unifi-u7-lite",
    category: "access-point",
    name: "UniFi U7 Lite",
    defaultU: 1,
    physicalHeightMm: 33,
    depthMm: 171.5,
    widthType: "shelf",
    customWidthMm: 171.5,
    rackMountable: false,
    weightKg: 0.313,
    powerW: 13,
    powerReference: { watts: 13, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "PoE uplink"
        }
      ]
    },
    color: "#94a3b8",
    description: "External ceiling/wall AP; keep in My devices inventory, not inside the rack. One 2.5G PoE uplink, no separate power jack. Power: official 13W maximum. Footprint approximates the circular enclosure."
  },
  {
    id: "mikrotik-crs310-8g-2s-in",
    category: "switch",
    name: "MikroTik CRS310-8G+2S+IN",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 206.1,
    widthType: "shelf",
    customWidthMm: 200,
    weightKg: 1,
    powerW: 21,
    powerReference: { watts: 21, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      usb: 1,
      ethernet: 8,
      fiber: 2,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "usb",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.08,
          mediaType: "usb2",
          groupLabel: "USB"
        },
        {
          type: "ethernet",
          count: 8,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.46,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.85,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "8x 2.5GbE and 2x 10G SFP+ for a compact storage network. Shelf footprint; optional rack ears not included. Power: official 21W maximum without attachments (34W with attachments). Weight: 1kg planning estimate, not manufacturer-verified."
  },
  {
    id: "tp-link-er605-v2",
    category: "router",
    name: "TP-Link Omada ER605 V2",
    defaultU: 1,
    physicalHeightMm: 25,
    depthMm: 101,
    widthType: "shelf",
    customWidthMm: 158,
    weightKg: 0.4,
    powerW: 7.94,
    powerReference: { watts: 7.94, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      usb: 1,
      ethernet: 5,
      power: 1
    },
    portLayouts: {
      front: [
        {
          type: "usb",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.1,
          mediaType: "usb2",
          groupLabel: "LTE USB"
        },
        {
          type: "ethernet",
          count: 5,
          columns: 5,
          rowIndex: 0,
          xRatio: 0.62,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "WAN / LAN"
        }
      ],
      rear: [
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "Compact VPN router with 1x WAN, 2x WAN/LAN, 2x LAN and USB 2.0 LTE backup. Power: official 7.94W maximum. Weight: 0.4kg planning estimate, not manufacturer-verified."
  },
  {
    id: "synology-ds224-plus",
    category: "nas",
    name: "Synology DiskStation DS224+",
    defaultU: 4,
    physicalHeightMm: 165,
    depthMm: 232.2,
    widthType: "shelf",
    customWidthMm: 108,
    weightKg: 1.3,
    powerW: 14.69,
    powerReference: { watts: 14.69, basis: 'measured', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 2,
      usb: 2,
      power: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 1,
          xRatio: 0.5,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.5,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "Two-bay shelf NAS, 2x GbE and 2x USB 3.2 Gen 1. Power: official 14.69W access measurement, not maximum. Weight excludes drives. USB ports grouped on rear schematically; physical front/rear split is not represented."
  },
  // Saved rack builds and current compact compute/storage; see catalog additions source notes.
  {
    id: "ednse-ed408h40",
    category: "server",
    name: "EDNSE ED408H40 8-bay NAS (saved build)",
    defaultU: 4,
    physicalHeightMm: 177.8,
    depthMm: 400,
    widthType: "19in",
    weightKg: 14,
    powerW: 140,
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 2,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      usb: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.23,
          groupLabel: "Configured LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          groupLabel: "Configured USB"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Configured PSU"
        }
      ]
    },
    color: "#0f766e",
    description: "Saved 22U build profile, not factory specifications. 4U envelope, depth 400mm, weight 14kg, power 140W and I/O copied from the local rack layout; all are configuration estimates. Adjust motherboard, PSU, drives and GPU for your build."
  },
  {
    id: "ednse-ed412h40",
    category: "server",
    name: "EDNSE ED412H40 12-bay NAS (saved build)",
    defaultU: 4,
    physicalHeightMm: 177.8,
    depthMm: 400,
    widthType: "19in",
    weightKg: 18,
    powerW: 180,
    heatLevel: 3,
    ports: {
      ethernet: 4,
      usb: 2,
      power: 2
    },
    portFaceOverrides: {
      ethernet: "rear",
      usb: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 4,
          columns: 4,
          rowIndex: 0,
          xRatio: 0.23,
          groupLabel: "Configured LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          groupLabel: "Configured USB"
        },
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Configured PSU"
        }
      ]
    },
    color: "#0f766e",
    description: "Saved 22U build profile, not factory specifications. 4U envelope, depth 400mm, weight 18kg, power 180W and I/O copied from the local rack layout; all are configuration estimates. Adjust motherboard, PSU, drives and GPU for your build."
  },
  {
    id: "jmcd-12e5",
    category: "nas",
    name: "JMCD 12E5 NAS (saved build)",
    defaultU: 6,
    physicalHeightMm: 266.7,
    depthMm: 415,
    widthType: "19in",
    weightKg: 25,
    powerW: 150,
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 2,
      power: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.23,
          groupLabel: "Configured LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          groupLabel: "Configured USB"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Configured PSU"
        }
      ]
    },
    color: "#0f766e",
    description: "Saved 22U build profile, not factory specifications. 6U envelope, depth 415mm, weight 25kg, power 150W and I/O copied from the local rack layout; all are configuration estimates. Adjust motherboard, PSU, drives and GPU for your build."
  },
  {
    id: "toploong-f4811",
    category: "server",
    name: "拓普龍 F4811 VM server (saved build)",
    defaultU: 4,
    physicalHeightMm: 177.8,
    depthMm: 480,
    widthType: "19in",
    weightKg: 18,
    powerW: 350,
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 4,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      usb: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.23,
          groupLabel: "Configured LAN"
        },
        {
          type: "usb",
          count: 4,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          groupLabel: "Configured USB"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Configured PSU"
        }
      ]
    },
    color: "#0f766e",
    description: "Saved 22U build profile, not factory specifications. 4U envelope, depth 480mm, weight 18kg, power 350W and I/O copied from the local rack layout; all are configuration estimates. Adjust motherboard, PSU, drives and GPU for your build."
  },
  {
    id: "dingxiang-4u400-12",
    category: "nas",
    name: "鼎翔 4U400-12 NAS (saved build)",
    defaultU: 4,
    physicalHeightMm: 177.8,
    depthMm: 400,
    widthType: "19in",
    weightKg: 12,
    powerW: 120,
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 2,
      power: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.23,
          groupLabel: "Configured LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          groupLabel: "Configured USB"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Configured PSU"
        }
      ]
    },
    color: "#0f766e",
    description: "Saved 22U build profile, not factory specifications. 4U envelope, depth 400mm, weight 12kg, power 120W and I/O copied from the local rack layout; all are configuration estimates. Adjust motherboard, PSU, drives and GPU for your build."
  },
  {
    id: "dingxiang-4u450",
    category: "server",
    name: "鼎翔 4U450 VM server (saved build)",
    defaultU: 4,
    physicalHeightMm: 177.8,
    depthMm: 450,
    widthType: "19in",
    weightKg: 10,
    powerW: 300,
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 4,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      usb: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.23,
          groupLabel: "Configured LAN"
        },
        {
          type: "usb",
          count: 4,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          groupLabel: "Configured USB"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Configured PSU"
        }
      ]
    },
    color: "#0f766e",
    description: "Saved 22U build profile, not factory specifications. 4U envelope, depth 450mm, weight 10kg, power 300W and I/O copied from the local rack layout; all are configuration estimates. Adjust motherboard, PSU, drives and GPU for your build."
  },
  {
    id: "minisforum-ms-a2",
    category: "mini-pc",
    name: "Minisforum MS-A2",
    defaultU: 2,
    physicalHeightMm: 48,
    depthMm: 189,
    widthType: "shelf",
    customWidthMm: 196,
    weightKg: 1.4,
    powerW: 60,
    powerReference: { watts: 60, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 2,
      fiber: 2,
      usb: 7,
      hdmi: 1,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      fiber: "rear",
      usb: "rear",
      hdmi: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.25,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.75,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        },
        {
          type: "usb",
          count: 6,
          columns: 6,
          rowIndex: 1,
          xRatio: 0.15,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "usb",
          count: 1,
          columns: 1,
          rowIndex: 1,
          xRatio: 0.9,
          mediaType: "usb2",
          groupLabel: "USB (schematic)"
        },
        {
          type: "hdmi",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.25,
          groupLabel: "HDMI"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.75,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "Compact virtualization workstation: dual 2.5GbE and dual 10G SFP+. Power: 60W planning estimate, not measured or maximum; depends on CPU/RAM/storage. Seven USB ports grouped on rear schematically; actual ports span both faces."
  },
  {
    id: "minisforum-ms-02-ultra-285hx",
    category: "mini-pc",
    name: "Minisforum MS-02 Ultra (285HX / 25GbE)",
    defaultU: 3,
    physicalHeightMm: 97,
    depthMm: 221.5,
    widthType: "shelf",
    customWidthMm: 225,
    weightKg: 3.45,
    powerW: 22,
    powerReference: { watts: 22, basis: 'idle', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 2,
      fiber: 2,
      usb: 7,
      hdmi: 1,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      fiber: "rear",
      usb: "rear",
      hdmi: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.16666666666666666,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "10G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.8333333333333334,
          speed: "25G",
          mediaType: "sfp28",
          groupLabel: "SFP28"
        },
        {
          type: "usb",
          count: 7,
          columns: 7,
          rowIndex: 1,
          xRatio: 0.5,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "hdmi",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.25,
          groupLabel: "HDMI"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.75,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "285HX with dual 25GbE NIC, not the NS variant. Horizontal shelf orientation. Power: manufacturer Windows idle test 22W with 25G NIC, NOT a load budget or 350W PSU rating. Seven USB ports grouped on rear; USB4/Thunderbolt use generic USB data sockets. Leave cooling clearance."
  },
  {
    id: "beelink-me-mini-n200",
    category: "nas",
    name: "Beelink ME mini (N200 / dual 2.5GbE)",
    defaultU: 3,
    physicalHeightMm: 98.3,
    depthMm: 99,
    widthType: "shelf",
    customWidthMm: 99,
    weightKg: 0.78,
    powerW: 20,
    powerReference: { watts: 20, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 3,
      hdmi: 1,
      power: 1
    },
    portFaceOverrides: {
      hdmi: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.5,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 1,
          xRatio: 0.15,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "usb",
          count: 1,
          columns: 1,
          rowIndex: 1,
          xRatio: 0.9,
          mediaType: "usb2",
          groupLabel: "USB (schematic)"
        },
        {
          type: "hdmi",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.25,
          groupLabel: "HDMI"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.75,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "N200 / 12GB six-M.2 NAS variant, dual 2.5GbE (not the newer 5G SKU). Power: 20W planning estimate, not measured or maximum. USB-A/C data ports grouped schematically on rear; internal M.2 slots are not cable sockets."
  },
  {
    id: "ugreen-dxp4800-pro",
    category: "nas",
    name: "UGREEN NASync DXP4800 Pro",
    defaultU: 4,
    physicalHeightMm: 177.8,
    depthMm: 256.54,
    widthType: "shelf",
    customWidthMm: 177.8,
    weightKg: 5,
    powerW: 42.36,
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 5,
      hdmi: 1,
      power: 1
    },
    portFaceOverrides: {
      hdmi: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.25,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.75,
          speed: "10G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "usb",
          count: 3,
          columns: 3,
          rowIndex: 1,
          xRatio: 0.15,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 1,
          xRatio: 0.9,
          mediaType: "usb2",
          groupLabel: "USB (schematic)"
        },
        {
          type: "hdmi",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.25,
          groupLabel: "HDMI"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 2,
          xRatio: 0.75,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "Four HDD bays plus two M.2 slots. Power: official 42.36W access test, not maximum. Weight: 5kg planning estimate, not manufacturer-verified. Dimensions converted from rounded 10.1 x 7 x 7 inch specification; allow extra shelf clearance. Five USB ports grouped on rear; SD reader not modelled."
  },
  {
    id: "synology-ds925-plus",
    category: "nas",
    name: "Synology DiskStation DS925+",
    defaultU: 4,
    physicalHeightMm: 166,
    depthMm: 223,
    widthType: "shelf",
    customWidthMm: 199,
    weightKg: 2.26,
    powerW: 37.91,
    powerReference: { watts: 37.91, basis: 'measured', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 2,
      usb: 2,
      power: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.25,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.57,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.85,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "Four-bay NAS with dual 2.5GbE. Power: official 37.91W access measurement, not maximum; weight excludes drives. Two USB ports grouped on rear schematically. Dedicated USB-C DX525 expansion connector omitted: it is not a general-purpose USB data port."
  },
  {
    id: "zimaboard-2",
    category: "sbc",
    name: "ZimaBoard 2",
    defaultU: 1,
    physicalHeightMm: 31,
    depthMm: 83,
    widthType: "shelf",
    customWidthMm: 140,
    weightKg: 0.407,
    powerW: 12,
    powerReference: { watts: 12, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {
      ethernet: 2,
      usb: 2,
      power: 1
    },
    portFaceOverrides: {
      ethernet: "rear",
      usb: "rear"
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.23,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "usb",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.57,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        },
        {
          type: "power",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.88,
          groupLabel: "Power"
        }
      ]
    },
    color: "#0f766e",
    description: "Intel N150 single-board server with dual 2.5GbE. Power: 12W planning estimate, not measured, CPU TDP or the 60W adapter rating. Mini DisplayPort, SATA and PCIe are not represented by supported cable types; no HDMI socket. Port placement is schematic."
  },
  {
    id: "unifi-unas-pro",
    category: "nas",
    name: "UniFi UNAS Pro",
    defaultU: 2,
    physicalHeightMm: 87.4,
    depthMm: 325,
    widthType: "19in",
    weightKg: 9.5,
    installationRequirements: { support: 'rails', railMinMm: 650, railMaxMm: 1000, source: 'Existing catalog rail-kit description; confirm your kit model' },
    powerW: 160,
    powerReference: { watts: 160, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 1,
      fiber: 1,
      power: 2
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.3,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.55,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        },
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.82,
          groupLabel: "Power inputs"
        }
      ]
    },
    color: "#94a3b8",
    description: "Seven HDD bays; AC and proprietary RPS inputs shown as generic power. Rail mounting depth 650-1000mm. Power: official 160W maximum, not typical or PSU capacity. Weight includes rack brackets but not installed drives. Rail range is checked against the recorded mounting-post spacing; confirm the installed kit model."
  },
  {
    id: "unifi-unas-pro-4",
    category: "nas",
    name: "UniFi UNAS Pro 4",
    defaultU: 1,
    physicalHeightMm: 43.7,
    depthMm: 400,
    widthType: "19in",
    weightKg: 6.7,
    installationRequirements: { support: 'rails', railMinMm: 600, railMaxMm: 1066, source: 'Existing catalog rail-kit description; confirm your kit model' },
    powerW: 150,
    powerReference: { watts: 150, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 1,
      fiber: 2,
      power: 2
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.3,
          speed: "1G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        },
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.82,
          groupLabel: "Power inputs"
        }
      ]
    },
    color: "#94a3b8",
    description: "Four HDD bays plus two M.2 slots; AC and proprietary RPS inputs shown as generic power. Rail mounting depth 600-1066mm. Power: official 150W maximum, not typical or PSU capacity. Weight includes rack brackets but not installed drives. Rail range is checked against the recorded mounting-post spacing; confirm the installed kit model."
  },
  {
    id: "unifi-unas-pro-8",
    category: "nas",
    name: "UniFi UNAS Pro 8",
    defaultU: 2,
    physicalHeightMm: 87.4,
    depthMm: 480,
    widthType: "19in",
    weightKg: 11.5,
    installationRequirements: { support: 'rails', railMinMm: 600, railMaxMm: 1066, source: 'Existing catalog rail-kit description; confirm your kit model' },
    powerW: 250,
    powerReference: { watts: 250, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 1,
      fiber: 2,
      power: 2
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.3,
          speed: "10G",
          mediaType: "rj45",
          groupLabel: "LAN"
        },
        {
          type: "fiber",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.55,
          speed: "10G",
          mediaType: "sfp+",
          groupLabel: "SFP+"
        },
        {
          type: "power",
          count: 2,
          columns: 2,
          rowIndex: 0,
          xRatio: 0.82,
          groupLabel: "Power inputs"
        }
      ]
    },
    color: "#94a3b8",
    description: "Eight HDD bays plus two M.2 slots; two AC PSU inputs. Rail mounting depth 600-1066mm. Power: official 250W maximum, not typical or PSU capacity. Weight includes rack brackets but not installed drives. Rail range is checked against the recorded mounting-post spacing; confirm the installed kit model."
  },
  {
    id: "unifi-unas-2",
    category: "nas",
    name: "UniFi UNAS 2",
    defaultU: 6,
    physicalHeightMm: 223.7,
    depthMm: 129,
    widthType: "shelf",
    customWidthMm: 135,
    weightKg: 1.3,
    powerW: 60,
    powerReference: { watts: 60, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {
      ethernet: 1,
      usb: 1
    },
    portLayouts: {
      rear: [
        {
          type: "ethernet",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.32,
          speed: "2.5G",
          mediaType: "rj45",
          groupLabel: "PoE++ input"
        },
        {
          type: "usb",
          count: 1,
          columns: 1,
          rowIndex: 0,
          xRatio: 0.7,
          mediaType: "usb3",
          groupLabel: "USB (schematic)"
        }
      ]
    },
    color: "#94a3b8",
    description: "Two-bay desktop NAS; upright 6U shelf envelope. Powered only by PoE++ through 2.5GbE; no separate power jack. USB-C is 5Gbps data. Power: official 60W maximum, not typical. Weight excludes drives. PoE supply compatibility is not automatically validated."
  },
  // Model-specific Mini PCs and remaining homelab coverage: docs/HOMELAB_CATALOG_MODELS.zh-Hant.md
  {
    id: "dell-optiplex-7050-micro",
    category: "mini-pc",
    name: "Dell OptiPlex 7050 Micro",
    defaultU: 1,
    physicalHeightMm: 35.56,
    depthMm: 177.8,
    widthType: "shelf",
    customWidthMm: 182.88,
    weightKg: 1.18,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "One standard HDMI plus one DisplayPort; 5 USB-A + 1 USB-C (Gen 1). Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "dell-optiplex-7070-micro",
    category: "mini-pc",
    name: "Dell OptiPlex 7070 Micro",
    defaultU: 1,
    physicalHeightMm: 36,
    depthMm: 178,
    widthType: "shelf",
    customWidthMm: 182,
    weightKg: 1.18,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Two standard DisplayPorts; HDMI is optional. 5 USB-A + 1 USB-C, including Gen 2 ports. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "dell-optiplex-7090-micro",
    category: "mini-pc",
    name: "Dell OptiPlex 7090 Micro",
    defaultU: 1,
    physicalHeightMm: 36,
    depthMm: 178.5,
    widthType: "shelf",
    customWidthMm: 182,
    weightKg: 1.38,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Integrated-graphics chassis, not the discrete-GPU version. Two DisplayPorts; HDMI is optional. 5 USB-A + 1 USB-C including Gen 2x2. Weight uses the official maximum 1.38kg. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "lenovo-thinkcentre-m720q",
    category: "mini-pc",
    name: "Lenovo ThinkCentre M720q Tiny",
    defaultU: 1,
    physicalHeightMm: 37,
    depthMm: 183,
    widthType: "shelf",
    customWidthMm: 179,
    weightKg: 1.32,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "8th/9th-gen Intel platform; 5 USB-A + 1 USB-C. Optional PCIe riser/card is not preinstalled; PCIe card and 2.5-inch drive are mutually exclusive. One standard HDMI and one DisplayPort. Height includes rubber feet. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "lenovo-thinkcentre-m920q",
    category: "mini-pc",
    name: "Lenovo ThinkCentre M920q Tiny",
    defaultU: 1,
    physicalHeightMm: 37,
    depthMm: 183,
    widthType: "shelf",
    customWidthMm: 179,
    weightKg: 1.32,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Q370/vPro-capable platform; 5 USB-A + 1 USB-C. Optional PCIe riser/card is not preinstalled; PCIe card and 2.5-inch drive are mutually exclusive. One standard HDMI and one DisplayPort. Height includes rubber feet. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "lenovo-thinkcentre-m90q-gen3",
    category: "mini-pc",
    name: "Lenovo ThinkCentre M90q Gen 3 Tiny",
    defaultU: 1,
    physicalHeightMm: 36.5,
    depthMm: 182.9,
    widthType: "shelf",
    customWidthMm: 179,
    weightKg: 1.25,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 7, columns: 7, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "12th-gen Intel platform; 6 USB-A + 1 USB-C. Optional 2.5GbE/PCIe network card is not included. One standard HDMI and one DisplayPort. Height includes rubber feet. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "hp-elitedesk-800-g3-mini",
    category: "mini-pc",
    name: "HP EliteDesk 800 G3 Desktop Mini",
    defaultU: 1,
    physicalHeightMm: 34,
    depthMm: 175,
    widthType: "shelf",
    customWidthMm: 177,
    weightKg: 1.3,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 7, columns: 7, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "6th/7th-gen Intel platform; 6 USB-A + 1 USB-C. Integrated graphics with two standard DisplayPorts; HDMI is optional. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "hp-elitedesk-800-g4-mini",
    category: "mini-pc",
    name: "HP EliteDesk 800 G4 Desktop Mini",
    defaultU: 1,
    physicalHeightMm: 34,
    depthMm: 175,
    widthType: "shelf",
    customWidthMm: 177,
    weightKg: 1.77,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 7, columns: 7, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "8th-gen Intel platform; 6 USB-A + 1 USB-C with Gen 2 support. Approximate weight from service guide. Integrated graphics with two standard DisplayPorts; HDMI is optional. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "hp-elitedesk-800-g6-mini",
    category: "mini-pc",
    name: "HP EliteDesk 800 G6 Desktop Mini",
    defaultU: 1,
    physicalHeightMm: 34,
    depthMm: 175,
    widthType: "shelf",
    customWidthMm: 177,
    weightKg: 1.42,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 7, columns: 7, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "10th-gen Intel platform; 6 USB-A + 1 USB-C. Optional Flex IO 2.5GbE, HDMI and discrete GPU are not included. Integrated graphics with two standard DisplayPorts; HDMI is optional. Horizontal shelf footprint; USB ports grouped on rear schematically although the real machine has front and rear ports. DisplayPort/audio and optional I/O modules are not represented. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for your CPU/RAM/storage.",
  },
  {
    id: "dell-poweredge-r730",
    category: "server",
    name: "Dell PowerEdge R730 (4x1GbE / dual PSU)",
    defaultU: 2,
    physicalHeightMm: 87.3,
    depthMm: 755.8,
    widthType: "19in",
    weightKg: 31.5,
    powerW: 200,
    powerReference: { watts: 200, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 4,
    ports: {ethernet: 5, power: 2, usb: 3},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.2, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.55, speed: "1G", mediaType: "rj45", groupLabel: "iDRAC management"},
        {type: "power", count: 2, columns: 2, rowIndex: 0, xRatio: 0.9, groupLabel: "Power input"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.25, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 1, columns: 1, rowIndex: 1, xRatio: 0.8, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "2U 3.5-inch drive chassis, quad-GbE network card plus dedicated iDRAC Ethernet; dual AC PSUs. Depth 755.8mm uses the Dell overall envelope, not rail-to-rear body depth; reserve cable/rail clearance. Weight 31.5kg is the manufacturer fully populated maximum. Power: 200W planning estimate, not measured or PSU capacity. General USB grouped on rear; dedicated iDRAC Direct USB, internal USB, VGA and serial are omitted. Optional NIC/GPU configurations require edits.",
  },
  {
    id: "dell-poweredge-r740",
    category: "server",
    name: "Dell PowerEdge R740 (4x1GbE / dual PSU)",
    defaultU: 2,
    physicalHeightMm: 86.8,
    depthMm: 737.5,
    widthType: "19in",
    weightKg: 28.6,
    powerW: 220,
    powerReference: { watts: 220, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 4,
    ports: {ethernet: 5, power: 2, usb: 4},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.2, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.55, speed: "1G", mediaType: "rj45", groupLabel: "iDRAC management"},
        {type: "power", count: 2, columns: 2, rowIndex: 0, xRatio: 0.9, groupLabel: "Power input"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.25, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.8, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "2U 3.5-inch drive chassis, quad-GbE network card plus dedicated iDRAC Ethernet; dual AC PSUs. Depth 737.5mm uses the Dell overall envelope, not rail-to-rear body depth; reserve cable/rail clearance. Weight 28.6kg is the manufacturer fully populated maximum. Power: 220W planning estimate, not measured or PSU capacity. General USB grouped on rear; dedicated iDRAC Direct USB, internal USB, VGA and serial are omitted. Optional NIC/GPU configurations require edits.",
  },
  {
    id: "hpe-microserver-gen10-plus",
    category: "server",
    name: "HPE ProLiant MicroServer Gen10 Plus",
    defaultU: 3,
    physicalHeightMm: 118.9,
    depthMm: 245,
    widthType: "shelf",
    customWidthMm: 245,
    weightKg: 4.23,
    powerW: 50,
    powerReference: { watts: 50, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 4, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.25, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Original Gen10 Plus (not v2), four LFF bays and four onboard GbE ports. Six external USB-A ports grouped on rear; internal USB, VGA and DisplayPort omitted. Optional iLO Enablement Kit and its additional management port are not included. Weight 4.23kg is minimum without drives; configured maximum is 7.2kg. Power: 50W planning estimate, not measured or 180W adapter capacity.",
  },
  {
    id: "qnap-ts-464",
    category: "nas",
    name: "QNAP TS-464",
    defaultU: 4,
    physicalHeightMm: 165,
    depthMm: 226.5,
    widthType: "shelf",
    customWidthMm: 170,
    weightKg: 2.26,
    powerW: 40.536,
    powerReference: { watts: 40.536, basis: 'typical', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 2, power: 1, usb: 4, hdmi: 1},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear", hdmi: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 2, columns: 2, rowIndex: 0, xRatio: 0.25, speed: "2.5G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.2, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.8, mediaType: "usb2", groupLabel: "USB (schematic)"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 2, xRatio: 0.5, groupLabel: "HDMI"},
      ],
    },
    color: "#334155",
    description: "Four-bay NAS, dual 2.5GbE, two USB 10Gbps plus two USB 2.0 and HDMI. Power: official 40.536W typical operating test with drives populated, not maximum. Net chassis weight 2.26kg. Height excludes foot pads; reserve extra shelf clearance. USB grouped on rear; optional PCIe 5/10GbE card not included.",
  },
  {
    id: "terramaster-f4-425-pro",
    category: "nas",
    name: "TerraMaster F4-425 Pro (N350)",
    defaultU: 4,
    physicalHeightMm: 150,
    depthMm: 219,
    widthType: "shelf",
    customWidthMm: 181,
    weightKg: 2.9,
    powerW: 40,
    powerReference: { watts: 40, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 2, power: 1, usb: 4, hdmi: 1},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear", hdmi: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 2, columns: 2, rowIndex: 0, xRatio: 0.25, speed: "5G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 4, columns: 4, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 2, xRatio: 0.5, groupLabel: "HDMI"},
      ],
    },
    color: "#334155",
    description: "N350 configuration; four SATA bays and three M.2 slots, dual 5GbE, three USB-A plus one USB-C 10Gbps and HDMI. Body dimensions 181x219x150mm, NOT packaging dimensions. Power: 40W planning estimate, not measured or the 90W adapter rating. Net weight 2.9kg; USB grouped on rear.",
  },
  {
    id: "asustor-flashstor-6-gen2",
    category: "nas",
    name: "ASUSTOR Flashstor 6 Gen2 (FS6806X)",
    defaultU: 2,
    physicalHeightMm: 48.3,
    depthMm: 193,
    widthType: "shelf",
    customWidthMm: 308.26,
    weightKg: 1.4,
    powerW: 17.9,
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 5},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: "10G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 5, columns: 5, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Six-M.2 NVMe NAS with one 10GbE port, three USB 10Gbps and two USB4 Type-C ports. USB grouped on rear using generic USB data sockets; no HDMI. Power: official 17.9W operation measurement, not maximum or 90W adapter capacity.",
  },
  {
    id: "mikrotik-crs309-1g-8s-in",
    category: "switch",
    name: "MikroTik CRS309-1G-8S+IN",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 191,
    widthType: "shelf",
    customWidthMm: 272,
    weightKg: 1.5,
    powerW: 17,
    powerReference: { watts: 17, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, fiber: 8, power: 1},
    portFaceOverrides: {ethernet: "front", fiber: "front", power: "rear"},
    portLayouts: {
      front: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.03, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "fiber", count: 8, columns: 8, rowIndex: 0, xRatio: 0.8, speed: "10G", mediaType: "sfp+", groupLabel: "SFP+"},
      ],
      rear: [
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "Power input"},
      ],
    },
    color: "#334155",
    description: "Eight 10G SFP+ plus one GbE PoE-in port. Shelf footprint without rack ears. Power: official 17W maximum without attachments, 23W with attachments. Weight: 1.5kg planning estimate, not manufacturer-verified. RS232 console omitted; DC and PoE are alternative power inputs.",
  },
  {
    id: "mikrotik-crs326-24g-2s-rm",
    category: "switch",
    name: "MikroTik CRS326-24G-2S+RM",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 144,
    widthType: "19in",
    weightKg: 1.5,
    powerW: 24,
    powerReference: { watts: 24, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 24, fiber: 2, power: 1},
    portFaceOverrides: {ethernet: "front", fiber: "front", power: "rear"},
    portLayouts: {
      front: [
        {type: "ethernet", count: 24, columns: 12, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "fiber", count: 2, columns: 2, rowIndex: 0, xRatio: 0.95, speed: "10G", mediaType: "sfp+", groupLabel: "SFP+"},
      ],
      rear: [
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "Power input"},
      ],
    },
    color: "#334155",
    description: "1U switch: 24x GbE and 2x 10G SFP+. Power: official 24W maximum. Weight: 1.5kg planning estimate, not manufacturer-verified. DC or passive PoE-in (10-30V); not PoE output. RJ45 serial console is not an Ethernet port and is omitted.",
  },
  {
    id: "unifi-dream-router-7",
    category: "router",
    name: "UniFi Dream Router 7 (UDR7)",
    defaultU: 5,
    physicalHeightMm: 184.1,
    depthMm: 110,
    widthType: "shelf",
    customWidthMm: 110,
    weightKg: 1.1,
    powerW: 26,
    powerReference: { watts: 26, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 4, fiber: 1, power: 1},
    portFaceOverrides: {ethernet: "rear", fiber: "rear", power: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 4, columns: 2, rowIndex: 0, xRatio: 0.15, speed: "2.5G", mediaType: "rj45", groupLabel: "LAN / WAN"},
        {type: "fiber", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, speed: "10G", mediaType: "sfp+", groupLabel: "SFP+"},
        {type: "power", count: 1, columns: 1, rowIndex: 1, xRatio: 0.5, groupLabel: "Power input"},
      ],
    },
    color: "#94a3b8",
    description: "WiFi 7 gateway; circular enclosure approximated by a square footprint. Four 2.5GbE ports (one PoE output) plus one 10G SFP+. Power: official 26W maximum excluding 15.4W PoE output. Internal AC supply; microSD is not a cable connector. Upright shelf orientation; allow RF and cooling clearance.",
  },
  {
    id: "unifi-express-7",
    category: "router",
    name: "UniFi Express 7 (UX7)",
    defaultU: 1,
    physicalHeightMm: 42.5,
    depthMm: 117,
    widthType: "shelf",
    customWidthMm: 117,
    weightKg: 0.443,
    powerW: 22,
    powerReference: { watts: 22, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 2, power: 1},
    portFaceOverrides: {ethernet: "rear", power: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.1, speed: "2.5G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, speed: "10G", mediaType: "rj45", groupLabel: "WAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.9, groupLabel: "Power input"},
      ],
    },
    color: "#94a3b8",
    description: "Compact WiFi 7 gateway with 10GbE WAN and 2.5GbE LAN. USB-C is power only, not an additional USB data port. Power: official 22W maximum. Shelf orientation; allow RF and cooling clearance.",
  },
  {
    id: "unifi-unvr-pro",
    category: "nas",
    name: "UniFi Network Video Recorder Pro (UNVR-Pro)",
    defaultU: 2,
    physicalHeightMm: 87,
    depthMm: 325,
    widthType: "19in",
    weightKg: 9.5,
    powerW: 160,
    powerReference: { watts: 160, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 4,
    ports: {ethernet: 1, fiber: 1, power: 2},
    portFaceOverrides: {ethernet: "rear", fiber: "rear", power: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "fiber", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, speed: "10G", mediaType: "sfp+", groupLabel: "SFP+"},
        {type: "power", count: 2, columns: 2, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
      ],
    },
    color: "#94a3b8",
    description: "Seven-bay 2U Protect NVR with one GbE and one 10G SFP+. Power: official 160W maximum, not the 200W PSU rating. Weight includes mounting brackets, excludes installed drives. AC and proprietary RPS inputs shown as generic power sockets.",
  },
  // Hong Kong-first additions: docs/HOMELAB_CATALOG_HK.zh-Hant.md
  {
    id: "synology-rs822-plus",
    category: "nas",
    name: "Synology RackStation RS822+",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 492.6,
    widthType: "19in",
    weightKg: 6.4,
    powerW: 47.69,
    powerReference: { watts: 47.69, basis: 'measured', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 4, power: 1, usb: 2},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.25, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Four-bay 1U NAS with four onboard GbE ports. Official 47.69W access measurement, not 150W PSU capacity; 6.4kg diskless weight. Optional PCIe NIC not installed; eSATA expansion connector is unsupported and omitted. Two rear USB data ports.",
  },
  {
    id: "synology-ds1825-plus",
    category: "nas",
    name: "Synology DiskStation DS1825+",
    defaultU: 4,
    physicalHeightMm: 166,
    depthMm: 243,
    widthType: "shelf",
    customWidthMm: 343,
    weightKg: 6,
    powerW: 60.1,
    powerReference: { watts: 60.1, basis: 'measured', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 2, power: 1, usb: 3},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 2, columns: 2, rowIndex: 0, xRatio: 0.25, speed: "2.5G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 3, columns: 3, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Eight-bay NAS, two onboard 2.5GbE ports. Official 60.1W access measurement; 6kg diskless weight. Three general USB-A ports grouped on rear. Two USB-C-shaped DX525 expansion ports are proprietary-use expansion connections and omitted, not general USB data ports. Optional PCIe NIC not installed.",
  },
  {
    id: "tp-link-er707-m2",
    category: "router",
    name: "TP-Link Omada ER707-M2 V1",
    defaultU: 1,
    physicalHeightMm: 35,
    depthMm: 131,
    widthType: "shelf",
    customWidthMm: 226,
    weightKg: 0.8,
    powerW: 7.1,
    powerReference: { watts: 7.1, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 6, fiber: 1, usb: 1, power: 1},
    portFaceOverrides: {ethernet: "front", fiber: "front", usb: "front", power: "rear"},
    portLayouts: {
      front: [
        {type: "ethernet", count: 2, columns: 2, rowIndex: 0, xRatio: 0.12, speed: "2.5G", mediaType: "rj45", groupLabel: "WAN / WAN-LAN"},
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.55, speed: "1G", mediaType: "rj45", groupLabel: "WAN / LAN"},
        {type: "fiber", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, speed: "1G", mediaType: "sfp", groupLabel: "WAN / LAN"},
        {type: "usb", count: 1, columns: 1, rowIndex: 0, xRatio: 0.95, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
      rear: [
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "Power input"},
      ],
    },
    color: "#334155",
    description: "V1 hardware baseline: two 2.5GbE, four GbE and one 1G SFP; USB 2.0 for storage/LTE. Official maximum 7.1W without USB load, 14.2W with USB connected; not 18W adapter capacity. Weight 0.8kg is an unverified planning estimate. Check hardware revision on the Hong Kong unit.",
  },
  {
    id: "unifi-usw-pro-xg-8-poe",
    category: "switch",
    name: "UniFi Switch Pro XG 8 PoE",
    defaultU: 1,
    physicalHeightMm: 43.7,
    depthMm: 173.8,
    widthType: "shelf",
    customWidthMm: 210.4,
    weightKg: 1.6,
    powerW: 61,
    powerReference: { watts: 61, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 8, fiber: 2, power: 1},
    portFaceOverrides: {ethernet: "front", fiber: "front", power: "rear"},
    portLayouts: {
      front: [
        {type: "ethernet", count: 8, columns: 4, rowIndex: 0, xRatio: 0.3, speed: "10G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "fiber", count: 2, columns: 2, rowIndex: 0, xRatio: 0.88, speed: "10G", mediaType: "sfp+", groupLabel: "SFP+"},
      ],
      rear: [
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "Power input"},
      ],
    },
    color: "#94a3b8",
    description: "Eight 10GbE PoE++ ports and two 10G SFP+. Official 61W maximum excluding PoE output, 155W PoE availability; 210W external adapter. Compact shelf body without optional mounts; body weight 1.6kg.",
  },
  {
    id: "unifi-usw-pro-max-48-poe",
    category: "switch",
    name: "UniFi Switch Pro Max 48 PoE",
    defaultU: 1,
    physicalHeightMm: 44,
    depthMm: 400,
    widthType: "19in",
    weightKg: 6.3,
    powerW: 100,
    powerReference: { watts: 100, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 48, fiber: 4, power: 2},
    portFaceOverrides: {ethernet: "front", fiber: "front", power: "rear"},
    portLayouts: {
      front: [
        {type: "ethernet", count: 32, columns: 16, rowIndex: 0, xRatio: 0.08, speed: "1G", mediaType: "rj45", groupLabel: "LAN", portScale: 0.7, pairing: "odd-even-vertical"},
        {type: "ethernet", count: 16, columns: 8, rowIndex: 0, xRatio: 0.8, speed: "2.5G", mediaType: "rj45", groupLabel: "LAN", portScale: 0.7, pairing: "odd-even-vertical"},
        {type: "fiber", count: 4, columns: 2, rowIndex: 0, xRatio: 0.97, speed: "10G", mediaType: "sfp+", groupLabel: "SFP+", portScale: 0.7, pairing: "odd-even-vertical"},
      ],
      rear: [
        {type: "power", count: 2, columns: 2, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
      ],
    },
    color: "#94a3b8",
    description: "32x GbE and 16x 2.5GbE plus four 10G SFP+. Official 100W maximum excluding PoE output; 720W PoE availability, not device consumption. Weight includes brackets. AC and proprietary RPS inputs use generic power sockets; PoE classes vary by port.",
  },
  {
    id: "mikrotik-crs304-4xg-in",
    category: "switch",
    name: "MikroTik CRS304-4XG-IN",
    defaultU: 1,
    physicalHeightMm: 35,
    depthMm: 128,
    widthType: "shelf",
    customWidthMm: 176,
    weightKg: 0.7,
    powerW: 15,
    powerReference: { watts: 15, basis: 'maximum', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 5, power: 3},
    portFaceOverrides: {ethernet: "front", power: "rear"},
    portLayouts: {
      front: [
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.3, speed: "10G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.88, speed: "1G", mediaType: "rj45", groupLabel: "Management / PoE-in"},
      ],
      rear: [
        {type: "power", count: 3, columns: 3, rowIndex: 0, xRatio: 0.5, groupLabel: "Power input"},
      ],
    },
    color: "#334155",
    description: "Four 10GbE RJ45 ports plus a separate GbE management/PoE-in port. Official 15W maximum without attachments, 21W overall. Two DC jacks and one 2-pin terminal shown as three schematic rear power sockets; PoE-in is the fourth power option, not another socket. Weight 0.7kg is an unverified planning estimate.",
  },
  {
    id: "dell-optiplex-7060-micro",
    category: "mini-pc",
    name: "Dell OptiPlex 7060 Micro",
    defaultU: 1,
    physicalHeightMm: 36,
    depthMm: 178,
    widthType: "shelf",
    customWidthMm: 182,
    weightKg: 1.18,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "8th-gen platform; 5 USB-A and 1 USB-C. Two standard DisplayPorts; HDMI optional. Weight is official minimum. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "dell-optiplex-7080-micro",
    category: "mini-pc",
    name: "Dell OptiPlex 7080 Micro",
    defaultU: 1,
    physicalHeightMm: 36,
    depthMm: 178.56,
    widthType: "shelf",
    customWidthMm: 182,
    weightKg: 1.28,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "35W CPU class with integrated graphics; 5 USB-A and 1 USB-C. Two standard DisplayPorts; HDMI optional. Weight is official maximum for this CPU class, not discrete-GPU chassis. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "lenovo-thinkcentre-m920x",
    category: "mini-pc",
    name: "Lenovo ThinkCentre M920x Tiny",
    defaultU: 1,
    physicalHeightMm: 37,
    depthMm: 183,
    widthType: "shelf",
    customWidthMm: 179,
    weightKg: 1.32,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Standard onboard GbE and HDMI. PCIe riser/NIC optional; no additional network card installed. Height includes feet. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "lenovo-thinkstation-p330-tiny",
    category: "mini-pc",
    name: "Lenovo ThinkStation P330 Tiny",
    defaultU: 1,
    physicalHeightMm: 37,
    depthMm: 182.9,
    widthType: "shelf",
    customWidthMm: 179,
    weightKg: 1.32,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Base onboard-I/O configuration with HDMI; optional PCIe NIC and discrete GPU ports not installed. Height includes feet. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "lenovo-thinkstation-p360-tiny",
    category: "mini-pc",
    name: "Lenovo ThinkStation P360 Tiny",
    defaultU: 1,
    physicalHeightMm: 37,
    depthMm: 182.9,
    widthType: "shelf",
    customWidthMm: 179,
    weightKg: 1.4,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 7, columns: 7, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "12th-gen platform with onboard HDMI; optional PCIe NIC/GPU not installed. Weight is official maximum configuration, not a measured base-unit weight. Height includes feet. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "hp-elitedesk-800-g5-mini",
    category: "mini-pc",
    name: "HP EliteDesk 800 G5 Desktop Mini",
    defaultU: 1,
    physicalHeightMm: 34,
    depthMm: 175,
    widthType: "shelf",
    customWidthMm: 177,
    weightKg: 1.77,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 7, columns: 7, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Six USB-A and one USB-C; two standard DisplayPorts, HDMI optional. Approximate weight from HP service guide. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "hp-elite-mini-800-g9",
    category: "mini-pc",
    name: "HP Elite Mini 800 G9",
    defaultU: 1,
    physicalHeightMm: 34,
    depthMm: 175,
    widthType: "shelf",
    customWidthMm: 177,
    weightKg: 1.42,
    powerW: 25,
    powerReference: { watts: 25, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, hdmi: 1, power: 1, usb: 6},
    portFaceOverrides: {ethernet: "rear", hdmi: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "hdmi", count: 1, columns: 1, rowIndex: 0, xRatio: 0.5, groupLabel: "HDMI"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.5, mediaType: "usb3", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Five USB-A and one USB-C, standard HDMI 2.1 and two DisplayPorts. Base onboard GbE configuration; optional Flex IO NIC/GPU not installed. Weight depends on configuration. Horizontal shelf footprint. USB front/rear ports grouped on rear schematically; DisplayPort/audio and optional modules omitted. Power: 25W planning estimate, not measured consumption, CPU TDP or adapter capacity; adjust for configuration.",
  },
  {
    id: "dell-wyse-5070",
    category: "mini-pc",
    name: "Dell Wyse 5070",
    defaultU: 1,
    physicalHeightMm: 35.6,
    depthMm: 184,
    widthType: "shelf",
    customWidthMm: 184,
    weightKg: 1.2,
    powerW: 12,
    powerReference: { watts: 12, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 8},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.32, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Slim chassis; no PCIe expansion slot. Weight from Dell datasheet. Horizontal shelf footprint. Eight external USB ports (two USB 2.0, five USB-A 3.x and one USB-C) grouped on rear; internal USB, DisplayPort, serial and optional second NIC/SFP omitted. Power: 12W planning estimate, not measured or adapter capacity.",
  },
  {
    id: "dell-wyse-5070-extended",
    category: "mini-pc",
    name: "Dell Wyse 5070 Extended",
    defaultU: 2,
    physicalHeightMm: 66,
    depthMm: 184,
    widthType: "shelf",
    customWidthMm: 184,
    weightKg: 1.47,
    powerW: 15,
    powerReference: { watts: 15, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 8},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 6, columns: 6, rowIndex: 1, xRatio: 0.32, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Extended chassis, 66mm thick per user guide; do not use the 56mm Hong Kong marketing-page typo. PCIe card optional, not installed. Starting weight from Dell user guide. Horizontal shelf footprint. Eight external USB ports (two USB 2.0, five USB-A 3.x and one USB-C) grouped on rear; internal USB, DisplayPort, serial and optional second NIC/SFP omitted. Power: 15W planning estimate, not measured or adapter capacity.",
  },
  {
    id: "hp-t740",
    category: "mini-pc",
    name: "HP t740 Thin Client",
    defaultU: 2,
    physicalHeightMm: 50,
    depthMm: 210,
    widthType: "shelf",
    customWidthMm: 210,
    weightKg: 1.323,
    powerW: 16.68,
    heatLevel: 2,
    ports: {ethernet: 1, power: 1, usb: 7},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.15, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 5, columns: 5, rowIndex: 1, xRatio: 0.3, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.85, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "Horizontal shelf footprint; body dimensions without stand, conservative 1.323kg weight includes stand per QuickSpecs. Seven external USB (six A, one C) grouped on rear; four DisplayPorts omitted. Optional PCIe GPU/fiber NIC not installed. Power: official 16.68W short-idle measurement at 230V/50Hz, ThinPro, 32GB RAM/128GB storage; not peak load or 90W adapter capacity.",
  },
  {
    id: "dell-poweredge-r630",
    category: "server",
    name: "Dell PowerEdge R630 (8-bay / 4x1GbE)",
    defaultU: 1,
    physicalHeightMm: 42.8,
    depthMm: 736.3,
    widthType: "19in",
    weightKg: 16.9,
    powerW: 180,
    powerReference: { watts: 180, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 4,
    ports: {ethernet: 5, power: 2, usb: 4},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 4, columns: 4, rowIndex: 0, xRatio: 0.25, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "ethernet", count: 1, columns: 1, rowIndex: 0, xRatio: 0.65, speed: "1G", mediaType: "rj45", groupLabel: "iDRAC management"},
        {type: "power", count: 2, columns: 2, rowIndex: 0, xRatio: 0.9, groupLabel: "Power input"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.25, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.7, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "8x2.5-inch chassis, quad-GbE NDC plus dedicated iDRAC port and dual AC PSUs. Overall depth 736.3mm includes bezel (35 + 701.3); other bay configurations are deeper. Official 16.9kg fully populated maximum. Power: 180W planning estimate, not measured or PSU capacity. General USB grouped on rear; internal USB, VGA and serial omitted.",
  },
  {
    id: "dell-poweredge-r230",
    category: "server",
    name: "Dell PowerEdge R230 (4-bay / base I/O)",
    defaultU: 1,
    physicalHeightMm: 42.8,
    depthMm: 532.1,
    widthType: "19in",
    weightKg: 9.51,
    powerW: 70,
    powerReference: { watts: 70, basis: 'estimated', source: 'Existing catalog description; see device notes for test conditions and exclusions' },
    heatLevel: 3,
    ports: {ethernet: 2, power: 1, usb: 4},
    portFaceOverrides: {ethernet: "rear", power: "rear", usb: "rear"},
    portLayouts: {
      rear: [
        {type: "ethernet", count: 2, columns: 2, rowIndex: 0, xRatio: 0.25, speed: "1G", mediaType: "rj45", groupLabel: "LAN"},
        {type: "power", count: 1, columns: 1, rowIndex: 0, xRatio: 0.85, groupLabel: "Power input"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.25, mediaType: "usb3", groupLabel: "USB (schematic)"},
        {type: "usb", count: 2, columns: 2, rowIndex: 1, xRatio: 0.7, mediaType: "usb2", groupLabel: "USB (schematic)"},
      ],
    },
    color: "#334155",
    description: "3.5-inch hot-swap chassis, two onboard GbE and one AC supply. Optional dedicated iDRAC port card is NOT preinstalled. Overall depth includes bezel. Official fully populated maximum 9.51kg. Power: 70W planning estimate, not measured or 250W PSU capacity. General USB grouped on rear; internal USB, VGA, serial and management-only USB omitted.",
  },
  {
    id: 'printed-bracket-l',
    category: 'printed-mount',
    name: '3D-printed L-bracket',
    defaultU: 1,
    depthMm: 80,
    mountEnvelopeMm: 20,
    widthType: '19in',
    weightKg: 0.15,
    powerW: 0,
    heatLevel: 1,
    color: '#f59e0b',
    description: 'Parametric L-bracket for non-rackmount gear. Check clearance before printing.'
  },
  {
    id: 'printed-tray-mini',
    category: 'printed-mount',
    name: '3D-printed mini tray',
    defaultU: 1,
    depthMm: 150,
    mountEnvelopeMm: 15,
    widthType: '10in',
    weightKg: 0.25,
    powerW: 0,
    heatLevel: 1,
    color: '#f59e0b',
    description: 'Small shelf tray for SBCs, NUCs, or modems in a 10-inch rack.'
  },
  {
    id: 'printed-tray-19in',
    category: 'printed-mount',
    name: '3D-printed 19-inch tray',
    defaultU: 1,
    depthMm: 200,
    mountEnvelopeMm: 15,
    widthType: '19in',
    weightKg: 0.4,
    powerW: 0,
    heatLevel: 1,
    color: '#f59e0b',
    description: 'Full-width printed tray for lightweight devices. Verify layer orientation for strength.'
  },
  {
    id: 'printed-din-rail-clip',
    category: 'printed-mount',
    name: '3D-printed DIN rail clip',
    defaultU: 1,
    depthMm: 40,
    mountEnvelopeMm: 10,
    widthType: 'custom',
    customWidthMm: 80,
    weightKg: 0.08,
    powerW: 0,
    heatLevel: 1,
    color: '#f59e0b',
    description: 'DIN-rail adapter clip for industrial IoT or relay modules.'
  },
  {
    id: 'printed-vertical-strip',
    category: 'printed-mount',
    name: '3D-printed vertical adapter strip',
    defaultU: 2,
    depthMm: 30,
    mountEnvelopeMm: 5,
    widthType: 'custom',
    customWidthMm: 40,
    weightKg: 0.12,
    powerW: 0,
    heatLevel: 1,
    color: '#f59e0b',
    description: 'Vertical strip for side-post or rear-post mounting small accessories.'
  },
  {
    id: 'printed-rail-pair',
    category: 'printed-mount',
    name: '3D-printed rail pair',
    defaultU: 1,
    depthMm: 180,
    mountEnvelopeMm: 25,
    widthType: '19in',
    weightKg: 0.3,
    powerW: 0,
    heatLevel: 1,
    color: '#f59e0b',
    description: 'Sliding rail pair for shallow mini-PC or NUC mounts. Check weight rating.'
  },
  {
    id: 'custom-device',
    category: 'custom',
    name: 'Custom device',
    defaultU: 1,
    depthMm: 200,
    widthType: 'custom',
    customWidthMm: 220,
    weightKg: 2,
    powerW: 20,
    heatLevel: 2,
    ports: { ethernet: 1, power: 1 },
    portLayouts: {
      rear: [
        { type: 'ethernet', count: 1, columns: 1, rowIndex: 0, xRatio: 0.2, speed: '1G', mediaType: 'rj45', groupLabel: 'LAN' },
        { type: 'power', count: 1, columns: 1, rowIndex: 0, xRatio: 0.8, groupLabel: 'Power' },
      ],
    },
    color: '#0891b2',
    description: 'Editable placeholder for anything else.'
  }
];

registerDeviceTemplates(deviceCatalog);

export function templateFromDevice(device: PlacedDevice): DeviceTemplate {
  return {
    id: device.templateId ?? device.id,
    category: device.category,
    name: device.name,
    defaultU: device.sizeU,
    depthMm: device.depthMm,
    widthType: device.widthType,
    customWidthMm: device.customWidthMm,
    weightKg: device.weightKg,
    powerW: device.powerW,
    installationRequirements: device.installationRequirements,
    installationKit: device.installationKit,
    powerReference: device.powerReference,
    powerBasis: device.powerBasis,
    powerPlanningNote: device.powerPlanningNote,
    powerCapacityW: device.powerCapacityW,
    powerCapacityReference: device.powerCapacityReference ? { ...device.powerCapacityReference } : undefined,
    poeBudgetW: device.poeBudgetW,
    poeInputMode: device.poeInputMode,
    poeEfficiencyPct: device.poeEfficiencyPct,
    batteryWh: device.batteryWh,
    upsBatteryAssumptions: device.upsBatteryAssumptions ? { ...device.upsBatteryAssumptions } : undefined,
    heatLevel: device.heatLevel,
    color: device.color,
    description: device.description ?? '',
    ports: device.ports,
    portConnectionSpecs: device.portConnectionSpecs,
    portFaceOverrides: device.portFaceOverrides,
    portLayouts: device.portLayouts,
    faceplate: device.faceplate,
    mountType: device.mountType,
    mountSide0U: device.mountSide0U,
    outletFacing: device.outletFacing,
    mountEnvelopeMm: device.mountEnvelopeMm,
  };
}

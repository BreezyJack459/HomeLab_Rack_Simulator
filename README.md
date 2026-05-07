# Homelab Rack Simulator

Interactive React prototype for planning 10-inch and 19-inch homelab rack layouts before buying or moving equipment.

## Features

- 10-inch and 19-inch rack support
- Rack heights: every size from 2U to 45U
- 2D front/rear rack editor with U numbering, drag/drop, snap-to-U placement and overlap prevention
- Multiple shelf-mounted devices can share the same U when their horizontal footprints fit
- Side labels for 1U and narrow devices so names remain readable when rack tiles are cramped
- Device properties for size, depth, width type, weight, power, heat, color and port counts
- Port layout columns for realistic front panel planning, such as a 24-port patch panel in one row
- Community-inspired templates for common homelab gear, including TinyMiniMicro PCs, Minisforum MS-01/UM790 Pro, Protectli Vault, MikroTik CRS305, UniFi rack and desktop gear, ISP modems, Synology NAS, APC UPS units, Raspberry Pi trays, patch panels, and shelf variants
- IP KVM templates, including JetKVM, Sipeed NanoKVM Full/Lite/PCIe, and PiKVM-style planning profiles
- Validation warnings for width, overlap, depth, rack weight, UPS placement, heavy devices, heat clustering, airflow and power budget
- Dedicated Cable Map tab with tray-style routed paths for Ethernet, power, fiber, USB, HDMI, ATX and coax routes
- 3D inspection view with approximate rack/device dimensions and depth
- Local save/load, JSON import/export and PNG export of the 2D diagram
- Seed layouts for a compact 10-inch lab, your on-hand device layout, and one 19-inch home cloud rack

## Setup

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173/
```

Build a production bundle:

```bash
npm run build
```

## How The App Is Organized

- `src/types/rack.ts` contains the rack, device, cable and validation data models.
- `src/data/deviceCatalog.ts` defines the reusable device templates shown in the left sidebar.
- `src/data/sampleLayouts.ts` contains the seed 10-inch and 19-inch layouts.
- `src/store/rackStore.ts` owns the layout state and mutation rules.
- `src/utils/rackMath.ts` contains rack dimensions, snapping, overlap and free-space helpers.
- `src/utils/validation.ts` contains layout validation rules.
- `src/components/RackEditor2D.tsx` is the reliable 2D editor.
- `src/components/RackViewer3D.tsx` renders the React Three Fiber scene.
- `src/components/three/RackModel.tsx` and `src/components/three/DeviceModel.tsx` render rack/device geometry.

## Adding New Device Types

Add a new `DeviceTemplate` object to `src/data/deviceCatalog.ts`.

Important fields:

- `category`: one of the supported device categories in `src/types/rack.ts`
- `defaultU`: default rack height in U
- `rackMountable`: set to `false` for external gear, such as ceiling APs, that should remain in the library but cannot be placed inside the rack
- `depthMm`: approximate device depth for validation and 3D
- `widthType`: `10in`, `19in`, `shelf` or `custom`
- `customWidthMm`: required for custom-width or shelf-mounted devices when you want realistic fit checks
- `xMm`: optional placement field on saved devices; it is the left offset inside the usable rack width
- `weightKg`, `powerW`, `heatLevel`: used by validation
- `ports`: optional front port counts for 2D/3D hints. Use `layoutColumns` to control front-panel wrapping.
- `color`: used in both 2D and 3D

Example:

```ts
{
  id: 'my-lab-node',
  category: 'mini-pc',
  name: 'Lab node',
  defaultU: 1,
  depthMm: 140,
  widthType: 'shelf',
  customWidthMm: 130,
  weightKg: 0.9,
  powerW: 28,
  heatLevel: 3,
  ports: { ethernet: 2, usb: 4, power: 1, layoutColumns: 2 },
  color: '#0891b2',
  description: 'Shelf-mounted compute node.'
}
```

The left library, 2D editor, validation system, JSON export and 3D viewer will pick it up automatically.

## Template Research Notes

The included hardware templates are planning profiles, not CAD-accurate models. Dimensions, power, and weights are rounded for layout validation and rough airflow/power planning.

Reference sources used for the built-in popular hardware set:

- ServeTheHome Project TinyMiniMicro coverage for Dell Micro, HP Mini, and Lenovo Tiny class homelab nodes: https://www.servethehome.com/introducing-project-tinyminimicro-home-lab-revolution/
- Minisforum MS-01 official specifications: https://store.minisforum.com/products/minisforum-ms-01
- Protectli Vault VP2420 specifications: https://eu.protectli.com/product/vp2420/
- MikroTik CRS305 specifications: https://mikrotik.com/product/crs305_1g_4s_in
- Ubiquiti UniFi Dream Machine Pro tech specs: https://techspecs.ui.com/unifi/cloud-gateways/udm-pro
- Ubiquiti UniFi Cloud Gateway Max tech specs: https://techspecs.ui.com/unifi/cloud-gateways/ucg-max
- Ubiquiti UniFi U7 Pro tech specs: https://techspecs.ui.com/unifi/wifi/u7-pro
- Ubiquiti 2.5G PoE+ Adapter tech specs: https://techspecs.ui.com/unifi/accessories/uacc-poe-plus-2-5g
- Ubiquiti UniFi Flex 2.5G 8-port switch tech specs: https://techspecs.ui.com/unifi/switching/usw-flex-2-5g-8
- Minisforum UM790 Pro official specifications: https://store.minisforum.com/products/minisforum-um790-pro
- Synology DS923+ product specifications: https://global.download.synology.com/download/Document/Hardware/ProductSpec/DiskStation/23-year/DS923%2B/enu/Product_Spec_DS923%2B_enu.pdf
- APC 1U Smart-UPS product families: https://www.apc.com/us/en/product/SCL500RM1UC/
- APC Back-UPS Pro Gaming BGM1500B-US product page: https://www.apc.com/us/en/product/BGM1500B-US/apc-backups-pro-for-gaming-1500va-900w-tower-120v-10x-nema-515r-outlets-rgb-lights-pure-sine-wave-midnight-black/
- Sipeed NanoKVM documentation: https://wiki.sipeed.com/hardware/en/kvm/NanoKVM/introduction.html
- Sipeed NanoKVM PCIe documentation: https://wiki.sipeed.com/hardware/en/kvm/NanoKVM_PCIe/introduction.html
- JetKVM documentation and specs: https://jetkvm.com/docs and https://jetkvm.com/products/jetkvm
- 寶藏盒 Pro NAS planning dimensions came from the user-provided product image.

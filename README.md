# Homelab Rack Simulator

Plan a 10-inch or 19-inch homelab rack in your browser. Place equipment in 2D, inspect it in 3D, connect ports, and review space, power, weight and serviceability before building.

[Live demo](https://breezyjack459.github.io/HomeLab_Rack_Simulator/) · [繁體中文](docs/README.zh-Hant.md) · [User guide](docs/USER_GUIDE.md) · [Documentation](docs/README.md)

This README describes the working tree reviewed on **2026-09-18**. The deployed demo follows the `main` deployment workflow and may not include local changes yet.

## Start locally

Use an npm-capable Node.js environment compatible with the lockfile. CI is configured for Node 20.x and 22.x.

```bash
npm ci
npm run dev
```

Open [the local app](http://127.0.0.1:5173/HomeLab_Rack_Simulator/). Vite uses port 5173 with `strictPort`, the `/HomeLab_Rack_Simulator/` base path, and listens on all local interfaces. Other devices on your trusted LAN can use `http://YOUR_LAN_IP:5173/HomeLab_Rack_Simulator/`; `npm run dev:lan` explicitly selects the same LAN binding. Each browser has its own saved data.

## Workflows

| Area | What you can do |
|---|---|
| **Build** | Search hardware templates, maintain **My devices** inventory, place equipment in 2D, inspect in 3D, and edit properties. |
| **Cable** | Connect ports, filter/select cables, use **2D map**, **3D routing**, **Topology** and **Table**, or draw a custom route. Requires the default-enabled Cable Management plugin. |
| **Check** | Review validation issues and affected equipment, then adjust the layout. |
| **Tools** | Enable and open **Operations**, **Planning** and **Fleet**; use **Settings** for rack settings, plugin management and appearance. |

The new shell is enabled by default. Operations, Planning, Fleet and Port Labels are optional and load on demand. Existing saved plugin preferences migrate differently from a fresh installation; see [plugin behavior](docs/dev/ARCHITECTURE.md#plugins).

## See it in action

Captured from the local working tree on **2026-09-18**, using bundled examples in an isolated browser. Sample warnings are shown as they appear; these images do not certify an installation. [Full screenshot tour](docs/SCREENSHOTS.md) includes inventory, topology, route drawing, thin trays, 0U PDUs, plugins and tablet layout.

### Build in 2D

Search the library, place equipment and edit a selected device beside the rack.

![Build workspace with a 19-inch rack, filtered device library and switch properties](docs/images/build-2d.png)

### Inspect in 3D

Review depth, sockets and equipment placement with camera presets and selection labels.

![3D inspection of the sample home cloud rack with a selected switch](docs/images/build-3d.png)

### Plan cable routes

Inspect power and data connections from the rear, with the cable list and connection controls alongside the scene.

![Cable workspace showing rear-angle 3D power and data routing](docs/images/cable-3d.png)

### Review issues

Select an issue to see the affected equipment and suggested next action.

![Check workspace with a selected PDU outlet assignment issue and its details](docs/images/check.png)

## Current capabilities

- **Placement:** front/rear editing, snap-to-U, collision and reservation checks, depth warnings, and a hardware library with rack-dimension filtering. **My devices** stores unplaced equipment per rack without adding it to rack totals.
- **Shelf and mounting support:** separate-U shelves, thin trays sharing U with supported devices, actual device height and clearance fields, and schematic 3D-printed mounts. Existing layouts are not automatically rearranged.
- **0U PDUs:** physical length, height above base, side/rear mounting lanes and outlet orientation; shared socket positions in inspection and cabling views.
- **Cabling:** Ethernet, patch, structured, power, fiber, USB, HDMI, ATX and coax connections; automatic routes, cable information/BOM, and semantic custom routes through existing channels or managers.
- **3D inspection:** camera presets, selection/focus, visible sockets, approximate device geometry and faceplate textures. Clean and Realistic cable modes keep blocked routes visible as review states instead of inventing a clear path.
- **Checks:** width, height, overlap, depth, shelf support, weight, power, heat, airflow, UPS position and serviceability. These are planning estimates, not installation certification.
- **Optional tools:** operations records, planning scenarios and readiness, multi-rack/fleet workflows and inter-rack cables, plus switch port labels and CSV documentation.
- **Data:** browser autosave, session undo/redo, rack JSON import/export and 2D PNG export. Fleet provides workspace import/export. Recovery warnings expose save failures and protect unreadable saved data.

Follow the [English user guide](docs/USER_GUIDE.md) or [繁體中文使用指南](docs/USER_GUIDE.zh-Hant.md) for exact controls, thin-tray examples, route drawing and recovery.

## Data and limitations

The app is a client-side React application with no shared backend or account system. Opening the same URL on another device does not synchronize layouts. Export JSON for backups and transfers; exporting a rack is different from exporting a full workspace.

Hardware dimensions, power, weight, thermal and noise values are planning inputs. Generic templates and user-entered values need checking against your equipment. The dated [device specification audit](docs/DEVICE_SPEC_AUDIT.zh-Hant.md) preserves source references and unresolved values. Template updates do not rewrite devices already saved in a layout.

Printed mounts are schematic geometry: there is no STL/CAD import or generation. Automatic 3D route candidates and automatic 2D/BOM estimates are distinct; the 3D image is not an installed cable-length measurement. See [limitations](docs/dev/KNOWN_ISSUES.md).

## Development and validation

React 18, TypeScript 5.7, Vite 6, Zustand 5, Tailwind CSS 3, Three.js 0.171, React Three Fiber 8 and Drei 9. Vitest handles unit/integration tests; Playwright handles browser workflows. Dependency ranges and scripts are in [package.json](package.json).

```bash
npm test                            # Unit, component, store, utility and importer tests
npm run test:plugins                 # Focused plugin-platform configuration
npx playwright install chromium     # First-time browser setup
npx playwright test                 # Browser workflows; starts/reuses the dev server
npm run build                       # Type checking plus production output
node scripts/check-bundle-size.mjs  # Entry + modulepreload JS, at most 500 KB pre-gzip
npm run preview                     # Inspect the production build locally
```

`npm run smoke:cables` refreshes cable screenshots with a running dev server. Run focused tests for the area you change; [development instructions](docs/dev/DEVELOPMENT.md) explain coverage and CI. No passing test counts or current bundle size are implied by this documentation refresh.

## Code map

| Location | Responsibility |
|---|---|
| `src/App.tsx`, `src/components/` | Shell, workspaces, inspectors and user workflows |
| `src/types/rack.ts` | Rack, device, cable and workspace data |
| `src/store/rackStore.ts` | Mutations, history, workspace synchronization, persistence and recovery |
| `src/utils/portLayout.ts`, `rackGeometry.ts` | Logical port layout and canonical 3D socket geometry |
| `src/utils/routing.ts`, `rackSceneModel.ts`, `manualCableRoute.ts` | Cable plans, managed 3D scene and custom route resolution |
| `src/plugins/` | Contributions, manifest catalog, lazy built-ins and approved local adapters |
| `src/data/`, `public/faceplates/` | Hardware templates, samples and faceplate assets |
| `tests/`, `src/**/*.test.*`, `scripts/` | Regression fixtures, tests and build/screenshot tooling |

See [architecture](docs/dev/ARCHITECTURE.md), [decisions](docs/dev/DECISIONS.md) and [agent instructions](AGENTS.md).

## Deployment

`npm run build` writes `dist/`. Serve it under the configured `/HomeLab_Rack_Simulator/` base path, or update `base` in `vite.config.ts` for another hosting location. The repository has separate [CI](.github/workflows/ci.yml) and [GitHub Pages deployment](.github/workflows/deploy.yml) workflows. Deployment runs on pushes to `main` or manual dispatch; local changes are not deployed automatically.

## Documentation and visual references

The [documentation index](docs/README.md) separates current guides from historical reviews, proposals and handoffs. The current screenshot set lives in `docs/images/`; reproduce it with `node scripts/capture-docs.mjs` while the dev server is running. Older images in `artifacts/` and `docs/design/` remain historical evidence. See the [screenshot tour](docs/SCREENSHOTS.md) for capture details.

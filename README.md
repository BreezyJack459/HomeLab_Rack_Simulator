# Homelab Rack Simulator

Plan a 10-inch or 19-inch homelab rack in your browser. Place equipment in 2D, inspect it in 3D, connect ports, and review space, power, weight and serviceability before building.

[Live demo](https://breezyjack459.github.io/HomeLab_Rack_Simulator/) · [繁體中文](docs/README.zh-Hant.md) · [User guide](docs/USER_GUIDE.md) · [Documentation](docs/README.md)

This README describes `main` at `c0d2038` (2026-10-01), checked against the source on **2026-10-21**. GitHub Pages published that commit to the live demo on 2026-10-01 after CI succeeded. Later commits publish only when the same deployment workflow passes.

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
| **Build** | Search hardware templates, keep unplaced gear in **My devices**, place equipment in 2D, inspect in 3D, and edit properties. A browser with no saved plan opens **Start small: one feed**. **File → Load sample** also offers **Trace A/B and patch paths**, **Repair three conflicts**, and the older legacy examples. |
| **Cable** | Connect ports, plan **Connect A–B** through one or two patch panels, tidy a panel's routes without moving endpoints, and use **2D map**, **3D routing**, **Topology** and **Table**. Draw or redraw a custom route when you need one. On a narrow screen, **Display** keeps Clean/Realistic styles and layer toggles inside the 3D canvas. Requires the default-enabled Cable Management plugin. |
| **Check** | Review root causes — confirmed issues, needs verification, optional information, and accepted exceptions — then adjust the layout or record a reasoned exception. **Planning goals** set supply, recovery and service-motion intent. |
| **Tools** | Enable and open **Operations**, **Planning** and **Fleet**. **Port Labels** and **Cable Labels** are optional views. **Settings** covers rack settings, plugin management and appearance. |

Rack Studio is the default shell. Cable Management and Governance Tools start enabled. Operations, Planning, Fleet, Port Labels and Cable Labels stay off until you enable them, and their code loads on demand. A saved list of enabled plugins is kept as stored; startup does not turn omitted packs back on. Set `localStorage["rack-simulator-new-shell"]` to `"0"` and reload to open the classic chrome for diagnostics. See [plugin behavior](docs/dev/ARCHITECTURE.md#plugins).

## See it in action

Captured on **2026-10-21** from the local Vite app at `main` `c0d2038`, using bundled examples in an isolated browser. The shell is Rack Studio. Sample warnings are shown as they appear; these images do not certify an installation. [Full screenshot tour](docs/SCREENSHOTS.md) includes inventory, topology, route drawing, thin trays, 0U PDUs, plugins and tablet layout.

### Build in 2D

Search the library, place equipment and edit a selected device beside the rack.

![Rack Studio Build workspace with the 19-inch Home Cloud, a switch search and selected switch properties](docs/images/build-2d.png)

### Inspect in 3D

Review depth and equipment placement with the camera presets.

![3D inspection of the sample Home Cloud rack](docs/images/build-3d.png)

### Plan cable routes

Open Cable for the list, 2D map, 3D routing, topology and table. **Connect A–B** is in that workspace; this capture is the rear-angle 3D route with the cable list beside it.

![Cable workspace showing rear-angle 3D routing and the Connect A–B control](docs/images/cable-3d.png)

### Review issues

Check groups root causes. The sample rack keeps its power findings, including an unknown outlet count and unassigned power cables.

![Check workspace with the sample rack's grouped power findings](docs/images/check.png)

## Current capabilities

- **Placement:** front/rear editing, snap-to-U, collision and reservation checks, depth warnings, and a hardware library with rack-dimension filtering. **My devices** stores unplaced equipment per rack without adding it to rack totals.
- **Shelf and mounting support:** separate-U shelves, thin trays sharing U with supported devices, actual device height and clearance fields, and schematic 3D-printed mounts. Existing layouts are not automatically rearranged.
- **0U PDUs:** physical length, height above base, side/rear mounting lanes and outlet orientation; shared socket positions in inspection and cabling views.
- **Learning examples:** a fresh browser opens the fictional 6U **Start small: one feed** rack. **Trace A/B and patch paths** and **Repair three conflicts** are explicit loads, and the four older layouts stay under **Legacy examples**. Replacing the active rack always asks first. A clear Check result on an example only means those stated assumptions agree with each other.
- **Cabling:** Ethernet, patch, structured, power, fiber, USB, HDMI, ATX and coax connections; automatic routes; **Connect A–B** (new patch-cord or permanent-link segments, reused backbone cables, and front/rear jack hops that are not extra purchases); panel tidying that keeps endpoints and recorded lengths; cable information/BOM; and semantic custom routes through existing channels or managers.
- **3D inspection:** camera presets, selection/focus, visible sockets, approximate device geometry and faceplate textures. Clean and Realistic cable modes keep blocked routes visible as review states instead of inventing a clear path. On a phone-width Cable view, **Display** stays inside the canvas and scrolls so the routing style and layer toggles remain reachable.
- **Checks:** width, height, overlap, depth, shelf support, weight, power, heat, airflow, UPS position and serviceability, grouped as root causes. Planning goals and accepted exceptions are stored with the rack and survive workspace backup. These are planning estimates, not installation certification.
- **Optional tools:** operations records, planning scenarios and readiness, multi-rack/fleet workflows and inter-rack cables, switch port labels, and printable cable-endpoint labels.
- **Data:** browser autosave, session undo/redo, rack JSON import/export and 2D PNG export. Fleet provides workspace import/export. Recovery warnings expose save failures and protect unreadable saved data.

Follow the [English user guide](docs/USER_GUIDE.md) or [繁體中文使用指南](docs/USER_GUIDE.zh-Hant.md) for exact controls, thin-tray examples, route drawing and recovery.

## Data and limitations

The app is a client-side React application with no shared backend or account system. Opening the same URL on another device does not synchronize layouts. Export JSON for backups and transfers; exporting a rack is different from exporting a full workspace.

Hardware dimensions, power, weight, thermal and noise values are planning inputs. Generic templates and user-entered values need checking against your equipment. The dated [device specification audit](docs/DEVICE_SPEC_AUDIT.zh-Hant.md) preserves source references and unresolved values. Template updates do not rewrite devices already saved in a layout.

Printed mounts are schematic geometry: there is no STL/CAD import or generation. Purchase length is the longer Clean or Realistic 3D centreline plus one installation-slack allowance, then a stocked length when the table contains one. The length drawn for the current display style is the centreline without that extra slack. A blocked route is not estimated, and recorded cable lengths are not replaced by either figure. See [limitations](docs/dev/KNOWN_ISSUES.md).

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
| `src/utils/routing.ts`, `rackSceneModel.ts`, `manualCableRoute.ts`, `patchChain.ts` | Cable plans, managed 3D scene, custom routes and A–B patch chains |
| `src/plugins/` | Contributions, manifest catalog, lazy built-ins and approved local adapters |
| `src/data/`, `public/faceplates/` | Hardware templates, samples and faceplate assets |
| `tests/`, `src/**/*.test.*`, `scripts/` | Regression fixtures, tests and build/screenshot tooling |

See [architecture](docs/dev/ARCHITECTURE.md), [decisions](docs/dev/DECISIONS.md) and [agent instructions](AGENTS.md).

## Deployment

`npm run build` writes `dist/`. Serve it under the configured `/HomeLab_Rack_Simulator/` base path, or update `base` in `vite.config.ts` for another hosting location.

Pushes to `main`, and manual dispatch, run [Deploy to GitHub Pages](.github/workflows/deploy.yml). That workflow calls [CI](.github/workflows/ci.yml) and publishes the Node 22 `production-dist` artifact only after unit tests, plugin tests, the production build, the 500 KB eager bundle guard and the Playwright suite succeed. Packaging does not rebuild. A failed check leaves the current Pages site in place. Local commits are not deployed until they are on `main` and that workflow passes.

## Documentation and visual references

The [documentation index](docs/README.md) separates current guides from historical reviews, proposals and handoffs. The current screenshot set lives in `docs/images/`; reproduce it with `node scripts/capture-docs.mjs` while the dev server is running. Older images in `artifacts/` and `docs/design/` remain historical evidence. See the [screenshot tour](docs/SCREENSHOTS.md) for capture details.

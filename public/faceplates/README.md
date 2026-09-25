# Vendored Faceplate Images

This directory contains device elevation images vendored from the
[NetBox Device Type Library](https://github.com/netbox-community/devicetype-library).

## Licensing

NetBox Device Type Library content is licensed under the Apache License 2.0.
See <https://github.com/netbox-community/devicetype-library/blob/master/LICENSE>
for the full license text.

Images are used here for local rendering of rack device faceplates only.

## Use in this repository

Templates in `src/data/deviceCatalog.ts` reference vendored images through their faceplate paths. The 3D faceplate texture layer uses these local assets alongside procedural and hand-traced SVGs. The development-only Faceplate Gallery is available for visual inspection.

Keep image attribution and licensing when adding or replacing assets. Asset paths must work with the configured Vite base (`/HomeLab_Rack_Simulator/`). See [architecture](../../docs/dev/ARCHITECTURE.md) and [development](../../docs/dev/DEVELOPMENT.md). This documentation refresh does not reverify upstream image licensing or specifications.

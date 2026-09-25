# Workspace organization

Current source reference, reviewed 2026-09-18.

The default top-level navigation is **Build / Cable / Check**, with **Tools** for advanced work. Build and Cable share the internal `model` workspace; `shellWorkflow.ts` maps cable view modes into the Cable workflow. Check uses `audit`. Operations, Planning and Fleet are plugin-owned workspaces.

Build combines Library/My devices, a 2D or 3D canvas and the Properties/Cables/Ports inspector. Cable replaces the left library with a cable list and offers 2D map, 3D routing, Topology and Table. Check provides an issue list, affected context and details. Optional packs use their contributed workbenches and inspectors.

Tools offers Enable & open for Operations/Planning/Fleet and a Settings page with rack configuration, plugin management, theme and extra views. Port Labels is an optional view. Fresh installs leave optional packs off; existing preference migration can restore the workspace packs. Manifests are available without eagerly importing pack code.

Library and inspector panels become dismissible drawers on narrower screens. Shared focus/Escape handling supports returning to the triggering control. The cable list closes before a connection flow so it does not cover port picking.

Library creates devices from templates. My devices holds unplaced equipment per rack and preserves identity during placement. Its Fits rack dimensions filter checks dimensions, not free-slot availability. Drag feedback uses shared placement checks: green permits placement, red identifies blocking conditions and amber warns about depth. Full rack data participates even if the canvas is filtered.

New chrome defaults on. The localStorage shell override can select classic chrome for diagnostics; it does not revert the current data model or plugin contributions. See [architecture](../dev/ARCHITECTURE.md) and [user guide](../USER_GUIDE.md).

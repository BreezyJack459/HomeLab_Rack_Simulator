# User guide

Current working-tree workflows, reviewed 2026-09-18. [繁體中文](USER_GUIDE.zh-Hant.md) · [Overview](../README.md)

Screenshots below were captured from the local app on 2026-09-18 using example data. [Complete visual tour](SCREENSHOTS.md).

## Build your rack

1. Open **Build**. Use **Tools → Settings → Rack settings** to configure the rack.
2. Search **Library** for a template. **Fits rack dimensions** checks dimensions, not whether an empty slot is available.
3. Drag into the 2D rack or use Add. Green previews can be placed; red previews identify blocking geometry/reservations; amber indicates a depth warning. Press Esc to cancel a drag.
4. Select equipment and edit **Properties**. Switch Front/Rear to inspect the other face; switch to 3D to inspect depth and sockets.
5. Open **Check** to review the resulting issues.

**My devices** is the active rack's unplaced inventory. Adding there does not consume rack U space, power or weight. Drag/Place preserves device identity and metadata. Disconnect rack and inter-rack cables before returning installed equipment to inventory. External equipment can be recorded but cannot be placed inside the rack. Automatic placement searches available space and skips reservations.

The library and inspector become drawers on smaller screens. Close a drawer to regain canvas space; the cable list drawer closes before connection picking.

![My devices inventory with two unplaced example devices](images/inventory.png)

*My devices keeps owned equipment separate from the installed rack.*

## Shelves and printed mounts

For a thin shelf, select it and choose **Properties → Dimensions & placement → Shelf placement → Thin tray — share U with devices**. Old layouts keep **Separate U** until you change them.

Place supported equipment at the same starting U and mounting face. Check shelf depth, load limit, at least 3 mm at each side, plate thickness/offset and the device's **Actual device height mm**, **Clearance above mm** and **Rack size U**. A zero load limit means unspecified. Without actual height the app uses an approximate U-derived height.

Example: a 2 mm tray at U15, a 52.3 mm Mini PC and 10 mm clearance fit within a device set to 2U starting at U15. The assembly occupies U15–U16. Side-by-side equipment may share that envelope; overlapping equipment cannot. Moving/removing a shelf does not move its equipment automatically; Check reports lost support.

![Thin tray sharing a starting U with a Mini PC, with actual device height and clearance fields](images/thin-tray.png)

*Illustrative 8U rack: the thin tray and 2U Mini PC share U3; this is a focused example, not the default layout.*

For a printed bracket, select the device and choose **Properties → Dimensions & placement → Mounting support → 3D-printed rack mount**. Save a reference in **Printed mount model URL** if useful. Position and cables remain, and the shelf requirement is replaced by printed support. Existing shelves stay in place. Switching back to **Shelf support** restores shelf checks.

Both 3D views show simplified brackets; devices sharing face and starting U can form a modular panel. This does not create a printable model, validate a downloaded model, reserve its extra physical clearance or add its geometry as a routing obstacle.

## 0U PDUs and 3D navigation

Search Library for a 0U PDU. Its **PDU length mm**, **Height above base mm**, **Mount type**, **Side** and **Outlet facing** determine placement. It consumes no normal U slots but must fit its physical lane without overlap. Left/right is viewed from the rack front. See [the PDU guide](0U_PDU.zh-Hant.md).

In 3D, drag to rotate, scroll to zoom and right-drag to pan. **Camera view** offers Overview, Front, Rear, Rear angle · PDU, Top, Left and Right; **Fit rack** restores rack framing. Selecting equipment or a cable provides focused inspection.

## Connect and inspect cables

Open **Cable** for the cable list and **2D map**, **3D routing**, **Topology** or **Table**. Cable Management is enabled by default; if the workflow is unavailable, check **Tools → Settings → Manage plugins**.

Use **Add cable** for the guided connection flow. Port compatibility and occupancy constrain endpoint choices. Select a cable to inspect its endpoints and routing information; list filters help isolate connections.

In 3D, **Clean** emphasizes clear routing geometry. **Realistic** can add slack when it remains clear. A blocked/review state means the route needs attention; it is not hidden behind a plausible-looking cable. Support clips and harnesses are planning aids, not automatic inventory additions.

Automatic 3D routes can differ from the automatic 2D cable plan used for length/BOM estimates. Treat all lengths as planning estimates with allowances, not measurements for cutting cable.

![2D cable map with data and power routes and the cable list](images/cable-map.png)

## Draw or redraw a route

1. Open **Cable → 3D routing → Draw route**, or select a cable and choose **Redraw route**.
2. Select an available source port on the required face. Green indicates available choices; unavailable ports are grey.
3. Select a compatible destination directly, or add gold routing points on side channels/existing cable managers first.
4. Review the preview and estimated length. Selecting a valid destination saves after compatibility, occupancy and clearance checks.

**Backspace / Step back** removes the last point; at the beginning it clears the source. **Esc / Cancel drawing** discards the draft. Selecting an earlier routing point lets you redraw the remaining section. A/B mark source and preview destination.

Saved anchors refer to channels/managers rather than fixed world coordinates. They follow geometry changes; a missing manager or new obstruction produces a blocked route requiring review. Redrawing retains the original cable's identity and metadata; cancelling leaves it unchanged.

![Custom route draft through two channel points, with destination and cable-length preview](images/draw-route.png)

*Two-server example showing the draft before saving, not a completed connection.*

## Checks and optional tools

**Check** groups issues for capacity, weight, power, heat, depth, support and serviceability. Select an issue for the affected devices and guidance, adjust the layout and review again. Values remain dependent on the dimensions and ratings you enter.

Under **Tools**, Operations, Planning and Fleet show **Enable & open** when needed. Settings includes plugin management. Optional code loads when enabled; a failed load can be retried by disabling and enabling the plugin. Existing saved preferences can restore workspace packs on reload.

Enable **Port Labels** in plugin management, open its view from Tools/Settings, choose a switch, edit physical labels, then **Save labels**. **CSV** exports its documentation. Unsaved label edits are shown separately from saved rack data.

Fleet exposes rack/room management, inter-rack links and **Export workspace JSON / Import workspace JSON** commands. Use the workspace export for the complete set of racks and their links.

![Plugin management dialog showing default and optional plugins](images/plugins.png)

## Save, transfer and recover

The browser autosaves locally. **File → Export JSON / Import JSON** handles the active rack; **Export PNG** creates a 2D diagram. Undo/redo is for the current session and is not preserved as history after reload. Export before replacing important data.

If saving fails, the **Layout recovery** banner says changes are not saved. Choose **Download workspace JSON** before closing or refreshing, then free storage and **Retry save** where offered.

If stored data cannot be read, autosave pauses to avoid overwriting it. Choose **Download original saved data** to preserve the unreadable payload; the current workspace download is a separate snapshot. Keep the original while repairing the data. Do not clear browser storage as the first recovery step.

Reducing rack height can open **Review rack height reduction**. **Cancel** leaves the rack alone; **Resize and retain all data** retains affected records out of bounds. Increase height or reposition them and review Check. Undo is available until reload; retention across reload requires successful autosave.

## Use another device

A development server started with `npm run dev` is accessible on the trusted LAN at `http://YOUR_LAN_IP:5173/HomeLab_Rack_Simulator/`. The address can change with networks. Another browser/device starts with its own storage; transfer rack/workspace JSON explicitly.

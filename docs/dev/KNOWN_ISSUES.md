# Known limitations and verification gaps

Source-reviewed 2026-10-21 against `main` `c0d2038`. This is not a fresh runtime test report. Previous issue statuses and pass counts are retained in the [historical issue list](../archive/2026-09-18-doc-refresh/dev/KNOWN_ISSUES.md).

| Area | Current limitation or behavior | Practical response |
|---|---|---|
| Physical accuracy | Rack/device geometry, connectors, thermal/noise and runtime values are approximations. | Check real dimensions, ratings, clearances and installation guidance. |
| Catalog data | Generic profiles and unresolved device configurations remain; updates do not rewrite saved instances. | Use the dated specification audit and edit the actual installed device values. |
| Power/weight totals | Totals sum placed-device fields; they do not infer omitted drives, accessories, PoE endpoints or conversion losses. | Include missing loads once and avoid double-counting output capacity as consumption. |
| Printed mounts | Schematic brackets do not import/export CAD or certify space/load/cable clearance. | Validate the actual mount separately. |
| Route lengths | Purchase length is the longer Clean/Realistic rendered centreline plus one installation-slack allowance, then a stocked length when the table contains one. The centreline shown for the current display style excludes that extra slack. Blocked routes are not estimated. Recorded lengths are not overwritten. | Do not treat either figure as a measured cut length. |
| Blocked routes | Missing manual anchors or unavailable clear paths produce review states. | Reposition equipment/managers or redraw; do not assume a hidden cable is valid. |
| Browser storage | No account synchronization; quotas, private mode or unreadable saved data can prevent saving. | Export workspace/original data using recovery controls before closing. |
| Plugin preferences | A saved enabled-id list is authoritative. Startup does not append missing Operations, Planning or Fleet ids. Unversioned preference blobs are checkpointed once at `prefsVersion` 1 without turning omitted packs back on. | A pack left out of a saved list stays off across reload. A fresh browser uses the default enabled set. |
| Imports | Runtime guards and normalization are not complete validation of every optional extension field. | Keep a backup and review imported Check issues. |

## What CI already runs

`.github/workflows/ci.yml` runs unit tests, plugin tests, the production build and the 500 KB eager bundle guard on Node 20.x and 22.x. Node 22 also runs the Playwright suite against the production build and uploads `production-dist`. `.github/workflows/deploy.yml` publishes that artifact to GitHub Pages only after those jobs succeed. This documentation pass did not rerun the suite and does not record a pass count or bundle size. Dense cable fixtures exist, but their presence is not a frame-rate guarantee. Screenshots show the UI; they are not a test result.

Historical claims such as “no tests”, “0U hidden”, “new shell opt-in”, “all packs statically imported”, silent workspace save failures, earlier 250/400 KB entry-only budgets, “saved plugin lists re-enable omitted workspace packs”, and “CI does not run Playwright, plugin tests or the bundle guard” no longer describe the current implementation.

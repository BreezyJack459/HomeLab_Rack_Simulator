# Known limitations and verification gaps

Source-reviewed 2026-09-18. This is not a fresh runtime test report. Previous issue statuses and pass counts are retained in the [historical issue list](../archive/2026-09-18-doc-refresh/dev/KNOWN_ISSUES.md).

| Area | Current limitation or behavior | Practical response |
|---|---|---|
| Physical accuracy | Rack/device geometry, connectors, thermal/noise and runtime values are approximations. | Check real dimensions, ratings, clearances and installation guidance. |
| Catalog data | Generic profiles and unresolved device configurations remain; updates do not rewrite saved instances. | Use the dated specification audit and edit the actual installed device values. |
| Power/weight totals | Totals sum placed-device fields; they do not infer omitted drives, accessories, PoE endpoints or conversion losses. | Include missing loads once and avoid double-counting output capacity as consumption. |
| Printed mounts | Schematic brackets do not import/export CAD or certify space/load/cable clearance. | Validate the actual mount separately. |
| Route lengths | Automatic managed 3D candidates and automatic 2D/BOM plans are separate. | Do not read a rendered 3D length as the BOM's measured installation path. |
| Blocked routes | Missing manual anchors or unavailable clear paths produce review states. | Reposition equipment/managers or redraw; do not assume a hidden cable is valid. |
| Browser storage | No account synchronization; quotas, private mode or unreadable saved data can prevent saving. | Export workspace/original data using recovery controls before closing. |
| Plugin preferences | On reload, saved enabled-ID lists have missing workspace packs appended. | Test clean and returning preferences separately; disabling a workspace pack may not persist across reload. |
| Imports | Runtime guards and normalization are not complete validation of every optional extension field. | Keep a backup and review imported Check issues. |
| CI coverage | CI runs unit tests and build, but not explicit Playwright/plugin-suite/bundle-guard commands. Deployment is a separate workflow. | Run relevant release checks explicitly. |

## Verification still required for a release

Run current unit/plugin tests, the relevant or full browser suite, production build and the 500 KB eager bundle guard. Dense cable fixtures exist, but their presence is not a current frame-rate guarantee. Existing screenshots and historical review reports are not evidence that the current working tree passes.

Historical claims such as “no tests”, “0U hidden”, “new shell opt-in”, “all packs statically imported”, silent workspace save failures and earlier 250/400 KB entry-only budgets no longer describe the current implementation.

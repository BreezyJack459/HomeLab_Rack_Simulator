# Simulation reliability implementation and acceptance

Requested outcome: fix the reviewed problems so users can build and simulate a rack using clear, trustworthy information. The reviewed implementation is complete within the represented-constraint scope documented below. Historical progress entries retain their original status; the final acceptance audit supersedes them.

## Required work and evidence

- Unify power socket selection, legacy outlet records, occupancy, validation and outlet-failure simulation. Verify both endpoint directions, legacy imports, duplicate and invalid sockets, and conflicts.
- Distinguish idle, typical, maximum, estimated and user-confirmed planning power. Preserve source values and use a consistent, editable planning load across totals, budgets, power chains, runtime and energy views. Unknown ratings must not become confirmed capacities.
- Validate installation requirements where known: chassis dimensions, rails, shelves, clearances and mounting. Clearly distinguish unchecked requirements from passed checks.
- Model connector subtype, direction and power/data role where supported; surface unknown compatibility. Do not infer exact compatibility from a generic socket type.
- Simplify Check view/topic controls, add cable filtering and clear filters, and make recommendations quantify deficits with relevant edit actions.
- Improve library discovery and device comparison using meaningful specs and installation requirements.
- Explain free ports by face/type and keep connection steps usable on laptop and mobile viewports.
- Resolve catalog dimension inconsistencies and preserve two-decimal rack weight display.
- Make browser-local persistence and backup/recovery clear; verify export/import round trips and unreadable saved-data recovery.
- Validate shared 2D/3D models, focused unit/integration tests, plugin tests, production build, bundle budget and relevant browser flows. Run broader regression checks before completion.

## Physical limits

The application can validate its represented constraints. Estimated thermal behavior, unspecified hardware variants, unknown connectors and unverified measurements must remain visible as unverified. A passing software check is not evidence of unmodelled physical compatibility.

## Progress — 2026-09-28, first implementation pass

Implemented: endpoint-aware outlet resolution shared by usage, validation, failure lookup and socket occupancy (including legacy assignments); explicit legacy conflicts; removed the single-connected-PSU false same-circuit warning; Cable issue topic and reset; quantified depth deficits; safer power/weight recommendations; two-decimal weight; corrected the saved JMCD template to its documented 6U / 266.7mm envelope. Existing placed layouts are preserved.

Evidence: 108 Vitest files / 1,468 tests passed; 7 plugin files / 32 tests passed; production build passed; eager JS 449.7KB / 500KB. Focused Check browser flow passed at widths 390, 1024 and 1440. First full browser run: 66/69 passed. Two placement failures used the catalog before its lazy registration; tests now await the actual library Add button before seeding. The saved-build 3D label failure passed an isolated rerun without weakening its assertion.

Second full browser run: 68/69 passed, including all three previously failing cases. Remaining failure exposed a Topology first-paint measurement race: fallback 800x600 positions changed when ResizeObserver delivered the actual size. The component now measures synchronously in `useLayoutEffect` before paint. Both topology specs passed three repetitions (6/6) after that fix; the entire browser suite has not been rerun after this final change. Production build and bundle guard passed again. Standalone cable smoke passed, including nonblank 3D clean/realistic captures in `/tmp/rack-cable-proof`.

Additional issues confirmed by source inspection, still outstanding:

- `buildPowerChains` builds edges from cable selection order; selecting a consumer first can omit it from the supply tree. Test source/consumer reversals and supply cascades.
- `simulateOutletFailure` skips a child power source before its recursive branch; nested distribution and redundant paths need proper directed reachability, not simply marking every connected peer offline.
- PDU and UPS capacities are inferred from socket counts in `powerChain.ts`. Replace with explicit ratings and visibly unknown capacity when not supplied.
- Catalog wattages mix idle, access measurements, maximum and estimates; `powerW` drives totals, energy and runtime. Add preserved reference metadata and an explicit reviewed planning load shared by these calculations.
- Known rail ranges currently live in descriptions. Add structured requirements and distinguish chassis fit from installation verification.

The overall goal remains incomplete. The outstanding acceptance items above must be implemented and verified before claiming a reliable complete build simulation.


## Progress — explicit output ratings

Removed socket-count-derived UPS/PDU capacities. Added optional `powerCapacityW` to templates and placed devices, copied through template placement, validated as finite positive on import, and editable/clearable under Power & Lifecycle. Missing ratings produce a Check warning and explanatory text in power-chain/runtime panels. Circuit summaries no longer sum equipment capacities and present that as a safe breaker limit. Runtime displays its fixed efficiency/usable-energy assumptions.

Verification: full Vitest run passed (108 files, 1,468 tests); rating tests cover unknown/invalid values, JSON import preservation, legacy layouts and missing-rating warnings. Production build and eager bundle guard passed (449.6KB / 500KB). `git diff --check` passed. Browser interaction for the new field has not yet been verified. Full goal remains active: supply direction, cascade/redundancy failure simulation, load provenance, structured installation/connectors, discovery and remaining end-to-end acceptance still need work.


## Progress — directed wired-supply simulation

Power chains, circuit reachability, outlet maps/validation and outlet-failure simulation now share directed source/consumer edges. Consumer-first socket selection is normalized. Source-to-source cascades have an editable `powerSourceDeviceId`; legacy direction remains an explicit warning until confirmed. Cycles and invalid directions are reported. Failure simulation compares reachability before/after removing all cables on the selected source outlet using the original root supplies, preserving alternate paths without promoting disconnected PDUs to sources.

Loads deduplicate shared descendants per source/circuit. Downstream UPS runtime includes its descendants and deduplicates groups/shutdown steps. Outlet maps exclude incoming cascade feeds and include downstream load. A/B path status requires distinct documented PSU inlets, roots labeled A/B and survival of each single source loss; UI avoids claiming verified real-world redundancy. Remaining-feed capacity, root supply availability, battery hold-up and hardware transfer behavior are explicit simulation limits, not implemented guarantees.

Evidence: 108 Vitest files / 1,473 tests passed; new cases cover reversed selection, three-level distribution, alternate feeds, shared-load totals, cycles, duplicate PSU sockets and nested UPS runtime. Production build and eager bundle guard passed (450.6KB / 500KB). Two Playwright tests passed: rating/direction editing with reload persistence, and visible surviving-feed outcome after outlet failure. Initial browser test failure was a selector mismatch (`Check` versus the actual accessible name `Check Health`), corrected to the observed name; result assertions remain intact. Full browser regression and plugin suite have not been rerun in this phase.

Remaining goal work includes load provenance/planning values, structured installation and connector data, source inlet/outlet modeling beyond generic power ports, actual supply/breaker ratings and remaining-feed capacity checks, realistic UPS failure scenarios, library discovery/comparison, port count/mobile clarity, backup/recovery and final end-to-end acceptance. Earlier outstanding entries above describe the historical baseline; these progress sections supersede the direction/cascade implementation status but do not claim full physical simulation.


## Progress — power provenance and reviewed planning load

Added preserved power references (watts, basis, source), editable planning basis/notes and an explicit review flag. Template placement copies the reference; editing an older unannotated layout captures its original value before changing watts. Any planning watts/basis/notes edit clears review. Runtime import guards validate metadata. Catalog descriptions were transferred into 61 explicit references (28 maximum, 27 estimates, 4 access measurements, 1 idle, 1 typical); unspecified entries remain unknown, without inventing manufacturer verification. Library cards show the basis. Check and the power health chip surface unreviewed active loads. All calculators continue using `powerW` as one planning load; the immutable reference is informational.

Evidence: final full Vitest run 109 files / 1,478 tests passed; cross-calculator assertions cover totals, energy, monthly kWh, supply trees and UPS runtime. Production build and eager guard passed (452.4KB / 500KB). Three power workflow browser tests passed after the final note field change, including original-reference preservation, review invalidation, and reload persistence. Three Check edit flows at widths 1440/1024/390 also passed before that final note field addition. `git diff --check` passed. Full browser regression and plugin suite remain for final acceptance.

The goal is still active. Outstanding work includes structured physical installation and connector data, richer supply/inlet and failure-capacity/battery modeling, library comparison/filtering, per-face port count clarity, persistence recovery/backup acceptance and final full regression.


## Progress — structured installation checks and accessible settings

Added installation support/rail range/rear allowance/source/kit fields to devices and templates, with template copying and import guards. Added measured mounting-post spacing to rack data and baseline snapshots. Three existing catalog rail ranges now feed checks; no new manufacturer specifications were inferred. Checks explicitly distinguish passed recorded conditions, failed requirements and missing data. Rail compatibility now compares measured post spacing against the equipment kit range, never chassis depth against legacy rack min/max fields. Legacy fields remain preserved. Shelf support now requires full horizontal/depth support, matching mount side and directly adjacent support (or the shared-U tray rules).

Browser validation uncovered a real existing entry-point problem: Depth Compatibility was assigned to the inspector, but the Serviceability inspector rendered only its dedicated serviceability panel. Moved Depth Compatibility to the main audit grid; the actual input path is now verified. The original full run was 72/73, and two isolated retries confirmed the missing control; the repaired final full run passed all 73 tests. Do not attribute the failure solely to the initial observed navigation/reload.

Final evidence: full Vitest 110 files / 1,485 tests; plugin suite 7 files / 32 tests; full Playwright 73/73; production build and eager bundle guard 456.6KB / 500KB; standalone cable smoke passed with artifacts in `/tmp/rack-install-routing-smoke`; `git diff --check` passed. Cable-routing-check applied: shared port face/endpoints/routing geometry were not altered; rackMath diff changes only the depth/rail compatibility check, and routing/port/0U plus 2D/both-3D regression coverage passed. The post-spacing value is inspection data, not a change to schematic 3D frame geometry.

Goal remains active. Remaining work still includes connector subtype/roles, supply inlet/outlet and battery/remaining-feed capacity simulation, library comparison/spec filters, face-specific free-port counts and any uncovered mobile/backup guidance. Passing this regression suite does not prove those unfinished requirements complete.


## Progress — socket constraints and face-specific availability

Added face-aware per-socket connector identity, role, AC/DC, nominal operating voltage, DC polarity and source fields, copied by template placement and preserved in JSON with runtime guards. Added cable-end socket-fit declarations. One constraint checker is shared by visual picking, auto-resolve, store creation, Check and directed power analysis. Known conflicts block new creation; imported/edited problems remain visible. Explicit socket roles resolve cascade direction; conflicting incoming feeds cannot promote a disconnected downstream PDU to a new root. Unknown metadata never becomes a compatibility pass. These are recorded-constraint checks, not protocol/current-rating/grounding or manufacturer certification.

UI includes Socket specifications in device properties and connector review/end-fit fields in cable details. Unavailable destinations with known conflicts explain the reason. Available counts are split by face/type, including patch-panel front/rear jacks. Browser tests use the actual collapsed-inspector and mobile Cable list entry points; the initial two test failures were missing those interactions, corrected without changing result assertions.

Final evidence: 111 Vitest files / 1,493 tests; 7 plugin files / 32 tests; full Playwright 75/75; build and eager guard 461.3KB / 500KB; standalone cable smoke passed with `/tmp/rack-connector-routing-smoke` artifacts; `git diff --check` passed. Unit cases cover generic unknowns, differing cable ends, role/AC-DC/voltage/polarity conflicts, canonical face resolution, store/picker blocking, blocked cascade roots, import validation and template copying. Full 2D/both-3D and responsive workflows passed; socket geometry/face rules remain unchanged.

Goal remains active. Remaining acceptance includes richer supply inlet/outlet and battery/remaining-feed capacity simulation, cable electrical ratings/PoE and inter-rack constraint coverage where supported, library spec comparison/filtering, backup guidance and a final requirement-by-requirement audit. Full simulation must continue to distinguish represented checks from unsupported physical behavior.


## Progress — remaining supply output capacity

Outlet failure now evaluates every still-reachable UPS/PDU stage against its explicit output rating, with full unique downstream planning load per supply and no assumed PSU sharing. It excludes the supply’s own consumption from its output, includes downstream distribution consumption, and excludes disconnected stages. The panel distinguishes overload (quantified excess), unknown rating and within-recorded-rating results alongside wired reachability. It deliberately does not predict breaker tripping, battery transfer or cable current safety; conditional planning assumptions remain visible.

Evidence: full Vitest 111 files / 1,494 tests; power reliability browser flows 3/3; production build and eager bundle guard 461.8KB / 500KB; diff check passed. New unit coverage exercises an overloaded surviving PDU, exact-capacity upstream UPS, duplicate reachable loads, unknown rating and disconnected downstream supply. Browser coverage confirms the surviving path can coexist with a visible 50W overload and an unknown rating. Full browser and plugin suites were not rerun in this phase; routing geometry was not changed.

Goal remains active: battery/transfer scenarios, electrical and PoE constraints, library discovery/comparison, backup acceptance, deployment test gates and final requirement audit remain outstanding.


## Progress — production validation and deployment gate

CI is now reusable and runs unit/plugin tests, production builds and the eager bundle guard on both configured Node versions. Node 22 runs all browser workflows against the built artifact on a dedicated preview port before uploading it. Deployment invokes this workflow, waits for the complete validation matrix, downloads the same-run artifact and packages it without rebuilding. Workflow YAML parsing and dependency/artifact checks passed locally; hosted Actions execution remains unverified until these changes are published and run.

The first production browser run exposed two failures (73/75): the port diagram initially used a 320px fallback before its first ResizeObserver callback, and the classic-shell test initializer overwrote its own fallback preference on reload. The diagram now measures available content width in a layout effect before paint; test initialization preserves an explicitly chosen shell. The final build is tested without concurrent rebuilds. Routing/port geometry is unchanged.

Final local evidence: 111 Vitest files / 1,494 tests, 7 plugin files / 32 tests, full production Playwright 75/75, build/typecheck and eager budget 461.8KB / 500KB passed. Focused connector component tests also passed (10). Diff whitespace checks passed. No commit, push or hosted deployment was performed. Remaining goal work still includes battery/transfer modeling, electrical/PoE constraints, library comparison/filtering, backup acceptance and the final comprehensive audit.


## Progress — catalog specification filters and comparison

The library now combines maximum U/depth/initial planning watts and minimum Ethernet count, with result counts and a clear-filters action. Up to three templates can be selected across searches and compared for dimensions, fixed-precision weight, power provenance, explicit output rating, actual port types/speeds, installation data and current rack dimension problems. Unknown specifications remain visibly unverified. The table supports horizontal scrolling on mobile and explains catalog/planning limitations. Shared native dialogs now have accessible names, isolate key events from the mobile drawer and restore focus to their opener on close.

Evidence: 111 Vitest files / 1,495 tests passed. Full production Playwright passed 77/77 after the dialog/focus changes. Final small display correction excludes port-layout metadata from the port list and adds a horizontal-scroll hint; the rebuilt final version passed both dedicated comparison browser flows (1440/390), build/typecheck and eager guard (461.8KB / 500KB). Mobile screenshot was visually inspected after the final correction. The plugin suite was not rerun in this phase. Diff whitespace check passed. Initial dedicated browser failures exposed a test opening-state race and a genuine missing focus return, both corrected without weakening expected outcomes.

Library discovery/comparison acceptance is implemented. Goal remains active: battery/transfer behavior, electrical/PoE constraints, backup/recovery acceptance and final requirement audit remain; hosted CI execution also needs evidence after publication, which has not been requested or performed.


## Progress — core workspace backup and restore acceptance

Both shells now expose File → Workspace backup and restore independently of Fleet. The menu and dialog explain browser-only autosave, whole-workspace versus single-rack JSON, and excluded browser/plugin preferences. The lazy dialog downloads current workspace data, previews imported rack/device counts and requires explicit replacement confirmation. Cancel leaves state intact. It rejects invalid files and inter-rack imports that would silently prune records. Restore resets undo history; paused-autosave recovery remains paused and visibly warns that restored state must be downloaded before closing.

Evidence: full Vitest 111 files / 1,495 tests; focused production browser 7/7, covering desktop/mobile full-workspace download→restore→reload equality including two racks, inventory, power references/ratings, connector/cable declarations, installation requirements and inter-rack links. Tests also prove malformed file rejection, invalid-link preservation, cancel safety, quota-error download/retry and original unreadable-data retention. Production build/typecheck and eager guard 462.1KB / 500KB passed; diff whitespace check passed. Full browser/plugin suites were not rerun in this phase.

Backup guidance and round-trip/recovery acceptance are implemented. Remaining goal work includes battery/transfer simulation, electrical/PoE and inter-rack compatibility coverage, and a final complete acceptance audit. Hosted workflow execution is still unverified; no publication was requested or performed.


## Progress — editable UPS battery energy scenarios

Added persisted battery Wh and efficiency/usable-capacity/starting-charge assumptions, with import guards and template conversion copying. Power & Lifecycle exposes their units and defaults. Runtime uses constant full reachable load with UPS self-consumption for energy, excluding self-consumption from output-rating utilization. Missing battery energy and zero modeled load now remain visible as Not estimated instead of disappearing or promising infinity. Percent output load is no longer numerically capped at 100. The previously unmounted UPS Runtime panel is now reachable under Check → Serviceability → Power Chain, lazy loaded only for UPS layouts. It compares a user-entered outage duration and distinguishes overload, unknown wiring/rating/energy, insufficient energy, unreviewed loads and conditional coverage. Critical-only estimates assume loads are already shed, not an executed shutdown plan.

Power-outage scenario traversal now uses the shared directed topology, including reverse-picked cables. Missing/partial runtime data does not produce an infinite endurance summary or an aggregate runtime metric. Degraded-battery scenarios likewise keep missing data unknown, preserve zero energy and avoid unsupported expansion/replacement promises. Power Chain output-capacity bars now also exclude source self-load. These are energy planning scenarios, not transfer-delay, surge, discharge-curve or automatic shutdown simulation.

Evidence: full Vitest 111 files / 1,497 tests, plugins 7 files / 32 tests, production browser 80/80 passed. Browser coverage edits all battery assumptions, reloads, compares 30 versus 31 minutes, then verifies missing Wh stays visible. Unit coverage verifies multiplicative energy/charge effects, exact output capacity, overload above 100%, zero charge, invalid imported percentages/Wh, reversed cable direction and unknown scenario summaries. After the final unknown/degraded summary refinements, the focused runtime/scenario suite passed 40/40 and final build/typecheck/eager guard passed (462.7KB / 500KB); full browser was not rerun after those last pure scenario refinements. Diff whitespace check passed.

Goal remains active. Outstanding acceptance includes electrical/PoE and inter-rack compatibility coverage, remaining failure/transfer limitations audit and final end-to-end requirement verification. Hosted deployment has not been run.


## Progress — inter-rack connector consistency

Inter-rack creation and editing now share the regular connector constraint checker. Endpoint identities are remapped internally so identical device IDs in separate racks cannot resolve to the same socket metadata. The wizard records cable-end socket-fit identities, explains unknown constraints, and blocks known conflicts. Map selection exposes editable identity drafts and explicit save, with conflict blocking before save. Existing connector conflicts remain preserved through normalization for review rather than silently pruned; existing structural endpoint/media/occupancy repair behavior remains unchanged. Regular Ethernet and inter-rack UI explicitly state that a data cable does not verify PoE power or optical/protocol support.

Evidence: full Vitest 111 files / 1,498 tests; plugins 7 files / 32 tests; final focused production browser 9/9 (regular connection, mobile patch panel, all four inter-rack media types, conflict prevention/correction, identity save/reload, and desktop/mobile backup). Unit coverage includes repeated device IDs across racks, different valid cable ends, creation blocking, unknown metadata, JSON preservation and preservation of imported conflicts. Build/typecheck and eager guard passed (463.6KB / 500KB); diff whitespace check passed. Full browser suite was not rerun in this phase.

Goal remains active. PoE power budgeting and electrical rating coverage still need implementation/audit; data connectivity is not treated as a supplied-power path. Final comprehensive acceptance remains outstanding.


## Progress — explicit PoE allocations across racks

Added optional device total PoE budget, per-Ethernet-socket PSE/PD/none role, recorded profile identity, per-port output limit and PD required allocation at the PSE. Import guards validate roles/text/nonnegative watts, template conversions preserve the device budget and existing structured socket metadata. PoE intent is an explicit boolean on regular/inter-rack cables; ordinary data connections never automatically imply power. Socket properties, cable details, inter-rack wizard and map editor expose these records.

A workspace-wide PoE allocation audit under Power Chain sums same-rack and cross-rack allocations per rack-scoped PSE identity. It handles reversed endpoint selection, distinguishes total/per-port excess, unknown roles/requirements/budgets and recorded-profile conflicts, and rejects nonexistent Ethernet endpoint identities in the audit. Profiles are compared as user-recorded identities; no manufacturer or protocol watt limits are invented. The UI explicitly states that this is an allocation audit, separate from upstream wired/UPS failure simulation.

Evidence: full Vitest 112 files / 1,501 tests passed; final focused PoE tests passed after endpoint guard addition; production browser 8/8 covered edited PSE specs, explicit cable intent, reload persistence, quantified 5W overload, regular connector flows and all four inter-rack media types. Final build/typecheck/eager guard passed (464.1KB / 500KB); diff whitespace check passed. Full browser/plugin suites were not rerun this phase.

Goal remains active. PoE allocation audit is implemented, but PoE upstream power/UPS/failure-path integration and Check-summary integration are still outstanding; conversion loss and patch-panel transit remain explicitly unmodeled. Electrical ratings and final requirement audit remain to address.

## Progress — PoE Check integration and cross-rack failure-path tracing

PoE source budgets and link conflicts/unknowns now feed Check's Power category and the power health chip. Cross-rack issues carry explicit edit targets so same device IDs in separate racks cannot open the wrong device. Missing allocations affect only related sources. Existing rack overload remains critical even when PoE metadata is unknown.

Added a user-selectable supply-unavailable scenario in the PoE audit. It combines the existing directed wired topology with explicitly role-resolved PoE links across all racks. Removing a UPS/PDU/PSE distinguishes receivers losing their recorded path, retaining another path, and lacking an upstream path before failure. IDs remain rack-scoped, traversal terminates with cycles, ordinary data links never imply power, and PSE devices are not invented as live roots. Profile/budget/topology warnings remain visible: results describe recorded paths, not verified operation. Removing a UPS represents unavailable output, not battery hold-up after mains failure. Allocation watts are deliberately not substituted for consumption; upstream load/runtime integration still requires explicit consumption and loss semantics.

Current-phase evidence: focused PoE/power-chain Vitest 2 files / 53 tests passed; production PoE browser 2/2 passed (including new untraced→UPS connected→UPS output failure flow and existing cross-rack correct-device edit); production build/typecheck and eager guard 469.3KB / 500KB passed. The final browser-test source also passed tsc. No full browser/unit/plugin rerun in this phase. Earlier Check integration evidence: full unit 112 files / 1502 tests before the last health-strip regression addition, then focused 13/13 and production browser 5/5. Those earlier counts are not a new full-suite result.

Goal remains active. Outstanding work includes PoE consumption/conversion-loss integration with upstream ratings, UPS runtime and outlet failure, electrical-current/transfer limitations audit and final complete acceptance regression. Hosted CI execution remains unverified; no publication performed.

## Progress — explicit PoE input projection for Power Chain and UPS

Added PD planned output draw (distinct from reserved allocation), PSE self-only/inclusive planning-watt semantics, and explicit conversion efficiency. New fields have import guards, device/template copying and socket-editing UI. A pure projection accounts for all workspace PoE links at their source, including cross-rack receivers; self-only mode adds output draw divided by efficiency, inclusive mode keeps the entered input total unchanged, and original saved powerW is never mutated. Missing assumptions, incompatible links, budget failures and inclusive input below recorded output keep UPS runtime unestimated. Power Chain and circuit load presentation consume the same projection. PoE demand follows its PSE shutdown priority; separate wired feeds retain full load rather than assumed sharing.

Evidence: full Vitest 112 files / 1,506 tests passed. Dedicated tests cover 10 W self + 20 W output at 80% = 35 W upstream, cross-rack aggregation, unchanged inclusive totals, missing efficiency/draw/mode, implausible inclusive input, immutable saved watts and import validation. Production browser 6/6 passed across PoE, UPS assumptions and power reliability, including editing/reloading PSE mode and efficiency and the resulting 2h51m UPS estimate. Build/typecheck and eager guard passed (469.9KB / 500KB). Diff whitespace check passed. No full browser/plugin rerun this phase.

Goal remains active. The new projection still needs integration with outlet-failure remaining-capacity calculations, rack-wide totals/health, and workspace-aware scenario callers. Inclusive totals require review when connected loads change; review invalidation needs audit. Receiver-by-receiver automatic shedding, transfer/current behavior and final full acceptance verification remain outstanding. This phase does not establish complete physical simulation or hosted deployment validation.

## Progress — PoE input in outlet capacity checks

Outlet grid load labels and simulateOutletFailure now consume the same explicit PoE input projection as Power Chain/UPS, with workspace context for cross-rack receiver demand. Surviving supplies carry full downstream projected input. Unknown PoE assumptions on a reachable downstream device prevent within-rating status, while already known overload retains priority. Unrelated or disconnected uncertain PoE loads do not invalidate an otherwise known empty output. UI distinguishes unknown input from unknown rating and known overload, with explanatory warnings. Projection remains transient and does not alter saved watts.

Evidence: focused Vitest PoE/power-chain 2 files / 56 tests passed. Added regression verifies 35W including cross-rack draw against 30W/35W limits, efficiency missing, unaffected empty source, and zero lost load for a surviving alternate feed. Production browser 6/6 passed across PoE and power reliability, including a new real outlet click showing 5W overload then unknown input after efficiency removal. Build/typecheck/eager guard passed (471.5KB / 500KB), diff whitespace check passed. Full unit/browser/plugin suites were not rerun in this phase.

Goal remains active. Outlet affected-device lists still trace wired edges; the separate PoE failure audit handles cross-rack receiver paths. Unified failure impact lists, rack-wide health/totals, workspace-aware scenario runtime and receiver reachability, review invalidation on changed PoE assumptions/loads, electrical/transfer limits and final acceptance remain outstanding. No publish/deployment performed.

## Progress — workspace-aware UPS scenarios

Power-outage and weak-battery scenarios now use rack-scoped wired/PoE reachability across the workspace and the same projected input/runtime calculations as Power Chain. They report impacts only for the selected rack, include relevant remote UPS units, exclude unrelated remote supplies and preserve local unknown UPS cases. Battery degradation halves energy on a synthetic workspace, including remote UPS units, without modifying saved data. Shared shutdown-priority defaults avoid contradictory network-device classification. Conditional path wording replaces guaranteed survival/drop claims, and unknown PoE inputs cannot produce a passed backup-path assumption. Scenario panel, overall calculation and report export all pass workspace context.

Evidence: full Vitest 112 files / 1,508 tests passed. New cases verify remote 150-minute baseline/75-minute degraded runtime, immutable battery values, identical IDs across racks, removing PoE intent, remote low-energy critical risk and unknown conversion input. Final production browser 5/5 passed, including Tools → Planning → Scenario Planner showing 150 and 75 minutes for a receiver-only rack. The initial run was 4/5 because the new test used the internal name Plan instead of the actual Planning menu label; corrected the locator from the captured page state without weakening assertions. Production build/typecheck/eager guard passed (471.5KB / 500KB). Full browser/plugin suites were not rerun this phase. Diff whitespace check passed.

Goal remains active. Remaining work includes unified wired/PoE outlet impact lists, rack-wide power totals/health semantics, review invalidation on changed input assumptions/load, electrical/transfer limits and final complete acceptance verification. No publication/deployment performed.

## Progress — invalidate stale power reviews across rack edits

A pure workspace comparison now clears existing powerReviewed flags when planning input semantics, socket specifications or connected PoE electrical records change. It includes remote receiver draw/spec changes and PoE link add/remove/update, while ignoring names, colors and labels. Rack-scoped identities prevent unrelated same-ID devices from losing their review. Explicit re-review remains possible. The store integrates invalidation before recording history and persists both active and remote changes; a local edit creates one history entry rather than a second invalidation entry. Undo/redo retains the local recorded review state. Import/restore retains review metadata supplied in the imported snapshot, explicitly not an independent verification.

Evidence: full Vitest 113 files / 1,511 tests, plugins 7 files / 32 tests, full production Playwright 84/84 passed. New store tests cover single history entry, re-review, undo/redo, remote receiver edits, persistence, unrelated same-ID devices, cosmetic edits, cable removal and import preservation. Production build/typecheck/eager budget passed (473.0KB / 500KB); diff whitespace check passed. Complete browser regression includes backup/recovery, cross-rack operations, PoE/UPS scenarios, 2D/both 3D viewers, shelf/0U and responsive workflows.

Goal remains active. Unified PoE/wired outlet impact lists and rack-wide totals/health still need completion, along with electrical/transfer boundaries and final requirement-by-requirement acceptance. Passing this regression does not prove those remaining requirements. No publication/deployment performed.

## Progress — unified outlet and PoE receiver impacts

The outlet result now runs the same workspace-wide PoE/wired path traversal used for supply removal, excluding the selected physical outlet edges while retaining original roots. It lists affected receivers in local and remote racks as lost, retained or previously untraced. Only descendants of the selected outlet are listed, so unrelated receivers do not appear as survivors of a free outlet. Rack-scoped keys distinguish identical IDs. Receivers retaining PoE after their wired inlet fails are removed from the lost-device list and appear as surviving. Projected wired-feed watts remain a separately labeled measure and do not add receiver watts again. Root-live and recorded-constraint assumptions remain explicit.

Evidence: focused PoE/power-chain Vitest 2 files / 59 tests passed. New tests cover local/cross-rack loss, reverse endpoint selection, partial independent receiver feeds, alternate PSE feeds, empty outlets, mixed wired/PoE retention and no double-counted loss watts. Final production browser 7/7 passed, including outlet receiver retention→loss→undo and the existing PoE/UPS/scenario/power flows. Final build/typecheck/eager guard passed (473.0KB / 500KB); diff check passed. Full browser/unit/plugin suites were not rerun this phase; the preceding full run was 84/84 browser, 1,511 unit and 32 plugin tests.

Goal remains active. Rack-wide power totals/health attribution, electrical/transfer boundaries and the final requirement-by-requirement audit remain outstanding. No publication/deployment performed.

## Progress — attributed rack input and health summaries

Added a shared rack-power summary based on the explicit PoE input projection. It attributes output/losses to the supplying rack, excludes PoE-only receivers from a second charge and retains full input on independently wired receivers. It preserves a separate raw device-watt sum and the existing independent heat score. Main App totals, Check budget validation, health chips, validation summary, audit headroom and the health dashboard now consume workspace-aware input. Unknown source assumptions propagate to receiver-rack Review status and correctly targeted Check issues; unknown headroom is not presented as available. An informational Check item explains both totals and their limits. Numeric display uses fixed precision.

Evidence: full Vitest 113 files / 1,514 tests passed; production focused browser 10/10 passed across PoE, power reliability and health workflows at 1440/1024/390. New utility coverage checks 35W source input/0W remote input, separate device totals, local PoE receiver exclusion, independent wired inputs, source overload and remote missing-efficiency edit targets. Browser coverage verifies source 40W including UPS self-load, receiver 0W, and receiver Review status after source efficiency removal. Final build/typecheck/eager guard passed (475.0KB / 500KB); diff check passed. Full browser/plugin suites were not rerun this phase.

Goal remains active. Remaining audit includes optional reports/forecast/fit-check workspace context, energy/heat versus attributed-input semantics, incomplete or conflicting wired-feed attribution, electrical/transfer boundaries and final full acceptance. No publication/deployment performed.

## Progress — optional-tool power consistency and accessible energy estimates

Capacity Forecast, Fit Check and Portfolio panel/export now pass workspace context into shared totals/validation. Unknown PoE input yields a null additional-device forecast, visible unverified messaging and a warning fit result. Fit results clear on workspace edits to prevent stale passes. Energy uses attributed rack input and suppresses energy/cost when input is unknown; missing electricity rate no longer displays a zero-cost claim. PoE local heat stays explicitly unestimated rather than converting exported input watts into local BTU/h. Portfolio labels and uncertainty states match these semantics. The previously unmounted EnergySummary is now lazy-mounted under Power Chain with editable/clearable electricity rate.

Evidence: full Vitest 113 files / 1,515 tests, plugins 7 files / 32 tests passed. Added cross-tool cases verify 35W input, a 40W proposed device exceeding a 70W budget, 25.55kWh/$51.10 under declared assumptions, no duplicated remote receiver energy, unknown heat/input, forecast null and fit warning. Production browser 8/8 passed including energy cost input/clearing, visible unknown heat, remote-input forecast warning and 1440/1024/390 health workflows. Final build/typecheck/eager guard passed (475.0KB / 500KB); diff check passed. First validation exposed a stale expected report label and missing required test-template description; corrected before final validation. Fit/portfolio data behavior is unit-verified; their complete interactive workflows still need final acceptance coverage. Full browser suite not rerun this phase.

Goal remains active. Outstanding audit includes incomplete/conflicting wired-feed attribution, proposed-template metadata fidelity and fit UI acceptance, electrical/transfer/thermal modeling limits and the final requirement-by-requirement regression. No publication/deployment performed.

## Progress — fit-preview metadata fidelity and installation acceptance

Actual placement and Fit Check now share a pure placedDeviceFromTemplate conversion (store still supplies generated IDs; preview supplies its stable ID). Existing placement semantics are preserved while preview gains physical height, mounting envelope, installation requirements/kit, power provenance/ratings, PoE and UPS/socket metadata. A distinct Installation category blocks recorded failures and warns on missing inputs. Physical-height validation is no longer dropped by fit categorization. Unreviewed planning loads remain power warnings, and warning results use an amber conditional placement verdict rather than a green blanket Fits claim. Known results still invalidate on workspace edits.

Evidence: full Vitest 113 files / 1,517 tests passed. New fit cases verify rail mismatch/missing/valid spacing, cloned socket metadata, retained electrical assumptions, normal-height and 0U-length rejection. Final production browser 11/11 passed including actual Tools → Planning → Fit Check flow at 1440/390, rail mismatch blocking, stale-result clearing, recheck and real placement preserving catalog metadata. Initial browser run was 10/11: clearing results at mobile width positioned Check Fit beneath the fixed Inspector button. Added responsive bottom space and verified normal clicks without force. Final build/typecheck/eager guard passed (475.0KB / 500KB); diff check passed. Full browser/plugin suites not rerun this phase.

Goal remains active. Remaining work includes incomplete/conflicting wired-feed attribution, remaining template-field/geometry and physical-model limits audit, portfolio UI/export acceptance, electrical/transfer/thermal boundaries and final comprehensive verification. No publication/deployment performed.

## Progress — unresolved wired-feed attribution

Rack attribution now distinguishes rejected wired input intent from a genuinely PoE-only receiver. Rejected power edges retain endpoint planning watts, and topology warnings generate a power-input review issue, unverified totals/headroom and suppressed energy. UPS runtime no longer displays an optimistic number while topology warnings remain. Surviving-supply output checks cannot report within-rating while wiring is unresolved; known overload retains precedence. Fit Check includes the attribution warning, and failure-panel wording covers both load and wiring uncertainty rather than incorrectly blaming PoE alone.

Evidence: final full Vitest 113 files / 1,518 tests passed; production browser 10/10 passed across power, PoE and desktop/mobile Fit Check. Added regression verifies 45W retained input for conflicting wired plus PoE, no energy/runtime or capacity pass, then restored estimates after conflict correction. Browser test observes the 10W Review chip, hidden monthly energy and restored 7.3kWh/6h48m after correcting the recorded voltage. Final build/typecheck/eager guard passed (475.5KB / 500KB); diff check passed. Full browser/plugin suites were not rerun this phase.

Goal remains active. Remaining work includes portfolio export interaction acceptance, remaining physical-model/template-field and electrical/transfer/thermal limits audit, review of confidence presentation in all supply panels and final comprehensive verification. No publication/deployment performed.


## Progress — supply confidence and verified portfolio downloads

Power Chain output bars now distinguish unreviewed loads, unresolved wired topology and PoE projection warnings from recorded capacity. Known overload keeps critical precedence and numeric utilization can exceed 100%. Topology warnings are visible alongside the chains. Browser coverage checks conflict → corrected wiring but unreviewed load → reviewed recorded status, and 133% output load.

Portfolio preview is a semantic preformatted block containing the exact generated Markdown. Named report/download controls support desktop and mobile interaction. Actual downloaded files match the visible preview before and after removing PoE efficiency; cross-rack input, cost and unknown heat/energy stay consistent. Source inspection also found unsupported redundancy claims: boot dependencies counted as dual PSUs and cable counts implied redundant networks. The report now uses the shared local wired A/B reachability check, describes its limits, and leaves network redundancy unverified. Planning Topics replaces Skills Demonstrated, explicitly making suggestions rather than claims of configured capabilities.

Evidence: full Vitest 113 files / 1,519 tests passed; final focused portfolio 16/16 after correcting a test cable type; plugins 7 files / 32 tests; final full production Playwright 89/89 passed, including both portfolio downloads at 1440/390 and 2D/both-3D, backup, fit, PoE and power flows. Production build/typecheck and eager guard passed at 475.5KB / 500KB. Initial focused browser run was 8/10: the new preview test expected a pre element while the existing preview used line divs; preview now preserves exact Markdown in pre and passes actual file equality. Initial build caught an invalid local test cable type, corrected from cat6a to ethernet; inter-rack cat6a remains valid. Diff whitespace check passed.

Current DeviceTemplate fields were compared with placedDeviceFromTemplate: represented template fields are copied directly or by templatePowerFields; no additional missing field found in this pass. This is a source audit, not manufacturer-data verification. Goal remains active: final requirement-by-requirement acceptance, automatic 2D/3D cable-length consistency, catalog provenance verification and electrical/current/transfer/thermal boundaries remain to resolve. Hosted CI/deployment has not been executed or verified; no publication performed.


## Progress — measured rendered-route centreline

Extracted the existing bounded line/quadratic fillet geometry into a pure managedRouteCurve utility shared by the Three.js renderer and route measurement. Selection, route candidates, ports, lane ranks and support placement are unchanged. RackSceneModel now measures the rendered curve with per-axis physical scaling, rather than treating world coordinates as metres. Curved spans are sampled at 32 subdivisions; independent Three.js sampling at 128 subdivisions verifies agreement within 0.1mm across sample and dense 60/100-route fixtures in Clean and Realistic modes. This numerical agreement does not establish physical installation accuracy.

The selected 3D route exposes centreline length, explicitly excluding extra installation slack, beside the separate 2D planning estimate. A shorter recorded cable displays the deficit. Blocked routes return null and display Not estimated rather than zero. This is the shared measurement prerequisite and visible mismatch diagnosis; BOM/procurement still consume the 2D plan and complete length unification remains outstanding.

Cable-routing-check applied: canonical resolvePortFace, mount-independent front/rear Z signs, canonical port positions, 0U approach, source-half/candidate selection and PDU behavior are unchanged; no store mutation or template fields were introduced. Full unit 113 files / 1,519 tests passed including rendered-curve collision/endpoints and additional length assertions. Production build/typecheck and eager guard passed at 475.5KB / 500KB. Standalone cable smoke passed with captures in /tmp/route-measure-captures. Final full production Playwright passed 89/89, including selected-route length/short-cable warnings and blocked-length states in both styles. Diff whitespace check passed. Plugin suite was not rerun in this geometry-only phase. Goal remains active: procurement/2D/3D route unification, catalog provenance and electrical/current/transfer/thermal limits plus final requirement acceptance remain outstanding; no publication performed.


## Progress — shared route-based purchasing lengths (2026-09-29)

Added a cached immutable-layout length requirement using the longer actual Clean/Realistic rendered centreline plus one discipline-specific installation allowance. Both styles use the complete layout so filtering does not change lane placement or recommendations. BOM, procurement, cable list/table, patch-panel printable labels, completed manual-drawing preview, selected 3D route and Check now consume that shared requirement. Recorded cable lengths are not overwritten. Check no longer adds a separate 15% margin, and the old schematic-only short-cable routing warning was removed in favor of the shared Check issue.

Blocked or missing routes stay visible as unestimated BOM/procurement entries. Requirements beyond the standard-length table have no stocked length and explicitly request a custom minimum instead of rounding down to 10m. CSV/Text exports include the measurement basis. Unit regressions compare both rendered styles against BOM/procurement/Check, verify moving an endpoint recomputes requirements, retain original declared lengths and cover blocked/missing and >10m routes. The 2D diagram remains a schematic; its segment dimensions are not purchasing lengths.

Current evidence: full Vitest 114 files / 1,522 tests, plugin suite 7 files / 32 tests, production build/typecheck and eager guard 493.0KB / 500KB passed. Initial full unit run found only a wording assertion requiring “plus”; wording was restored without changing calculation assertions. Initial focused browser exports confirmed CSV equality but the text-file locator incorrectly used BOM TXT; captured UI says BOM Text, and the test now uses that exact button. Final full production Playwright passed 89/89, including actual BOM CSV/Text download equality with selected 3D purchase length for clear and blocked routes, stable recommendations in both styles and the manual-drawing workflow. Standalone cable smoke passed with captures in /tmp/route-purchase-captures. Diff whitespace check passed. Cable-routing-check: endpoint face/sign/approach, candidate selection, PDU drop and scene geometry were unchanged; routing diff removes only the obsolete schematic-length warning, and existing endpoint/collision/0U/dense-route tests and full browser coverage passed.

Goal remains active. Remaining audit includes persisted procurement overrides from earlier length groups, serviceability pull-out-length assumptions, current/catalog provenance, electrical/current/transfer/thermal boundaries and final requirement-by-requirement acceptance. No publication performed; hosted CI/deployment remains unverified.


## Progress — connected maintenance cable allowance

Serviceability previously compared total cable length only to chassis depth plus 300mm, ignoring the length already occupied by the installed route and substituting an estimated stock length for an unrecorded cable. It now uses recorded actual length against the longer rendered centreline plus assumed chassis-depth travel and the larger of 300mm or routing slack. Missing cable length, unresolved routes and missing depth are unverified rather than passing. Per-device checklist, Check issues and Serviceability panel share the same explanatory result. General “all devices accessible” wording was replaced with a conditional modeled-result statement. Cable arms, release points and moving clearances remain explicitly unverified; no physical travel measurement or moving-cable simulation is claimed.

Evidence: full Vitest 114 files / 1,523 tests passed. New regression checks a cable that passed the former depth-only comparison, the full requirement, corrected length, missing actual length, blocked route and maintenance checklist warning. Final production installation browser 3/3 passed including the new 1440/390 service flow and rail fit. The two rear-route/BOM-download tests also passed during the first focused run. Initial mobile failures were missing sidebar interactions: open Check issues before selecting category, close its drawer before opening Inspector. Tests now perform both actual interactions without force clicks; production UI did not need a workaround. Build/typecheck and eager guard passed at 493.3KB / 500KB; final test-source typecheck and diff whitespace check passed. Full browser/plugin suites and standalone cable smoke were not rerun in this non-geometry phase.

Goal remains active. Remaining work includes saved procurement records from obsolete length groups, actual travel/cable-arm and other physical-model limitations, catalog provenance and electrical/current/transfer/thermal requirements, and final comprehensive acceptance. No publication or hosted CI verification performed.


## Progress — procurement history reconciliation

Cable procurement groups now include their sorted route membership in their identity. Matching legacy length groups migrate only when saved quantity and route membership agree. A changed/removed group preserves its previous saved status and notes as a review record, rather than automatically fulfilling the new group. Current requirement summaries, the Planning Build count and readiness hardware counts exclude those previous records. Current calculated route guidance is a separate read-only field; user notes cannot replace it. Runtime review/calculation fields are stripped before saving records. CSV/Text export carries review/calculation columns/text; procurement CSV now escapes quoted notes correctly.

Evidence: full unit 114 files / 1,525 tests passed before the final Planning/readiness-count adjustment; focused procurement/readiness 8/8 and plugin suite 32/32 passed afterward. New unit cases cover added membership, preserved orders/notes, reload, no duplicate IDs, excluded historic totals, matching legacy migration and removal. Final production browser 6/6 passed at 1440/390 across procurement, Fit Check and Portfolio: actual status/note edits, adding a distinct cable, retaining the prior order, new need-to-buy state, reload and real CSV download including escaped quotes/review/current basis. Final build/typecheck and eager guard passed at 493.3KB / 500KB; diff whitespace check passed. Initial typecheck caught a browser fixture passing an id to addCable (which generates its own id); corrected to the public store contract. Full browser suite was not rerun this phase.

Goal remains active. Procurement history no longer silently implies current fulfillment. Remaining audit includes actual travel/cable-arm and broader physical-model limitations, catalog provenance and electrical/current/transfer/thermal requirements, and final complete acceptance. No publication or hosted CI verification performed.


## Progress — explicit output-rating provenance

Fixed the undefined isRecord import guard that prevented type-checking. Output capacity references now preserve original watts, exact model/region, source and checked date through placement, reverse template conversion and JSON. Properties and device comparison expose the reference; edited ratings show a mismatch, and clearing the rating remains unknown without reference fallback. HTTP(S) sources are linked; other source strings remain text. Imported provenance is not independently authenticated.

Verified SCL500RM1U (120 V) against https://iportal.se.com/Contents/docs/SCL500RM1U_DATA%20SHEET.PDF on 2026-09-29: 400 W output, 500 VA, 232 mm depth, 4.18 kg. The pre-existing 8 W self-load is explicitly estimated; battery Wh stays unknown, without substituting the PDF's VAh field. No rating was copied from SMT or Gaming UPS regional/model variants. Existing saved devices are not silently catalog-updated.

Evidence: full Vitest 114 files / 1,526 tests passed; production build and eager budget 493.7KB / 500KB passed; focused production Playwright 7/7 (power reliability and desktop/mobile library comparison) passed. New browser case edits and clears the current rating, checks the source link and original reference, and verifies reload persistence. Its initial setup failed before device creation; corrected by waiting for shell readiness and providing sufficient rack depth, without weakening result assertions. Full browser and plugin suites were not rerun in this phase.

Goal remains active. UPS battery-backed versus surge-only socket behavior is still unmodeled and must be resolved across runtime/outage paths. Broader catalog provenance, physical/electrical/thermal limitations and final requirement-by-requirement acceptance remain incomplete. No publication or hosted CI verification performed.


## Progress — per-outlet UPS battery paths

Added optional UPS socket backup metadata (battery-backed or surge-only; omitted means unknown), import validation and the Socket specifications editor. The canonical port-face lookup resolves source sockets independently of cable endpoint order. Normal utility wiring remains intact. Runtime uses only recorded battery-backed output paths for battery load/shutdown groups while preserving total utility output load for rating checks. Unknown connected UPS outputs suppress runtime estimates and surface actionable Check warnings. A UPS with only self-load no longer displays a successful rack-runtime result. No manufacturer outlet numbering was guessed and no legacy layout was silently upgraded.

Outage and weak-battery scenarios share battery-only wired reachability, including downstream PDU paths and local/cross-rack PoE receivers. Remote UPS diagnostics remain present when normal wiring reaches the selected rack but backup is unknown or surge-only. Outlet-failure simulation retains its separate, explicit utility-source-live assumption. Transfer time, actual discharge curves, socket current and breaker behavior are not verified by backup-type declarations.

Tests cover mixed output types, reverse-selected sockets, missing ports/specs, face mismatch, JSON validation, separate utility/battery watts, shutdown membership, weak-battery runtime, immutable inputs and remote PoE backup exclusion. Existing runtime fixtures now explicitly declare their battery outputs instead of relying on an implicit all-UPS-outlets assumption. New browser flow edits unknown to battery-backed, reloads, then changes to surge-only and unknown and checks displayed load/eligibility. Focused production browser 11/11 passed before the final no-downstream presentation change. Full Vitest 115 files / 1,529 tests and plugin suite 7 files / 32 tests passed. Final production build and eager guard 494.7KB / 500KB passed. Full production browser regression is in progress; record its terminal outcome below.

Goal remains active pending full regression and requirement-by-requirement acceptance, including remaining provenance and physical-model limitations. No publication or hosted CI verification performed.

Final regression for per-outlet UPS backup: all 95 production Playwright tests passed, including both 3D viewers, mobile workflows, procurement, workspace backup, runtime edits and remote PoE scenarios. Full unit 1,529/1,529, plugins 32/32, build/typecheck, eager budget 494.7KB/500KB and diff whitespace checks passed. The initial build caught inferred union types in revised browser fixtures; explicitly typing those fixture racks fixed the test-source type errors. Remaining work is the broader completion audit and any findings it exposes; these results do not establish unmodeled real-world behavior.


## Acceptance audit finding — scenario confidence

The audit found that getOverallReadinessScore credited unknown assumptions as passes, even returning 100% for no assumptions. Replaced it with passed/total check coverage, separate passed/failed/unknown counts, zero for no checks, floor percentages and no good status while any item is unknown or failed. UI and actual downloaded reports share this basis and describe unflagged devices as model outcomes rather than verified survivors.

Heatwave review previously certified passive cooling from a heat score and claimed a 3–7 degree fan improvement without a thermal model. Removed those unsupported conclusions; cooling sufficiency remains unknown, heat scores prioritize review, and passive accessories no longer dilute the operational-device average. Weak-battery results now explicitly mean half recorded energy rather than measured battery health. Target checks require reviewed loads and known output ratings; known overload fails. Incomplete multi-UPS runtime is suppressed before rendering assumption details as well as the summary. Synthetic calculations no longer directly instruct battery replacement or imply priority labels execute shutdown.

Evidence: full Vitest 115 files / 1,531 tests passed before one final target-gating regression was added; final focused scenario suite 32/32 passed, including unknown ratings, unreviewed loads, known overload and incomplete multi-UPS details. Production build/typecheck and 494.7KB/500KB eager budget passed. Production browser 6/6 passed for desktop/mobile check coverage, actual report download assertions and cross-rack PoE scenario regression. No complete browser or plugin rerun in this phase; prior 95/95 browser and 32/32 plugin results predate these scenario changes.

Goal remains active. The audit has not yet established all remaining scenario conclusions: ISP/switch/NAS/AP/management presets still need source and result-level review (for example the management preset currently says other devices keep serving without verifying their service dependencies). Broader final requirement acceptance remains pending. No publishing or hosted CI verification performed.


## Acceptance audit finding — network and NAS scenario claims

Replaced switch-reboot use of the broad blast-radius traversal with a network-only, device-level before/after gateway-path comparison. It excludes power links and does not use multi-NIC endpoints as forwarding devices. Direct link loss is distinguished from a remaining alternate candidate path, and previously untraced devices are not declared working. The selected switch (highest network-link count) and unknown recovery time are explicit. This is not VLAN/protocol/patch-jack continuity verification.

NAS failure now follows cycle-safe transitive boot dependencies and explicit RackService host/storage references. Boot order is explained as restart risk rather than proof of a running-service outage. First-NAS selection is disclosed. Counts of NAS units no longer verify recoverability. ISP failover and local offline service continuity stay unknown despite modem counts or LTE/4G labels. The all-APs-offline preset no longer passes redundancy merely because multiple APs exist. IP-KVM presence no longer proves independent recovery access, and management loss no longer promises that other services keep serving. Guide and exported scenario content describe the represented scope.

Evidence: full Vitest 116 files / 1,535 tests passed; build/typecheck and eager guard 494.6KB/500KB passed; focused production browser 8/8 passed, including desktop/mobile alternate-path, NAS dependency, AP and management displays plus actual report download and remote PoE regression. New unit cases cover power-link exclusion, endpoint forwarding exclusion, alternate vs lost paths, transitive boot cycles, service-storage dependency propagation, immutability and metadata-only false passes. Full browser/plugin suites were not rerun in this phase.

Goal remains active. The audit also located the separate Blast Radius tool's legacy power adjacency in src/utils/blastRadius.ts: it still uses cable from/to order directly, unlike the canonical directed power model, and network traversal is broader than verified disruption. Scenario Planner no longer calls it, but its own exposed workflow still requires correction/verification. Final requirement-by-requirement acceptance remains pending; no publication or hosted CI verification performed.


## Acceptance audit finding — Blast Radius consistency

Blast Radius now uses the shared workspace wired/PoE supply-failure reachability model instead of cable from/to order. It reports only paths lost relative to the original live roots, preserves alternate feeds and separates previously untraced paths. Cross-rack PoE impacts and upstream supplies use rack-scoped identities; UI selection switches to the correct rack, even with repeated device IDs. Source removal explicitly means unavailable output, not utility loss with UPS battery operation.

Network records distinguish direct links and lost device-level gateway paths, retaining unknown associations for review when no gateway exists. Endpoints are not assumed to forward traffic. Boot records identify restart prerequisites. Removed silent three-hop network and five-hop power/boot truncation. Priority remains a disclosed weighted heuristic rather than a risk probability; UI no longer declares all listed records necessarily offline or isolated devices low risk. Network/boot scope remains selected-rack, while supply paths use workspace context.

Evidence: full Vitest 116 files / 1,538 tests passed before adding the final deep-chain regression; final focused Blast Radius suite 17/17 passed, including seven-hop supply/restart chains, reversed power selection, alternate feeds, conflicting supply metadata, remote PoE identity and upstream lookup. Plugin suite 7 files / 32 tests passed. Production build/typecheck and eager guard 494.6KB/500KB passed; final test-source typecheck and whitespace check passed. Focused production Playwright 6/6 passed for desktop/mobile navigation and existing PoE flows. Full production browser regression is running; append its terminal outcome below.

Goal remains active pending completion of the requirement-by-requirement evidence matrix and any remaining findings. No publication or hosted CI verification performed.

Final Blast Radius regression: full production Playwright 101/101 passed, including recent scenario confidence changes, both 3D viewers, mobile flows, workspace backups and cross-rack navigation. No active validation process remains from this phase. This is regression evidence; final completion still requires the explicit acceptance matrix.

## Final acceptance audit — 2026-09-29

The final audit removed a remaining assumed eight-outlet inventory for PDU records without a power-port count. Unknown total/free counts now stay unknown; the sparse outlet map retains only recorded socket assignments, and connected downstream load is retained even if socket inventory cannot be verified. Duplicate/invalid indices still produce issues; a missing count does not fabricate an eight-socket range limit. An explicit zero count remains distinct from missing data.

| Requirement | Implemented evidence | Acceptance evidence |
| --- | --- | --- |
| Shared socket selection and failure semantics | `powerOutlet.ts`, `powerChain.ts`, `portSelection.ts`, shared supply topology | Power-chain and port-selection tests cover reverse endpoints, legacy conflicts, duplicate sockets and alternate supply; production power reliability flow exercises surviving feed and overload. |
| Trustworthy planning power | `placedDeviceFromTemplate.ts`, power provenance/review fields, shared PoE projection and UPS assumptions | Power reliability, PoE and UPS browser tests cover editing, invalidation, reload and unknown data; calculation tests cover shared totals and battery-path eligibility. |
| Installation constraints | `installationChecks.ts`, shared Fit template conversion, serviceability checks | Installation/Fit browser cases cover desktop/mobile edits and stale-result clearing; utility tests cover measured rail spacing, shelf footprint and unknown requirements. |
| Connector compatibility | `connectorCompatibility.ts`, socket specifications editor, runtime import guards | Connector reliability browser and utility tests cover editing/reload, known conflict prevention and preservation of imported conflicts. |
| Actionable Check workflow | Check topic/severity controls, cable filtering, quantified recommendations | UX polish browser tests at 1440/1024/390 exercise health-to-issue-to-edit navigation. |
| Library discovery/comparison | Component library filters and comparison panel | Library comparison browser tests at desktop/mobile widths cover filters, clearing, focus and scrolling. |
| Connection usability | Face/type-specific availability and socket selection | Connector browser test verifies 24 front plus 24 rear patch-panel sockets; connection and mobile regressions passed. |
| Catalog dimensions/weight | JMCD 6U / 266.7mm consistency and two-decimal health weight | Catalog regression and RackHealthStrip tests; legacy placed layouts are preserved. This is not a manufacturer audit of every catalog entry. |
| Persistence/backup/recovery | Core workspace backup independent of Fleet; unreadable-data autosave pause | Workspace backup and recovery browser tests exercise actual downloads, import/reload, invalid files, quota failure and original-data recovery. |
| Shared models and regression | Canonical rack/port geometry, shared rendered cable measurement, CI gates | 2D/both-3D, dense route and procurement tests; full 101-case production browser run before the final outlet-count change; final focused results recorded below. |

Scope accepted: planning and simulation of represented, recorded constraints, with missing evidence explicitly unverified. Full physical certification, thermal/airflow simulation, protocol-level network failover, UPS hardware transfer behavior, breaker coordination and verified recovery from backups are not implemented guarantees. The interface and reports must retain these distinctions. Hosted CI and deployment have not been run or published from this work.


Final validation: 116 Vitest files / 1,541 tests passed; plugin suite 7 files / 32 tests passed; production build and eager budget passed at 495.1KB / 500KB. Final focused production browser suite passed 7/7, including the new 1440px and 390px unknown-inventory checks. The first mobile attempt omitted the existing Check issues drawer interaction; the corrected test follows that visible path. Full production browser 101/101 evidence predates the final outlet-count change; it was not rerun afterward. Final typecheck and whitespace validation passed. No deployment, hosted CI run or hardware validation is claimed.

All ten reviewed requirements have implementation and validation evidence above. Remaining physical limitations are explicit product boundaries, not passing checks or promised capabilities. The reviewed implementation goal is complete within that scope.

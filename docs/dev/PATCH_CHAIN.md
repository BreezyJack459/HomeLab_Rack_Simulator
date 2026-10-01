# A–B patch chain and panel routing tidy

Cable → Connect A–B selects final same-rack Ethernet devices/sockets, then a direct path or one/two passive patch panels. Up to five deterministic candidates show each new planned physical segment, unchanged existing cable, and same-jack front/rear continuity. Internal continuity creates no cable record or BOM item. Switch ports are endpoints, never passive transit. Network configuration, VLANs, protocol support and actual connectors remain unverified.

Socket identity includes rack, device, type, canonical face and index. Legacy panel claims lacking a face conservatively occupy both faces. Reservations and inter-rack claims are checked. Occupied sockets may only traverse their existing physical link. Panels must be distinct; each topology has at most two internal hops and three physical links, so cycles cannot recurse. Search visits existing claims first and is capped at 16,000 topologies and 128 jacks per panel; a bounded-search message is shown. The best 24 graph candidates are refined through the existing Clean/Realistic route engine before returning six previews; blocked geometry is shown without a length estimate. This bounds preview cost and does not guarantee globally optimal routing. Candidate order favors fully connected paths, existing links, fewer new segments, fewer unknown specifications, estimated length, then stable socket indices. Known non-RJ45 media/connector constraints are rejected in this first copper Ethernet workflow; speed differences do not establish physical incompatibility.

Confirmation revalidates the exact candidate against current socket/spec/reservation/geometry/cable/inter-rack data. A stale or invalid preview makes no layout mutation. One immutable store mutation appends only missing segments and gives one undo/redo step. Repeated confirmation and a reloaded fully existing path add no duplicates. Existing physical records, purchased/measured lengths, labels, IDs and status are preserved. Each new record is `planned`; estimates and purchase recommendations come from the existing per-segment routing/BOM pipeline, without writing an actual purchased length.

## Explicit installation intent

`CableRoute.installationRole` is optional:

- `patch-cord`: Ethernet/patch cable with Ethernet sockets, using front sockets on every involved panel. An endpoint such as a server may explicitly use a front patch cord. This supports Server → P1 front #3 → P1 rear #3 → existing rear #3/#7 backbone → P2 front #7 → Switch.
- `permanent-link`: structured cable with at least one panel, using rear panel sockets; switch termination is not permitted.

Omitted intent preserves the existing model and its findings: ordinary endpoints belong on panel rear, switches on front, and inferred patch cables connect panel and switch. The planner does not rewrite old roles. Explicit malformed or contradictory intent is rejected by store writes and import/backup restore and reported by validation. The additive fields pass through JSON export, clone/history, workspace backup and migration using existing record-preserving paths. Manual creation retains its existing inference; recorded explicit intent is visible in cable details.

## 整理走線 / routing only

Select a panel and press Tidy panel routes. Only that panel's physical cable routes are eligible. User manual paths are preserved; automated tidy anchors are identified by optional `routingOrigin: 'panel-tidy'`. Socket IDs, indices, faces, labels, status, physical length and connectivity are never changed. The retained bounded settling engine compares current, direct and channel routes for up to 128 panel cables and 32 passes, requiring feasibility in both Clean and Realistic styles. It reduces projected crossings, then rendered length. If it cannot settle, the entire tidy is rejected. It is not a global optimum or a guarantee of crossing-free installation. Missing/blocked routes are reported and preserved. One immutable store mutation gives one undo. Length requirements/BOM follow geometry without overwriting purchased lengths.

The existing manual connection/drawing flows, rendering face conventions and physical routing engine are retained. Cross-rack planning, fiber/breakout, automatic A/B power and device replacement are outside this feature.

# Transfer Follow-up

## Current State (2026-05-06)

This repo is not currently inside a git worktree, so transfer review was done by inspecting the local files directly.

Completed follow-up from the Game Studio review:
- Lazy-loaded 3D surfaces keep Three.js out of the initial app path; latest observed build produced ~357KB initial JS and a ~963KB lazy 3D chunk.
- Vitest is installed and `npm test` runs the source regression suite.
- Cable route recompute is incremental for `moveDevice`, `updateDevice`, and `removeDevice`.
- History subscriber errors are logged instead of silently swallowed.
- WebGL context restore remounts the Canvas through `recoveryKey`.
- Hidden 0U PDU cleanup is feature-gated through `ENABLE_ZERO_U_PDU = false`; loaded layouts are sanitized and now select the first normalized visible device.

## Files Updated In This Transfer Pass

- `src/store/rackStore.ts` — fixed selected device state after normalized layout cleanup.
- `src/store/rackStore.test.ts` — added regression coverage for hidden 0U PDU cleanup selection.
- `CLAUDE.md` — replaced stale testing guidance and added transfer status.
- `DECISIONS.md` — added ADR-014 for hidden 0U PDU gating and cleanup.
- `TASKS.md`, `NEXT_STEPS.md`, `KNOWN_ISSUES.md` — synchronized completed work and remaining priorities.
- `game-studio-code-review.md` — updated the original review report so it reflects completed fixes instead of old gaps.

## Open Follow-up

1. Add Playwright smoke specs for load app, switch views, add device/cable, and JSON import/export.
2. Add a bundle budget guard so accidental eager Three.js imports fail early.
3. Redesign 0U PDU 3D display as separate physical anchor plus optional inspection proxy before re-enabling it.
4. Profile 3D port labels on dense 48-port and multi-device scenes before adding more label-heavy features.

## Validation Commands

Run these before handing off another implementation pass:

```bash
npm test
npm run build
```

`npm run lint` exists, but it depends on ESLint being installed/configured. Treat lint as optional until that gate is made real.

Latest local validation from this transfer pass:
- `npm test` passed: 4 files, 57 tests.
- `npm run build` passed. Vite still reported the expected chunk-size warning for the lazy 3D chunk.

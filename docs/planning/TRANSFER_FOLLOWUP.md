# Transfer Follow-up

## Current State (2026-05-18)

This repo has moved well beyond the original 2026-05-06 transfer scope. Most of the earlier follow-up items are now implemented and should no longer be treated as active transfer work.

Latest local verification:
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `npm test -- --pool=threads` — passed (`62` files / `979` tests).
- `npm run build` — passed.
- `node scripts/check-bundle-size.mjs` — passed: current `index-*.js` is `213.3KB`, under the `250KB` initial-chunk limit.

Stable completed areas that no longer belong in active transfer follow-up:
- Playwright smoke coverage exists.
- Bundle budget guard exists, is a real gate, and is back in compliance after moving `ComponentLibrary`, sample-layout loading, and exporter helpers off the eager app path.
- Cable preview / 3D port-picking / planning workflow follow-up is shipped.
- Scenario planner, capacity forecast, service map, failure domains, drift detection, and many other roadmap items have shipped since the original transfer notes.

## Active Follow-up

1. **Housekeeping pass on planning/handoff docs**
   - Remove already-completed work from active next-step sections.
   - Keep `TASKS.md`, transfer notes, and current handoff docs aligned with the real repo state.

2. **Keep 0U PDU 3D redesign deferred**
   - `ENABLE_ZERO_U_PDU = false` remains the correct product stance.
   - Resume only when the team is ready to handle physical-anchor vs inspection-proxy rendering as one coherent redesign.

3. **Protect the restored bundle budget**
   - Re-run `node scripts/check-bundle-size.mjs` after new toolbar actions, shared utilities, or always-mounted UI are added.
   - Treat new static imports in `App.tsx` as bundle-sensitive by default.

## Validation Commands

Use these before handing off another implementation pass:

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test -- --pool=threads
npm run build
node scripts/check-bundle-size.mjs
```

`npm run lint` still depends on ESLint being fully configured, so it remains optional until that gate is made real.

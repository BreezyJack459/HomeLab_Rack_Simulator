# Transfer Follow-up

## Current State (2026-05-18)

This repo has moved well beyond the original 2026-05-06 transfer scope. Most of the earlier follow-up items are now implemented and should no longer be treated as active transfer work.

The newest local app state is the V2 shell-first rewrite baseline:
- `App.tsx` is now a workspace shell orchestrator instead of a single monolithic right-panel mount list.
- Primary navigation is organized around `Model`, `Operate`, `Audit`, `Plan`, and `Portfolio`.
- Audit now has a dedicated `AuditWorkbench` with lens-based routing instead of relying on a permanently expanded validation tail panel.
- The right inspector is context-sensitive and no longer renders the full panel inventory at once.

Latest local verification:
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `npm test -- --pool=threads` — passed (`62` files / `979` tests).
- `npm run build` — passed.
- `node scripts/check-bundle-size.mjs` — passed: current `index-*.js` is `224.1KB`, under the `250KB` initial-chunk limit.
- `npx playwright test tests/smoke/app.spec.ts` — blocked locally because `@playwright/test` is missing from the environment (`ERR_MODULE_NOT_FOUND` while loading `playwright.config.ts`).

Stable completed areas that no longer belong in active transfer follow-up:
- Playwright smoke coverage exists.
- Bundle budget guard exists, is a real gate, and is back in compliance after moving `ComponentLibrary`, sample-layout loading, and exporter helpers off the eager app path.
- Cable preview / 3D port-picking / planning workflow follow-up is shipped.
- Scenario planner, capacity forecast, service map, failure domains, drift detection, and many other roadmap items have shipped since the original transfer notes.
- Shell-first app navigation, contextual inspector routing, workspace quick-open, and Audit workbench scaffolding are now implemented locally.

## Active Follow-up

1. **Phase 3 workspace consolidation**
   - Continue the V2 rewrite by reshaping `Operate` and `Plan` from panel buckets into clearer list/detail and timeline/comparison workflows.
   - Keep the current shell state, panel registry, and lazy-loading strategy intact while moving more logic out of the old monolithic `App.tsx` flow.

2. **Restore Playwright as a real handoff gate**
   - The smoke suite exists, but the local environment currently cannot execute it because `@playwright/test` is unavailable.
   - The next implementation pass should either restore the dependency locally or document a canonical smoke environment so handoffs stop ending with an unverifiable E2E gap.

3. **Keep 0U PDU 3D redesign deferred**
   - `ENABLE_ZERO_U_PDU = false` remains the correct product stance.
   - Resume only when the team is ready to handle physical-anchor vs inspection-proxy rendering as one coherent redesign.

4. **Protect the restored bundle budget**
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

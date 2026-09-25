# Next steps

Reviewed 2026-09-18. These are proposed follow-ups, not authorization to implement them. Current implementation status is in [TASKS](../planning/TASKS.md); previous recommendations are [archived](../archive/2026-09-18-doc-refresh/dev/NEXT_STEPS.md).

1. **Establish release evidence.** Run unit/plugin/browser tests, build and eager bundle guard on the intended revision. Record failures separately from passing focused checks and refresh UI screenshots deliberately.
2. **Review plugin preference migration.** The current migration adds missing workspace packs to every saved enabled-ID list on startup. Decide how to preserve a user's explicit disable choice without removing legacy access.
3. **Clarify cable estimate presentation.** Automatic 3D candidates and automatic 2D/BOM calculations remain distinct. Any unification needs routing and obstruction tests; keep the distinction visible until then.
4. **Complete unresolved catalog evidence.** Resolve model/configuration-specific power and weight values from the dated audit. Avoid replacing saved user values without an explicit migration design.
5. **Evaluate release gating.** CI and deployment are separate; decide whether browser/plugin/bundle checks should gate publishing.

CAD/STL import/generation, live backend synchronization and automatic rack optimization remain separate product proposals. Schematic printed mounts, workspace JSON and existing heuristics do not imply those features are delivered.

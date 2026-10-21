# Next steps

Reviewed 2026-10-21 against `main` `c0d2038`. These are proposed follow-ups, not authorization to implement them. Current implementation status is in [TASKS](../planning/TASKS.md); previous recommendations are [archived](../archive/2026-09-18-doc-refresh/dev/NEXT_STEPS.md).

The 2026-09-18 items to preserve an explicit plugin-disable choice, and to decide whether browser, plugin and bundle checks should gate publishing, are already in the tree. Saved enabled-plugin lists stay as stored, and GitHub Pages publishes the Node 22 production artifact only after CI succeeds. Purchase length now uses the longer Clean/Realistic centreline plus one installation allowance; the on-screen centreline for the current style still excludes that slack, and that distinction is documented in the user guide.

1. **Keep release notes tied to a CI run.** This documentation pass did not attach a new test log or bundle measurement. When publishing a revision note, cite the workflow run instead of copying historical pass counts.
2. **Refresh screenshots with the UI.** `node scripts/capture-docs.mjs` rewrites `docs/images/` from a running dev server. Review the images before replacing published captions. The 2026-10-21 set matches Rack Studio at `c0d2038`.
3. **Complete unresolved catalog evidence.** Resolve model/configuration-specific power and weight values from the dated audit. Avoid replacing saved user values without an explicit migration design.

CAD/STL import/generation, live backend synchronization and automatic rack optimization remain separate product proposals. Schematic printed mounts, workspace JSON and existing heuristics do not imply those features are delivered.

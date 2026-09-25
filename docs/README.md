# Documentation index

Current guides were reconciled with the working tree on **2026-09-18**. Local changes may be ahead of the deployed demo. Historical records retain their original evidence and have explicit status notices; they are not current release instructions.

## Start and use the app

| Document | Purpose |
|---|---|
| [Project README](../README.md) | English overview, setup, capabilities and deployment |
| [繁體中文 README](README.zh-Hant.md) | Traditional Chinese overview and setup |
| [User guide](USER_GUIDE.md) / [繁體中文使用指南](USER_GUIDE.zh-Hant.md) | Build/Cable/Check, inventory, shelves, mounts, route drawing, tools and recovery |
| [Screenshot tour](SCREENSHOTS.md) | Current feature screenshots, example context and refresh instructions |
| [0U PDU guide](0U_PDU.zh-Hant.md) | Physical mounting and inspection controls |
| [Device specification audit](DEVICE_SPEC_AUDIT.zh-Hant.md) | Dated manufacturer-source evidence and unresolved/custom values; not re-researched in this refresh |

## Develop and maintain

| Document | Purpose |
|---|---|
| [Project context](../PROJECT_CONTEXT.md) | Short orientation and ownership map |
| [Architecture](dev/ARCHITECTURE.md) | State, geometry, routing, plugins, lazy loading and persistence |
| [Development](dev/DEVELOPMENT.md) | Commands, checks, CI, screenshots and deployment |
| [Architecture decisions](dev/DECISIONS.md) | Rationale, current amendments and superseded decisions |
| [Known limitations](dev/KNOWN_ISSUES.md) | Source-backed limitations and outstanding release verification |
| [Implementation status](planning/TASKS.md) | Current areas with source/test entry points |
| [Next steps](dev/NEXT_STEPS.md) | Proposed follow-ups, not automatic implementation authorization |
| [Workspace organization](design/workspace-organization.md) | Current navigation, inventory, placement feedback and drawers |
| [0U physical model](0u-pdu-3d-positioning.md) | Shared geometry, physical fields and legacy fallback |
| [Faceplate assets](../public/faceplates/README.md) | Pipeline context and retained attribution |
| [Agent rules](../AGENTS.md) / [Claude pointer](../CLAUDE.md) | Coding and operating instructions |

Agent configuration directories stay at their existing repository locations; this refresh does not reorganize them.

## Historical evidence and proposals

- [Earlier code review](dev/CODE_REVIEW.md) and [Game Studio review](design/game-studio-code-review.md): original findings; recheck against current code.
- [Cable endpoint fix](cable-endpoint-routing-fix.md): historical diagnosis; shared geometry ownership has since evolved.
- [4-zone proposal](4zone-display-option.md) and [brainstorm](planning/BRAINSTORM.md): design ideas, not promises of shipped functionality.
- [Plugin design](superpowers/specs/2026-06-21-plugin-platform-design.md) and [phase-one plan](superpowers/plans/2026-06-21-plugin-platform-phase-1.md): original platform design, predating current lazy-pack loading.
- [Auto-wire design](superpowers/specs/2026-06-12-auto-wire-cables-design.md) and [plan](superpowers/plans/2026-06-12-auto-wire-cables.md): dated proposal/implementation context.
- [Port-layout design](superpowers/specs/2026-06-12-port-layout-realism-design.md), [reuse-first revision](superpowers/specs/2026-06-13-port-layout-realism-design-v3-reuse-first.md) and [plan](superpowers/plans/2026-06-13-port-layout-realism-v3-plan.md): original port/faceplate work.
- [Archive index](archive/README.md): prior handoffs, plans, source references and the pre-refresh status ledgers.

Current walkthrough images are in [the screenshot tour](SCREENSHOTS.md), backed by `docs/images/`. Older images and HTML mockups in `docs/design/` and `artifacts/` are retained visual evidence. A filename or screenshot does not establish current behavior or a passing test result.

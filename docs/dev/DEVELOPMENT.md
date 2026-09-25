# Development and validation

Reviewed against repository configuration on 2026-09-18. Commands run from the repository root.

## Local development

```bash
npm ci
npm run dev
```

CI specifies Node 20.x and 22.x. Use an environment compatible with `package-lock.json`; `npm ci` installs the recorded dependencies without rewriting the lockfile.

The app URL is `http://127.0.0.1:5173/HomeLab_Rack_Simulator/`. `vite.config.ts` binds `0.0.0.0:5173` with `strictPort: true`; an occupied port is an error. `npm run dev:lan` makes the LAN binding explicit. The server is intended for local/trusted-LAN development. Browsers on other devices do not share localStorage.

## Checks by change

| Change | Validation |
|---|---|
| Documentation | Check local links, paths, commands and claims against source; runtime tests can be skipped. |
| Store, placement, ports or routing | Run the relevant Vitest files; extend coverage for changed invariants. |
| Plugin host or contributions | Run focused tests and `npm run test:plugins`. |
| User workflow | Run the relevant Playwright spec; check desktop and narrow-screen behavior when affected. |
| 3D, imports or bundle | Also run `npm run build` and `node scripts/check-bundle-size.mjs`. |

```bash
npm test
npx vitest run src/store/rackStore.test.ts
npx vitest run src/utils/rackSceneModel.test.ts tests/managedCable3D.test.ts
npm run test:plugins
npx playwright install chromium
npx playwright test
npx playwright test tests/smoke/layout-recovery.spec.ts
npm run build
node scripts/check-bundle-size.mjs
```

The default Vitest config includes source/component/store/integration tests and a separate importer test project. The plugin configuration is a focused subset, not a replacement for all tests. Playwright uses Chromium, one worker and a dev-server fixture; outside CI it can reuse an existing server.

Browser specs cover shell/plugin menus and loading, placement, shelves, printed mounts, 0U PDUs, custom/rear routes, topology, property editing, inter-rack links, recovery and 3D inspection, alongside general app/workspace flows. Presence of a test is not evidence that it passed on a particular revision. Record command, scope and final exit status when reporting validation.

## Build and screenshots

```bash
npm run build
npm run preview
```

The bundle guard counts uncompressed entry scripts plus every modulepreload in `dist/index.html`, with a 500 KB limit. Large lazy chunks can emit Vite warnings without counting toward that eager limit. Only measure a freshly built `dist/`; do not reuse old size claims.

For README and guide screenshots, start the dev server and run `node scripts/capture-docs.mjs`. It writes isolated example captures and metadata into `docs/images/`; see the [visual tour](../SCREENSHOTS.md). This is separate from the regression screenshot artifacts.

Start `npm run dev` before `npm run smoke:cables`. This script regenerates screenshot artifacts; review the images before including them in docs. Dense scene fixtures can be regenerated with `node scripts/gen-dense-layout.mjs` when intentionally updating performance inputs. Avoid incidental generated-file changes during ordinary documentation edits.

## Source conventions

Use function declarations for React components, strict TypeScript and type imports, existing Tailwind semantic tokens, and store actions for all layout changes. `AGENTS.md` provides the full operating rules. New template fields must survive `templateToDevice()`; non-trivial ports need shared-layout tests and checks in both 2D and 3D.

## CI and hosting

`.github/workflows/ci.yml` runs `npm ci`, `npm test` and `npm run build` on Node 20.x and 22.x. It does not currently run Playwright, the separate plugin command or the bundle guard explicitly.

`.github/workflows/deploy.yml` separately builds on Node 20 and publishes `dist/` to GitHub Pages on pushes to `main` or manual dispatch. It does not wait for the CI workflow as a deployment gate. The configured base is `/HomeLab_Rack_Simulator/`; change Vite's base for another hosting path. There is no application server to deploy.

## Shell diagnostics

The redesigned shell is the default. To reproduce classic chrome, set `localStorage["rack-simulator-new-shell"] = "0"` in that browser and reload. Remove the key to restore default behavior. Test saved plugin preferences separately from a clean browser because migration adds workspace packs to existing preference lists.

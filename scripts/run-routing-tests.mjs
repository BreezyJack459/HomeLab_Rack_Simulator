import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'node_modules/.tmp/routing.test.mjs');

await mkdir(dirname(outFile), { recursive: true });
await build({
  entryPoints: [resolve(root, 'tests/routing.test.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: 'inline',
  external: ['node:test', 'node:assert/strict']
});

await import(outFile);
await rm(outFile, { force: true });

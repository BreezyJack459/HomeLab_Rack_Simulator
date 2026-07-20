#!/usr/bin/env node
/**
 * Bundle Budget Guard — Eager Payload
 *
 * Measures the true eager JS payload of the built app: the entry
 * `<script type="module">` file plus every `<link rel="modulepreload">`
 * file referenced by dist/index.html. Everything else (Three.js, R3F,
 * lazy viewers) is loaded on demand and does not count against this budget.
 *
 * This catches accidental eager imports of heavy libraries (e.g. Three.js)
 * that a single-file check would miss when the weight hides in a
 * preloaded vendor chunk.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *
 * Exit codes:
 *   0 – within budget
 *   1 – exceeds budget or dist missing
 */

import { readFileSync, statSync } from 'fs';
import { join } from 'path';

const BUDGET_KB = 500; // total eager JS budget (pre-gzip)
const DIST = 'dist';
const DIST_ASSETS = 'dist/assets';

function getSizeKB(filePath) {
  return statSync(filePath).size / 1024;
}

function formatSize(sizeKB) {
  return `${sizeKB.toFixed(1)}KB`;
}

function main() {
  let html;
  try {
    html = readFileSync(join(DIST, 'index.html'), 'utf8');
  } catch (err) {
    console.error(`❌ Cannot read ${DIST}/index.html. Run "npm run build" first.`);
    process.exit(1);
  }

  const eagerFiles = new Set();

  // Entry script: <script type="module" ... src="...">
  for (const match of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) {
    eagerFiles.add(match[1]);
  }

  // Preloaded chunks: <link rel="modulepreload" ... href="...">
  for (const match of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) {
    eagerFiles.add(match[1]);
  }

  if (eagerFiles.size === 0) {
    console.error('❌ No entry script or modulepreload links found in dist/index.html.');
    process.exit(1);
  }

  let totalKB = 0;
  const breakdown = [];

  for (const href of eagerFiles) {
    // hrefs may carry the configured base path (e.g. /HomeLab_Rack_Simulator/assets/…);
    // resolve them against dist/ and only count local asset files.
    const fileName = href.replace(/^\//, '').split('/').pop();
    const filePath = join(DIST_ASSETS, fileName);
    let sizeKB;
    try {
      sizeKB = getSizeKB(filePath);
    } catch (err) {
      console.error(`❌ Referenced file not found: ${href} (looked for ${filePath})`);
      process.exit(1);
    }
    totalKB += sizeKB;
    breakdown.push({ fileName, sizeKB });
  }

  breakdown.sort((a, b) => b.sizeKB - a.sizeKB);
  console.log('Eager JS payload (from dist/index.html):');
  for (const { fileName, sizeKB } of breakdown) {
    console.log(`  ${fileName}: ${formatSize(sizeKB)}`);
  }
  console.log(`  Total: ${formatSize(totalKB)} (budget: ${BUDGET_KB}KB)`);

  if (totalKB > BUDGET_KB) {
    console.error(
      `\n❌ BUDGET EXCEEDED: eager payload is ${formatSize(totalKB)} (limit: ${BUDGET_KB}KB)`
    );
    console.error(
      '   Hint: check for accidental static imports of three / @react-three/* in App.tsx or main.tsx'
    );
    process.exit(1);
  }

  console.log(`\n✅ Eager bundle budget check passed.`);
}

main();

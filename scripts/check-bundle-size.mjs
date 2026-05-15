#!/usr/bin/env node
/**
 * Bundle Budget Guard
 *
 * Checks that the initial JS chunk (index-*.js) does not exceed the agreed
 * budget.  This prevents accidental eager imports of heavy libraries such as
 * Three.js from bloating the first-load bundle.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *
 * Exit codes:
 *   0 – within budget
 *   1 – exceeds budget or dist missing
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUDGET_KB = 250; // agreed initial-chunk budget (pre-gzip)
const DIST_ASSETS = 'dist/assets';

function getSizeKB(filePath) {
  const bytes = statSync(filePath).size;
  return bytes / 1024;
}

function formatSize(sizeKB) {
  return `${sizeKB.toFixed(1)}KB`;
}

function main() {
  let files;
  try {
    files = readdirSync(DIST_ASSETS);
  } catch (err) {
    console.error(`❌ Cannot read ${DIST_ASSETS}. Run "npm run build" first.`);
    process.exit(1);
  }

  const indexFiles = files.filter((name) => /^index-.*\.js$/.test(name));

  if (indexFiles.length === 0) {
    console.error(`❌ No index-*.js found in ${DIST_ASSETS}.`);
    process.exit(1);
  }

  let failed = false;

  for (const name of indexFiles) {
    const filePath = join(DIST_ASSETS, name);
    const sizeKB = getSizeKB(filePath);

    if (sizeKB > BUDGET_KB) {
      console.error(
        `❌ BUDGET EXCEEDED: ${name} is ${formatSize(sizeKB)} (limit: ${BUDGET_KB}KB)`
      );
      console.error(
        `   Hint: check for accidental static imports of three / @react-three/* in App.tsx or main.tsx`
      );
      failed = true;
    } else {
      console.log(`✅ ${name}: ${formatSize(sizeKB)} (limit: ${BUDGET_KB}KB)`);
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(`\n✅ Bundle budget check passed.`);
}

main();

#!/usr/bin/env node
/**
 * One-off codemod: migrate hard-coded Tailwind palette classes
 * (slate / cyan / white / black) to semantic theme tokens
 * (content / surface / fill / edge / accent) defined in tailwind.config.js.
 *
 * - Variant prefixes (dark:, hover:, focus:, sm:, ...) are preserved.
 * - Alpha suffixes (/10, /82, ...) are preserved.
 * - Two mapping tables: BASE for bare classes, DARK for dark:-prefixed ones,
 *   so each side of a `X dark:Y` pair maps independently and faithfully.
 * - Classes intentionally kept (mid-grays, overlays, gradients to white)
 *   are simply absent from the tables and pass through unchanged.
 * - A dedupe pass collapses `token dark:token` into `token`.
 *
 * Usage: node scripts/codemod-theme-tokens.mjs [--dry-run]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = new URL('../src', import.meta.url).pathname;
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

// ── Mapping tables ──────────────────────────────────────────────
// Key: `<util>-<color>-<shade>` (or `<util>-<color>` for white/black).
// Value: token core class, e.g. `text-content-muted`. Alpha is re-appended.

const CYAN_ALL_TO_ACCENT = {
  'cyan-50': 'accent-subtle', 'cyan-100': 'accent-subtle', 'cyan-200': 'accent-subtle',
  'cyan-800': 'accent-subtle', 'cyan-900': 'accent-subtle', 'cyan-950': 'accent-subtle',
};

const BASE = {
  text: {
    'slate-900': 'content', 'slate-800': 'content', 'slate-950': 'content',
    'slate-700': 'content-secondary', 'slate-600': 'content-secondary',
    'slate-500': 'content-muted',
    'slate-400': 'content-faint', 'slate-300': 'content-faint',
    // slate-50/100/200 kept (dark-intent text on always-dark surfaces)
    'cyan-950': 'accent-fg-strong', 'cyan-900': 'accent-fg-strong',
    'cyan-800': 'accent-fg-strong', 'cyan-100': 'accent-fg-strong', 'cyan-50': 'accent-fg-strong',
    'cyan-700': 'accent-fg', 'cyan-300': 'accent-fg', 'cyan-200': 'accent-fg',
    'cyan-600': 'accent', 'cyan-500': 'accent', 'cyan-400': 'accent',
    white: 'content',
  },
  bg: {
    white: 'surface',
    'slate-50': 'fill-subtle', 'slate-100': 'fill', 'slate-200': 'fill-strong',
    'slate-700': 'fill-strong', 'slate-800': 'fill',
    'slate-900': 'surface-raised', 'slate-950': 'surface',
    'slate-500': 'content-muted',
    'cyan-300': 'accent', 'cyan-400': 'accent',
    'cyan-500': 'accent-solid', 'cyan-600': 'accent-solid',
    'cyan-700': 'accent-solid-hover',
    ...CYAN_ALL_TO_ACCENT,
    // kept: slate-300, slate-400, slate-600, black
  },
  border: {
    'slate-100': 'edge', 'slate-200': 'edge', 'slate-300': 'edge-strong',
    'slate-500': 'content-muted',
    'slate-700': 'edge-strong', 'slate-800': 'edge',
    'cyan-200': 'accent', 'cyan-300': 'accent', 'cyan-400': 'accent',
    'cyan-500': 'accent', 'cyan-600': 'accent', 'cyan-700': 'accent', 'cyan-800': 'accent',
    // kept: slate-400, slate-600, white, black
  },
  ring: {
    'slate-700': 'edge-strong',
    'cyan-300': 'accent', 'cyan-400': 'accent', 'cyan-500': 'accent', 'cyan-600': 'accent',
  },
  divide: {
    'slate-200': 'edge', 'slate-700': 'edge-strong', 'slate-800': 'edge',
  },
  from: gradientTable(), via: gradientTable(), to: gradientTable(),
  placeholder: {
    'slate-400': 'content-faint', 'slate-500': 'content-muted', 'slate-600': 'content-muted',
  },
  shadow: {
    'cyan-300': 'accent', 'cyan-400': 'accent', 'cyan-500': 'accent', 'cyan-600': 'accent',
  },
  fill: {}, stroke: {}, decoration: {},
};

const DARK = {
  text: {
    white: 'content',
    'slate-100': 'content', 'slate-200': 'content',
    'slate-800': 'content', 'slate-900': 'content',
    'slate-950': 'accent-on',
    'slate-300': 'content-secondary',
    'slate-400': 'content-muted',
    'slate-500': 'content-faint', 'slate-600': 'content-faint', 'slate-700': 'content-faint',
    'cyan-50': 'accent-fg-strong', 'cyan-100': 'accent-fg-strong',
    'cyan-200': 'accent-fg', 'cyan-300': 'accent-fg',
    'cyan-400': 'accent', 'cyan-500': 'accent', 'cyan-600': 'accent', 'cyan-700': 'accent',
  },
  bg: {
    'slate-950': 'surface', 'slate-900': 'surface-raised',
    'slate-800': 'fill', 'slate-700': 'fill-strong',
    'slate-500': 'content-muted',
    'cyan-300': 'accent', 'cyan-400': 'accent', 'cyan-500': 'accent',
    'cyan-900': 'accent-subtle', 'cyan-950': 'accent-subtle',
    // kept: slate-600, slate-400, white, black
  },
  border: {
    'slate-900': 'edge', 'slate-800': 'edge', 'slate-700': 'edge-strong',
    'cyan-100': 'accent', 'cyan-200': 'accent', 'cyan-300': 'accent',
    'cyan-400': 'accent', 'cyan-500': 'accent', 'cyan-700': 'accent',
    'cyan-900': 'accent',
  },
  ring: {
    'cyan-300': 'accent', 'cyan-500': 'accent',
  },
  divide: {
    'slate-800': 'edge', 'slate-700': 'edge-strong',
  },
  from: gradientTable(), via: gradientTable(), to: gradientTable(),
  placeholder: {
    'slate-500': 'content-muted', 'slate-600': 'content-muted',
  },
  shadow: {
    'cyan-500': 'accent',
  },
  fill: {}, stroke: {}, decoration: {},
};

function gradientTable() {
  return {
    'slate-50': 'fill-subtle', 'slate-100': 'fill', 'slate-200': 'fill-strong',
    'slate-800': 'fill', 'slate-900': 'surface-raised', 'slate-950': 'surface',
    'cyan-500': 'accent', 'cyan-400': 'accent',
    // white gradient stops kept (scroll fades)
  };
}

// ── Replacement engine ──────────────────────────────────────────

const CLASS_RE =
  /(?<![\w/-])(?<variants>(?:[a-zA-Z-]+:)*)(?<util>bg|text|border|ring|divide|from|via|to|placeholder|fill|stroke|shadow|decoration)-(?<color>slate|cyan|white|black)(?:-(?<shade>\d{2,3}))?(?<alpha>\/\d+)?/g;

function migrate(source) {
  let count = 0;
  const out = source.replace(CLASS_RE, (match, variants, util, color, shade, alpha) => {
    const table = variants.includes('dark:') ? DARK : BASE;
    const utilTable = table[util];
    if (!utilTable) return match;
    const key = shade ? `${color}-${shade}` : color;
    const token = utilTable[key];
    if (!token) return match;
    count += 1;
    return `${variants}${util}-${token}${alpha ?? ''}`;
  });
  return { out, count };
}

function dedupe(source) {
  let count = 0;
  // `token dark:token` → `token`
  let out = source.replace(
    /\b(?<tok>[a-z][\w-]*(?:\/\d+)?) dark:\k<tok>\b/g,
    (m, tok) => {
      if (!/content|surface|fill|edge|accent/.test(tok)) return m;
      count += 1;
      return tok;
    },
  );
  // adjacent exact duplicates of a migrated token → one
  out = out.replace(
    /\b(?<tok>[a-z][\w-]*(?:\/\d+)?) \k<tok>\b/g,
    (m, tok) => {
      if (!/content|surface|fill|edge|accent/.test(tok)) return m;
      count += 1;
      return tok;
    },
  );
  return { out, count };
}

// ── File walk ───────────────────────────────────────────────────

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) yield path;
  }
}

let totalReplaced = 0;
let totalDeduped = 0;
let filesChanged = 0;

for (const file of walk(ROOT)) {
  const source = readFileSync(file, 'utf8');
  const { out: migrated, count } = migrate(source);
  const { out: deduped, count: dd } = dedupe(migrated);
  if (deduped !== source) {
    filesChanged += 1;
    totalReplaced += count;
    totalDeduped += dd;
    if (!DRY_RUN) writeFileSync(file, deduped);
    console.log(`${DRY_RUN ? '[dry] ' : ''}${file}: ${count} replaced, ${dd} deduped`);
  }
}

console.log(
  `\n${DRY_RUN ? '[dry-run] ' : ''}Done: ${totalReplaced} classes migrated, ` +
  `${totalDeduped} duplicates collapsed, ${filesChanged} files changed.`,
);

/**
 * One-shot migration script: rewrites hardcoded design values in webview
 * components to design-system tokens. Idempotent — safe to re-run.
 *
 * Transforms applied, in order:
 *   1. Exact-match single-value spacing (`padding: 8px;` → `padding: var(--jc-space-md);`).
 *   2. Off-scale single-value spacing rounded to nearest token
 *      (6→md, 10→lg, 14→xl, 18→xl, 20→2xl).
 *   3. Multi-value shorthand where every value is on-scale
 *      (`padding: 8px 12px;` → `padding: var(--jc-space-md) var(--jc-space-lg);`).
 *   4. Transition duration shorthand (150ms ease / 200ms ease) — already
 *      covered by earlier sweep, kept idempotent here.
 *   5. Known rgba() combinations → matching tint token
 *      (`rgba(255, 180, 171, 0.15)` → `var(--jc-error-tint-medium)`).
 *   6. Off-palette hex accent colors → named accent token
 *      (`#F59E0B` → `var(--jc-accent-amber)`).
 *   7. `width: 3px;` on status-bar `::before` rails → `var(--jc-status-bar-width)`.
 *   8. `box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4)` → `var(--jc-shadow-float)`.
 *
 * Tokens (from src/webview/design-system.css):
 *   --jc-space-xs/sm/md/lg/xl/2xl       2/4/8/12/16/24 px
 *   --jc-radius-xs/sm/md/lg             2/4/6/8 px
 *   --jc-transition-fast/base           150ms / 200ms
 *   --jc-status-bar-width               3 px
 *   --jc-{primary,tertiary,error,warning}-tint-{weak,soft,medium,strong,emphasis}
 *   --jc-accent-{amber,blue,green,purple,pink}
 *   --jc-shadow-float
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ── Spacing ────────────────────────────────────────────────────────

const spaceProperties = [
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'margin',  'margin-top',  'margin-bottom',  'margin-left',  'margin-right',
  'gap', 'row-gap', 'column-gap',
];

const onScale = new Map([
  ['2', 'var(--jc-space-xs)'],
  ['4', 'var(--jc-space-sm)'],
  ['8', 'var(--jc-space-md)'],
  ['12', 'var(--jc-space-lg)'],
  ['16', 'var(--jc-space-xl)'],
  ['24', 'var(--jc-space-2xl)'],
]);

/** Round odd px values to the nearest token — ties go up for visual breath. */
const roundOffScale = new Map([
  ['6',  'var(--jc-space-md)'],   // → 8
  ['10', 'var(--jc-space-lg)'],   // → 12  (tie 8/12 → up)
  ['14', 'var(--jc-space-xl)'],   // → 16
  ['18', 'var(--jc-space-xl)'],   // → 16
  ['20', 'var(--jc-space-2xl)'],  // → 24  (tie 16/24 → up)
]);

const pxToToken = new Map([...onScale, ...roundOffScale]);

/** Return the token for an exact px string, or null if off-scale. */
function pxToken(n) {
  return pxToToken.get(n) ?? null;
}

/** Rewrite `prop: N px;` single-value to token, on-scale AND rounded off-scale. */
function migrateSinglePxValues(css) {
  let next = css;
  for (const prop of spaceProperties) {
    for (const [px, token] of pxToToken) {
      const re = new RegExp(`(^|[;\\s])${prop}:\\s*${px}px\\s*;`, 'gm');
      next = next.replace(re, (_m, lead) => `${lead}${prop}: ${token};`);
    }
  }
  return next;
}

/**
 * Rewrite shorthand `prop: A B [C] [D] ;` where every value is px and on
 * the token scale (including rounded off-scale). Skips declarations that
 * include a non-px value, a var(...), or a keyword like `auto`.
 */
function migrateShorthandSpacing(css) {
  let next = css;
  const shortProps = ['padding', 'margin', 'gap'];
  // Match shorthand where each value is either `Npx` or a unitless `0`
  // (which means zero — unit-independent and standard). Unitless zero is
  // preserved as-is.
  const valuePart = '(?:[0-9]+px|0)';
  for (const prop of shortProps) {
    const re = new RegExp(
      `(^|[;\\s])${prop}:\\s*(${valuePart}(?:\\s+${valuePart}){1,3})\\s*;`,
      'gm',
    );
    next = next.replace(re, (match, lead, valueList) => {
      const parts = valueList.trim().split(/\s+/);
      const tokens = parts.map(v => {
        if (v === '0') return '0';
        const n = v.endsWith('px') ? v.slice(0, -2) : v;
        return pxToken(n);
      });
      if (tokens.some(t => t === null)) return match;
      // Skip no-op replacements (e.g. `padding: 0 0 0 0;` has no px).
      if (tokens.every(t => t === '0')) return match;
      return `${lead}${prop}: ${tokens.join(' ')};`;
    });
  }
  return next;
}

// ── Transitions (idempotent) ────────────────────────────────────────

function migrateTransitions(css) {
  return css
    .replace(/\b150ms ease\b/g, 'var(--jc-transition-fast)')
    .replace(/\b200ms ease\b/g, 'var(--jc-transition-base)');
}

// ── rgba → tint tokens ─────────────────────────────────────────────

/**
 * Map each (r,g,b) base color to its design-system color family. Alpha
 * is then classified into a tint intensity bucket.
 */
const rgbToFamily = new Map([
  [_key(255, 180, 171), 'error'],
  // PreMortem severity-critical uses tailwind red-500; roll it into the
  // error tint family for visual consistency (the text color is already
  // var(--jc-error), and the background was a slightly different red —
  // that inconsistency is exactly what the migration should fix).
  [_key(239, 68, 68),   'error'],
  [_key(147, 0, 10),   'error-container'],
  [_key(159, 202, 255), 'primary'],
  [_key(0, 122, 204),   'primary-container'],
  [_key(97, 218, 193),  'tertiary'],
  [_key(0, 134, 114),   'tertiary-container'],
  [_key(249, 168, 37),  'warning'],
  [_key(245, 158, 11),  'accent-amber'],
  [_key(59, 130, 246),  'accent-blue'],
  [_key(34, 197, 94),   'accent-green'],
  [_key(168, 85, 247),  'accent-purple'],
  [_key(64, 71, 81),    'outline-variant'],
]);

function _key(r, g, b) { return `${r},${g},${b}`; }

/** Map alpha 0.0–1.0 to one of: weak / soft / medium / strong / emphasis. */
function alphaToBucket(alpha) {
  if (alpha <= 0.08) return 'weak';
  if (alpha <= 0.13) return 'soft';
  if (alpha <= 0.18) return 'medium';
  if (alpha <= 0.25) return 'strong';
  return 'emphasis';
}

/** Which tint scale does each family expose? */
const familyTintScale = new Map([
  ['error',             ['weak','soft','medium','strong','emphasis']],
  ['primary',           ['weak','soft','medium','strong','emphasis']],
  ['tertiary',          ['weak','soft','medium','strong','emphasis']],
  ['warning',           ['weak','soft','medium','strong','emphasis']],
  ['error-container',   ['soft']],
  ['tertiary-container',['soft']],
  ['primary-container', ['soft']],
  ['accent-amber',      ['soft','strong']],
  ['accent-blue',       ['soft','strong']],
  ['accent-green',      ['soft','strong']],
  ['accent-purple',     ['soft','strong']],
  ['outline-variant',   ['soft','medium','strong']],
]);

/**
 * Pick the closest available bucket for a family. If `medium` isn't
 * offered (e.g. accent-amber only has soft and strong), downgrade or
 * upgrade to the nearest.
 */
function pickBucket(family, desired) {
  const available = familyTintScale.get(family);
  if (!available) return null;
  if (available.includes(desired)) return desired;
  // Priority walk — prefer stronger if exact is unavailable.
  const order = ['weak','soft','medium','strong','emphasis'];
  const desiredIdx = order.indexOf(desired);
  let bestIdx = -1;
  let bestDist = Infinity;
  for (const b of available) {
    const d = Math.abs(order.indexOf(b) - desiredIdx);
    if (d < bestDist) { bestDist = d; bestIdx = order.indexOf(b); }
  }
  return bestIdx >= 0 ? order[bestIdx] : null;
}

function migrateRgba(css) {
  // Match rgba(r, g, b, a) with any whitespace.
  const re = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)/g;
  return css.replace(re, (match, r, g, b, a) => {
    const base = _key(Number(r), Number(g), Number(b));
    const family = rgbToFamily.get(base);
    if (!family) return match; // unknown color — leave it
    const alpha = Number(a);
    // Shadow black is a non-tint rgba — handled separately below.
    if (base === '0,0,0') return match;
    const desired = alphaToBucket(alpha);
    const bucket = pickBucket(family, desired);
    if (!bucket) return match;
    return `var(--jc-${family}-tint-${bucket})`;
  });
}

// ── Shadows ────────────────────────────────────────────────────────

function migrateShadows(css) {
  return css
    .replace(
      /box-shadow:\s*0\s+8px\s+30px\s+rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.4\s*\)\s*;/g,
      'box-shadow: var(--jc-shadow-float);',
    )
    .replace(
      /box-shadow:\s*0\s+4px\s+12px\s+rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.4\s*\)\s*;/g,
      'box-shadow: var(--jc-shadow-menu);',
    );
}

// ── Off-palette hex accent colors ──────────────────────────────────

const hexToAccentToken = new Map([
  ['#F59E0B', 'var(--jc-accent-amber)'],
  ['#f59e0b', 'var(--jc-accent-amber)'],
  ['#60A5FA', 'var(--jc-accent-blue)'],
  ['#60a5fa', 'var(--jc-accent-blue)'],
  ['#C084FC', 'var(--jc-accent-purple)'],
  ['#c084fc', 'var(--jc-accent-purple)'],
  ['#C586C0', 'var(--jc-accent-pink)'],
  ['#c586c0', 'var(--jc-accent-pink)'],
]);

function migrateHexAccents(css) {
  let next = css;
  for (const [hex, token] of hexToAccentToken) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${hex}\\b`, 'g');
    next = next.replace(re, (_m, lead) => `${lead}${token}`);
  }
  return next;
}

// ── Status bar width ───────────────────────────────────────────────

/**
 * Rewrite `width: 3px;` only when it sits inside a selector whose last
 * segment is `::before` and a sibling `left: 0;`/`top: 0;`/`bottom: 0;`
 * suggests the rail pattern. We approximate with a line-based heuristic:
 * if the preceding 6 lines inside the current rule include `::before {`
 * AND `position: absolute`, treat the 3px as the rail width. Otherwise
 * leave it alone.
 */
function migrateStatusBarWidth(css) {
  const lines = css.split('\n');
  const out = [];
  let inBeforeRule = false;
  let absoluteSeen = false;
  let depth = 0;
  for (const line of lines) {
    // Track brace depth to know when we enter/exit rules.
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (inBeforeRule && /width:\s*3px\s*;/.test(line) && absoluteSeen) {
      out.push(line.replace(/width:\s*3px\s*;/, 'width: var(--jc-status-bar-width);'));
    } else {
      out.push(line);
    }

    if (/::before\s*\{/.test(line)) { inBeforeRule = true; absoluteSeen = false; }
    if (inBeforeRule && /position:\s*absolute/.test(line)) absoluteSeen = true;
    depth += opens - closes;
    if (inBeforeRule && closes > 0 && depth <= 0) { inBeforeRule = false; absoluteSeen = false; depth = 0; }
  }
  return out.join('\n');
}

// ── Orchestration ──────────────────────────────────────────────────

function migrate(css) {
  let next = css;
  next = migrateTransitions(next);
  next = migrateSinglePxValues(next);
  next = migrateShorthandSpacing(next);
  next = migrateRgba(next);
  next = migrateShadows(next);
  next = migrateHexAccents(next);
  next = migrateStatusBarWidth(next);
  return next;
}

async function migrateFile(file) {
  const before = await fs.readFile(file, 'utf-8');
  const after = migrate(before);
  if (after !== before) {
    await fs.writeFile(file, after, 'utf-8');
    return { file, bytesDelta: after.length - before.length };
  }
  return null;
}

async function main() {
  const webviewDir = path.join(repoRoot, 'src', 'webview');
  const files = [];
  for (const entry of await fs.readdir(path.join(webviewDir, 'components'))) {
    if (entry.endsWith('.svelte')) files.push(path.join(webviewDir, 'components', entry));
  }
  files.push(path.join(webviewDir, 'App.svelte'));

  const results = [];
  for (const file of files) {
    const result = await migrateFile(file);
    if (result) results.push(result);
  }

  if (results.length === 0) {
    console.log('No files changed — already migrated.');
    return;
  }
  console.log(`Migrated ${results.length} file(s):`);
  for (const r of results) {
    console.log(`  ${path.relative(repoRoot, r.file)}  (${r.bytesDelta >= 0 ? '+' : ''}${r.bytesDelta} bytes)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

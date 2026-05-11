#!/usr/bin/env tsx
/**
 * Configuration-vs-code linter — Wave 8.
 *
 * Per docs/janumilegal_product_description_evolution.md §11.1 and
 * docs/janumilegal_implementation_roadmap.md Wave 8 §8.3.
 *
 * Findings are CI-blocking when they appear in Layer 1 (`src/lib/**`,
 * `src/extension.ts`, `src/sidecar/**`, `src/webview/**`). They are warnings
 * in Layer 2 (lens packs) and allowed in Layer 3 (firm config).
 *
 * Rules:
 *
 *   H1  No hardcoded firm name in Layer 1 code (e.g., 'JC Law', 'James Crawford',
 *       'Crawford'). Firm names belong in Layer 3 firm config.
 *
 *   H2  No jurisdiction-comparison branching in Layer 1 code:
 *         === 'MD' / === 'VA' / === 'PA' / === 'DC' / === 'Maryland' / etc.
 *         case 'MD': / case 'Maryland': etc.
 *       Layer 1 should treat jurisdiction as opaque data; lens packs and
 *       firm config branch on jurisdiction.
 *
 *   H3  No hardcoded firm-specific directory path in Layer 1.
 *
 * Allowlist mechanism: a line ending with `// hardcoding-audit-allow`
 * suppresses findings on that line. Use sparingly with attached rationale.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

interface Finding {
  rule: 'H1' | 'H2' | 'H3';
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

const findings: Finding[] = [];

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.svelte'))) yield p;
  }
}

function relSrc(p: string): string {
  return path.relative(SRC, p).replace(/\\/g, '/');
}

function layerOf(p: string): 'layer1' | 'layer2' | 'layer3' | 'fixture' | 'test' | 'docs' {
  const r = relSrc(p);
  if (r.startsWith('layer2_lens_packs/')) return 'layer2';
  if (r.startsWith('layer3_firm_config/')) return 'layer3';
  if (r.startsWith('test/')) return 'test';
  return 'layer1';
}

const FORBIDDEN_FIRM_NAMES = ['JC Law', 'James Crawford', 'jamescrawfordlaw'];
const JURISDICTION_BRANCHING_RES = [
  // === '<jur>'  or  !== '<jur>'
  /[!=]==\s*['"](MD|VA|PA|DC|Maryland|Virginia|Pennsylvania|"District of Columbia"|US)['"]/,
  // case '<jur>':
  /\bcase\s+['"](MD|VA|PA|DC|Maryland|Virginia|Pennsylvania)['"]\s*:/,
];

const FIRM_PATH_RE = /firms\/firm_jclaw|firms\/[a-z_]+_jclaw/i;

const ALLOW_MARKER = 'hardcoding-audit-allow';

for (const file of walk(SRC)) {
  const layer = layerOf(file);
  // Tests/fixtures/data are exempt — they exist to exercise scenarios.
  if (layer === 'test') continue;

  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(ALLOW_MARKER)) continue;

    // H1 — firm name
    for (const fn of FORBIDDEN_FIRM_NAMES) {
      if (line.toLowerCase().includes(fn.toLowerCase())) {
        if (layer === 'layer1' || layer === 'layer2') {
          findings.push({
            rule: 'H1',
            file: relSrc(file),
            line: i + 1,
            message: `firm name '${fn}' hardcoded — belongs in Layer 3 firm config`,
            severity: layer === 'layer1' ? 'error' : 'warning',
          });
        }
      }
    }

    // H2 — jurisdiction branching (Layer 1 only; Layer 2 lens packs may legitimately list applicableJurisdictions but not branch on them in code)
    if (layer === 'layer1') {
      for (const re of JURISDICTION_BRANCHING_RES) {
        const m = re.exec(line);
        if (m) {
          findings.push({
            rule: 'H2',
            file: relSrc(file),
            line: i + 1,
            message: `jurisdiction comparison '${m[0]}' in Layer 1 — branching on jurisdictions belongs to Layer 2/3`,
            severity: 'error',
          });
        }
      }
    }

    // H3 — firm-specific path
    if (layer === 'layer1' && FIRM_PATH_RE.test(line)) {
      findings.push({
        rule: 'H3',
        file: relSrc(file),
        line: i + 1,
        message: `firm-specific directory path detected in Layer 1`,
        severity: 'error',
      });
    }
  }
}

const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warning');

for (const f of warnings) {
  console.warn(`[${f.rule}] WARN  src/${f.file}:${f.line} — ${f.message}`);
}
for (const f of errors) {
  console.error(`[${f.rule}] ERROR src/${f.file}:${f.line} — ${f.message}`);
}

if (errors.length === 0) {
  console.log(`hardcoding audit: ok (${warnings.length} warning(s))`);
  process.exit(0);
}
console.error(`\nhardcoding audit: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(1);

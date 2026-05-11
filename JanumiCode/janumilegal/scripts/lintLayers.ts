#!/usr/bin/env tsx
/**
 * Layer-boundary + DAL-bypass linter.
 *
 * Per:
 *   - docs/janumilegal_implementation_roadmap.md Wave 0 §0.3 Standing Disciplines
 *   - docs/janumilegal_multi_matter_isolation_addendum.md §11
 *
 * Rules enforced (all CI-blocking):
 *
 *   R1  No file under src/layer1_core/** may import from src/layer2_lens_packs
 *       or src/layer3_firm_config.
 *
 *   R2  No file under src/layer2_lens_packs/** may import from
 *       src/layer3_firm_config.
 *
 *   R3  No file outside src/lib/database/** may import 'better-sqlite3'.
 *       (DAL-bypass prevention. Tests under src/test/** are also forbidden
 *       from raw access; tests use the DAL like everything else.)
 *
 *   R4  No file outside src/lib/database/** may call `db.prepare(`,
 *       `db.exec(`, `db.transaction(`, or new Database(...).
 *       Caught by simple regex over source text. False positives are accepted
 *       in exchange for cheap, fast CI.
 *
 * Wave 8 will add R5 (no Layer-3 identifier in Layer 1 code) and R6
 * (configuration-vs-code linter for jurisdictions, firm names, etc.).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface Finding {
  rule: string;
  file: string;
  line: number;
  message: string;
}

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const findings: Finding[] = [];

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) yield p;
  }
}

const importRegex = /^\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/;
const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]/;
const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]/;
// R4 patterns: .exec( is NOT included because RegExp.exec is too common a
// false positive. .prepare(, .transaction(, and `new Database(` are
// unambiguously SQL-specific in this codebase.
const dbPrepareRegex = /\b(?:db|database)\.prepare\s*\(/;
const dbTxRegex = /\b(?:db|database)\.transaction\s*\(/;
const newDatabaseRegex = /new\s+Database\s*\(/;

function relSrc(p: string): string {
  return path.relative(SRC, p).replace(/\\/g, '/');
}

function isDalFile(p: string): boolean {
  const r = relSrc(p);
  return (
    r.startsWith('lib/database/') ||
    r === 'sidecar/dbServer.ts' ||
    // Per-matter Governed Stream files are their own DAL surface (per privilege design §3.3).
    // matterTrackStore manages a per-matter SQLite file; it's a sanctioned direct-DB module.
    r === 'lib/governedStream/matterTrackStore.ts'
  );
}

function isLayer1File(p: string): boolean {
  return relSrc(p).startsWith('layer1_core/');
}

function isLayer2File(p: string): boolean {
  return relSrc(p).startsWith('layer2_lens_packs/');
}

function importTargetsLayer(spec: string, layer: 'layer1_core' | 'layer2_lens_packs' | 'layer3_firm_config'): boolean {
  return spec.includes(`/${layer}/`) || spec.startsWith(`./${layer}/`) || spec.startsWith(`../${layer}/`);
}

for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip line and block comments superficially (don't bother with full parsing)
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // R1, R2 — layer import direction
    const importMatch =
      importRegex.exec(line) ?? dynamicImportRegex.exec(line) ?? requireRegex.exec(line);
    if (importMatch) {
      const spec = importMatch[1];
      if (isLayer1File(file) && (importTargetsLayer(spec, 'layer2_lens_packs') || importTargetsLayer(spec, 'layer3_firm_config'))) {
        findings.push({ rule: 'R1', file: relSrc(file), line: i + 1, message: `layer 1 may not import ${spec}` });
      }
      if (isLayer2File(file) && importTargetsLayer(spec, 'layer3_firm_config')) {
        findings.push({ rule: 'R2', file: relSrc(file), line: i + 1, message: `layer 2 may not import ${spec}` });
      }
      // R3 — better-sqlite3 only inside DAL
      if (spec === 'better-sqlite3' && !isDalFile(file)) {
        findings.push({
          rule: 'R3',
          file: relSrc(file),
          line: i + 1,
          message: `better-sqlite3 imported outside src/lib/database/ — use the DAL`,
        });
      }
    }

    // R4 — raw db.prepare / db.exec / db.transaction / new Database outside DAL
    if (!isDalFile(file)) {
      if (dbPrepareRegex.test(line) || dbTxRegex.test(line) || newDatabaseRegex.test(line)) {
        // Allow: lines that explicitly reference our DAL surface (e.g., describing the rule).
        // Keep regex-cheap; if a comment mentions db.prepare it'll false-positive.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        findings.push({
          rule: 'R4',
          file: relSrc(file),
          line: i + 1,
          message: `raw SQL execution outside src/lib/database/ — use ScopedDal / FirmDal`,
        });
      }
    }
  }
}

if (findings.length === 0) {
  console.log('lintLayers: ok');
  process.exit(0);
}

for (const f of findings) {
  console.error(`[${f.rule}] src/${f.file}:${f.line} — ${f.message}`);
}
console.error(`\nlintLayers: ${findings.length} finding(s)`);
process.exit(1);

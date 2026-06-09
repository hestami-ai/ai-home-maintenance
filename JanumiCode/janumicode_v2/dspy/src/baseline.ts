/**
 * Baseline: score every recorded output in a trainset and emit a report.
 * This is the number DSPy must beat — and it proves the metric works on real data.
 *
 *   npx tsx dspy/src/baseline.ts --trainset <jsonl> --out <md>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { scoreCandidate } from './metric';
import type { TrainExample, ScoreResult } from './types';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

const trainsetPath = arg('trainset');
const outPath = arg('out');
if (!trainsetPath) {
  console.error('Usage: baseline.ts --trainset <jsonl> [--out <md>]');
  process.exit(1);
}

const lines = readFileSync(trainsetPath, 'utf-8').split('\n').filter((l) => l.trim());
const examples: TrainExample[] = lines.map((l) => JSON.parse(l));

interface Row { ex: TrainExample; res: ScoreResult; }
const rows: Row[] = examples.map((ex) => ({
  ex,
  res: scoreCandidate({
    agentRole: ex.agentRole,
    subPhaseId: ex.subPhaseId,
    prompt: ex.prompt,
    system: ex.system,
    outputText: ex.recordedOutputText,
  }),
}));

const n = rows.length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const meanScore = mean(rows.map((r) => r.res.score));
const parseOkCount = rows.filter((r) => r.res.parseOk).length;

// Aggregate findings per validator across the whole set.
const perValidator = new Map<string, { high: number; medium: number; low: number; examplesWith: number }>();
for (const r of rows) {
  for (const v of r.res.byValidator) {
    const agg = perValidator.get(v.validatorId) ?? { high: 0, medium: 0, low: 0, examplesWith: 0 };
    agg.high += v.high; agg.medium += v.medium; agg.low += v.low;
    if (v.high + v.medium + v.low > 0) agg.examplesWith++;
    perValidator.set(v.validatorId, agg);
  }
}

const sorted = [...rows].sort((a, b) => a.res.score - b.res.score);

// ── Console summary ──
console.log(`\nBaseline over ${n} examples (${trainsetPath})`);
console.log(`  mean score:   ${meanScore.toFixed(3)}`);
console.log(`  parse-ok:     ${parseOkCount}/${n}`);
console.log(`  findings by validator:`);
for (const [id, a] of perValidator) {
  console.log(`    ${id.padEnd(34)} HIGH=${a.high} MED=${a.medium} LOW=${a.low}  (in ${a.examplesWith}/${n} examples)`);
}
console.log(`  worst 5:`);
for (const r of sorted.slice(0, 5)) {
  console.log(`    ${r.res.score.toFixed(3)}  ${r.ex.label}`);
}

// ── Markdown report ──
if (outPath) {
  const lines2: string[] = [];
  lines2.push(`# fr_saturation baseline — deterministic metric`);
  lines2.push('');
  lines2.push(`Trainset: \`${trainsetPath}\` (${n} examples, model = recorded gpt-oss:20b)`);
  lines2.push('');
  lines2.push(`- **Mean score:** ${meanScore.toFixed(3)}`);
  lines2.push(`- **Parse-ok:** ${parseOkCount}/${n}`);
  lines2.push('');
  lines2.push(`## Findings by validator (totals across all ${n} examples)`);
  lines2.push('');
  lines2.push(`| Validator | HIGH | MED | LOW | examples with ≥1 finding |`);
  lines2.push(`|---|---|---|---|---|`);
  for (const [id, a] of perValidator) {
    lines2.push(`| \`${id}\` | ${a.high} | ${a.medium} | ${a.low} | ${a.examplesWith}/${n} |`);
  }
  lines2.push('');
  lines2.push(`## Per-example scores (worst first)`);
  lines2.push('');
  lines2.push(`| Score | Penalty | Parse | Example |`);
  lines2.push(`|---|---|---|---|`);
  for (const r of sorted) {
    lines2.push(`| ${r.res.score.toFixed(3)} | ${r.res.penalty.toFixed(1)} | ${r.res.parseOk ? 'ok' : 'FAIL'} | ${r.ex.label} |`);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines2.join('\n') + '\n', 'utf-8');
  console.log(`\nReport → ${outPath}`);
}

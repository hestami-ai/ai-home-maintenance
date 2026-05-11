#!/usr/bin/env tsx
/**
 * Thin-slice reviewer (operator mode).
 *
 * Mirrors `JanumiCode/janumicode_v2/scripts/thin-slice-review.js` for
 * JanumiLegal. Walks a thin-slice workspace, extracts each (state, agent,
 * output) record plus the relevant op-track context, invokes Claude CLI
 * (or a configured reviewer command) to score the prompt template + output,
 * and writes a markdown report.
 *
 * NOT to be invoked from inside an active Claude Code session — the
 * `claude -p` subprocess would conflict with the parent. Run from a
 * regular shell after the thin-slice run completes.
 *
 * Wave 9 caveat: real LLM-backed agents are not yet wired. Replay agents
 * stand in. The reviewer's "prompt template" is the lens manifest's
 * documented input/output schema (until Wave 10+ replaces with real
 * prompt text), and "output" is the captured state output. The capability
 * scoring still surfaces structural drift, output validity, and per-state
 * shape problems.
 *
 * Usage:
 *   tsx scripts/thinSliceReview.ts \
 *     --workspace <path-to-thin-slice-workspace-N> \
 *     --out <path-to-output.md>          [optional; default: <workspace>/thin-slice-review.md]
 *     --reviewer-cmd <path-to-claude>    [optional; default: 'claude']
 *     --skip-llm                         [optional; emit report without LLM scoring (structural-only)]
 *     --limit <N>                        [optional; cap records reviewed]
 *
 * Exit codes:
 *   0 — success
 *   2 — usage error
 *   3 — workspace invalid / no records found
 *   4 — reviewer CLI not available (only when --skip-llm not set)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  openDirect,
  ActivationDal,
  OpStreamDal,
} from '../src/lib/database/index.js';
import {
  MatterTrackStore,
  matterTrackPath,
} from '../src/lib/governedStream/matterTrackStore.js';

interface Args {
  workspace: string;
  out: string;
  reviewerCmd: string;
  skipLlm: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { workspace: '', out: '', reviewerCmd: 'claude', skipLlm: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue; // pnpm/npm pass-through separator
    if (a === '--workspace') out.workspace = path.resolve(argv[++i]);
    else if (a === '--out') out.out = path.resolve(argv[++i]);
    else if (a === '--reviewer-cmd') out.reviewerCmd = argv[++i];
    else if (a === '--skip-llm') out.skipLlm = true;
    else if (a === '--limit') out.limit = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') {
      console.error(helpText());
      process.exit(0);
    } else {
      console.error(`[thin-slice-review] unknown option: ${a}`);
      process.exit(2);
    }
  }
  if (!out.workspace) {
    console.error('[thin-slice-review] --workspace is required.');
    process.exit(2);
  }
  if (!out.out) out.out = path.join(out.workspace, 'thin-slice-review.md');
  return out;
}

function helpText(): string {
  return [
    'Usage: tsx scripts/thinSliceReview.ts --workspace <path> [--out <path>] [--reviewer-cmd <cmd>] [--skip-llm] [--limit <N>]',
  ].join('\n');
}

interface CapturedRecord {
  stateId: string;
  agentId: string;
  outputJson: string;
  outputHash: string;
  completedAt: string;
}

interface ScoredRecord extends CapturedRecord {
  score?: ReviewScore;
  scoreError?: string;
}

interface ReviewScore {
  prompt_clarity: number; // 1..5
  output_validity: number; // 1..5
  structural_correctness: number; // 1..5
  capability_match: 'yes' | 'borderline' | 'no';
  issues: string[];
  summary: string;
}

function loadCaptured(workspace: string): CapturedRecord[] {
  const platformDb = path.join(workspace, 'platform.sqlite');
  if (!fs.existsSync(platformDb)) throw new Error(`platform.sqlite missing in ${workspace}`);
  const db = openDirect(platformDb);
  const summaryPath = path.join(workspace, 'thin-slice-summary.json');
  if (!fs.existsSync(summaryPath)) {
    db.close();
    throw new Error(`thin-slice-summary.json missing in ${workspace}`);
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as {
    firmId: string; clientId: string; matterId: string; activationId: string;
  };
  const scope = { firmId: summary.firmId, clientId: summary.clientId, matterId: summary.matterId };
  const activationDal = new ActivationDal(db);
  const states = activationDal.listCompletedStates(scope, summary.activationId);
  const records: CapturedRecord[] = [];
  for (const stateId of states) {
    const row = activationDal.getStateOutput(scope, summary.activationId, stateId);
    if (!row) continue;
    records.push({
      stateId: row.stateId,
      agentId: 'unknown', // resolved from manifest in a richer review (Wave 10+)
      outputJson: row.outputJson,
      outputHash: row.outputHash,
      completedAt: row.completedAt,
    });
  }
  db.close();
  return records;
}

function loadOpTrackSummary(workspace: string): { eventTypeCounts: Record<string, number> } {
  const platformDb = path.join(workspace, 'platform.sqlite');
  const db = openDirect(platformDb);
  const summaryPath = path.join(workspace, 'thin-slice-summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as { firmId: string };
  const opStream = new OpStreamDal(db);
  const events = opStream.recent(summary.firmId, 1000);
  const counts: { [eventType: string]: number } = {};
  for (const e of events) counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
  db.close();
  return { eventTypeCounts: counts };
}

function loadMatterTrackSummary(workspace: string): { classificationCounts: { [c: string]: number } } {
  const summaryPath = path.join(workspace, 'thin-slice-summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as { firmId: string; clientId: string; matterId: string };
  const trackPath = matterTrackPath(workspace, { firmId: summary.firmId, clientId: summary.clientId, matterId: summary.matterId });
  const store = new MatterTrackStore(trackPath);
  const counts: { [c: string]: number } = {};
  for (const e of store.listEvents()) counts[e.classification] = (counts[e.classification] ?? 0) + 1;
  store.close();
  return { classificationCounts: counts };
}

function buildLlmPrompt(rec: CapturedRecord): string {
  return [
    'You are reviewing one lens-state output from a JanumiLegal thin-slice run.',
    '',
    'Your task: assess whether the captured state output is structurally and semantically sensible',
    'for a state of the named lens, and whether the output\'s legal-domain shape is appropriate.',
    '',
    `## State: ${rec.stateId}`,
    `## Agent: ${rec.agentId}`,
    `## Output completed at: ${rec.completedAt}`,
    '',
    '## STATE OUTPUT',
    '```json',
    rec.outputJson.length > 16384 ? rec.outputJson.slice(0, 16384) + '\n...[truncated]' : rec.outputJson,
    '```',
    '',
    '## Instructions',
    '',
    'Return ONLY a single JSON object on stdout, no prose, no markdown fences. Schema:',
    '',
    '```json',
    '{',
    '  "prompt_clarity": <int 1-5>,           // clarity of the implied prompt template (1=unclear, 5=excellent)',
    '  "output_validity": <int 1-5>,          // legal-domain validity of the output (1=nonsense, 5=ideal)',
    '  "structural_correctness": <int 1-5>,   // matches the expected output schema for this state',
    '  "capability_match": "yes" | "borderline" | "no",',
    '  "issues": ["short bullet describing a defect", ...],',
    '  "summary": "1-2 sentence overall assessment"',
    '}',
    '```',
    '',
    'Be terse. Do not narrate outside the JSON.',
  ].join('\n');
}

function invokeReviewer(cmd: string, prompt: string): { ok: boolean; score?: ReviewScore; error?: string } {
  const result = spawnSync(cmd, ['-p', prompt, '--output-format', 'text'], {
    encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024, timeout: 120_000,
  });
  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) return { ok: false, error: `reviewer exited ${result.status}: ${(result.stderr ?? '').slice(0, 500)}` };
  const raw = (result.stdout ?? '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, error: 'no JSON object in stdout' };
  try {
    return { ok: true, score: JSON.parse(raw.slice(start, end + 1)) as ReviewScore };
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${(err as Error).message}` };
  }
}

function main(): number {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.workspace)) {
    console.error(`[thin-slice-review] workspace not found: ${args.workspace}`);
    return 3;
  }

  if (!args.skipLlm) {
    const probe = spawnSync(args.reviewerCmd, ['--version'], { stdio: 'pipe', timeout: 5000 });
    if (probe.status !== 0) {
      console.error(`[thin-slice-review] reviewer CLI not available: ${args.reviewerCmd} --version exited ${probe.status}`);
      return 4;
    }
    console.error(`[thin-slice-review] reviewer: ${args.reviewerCmd} ${(probe.stdout?.toString() ?? '').trim()}`);
  }

  const captured = loadCaptured(args.workspace);
  if (captured.length === 0) {
    console.error('[thin-slice-review] no captured state outputs');
    return 3;
  }
  const opSummary = loadOpTrackSummary(args.workspace);
  const matterSummary = loadMatterTrackSummary(args.workspace);

  const limit = Number.isFinite(args.limit) ? Math.min(args.limit!, captured.length) : captured.length;
  const scored: ScoredRecord[] = [];

  for (let i = 0; i < limit; i++) {
    const rec = captured[i];
    if (args.skipLlm) {
      scored.push(rec);
      continue;
    }
    const r = invokeReviewer(args.reviewerCmd, buildLlmPrompt(rec));
    if (r.ok && r.score) {
      scored.push({ ...rec, score: r.score });
      console.error(`  [${i + 1}/${limit}] ${rec.stateId} — clarity=${r.score.prompt_clarity} validity=${r.score.output_validity} structural=${r.score.structural_correctness} cap=${r.score.capability_match}`);
    } else {
      scored.push({ ...rec, scoreError: r.error });
      console.error(`  [${i + 1}/${limit}] ${rec.stateId} — REVIEW FAILED: ${r.error}`);
    }
  }

  // Markdown report
  const lines: string[] = [];
  lines.push(`# Thin-Slice Review`);
  lines.push('');
  lines.push(`_Generated ${new Date().toISOString()} · workspace: \`${args.workspace}\`_`);
  lines.push('');
  lines.push('## Run summary');
  lines.push('');
  lines.push(`- States captured: **${captured.length}**`);
  lines.push(`- Records reviewed: **${scored.length}**`);
  lines.push(`- LLM scoring: ${args.skipLlm ? '_skipped_' : 'on'}`);
  lines.push('');
  lines.push('### Op-track event types');
  lines.push('');
  lines.push('| Event type | Count |');
  lines.push('|---|---:|');
  for (const [t, c] of Object.entries(opSummary.eventTypeCounts).sort()) {
    lines.push(`| ${t} | ${c} |`);
  }
  lines.push('');
  lines.push('### Matter-track event classifications');
  lines.push('');
  lines.push('| Classification | Count |');
  lines.push('|---|---:|');
  for (const [c, n] of Object.entries(matterSummary.classificationCounts).sort()) {
    lines.push(`| ${c} | ${n} |`);
  }
  lines.push('');
  lines.push('## Per-state scoring');
  lines.push('');
  if (args.skipLlm) {
    lines.push('| # | State | Output bytes | Output hash |');
    lines.push('|---:|---|---:|---|');
    scored.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.stateId} | ${Buffer.byteLength(r.outputJson, 'utf-8')} | \`${r.outputHash.slice(0, 12)}…\` |`);
    });
  } else {
    lines.push('| # | State | Clarity | Validity | Structural | Capability |');
    lines.push('|---:|---|---:|---:|---:|---|');
    scored.forEach((r, i) => {
      if (r.score) {
        lines.push(`| ${i + 1} | ${r.stateId} | ${r.score.prompt_clarity} | ${r.score.output_validity} | ${r.score.structural_correctness} | ${r.score.capability_match} |`);
      } else {
        lines.push(`| ${i + 1} | ${r.stateId} | — | — | — | _review failed_ |`);
      }
    });

    const flagged = scored.filter((r) => r.score && r.score.capability_match !== 'yes');
    if (flagged.length > 0) {
      lines.push('');
      lines.push('## Flagged records (capability ≠ "yes")');
      lines.push('');
      for (const r of flagged) {
        if (!r.score) continue;
        lines.push(`### ${r.stateId} — capability \`${r.score.capability_match}\``);
        lines.push('');
        lines.push(`- Scores: clarity=${r.score.prompt_clarity}, validity=${r.score.output_validity}, structural=${r.score.structural_correctness}`);
        if (r.score.issues.length > 0) {
          lines.push('- Issues:');
          for (const issue of r.score.issues) lines.push(`  - ${issue}`);
        }
        lines.push(`- _${r.score.summary}_`);
        lines.push('');
      }
    }
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, lines.join('\n') + '\n');
  console.error(`[thin-slice-review] wrote ${args.out}`);
  return 0;
}

process.exit(main());

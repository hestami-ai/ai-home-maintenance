#!/usr/bin/env node
/**
 * Thin-Slice Reviewer (Item 4 of the thin-slice tooling)
 *
 * Walks the governed_stream DB produced by a thin-slice run, and for each
 * (sub_phase, agent_invocation, agent_output) tuple invokes Claude Code
 * CLI as a holistic reviewer. Produces a per-record assessment and a
 * coverage report comparing actual output against the expected_coverage
 * matrix in test-and-evaluation/thin-slice-specs/expected_coverage.md.
 *
 * Goal: catch prompt-template defects that the local validators (which
 * are deterministic + qwen3.5:9b-driven) cannot — degraded clarity,
 * structural drift, capability mismatch with qwen3.5:9b, etc.
 *
 * NOT to be invoked from inside an active Claude Code session — the
 * `claude -p` subprocess would conflict with the parent. Run from a
 * regular shell after the thin-slice run completes.
 *
 * Usage:
 *   node scripts/thin-slice-review.js \
 *     --db <path-to-governed_stream.db> \
 *     --out <path-to-output.md>          [optional; default: stdout]
 *     --run-id <id>                       [optional; default: latest]
 *     --reviewer-cmd <path-to-claude>     [optional; default: 'claude']
 *     --limit <N>                         [optional; cap records reviewed; useful for smoke tests]
 *     --skip-thinking                     [optional; omit thinking from review prompt to save tokens]
 *     --max-thinking-bytes <N>            [optional; truncate thinking to N bytes (default 10240)]
 *     --max-output-bytes <N>              [optional; truncate output text to N bytes (default 20480)]
 *
 * Exit codes:
 *   0 — success
 *   2 — CLI usage error
 *   3 — no run / no records found
 *   4 — claude CLI not available
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = {
    reviewerCmd: 'claude',
    maxThinkingBytes: 10240,
    maxOutputBytes: 20480,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--reviewer-cmd') out.reviewerCmd = argv[++i];
    else if (a === '--limit') out.limit = parseInt(argv[++i], 10);
    else if (a === '--skip-thinking') out.skipThinking = true;
    else if (a === '--max-thinking-bytes') out.maxThinkingBytes = parseInt(argv[++i], 10);
    else if (a === '--max-output-bytes') out.maxOutputBytes = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') { printHelpAndExit(); }
    else { console.error(`[thin-slice-review] unknown option: ${a}`); process.exit(2); }
  }
  if (!out.db) {
    console.error('[thin-slice-review] --db is required.');
    printHelpAndExit(2);
  }
  return out;
}

function printHelpAndExit(code = 0) {
  const help = fs.readFileSync(__filename, 'utf-8');
  const block = help.split('\n').slice(1, 35).join('\n');
  console.error(block);
  process.exit(code);
}

const args = parseArgs(process.argv);

// Verify claude CLI is on PATH before doing any DB work.
{
  const probe = spawnSync(args.reviewerCmd, ['--version'], { stdio: 'pipe', timeout: 5000 });
  if (probe.status !== 0) {
    console.error(`[thin-slice-review] reviewer CLI not available: ${args.reviewerCmd} --version exited ${probe.status}`);
    if (probe.error) console.error(`  ${probe.error.message}`);
    process.exit(4);
  }
  console.error(`[thin-slice-review] reviewer: ${args.reviewerCmd} ${(probe.stdout?.toString() ?? '').trim()}`);
}

if (!fs.existsSync(args.db)) {
  console.error(`[thin-slice-review] DB not found: ${args.db}`);
  process.exit(3);
}

const db = new Database(args.db, { readonly: true, fileMustExist: true });

let runId = args.runId;
if (!runId) {
  const row = db.prepare(
    `SELECT id, current_phase_id, status, intent_lens
       FROM workflow_runs
       ORDER BY initiated_at DESC LIMIT 1`,
  ).get();
  if (!row) { console.error('[thin-slice-review] no workflow_runs in DB'); process.exit(3); }
  runId = row.id;
  console.error(
    `[thin-slice-review] latest run: ${runId}  phase=${row.current_phase_id}  lens=${row.intent_lens}  status=${row.status}`,
  );
}

// Fetch agent_invocation records and their corresponding agent_output
// records. We join on derived_from_record_ids[0] = invocation.id, which
// is the contract from llmCaller.writeOutputRecords.
function fetchInvocations() {
  const rows = db.prepare(`
    SELECT
      inv.id              AS invocation_id,
      inv.phase_id        AS phase_id,
      inv.sub_phase_id    AS sub_phase_id,
      inv.produced_by_agent_role AS agent_role,
      inv.produced_at     AS produced_at,
      inv.content         AS inv_content,
      out.id              AS output_id,
      out.content         AS out_content
    FROM governed_stream inv
    LEFT JOIN governed_stream out
      ON out.record_type = 'agent_output'
      AND out.is_current_version = 1
      AND json_extract(out.derived_from_record_ids, '$[0]') = inv.id
    WHERE inv.record_type = 'agent_invocation'
      AND inv.is_current_version = 1
      AND inv.workflow_run_id = ?
    ORDER BY inv.produced_at ASC
  `).all(runId);

  return rows.map(r => {
    const inv = JSON.parse(r.inv_content);
    const out = r.out_content ? JSON.parse(r.out_content) : null;
    return {
      invocation_id: r.invocation_id,
      output_id: r.output_id,
      phase_id: r.phase_id,
      sub_phase_id: r.sub_phase_id,
      agent_role: r.agent_role,
      produced_at: r.produced_at,
      provider: inv.provider ?? null,
      model: inv.model ?? null,
      label: inv.label ?? null,
      prompt: inv.prompt ?? '',
      system: inv.system ?? null,
      out_status: out?.status ?? 'missing',
      output_text: out?.text ?? '',
      thinking: out?.thinking ?? null,
      duration_ms: out?.duration_ms ?? null,
    };
  });
}

function truncate(text, maxBytes) {
  if (text == null) return '(none)';
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  if (Buffer.byteLength(s, 'utf-8') <= maxBytes) return s;
  return s.slice(0, maxBytes) + `\n…[truncated to ${maxBytes} bytes]`;
}

function buildReviewPrompt(rec) {
  const thinkingBlock = args.skipThinking
    ? '(omitted via --skip-thinking)'
    : truncate(rec.thinking ?? '(none — model did not emit thinking)', args.maxThinkingBytes);
  const outputBlock = truncate(rec.output_text || '(empty)', args.maxOutputBytes);
  const systemBlock = truncate(rec.system, 8192);
  const promptBlock = truncate(rec.prompt, 16384);

  return [
    'You are reviewing one agent invocation from a JanumiCode v2 thin-slice calibration run.',
    '',
    'Your task: assess whether the prompt template (the system instruction below) communicates clearly,',
    'whether the model adhered to it, and whether the resulting output is structurally and semantically sensible',
    'for the sub-phase named below. Flag prompt templates that look too complex for a 9B-class model to follow reliably.',
    '',
    `## Sub-phase: ${rec.sub_phase_id ?? '(unknown)'}`,
    `## Agent role: ${rec.agent_role ?? '(unknown)'}`,
    `## Model: ${rec.provider ?? '?'} / ${rec.model ?? '?'}`,
    `## Output status: ${rec.out_status}`,
    '',
    '## SYSTEM (prompt template)',
    '```',
    systemBlock,
    '```',
    '',
    '## USER PROMPT',
    '```',
    promptBlock,
    '```',
    '',
    '## THINKING',
    '```',
    thinkingBlock,
    '```',
    '',
    '## OUTPUT',
    '```',
    outputBlock,
    '```',
    '',
    '## Instructions',
    '',
    'Return ONLY a single JSON object on stdout, no prose, no markdown fences. The schema:',
    '',
    '```json',
    '{',
    '  "prompt_clarity": <int 1-5>,            // 1 = unclear, 5 = excellent',
    '  "model_adherence": <int 1-5>,           // 1 = ignored prompt, 5 = followed exactly',
    '  "output_validity": <int 1-5>,           // 1 = nonsense, 5 = ideal',
    '  "capability_match": "yes" | "borderline" | "no",   // is a 9B-class model up to this template?',
    '  "issues": ["short bullet describing a defect", ...],   // empty array = no issues',
    '  "summary": "1-2 sentence overall assessment"',
    '}',
    '```',
    '',
    'Be terse. Do not narrate your reasoning outside the JSON.',
  ].join('\n');
}

function invokeReviewer(prompt) {
  // `claude -p "<prompt>" --output-format text` — non-interactive print mode.
  // The reviewer is asked to emit a single JSON object; we parse from stdout.
  const result = spawnSync(
    args.reviewerCmd,
    ['-p', prompt, '--output-format', 'text'],
    { encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024, timeout: 120_000 },
  );
  if (result.error) return { ok: false, error: result.error.message, raw: '' };
  if (result.status !== 0) {
    return { ok: false, error: `claude exited ${result.status}: ${result.stderr?.slice(0, 500) ?? ''}`, raw: result.stdout ?? '' };
  }
  const raw = (result.stdout ?? '').trim();
  // Locate the first JSON object in the output. Claude may wrap or prefix.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, error: 'no JSON object in stdout', raw };
  const slice = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    return { ok: true, parsed, raw };
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${err.message}`, raw };
  }
}

const records = fetchInvocations();
if (records.length === 0) {
  console.error('[thin-slice-review] no agent_invocation records for this run');
  process.exit(3);
}

const limit = Number.isFinite(args.limit) ? Math.min(args.limit, records.length) : records.length;
console.error(`[thin-slice-review] reviewing ${limit} of ${records.length} agent_invocation records`);

const assessments = [];
const startedAt = Date.now();
for (let i = 0; i < limit; i++) {
  const rec = records[i];
  const t0 = Date.now();
  const prompt = buildReviewPrompt(rec);
  const review = invokeReviewer(prompt);
  const elapsed = Date.now() - t0;
  if (review.ok) {
    assessments.push({ rec, review: review.parsed, elapsed_ms: elapsed });
    console.error(
      `  [${i + 1}/${limit}] ${rec.sub_phase_id ?? '?'} (${rec.agent_role ?? '?'}) — ` +
      `clarity=${review.parsed.prompt_clarity} adherence=${review.parsed.model_adherence} validity=${review.parsed.output_validity} ` +
      `capability=${review.parsed.capability_match} (${(elapsed / 1000).toFixed(1)}s)`,
    );
  } else {
    assessments.push({ rec, review: { error: review.error }, elapsed_ms: elapsed });
    console.error(`  [${i + 1}/${limit}] ${rec.sub_phase_id ?? '?'} — REVIEW FAILED: ${review.error}`);
  }
}
const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

// Aggregate summary stats.
const summary = {
  total: assessments.length,
  by_capability: { yes: 0, borderline: 0, no: 0 },
  by_sub_phase: {},
  failures: 0,
  avg_clarity: 0,
  avg_adherence: 0,
  avg_validity: 0,
};
let nValid = 0;
let sumC = 0, sumA = 0, sumV = 0;
for (const a of assessments) {
  if (a.review.error) { summary.failures++; continue; }
  const r = a.review;
  if (r.capability_match === 'yes') summary.by_capability.yes++;
  else if (r.capability_match === 'borderline') summary.by_capability.borderline++;
  else if (r.capability_match === 'no') summary.by_capability.no++;
  const sp = a.rec.sub_phase_id ?? '(unknown)';
  if (!summary.by_sub_phase[sp]) summary.by_sub_phase[sp] = { count: 0, capability: { yes: 0, borderline: 0, no: 0 } };
  summary.by_sub_phase[sp].count++;
  summary.by_sub_phase[sp].capability[r.capability_match] = (summary.by_sub_phase[sp].capability[r.capability_match] ?? 0) + 1;
  sumC += r.prompt_clarity; sumA += r.model_adherence; sumV += r.output_validity;
  nValid++;
}
if (nValid > 0) {
  summary.avg_clarity = +(sumC / nValid).toFixed(2);
  summary.avg_adherence = +(sumA / nValid).toFixed(2);
  summary.avg_validity = +(sumV / nValid).toFixed(2);
}

// Markdown report.
const lines = [];
lines.push(`# Thin-Slice Review — run ${runId}`);
lines.push('');
lines.push(`_Generated ${new Date().toISOString()} · reviewer: \`${args.reviewerCmd}\` · ${totalElapsed}s wall_`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- Records reviewed: **${summary.total}**`);
lines.push(`- Review failures: **${summary.failures}**`);
lines.push(`- Avg prompt clarity: **${summary.avg_clarity} / 5**`);
lines.push(`- Avg model adherence: **${summary.avg_adherence} / 5**`);
lines.push(`- Avg output validity: **${summary.avg_validity} / 5**`);
lines.push(`- Capability match: ✅ ${summary.by_capability.yes} · ⚠️ ${summary.by_capability.borderline} · ❌ ${summary.by_capability.no}`);
lines.push('');
lines.push('## Per-Sub-Phase Capability Breakdown');
lines.push('');
lines.push('| Sub-phase | Count | ✅ yes | ⚠️ borderline | ❌ no |');
lines.push('|---|---:|---:|---:|---:|');
for (const sp of Object.keys(summary.by_sub_phase).sort()) {
  const r = summary.by_sub_phase[sp];
  lines.push(`| ${sp} | ${r.count} | ${r.capability.yes ?? 0} | ${r.capability.borderline ?? 0} | ${r.capability.no ?? 0} |`);
}
lines.push('');
lines.push('## Records Flagged as Capability ≠ "yes"');
lines.push('');
const flagged = assessments.filter(a => !a.review.error && a.review.capability_match !== 'yes');
if (flagged.length === 0) {
  lines.push('_None — every record passed capability assessment._');
} else {
  for (const a of flagged) {
    const r = a.review;
    lines.push(`### ${a.rec.sub_phase_id} — ${a.rec.agent_role} — capability \`${r.capability_match}\``);
    lines.push('');
    lines.push(`- Invocation: \`${a.rec.invocation_id}\``);
    lines.push(`- Model: ${a.rec.provider}/${a.rec.model}`);
    lines.push(`- Scores: clarity=${r.prompt_clarity}, adherence=${r.model_adherence}, validity=${r.output_validity}`);
    if (r.issues?.length) {
      lines.push('- Issues:');
      for (const issue of r.issues) lines.push(`  - ${issue}`);
    }
    if (r.summary) lines.push(`- _${r.summary}_`);
    lines.push('');
  }
}
lines.push('');
lines.push('## All Records');
lines.push('');
lines.push('| # | Sub-phase | Agent | Status | Clarity | Adherence | Validity | Capability |');
lines.push('|---:|---|---|---|---:|---:|---:|---|');
assessments.forEach((a, i) => {
  if (a.review.error) {
    lines.push(`| ${i + 1} | ${a.rec.sub_phase_id ?? '?'} | ${a.rec.agent_role ?? '?'} | ${a.rec.out_status} | — | — | — | _review failed_ |`);
  } else {
    const r = a.review;
    lines.push(`| ${i + 1} | ${a.rec.sub_phase_id ?? '?'} | ${a.rec.agent_role ?? '?'} | ${a.rec.out_status} | ${r.prompt_clarity} | ${r.model_adherence} | ${r.output_validity} | ${r.capability_match} |`);
  }
});

const report = lines.join('\n') + '\n';
if (args.out) {
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, report, 'utf-8');
  console.error(`[thin-slice-review] wrote ${args.out}`);
} else {
  process.stdout.write(report);
}

db.close();
process.exit(0);

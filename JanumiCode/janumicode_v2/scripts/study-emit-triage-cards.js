#!/usr/bin/env node
/**
 * study-emit-triage-cards.js — emit per-finding triage cards for the
 * validator-trustworthiness study against a thin-slice DB.
 *
 * Stratified sampling: up to N HIGH findings per validator (default 10).
 * Validators with fewer than N HIGH findings get all of them.
 *
 * Each card is a single markdown file containing:
 *   - validator + finding metadata
 *   - the reviewed agent's invocation prompt
 *   - the reviewed agent's response text + thinking
 *   - the finding's summary + detail + recommendation
 *   - target_field + target_identifier when present
 *
 * Cards are written to study/triage-cards/<validator_id>/<NNNN>.md
 * so subagents can be dispatched per-validator (one batch per directory).
 *
 * Usage:
 *   node scripts/study-emit-triage-cards.js \
 *     --db <path> \
 *     --out study/triage-cards \
 *     [--per-validator 10] \
 *     [--include-severity HIGH,MEDIUM]   # default HIGH
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = { perValidator: 10, includeSeverity: ['HIGH'] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '--per-validator') out.perValidator = parseInt(argv[++i], 10);
    else if (a === '--include-severity') out.includeSeverity = argv[++i].split(',').map(s => s.trim());
    else if (a === '--run-id') out.runId = argv[++i];
  }
  if (!out.db || !out.outDir) {
    console.error('usage: --db <path> --out <dir> [--per-validator N] [--include-severity HIGH,MEDIUM] [--run-id <id>]');
    process.exit(2);
  }
  return out;
}

const args = parseArgs(process.argv);
const db = new Database(args.db, { readonly: true, fileMustExist: true });

let runId = args.runId;
if (!runId) {
  const r = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
  if (!r) { console.error('no workflow_runs'); process.exit(3); }
  runId = r.id;
}
console.error(`[triage] run_id: ${runId}`);

const sevList = args.includeSeverity.map(s => `'${s}'`).join(',');

// All findings of selected severities, in produced_at order
const findings = db.prepare(`
  SELECT id, content, sub_phase_id, produced_at
    FROM governed_stream
   WHERE workflow_run_id = ?
     AND record_type = 'reasoning_review_finding_record'
     AND is_current_version = 1
     AND json_extract(content, '$.severity') IN (${sevList})
   ORDER BY produced_at ASC
`).all(runId).map(r => ({
  id: r.id,
  sub_phase_id: r.sub_phase_id,
  produced_at: r.produced_at,
  content: JSON.parse(r.content),
}));

// Group by validator_id, stratified sample
const byValidator = new Map();
for (const f of findings) {
  const v = f.content.validator_id ?? 'unknown';
  if (!byValidator.has(v)) byValidator.set(v, []);
  byValidator.get(v).push(f);
}

console.error(`[triage] ${findings.length} total findings across ${byValidator.size} validators`);

// Sample N per validator (deterministic: every Kth across the available)
function stratifiedSample(arr, n) {
  if (arr.length <= n) return arr;
  const stride = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * stride)]);
  return out;
}

// Lookup helpers — fetch the reviewed agent_invocation + agent_output
const harnessById = new Map();
const harnessRows = db.prepare(`
  SELECT id, content FROM governed_stream
   WHERE workflow_run_id = ? AND record_type='reasoning_review_harness_record' AND is_current_version=1
`).all(runId);
for (const r of harnessRows) harnessById.set(r.id, JSON.parse(r.content));

function fetchRecord(id) {
  if (!id) return null;
  const r = db.prepare('SELECT id, record_type, content, sub_phase_id FROM governed_stream WHERE id=?').get(id);
  if (!r) return null;
  return { id: r.id, record_type: r.record_type, sub_phase_id: r.sub_phase_id, content: JSON.parse(r.content) };
}

function truncate(s, n) {
  if (typeof s !== 'string') return String(s ?? '');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

fs.mkdirSync(args.outDir, { recursive: true });

// Manifest at root
const manifest = { run_id: runId, generated_at: new Date().toISOString(), per_validator: args.perValidator, severities: args.includeSeverity, validators: [] };

for (const [validatorId, items] of [...byValidator.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const sampled = stratifiedSample(items, args.perValidator);
  const dir = path.join(args.outDir, validatorId);
  fs.mkdirSync(dir, { recursive: true });

  const validatorEntry = { validator_id: validatorId, total_findings: items.length, sampled: sampled.length, sample_ids: [] };
  manifest.validators.push(validatorEntry);

  for (let i = 0; i < sampled.length; i++) {
    const f = sampled[i];
    const c = f.content;
    const harness = harnessById.get(c.harness_id);
    const reviewedInvocation = harness ? fetchRecord(harness.reviewed_agent_invocation_id) : null;
    const reviewedOutput = harness ? fetchRecord(harness.reviewed_agent_output_id) : null;

    const invocationPrompt = reviewedInvocation ? (reviewedInvocation.content.prompt ?? '') : '';
    const outputText = reviewedOutput ? (reviewedOutput.content.text ?? '') : '';
    const outputThinking = reviewedOutput ? (reviewedOutput.content.thinking ?? '') : '';

    const md = [
      `# Triage card — ${validatorId} · finding ${i + 1}/${sampled.length}`,
      '',
      `**Finding record id:** \`${f.id}\``,
      `**Sub-phase:** \`${f.sub_phase_id}\``,
      `**Produced at:** ${f.produced_at}`,
      `**Reviewed agent role:** \`${harness?.reviewed_agent_role ?? '?'}\``,
      '',
      '## Finding',
      '',
      `- **severity:** ${c.severity}`,
      `- **type:** ${c.finding_type ?? c.type ?? '?'}`,
      `- **summary:** ${c.summary ?? '(none)'}`,
      `- **location:** ${c.location ?? '(none)'}`,
      `- **target_field:** ${c.target_field ?? '(not provided)'}`,
      `- **target_identifier:** ${c.target_identifier ?? '(not provided)'}`,
      '',
      '### Detail',
      '',
      truncate(c.detail ?? '(none)', 2000),
      '',
      '### Recommendation',
      '',
      truncate(c.recommendation ?? '(none)', 1000),
      '',
      '## Reviewed agent invocation prompt (excerpt)',
      '',
      '```',
      truncate(invocationPrompt, 6000),
      '```',
      '',
      '## Reviewed agent output text (excerpt)',
      '',
      '```',
      truncate(outputText, 4000),
      '```',
      '',
      '## Reviewed agent thinking (excerpt)',
      '',
      '```',
      truncate(outputThinking, 4000),
      '```',
      '',
      '---',
      '',
      '## Triage (fill in)',
      '',
      '- [ ] **true_positive_actionable** — finding is real AND target is machine-resolvable',
      '- [ ] **true_positive_advisory** — finding is real but no machine-actionable target',
      '- [ ] **false_positive_overstrict** — validator threshold catches benign content',
      '- [ ] **substrate_gap** — finding caused by spec ambiguity or missing DMR context',
      '- [ ] **workflow_artifact** — finding caused by phase ordering / dependency',
      '',
      '### Triage notes (one paragraph):',
      '',
      '_(replace this line with a paragraph: was the agent\'s output actually wrong? if yes, what would the correct output have been? if no, why is the validator flagging it?)_',
      '',
    ].join('\n');

    const cardPath = path.join(dir, `${String(i + 1).padStart(4, '0')}.md`);
    fs.writeFileSync(cardPath, md);
    validatorEntry.sample_ids.push(f.id);
  }
  console.error(`  ${validatorId}: ${items.length} findings → sampled ${sampled.length}`);
}

fs.writeFileSync(path.join(args.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.error(`[triage] wrote manifest + ${manifest.validators.reduce((s, v) => s + v.sampled, 0)} cards to ${args.outDir}`);

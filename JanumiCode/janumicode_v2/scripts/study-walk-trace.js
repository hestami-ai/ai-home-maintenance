#!/usr/bin/env node
/**
 * study-walk-trace.js — emit a phase-by-phase mechanical trace of a workflow
 * run for offline study. Pure SQL over a read-only DB; no LLM, no mutation.
 *
 * Usage:
 *   node scripts/study-walk-trace.js \
 *     --db <path-to-db> \
 *     --out <path.md>          # optional; defaults to stdout
 *     [--run-id <id>]          # optional; defaults to latest workflow_run
 *     [--min-severity HIGH|MEDIUM|LOW]  # default HIGH (controls which findings render in full)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = { minSeverity: 'HIGH' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--out') out.outPath = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--min-severity') out.minSeverity = argv[++i].toUpperCase();
  }
  if (!out.db) {
    console.error('usage: --db <path> [--out <path.md>] [--run-id <id>] [--min-severity HIGH|MEDIUM|LOW]');
    process.exit(2);
  }
  return out;
}

const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const args = parseArgs(process.argv);
const db = new Database(args.db, { readonly: true, fileMustExist: true });

let runId = args.runId;
if (!runId) {
  const r = db.prepare(
    `SELECT id, current_phase_id, status, intent_lens, initiated_at
       FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`,
  ).get();
  if (!r) { console.error('no workflow_runs'); process.exit(3); }
  runId = r.id;
}

const run = db.prepare(
  `SELECT id, current_phase_id, status, intent_lens, initiated_at,
          decomposition_budget_calls_used, decomposition_max_depth_reached
     FROM workflow_runs WHERE id = ?`,
).get(runId);
if (!run) { console.error(`run not found: ${runId}`); process.exit(3); }

const minSevRank = SEVERITY_RANK[args.minSeverity] ?? 3;

// ---- Data loaders ---------------------------------------------------------

function loadHarnessRecords() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'reasoning_review_harness_record'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({
    id: r.id,
    sub_phase_id: r.sub_phase_id,
    produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function loadFindings() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'reasoning_review_finding_record'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({
    id: r.id,
    sub_phase_id: r.sub_phase_id,
    produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function loadArtifacts() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({
    id: r.id,
    sub_phase_id: r.sub_phase_id,
    produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function loadInvocations() {
  // agent_invocation: links to phase/sub_phase, agent_role, model
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'agent_invocation'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({
    id: r.id,
    sub_phase_id: r.sub_phase_id,
    produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function loadGateEvals() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'phase_gate_evaluation'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({ ...r, content: JSON.parse(r.content) }));
}

const harnessRecords = loadHarnessRecords();
const findingRecords = loadFindings();
const artifacts = loadArtifacts();
const invocations = loadInvocations();
const gateEvals = loadGateEvals();

// Index findings by harness_id
const findingsByHarness = new Map();
for (const f of findingRecords) {
  const hid = f.content.harness_id;
  if (!hid) continue;
  const bucket = findingsByHarness.get(hid) ?? [];
  bucket.push(f);
  findingsByHarness.set(hid, bucket);
}

// Group harness records by phase, then sub_phase
const phaseGroups = new Map();
for (const h of harnessRecords) {
  const phase = String(h.content.reviewed_phase_id ?? 'unknown');
  const sub = String(h.content.reviewed_sub_phase_id ?? h.sub_phase_id ?? 'unknown');
  if (!phaseGroups.has(phase)) phaseGroups.set(phase, new Map());
  const subMap = phaseGroups.get(phase);
  if (!subMap.has(sub)) subMap.set(sub, []);
  subMap.get(sub).push(h);
}

// Index artifacts by sub_phase
const artifactsBySub = new Map();
for (const a of artifacts) {
  const sub = String(a.sub_phase_id ?? 'unknown');
  if (!artifactsBySub.has(sub)) artifactsBySub.set(sub, []);
  artifactsBySub.get(sub).push(a);
}

// Index invocations by sub_phase
const invByPhase = new Map();
const invBySub = new Map();
for (const inv of invocations) {
  const phase = String(inv.content.phase_id ?? 'unknown');
  const sub = String(inv.content.sub_phase_id ?? inv.sub_phase_id ?? 'unknown');
  if (!invByPhase.has(phase)) invByPhase.set(phase, []);
  invByPhase.get(phase).push(inv);
  if (!invBySub.has(sub)) invBySub.set(sub, []);
  invBySub.get(sub).push(inv);
}

// ---- Rendering ------------------------------------------------------------

const out = [];
const w = (s = '') => out.push(s);

w(`# Thin-Slice-5 Phase Walk Trace`);
w('');
w(`- **Run ID:** \`${run.id}\``);
w(`- **Initiated:** ${run.initiated_at}`);
w(`- **Final phase:** ${run.current_phase_id}`);
w(`- **Status:** ${run.status}`);
w(`- **Intent lens:** ${run.intent_lens}`);
w(`- **Decomposition budget used:** ${run.decomposition_budget_calls_used ?? 'n/a'}`);
w(`- **Max decomposition depth:** ${run.decomposition_max_depth_reached ?? 'n/a'}`);
w(`- **Min finding severity rendered:** ${args.minSeverity}`);
w('');

// Run-wide totals
const runTotals = { HIGH: 0, MEDIUM: 0, LOW: 0, harnessCount: 0, validatorDispatches: 0 };
for (const h of harnessRecords) {
  runTotals.harnessCount++;
  runTotals.validatorDispatches += (h.content.dispatched_validator_ids ?? []).length;
  const c = h.content.findings_count_by_severity ?? {};
  runTotals.HIGH += c.HIGH ?? 0;
  runTotals.MEDIUM += c.MEDIUM ?? 0;
  runTotals.LOW += c.LOW ?? 0;
}
w(`## Run-wide totals`);
w('');
w(`| metric | count |`);
w(`|---|---|`);
w(`| harness records | ${runTotals.harnessCount} |`);
w(`| validator dispatches (sum) | ${runTotals.validatorDispatches} |`);
w(`| HIGH findings | ${runTotals.HIGH} |`);
w(`| MEDIUM findings | ${runTotals.MEDIUM} |`);
w(`| LOW findings | ${runTotals.LOW} |`);
w(`| artifacts produced | ${artifacts.length} |`);
w(`| agent invocations | ${invocations.length} |`);
w(`| phase gate evaluations | ${gateEvals.length} |`);
w('');

// Phase summary table
w(`## Per-phase summary`);
w('');
w(`| phase | sub-phases | harness | dispatches | HIGH | MEDIUM | LOW | artifacts |`);
w(`|---|---|---|---|---|---|---|---|`);
const sortedPhases = [...phaseGroups.keys()].sort((a, b) => {
  const na = Number(a); const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
});
for (const phase of sortedPhases) {
  const subMap = phaseGroups.get(phase);
  let harnessN = 0, dispN = 0, H = 0, M = 0, L = 0;
  for (const recs of subMap.values()) {
    for (const h of recs) {
      harnessN++;
      dispN += (h.content.dispatched_validator_ids ?? []).length;
      const c = h.content.findings_count_by_severity ?? {};
      H += c.HIGH ?? 0; M += c.MEDIUM ?? 0; L += c.LOW ?? 0;
    }
  }
  // count artifacts whose sub_phase belongs to any sub of this phase
  let artN = 0;
  for (const sub of subMap.keys()) {
    artN += (artifactsBySub.get(sub) ?? []).length;
  }
  w(`| ${phase} | ${subMap.size} | ${harnessN} | ${dispN} | ${H} | ${M} | ${L} | ${artN} |`);
}
w('');

// Validator hot-list (most-firing validators by HIGH count)
const validatorHigh = new Map();
const validatorAll = new Map();
for (const f of findingRecords) {
  const v = f.content.validator_id ?? 'unknown';
  const sev = f.content.severity ?? 'LOW';
  validatorAll.set(v, (validatorAll.get(v) ?? 0) + 1);
  if (sev === 'HIGH') validatorHigh.set(v, (validatorHigh.get(v) ?? 0) + 1);
}
const validatorRows = [...validatorAll.keys()].map(v => ({
  validator: v,
  HIGH: validatorHigh.get(v) ?? 0,
  total: validatorAll.get(v) ?? 0,
})).sort((a, b) => b.HIGH - a.HIGH || b.total - a.total);

w(`## Validator hot-list`);
w('');
w(`| validator | HIGH | total findings |`);
w(`|---|---|---|`);
for (const r of validatorRows) {
  if (r.HIGH === 0 && r.total < 3) continue; // suppress chatty no-HIGH validators
  w(`| ${r.validator} | ${r.HIGH} | ${r.total} |`);
}
w('');

// Per-phase, per-sub-phase deep dive
w(`## Per-sub-phase deep dive`);
w('');
for (const phase of sortedPhases) {
  w(`### Phase ${phase}`);
  w('');
  const subMap = phaseGroups.get(phase);
  const sortedSubs = [...subMap.keys()].sort();
  for (const sub of sortedSubs) {
    const recs = subMap.get(sub);
    w(`#### ${sub}`);
    w('');
    // Aggregate
    let dispatched = new Set();
    let H = 0, M = 0, L = 0;
    const decisions = [];
    for (const h of recs) {
      for (const v of h.content.dispatched_validator_ids ?? []) dispatched.add(v);
      const c = h.content.findings_count_by_severity ?? {};
      H += c.HIGH ?? 0; M += c.MEDIUM ?? 0; L += c.LOW ?? 0;
      if (h.content.decision_recommendation) decisions.push(h.content.decision_recommendation);
    }
    w(`- **harness records:** ${recs.length}`);
    w(`- **agent role(s):** ${[...new Set(recs.map(r => r.content.reviewed_agent_role ?? '?'))].join(', ')}`);
    w(`- **validators dispatched:** ${dispatched.size}`);
    w(`- **findings:** HIGH=${H} · MEDIUM=${M} · LOW=${L}`);
    w(`- **decisions:** ${decisions.join(', ') || '(none)'}`);
    const arts = artifactsBySub.get(sub) ?? [];
    if (arts.length) {
      const kinds = arts.map(a => a.content.kind ?? '?');
      w(`- **artifacts produced (${arts.length}):** ${[...new Set(kinds)].join(', ')}`);
    }
    w('');
    // Render findings at-or-above min-severity
    const rendered = [];
    for (const h of recs) {
      const findings = (findingsByHarness.get(h.id) ?? []);
      for (const f of findings) {
        const sev = f.content.severity ?? 'LOW';
        if ((SEVERITY_RANK[sev] ?? 1) < minSevRank) continue;
        rendered.push({ h, f });
      }
    }
    if (rendered.length) {
      w(`<details><summary>${rendered.length} finding(s) at ≥ ${args.minSeverity}</summary>`);
      w('');
      for (const { h, f } of rendered) {
        const c = f.content;
        w(`- **${c.severity}** · \`${c.validator_id}\` · ${c.finding_type ?? ''}`);
        if (c.summary) w(`  - ${c.summary}`);
        if (c.location && c.location !== '$') w(`  - location: \`${c.location}\``);
        if (c.detail) w(`  - detail: ${truncate(c.detail, 400)}`);
        if (c.recommendation) w(`  - rec: ${truncate(c.recommendation, 300)}`);
        w(`  - harness: \`${h.id}\``);
      }
      w('');
      w(`</details>`);
      w('');
    }
  }
}

// Phase gate evaluations
if (gateEvals.length) {
  w(`## Phase gate evaluations`);
  w('');
  for (const g of gateEvals) {
    const c = g.content;
    w(`- **${c.phase_id ?? g.sub_phase_id ?? '?'}** — ${c.decision ?? c.status ?? '?'} · ${truncate(c.rationale ?? c.summary ?? '', 200)}`);
  }
  w('');
}

function truncate(s, n) {
  if (typeof s !== 'string') return String(s ?? '');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

const md = out.join('\n');
if (args.outPath) {
  fs.writeFileSync(args.outPath, md);
  console.error(`[trace] wrote ${md.length} bytes to ${args.outPath}`);
} else {
  process.stdout.write(md);
}

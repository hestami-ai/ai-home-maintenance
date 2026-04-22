#!/usr/bin/env node
/**
 * Extract the Phase 2.1a FR decomposition tree and (if present) the
 * Phase 2.2a NFR decomposition tree from a workflow run's governed
 * stream, writing each as a gold reference file. Mirrors
 * extract-phase2-requirements.js but captures the Wave 6 recursive
 * decomposition output rather than the root FR/NFR artifacts.
 *
 * Each gold file contains:
 *   {
 *     root_kind: 'fr' | 'nfr',
 *     nodes: [<current-version decomposition nodes, in tree order>],
 *     assumption_snapshots: [<one per pass, in pass order>],
 *     audit_records: [<reasoning_review_record of kind tier_c_ac_shape_audit>],
 *     telemetry: { budget_calls_used, max_depth_reached, total_nodes, atomic_leaves, pruned, downgraded, deferred }
 *   }
 *
 * Usage:
 *   node scripts/extract-phase2-decomposition.js \
 *     --db test-and-evaluation/test-workspace/.janumicode/test-harness/<file>.db \
 *     --out-fr src/test/fixtures/hestami-product-description/gold/product_fr_decomposition.<tag>.gold.json \
 *     --out-nfr src/test/fixtures/hestami-product-description/gold/product_nfr_decomposition.<tag>.gold.json
 *
 *   Add --run-id <id> to target a specific run (defaults to the latest).
 *   Add --no-write to dump both trees to stdout instead of writing files.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--out-fr') out.outFr = argv[++i];
    else if (a === '--out-nfr') out.outNfr = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--no-write') out.noWrite = true;
  }
  if (!out.db) {
    console.error('usage: --db <path> [--out-fr <path>] [--out-nfr <path>] [--run-id <id>] [--no-write]');
    process.exit(2);
  }
  return out;
}

const args = parseArgs(process.argv);
const db = new Database(args.db, { readonly: true, fileMustExist: true });

let runId = args.runId;
if (!runId) {
  const row = db.prepare(
    `SELECT id, current_phase_id, status, intent_lens,
            decomposition_budget_calls_used, decomposition_max_depth_reached
       FROM workflow_runs
       ORDER BY initiated_at DESC LIMIT 1`,
  ).get();
  if (!row) { console.error('no workflow_runs'); process.exit(3); }
  runId = row.id;
  console.error(
    `[extract] latest run: ${runId}  phase=${row.current_phase_id}  lens=${row.intent_lens}  status=${row.status}  ` +
    `budget_used=${row.decomposition_budget_calls_used}  max_depth=${row.decomposition_max_depth_reached}`,
  );
}

function fetchDecompositionNodes(rootKind) {
  // Current-version nodes for this run. Filter by root_kind in content.
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'requirement_decomposition_node'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows
    .map(r => ({ id: r.id, sub_phase_id: r.sub_phase_id, produced_at: r.produced_at, content: JSON.parse(r.content) }))
    .filter(r => {
      const kind = r.content.root_kind ?? 'fr';
      return kind === rootKind;
    });
}

function fetchAssumptionSnapshots(rootKind) {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'assumption_set_snapshot'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  const marker = rootKind === 'nfr' ? '*nfr*' : '*';
  return rows
    .map(r => ({ id: r.id, sub_phase_id: r.sub_phase_id, produced_at: r.produced_at, content: JSON.parse(r.content) }))
    .filter(r => (r.content.root_fr_id ?? '*') === marker);
}

function fetchAuditRecords() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'reasoning_review_record'
       AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId);
  return rows
    .map(r => ({ id: r.id, sub_phase_id: r.sub_phase_id, produced_at: r.produced_at, content: JSON.parse(r.content) }))
    .filter(r => r.content.kind === 'tier_c_ac_shape_audit');
}

function computeTelemetry(nodes) {
  const tally = {
    total_nodes: nodes.length,
    atomic_leaves: 0,
    pending: 0,
    pruned: 0,
    downgraded: 0,
    deferred: 0,
    by_tier: { A: 0, B: 0, C: 0, D: 0, root: 0 },
  };
  for (const n of nodes) {
    const c = n.content;
    if (c.status === 'atomic') tally.atomic_leaves++;
    else if (c.status === 'pending') tally.pending++;
    else if (c.status === 'pruned') tally.pruned++;
    else if (c.status === 'downgraded') tally.downgraded++;
    else if (c.status === 'deferred') tally.deferred++;
    const tier = c.tier ?? (c.depth === 0 ? 'root' : null);
    if (tier && tally.by_tier[tier] !== undefined) tally.by_tier[tier]++;
  }
  return tally;
}

function buildTree(rootKind) {
  const nodes = fetchDecompositionNodes(rootKind);
  const assumption_snapshots = fetchAssumptionSnapshots(rootKind);
  const audit_records = fetchAuditRecords().filter(a => {
    // tier_c_ac_shape_audit is tagged by sub_phase_id (2.1a for FR, 2.2a for NFR).
    const wanted = rootKind === 'nfr' ? '2.2a' : '2.1a';
    return a.sub_phase_id === wanted;
  });
  const telemetry = computeTelemetry(nodes);
  return {
    root_kind: rootKind,
    run_id: runId,
    nodes: nodes.map(n => n.content),
    assumption_snapshots: assumption_snapshots.map(s => s.content),
    audit_records: audit_records.map(a => a.content),
    telemetry,
  };
}

const frTree = buildTree('fr');
const nfrTree = buildTree('nfr');

console.error(`[extract] FR tree: ${frTree.telemetry.total_nodes} nodes (${frTree.telemetry.atomic_leaves} atomic, ${frTree.telemetry.pruned} pruned, ${frTree.telemetry.downgraded} downgraded, ${frTree.telemetry.deferred} deferred)`);
console.error(`[extract] NFR tree: ${nfrTree.telemetry.total_nodes} nodes (${nfrTree.telemetry.atomic_leaves} atomic, ${nfrTree.telemetry.pruned} pruned, ${nfrTree.telemetry.downgraded} downgraded, ${nfrTree.telemetry.deferred} deferred)`);

if (args.noWrite) {
  console.log(JSON.stringify({ fr: frTree, nfr: nfrTree }, null, 2));
  process.exit(0);
}

const outFr = args.outFr
  ?? path.join('src', 'test', 'fixtures', 'hestami-product-description', 'gold', 'product_fr_decomposition.gold.json');
const outNfr = args.outNfr
  ?? path.join('src', 'test', 'fixtures', 'hestami-product-description', 'gold', 'product_nfr_decomposition.gold.json');

if (frTree.telemetry.total_nodes > 0) {
  fs.mkdirSync(path.dirname(outFr), { recursive: true });
  fs.writeFileSync(outFr, JSON.stringify(frTree, null, 2) + '\n');
  console.error(`[extract] wrote FR decomposition to ${outFr} (${fs.statSync(outFr).size} bytes)`);
} else {
  console.error('[extract] FR tree is empty — skipping write');
}

if (nfrTree.telemetry.total_nodes > 0) {
  fs.mkdirSync(path.dirname(outNfr), { recursive: true });
  fs.writeFileSync(outNfr, JSON.stringify(nfrTree, null, 2) + '\n');
  console.error(`[extract] wrote NFR decomposition to ${outNfr} (${fs.statSync(outNfr).size} bytes)`);
} else {
  console.error('[extract] NFR tree is empty — skipping write');
}

db.close();

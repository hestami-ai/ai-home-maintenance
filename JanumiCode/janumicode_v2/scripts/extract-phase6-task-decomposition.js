#!/usr/bin/env node
/**
 * Wave 8 — extract the Phase 6.1a task decomposition tree from a
 * workflow run's governed stream and write it as a gold reference.
 * Mirrors extract-phase4-component-decomposition.js but for tasks.
 *
 * Output:
 *   {
 *     run_id: <id>,
 *     pipeline_id: <id>,
 *     nodes: [<current-version task_decomposition_node, in tree order>],
 *     assumption_snapshots: [<one per pass, in pass order>],
 *     pipeline: <latest task_decomposition_pipeline content>,
 *     telemetry: {
 *       budget_calls_used, max_depth_reached, total_nodes,
 *       atomic_leaves, pruned, downgraded, deferred,
 *       by_tier: { A, B, C, D, root }
 *     }
 *   }
 *
 * Usage:
 *   node scripts/extract-phase6-task-decomposition.js \
 *     --db test-and-evaluation/test-workspace/.janumicode/test-harness/<file>.db \
 *     --out src/test/fixtures/hestami-product-description/gold/task_decomposition.<tag>.gold.json
 *
 *   Add --run-id <id> to target a specific run (defaults to the latest).
 *   Add --no-write to dump the tree to stdout instead of writing.
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
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--no-write') out.noWrite = true;
  }
  if (!out.db) {
    console.error('usage: --db <path> [--out <path>] [--run-id <id>] [--no-write]');
    process.exit(2);
  }
  return out;
}

const args = parseArgs(process.argv);
const db = new Database(args.db, { readonly: true, fileMustExist: true });

let runId = args.runId;
if (!runId) {
  const row = db.prepare(`
    SELECT id, current_phase_id, status, intent_lens,
           task_decomposition_budget_calls_used,
           task_decomposition_max_depth_reached,
           active_task_pipeline_id
      FROM workflow_runs
      ORDER BY initiated_at DESC LIMIT 1
  `).get();
  if (!row) { console.error('no workflow_runs'); process.exit(3); }
  runId = row.id;
  console.error(
    `[extract] latest run: ${runId}  phase=${row.current_phase_id}  lens=${row.intent_lens}  status=${row.status}  ` +
    `task_budget_used=${row.task_decomposition_budget_calls_used ?? 0}  ` +
    `task_max_depth=${row.task_decomposition_max_depth_reached ?? 0}  ` +
    `pipeline=${row.active_task_pipeline_id ?? '(none)'}`,
  );
}

function fetchTaskDecompositionNodes() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'task_decomposition_node'
        AND is_current_version = 1
      ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({
    id: r.id, sub_phase_id: r.sub_phase_id, produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function fetchTaskAssumptionSnapshots() {
  const rows = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'task_assumption_set_snapshot'
        AND is_current_version = 1
      ORDER BY produced_at ASC
  `).all(runId);
  return rows.map(r => ({
    id: r.id, sub_phase_id: r.sub_phase_id, produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function fetchLatestPipeline() {
  const rows = db.prepare(`
    SELECT id, content, produced_at, is_current_version
      FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'task_decomposition_pipeline'
        AND is_current_version = 1
      ORDER BY produced_at DESC LIMIT 1
  `).all(runId);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].content);
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

const nodes = fetchTaskDecompositionNodes();
const assumption_snapshots = fetchTaskAssumptionSnapshots();
const pipeline = fetchLatestPipeline();
const telemetry = computeTelemetry(nodes);

const tree = {
  run_id: runId,
  pipeline_id: pipeline?.pipeline_id ?? null,
  nodes: nodes.map(n => n.content),
  assumption_snapshots: assumption_snapshots.map(s => s.content),
  pipeline,
  telemetry,
};

console.error(
  `[extract] task tree: ${telemetry.total_nodes} nodes ` +
  `(${telemetry.atomic_leaves} atomic, ${telemetry.pruned} pruned, ` +
  `${telemetry.downgraded} downgraded, ${telemetry.deferred} deferred); ` +
  `tier_distribution=${JSON.stringify(telemetry.by_tier)}`,
);

if (args.noWrite) {
  console.log(JSON.stringify(tree, null, 2));
  process.exit(0);
}

const out = args.out
  ?? path.join('src', 'test', 'fixtures', 'hestami-product-description', 'gold', 'task_decomposition.gold.json');

if (tree.telemetry.total_nodes > 0) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(tree, null, 2) + '\n');
  console.error(`[extract] wrote task decomposition to ${out} (${fs.statSync(out).size} bytes)`);
} else {
  console.error('[extract] task tree is empty — skipping write');
}

db.close();

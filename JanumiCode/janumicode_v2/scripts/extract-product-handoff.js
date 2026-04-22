#!/usr/bin/env node
/**
 * Extract the latest `product_description_handoff` record from a
 * harness run's governed-stream DB. Used for gold-reference capture
 * (plan §10.3) — the first clean real-mode run's handoff is written
 * to src/test/fixtures/hestami-product-description/gold/.
 *
 * Usage:
 *   node scripts/extract-product-handoff.js \
 *     --db test-and-evaluation/test-workspace/.janumicode/test-harness/<file>.db \
 *     [--out src/test/fixtures/hestami-product-description/gold/product_description_handoff.gold.json]
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

// Most recent workflow_run, unless --run-id supplied.
let runId = args.runId;
if (!runId) {
  const runRow = db
    .prepare(`SELECT id, current_phase_id, status, intent_lens FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`)
    .get();
  if (!runRow) {
    console.error('no workflow_runs in DB');
    process.exit(3);
  }
  runId = runRow.id;
  console.error(`[extract] latest run: ${runId}  phase=${runRow.current_phase_id}  lens=${runRow.intent_lens}  status=${runRow.status}`);
}

const handoffRow = db
  .prepare(
    `SELECT id, content, produced_at, sub_phase_id, is_current_version
       FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'product_description_handoff'
      ORDER BY produced_at DESC LIMIT 1`,
  )
  .get(runId);

if (!handoffRow) {
  console.error(`[extract] no product_description_handoff record for run ${runId}`);
  // Summarize what DID get emitted so we can see where the pipeline stopped.
  const counts = db
    .prepare(`SELECT record_type, sub_phase_id, COUNT(*) AS n FROM governed_stream WHERE workflow_run_id = ? GROUP BY record_type, sub_phase_id ORDER BY MIN(produced_at)`)
    .all(runId);
  console.error('record counts by type+sub_phase:');
  for (const r of counts) console.error(`  ${String(r.record_type).padEnd(32)} sub=${String(r.sub_phase_id ?? '-').padEnd(5)} n=${r.n}`);
  process.exit(4);
}

const content = JSON.parse(handoffRow.content);

// Summary
const arrLen = (k) => (Array.isArray(content[k]) ? content[k].length : 0);
console.error(`[extract] handoff record ${handoffRow.id} @ ${handoffRow.produced_at} (sub_phase ${handoffRow.sub_phase_id})`);
console.error(`  personas=${arrLen('personas')} journeys=${arrLen('userJourneys')} domains=${arrLen('businessDomainProposals')} entities=${arrLen('entityProposals')} workflows=${arrLen('workflowProposals')} integrations=${arrLen('integrationProposals')} QAs=${arrLen('qualityAttributes')} phasing=${arrLen('phasingStrategy')}`);

if (args.noWrite) {
  console.log(JSON.stringify(content, null, 2));
  process.exit(0);
}

const outPath = args.out ?? path.join('src', 'test', 'fixtures', 'hestami-product-description', 'gold', 'product_description_handoff.gold.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(content, null, 2) + '\n');
console.error(`[extract] wrote gold reference to ${outPath} (${fs.statSync(outPath).size} bytes)`);

db.close();

#!/usr/bin/env node
/**
 * Extract the latest functional_requirements + non_functional_requirements
 * artifacts from a workflow run and write them as paired gold reference
 * files. Mirrors extract-product-handoff.js but for Phase 2.
 *
 * Usage:
 *   node scripts/extract-phase2-requirements.js \
 *     --db test-workspace/.janumicode/test-harness/<file>.db \
 *     --out-fr src/test/fixtures/hestami-product-description/gold/product_functional_requirements.<tag>.gold.json \
 *     --out-nfr src/test/fixtures/hestami-product-description/gold/product_non_functional_requirements.<tag>.gold.json
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
  const row = db.prepare(`SELECT id, current_phase_id, status, intent_lens FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`).get();
  if (!row) { console.error('no workflow_runs'); process.exit(3); }
  runId = row.id;
  console.error(`[extract] latest run: ${runId}  phase=${row.current_phase_id}  lens=${row.intent_lens}  status=${row.status}`);
}

function fetchArtifact(kind) {
  const row = db.prepare(`
    SELECT id, content, sub_phase_id, produced_at
      FROM governed_stream
     WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
       AND json_extract(content, '$.kind') = ?
     ORDER BY produced_at DESC LIMIT 1
  `).get(runId, kind);
  if (!row) return null;
  return { id: row.id, content: JSON.parse(row.content), sub_phase_id: row.sub_phase_id, produced_at: row.produced_at };
}

const fr = fetchArtifact('functional_requirements');
const nfr = fetchArtifact('non_functional_requirements');

if (!fr) { console.error(`[extract] no functional_requirements artifact for run ${runId}`); process.exit(4); }
if (!nfr) { console.error(`[extract] no non_functional_requirements artifact for run ${runId}`); process.exit(5); }

const frCount = fr.content.user_stories?.length ?? 0;
const nfrCount = nfr.content.requirements?.length ?? 0;
const frWithTrace = (fr.content.user_stories ?? []).filter(s => Array.isArray(s.traces_to) && s.traces_to.length > 0).length;
const nfrWithTrace = (nfr.content.requirements ?? []).filter(r => Array.isArray(r.traces_to) && r.traces_to.length > 0).length;
console.error(`[extract] FR:  ${frCount} user_stories  (${frWithTrace} with traces_to)  @ ${fr.produced_at}`);
console.error(`[extract] NFR: ${nfrCount} requirements  (${nfrWithTrace} with traces_to)  @ ${nfr.produced_at}`);

if (args.noWrite) {
  console.log(JSON.stringify({ fr: fr.content, nfr: nfr.content }, null, 2));
  process.exit(0);
}

const outFr = args.outFr ?? path.join('src', 'test', 'fixtures', 'hestami-product-description', 'gold', 'product_functional_requirements.gold.json');
const outNfr = args.outNfr ?? path.join('src', 'test', 'fixtures', 'hestami-product-description', 'gold', 'product_non_functional_requirements.gold.json');

fs.mkdirSync(path.dirname(outFr), { recursive: true });
fs.writeFileSync(outFr, JSON.stringify(fr.content, null, 2) + '\n');
fs.writeFileSync(outNfr, JSON.stringify(nfr.content, null, 2) + '\n');
console.error(`[extract] wrote FR gold to ${outFr} (${fs.statSync(outFr).size} bytes)`);
console.error(`[extract] wrote NFR gold to ${outNfr} (${fs.statSync(outNfr).size} bytes)`);

db.close();

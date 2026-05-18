/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-8/.janumicode/test-harness/1778543391345.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, status FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
console.log('RUN status:', run.status, '· current phase:', run.current_phase_id);

const SKIPPED = new Set([
  'json_repair_record','file_system_write_record','mirror_presented',
  'decision_bundle_presented','execution_wave_started','execution_wave_completed',
  'workflow_run_closure',
]);

const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const fts = db.prepare(`SELECT COUNT(*) c FROM governed_stream_fts`).get();
const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
console.log(`\ngoverned_stream:     ${gs.c} records`);
console.log(`governed_stream_fts: ${fts.c} rows`);
console.log(`governed_stream_vec: ${vec.c} rows`);

// Eligibility: every record except SKIPPED types. extractEmbeddingText
// might further filter to non-null extractable text but most pass.
const eligibleQ = db.prepare(`
  SELECT COUNT(*) c FROM governed_stream
   WHERE workflow_run_id = ? AND is_current_version = 1
     AND record_type NOT IN (${[...SKIPPED].map(t => `'${t}'`).join(',')})
`).get(run.id);
console.log(`\neligible records (non-plumbing): ${eligibleQ.c}`);
console.log(`coverage ratio: ${vec.c}/${eligibleQ.c} = ${((vec.c / eligibleQ.c) * 100).toFixed(1)}%`);

// Most recent embed activity — to see if indexer is still running or stalled
const recent = db.prepare(`SELECT embedded_at FROM governed_stream_vec ORDER BY embedded_at DESC LIMIT 1`).get();
const oldest = db.prepare(`SELECT embedded_at FROM governed_stream_vec ORDER BY embedded_at ASC LIMIT 1`).get();
if (recent) {
  const lag = (Date.now() - new Date(recent.embedded_at).getTime()) / 1000;
  console.log(`\noldest embed: ${oldest.embedded_at}`);
  console.log(`newest embed: ${recent.embedded_at}  (${lag.toFixed(0)}s ago)`);
}

// Distribution of vec rows by source record_type
console.log('\n--- vec coverage by record_type ---');
const byType = db.prepare(`
  SELECT gs.record_type, COUNT(*) c
    FROM governed_stream_vec v
    JOIN governed_stream gs ON gs.id = v.record_id
   WHERE gs.workflow_run_id = ?
   GROUP BY gs.record_type
   ORDER BY c DESC
`).all(run.id);
for (const r of byType) console.log(' ', String(r.c).padStart(5), r.record_type);

// What's NOT embedded — eligible but no vec row
console.log('\n--- eligible records WITHOUT vec row (sampled) ---');
const missing = db.prepare(`
  SELECT gs.record_type, COUNT(*) c
    FROM governed_stream gs
    LEFT JOIN governed_stream_vec v ON v.record_id = gs.id
   WHERE gs.workflow_run_id = ? AND gs.is_current_version = 1
     AND gs.record_type NOT IN (${[...SKIPPED].map(t => `'${t}'`).join(',')})
     AND v.record_id IS NULL
   GROUP BY gs.record_type
   ORDER BY c DESC LIMIT 10
`).all(run.id);
for (const r of missing) console.log(' ', String(r.c).padStart(5), r.record_type);

// Embedding model + byte length sanity
const sampleVec = db.prepare(`SELECT record_id, embedding_model, LENGTH(embedding) AS bytes FROM governed_stream_vec LIMIT 3`).all();
console.log('\n--- embedding sanity ---');
for (const s of sampleVec) console.log(` model=${s.embedding_model} · bytes=${s.bytes} · ${s.record_id.slice(0,8)}`);

// Has DMR actually fired yet? Context packets indicate DMR ran
const dmr = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1`).get(run.id);
console.log(`\nDMR context_packets emitted: ${dmr.c}`);

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-6/.janumicode/test-harness/1778522570099.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, status FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
console.log('RUN:', run);

console.log('\n--- record_type counts ---');
const cts = db.prepare(`SELECT record_type, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY record_type ORDER BY c DESC`).all(run.id);
for (const r of cts) console.log(' ', String(r.c).padStart(5), r.record_type);

console.log('\n--- authority_level distribution ---');
const auth = db.prepare(`SELECT authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY authority_level ORDER BY authority_level`).all(run.id);
for (const a of auth) console.log('  level', a.authority_level, '→', a.c);

console.log('\n--- B.1 verification: constitutional_invariant records ---');
const ci = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='constitutional_invariant' AND is_current_version=1`).all(run.id);
console.log('  count:', ci.length);
if (ci.length) {
  const c = JSON.parse(ci[0].content);
  console.log('  sample:', c.invariant_id, '-', c.statement.slice(0, 80) + '...');
}

console.log('\n--- A.1 verification: vec index population ---');
try {
  const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
  console.log('  governed_stream_vec rows:', vec.c);
} catch (e) { console.log('  err:', e.message); }
const fts = db.prepare(`SELECT COUNT(*) c FROM governed_stream_fts`).get();
console.log('  governed_stream_fts rows:', fts.c);

console.log('\n--- C.1 verification: Stage III activity ---');
const proposed = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='memory_edge_proposed' AND is_current_version=1`).get(run.id);
console.log('  memory_edge_proposed records:', proposed.c);
const stage3Invocations = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='agent_invocation' AND produced_by_agent_role='ingestion_pipeline_stage3' AND is_current_version=1`).get(run.id);
console.log('  Stage III agent_invocation records:', stage3Invocations.c);

console.log('\n--- B.2 verification: any bloom records at authority=1 yet ---');
const bloom1 = db.prepare(`SELECT record_type, sub_phase_id, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND authority_level=1 AND is_current_version=1 GROUP BY record_type, sub_phase_id`).all(run.id);
for (const b of bloom1) console.log(' ', b.c, b.record_type, '@', b.sub_phase_id);

console.log('\n--- current activity ---');
const recent = db.prepare(`SELECT record_type, sub_phase_id, produced_at FROM governed_stream WHERE workflow_run_id=? ORDER BY produced_at DESC LIMIT 5`).all(run.id);
for (const r of recent) console.log(' ', r.produced_at, r.record_type, '@', r.sub_phase_id || '');

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-8/.janumicode/test-harness/1778543391345.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, status FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
console.log('RUN:', run);

const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const fts = db.prepare(`SELECT COUNT(*) c FROM governed_stream_fts`).get();
const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
console.log('\ngoverned_stream:', gs.c, 'records');
console.log('governed_stream_fts:', fts.c, 'rows');
console.log('governed_stream_vec:', vec.c, 'rows  ← critical: should be > 0 within seconds');

const ci = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE record_type='constitutional_invariant' AND is_current_version=1`).get();
console.log('constitutional_invariant:', ci.c);

const auth = db.prepare(`SELECT authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY authority_level ORDER BY authority_level`).all(run.id);
console.log('\nauthority levels:');
for (const a of auth) console.log('  level', a.authority_level, '→', a.c);

if (vec.c > 0) {
  const sample = db.prepare(`SELECT record_id, embedding_model, embedded_at FROM governed_stream_vec ORDER BY embedded_at DESC LIMIT 3`).all();
  console.log('\nvec samples (most recent):');
  for (const s of sample) console.log(' ', s.embedded_at, s.embedding_model, s.record_id.slice(0,8));
}

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-9/.janumicode/test-harness/1778546498732.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, status FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const vec = db.prepare('SELECT COUNT(*) c FROM governed_stream_vec').get();
const newest = db.prepare('SELECT embedded_at FROM governed_stream_vec ORDER BY embedded_at DESC LIMIT 1').get();
console.log('phase:', run.current_phase_id, '· status:', run.status);
console.log('records:', gs.c, '· vec rows:', vec.c, '· newest embed:', newest ? newest.embedded_at : 'none');
const lag = newest ? (Date.now() - new Date(newest.embedded_at).getTime()) / 1000 : null;
if (lag !== null) console.log('newest embed age:', lag.toFixed(0), 's');

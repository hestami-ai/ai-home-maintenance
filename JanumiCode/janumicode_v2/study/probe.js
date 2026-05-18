/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-5/.janumicode/test-harness/1778448716098.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();

console.log('--- authority_level distribution (current_version=1) ---');
const auth = db.prepare('SELECT authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY authority_level ORDER BY authority_level').all(run.id);
for (const a of auth) console.log('  level', a.authority_level, '→', a.c);

console.log('\n--- top authority record_types ---');
const topAuth = db.prepare('SELECT record_type, authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND authority_level>=4 GROUP BY record_type, authority_level ORDER BY authority_level DESC, c DESC LIMIT 20').all(run.id);
for (const a of topAuth) console.log(' ', a.authority_level, '|', a.record_type, '|', a.c);

console.log('\n--- record_types with authority 1-3 ---');
const lo = db.prepare('SELECT record_type, authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND authority_level<=3 GROUP BY record_type, authority_level ORDER BY c DESC LIMIT 15').all(run.id);
for (const a of lo) console.log(' ', a.authority_level, '|', a.record_type, '|', a.c);

console.log('\n--- query_decomposition_record sample ---');
const qd = db.prepare("SELECT content, sub_phase_id FROM governed_stream WHERE workflow_run_id=? AND record_type='query_decomposition_record' AND is_current_version=1 LIMIT 1").get(run.id);
console.log('sub_phase:', qd.sub_phase_id);
console.log(JSON.stringify(JSON.parse(qd.content), null, 2).slice(0, 1800));

console.log('\n--- indexes ---');
try { const fts = db.prepare(`SELECT COUNT(*) c FROM governed_stream_fts`).get(); console.log('governed_stream_fts rows:', fts.c); } catch(e) { console.log('fts:', e.message); }
try { const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get(); console.log('governed_stream_vec rows:', vec.c); } catch(e) { console.log('vec:', e.message); }
const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE is_current_version=1').get();
console.log('current governed_stream rows:', gs.c);

console.log('\n--- material findings record_type distribution from one packet ---');
const cp = db.prepare("SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1 LIMIT 1").get(run.id);
const cpJ = JSON.parse(cp.content);
const typeCounts = {};
for (const f of (cpJ.material_findings ?? [])) {
  const t = f.record_type ?? '?';
  typeCounts[t] = (typeCounts[t] ?? 0) + 1;
}
for (const [t,c] of Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])) console.log(' ', c.toString().padStart(4), t);
console.log('total material_findings in this packet:', (cpJ.material_findings ?? []).length);
console.log('active_constraints in this packet:', (cpJ.active_constraints ?? []).length);
console.log('authority_levels_included from decomposition:', cpJ.query_decomposition?.authority_levels_included ?? cpJ.queryDecomposition?.authorityLevelsIncluded);

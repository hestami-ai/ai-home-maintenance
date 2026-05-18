/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-10/.janumicode/test-harness/1778618103737.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, current_sub_phase_id, status, initiated_at FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
const elapsedH = ((Date.now() - new Date(run.initiated_at).getTime()) / 3_600_000).toFixed(2);
console.log(`=== thin-slice-10 (elapsed ${elapsedH}h, phase ${run.current_phase_id}, sub ${run.current_sub_phase_id}, ${run.status}) ===\n`);

const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
console.log(`records: ${gs.c} · vec: ${vec.c} (${gs.c ? ((vec.c/gs.c)*100).toFixed(1) : '0'}% of records)`);

console.log('\n--- per-phase record count ---');
const phases = db.prepare(`SELECT phase_id, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND phase_id IS NOT NULL GROUP BY phase_id ORDER BY phase_id`).all(run.id);
for (const p of phases) console.log(`  phase ${p.phase_id}: ${p.c}`);

console.log('\n--- record_type top 12 ---');
const types = db.prepare(`SELECT record_type, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY record_type ORDER BY c DESC LIMIT 12`).all(run.id);
for (const t of types) console.log(`  ${String(t.c).padStart(5)} ${t.record_type}`);

console.log('\n--- reasoning_review findings by severity ---');
const sev = db.prepare(`SELECT json_extract(content, '$.severity') AS sev, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='reasoning_review_finding_record' AND is_current_version=1 GROUP BY sev ORDER BY c DESC`).all(run.id);
for (const s of sev) console.log(`  ${String(s.c).padStart(5)} ${s.sev}`);

console.log('\n--- HIGH findings with target_field populated (new contract uptake) ---');
const tf = db.prepare(`
  SELECT json_extract(content, '$.validator_id') AS v,
         SUM(CASE WHEN json_extract(content, '$.target_field') IS NOT NULL AND json_extract(content, '$.target_field') != '' THEN 1 ELSE 0 END) AS with_tf,
         COUNT(*) AS total
    FROM governed_stream
   WHERE workflow_run_id=? AND record_type='reasoning_review_finding_record' AND is_current_version=1
     AND json_extract(content, '$.severity')='HIGH'
   GROUP BY v ORDER BY total DESC LIMIT 20
`).all(run.id);
for (const r of tf) console.log(`  ${String(r.with_tf).padStart(3)}/${String(r.total).padStart(3)}  ${r.v}`);

console.log('\n--- last 5 records ---');
const last = db.prepare(`SELECT record_type, sub_phase_id, produced_at FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 ORDER BY produced_at DESC LIMIT 5`).all(run.id);
for (const r of last) console.log(`  ${r.produced_at}  ${r.sub_phase_id}  ${r.record_type}`);

console.log('\n--- auto_mitigation_action records ---');
const mit = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='auto_mitigation_action' AND is_current_version=1`).get(run.id);
console.log(`  count: ${mit.c}`);
if (mit.c > 0) {
  const samples = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='auto_mitigation_action' AND is_current_version=1 ORDER BY produced_at DESC LIMIT 3`).all(run.id);
  for (const s of samples) {
    const c = JSON.parse(s.content);
    console.log(`  · validator=${c.validator_id} action=${c.action} target=${c.target_field}/${c.target_identifier}`);
  }
}

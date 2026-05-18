/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-9/.janumicode/test-harness/1778546498732.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, status, initiated_at FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
const elapsedH = ((Date.now() - new Date(run.initiated_at).getTime()) / 3_600_000).toFixed(2);
console.log(`=== thin-slice-9 FINAL (elapsed ${elapsedH}h, phase ${run.current_phase_id}, ${run.status}) ===\n`);

const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
console.log(`records: ${gs.c} · vec: ${vec.c} (${((vec.c/gs.c)*100).toFixed(1)}% of records)`);

console.log('\n--- record_type top 15 ---');
const types = db.prepare(`SELECT record_type, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY record_type ORDER BY c DESC LIMIT 15`).all(run.id);
for (const t of types) console.log(`  ${String(t.c).padStart(5)} ${t.record_type}`);

console.log('\n--- per-phase record count ---');
const phases = db.prepare(`SELECT phase_id, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND phase_id IS NOT NULL GROUP BY phase_id ORDER BY phase_id`).all(run.id);
for (const p of phases) console.log(`  phase ${p.phase_id}: ${p.c}`);

console.log('\n--- reasoning_review findings by severity ---');
const sev = db.prepare(`SELECT json_extract(content, '$.severity') AS sev, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='reasoning_review_finding_record' AND is_current_version=1 GROUP BY sev ORDER BY c DESC`).all(run.id);
for (const s of sev) console.log(`  ${String(s.c).padStart(5)} ${s.sev}`);

console.log('\n--- top validators by HIGH findings ---');
const validators = db.prepare(`
  SELECT json_extract(content, '$.validator_id') AS v,
         SUM(CASE WHEN json_extract(content, '$.severity')='HIGH' THEN 1 ELSE 0 END) AS high,
         COUNT(*) total
    FROM governed_stream
   WHERE workflow_run_id=? AND record_type='reasoning_review_finding_record' AND is_current_version=1
   GROUP BY v ORDER BY high DESC, total DESC LIMIT 15
`).all(run.id);
for (const v of validators) console.log(`  HIGH=${String(v.high).padStart(4)} total=${String(v.total).padStart(4)} ${v.v}`);

console.log('\n--- DMR ---');
const packets = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1`).all(run.id);
let withConstraints = 0, totalConstraints = 0, completeness = {};
for (const p of packets) {
  const c = JSON.parse(p.content);
  const ac = (c.active_constraints ?? []).length;
  totalConstraints += ac;
  if (ac > 0) withConstraints++;
  const s = c.completeness_status ?? '?';
  completeness[s] = (completeness[s] ?? 0) + 1;
}
console.log(`  context_packets: ${packets.length}`);
console.log(`  packets with active_constraints > 0: ${withConstraints}/${packets.length}`);
console.log(`  total active_constraints: ${totalConstraints} (avg ${(totalConstraints/packets.length).toFixed(1)}/packet)`);
console.log(`  completeness_status:`, completeness);

console.log('\n--- Stage III ---');
const stage3 = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='agent_invocation' AND produced_by_agent_role='ingestion_pipeline_stage3' AND is_current_version=1`).get(run.id);
const proposed = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='memory_edge_proposed' AND is_current_version=1`).get(run.id);
console.log(`  Stage III LLM invocations: ${stage3.c}`);
console.log(`  memory_edge_proposed records: ${proposed.c}`);

console.log('\n--- memory_edge by type ---');
const edges = db.prepare(`SELECT edge_type, status, COUNT(*) c FROM memory_edge GROUP BY edge_type, status ORDER BY c DESC LIMIT 12`).all();
for (const e of edges) console.log(`  ${String(e.c).padStart(5)} ${e.edge_type} [${e.status}]`);

console.log('\n--- authority levels ---');
const auth = db.prepare(`SELECT authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY authority_level ORDER BY authority_level`).all(run.id);
for (const a of auth) console.log(`  level ${a.authority_level} → ${a.c}`);

console.log('\n--- auto_mitigation_action records ---');
const mit = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='auto_mitigation_action' AND is_current_version=1`).get(run.id);
console.log(`  auto_mitigation_action: ${mit.c} (policy was 'disabled' for thin-slice-9 — 0 expected)`);

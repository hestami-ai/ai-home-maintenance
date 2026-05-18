/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-9/.janumicode/test-harness/1778546498732.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, status, initiated_at FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();

const elapsedMs = Date.now() - new Date(run.initiated_at).getTime();
const elapsedH = (elapsedMs / 3_600_000).toFixed(2);
console.log(`=== thin-slice-9 (elapsed ${elapsedH}h, phase ${run.current_phase_id}, ${run.status}) ===\n`);

const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const fts = db.prepare(`SELECT COUNT(*) c FROM governed_stream_fts`).get();
const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
const newest = db.prepare('SELECT embedded_at FROM governed_stream_vec ORDER BY embedded_at DESC LIMIT 1').get();
console.log('=== A.1 Embeddings ===');
console.log(`  governed_stream:     ${gs.c} records`);
console.log(`  governed_stream_fts: ${fts.c}`);
console.log(`  governed_stream_vec: ${vec.c}  (coverage ${((vec.c/gs.c)*100).toFixed(1)}% of all records)`);
if (newest) {
  const lag = (Date.now() - new Date(newest.embedded_at).getTime()) / 1000;
  console.log(`  newest embed age:    ${lag.toFixed(0)}s`);
}

// Per record_type — embedded vs total
const SKIPPED = new Set(['json_repair_record','file_system_write_record','mirror_presented','decision_bundle_presented','execution_wave_started','execution_wave_completed','workflow_run_closure']);
const eligibleTypes = db.prepare(`
  SELECT gs.record_type, COUNT(*) AS total,
         SUM(CASE WHEN v.record_id IS NOT NULL THEN 1 ELSE 0 END) AS embedded
    FROM governed_stream gs
    LEFT JOIN governed_stream_vec v ON v.record_id = gs.id
   WHERE gs.workflow_run_id = ? AND gs.is_current_version = 1
     AND gs.record_type NOT IN (${[...SKIPPED].map(t => `'${t}'`).join(',')})
   GROUP BY gs.record_type
   ORDER BY total DESC
   LIMIT 20
`).all(run.id);
console.log('\n=== Per-type embed coverage (eligible types only) ===');
console.log('  embedded/total  record_type');
for (const r of eligibleTypes) {
  const pct = ((r.embedded / r.total) * 100).toFixed(0).padStart(3);
  console.log(`  ${String(r.embedded).padStart(5)}/${String(r.total).padStart(5)} (${pct}%) ${r.record_type}`);
}

// DMR activity
console.log('\n=== DMR (Deep Memory Research) ===');
const dmrPipes = db.prepare(`SELECT sub_phase_id, content FROM governed_stream WHERE workflow_run_id=? AND record_type='dmr_pipeline' AND is_current_version=1 ORDER BY produced_at`).all(run.id);
console.log(`  dmr_pipeline records: ${dmrPipes.length}`);
const packets = db.prepare(`SELECT sub_phase_id, content FROM governed_stream WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1 ORDER BY produced_at`).all(run.id);
console.log(`  context_packet records: ${packets.length}`);

if (packets.length > 0) {
  console.log('\n  --- Context Packet completeness + active_constraints (DMR substrate fix verification) ---');
  let withConstraints = 0, totalConstraints = 0, completenessHist = {};
  for (const p of packets) {
    const c = JSON.parse(p.content);
    const ac = (c.active_constraints ?? []).length;
    totalConstraints += ac;
    if (ac > 0) withConstraints++;
    const stat = c.completeness_status ?? '?';
    completenessHist[stat] = (completenessHist[stat] ?? 0) + 1;
  }
  console.log(`  packets with active_constraints > 0: ${withConstraints}/${packets.length}`);
  console.log(`  total active_constraints across all packets: ${totalConstraints}`);
  console.log(`  completeness_status histogram:`);
  for (const [k, v] of Object.entries(completenessHist)) console.log(`    ${v}× ${k}`);
}

// Material findings noise share (was 65-75% noise in thin-slice-5)
if (packets.length > 0) {
  console.log('\n  --- Material findings record_type distribution (sampled from latest packet) ---');
  const latest = JSON.parse(packets[packets.length - 1].content);
  const typeCounts = {};
  for (const f of (latest.material_findings ?? [])) {
    typeCounts[f.record_type ?? '?'] = (typeCounts[f.record_type ?? '?'] ?? 0) + 1;
  }
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);
  const noise = (typeCounts['agent_invocation'] ?? 0) + (typeCounts['agent_output'] ?? 0) + (typeCounts['agent_reasoning_step'] ?? 0);
  for (const [t, c] of Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).slice(0,10)) {
    console.log(`    ${String(c).padStart(4)} ${t}`);
  }
  console.log(`  noise share (agent_invocation+output+reasoning_step): ${noise}/${total} = ${((noise/total)*100).toFixed(1)}% (was ~65-75% in thin-slice-5)`);
}

// Stage III activity
console.log('\n=== C.1 Stage III LLM Relationship Extraction ===');
const stage3 = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='agent_invocation' AND produced_by_agent_role='ingestion_pipeline_stage3' AND is_current_version=1`).get(run.id);
const proposed = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='memory_edge_proposed' AND is_current_version=1`).get(run.id);
console.log(`  Stage III LLM invocations: ${stage3.c}`);
console.log(`  memory_edge_proposed records: ${proposed.c}`);

// Memory edges total
const edges = db.prepare(`SELECT edge_type, COUNT(*) c FROM memory_edge GROUP BY edge_type ORDER BY c DESC`).all();
console.log(`\n=== Memory edges by type ===`);
for (const e of edges) console.log(`  ${String(e.c).padStart(5)} ${e.edge_type}`);

// Authority distribution
console.log('\n=== B-layer Authority distribution ===');
const auth = db.prepare(`SELECT authority_level, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 GROUP BY authority_level ORDER BY authority_level`).all(run.id);
for (const a of auth) console.log(`  level ${a.authority_level} → ${a.c}`);

// Constitutional invariants
const ci = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='constitutional_invariant' AND is_current_version=1`).get(run.id);
console.log(`  constitutional_invariant records: ${ci.c} (level 7)`);

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-11/.janumicode/test-harness/1778691029124.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id, current_phase_id, current_sub_phase_id, status, initiated_at FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
const elapsedH = ((Date.now() - new Date(run.initiated_at).getTime()) / 3_600_000).toFixed(2);
console.log(`=== thin-slice-11 (elapsed ${elapsedH}h, phase ${run.current_phase_id}, sub ${run.current_sub_phase_id}, ${run.status}) ===\n`);

const gs = db.prepare('SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1').get(run.id);
const vec = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
console.log(`records: ${gs.c} · vec: ${vec.c}`);

const phases = db.prepare(`SELECT phase_id, COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND phase_id IS NOT NULL GROUP BY phase_id ORDER BY phase_id`).all(run.id);
console.log('\n--- per-phase ---');
for (const p of phases) console.log(`  phase ${p.phase_id}: ${p.c}`);

// === GAP 1 PROBE: Stage 1 LLM invocations should be ZERO ===
console.log('\n=== Gap 1: Stage 1 LLM invocations (should be 0) ===');
const stage1 = db.prepare(`
  SELECT COUNT(*) c FROM governed_stream
   WHERE workflow_run_id=? AND record_type='agent_invocation' AND is_current_version=1
     AND json_extract(content, '$.label') LIKE '%Stage 1%'`).get(run.id);
console.log(`Stage 1 LLM invocations: ${stage1.c} ${stage1.c === 0 ? '✓' : '✗ (still firing — change not effective)'}`);

// query_decomposition_record should still be written (deterministic path)
const qd = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type='query_decomposition_record' AND is_current_version=1`).get(run.id);
console.log(`query_decomposition_records (deterministic): ${qd.c}`);

// Sample a recent query_decomposition_record — check for known_conflict_zones field
const sampleQD = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='query_decomposition_record' AND is_current_version=1 ORDER BY produced_at DESC LIMIT 1`).get(run.id);
if (sampleQD) {
  const c = JSON.parse(sampleQD.content);
  console.log(`  topicEntities sample: ${JSON.stringify((c.topic_entities ?? []).slice(0, 6))}`);
  console.log(`  known_conflict_zones field present: ${c.known_conflict_zones !== undefined ? '✓' : '✗'}`);
}

// === GAP 2 PROBE: decision_context_summary on Stage 7 outputs ===
console.log('\n=== Gap 2: decision_context_summary populated ===');
const packets = db.prepare(`SELECT id, content, sub_phase_id FROM governed_stream WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1 ORDER BY produced_at DESC LIMIT 5`).all(run.id);
console.log(`Latest context_packets (last 5):`);
for (const p of packets) {
  const c = JSON.parse(p.content);
  const dcs = c.decision_context_summary;
  const present = typeof dcs === 'string' && dcs.length > 0;
  console.log(`  ${p.sub_phase_id} · decision_context_summary: ${present ? `✓ (${dcs.length} chars)` : '✗ EMPTY'}`);
  if (present) console.log(`    excerpt: ${dcs.slice(0, 150)}...`);
}

// === GAP 3 PROBE: structured query with IDs ===
console.log('\n=== Gap 3: structured queries with IDs in retrieval_brief ===');
const briefs = db.prepare(`SELECT content, sub_phase_id FROM governed_stream WHERE workflow_run_id=? AND record_type='retrieval_brief_record' AND is_current_version=1 ORDER BY produced_at DESC LIMIT 5`).all(run.id);
console.log(`Latest retrieval_briefs (last 5):`);
for (const b of briefs) {
  const c = JSON.parse(b.content);
  const q = c.query ?? '';
  const knownIds = (c.known_relevant_record_ids ?? []).length;
  // Detect ID tokens in query
  const ids = [...q.matchAll(/\b[A-Z][A-Z0-9]+-[A-Z0-9-]+\b/g)].map(m => m[0]);
  console.log(`  ${b.sub_phase_id}:`);
  console.log(`    query: ${q.slice(0, 180)}`);
  console.log(`    knownRelevantRecordIds count: ${knownIds}`);
  console.log(`    ID-shape tokens in query: ${ids.length > 0 ? ids.slice(0, 6).join(', ') : '(none)'}`);
}

console.log('\n--- last 5 records ---');
const last = db.prepare(`SELECT record_type, sub_phase_id, produced_at FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 ORDER BY produced_at DESC LIMIT 5`).all(run.id);
for (const r of last) console.log(`  ${r.produced_at}  ${r.sub_phase_id}  ${r.record_type}`);

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-10/.janumicode/test-harness/1778618103737.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();

console.log('=== DMR pipeline records ===');
const types = ['query_decomposition_record', 'context_packet', 'dmr_pipeline'];
for (const t of types) {
  const c = db.prepare(`SELECT COUNT(*) c FROM governed_stream WHERE workflow_run_id=? AND record_type=? AND is_current_version=1`).get(run.id, t);
  console.log(`  ${t}: ${c.c}`);
}

console.log('\n=== sample query_decomposition_record (Stage 1 output) ===');
const qd = db.prepare(`SELECT id, content, produced_at FROM governed_stream WHERE workflow_run_id=? AND record_type='query_decomposition_record' AND is_current_version=1 ORDER BY produced_at DESC LIMIT 1`).get(run.id);
if (qd) {
  const c = JSON.parse(qd.content);
  console.log(`id: ${qd.id}`);
  console.log(`topicEntities: ${JSON.stringify(c.topicEntities ?? c.topic_entities)}`);
  console.log(`decisionTypesSought: ${JSON.stringify(c.decisionTypesSought ?? c.decision_types_sought)}`);
  console.log(`temporalScope: ${JSON.stringify(c.temporalScope ?? c.temporal_scope)}`);
  console.log(`authorityLevels: ${JSON.stringify(c.authorityLevelsIncluded ?? c.authority_levels_included)}`);
  console.log(`sources: ${JSON.stringify(c.sourcesInScope ?? c.sources_in_scope)}`);
}

console.log('\n=== sample context_packet (Stage 7 output) ===');
const cp = db.prepare(`SELECT id, content, produced_at FROM governed_stream WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1 ORDER BY produced_at DESC LIMIT 1`).get(run.id);
if (cp) {
  const c = JSON.parse(cp.content);
  console.log(`id: ${cp.id}`);
  console.log(`decision_context_summary: ${(c.decision_context_summary ?? '').slice(0, 300)}`);
  console.log(`active_constraints count: ${(c.active_constraints ?? []).length}`);
  if ((c.active_constraints ?? []).length > 0) {
    console.log(`  sample constraint: ${JSON.stringify(c.active_constraints[0]).slice(0, 250)}`);
  }
  console.log(`supersession_chains count: ${(c.supersession_chains ?? []).length}`);
  console.log(`contradictions count: ${(c.contradictions ?? []).length}`);
  console.log(`open_questions count: ${(c.open_questions ?? []).length}`);
  console.log(`completeness_status: ${c.completeness_status}`);
  console.log(`completeness_narrative: ${(c.completeness_narrative ?? '').slice(0, 250)}`);
  console.log(`material_findings count: ${(c.material_findings ?? []).length}`);
}

console.log('\n=== Stage 7 LLM call detection (look for "Context Packet Synthesis" label in agent_invocation) ===');
const stage7Calls = db.prepare(`
  SELECT COUNT(*) c FROM governed_stream
   WHERE workflow_run_id=? AND record_type='agent_invocation' AND is_current_version=1
     AND json_extract(content, '$.label') LIKE '%Stage 7%'`).get(run.id);
console.log(`Stage 7 LLM invocations: ${stage7Calls.c}`);

const stage1Calls = db.prepare(`
  SELECT COUNT(*) c FROM governed_stream
   WHERE workflow_run_id=? AND record_type='agent_invocation' AND is_current_version=1
     AND json_extract(content, '$.label') LIKE '%Stage 1%'`).get(run.id);
console.log(`Stage 1 LLM invocations: ${stage1Calls.c}`);

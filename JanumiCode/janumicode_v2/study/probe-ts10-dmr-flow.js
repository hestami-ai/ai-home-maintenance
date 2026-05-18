/* eslint-disable @typescript-eslint/no-require-imports */
// Trace a single phase 6 DMR flow end-to-end:
//   1. The query sent to DMR
//   2. Stage 1's query_decomposition_record
//   3. Stage 7's context_packet
//   4. The implementation_planner's agent_invocation prompt (does it actually
//      contain the active_constraints?)
//   5. The implementation_planner's agent_output (did the constraints
//      influence its decisions?)

const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-10/.janumicode/test-harness/1778618103737.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();

// Pick the most recent data_model_skeleton context_packet.
const cp = db.prepare(`
  SELECT id, content, produced_at FROM governed_stream
   WHERE workflow_run_id=? AND record_type='context_packet' AND is_current_version=1
     AND sub_phase_id='data_model_skeleton'
   ORDER BY produced_at DESC LIMIT 1
`).get(run.id);
console.log('=== Step 3: context_packet (Stage 7 output) ===');
console.log('id:', cp.id);
const cpc = JSON.parse(cp.content);
console.log('completeness_status:', cpc.completeness_status);
console.log('decision_context_summary:', JSON.stringify(cpc.decision_context_summary ?? '(undefined)').slice(0, 200));
console.log('active_constraints count:', (cpc.active_constraints ?? []).length);
console.log('top 3 constraints:');
for (const c of (cpc.active_constraints ?? []).slice(0, 3)) {
  console.log(`  · auth=${c.authority_level}: ${c.statement.slice(0, 120)}`);
}
console.log('material_findings count:', (cpc.material_findings ?? []).length);

// Stage 1 query_decomposition for the same sub_phase.
const qd = db.prepare(`
  SELECT id, content FROM governed_stream
   WHERE workflow_run_id=? AND record_type='query_decomposition_record' AND is_current_version=1
     AND sub_phase_id='data_model_skeleton'
   ORDER BY produced_at DESC LIMIT 1
`).get(run.id);
console.log('\n=== Step 2: query_decomposition_record (Stage 1 output) ===');
if (qd) {
  const qc = JSON.parse(qd.content);
  console.log('topicEntities:', JSON.stringify(qc.topicEntities ?? qc.topic_entities));
  console.log('decisionTypesSought:', JSON.stringify(qc.decisionTypesSought ?? qc.decision_types_sought));
}

// Stage 1 invocation prompt — to see the actual query string.
const stage1 = db.prepare(`
  SELECT id, content FROM governed_stream
   WHERE workflow_run_id=? AND record_type='agent_invocation' AND is_current_version=1
     AND sub_phase_id='data_model_skeleton'
     AND json_extract(content, '$.label') LIKE '%Stage 1%'
   ORDER BY produced_at DESC LIMIT 1
`).get(run.id);
console.log('\n=== Step 1: Query sent to DMR (the raw query string in Stage 1 prompt) ===');
if (stage1) {
  const ic = JSON.parse(stage1.content);
  const promptText = ic.prompt ?? '';
  const queryMatch = /Query:\s*([\s\S]+?)\nScope:/.exec(promptText);
  console.log('Query (first 400 chars):', (queryMatch ? queryMatch[1] : '(not found)').slice(0, 400));
}

// implementation_planner invocation — the agent that received the context packet.
const planner = db.prepare(`
  SELECT id, content, produced_at FROM governed_stream
   WHERE workflow_run_id=? AND record_type='agent_invocation' AND is_current_version=1
     AND sub_phase_id='data_model_skeleton'
     AND json_extract(content, '$.agent_role') IN ('implementation_planner','orchestrator')
     AND json_extract(content, '$.label') NOT LIKE '%Stage%'
   ORDER BY produced_at DESC LIMIT 1
`).get(run.id);
console.log('\n=== Step 4: implementation_planner agent_invocation ===');
if (planner) {
  const pc = JSON.parse(planner.content);
  console.log('label:', pc.label);
  console.log('agent_role:', pc.agent_role);
  const prompt = pc.prompt ?? '';
  console.log('prompt length:', prompt.length, 'chars');
  // Does the prompt contain governance constraints from the packet?
  const govMatch = /GOVERNING CONSTRAINTS[\s\S]{0,2000}/i.exec(prompt);
  if (govMatch) {
    console.log('\n--- GOVERNING CONSTRAINTS section found in prompt: ---');
    console.log(govMatch[0].slice(0, 1500));
  } else {
    console.log('\n--- No GOVERNING CONSTRAINTS section found in prompt ---');
    // Look for any of the active_constraints text content
    const firstConstraint = (cpc.active_constraints ?? [])[0];
    if (firstConstraint) {
      const fragment = firstConstraint.statement.slice(0, 50);
      const inPrompt = prompt.includes(fragment);
      console.log(`First constraint fragment "${fragment}" present in planner prompt? ${inPrompt}`);
    }
  }
}

// Find the planner's output and see if it cited any of the constraint record IDs.
const plannerOut = db.prepare(`
  SELECT id, content FROM governed_stream
   WHERE workflow_run_id=? AND record_type='agent_output' AND is_current_version=1
     AND sub_phase_id='data_model_skeleton'
   ORDER BY produced_at DESC LIMIT 1
`).get(run.id);
console.log('\n=== Step 5: planner agent_output ===');
if (plannerOut) {
  const oc = JSON.parse(plannerOut.content);
  console.log('output text length:', (oc.text ?? '').length, 'chars');
  // Did the planner output cite any of the constraint source record IDs?
  const constraintIds = (cpc.active_constraints ?? []).flatMap(c => c.source_record_ids ?? []);
  let citedIds = 0;
  for (const id of constraintIds) {
    if ((oc.text ?? '').includes(id)) citedIds++;
  }
  console.log(`active_constraint source_record_ids cited in output: ${citedIds}/${constraintIds.length}`);
  // Also check thinking trace
  let thinkingCited = 0;
  for (const id of constraintIds) {
    if ((oc.thinking ?? '').includes(id)) thinkingCited++;
  }
  console.log(`active_constraint source_record_ids cited in thinking: ${thinkingCited}/${constraintIds.length}`);
}

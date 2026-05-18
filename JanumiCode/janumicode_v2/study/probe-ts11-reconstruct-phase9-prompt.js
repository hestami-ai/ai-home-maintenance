/* eslint-disable @typescript-eslint/no-require-imports */
// Reconstruct the Phase 9 prompt that WOULD be sent for one task using
// the new template + per-task DMR wiring, based on thin-slice-11 data.
// This is a read-only walkthrough — no LLM call, no DMR call, just
// render the variables from the artifacts already in the governed
// stream and show the final template output.

const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-11/.janumicode/test-harness/1778691029124.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
const TASK_ID = 'task-link-repo-uniqueness-constraint';

// Pull the implementation_plan artifact + find our task.
const planRow = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='implementation_plan' LIMIT 1`).get(run.id);
const plan = JSON.parse(planRow.content);
const task = (plan.tasks ?? []).find(t => t.id === TASK_ID);

console.log('=== TASK FROM IMPLEMENTATION_PLAN ===');
console.log('id:', task.id);
console.log('component_id:', task.component_id);
console.log('task_type:', task.task_type);
console.log('description:', task.description);
console.log('completion_criteria:', JSON.stringify(task.completion_criteria, null, 2));
console.log('write_directory_paths:', task.write_directory_paths);
console.log('dependency_task_ids:', task.dependency_task_ids);
console.log('technical_spec_ids:', task.technical_spec_ids);

// Component model + responsibility lookup
const cmRow = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='component_model' LIMIT 1`).get(run.id);
const cm = cmRow ? JSON.parse(cmRow.content) : null;
const component = cm?.components?.find(c => c.id === task.component_id);

console.log('\n=== COMPONENT CONTEXT (Phase 4) ===');
console.log('component.id:', component?.id);
console.log('component.name:', component?.name);
console.log('component.responsibility:', component?.responsibility);
console.log('\n--- component_model.summary excerpt (first 400 chars) ---');
console.log((cm?.summary ?? '').slice(0, 400));

// ADRs
const adrRow = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='adr_capture' LIMIT 1`).get(run.id);
const adrs = adrRow ? (JSON.parse(adrRow.content).adrs ?? []) : [];
console.log('\n=== GOVERNING ADRs (Phase 4) ===');
console.log(`${adrs.length} ADRs total. First 3:`);
for (const a of adrs.slice(0, 3)) console.log(`  - [${a.id}] ${a.title}: ${(a.decision ?? '').slice(0, 80)}`);

// Test cases for this component
const tpRow = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='test_plan' LIMIT 1`).get(run.id);
const tp = tpRow ? JSON.parse(tpRow.content) : null;
const relevantSuites = (tp?.test_suites ?? []).filter(s => s.component_id === task.component_id);
console.log('\n=== TASK-SPECIFIC TEST CASES (Phase 7, filtered by component_id) ===');
console.log(`${relevantSuites.length} suite(s) for component ${task.component_id}`);
for (const s of relevantSuites.slice(0, 2)) {
  console.log(`  Suite: ${s.suite_id} (${s.test_type})`);
  for (const tc of (s.test_cases ?? []).slice(0, 3)) console.log(`    - [${tc.test_case_id}] ${tc.expected_outcome}`);
}

// Eval criteria — show ALL counts and the FILTERED counts per new relevance logic
const fePlan = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='functional_evaluation_plan' LIMIT 1`).get(run.id);
const qePlan = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='quality_evaluation_plan' LIMIT 1`).get(run.id);
const reCriteria = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='reasoning_evaluation_plan' LIMIT 1`).get(run.id);

const fc = fePlan ? (JSON.parse(fePlan.content).criteria ?? []) : [];
const qc = qePlan ? (JSON.parse(qePlan.content).criteria ?? []) : [];
const rs = reCriteria ? (JSON.parse(reCriteria.content).scenarios ?? []) : [];
console.log('\n=== EVAL CRITERIA (Phase 8) ===');
console.log(`Pre-filter: functional=${fc.length}, quality=${qc.length}, reasoning=${rs.length}`);

// Compute relevance lineage like filterEvalCriteriaForTask does
const related = new Set();
let sawLineage = false;
if (task.technical_spec_ids?.length) { sawLineage = true; for (const s of task.technical_spec_ids) related.add(s); }
for (const c of task.completion_criteria ?? []) if (c.artifact_ref) { sawLineage = true; related.add(c.artifact_ref); }
for (const t of plan.tasks ?? []) {
  if (t.component_id === task.component_id) {
    for (const s of t.technical_spec_ids ?? []) { sawLineage = true; related.add(s); }
    for (const c of t.completion_criteria ?? []) if (c.artifact_ref) { sawLineage = true; related.add(c.artifact_ref); }
  }
}
const componentToken = task.component_id;
const idMatches = (id) => id && (related.has(id) || id.includes(componentToken));
const keptF = sawLineage ? fc.filter(c => idMatches(c.functional_requirement_id)) : fc;
const keptQ = sawLineage ? qc.filter(c => idMatches(c.nfr_id)) : qc;
const keptR = sawLineage ? rs.filter(s => s.description.includes(componentToken) || idMatches(s.id) || [...related].some(id => s.description.includes(id))) : rs;
console.log(`Post-filter (lineage ${sawLineage ? 'present' : 'missing — keep all'}): functional=${keptF.length}, quality=${keptQ.length}, reasoning=${keptR.length}`);
console.log(`relatedIdentifiers: ${JSON.stringify([...related])}`);

// Upstream validator findings — walk task.derived_from_record_ids
console.log('\n=== UPSTREAM VALIDATOR FINDINGS (Phase 2-5 validators) ===');
const motivIds = task.derived_from_record_ids ?? [];
console.log(`Walk path: task.derived_from_record_ids has ${motivIds.length} ids`);
if (motivIds.length > 0) {
  const findings = db.prepare(`
    SELECT id, content FROM governed_stream
     WHERE workflow_run_id=? AND record_type='reasoning_review_finding_record' AND is_current_version=1
       AND json_extract(content,'$.severity') IN ('HIGH','MEDIUM')
       AND EXISTS (
         SELECT 1 FROM json_each(derived_from_record_ids) WHERE value IN (${motivIds.map(() => '?').join(',')})
       )
     LIMIT 30
  `).all(run.id, ...motivIds);
  console.log(`HIGH/MEDIUM findings whose lineage intersects motivating artifacts: ${findings.length}`);
  for (const f of findings.slice(0, 3)) {
    const c = JSON.parse(f.content);
    console.log(`  - [${c.severity}] ${c.validator_id}: ${(c.summary ?? '').slice(0, 80)}`);
  }
} else {
  console.log('No motivating artifacts on this task — empty-case fallback would fire.');
}

// Per-task DMR query that WOULD be issued (Item 3 follow-up)
console.log('\n=== PER-TASK DMR CALL (new wiring) ===');
const specIds = task.technical_spec_ids ?? [];
const criterionRefs = (task.completion_criteria ?? []).map(c => c.artifact_ref).filter(Boolean);
const idTokens = [...new Set([task.component_id, ...specIds, ...criterionRefs])].slice(0, 20);
const query = idTokens.length > 0
  ? `Implementation of task ${task.id} on component ${task.component_id} referencing ${idTokens.join(', ')}. Retrieve governing constraints, technical specs, and known conflicts.`
  : `Implementation of task ${task.id} on component ${task.component_id}. Retrieve governing constraints and technical specs.`;
console.log(`Query: ${query}`);
console.log(`knownRelevantRecordIds: ${JSON.stringify(motivIds)}`);
console.log('\n(DMR would retrieve active_constraints + material findings + supersession + completeness narrative)');
console.log('(Result feeds {{active_constraints}} and is appended after the task-detail JSON in {{detail_file_content}})');

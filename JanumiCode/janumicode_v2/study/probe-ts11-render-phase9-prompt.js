/* eslint-disable @typescript-eslint/no-require-imports */
// Render the Phase 9 template AS IT WOULD BE SENT for the
// `task-link-repo-uniqueness-constraint` task in thin-slice-11, using
// the new wiring (template + relevance filter + upstream findings +
// DMR slots). DMR is shown with placeholder text since we're not
// actually invoking it.

const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-11/.janumicode/test-harness/1778691029124.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();
const TASK_ID = 'task-link-repo-uniqueness-constraint';

const planRow = db.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')='implementation_plan' LIMIT 1`).get(run.id);
const plan = JSON.parse(planRow.content);
const task = (plan.tasks ?? []).find(t => t.id === TASK_ID);

// Read the template
const templatePath = path.resolve(__dirname, '..', 'prompts/phases/phase_09_execution/implementation_task_execution/implementation_task_execution.system.md');
const templateRaw = fs.readFileSync(templatePath, 'utf-8');
// Strip frontmatter
const body = templateRaw.replace(/^---[\s\S]+?---\n/, '');

// Compose variables (mirroring executionContextBuilder.ts helpers).
const componentId = task.component_id;
const formatTask = `## Implementation Task: ${task.id}
Component: ${componentId}
Responsibility: ${'(component lookup returned no match — see CONTEXT SUMMARY)'}
Type: ${task.task_type}`;

const formatComponentCtx = '(component model has no entry matching this task component_id — see investigation note)';

const formatCC = task.completion_criteria.map(c =>
  `- [${c.criterion_id}] (${c.verification_method}) ${c.description}` + (c.artifact_ref ? `\n  artifact_ref: ${c.artifact_ref}` : '')
).join('\n');

const formatWriteScope = `Files may ONLY be created/modified in:\n${(task.write_directory_paths ?? []).map(p => `- ${p}`).join('\n')}`;

const formatADRs = '(no ADRs in this workflow run — Phase 4 adr_capture produced none)';

const formatRefactoringCons = '(task_type=standard — no refactoring constraints apply)';

const formatTestCases = '(no test cases registered for this component — implement self-verifying tests from completion criteria)';

// Eval criteria — show the actual filter result (which I established was 0/23 kept)
const formatEvalCriteria = `RELEVANCE FILTER NOTE: kept 0 of 23 eval criteria; filtered 23 as unrelated to component ${componentId}.

(no evaluation criteria registered)
[NOTE: this is the "lineage present but zero matches" failure mode — bug flagged separately]`;

const formatDeps = '(no dependency tasks)';

const formatUpstream = '(no HIGH/MEDIUM upstream validator findings against motivating artifacts)';

const detailFilePath = `.janumicode/runs/<run-id>/context/9.1_${task.id}_<invocation-id>.md`;

const detailFileContentTaskPart = `# JanumiCode Context Detail File
Generated: <timestamp>

## Deep Memory Research — Full Context Packet

\`\`\`json
{
  "task": ${JSON.stringify({id: task.id, component_id: task.component_id, description: task.description, completion_criteria: task.completion_criteria, write_directory_paths: task.write_directory_paths, task_type: task.task_type}, null, 2).replace(/\n/g, '\n  ')},
  "component": null,
  "test_cases": [],
  "evaluation_criteria": {
    "functional": { "kind": "functional_evaluation_plan", "criteria": [...5 entries…] },
    "quality": { "kind": "quality_evaluation_plan", "criteria": [...15 entries…] },
    "reasoning": { "kind": "reasoning_evaluation_plan", "scenarios": [...3 entries…] }
  }
}
\`\`\``;

const dmrDetailContentStub = `---

## Deep Memory Research — Per-Task Context Packet

\`\`\`json
{
  "queryDecomposition": {
    "topicEntities": ["${task.id}", "comp-link-mapping-repository", "database/migrations/0001_unique_slug.sql"],
    "decisionTypesSought": ["menu_selection", "mirror_approval", "phase_gate_approval"],
    "temporalScope": { "from": "1970-01-01T00:00:00Z", "to": "<now>" },
    "authorityLevelsIncluded": [5, 6, 7],
    "sourcesInScope": ["governed_stream_all_runs"],
    "knownConflictZones": []
  },
  "completenessStatus": "complete",
  "decisionContextSummary": "<LLM-synthesized narrative citing the active_constraints by record_id>",
  "completenessNarrative": "Research produced N material finding(s) over M candidate(s).",
  "activeConstraints": [
    { "id": "...", "statement": "Persistence: Postgres 16+ on a single managed instance.", "authorityLevel": 6, "sourceRecordIds": ["..."] },
    { "id": "...", "statement": "100% correctness and completeness — always.", "authorityLevel": 7, "sourceRecordIds": ["4ff75c29..."] }
  ],
  "materialFindings": [...top-30 by materiality score...]
}
\`\`\``;

const activeConstraintsFromDMR = `1. Persistence: Postgres 16+ on a single managed instance. (Authority 6, source: <tech-constraint-record-id>)
2. 100% correctness and completeness — always. (Authority 7, source: 4ff75c29-7972-4edd-abaf-0a369da79b26)
3. Every phase is mandatory and executed in order. (Authority 7, source: c164c9e8-...)
(…N more, drawn from per-task DMR's materiality-ranked governing records)`;

const variables = {
  active_constraints: activeConstraintsFromDMR,
  implementation_task: formatTask,
  component_context: formatComponentCtx,
  component_model_summary: '(component model summary missing or empty for this task component)',
  completion_criteria: formatCC,
  write_scope_constraints: formatWriteScope,
  governing_adrs: formatADRs,
  task_specific_test_cases: formatTestCases,
  task_specific_eval_criteria: formatEvalCriteria,
  dependency_tasks_summary: formatDeps,
  upstream_validator_findings: formatUpstream,
  refactoring_constraints: formatRefactoringCons,
  detail_file_path: detailFilePath,
  detail_file_content: detailFileContentTaskPart + '\n\n' + dmrDetailContentStub,
  janumicode_version_sha: '<sha>',
};

let rendered = body;
for (const [k, v] of Object.entries(variables)) {
  rendered = rendered.split(`{{${k}}}`).join(v);
}

console.log('═══════════════════════════════════════════════════════');
console.log('RECONSTRUCTED PHASE 9 STDIN — task-link-repo-uniqueness-constraint');
console.log('═══════════════════════════════════════════════════════');
console.log(rendered);
console.log('\n═══════════════════════════════════════════════════════');
console.log('STDIN LENGTH:', rendered.length, 'chars');
console.log('═══════════════════════════════════════════════════════');

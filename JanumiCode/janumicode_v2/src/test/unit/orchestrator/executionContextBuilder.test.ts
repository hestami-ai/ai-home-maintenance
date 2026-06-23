/**
 * Unit tests for the Phase 9 ExecutionContextBuilder (cal-23 refactor).
 *
 * Validates that:
 *   - the prompt is rendered from the executor_agent template (not
 *     hardcoded section assembly)
 *   - filterEvalCriteriaForTask reduces eval criteria when the task's
 *     component_id is set and lineage is present
 *   - findUpstreamFindingsForTask surfaces HIGH/MEDIUM findings whose
 *     derived_from_record_ids match the task's derived lineage
 *   - empty-case fallback strings render when artifacts are absent
 */

import { describe, it, expect } from 'vitest';
import {
  ExecutionContextBuilder,
  filterEvalCriteriaForTask,
  findUpstreamFindingsForTask,
  type ImplementationTask,
  type EvaluationPlans,
  type TestPlan,
} from '../../../lib/orchestrator/executionContextBuilder';
import { GovernedStreamWriter as RealGovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { createTestDatabase } from '../../../lib/database/init';
import { TemplateLoader, type PromptTemplate } from '../../../lib/orchestrator/templateLoader';
import type { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import type { GovernedStreamRecord, RecordType } from '../../../lib/types/records';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function makeTask(overrides: Partial<ImplementationTask> = {}): ImplementationTask {
  return {
    id: 'task-1',
    task_type: 'standard',
    component_id: 'comp-foo',
    component_responsibility: 'Handles foo concerns',
    description: 'Implement foo',
    backing_tool: 'claude_code_cli',
    estimated_complexity: 'medium',
    completion_criteria: [{
      criterion_id: 'cc-1',
      description: 'foo works',
      verification_method: 'test_execution',
    }],
    write_directory_paths: ['src/foo/'],
    derived_from_record_ids: ['art-fr-1', 'art-comp-1'],
    technical_spec_ids: ['FR-001'],
    ...overrides,
  };
}

function makeFakeWriter(records: GovernedStreamRecord[]): GovernedStreamWriter {
  // Minimal duck-typed fake; the builder only uses getRecordsByType.
  return {
    getRecordsByType: (_runId: string, recordType: RecordType) =>
      records.filter(r => r.record_type === recordType),
  } as unknown as GovernedStreamWriter;
}

function fakeFinding(opts: {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  derived: string[];
  summary?: string;
}): GovernedStreamRecord {
  return {
    id: opts.id,
    record_type: 'reasoning_review_finding_record',
    schema_version: '1.0',
    workflow_run_id: 'wf-1',
    phase_id: '2',
    produced_by_agent_role: 'review_harness',
    janumicode_version_sha: 'test',
    derived_from_record_ids: opts.derived,
    produced_at: new Date().toISOString(),
    is_current_version: 1,
    content: {
      kind: 'reasoning_review_finding',
      harness_id: 'h-1',
      validator_id: 'v-1',
      severity: opts.severity,
      finding_type: 'demo',
      summary: opts.summary ?? `summary for ${opts.id}`,
      location: 'somewhere',
      detail: 'detail',
      recommendation: 'fix it',
      duration_ms: 1,
    },
  } as unknown as GovernedStreamRecord;
}

describe('filterEvalCriteriaForTask', () => {
  it('filters out unrelated quality criteria when lineage is present', () => {
    const plans: EvaluationPlans = {
      quality: {
        criteria: [
          { nfr_id: 'NFR-001-comp-foo', category: 'perf', evaluation_tool: 'bench', threshold: 'p95<200', measurement_method: 'auto' },
          { nfr_id: 'NFR-099-other', category: 'sec', evaluation_tool: 'scan', threshold: 'A', measurement_method: 'auto' },
        ],
      },
    };
    const task = makeTask({ technical_spec_ids: ['FR-001'] });
    const result = filterEvalCriteriaForTask(plans, task, null, null);
    expect(result.filteredQuality).toBe(1);
    expect(result.keptQuality).toBe(1);
    expect(result.rendered).toContain('RELEVANCE FILTER NOTE');
    expect(result.rendered).toContain('NFR-001-comp-foo');
    expect(result.rendered).not.toContain('NFR-099-other');
  });

  it('keeps all when lineage is unknown (no technical_spec_ids or artifact_refs)', () => {
    const plans: EvaluationPlans = {
      functional: {
        criteria: [
          { functional_requirement_id: 'FR-A', evaluation_method: 'm', success_condition: 'c' },
          { functional_requirement_id: 'FR-B', evaluation_method: 'm', success_condition: 'c' },
        ],
      },
    };
    const task = makeTask({
      technical_spec_ids: undefined,
      completion_criteria: [{ criterion_id: 'cc-1', description: 'x', verification_method: 'invariant' }],
    });
    const result = filterEvalCriteriaForTask(plans, task, null, null);
    expect(result.filteredFunctional).toBe(0);
    expect(result.keptFunctional).toBe(2);
    expect(result.rendered).toContain('lineage data missing');
  });
});

describe('findUpstreamFindingsForTask', () => {
  it('surfaces HIGH/MEDIUM findings whose source matches task lineage', () => {
    const records = [
      fakeFinding({ id: 'f1', severity: 'HIGH', derived: ['art-fr-1'], summary: 'fr ambiguity' }),
      fakeFinding({ id: 'f2', severity: 'LOW', derived: ['art-fr-1'], summary: 'minor nit' }),
      fakeFinding({ id: 'f3', severity: 'MEDIUM', derived: ['art-other'], summary: 'unrelated' }),
    ];
    const writer = makeFakeWriter(records);
    const out = findUpstreamFindingsForTask(makeTask(), writer, 'wf-1');
    expect(out).toContain('fr ambiguity');
    expect(out).not.toContain('minor nit');     // LOW excluded
    expect(out).not.toContain('unrelated');     // lineage mismatch
  });

  it('falls back to empty-case message when no findings match', () => {
    const writer = makeFakeWriter([]);
    const out = findUpstreamFindingsForTask(makeTask(), writer, 'wf-1');
    expect(out).toBe('(no HIGH/MEDIUM upstream validator findings against motivating artifacts)');
  });
});

describe('ExecutionContextBuilder.buildTaskContext', () => {
  it('renders the executor_agent template into the stdin text', () => {
    const loader = new TemplateLoader(REPO_ROOT);
    const tpl = loader.findTemplate('executor_agent', 'implementation_task_execution');
    expect(tpl).not.toBeNull();
    expect((tpl as PromptTemplate).metadata.required_variables).toContain('upstream_validator_findings');

    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never,
      writer,
      {
        stdinMaxTokens: 16000,
        detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp',
        janumiCodeVersionSha: 'sha-test',
        activeConstraints: 'Use TypeScript strict mode',
      },
      loader,
    );

    const payload = builder.buildTaskContext(
      makeTask({ active_constraints: ['TECH-FOO-1'] }),
      'wf-1',
      'inv-1',
      {
        implementationPlan: null,
        testPlan: null,
        evaluationPlans: {},
        componentModel: null,
        technicalSpecs: null,
        adrs: [],
      },
    );

    // Template-rendered headings should appear; not the legacy
    // `## Implementation Task:` from the old hardcoded path.
    expect(payload.stdin.text).toContain('# GOVERNING CONSTRAINTS');
    expect(payload.stdin.text).toContain('## Completion Criteria');
    // Executor active_constraints = the TASK's technical constraints, NOT the
    // workflow's process governance (options.activeConstraints is no longer fed
    // to the executor — it was Authority-7 process noise).
    expect(payload.stdin.text).toContain('TECH-FOO-1');
    expect(payload.stdin.text).not.toContain('Use TypeScript strict mode');
    expect(payload.stdin.text).toContain('Implement foo');
    // Empty-case fallbacks render:
    expect(payload.stdin.text).toContain('(no test cases registered for this component');
    expect(payload.stdin.text).toContain('(no HIGH/MEDIUM upstream validator findings');
  });

  // Regression (slice-151): the Phase-9 executor runs inside the projectRoot
  // cwd-sandbox, where the control-plane `.janumicode/runs/…` detail-file path is
  // unreadable. The curated DMR context must therefore be INLINED by default, not
  // pointed at via a dead on-disk reference (0/23 leaves could read it before).
  it('inlines the curated DMR context by default (on-disk pointer is the opt-out)', () => {
    const prev = process.env.JANUMICODE_INLINE_DMR;
    delete process.env.JANUMICODE_INLINE_DMR;
    try {
      const loader = new TemplateLoader(REPO_ROOT);
      const writer = makeFakeWriter([]);
      const builder = new ExecutionContextBuilder(
        {} as never, writer,
        { stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000, detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md', workspacePath: '/tmp', janumiCodeVersionSha: 'sha-test' },
        loader,
      );
      const dmrPacket = { detailFileContent: 'DMR_SUPERSESSION_MARKER_XYZ', detailFilePath: '/tmp/wf-1/dmr.md' } as never;
      const payload = builder.buildTaskContext(
        makeTask({}), 'wf-1', 'inv-1',
        { implementationPlan: null, testPlan: null, evaluationPlans: {}, componentModel: null, technicalSpecs: null, adrs: [] },
        undefined, dmrPacket,
      );
      // DMR body is embedded (readable by a sandboxed executor), NOT replaced by
      // a "read it from disk" pointer.
      expect(payload.stdin.text).toContain('DMR_SUPERSESSION_MARKER_XYZ');
      expect(payload.stdin.text).not.toContain('Read it selectively if you need supporting governing context');
      // The "# DETAIL FILE — Path:" pointer must NOT send the agent to the
      // now-redundant unreadable file; it surfaces the inlined-above sentinel.
      expect(payload.stdin.text).not.toContain('/tmp/wf-1/dmr.md');
      expect(payload.stdin.text).toContain('the full curated context is inlined above');
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_INLINE_DMR; else process.env.JANUMICODE_INLINE_DMR = prev;
    }
  });

  it('honors JANUMICODE_INLINE_DMR=0 to keep the on-disk DMR pointer (non-sandboxed runs)', () => {
    const prev = process.env.JANUMICODE_INLINE_DMR;
    process.env.JANUMICODE_INLINE_DMR = '0';
    try {
      const loader = new TemplateLoader(REPO_ROOT);
      const writer = makeFakeWriter([]);
      const builder = new ExecutionContextBuilder(
        {} as never, writer,
        { stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000, detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md', workspacePath: '/tmp', janumiCodeVersionSha: 'sha-test' },
        loader,
      );
      const dmrPacket = { detailFileContent: 'DMR_SUPERSESSION_MARKER_XYZ', detailFilePath: '/tmp/wf-1/dmr.md' } as never;
      const payload = builder.buildTaskContext(
        makeTask({}), 'wf-1', 'inv-1',
        { implementationPlan: null, testPlan: null, evaluationPlans: {}, componentModel: null, technicalSpecs: null, adrs: [] },
        undefined, dmrPacket,
      );
      expect(payload.stdin.text).not.toContain('DMR_SUPERSESSION_MARKER_XYZ');
      expect(payload.stdin.text).toContain('Read it selectively');
      // Opt-out keeps the real on-disk path (readable in a non-sandboxed run).
      expect(payload.stdin.text).toContain('/tmp/wf-1/dmr.md');
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_INLINE_DMR; else process.env.JANUMICODE_INLINE_DMR = prev;
    }
  });

  it('sources the detail bundle test_cases + evals from the packet, and renders CC as the gate with covering tests', () => {
    const loader = new TemplateLoader(REPO_ROOT);
    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never,
      writer,
      { stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000, detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md', workspacePath: '/tmp', janumiCodeVersionSha: 'sha-test' },
      loader,
    );

    // A whole-project test plan + eval plan that the raw-artifact heuristics
    // would mis-scope (root component_id ≠ task leaf; keep-all evals).
    const artifacts = {
      implementationPlan: null,
      testPlan: { test_suites: [
        { suite_id: 'TS-ROOT', component_id: 'comp-root', test_type: 'unit' as const,
          test_cases: [{ test_case_id: 'TC-DEL', type: 'unit' as const, acceptance_criterion_ids: ['AC-1'], preconditions: [], expected_outcome: 'deleted' }] },
      ] },
      evaluationPlans: { functional: { criteria: [
        { functional_requirement_id: 'US-001', evaluation_method: 'm', success_condition: 's' },
        { functional_requirement_id: 'US-999', evaluation_method: 'unrelated', success_condition: 's' },
      ] } },
      componentModel: null,
      technicalSpecs: null,
      adrs: [],
    };

    const packet = {
      kind: 'implementation_packet', schemaVersion: '1.0', packet_id: 'pkt-1',
      task: {
        id: 'task-leaf', node_id: 'n1', name: 't', description: 'd', task_type: 'standard', estimated_complexity: 'low',
        completion_criteria: [
          { criterion_id: 'CC-1', description: 'delete rows', verification_method: 'test_execution', covered_by_test_ids: ['TC-DEL'] },
          { criterion_id: 'CC-2', description: 'return 200', verification_method: 'test_execution', covered_by_test_ids: [] },
        ],
        write_directory_paths: ['src/leaf'], read_directory_paths: [], dependency_task_ids: [],
      },
      user_stories: [], nfrs: [],
      component: { id: 'comp-leaf', name: 'L', domain_id: null, responsibilities: [], dependencies: [], active_constraints: [] },
      data_models: [], api_definitions: [],
      test_cases: [{ test_case_id: 'TC-DEL', type: 'unit', acceptance_criterion_ids: ['AC-1'], preconditions: [], expected_outcome: 'deleted' }],
      evaluation_criteria: [{ kind: 'functional', target_id: 'US-001', evaluation_method: 'm', success_condition: 's' }],
      active_constraints: [], compliance_items: [], depends_on_packets: [],
      coherence: { passed: true, blocking_failures: [], advisory_findings: [], annotations: { ai_proposed_root_count: 0, ai_proposed_root_ids: [] } },
      release_id: null, release_ordinal: null,
    } as never;

    const payload = builder.buildTaskContext(
      makeTask({ id: 'task-leaf', component_id: 'comp-leaf' }),
      'wf-1', 'inv-1', artifacts, undefined, null, null, packet,
    );
    const detail = payload.detailFile?.content ?? '';
    // Detail bundle test_cases come from the packet (TC-DEL present), NOT the
    // root-suite re-derivation that would mismatch comp-leaf and yield [].
    expect(detail).toContain('TC-DEL');
    // Eval bundle is the packet's scoped eval (US-001), not the unrelated US-999.
    expect(detail).toContain('US-001');
    expect(detail).not.toContain('US-999');
    // Completion criteria render as the authoritative gate with covering tests.
    expect(payload.stdin.text).toContain('AUTHORITATIVE pass/fail gate');
    expect(payload.stdin.text).toMatch(/Covering test\(s\): TC-DEL/);
    expect(payload.stdin.text).toContain('you MUST author a test'); // CC-2 uncovered
  });

  it('filters ADRs to those governing the task component + global ADRs (structural, via governs_components)', () => {
    const loader = new TemplateLoader(REPO_ROOT);
    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never, writer,
      { stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000, detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md', workspacePath: '/tmp', janumiCodeVersionSha: 'sha-test' },
      loader,
    );
    const payload = builder.buildTaskContext(
      makeTask({ component_id: 'comp-foo' }),
      'wf-1', 'inv-1',
      {
        implementationPlan: null, testPlan: null, evaluationPlans: {}, componentModel: null, technicalSpecs: null,
        adrs: [
          { id: 'ADR-FOO', title: 'Foo decision', decision: 'do foo', governs_components: ['comp-foo'] },
          { id: 'ADR-PDF', title: 'PDF Report Generation', decision: 'render pdfs', governs_components: ['comp-reports'] },
          { id: 'ADR-HTTPS', title: 'HTTPS only', decision: 'tls everywhere' }, // global (no governs list)
        ],
      },
    );
    expect(payload.stdin.text).toContain('ADR-FOO');
    expect(payload.stdin.text).toContain('ADR-HTTPS');      // global → kept
    expect(payload.stdin.text).not.toContain('ADR-PDF');    // other component → dropped
    expect(payload.stdin.text).not.toContain('PDF Report Generation');
  });

  it('falls back to legacy inline assembly when no templateLoader is supplied', () => {
    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never,
      writer,
      {
        stdinMaxTokens: 16000,
        detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp',
        janumiCodeVersionSha: 'sha-test',
      },
      // no templateLoader
    );

    const payload = builder.buildTaskContext(
      makeTask(),
      'wf-1',
      'inv-1',
      {
        implementationPlan: null,
        testPlan: null,
        evaluationPlans: {},
        componentModel: null,
        technicalSpecs: null,
        adrs: [],
      },
    );

    expect(payload.stdin.text).toContain('GOVERNING CONSTRAINTS');
    expect(payload.stdin.text).toContain('## Implementation Task: task-1');
  });

  it('includes filtered eval-criteria note when criteria are provided', () => {
    const loader = new TemplateLoader(REPO_ROOT);
    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never, writer,
      {
        stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp', janumiCodeVersionSha: 'sha-test',
      },
      loader,
    );

    const evalPlans: EvaluationPlans = {
      quality: { criteria: [
        { nfr_id: 'NFR-comp-foo', category: 'perf', evaluation_tool: 'bench', threshold: 'p95<200', measurement_method: 'auto' },
        { nfr_id: 'NFR-other', category: 'sec', evaluation_tool: 'scan', threshold: 'A', measurement_method: 'auto' },
      ] },
    };

    const testPlan: TestPlan = { test_suites: [] };
    const payload = builder.buildTaskContext(makeTask(), 'wf-1', 'inv-1', {
      implementationPlan: null, testPlan, evaluationPlans: evalPlans,
      componentModel: null, technicalSpecs: null, adrs: [],
    });

    expect(payload.stdin.text).toContain('RELEVANCE FILTER NOTE');
    expect(payload.stdin.text).toContain('NFR-comp-foo');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Regression: upstream data alignment with Phase 4 / Phase 6 / Phase 7
//
// Pins the three field-name / id-prefix mismatches that thin-slice-11
// surfaced empirically:
//   1. Phase 4's adr_capture emits `kind: 'architectural_decisions'`
//      carrying `adrs[]`. The prior extractArtifacts only matched
//      `case 'adr'` and surfaced 0 ADRs on every run.
//   2. Phase 6's implementation_planner prepends `comp-` to component
//      ids (`comp-foo`), while Phase 4's component_model and Phase 7's
//      test_plan use the bare slug (`foo`). The naive `===` lookups
//      missed every task on every run.
//   3. Phase 6 emits per-task lineage as `traces_to`, but the consumer
//      was reading `technical_spec_ids` / `derived_from_record_ids` —
//      no overlap, 0/N tasks ever had detectable lineage.
//
// Each test below is fail-to-pass against the pre-fix code (would have
// returned 0 matches / 0 ADRs / null lineage) and pass-to-pass against
// the fixed code (correctly resolves the artifact).
// ─────────────────────────────────────────────────────────────────────
describe('extractArtifacts — Phase 4 architectural_decisions surfacing', () => {
  it('flattens an architectural_decisions artifact\'s adrs[] into per-ADR shape', () => {
    const db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run('wf-extract-1');
    let n = 0;
    const writer = new RealGovernedStreamWriter(db, () => `xa-${++n}`);
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'wf-extract-1',
      phase_id: '4',
      sub_phase_id: 'adr_capture',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: 'dev',
      content: {
        kind: 'architectural_decisions',
        adrs: [
          { id: 'JC-ADR-001', title: 'Cipher Suite', status: 'proposed', decision: 'AES-256-GCM at rest.' },
          { id: 'JC-ADR-002', title: 'Container Image', status: 'proposed', decision: 'Single Node container per the constraint.' },
        ],
      },
    });

    const builder = new ExecutionContextBuilder(
      db as never, writer,
      {
        stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp', janumiCodeVersionSha: 'dev',
      },
    );
    const artifacts = builder.extractArtifacts('wf-extract-1');
    expect(artifacts.adrs).toHaveLength(2);
    expect(artifacts.adrs[0].id).toBe('JC-ADR-001');
    expect(artifacts.adrs[0].title).toBe('Cipher Suite');
    expect(artifacts.adrs[1].decision).toContain('Single Node container');
    db.close();
  });

  it('legacy "adr" kind still surfaces one-record-per-ADR (pass-to-pass)', () => {
    const db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run('wf-extract-2');
    let n = 0;
    const writer = new RealGovernedStreamWriter(db, () => `xa-legacy-${++n}`);
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'wf-extract-2',
      phase_id: '4',
      sub_phase_id: 'adr_capture',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: 'dev',
      content: { kind: 'adr', id: 'ADR-X', title: 'Single ADR', decision: 'Do the thing.' },
    });

    const builder = new ExecutionContextBuilder(
      db as never, writer,
      {
        stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp', janumiCodeVersionSha: 'dev',
      },
    );
    const artifacts = builder.extractArtifacts('wf-extract-2');
    expect(artifacts.adrs).toHaveLength(1);
    expect(artifacts.adrs[0].id).toBe('ADR-X');
    db.close();
  });
});

describe('comp- prefix tolerance — Phase 6 ↔ Phase 4/7 id alignment', () => {
  it('formatComponentContext resolves task `comp-foo` against component_model `foo`', () => {
    const loader = new TemplateLoader(REPO_ROOT);
    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never, writer,
      {
        stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp', janumiCodeVersionSha: 'dev',
      },
      loader,
    );
    const task = makeTask({ component_id: 'comp-foo' });
    const payload = builder.buildTaskContext(task, 'wf-1', 'inv-1', {
      implementationPlan: null, testPlan: null, evaluationPlans: {},
      componentModel: {
        summary: 'two-component system',
        components: [{ id: 'foo', name: 'FooComponent', responsibility: 'Handles foo concerns' }],
      },
      technicalSpecs: null, adrs: [],
    });
    // The bare-slug component should be resolved — the prompt now shows
    // its name + responsibility instead of falling back to the task's
    // task.component_responsibility string verbatim.
    expect(payload.stdin.text).toContain('Name: FooComponent');
    expect(payload.stdin.text).toContain('Handles foo concerns');
  });

  it('formatTestCasesForComponent matches test_plan suite `foo` against task `comp-foo`', () => {
    const loader = new TemplateLoader(REPO_ROOT);
    const writer = makeFakeWriter([]);
    const builder = new ExecutionContextBuilder(
      {} as never, writer,
      {
        stdinMaxTokens: 16000, detailFileMaxBytes: 1_000_000,
        detailFilePathTemplate: '/tmp/{workflow_run_id}/{sub_phase_id}_{invocation_id}.md',
        workspacePath: '/tmp', janumiCodeVersionSha: 'dev',
      },
      loader,
    );
    const testPlan: TestPlan = { test_suites: [{
      suite_id: 'S-1',
      component_id: 'foo',
      test_type: 'unit',
      test_cases: [{ test_case_id: 'tc-1', type: 'unit', expected_outcome: 'foo() returns bar' }],
    } as unknown as TestPlan['test_suites'][number]] };
    const payload = builder.buildTaskContext(
      makeTask({ component_id: 'comp-foo' }), 'wf-1', 'inv-1',
      { implementationPlan: null, testPlan, evaluationPlans: {}, componentModel: null, technicalSpecs: null, adrs: [] },
    );
    expect(payload.stdin.text).toContain('foo() returns bar');
    expect(payload.stdin.text).not.toContain('no test cases registered');
  });
});

describe('traces_to as canonical lineage source — Phase 6 emission alignment', () => {
  it('filterEvalCriteriaForTask reads traces_to as lineage (not just technical_spec_ids)', () => {
    const plans: EvaluationPlans = {
      quality: {
        criteria: [
          { nfr_id: 'NFR-007', category: 'reliability', evaluation_tool: 't', threshold: 'x', measurement_method: 'auto' },
          { nfr_id: 'NFR-099-other', category: 'sec', evaluation_tool: 't', threshold: 'x', measurement_method: 'auto' },
        ],
      },
    };
    // Phase 6 emits traces_to, NOT technical_spec_ids.
    const task = makeTask({
      component_id: 'foo',
      technical_spec_ids: undefined,
      traces_to: ['NFR-007', 'foo'],
    });
    const result = filterEvalCriteriaForTask(plans, task, null, null);
    expect(result.keptQuality).toBe(1);
    expect(result.filteredQuality).toBe(1);
    expect(result.rendered).toContain('NFR-007');
    expect(result.rendered).not.toContain('NFR-099-other');
  });

  it('falls back to keep-all when lineage tokens are present but match nothing (regression fix)', () => {
    const plans: EvaluationPlans = {
      functional: {
        criteria: [
          { functional_requirement_id: 'US-001', evaluation_method: 'm', success_condition: 'c' },
          { functional_requirement_id: 'US-002', evaluation_method: 'm', success_condition: 'c' },
        ],
      },
    };
    // Lineage present, but the tokens are file paths from artifact_ref
    // — they don't match any US-* id. Without the zero-match fallback
    // the filter would have dropped both criteria. With the fallback,
    // it keeps all and emits a clarifying note.
    const task = makeTask({
      component_id: 'unrelated-component',
      technical_spec_ids: undefined,
      traces_to: undefined,
      completion_criteria: [
        { criterion_id: 'cc-1', description: 'x', verification_method: 'invariant', artifact_ref: 'database/migrations/0001.sql' },
        { criterion_id: 'cc-2', description: 'y', verification_method: 'invariant', artifact_ref: 'database/migrations/0001.test.ts' },
      ],
    });
    const result = filterEvalCriteriaForTask(plans, task, null, null);
    expect(result.keptFunctional).toBe(2);
    expect(result.filteredFunctional).toBe(0);
    expect(result.rendered).toContain('lineage tokens did not match');
    expect(result.rendered).toContain('US-001');
    expect(result.rendered).toContain('US-002');
  });

  it('findUpstreamFindingsForTask walks traces_to (in addition to derived_from_record_ids)', () => {
    const records = [
      fakeFinding({ id: 'f1', severity: 'HIGH', derived: ['SR-009'], summary: 'sr ambiguity for SR-009' }),
      fakeFinding({ id: 'f2', severity: 'MEDIUM', derived: ['SR-other'], summary: 'unrelated other' }),
    ];
    const writer = makeFakeWriter(records);
    // Phase 6's tasks have traces_to populated, derived_from_record_ids absent.
    const task = makeTask({
      derived_from_record_ids: undefined,
      traces_to: ['SR-009', 'comp-foo'],
    });
    const out = findUpstreamFindingsForTask(task, writer, 'wf-1');
    expect(out).toContain('sr ambiguity for SR-009');
    expect(out).not.toContain('unrelated other');
  });
});

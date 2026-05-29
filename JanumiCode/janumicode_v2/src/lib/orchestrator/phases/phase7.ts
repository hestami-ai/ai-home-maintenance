/**
 * Phase 7 — Test Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 7.
 *
 * Sub-phases:
 *   7.1 — Test Case Generation (Test Design Agent LLM call)
 *   7.2 — Test Coverage Analysis (deterministic)
 *   7.3 — Test Plan Mirror and Menu (human review)
 *   7.4 — Approval (phase gate)
 */

import { randomUUID } from 'node:crypto';
import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type {
  PhaseId,
  TechnicalConstraint,
  DecompositionTestCase,
  TestDecompositionNodeContent,
  GovernedStreamRecord,
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveFrView } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { runTestSaturationLoop } from './phase7_1a';
import { runPhase7CycleDelta } from './runCycleDelta';
import { emit as aoddEmit } from '../../aodd';
import { buildCanonicalAcIndex, resolveAcReferences, type CanonicalAcIndex } from './phase7/acRefResolver';
import { runDownstreamScopeGatekeeper } from './downstreamGatekeeper';

// ── Artifact shape interfaces ──────────────────────────────────────

interface TestCase {
  test_case_id: string;
  type: 'unit' | 'integration' | 'end_to_end';
  acceptance_criterion_ids: string[];
  component_ids?: string[];
  preconditions: string[];
  inputs?: Record<string, unknown>;
  execution_steps?: string[];
  expected_outcome: string;
  edge_cases?: string[];
  implementation_notes?: string;
}

interface TestSuite {
  suite_id: string;
  component_id: string;
  test_type: 'unit' | 'integration' | 'end_to_end';
  runner_command?: string;
  test_cases: TestCase[];
}

interface TestPlan {
  test_suites: TestSuite[];
  total_test_cases?: number;
  coverage_by_type?: { unit: number; integration: number; end_to_end: number };
}

interface TestCoverageReport {
  gaps: Array<{ acceptance_criterion_id: string; reason: string }>;
  component_gaps: Array<{ component_id: string; reason: string }>;
  coverage_percentage: number;
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase7Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '7';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Cycle-delta short-circuit ───────────────────────────────
    if ((workflowRun.current_cycle_number ?? 0) > 0) {
      return runPhase7CycleDelta(ctx);
    }

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    // Wave 6 — prefer frozen leaves when Phase 2.1a produced a
    // decomposition tree; fall back to root FRs otherwise. Test coverage
    // benefits most from the leaf-level AC set because each leaf carries
    // individually-testable acceptance criteria.
    const decompositionNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
    const frView = buildEffectiveFrView(decompositionNodes, prior);
    const frSummary = frView.summary;
    const planSummary = prior.implementationPlan?.summary ?? 'No implementation plan available';
    const componentSummary = prior.componentModel?.summary ?? 'No component model available';

    // Collect all acceptance criterion IDs for coverage analysis
    const allAcIds: string[] = [];
    const frStories = frView.stories;
    for (const story of frStories) {
      for (const ac of (story.acceptance_criteria as Array<Record<string, unknown>>) ?? []) {
        if (ac.id) allAcIds.push(ac.id as string);
      }
    }

    // Canonical AC index drives the deterministic ref-resolver applied
    // before this phase persists. See phase7/acRefResolver.ts header.
    const canonicalAcIndex = buildCanonicalAcIndex(frStories);

    const derivedFromIds = prior.allRecordIds;

    // ── 7.1 — Test Case Generation ────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'test_case_skeleton');

    const frIds = frStories.map(s => (typeof s.id === 'string' ? s.id : '')).filter(Boolean);
    const nfrIds = ((prior.nonFunctionalRequirements?.content.requirements as Array<Record<string, unknown>>) ?? [])
      .map(n => (typeof n.id === 'string' ? n.id : ''))
      .filter(Boolean);
    const dmr71Seeds = [
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
      ...(prior.componentModel ? [prior.componentModel.recordId] : []),
      ...(prior.implementationPlan ? [prior.implementationPlan.recordId] : []),
    ];
    const dmr71 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'test_case_skeleton',
      requestingAgentRole: 'test_design_agent',
      query: `Test cases covering ACs ${allAcIds.join(', ')} for FRs ${frIds.join(', ')} under NFRs ${nfrIds.join(', ')} (implementation_plan ${prior.implementationPlan?.recordId ?? 'unknown'}).`,
      knownRelevantRecordIds: dmr71Seeds,
      detailFileLabel: 'p7_1_tests',
      requiredOutputSpec: 'test_plan JSON — test_suites with test_cases tracing to acceptance_criterion_ids',
    });

    // Pull the component id list — every id must end up as a
    // `suite.component_id` in the emitted test plan (Phase 7 coverage
    // invariant; packet_synthesis joins suites to tasks by component_id).
    const componentIds: string[] = (
      (prior.componentModel?.content.components as Array<Record<string, unknown>> | undefined) ?? []
    )
      .map(c => (typeof c.id === 'string' ? c.id : ''))
      .filter(Boolean);

    let testPlanContent = await this.runTestCaseGeneration(
      ctx, frSummary, planSummary, componentSummary, componentIds, dmr71,
    );

    // Phase exit correction: canonicalize every emitted AC ref against
    // the FR view's canonical AC set so downstream coverage and packet
    // synthesis never have to bridge LLM id drift themselves.
    normalizeTestPlanAcRefs(testPlanContent, canonicalAcIndex, 'test_case_skeleton');

    // Phase exit correction: ensure every component has at least one
    // test suite — components without one would produce unbacked packets
    // at Phase 9. Empty stub suites get filled by 7.1a saturation.
    backfillMissingComponentSuites(testPlanContent, componentIds);

    let testPlanRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: 'test_case_skeleton',
      produced_by_agent_role: 'test_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: {
        kind: 'test_plan',
        ...testPlanContent,
        total_test_cases: testPlanContent.test_suites.reduce((n, s) => n + s.test_cases.length, 0),
        coverage_by_type: {
          unit: testPlanContent.test_suites.filter(s => s.test_type === 'unit').reduce((n, s) => n + s.test_cases.length, 0),
          integration: testPlanContent.test_suites.filter(s => s.test_type === 'integration').reduce((n, s) => n + s.test_cases.length, 0),
          end_to_end: testPlanContent.test_suites.filter(s => s.test_type === 'end_to_end').reduce((n, s) => n + s.test_cases.length, 0),
        },
      },
    });
    artifactIds.push(testPlanRecord.id);
    engine.ingestionPipeline.ingest(testPlanRecord);

    // Phase-exit scope gatekeeper. Cross-checks each test suite against
    // the accepted components. A suite for a rejected component is
    // stale and would produce a packet test_case binding to a component
    // that no longer exists.
    const pruned = await applyTestPlanGatekeeper(
      ctx, testPlanContent, testPlanRecord.id, artifactIds,
    );
    if (pruned) {
      testPlanContent = pruned.content;
      testPlanRecord = pruned.record;
    }

    // ── 7.1a — Recursive Test Decomposition (Wave 10) ─────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'test_case_saturation');

    const techConstraintsRecord = allArtifacts.find(
      r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery',
    );
    const technicalConstraints: TechnicalConstraint[] = techConstraintsRecord
      ? (((techConstraintsRecord.content as Record<string, unknown>).technicalConstraints) as TechnicalConstraint[] ?? [])
      : [];

    // Resume guard — skip seeding when depth-0 nodes already exist.
    const existingTestRoots = engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node')
      .filter(r => (r.content as unknown as TestDecompositionNodeContent).depth === 0);
    let rootTestCases: DecompositionTestCase[];
    let rootTestRecordIds: string[];
    let rootTestLogicalIds: string[];
    if (existingTestRoots.length > 0) {
      getLogger().info('workflow', 'Phase 7.1a RESUME: depth-0 test nodes already present', {
        existingRoots: existingTestRoots.length,
      });
      rootTestCases = existingTestRoots.map(r => (r.content as unknown as TestDecompositionNodeContent).test_case);
      rootTestRecordIds = existingTestRoots.map(r => r.id);
      rootTestLogicalIds = existingTestRoots.map(r => (r.content as unknown as TestDecompositionNodeContent).node_id);
    } else {
      // Convert Phase 7.1's flat test plan into per-case roots. Each
      // test_suites[].test_cases[] entry becomes one depth-0 root.
      const constraintIds = technicalConstraints.map(t => t.id);
      rootTestCases = testPlanContent.test_suites.flatMap(s =>
        s.test_cases.map(tc => ({
          id: tc.test_case_id,
          name: tc.expected_outcome ?? tc.test_case_id,
          test_type: tc.type,
          component_ids: tc.component_ids ?? [],
          acceptance_criterion_ids: tc.acceptance_criterion_ids,
          preconditions: tc.preconditions,
          steps: (tc.execution_steps && tc.execution_steps.length > 0)
            ? tc.execution_steps.map((stp, idx) => ({
                id: `step-${String(idx + 1).padStart(2, '0')}`,
                description: stp,
              }))
            : [{ id: 'step-01', description: tc.expected_outcome ?? tc.test_case_id }],
          expected_outcome: tc.expected_outcome,
          edge_cases: tc.edge_cases,
          active_constraints: constraintIds,
        })),
      );
      rootTestRecordIds = [];
      rootTestLogicalIds = [];
      for (const tc of rootTestCases) {
        const logicalNodeId = randomUUID();
        const rec = engine.writer.writeRecord({
          record_type: 'test_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '7',
          sub_phase_id: 'test_case_saturation',
          produced_by_agent_role: 'test_design_agent',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [testPlanRecord.id],
          content: {
            kind: 'test_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: tc.id,
            root_test_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            test_case: tc,
            surfaced_assumption_ids: [],
            release_id: null,
            release_ordinal: null,
          } satisfies TestDecompositionNodeContent,
        });
        rootTestRecordIds.push(rec.id);
        rootTestLogicalIds.push(logicalNodeId);
        artifactIds.push(rec.id);
      }
    }

    if (rootTestCases.length > 0) {
      await runTestSaturationLoop(ctx, {
        technicalConstraints,
        componentSummary: prior.componentModel?.summary ?? 'No component model available',
        // Use the leaf-aware FR view so AC ids minted from Phase 2.1a
        // leaves are visible to the saturation prompt. Previously this
        // fell back to `prior.functionalRequirements?.summary` (root
        // FRs only), so the parent test case's `acceptance_criterion_ids`
        // referenced AC ids the model never saw — encouraging it to
        // rephrase or fabricate them in children.
        acceptanceCriteriaSummary: frSummary,
        interfaceContractsSummary: prior.interfaceContracts?.summary
          ?? prior.apiDefinitions?.summary
          ?? 'No interface-contracts / api-definitions artifact available',
        rootTestCases,
        rootNodeRecordIds: rootTestRecordIds,
        rootLogicalIds: rootTestLogicalIds,
        canonicalAcIndex,
      });
    }

    // ── 7.2 — Test Coverage Analysis ──────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'test_plan_synthesis');

    const coverageReport = this.runCoverageAnalysis(testPlanContent, allAcIds, componentIds);

    const coverageRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: 'test_plan_synthesis',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [testPlanRecord.id],
      content: { kind: 'test_coverage_report', ...coverageReport },
    });
    artifactIds.push(coverageRecord.id);
    engine.ingestionPipeline.ingest(coverageRecord);

    // ── 7.3 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'test_plan_review_prep');

    const totalCases = testPlanContent.test_suites.reduce((n, s) => n + s.test_cases.length, 0);
    const testMirror = engine.mirrorGenerator.generate({
      artifactId: testPlanRecord.id,
      artifactType: 'test_plan',
      content: { total_test_cases: totalCases, coverage: coverageReport.coverage_percentage },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: 'test_plan_review_prep',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [testPlanRecord.id, coverageRecord.id],
      content: {
        kind: 'test_plan_mirror',
        mirror_id: testMirror.mirrorId,
        artifact_id: testPlanRecord.id,
        artifact_type: 'test_plan',
        fields: testMirror.fields,
        total_test_cases: totalCases,
        coverage_percentage: coverageReport.coverage_percentage,
        gaps_count: coverageReport.gaps.length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: testMirror.mirrorId, artifactType: 'test_plan' });

    try {
      const resolution = await engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror');
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected test plan', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 7 review failed', { error: String(err) });
      return { success: false, error: 'Test plan review failed', artifactIds };
    }

    // ── 7.4 — Approval ────────────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'test_plan_gate');

    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: 'test_plan_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [testPlanRecord.id, coverageRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '7',
        test_plan_record_id: testPlanRecord.id,
        test_coverage_record_id: coverageRecord.id,
        coverage_percentage: coverageReport.coverage_percentage,
        gaps_count: coverageReport.gaps.length,
        component_gaps_count: coverageReport.component_gaps.length,
        has_unresolved_warnings: coverageReport.gaps.length > 0 || coverageReport.component_gaps.length > 0,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '7' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── LLM call helper ───────────────────────────────────────────

  private async runTestCaseGeneration(
    ctx: PhaseContext, frSummary: string, planSummary: string, componentSummary: string,
    componentIds: string[], dmr: PhaseContextPacketResult,
  ): Promise<TestPlan> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('test_design_agent', 'test_case_skeleton');

    const fallback: TestPlan = {
      test_suites: [{
        suite_id: 'TS-001', component_id: 'COMP-001', test_type: 'unit',
        test_cases: [{
          test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-001'],
          preconditions: ['Application is initialized'], expected_outcome: 'Core functionality works as specified',
        }],
      }],
    };

    if (!template) return fallback;

    const componentIdList = componentIds.length > 0
      ? componentIds.map(id => `- ${id}`).join('\n')
      : '(no components available)';

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      functional_requirements_summary: frSummary,
      implementation_plan_summary: planSummary,
      component_model_summary: componentSummary,
      component_id_list: componentIdList,
      detail_file_path: dmr.detailFilePath,
      detail_file_content: dmr.detailFileContent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '7', subPhaseId: 'test_case_skeleton', agentRole: 'test_design_agent', label: 'Phase 7.1 — Test Case Generation' },
    });

    const parsed = result.parsed as Record<string, unknown> | null;
    const tp = parsed?.test_plan ?? parsed;
    const data = (Array.isArray(tp) ? tp[0] : tp) as Partial<TestPlan> | null;
    if (data?.test_suites && Array.isArray(data.test_suites) && data.test_suites.length > 0) {
      return { test_suites: data.test_suites as TestSuite[] };
    }
    return fallback;
  }

  /**
   * Deterministic coverage analysis: every AC must be referenced by at
   * least one test case, AND every component must own at least one test
   * suite. The component check exists because `packet_synthesis` matches
   * test suites to tasks by `suite.component_id === task.component_id`;
   * a component without a suite leaves its tasks unbacked at Phase 9.
   */
  private runCoverageAnalysis(
    testPlan: TestPlan,
    allAcIds: string[],
    componentIds: string[],
  ): TestCoverageReport {
    const coveredAcIds = new Set<string>();
    for (const suite of testPlan.test_suites) {
      for (const tc of suite.test_cases) {
        for (const acId of tc.acceptance_criterion_ids ?? []) {
          coveredAcIds.add(acId);
        }
      }
    }
    const gaps = allAcIds
      .filter(id => !coveredAcIds.has(id))
      .map(id => ({ acceptance_criterion_id: id, reason: `No test case references ${id}` }));

    const suiteComponentIds = new Set(testPlan.test_suites.map(s => s.component_id));
    const componentGaps = componentIds
      .filter(id => !suiteComponentIds.has(id))
      .map(id => ({
        component_id: id,
        reason: `No test suite has component_id="${id}" — its tasks will get unbacked packets at Phase 9`,
      }));

    const total = allAcIds.length || 1;
    const covered = allAcIds.length - gaps.length;

    return {
      gaps,
      component_gaps: componentGaps,
      coverage_percentage: Math.round((covered / total) * 100),
    };
  }
}

/**
 * Phase exit correction: insert empty stub suites for any component
 * that the LLM didn't cover. Each stub gets a single placeholder test
 * case so `packet_synthesis`'s component-id fallback can match. The
 * 7.1a saturation pass will then receive the stub and either flesh it
 * out or surface a `deferred` status — both visible in the audit.
 */
function backfillMissingComponentSuites(
  testPlan: TestPlan,
  componentIds: string[],
): void {
  if (componentIds.length === 0) return;
  const covered = new Set(testPlan.test_suites.map(s => s.component_id));
  let backfilled = 0;
  for (const compId of componentIds) {
    if (covered.has(compId)) continue;
    testPlan.test_suites.push({
      suite_id: `TS-AUTO-${compId}`,
      component_id: compId,
      test_type: 'integration',
      test_cases: [{
        test_case_id: `TC-AUTO-${compId}-001`,
        type: 'functional',
        acceptance_criterion_ids: [],
        preconditions: [`Component ${compId} is deployed and reachable.`],
        expected_outcome: `Component ${compId} responds to its primary interface call without error (stub — 7.1a saturation will refine this against component responsibilities).`,
      }],
    });
    backfilled++;
  }
  if (backfilled > 0) {
    getLogger().info('workflow', 'Phase 7.1 component-coverage backfill applied', {
      backfilled_components: backfilled,
      total_components: componentIds.length,
    });
  }
}

/**
 * Phase 7.1 scope-gatekeeper pass on the emitted test plan. Runs the
 * downstream gatekeeper, supersedes the original artifact with a pruned
 * copy when items were dropped, and returns the new content+record
 * (or `null` when nothing changed).
 */
async function applyTestPlanGatekeeper(
  ctx: PhaseContext,
  testPlanContent: TestPlan,
  originalArtifactId: string,
  artifactIds: string[],
): Promise<{ content: TestPlan; record: GovernedStreamRecord } | null> {
  const prune = await runDownstreamScopeGatekeeper(ctx, {
    phaseId: '7',
    subPhaseId: 'test_case_skeleton',
    bloomDescription: 'test suites',
    items: testPlanContent.test_suites.map(s => ({
      id: s.suite_id,
      label: `${s.suite_id}: ${s.test_type} suite for ${s.component_id}`,
      description: `${s.test_cases.length} test case(s)`,
      tradeoffs: s.test_cases.map(tc => tc.test_case_id).join(', '),
    })),
    originalArtifactId,
    overlay: 'DROP test suites whose `component_id` is NOT in Accepted Components. KEEP suites whose component is accepted, even if individual test cases reference removed ACs — the resolver will canonicalize references at 7.1a saturation.',
  });
  if (prune.skipped || prune.dropped.length === 0) return null;
  const keptSet = new Set(prune.kept_ids);
  const prunedSuites = testPlanContent.test_suites.filter(s => keptSet.has(s.suite_id));
  const prunedContent: TestPlan = { test_suites: prunedSuites };
  const { engine, workflowRun } = ctx;
  const prunedRecord = engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: 'test_case_skeleton',
    produced_by_agent_role: 'test_design_agent',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [originalArtifactId],
    content: {
      kind: 'test_plan',
      ...prunedContent,
      total_test_cases: prunedSuites.reduce((n, s) => n + s.test_cases.length, 0),
      coverage_by_type: {
        unit: prunedSuites.filter(s => s.test_type === 'unit').reduce((n, s) => n + s.test_cases.length, 0),
        integration: prunedSuites.filter(s => s.test_type === 'integration').reduce((n, s) => n + s.test_cases.length, 0),
        end_to_end: prunedSuites.filter(s => s.test_type === 'end_to_end').reduce((n, s) => n + s.test_cases.length, 0),
      },
    },
  });
  engine.writer.supersedByRollback(originalArtifactId, prunedRecord.id);
  engine.ingestionPipeline.ingest(prunedRecord);
  artifactIds.push(prunedRecord.id);
  return { content: prunedContent, record: prunedRecord };
}

/**
 * Phase exit correction: replace each test case's `acceptance_criterion_ids[]`
 * with canonical ids resolved against the FR view. Logs aggregate bridge
 * activity at INFO so operators see the drift rate trend over time.
 * Unresolved refs are preserved so coverage analysis still flags them.
 */
function normalizeTestPlanAcRefs(
  testPlan: TestPlan,
  index: CanonicalAcIndex,
  subPhase: string,
): void {
  let bridged = 0;
  let unresolved = 0;
  let touchedCases = 0;
  for (const suite of testPlan.test_suites) {
    for (const tc of suite.test_cases) {
      const refs = tc.acceptance_criterion_ids ?? [];
      if (refs.length === 0) continue;
      const contextText = [tc.expected_outcome, ...(tc.execution_steps ?? [])]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ');
      const result = resolveAcReferences(refs, index, { contextText });
      bridged += result.bridgedCount;
      unresolved += result.unresolvedCount;
      const changed =
        result.resolvedIds.length !== refs.length ||
        result.resolvedIds.some((id, i) => id !== refs[i]);
      if (changed) {
        tc.acceptance_criterion_ids = result.resolvedIds;
        touchedCases++;
      }
    }
  }
  if (bridged > 0 || unresolved > 0) {
    getLogger().info('workflow', 'Phase 7 AC ref normalizer applied', {
      subPhase,
      touchedCases,
      refsBridged: bridged,
      refsUnresolved: unresolved,
    });
  }
}

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
  PropertySpec,
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveFrView } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { runTestSaturationLoop } from './phase7_1a';
import {
  renderComponentBlockForTask,
  renderAcceptanceCriteriaMenu,
  collectLeafAcceptanceCriteria,
  chunkUncoveredByStory,
  renderUncoveredAcsMenu,
  renderComponentMenu,
  summarizeResidualDivergence,
  type LeafAcceptanceCriteria,
} from './phase6';
import { chunkedCoverageBloom } from './chunkedCoverageBloom';
import { pickItemsArray } from '../parsedResponseHelpers';
import type { PromptTemplate } from '../templateLoader';
import { runPhase7CycleDelta } from './runCycleDelta';
import { emit as aoddEmit } from '../../aodd';
import { buildCanonicalAcIndex, resolveAcReferences, type CanonicalAcIndex } from './phase7/acRefResolver';
import { runDownstreamScopeGatekeeper } from './downstreamGatekeeper';

// ── Artifact shape interfaces ──────────────────────────────────────

interface TestCase {
  test_case_id: string;
  type: 'unit' | 'integration' | 'end_to_end' | 'property';
  acceptance_criterion_ids: string[];
  component_ids?: string[];
  preconditions: string[];
  inputs?: Record<string, unknown>;
  execution_steps?: string[];
  expected_outcome: string;
  edge_cases?: string[];
  implementation_notes?: string;
  /** Present iff type === 'property' (emerges in 7.1a saturation, not the skeleton). */
  property_spec?: PropertySpec;
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
    // PA-2: per-component scoped context so a single-test-case saturation call
    // sees only its own component(s), not the whole ~17-component model.
    const componentSummaryById: Record<string, string> = {};
    for (const c of (prior.componentModel?.content.components as Array<Record<string, unknown>> | undefined) ?? []) {
      const cid = typeof c.id === 'string' ? c.id : '';
      if (cid) componentSummaryById[cid] = renderComponentBlockForTask(c);
    }

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
    const leafComponents: Array<Record<string, unknown>> =
      (prior.componentModel?.content.components as Array<Record<string, unknown>> | undefined) ?? [];
    const componentIds: string[] = leafComponents
      .map(c => (typeof c.id === 'string' ? c.id : ''))
      .filter(Boolean);

    // SD-4 / PA-15: per-component chunking + orchestrator-owned AC-coverage
    // reconciliation. The authoritative leaf-AC inventory (the same set Phase 6
    // tasks bind against) is the coverage oracle; the componentAcMap scopes each
    // per-component call to only the ACs that component implements (full-menu
    // fallback for any component absent from the map — never starve).
    const leafAcceptanceCriteria = collectLeafAcceptanceCriteria(decompositionNodes);
    const componentAcMap = buildComponentAcMap(
      (prior.implementationPlan?.content.tasks as Array<Record<string, unknown>> | undefined) ?? [],
    );

    let testPlanContent = await this.runTestCaseGeneration(
      ctx, leafComponents, leafAcceptanceCriteria, componentAcMap, dmr71,
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
          // PA-2 fix: the 7.1 skeleton binds components at the SUITE level, so a
          // root test case usually has no component_ids of its own. Inherit the
          // suite's component_id so 7.1a sibling_context/component_context scoping
          // has a real id to key on (otherwise parentComps is empty and every root
          // renders as "sole child", starving the cross-sibling roster).
          component_ids: (tc.component_ids && tc.component_ids.length > 0)
            ? tc.component_ids
            : (s.component_id ? [s.component_id] : []),
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
          // Carry a skeleton-minted property into the saturation tree so the
          // decomposition pass can refine/fan it out rather than re-derive it.
          property_spec: tc.property_spec,
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
        componentSummaryById,
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

  /**
   * Phase 7.1 test-case generation — PER-COMPONENT chunking + coverage-driven
   * reconciliation (SD-4 / PA-15), replacing the single monolithic call.
   *
   * The monolithic call rendered the WHOLE plan (all ~303 ACs, all components)
   * and demanded "every AC has a test case" + "every component appears as a
   * suite.component_id" in one response — local dense models short-cut to ~28%
   * AC coverage, and the shortfall flowed through silently (coverage analysis is
   * visibility-only; component backfill closes only component gaps with EMPTY
   * stub suites; 7.1a saturation only refines existing roots).
   *
   * Instead: one BOUNDED call per component (its scoped AC menu + its component
   * block → suites for just that component), then the shared `chunkedCoverageBloom`
   * owns the 100%-AC-coverage guarantee — a deterministic check finds leaf ACs no
   * test case covered and routes them back through focused reconciliation passes
   * until clean (or the budget is spent → an honest, non-fabricated residual).
   * NEVER fabricates: a per-component generator returns [] on failure and the
   * whole method returns an honest empty `{ test_suites: [] }` if nothing was
   * produced (the component backfill downstream is the component-coverage
   * backstop). The returned `{ test_suites }` shape is byte-identical to before,
   * so 7.1a seeding + downstream are untouched.
   */
  private async runTestCaseGeneration(
    ctx: PhaseContext,
    leafComponents: Array<Record<string, unknown>>,
    leafAcceptanceCriteria: LeafAcceptanceCriteria[],
    componentAcMap: Map<string, Set<string>>,
    dmr: PhaseContextPacketResult,
  ): Promise<TestPlan> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('test_design_agent', 'test_case_skeleton');
    // NEVER fabricate placeholder content (house rule): on failure emit an honest
    // empty plan — the component backfill + coverage report make the gap visible.
    const empty: TestPlan = { test_suites: [] };
    const chunks = leafComponents.filter(c => typeof c.id === 'string' && (c.id as string).length > 0);
    if (!template || chunks.length === 0) return empty;

    const reconTemplate = engine.templateLoader.findTemplate('test_design_agent', 'test_case_reconciliation');

    // Coverage oracle: every leaf AC MUST be covered by >=1 test case.
    const targetCoverageSet = new Set<string>(
      leafAcceptanceCriteria.flatMap(l => l.acs.map(a => a.id)),
    );
    const maxReconPasses = Math.max(0, Number.parseInt(process.env.JANUMICODE_P7_RECON_PASSES ?? '2', 10) || 0);
    const maxAcsPerBatch = Math.max(1, Number.parseInt(process.env.JANUMICODE_P7_RECON_BATCH_AC ?? '25', 10) || 25);

    // Wrap each suite with a chunk-namespaced dedup KEY (distinct from suite_id)
    // so the helper's idOf dedup can't collapse two DISTINCT suites that both
    // restarted their numbering at TS-001. suite_id/test_case_id are re-id'd for
    // global uniqueness on the merged list below (SD-5 renumber-on-collision).
    interface ProducedSuite { suite: TestSuite; key: string }

    // PA-15 fail-safe visibility: renderScopedAcMenu falls open to the FULL AC
    // inventory when a component is absent from componentAcMap (no AC-bearing task).
    // Track unique fell-open components and WARN once each (mirrors PA-3).
    const fellOpenAcComponents = new Set<string>();

    const { produced } = await chunkedCoverageBloom<Record<string, unknown>, ProducedSuite>({
      chunks,
      // ── Per-component generation: ONE bounded call per component ──
      generateForChunk: async (component, index) => {
        const cid = String(component.id);
        // PA-15: renderScopedAcMenu falls open to the FULL menu when this component
        // is absent from componentAcMap — log the first occurrence of each.
        const ownedAcs = componentAcMap.get(cid);
        if ((!ownedAcs || ownedAcs.size === 0) && !fellOpenAcComponents.has(cid)) {
          fellOpenAcComponents.add(cid);
          getLogger().warn('workflow', 'Phase 7.1 test_case_skeleton: AC menu fell open to the FULL inventory — component absent from componentAcMap (no AC-bearing task bound; PA-15 fallback)', {
            workflow_run_id: ctx.workflowRun.id, component_id: cid,
          });
        }
        const scopedAcMenu = renderScopedAcMenu(cid, componentAcMap, leafAcceptanceCriteria);
        const rendered = engine.templateLoader.render(template, {
          active_constraints: dmr.activeConstraintsText,
          acceptance_criteria_menu: scopedAcMenu,
          component_model_summary: renderComponentBlockForTask(component),
          detail_file_path: dmr.detailFilePath,
          detail_file_content: dmr.detailFileContent,
          janumicode_version_sha: engine.janumiCodeVersionSha,
        });
        if (rendered.missing_variables.length > 0) return [];
        try {
          // LLM throws are caught here so one component never sinks the phase —
          // the reconciliation pass recovers any AC it would have covered.
          const result = await engine.callForRole('requirements_agent', {
            prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
            traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '7', subPhaseId: 'test_case_skeleton', agentRole: 'test_design_agent', label: `Phase 7.1 — Test Case Generation (${cid})` },
          });
          const suites = parseTestSuites(result.parsed as Record<string, unknown> | null);
          return suites.map((s, k) => ({ suite: s, key: `c${index}:${k}:${s.suite_id ?? ''}` }));
        } catch (err) {
          getLogger().warn('workflow', 'Phase 7.1 per-component test generation failed — continuing', {
            component_id: cid, error: err instanceof Error ? err.message : String(err),
          });
          return [];
        }
      },
      idOf: (p) => p.key,
      targetCoverageSet,
      coveredBy: (p) => {
        const ids: string[] = [];
        for (const tc of p.suite.test_cases ?? []) {
          for (const id of asStringArray(tc.acceptance_criterion_ids)) ids.push(id);
        }
        return ids;
      },
      chunkUncovered: (uncovered) => chunkUncoveredByStory(uncovered, leafAcceptanceCriteria, maxAcsPerBatch),
      reconcileBatch: reconTemplate
        ? async (batch, info) => {
            const suites = await this.reconcileUncoveredTestAcs(
              ctx, reconTemplate, batch, leafAcceptanceCriteria, chunks, dmr, info,
            );
            return suites.map((s, k) => ({ suite: s, key: `r${info.pass}:${info.batchIndex}:${k}:${s.suite_id ?? ''}` }));
          }
        : undefined,
      maxReconPasses,
      onResidual: (residual) => {
        getLogger().warn(
          'workflow',
          'Phase 7.1 residual uncovered leaf ACs after reconciliation (honest gap — upstream component/FR divergence, not fabricated)',
          summarizeResidualDivergence(residual, leafAcceptanceCriteria, targetCoverageSet.size),
        );
      },
      logLabel: 'Phase 7.1',
    });

    if (produced.length === 0) return empty; // honest empty — residual already logged; never fabricate
    // Re-id suite/case ids for global uniqueness (each component's call restarts
    // at TS-001/TC-001). Preserved verbatim when already unique; only actual
    // collisions are renumbered — mirrors SD-5.
    return { test_suites: dedupeTestSuiteIds(produced.map(p => p.suite)) };
  }

  /**
   * Reconciliation pass: emit test suites for the leaf ACs no per-component call
   * covered. Small/focused — sees only the uncovered ACs + a compact component
   * menu (routing target), so the model does bounded reasoning, not the
   * monolithic mapping. Returns [] on failure (caller logs the residual gap; NO
   * fabrication). Crediting robustness (accept only suites covering a still-
   * uncovered AC in THIS batch) is enforced by the shared bloom helper.
   */
  private async reconcileUncoveredTestAcs(
    ctx: PhaseContext,
    template: PromptTemplate,
    uncovered: Set<string>,
    leafAcceptanceCriteria: LeafAcceptanceCriteria[],
    components: Array<Record<string, unknown>>,
    dmr: PhaseContextPacketResult,
    batchInfo?: { pass: number; batchIndex: number; batchCount: number },
  ): Promise<TestSuite[]> {
    const { engine } = ctx;
    const menu = renderUncoveredAcsMenu(uncovered, leafAcceptanceCriteria);
    if (!menu) return [];
    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      uncovered_acceptance_criteria: menu,
      component_menu: renderComponentMenu(components),
    });
    if (rendered.missing_variables.length > 0) return [];
    const label = batchInfo
      ? `Phase 7.1 — Test Coverage Reconciliation (pass ${batchInfo.pass}, batch ${batchInfo.batchIndex}/${batchInfo.batchCount}, ${uncovered.size} ACs)`
      : `Phase 7.1 — Test Coverage Reconciliation (${uncovered.size} orphan ACs)`;
    // Focused reconciliation directive — busts llmCaller's in-memory prompt cache
    // (a verbatim-reused prompt returns the identical empty result → silent no-op)
    // and re-orients the model on the specific coverage miss.
    const prompt = `COVERAGE RECONCILIATION — FOCUS: a prior per-component pass produced NO test case for the ${uncovered.size} acceptance criterion id(s) listed below. Emit test suites/cases that cover EVERY one of them now (cite each id verbatim in acceptance_criterion_ids), routing each AC to its best-fit component.\n\n${rendered.rendered}`;
    try {
      const result = await engine.callForRole('requirements_agent', {
        prompt, responseFormat: 'json', temperature: 0.4,
        traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '7', subPhaseId: 'test_case_reconciliation', agentRole: 'test_design_agent', label },
      });
      const parsed = result.parsed as Record<string, unknown> | null;
      const suites = parseTestSuites(parsed);
      if (suites.length === 0) {
        getLogger().warn('workflow', 'Phase 7.1 reconciliation batch yielded no usable test suites', {
          label, parse_failed: parsed == null, ac_count: uncovered.size,
        });
        return [];
      }
      return suites;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 7.1 reconciliation call failed', {
        label, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
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

// ── SD-4 / PA-15 per-component chunking helpers (exported for unit tests) ──

/**
 * Coerce an LLM-emitted field to a string[] at the deterministic boundary.
 * `acceptance_criterion_ids` has been observed to arrive as a non-array (e.g. a
 * boolean shorthand), so every id read guards against it — a non-array yields []
 * and non-string members are dropped (never crashes the coverage pass).
 */
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Build the componentId → Set<AC-*> map from the implementation plan's tasks
 * (each task's `component_id` × its `traces_to` AC ids). This is the
 * orchestrator-owned, deterministic axis that scopes each per-component test
 * generation call to only the ACs that component implements. Array-safe:
 * tolerates a missing/boolean `traces_to`; keeps AC-prefixed ids only. A
 * component with no AC-bearing task is simply absent from the map (→ full-menu
 * fallback in `renderScopedAcMenu`, never starved).
 */
export function buildComponentAcMap(
  tasks: Array<Record<string, unknown>>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const t of Array.isArray(tasks) ? tasks : []) {
    if (!t || typeof t !== 'object') continue;
    const cid = typeof t.component_id === 'string' ? t.component_id : '';
    if (!cid) continue;
    const acs = asStringArray(t.traces_to).filter(id => id.startsWith('AC-'));
    if (acs.length === 0) continue;
    let set = map.get(cid);
    if (!set) { set = new Set<string>(); map.set(cid, set); }
    for (const ac of acs) set.add(ac);
  }
  return map;
}

/**
 * Leaf ACs cited by no test case — the reconciliation work-list / residual
 * oracle. Reads `acceptance_criterion_ids` array-safely; ignores ids outside the
 * leaf-AC set.
 */
export function computeUncoveredTestAcIds(
  suites: TestSuite[],
  leafAcIdSet: Set<string>,
): Set<string> {
  const cited = new Set<string>();
  for (const s of suites ?? []) {
    for (const tc of s.test_cases ?? []) {
      for (const id of asStringArray(tc.acceptance_criterion_ids)) cited.add(id);
    }
  }
  const out = new Set<string>();
  for (const ac of leafAcIdSet) if (!cited.has(ac)) out.add(ac);
  return out;
}

/**
 * Does this test case cover ANY id in `idSet`? Array-safe on
 * `acceptance_criterion_ids`.
 */
export function caseCoversAny(
  tc: { acceptance_criterion_ids?: unknown },
  idSet: Set<string>,
): boolean {
  for (const id of asStringArray(tc.acceptance_criterion_ids)) if (idSet.has(id)) return true;
  return false;
}

/**
 * Extract the test-suites array from an LLM JSON result, tolerating the nested
 * envelopes Phase 7 has historically seen: `{test_suites:[…]}`,
 * `{test_plan:{test_suites:[…]}}`, `{test_plan:[{test_suites:[…]}]}`. Returns []
 * on null / unrecognised shape (never throws, never fabricates).
 */
export function parseTestSuites(
  parsed: Record<string, unknown> | null | undefined,
): TestSuite[] {
  if (!parsed) return [];
  const root = parsed as Record<string, unknown>;
  // Fast path: `{ test_suites: [...] }` (and its double-envelope variants).
  const direct = pickItemsArray<TestSuite>(root, ['test_suites']);
  if (direct && direct.length > 0) return direct;
  // `{ test_plan: {...} }` or `{ test_plan: [ {...} ] }` → unwrap the plan object.
  const tp = root.test_plan;
  if (tp) {
    const planObj = (Array.isArray(tp) ? tp[0] : tp) as Record<string, unknown> | undefined | null;
    if (planObj && typeof planObj === 'object') {
      const nested = pickItemsArray<TestSuite>(planObj, ['test_suites']);
      if (nested && nested.length > 0) return nested;
    }
  }
  return [];
}

/**
 * Render the leaf-AC menu SCOPED to one component: only the ACs that component
 * implements (from `componentAcMap`), grouped by their owning leaf story. When
 * the component is absent from the map (no AC-bearing task) or none of its ids
 * resolve to a known leaf AC, fall back to the FULL menu so a per-component call
 * is never starved of citable ids — coverage can never regress below baseline.
 */
export function renderScopedAcMenu(
  cid: string,
  componentAcMap: Map<string, Set<string>>,
  leaves: LeafAcceptanceCriteria[],
): string {
  const owned = componentAcMap.get(cid);
  if (!owned || owned.size === 0) return renderAcceptanceCriteriaMenu(leaves);
  const ownedLeaves: LeafAcceptanceCriteria[] = [];
  for (const l of leaves) {
    const acs = l.acs.filter(a => owned.has(a.id));
    if (acs.length > 0) ownedLeaves.push({ ...l, acs });
  }
  if (ownedLeaves.length === 0) return renderAcceptanceCriteriaMenu(leaves);
  return renderAcceptanceCriteriaMenu(ownedLeaves);
}

/**
 * Guarantee globally-unique `suite_id` and `test_case_id` across the merged
 * suites (each per-component call restarts numbering at TS-001/TC-001, so a raw
 * collision across the merged set would drop or confuse a distinct suite/case
 * downstream — the gatekeeper keys suites by `suite_id`, 7.1a seeds roots by
 * `test_case_id`). Ids are preserved VERBATIM when already unique; only actual
 * collisions are renumbered to the next free TS-###/TC-### — mirrors SD-5's
 * renumber-on-collision. Mutates in place and returns the same array.
 */
export function dedupeTestSuiteIds(suites: TestSuite[]): TestSuite[] {
  const seenSuite = new Set<string>();
  const seenCase = new Set<string>();
  let suiteCounter = 0;
  let caseCounter = 0;
  const uniqueId = (
    raw: unknown, seen: Set<string>, prefix: string, next: () => number,
  ): string => {
    let id = typeof raw === 'string' && raw.length > 0 && !seen.has(raw) ? raw : '';
    while (!id) {
      const candidate = `${prefix}-${String(next()).padStart(3, '0')}`;
      if (!seen.has(candidate)) id = candidate;
    }
    seen.add(id);
    return id;
  };
  for (const s of suites) {
    s.suite_id = uniqueId(s.suite_id, seenSuite, 'TS', () => ++suiteCounter);
    for (const tc of s.test_cases ?? []) {
      tc.test_case_id = uniqueId(tc.test_case_id, seenCase, 'TC', () => ++caseCounter);
    }
  }
  return suites;
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
        // Mirror the parent suite's `test_type: 'integration'`. The
        // TestCase.type union doesn't include 'functional' — the
        // previous value caused a TS2322 here.
        type: 'integration',
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

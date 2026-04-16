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

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';

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
  coverage_percentage: number;
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase7Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '7';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const frSummary = prior.functionalRequirements?.summary ?? 'No functional requirements available';
    const planSummary = prior.implementationPlan?.summary ?? 'No implementation plan available';
    const componentSummary = prior.componentModel?.summary ?? 'No component model available';

    // Collect all acceptance criterion IDs for coverage analysis
    const allAcIds: string[] = [];
    const frStories = (prior.functionalRequirements?.content.user_stories as Array<Record<string, unknown>>) ?? [];
    for (const story of frStories) {
      for (const ac of (story.acceptance_criteria as Array<Record<string, unknown>>) ?? []) {
        if (ac.id) allAcIds.push(ac.id as string);
      }
    }

    const derivedFromIds = prior.allRecordIds;

    // ── 7.1 — Test Case Generation ────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.1');

    const dmr71 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '7.1',
      requestingAgentRole: 'test_design_agent',
      query: `Test case generation for requirements: ${frSummary.slice(0, 400)}`,
      detailFileLabel: 'p7_1_tests',
      requiredOutputSpec: 'test_plan JSON — test_suites with test_cases tracing to acceptance_criterion_ids',
    });

    const testPlanContent = await this.runTestCaseGeneration(
      ctx, frSummary, planSummary, componentSummary, dmr71,
    );

    const testPlanRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: '7.1',
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

    // ── 7.2 — Test Coverage Analysis ──────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.2');

    const coverageReport = this.runCoverageAnalysis(testPlanContent, allAcIds);

    const coverageRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: '7.2',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [testPlanRecord.id],
      content: { kind: 'test_coverage_report', ...coverageReport },
    });
    artifactIds.push(coverageRecord.id);
    engine.ingestionPipeline.ingest(coverageRecord);

    // ── 7.3 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.3');

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
      sub_phase_id: '7.3',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '7.4');

    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: '7.4',
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
        has_unresolved_warnings: coverageReport.gaps.length > 0,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '7' });

    return { success: true, artifactIds };
  }

  // ── LLM call helper ───────────────────────────────────────────

  private async runTestCaseGeneration(
    ctx: PhaseContext, frSummary: string, planSummary: string, componentSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<TestPlan> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('test_design_agent', '07_1_test_case_generation');

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

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      functional_requirements_summary: frSummary,
      implementation_plan_summary: planSummary,
      component_model_summary: componentSummary,
      detail_file_path: dmr.detailFilePath,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
        traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '7', subPhaseId: '7.1', agentRole: 'test_design_agent', label: 'Phase 7.1 — Test Case Generation' },
      });

      const parsed = result.parsed as Record<string, unknown> | null;
      const tp = parsed?.test_plan ?? parsed;
      const data = (Array.isArray(tp) ? tp[0] : tp) as Partial<TestPlan> | null;
      if (data?.test_suites && Array.isArray(data.test_suites) && data.test_suites.length > 0) {
        return { test_suites: data.test_suites as TestSuite[] };
      }
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Test case generation failed', { error: String(err) });
      return fallback;
    }
  }

  /** Deterministic coverage analysis: check every AC ID is referenced by at least one test case. */
  private runCoverageAnalysis(testPlan: TestPlan, allAcIds: string[]): TestCoverageReport {
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

    const total = allAcIds.length || 1;
    const covered = allAcIds.length - gaps.length;

    return {
      gaps,
      coverage_percentage: Math.round((covered / total) * 100),
    };
  }
}

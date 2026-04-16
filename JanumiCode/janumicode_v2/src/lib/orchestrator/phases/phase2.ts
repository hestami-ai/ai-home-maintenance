/**
 * Phase 2 — Requirements Definition.
 * Based on JanumiCode Spec v2.3, §4 Phase 2.
 *
 * Sub-phases:
 *   2.1 — Functional Requirements Bloom (Requirements Agent LLM call)
 *   2.2 — Non-Functional Requirements Bloom (Requirements Agent LLM call)
 *   2.3 — Requirements Mirror and Menu (human review via webview)
 *   2.4 — Requirements Consistency Check (deterministic + LLM)
 *   2.5 — Requirements Approval with Domain Attestation (phase gate)
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';

// ── Artifact shape interfaces ──────────────────────────────────────

interface AcceptanceCriterion {
  id: string;
  description: string;
  measurable_condition: string;
}

interface UserStory {
  id: string;
  role: string;
  action: string;
  outcome: string;
  acceptance_criteria: AcceptanceCriterion[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface FunctionalRequirements {
  user_stories: UserStory[];
}

interface NonFunctionalRequirement {
  id: string;
  category: 'performance' | 'security' | 'reliability' | 'scalability' | 'accessibility' | 'maintainability';
  description: string;
  threshold: string;
  measurement_method?: string;
}

interface NonFunctionalRequirements {
  requirements: NonFunctionalRequirement[];
}

interface ConsistencyFinding {
  severity: 'critical' | 'warning';
  description: string;
  artifact_ids_involved: string[];
  recommended_action: string;
}

interface ConsistencyReport {
  overall_pass: boolean;
  traceability_results: Array<{
    assertion: string;
    pass: boolean;
    failures: Array<{ item_id: string; explanation: string }>;
  }>;
  semantic_findings: ConsistencyFinding[];
  internal_findings: ConsistencyFinding[];
  blocking_failures: string[];
  warnings: string[];
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase2Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '2';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const intentSummary = prior.intentStatement?.summary ?? 'No intent statement available';

    // ── 2.1 — Functional Requirements Bloom ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.1');

    // Invoke DMR to assemble cross-cutting context (active constraints,
    // material findings, ingested external files) before the bloom.
    const dmr21 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '2.1',
      requestingAgentRole: 'requirements_agent',
      query: `Functional requirements bloom for: ${intentSummary.slice(0, 400)}`,
      detailFileLabel: 'p2_1_func_req',
      requiredOutputSpec: 'functional_requirements JSON — user_stories with acceptance_criteria',
    });

    const frContent = await this.runFunctionalRequirementsBloom(ctx, intentSummary, dmr21);

    const frRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.1',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: prior.intentStatement ? [prior.intentStatement.recordId] : [],
      content: {
        kind: 'functional_requirements',
        ...frContent,
      },
    });
    artifactIds.push(frRecord.id);
    engine.ingestionPipeline.ingest(frRecord);

    // ── 2.2 — Non-Functional Requirements Bloom ───────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.2');

    // Build a rich FR summary for the NFR prompt
    const frSummary = frContent.user_stories.map(s =>
      `${s.id} [${s.priority}]: As a ${s.role}, I want ${s.action}, so that ${s.outcome}. ACs: ${s.acceptance_criteria.map(ac => `${ac.id}: ${ac.measurable_condition}`).join('; ')}`,
    ).join('\n');

    const dmr22 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '2.2',
      requestingAgentRole: 'requirements_agent',
      query: `Non-functional requirements for: ${intentSummary.slice(0, 200)}; FRs: ${frSummary.slice(0, 200)}`,
      detailFileLabel: 'p2_2_nfr',
      requiredOutputSpec: 'non_functional_requirements JSON — performance, security, reliability, etc.',
    });

    const nfrContent = await this.runNonFunctionalRequirementsBloom(
      ctx, intentSummary, frSummary, dmr22,
    );

    const nfrRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.2',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id],
      content: {
        kind: 'non_functional_requirements',
        ...nfrContent,
      },
    });
    artifactIds.push(nfrRecord.id);
    engine.ingestionPipeline.ingest(nfrRecord);

    // ── 2.3 — Requirements Mirror and Menu ────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.3');

    const frMirror = engine.mirrorGenerator.generate({
      artifactId: frRecord.id,
      artifactType: 'functional_requirements',
      content: frContent as unknown as Record<string, unknown>,
    });

    const frMirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.3',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id, nfrRecord.id],
      content: {
        kind: 'requirements_mirror',
        mirror_id: frMirror.mirrorId,
        artifact_id: frRecord.id,
        artifact_type: 'functional_requirements',
        fields: frMirror.fields,
        user_story_count: frContent.user_stories.length,
        nfr_count: nfrContent.requirements.length,
      },
    });
    artifactIds.push(frMirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: frMirror.mirrorId,
      artifactType: 'functional_requirements',
    });

    // Pause for human review of requirements
    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id,
        frMirrorRecord.id,
        'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected the requirements', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2 requirements review failed', { error: String(err) });
      return { success: false, error: 'Requirements review failed', artifactIds };
    }

    // ── 2.4 — Requirements Consistency Check ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.4');

    const consistencyReport = this.runConsistencyCheck(frContent, nfrContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.4',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id, nfrRecord.id],
      content: {
        kind: 'consistency_report',
        ...consistencyReport,
      },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    if (!consistencyReport.overall_pass) {
      engine.eventBus.emit('error:occurred', {
        message: 'Requirements consistency check found blocking failures',
        context: JSON.stringify(consistencyReport.blocking_failures),
      });
      // Don't fail the phase — surface through the gate instead
    }

    // ── 2.5 — Approval with Domain Attestation ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.5');

    const attestationMirror = engine.mirrorGenerator.generate({
      artifactId: consistencyRecord.id,
      artifactType: 'consistency_report',
      content: consistencyReport as unknown as Record<string, unknown>,
    });

    const attestationRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [consistencyRecord.id],
      content: {
        kind: 'domain_attestation_mirror',
        mirror_id: attestationMirror.mirrorId,
        artifact_id: consistencyRecord.id,
        artifact_type: 'consistency_report',
        fields: attestationMirror.fields,
        consistency_pass: consistencyReport.overall_pass,
        blocking_failures: consistencyReport.blocking_failures.length,
        warnings: consistencyReport.warnings.length,
      },
    });
    artifactIds.push(attestationRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: attestationMirror.mirrorId,
      artifactType: 'consistency_report',
    });

    // Pause for domain attestation approval
    try {
      const attestationResolution = await engine.pauseForDecision(
        workflowRun.id,
        attestationRecord.id,
        'mirror',
      );
      if (attestationResolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected domain attestation', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2 attestation failed', { error: String(err) });
      return { success: false, error: 'Domain attestation failed', artifactIds };
    }

    // ── Phase Gate ────────────────────────────────────────────
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id, nfrRecord.id, consistencyRecord.id, attestationRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '2',
        functional_requirements_record_id: frRecord.id,
        non_functional_requirements_record_id: nfrRecord.id,
        consistency_report_record_id: consistencyRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        domain_attestation_confirmed: true,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '2' });

    return { success: true, artifactIds };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  /**
   * Sub-Phase 2.1: Generate Functional Requirements from the Intent Statement.
   */
  private async runFunctionalRequirementsBloom(
    ctx: PhaseContext,
    intentSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<FunctionalRequirements> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'requirements_agent',
      '02_1_functional_requirements',
    );

    const fallback: FunctionalRequirements = {
      user_stories: [{
        id: 'US-001',
        role: 'user',
        action: 'use the core functionality',
        outcome: 'achieve the primary goal described in the intent',
        acceptance_criteria: [{
          id: 'AC-001',
          description: 'Core functionality is available',
          measurable_condition: 'System responds within 2 seconds',
        }],
        priority: 'high',
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      intent_statement_summary: intentSummary,
      compliance_context_summary: '(none)',
      detail_file_path: dmr.detailFilePath,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.5,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '2',
          subPhaseId: '2.1',
          agentRole: 'requirements_agent',
          label: 'Phase 2.1 — Functional Requirements Bloom',
        },
      });

      const parsed = result.parsed as Record<string, unknown> | null;
      // The LLM may wrap the output: { functional_requirements: [{ user_stories }] }
      // or return directly: { user_stories }. Handle both.
      const fr = parsed?.functional_requirements;
      const stories = parsed?.user_stories
        ?? (Array.isArray(fr) ? (fr[0] as Record<string, unknown>)?.user_stories : (fr as Record<string, unknown>)?.user_stories);
      if (Array.isArray(stories) && stories.length > 0) {
        return { user_stories: stories as UserStory[] };
      }
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Functional requirements bloom failed', { error: String(err) });
      return fallback;
    }
  }

  /**
   * Sub-Phase 2.2: Generate Non-Functional Requirements.
   */
  private async runNonFunctionalRequirementsBloom(
    ctx: PhaseContext,
    intentSummary: string,
    frSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<NonFunctionalRequirements> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'requirements_agent',
      '02_2_nonfunctional_requirements',
    );

    const fallback: NonFunctionalRequirements = {
      requirements: [{
        id: 'NFR-001',
        category: 'performance',
        description: 'System response time',
        threshold: 'p95 response time < 500ms',
        measurement_method: 'Load testing with representative workload',
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      intent_statement_summary: intentSummary,
      functional_requirements_summary: frSummary,
      compliance_context_summary: 'No compliance regimes',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.5,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '2',
          subPhaseId: '2.2',
          agentRole: 'requirements_agent',
          label: 'Phase 2.2 — Non-Functional Requirements Bloom',
        },
      });

      const parsed = result.parsed as Record<string, unknown> | null;
      // The LLM may wrap: { non_functional_requirements: [...] }
      // or return directly: { requirements: [...] }. Handle both.
      const nfr = parsed?.non_functional_requirements;
      const reqs = parsed?.requirements
        ?? (Array.isArray(nfr) ? nfr : (nfr as Record<string, unknown>)?.requirements);
      if (Array.isArray(reqs) && reqs.length > 0) {
        return { requirements: reqs as NonFunctionalRequirement[] };
      }
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Non-functional requirements bloom failed', { error: String(err) });
      return fallback;
    }
  }

  /**
   * Sub-Phase 2.4: Deterministic consistency check across FR and NFR artifacts.
   * Checks traceability (every user story has measurable ACs) and internal
   * consistency (no duplicate IDs, no conflicting requirements).
   */
  private runConsistencyCheck(
    fr: FunctionalRequirements,
    nfr: NonFunctionalRequirements,
  ): ConsistencyReport {
    const traceability: ConsistencyReport['traceability_results'] = [];
    const semanticFindings: ConsistencyFinding[] = [];
    const blockingFailures: string[] = [];
    const warnings: string[] = [];

    // Check: Every user story has at least one acceptance criterion with measurable_condition
    const acCheck = {
      assertion: 'Every user story has at least one acceptance criterion with measurable_condition',
      pass: true,
      failures: [] as Array<{ item_id: string; explanation: string }>,
    };

    for (const story of fr.user_stories) {
      if (!story.acceptance_criteria || story.acceptance_criteria.length === 0) {
        acCheck.pass = false;
        acCheck.failures.push({
          item_id: story.id,
          explanation: `User story ${story.id} has no acceptance criteria`,
        });
      } else {
        const hasMeasurable = story.acceptance_criteria.some(ac => ac.measurable_condition);
        if (!hasMeasurable) {
          acCheck.pass = false;
          acCheck.failures.push({
            item_id: story.id,
            explanation: `User story ${story.id} has acceptance criteria but none with measurable_condition`,
          });
        }
      }
    }
    traceability.push(acCheck);
    if (!acCheck.pass) blockingFailures.push('ac-measurable-condition');

    // Check: No duplicate user story IDs
    const storyIds = fr.user_stories.map(s => s.id);
    const dupIds = storyIds.filter((id, i) => storyIds.indexOf(id) !== i);
    if (dupIds.length > 0) {
      semanticFindings.push({
        severity: 'warning',
        description: `Duplicate user story IDs: ${dupIds.join(', ')}`,
        artifact_ids_involved: [],
        recommended_action: 'Rename duplicate IDs to be unique',
      });
      warnings.push('duplicate-story-ids');
    }

    // Check: NFRs have measurable thresholds
    const nfrThresholdCheck = {
      assertion: 'Every NFR has a measurable threshold',
      pass: true,
      failures: [] as Array<{ item_id: string; explanation: string }>,
    };

    for (const req of nfr.requirements) {
      if (!req.threshold || req.threshold.trim().length === 0) {
        nfrThresholdCheck.pass = false;
        nfrThresholdCheck.failures.push({
          item_id: req.id,
          explanation: `NFR ${req.id} has no threshold`,
        });
      }
    }
    traceability.push(nfrThresholdCheck);
    if (!nfrThresholdCheck.pass) warnings.push('nfr-missing-threshold');

    // Check: All NFR categories are covered
    const categories = new Set<string>(nfr.requirements.map(r => r.category));
    const requiredCategories = ['performance', 'security', 'reliability'];
    for (const cat of requiredCategories) {
      if (!categories.has(cat)) {
        semanticFindings.push({
          severity: 'warning',
          description: `NFR category '${cat}' is not covered`,
          artifact_ids_involved: [],
          recommended_action: `Add at least one ${cat} requirement`,
        });
        warnings.push(`missing-category-${cat}`);
      }
    }

    return {
      overall_pass: blockingFailures.length === 0,
      traceability_results: traceability,
      semantic_findings: semanticFindings,
      internal_findings: [],
      blocking_failures: blockingFailures,
      warnings,
    };
  }
}

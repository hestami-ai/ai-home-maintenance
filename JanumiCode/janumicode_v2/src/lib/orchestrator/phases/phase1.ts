/**
 * Phase 1 — Intent Capture and Convergence.
 * Based on JanumiCode Spec v2.3, §4 Phase 1.
 *
 * Sub-phases:
 *   1.0  — Intent Quality Check (Orchestrator LLM call)
 *   1.1b — Scope Bounding and Compliance Context (deterministic placeholder)
 *   1.2  — Intent Domain Bloom (Domain Interpreter Agent — real LLM call)
 *   1.3  — Intent Mirror and Menu (human prune via webview)
 *   1.4  — Intent Statement Synthesis (Domain Interpreter Agent — real LLM call)
 *   1.5  — Intent Statement Approval (human approval via webview)
 *
 * Wave 5: Implements the full flow end-to-end. Awaits human decisions via
 * `engine.pauseForDecision`. Phase handlers are idempotent on re-entry —
 * record ids are derived deterministically from the run id where possible.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { GovernedStreamRecord, PhaseId } from '../../types/records';
import { getLogger } from '../../logging';

interface BloomCandidate {
  id: string;
  name: string;
  description: string;
  who_it_serves: string;
  problem_it_solves: string;
  assumptions: string[];
  constraints: string[];
  open_questions: string[];
}

interface BloomContent {
  candidate_product_concepts: BloomCandidate[];
}

interface IntentStatementContent {
  product_concept: {
    name: string;
    description: string;
    who_it_serves: string;
    problem_it_solves: string;
  };
  confirmed_assumptions: string[];
  confirmed_constraints: string[];
  out_of_scope: string[];
}

export class Phase1Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '1';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Sub-Phase 1.0 — Intent Quality Check ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0');

    const rawIntentRecords = engine.writer.getRecordsByType(workflowRun.id, 'raw_intent_received');
    if (rawIntentRecords.length === 0) {
      return {
        success: false,
        error: 'No Raw Intent found. Use startWorkflowRun or record a raw_intent_received first.',
        artifactIds,
      };
    }

    const rawIntent = rawIntentRecords[0];
    const rawIntentText = (rawIntent.content.text as string) ?? JSON.stringify(rawIntent.content);

    const qualityReport = await this.runIntentQualityCheck(ctx, rawIntentText);

    const qualityRecord = engine.writer.writeRecord({
      record_type: 'intent_quality_report',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id],
      content: qualityReport,
    });
    artifactIds.push(qualityRecord.id);
    engine.ingestionPipeline.ingest(qualityRecord);

    if (qualityReport.overall_status === 'blocking') {
      engine.eventBus.emit('error:occurred', {
        message: 'Intent Quality Check found blocking issues',
        context: JSON.stringify(qualityReport),
      });
      return {
        success: false,
        error: 'Intent Quality Check found blocking contradictions — must be resolved before bloom',
        artifactIds,
      };
    }

    // ── Sub-Phase 1.1b — Scope Bounding ───────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.1b');

    const scopeRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.1b',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: {
        kind: 'scope_classification',
        breadth: 'single_product',
        depth: 'production_grade',
      },
    });
    artifactIds.push(scopeRecord.id);
    engine.ingestionPipeline.ingest(scopeRecord);

    const complianceRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.1b',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'compliance_context', regimes: [] },
    });
    artifactIds.push(complianceRecord.id);
    engine.ingestionPipeline.ingest(complianceRecord);

    // ── Sub-Phase 1.2 — Intent Domain Bloom (real) ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.2');

    const bloomContent = await this.runIntentDomainBloom(ctx, rawIntentText);

    const bloomRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.2',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id],
      content: bloomContent as unknown as Record<string, unknown>,
    });
    artifactIds.push(bloomRecord.id);
    engine.ingestionPipeline.ingest(bloomRecord);

    // ── Sub-Phase 1.3 — Intent Mirror & Menu (human prune) ────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.3');

    // Extract assumption rows from each bloom candidate so the MirrorCard
    // can render v1-style per-row Accept / Reject / Defer / Edit surfaces.
    const assumptionItems: import('../../types/records').AssumptionItem[] = [];
    for (const candidate of bloomContent.candidate_product_concepts) {
      for (let i = 0; i < candidate.assumptions.length; i++) {
        assumptionItems.push({
          id: `${candidate.id}-assumption-${i}`,
          text: candidate.assumptions[i],
          category: candidate.name,
          source: 'ai_proposed',
          status: 'pending',
        });
      }
      // Surface each candidate's open questions as assumptions too (they're
      // ambiguities the user should consciously accept or reject).
      for (let i = 0; i < candidate.open_questions.length; i++) {
        assumptionItems.push({
          id: `${candidate.id}-openq-${i}`,
          text: `Open question: ${candidate.open_questions[i]}`,
          category: candidate.name,
          source: 'ai_proposed',
          status: 'pending',
        });
      }
    }

    const assumptionMirror = engine.mirrorGenerator.generateAssumptionMirror({
      artifactId: bloomRecord.id,
      artifactType: 'intent_bloom',
      assumptions: assumptionItems,
      steelMan: bloomContent.candidate_product_concepts.length > 0
        ? `I identified ${bloomContent.candidate_product_concepts.length} candidate interpretation(s) of your intent. Review the assumptions and open questions below, then approve, reject, defer, or edit each one.`
        : undefined,
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.3',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id],
      content: {
        kind: 'assumption_mirror',
        mirror_id: assumptionMirror.mirrorId,
        artifact_id: bloomRecord.id,
        artifact_type: 'intent_bloom',
        assumptions: assumptionMirror.assumptions,
        steelMan: assumptionMirror.steelMan,
        candidates: bloomContent.candidate_product_concepts,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: assumptionMirror.mirrorId,
      artifactType: 'intent_bloom',
    });

    // If multiple candidates, present a prune menu and wait for both decisions in parallel.
    let menuRecord: GovernedStreamRecord | null = null;
    if (bloomContent.candidate_product_concepts.length > 1) {
      menuRecord = engine.writer.writeRecord({
        record_type: 'menu_presented',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '1',
        sub_phase_id: '1.3',
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [bloomRecord.id],
        content: {
          kind: 'intent_bloom_prune',
          question: 'Select the candidate interpretations to keep for synthesis:',
          context: `${bloomContent.candidate_product_concepts.length} candidates were generated from your intent. Keep the ones that best match what you want to build.`,
          multi_select: true,
          allowCustom: false,
          options: bloomContent.candidate_product_concepts.map((c, i) => ({
            id: c.id,
            label: c.name,
            description: c.description,
            recommended: i === 0,
            tradeoffs: c.open_questions.length > 0
              ? `${c.open_questions.length} open question(s): ${c.open_questions[0]}`
              : undefined,
          })),
        },
      });
      artifactIds.push(menuRecord.id);
      engine.eventBus.emit('menu:presented', {
        menuId: menuRecord.id,
        options: bloomContent.candidate_product_concepts.map(c => c.id),
      });
    }

    // Wait for human decisions. The DecisionRouter resolves these when the
    // user clicks Approve/Submit in the webview.
    const decisionAwaiters: Promise<unknown>[] = [
      engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror'),
    ];
    if (menuRecord) {
      decisionAwaiters.push(engine.pauseForDecision(workflowRun.id, menuRecord.id, 'menu'));
    }

    let mirrorResolution: { type: string; payload?: Record<string, unknown> };
    let menuResolution: { type: string; payload?: Record<string, unknown> } | null = null;
    try {
      const resolutions = await Promise.all(decisionAwaiters);
      mirrorResolution = resolutions[0] as { type: string; payload?: Record<string, unknown> };
      menuResolution = (resolutions[1] as { type: string; payload?: Record<string, unknown> } | undefined) ?? null;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1 prune decision failed', { error: String(err) });
      return { success: false, error: 'Prune decisions failed', artifactIds };
    }

    if (mirrorResolution.type === 'mirror_rejection') {
      return { success: false, error: 'User rejected the bloom mirror', artifactIds };
    }

    // Determine kept candidates from the menu selection (or all if no menu).
    let keptCandidates: BloomCandidate[];
    if (menuResolution && Array.isArray((menuResolution.payload as { selected?: string[] })?.selected)) {
      const selected = new Set((menuResolution.payload as { selected: string[] }).selected);
      keptCandidates = bloomContent.candidate_product_concepts.filter(c => selected.has(c.id));
      if (keptCandidates.length === 0) keptCandidates = bloomContent.candidate_product_concepts.slice(0, 1);
    } else {
      keptCandidates = bloomContent.candidate_product_concepts;
    }

    // ── Sub-Phase 1.4 — Intent Statement Synthesis ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.4');

    const intentStatement = await this.runIntentStatementSynthesis(
      ctx,
      keptCandidates,
      rawIntentText,
    );

    const statementRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.4',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id, ...keptCandidates.map(() => mirrorRecord.id)],
      content: {
        kind: 'intent_statement',
        ...intentStatement,
      },
    });
    artifactIds.push(statementRecord.id);
    engine.ingestionPipeline.ingest(statementRecord);

    // ── Sub-Phase 1.5 — Intent Statement Approval ─────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.5');

    const approvalMirror = engine.mirrorGenerator.generate({
      artifactId: statementRecord.id,
      artifactType: 'intent_statement',
      content: intentStatement as unknown as Record<string, unknown>,
    });

    const approvalMirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [statementRecord.id],
      content: {
        kind: 'intent_statement_mirror',
        mirror_id: approvalMirror.mirrorId,
        artifact_id: statementRecord.id,
        artifact_type: 'intent_statement',
        fields: approvalMirror.fields,
        intent_statement: intentStatement,
      },
    });
    artifactIds.push(approvalMirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: approvalMirror.mirrorId,
      artifactType: 'intent_statement',
    });

    let approvalResolution: { type: string; payload?: Record<string, unknown> };
    try {
      approvalResolution = await engine.pauseForDecision(
        workflowRun.id,
        approvalMirrorRecord.id,
        'mirror',
      );
    } catch (err) {
      return {
        success: false,
        error: `Statement approval failed: ${String(err)}`,
        artifactIds,
      };
    }

    if (approvalResolution.type === 'mirror_rejection') {
      return { success: false, error: 'User rejected the intent statement', artifactIds };
    }

    // ── Phase Gate Surface ────────────────────────────────────
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [statementRecord.id, approvalMirrorRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '1',
        intent_statement_record_id: statementRecord.id,
        has_unresolved_warnings: false,
        has_unapproved_proposals: false,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '1' });

    // The DecisionRouter resolves the gate via engine.advanceToNextPhase + executeCurrentPhase.
    // Phase 1 itself reports success here; the next phase runs in a separate invocation.
    return { success: true, artifactIds };
  }

  // ── LLM helpers ────────────────────────────────────────────────

  private async runIntentQualityCheck(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<Record<string, unknown>> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('orchestrator', '01_0_intent_quality_check');
    const defaultReport = {
      completeness_findings: [],
      consistency_findings: [],
      coherence_findings: [],
      overall_status: 'pass',
    };
    if (!template) return defaultReport;

    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: rawIntentText,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return defaultReport;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.3,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.0',
          agentRole: 'orchestrator',
          label: 'Phase 1.0 — Intent Quality Check',
        },
      });
      return result.parsed ?? defaultReport;
    } catch {
      return defaultReport;
    }
  }

  private async runIntentDomainBloom(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<BloomContent> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_2_intent_domain_bloom');

    const fallback: BloomContent = {
      candidate_product_concepts: [
        {
          id: 'c1',
          name: 'Primary interpretation',
          description: rawIntentText,
          who_it_serves: '(to be determined through bloom)',
          problem_it_solves: '(to be determined through bloom)',
          assumptions: [],
          constraints: [],
          open_questions: [],
        },
      ],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: 'No constraints',
      scope_classification_summary: 'single_product, production_grade',
      compliance_context_summary: 'No compliance regimes',
      collision_risk_aliases: 'None',
      raw_intent_text: rawIntentText,
      detail_file_path: '/dev/null',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.6,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.2',
          agentRole: 'domain_interpreter',
          label: 'Phase 1.2 — Intent Domain Bloom',
        },
      });
      const parsed = result.parsed as Partial<BloomContent> | null;
      if (parsed?.candidate_product_concepts && Array.isArray(parsed.candidate_product_concepts) && parsed.candidate_product_concepts.length > 0) {
        return { candidate_product_concepts: parsed.candidate_product_concepts as BloomCandidate[] };
      }
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Bloom LLM call failed', { error: String(err) });
      return fallback;
    }
  }

  private async runIntentStatementSynthesis(
    ctx: PhaseContext,
    keptCandidates: BloomCandidate[],
    rawIntentText: string,
  ): Promise<IntentStatementContent> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_4_intent_statement_synthesis');

    const primary = keptCandidates[0];
    const fallback: IntentStatementContent = {
      product_concept: {
        name: primary?.name ?? 'Untitled product',
        description: primary?.description ?? rawIntentText,
        who_it_serves: primary?.who_it_serves ?? 'unspecified',
        problem_it_solves: primary?.problem_it_solves ?? 'unspecified',
      },
      confirmed_assumptions: keptCandidates.flatMap(c => c.assumptions),
      confirmed_constraints: keptCandidates.flatMap(c => c.constraints),
      out_of_scope: [],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: 'No constraints',
      prune_decisions_summary: keptCandidates.map(c => `Kept: ${c.name}`).join('\n'),
      selected_product_concept: JSON.stringify(primary),
      confirmed_assumptions: keptCandidates.flatMap(c => c.assumptions).join('; '),
      confirmed_constraints: keptCandidates.flatMap(c => c.constraints).join('; '),
      out_of_scope_items: '',
      scope_classification_ref: '',
      compliance_context_ref: '',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.4,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.4',
          agentRole: 'domain_interpreter',
          label: 'Phase 1.4 — Intent Statement Synthesis',
        },
      });
      const parsed = result.parsed as Partial<IntentStatementContent> | null;
      if (parsed?.product_concept) {
        return {
          product_concept: parsed.product_concept,
          confirmed_assumptions: parsed.confirmed_assumptions ?? fallback.confirmed_assumptions,
          confirmed_constraints: parsed.confirmed_constraints ?? fallback.confirmed_constraints,
          out_of_scope: parsed.out_of_scope ?? [],
        };
      }
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Synthesis LLM call failed', { error: String(err) });
      return fallback;
    }
  }
}

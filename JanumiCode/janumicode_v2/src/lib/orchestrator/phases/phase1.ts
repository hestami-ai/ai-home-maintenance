/**
 * Phase 1 — Intent Capture and Convergence.
 * Based on JanumiCode Spec v2.3, §4 Phase 1.
 *
 * Sub-phases:
 *   1.0  — Intent Quality Check (Orchestrator LLM call)
 *   1.1b — Scope Bounding and Compliance Context (deterministic placeholder)
 *   1.2  — Intent Domain Bloom (Domain Interpreter Agent — real LLM call)
 *   1.3  — Intent Candidate Review and Menu (human prune via webview)
 *   1.4  — Assumption Surfacing and Adjudication (human approval via webview)
 *   1.5  — Intent Statement Synthesis (Domain Interpreter Agent — real LLM call)
 *   1.6  — Intent Statement Approval (human approval via webview)
 *
 * Wave 5: Implements the full flow end-to-end. Awaits human decisions via
 * `engine.pauseForDecision`. Phase handlers are idempotent on re-entry —
 * record ids are derived deterministically from the run id where possible.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { IntentLens, PhaseId } from '../../types/records';
import type {
  DecisionBundleContent,
  MirrorItem,
  MenuOption,
  MirrorItemDecision,
  MenuOptionSelection,
} from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { parseJsonWithRecovery } from '../../llm/jsonRecovery';
import { buildInterpretationMirror } from './phase1/buildInterpretationMirror';

/** An assumption may be a plain string or a structured object from the LLM. */
type AssumptionEntry = string | { statement?: string; inference?: string; assumption?: string; basis?: string };

function assumptionText(a: AssumptionEntry): string {
  if (typeof a === 'string') return a;
  return a.statement ?? a.inference ?? a.assumption ?? JSON.stringify(a);
}

interface BloomCandidate {
  id: string;
  name: string;
  description: string;
  who_it_serves: string;
  problem_it_solves: string;
  assumptions: AssumptionEntry[];
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
  confirmed_assumptions: Array<{
    assumption_id: string;
    assumption: string;
    confirmed_by_record_id: string;
  }>;
  confirmed_constraints: string[];
  out_of_scope: string[];
}

interface SurfacedAssumption {
  id: string;
  text: string;
  rationale?: string;
  source_candidate_ids: string[];
  source: import('../../types/records').AssumptionSource;
}

interface AdjudicatedAssumptionSet {
  confirmed: Array<{ id: string; text: string; rationale?: string; source_candidate_ids: string[] }>;
  rejected: Array<{ id: string; text: string; rationale?: string; source_candidate_ids: string[] }>;
  deferred: Array<{ id: string; text: string; rationale?: string; source_candidate_ids: string[] }>;
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

    let qualityReport: Record<string, unknown>;
    try {
      qualityReport = await this.runIntentQualityCheck(ctx, rawIntentText);
    } catch (err) {
      // Orchestrator backing blew up (CLI arg error, missing binary,
      // provider unreachable). Surface as a phase failure so the
      // workflow halts — previous behaviour silently used a "pass"
      // defaultReport and kept the pipeline running with an
      // invalid assumption that the intent had been audited.
      const message = err instanceof Error ? err.message : String(err);
      getLogger().error('workflow', 'Phase 1.0 Intent Quality Check failed', {
        workflow_run_id: workflowRun.id,
        error: message,
      });
      return {
        success: false,
        error: `Intent Quality Check failed: ${message}`,
        artifactIds,
      };
    }

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

    // ── Sub-Phase 1.0a — Intent Lens Classification ──────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0a');

    const lensClassification = await this.runIntentLensClassification(ctx, rawIntentText);
    const lensRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0a',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, qualityRecord.id],
      content: {
        kind: 'intent_lens_classification',
        lens: lensClassification.lens,
        confidence: lensClassification.confidence,
        rationale: lensClassification.rationale,
        fallback_lens: lensClassification.fallback_lens,
      },
    });
    artifactIds.push(lensRecord.id);
    engine.ingestionPipeline.ingest(lensRecord);
    engine.stateMachine.setIntentLens(workflowRun.id, lensClassification.lens);
    // Templates beyond product + feature have not shipped yet. The classifier
    // still emits the true lens for audit, but downstream handlers resolve
    // templates against `fallback_lens` so the pipeline keeps moving with a
    // product-shaped bloom + synthesis while lens-specific templates land.
    const activeLens = lensClassification.fallback_lens;

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

    // Invoke DMR to build a Context Packet for the bloom. DMR retrieves
    // ingested external files (from Phase 0.1b + 0.2), prior decisions
    // (brownfield), and the raw intent itself — giving the Domain
    // Interpreter actual file content to reason from.
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const contextPacket = await this.runDMR(ctx, rawIntentText);

    const bloomContent = await this.runIntentDomainBloom(
      ctx, rawIntentText, ingestedFiles, contextPacket, activeLens,
    );

    const bloomRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.2',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id],
      // Stamp `kind` so the harness oracle can match this record against
      // the PHASE1_CONTRACT entry for `intent_bloom`. Every other
      // artifact_produced record in the pipeline carries `content.kind`
      // as the discriminator; this one was missing it, which made the
      // oracle treat the bloom as a missing artifact.
      content: { kind: 'intent_bloom', ...bloomContent } as unknown as Record<string, unknown>,
    });
    artifactIds.push(bloomRecord.id);
    engine.ingestionPipeline.ingest(bloomRecord);

    // ── Sub-Phase 1.3 — Intent Candidate Review & Menu (human prune) ────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.3');

    // Emit ONE composite decision_bundle_presented. Mirror and Menu now carry
    // different payloads:
    //   Mirror = interpretation assumptions the agent made (lens, scope,
    //            cross-cutting assumptions) — the human can reject a framing
    //            without rejecting a candidate.
    //   Menu   = the candidate concepts themselves — the prune.
    // Before this split, both surfaces rendered the same candidate array, so
    // the human had no way to challenge an interpretation assumption that
    // cut across candidates (e.g. "I'm assuming this is a product intent").
    const mirrorItems: MirrorItem[] = buildInterpretationMirror({
      classifiedLens: lensClassification.lens,
      activeLens,
      lensRationale: lensClassification.rationale,
      candidates: bloomContent.candidate_product_concepts,
      scopeSummary: 'single_product, production_grade',
      complianceSummary: 'No compliance regimes',
    });
    const hasMenu = bloomContent.candidate_product_concepts.length > 1;
    const menuOptions: MenuOption[] = hasMenu
      ? bloomContent.candidate_product_concepts.map((c, i) => ({
          id: c.id,
          label: c.name,
          description: c.description,
          recommended: i === 0,
          tradeoffs: c.open_questions.length > 0
            ? `${c.open_questions.length} open question(s): ${c.open_questions[0]}`
            : undefined,
        }))
      : [];
    const bundleContent: DecisionBundleContent = {
      surface_id: `phase1-bloom-prune-${bloomRecord.id}`,
      title: 'Review candidate interpretations of your intent',
      summary: bloomContent.candidate_product_concepts.length > 0
        ? `I identified ${bloomContent.candidate_product_concepts.length} plausible interpretation(s) of your intent. First, review the **interpretation assumptions** I made when framing them — reject any that are wrong and I'll re-interpret. Then, pick which **candidate interpretations** to keep for synthesis.`
        : undefined,
      mirror: {
        kind: 'intent_bloom_mirror',
        items: mirrorItems,
      },
      ...(hasMenu ? {
        menu: {
          question: 'Select the candidate interpretations to keep for synthesis:',
          context: `${bloomContent.candidate_product_concepts.length} candidates were generated from your intent. Keep the ones that best match what you want to build.`,
          multi_select: true,
          allow_free_text: false,
          options: menuOptions,
        },
      } : {}),
    };

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.3',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id],
      content: bundleContent as unknown as Record<string, unknown>,
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: mirrorRecord.id,
      artifactType: 'intent_bloom',
    });
    if (hasMenu) {
      engine.eventBus.emit('menu:presented', {
        menuId: mirrorRecord.id,
        options: bloomContent.candidate_product_concepts.map(c => c.id),
      });
    }

    // Await exactly one bundle resolution. DecisionRouter.routeBundle
    // translates the webview submit into the decision_bundle_resolved
    // record and resolves this promise with the full payload.
    let bundleResolution: {
      type: string;
      payload?: {
        mirror_decisions?: MirrorItemDecision[];
        menu_selections?: MenuOptionSelection[];
      };
    };
    try {
      bundleResolution = await engine.pauseForDecision(
        workflowRun.id,
        mirrorRecord.id,
        'decision_bundle',
      ) as typeof bundleResolution;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1 prune decision failed', { error: String(err) });
      return { success: false, error: 'Prune decisions failed', artifactIds };
    }

    // Mirror rejections on the interpretation-assumption surface are the
    // signal to re-bloom with corrected framing. The automated re-bloom
    // loop is a follow-up iteration; for now any rejection halts Phase 1
    // with `requires_input` so a human can intervene with a corrected
    // intent rather than letting downstream phases reason on assumptions
    // the human has already flagged as wrong.
    const mirrorDecisions = bundleResolution.payload?.mirror_decisions ?? [];
    const rejectedMirrorItems = mirrorDecisions.filter(d => d.action === 'rejected');
    if (rejectedMirrorItems.length > 0) {
      getLogger().info('workflow', 'Phase 1.3 interpretation mirror had rejections — halting for human intervention', {
        workflow_run_id: workflowRun.id,
        rejected_item_ids: rejectedMirrorItems.map(d => d.item_id),
      });
      return {
        success: false,
        error: `User rejected ${rejectedMirrorItems.length} interpretation assumption(s) — re-bloom with corrected framing required`,
        artifactIds,
      };
    }

    // Determine kept candidates from the menu selections (or all candidates
    // when the surface had no menu section). Mirror per-row decisions flow
    // on the resolution for audit; downstream phases can read them from
    // the decision_bundle_resolved record.
    const menuSelections = bundleResolution.payload?.menu_selections ?? [];
    let keptCandidates: BloomCandidate[];
    if (hasMenu && menuSelections.length > 0) {
      const selected = new Set(menuSelections.map(s => s.option_id));
      keptCandidates = bloomContent.candidate_product_concepts.filter(c => selected.has(c.id));
      if (keptCandidates.length === 0) keptCandidates = bloomContent.candidate_product_concepts.slice(0, 1);
    } else {
      keptCandidates = bloomContent.candidate_product_concepts;
    }

    // ── Sub-Phase 1.4 — Assumption Surfacing & Adjudication ───
    engine.stateMachine.setSubPhase(workflowRun.id, '1.4');

    const surfacedAssumptions = this.extractSurfacedAssumptions(keptCandidates);
    const surfacedAssumptionsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id, mirrorRecord.id],
      content: {
        kind: 'surfaced_assumptions',
        assumptions: surfacedAssumptions,
      },
    });
    artifactIds.push(surfacedAssumptionsRecord.id);
    engine.ingestionPipeline.ingest(surfacedAssumptionsRecord);

    const assumptionMirror = engine.mirrorGenerator.generateAssumptionMirror({
      artifactId: surfacedAssumptionsRecord.id,
      artifactType: 'surfaced_assumptions',
      assumptions: surfacedAssumptions.map((assumption) => ({
        id: assumption.id,
        text: assumption.text,
        category: 'Phase 1 Assumption',
        source: assumption.source,
        status: 'pending',
        rationale: assumption.rationale,
      })),
      steelMan: surfacedAssumptions.length > 0
        ? `I surfaced ${surfacedAssumptions.length} assumption(s) implied by the kept candidate interpretations. Accept or edit assumptions that should govern downstream work; reject assumptions that should not survive synthesis.`
        : 'No assumptions were surfaced from the kept candidate interpretations.',
    });

    const assumptionMirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [surfacedAssumptionsRecord.id],
      content: {
        kind: 'assumption_mirror',
        mirror_id: assumptionMirror.mirrorId,
        artifact_id: surfacedAssumptionsRecord.id,
        artifact_type: 'surfaced_assumptions',
        assumptions: assumptionMirror.assumptions,
        steelMan: assumptionMirror.steelMan,
      },
    });
    artifactIds.push(assumptionMirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: assumptionMirror.mirrorId,
      artifactType: 'surfaced_assumptions',
    });

    let assumptionResolution: { type: string; payload?: Record<string, unknown> };
    try {
      assumptionResolution = await engine.pauseForDecision(
        workflowRun.id,
        assumptionMirrorRecord.id,
        'mirror',
      );
    } catch (err) {
      return {
        success: false,
        error: `Assumption adjudication failed: ${String(err)}`,
        artifactIds,
      };
    }

    const adjudicatedAssumptions = this.materializeAssumptionAdjudication(
      surfacedAssumptions,
      assumptionResolution,
    );
    if (adjudicatedAssumptions.deferred.length > 0) {
      return {
        success: false,
        error: 'Deferred assumptions remain unresolved and block intent statement synthesis',
        artifactIds,
      };
    }

    const adjudicatedAssumptionsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [surfacedAssumptionsRecord.id, assumptionMirrorRecord.id],
      content: {
        kind: 'adjudicated_assumptions',
        confirmed: adjudicatedAssumptions.confirmed,
        rejected: adjudicatedAssumptions.rejected,
        deferred: adjudicatedAssumptions.deferred,
      },
    });
    artifactIds.push(adjudicatedAssumptionsRecord.id);
    engine.ingestionPipeline.ingest(adjudicatedAssumptionsRecord);

    // ── Sub-Phase 1.5 — Intent Statement Synthesis ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.5');

    const intentStatement = await this.runIntentStatementSynthesis(
      ctx,
      keptCandidates,
      adjudicatedAssumptions.confirmed,
      adjudicatedAssumptionsRecord.id,
      rawIntentText,
      activeLens,
    );

    const statementRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id, mirrorRecord.id, adjudicatedAssumptionsRecord.id],
      content: {
        kind: 'intent_statement',
        ...intentStatement,
      },
    });
    artifactIds.push(statementRecord.id);
    engine.ingestionPipeline.ingest(statementRecord);

    // ── Sub-Phase 1.6 — Intent Statement Approval ─────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.6');

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
      sub_phase_id: '1.6',
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
      sub_phase_id: '1.6',
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

    // Inline any external file references from Phase 0's ingestion
    // pass so the Orchestrator actually SEES the spec content —
    // otherwise a raw intent like "Review specs/foo.md and prepare
    // for implementation" looks trivially incomplete, and the
    // quality check either passes vacuously or flags completeness
    // findings that don't match what a human would see.
    //
    // Same enrichment pattern Phase 1.2 bloom uses. Keeping both in
    // sync is important: if the bloom sees the file but the quality
    // gate doesn't, we risk "blocking" on an intent the downstream
    // phase can actually consume.
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);

    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return defaultReport;

    // Route via callForRole so the Orchestrator's backing tool (Gemini
    // CLI in production, Claude Code CLI in the harness, or
    // direct_llm_api fallback) is governed by llm_routing.orchestrator
    // config — NOT hardcoded to 'ollama' here. Previous hardcoding
    // left the extension host tied to a local Ollama daemon even when
    // operators had keys for better-fit models.
    //
    // IMPORTANT: callForRole() now throws on CLI invocation failure
    // (non-zero exit, arg-parse error, missing binary). We let the
    // error propagate so execute() fails the phase — the previous
    // behaviour of silently returning defaultReport let the workflow
    // march past Phase 1.0 with a "pass" verdict even when the
    // Orchestrator's backing never ran.
    const result = await engine.callForRole('orchestrator', {
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
  }

  /**
   * Phase 1.0a — classify the intent into one of six lenses so downstream
   * bloom + synthesis can pick lens-tailored prompts. Mirrors the IQC
   * enrichment flow: inlines Phase 0–ingested files so the classifier sees
   * what the human actually referenced.
   *
   * Lenses outside the shipped template set (product, feature) classify
   * successfully but `fallback_lens` is set to 'product' so the workflow
   * keeps moving while per-lens templates land incrementally.
   */
  private async runIntentLensClassification(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<{ lens: IntentLens; confidence: number; rationale: string; fallback_lens: IntentLens }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'orchestrator',
      '01_0a_intent_lens_classification',
    );

    const supportedLenses = new Set<IntentLens>(['product', 'feature']);
    const fallbackFor = (lens: IntentLens): IntentLens =>
      supportedLenses.has(lens) ? lens : 'product';

    const defaultResult = {
      lens: 'unclassified' as IntentLens,
      confidence: 0.0,
      rationale: 'Classifier did not run — template missing or LLM unavailable; using product fallback.',
      fallback_lens: 'product' as IntentLens,
    };

    if (!template) {
      getLogger().warn('workflow', 'Intent lens classification template not found; using unclassified + product fallback', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.0a',
      });
      return defaultResult;
    }

    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);

    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return defaultResult;

    let parsed: Record<string, unknown> | null;
    try {
      const result = await engine.callForRole('orchestrator', {
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.2,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.0a',
          agentRole: 'orchestrator',
          label: 'Phase 1.0a — Intent Lens Classification',
        },
      });
      parsed = result.parsed ?? null;
    } catch (err) {
      getLogger().warn('workflow', 'Intent lens classification LLM call failed; using product fallback', {
        workflow_run_id: ctx.workflowRun.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return defaultResult;
    }

    const validLenses: IntentLens[] = ['product', 'feature', 'bug', 'infra', 'legal', 'unclassified'];
    const rawLens = parsed?.lens;
    const lens: IntentLens = typeof rawLens === 'string' && (validLenses as string[]).includes(rawLens)
      ? (rawLens as IntentLens)
      : 'unclassified';
    const rawConfidence = parsed?.confidence;
    const confidence = typeof rawConfidence === 'number'
      ? Math.max(0, Math.min(1, rawConfidence))
      : 0.0;
    const rationale = typeof parsed?.rationale === 'string' && parsed.rationale.trim().length > 0
      ? parsed.rationale
      : '(no rationale provided)';

    const fallback = fallbackFor(lens);
    if (lens !== fallback) {
      getLogger().warn('workflow', `Lens '${lens}' not yet supported — using product fallback for Phase 1.2 / 1.5`, {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.0a',
        classified_lens: lens,
      });
    }

    return { lens, confidence, rationale, fallback_lens: fallback };
  }

  /**
   * Invoke Deep Memory Research to build a Context Packet for Phase 1.2.
   * Returns null on failure — the bloom degrades gracefully without it.
   */
  private async runDMR(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<import('../../agents/deepMemoryResearch').ContextPacket | null> {
    const { workflowRun, engine } = ctx;
    // DMR failures propagate. Reason: context from DMR flows into the
    // bloom prompt; if DMR fails, the bloom is reasoning on missing
    // prior decisions / ingested files. Per the correctness-over-
    // degradation design, an unrecoverable DMR error halts the workflow
    // rather than producing a bloom with silently-thin context.
    return await engine.deepMemoryResearch.research({
      requestingAgentRole: 'domain_interpreter',
      scopeTier: 'current_run', // Phase 1.2 only needs current-run context
      query: `Intent bloom context for: ${rawIntentText.slice(0, 500)}`,
      knownRelevantRecordIds: [],
      workflowRunId: workflowRun.id,
      phaseId: '1',
      subPhaseId: '1.2',
    });
  }

  /**
   * Collect external_file_ingested artifacts from Phase 0. These carry the
   * actual content of files the human referenced in the raw intent (and,
   * for brownfield, ingested workspace files).
   */
  private async collectIngestedFileContent(
    ctx: PhaseContext,
  ): Promise<Array<{ relativePath: string; content: string; type: string; truncated: boolean }>> {
    const { workflowRun, engine } = ctx;
    const artifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');

    const ingested: Array<{ relativePath: string; content: string; type: string; truncated: boolean }> = [];
    for (const rec of artifacts) {
      const content = rec.content as Record<string, unknown>;
      if (content.kind !== 'external_file_ingested') continue;
      // Only use explicitly-referenced files in the bloom prompt — workspace
      // scan results are too noisy. Phase 2+ agents can retrieve them via DMR.
      if (content.ingested_via !== 'explicit_reference') continue;

      ingested.push({
        relativePath: String(content.relative_path ?? ''),
        content: String(content.content ?? ''),
        type: String(content.file_type ?? 'other'),
        truncated: Boolean(content.truncated),
      });
    }
    return ingested;
  }

  private async runIntentDomainBloom(
    ctx: PhaseContext,
    rawIntentText: string,
    ingestedFiles: Array<{ relativePath: string; content: string; type: string; truncated: boolean }> = [],
    contextPacket: import('../../agents/deepMemoryResearch').ContextPacket | null = null,
    lens: IntentLens = 'product',
  ): Promise<BloomContent> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'domain_interpreter',
      '01_2_intent_domain_bloom',
      lens,
    );
    if (template && template.metadata.lens !== lens) {
      getLogger().warn('workflow', `Lens ${lens} not yet supported — using lens-neutral fallback template`, {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.2',
        requested_lens: lens,
      });
    }

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

    if (!template) {
      getLogger().warn('workflow', 'Intent bloom template not found; using fallback', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.2',
      });
      return fallback;
    }

    // Assemble an enriched raw_intent_text that embeds resolved file
    // references inline. This is the Channel 1 (stdin) path for LLM-backed
    // agents — they can't read files from disk, so we inline content here.
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);

    // Write a detail file via ContextBuilder for audit/Phase 9 readiness.
    const detailFilePath = await this.writeDetailFile(ctx, enrichedIntent, contextPacket);

    // Build active_constraints summary from the Context Packet (authority 6+).
    const activeConstraintsText = contextPacket && contextPacket.activeConstraints.length > 0
      ? contextPacket.activeConstraints
          .map((c, i) => `${i + 1}. ${c.statement} (Authority ${c.authorityLevel}, source: ${c.sourceRecordIds[0] ?? 'unknown'})`)
          .join('\n')
      : '(none)';

    const rendered = engine.templateLoader.render(template, {
      active_constraints: activeConstraintsText,
      scope_classification_summary: 'single_product, production_grade',
      compliance_context_summary: 'No compliance regimes',
      collision_risk_aliases: 'None',
      raw_intent_text: enrichedIntent,
      detail_file_path: detailFilePath ?? '(not available)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      getLogger().warn('workflow', 'Intent bloom template render missing variables; using fallback', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.2',
        missing_variables: rendered.missing_variables,
      });
      return fallback;
    }

    // No outer try/catch — LLM call failures throw and the engine's
    // executeCurrentPhase catch converts them to phase failure. The
    // inner "return fallback" paths below handle the softer case where
    // the call succeeded but returned empty / unparseable JSON.
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
    let parsed = result.parsed as Record<string, unknown> | null;
    if (!parsed && typeof result.text === 'string' && result.text.trim().length > 0) {
      const recovered = parseJsonWithRecovery(result.text);
      parsed = recovered.parsed;
      if (recovered.recovered) {
        getLogger().warn('workflow', 'Recovered malformed bloom JSON from raw model text', {
          workflow_run_id: ctx.workflowRun.id,
          sub_phase_id: '1.2',
          provider: result.provider,
          model: result.model,
        });
      } else if (!recovered.parsed) {
        getLogger().warn('workflow', 'Bloom raw model text could not be parsed as JSON', {
          workflow_run_id: ctx.workflowRun.id,
          sub_phase_id: '1.2',
          provider: result.provider,
          model: result.model,
          error: recovered.error ?? 'unknown',
        });
      }
    }
    // LLM may wrap response in a top-level key like "intent_bloom"
    const unwrapped = (parsed?.intent_bloom ?? parsed?.bloom ?? parsed) as Partial<BloomContent> | null;
    if (unwrapped?.candidate_product_concepts && Array.isArray(unwrapped.candidate_product_concepts) && unwrapped.candidate_product_concepts.length > 0) {
      return { candidate_product_concepts: unwrapped.candidate_product_concepts };
    }
    getLogger().warn('workflow', 'Bloom parsed JSON did not contain candidate_product_concepts; using fallback', {
      workflow_run_id: ctx.workflowRun.id,
      sub_phase_id: '1.2',
      provider: result.provider,
      model: result.model,
      parsed_top_level_keys: parsed ? Object.keys(parsed).slice(0, 20) : [],
    });
    return fallback;
  }

  private async runIntentStatementSynthesis(
    ctx: PhaseContext,
    keptCandidates: BloomCandidate[],
    confirmedAssumptions: Array<{ id: string; text: string; rationale?: string; source_candidate_ids: string[] }>,
    confirmedAssumptionsRecordId: string,
    rawIntentText: string,
    lens: IntentLens = 'product',
  ): Promise<IntentStatementContent> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'domain_interpreter',
      '01_4_intent_statement_synthesis',
      lens,
    );
    if (template && template.metadata.lens !== lens) {
      getLogger().warn('workflow', `Lens ${lens} not yet supported — using lens-neutral fallback template`, {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.5',
        requested_lens: lens,
      });
    }
    const confirmedAssumptionEntries = confirmedAssumptions.map((assumption) => ({
      assumption_id: assumption.id,
      assumption: assumption.text,
      confirmed_by_record_id: confirmedAssumptionsRecordId,
    }));

    const primary = keptCandidates[0];
    const fallback: IntentStatementContent = {
      product_concept: {
        name: primary?.name ?? 'Untitled product',
        description: primary?.description ?? rawIntentText,
        who_it_serves: primary?.who_it_serves ?? 'unspecified',
        problem_it_solves: primary?.problem_it_solves ?? 'unspecified',
      },
      confirmed_assumptions: confirmedAssumptionEntries,
      confirmed_constraints: keptCandidates.flatMap(c => c.constraints),
      out_of_scope: [],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: '(none)',
      prune_decisions_summary: keptCandidates.map(c => `Kept: ${c.name}`).join('\n'),
      selected_product_concept: JSON.stringify(primary, null, 2),
      confirmed_assumptions: JSON.stringify(confirmedAssumptionEntries, null, 2),
      confirmed_constraints: keptCandidates.flatMap(c => c.constraints).join('; '),
      out_of_scope_items: '',
      scope_classification_ref: '',
      compliance_context_ref: '',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM call throws propagate to the engine's phase catch. Parse /
    // shape fallbacks below handle the success-but-empty-JSON case.
    const result = await engine.llmCaller.call({
      provider: 'ollama',
      model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '1',
        subPhaseId: '1.5',
        agentRole: 'domain_interpreter',
        label: 'Phase 1.5 — Intent Statement Synthesis',
      },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    // LLM may wrap response in a top-level key like "intent_statement"
    const unwrapped = (parsed?.intent_statement ?? parsed?.statement ?? parsed) as Partial<IntentStatementContent> | null;
    if (unwrapped?.product_concept) {
      return {
        product_concept: unwrapped.product_concept,
        confirmed_assumptions: fallback.confirmed_assumptions,
        confirmed_constraints: unwrapped.confirmed_constraints ?? fallback.confirmed_constraints,
        out_of_scope: unwrapped.out_of_scope ?? [],
      };
    }
    return fallback;
  }

  private extractSurfacedAssumptions(keptCandidates: BloomCandidate[]): SurfacedAssumption[] {
    const deduped = new Map<string, SurfacedAssumption>();
    let index = 0;
    for (const candidate of keptCandidates) {
      for (const entry of candidate.assumptions) {
        const text = assumptionText(entry).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        const rationale = typeof entry === 'object' ? entry.basis : undefined;
        const existing = deduped.get(key);
        if (existing) {
          if (!existing.source_candidate_ids.includes(candidate.id)) {
            existing.source_candidate_ids.push(candidate.id);
          }
          if (!existing.rationale && rationale) existing.rationale = rationale;
          continue;
        }
        deduped.set(key, {
          id: `assumption-${++index}`,
          text,
          rationale,
          source_candidate_ids: [candidate.id],
          source: 'ai_proposed',
        });
      }
    }
    return Array.from(deduped.values());
  }

  private materializeAssumptionAdjudication(
    surfacedAssumptions: SurfacedAssumption[],
    resolution: { type: string; payload?: Record<string, unknown> },
  ): AdjudicatedAssumptionSet {
    const decisions = Array.isArray(resolution.payload?.decisions)
      ? resolution.payload?.decisions as Array<{
          itemId?: string;
          action?: 'accepted' | 'rejected' | 'deferred' | 'edited';
          payload?: { edited_text?: string };
        }>
      : [];

    if (decisions.length === 0) {
      return {
        confirmed: surfacedAssumptions.map((a) => ({ ...a })),
        rejected: [],
        deferred: [],
      };
    }

    const result: AdjudicatedAssumptionSet = {
      confirmed: [],
      rejected: [],
      deferred: [],
    };
    for (const assumption of surfacedAssumptions) {
      const decision = decisions.find((d) => d.itemId === assumption.id);
      if (!decision || !decision.action || decision.action === 'deferred') {
        result.deferred.push({ ...assumption });
        continue;
      }
      if (decision.action === 'rejected') {
        result.rejected.push({ ...assumption });
        continue;
      }
      result.confirmed.push({
        ...assumption,
        text: decision.action === 'edited'
          ? (decision.payload?.edited_text?.trim() || assumption.text)
          : assumption.text,
      });
    }
    return result;
  }

  /**
   * Build an enriched intent text that embeds resolved file references.
   * For LLM-backed agents (no filesystem access), this is the stdin path —
   * the file content IS the context. Each file is wrapped in clear
   * delimiters so the agent can distinguish intent text from reference
   * content.
   */
  private buildEnrichedIntentText(
    rawIntentText: string,
    ingestedFiles: Array<{ relativePath: string; content: string; type: string; truncated: boolean }>,
  ): string {
    if (ingestedFiles.length === 0) return rawIntentText;

    const parts: string[] = [rawIntentText.trim(), ''];
    parts.push('--- REFERENCED FILES (resolved from intent) ---', '');
    for (const file of ingestedFiles) {
      const header = `### File: ${file.relativePath} [${file.type}${file.truncated ? ', truncated' : ''}]`;
      parts.push(header, '', '```', file.content, '```', '');
    }
    parts.push('--- END REFERENCED FILES ---');
    return parts.join('\n');
  }

  /**
   * Write a Context Payload detail file under .janumicode/context/ so the
   * full assembled context is auditable (and, in future, readable by CLI
   * agents directly from disk without re-inlining). Returns the path or
   * null on failure.
   */
  private async writeDetailFile(
    ctx: PhaseContext,
    enrichedIntent: string,
    contextPacket: import('../../agents/deepMemoryResearch').ContextPacket | null,
  ): Promise<string | null> {
    const { workflowRun, engine } = ctx;
    try {
      const invocationId = `bloom-${workflowRun.id.slice(0, 8)}`;
      const constraintsText = contextPacket?.activeConstraints
        .map(c => `- ${c.statement} (Authority ${c.authorityLevel})`)
        .join('\n') ?? '';

      const payload = engine.contextBuilder.buildContextPayload(
        '1.2',
        invocationId,
        {
          governingConstraints: constraintsText,
          requiredOutputSpec: 'intent_bloom JSON — candidate_product_concepts, assumptions, open_questions',
          summaryContext: contextPacket
            ? `DMR completeness: ${contextPacket.completenessStatus}. ${contextPacket.completenessNarrative}`
            : '(no DMR context packet available)',
          detailFileReference: '',
        },
        {
          contextPacket: contextPacket ? JSON.stringify(contextPacket, null, 2) : '',
          narrativeMemories: [],
          decisionTraces: '',
          technicalSpecs: [],
          complianceContext: '',
          unstickingResolutions: '',
        },
      );
      // Augment the detail file on disk with the enriched intent so a
      // human auditor (or future CLI agent) can see exactly what the
      // agent was reasoning from.
      if (payload.detailFile?.path) {
        try {
          const fs = await import('node:fs');
          const existing = fs.readFileSync(payload.detailFile.path, 'utf-8');
          fs.writeFileSync(
            payload.detailFile.path,
            existing + '\n\n## Enriched Intent (with resolved references)\n\n' + enrichedIntent,
          );
        } catch { /* non-fatal */ }
      }
      return payload.detailFile?.path ?? null;
    } catch (err) {
      getLogger().debug('workflow', 'Failed to write Phase 1.2 detail file', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

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
import type {
  CoverageGapContent,
  CrossCuttingContents,
  GovernedStreamRecord,
  IntentLens,
  PhaseId,
  ProductDescriptionHandoffContent,
  Persona,
  UserJourney,
  UserJourneyStep,
  PhasingPhase,
  BusinessDomain,
  Entity,
  WorkflowV2,
  WorkflowStep,
  WorkflowTrigger,
  Integration,
  ExtractedItem,
  HumanDecisionSummary,
  OpenLoop,
  ReleaseV2,
  ReleaseContents,
  ReleasePlanContentV2,
  SourceRef,
  TechnicalConstraint,
  VVRequirement,
  VocabularyTerm,
} from '../../types/records';
import { verifyCoverage } from './phase1/verifyCoverage';
import { verifyReleaseManifest } from './phase1/verifyReleaseManifest';
import { buildReleaseManifest, type LlmReleaseSkeleton } from './phase1/buildReleaseManifest';
import { randomUUID } from 'node:crypto';
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

    // ── Lens dispatch ─────────────────────────────────────────
    // Product-classified intents run the v1-style proposer loop:
    // 1.0b discovery → 1.1b scope → 1.2/1.3/1.4/1.5 bloom+prune →
    // 1.6 handoff synthesis → 1.7 approval. Every other lens
    // (feature / bug / infra / legal / unclassified) continues on
    // the default collapsed flow below.
    if (lensClassification.lens === 'product') {
      return this.executeProductLens(ctx, {
        rawIntent,
        rawIntentText,
        qualityRecord,
        lensRecord,
        lensClassification,
        artifactIds,
      });
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

  // ══════════════════════════════════════════════════════════════════
  // Product-lens flow (Phase 1 under lens='product')
  //
  // Replaces the default 1.1b–1.6 collapsed flow with a v1-style
  // proposer loop: 1.0b silent discovery → 1.1b scope → four bloom
  // rounds with human prune gates (1.2 domains+personas, 1.3
  // journeys+workflows, 1.4 entities, 1.5 integrations+QAs) → 1.6
  // silent synthesis into a product_description_handoff (+ derived
  // intent_statement for Phase 2–9 compatibility) → 1.7 handoff
  // approval gate.
  //
  // Wave 3 scope: happy path only. Free-text feedback on any prune
  // gate returns requires_input (the re-bloom loop is Wave 5). Mirror
  // rejection on any gate also returns requires_input.
  // ══════════════════════════════════════════════════════════════════

  private async executeProductLens(
    ctx: PhaseContext,
    state: {
      rawIntent: GovernedStreamRecord;
      rawIntentText: string;
      qualityRecord: GovernedStreamRecord;
      lensRecord: GovernedStreamRecord;
      lensClassification: { lens: IntentLens; confidence: number; rationale: string; fallback_lens: IntentLens };
      artifactIds: string[];
    },
  ): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const { rawIntent, rawIntentText, lensRecord, artifactIds } = state;
    const humanDecisions: HumanDecisionSummary[] = [];

    // ── 1.0b Product Intent Discovery (silent) ──────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0b');
    let discovery: IntentDiscoveryResult;
    try {
      discovery = await this.runIntentDiscovery(ctx, rawIntentText);
    } catch (err) {
      return { success: false, error: `Product Intent Discovery failed: ${err instanceof Error ? err.message : String(err)}`, artifactIds };
    }
    const discoveryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0b',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, lensRecord.id],
      content: { kind: 'intent_discovery', ...discovery } as unknown as Record<string, unknown>,
    });
    artifactIds.push(discoveryRecord.id);
    engine.ingestionPipeline.ingest(discoveryRecord);

    // ── 1.0c Technical Constraints Discovery (silent) ───────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0c');
    let technicalConstraints: TechnicalConstraint[] = [];
    try {
      technicalConstraints = await this.runTechnicalConstraintsDiscovery(ctx, rawIntentText);
    } catch (err) {
      // Non-fatal: tech-extraction failure degrades gracefully — we
      // log the gap but the product flow continues. Harness oracle
      // will flag missing captures for the virtuous-cycle loop to
      // address.
      getLogger().warn('workflow', 'Phase 1.0c Technical Constraints Discovery failed — continuing with empty captures', {
        workflow_run_id: workflowRun.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const techRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0c',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, lensRecord.id],
      content: { kind: 'technical_constraints_discovery', technicalConstraints } as unknown as Record<string, unknown>,
    });
    artifactIds.push(techRecord.id);
    engine.ingestionPipeline.ingest(techRecord);

    // ── 1.0d Compliance & Retention Discovery (silent) ──────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0d');
    let complianceExtractedItems: ExtractedItem[] = [];
    try {
      complianceExtractedItems = await this.runComplianceRetentionDiscovery(ctx, rawIntentText);
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1.0d Compliance & Retention Discovery failed — continuing with empty captures', {
        workflow_run_id: workflowRun.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const complianceRecord_extraction = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0d',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, lensRecord.id],
      content: { kind: 'compliance_retention_discovery', complianceExtractedItems } as unknown as Record<string, unknown>,
    });
    artifactIds.push(complianceRecord_extraction.id);
    engine.ingestionPipeline.ingest(complianceRecord_extraction);

    // ── 1.0e V&V Requirements Discovery (silent) ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0e');
    let vvRequirements: VVRequirement[] = [];
    try {
      vvRequirements = await this.runVVRequirementsDiscovery(ctx, rawIntentText);
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1.0e V&V Requirements Discovery failed — continuing with empty captures', {
        workflow_run_id: workflowRun.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const vvRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0e',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, lensRecord.id],
      content: { kind: 'vv_requirements_discovery', vvRequirements } as unknown as Record<string, unknown>,
    });
    artifactIds.push(vvRecord.id);
    engine.ingestionPipeline.ingest(vvRecord);

    // ── 1.0f Canonical Vocabulary Discovery (silent) ────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0f');
    let canonicalVocabulary: VocabularyTerm[] = [];
    try {
      canonicalVocabulary = await this.runCanonicalVocabularyDiscovery(ctx, rawIntentText);
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1.0f Canonical Vocabulary Discovery failed — continuing with empty captures', {
        workflow_run_id: workflowRun.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const vocabRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0f',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, lensRecord.id],
      content: { kind: 'canonical_vocabulary_discovery', canonicalVocabulary } as unknown as Record<string, unknown>,
    });
    artifactIds.push(vocabRecord.id);
    engine.ingestionPipeline.ingest(vocabRecord);

    // ── 1.0g Intent Discovery Synthesis (deterministic compose) ──
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0g');
    const discoveryBundle: IntentDiscoveryBundle = this.composeDiscoveryBundle(
      discovery,
      technicalConstraints,
      complianceExtractedItems,
      vvRequirements,
      canonicalVocabulary,
    );
    const bundleRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0g',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [discoveryRecord.id, techRecord.id, complianceRecord_extraction.id, vvRecord.id, vocabRecord.id],
      content: {
        kind: 'intent_discovery_bundle',
        product_extraction_id: discoveryRecord.id,
        technical_extraction_id: techRecord.id,
        compliance_extraction_id: complianceRecord_extraction.id,
        vv_extraction_id: vvRecord.id,
        vocabulary_extraction_id: vocabRecord.id,
        counts: {
          personas: discoveryBundle.product.personas.length,
          userJourneys: discoveryBundle.product.userJourneys.length,
          phasingStrategy: discoveryBundle.product.phasingStrategy.length,
          technicalConstraints: discoveryBundle.technicalConstraints.length,
          complianceExtractedItems: discoveryBundle.complianceExtractedItems.length,
          vvRequirements: discoveryBundle.vvRequirements.length,
          canonicalVocabulary: discoveryBundle.canonicalVocabulary.length,
        },
      },
    });
    artifactIds.push(bundleRecord.id);
    engine.ingestionPipeline.ingest(bundleRecord);

    // ── 1.1b Scope Bounding + Compliance (deterministic) ────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.1b');
    const scopeRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.1b',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'scope_classification', breadth: 'single_product', depth: 'production_grade' },
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

    // ── 1.2 Business Domains & Personas Bloom (Round 1) ─────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.2');
    const round12 = await this.runBloomRoundWithFeedbackLoop<{ domains: BusinessDomain[]; personas: Persona[] }>(ctx, {
      subPhaseId: '1.2',
      roundLabel: 'Business Domains',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [discoveryRecord.id],
      runProposer: (feedback) => this.runBusinessDomainsBloom(ctx, discovery, feedback),
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: '1.2',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: { kind: 'business_domains_bloom', ...bloom } as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => [
        ...bloom.domains.map(d => ({ id: d.id, label: `[Domain] ${d.name}`, description: d.description, tradeoffs: d.rationale })),
        ...bloom.personas.map(p => ({ id: p.id, label: `[Persona] ${p.name}`, description: p.description })),
      ],
      buildTitle: () => 'Review Business Domains and Personas',
      buildSummary: (bloom) => `${bloom.domains.length} business domain(s) and ${bloom.personas.length} persona(s) proposed. Keep what belongs in your product; reject what doesn't.`,
    });
    if (!round12.success) return { success: false, error: round12.error, artifactIds };
    const domainsBloom = round12.bloom;
    const domainsRecord = round12.record;
    const keptDomainIds = new Set(round12.keptIds);
    const acceptedDomains = domainsBloom.domains.filter(d => keptDomainIds.has(d.id));
    const acceptedPersonas = domainsBloom.personas.filter(p => keptDomainIds.has(p.id));
    const safeDomains = acceptedDomains.length > 0 ? acceptedDomains : domainsBloom.domains;
    const safePersonas = acceptedPersonas.length > 0 ? acceptedPersonas : domainsBloom.personas;

    // ── Wave 7 Phase 1.3 — split into 1.3a (journeys) + 1.3b (workflows) + 1.3c (verifier) ──
    // Inputs discovered upstream (1.0d compliance + retention, 1.0e V&V). Integrations
    // come from 1.5 which runs AFTER 1.3 in the current flow — passed as empty here;
    // integration_coverage check no-ops on empty input. Moving 1.5 ahead of 1.3 is a
    // deferred reorder (see docs/wave7_phase1_redesign.md roadmap).
    const complianceInputs = discoveryBundle.complianceExtractedItems;
    const retentionInputs = complianceInputs.filter(c => /retention|retain|archiv|purge|delet/i.test(c.text));
    const vvInputs = discoveryBundle.vvRequirements;
    const integrationInputs: Integration[] = [];

    // ── 1.3a — User Journey Bloom ─────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.3a');
    let bloom13aMeta: { unreachedPersonas: string[]; unreachedDomains: string[] } = { unreachedPersonas: [], unreachedDomains: [] };
    const round13a = await this.runBloomRoundWithFeedbackLoop<{ userJourneys: UserJourney[]; unreachedPersonas: string[]; unreachedDomains: string[] }>(ctx, {
      subPhaseId: '1.3a',
      roundLabel: 'User Journeys',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [domainsRecord.id],
      runProposer: async (feedback) => {
        const r = await this.runJourneyBloom13a(ctx, {
          acceptedDomains: safeDomains,
          acceptedPersonas: safePersonas,
          phasingStrategy: discovery.phasingStrategy ?? [],
          complianceItems: complianceInputs,
          retentionRules: retentionInputs,
          vvRequirements: vvInputs,
          integrations: integrationInputs,
        }, feedback);
        bloom13aMeta = { unreachedPersonas: r.unreachedPersonas, unreachedDomains: r.unreachedDomains };
        return r;
      },
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: '1.3a',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: {
            kind: 'user_journey_bloom',
            userJourneys: bloom.userJourneys,
            unreached_personas: bloom.unreachedPersonas.map(id => ({ personaId: id })),
            unreached_domains: bloom.unreachedDomains.map(id => ({ domainId: id })),
          } as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => bloom.userJourneys.map(j => ({
        id: j.id, label: `[Journey] ${j.title}`, description: j.scenario,
        tradeoffs: `${j.implementationPhase} • persona ${j.personaId}`,
      })),
      buildTitle: () => 'Review User Journeys',
      buildSummary: (bloom) => `${bloom.userJourneys.length} user journey(s) proposed across the accepted domains.`,
    });
    if (!round13a.success) return { success: false, error: round13a.error, artifactIds };
    const journeyBloom = round13a.bloom;
    const journeysRecord = round13a.record;
    const keptJourneyIds = new Set(round13a.keptIds);
    const acceptedJourneys = journeyBloom.userJourneys.filter(j => keptJourneyIds.has(j.id));
    const safeJourneys = acceptedJourneys.length > 0 ? acceptedJourneys : journeyBloom.userJourneys;

    // ── 1.3b — System Workflow Bloom ──────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.3b');
    const round13b = await this.runBloomRoundWithFeedbackLoop<{ workflows: WorkflowV2[] }>(ctx, {
      subPhaseId: '1.3b',
      roundLabel: 'System Workflows',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [journeysRecord.id],
      runProposer: (feedback) => this.runWorkflowBloom13b(ctx, {
        acceptedJourneys: safeJourneys,
        acceptedPersonas: safePersonas,
        acceptedDomains: safeDomains,
        complianceItems: complianceInputs,
        retentionRules: retentionInputs,
        vvRequirements: vvInputs,
        integrations: integrationInputs,
      }, feedback),
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: '1.3b',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: {
            kind: 'system_workflow_bloom',
            workflows: bloom.workflows,
          } as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => bloom.workflows.map(w => ({
        id: w.id, label: `[Workflow] ${w.name}`, description: w.description,
        tradeoffs: `domain ${w.businessDomainId} • ${w.triggers.length} trigger(s)`,
      })),
      buildTitle: () => 'Review System Workflows',
      buildSummary: (bloom) => `${bloom.workflows.length} system workflow(s) proposed — every workflow carries at least one typed trigger. Any workflow whose automatable step-backing cannot be verified will surface in the 1.3c coverage pass.`,
    });
    if (!round13b.success) return { success: false, error: round13b.error, artifactIds };
    const workflowBloom = round13b.bloom;
    const workflowsRecord = round13b.record;
    const keptWorkflowIds = new Set(round13b.keptIds);
    const acceptedWorkflowsV2 = workflowBloom.workflows.filter(w => keptWorkflowIds.has(w.id));
    const safeWorkflowsV2 = acceptedWorkflowsV2.length > 0 ? acceptedWorkflowsV2 : workflowBloom.workflows;

    // ── 1.3c — Coverage Verifier (deterministic) ─────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.3c');
    const coverageGaps = verifyCoverage({
      personas: safePersonas,
      domainIds: safeDomains.map(d => d.id),
      journeys: safeJourneys,
      workflows: safeWorkflowsV2,
      complianceItems: complianceInputs,
      retentionRules: retentionInputs,
      vvRequirements: vvInputs,
      integrations: integrationInputs,
      vocabulary: discoveryBundle.canonicalVocabulary,
      bloomExplicitlyUnreachedPersonas: bloom13aMeta.unreachedPersonas,
      blomExplicitlyUnreachedDomains: bloom13aMeta.unreachedDomains,
    });
    const blockingGaps = coverageGaps.filter(g => g.severity === 'blocking');
    if (blockingGaps.length > 0) {
      const gapRecIds = this.persistCoverageGaps(ctx, coverageGaps, [journeysRecord.id, workflowsRecord.id]);
      getLogger().warn('workflow', 'Phase 1.3c: blocking coverage gaps detected', {
        workflow_run_id: workflowRun.id,
        gap_count: blockingGaps.length,
        advisory_count: coverageGaps.length - blockingGaps.length,
        gap_record_ids: gapRecIds,
      });
      return {
        success: false,
        error: `Phase 1.3c coverage verifier: ${blockingGaps.length} blocking gap(s) detected — ${blockingGaps.map(g => g.check).join(', ')}. Review the coverage_gap records and re-run with feedback targeting the missing items.`,
        artifactIds,
      };
    }
    if (coverageGaps.length > 0) {
      // Advisory-only — persist but don't block.
      this.persistCoverageGaps(ctx, coverageGaps, [journeysRecord.id, workflowsRecord.id]);
      getLogger().info('workflow', 'Phase 1.3c: advisory-only coverage notes', {
        workflow_run_id: workflowRun.id,
        advisory_count: coverageGaps.length,
      });
    }

    // ── 1.4 Business Entities Bloom (Round 3) ───────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.4');
    const round14 = await this.runBloomRoundWithFeedbackLoop<{ entities: Entity[] }>(ctx, {
      subPhaseId: '1.4',
      roundLabel: 'Entities',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [journeysRecord.id],
      runProposer: (feedback) => this.runEntitiesBloom(ctx, safeDomains, safeWorkflowsV2, safePersonas, safeJourneys, feedback),
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: '1.4',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: { kind: 'entities_bloom', ...bloom } as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => bloom.entities.map(e => ({ id: e.id, label: `[Entity] ${e.name}`, description: e.description, tradeoffs: `domain ${e.businessDomainId}` })),
      buildTitle: () => 'Review Business Entities',
      buildSummary: (bloom) => `${bloom.entities.length} entity/entities proposed across the accepted domains.`,
    });
    if (!round14.success) return { success: false, error: round14.error, artifactIds };
    const entitiesBloom = round14.bloom;
    const entitiesRecord = round14.record;
    const keptEntityIds = new Set(round14.keptIds);
    const acceptedEntities = entitiesBloom.entities.filter(e => keptEntityIds.has(e.id));
    const safeEntities = acceptedEntities.length > 0 ? acceptedEntities : entitiesBloom.entities;

    // ── 1.5 Integrations + Quality Attributes Bloom (Round 4) ──
    engine.stateMachine.setSubPhase(workflowRun.id, '1.5');
    // Hoist the id-generator so the QA synthetic ids are stable across
    // feedback iterations — a re-bloom produces a new array, but the
    // same id scheme resolves accept/reject consistently.
    const buildQaItems = (qas: string[]) => qas.map((q, i) => ({
      id: `QA-${i + 1}`,
      label: `[Quality] ${q.slice(0, 80)}${q.length > 80 ? '…' : ''}`,
      description: q,
    }));
    let lastQaItems: Array<{ id: string; label: string; description: string }> = [];
    const round15 = await this.runBloomRoundWithFeedbackLoop<{ integrations: Integration[]; qualityAttributes: string[] }>(ctx, {
      subPhaseId: '1.5',
      roundLabel: 'Integrations/QA',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [entitiesRecord.id],
      runProposer: (feedback) => this.runIntegrationsQaBloom(ctx, safeDomains, safeEntities, safeWorkflowsV2, safePersonas, safeJourneys, feedback),
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: '1.5',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: { kind: 'integrations_qa_bloom', ...bloom } as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => {
        lastQaItems = buildQaItems(bloom.qualityAttributes);
        return [
          ...bloom.integrations.map(i => ({ id: i.id, label: `[Integration] ${i.name}`, description: i.description, tradeoffs: `${i.category} • ${i.ownershipModel}` })),
          ...lastQaItems,
        ];
      },
      buildTitle: () => 'Review Integrations and Quality Attributes',
      buildSummary: (bloom) => `${bloom.integrations.length} integration(s) and ${bloom.qualityAttributes.length} quality attribute(s) proposed.`,
    });
    if (!round15.success) return { success: false, error: round15.error, artifactIds };
    const integrationsBloom = round15.bloom;
    const keptIntegrationIds = new Set(round15.keptIds);
    const acceptedIntegrations = integrationsBloom.integrations.filter(i => keptIntegrationIds.has(i.id));
    const acceptedQAs = lastQaItems.filter(q => keptIntegrationIds.has(q.id)).map(q => q.description);
    const safeIntegrations = acceptedIntegrations.length > 0 ? acceptedIntegrations : integrationsBloom.integrations;
    const safeQAs = acceptedQAs.length > 0 ? acceptedQAs : integrationsBloom.qualityAttributes;

    // ── 1.6 Product Description Synthesis (silent) ──────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.6');
    let handoff: ProductDescriptionHandoffContent;
    try {
      handoff = await this.runProductDescriptionSynthesis(ctx, {
        discovery,
        domains: safeDomains,
        personas: safePersonas,
        journeys: safeJourneys,
        workflows: safeWorkflowsV2,
        entities: safeEntities,
        integrations: safeIntegrations,
        qualityAttributes: safeQAs,
        humanDecisions,
        // Decomposed extraction slots — threaded from 1.0g bundle.
        technicalConstraints: discoveryBundle.technicalConstraints,
        complianceExtractedItems: discoveryBundle.complianceExtractedItems,
        vvRequirements: discoveryBundle.vvRequirements,
        canonicalVocabulary: discoveryBundle.canonicalVocabulary,
      });
    } catch (err) {
      return { success: false, error: `Product description synthesis failed: ${err instanceof Error ? err.message : String(err)}`, artifactIds };
    }
    const handoffRecord = engine.writer.writeRecord({
      record_type: 'product_description_handoff',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.6',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [discoveryRecord.id, domainsRecord.id, journeysRecord.id, entitiesRecord.id, round15.record.id],
      content: handoff as unknown as Record<string, unknown>,
    });
    artifactIds.push(handoffRecord.id);
    engine.ingestionPipeline.ingest(handoffRecord);

    // Derive a compatibility intent_statement at 1.6 so Phases 2–9
    // keep reading their existing interface unchanged.
    const derivedIntentStatement = this.deriveIntentStatementFromHandoff(handoff);
    const statementRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.6',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [handoffRecord.id],
      content: { kind: 'intent_statement', ...derivedIntentStatement },
    });
    artifactIds.push(statementRecord.id);
    engine.ingestionPipeline.ingest(statementRecord);

    // ── 1.7 Handoff Approval ────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.7');
    const approvalMirror = engine.mirrorGenerator.generate({
      artifactId: handoffRecord.id,
      artifactType: 'product_description_handoff',
      content: handoff as unknown as Record<string, unknown>,
    });
    const approvalMirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.7',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [handoffRecord.id],
      content: {
        kind: 'product_description_handoff_mirror',
        mirror_id: approvalMirror.mirrorId,
        artifact_id: handoffRecord.id,
        artifact_type: 'product_description_handoff',
        fields: approvalMirror.fields,
        handoff_summary: {
          productVision: handoff.productVision,
          personas_count: handoff.personas.length,
          userJourneys_count: handoff.userJourneys.length,
          businessDomains_count: handoff.businessDomainProposals.length,
          entities_count: handoff.entityProposals.length,
          workflows_count: handoff.workflowProposals.length,
          integrations_count: handoff.integrationProposals.length,
          qualityAttributes_count: handoff.qualityAttributes.length,
        },
      },
    });
    artifactIds.push(approvalMirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: approvalMirror.mirrorId,
      artifactType: 'product_description_handoff',
    });

    let approvalResolution: { type: string; payload?: Record<string, unknown> };
    try {
      approvalResolution = await engine.pauseForDecision(workflowRun.id, approvalMirrorRecord.id, 'mirror');
    } catch (err) {
      return { success: false, error: `Handoff approval failed: ${String(err)}`, artifactIds };
    }
    if (approvalResolution.type === 'mirror_rejection') {
      return { success: false, error: 'User rejected the product description handoff', artifactIds };
    }

    // ── 1.8 Release Plan v2 — widened manifest proposal + deterministic verifier + approval ──
    engine.stateMachine.setSubPhase(workflowRun.id, '1.8');
    // Derive full input surface from handoff + discovery.
    const acceptedWorkflowsForPlan = safeWorkflowsV2;
    const acceptedEntitiesForPlan = safeEntities;
    const acceptedIntegrationsForPlan = safeIntegrations;
    const acceptedComplianceForPlan = discoveryBundle.complianceExtractedItems;
    const acceptedVocabularyForPlan = discoveryBundle.canonicalVocabulary;
    let lastCrossCutting: CrossCuttingContents = { workflows: [], compliance: [], integrations: [], vocabulary: [] };
    const round18 = await this.runBloomRoundWithFeedbackLoop<{ releases: ReleaseV2[]; crossCutting: CrossCuttingContents }>(ctx, {
      subPhaseId: '1.8',
      roundLabel: 'Release Plan (v2)',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [handoffRecord.id],
      runProposer: async (feedback) => {
        const r = await this.runReleasePlanProposalV2_18(ctx, {
          productVision: handoff.productVision,
          productDescription: handoff.productDescription,
          phasingStrategy: discovery.phasingStrategy ?? [],
          journeys: safeJourneys,
          workflows: acceptedWorkflowsForPlan,
          entities: acceptedEntitiesForPlan,
          complianceItems: acceptedComplianceForPlan,
          integrations: acceptedIntegrationsForPlan,
          vocabulary: acceptedVocabularyForPlan,
          domains: safeDomains,
        }, feedback);
        lastCrossCutting = r.crossCutting;
        return r;
      },
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '2.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: '1.8',
          produced_by_agent_role: 'orchestrator',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: {
            kind: 'release_plan',
            schemaVersion: '2.0',
            releases: bloom.releases,
            cross_cutting: bloom.crossCutting,
            approved: false,
          } satisfies ReleasePlanContentV2 as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => bloom.releases.map(r => ({
        id: r.release_id,
        label: `Release ${r.ordinal}: ${r.name}`,
        description: r.description,
        tradeoffs: `${r.rationale} • contains ${r.contains.journeys.length}j/${r.contains.workflows.length}w/${r.contains.entities.length}e/${r.contains.compliance.length}c/${r.contains.integrations.length}i/${r.contains.vocabulary.length}v`,
      })),
      buildTitle: () => 'Review the proposed release plan (v2 manifest)',
      buildSummary: (bloom) => `${bloom.releases.length} release(s) proposed. Every accepted handoff artifact is assigned to exactly one release OR to the cross_cutting bucket. The deterministic 1.8 verifier will confirm exact coverage, ordinal integrity, and forward-only dependencies before final approval.`,
    });
    if (!round18.success) return { success: false, error: round18.error, artifactIds };
    const releasePlan = round18.bloom;
    const keptReleaseIds = new Set(round18.keptIds);
    const approvedReleases: ReleaseV2[] = releasePlan.releases
      .filter(r => keptReleaseIds.size === 0 || keptReleaseIds.has(r.release_id));
    approvedReleases.sort((a, b) => a.ordinal - b.ordinal);
    approvedReleases.forEach((r, i) => { r.ordinal = i + 1; });
    if (approvedReleases.length === 0) {
      return {
        success: false,
        error: 'Phase 1.8: no releases remain after human review — re-run with feedback',
        artifactIds,
      };
    }

    // Run the deterministic 1.8 verifier BEFORE minting the approved
    // record. If any blocking gaps, fail with a description pointing at
    // the coverage_gap records.
    const draftPlan: ReleasePlanContentV2 = {
      kind: 'release_plan',
      schemaVersion: '2.0',
      releases: approvedReleases,
      cross_cutting: lastCrossCutting,
      approved: false,
    };
    const manifestGaps = verifyReleaseManifest({
      plan: draftPlan,
      journeys: safeJourneys,
      workflows: acceptedWorkflowsForPlan,
      entityIds: acceptedEntitiesForPlan.map(e => e.id),
      complianceIds: acceptedComplianceForPlan.map(c => c.id),
      integrations: acceptedIntegrationsForPlan,
      vocabulary: acceptedVocabularyForPlan,
    });
    const blockingManifestGaps = manifestGaps.filter(g => g.severity === 'blocking');
    if (blockingManifestGaps.length > 0) {
      const gapRecIds = this.persistCoverageGaps(ctx, manifestGaps, [round18.record.id]);
      getLogger().warn('workflow', 'Phase 1.8 verifier: blocking coverage/coherence gaps detected', {
        workflow_run_id: workflowRun.id,
        gap_count: blockingManifestGaps.length,
        advisory_count: manifestGaps.length - blockingManifestGaps.length,
        gap_record_ids: gapRecIds,
      });
      return {
        success: false,
        error: `Phase 1.8 manifest verifier: ${blockingManifestGaps.length} blocking gap(s) — ${blockingManifestGaps.map(g => g.check).join(', ')}. Review coverage_gap records and re-run with feedback.`,
        artifactIds,
      };
    }
    if (manifestGaps.length > 0) {
      this.persistCoverageGaps(ctx, manifestGaps, [round18.record.id]);
      getLogger().info('workflow', 'Phase 1.8 verifier: advisory-only findings', {
        workflow_run_id: workflowRun.id,
        advisory_count: manifestGaps.length,
      });
    }

    // Final approved record. Phase 2+ reads this via
    // workflow_runs.active_release_plan_record_id.
    const approvedReleasePlanRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '2.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.8',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [round18.record.id],
      content: {
        kind: 'release_plan',
        schemaVersion: '2.0',
        releases: approvedReleases,
        cross_cutting: lastCrossCutting,
        approved: true,
      } satisfies ReleasePlanContentV2 as unknown as Record<string, unknown>,
    });
    artifactIds.push(approvedReleasePlanRecord.id);
    engine.stateMachine.setActiveReleasePlanRecordId(workflowRun.id, approvedReleasePlanRecord.id);
    engine.ingestionPipeline.ingest(approvedReleasePlanRecord);

    // ── Phase Gate ──────────────────────────────────────────
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.8',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [
        handoffRecord.id, statementRecord.id, approvalMirrorRecord.id,
        approvedReleasePlanRecord.id,
      ],
      content: {
        kind: 'phase_gate',
        phase_id: '1',
        intent_statement_record_id: statementRecord.id,
        product_description_handoff_record_id: handoffRecord.id,
        active_release_plan_record_id: approvedReleasePlanRecord.id,
        has_unresolved_warnings: false,
        has_unapproved_proposals: false,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '1' });
    return { success: true, artifactIds };
  }

  // ── Product-lens helpers ───────────────────────────────────────

  /**
   * Present a bloom prune gate as a decision_bundle_presented. Returns
   * success + the kept item ids, or failure when the user rejected an
   * interpretation assumption (the re-bloom loop is Wave 5). Writes
   * the bundle record onto `artifactIds` as a side effect.
   */
  private async presentProductBloomGate(
    ctx: PhaseContext,
    opts: {
      subPhaseId: string;
      derivedFromRecordId: string;
      title: string;
      summary: string;
      items: Array<{ id: string; label: string; description?: string; tradeoffs?: string }>;
      lensRationale: string;
      humanDecisions: HumanDecisionSummary[];
      artifactIds: string[];
    },
  ): Promise<
    | { success: true; keptIds: string[]; freeTextFeedback?: string }
    | { success: false; error: string }
  > {
    const { workflowRun, engine } = ctx;
    const mirrorItems: MirrorItem[] = [
      {
        id: 'lens-framing',
        text: `This list is proposed expansively under the **product** lens — reject anything that does not belong in your product.`,
        rationale: opts.lensRationale,
        category: 'lens',
      },
    ];
    const menuOptions: MenuOption[] = opts.items.map((it, i) => ({
      id: it.id,
      label: it.label,
      description: it.description,
      tradeoffs: it.tradeoffs,
      recommended: i === 0,
    }));
    const bundleContent: DecisionBundleContent = {
      surface_id: `phase1-product-${opts.subPhaseId}-${opts.derivedFromRecordId}`,
      title: opts.title,
      summary: opts.summary,
      mirror: { kind: 'product_bloom_mirror', items: mirrorItems },
      menu: {
        question: 'Keep the items that belong in your product; reject anything that does not:',
        context: `${opts.items.length} item(s) proposed. The product lens intentionally over-proposes — pruning is your job.`,
        multi_select: true,
        allow_free_text: false,
        options: menuOptions,
      },
    };
    const bundleRecord = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: opts.subPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [opts.derivedFromRecordId],
      content: bundleContent as unknown as Record<string, unknown>,
    });
    opts.artifactIds.push(bundleRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: bundleRecord.id, artifactType: 'product_bloom_mirror' });
    engine.eventBus.emit('menu:presented', { menuId: bundleRecord.id, options: opts.items.map(i => i.id) });

    let resolution: {
      type: string;
      payload?: {
        mirror_decisions?: MirrorItemDecision[];
        menu_selections?: MenuOptionSelection[];
        /** Wave 5 — optional free-text feedback channel. When present, the
         *  caller re-runs the proposer with this text injected as
         *  `{{human_feedback}}` rather than accepting the menu as-is. */
        free_text_feedback?: string;
      };
    };
    try {
      resolution = await engine.pauseForDecision(
        workflowRun.id,
        bundleRecord.id,
        'decision_bundle',
      ) as typeof resolution;
    } catch (err) {
      return { success: false, error: `Sub-phase ${opts.subPhaseId} prune decisions failed: ${String(err)}` };
    }

    const mirrorDecisions = resolution.payload?.mirror_decisions ?? [];
    const rejected = mirrorDecisions.filter(d => d.action === 'rejected');
    if (rejected.length > 0) {
      // Mirror-item rejection is the "this framing is wrong" signal — no
      // proposer re-run will fix it. Halts with requires_input so a human
      // can re-state the intent. Free-text feedback is a separate, softer
      // channel handled below.
      getLogger().info('workflow', `Sub-phase ${opts.subPhaseId} interpretation mirror had rejections — halting`, {
        workflow_run_id: workflowRun.id,
        rejected_ids: rejected.map(r => r.item_id),
      });
      return { success: false, error: `User rejected interpretation assumption at sub-phase ${opts.subPhaseId}` };
    }

    const freeTextFeedback = resolution.payload?.free_text_feedback?.trim();
    if (freeTextFeedback && freeTextFeedback.length > 0) {
      // Feedback channel: the caller loops and re-runs the proposer. We do
      // NOT record any accept/reject decisions here — the user has explicitly
      // asked for a re-bloom, so the current items are considered superseded.
      return { success: true, keptIds: [], freeTextFeedback };
    }

    const menuSelections = resolution.payload?.menu_selections ?? [];
    const keptIds = menuSelections.map(s => s.option_id);
    for (const s of menuSelections) {
      opts.humanDecisions.push({ action: 'accepted', sub_phase_id: opts.subPhaseId, target_id: s.option_id });
    }
    for (const item of opts.items) {
      if (!keptIds.includes(item.id) && menuSelections.length > 0) {
        opts.humanDecisions.push({ action: 'rejected', sub_phase_id: opts.subPhaseId, target_id: item.id });
      }
    }
    return { success: true, keptIds };
  }

  /**
   * Wrap a bloom round in the proposer/gate feedback loop: run the
   * proposer, write its artifact, present the prune gate, and either
   * return the kept items OR re-run with free-text feedback. Capped at
   * MAX_FEEDBACK_ITERATIONS so a stubborn user can't livelock the phase.
   *
   * Each iteration writes a NEW bloom artifact_produced record — no
   * supersession logic. Downstream consumers read state from the kept
   * items returned by this helper, not by re-scanning the stream.
   */
  private async runBloomRoundWithFeedbackLoop<T>(
    ctx: PhaseContext,
    spec: {
      subPhaseId: string;
      roundLabel: string;
      lensRationale: string;
      humanDecisions: HumanDecisionSummary[];
      artifactIds: string[];
      priorRecordIds: string[];
      /** Called once per iteration; receives the accumulated feedback. */
      runProposer: (feedback: string) => Promise<T>;
      /** Writes the proposer output as an artifact_produced record. */
      writeBloomRecord: (bloom: T, derivedFrom: string[]) => GovernedStreamRecord;
      mapItems: (bloom: T) => Array<{ id: string; label: string; description?: string; tradeoffs?: string }>;
      buildSummary: (bloom: T) => string;
      buildTitle: () => string;
    },
  ): Promise<
    | { success: true; bloom: T; record: GovernedStreamRecord; keptIds: string[] }
    | { success: false; error: string }
  > {
    const MAX_FEEDBACK_ITERATIONS = 3;
    let accumulatedFeedback = '';
    let lastBloom: T | null = null;
    let lastRecord: GovernedStreamRecord | null = null;

    for (let iter = 1; iter <= MAX_FEEDBACK_ITERATIONS + 1; iter++) {
      let bloom: T;
      try {
        bloom = await spec.runProposer(accumulatedFeedback);
      } catch (err) {
        return { success: false, error: `${spec.roundLabel} bloom failed: ${err instanceof Error ? err.message : String(err)}` };
      }
      const derivedFrom = [
        ...spec.priorRecordIds,
        ...(lastRecord ? [lastRecord.id] : []),
      ];
      const record = spec.writeBloomRecord(bloom, derivedFrom);
      ctx.engine.ingestionPipeline.ingest(record);
      lastBloom = bloom;
      lastRecord = record;

      const gate = await this.presentProductBloomGate(ctx, {
        subPhaseId: spec.subPhaseId,
        derivedFromRecordId: record.id,
        title: spec.buildTitle(),
        summary: spec.buildSummary(bloom),
        items: spec.mapItems(bloom),
        lensRationale: spec.lensRationale,
        humanDecisions: spec.humanDecisions,
        artifactIds: spec.artifactIds,
      });
      if (!gate.success) return gate;

      if (!gate.freeTextFeedback) {
        return { success: true, bloom, record, keptIds: gate.keptIds };
      }

      if (iter > MAX_FEEDBACK_ITERATIONS) {
        getLogger().info('workflow', `Sub-phase ${spec.subPhaseId} exhausted ${MAX_FEEDBACK_ITERATIONS} feedback iterations — halting`, {
          workflow_run_id: ctx.workflowRun.id,
        });
        return { success: false, error: `Sub-phase ${spec.subPhaseId} reached max feedback iterations (${MAX_FEEDBACK_ITERATIONS}); human intervention required.` };
      }

      getLogger().info('workflow', `Sub-phase ${spec.subPhaseId} received free-text feedback — re-running proposer (iteration ${iter + 1})`, {
        workflow_run_id: ctx.workflowRun.id,
        feedback_chars: gate.freeTextFeedback.length,
      });
      accumulatedFeedback = accumulateFeedback(accumulatedFeedback, gate.freeTextFeedback);
    }

    // Unreachable — loop always returns via success or max-iterations path.
    return { success: false, error: `Sub-phase ${spec.subPhaseId} feedback loop exited unexpectedly`, };
  }

  /**
   * 1.0b — silent product discovery. Reads raw intent + inlined
   * referenced files; produces vision, description, seed personas /
   * journeys / phasing, and extracted items.
   */
  private async runIntentDiscovery(ctx: PhaseContext, rawIntentText: string): Promise<IntentDiscoveryResult> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_0b_intent_discovery', 'product');
    if (!template) throw new Error('1.0b intent_discovery product-lens template not found');
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);
    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) throw new Error(`1.0b missing variables: ${rendered.missing_variables.join(', ')}`);
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.0b', agentRole: 'domain_interpreter', label: 'Phase 1.0b — Intent Discovery' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Intent Discovery returned unparseable JSON');
    return {
      analysisSummary: (parsed.analysisSummary as string) ?? '',
      productVision: (parsed.productVision as string) ?? '',
      productDescription: (parsed.productDescription as string) ?? '',
      personas: (parsed.personas as Persona[] | undefined) ?? [],
      userJourneys: (parsed.userJourneys as UserJourney[] | undefined) ?? [],
      phasingStrategy: (parsed.phasingStrategy as PhasingPhase[] | undefined) ?? [],
      successMetrics: (parsed.successMetrics as string[] | undefined) ?? [],
      uxRequirements: (parsed.uxRequirements as string[] | undefined) ?? [],
      requirements: this.normalizeExtractedItems(parsed.requirements, 'REQUIREMENT', 'REQ'),
      decisions: this.normalizeExtractedItems(parsed.decisions, 'DECISION', 'DEC'),
      constraints: this.normalizeExtractedItems(parsed.constraints, 'CONSTRAINT', 'CON'),
      openQuestions: this.normalizeExtractedItems(parsed.openQuestions, 'OPEN_QUESTION', 'Q'),
    };
  }

  /**
   * 1.0c — Technical Constraints Discovery. Transcribes stated-not-
   * invented technical decisions (stack, infra, security, deployment)
   * from the source docs. Every captured TechnicalConstraint carries a
   * `source_ref.excerpt` for downstream drift-detection chains.
   */
  private async runTechnicalConstraintsDiscovery(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<TechnicalConstraint[]> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'domain_interpreter', '01_0c_technical_constraints_discovery', 'product',
    );
    if (!template) throw new Error('1.0c technical_constraints_discovery product-lens template not found');
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);
    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      throw new Error(`1.0c missing variables: ${rendered.missing_variables.join(', ')}`);
    }
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.2,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.0c', agentRole: 'domain_interpreter', label: 'Phase 1.0c — Technical Constraints Discovery' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Technical Constraints Discovery returned unparseable JSON');
    const raw = Array.isArray(parsed.technicalConstraints) ? parsed.technicalConstraints : [];
    return this.normalizeTechnicalConstraints(raw);
  }

  /**
   * 1.0d — Compliance & Retention Discovery. Captures regulatory
   * regimes, legal retention obligations, and audit requirements as
   * ExtractedItem records (type=CONSTRAINT/DECISION/REQUIREMENT/OPEN_QUESTION).
   */
  private async runComplianceRetentionDiscovery(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<ExtractedItem[]> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'domain_interpreter', '01_0d_compliance_retention_discovery', 'product',
    );
    if (!template) throw new Error('1.0d compliance_retention_discovery product-lens template not found');
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);
    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      throw new Error(`1.0d missing variables: ${rendered.missing_variables.join(', ')}`);
    }
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.2,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.0d', agentRole: 'domain_interpreter', label: 'Phase 1.0d — Compliance & Retention Discovery' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Compliance & Retention Discovery returned unparseable JSON');
    const raw = Array.isArray(parsed.complianceExtractedItems) ? parsed.complianceExtractedItems : [];
    // Preserve any source_ref on each item during normalization.
    return this.normalizeExtractedItemsWithProvenance(raw, 'COMP');
  }

  /**
   * 1.0e — V&V Requirements Discovery. Captures measurable
   * performance / availability / reliability / security / accessibility
   * targets with explicit threshold + measurement method.
   */
  private async runVVRequirementsDiscovery(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<VVRequirement[]> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'domain_interpreter', '01_0e_vv_requirements_discovery', 'product',
    );
    if (!template) throw new Error('1.0e vv_requirements_discovery product-lens template not found');
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);
    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      throw new Error(`1.0e missing variables: ${rendered.missing_variables.join(', ')}`);
    }
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.2,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.0e', agentRole: 'domain_interpreter', label: 'Phase 1.0e — V&V Requirements Discovery' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('V&V Requirements Discovery returned unparseable JSON');
    const raw = Array.isArray(parsed.vvRequirements) ? parsed.vvRequirements : [];
    return this.normalizeVVRequirements(raw);
  }

  /**
   * 1.0f — Canonical Vocabulary Discovery. Captures domain-specific
   * terms + definitions from the source docs.
   */
  private async runCanonicalVocabularyDiscovery(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<VocabularyTerm[]> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate(
      'domain_interpreter', '01_0f_canonical_vocabulary_discovery', 'product',
    );
    if (!template) throw new Error('1.0f canonical_vocabulary_discovery product-lens template not found');
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);
    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: enrichedIntent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      throw new Error(`1.0f missing variables: ${rendered.missing_variables.join(', ')}`);
    }
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.2,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.0f', agentRole: 'domain_interpreter', label: 'Phase 1.0f — Canonical Vocabulary Discovery' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Canonical Vocabulary Discovery returned unparseable JSON');
    const raw = Array.isArray(parsed.canonicalVocabulary) ? parsed.canonicalVocabulary : [];
    return this.normalizeVocabularyTerms(raw);
  }

  /**
   * 1.0g — deterministic composer. Merges the five extraction outputs
   * into a single IntentDiscoveryBundle. No LLM call — just structural
   * assembly + id-uniqueness cleanup.
   */
  private composeDiscoveryBundle(
    product: IntentDiscoveryResult,
    technicalConstraints: TechnicalConstraint[],
    complianceExtractedItems: ExtractedItem[],
    vvRequirements: VVRequirement[],
    canonicalVocabulary: VocabularyTerm[],
  ): IntentDiscoveryBundle {
    return { product, technicalConstraints, complianceExtractedItems, vvRequirements, canonicalVocabulary };
  }

  // ── Extraction normalizers (id reassignment + provenance preservation) ──

  private normalizeTechnicalConstraints(raw: unknown[]): TechnicalConstraint[] {
    return raw.map((r, i) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `TECH-${i + 1}`,
        category: typeof o.category === 'string' ? o.category : 'uncategorized',
        text: typeof o.text === 'string' ? o.text : '',
        technology: typeof o.technology === 'string' ? o.technology : undefined,
        version: typeof o.version === 'string' ? o.version : undefined,
        rationale: typeof o.rationale === 'string' ? o.rationale : undefined,
        source_ref: this.normalizeSourceRef(o.source_ref),
      };
    }).filter(t => t.text.length > 0);
  }

  private normalizeVVRequirements(raw: unknown[]): VVRequirement[] {
    return raw.map((r, i) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `VV-${i + 1}`,
        category: typeof o.category === 'string' ? o.category : 'uncategorized',
        target: typeof o.target === 'string' ? o.target : '',
        measurement: typeof o.measurement === 'string' ? o.measurement : '',
        threshold: typeof o.threshold === 'string' ? o.threshold : undefined,
        source_ref: this.normalizeSourceRef(o.source_ref),
      };
    }).filter(v => v.target.length > 0 && v.measurement.length > 0);
  }

  private normalizeVocabularyTerms(raw: unknown[]): VocabularyTerm[] {
    return raw.map((r, i) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `VOC-${i + 1}`,
        term: typeof o.term === 'string' ? o.term : '',
        definition: typeof o.definition === 'string' ? o.definition : '',
        synonyms: Array.isArray(o.synonyms) ? o.synonyms.filter(s => typeof s === 'string') as string[] : [],
        source_ref: this.normalizeSourceRef(o.source_ref),
      };
    }).filter(v => v.term.length > 0 && v.definition.length > 0);
  }

  /**
   * Preserve `source_ref` provenance on ExtractedItem captures (used by
   * compliance discovery). The existing `normalizeExtractedItems` drops
   * source_ref; this variant retains it.
   */
  private normalizeExtractedItemsWithProvenance(
    raw: unknown[],
    idPrefix: string,
  ): ExtractedItem[] {
    const now = new Date().toISOString();
    return raw.map((r, i) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const typeRaw = typeof o.type === 'string' ? o.type.toUpperCase() : 'CONSTRAINT';
      const type: ExtractedItem['type'] =
        typeRaw === 'REQUIREMENT' || typeRaw === 'DECISION' || typeRaw === 'CONSTRAINT' || typeRaw === 'OPEN_QUESTION'
          ? typeRaw
          : 'CONSTRAINT';
      return {
        id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `${idPrefix}-${i + 1}`,
        type,
        text: typeof o.text === 'string' ? o.text : '',
        extractedFromTurnId: typeof o.extractedFromTurnId === 'number' ? o.extractedFromTurnId : undefined,
        timestamp: typeof o.timestamp === 'string' && o.timestamp.length > 0 ? o.timestamp : now,
        source_ref: this.normalizeSourceRef(o.source_ref),
      };
    }).filter(x => x.text.length > 0);
  }

  private normalizeSourceRef(raw: unknown): SourceRef | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const document_path = typeof o.document_path === 'string' ? o.document_path : '';
    const excerpt = typeof o.excerpt === 'string' ? o.excerpt : '';
    if (!document_path || !excerpt) return undefined;
    return {
      document_path,
      section_heading: typeof o.section_heading === 'string' ? o.section_heading : undefined,
      excerpt,
      excerpt_start: typeof o.excerpt_start === 'number' ? o.excerpt_start : undefined,
      excerpt_end: typeof o.excerpt_end === 'number' ? o.excerpt_end : undefined,
    };
  }

  private async runBusinessDomainsBloom(
    ctx: PhaseContext,
    discovery: IntentDiscoveryResult,
    humanFeedback: string = '',
  ): Promise<{ domains: BusinessDomain[]; personas: Persona[] }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_2_business_domains_bloom', 'product');
    if (!template) throw new Error('1.2 business_domains_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      product_vision: discovery.productVision,
      product_description: discovery.productDescription,
      discovered_personas: this.formatPersonas(discovery.personas),
      discovered_journeys: this.formatJourneys(discovery.userJourneys),
      phasing_strategy: this.formatPhasing(discovery.phasingStrategy),
      requirements: this.formatExtractedItems(discovery.requirements),
      human_feedback: humanFeedback.trim().length > 0 ? humanFeedback : '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) throw new Error(`1.2 missing variables: ${rendered.missing_variables.join(', ')}`);
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.5,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.2', agentRole: 'domain_interpreter', label: 'Phase 1.2 — Business Domains & Personas Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Business Domains bloom returned unparseable JSON');
    return {
      domains: (parsed.domains as BusinessDomain[] | undefined) ?? [],
      personas: (parsed.personas as Persona[] | undefined) ?? [],
    };
  }

  private async runEntitiesBloom(
    ctx: PhaseContext,
    acceptedDomains: BusinessDomain[],
    acceptedWorkflows: WorkflowV2[],
    acceptedPersonas: Persona[],
    acceptedJourneys: UserJourney[],
    humanFeedback: string = '',
  ): Promise<{ entities: Entity[] }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_4_entities_bloom', 'product');
    if (!template) throw new Error('1.4 entities_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      accepted_domains: this.formatDomains(acceptedDomains),
      accepted_workflows: this.formatWorkflowsV2(acceptedWorkflows),
      accepted_personas: this.formatPersonas(acceptedPersonas),
      accepted_journeys: this.formatJourneys(acceptedJourneys),
      human_feedback: humanFeedback.trim().length > 0 ? humanFeedback : '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) throw new Error(`1.4 missing variables: ${rendered.missing_variables.join(', ')}`);
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.5,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.4', agentRole: 'domain_interpreter', label: 'Phase 1.4 — Entities Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Entities bloom returned unparseable JSON');
    return { entities: (parsed.entities as Entity[] | undefined) ?? [] };
  }

  private async runIntegrationsQaBloom(
    ctx: PhaseContext,
    acceptedDomains: BusinessDomain[],
    acceptedEntities: Entity[],
    acceptedWorkflows: WorkflowV2[],
    acceptedPersonas: Persona[],
    acceptedJourneys: UserJourney[],
    humanFeedback: string = '',
  ): Promise<{ integrations: Integration[]; qualityAttributes: string[] }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_5_integrations_qa_bloom', 'product');
    if (!template) throw new Error('1.5 integrations_qa_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      accepted_domains: this.formatDomains(acceptedDomains),
      accepted_entities: this.formatEntities(acceptedEntities),
      accepted_workflows: this.formatWorkflowsV2(acceptedWorkflows),
      accepted_personas: this.formatPersonas(acceptedPersonas),
      accepted_journeys: this.formatJourneys(acceptedJourneys),
      human_feedback: humanFeedback.trim().length > 0 ? humanFeedback : '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) throw new Error(`1.5 missing variables: ${rendered.missing_variables.join(', ')}`);
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.5,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.5', agentRole: 'domain_interpreter', label: 'Phase 1.5 — Integrations & QA Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Integrations/QA bloom returned unparseable JSON');
    return {
      integrations: (parsed.integrations as Integration[] | undefined) ?? [],
      qualityAttributes: Array.isArray(parsed.qualityAttributes) ? parsed.qualityAttributes as string[] : [],
    };
  }

  /**
   * 1.6 — assemble the product description handoff.
   *
   * Mirrors v1's `materializeIntakeHandoff` pattern: arrays are composed
   * DETERMINISTICALLY from the accepted bloom outputs. The LLM is only
   * asked to refine NARRATIVE fields (`productVision`,
   * `productDescription`, `summary`, `openLoops`) using a compact
   * summary of the blooms. This keeps 1.6 model-agnostic and eliminates
   * the class of "synthesis LLM drops arrays" failures that v1 also had
   * to work around (see janumicode/src/lib/curation/narrativeCurator.ts
   * lines 941–961 — v1's fallback to `draft_plan`).
   *
   * If the narrative LLM call fails (unparseable JSON, missing
   * variables, CLI error), we fall back to the 1.0b Intent Discovery
   * seed values for vision/description/summary. The handoff arrays
   * remain intact.
   */
  private async runProductDescriptionSynthesis(
    ctx: PhaseContext,
    input: {
      discovery: IntentDiscoveryResult;
      domains: BusinessDomain[];
      personas: Persona[];
      journeys: UserJourney[];
      workflows: WorkflowV2[];
      entities: Entity[];
      integrations: Integration[];
      qualityAttributes: string[];
      humanDecisions: HumanDecisionSummary[];
      // Decomposed 1.0 extraction slots — threaded from the discovery
      // bundle so the deterministic assembler can carry them forward.
      technicalConstraints?: TechnicalConstraint[];
      complianceExtractedItems?: ExtractedItem[];
      vvRequirements?: VVRequirement[];
      canonicalVocabulary?: VocabularyTerm[];
    },
  ): Promise<ProductDescriptionHandoffContent> {
    // 1. Always assemble the base handoff deterministically.
    const base = this.assembleHandoffFromBloomOutputs(input);

    // 2. Try to refine narrative fields via a small LLM call. This is
    //    advisory — failures keep the 1.0b seed narrative.
    try {
      const refined = await this.refineHandoffNarrative(ctx, input, base);
      return { ...base, ...refined };
    } catch (err) {
      getLogger().warn('workflow', '1.6 narrative refinement failed; keeping 1.0b seed values', {
        workflow_run_id: ctx.workflowRun.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return base;
    }
  }

  /**
   * LLM-backed narrative refinement for 1.6. Inputs are a compact
   * summary of the bloom shape (counts + names + id-only references,
   * not full JSON); outputs are a small object with refined narrative
   * fields only. Small in, small out — model-agnostic.
   */
  private async refineHandoffNarrative(
    ctx: PhaseContext,
    input: {
      discovery: IntentDiscoveryResult;
      domains: BusinessDomain[];
      personas: Persona[];
      journeys: UserJourney[];
      workflows: WorkflowV2[];
      entities: Entity[];
      integrations: Integration[];
      qualityAttributes: string[];
    },
    base: ProductDescriptionHandoffContent,
  ): Promise<Partial<ProductDescriptionHandoffContent>> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_6_product_description_synthesis', 'product');
    if (!template) {
      throw new Error('1.6 product_description_synthesis product-lens template not found');
    }

    // Compact summary of the bloom shape — names + counts only, no full
    // JSON payload. Keeps input tokens ~1 K and output tokens ~500.
    const bloomSummary = [
      `Personas (${input.personas.length}): ${input.personas.map(p => `${p.id} ${p.name}`).join('; ')}`,
      `User Journeys (${input.journeys.length}): ${input.journeys.map(j => `${j.id} ${j.title}`).join('; ')}`,
      `Business Domains (${input.domains.length}): ${input.domains.map(d => `${d.id} ${d.name}`).join('; ')}`,
      `Entities: ${input.entities.length}`,
      `Workflows (${input.workflows.length}): ${input.workflows.map(w => `${w.id} ${w.name}`).join('; ')}`,
      `Integrations (${input.integrations.length}): ${input.integrations.map(i => `${i.id} ${i.name}`).join('; ')}`,
      `Quality Attributes: ${input.qualityAttributes.length}`,
    ].join('\n');

    const rendered = engine.templateLoader.render(template, {
      seed_vision: input.discovery.productVision,
      seed_description: input.discovery.productDescription,
      seed_summary: input.discovery.analysisSummary,
      bloom_summary: bloomSummary,
      open_questions_seed: input.discovery.openQuestions.map(q => `- ${q.id}: ${q.text}`).join('\n') || '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      throw new Error(`1.6 narrative template missing variables: ${rendered.missing_variables.join(', ')}`);
    }

    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.3,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.6', agentRole: 'domain_interpreter', label: 'Phase 1.6 — Product Description Narrative Refinement' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('1.6 narrative LLM returned unparseable JSON');

    const refined: Partial<ProductDescriptionHandoffContent> = {};
    if (typeof parsed.productVision === 'string' && parsed.productVision.trim().length > 0) {
      refined.productVision = parsed.productVision.trim();
    }
    if (typeof parsed.productDescription === 'string' && parsed.productDescription.trim().length > 0) {
      refined.productDescription = parsed.productDescription.trim();
    }
    if (typeof parsed.summary === 'string' && parsed.summary.trim().length > 0) {
      refined.summary = parsed.summary.trim();
    }
    if (Array.isArray(parsed.openLoops) && parsed.openLoops.length > 0) {
      refined.openLoops = parsed.openLoops as OpenLoop[];
    }
    return refined;
  }

  private assembleHandoffFromBloomOutputs(input: {
    discovery: IntentDiscoveryResult;
    domains: BusinessDomain[];
    personas: Persona[];
    journeys: UserJourney[];
    workflows: WorkflowV2[];
    entities: Entity[];
    integrations: Integration[];
    qualityAttributes: string[];
    humanDecisions: HumanDecisionSummary[];
    // Decomposed Phase 1.0 extraction slots (iter-4). Optional so legacy
    // call sites that don't yet thread the bundle compile; handler
    // refactor below will populate them.
    technicalConstraints?: TechnicalConstraint[];
    complianceExtractedItems?: ExtractedItem[];
    vvRequirements?: VVRequirement[];
    canonicalVocabulary?: VocabularyTerm[];
  }): ProductDescriptionHandoffContent {
    // Refresh phasing's journeyIds against the accepted journeys — journeys
    // pruned in 1.3 must not linger in any phase's journeyIds list. This
    // replaces v1's finalized-plan merge behaviour deterministically.
    const acceptedJourneyIds = new Set(input.journeys.map(j => j.id));
    const phasingStrategy = input.discovery.phasingStrategy.map(phase => ({
      ...phase,
      journeyIds: (phase.journeyIds ?? []).filter(id => acceptedJourneyIds.has(id)),
    }));

    return {
      kind: 'product_description_handoff',
      schemaVersion: '1.1',
      requestCategory: 'product_or_feature',
      productVision: input.discovery.productVision,
      productDescription: input.discovery.productDescription,
      summary: input.discovery.analysisSummary,
      personas: input.personas,
      userJourneys: input.journeys,
      phasingStrategy,
      successMetrics: input.discovery.successMetrics,
      businessDomainProposals: input.domains,
      entityProposals: input.entities,
      workflowProposals: input.workflows,
      integrationProposals: input.integrations,
      qualityAttributes: input.qualityAttributes,
      uxRequirements: input.discovery.uxRequirements,
      requirements: input.discovery.requirements,
      decisions: input.discovery.decisions,
      constraints: input.discovery.constraints,
      openQuestions: input.discovery.openQuestions,
      // New extraction fields — populated by the decomposed 1.0c–1.0f
      // extraction passes. Defaulted to empty on the union type so
      // existing tests that pre-date the bundle wiring keep compiling;
      // the handler refactor below threads real values through.
      technicalConstraints: input.technicalConstraints ?? [],
      complianceExtractedItems: input.complianceExtractedItems ?? [],
      vvRequirements: input.vvRequirements ?? [],
      canonicalVocabulary: input.canonicalVocabulary ?? [],
      humanDecisions: input.humanDecisions,
      openLoops: input.discovery.openQuestions.map(q => ({
        category: 'deferred_decision' as const,
        description: q.text,
        priority: 'medium' as const,
      })),
    };
  }

  /**
   * Project a product_description_handoff into the IntentStatementContent
   * shape that Phase 2+ reads today. A follow-up can upgrade specific
   * downstream phases to read the richer handoff directly.
   */
  private deriveIntentStatementFromHandoff(handoff: ProductDescriptionHandoffContent): Record<string, unknown> {
    const primaryPersona = handoff.personas[0];
    const whoItServes = primaryPersona ? `${primaryPersona.name} — ${primaryPersona.description}` : 'unspecified';
    const problemItSolves = handoff.productDescription.length > 0 ? handoff.productDescription : handoff.summary;
    return {
      product_concept: {
        name: handoff.productVision || 'Untitled product',
        description: handoff.productDescription || handoff.summary,
        who_it_serves: whoItServes,
        problem_it_solves: problemItSolves,
      },
      confirmed_assumptions: handoff.decisions.map(d => ({
        assumption_id: d.id,
        assumption: d.text,
        confirmed_by_record_id: d.id,
      })),
      confirmed_constraints: handoff.constraints.map(c => c.text),
      out_of_scope: handoff.openLoops
        .filter(l => l.category === 'deferred_decision' || l.category === 'followup')
        .map(l => l.description),
    };
  }

  // ── Format helpers (human-readable context blocks for templates) ──

  private formatPersonas(ps: Persona[]): string {
    if (!ps.length) return '(none)';
    return ps.map(p => {
      const goals = (p.goals ?? []).length > 0 ? `\n  Goals: ${(p.goals ?? []).join('; ')}` : '';
      const pains = (p.painPoints ?? []).length > 0 ? `\n  Pain points: ${(p.painPoints ?? []).join('; ')}` : '';
      return `- **${p.id}**: ${p.name} — ${p.description}${goals}${pains}`;
    }).join('\n');
  }

  private formatJourneys(js: UserJourney[]): string {
    if (!js.length) return '(none)';
    return js.map(j => `- **${j.id}** [${j.implementationPhase ?? 'TBD'}] ${j.title} (${j.personaId}): ${j.scenario}`).join('\n');
  }

  private formatPhasing(ps: PhasingPhase[]): string {
    if (!ps.length) return '(none — to be derived)';
    return ps.map(p => {
      const jids = (p.journeyIds ?? []).length > 0 ? ` (journeys: ${p.journeyIds.join(', ')})` : '';
      return `- **${p.phase}**: ${p.description}${jids}\n  Rationale: ${p.rationale ?? ''}`;
    }).join('\n');
  }

  private formatExtractedItems(items: ExtractedItem[]): string {
    if (!items.length) return '(none)';
    return items.slice(0, 25).map(i => `- ${i.text}`).join('\n');
  }

  private formatDomains(ds: BusinessDomain[]): string {
    if (!ds.length) return '(none)';
    return ds.map(d => `- **${d.id}**: ${d.name} — ${d.description}`).join('\n');
  }

  private formatEntities(es: Entity[]): string {
    if (!es.length) return '(none)';
    return es.map(e => `- **${e.id}** (${e.businessDomainId}): ${e.name} — ${e.description}`).join('\n');
  }

  /**
   * Coerce an arbitrary JSON array into our ExtractedItem[] shape,
   * generating stable ids + ISO timestamps when the LLM omits them.
   * Falls back to `fallback` when the input is empty or missing.
   */
  private normalizeExtractedItems(
    raw: unknown,
    type: ExtractedItem['type'],
    idPrefix: string,
    fallback: ExtractedItem[] = [],
  ): ExtractedItem[] {
    if (!Array.isArray(raw) || raw.length === 0) return fallback;
    const now = new Date().toISOString();
    return raw.map((r, i) => {
      if (typeof r === 'string') {
        return { id: `${idPrefix}-${i + 1}`, type, text: r, timestamp: now };
      }
      const obj = r as Record<string, unknown>;
      return {
        id: (obj.id as string) ?? `${idPrefix}-${i + 1}`,
        type,
        text: (obj.text as string) ?? '',
        extractedFromTurnId: typeof obj.extractedFromTurnId === 'number' ? obj.extractedFromTurnId : undefined,
        timestamp: (obj.timestamp as string) ?? now,
      };
    });
  }

  /**
   * Best-effort parse of an LLM result — prefers the SDK-parsed value,
   * falls back to parseJsonWithRecovery on the raw text, returns null
   * if neither yields an object.
   */
  private safeParseJson(result: { parsed?: unknown; text?: string }): Record<string, unknown> | null {
    if (result.parsed && typeof result.parsed === 'object' && !Array.isArray(result.parsed)) {
      return result.parsed as Record<string, unknown>;
    }
    if (typeof result.text === 'string' && result.text.trim().length > 0) {
      const recovered = parseJsonWithRecovery(result.text);
      if (recovered.parsed && typeof recovered.parsed === 'object' && !Array.isArray(recovered.parsed)) {
        return recovered.parsed as Record<string, unknown>;
      }
    }
    return null;
  }

  // ── Wave 7 Phase 1.3 redesign — 1.3a + 1.3b + 1.3c ────────────────

  /**
   * 1.3a — User Journey Bloom proposer. Replaces the journey-half of
   * the legacy `runJourneysWorkflowsBloom`. Produces journeys only; the
   * human accepts/rejects via MMP before 1.3b consumes them.
   */
  private async runJourneyBloom13a(
    ctx: PhaseContext,
    inputs: {
      acceptedDomains: BusinessDomain[];
      acceptedPersonas: Persona[];
      phasingStrategy: PhasingPhase[];
      complianceItems: ExtractedItem[];
      retentionRules: ExtractedItem[];
      vvRequirements: VVRequirement[];
      integrations: Integration[];
    },
    humanFeedback: string = '',
  ): Promise<{ userJourneys: UserJourney[]; unreachedPersonas: string[]; unreachedDomains: string[] }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_3a_user_journey_bloom', 'product');
    if (!template) throw new Error('1.3a user_journey_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      accepted_personas: this.formatPersonas(inputs.acceptedPersonas),
      accepted_domains: this.formatDomains(inputs.acceptedDomains),
      phasing_strategy: this.formatPhasing(inputs.phasingStrategy),
      compliance_regimes: this.formatExtractedItems(inputs.complianceItems),
      retention_rules: this.formatExtractedItems(inputs.retentionRules),
      vv_requirements: this.formatVVRequirements(inputs.vvRequirements),
      integrations: this.formatIntegrations(inputs.integrations),
      human_feedback: humanFeedback.trim().length > 0 ? humanFeedback : '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) throw new Error(`1.3a missing variables: ${rendered.missing_variables.join(', ')}`);
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.5,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.3a', agentRole: 'domain_interpreter', label: 'Phase 1.3a — User Journey Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('1.3a bloom returned unparseable JSON');
    const unreachedPersonas = Array.isArray(parsed.unreached_personas)
      ? (parsed.unreached_personas as Array<{ personaId?: string }>).map(u => u.personaId ?? '').filter(Boolean)
      : [];
    const unreachedDomains = Array.isArray(parsed.unreached_domains)
      ? (parsed.unreached_domains as Array<{ domainId?: string }>).map(u => u.domainId ?? '').filter(Boolean)
      : [];
    // Self-heal filter: drop any surfaces[*] id that isn't in the
    // accepted set for its type. Mirrors the Path C 1.8 filter. When
    // the LLM emits free-text ("Compliance monitoring rules") or a
    // close-but-wrong slug (COMP-MALWARE-SCAN vs accepted COMP-SEC-MALWARE)
    // we drop it silently with an aggregated WARN rather than letting
    // the 1.3c verifier reject the whole output.
    const acceptedCompliance = new Set(inputs.complianceItems.map(c => c.id));
    const acceptedRetention = new Set(inputs.retentionRules.map(r => r.id));
    const acceptedVV = new Set(inputs.vvRequirements.map(v => v.id));
    const acceptedIntegrations = new Set(inputs.integrations.map(i => i.id));
    const rawJourneys = (parsed.userJourneys as Array<Record<string, unknown>> | undefined) ?? [];
    const droppedBySurfaceType: Record<string, string[]> = {
      compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [],
    };
    const userJourneys: UserJourney[] = rawJourneys.map(j => {
      const s = (j as { surfaces?: Record<string, unknown> }).surfaces;
      if (s && typeof s === 'object') {
        const filterArr = (key: string, accepted: Set<string>, mergeAccepted?: Set<string>) => {
          const xs = Array.isArray((s as Record<string, unknown>)[key])
            ? (s as Record<string, string[]>)[key].filter(x => typeof x === 'string')
            : [];
          const kept: string[] = [];
          for (const x of xs) {
            if (accepted.has(x) || (mergeAccepted && mergeAccepted.has(x))) kept.push(x);
            else droppedBySurfaceType[key].push(x);
          }
          (s as Record<string, string[]>)[key] = kept;
        };
        // Retention-rule ids may also resolve against the compliance set
        // (retention is a subset of compliance in our extraction model).
        filterArr('compliance_regimes', acceptedCompliance);
        filterArr('retention_rules', acceptedRetention, acceptedCompliance);
        filterArr('vv_requirements', acceptedVV);
        filterArr('integrations', acceptedIntegrations);
      }
      return j as unknown as UserJourney;
    });
    const totalDropped = Object.values(droppedBySurfaceType).reduce((a, b) => a + b.length, 0);
    if (totalDropped > 0) {
      getLogger().warn('workflow', `Phase 1.3a: dropped ${totalDropped} non-accepted id(s) from journey surfaces`, {
        workflow_run_id: ctx.workflowRun.id,
        compliance_dropped: droppedBySurfaceType.compliance_regimes.slice(0, 20),
        retention_dropped: droppedBySurfaceType.retention_rules.slice(0, 20),
        vv_dropped: droppedBySurfaceType.vv_requirements.slice(0, 20),
        integration_dropped: droppedBySurfaceType.integrations.slice(0, 20),
      });
    }
    return {
      userJourneys,
      unreachedPersonas,
      unreachedDomains,
    };
  }

  /**
   * 1.3b — System Workflow Bloom proposer. Runs after the human has
   * accepted a set of journeys via 1.3a MMP. Every workflow MUST carry
   * at least one typed trigger; the coverage verifier (1.3c) enforces
   * structural correctness of the triggers post-MMP.
   */
  private async runWorkflowBloom13b(
    ctx: PhaseContext,
    inputs: {
      acceptedJourneys: UserJourney[];
      acceptedPersonas: Persona[];
      acceptedDomains: BusinessDomain[];
      complianceItems: ExtractedItem[];
      retentionRules: ExtractedItem[];
      vvRequirements: VVRequirement[];
      integrations: Integration[];
    },
    humanFeedback: string = '',
  ): Promise<{ workflows: WorkflowV2[] }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_3b_system_workflow_bloom', 'product');
    if (!template) throw new Error('1.3b system_workflow_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      accepted_journeys: this.formatJourneysWithSteps(inputs.acceptedJourneys),
      accepted_personas: this.formatPersonas(inputs.acceptedPersonas),
      accepted_domains: this.formatDomains(inputs.acceptedDomains),
      compliance_regimes: this.formatExtractedItems(inputs.complianceItems),
      retention_rules: this.formatExtractedItems(inputs.retentionRules),
      vv_requirements: this.formatVVRequirements(inputs.vvRequirements),
      integrations: this.formatIntegrations(inputs.integrations),
      human_feedback: humanFeedback.trim().length > 0 ? humanFeedback : '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) throw new Error(`1.3b missing variables: ${rendered.missing_variables.join(', ')}`);
    const result = await engine.callForRole('domain_interpreter', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.5,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: '1.3b', agentRole: 'domain_interpreter', label: 'Phase 1.3b — System Workflow Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('1.3b bloom returned unparseable JSON');
    const rawWfs = (parsed.workflows as Array<Record<string, unknown>> | undefined) ?? [];
    // Build accepted-id sets for the self-heal filter.
    const acceptedJourneyIds = new Set(inputs.acceptedJourneys.map(j => j.id));
    const stepCountByJourney = new Map<string, number>();
    for (const j of inputs.acceptedJourneys) stepCountByJourney.set(j.id, j.steps.length);
    const acceptedCompliance = new Set(inputs.complianceItems.map(c => c.id));
    const acceptedRetention = new Set(inputs.retentionRules.map(r => r.id));
    const acceptedVV = new Set(inputs.vvRequirements.map(v => v.id));
    const acceptedIntegrations = new Set(inputs.integrations.map(i => i.id));
    const acceptedDomains = new Set(inputs.acceptedDomains.map(d => d.id));

    const droppedTriggers: string[] = [];
    const droppedWorkflows: string[] = [];
    const droppedSurfaces: string[] = [];
    const workflows: WorkflowV2[] = [];
    for (const raw of rawWfs) {
      const w = this.normalizeWorkflowV2(raw);
      // Filter triggers against accepted sets. A journey_step trigger is
      // valid if the journey is accepted AND the step_number is within
      // the journey's steps. Compliance/integration triggers must point
      // at accepted ids. Schedule/event triggers carry no id refs and
      // always pass.
      const keptTriggers = w.triggers.filter(t => {
        if (t.kind === 'journey_step') {
          if (!acceptedJourneyIds.has(t.journey_id)) {
            droppedTriggers.push(`${w.id}:journey_step:${t.journey_id}#${t.step_number}:journey-not-accepted`);
            return false;
          }
          const n = stepCountByJourney.get(t.journey_id) ?? 0;
          if (t.step_number < 1 || t.step_number > n) {
            droppedTriggers.push(`${w.id}:journey_step:${t.journey_id}#${t.step_number}:step-out-of-range`);
            return false;
          }
          return true;
        }
        if (t.kind === 'compliance') {
          if (!acceptedCompliance.has(t.regime_id)) {
            droppedTriggers.push(`${w.id}:compliance:${t.regime_id}:regime-not-accepted`);
            return false;
          }
          return true;
        }
        if (t.kind === 'integration') {
          if (!acceptedIntegrations.has(t.integration_id)) {
            droppedTriggers.push(`${w.id}:integration:${t.integration_id}:integration-not-accepted`);
            return false;
          }
          return true;
        }
        return true; // schedule, event
      });
      // A workflow with zero valid triggers can't exist — drop it.
      if (keptTriggers.length === 0) {
        droppedWorkflows.push(w.id);
        continue;
      }
      // Re-derive backs_journeys from the filtered trigger set.
      const derivedBacks = Array.from(new Set(keptTriggers
        .filter((t): t is Extract<WorkflowTrigger, { kind: 'journey_step' }> => t.kind === 'journey_step')
        .map(t => t.journey_id)));
      // Filter surfaces[*] against accepted sets.
      const raws = (raw as { surfaces?: Record<string, unknown> }).surfaces;
      const filterSurfaces = (key: string, accepted: Set<string>, mergeAccepted?: Set<string>): string[] => {
        const xs = (raws && Array.isArray(raws[key]))
          ? (raws[key] as unknown[]).filter((x): x is string => typeof x === 'string')
          : [];
        const kept: string[] = [];
        for (const x of xs) {
          if (accepted.has(x) || (mergeAccepted && mergeAccepted.has(x))) kept.push(x);
          else droppedSurfaces.push(`${w.id}:${key}:${x}`);
        }
        return kept;
      };
      const surfaces = {
        compliance_regimes: filterSurfaces('compliance_regimes', acceptedCompliance),
        retention_rules:    filterSurfaces('retention_rules', acceptedRetention, acceptedCompliance),
        vv_requirements:    filterSurfaces('vv_requirements', acceptedVV),
        integrations:       filterSurfaces('integrations', acceptedIntegrations),
      };
      // Drop workflows whose businessDomainId is not accepted (another
      // referential-integrity class — the verifier would block on this
      // but the self-heal approach is to drop with WARN instead).
      if (!acceptedDomains.has(w.businessDomainId)) {
        droppedWorkflows.push(w.id);
        droppedTriggers.push(`${w.id}:domain:${w.businessDomainId}:domain-not-accepted`);
        continue;
      }
      workflows.push({
        ...w,
        triggers: keptTriggers,
        backs_journeys: derivedBacks,
        // Re-attach filtered surfaces (casting — surfaces aren't in
        // WorkflowV2's public type yet, but are set on the content record
        // via the cast-through from raw LLM output).
        ...(raws ? { surfaces } as unknown as Partial<WorkflowV2> : {}),
      });
    }
    if (droppedTriggers.length > 0) {
      getLogger().warn('workflow', `Phase 1.3b: dropped ${droppedTriggers.length} invalid workflow trigger ref(s)`, {
        workflow_run_id: ctx.workflowRun.id,
        dropped_triggers: droppedTriggers.slice(0, 30),
      });
    }
    if (droppedSurfaces.length > 0) {
      getLogger().warn('workflow', `Phase 1.3b: dropped ${droppedSurfaces.length} non-accepted id(s) from workflow surfaces`, {
        workflow_run_id: ctx.workflowRun.id,
        dropped_surfaces: droppedSurfaces.slice(0, 30),
      });
    }
    if (droppedWorkflows.length > 0) {
      getLogger().warn('workflow', `Phase 1.3b: dropped ${droppedWorkflows.length} workflow(s) with zero valid triggers or invalid domain`, {
        workflow_run_id: ctx.workflowRun.id,
        dropped_workflows: droppedWorkflows,
      });
    }
    return { workflows };
  }

  /**
   * 1.8 v2 — Widened release-plan proposer. Assigns every accepted
   * handoff artifact to exactly one release's `contains[type]` OR to
   * the top-level `cross_cutting` bucket. Replaces the journey-only
   * legacy `runReleasePlanProposal`.
   */
  private async runReleasePlanProposalV2_18(
    ctx: PhaseContext,
    inputs: {
      productVision: string;
      productDescription: string;
      phasingStrategy: PhasingPhase[];
      journeys: UserJourney[];
      workflows: WorkflowV2[];
      entities: Entity[];
      complianceItems: ExtractedItem[];
      integrations: Integration[];
      vocabulary: VocabularyTerm[];
      domains: BusinessDomain[];
    },
    feedback: string,
  ): Promise<{ releases: ReleaseV2[]; crossCutting: CrossCuttingContents }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('orchestrator', '01_8_release_plan', 'product');
    if (!template) throw new Error('1.8 v2 release_plan product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      product_vision: inputs.productVision || '(none)',
      product_description: inputs.productDescription || '(none)',
      phasing_strategy: this.formatPhasing(inputs.phasingStrategy),
      accepted_journeys: this.formatJourneys(inputs.journeys),
      accepted_domains: this.formatDomains(inputs.domains),
      human_feedback: feedback || '(none)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      throw new Error(`1.8 v2 template has unfilled variables: ${rendered.missing_variables.join(', ')}`);
    }
    const result = await engine.callForRole('orchestrator', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.3,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '1',
        subPhaseId: '1.8',
        agentRole: 'orchestrator',
        label: 'Phase 1.8 — Release Plan v2 proposer (narrow scope)',
      },
    });
    // The 1.8 LLM output is a NARROW skeleton: release structure +
    // journey placement only. Everything else (workflows, entities,
    // compliance, integrations, vocabulary) is computed deterministically
    // by `buildReleaseManifest` from the journey placement + upstream
    // trigger/domain references. This matches JanumiCode's
    // "deterministic where possible" principle and eliminates the class
    // of small-model drift (invented ids, prose-as-compliance) observed
    // in cal-14..cal-17.
    const parsed = result.parsed as { releases?: unknown } | null;
    const rawReleases = Array.isArray(parsed?.releases)
      ? parsed.releases as Array<Record<string, unknown>>
      : [];
    const acceptedJourneyIds = new Set(inputs.journeys.map(j => j.id));
    const skeleton: LlmReleaseSkeleton[] = rawReleases.map((r, i) => {
      const ord = typeof r.ordinal === 'number' ? r.ordinal : i + 1;
      const contains_journeys = Array.isArray(r.contains_journeys)
        ? (r.contains_journeys as unknown[])
            .filter((x): x is string => typeof x === 'string' && acceptedJourneyIds.has(x))
        : [];
      return {
        release_id: typeof r.release_id === 'string' && r.release_id.length > 0 ? r.release_id : `REL-${ord}`,
        ordinal: ord,
        name: typeof r.name === 'string' && r.name.length > 0 ? r.name : `Release ${i + 1}`,
        description: typeof r.description === 'string' ? r.description : '',
        rationale: typeof r.rationale === 'string' ? r.rationale : '',
        contains_journeys,
      };
    });

    const built = buildReleaseManifest({
      releases: skeleton,
      journeys: inputs.journeys,
      workflows: inputs.workflows,
      entities: inputs.entities,
      complianceIds: inputs.complianceItems.map(c => c.id),
      integrations: inputs.integrations,
      vocabulary: inputs.vocabulary,
    });

    if (built.unplacedJourneys.length > 0) {
      getLogger().warn('workflow', `Phase 1.8: ${built.unplacedJourneys.length} accepted journey(s) not placed by LLM — defaulted to first release`, {
        workflow_run_id: ctx.workflowRun.id,
        unplaced: built.unplacedJourneys.slice(0, 20),
      });
    }
    if (built.orphanEntities.length > 0) {
      getLogger().warn('workflow', `Phase 1.8: ${built.orphanEntities.length} entity/entities had no domain surface — defaulted to first release`, {
        workflow_run_id: ctx.workflowRun.id,
        orphans: built.orphanEntities.slice(0, 20),
      });
    }

    // Mint canonical UUIDs now (the LLM's REL-N short form was only for
    // its own reasoning; stored ids are fresh UUIDs so downstream
    // tree-joins don't collide across runs).
    const releasesWithUuid: ReleaseV2[] = built.releases.map(r => ({
      ...r,
      release_id: randomUUID(),
    }));
    return { releases: releasesWithUuid, crossCutting: built.crossCutting };
  }

  // ── Wave 7 helpers ───────────────────────────────────────────────

  private normalizeWorkflowV2(w: Record<string, unknown>): WorkflowV2 {
    const rawTriggers = Array.isArray(w.triggers) ? w.triggers as Array<Record<string, unknown>> : [];
    const triggers: WorkflowTrigger[] = rawTriggers
      .map(t => this.normalizeWorkflowTrigger(t))
      .filter((t): t is WorkflowTrigger => t !== null);
    const rawSteps = Array.isArray(w.steps) ? w.steps as Array<Record<string, unknown>> : [];
    const steps: WorkflowStep[] = rawSteps.map((s, i) => ({
      stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : i + 1,
      actor: typeof s.actor === 'string' ? s.actor : 'System',
      action: typeof s.action === 'string' ? s.action : '',
      expectedOutcome: typeof s.expectedOutcome === 'string' ? s.expectedOutcome : '',
    }));
    const rawActors = Array.isArray(w.actors) ? w.actors.filter((x): x is string => typeof x === 'string') : [];
    // Always derive backs_journeys from triggers; the LLM-supplied list
    // is a hint and frequently drifts (extras without matching triggers,
    // missing entries when the LLM forgets to populate it). The verifier
    // compares against derived truth, so we normalize unconditionally.
    const backs_journeys = Array.from(new Set(triggers
      .filter((t): t is Extract<WorkflowTrigger, { kind: 'journey_step' }> => t.kind === 'journey_step')
      .map(t => t.journey_id)));
    return {
      id: typeof w.id === 'string' ? w.id : '',
      businessDomainId: typeof w.businessDomainId === 'string' ? w.businessDomainId : '',
      name: typeof w.name === 'string' ? w.name : '',
      description: typeof w.description === 'string' ? w.description : '',
      steps,
      triggers,
      actors: rawActors,
      backs_journeys,
      source: (typeof w.source === 'string' ? w.source : undefined) as WorkflowV2['source'],
    };
  }

  private normalizeWorkflowTrigger(t: Record<string, unknown>): WorkflowTrigger | null {
    const kind = t.kind;
    if (kind === 'journey_step' && typeof t.journey_id === 'string' && typeof t.step_number === 'number') {
      return { kind, journey_id: t.journey_id, step_number: t.step_number };
    }
    if (kind === 'schedule' && typeof t.cadence === 'string') {
      return { kind, cadence: t.cadence };
    }
    if (kind === 'event' && typeof t.event_type === 'string') {
      return { kind, event_type: t.event_type };
    }
    if (kind === 'compliance' && typeof t.regime_id === 'string' && typeof t.rule === 'string') {
      return { kind, regime_id: t.regime_id, rule: t.rule };
    }
    if (kind === 'integration' && typeof t.integration_id === 'string' && typeof t.event === 'string') {
      return { kind, integration_id: t.integration_id, event: t.event };
    }
    return null;
  }

  private formatJourneysWithSteps(js: UserJourney[]): string {
    if (!js.length) return '(none)';
    return js.map(j => {
      const steps = j.steps
        .map((s: UserJourneyStep) =>
          `    ${s.stepNumber}. [${s.actor}${s.automatable === true ? ' · automatable' : ''}] ${s.action} → ${s.expectedOutcome}`)
        .join('\n');
      return `- **${j.id}** (persona ${j.personaId}) — ${j.title}\n    scenario: ${j.scenario}\n${steps}`;
    }).join('\n');
  }

  private formatWorkflowsV2(ws: WorkflowV2[]): string {
    if (!ws.length) return '(none)';
    return ws.map(w => {
      const triggers = w.triggers.map(t => {
        if (t.kind === 'journey_step') return `journey_step(${t.journey_id}#${t.step_number})`;
        if (t.kind === 'schedule') return `schedule(${t.cadence})`;
        if (t.kind === 'event') return `event(${t.event_type})`;
        if (t.kind === 'compliance') return `compliance(${t.regime_id}:${t.rule})`;
        return `integration(${t.integration_id}:${t.event})`;
      }).join(', ');
      return `- **${w.id}** (${w.businessDomainId}): ${w.name} — ${w.description}\n    triggers: ${triggers}`;
    }).join('\n');
  }

  private formatVVRequirements(vvs: VVRequirement[]): string {
    if (!vvs.length) return '(none)';
    return vvs.map(v => `- **${v.id}** (${v.category}): ${v.target} — ${v.measurement}${v.threshold ? ` (threshold: ${v.threshold})` : ''}`).join('\n');
  }

  private formatIntegrations(ints: Integration[]): string {
    if (!ints.length) return '(none)';
    return ints.map(i => `- **${i.id}** (${i.category}, ${i.ownershipModel}): ${i.name} — ${i.description}`).join('\n');
  }

  private formatVocabulary(vs: VocabularyTerm[]): string {
    if (!vs.length) return '(none)';
    return vs.map(v => `- **${v.id}**: ${v.term} — ${v.definition}`).join('\n');
  }

  /**
   * Write one `coverage_gap` governed-stream record per gap returned by
   * a deterministic verifier (1.3c or the 1.8 verifier). Returns the
   * written record ids so the caller can include them in derived_from
   * chains.
   */
  private persistCoverageGaps(
    ctx: PhaseContext,
    gaps: CoverageGapContent[],
    derivedFrom: string[],
  ): string[] {
    const ids: string[] = [];
    for (const gap of gaps) {
      const rec = ctx.engine.writer.writeRecord({
        record_type: 'coverage_gap',
        schema_version: '1.0',
        workflow_run_id: ctx.workflowRun.id,
        phase_id: '1',
        sub_phase_id: gap.sub_phase_id,
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: ctx.engine.janumiCodeVersionSha,
        derived_from_record_ids: derivedFrom,
        content: gap as unknown as Record<string, unknown>,
      });
      ctx.engine.ingestionPipeline.ingest(rec);
      ids.push(rec.id);
    }
    return ids;
  }
}

// ── Types local to the product-lens flow ───────────────────────────

/**
 * Concatenate prior feedback with the newest batch. Each iteration's
 * feedback is appended, not replaced — the LLM sees the full history so
 * it knows the user's refinement trajectory, not just the latest message.
 */
function accumulateFeedback(existing: string, next: string): string {
  if (!existing) return next.trim();
  return `${existing}\n\n---\n\n${next.trim()}`;
}

/**
 * Output of Phase 1.0b Product Intent Discovery — the product slice of
 * the decomposed extraction. Tech stack / compliance / V&V / vocabulary
 * arrive as sibling extraction outputs and are composed alongside this
 * into the IntentDiscoveryBundle at Sub-Phase 1.0g.
 */
interface IntentDiscoveryResult {
  analysisSummary: string;
  productVision: string;
  productDescription: string;
  personas: Persona[];
  userJourneys: UserJourney[];
  phasingStrategy: PhasingPhase[];
  successMetrics: string[];
  uxRequirements: string[];
  requirements: ExtractedItem[];
  decisions: ExtractedItem[];
  constraints: ExtractedItem[];
  openQuestions: ExtractedItem[];
}

/**
 * Composite output of the five Phase 1.0b–1.0f extraction passes,
 * assembled deterministically at Sub-Phase 1.0g. This bundle is the
 * authoritative intent-discovery surface that downstream Phase 1 work
 * (1.1b scope, 1.2–1.5 blooms, 1.6 synthesis) consumes.
 *
 * Decomposition rationale: a single monolithic "1.0b capture everything"
 * pass suffered from probabilistic drift — iter-3c's Codex run nailed
 * product but silently dropped the entire tech-stack section. Splitting
 * the pass into five narrow focused extractions bounds drift per
 * category and lets each pass be graded independently by the harness.
 */
interface IntentDiscoveryBundle {
  product: IntentDiscoveryResult;
  technicalConstraints: TechnicalConstraint[];
  complianceExtractedItems: ExtractedItem[];
  vvRequirements: VVRequirement[];
  canonicalVocabulary: VocabularyTerm[];
}


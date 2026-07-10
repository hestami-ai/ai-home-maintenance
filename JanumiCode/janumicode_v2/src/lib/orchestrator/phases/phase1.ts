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
  WorkflowTrigger,
  Integration,
  ExtractedItem,
  HumanDecisionSummary,
  OpenLoop,
  ReleaseV2,
  ReleasePlanContentV2,
  SourceRef,
  TechnicalConstraint,
  VVRequirement,
  VocabularyTerm,
  ScopePruneDecisionContent,
} from '../../types/records';
import { verifyCoverage } from './phase1/verifyCoverage';
import { verifyReleaseManifest } from './phase1/verifyReleaseManifest';
import { buildReleaseManifest, type LlmReleaseSkeleton } from './phase1/buildReleaseManifest';
import {
  normalizeTechnicalConstraints,
  normalizeJourneyFromWire,
  normalizeIntentDiscoveryFromWire,
  normalizeSynthesisFromWire,
  normalizeDomainFromWire,
  normalizePersonaFromWire,
  normalizeWorkflowV2 as normalizeWorkflowV2Pure,
  normalizeWorkflowTrigger as normalizeWorkflowTriggerPure,
} from './phase1Normalizers';
import { resolveAgainstOracle, resolveByTokenSubset } from '../idResolver';
import { randomUUID } from 'node:crypto';
import type {
  DecisionBundleContent,
  MirrorItem,
  MenuOption,
  MirrorItemDecision,
  MenuOptionSelection,
} from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { traceNormalize } from '../../trace/traceNormalize';
import {
  runScopeGatekeeperPrune,
  buildReleasePlanGatekeeperPrompt,
  stripSelfProducedAcceptedSets,
  type GatekeeperUpstreamContext,
} from '../scopeGatekeeper';
import { tryParseJson } from '../../llm/jsonRecovery';
import { renderHydratedPacket } from './dmrHydration';
import { normalizeIdsInTree, normalizeIdHyphens } from '../idNormalization';
import { MitigationEngine } from '../../review/mitigation/mitigationEngine';
import { loadMostRecentFindings } from '../../review/mitigation/findingsLookup';
import { emit as aoddEmit } from '../../aodd';

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

/**
 * Coerce a quality-attribute bloom item to a display string. Some models
 * (gpt-oss:20b) emit each QA as an OBJECT (`{attribute|name|description|...}`)
 * rather than a bare string; the downstream `buildQaItems` does `q.slice(...)`
 * and threw `q.slice is not a function` on gpt-oss (cal-32 P1.5). Normalize
 * producer-side so every consumer stays on `string[]`.
 */
export function coerceQualityAttribute(x: unknown): string {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    for (const k of ['attribute', 'quality_attribute', 'statement', 'description', 'name', 'text', 'value', 'label']) {
      const v = o[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return JSON.stringify(o);
  }
  return coerceFieldToString(x);
}

/**
 * Coerce an unknown record field to a meaningful display string: the string
 * itself when it is one, `fallback` for null/undefined, and a JSON
 * representation for objects/arrays — so a field a model drifted into an
 * object surfaces its real content instead of the useless '[object Object]'.
 */
function coerceFieldToString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v as string | number | boolean);
}

/** A single journey→domain reference the oracle-resolution pass rewrote. */
export interface JourneyDomainRemap {
  /** The journey whose businessDomainIds entry changed. */
  journey: string;
  /** The drifted ref the LLM emitted. */
  from: string;
  /** The canonical accepted-domain id it resolved to. */
  to: string;
}

/**
 * Deterministic oracle-resolution for journey → business-domain references.
 *
 * gpt-oss:20b keeps drifting a journey's `businessDomainIds` entries from the
 * accepted business-domain id in a NEW way each run: cal-33 emitted an
 * underscore variant (`DOM-AI_CONCIERGE-INTERACTION` vs the accepted
 * `DOM-AI-CONCIERGE-INTERACTION`); cal-36 emitted a plural/singular token
 * variant (`DOM-USERS-AUTHENTICATION` vs `DOM-USER-AUTHENTICATION`). The
 * per-variant hyphen-normalizer (`normalizeJourneyFromWire`) can only reach the
 * SEPARATOR drift, so the Phase 1.3c `referential_integrity_journey_domain`
 * verifier keeps hard-failing on each fresh near-miss — whack-a-mole.
 *
 * This pass re-anchors every ref to the ACCEPTED-domain ORACLE using the
 * sanctioned {@link resolveAgainstOracle} (exact → normalized-key [separator/
 * case] → high-confidence Levenshtein ≥ 0.90 with a 0.05 margin; oracle-bounded,
 * regex-free, returns `null` on ambiguity). A ref that resolves is rewritten to
 * the canonical accepted id; a ref that does NOT resolve is KEPT verbatim so
 * the 1.3c verifier flags a GENUINE reference error — no fabrication, no silent
 * drop. This subsumes fix #5's underscore case (via the normalized-key path)
 * and permanently handles plural/token drift and future near-misses.
 *
 * Pure: returns fresh journey objects (with a rebuilt `businessDomainIds`
 * array) plus a remap log; does not mutate its inputs.
 */
export function resolveJourneyDomainRefs<J extends { id?: unknown; businessDomainIds?: unknown }>(
  journeys: readonly J[],
  acceptedDomainIds: readonly string[],
): { journeys: J[]; remapped: JourneyDomainRemap[] } {
  const oracle = [...acceptedDomainIds];
  const remapped: JourneyDomainRemap[] = [];
  const out = journeys.map((j) => {
    const refs = j.businessDomainIds;
    if (!Array.isArray(refs)) return j;
    const journeyId = typeof j.id === 'string' ? j.id : '';
    const nextRefs = refs.map((ref) => {
      if (typeof ref !== 'string') return ref;
      // resolveAgainstOracle handles separator/case/near-miss drift; the
      // token-subset fallback handles TRUNCATION (`DOM-COMMUNICATION` for the
      // accepted `DOM-COMMUNITY-COMMUNICATION`, cal-39) that similarity can't reach.
      const resolved = resolveAgainstOracle(ref, oracle) ?? resolveByTokenSubset(ref, oracle);
      if (resolved && resolved !== ref) {
        remapped.push({ journey: journeyId, from: ref, to: resolved });
        return resolved;
      }
      return ref;
    });
    return { ...j, businessDomainIds: nextRefs } as J;
  });
  return { journeys: out, remapped };
}

/** Normalize an unknown thrown value to a display message. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Per-journey and total LLM-retry budgets for the 1.3a persona self-heal. */
const PER_JOURNEY_RETRY_BUDGET = 2;
const TOTAL_RETRY_BUDGET = 10;

/**
 * Deterministic oracle-resolution for workflow → business-domain references.
 * Mirrors {@link resolveJourneyDomainRefs} but for a workflow's single
 * `businessDomainId`, mutating each workflow in place and logging an
 * aggregate remap line. Extracted from executeProductLens's 1.3b runProposer
 * to keep that method under the cognitive-complexity budget; behavior is
 * identical (resolve via oracle → token-subset fallback; keep unresolvable
 * refs verbatim so 1.3c flags them).
 */
function resolveWorkflowDomainRefs(
  workflows: WorkflowV2[],
  acceptedDomainIds: string[],
  workflowRunId: string,
): void {
  const wfRemapped: Array<{ workflow: string; from: string; to: string }> = [];
  for (const w of workflows) {
    if (typeof w.businessDomainId === 'string' && w.businessDomainId) {
      const resolved = resolveAgainstOracle(w.businessDomainId, acceptedDomainIds)
        ?? resolveByTokenSubset(w.businessDomainId, acceptedDomainIds);
      if (resolved && resolved !== w.businessDomainId) {
        wfRemapped.push({ workflow: w.id, from: w.businessDomainId, to: resolved });
        w.businessDomainId = resolved;
      }
    }
  }
  if (wfRemapped.length > 0) {
    getLogger().info('workflow', `Phase 1.3b: oracle-resolved ${wfRemapped.length} workflow→domain ref(s) to the accepted-domain set`, {
      workflow_run_id: workflowRunId,
      remapped: wfRemapped,
    });
  }
}

/**
 * Apply {@link resolveJourneyDomainRefs} to a journey bloom result in place:
 * when any ref was remapped, swap in the canonicalized journeys and log the
 * aggregate. Extracted from executeProductLens's 1.3a runProposer to keep
 * that method under the cognitive-complexity budget; behavior is identical.
 */
function applyJourneyDomainResolution(
  r: { userJourneys: UserJourney[] },
  acceptedDomainIds: string[],
  workflowRunId: string,
): void {
  const journeyResolution = resolveJourneyDomainRefs(r.userJourneys, acceptedDomainIds);
  if (journeyResolution.remapped.length > 0) {
    r.userJourneys = journeyResolution.journeys;
    getLogger().info('workflow', `Phase 1.3a: oracle-resolved ${journeyResolution.remapped.length} journey→domain ref(s) to the accepted-domain set`, {
      workflow_run_id: workflowRunId,
      remapped: journeyResolution.remapped,
    });
  }
}

export class Phase1Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '1';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Sub-Phase 1.0 — Intent Quality Check ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'intent_quality_check');

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
      sub_phase_id: 'intent_quality_check',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id],
      content: qualityReport,
    });
    artifactIds.push(qualityRecord.id);
    engine.ingestionPipeline.ingest(qualityRecord);

    if (qualityReport.overall_status === 'blocking') {
      // Only true contradictions (consistency_findings) hard-fail the
      // phase. Coherence-finding blockers are scope/complexity concerns
      // — judgement calls the calibrating LLM may flag inconsistently
      // across runs (cal-23 case: gemma flagged "massive scope" as
      // blocking on the Hestami spec; the same spec passed in cal-22b).
      // We log them as advisories instead of halting bloom; the human
      // approval gates downstream can still pause the run on substance.
      const consistency = (qualityReport.consistency_findings ?? []) as Array<{ severity?: string; concern?: string }>;
      const coherence = (qualityReport.coherence_findings ?? []) as Array<{ severity?: string; concern?: string }>;
      const blockingConsistency = consistency.filter(f => f.severity === 'blocking');
      const blockingCoherence = coherence.filter(f => f.severity === 'blocking');
      if (blockingConsistency.length > 0) {
        engine.eventBus.emit('error:occurred', {
          message: 'Intent Quality Check found blocking contradictions',
          context: JSON.stringify(qualityReport),
        });
        return {
          success: false,
          error: 'Intent Quality Check found blocking contradictions — must be resolved before bloom',
          artifactIds,
        };
      }
      if (blockingCoherence.length > 0) {
        getLogger().warn('workflow',
          `Phase 1.0: Intent Quality Check flagged ${blockingCoherence.length} blocking coherence concern(s) — proceeding with bloom; surfaced as advisory`,
          {
            workflow_run_id: workflowRun.id,
            concerns: blockingCoherence.map(f => f.concern ?? '<unnamed>').slice(0, 10),
          });
      }
    }

    // ── Sub-Phase 1.0a — Intent Lens Classification ──────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'intent_lens_classification');

    const lensClassification = await this.runIntentLensClassification(ctx, rawIntentText);
    const lensRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: 'intent_lens_classification',
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

    // ── Lens dispatch ─────────────────────────────────────────
    // Only the `product` lens has a complete specialized pipeline. Other
    // lenses (`feature`, `bug`, `infra`, `legal`, `unclassified`) do not
    // have full handler dispatch paths and would silently fall through to
    // a lens-neutral fallback that produces lossy output without coverage
    // contracts or traceability. Rather than degrade silently, hard-fail
    // early with a clear message so the operator knows which lenses are
    // supported.
    if (lensClassification.lens !== 'product') {
      const msg = `Intent classified as '${lensClassification.lens}' lens (confidence ${lensClassification.confidence.toFixed(2)}). Only the 'product' lens has a supported pipeline; 'feature' / 'bug' / 'infra' / 'legal' / 'unclassified' lenses are not yet implemented. Refusing to proceed with the lens-neutral fallback because it produces lossy output without coverage contracts. Rationale from classifier: ${lensClassification.rationale}`;
      getLogger().warn('workflow', 'Phase 1 hard-fail: unsupported lens', {
        workflow_run_id: workflowRun.id,
        lens: lensClassification.lens,
        confidence: lensClassification.confidence,
      });
      return { success: false, error: msg, artifactIds };
    }

    return this.executeProductLens(ctx, {
      rawIntent,
      rawIntentText,
      qualityRecord,
      lensRecord,
      lensClassification,
      artifactIds,
    });
  }

  // ── LLM helpers ────────────────────────────────────────────────

  private async runIntentQualityCheck(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<Record<string, unknown>> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('orchestrator', 'intent_quality_check');
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
        subPhaseId: 'intent_quality_check',
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
      'intent_lens_classification',
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
        sub_phase_id: 'intent_lens_classification',
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
          subPhaseId: 'intent_lens_classification',
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
        sub_phase_id: 'intent_lens_classification',
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
      subPhaseId: 'business_domains_bloom',
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
        relativePath: coerceFieldToString(content.relative_path),
        content: coerceFieldToString(content.content),
        type: coerceFieldToString(content.file_type, 'other'),
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
      'intent_domain_bloom',
      lens,
    );
    if (template && template.metadata.lens !== lens) {
      getLogger().warn('workflow', `Lens ${lens} not yet supported — using lens-neutral fallback template`, {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: 'business_domains_bloom',
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
        sub_phase_id: 'business_domains_bloom',
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
        sub_phase_id: 'business_domains_bloom',
        missing_variables: rendered.missing_variables,
      });
      return fallback;
    }

    // No outer try/catch — LLM call failures throw and the engine's
    // executeCurrentPhase catch converts them to phase failure. The
    // inner "return fallback" paths below handle the softer case where
    // the call succeeded but returned empty / unparseable JSON.
    const diRoute = engine.configManager.getRoutingModel('domain_interpreter');
    const result = await engine.llmCaller.call({
      provider: diRoute.provider,
      model: diRoute.model,
      baseUrl: diRoute.baseUrl,
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.6,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '1',
        subPhaseId: 'business_domains_bloom',
        agentRole: 'domain_interpreter',
        label: 'Phase 1.2 — Intent Domain Bloom',
      },
    });
    let parsed = result.parsed as Record<string, unknown> | null;
    if (!parsed && typeof result.text === 'string' && result.text.trim().length > 0) {
      const recovered = tryParseJson(result.text);
      parsed = recovered.parsed;
      // `recovered.parsed` is non-null only when extraction + parse succeeded
      // against the raw text (i.e. the LLM caller's normal parse path missed
      // JSON that was salvageable). Treat that as "recovered" and emit the
      // diagnostic warning. The previous `recovered.recovered` field never
      // existed on this return type — that condition silently never fired.
      if (recovered.parsed) {
        getLogger().warn('workflow', 'Recovered malformed bloom JSON from raw model text', {
          workflow_run_id: ctx.workflowRun.id,
          sub_phase_id: 'business_domains_bloom',
          provider: result.provider,
          model: result.model,
        });
      } else if (!recovered.parsed) {
        getLogger().warn('workflow', 'Bloom raw model text could not be parsed as JSON', {
          workflow_run_id: ctx.workflowRun.id,
          sub_phase_id: 'business_domains_bloom',
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
      sub_phase_id: 'business_domains_bloom',
      provider: result.provider,
      model: result.model,
      parsed_top_level_keys: parsed ? Object.keys(parsed).slice(0, 20) : [],
    });
    return fallback;
  }

  private extractSurfacedAssumptions(keptCandidates: BloomCandidate[]): SurfacedAssumption[] {
    const deduped = new Map<string, SurfacedAssumption>();
    let index = 0;
    for (const candidate of keptCandidates) {
      for (const entry of candidate.assumptions) {
        index = this.mergeSurfacedAssumption(deduped, candidate, entry, index);
      }
    }
    return Array.from(deduped.values());
  }

  /**
   * Fold one candidate assumption into the dedup map. Empty text is
   * skipped; a duplicate (same lowercased text) merges the candidate id
   * and back-fills a missing rationale; a novel assumption is inserted
   * with the next `assumption-N` id. Returns the (possibly incremented)
   * index so the caller keeps the counter monotonic across candidates.
   * Extracted from extractSurfacedAssumptions to bound its cognitive
   * complexity; behavior is identical to the former inner-loop body.
   */
  private mergeSurfacedAssumption(
    deduped: Map<string, SurfacedAssumption>,
    candidate: BloomCandidate,
    entry: AssumptionEntry,
    index: number,
  ): number {
    const text = assumptionText(entry).trim();
    if (!text) return index;
    const key = text.toLowerCase();
    const rationale = typeof entry === 'object' ? entry.basis : undefined;
    const existing = deduped.get(key);
    if (existing) {
      if (!existing.source_candidate_ids.includes(candidate.id)) {
        existing.source_candidate_ids.push(candidate.id);
      }
      if (!existing.rationale && rationale) existing.rationale = rationale;
      return index;
    }
    const nextIndex = index + 1;
    deduped.set(key, {
      id: `assumption-${nextIndex}`,
      text,
      rationale,
      source_candidate_ids: [candidate.id],
      source: 'ai_proposed',
    });
    return nextIndex;
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
      if (!decision?.action || decision.action === 'deferred') {
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
   * Write a Context Payload detail file under .janumicode/runs/<run_id>/context/ so the
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
        'business_domains_bloom',
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
          // Curated, resolved DMR reference (consistent with the phase 2-9
          // path) instead of the raw ContextPacket JSON dump. Raw recoverable
          // via JANUMICODE_DMR_RAW_DETAIL=1.
          hydratedPacket: contextPacket
            ? renderHydratedPacket(contextPacket, (id) => {
                const rec = engine.writer.getRecord(id);
                return rec ? { record_type: rec.record_type, content: rec.content } : null;
              })
            : '',
          ...(contextPacket && process.env.JANUMICODE_DMR_RAW_DETAIL === '1'
            ? { contextPacket: JSON.stringify(contextPacket, null, 2) }
            : {}),
          narrativeMemories: [],
          decisionTraces: '',
          technicalSpecs: [],
          complianceContext: '',
          unstickingResolutions: '',
        },
        workflowRun.id,
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

  /**
   * Run one silent (non-fatal) 1.0c–1.0f discovery step: set the sub-phase,
   * invoke `run` (falling back to `fallback` and WARN-logging on failure),
   * persist an `artifact_produced` record of `contentKind` carrying the
   * result under `resultKey`, push its id onto `artifactIds`, and ingest it.
   * Extracted from executeProductLens so that method stays under the
   * cognitive-complexity budget; behavior mirrors the former inline blocks.
   */
  private async runSilentDiscoveryStep<T>(
    ctx: PhaseContext,
    opts: {
      subPhaseId: string;
      contentKind: string;
      resultKey: string;
      warnMessage: string;
      derivedFromRecordIds: string[];
      artifactIds: string[];
      fallback: T;
      run: () => Promise<T>;
    },
  ): Promise<{ value: T; record: GovernedStreamRecord }> {
    const { workflowRun, engine } = ctx;
    engine.stateMachine.setSubPhase(workflowRun.id, opts.subPhaseId);
    let value: T = opts.fallback;
    try {
      value = await opts.run();
    } catch (err) {
      getLogger().warn('workflow', opts.warnMessage, {
        workflow_run_id: workflowRun.id,
        error: errMessage(err),
      });
    }
    const record = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: opts.subPhaseId,
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: opts.derivedFromRecordIds,
      content: { kind: opts.contentKind, [opts.resultKey]: value } as unknown as Record<string, unknown>,
    });
    opts.artifactIds.push(record.id);
    engine.ingestionPipeline.ingest(record);
    return { value, record };
  }

  /** Prefer the human-accepted subset; fall back to the full bloom when the
   *  accept set is empty (a keep-nothing gate is treated as keep-all so the
   *  pipeline never starves). Extracted from executeProductLens's repeated
   *  `accepted.length > 0 ? accepted : all` ternaries. */
  private pickAcceptedOrAll<T>(accepted: T[], fallbackAll: T[]): T[] {
    return accepted.length > 0 ? accepted : fallbackAll;
  }

  /** Build the QA menu items — synthetic `QA-N` ids indexing into the
   *  qualityAttributes array by position. Extracted from executeProductLens. */
  private buildQaItems(qas: string[]): Array<{ id: string; label: string; description: string }> {
    return qas.map((q, i) => ({
      id: `QA-${i + 1}`,
      label: `[Quality] ${q.slice(0, 80)}${q.length > 80 ? '…' : ''}`,
      description: q,
    }));
  }

  /** Render one release as a decision-menu item, including the per-category
   *  `contains:` id detail. Extracted from executeProductLens's 1.8 mapItems. */
  private formatReleaseMenuItem(r: ReleaseV2): { id: string; label: string; description: string; tradeoffs: string; detail: string } {
    const fmt = (label: string, ids: string[]): string =>
      ids.length > 0 ? `      ${label} (${ids.length}): ${ids.join(', ')}` : `      ${label} (0): —`;
    const detail = [
      `      contains:`,
      fmt('journeys', r.contains.journeys),
      fmt('workflows', r.contains.workflows),
      fmt('entities', r.contains.entities),
      fmt('compliance', r.contains.compliance),
      fmt('integrations', r.contains.integrations),
      fmt('vocabulary', r.contains.vocabulary),
    ].join('\n');
    return {
      id: r.release_id,
      label: `Release ${r.ordinal}: ${r.name}`,
      description: r.description,
      tradeoffs: `${r.rationale} • contains ${r.contains.journeys.length}j/${r.contains.workflows.length}w/${r.contains.entities.length}e/${r.contains.compliance.length}c/${r.contains.integrations.length}i/${r.contains.vocabulary.length}v`,
      detail,
    };
  }

  /** Apply the 1.8 release_plan gatekeeper prune. A total wipeout (keep
   *  nothing) is treated as keep-all — zero releases is structurally invalid,
   *  so the deterministic verifier does the real structural check. Extracted
   *  from executeProductLens's 1.8 applyPrune. */
  private applyReleasePrune(
    bloom: { releases: ReleaseV2[]; crossCutting: CrossCuttingContents },
    keptIds: Set<string>,
    workflowRunId: string,
  ): { releases: ReleaseV2[]; crossCutting: CrossCuttingContents } {
    if (keptIds.size === 0) {
      getLogger().warn('workflow', 'Phase 1.8 release_plan gatekeeper dropped ALL releases — keeping all (zero releases is invalid; deferring to the deterministic 1.8 verifier)', {
        workflow_run_id: workflowRunId,
        proposed_releases: bloom.releases.length,
      });
      return { releases: bloom.releases, crossCutting: bloom.crossCutting };
    }
    return {
      releases: bloom.releases.filter(r => keptIds.has(r.release_id)),
      crossCutting: bloom.crossCutting,
    };
  }

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
    engine.stateMachine.setSubPhase(workflowRun.id, 'product_intent_discovery');
    let discovery: IntentDiscoveryResult;
    try {
      discovery = await this.runIntentDiscovery(ctx, rawIntentText);
    } catch (err) {
      return { success: false, error: `Product Intent Discovery failed: ${errMessage(err)}`, artifactIds };
    }
    const discoveryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: 'product_intent_discovery',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id, lensRecord.id],
      content: { kind: 'intent_discovery', ...discovery } as unknown as Record<string, unknown>,
    });
    artifactIds.push(discoveryRecord.id);
    engine.ingestionPipeline.ingest(discoveryRecord);

    // ── 1.0c Technical Constraints Discovery (silent) ───────
    // Non-fatal: extraction failure degrades gracefully — the step logs
    // the gap but the product flow continues. Harness oracle flags
    // missing captures for the virtuous-cycle loop to address.
    const techStep = await this.runSilentDiscoveryStep<TechnicalConstraint[]>(ctx, {
      subPhaseId: 'technical_constraints_discovery',
      contentKind: 'technical_constraints_discovery',
      resultKey: 'technicalConstraints',
      warnMessage: 'Phase 1.0c Technical Constraints Discovery failed — continuing with empty captures',
      derivedFromRecordIds: [rawIntent.id, lensRecord.id],
      artifactIds,
      fallback: [],
      run: () => this.runTechnicalConstraintsDiscovery(ctx, rawIntentText),
    });
    const technicalConstraints = techStep.value;
    const techRecord = techStep.record;

    // ── 1.0d Compliance & Retention Discovery (silent) ──────
    const complianceStep = await this.runSilentDiscoveryStep<ExtractedItem[]>(ctx, {
      subPhaseId: 'compliance_retention_discovery',
      contentKind: 'compliance_retention_discovery',
      resultKey: 'complianceExtractedItems',
      warnMessage: 'Phase 1.0d Compliance & Retention Discovery failed — continuing with empty captures',
      derivedFromRecordIds: [rawIntent.id, lensRecord.id],
      artifactIds,
      fallback: [],
      run: () => this.runComplianceRetentionDiscovery(ctx, rawIntentText),
    });
    const complianceExtractedItems = complianceStep.value;
    const complianceRecord_extraction = complianceStep.record;

    // ── 1.0e V&V Requirements Discovery (silent) ────────────
    const vvStep = await this.runSilentDiscoveryStep<VVRequirement[]>(ctx, {
      subPhaseId: 'vv_requirements_discovery',
      contentKind: 'vv_requirements_discovery',
      resultKey: 'vvRequirements',
      warnMessage: 'Phase 1.0e V&V Requirements Discovery failed — continuing with empty captures',
      derivedFromRecordIds: [rawIntent.id, lensRecord.id],
      artifactIds,
      fallback: [],
      run: () => this.runVVRequirementsDiscovery(ctx, rawIntentText),
    });
    const vvRequirements = vvStep.value;
    const vvRecord = vvStep.record;

    // ── 1.0f Canonical Vocabulary Discovery (silent) ────────
    const vocabStep = await this.runSilentDiscoveryStep<VocabularyTerm[]>(ctx, {
      subPhaseId: 'canonical_vocabulary_discovery',
      contentKind: 'canonical_vocabulary_discovery',
      resultKey: 'canonicalVocabulary',
      warnMessage: 'Phase 1.0f Canonical Vocabulary Discovery failed — continuing with empty captures',
      derivedFromRecordIds: [rawIntent.id, lensRecord.id],
      artifactIds,
      fallback: [],
      run: () => this.runCanonicalVocabularyDiscovery(ctx, rawIntentText),
    });
    const canonicalVocabulary = vocabStep.value;
    const vocabRecord = vocabStep.record;

    // ── 1.0g Intent Discovery Synthesis (deterministic compose) ──
    engine.stateMachine.setSubPhase(workflowRun.id, 'discovery_bundle_compose');
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
      sub_phase_id: 'discovery_bundle_compose',
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
    engine.stateMachine.setSubPhase(workflowRun.id, 'scope_bounding');
    const scopeRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: 'scope_bounding',
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
      sub_phase_id: 'scope_bounding',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'compliance_context', regimes: [] },
    });
    artifactIds.push(complianceRecord.id);
    engine.ingestionPipeline.ingest(complianceRecord);

    // ── 1.2 Business Domains & Personas Bloom (Round 1) ─────
    engine.stateMachine.setSubPhase(workflowRun.id, 'business_domains_bloom');
    const round12 = await this.runBloomRoundWithFeedbackLoop<{ domains: BusinessDomain[]; personas: Persona[] }>(ctx, {
      subPhaseId: 'business_domains_bloom',
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
          sub_phase_id: 'business_domains_bloom',
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
      gatekeeper: {
        bloomDescription: 'business domains and personas',
        applyPrune: (bloom, keptIds) => ({
          domains:  bloom.domains.filter(d => keptIds.has(d.id)),
          personas: bloom.personas.filter(p => keptIds.has(p.id)),
        }),
        overlay: `### Shape-specific guidance (domains + personas)

DOMAINS are problem-space areas the product addresses. A domain is in
scope only if at least one upstream artifact (requirement, constraint,
journey, workflow trigger, compliance item, V&V threshold) names a
concept that lives in that domain.

A business domain is a user-facing FUNCTIONAL capability area (e.g. URL
submission, redirection, statistics, deletion, API access). DROP any
domain whose essence is a NON-FUNCTIONAL / operational quality concern —
monitoring & logging, observability, reliability & availability, uptime
& failover, performance & latency, security/encryption-as-a-property,
HTTPS/transport enforcement, compliance-as-a-property. Those are captured
as Non-Functional Requirements (Phase 2.2) and as cross-cutting
constraints folded into the functional components — they are NOT business
domains. Example drops: "Monitoring & Logging", "Reliability &
Availability", "Security & Encryption", "HTTPS-Only Traffic Enforcement".
(Encryption-at-rest, uptime, and observability are still required — they
live in the NFR roster, not as their own domain.)

PERSONAS are roles that interact with the product. A persona is in
scope when:
  - The upstream Analysis Summary or a user journey describes that
    role acting on the product (sender, receiver, viewer, requester,
    etc.), OR
  - An upstream constraint or compliance item explicitly invokes
    that role (e.g., a regulator named in a compliance regime).

A persona whose description is purely INTERNAL/OPERATIONAL (admin,
SRE, support agent, compliance officer, abuse handler) and is not
named in any upstream artifact is NOT in scope at Phase 1. Phase 4
(architecture) and Phase 6 (tasks) handle operational roles. Drop
such personas in Pass 2 with a rationale citing the absence of
upstream support.

Apply the base-prompt Pass 1 rules first; this overlay refines Pass 2
grounding judgements for the persona shape specifically.`,
      },
    });
    if (!round12.success) return { success: false, error: round12.error, artifactIds };
    const domainsBloom = round12.bloom;
    const domainsRecord = round12.record;
    const keptDomainIds = new Set(round12.keptIds);
    const acceptedDomains = domainsBloom.domains.filter(d => keptDomainIds.has(d.id));
    const acceptedPersonas = domainsBloom.personas.filter(p => keptDomainIds.has(p.id));
    const safeDomains = this.pickAcceptedOrAll(acceptedDomains, domainsBloom.domains);
    const safePersonas = this.pickAcceptedOrAll(acceptedPersonas, domainsBloom.personas);

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
    engine.stateMachine.setSubPhase(workflowRun.id, 'user_journey_bloom');
    let bloom13aMeta: { unreachedPersonas: string[]; unreachedDomains: string[] } = { unreachedPersonas: [], unreachedDomains: [] };
    const round13a = await this.runBloomRoundWithFeedbackLoop<{ userJourneys: UserJourney[]; unreachedPersonas: string[]; unreachedDomains: string[] }>(ctx, {
      subPhaseId: 'user_journey_bloom',
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
        // Deterministic oracle-resolution of journey→domain refs, applied
        // BEFORE the bloom is persisted (writeBloomRecord below) or flows into
        // safeJourneys / the P2 handoff — so the persisted user_journey_bloom
        // record AND every downstream consumer carry canonical accepted-domain
        // ids. gpt-oss drifts businessDomainIds a new way each run; the hyphen
        // normalizer can't reach a token drift. See applyJourneyDomainResolution:
        // it re-anchors each ref to safeDomains and KEEPS any that don't resolve
        // (1.3c then flags a genuine error).
        applyJourneyDomainResolution(r, safeDomains.map(d => d.id), workflowRun.id);
        return r;
      },
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: 'user_journey_bloom',
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
      gatekeeper: {
        bloomDescription: 'user journeys across the accepted domains and personas',
        overlay: `### Shape-specific guidance (user journeys)

A USER JOURNEY is a sequence of interactions a persona has with the
product to achieve a goal. A journey is in scope when:
  - Its personaId is in the "Accepted Personas" section above, AND
  - Its goal traces to an upstream Intent Requirement, Intent
    Constraint, Compliance Item, V&V Requirement, or user journey
    in the Intent Discovery output.

If a journey's personaId is NOT in the "Accepted Personas" section,
DROP it. The "Accepted Personas" section is authoritative — it lists
the personas the business_domains_bloom gatekeeper kept. Do NOT use
the narrative Analysis Summary as the persona list; it may name only
the primary roles informally while other accepted personas (API
consumers, etc.) are equally valid.

If two journeys differ ONLY by interaction surface (web vs API) and
both surfaces are accepted (e.g., spec mentions "via web form or
API"), KEEP both — they are distinct delivery paths the product
must serve.

Apply the base-prompt Pass 1 rules first; this overlay refines Pass 2
grounding for the journey shape.`,
        applyPrune: (bloom, keptIds) => ({
          userJourneys: bloom.userJourneys.filter(j => keptIds.has(j.id)),
          unreachedPersonas: bloom.unreachedPersonas,
          unreachedDomains: bloom.unreachedDomains,
        }),
      },
    });
    if (!round13a.success) return { success: false, error: round13a.error, artifactIds };
    const journeyBloom = round13a.bloom;
    const journeysRecord = round13a.record;
    const keptJourneyIds = new Set(round13a.keptIds);
    const acceptedJourneys = journeyBloom.userJourneys.filter(j => keptJourneyIds.has(j.id));
    const safeJourneys = this.pickAcceptedOrAll(acceptedJourneys, journeyBloom.userJourneys);

    // ── 1.3b — System Workflow Bloom ──────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'system_workflow_bloom');
    const round13b = await this.runBloomRoundWithFeedbackLoop<{ workflows: WorkflowV2[] }>(ctx, {
      subPhaseId: 'system_workflow_bloom',
      roundLabel: 'System Workflows',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [journeysRecord.id],
      runProposer: async (feedback) => {
        const r = await this.runWorkflowBloom13b(ctx, {
          acceptedJourneys: safeJourneys,
          acceptedPersonas: safePersonas,
          acceptedDomains: safeDomains,
          complianceItems: complianceInputs,
          retentionRules: retentionInputs,
          vvRequirements: vvInputs,
          integrations: integrationInputs,
        }, feedback);
        // Same oracle-resolution for a workflow's single businessDomainId ref —
        // applied before the workflow bloom is persisted / flows into
        // safeWorkflowsV2, so the 1.3c domain_workflow_coverage advisory (and
        // the persisted record) survive the same gpt-oss token drift that hits
        // journeys. Unresolvable refs are KEPT so 1.3c still flags them.
        resolveWorkflowDomainRefs(r.workflows, safeDomains.map(d => d.id), workflowRun.id);
        return r;
      },
      writeBloomRecord: (bloom, derivedFrom) => {
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: 'system_workflow_bloom',
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
      gatekeeper: {
        bloomDescription: 'system workflows backing the accepted user journeys',
        overlay: `### Shape-specific guidance (system workflows)

A SYSTEM WORKFLOW is a server-side process that backs a user-facing
FUNCTIONAL behaviour. Each workflow has a trigger (HTTP request,
scheduled tick, event, etc.). A workflow is in scope when:
  - It backs a journey in the "Accepted User Journeys" section
    above (this includes functional compliance behaviours such as GDPR
    erasure — the delete journey), OR
  - It is required infrastructure for an upstream Technical Constraint
    (e.g., a startup migration workflow for an upstream-mandated
    database).

DROP workflows whose PURPOSE is operational NON-FUNCTIONAL measurement,
monitoring, or alerting — uptime calculation, health-check monitoring,
latency/performance monitoring, availability/RTO failover testing,
metric publishing, log aggregation. These are NFR *verification methods*
(captured in the NFR roster and the Phase-8 evaluation plans) and
cross-cutting constraints folded into the functional components — they
are NOT system workflows. Example drops: "Monthly Uptime Calculation",
"Health-Check Endpoint Monitor", "Redirect Latency Monitor".
(The underlying NFRs — availability, observability, latency — are still
required; they live in the NFR roster, not as workflows.)

Workflow names commonly mention the same surfaces as journeys (UI,
API, scheduled). Do NOT drop a workflow merely because its name
contains "API" or "auth" — the base-prompt anti-pattern (do not use
implication chains) applies here. A workflow's authentication
mechanism is a Phase 4 architectural concern, not a Phase 1 scope
question. Drop only when the workflow's PURPOSE is upstream-unsupported
or contradicts an explicit constraint (Pass 1 literal-match).

Apply the base-prompt Pass 1 rules first; this overlay refines Pass 2
grounding for the workflow shape.`,
        applyPrune: (bloom, keptIds) => ({
          workflows: bloom.workflows.filter(w => keptIds.has(w.id)),
        }),
      },
    });
    if (!round13b.success) return { success: false, error: round13b.error, artifactIds };
    const workflowBloom = round13b.bloom;
    const workflowsRecord = round13b.record;
    const keptWorkflowIds = new Set(round13b.keptIds);
    const acceptedWorkflowsV2 = workflowBloom.workflows.filter(w => keptWorkflowIds.has(w.id));
    const safeWorkflowsV2 = this.pickAcceptedOrAll(acceptedWorkflowsV2, workflowBloom.workflows);

    // ── 1.3c — Coverage Verifier (deterministic) ─────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'coverage_verifier');
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
    engine.stateMachine.setSubPhase(workflowRun.id, 'entities_bloom');
    const round14 = await this.runBloomRoundWithFeedbackLoop<{ entities: Entity[] }>(ctx, {
      subPhaseId: 'entities_bloom',
      roundLabel: 'Entities',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [journeysRecord.id],
      runProposer: (feedback) => this.runEntitiesBloom(ctx, safeDomains, safeWorkflowsV2, safePersonas, safeJourneys, feedback),
      writeBloomRecord: (bloom, derivedFrom) => {
        // Normalize ENT-* ids: replace any underscores in the body with
        // hyphens. ts-13 surfaced ~5% drift (e.g. `ENT-LEGAL_DOCUMENT`
        // instead of `ENT-LEGAL-DOCUMENT`); we sanitize at ingestion so
        // downstream traces can match on the canonical hyphen-only form.
        const content = { kind: 'entities_bloom', ...bloom } as unknown as Record<string, unknown>;
        normalizeIdsInTree(content, new Set(['id']), normalizeIdHyphens);
        const rec = engine.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '1',
          sub_phase_id: 'entities_bloom',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => bloom.entities.map(e => ({ id: e.id, label: `[Entity] ${e.name}`, description: e.description, tradeoffs: `domain ${e.businessDomainId}` })),
      buildTitle: () => 'Review Business Entities',
      buildSummary: (bloom) => `${bloom.entities.length} entity/entities proposed across the accepted domains.`,
      gatekeeper: {
        bloomDescription: 'business entities across the accepted domains',
        applyPrune: (bloom, keptIds) => ({
          entities: bloom.entities.filter(e => keptIds.has(e.id)),
        }),
        overlay: `### Shape-specific guidance (business entities)

A BUSINESS ENTITY represents PERSISTENT state the product must
maintain to satisfy its requirements. An entity is in scope when:
  - It carries data the spec explicitly requires storing (named in
    a requirement, journey, or compliance item), OR
  - It is structurally necessary to record the outcome of an
    upstream-mandated workflow (e.g., an audit record entity when
    the spec mandates auditable operations).

### MUST DROP for entities (Pass 1 inherent-requirement specialization)

Drop these CATEGORIES aggressively. The proposer's "entities are
behavior, not data" failure mode dominates this round on calibration
runs. Identify candidates by NAME PATTERN and PURPOSE, not by literal
match against a fixed list.

- **Log-emission entities** — anything named like \`*-LOG\` or
  \`*-EVENT-LOG\`. Logs are emissions to stdout / aggregator. Drop
  unless the spec EXPLICITLY mandates structured log persistence
  inside the product's own database.
- **HTTP / transport traffic records** — entries representing
  in-flight request/response/error transients (request, response,
  request-error, call-record). Drop unless the spec mandates a
  request log.
- **Validation artifacts** — entries whose purpose is to represent
  the BEHAVIOR of input validation (validation-result, validation-
  error, validation-settings). Validation is workflow logic, not
  stored business data.
- **Telemetry / metrics** — entries representing observability data
  emitted to external systems (\`*-METRIC\`, \`MONITORING-*\`,
  \`PERFORMANCE-*\`, \`*-LATENCY-METRIC\`). Not product entities
  unless the spec mandates storing them in the product database.
- **Operational concepts as entities** — runtime / deployment /
  config concepts proposed as data (region, outage, deployment-
  artifact, feature-flag, configuration, environment). These are
  operations / runtime properties, not stored business data.
- **Auth / identity artifacts that contradict upstream constraints** —
  when an upstream constraint forbids per-user accounts / per-user
  history / multi-tenancy, the entities that implement those
  mechanisms (user, session, auth-token, api-key, user-profile,
  tenant, etc.) are also forbidden. This is Pass 1
  inherent-requirement, not Pass 2 — drop with a rationale citing
  the conflicting constraint.

### KEEP for entities

Keep an entity when:
  - The spec names the data the entity holds (e.g. a slug→URL mapping
    when the spec mandates persisting that mapping).
  - The entity is the storage backing an upstream-mandated workflow
    (e.g. a deletion-request record when the spec mandates accepting
    deletion requests AND auditing them).
  - The entity is the data model expression of an accepted V&V
    requirement (e.g. an encrypted-URL record when V&V says "URLs
    encrypted at rest").

### The persistence test

Before keeping any entity, ask: "Does the spec require this data to
survive a process restart, AND is the workflow that uses it grounded
in an accepted upstream artifact?" Both halves must hold.

Apply the base-prompt Pass 1 rules first; this overlay refines both
Pass 1 (the MUST DROP list above) and Pass 2 (the persistence test)
for the entity shape.`,
      },
    });
    if (!round14.success) return { success: false, error: round14.error, artifactIds };
    const entitiesBloom = round14.bloom;
    const entitiesRecord = round14.record;
    const keptEntityIds = new Set(round14.keptIds);
    const acceptedEntities = entitiesBloom.entities.filter(e => keptEntityIds.has(e.id));
    const safeEntities = this.pickAcceptedOrAll(acceptedEntities, entitiesBloom.entities);

    // ── 1.5 Integrations + Quality Attributes Bloom (Round 4) ──
    engine.stateMachine.setSubPhase(workflowRun.id, 'integrations_qa_bloom');
    // QA synthetic ids are stable across feedback iterations — a re-bloom
    // produces a new array, but the same id scheme (see buildQaItems)
    // resolves accept/reject consistently.
    let lastQaItems: Array<{ id: string; label: string; description: string }> = [];
    const round15 = await this.runBloomRoundWithFeedbackLoop<{ integrations: Integration[]; qualityAttributes: string[] }>(ctx, {
      subPhaseId: 'integrations_qa_bloom',
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
          sub_phase_id: 'integrations_qa_bloom',
          produced_by_agent_role: 'domain_interpreter',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: derivedFrom,
          content: { kind: 'integrations_qa_bloom', ...bloom } as unknown as Record<string, unknown>,
        });
        artifactIds.push(rec.id);
        return rec;
      },
      mapItems: (bloom) => {
        lastQaItems = this.buildQaItems(bloom.qualityAttributes);
        return [
          ...bloom.integrations.map(i => ({ id: i.id, label: `[Integration] ${i.name}`, description: i.description, tradeoffs: `${i.category} • ${i.ownershipModel}` })),
          ...lastQaItems,
        ];
      },
      buildTitle: () => 'Review Integrations and Quality Attributes',
      buildSummary: (bloom) => `${bloom.integrations.length} integration(s) and ${bloom.qualityAttributes.length} quality attribute(s) proposed.`,
      gatekeeper: {
        bloomDescription: 'integrations and quality attributes for the accepted product scope',
        // QA-N ids are synthetic and index into qualityAttributes by position;
        // mirrored here so both surfaces share a single keptIds set.
        applyPrune: (bloom, keptIds) => ({
          integrations: bloom.integrations.filter(i => keptIds.has(i.id)),
          qualityAttributes: bloom.qualityAttributes.filter((_, i) => keptIds.has(`QA-${i + 1}`)),
        }),
        overlay: `### Vendor / technology specificity rule (integrations + QAs)

This round's items often name SPECIFIC vendors, products, or
technologies (a named database, cache, observability stack, CDN, IDP,
deployment platform, etc.). The shared base prompt's "any upstream
mention of the concept" rule is too loose here: it would let "Redis
Cache" survive because "caching" is mentioned, even though the spec
never picked Redis.

For items that name a specific vendor / product / branded service:
  1. Identify the specific name in the item (e.g., the product name,
     the vendor, the branded service).
  2. Search the upstream artifacts for that LITERAL name (or an
     unambiguous spelling variant).
  3. If found upstream → KEEP. The spec mandated this specific choice.
  4. If not found upstream → DROP — even if the bare concept is
     mentioned. Phase 4 / 5 are where implementations get chosen;
     Phase 1 must not lock in vendor choices the spec did not make.

For items that are BARE CONCEPTS (no vendor/product name) — e.g., a
quality attribute stated abstractly, an integration described only
as "Logging" without naming a vendor — apply the standard "any
upstream mention" rule from the base prompt.

For quality attributes specifically: also drop QAs that introduce
NUMERIC thresholds (latencies, percentages, retention periods,
intervals) that do not appear upstream. The upstream V&V Requirements
section is the only authoritative source for thresholds; a QA that
fabricates a new threshold is unsupported.`,
      },
    });
    if (!round15.success) return { success: false, error: round15.error, artifactIds };
    const integrationsBloom = round15.bloom;
    const keptIntegrationIds = new Set(round15.keptIds);
    const acceptedIntegrations = integrationsBloom.integrations.filter(i => keptIntegrationIds.has(i.id));
    const acceptedQAs = lastQaItems.filter(q => keptIntegrationIds.has(q.id)).map(q => q.description);
    const safeIntegrations = this.pickAcceptedOrAll(acceptedIntegrations, integrationsBloom.integrations);
    const safeQAs = this.pickAcceptedOrAll(acceptedQAs, integrationsBloom.qualityAttributes);

    // ── 1.6 Product Description Synthesis (silent) ──────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'product_description_synthesis');
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
      return { success: false, error: `Product description synthesis failed: ${errMessage(err)}`, artifactIds };
    }
    const handoffRecord = engine.writer.writeRecord({
      record_type: 'product_description_handoff',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: 'product_description_synthesis',
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
      sub_phase_id: 'product_description_synthesis',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [handoffRecord.id],
      content: { kind: 'intent_statement', ...derivedIntentStatement },
    });
    artifactIds.push(statementRecord.id);
    engine.ingestionPipeline.ingest(statementRecord);

    // ── 1.7 Handoff Approval ────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'product_handoff_gate');
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
      sub_phase_id: 'product_handoff_gate',
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
    aoddEmit('mirror.presented', {
      mirror_id: approvalMirror.mirrorId,
      artifact_type: 'product_description_handoff',
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
    engine.stateMachine.setSubPhase(workflowRun.id, 'release_plan');
    // Derive full input surface from handoff + discovery.
    const acceptedWorkflowsForPlan = safeWorkflowsV2;
    const acceptedEntitiesForPlan = safeEntities;
    const acceptedIntegrationsForPlan = safeIntegrations;
    const acceptedComplianceForPlan = discoveryBundle.complianceExtractedItems;
    const acceptedVocabularyForPlan = discoveryBundle.canonicalVocabulary;
    let lastCrossCutting: CrossCuttingContents = {
      workflows: [], compliance: [], integrations: [], vocabulary: [],
      vv_requirements: [], quality_attributes: [], technical_constraints: [],
    };
    const round18 = await this.runBloomRoundWithFeedbackLoop<{ releases: ReleaseV2[]; crossCutting: CrossCuttingContents }>(ctx, {
      subPhaseId: 'release_plan',
      roundLabel: 'Release Plan (v2)',
      lensRationale: state.lensClassification.rationale,
      humanDecisions,
      artifactIds,
      priorRecordIds: [handoffRecord.id],
      runProposer: async (feedback) => {
        const r = await this.runReleasePlanProposalV2_18(ctx, {
          productVision: handoff.productVision,
          productDescription: handoff.productDescription,
          // Use the handoff's filtered phasingStrategy (UJ-* ids surviving
          // the 1.3a MMP gate), not raw discovery output that may still
          // reference rejected journeys.
          phasingStrategy: handoff.phasingStrategy ?? [],
          journeys: safeJourneys,
          workflows: acceptedWorkflowsForPlan,
          entities: acceptedEntitiesForPlan,
          complianceItems: acceptedComplianceForPlan,
          integrations: acceptedIntegrationsForPlan,
          vocabulary: acceptedVocabularyForPlan,
          domains: safeDomains,
          vvRequirements: discoveryBundle.vvRequirements,
          technicalConstraints: discoveryBundle.technicalConstraints,
          qualityAttributes: safeQAs,
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
          sub_phase_id: 'release_plan',
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
      // Render the ACTUAL contained ids per category — not just counts — so
      // the gatekeeper can id-match each claimed member against the Accepted
      // Journeys/Workflows/Entities sets (its core DROP rule). See
      // formatReleaseMenuItem.
      mapItems: (bloom) => bloom.releases.map(r => this.formatReleaseMenuItem(r)),
      buildTitle: () => 'Review the proposed release plan (v2 manifest)',
      buildSummary: (bloom) => `${bloom.releases.length} release(s) proposed. Every accepted handoff artifact is assigned to exactly one release OR to the cross_cutting bucket. The deterministic 1.8 verifier will confirm exact coverage, ordinal integrity, and forward-only dependencies before final approval.`,
      gatekeeper: {
        bloomDescription: 'release plan slicing the accepted handoff artifacts into ordered releases',
        // A total wipeout (keep nothing) is treated as keep-all — zero
        // releases is structurally invalid, so the deterministic 1.8 verifier
        // below does the real structural check. See applyReleasePrune.
        applyPrune: (bloom, keptIds) => this.applyReleasePrune(bloom, keptIds, workflowRun.id),
        // release_plan's evaluation is fundamentally different from
        // member-drop: it checks structural validity of proposed
        // releases (malformed, hallucinated artifact ids, explicit
        // constraint contradictions) rather than upstream grounding
        // of a concept. Use a dedicated prompt builder.
        customPromptBuilder: buildReleasePlanGatekeeperPrompt,
      },
    });
    if (!round18.success) return { success: false, error: round18.error, artifactIds };

    // ── 1.8 deterministic verify + auto-fix + approve + phase gate ──
    return this.verifyAndFinalizeReleasePlan(ctx, {
      round18Bloom: round18.bloom,
      round18Record: round18.record,
      round18KeptIds: round18.keptIds,
      lastCrossCutting,
      safeJourneys,
      workflows: acceptedWorkflowsForPlan,
      entities: acceptedEntitiesForPlan,
      compliance: acceptedComplianceForPlan,
      integrations: acceptedIntegrationsForPlan,
      vocabulary: acceptedVocabularyForPlan,
      vvRequirements: discoveryBundle.vvRequirements,
      technicalConstraints: discoveryBundle.technicalConstraints,
      safeQAs,
      handoffRecord,
      statementRecord,
      approvalMirrorRecord,
      artifactIds,
    });
  }

  /**
   * Phase 1.8 — deterministic release-manifest verify + auto-fix + persist.
   * Sorts/re-ordinals the approved releases, runs the manifest verifier (with
   * a backward-dependency auto-fix pass and a harness-only advisory downgrade),
   * fails with coverage_gap records on any blocking gap, and otherwise mints
   * the approved release_plan record, sets the active pointer, and writes the
   * phase gate. Extracted from executeProductLens to keep it under the
   * cognitive-complexity budget; behavior mirrors the former inline tail.
   */
  private verifyAndFinalizeReleasePlan(
    ctx: PhaseContext,
    args: {
      round18Bloom: { releases: ReleaseV2[]; crossCutting: CrossCuttingContents };
      round18Record: GovernedStreamRecord;
      round18KeptIds: string[];
      lastCrossCutting: CrossCuttingContents;
      safeJourneys: UserJourney[];
      workflows: WorkflowV2[];
      entities: Entity[];
      compliance: ExtractedItem[];
      integrations: Integration[];
      vocabulary: VocabularyTerm[];
      vvRequirements: VVRequirement[];
      technicalConstraints: TechnicalConstraint[];
      safeQAs: string[];
      handoffRecord: GovernedStreamRecord;
      statementRecord: GovernedStreamRecord;
      approvalMirrorRecord: GovernedStreamRecord;
      artifactIds: string[];
    },
  ): PhaseResult {
    const { workflowRun, engine } = ctx;
    const { artifactIds, lastCrossCutting, safeJourneys } = args;
    const releasePlan = args.round18Bloom;
    const keptReleaseIds = new Set(args.round18KeptIds);
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
    const acceptedVvIdsForPlan = args.vvRequirements.map(v => v.id);
    const acceptedTechIdsForPlan = args.technicalConstraints.map(t => t.id);
    const acceptedQaIdsForPlan = args.safeQAs.map((_q, i) => `QA-${i + 1}`);
    let manifestGaps = verifyReleaseManifest({
      plan: draftPlan,
      journeys: safeJourneys,
      workflows: args.workflows,
      entityIds: args.entities.map(e => e.id),
      complianceIds: args.compliance.map(c => c.id),
      integrations: args.integrations,
      vocabulary: args.vocabulary,
      vvRequirementIds: acceptedVvIdsForPlan,
      qualityAttributeIds: acceptedQaIdsForPlan,
      technicalConstraintIds: acceptedTechIdsForPlan,
    });

    // Auto-fix pass — when the verifier flags release_backward_dependency
    // for one or more workflows, the LLM placed the workflow earlier than
    // its trigger targets. Deterministic remedy: move each offending
    // workflow forward to the latest release that contains any of its
    // trigger targets. Re-verify; only fall through to the hard-fail
    // path if violations remain.
    const backwardGap = manifestGaps.some(g => g.check === 'release_backward_dependency' && g.severity === 'blocking');
    if (backwardGap) {
      const fixesApplied = autoFixBackwardDependencies(draftPlan, args.workflows, safeJourneys);
      if (fixesApplied.length > 0) {
        getLogger().warn('workflow', `Phase 1.8: auto-fixed ${fixesApplied.length} backward-dependency violation(s) — promoted workflow(s) to a later release`, {
          workflow_run_id: workflowRun.id,
          fixes: fixesApplied.slice(0, 20),
        });
        manifestGaps = verifyReleaseManifest({
          plan: draftPlan,
          journeys: safeJourneys,
          workflows: args.workflows,
          entityIds: args.entities.map(e => e.id),
          complianceIds: args.compliance.map(c => c.id),
          integrations: args.integrations,
          vocabulary: args.vocabulary,
          vvRequirementIds: acceptedVvIdsForPlan,
          qualityAttributeIds: acceptedQaIdsForPlan,
          technicalConstraintIds: acceptedTechIdsForPlan,
        });
      }
    }
    let blockingManifestGaps = manifestGaps.filter(g => g.severity === 'blocking');
    // Harness-scoped opt-in (default OFF → production behaviour unchanged): a
    // validation run exercising Phases 3-8 (virtuousCycle.harness) should not
    // hard-fail on a Phase-1.8 release-plan coverage miss caused by LLM sampling
    // variance (temp=1.0 dense models omit journeys from the release `contains`
    // blocks stochastically). Downgrade blocking manifest gaps to advisory — they
    // are still persisted as coverage_gap records and WARN-logged, so the
    // fragility stays observable; the run just proceeds. Mirrors
    // JANUMICODE_REVIEW_ENABLED / JANUMICODE_SCOPE_GATEKEEPER harness relaxations.
    if (blockingManifestGaps.length > 0
        && (process.env.JANUMICODE_RELEASE_MANIFEST_ADVISORY ?? '') === '1') {
      getLogger().warn('workflow', 'Phase 1.8 verifier: blocking manifest gaps DOWNGRADED to advisory (JANUMICODE_RELEASE_MANIFEST_ADVISORY=1)', {
        workflow_run_id: workflowRun.id,
        downgraded: blockingManifestGaps.map(g => g.check),
      });
      for (const g of blockingManifestGaps) g.severity = 'advisory';
      blockingManifestGaps = [];
    }
    if (blockingManifestGaps.length > 0) {
      const gapRecIds = this.persistCoverageGaps(ctx, manifestGaps, [args.round18Record.id]);
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
      this.persistCoverageGaps(ctx, manifestGaps, [args.round18Record.id]);
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
      sub_phase_id: 'release_plan',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [args.round18Record.id],
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
      sub_phase_id: 'release_plan',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [
        args.handoffRecord.id, args.statementRecord.id, args.approvalMirrorRecord.id,
        approvedReleasePlanRecord.id,
      ],
      content: {
        kind: 'phase_gate',
        phase_id: '1',
        intent_statement_record_id: args.statementRecord.id,
        product_description_handoff_record_id: args.handoffRecord.id,
        active_release_plan_record_id: approvedReleasePlanRecord.id,
        has_unresolved_warnings: false,
        has_unapproved_proposals: false,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '1' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });
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
    aoddEmit('mirror.presented', { mirror_id: bundleRecord.id, artifact_type: 'product_bloom_mirror' });
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
      /**
       * Scope gatekeeper — opt-in per round. When provided, runs an
       * LLM-backed prune of the bloom output BEFORE the decision card
       * sees it. The original bloom artifact is superseded by the
       * pruned version. Calibrated mode: defaults to keep, drops only
       * items the LLM can justify against upstream extraction artifacts.
       *
       * Required pieces:
       *   - bloomDescription: short label for the prompt ("business domains and personas")
       *   - applyPrune: given the bloom and the set of kept ids, return a new
       *     bloom with non-kept items filtered out
       */
      gatekeeper?: {
        bloomDescription: string;
        applyPrune: (bloom: T, keptIds: Set<string>) => T;
        /**
         * Optional sub-phase-specific overlay — narrow guidance for the
         * artifact shape this round produces (personas vs entities vs
         * integrations, etc.). Spliced into the shared base prompt
         * between the universal criteria and the upstream context.
         */
        overlay?: string;
        /**
         * Optional fully-custom prompt builder. Use ONLY for sub-phases
         * whose evaluation is fundamentally different from member-drop
         * (e.g., release_plan). For ordinary shape-specific tweaks,
         * prefer `overlay` so the universal procedure stays canonical.
         */
        customPromptBuilder?: NonNullable<import('../scopeGatekeeper').GatekeeperConfig['customPromptBuilder']>;
      };
    },
  ): Promise<
    | { success: true; bloom: T; record: GovernedStreamRecord; keptIds: string[] }
    | { success: false; error: string }
  > {
    const MAX_FEEDBACK_ITERATIONS = 3;
    let accumulatedFeedback = '';
    let lastRecord: GovernedStreamRecord | null = null;

    for (let iter = 1; iter <= MAX_FEEDBACK_ITERATIONS + 1; iter++) {
      let bloom: T;
      try {
        bloom = await spec.runProposer(accumulatedFeedback);
      } catch (err) {
        return { success: false, error: `${spec.roundLabel} bloom failed: ${err instanceof Error ? err.message : String(err)}` };
      }

      // Auto-mitigation step (spec §auto-mitigation-design.md).
      // The reasoning-review harness has fired synchronously on the
      // proposer's agent_output by the time we get here. If policy is
      // 'auto' and a registered validator emitted HIGH findings with
      // machine-resolvable targets, mutate `bloom` before writing it.
      // Each mutation lands an `auto_mitigation_action` governed-stream
      // record for audit.
      this.runAutoMitigation(ctx, spec.subPhaseId, bloom as unknown as Record<string, unknown>);

      const derivedFrom = [
        ...spec.priorRecordIds,
        ...(lastRecord ? [lastRecord.id] : []),
      ];
      let record = spec.writeBloomRecord(bloom, derivedFrom);
      ctx.engine.ingestionPipeline.ingest(record);

      // Scope gatekeeper — opt-in per round. Runs an LLM prune of the
      // proposer's output BEFORE the decision card / downstream
      // consumers see it. Supersedes the bloom artifact with the
      // pruned version and writes a scope_prune_decision audit record.
      // Env var JANUMICODE_SCOPE_GATEKEEPER=off skips it (tests with
      // mock LLM queues that don't account for the extra gatekeeper
      // call use this to keep their fixture counts deterministic).
      ({ bloom, record } = await this.applyBloomGatekeeper(ctx, spec, bloom, record));

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
   * Apply the opt-in scope gatekeeper to a freshly-written bloom record.
   * Extracted from runBloomRoundWithFeedbackLoop to keep that loop's
   * cognitive complexity in check. Returns the (possibly pruned) bloom
   * and its current governed-stream record — identical values to the
   * inline logic it replaced.
   */
  private async applyBloomGatekeeper<T>(
    ctx: PhaseContext,
    spec: {
      subPhaseId: string;
      mapItems: (bloom: T) => Array<{ id: string; label: string; description?: string; tradeoffs?: string }>;
      writeBloomRecord: (bloom: T, derivedFrom: string[]) => GovernedStreamRecord;
      gatekeeper?: {
        bloomDescription: string;
        applyPrune: (bloom: T, keptIds: Set<string>) => T;
        overlay?: string;
        customPromptBuilder?: NonNullable<import('../scopeGatekeeper').GatekeeperConfig['customPromptBuilder']>;
      };
    },
    bloom: T,
    record: GovernedStreamRecord,
  ): Promise<{ bloom: T; record: GovernedStreamRecord }> {
    const gatekeeperEnabled = (process.env.JANUMICODE_SCOPE_GATEKEEPER ?? 'on') !== 'off';
    if (spec.gatekeeper && gatekeeperEnabled) {
      const pruneOutcome = await this.runScopeGatekeeperForBloom(
        ctx, spec.subPhaseId, spec.gatekeeper.bloomDescription,
        spec.mapItems(bloom), record.id,
        {
          overlay: spec.gatekeeper.overlay,
          customPromptBuilder: spec.gatekeeper.customPromptBuilder,
        },
      );
      if (pruneOutcome.dropped.length > 0 || pruneOutcome.error) {
        // Apply the prune to the bloom and write the pruned artifact.
        const keptSet = new Set(pruneOutcome.kept_ids);
        const prunedBloom = spec.gatekeeper.applyPrune(bloom, keptSet);
        const prunedRecord = spec.writeBloomRecord(prunedBloom, [record.id]);
        ctx.engine.ingestionPipeline.ingest(prunedRecord);
        ctx.engine.writer.supersedByRollback(record.id, prunedRecord.id);
        bloom = prunedBloom;
        record = prunedRecord;
      }
    }
    return { bloom, record };
  }

  /**
   * Invoke the scope gatekeeper for a freshly-emitted bloom artifact.
   *
   * Loads distilled upstream-extraction artifacts (Phase 1.0a-f outputs)
   * as the gatekeeper's ground-truth context, runs the LLM prune, and
   * writes a `scope_prune_decision` audit record. Returns the prune
   * outcome so the caller can apply it to the bloom shape it owns.
   *
   * On any failure (LLM throw, parse fail), the gatekeeper module
   * already degrades to "keep all items" — this method propagates that
   * safely so the workflow continues with no data loss.
   */
  private async runScopeGatekeeperForBloom(
    ctx: PhaseContext,
    subPhaseId: string,
    bloomDescription: string,
    items: Array<{ id: string; label: string; description?: string; tradeoffs?: string }>,
    originalArtifactId: string,
    options?: {
      overlay?: string;
      customPromptBuilder?: NonNullable<import('../scopeGatekeeper').GatekeeperConfig['customPromptBuilder']>;
    },
  ): Promise<{ kept_ids: string[]; dropped: Array<{ id: string; reason: string }>; rationale_summary: string; error?: string }> {
    const { engine, workflowRun } = ctx;
    if (items.length === 0) {
      return { kept_ids: [], dropped: [], rationale_summary: 'no items to prune' };
    }

    // Build upstream-extraction context from already-persisted artifacts.
    // Pass subPhaseId so the collector can strip this gatekeeper's OWN
    // un-pruned bloom output from the accepted sets (it's written before
    // the gatekeeper runs; feeding it back as "already accepted" biases
    // the LLM toward keep-all — see stripSelfProducedAcceptedSets).
    const upstream = this.collectGatekeeperUpstreamContext(ctx, subPhaseId);

    const diRoute = engine.configManager.getRoutingModel('domain_interpreter');
    const result = await runScopeGatekeeperPrune(
      engine.llmCaller,
      { provider: diRoute.provider, model: diRoute.model, baseUrl: diRoute.baseUrl },
      {
        workflowRunId: workflowRun.id,
        phaseId: '1',
        subPhaseId,
        bloomDescription,
        items,
        upstreamContext: upstream,
        agentRole: 'domain_interpreter',
        overlay: options?.overlay,
        customPromptBuilder: options?.customPromptBuilder,
      },
    );

    // Write the audit record. Even when nothing was dropped, we emit
    // it so the run's history shows the gatekeeper was consulted.
    const auditContent: ScopePruneDecisionContent = {
      kind: 'scope_prune_decision',
      schemaVersion: '1.0',
      sub_phase_id: subPhaseId,
      original_artifact_id: originalArtifactId,
      pruned_artifact_id: '',  // set after the pruned write — fixed up below by caller
      kept_ids: result.kept_ids,
      dropped: result.dropped.map((d) => {
        const orig = items.find((it) => it.id === d.id);
        return { id: d.id, label: orig?.label, reason: d.reason };
      }),
      rationale_summary: result.rationale_summary,
      gatekeeper_provider: result.provider,
      gatekeeper_model: result.model,
      duration_ms: result.duration_ms,
    };
    engine.writer.writeRecord({
      record_type: 'scope_prune_decision',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: subPhaseId,
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [originalArtifactId],
      content: auditContent as unknown as Record<string, unknown>,
    });

    getLogger().info('workflow', 'Scope gatekeeper prune complete', {
      workflow_run_id: workflowRun.id,
      sub_phase_id: subPhaseId,
      items_in: items.length,
      kept: result.kept_ids.length,
      dropped: result.dropped.length,
      duration_ms: result.duration_ms,
    });

    return {
      kept_ids: result.kept_ids,
      dropped: result.dropped,
      rationale_summary: result.rationale_summary,
      error: result.error,
    };
  }

  /**
   * Assemble the gatekeeper's upstream-context object by pulling the
   * latest current-version Phase 1 extraction artifacts from the
   * governed stream.
   */
  private collectGatekeeperUpstreamContext(ctx: PhaseContext, subPhaseId?: string): GatekeeperUpstreamContext {
    const { engine, workflowRun } = ctx;
    const byKind = this.indexCurrentArtifactsByKind(
      engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced'),
    );
    const id = byKind.get('intent_discovery');
    const tcd = byKind.get('technical_constraints_discovery');
    const crd = byKind.get('compliance_retention_discovery');
    const vvd = byKind.get('vv_requirements_discovery');
    const sc = byKind.get('scope_classification');
    // Read the LATEST cv=1 bloom artifacts (the gatekeeper-pruned
    // outputs) so downstream gatekeepers see the AUTHORITATIVE
    // accepted set, not just the narrative Analysis Summary.
    const bdb = byKind.get('business_domains_bloom');
    const ujb = byKind.get('user_journey_bloom');
    const swb = byKind.get('system_workflow_bloom');
    const eb  = byKind.get('entities_bloom');
    const ctx_: GatekeeperUpstreamContext = {
      analysisSummary: typeof id?.analysisSummary === 'string' ? id.analysisSummary as string : undefined,
      intentConstraints: Array.isArray(id?.constraints) ? id.constraints as Array<{id?: string; text: string}> : undefined,
      intentRequirements: Array.isArray(id?.requirements) ? id.requirements as Array<{id?: string; text: string}> : undefined,
      intentOpenQuestions: Array.isArray(id?.openQuestions) ? id.openQuestions as Array<{id?: string; text: string}> : undefined,
      technicalConstraints: Array.isArray(tcd?.technicalConstraints) ? tcd.technicalConstraints as Array<{id?: string; text: string}> : undefined,
      complianceItems: Array.isArray(crd?.complianceExtractedItems) ? crd.complianceExtractedItems as Array<{id?: string; text: string; type?: string}> : undefined,
      vvRequirements: Array.isArray(vvd?.vvRequirements) ? vvd.vvRequirements as Array<{id?: string; target?: string; threshold?: string}> : undefined,
      scopeClassification: sc ? { breadth: sc.breadth as string, depth: sc.depth as string } : undefined,
      acceptedDomains: Array.isArray(bdb?.domains)
        ? (bdb.domains as Array<Record<string, unknown>>).map(d => ({ id: coerceFieldToString(d.id), name: coerceFieldToString(d.name), description: typeof d.description === 'string' ? d.description : undefined }))
        : undefined,
      acceptedPersonas: Array.isArray(bdb?.personas)
        ? (bdb.personas as Array<Record<string, unknown>>).map(p => ({ id: coerceFieldToString(p.id), name: coerceFieldToString(p.name), description: typeof p.description === 'string' ? p.description : undefined }))
        : undefined,
      acceptedJourneys: Array.isArray(ujb?.userJourneys)
        ? (ujb.userJourneys as Array<Record<string, unknown>>).map(j => ({ id: coerceFieldToString(j.id), title: coerceFieldToString(j.title ?? j.name), personaId: typeof j.personaId === 'string' ? j.personaId : undefined }))
        : undefined,
      acceptedWorkflows: Array.isArray(swb?.workflows)
        ? (swb.workflows as Array<Record<string, unknown>>).map(w => ({ id: coerceFieldToString(w.id), name: coerceFieldToString(w.name), businessDomainId: typeof w.businessDomainId === 'string' ? w.businessDomainId : undefined }))
        : undefined,
      acceptedEntities: Array.isArray(eb?.entities)
        ? (eb.entities as Array<Record<string, unknown>>).map(e => ({ id: coerceFieldToString(e.id), name: coerceFieldToString(e.name), businessDomainId: typeof e.businessDomainId === 'string' ? e.businessDomainId : undefined }))
        : undefined,
    };
    // Strip the accepted set(s) this gatekeeper's own bloom produced so
    // it doesn't see its un-pruned proposal as "already accepted".
    return subPhaseId ? stripSelfProducedAcceptedSets(ctx_, subPhaseId) : ctx_;
  }

  /**
   * Index current-version artifact records by their content `kind`,
   * keeping the last-seen record for each kind (matches the prior inline
   * loop's overwrite semantics). Non-current records and records without
   * a string `kind` are skipped. Extracted from
   * collectGatekeeperUpstreamContext to bound its cognitive complexity.
   */
  private indexCurrentArtifactsByKind(
    records: GovernedStreamRecord[],
  ): Map<string, Record<string, unknown>> {
    const byKind = new Map<string, Record<string, unknown>>();
    for (const r of records) {
      if (!r.is_current_version) continue;
      const c = r.content as Record<string, unknown>;
      const kind = typeof c.kind === 'string' ? c.kind : undefined;
      if (kind) byKind.set(kind, c);
    }
    return byKind;
  }

  /**
   * 1.0b — silent product discovery. Reads raw intent + inlined
   * referenced files; produces vision, description, seed personas /
   * journeys / phasing, and extracted items.
   */
  private async runIntentDiscovery(ctx: PhaseContext, rawIntentText: string): Promise<IntentDiscoveryResult> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'product_intent_discovery', 'product');
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'product_intent_discovery', agentRole: 'domain_interpreter', label: 'Phase 1.0b — Intent Discovery' },
    });
    const rawParsed = this.safeParseJson(result);
    if (!rawParsed) throw new Error('Intent Discovery returned unparseable JSON');
    // Wire-format → record-type adapter: agents now emit snake_case; map to camelCase TS fields.
    const parsed = normalizeIntentDiscoveryFromWire(rawParsed);
    return {
      analysisSummary: (parsed.analysisSummary as string) ?? '',
      productVision: (parsed.productVision as string) ?? '',
      productDescription: (parsed.productDescription as string) ?? '',
      personas: ((parsed.personas as Array<Record<string, unknown>> | undefined) ?? []).map(normalizePersonaFromWire) as unknown as Persona[],
      userJourneys: ((parsed.userJourneys as Array<Record<string, unknown>> | undefined) ?? []).map(normalizeJourneyFromWire) as unknown as UserJourney[],
      phasingStrategy: (parsed.phasingStrategy as PhasingPhase[] | undefined) ?? [],
      successMetrics: (parsed.successMetrics as string[] | undefined) ?? [],
      uxRequirements: (parsed.uxRequirements as string[] | undefined) ?? [],
      requirements: this.normalizeExtractedItems(parsed.requirements, 'REQUIREMENT', 'REQ'),
      decisions: this.normalizeExtractedItems(parsed.decisions, 'DECISION', 'DEC'),
      constraints: this.normalizeExtractedItems(parsed.constraints, 'CONSTRAINT', 'CON'),
      openQuestions: this.normalizeExtractedItems(parsed.openQuestions ?? parsed.open_questions, 'OPEN_QUESTION', 'Q'),
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
      'domain_interpreter', 'technical_constraints_discovery', 'product',
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'technical_constraints_discovery', agentRole: 'domain_interpreter', label: 'Phase 1.0c — Technical Constraints Discovery' },
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
      'domain_interpreter', 'compliance_retention_discovery', 'product',
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'compliance_retention_discovery', agentRole: 'domain_interpreter', label: 'Phase 1.0d — Compliance & Retention Discovery' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Compliance & Retention Discovery returned unparseable JSON');
    // Accept snake_case (canonical) with camelCase fallback for backward compat.
    const complianceRawCamel = Array.isArray(parsed.complianceExtractedItems) ? parsed.complianceExtractedItems : [];
    const raw = Array.isArray(parsed.compliance_extracted_items)
      ? parsed.compliance_extracted_items
      : complianceRawCamel;
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
      'domain_interpreter', 'vv_requirements_discovery', 'product',
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'vv_requirements_discovery', agentRole: 'domain_interpreter', label: 'Phase 1.0e — V&V Requirements Discovery' },
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
      'domain_interpreter', 'canonical_vocabulary_discovery', 'product',
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'canonical_vocabulary_discovery', agentRole: 'domain_interpreter', label: 'Phase 1.0f — Canonical Vocabulary Discovery' },
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
    // Delegated to the extracted pure-function module so the
    // LLM-shape-tolerance behavior is regression-tested in isolation.
    // See phase1Normalizers.ts for the fallback order rationale.
    return normalizeTechnicalConstraints(raw);
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
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'business_domains_bloom', 'product');
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'business_domains_bloom', agentRole: 'domain_interpreter', label: 'Phase 1.2 — Business Domains & Personas Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Business Domains bloom returned unparseable JSON');
    // Wire-format → record-type adapter: normalize snake_case domain/persona fields.
    const rawDomains = (parsed.domains as Array<Record<string, unknown>> | undefined) ?? [];
    const rawPersonas = (parsed.personas as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      domains: rawDomains.map(normalizeDomainFromWire) as unknown as BusinessDomain[],
      personas: rawPersonas.map(normalizePersonaFromWire) as unknown as Persona[],
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
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'entities_bloom', 'product');
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'entities_bloom', agentRole: 'domain_interpreter', label: 'Phase 1.4 — Entities Bloom' },
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
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'integrations_qa_bloom', 'product');
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'integrations_qa_bloom', agentRole: 'domain_interpreter', label: 'Phase 1.5 — Integrations & QA Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('Integrations/QA bloom returned unparseable JSON');
    // Normalize qualityAttributes to string[]: some models (gpt-oss:20b) emit each
    // QA as an OBJECT and/or use the snake_case key. Coerce producer-side so all
    // consumers (buildQaItems' q.slice, .filter, safeQAs) get strings.
    const rawQas = (parsed.qualityAttributes ?? parsed.quality_attributes) as unknown;
    return {
      integrations: (parsed.integrations as Integration[] | undefined) ?? [],
      qualityAttributes: Array.isArray(rawQas)
        ? rawQas.map(coerceQualityAttribute).filter(s => s.length > 0)
        : [],
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
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'product_description_synthesis', 'product');
    if (!template) {
      throw new Error('1.6 product_description_synthesis product-lens template not found');
    }

    // Compact summary of the bloom shape — names + counts only, no full
    // JSON payload. Keeps input tokens ~1 K and output tokens ~500.
    const bloomSummary = [
      `Personas (${input.personas.length}): ${input.personas.map(p => p.id + ' ' + p.name).join('; ')}`,
      `User Journeys (${input.journeys.length}): ${input.journeys.map(j => j.id + ' ' + j.title).join('; ')}`,
      `Business Domains (${input.domains.length}): ${input.domains.map(d => d.id + ' ' + d.name).join('; ')}`,
      `Entities: ${input.entities.length}`,
      `Workflows (${input.workflows.length}): ${input.workflows.map(w => w.id + ' ' + w.name).join('; ')}`,
      `Integrations (${input.integrations.length}): ${input.integrations.map(i => i.id + ' ' + i.name).join('; ')}`,
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'product_description_synthesis', agentRole: 'domain_interpreter', label: 'Phase 1.6 — Product Description Narrative Refinement' },
    });
    const rawParsed = this.safeParseJson(result);
    if (!rawParsed) throw new Error('1.6 narrative LLM returned unparseable JSON');
    // Wire-format → record-type adapter: agents now emit snake_case; map to camelCase TS fields.
    const parsed = normalizeSynthesisFromWire(rawParsed);

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
    // Refresh phasing's journeyIds against the accepted journeys.
    //
    // History: intent_discovery (Phase 1.0b) emits seed phasing entries
    // with abstract journey IDs the LLM invented at that stage (e.g.
    // UJ-SHORTEN_URL). user_journey_bloom (Phase 1.3a) then produces the
    // authoritative kept journey set with DIFFERENT IDs (e.g.
    // UJ-CREATE-SHORT-LINK-WEB). The seed IDs are dead by this point.
    //
    // Resolution: strip the seed `journey_ids` / `journeyIds` fields and
    // re-populate `journeyIds` from the accepted set. Each accepted
    // journey carries an `implementationPhase` tag (set by 1.3a per the
    // validated phasing strategy). We distribute kept journeys to phases
    // by matching `UserJourney.implementationPhase` against
    // `PhasingPhase.phase`. Falls back to single-phase ("assign all")
    // when only one phase exists, which is the dominant thin-slice shape.
    const acceptedJourneyIds = input.journeys.map(j => j.id);
    const acceptedJourneyIdSet = new Set(acceptedJourneyIds);

    // Build phase-tag → [journeyId] index from the accepted set so each
    // phase can claim its assigned journeys. Normalise the tag (trim +
    // case-fold) since the LLM occasionally emits "phase 1" / "PHASE 1".
    const normalisePhaseTag = (s: unknown): string =>
      typeof s === 'string' ? s.trim().toLowerCase() : '';
    const journeysByPhaseTag = new Map<string, string[]>();
    for (const j of input.journeys) {
      const tag = normalisePhaseTag(j.implementationPhase);
      if (!tag) continue;
      const bucket = journeysByPhaseTag.get(tag) ?? [];
      bucket.push(j.id);
      journeysByPhaseTag.set(tag, bucket);
    }

    const phasingStrategy = input.discovery.phasingStrategy.map((phase, _idx, arr) => {
      const preFiltered = (phase.journeyIds ?? []).filter(id => acceptedJourneyIdSet.has(id));
      const seedSnake = ((phase as unknown as { journey_ids?: unknown }).journey_ids);
      const seedSnakeFiltered = Array.isArray(seedSnake)
        ? (seedSnake as unknown[]).filter((id): id is string => typeof id === 'string' && acceptedJourneyIdSet.has(id))
        : [];
      let journeyIds = [...new Set([...preFiltered, ...seedSnakeFiltered])];

      // Multi-phase distribution: when the filter produced nothing,
      // claim journeys whose `implementationPhase` matches this phase's
      // tag. This is the correct path when the seed IDs are dead but
      // 1.3a tagged each kept journey with the validated phase name.
      if (journeyIds.length === 0) {
        const tagged = journeysByPhaseTag.get(normalisePhaseTag(phase.phase)) ?? [];
        journeyIds = [...tagged];
      }

      // Single-phase fallback: when the strategy has exactly one phase
      // and we still have nothing (e.g. 1.3a omitted the tag), assign
      // all accepted journeys. Correct for "Phase 1 = deliver" plans.
      if (journeyIds.length === 0 && arr.length === 1 && acceptedJourneyIds.length > 0) {
        journeyIds = [...acceptedJourneyIds];
      }

      // Strip seed snake_case so only camelCase leaves this function.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { journey_ids: _stripped, ...phaseSansSnake } = phase as unknown as Record<string, unknown>;
      return { ...phaseSansSnake, journeyIds } as typeof phase;
    });

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
   * Project a product_description_handoff into the intent_statement shape
   * Phase 2+ reads today. A follow-up can upgrade specific downstream
   * phases to read the richer handoff directly.
   */
  private deriveIntentStatementFromHandoff(handoff: ProductDescriptionHandoffContent): Record<string, unknown> {
    // DEFECT-5 fix: previously problem_it_solves was set to
    // productDescription verbatim, duplicating the description field.
    // Derive a distinct problem framing from the analysis summary's
    // first sentence (which typically articulates the problem statement)
    // and the personas' pain points (each persona's description often
    // names the user's pain — "Anyone who wants to share a long URL").
    // Compose a problem-focused statement that is structurally distinct
    // from the description.
    //
    // who_it_serves: previously single persona; widen to all primary
    // personas so the intent_statement reflects the full audience.
    const whoItServes = handoff.personas.length > 0
      ? handoff.personas.map(p => `${p.name} (${p.description})`).join('; ')
      : 'unspecified';
    const problemItSolves = this.deriveProblemStatement(handoff);
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

  /**
   * Derive a problem-focused statement that is structurally distinct
   * from the product description. Used by intent_statement's
   * problem_it_solves slot.
   *
   * Heuristic strategy:
   *   1. If any persona has `painPoints`, weave those into a "users
   *      face X" statement — most directly answers "what problem does
   *      this solve?".
   *   2. Else if the analysisSummary contains a sentence with problem-
   *      indicating phrasing (problem, need, frustration, pain, want,
   *      lack, difficult), surface that sentence.
   *   3. Else fall back to a synthetic statement composed from the
   *      product vision: "<Personas> need <vision-paraphrase>".
   *
   * The output is intentionally shorter and more focused than the
   * description, and never duplicates it verbatim.
   */
  private deriveProblemStatement(handoff: ProductDescriptionHandoffContent): string {
    // Strategy 1: persona pain points.
    const painPoints = handoff.personas.flatMap(p => p.painPoints ?? []).filter(s => s.trim().length > 0);
    if (painPoints.length > 0) {
      const personaName = handoff.personas[0]?.name ?? 'Users';
      const uniquePains = [...new Set(painPoints)].slice(0, 3);
      return `${personaName} and similar users face the following challenges: ${uniquePains.join('; ')}.`;
    }

    // Strategy 2: problem-indicating sentence in analysisSummary.
    const summary = handoff.summary ?? '';
    const sentences = summary.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const problemKeywords = /\b(problem|need|frustrat|pain|want|lack|difficult|tedious|cumbersome|awkward)\b/i;
    const problemSentence = sentences.find(s => problemKeywords.test(s));
    if (problemSentence && problemSentence !== handoff.productDescription) {
      return problemSentence.trim();
    }

    // Strategy 3: synthetic fallback from vision.
    const personaList = handoff.personas.slice(0, 2).map(p => p.name).join(' and ') || 'users';
    const vision = handoff.productVision || handoff.productDescription || handoff.summary || 'a streamlined solution';
    return `${personaList} need ${vision.replace(/^[A-Z]/, c => c.toLowerCase())}`;
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

  /**
   * Like formatExtractedItems but preserves the item id (COMP-*, INT-*,
   * VV-*, etc.) so prompts that ask the model to cite the id verbatim
   * actually see it. Thin-slice-1 evidence: user_journey_bloom (1.3a)
   * and system_workflow_bloom (1.3b) instructed the model to use exact
   * COMP-* slugs in `surfaces.compliance_regimes[]` and
   * `triggers[].regime_id`, but `formatExtractedItems` rendered each
   * item without its id, forcing the model to fabricate. The self-heal
   * filters then dropped every fabricated id, leaving compliance
   * surfaces silently empty across all journeys and workflows.
   */
  private formatExtractedItemsWithIds(items: ExtractedItem[]): string {
    if (!items.length) return '(none)';
    return items.slice(0, 25).map(i => `- **${i.id}**: ${i.text}`).join('\n');
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
    const out = raw.map((r, i) => {
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
    // Wrap in synthetic { items } so the field-diff's size_changed
    // surfaces drops where, e.g., the LLM emitted 12 items but a key
    // mismatch caused 0 to survive. Same shape as
    // normalizeTechnicalConstraints to keep grep queries consistent.
    traceNormalize(
      `phase1.normalizeExtractedItems.${type}`,
      { items: raw },
      { items: out },
    );
    return out;
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
      const recovered = tryParseJson(result.text);
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
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'user_journey_bloom', 'product');
    if (!template) throw new Error('1.3a user_journey_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      accepted_personas: this.formatPersonas(inputs.acceptedPersonas),
      accepted_domains: this.formatDomains(inputs.acceptedDomains),
      phasing_strategy: this.formatPhasing(inputs.phasingStrategy),
      compliance_regimes: this.formatExtractedItemsWithIds(inputs.complianceItems),
      retention_rules: this.formatExtractedItemsWithIds(inputs.retentionRules),
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'user_journey_bloom', agentRole: 'domain_interpreter', label: 'Phase 1.3a — User Journey Bloom' },
    });
    const parsed = this.safeParseJson(result);
    if (!parsed) throw new Error('1.3a bloom returned unparseable JSON');
    const unreachedPersonas = this.extractUnreachedIds(parsed.unreached_personas, 'personaId');
    const unreachedDomains = this.extractUnreachedIds(parsed.unreached_domains, 'domainId');
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
    const acceptedPersonaIds = new Set(inputs.acceptedPersonas.map(p => p.id));
    // Accept snake_case (canonical) with camelCase fallback; normalize each journey object.
    const rawJourneysRaw = (
      (parsed.user_journeys ?? parsed.userJourneys) as Array<Record<string, unknown>> | undefined
    ) ?? [];
    const rawJourneys = rawJourneysRaw.map(normalizeJourneyFromWire);
    const droppedBySurfaceType: Record<string, string[]> = {
      compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [],
    };
    // Persona-ID self-heal. Mirrors the surfaces[*] drop pattern but
    // applied to journey.personaId, journey.additionalPersonas[], and
    // journey.steps[].actor. Resolution order per journey: (1) per-journey
    // LLM retry, (2) fuzzy-remap fallback, (3) drop. See
    // repairJourneyPersonaRefs; the log arrays and the cross-journey
    // TOTAL_RETRY_BUDGET counter are threaded through by reference / return.
    const personaRemapLog: Array<{ from: string; to: string; where: string }> = [];
    const personaDropLog: Array<{ id: string; where: string }> = [];
    const personaRetryLog: Array<{ journey_id: string; from: string; to: string; outcome: string }> = [];
    const accepted = {
      personaIds: acceptedPersonaIds,
      integrations: acceptedIntegrations,
      compliance: acceptedCompliance,
      retention: acceptedRetention,
      vv: acceptedVV,
      personas: inputs.acceptedPersonas,
    };
    const logs = { personaRemapLog, personaDropLog, personaRetryLog };
    let totalRetriesUsed = 0;
    const journeysAfterDrop: Array<Record<string, unknown>> = [];
    for (const jRaw of rawJourneys) {
      const res = await this.repairJourneyPersonaRefs(
        ctx, jRaw as Record<string, unknown>, accepted, droppedBySurfaceType, logs, totalRetriesUsed,
      );
      totalRetriesUsed = res.totalRetriesUsed;
      if (res.journey) journeysAfterDrop.push(res.journey);
    }
    const userJourneys: UserJourney[] = journeysAfterDrop as unknown as UserJourney[];
    if (personaRetryLog.length > 0) {
      const fixed = personaRetryLog.filter(r => r.outcome === 'fixed').length;
      getLogger().warn('workflow', `Phase 1.3a: ran ${personaRetryLog.length} per-journey LLM retry/retries (${fixed} fixed by retry, rest fell through to remap/drop)`, {
        workflow_run_id: ctx.workflowRun.id,
        retries: personaRetryLog.slice(0, 20),
        total_retries_used: totalRetriesUsed,
      });
    }
    if (personaRemapLog.length > 0) {
      getLogger().warn('workflow', `Phase 1.3a: remapped ${personaRemapLog.length} hallucinated persona id(s) to nearest accepted match`, {
        workflow_run_id: ctx.workflowRun.id,
        remaps: personaRemapLog.slice(0, 20),
      });
    }
    if (personaDropLog.length > 0) {
      getLogger().warn('workflow', `Phase 1.3a: dropped ${personaDropLog.length} unresolvable persona id reference(s)`, {
        workflow_run_id: ctx.workflowRun.id,
        drops: personaDropLog.slice(0, 20),
      });
    }
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
   * Extract a de-blanked id list from an `unreached_*` array where each entry
   * is `{ [key]: string }`. Mirrors the former inline
   * `Array.isArray(x) ? x.map(u => u[key] ?? '').filter(Boolean) : []`.
   * Extracted from runJourneyBloom13a to keep it under the complexity budget.
   */
  private extractUnreachedIds(raw: unknown, key: string): string[] {
    if (!Array.isArray(raw)) return [];
    return (raw as Array<Record<string, unknown>>)
      .map(u => (u[key] ?? '') as string)
      .filter(Boolean);
  }

  /**
   * Resolve a persona ref against the accepted set: pass it through when
   * already accepted, else fuzzy-remap to the nearest accepted persona
   * (logging the remap), else log a drop and return null. Mutates the passed
   * log arrays. Extracted from runJourneyBloom13a's `remapPersona` closure.
   */
  private remapPersonaAgainstAccepted(
    raw: string,
    where: string,
    acceptedPersonaIds: Set<string>,
    personaRemapLog: Array<{ from: string; to: string; where: string }>,
    personaDropLog: Array<{ id: string; where: string }>,
  ): string | null {
    if (acceptedPersonaIds.has(raw)) return raw;
    const best = nearestAcceptedPersona(raw, [...acceptedPersonaIds]);
    if (best) {
      personaRemapLog.push({ from: raw, to: best, where });
      return best;
    }
    personaDropLog.push({ id: raw, where });
    return null;
  }

  /**
   * Drop any surfaces[*] id that isn't in the accepted set for its type,
   * mutating the journey's `surfaces` in place and recording each dropped id
   * on `droppedBySurfaceType`. retention_rules also accept a compliance id
   * (merge set). Extracted from runJourneyBloom13a's `filterSurfaces` closure.
   */
  private filterJourneySurfaces(
    j: Record<string, unknown>,
    accepted: { compliance: Set<string>; retention: Set<string>; vv: Set<string>; integrations: Set<string> },
    droppedBySurfaceType: Record<string, string[]>,
  ): void {
    const s = (j as { surfaces?: Record<string, unknown> }).surfaces;
    if (!s || typeof s !== 'object') return;
    const filterArr = (key: string, acc: Set<string>, mergeAccepted?: Set<string>) => {
      const xs = Array.isArray((s as Record<string, unknown>)[key])
        ? (s as Record<string, string[]>)[key].filter(x => typeof x === 'string')
        : [];
      const kept: string[] = [];
      for (const x of xs) {
        if (acc.has(x) || mergeAccepted?.has(x)) kept.push(x);
        else droppedBySurfaceType[key].push(x);
      }
      (s as Record<string, string[]>)[key] = kept;
    };
    filterArr('compliance_regimes', accepted.compliance);
    filterArr('retention_rules', accepted.retention, accepted.compliance);
    filterArr('vv_requirements', accepted.vv);
    filterArr('integrations', accepted.integrations);
  }

  /**
   * Identify hallucinated persona references on a journey BEFORE mutating it —
   * `personaId`, `additionalPersonas[]`, and persona-shaped `steps[].actor`
   * refs not in the accepted set. Pure (no mutation). Extracted from
   * runJourneyBloom13a's `collectInvalidPersonaRefs` closure.
   */
  private collectInvalidPersonaRefs(
    j: Record<string, unknown>,
    acceptedPersonaIds: Set<string>,
    acceptedIntegrations: Set<string>,
  ): Array<{ id: string; where: string }> {
    const refs: Array<{ id: string; where: string }> = [];
    const journeyId = typeof j.id === 'string' ? j.id : '<unknown>';
    if (typeof j.personaId === 'string' && !acceptedPersonaIds.has(j.personaId)) {
      refs.push({ id: j.personaId, where: `${journeyId}.personaId` });
    }
    if (Array.isArray(j.additionalPersonas)) {
      for (const p of j.additionalPersonas) {
        if (typeof p === 'string' && !acceptedPersonaIds.has(p)) {
          refs.push({ id: p, where: `${journeyId}.additionalPersonas` });
        }
      }
    }
    refs.push(...this.collectInvalidStepActorRefs(j.steps, journeyId, acceptedPersonaIds, acceptedIntegrations));
    return refs;
  }

  /**
   * Apply `remapPersona` to a journey in place. Returns true on success;
   * false when the initiator persona is unrecoverable (caller drops the
   * journey). Extracted from runJourneyBloom13a's `applyRemap` closure.
   */
  private applyPersonaRemap(
    j: Record<string, unknown>,
    acceptedIntegrations: Set<string>,
    remapPersona: (raw: string, where: string) => string | null,
  ): boolean {
    const journeyId = typeof j.id === 'string' ? j.id : '<unknown>';
    if (typeof j.personaId === 'string') {
      const remapped = remapPersona(j.personaId, `${journeyId}.personaId`);
      if (!remapped) return false;
      j.personaId = remapped;
    }
    if (Array.isArray(j.additionalPersonas)) {
      const kept: string[] = [];
      for (const p of j.additionalPersonas) {
        if (typeof p !== 'string') continue;
        const remapped = remapPersona(p, `${journeyId}.additionalPersonas`);
        if (remapped) kept.push(remapped);
      }
      j.additionalPersonas = kept;
    }
    this.remapJourneyStepActors(j.steps, journeyId, acceptedIntegrations, remapPersona);
    return true;
  }

  /**
   * Per-journey persona-ref self-heal for 1.3a: filter the journey's surfaces
   * against the accepted sets, then repair hallucinated persona refs via
   * (1) per-journey LLM retry, (2) fuzzy-remap fallback, (3) drop. Threads the
   * shared cross-journey retry budget through `totalRetriesUsed`. Mutates the
   * journey, `droppedBySurfaceType`, and the log arrays in place. Returns the
   * repaired journey (or null when its initiator persona is unrecoverable)
   * plus the running retry total. Extracted from runJourneyBloom13a's
   * per-journey loop to keep it under the cognitive-complexity budget.
   */
  private async repairJourneyPersonaRefs(
    ctx: PhaseContext,
    journey: Record<string, unknown>,
    accepted: {
      personaIds: Set<string>;
      integrations: Set<string>;
      compliance: Set<string>;
      retention: Set<string>;
      vv: Set<string>;
      personas: Persona[];
    },
    droppedBySurfaceType: Record<string, string[]>,
    logs: {
      personaRemapLog: Array<{ from: string; to: string; where: string }>;
      personaDropLog: Array<{ id: string; where: string }>;
      personaRetryLog: Array<{ journey_id: string; from: string; to: string; outcome: string }>;
    },
    totalRetriesUsed: number,
  ): Promise<{ journey: Record<string, unknown> | null; totalRetriesUsed: number }> {
    const remapPersona = (raw: string, where: string): string | null =>
      this.remapPersonaAgainstAccepted(raw, where, accepted.personaIds, logs.personaRemapLog, logs.personaDropLog);
    this.filterJourneySurfaces(journey, accepted, droppedBySurfaceType);
    journey.acceptanceCriteria = normalizeAcceptanceCriteria(journey.acceptanceCriteria);
    const journeyId = typeof journey.id === 'string' ? journey.id : '<unknown>';

    // Step 1 — LLM retry per offending journey (most correct path).
    const loop = await this.retryJourneyPersonaFixLoop(
      ctx, journey, accepted, droppedBySurfaceType, logs.personaRetryLog, journeyId, totalRetriesUsed,
    );
    const j = loop.journey;
    totalRetriesUsed = loop.totalRetriesUsed;
    if (loop.invalidRefs.length > 0 && totalRetriesUsed >= TOTAL_RETRY_BUDGET) {
      logs.personaRetryLog.push({
        journey_id: journeyId,
        from: loop.invalidRefs.map(r => r.id).join(','),
        to: '',
        outcome: 'retry_budget_exhausted',
      });
    }

    // Step 2 — fuzzy-remap fallback for any residual invalid refs.
    if (!this.applyPersonaRemap(j, accepted.integrations, remapPersona)) {
      getLogger().warn('workflow', 'Phase 1.3a: dropping journey — personaId unrecoverable after retry + fuzzy-remap', {
        journey_id: journeyId,
        persona_id: (j as { personaId?: unknown }).personaId,
      });
      return { journey: null, totalRetriesUsed };
    }
    return { journey: j, totalRetriesUsed };
  }

  /**
   * Step 1 of the 1.3a persona self-heal: retry each offending journey via a
   * focused LLM call up to PER_JOURNEY_RETRY_BUDGET times (capped by the
   * cross-journey TOTAL_RETRY_BUDGET). Each attempt re-filters surfaces and
   * re-normalizes acceptanceCriteria and logs its outcome. Returns the latest
   * journey object, the residual invalid refs, and the running retry total.
   * Extracted from repairJourneyPersonaRefs to keep it under the complexity
   * budget; the former `if (fixed) {…} else {…break}` becomes a guard clause.
   */
  private async retryJourneyPersonaFixLoop(
    ctx: PhaseContext,
    journey: Record<string, unknown>,
    accepted: {
      personaIds: Set<string>;
      integrations: Set<string>;
      compliance: Set<string>;
      retention: Set<string>;
      vv: Set<string>;
      personas: Persona[];
    },
    droppedBySurfaceType: Record<string, string[]>,
    personaRetryLog: Array<{ journey_id: string; from: string; to: string; outcome: string }>,
    journeyId: string,
    totalRetriesUsed: number,
  ): Promise<{ journey: Record<string, unknown>; invalidRefs: Array<{ id: string; where: string }>; totalRetriesUsed: number }> {
    let j = journey;
    let invalidRefs = this.collectInvalidPersonaRefs(j, accepted.personaIds, accepted.integrations);
    let retriesForThisJourney = 0;
    while (invalidRefs.length > 0
      && retriesForThisJourney < PER_JOURNEY_RETRY_BUDGET
      && totalRetriesUsed < TOTAL_RETRY_BUDGET) {
      retriesForThisJourney++;
      totalRetriesUsed++;
      const fixed = await this.retryJourneyForPersonaFix(
        ctx, j, invalidRefs, accepted.personas, retriesForThisJourney,
      );
      if (!fixed) {
        personaRetryLog.push({
          journey_id: journeyId,
          from: invalidRefs.map(r => r.id).join(','),
          to: '',
          outcome: 'retry_call_failed',
        });
        break;
      }
      this.filterJourneySurfaces(fixed, accepted, droppedBySurfaceType);
      fixed.acceptanceCriteria = normalizeAcceptanceCriteria(fixed.acceptanceCriteria);
      j = fixed;
      const stillInvalid = this.collectInvalidPersonaRefs(j, accepted.personaIds, accepted.integrations);
      personaRetryLog.push({
        journey_id: journeyId,
        from: invalidRefs.map(r => r.id).join(','),
        to: typeof j.personaId === 'string' ? j.personaId : '?',
        outcome: stillInvalid.length === 0 ? 'fixed' : 'still_invalid',
      });
      invalidRefs = stillInvalid;
    }
    return { journey: j, invalidRefs, totalRetriesUsed };
  }

  /**
   * Collect hallucinated persona-id references from a journey's steps[].
   * A step.actor is invalid when it is persona-shaped (`P-` prefix) but
   * not in the accepted-persona set; `System` and accepted integration
   * ids are always valid. Extracted from runJourneyBloom13a's
   * collectInvalidPersonaRefs to keep it under the complexity budget;
   * behavior mirrors the former inline `if (Array.isArray(j.steps))` scan.
   */
  private collectInvalidStepActorRefs(
    steps: unknown,
    journeyId: string,
    acceptedPersonaIds: Set<string>,
    acceptedIntegrations: Set<string>,
  ): Array<{ id: string; where: string }> {
    const refs: Array<{ id: string; where: string }> = [];
    if (!Array.isArray(steps)) return refs;
    for (const stepRaw of steps) {
      if (!stepRaw || typeof stepRaw !== 'object') continue;
      const step = stepRaw as Record<string, unknown>;
      const actor = step.actor;
      if (typeof actor !== 'string') continue;
      if (actor === 'System' || acceptedIntegrations.has(actor)) continue;
      if (!actor.startsWith('P-')) continue;
      if (!acceptedPersonaIds.has(actor)) {
        refs.push({ id: actor, where: `${journeyId}.step#${step.stepNumber}.actor` });
      }
    }
    return refs;
  }

  /**
   * Fuzzy-remap persona-shaped step.actor values on a journey in place.
   * `System`, accepted integration ids, and non-`P-` actors are left
   * untouched; a persona-shaped actor is remapped via `remap`, falling
   * back to `System` when unrecoverable. Extracted from
   * runJourneyBloom13a's applyRemap to keep it under the complexity
   * budget; mirrors the former inline `if (Array.isArray(j.steps))` block.
   */
  private remapJourneyStepActors(
    steps: unknown,
    journeyId: string,
    acceptedIntegrations: Set<string>,
    remap: (raw: string, where: string) => string | null,
  ): void {
    if (!Array.isArray(steps)) return;
    for (const stepRaw of steps) {
      if (!stepRaw || typeof stepRaw !== 'object') continue;
      const step = stepRaw as Record<string, unknown>;
      const actor = step.actor;
      if (typeof actor !== 'string') continue;
      if (actor === 'System' || acceptedIntegrations.has(actor) || !actor.startsWith('P-')) continue;
      const remapped = remap(actor, `${journeyId}.step#${step.stepNumber}.actor`);
      step.actor = remapped ?? 'System';
    }
  }

  /**
   * 1.3a per-journey persona-fix retry. Fires one focused LLM call to
   * re-emit a single offending journey with strict instruction to use
   * only accepted persona ids. Returns the corrected journey object, or
   * null when the call fails or the LLM emits unparseable JSON.
   *
   * Invoked from runJourneyBloom13a's sanitizer when a journey carries
   * a personaId / additionalPersonas[] / step.actor that's not in the
   * accepted persona set. More correct than mechanical fuzzy-remapping
   * — the model picks the right initiator from context. Falls through
   * to fuzzy-remap when the retry budget is exhausted or also fails.
   */
  private async retryJourneyForPersonaFix(
    ctx: PhaseContext,
    journey: Record<string, unknown>,
    invalidRefs: ReadonlyArray<{ id: string; where: string }>,
    acceptedPersonas: Persona[],
    attempt: number,
  ): Promise<Record<string, unknown> | null> {
    const { engine } = ctx;
    const journeyId = typeof journey.id === 'string' ? journey.id : '<unknown>';
    const acceptedList = acceptedPersonas
      .map(p => `- ${p.id}: ${p.name}`)
      .join('\n');
    const offending = invalidRefs.map(r => `  - "${r.id}" at ${r.where}`).join('\n');
    const journeyJson = JSON.stringify(journey, null, 2);
    const prompt = `You are correcting a single user journey whose persona references include id(s) that aren't in the accepted set.

# Accepted personas (these are the ONLY valid persona ids; copy them verbatim — do not invent variants)

${acceptedList}

# Offending references in the journey

${offending}

# The journey to correct

${journeyJson}

# Your task

Re-emit this single journey as a JSON object that matches the original schema (id, personaId, additionalPersonas[], steps[], etc.) but with EVERY persona reference replaced by an id from the accepted set above. If a step's actor was a hallucinated persona id and no accepted persona fits the role, set the actor to "System" instead. Preserve every other field unchanged.

# JSON Output Contract (strict)

- Response is ONE JSON object — the corrected journey.
- No markdown fences, no prose before or after the JSON.
- Straight ASCII double quotes only.
- Every personaId / additionalPersonas[] entry / step.actor (when persona-shaped) MUST be one of: ${acceptedPersonas.map(p => p.id).join(', ')}, "System", or an integration id.`;
    try {
      const result = await engine.callForRole('domain_interpreter', {
        prompt,
        responseFormat: 'json',
        temperature: 0.3,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: 'user_journey_bloom',
          agentRole: 'domain_interpreter',
          label: `Phase 1.3a — persona-fix retry attempt ${attempt} for ${journeyId}`,
        },
      });
      const parsed = this.safeParseJson(result);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      // Preserve the original journey id when the model drops or
      // reshapes it — we are correcting THIS journey, not generating
      // a new one. Surfaces / acceptanceCriteria normalization is
      // re-applied by the caller after this returns.
      if (typeof parsed.id !== 'string' && typeof journey.id === 'string') {
        parsed.id = journey.id;
      }
      return parsed;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1.3a: persona-fix retry call failed', {
        journey_id: journeyId,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Self-heal one raw workflow from the 1.3b bloom against the accepted-id
   * sets: normalize it, filter its triggers/surfaces to accepted refs, and
   * drop it (returning null) when it has zero valid triggers or an
   * unaccepted business domain. The `dropped*` arrays are appended in place
   * so the caller can log the aggregate drop reasons. Extracted from
   * runWorkflowBloom13b to keep that method's cognitive complexity bounded;
   * behavior is identical (the two `return null` paths mirror the former
   * `continue` statements).
   */
  private buildFilteredWorkflowV2(
    raw: Record<string, unknown>,
    accepted: {
      journeyIds: Set<string>;
      stepCountByJourney: Map<string, number>;
      compliance: Set<string>;
      retention: Set<string>;
      vv: Set<string>;
      integrations: Set<string>;
      domains: Set<string>;
    },
    dropped: { triggers: string[]; workflows: string[]; surfaces: string[] },
  ): WorkflowV2 | null {
    const w = this.normalizeWorkflowV2(raw);
    // Filter triggers against accepted sets. A journey_step trigger is
    // valid if the journey is accepted AND the step_number is within
    // the journey's steps. Compliance/integration triggers must point
    // at accepted ids. Schedule/event triggers carry no id refs and
    // always pass.
    const keptTriggers = w.triggers.filter(t =>
      isWorkflowTriggerAccepted(t, w.id, {
        journeyIds: accepted.journeyIds,
        stepCountByJourney: accepted.stepCountByJourney,
        compliance: accepted.compliance,
        integrations: accepted.integrations,
      }, dropped.triggers));
    // A workflow with zero valid triggers can't exist — drop it.
    if (keptTriggers.length === 0) {
      dropped.workflows.push(w.id);
      return null;
    }
    // Re-derive backs_journeys from the filtered trigger set.
    const derivedBacks = Array.from(new Set(keptTriggers
      .filter((t): t is Extract<WorkflowTrigger, { kind: 'journey_step' }> => t.kind === 'journey_step')
      .map(t => t.journey_id)));
    // Filter surfaces[*] against accepted sets.
    const raws = (raw as { surfaces?: Record<string, unknown> }).surfaces;
    const surfaces = {
      compliance_regimes: filterAcceptedSurfaces(raws, w.id, 'compliance_regimes', accepted.compliance, dropped.surfaces),
      retention_rules:    filterAcceptedSurfaces(raws, w.id, 'retention_rules', accepted.retention, dropped.surfaces, accepted.compliance),
      vv_requirements:    filterAcceptedSurfaces(raws, w.id, 'vv_requirements', accepted.vv, dropped.surfaces),
      integrations:       filterAcceptedSurfaces(raws, w.id, 'integrations', accepted.integrations, dropped.surfaces),
    };
    // Drop workflows whose businessDomainId is not accepted (another
    // referential-integrity class — the verifier would block on this
    // but the self-heal approach is to drop with WARN instead).
    if (!accepted.domains.has(w.businessDomainId)) {
      dropped.workflows.push(w.id);
      dropped.triggers.push(`${w.id}:domain:${w.businessDomainId}:domain-not-accepted`);
      return null;
    }
    return {
      ...w,
      triggers: keptTriggers,
      backs_journeys: derivedBacks,
      // Re-attach filtered surfaces (casting — surfaces aren't in
      // WorkflowV2's public type yet, but are set on the content record
      // via the cast-through from raw LLM output).
      ...(raws ? { surfaces } as unknown as Partial<WorkflowV2> : {}),
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
    const template = engine.templateLoader.findTemplate('domain_interpreter', 'system_workflow_bloom', 'product');
    if (!template) throw new Error('1.3b system_workflow_bloom product-lens template not found');
    const rendered = engine.templateLoader.render(template, {
      accepted_journeys: this.formatJourneysWithSteps(inputs.acceptedJourneys),
      accepted_personas: this.formatPersonas(inputs.acceptedPersonas),
      accepted_domains: this.formatDomains(inputs.acceptedDomains),
      compliance_regimes: this.formatExtractedItemsWithIds(inputs.complianceItems),
      retention_rules: this.formatExtractedItemsWithIds(inputs.retentionRules),
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
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '1', subPhaseId: 'system_workflow_bloom', agentRole: 'domain_interpreter', label: 'Phase 1.3b — System Workflow Bloom' },
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
      const built = this.buildFilteredWorkflowV2(
        raw,
        {
          journeyIds: acceptedJourneyIds,
          stepCountByJourney,
          compliance: acceptedCompliance,
          retention: acceptedRetention,
          vv: acceptedVV,
          integrations: acceptedIntegrations,
          domains: acceptedDomains,
        },
        { triggers: droppedTriggers, workflows: droppedWorkflows, surfaces: droppedSurfaces },
      );
      if (built) workflows.push(built);
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
    // Fail loud when the LLM hallucinated so heavily that fewer than half
    // its proposed workflows survive the deterministic filter — the
    // current artifact would be empty or sparse, and a silent prune
    // hides that the producer needs to be re-run with corrected input
    // (or, more often, that the LLM ignored the accepted-domains list).
    // Threshold is conservative: only the >50%-drop case escalates.
    // The historical ts-12 / ts-13 system_workflow_bloom drops were
    // both 100% — those would have caught this loudly instead of
    // silently producing `workflows: []`.
    const totalProposed = workflows.length + droppedWorkflows.length;
    if (totalProposed > 0 && droppedWorkflows.length / totalProposed > 0.5) {
      const ratioPct = Math.round((droppedWorkflows.length / totalProposed) * 100);
      throw new Error(
        `Phase 1.3b system_workflow_bloom: ${droppedWorkflows.length}/${totalProposed} (${ratioPct}%) ` +
        `proposed workflows dropped because their business_domain_id is not in the accepted_domains set ` +
        `or all their triggers reference non-accepted ids. The LLM is hallucinating downstream references. ` +
        `Check accepted_domains rendering in the prompt; verify the producer is seeing the right domain list. ` +
        `Dropped workflow ids: ${droppedWorkflows.slice(0, 10).join(', ')}${droppedWorkflows.length > 10 ? '…' : ''}`,
      );
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
      vvRequirements: VVRequirement[];
      technicalConstraints: TechnicalConstraint[];
      qualityAttributes: string[];
    },
    feedback: string,
  ): Promise<{ releases: ReleaseV2[]; crossCutting: CrossCuttingContents }> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('orchestrator', 'release_plan', 'product');
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
        subPhaseId: 'release_plan',
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
      vvRequirementIds: inputs.vvRequirements.map(v => v.id),
      technicalConstraintIds: inputs.technicalConstraints.map(t => t.id),
      // QA-N ids are the synthetic indices used at the 1.5 gate
      // (`buildQaItems` in this file). Regenerated here so the ids
      // match what the gate review presented and what NFR roots will
      // cite in `traces_to`.
      qualityAttributeIds: inputs.qualityAttributes.map((_q, i) => `QA-${i + 1}`),
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
    // Delegated to the extracted pure-function module so the dual-shape
    // (snake_case / camelCase) tolerance is unit-tested in isolation.
    // See phase1Normalizers.ts and feedback_normalizer_case_dual_keys.md.
    return normalizeWorkflowV2Pure(w);
  }

  private normalizeWorkflowTrigger(t: Record<string, unknown>): WorkflowTrigger | null {
    return normalizeWorkflowTriggerPure(t);
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
    return vvs.map(v => {
      const thresholdSuffix = v.threshold ? ` (threshold: ${v.threshold})` : '';
      return `- **${v.id}** (${v.category}): ${v.target} — ${v.measurement}${thresholdSuffix}`;
    }).join('\n');
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

  /**
   * Apply deterministic mitigations to a freshly-proposed bloom artifact
   * based on the reasoning-review harness findings that fired against it.
   * Mutates `bloom` in place. No-op when policy != 'auto' or no findings
   * have machine-resolvable targets.
   *
   * See study/auto-mitigation-design.md for the v1 scope (drop only,
   * gated to spec_boundary_respect_bloom).
   */
  private runAutoMitigation(
    ctx: PhaseContext,
    subPhaseId: string,
    bloom: Record<string, unknown>,
  ): void {
    const cfg = ctx.engine.configManager.get();
    const policy = cfg.workflow.auto_mitigation_policy ?? 'disabled';
    if (policy !== 'auto') return;

    const { findings, findingRecordIds, harnessRecordId } = loadMostRecentFindings(
      ctx.engine.db,
      ctx.workflowRun.id,
      subPhaseId,
    );
    if (findings.length === 0 || !harnessRecordId) return;

    const engine = new MitigationEngine();
    const result = engine.apply(findings, bloom, {
      writer: ctx.engine.writer,
      workflowRunId: ctx.workflowRun.id,
      phaseId: '1',
      subPhaseId,
      janumiCodeVersionSha: ctx.engine.janumiCodeVersionSha,
      // We haven't written the bloom artifact yet — cite the harness
      // record as the immediate parent. Once the bloom artifact lands
      // its id flows downstream via derived_from_record_ids on later
      // records, preserving the trace.
      sourceArtifactRecordId: harnessRecordId,
      findingRecordIds,
    });

    if (result.actionsApplied.length > 0) {
      getLogger().info('workflow', 'Auto-mitigation applied to bloom', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: subPhaseId,
        actions_applied: result.actionsApplied.length,
        findings_skipped: result.findingsSkipped,
      });
    }
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

/**
 * Normalize an LLM-emitted `acceptanceCriteria` value to string[].
 * The journey-bloom prompt asks for `string[]` but qwen-3.5:9b
 * (cal-22) returned a bare string for some journeys. Earlier runs
 * may also produce arrays of objects when the model embeds
 * measurable conditions. Coerce all shapes to a plain string[] so
 * the persisted UserJourney shape matches its TypeScript contract.
 */
/**
 * Find the closest accepted persona id when the LLM emitted a near-name
 * variant (e.g. "P-HOA-BOARD-MANAGER" instead of accepted
 * "P-HOA-BOARD-MEMBER"). Strategy:
 *   1. Token-overlap match — if the candidate shares all tokens except
 *      one, it's almost certainly the same persona under a different
 *      name. This catches the cal-23 manager/member case.
 *   2. Levenshtein-bounded match — fall back to edit-distance ≤ 4 when
 *      tokens don't align cleanly (e.g. typos, suffix variants).
 * Returns null when no accepted persona is within either threshold.
 */
function nearestAcceptedPersona(raw: string, accepted: readonly string[]): string | null {
  if (accepted.length === 0) return null;
  const rawTokens = new Set(raw.toUpperCase().split(/[-_\s]+/).filter(Boolean));
  // Token-overlap pass: best match shares all-but-one token.
  let bestByTokens: { id: string; overlap: number; missing: number } | null = null;
  for (const a of accepted) {
    const aTokens = new Set(a.toUpperCase().split(/[-_\s]+/).filter(Boolean));
    let overlap = 0;
    for (const t of rawTokens) if (aTokens.has(t)) overlap++;
    const missing = Math.abs(rawTokens.size - aTokens.size) + (rawTokens.size - overlap);
    if (overlap >= Math.max(1, rawTokens.size - 1)
      && (!bestByTokens || overlap > bestByTokens.overlap || missing < bestByTokens.missing)) {
      bestByTokens = { id: a, overlap, missing };
    }
  }
  if (bestByTokens) return bestByTokens.id;
  // Levenshtein fallback.
  let bestById: { id: string; distance: number } | null = null;
  for (const a of accepted) {
    const d = levenshtein(raw.toUpperCase(), a.toUpperCase());
    if (d <= 4 && (!bestById || d < bestById.distance)) bestById = { id: a, distance: d };
  }
  return bestById?.id ?? null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Phase 1.8 deterministic auto-fix for `release_backward_dependency`
 * verifier failures. When the LLM places a workflow in an earlier
 * release than one of its trigger targets, move the workflow forward
 * to the latest release that contains any of its trigger targets.
 *
 * Mutates `plan` in place: removes each offending workflow from its
 * source release's `contains.workflows`, removes it from
 * `cross_cutting.workflows` if present, and pushes it onto the target
 * release's `contains.workflows`. Idempotent — running on a clean plan
 * is a no-op. Safe under shared-array invariants because both source
 * and target are arrays we own (release contents).
 *
 * Cross-cutting workflows whose triggers include release-specific
 * targets are also auto-fixed: the workflow is demoted from
 * `cross_cutting` to the latest target release, since a workflow
 * whose triggers fire only in some releases doesn't truly span all.
 *
 * Returns a per-workflow log of what was moved (for the WARN line).
 */
export function autoFixBackwardDependencies(
  plan: ReleasePlanContentV2,
  workflows: WorkflowV2[],
  journeys: UserJourney[],
): Array<{ workflow_id: string; from: string; to: string; reason: string }> {
  const fixes: Array<{ workflow_id: string; from: string; to: string; reason: string }> = [];
  // id → ordinal lookup (cross_cutting → -Infinity) and workflow → its
  // current placement, so applyBackwardDependencyFix can find each source
  // release fast. ordinalOf is mutated as workflows move so subsequent
  // iterations see the new placement.
  const ordinalOf = buildReleaseOrdinalLookup(plan);
  const journeyIdSet = new Set(journeys.map(j => j.id));
  const workflowPlacementSource = buildWorkflowPlacementSource(plan);

  for (const w of workflows) {
    const fix = applyBackwardDependencyFix(w, plan, ordinalOf, workflowPlacementSource, journeyIdSet);
    if (fix) fixes.push(fix);
  }
  return fixes;
}

/**
 * Build the id → release-ordinal lookup used by the 1.8 backward-dependency
 * auto-fix. cross_cutting members map to -Infinity (never block anything),
 * matching verifyReleaseManifest's mapping exactly. Extracted from
 * autoFixBackwardDependencies to keep it under the complexity budget.
 */
function buildReleaseOrdinalLookup(plan: ReleasePlanContentV2): Map<string, number> {
  const ordinalOf = new Map<string, number>();
  for (const r of plan.releases) {
    for (const id of r.contains.journeys) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.workflows) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.compliance) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.integrations) ordinalOf.set(id, r.ordinal);
  }
  for (const id of plan.cross_cutting.workflows) ordinalOf.set(id, -Infinity);
  for (const id of plan.cross_cutting.compliance) ordinalOf.set(id, -Infinity);
  for (const id of plan.cross_cutting.integrations) ordinalOf.set(id, -Infinity);
  return ordinalOf;
}

/**
 * Build a workflow id → current placement (release object or 'cross_cutting')
 * map. Extracted from autoFixBackwardDependencies to keep it under the
 * complexity budget.
 */
function buildWorkflowPlacementSource(plan: ReleasePlanContentV2): Map<string, ReleaseV2 | 'cross_cutting'> {
  const workflowPlacementSource = new Map<string, ReleaseV2 | 'cross_cutting'>();
  for (const r of plan.releases) {
    for (const wid of r.contains.workflows) workflowPlacementSource.set(wid, r);
  }
  for (const wid of plan.cross_cutting.workflows) workflowPlacementSource.set(wid, 'cross_cutting');
  return workflowPlacementSource;
}

/**
 * Move one workflow forward if its triggers reference targets in a later
 * release than its current placement. Mutates `plan` (removes the workflow
 * from its source, adds it to the target release) and `ordinalOf` in place,
 * and returns a fix log entry — or null when no move is needed. Extracted
 * from autoFixBackwardDependencies to keep it under the complexity budget;
 * each former `continue` becomes an early `return null`.
 */
function applyBackwardDependencyFix(
  w: WorkflowV2,
  plan: ReleasePlanContentV2,
  ordinalOf: Map<string, number>,
  workflowPlacementSource: Map<string, ReleaseV2 | 'cross_cutting'>,
  journeyIdSet: Set<string>,
): { workflow_id: string; from: string; to: string; reason: string } | null {
  const wfPlacement = workflowPlacementSource.get(w.id);
  if (wfPlacement === undefined) return null; // not placed; coverage check reports it
  const wfOrd = wfPlacement === 'cross_cutting' ? -Infinity : wfPlacement.ordinal;

  // Compute the maximum trigger-target ordinal. Targets that are
  // cross_cutting (-Infinity) don't constrain placement; targets
  // not present in ordinalOf are coverage failures (ignored here).
  const maxTargetOrd = computeMaxTargetOrdinal(w.triggers, ordinalOf, journeyIdSet);

  if (maxTargetOrd === -Infinity) return null; // no constraining targets
  if (typeof wfOrd === 'number' && wfOrd >= maxTargetOrd && wfOrd !== -Infinity) return null; // already satisfies

  const targetRelease = plan.releases.find(r => r.ordinal === maxTargetOrd);
  if (!targetRelease) return null; // shouldn't happen; bail safely

  // Remove from current placement.
  if (wfPlacement === 'cross_cutting') {
    plan.cross_cutting.workflows = plan.cross_cutting.workflows.filter(id => id !== w.id);
  } else {
    wfPlacement.contains.workflows = wfPlacement.contains.workflows.filter(id => id !== w.id);
  }
  // Add to target release (dedupe just in case).
  if (!targetRelease.contains.workflows.includes(w.id)) {
    targetRelease.contains.workflows.push(w.id);
  }
  // Update ordinalOf so subsequent iterations see the new placement.
  ordinalOf.set(w.id, targetRelease.ordinal);

  return {
    workflow_id: w.id,
    from: wfPlacement === 'cross_cutting' ? 'cross_cutting' : `REL-ord=${wfPlacement.ordinal}`,
    to: `REL-ord=${targetRelease.ordinal}`,
    reason: `triggers reference targets up to REL-ord=${maxTargetOrd}`,
  };
}

function normalizeAcceptanceCriteria(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return v.length > 0 ? [v] : [];
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && item.length > 0) {
      out.push(item);
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const text = (o.description ?? o.text ?? o.title ?? o.criterion) as string | undefined;
      if (typeof text === 'string' && text.length > 0) out.push(text);
    }
  }
  return out;
}

/**
 * Decide whether a single workflow trigger references an accepted target.
 * Extracted from runWorkflowBloom13b's trigger-filter callback so that
 * loop's cognitive complexity stays under threshold. Behaviour is
 * identical: journey_step triggers require an accepted journey with an
 * in-range step; compliance/integration triggers require accepted ids;
 * schedule/event triggers always pass. Rejected triggers push a reason
 * onto `droppedTriggers` (same array reference the caller reads).
 */
function isWorkflowTriggerAccepted(
  t: WorkflowTrigger,
  wId: string,
  accepted: {
    journeyIds: Set<string>;
    stepCountByJourney: Map<string, number>;
    compliance: Set<string>;
    integrations: Set<string>;
  },
  droppedTriggers: string[],
): boolean {
  if (t.kind === 'journey_step') {
    if (!accepted.journeyIds.has(t.journey_id)) {
      droppedTriggers.push(`${wId}:journey_step:${t.journey_id}#${t.step_number}:journey-not-accepted`);
      return false;
    }
    const n = accepted.stepCountByJourney.get(t.journey_id) ?? 0;
    if (t.step_number < 1 || t.step_number > n) {
      droppedTriggers.push(`${wId}:journey_step:${t.journey_id}#${t.step_number}:step-out-of-range`);
      return false;
    }
    return true;
  }
  if (t.kind === 'compliance') {
    if (!accepted.compliance.has(t.regime_id)) {
      droppedTriggers.push(`${wId}:compliance:${t.regime_id}:regime-not-accepted`);
      return false;
    }
    return true;
  }
  if (t.kind === 'integration') {
    if (!accepted.integrations.has(t.integration_id)) {
      droppedTriggers.push(`${wId}:integration:${t.integration_id}:integration-not-accepted`);
      return false;
    }
    return true;
  }
  return true; // schedule, event
}

/**
 * Filter a workflow's raw surface id list against an accepted-id set.
 * Extracted from runWorkflowBloom13b's per-workflow loop so that loop's
 * cognitive complexity stays under threshold. Behaviour is identical: only
 * string entries present in `accepted` (or the optional `mergeAccepted`
 * set) are kept; every rejected id is recorded on `droppedSurfaces` (the
 * same array reference the caller reads) as `${workflowId}:${key}:${id}`.
 */
function filterAcceptedSurfaces(
  raws: Record<string, unknown> | undefined,
  workflowId: string,
  key: string,
  accepted: Set<string>,
  droppedSurfaces: string[],
  mergeAccepted?: Set<string>,
): string[] {
  const xs = (raws && Array.isArray(raws[key]))
    ? (raws[key] as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const kept: string[] = [];
  for (const x of xs) {
    if (accepted.has(x) || mergeAccepted?.has(x)) kept.push(x);
    else droppedSurfaces.push(`${workflowId}:${key}:${x}`);
  }
  return kept;
}

/**
 * Compute the maximum constraining release ordinal across a workflow's
 * triggers. Extracted from autoFixBackwardDependencies to keep that
 * function's cognitive complexity under threshold. Targets that are
 * cross_cutting (-Infinity), unknown to `ordinalOf`, or (for journey_step)
 * not a known accepted journey do not constrain placement, matching the
 * original inline logic exactly. Returns -Infinity when nothing constrains.
 */
function computeMaxTargetOrdinal(
  triggers: WorkflowTrigger[],
  ordinalOf: Map<string, number>,
  journeyIdSet: Set<string>,
): number {
  let maxTargetOrd = -Infinity;
  for (const t of triggers) {
    let target: string | undefined;
    if (t.kind === 'journey_step') target = t.journey_id;
    else if (t.kind === 'compliance') target = t.regime_id;
    else if (t.kind === 'integration') target = t.integration_id;
    if (target === undefined) continue;
    const o = ordinalOf.get(target);
    // undefined = unknown target (coverage check reports it);
    // -Infinity = cross_cutting target (doesn't constrain placement).
    if (o === undefined || o === -Infinity) continue;
    // For journey_step triggers, double-check the journey is
    // actually a known accepted journey — guards against stale
    // references that survived earlier filtering.
    if (t.kind === 'journey_step' && !journeyIdSet.has(t.journey_id)) continue;
    if (o > maxTargetOrd) maxTargetOrd = o;
  }
  return maxTargetOrd;
}


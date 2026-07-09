/**
 * Deep Memory Research Agent — multi-stage context reconstruction.
 * Based on JanumiCode Spec v2.3, §8.4.
 *
 * Seven-stage process:
 *   1. Query Decomposition           — deterministic (ID-token extraction; no LLM call)
 *   2. Broad Candidate Harvest        — FTS5 + vector similarity + graph traversal
 *   3. Materiality Scoring            — real semantic similarity, temporal recency, causal relevance
 *   4. Relationship Expansion         — memory_edge traversal
 *   5. Supersession Analysis          — deterministic via `supersedes`/`contradicts` edges
 *   6. Gap Detection                  — scope-tier availability + unavailable sources
 *   7. Context Packet Synthesis       — LLM call (template-driven) + deterministic fallback
 *
 * Always complete — no "fast mode". When completeness cannot be achieved,
 * that fact is surfaced in the Context Packet.
 *
 * Records produced in the governed stream:
 *   - retrieval_brief_record       (input, recorded on invocation)
 *   - query_decomposition_record   (Stage 1 output)
 *   - context_packet               (Stage 7 output)
 */

import type { Database } from '../database/init';
import type { LLMCaller } from '../llm/llmCaller';
import type { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import type { TemplateLoader } from '../orchestrator/templateLoader';
import type { EmbeddingService } from '../embedding/embeddingService';
import { cosineSimilarity } from '../embedding/embeddingService';
import { getLogger } from '../logging';
import { classifyGoverningKind, type GoverningClass } from './governingClassification';
import type { DmrPipelineContent, DmrStageEntry } from '../types/records';
import {
  buildAuthorityElevationIndex,
  effectiveAuthorityLevel,
  type AuthorityElevationIndex,
} from '../orchestrator/effectiveAuthority';

const DMR_STAGE_NAMES: Record<number, string> = {
  1: 'Query Decomposition',
  2: 'Broad Candidate Harvest',
  3: 'Materiality Scoring',
  4: 'Relationship Expansion',
  5: 'Supersession Analysis',
  6: 'Gap Detection',
  7: 'Context Packet Synthesis',
};

const DMR_STAGE_KINDS: Record<number, DmrStageEntry['kind']> = {
  // Stage 1 is deterministic: `decomposeQuery` makes NO LLM call (the prior
  // qwen3.5:9b decomposition was removed — see decomposeQuery header). The
  // only remaining LLM stage is Stage 7 synthesis.
  1: 'deterministic',
  2: 'deterministic',
  3: 'deterministic',
  4: 'deterministic',
  5: 'deterministic',
  6: 'deterministic',
  7: 'llm',
};

/**
 * Pure-plumbing record types excluded entirely from FTS/vector harvest.
 * These carry no semantic content worth retrieving on — they're error
 * envelopes, timing markers, and presentation echoes.
 *
 * `agent_invocation`, `agent_output`, `agent_reasoning_step`, and the
 * reasoning_review_* types are NOT in this list — they carry the agent
 * reasoning trail that the system uses for intent-fidelity / drift
 * detection (spec §1.5 invariant CI-10: "the Governed Stream is
 * lossless"). They're harvested into the candidate pool but
 * down-weighted in materiality scoring via REASONING_TRAIL_MULTIPLIER
 * so the default Context Packet surfaces governing artifacts first
 * while audit-style consumers can still reach them.
 */
const HARVEST_PLUMBING_EXCLUDE = [
  'json_repair_record',
  'file_system_write_record',
  'mirror_presented',
  'decision_bundle_presented',
  'execution_wave_started',
  'execution_wave_completed',
  'workflow_run_closure',
];

/**
 * Reasoning-trail records — included in harvest but materiality is
 * multiplied by REASONING_TRAIL_MULTIPLIER before threshold check.
 * Effect: in the default Context Packet, governing artifacts crowd out
 * raw transcripts; an audit consumer lowering materialityThreshold or
 * supplying known_relevant_record_ids surfaces them.
 */
const REASONING_TRAIL_RECORD_TYPES = new Set<string>([
  'agent_invocation',
  'agent_output',
  'agent_reasoning_step',
  'reasoning_review_finding_record',
  'reasoning_review_harness_record',
]);

const REASONING_TRAIL_MULTIPLIER = 0.4;

/**
 * Record types that are JanumiCode's own PROCESS-GOVERNANCE operating model
 * (constitutional invariants: "agents never exercise judgment", "every phase
 * gate requires human approval", "the governed stream is lossless"). They are
 * authority-7 and therefore dominate the authority-weighted materiality score,
 * but they are never relevant to a CODE-EXECUTOR task — they describe how
 * JanumiCode runs, not what to build. For `executor_agent` requests they are
 * excluded so the task's own technical artifacts (component contract, data
 * models, tests) surface instead. Genuine governing TECH constraints are
 * separate record types (artifacts / technical_constraints_discovery) and are
 * NOT excluded.
 */
const EXECUTOR_IRRELEVANT_RECORD_TYPES = new Set<string>([
  'constitutional_invariant',
]);

// ── Types ───────────────────────────────────────────────────────────

export type ScopeTier = 'current_run' | 'all_runs' | 'all_runs_plus_external';
export type CompletenessStatus = 'complete' | 'partial_low' | 'partial_medium' | 'incomplete_high';

export interface RetrievalBrief {
  requestingAgentRole: string;
  scopeTier: ScopeTier;
  query: string;
  knownRelevantRecordIds: string[];
  workflowRunId: string;
  phaseId: string;
  subPhaseId: string;
  /**
   * Optional component this request is scoped to (e.g. a per-leaf executor
   * DMR sets it to the leaf's `component_id`). When present, structured
   * artifact findings (component_model / data_models / interface_contracts /
   * api_definitions) are distilled to THAT component's governing detail in the
   * Context Packet instead of the whole project — see `distillContentSummary`.
   */
  focusComponentId?: string;
}

export interface ContextPacket {
  queryDecomposition: {
    topicEntities: string[];
    decisionTypesSought: string[];
    temporalScope: { from: string; to: string };
    authorityLevelsIncluded: number[];
    sourcesInScope: string[];
    /** Spec §8.4 Stage 1 field. Populated by deterministic decomposition;
     *  currently always empty — conflict-zone detection requires
     *  governed-stream inspection that the current direct-LLM-API DMR
     *  architecture cannot perform. Surfaced empty for spec conformance
     *  and audit-shape stability. */
    knownConflictZones: string[];
  };
  completenessStatus: CompletenessStatus;
  /** Spec §8.4 Stage 7 output: narrative summary of governing decisions,
   *  with every claim citing a source record ID. Produced by Stage 7's
   *  LLM synthesis when available; falls back to a deterministic summary
   *  derived from active_constraints when synthesis is unavailable or
   *  the LLM omits the field. Distinct from `completenessNarrative`
   *  (which describes what was found / what is missing). */
  decisionContextSummary: string;
  completenessNarrative: string;
  unavailableSources: UnavailableSource[];
  materialFindings: MaterialFinding[];
  activeConstraints: ActiveConstraint[];
  supersessionChains: SupersessionChain[];
  contradictions: Contradiction[];
  openQuestions: OpenQuestion[];
  implicitDecisions: ImplicitDecision[];
  recommendedDrilldowns: { targetRecordId: string; reason: string }[];
  coverageAssessment: {
    sourcesQueried: string[];
    sourcesUnavailable: string[];
    knownGaps: string[];
    confidence: number;
  };
}

export interface UnavailableSource {
  source: string;
  reason: string;
  materiality: 'high' | 'medium' | 'low';
  materialityExplanation: string;
  recommendation: 'delay' | 'proceed_with_caveat' | 'proceed';
}

export interface MaterialFinding {
  id: string;
  recordType: string;
  authorityLevel: number;
  governingStatus: 'active' | 'superseded' | 'contradicted' | 'unresolved';
  summary: string;
  sourceRecordIds: string[];
  materialityScore: number;
  /** Optional per-dimension scores — surfaced for diagnosability. */
  materialityBreakdown?: {
    semanticSimilarity: number;
    constraintRelevance: number;
    authorityScore: number;
    temporalRecency: number;
    causalRelevance: number;
    contradictionSignal: number;
  };
}

export interface ActiveConstraint {
  id: string;
  statement: string;
  authorityLevel: number;
  sourceRecordIds: string[];
  /**
   * Whether this certified record is a NORMATIVE rule (`binding`) or
   * authoritative reference (`certified_context`). Authority >= 6 admits a
   * record into this set; `bindingClass` is the second axis that decides whether
   * it is "apply without exception" (binding) vs "build within this, do not
   * contradict" (context). See {@link classifyGoverningKind}.
   */
  bindingClass: GoverningClass;
}

export interface SupersessionChain {
  subject: string;
  // `summary` carries the distilled CONTENT of each link so the chain conveys
  // WHAT changed (e.g. "delete-by-key endpoint REMOVED"), not just that record
  // X superseded record Y. Without it a consumer sees only ids/positions.
  chain: { recordId: string; position: string; timestamp: string; summary: string }[];
}

export interface Contradiction {
  recordIds: string[];
  explanation: string;
  resolutionStatus: 'unresolved' | 'resolved_by_recency' | 'resolved_by_authority';
  resolvedByRecordId?: string;
}

export interface OpenQuestion {
  question: string;
  firstRaised: string;
  stillUnresolved: boolean;
  sourceRecordId: string;
}

export interface ImplicitDecision {
  inferredDecision: string;
  basis: string;
  confidence: number;
  sourceRecordIds: string[];
}

export interface MaterialityWeights {
  semantic_similarity: number;
  constraint_relevance: number;
  authority_level: number;
  temporal_recency: number;
  causal_relevance: number;
  contradiction_signal: number;
}

export interface DMRConfig {
  /** Model to use for LLM calls (Stage 1 decomposition + Stage 7 synthesis). */
  model?: string;
  /** Provider name for LLM calls. */
  provider?: string;
  /**
   * Optional provider base URL — only honored by providers that
   * support per-call URL routing (currently `llamacpp`). Lets the
   * orchestrator point DMR at a specific llama-server instance.
   * Without this, llama.cpp users discovered DMR was silently
   * falling back to the LlamaCppProvider's constructor default
   * (LLAMACPP_URL or 127.0.0.1:11435), which is fine when there's
   * one server but breaks multi-server harness setups.
   */
  baseUrl?: string;
  /** JanumiCode version SHA — stamped on records we write. */
  janumiCodeVersionSha: string;
  /** Materiality scoring threshold — findings below are dropped in Stage 7. */
  materialityThreshold?: number;
  /** Temporal half-life in days for recency scoring (default 30). */
  temporalHalfLifeDays?: number;
  /** Max candidates returned from FTS5 harvest (default 100). */
  maxFtsCandidates?: number;
  /** Max candidates returned from vector harvest (default 50). */
  maxVectorCandidates?: number;
  /** Max depth for causal relevance traversal (default 3). */
  maxCausalDepth?: number;
}

// ── DeepMemoryResearchAgent ─────────────────────────────────────────

export class DeepMemoryResearchAgent {
  private readonly materialityThreshold: number;
  private readonly temporalHalfLifeDays: number;
  private readonly maxFtsCandidates: number;
  private readonly maxVectorCandidates: number;
  private readonly maxCausalDepth: number;
  /** Model is optional at construction (lets tests instantiate without
   * touching LLM-call paths); validated lazily at the first LLM call so
   * production callers must resolve it via ConfigManager.getRoutingModel
   * rather than relying on a hardcoded literal here. */
  private readonly model: string | undefined;
  private readonly provider: string;
  private readonly baseUrl: string | undefined;

  constructor(
    private readonly db: Database,
    private readonly llmCaller: LLMCaller,
    private readonly weights: MaterialityWeights,
    private readonly config: DMRConfig = { janumiCodeVersionSha: 'dev' },
    private readonly templateLoader?: TemplateLoader,
    private readonly embedding?: EmbeddingService,
    private readonly writer?: GovernedStreamWriter,
  ) {
    this.materialityThreshold = config.materialityThreshold ?? 0.3;
    this.temporalHalfLifeDays = config.temporalHalfLifeDays ?? 30;
    this.maxFtsCandidates = config.maxFtsCandidates ?? 100;
    this.maxVectorCandidates = config.maxVectorCandidates ?? 50;
    this.maxCausalDepth = config.maxCausalDepth ?? 3;
    this.model = config.model;
    this.provider = config.provider ?? 'llamacpp';
    this.baseUrl = config.baseUrl;
  }

  /**
   * Execute the full seven-stage research process.
   *
   * When `writer` is attached, this also writes:
   *   - `retrieval_brief_record` on entry
   *   - `query_decomposition_record` after Stage 1
   *   - `context_packet` after Stage 7
   */
  async research(brief: RetrievalBrief): Promise<ContextPacket> {
    // Build a per-stage journal as we go. Stages 2–6 are deterministic
    // and previously emitted no governed-stream records, so the UI saw
    // only Stage 1 and Stage 7 cards and the pipeline looked like it
    // jumped 1 → 7. We now emit a single `dmr_pipeline` container
    // record at the end with status + timing + output pointers for
    // all 7 stages so the whole run is legible as one card.
    const stages: DmrStageEntry[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      stage: n as DmrStageEntry['stage'],
      name: DMR_STAGE_NAMES[n],
      kind: DMR_STAGE_KINDS[n],
      status: 'pending',
      started_at: null,
      completed_at: null,
    }));
    const markStart = (n: number): void => {
      const entry = stages[n - 1];
      entry.status = 'running';
      entry.started_at = new Date().toISOString();
    };
    const markDone = (n: number, patch: Partial<DmrStageEntry>): void => {
      const entry = stages[n - 1];
      entry.status = 'completed';
      entry.completed_at = new Date().toISOString();
      Object.assign(entry, patch);
    };

    // Write the retrieval brief to the governed stream so the invocation is
    // itself auditable. The hiring entity can see exactly what was asked.
    const briefRecordId = this.writeRetrievalBriefRecord(brief);

    // Stage 1 — Query Decomposition
    markStart(1);
    const decomposition = await this.decomposeQuery(brief);
    const decompRecordId = this.writeQueryDecompositionRecord(brief, decomposition, briefRecordId);
    markDone(1, {
      output_summary: `${decomposition.topicEntities.length} topic entit(ies), ${decomposition.decisionTypesSought.length} decision type(s) sought`,
      output_record_id: decompRecordId ?? undefined,
    });

    // Build the authority elevation index once per research() call. The
    // governed stream stores authority_level at write time; phase-gate
    // certification and constitutional status elevate it without rewriting
    // the record (spec §3.1 + §8.12 Stage II `validates` edges). All
    // downstream reads of MaterialFinding.authorityLevel reflect the
    // elevated value so scoring, constraint extraction, and `active_constraints`
    // filtering see the effective authority, not the stored one.
    const elevationIndex = buildAuthorityElevationIndex(this.db);

    // Stage 2 — Broad Candidate Harvest
    markStart(2);
    let candidates = await this.harvestCandidates(brief, decomposition);
    // Executor tasks: drop JanumiCode's process-governance constitutional
    // invariants. They are authority-7 and otherwise dominate the materiality
    // ranking (authority-weighted), crowding out the task's own technical
    // artifacts — the slice-138 failure where the DMR packet held only
    // governance boilerplate and no component/data-model/test context. Never
    // drops a seeded known-relevant record (we never seed invariants).
    if (brief.requestingAgentRole === 'executor_agent') {
      const before = candidates.length;
      candidates = candidates.filter(c => !EXECUTOR_IRRELEVANT_RECORD_TYPES.has(c.recordType));
      const dropped = before - candidates.length;
      if (dropped > 0) {
        getLogger().debug('dmr', 'executor DMR: excluded process-governance records', {
          dropped, requestingAgentRole: brief.requestingAgentRole,
        });
      }
    }
    for (const c of candidates) {
      c.authorityLevel = effectiveAuthorityLevel(
        { id: c.id, record_type: c.recordType, authority_level: c.authorityLevel },
        elevationIndex,
      );
    }
    markDone(2, { output_summary: `${candidates.length} candidate finding(s) harvested (FTS5 + vector + graph)` });

    // Stage 3 — Materiality Scoring
    markStart(3);
    const scored = await this.scoreCandidates(candidates, brief);
    markDone(3, { output_summary: `${scored.length} scored (threshold applied)` });

    // Stage 4 — Relationship Expansion
    markStart(4);
    const expanded = this.expandRelationships(scored, elevationIndex);
    markDone(4, { output_summary: `${expanded.length} finding(s) after memory_edge expansion` });

    // Stage 5 — Supersession and Contradiction Analysis
    markStart(5);
    const { supersessionChains, contradictions } = this.analyzeSupersession(expanded);
    markDone(5, {
      output_summary: `${supersessionChains.length} chain(s), ${contradictions.length} contradiction(s)`,
    });

    // Stage 6 — Gap Detection
    markStart(6);
    const { unavailableSources, knownGaps } = this.detectGaps(brief);
    markDone(6, {
      output_summary: `${unavailableSources.length} unavailable source(s), ${knownGaps.length} known gap(s)`,
    });

    // Stage 7 — Context Packet Synthesis
    markStart(7);
    const packet = await this.synthesize(
      decomposition, expanded, supersessionChains,
      contradictions, unavailableSources, knownGaps, brief,
    );
    const contextPacketRecordId = this.writeContextPacketRecord(brief, packet, briefRecordId, decompRecordId);
    markDone(7, {
      output_summary: `completeness: ${packet.completenessStatus}`,
      output_record_id: contextPacketRecordId ?? undefined,
    });

    // One-shot pipeline container record — writes once at the end with
    // the full 7-stage journal. The webview's DmrPipelineCard renders
    // this as a single composite card and inlines the detail records
    // (query_decomposition_record, context_packet) by their ids.
    this.writeDmrPipelineRecord(brief, stages, packet.completenessStatus, briefRecordId);
    return packet;
  }

  // ── Stage 1: Query Decomposition ────────────────────────────────
  //
  // Deterministic by design — the prior LLM call produced fields that
  // were either rule-derived (authority levels, sources, temporal scope)
  // or unused downstream (decision_types_sought, temporal_scope are
  // never consumed by Stages 2-7). The only meaningful LLM-side
  // contribution was topic-entity tokenization, and qwen3.5:9b
  // consistently produced marketing-prose tokens rather than the
  // upstream record identifiers Stage 2's topic FTS sweep can match
  // against. `extractTopicEntities` now preserves ID-shaped tokens
  // (e.g. `COMP-1`, `FR-3`, `NFR-2`) so the deterministic path provides
  // strictly better signal than the LLM did, in a fraction of the time.
  //
  // Spec §8.4 Stage 1 derives `known_conflict_zones` from governed-stream
  // inspection. We have direct DB access (no CLI tool needed), so this is a
  // deterministic query — see `deriveConflictZones`.

  private async decomposeQuery(
    brief: RetrievalBrief,
  ): Promise<ContextPacket['queryDecomposition']> {
    return {
      topicEntities: this.extractTopicEntities(brief.query),
      decisionTypesSought: ['menu_selection', 'mirror_approval', 'phase_gate_approval'],
      temporalScope: { from: '1970-01-01T00:00:00Z', to: new Date().toISOString() },
      authorityLevelsIncluded: [5, 6, 7],
      sourcesInScope: brief.scopeTier === 'current_run'
        ? ['governed_stream_current_run']
        : ['governed_stream_all_runs'],
      knownConflictZones: this.deriveConflictZones(brief),
    };
  }

  /**
   * Stage 1 conflict-zone derivation (spec §8.4). A "conflict zone" is a subject
   * — a component or artifact kind — that already carries unresolved tension in
   * the governed stream: it is an endpoint of a CONFIRMED `contradicts` or
   * `supersedes` memory edge. Surfacing these tells a consumer where the record
   * set disagrees with itself (active overrides, contradictions) so it can read
   * those zones with extra care. Deterministic DB inspection; '' on any error.
   */
  private deriveConflictZones(brief: RetrievalBrief): string[] {
    try {
      const runScope = brief.scopeTier === 'current_run' ? 'AND gs.workflow_run_id = @run' : '';
      const stmt = this.db.prepare(`
        SELECT DISTINCT gs.record_type AS rt,
               json_extract(gs.content, '$.kind') AS kind,
               json_extract(gs.content, '$.component_id') AS comp
        FROM memory_edge me
        JOIN governed_stream gs
          ON gs.id IN (me.source_record_id, me.target_record_id)
        WHERE me.edge_type IN ('contradicts', 'supersedes')
          AND me.status IN ('confirmed', 'system_asserted')
          ${runScope}
      `);
      const rows = (runScope ? stmt.all({ run: brief.workflowRunId }) : stmt.all()) as
        Array<{ rt: string; kind: string | null; comp: string | null }>;
      const zones = new Set<string>();
      for (const r of rows) {
        const label = r.comp || r.kind || r.rt;
        if (label) zones.add(String(label));
      }
      return [...zones].slice(0, 10);
    } catch { return []; }
  }

  // ── Stage 2: Broad Candidate Harvest ────────────────────────────

  private async harvestCandidates(
    brief: RetrievalBrief,
    decomposition: ContextPacket['queryDecomposition'],
  ): Promise<MaterialFinding[]> {
    const byId = new Map<string, MaterialFinding>();

    // FTS5 keyword search
    for (const f of this.searchFTS(brief.query, brief.workflowRunId, brief.scopeTier)) {
      byId.set(f.id, f);
    }

    // Vector similarity search (if embedding service is available)
    if (this.embedding) {
      try {
        const queryVec = await this.embedding.embedQuery(brief.query);
        const vectorHits = this.searchVector(queryVec, brief.workflowRunId, brief.scopeTier);
        for (const f of vectorHits) {
          if (!byId.has(f.id)) byId.set(f.id, f);
        }
      } catch (err) {
        getLogger().debug('dmr', 'Vector search unavailable — continuing with FTS only', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Authority-weighted filter — always include governing records (Authority 6+)
    // within scope, even if they didn't match FTS/vector.
    for (const f of this.harvestByAuthority(brief, decomposition.authorityLevelsIncluded)) {
      if (!byId.has(f.id)) byId.set(f.id, f);
    }

    // Topic entity exact-match sweep — guard against FTS tokenization quirks.
    for (const entity of decomposition.topicEntities.slice(0, 20)) {
      for (const f of this.searchFTS(entity, brief.workflowRunId, brief.scopeTier)) {
        if (!byId.has(f.id)) byId.set(f.id, f);
      }
    }

    // Known relevant records
    for (const recordId of brief.knownRelevantRecordIds) {
      const record = this.db.prepare(
        'SELECT id, record_type, authority_level, content, effective_at, produced_at FROM governed_stream WHERE id = ? AND is_current_version = 1',
      ).get(recordId) as Record<string, unknown> | undefined;

      if (record) {
        byId.set(record.id as string, {
          id: record.id as string,
          recordType: record.record_type as string,
          authorityLevel: record.authority_level as number,
          governingStatus: 'active',
          summary: this.extractSummary(record),
          sourceRecordIds: [record.id as string],
          materialityScore: 1.0, // Known relevant = max score
        });
      }
    }

    return Array.from(byId.values());
  }

  // ── Stage 3: Materiality Scoring ────────────────────────────────

  private async scoreCandidates(
    candidates: MaterialFinding[],
    brief: RetrievalBrief,
  ): Promise<MaterialFinding[]> {
    // Compute query embedding once for semantic similarity scoring.
    let queryVec: Float32Array | null = null;
    if (this.embedding) {
      try {
        queryVec = await this.embedding.embedQuery(brief.query);
      } catch {
        // Ignore — fall back to FTS-proxy similarity
      }
    }

    for (const c of candidates) {
      if (c.materialityScore === 1.0) continue; // Known relevant, preserve max
      c.materialityScore = await this.computeMaterialityAsync(c, brief, queryVec);
    }

    candidates.sort((a, b) => b.materialityScore - a.materialityScore);
    return candidates;
  }

  /**
   * Synchronous compute (deterministic dimensions only) — public API for tests
   * and cases where embedding service isn't present. Uses conservative
   * placeholders for dimensions that require external signals.
   */
  computeMateriality(finding: MaterialFinding, _brief: RetrievalBrief): number {
    const w = this.weights;

    const semanticSimilarity = 0.5; // No query vector in sync path
    const constraintRelevance = finding.authorityLevel >= 6 ? 1.0 : 0.3;
    const authorityScore = finding.authorityLevel / 7;
    const temporalRecency = this.computeTemporalRecency(finding.id);
    const causalRelevance = this.computeCausalRelevance(finding.id);
    const contradictionSignal = finding.governingStatus === 'contradicted' ? 1.0 : 0.0;

    const raw = (
      w.semantic_similarity * semanticSimilarity +
      w.constraint_relevance * constraintRelevance +
      w.authority_level * authorityScore +
      w.temporal_recency * temporalRecency +
      w.causal_relevance * causalRelevance +
      w.contradiction_signal * contradictionSignal
    );

    return REASONING_TRAIL_RECORD_TYPES.has(finding.recordType)
      ? raw * REASONING_TRAIL_MULTIPLIER
      : raw;
  }

  /**
   * Full async materiality score — uses vector similarity when available.
   */
  private async computeMaterialityAsync(
    finding: MaterialFinding,
    _brief: RetrievalBrief,
    queryVec: Float32Array | null,
  ): Promise<number> {
    const w = this.weights;

    const semanticSimilarity = queryVec
      ? this.computeSemanticSimilarity(finding.id, queryVec)
      : 0.5; // Degraded mode — neutral signal when embeddings unavailable
    const constraintRelevance = finding.authorityLevel >= 6 ? 1.0 : 0.3;
    const authorityScore = finding.authorityLevel / 7;
    const temporalRecency = this.computeTemporalRecency(finding.id);
    const causalRelevance = this.computeCausalRelevance(finding.id);
    const contradictionSignal = finding.governingStatus === 'contradicted' ? 1.0 : 0.0;

    const raw = (
      w.semantic_similarity * semanticSimilarity +
      w.constraint_relevance * constraintRelevance +
      w.authority_level * authorityScore +
      w.temporal_recency * temporalRecency +
      w.causal_relevance * causalRelevance +
      w.contradiction_signal * contradictionSignal
    );

    const score = REASONING_TRAIL_RECORD_TYPES.has(finding.recordType)
      ? raw * REASONING_TRAIL_MULTIPLIER
      : raw;

    finding.materialityBreakdown = {
      semanticSimilarity,
      constraintRelevance,
      authorityScore,
      temporalRecency,
      causalRelevance,
      contradictionSignal,
    };

    return score;
  }

  /**
   * Cosine similarity between the query vector and the record's embedding
   * (if one exists in `governed_stream_vec`).
   */
  private computeSemanticSimilarity(recordId: string, queryVec: Float32Array): number {
    try {
      const row = this.db.prepare(
        'SELECT embedding FROM governed_stream_vec WHERE record_id = ?',
      ).get(recordId) as { embedding: Buffer } | undefined;
      if (!row) return 0.5; // No embedding yet (async indexer) — neutral

      const recordVec = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      );
      if (recordVec.length !== queryVec.length) return 0.5;

      // Cosine similarity is in [-1, 1]; map to [0, 1] for materiality.
      const sim = cosineSimilarity(queryVec, recordVec);
      return Math.max(0, (sim + 1) / 2);
    } catch {
      return 0.5;
    }
  }

  /**
   * Exponential decay from the record's `effective_at` (falling back to
   * `produced_at`). Recency halves every `temporalHalfLifeDays`.
   */
  private computeTemporalRecency(recordId: string): number {
    try {
      const row = this.db.prepare(
        'SELECT effective_at, produced_at FROM governed_stream WHERE id = ?',
      ).get(recordId) as { effective_at: string | null; produced_at: string } | undefined;
      if (!row) return 0.5;

      const ts = row.effective_at ?? row.produced_at;
      const ageMs = Date.now() - new Date(ts).getTime();
      if (ageMs < 0) return 1.0; // Future-dated → fully recent

      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      // recency = 2^(-age/halfLife) so age=0 → 1.0, age=halfLife → 0.5
      return Math.pow(2, -ageDays / this.temporalHalfLifeDays);
    } catch {
      return 0.5;
    }
  }

  /**
   * Proxy for causal relevance: count of inbound confirmed/system_asserted
   * edges from other records. A record referenced by many downstream
   * artifacts is structurally more causal to the current context.
   * Normalized to [0, 1] with a soft cap at 10 inbound edges.
   */
  private computeCausalRelevance(recordId: string): number {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) AS n FROM memory_edge
        WHERE target_record_id = ? AND status IN ('confirmed', 'system_asserted')
      `).get(recordId) as { n: number } | undefined;
      const n = row?.n ?? 0;
      return Math.min(1.0, n / 10);
    } catch {
      return 0.3;
    }
  }

  // ── Stage 4: Relationship Expansion ─────────────────────────────

  private expandRelationships(
    findings: MaterialFinding[],
    elevationIndex: AuthorityElevationIndex,
  ): MaterialFinding[] {
    const expanded = [...findings];
    const seen = new Set(findings.map(f => f.id));

    const highMateriality = findings.filter(f => f.materialityScore >= 0.5);

    for (const finding of highMateriality) {
      const edges = this.db.prepare(`
        SELECT target_record_id, edge_type FROM memory_edge
        WHERE source_record_id = ? AND status IN ('confirmed', 'system_asserted')
        LIMIT 20
      `).all(finding.id) as { target_record_id: string; edge_type: string }[];

      for (const edge of edges) {
        if (seen.has(edge.target_record_id)) continue;
        const record = this.db.prepare(
          'SELECT id, record_type, authority_level, content FROM governed_stream WHERE id = ? AND is_current_version = 1',
        ).get(edge.target_record_id) as Record<string, unknown> | undefined;

        if (record) {
          const recId = record.id as string;
          const recType = record.record_type as string;
          const storedAuth = record.authority_level as number;
          expanded.push({
            id: recId,
            recordType: recType,
            authorityLevel: effectiveAuthorityLevel(
              { id: recId, record_type: recType, authority_level: storedAuth },
              elevationIndex,
            ),
            governingStatus: 'active',
            summary: this.extractSummary(record) || `Expanded via ${edge.edge_type} from ${finding.id}`,
            sourceRecordIds: [recId],
            materialityScore: finding.materialityScore * 0.7,
          });
          seen.add(recId);
        }
      }
    }

    return expanded;
  }

  // ── Stage 5: Supersession Analysis ──────────────────────────────

  private analyzeSupersession(findings: MaterialFinding[]): {
    supersessionChains: SupersessionChain[];
    contradictions: Contradiction[];
  } {
    const chains: SupersessionChain[] = [];
    const contradictions: Contradiction[] = [];
    const chainBySubject = new Map<string, SupersessionChain>();

    for (const finding of findings) {
      const supersedes = this.db.prepare(`
        SELECT target_record_id FROM memory_edge
        WHERE source_record_id = ? AND edge_type = 'supersedes'
          AND status IN ('confirmed', 'system_asserted')
      `).all(finding.id) as { target_record_id: string }[];

      if (supersedes.length > 0) {
        finding.governingStatus = 'active';
        const subjectKey = finding.recordType;
        let chain = chainBySubject.get(subjectKey);
        if (!chain) {
          chain = { subject: subjectKey, chain: [] };
          chainBySubject.set(subjectKey, chain);
          chains.push(chain);
        }
        chain.chain.push({
          recordId: finding.id,
          position: 'current_governing',
          timestamp: new Date().toISOString(),
          summary: finding.summary || this.summaryForRecordId(finding.id),
        });
        for (const sup of supersedes) {
          const superseded = findings.find(f => f.id === sup.target_record_id);
          if (superseded) superseded.governingStatus = 'superseded';
          chain.chain.push({
            recordId: sup.target_record_id,
            position: 'superseded',
            timestamp: new Date().toISOString(),
            // The superseded record may not be independently material (not in
            // `findings`); distill its content directly so the chain still says
            // what was replaced.
            summary: superseded?.summary || this.summaryForRecordId(sup.target_record_id),
          });
        }
      }

      const contradicts = this.db.prepare(`
        SELECT target_record_id FROM memory_edge
        WHERE source_record_id = ? AND edge_type = 'contradicts'
          AND status IN ('confirmed', 'system_asserted')
      `).all(finding.id) as { target_record_id: string }[];

      for (const c of contradicts) {
        contradictions.push({
          recordIds: [finding.id, c.target_record_id],
          explanation: 'Contradiction detected via memory edge',
          resolutionStatus: 'unresolved',
        });
      }
    }

    return { supersessionChains: chains, contradictions };
  }

  /**
   * Distill a record's content by id — used for supersession-chain links whose
   * record is not an independently-material finding (so it has no precomputed
   * summary). Best-effort: returns '' if the record is missing/unreadable.
   */
  private summaryForRecordId(recordId: string): string {
    try {
      const row = this.db.prepare('SELECT content, record_type FROM governed_stream WHERE id = ?')
        .get(recordId) as { content: string; record_type: string } | undefined;
      if (!row) return '';
      return this.extractSummary({ content: row.content, record_type: row.record_type });
    } catch { return ''; }
  }

  // ── Stage 6: Gap Detection ──────────────────────────────────────

  private detectGaps(brief: RetrievalBrief): {
    unavailableSources: UnavailableSource[];
    knownGaps: string[];
  } {
    const unavailableSources: UnavailableSource[] = [];
    const knownGaps: string[] = [];

    // Check vector search availability
    if (this.embedding) {
      const vecCount = (this.db.prepare(
        'SELECT COUNT(*) as n FROM governed_stream_vec',
      ).get() as { n: number }).n;
      const recordCount = (this.db.prepare(
        'SELECT COUNT(*) as n FROM governed_stream WHERE is_current_version = 1',
      ).get() as { n: number }).n;
      if (recordCount > 0 && vecCount / recordCount < 0.5) {
        knownGaps.push(
          `Vector index coverage is ${Math.round(100 * vecCount / recordCount)}% ` +
          `(${vecCount}/${recordCount}) — semantic similarity results may be incomplete.`,
        );
      }
    } else {
      knownGaps.push('Embedding service not attached — semantic similarity signal unavailable.');
    }

    // External sources — only in all_runs_plus_external scope
    if (brief.scopeTier === 'all_runs_plus_external') {
      unavailableSources.push({
        source: 'git_history',
        reason: 'External source integrations not yet implemented',
        materiality: 'low',
        materialityExplanation: 'Git history would add commit-level provenance — not yet wired.',
        recommendation: 'proceed_with_caveat',
      });
    }

    return { unavailableSources, knownGaps };
  }

  // ── Stage 7: Context Packet Synthesis ───────────────────────────

  private async synthesize(
    decomposition: ContextPacket['queryDecomposition'],
    findings: MaterialFinding[],
    supersessionChains: SupersessionChain[],
    contradictions: Contradiction[],
    unavailableSources: UnavailableSource[],
    knownGaps: string[],
    brief: RetrievalBrief,
  ): Promise<ContextPacket> {
    // Enrich the summaries of the findings that will actually be emitted
    // (active_constraints + the Stage-7 prompt + hydration) with the query's
    // component scope. Harvest-time summaries are component-blind and were
    // `[kind]`/"" for structured artifacts + decision_traces; re-derive them
    // here via the record-type-aware, component-scoped distiller so the
    // synthesis — and `activeConstraint.statement` below — carry real substance.
    // Capture each enriched record's KIND (content.kind, else record_type) so
    // activeConstraints can be classified binding-vs-context below. Every
    // authority>=6 record passes through this loop (the `continue` only skips
    // sub-threshold, sub-authority-6 findings), so every activeConstraint's kind
    // is captured here without an extra DB round-trip.
    const kindById = new Map<string, string>();
    for (const f of findings) {
      if (f.authorityLevel < 6 && f.materialityScore < this.materialityThreshold) continue;
      try {
        const rec = this.db.prepare(
          'SELECT record_type, content FROM governed_stream WHERE id = ?',
        ).get(f.id) as { record_type: string; content: string } | undefined;
        if (rec) {
          const enriched = this.extractSummary(
            { record_type: rec.record_type, content: rec.content },
            brief.focusComponentId,
          );
          if (enriched) f.summary = enriched;
          let kind = rec.record_type;
          try {
            const parsed = JSON.parse(rec.content) as { kind?: unknown };
            if (typeof parsed.kind === 'string' && parsed.kind) kind = parsed.kind;
          } catch { /* content unparseable — keep record_type as the kind */ }
          kindById.set(f.id, kind);
        }
      } catch { /* keep the harvest-time summary */ }
    }

    // Deterministic base — always built. LLM synthesis adds narrative.
    // Authority>=6 + active is the ADMISSION gate; bindingClass is the second
    // axis distinguishing normative rules ("apply without exception") from
    // certified reference context ("build within this; do not contradict").
    const activeConstraints: ActiveConstraint[] = findings
      .filter(f => f.authorityLevel >= 6 && f.governingStatus === 'active')
      .map(f => ({
        id: f.id,
        statement: f.summary,
        authorityLevel: f.authorityLevel,
        sourceRecordIds: f.sourceRecordIds,
        bindingClass: classifyGoverningKind(kindById.get(f.id) ?? f.recordType),
      }));

    let completenessStatus: CompletenessStatus = 'complete';
    if (unavailableSources.some(s => s.materiality === 'high')) {
      completenessStatus = 'incomplete_high';
    } else if (unavailableSources.some(s => s.materiality === 'medium')) {
      completenessStatus = 'partial_medium';
    } else if (knownGaps.length > 0) {
      completenessStatus = 'partial_low';
    }

    const filteredFindings = findings.filter(f => f.materialityScore >= this.materialityThreshold);

    let coverageConfidence = 0.4;
    if (completenessStatus === 'complete') coverageConfidence = 1.0;
    else if (completenessStatus === 'partial_low') coverageConfidence = 0.85;
    else if (completenessStatus === 'partial_medium') coverageConfidence = 0.65;

    const basePacket: ContextPacket = {
      queryDecomposition: decomposition,
      completenessStatus,
      decisionContextSummary: this.buildDeterministicDecisionSummary(activeConstraints, supersessionChains, contradictions),
      completenessNarrative: `Research produced ${filteredFindings.length} material finding(s) over ${findings.length} candidate(s).`,
      unavailableSources,
      materialFindings: filteredFindings,
      activeConstraints,
      supersessionChains,
      contradictions,
      openQuestions: [],
      implicitDecisions: [],
      recommendedDrilldowns: [],
      coverageAssessment: {
        sourcesQueried: decomposition.sourcesInScope,
        sourcesUnavailable: unavailableSources.map(s => s.source),
        knownGaps,
        confidence: coverageConfidence,
      },
    };

    // LLM synthesis layer — optional. Enriches narrative and surfaces
    // open questions / implicit decisions beyond what deterministic
    // analysis can infer. Falls back to the base packet on any failure.
    if (!this.templateLoader) return basePacket;

    const template = this.templateLoader.findTemplate(
      'deep_memory_research', 'deep_memory_context_packet_synthesis',
    );
    if (!template) return basePacket;

    const rendered = this.templateLoader.render(template, {
      query_decomposition: JSON.stringify(decomposition, null, 2),
      material_findings: JSON.stringify(
        filteredFindings.slice(0, 30).map(f => ({
          id: f.id,
          record_type: f.recordType,
          authority_level: f.authorityLevel,
          governing_status: f.governingStatus,
          summary: f.summary,
          materiality_score: Number(f.materialityScore.toFixed(3)),
        })),
        null, 2,
      ),
      supersession_chains: JSON.stringify(supersessionChains, null, 2),
      contradictions: JSON.stringify(contradictions, null, 2),
      coverage_assessment: JSON.stringify(basePacket.coverageAssessment, null, 2),
      janumicode_version_sha: this.config.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return basePacket;

    if (!this.model) {
      throw new Error(
        'DeepMemoryResearchAgent.model is not set. ' +
        'Production callers must supply config.model via ConfigManager.getRoutingModel(role). ' +
        'Never fall back to a hardcoded literal.',
      );
    }
    try {
      const result = await this.llmCaller.call({
        provider: this.provider,
        model: this.model,
        baseUrl: this.baseUrl,
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.3,
        traceContext: {
          workflowRunId: brief.workflowRunId,
          phaseId: brief.phaseId,
          subPhaseId: brief.subPhaseId,
          agentRole: 'deep_memory_research',
          label: 'DMR Stage 7 — Context Packet Synthesis',
        },
      });

      const parsed = result.parsed as Record<string, unknown> | null;
      if (!parsed) return basePacket;

      // LLM may wrap response in a top-level key like "context_packet"
      const unwrapped = (parsed.context_packet ?? parsed.packet ?? parsed) as Record<string, unknown>;

      // Enrich base packet with LLM narrative and open questions.
      // Coerce LLM-supplied unknown fields to strings; JSON-encode any object
      // value so it surfaces real content instead of "[object Object]".
      const asField = (v: unknown, fallback: string): string => {
        if (typeof v === 'string') return v;
        if (v == null) return fallback;
        return JSON.stringify(v);
      };
      const openQuestionsRaw = unwrapped.open_questions;
      const openQuestions: OpenQuestion[] = Array.isArray(openQuestionsRaw)
        ? (openQuestionsRaw as Array<Record<string, unknown>>).map(oq => ({
            question: asField(oq.question, ''),
            firstRaised: asField(oq.first_raised, new Date().toISOString()),
            stillUnresolved: oq.still_unresolved !== false,
            sourceRecordId: asField(oq.source_record_id, ''),
          }))
        : [];

      const llmNarrative = typeof unwrapped.completeness_narrative === 'string'
        ? unwrapped.completeness_narrative
        : basePacket.completenessNarrative;

      const decisionSummary = typeof unwrapped.decision_context_summary === 'string'
        && unwrapped.decision_context_summary.trim().length > 0
          ? unwrapped.decision_context_summary
          : basePacket.decisionContextSummary;

      return {
        ...basePacket,
        decisionContextSummary: decisionSummary,
        completenessNarrative: llmNarrative,
        openQuestions,
      };
    } catch (err) {
      getLogger().warn('dmr', 'Stage 7 synthesis LLM call failed — using deterministic packet', {
        error: err instanceof Error ? err.message : String(err),
      });
      return basePacket;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Deterministic decision_context_summary used when the Stage 7 LLM
   * synthesis is unavailable or omits the field. Composes a one-line
   * narrative naming the active constraints and contradiction state so
   * the spec's "every claim cites a source_record_id" rule is honored
   * even in the fallback path.
   */
  private buildDeterministicDecisionSummary(
    activeConstraints: ActiveConstraint[],
    supersessionChains: SupersessionChain[],
    contradictions: Contradiction[],
  ): string {
    if (activeConstraints.length === 0) {
      return 'No active constraints identified in scope.';
    }
    const constraintLine = activeConstraints
      .slice(0, 5)
      .map(c => `${c.statement} (auth=${c.authorityLevel}; source=${c.sourceRecordIds[0] ?? 'unknown'})`)
      .join('; ');
    const moreCount = Math.max(0, activeConstraints.length - 5);
    const constraintSuffix = moreCount > 0 ? ` (+${moreCount} more)` : '';
    const supersessionSuffix = supersessionChains.length > 0
      ? ` Supersession chains: ${supersessionChains.length}.`
      : '';
    const contradictionSuffix = contradictions.length > 0
      ? ` Unresolved contradictions: ${contradictions.filter(c => c.resolutionStatus === 'unresolved').length}.`
      : '';
    return `Governing decisions: ${constraintLine}${constraintSuffix}.${supersessionSuffix}${contradictionSuffix}`;
  }

  private extractTopicEntities(query: string): string[] {
    // Preserve domain-shaped identifiers (FR-1, COMP-API-GATEWAY, NFR-2,
    // UJ-SHARE, etc.) verbatim — these are the highest-value retrieval
    // tokens because they match indexed record fields directly. Phase
    // callers pass these in the query when they have upstream artifacts
    // to anchor against.
    // Uppercase domain ids (FR-1, COMP-API-GATEWAY, TECH-POSTGRES-16). The `.`
    // in the trailing class captures DOTTED ids whole (AC-FR-AUTH-C3.2-2.2-...,
    // FR-AUTH-C3.2-3) — without it the class stopped at the first dot, collapsing
    // distinct dotted ACs to a common prefix (e.g. a P7 test batch over 12 dotted
    // AUTH ACs degraded to "AC-FR-AUTH-C3" ×12). The trailing `\b` backtracks off
    // a sentence-ending dot, so "see FR-1.2." still yields "FR-1.2".
    const upperIdRe = /\b[A-Z][A-Z0-9]+-[A-Z0-9.-]+\b/g;
    // Lowercase / mixed-case STRUCTURAL ids (comp-lifecycle-manager,
    // task-comp-x-delete, us-001, dom-shortening). The per-leaf executor query
    // anchors on `comp-*`/`task-*` ids, which the uppercase pattern missed — so
    // they degraded into ordinary word tokens (lost retrieval signal). Matching
    // is gated on a known id PREFIX so genuine compound words ("single-tenant",
    // "delete-by-key") are NOT misread as identifiers. `.` allowed for dotted ids.
    const prefixedIdRe = /\b(?:comp|task|leaf|node|us|ac|fr|nfr|dom|uj|wf|ent|int|ic|sr|dm|cc|api|tech|con|qa|rel)-[a-z0-9][a-z0-9.-]*\b/gi;
    const idTokens = [
      ...[...query.matchAll(upperIdRe)].map(m => m[0]),
      ...[...query.matchAll(prefixedIdRe)].map(m => m[0]),
    ];

    // Keep quoted phrases intact.
    const quoted = [...query.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    const stripped = query
      .replace(/"[^"]+"/g, ' ')
      .replace(upperIdRe, ' ')
      .replace(prefixedIdRe, ' '); // remove already-captured IDs
    const stopwords = new Set([
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these',
      'those', 'into', 'onto', 'over', 'then', 'than', 'when', 'where',
      'what', 'which', 'while', 'have', 'will', 'would', 'could', 'should',
    ]);
    const words = stripped.split(/\s+/)
      .filter(w => w.length > 3)
      .map(w => w.toLowerCase().replace(/[^a-z0-9_\-./]/g, ''))
      .filter(w => w.length > 0 && !stopwords.has(w));
    // Dedup case-insensitively, preserving first occurrence (ids first, so they
    // win the 12-slot budget). Without this, an id captured by BOTH upperIdRe and
    // prefixedIdRe — or the same id repeated across a batch query — fills slots
    // with duplicates and starves distinct entities.
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const tok of [...idTokens, ...quoted, ...words]) {
      const key = tok.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(tok);
    }
    return deduped.slice(0, 12);
  }

  private searchFTS(
    query: string,
    workflowRunId: string,
    scopeTier: ScopeTier,
  ): MaterialFinding[] {
    try {
      const ftsQuery = this.buildFtsQuery(query);
      if (!ftsQuery) return [];

      const whereClause = scopeTier === 'current_run'
        ? 'AND gs.workflow_run_id = ?'
        : '';
      const params = scopeTier === 'current_run'
        ? [ftsQuery, workflowRunId]
        : [ftsQuery];

      // Exclude conversation/process noise: agent_invocation prompts repeat
      // the query verbatim and dominate FTS rankings, drowning out actual
      // memory-bearing records. See SKIPPED_RECORD_TYPES in the embedding
      // service for the matching write-side exclusion list.
      const noiseTypes = HARVEST_PLUMBING_EXCLUDE.map(t => `'${t}'`).join(',');

      const results = this.db.prepare(`
        SELECT gs.id, gs.record_type, gs.authority_level, gs.content
        FROM governed_stream_fts fts
        JOIN governed_stream gs ON gs.id = fts.id
        WHERE governed_stream_fts MATCH ? ${whereClause}
          AND gs.is_current_version = 1
          AND gs.record_type NOT IN (${noiseTypes})
        LIMIT ${this.maxFtsCandidates}
      `).all(...params) as Array<{ id: string; record_type: string; authority_level: number; content: string }>;

      return results.map(r => ({
        id: r.id,
        recordType: r.record_type,
        authorityLevel: r.authority_level,
        governingStatus: 'active' as const,
        summary: this.extractSummary({ record_type: r.record_type, content: r.content }),
        sourceRecordIds: [r.id],
        materialityScore: 0,
      }));
    } catch {
      return [];
    }
  }

  private searchVector(
    queryVec: Float32Array,
    workflowRunId: string,
    scopeTier: ScopeTier,
  ): MaterialFinding[] {
    try {
      const whereClause = scopeTier === 'current_run'
        ? 'AND gs.workflow_run_id = ?'
        : '';
      const params = scopeTier === 'current_run' ? [workflowRunId] : [];

      interface VecRow {
        id: string;
        record_type: string;
        authority_level: number;
        content: string;
        embedding: Buffer;
      }
      const noiseTypes = HARVEST_PLUMBING_EXCLUDE.map(t => `'${t}'`).join(',');
      const rows = this.db.prepare(`
        SELECT gs.id, gs.record_type, gs.authority_level, gs.content, v.embedding
        FROM governed_stream gs
        JOIN governed_stream_vec v ON v.record_id = gs.id
        WHERE gs.is_current_version = 1 ${whereClause}
          AND gs.record_type NOT IN (${noiseTypes})
      `).all(...params) as VecRow[];

      // Score each by cosine similarity; keep top N.
      const scored = rows.map(r => {
        const vec = new Float32Array(
          r.embedding.buffer,
          r.embedding.byteOffset,
          r.embedding.byteLength / 4,
        );
        const sim = vec.length === queryVec.length ? cosineSimilarity(queryVec, vec) : 0;
        return { row: r, sim };
      });
      scored.sort((a, b) => b.sim - a.sim);

      return scored.slice(0, this.maxVectorCandidates)
        .filter(s => s.sim > 0.2) // Drop noise
        .map(s => ({
          id: s.row.id,
          recordType: s.row.record_type,
          authorityLevel: s.row.authority_level,
          governingStatus: 'active' as const,
          summary: this.extractSummary({ record_type: s.row.record_type, content: s.row.content }),
          sourceRecordIds: [s.row.id],
          materialityScore: 0,
        }));
    } catch {
      return [];
    }
  }

  private harvestByAuthority(
    brief: RetrievalBrief,
    authorityLevels: number[],
  ): MaterialFinding[] {
    if (authorityLevels.length === 0) return [];

    // Harvest at the *highest* requested level downward to 5. Previously this
    // used Math.min and short-circuited when the lowest requested level was
    // below 5 — meaning a brief asking for [3,4,5,6,7] (broad sweep) got
    // nothing instead of the governing records the agent asked for.
    const governingLevels = authorityLevels.filter(l => l >= 5);
    if (governingLevels.length === 0) return []; // Only auto-include governing records
    const floor = Math.min(...governingLevels);

    const whereClause = brief.scopeTier === 'current_run'
      ? 'AND workflow_run_id = ?'
      : '';
    const params = brief.scopeTier === 'current_run' ? [floor, brief.workflowRunId] : [floor];

    try {
      const rows = this.db.prepare(`
        SELECT id, record_type, authority_level, content
        FROM governed_stream
        WHERE authority_level >= ? AND is_current_version = 1 ${whereClause}
          AND record_type NOT IN (${HARVEST_PLUMBING_EXCLUDE.map(t => `'${t}'`).join(',')})
        ORDER BY authority_level DESC
        LIMIT 50
      `).all(...params) as Array<{ id: string; record_type: string; authority_level: number; content: string }>;

      return rows.map(r => ({
        id: r.id,
        recordType: r.record_type,
        authorityLevel: r.authority_level,
        governingStatus: 'active' as const,
        summary: this.extractSummary({ record_type: r.record_type, content: r.content }),
        sourceRecordIds: [r.id],
        materialityScore: 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Build a valid FTS5 MATCH expression from the user query. Returns null if
   * no usable tokens remain.
   */
  private buildFtsQuery(query: string): string | null {
    // Keep `.` so DOTTED ids (AC-FR-AUTH-C3.2-2.2-1.2.2.1-001) stay ONE token —
    // a single quoted phrase that FTS5 matches as a unit. Stripping the dot (the
    // prior `[^\w\s-]`) fragmented the id into `"ac-fr-auth-c3" OR "2-2" OR …`,
    // an OR of common fragments that drowned the precise record in noise.
    const tokens = query
      .replace(/[^\w\s.-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.toLowerCase());
    if (tokens.length === 0) return null;
    return tokens.map(t => `"${t}"`).join(' OR ');
  }

  private extractSummary(record: Record<string, unknown>, focusComponentId?: string): string {
    let content: Record<string, unknown>;
    if (typeof record.content === 'string') {
      try { content = JSON.parse(record.content) as Record<string, unknown>; }
      catch { return String(record.content).slice(0, 300); }
    } else if (record.content && typeof record.content === 'object') {
      content = record.content as Record<string, unknown>;
    } else {
      return '';
    }

    // Fast path: records that expose a direct narrative field.
    if (typeof content.summary === 'string' && content.summary.trim()) return content.summary.slice(0, 300);
    if (typeof content.description === 'string' && content.description.trim()) return content.description.slice(0, 300);
    if (typeof content.statement === 'string' && content.statement.trim()) return content.statement.slice(0, 300);
    if (typeof content.text === 'string' && content.text.trim()) return content.text.slice(0, 300);
    if (typeof content.response_text === 'string' && content.response_text.trim()) return content.response_text.slice(0, 300);

    // Record-type-aware distillation — the substance the fast-path fields miss.
    // Without it, decision_traces summarised to "" (their content lives in
    // decision_type/human_selection/rationale_captured) and structured artifacts
    // (component_model, interface_contracts, …) collapsed to a bare `[kind]`
    // label, so the Stage-7 synthesis had nothing to reason over.
    const recordType = typeof record.record_type === 'string' ? record.record_type : '';
    const kind = typeof content.kind === 'string' ? content.kind : recordType;
    const distilled = this.distillContentSummary(kind, content, focusComponentId);
    if (distilled) return distilled.slice(0, 500);

    if (kind) return `[${kind}]`;
    return '';
  }

  /**
   * Record-type-aware content distillation — turns a structured artifact /
   * decision record into a bounded, substantive summary instead of a `[kind]`
   * label or empty string. When `focusComponentId` is supplied, structured
   * artifacts are scoped to THAT component (a per-leaf executor DMR sees its own
   * governing detail, not the whole project). Best-effort + defensive: any
   * shape mismatch yields '' so the caller falls back to the `[kind]` label.
   */
  private distillContentSummary(
    kind: string,
    content: Record<string, unknown>,
    focusComponentId?: string,
  ): string {
    const arr = (v: unknown): Record<string, unknown>[] =>
      Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const focus = focusComponentId?.toLowerCase();
    const matchesFocus = (id: unknown): boolean =>
      !!focus && typeof id === 'string' && id.toLowerCase() === focus;

    try {
      // Human decisions — the substance lives in fields the fast-path never
      // reads. Prefer the canonical selection/rationale (populated by a real or
      // simulated decision-maker); otherwise derive from what the DecisionRouter
      // actually writes (decision_type / attribution / option_id / action /
      // payload bundle) so an auto-approved trace still summarises as "what
      // happened" instead of "".
      if (kind === 'decision_trace' || /decision|override|approval/.test(kind)) {
        const dt = str(content.decision_type) || kind || 'decision';
        const sel = str(content.human_selection) || str(content.option_id) || str(content.action);
        const rat = str(content.rationale_captured);
        const ctxP = str(content.context_presented);
        const attribution = str(content.attribution);
        const autoBy = str(content.auto_approved_by);
        const payload = (content.payload && typeof content.payload === 'object')
          ? content.payload as Record<string, unknown> : {};
        const menu = arr(payload.menu_selections);
        const mirror = arr(payload.mirror_decisions);
        const bundle = [
          menu.length ? `${menu.length} menu selection(s)` : '',
          mirror.length ? `${mirror.length} mirror decision(s)` : '',
        ].filter(Boolean).join(', ');
        const autoBySuffix = autoBy ? ` by ${autoBy}` : '';
        const attributionLabel = attribution === 'auto_approve'
          ? `auto-approved${autoBySuffix}`
          : attribution;
        const parts = [
          sel && `chose: ${sel}`,
          rat && `rationale: ${rat}`,
          !sel && !rat && attribution && attributionLabel,
          bundle,
          !sel && !rat && !attribution && ctxP && `context: ${ctxP.slice(0, 200)}`,
        ].filter(Boolean);
        return parts.length ? `${dt} — ${parts.join('; ')}` : dt;
      }

      // Component model — the (focus) component's responsibilities.
      if (kind === 'component_model' || content.components) {
        const all = arr(content.components);
        const scoped = focus ? all.filter(c => matchesFocus(c.id) || matchesFocus(c.component_id)) : [];
        const pick = (scoped.length ? scoped : all).slice(0, focus ? 1 : 3);
        return pick.map(c => {
          const id = str(c.id) || str(c.component_id) || str(c.name);
          const resp = arr(c.responsibilities)
            .map(r => str(r.statement) || str(r.description) || str(r)).filter(Boolean);
          return `${id}: ${resp.slice(0, 5).join('; ')}`;
        }).filter(Boolean).join(' | ');
      }

      // Data models — the (focus) component's entities + key fields.
      if (kind === 'data_models' || content.models) {
        const all = arr(content.models);
        const scoped = focus ? all.filter(m => matchesFocus(m.component_id)) : [];
        const pick = (scoped.length ? scoped : all).slice(0, focus ? 3 : 4);
        return pick.map(m => {
          const ents = arr(m.entities).map(e => {
            const fields = arr(e.fields).map(f => str(f.name)).filter(Boolean).slice(0, 6);
            return `${str(e.name)}(${fields.join(',')})`;
          });
          return `${str(m.component_id)}: ${ents.join(', ')}`;
        }).filter(Boolean).join(' | ');
      }

      // Interface contracts — ids + protocol + auth posture.
      if (kind === 'interface_contracts' || content.contracts) {
        return arr(content.contracts).slice(0, 5).map(c =>
          `${str(c.id)}: ${str(c.protocol)}${str(c.auth_mechanism) ? ` auth=${str(c.auth_mechanism)}` : ''}`.trim(),
        ).filter(Boolean).join(' | ');
      }

      // API definitions — endpoint signatures.
      if (kind === 'api_definitions' || content.api_definitions || content.endpoints) {
        const eps = arr(content.api_definitions).length ? arr(content.api_definitions) : arr(content.endpoints);
        return eps.slice(0, 6).map(e =>
          `${str(e.method) || str(e.verb)} ${str(e.path) || str(e.route) || str(e.name)}`.trim(),
        ).filter(Boolean).join(', ');
      }

      // Intent statement — the product concept. Its substance lives in
      // `product_concept` (an object with name/description), which the fast-path
      // never reads, so a certified intent collapsed to `[intent_statement]`.
      if (kind === 'intent_statement' || content.product_concept) {
        const pc = content.product_concept;
        if (pc && typeof pc === 'object') {
          const o = pc as Record<string, unknown>;
          const line = str(o.description) || str(o.name);
          if (line) return line;
        }
        if (typeof pc === 'string' && pc.trim()) return pc;
      }

      // Functional requirements — user-story lines (id + the action/outcome).
      // The certified FR collection holds an array under `user_stories`; each
      // story has no narrative field, so compose one from id + action.
      if (kind === 'functional_requirements' || content.user_stories) {
        return arr(content.user_stories).slice(0, 5).map(s => {
          const id = str(s.id);
          const body = str(s.action) || str(s.outcome) || str(s.role);
          return id || body ? `${id}: ${body}`.trim() : '';
        }).filter(Boolean).join(' | ');
      }

      // Cross-run modification — the applied refactoring that supersedes a
      // prior-run artifact (so the supersession chain says WHAT was applied).
      if (kind === 'cross_run_modification') {
        const mod = str(content.modification_type);
        const changed = str(content.changed_interface_id) || str(content.modified_artifact_id);
        const status = str(content.applied_status);
        const parts = [
          mod && `${mod} change`,
          changed && `to ${changed}`,
          status && `(${status})`,
        ].filter(Boolean);
        return parts.length ? `cross-run modification: ${parts.join(' ')}` : '';
      }

      // Non-functional requirements — id (category): description. The certified
      // NFR collection holds an array under `requirements`.
      if (kind === 'non_functional_requirements' || content.requirements) {
        return arr(content.requirements).slice(0, 5).map(n => {
          const id = str(n.id);
          const cat = str(n.category);
          const desc = str(n.description) || str(n.statement) || str(n.threshold);
          const catSuffix = cat ? ` (${cat})` : '';
          return id || desc ? `${id}${catSuffix}: ${desc}`.trim() : '';
        }).filter(Boolean).join(' | ');
      }

      // Requirements / intent — a name/title line.
      const title = str(content.title) || str(content.name) || str(content.intent) || str(content.requirement);
      if (title) return title;
    } catch { /* fall through to the [kind] label */ }
    return '';
  }

  // ── Record writing ──────────────────────────────────────────────

  private writeRetrievalBriefRecord(brief: RetrievalBrief): string | null {
    if (!this.writer) return null;
    try {
      const rec = this.writer.writeRecord({
        record_type: 'retrieval_brief_record',
        schema_version: '1.0',
        workflow_run_id: brief.workflowRunId,
        phase_id: brief.phaseId as never,
        sub_phase_id: brief.subPhaseId,
        produced_by_agent_role: 'deep_memory_research',
        janumicode_version_sha: this.config.janumiCodeVersionSha,
        content: {
          artifact_type: 'retrieval_brief',
          requesting_agent_role: brief.requestingAgentRole,
          scope_tier: brief.scopeTier,
          query: brief.query,
          known_relevant_record_ids: brief.knownRelevantRecordIds,
          workflow_run_id: brief.workflowRunId,
          phase_id: brief.phaseId,
          sub_phase_id: brief.subPhaseId,
        },
      });
      return rec.id;
    } catch (err) {
      getLogger().warn('dmr', 'Failed to write retrieval_brief_record', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private writeQueryDecompositionRecord(
    brief: RetrievalBrief,
    decomposition: ContextPacket['queryDecomposition'],
    briefRecordId: string | null,
  ): string | null {
    if (!this.writer) return null;
    try {
      const rec = this.writer.writeRecord({
        record_type: 'query_decomposition_record',
        schema_version: '1.0',
        workflow_run_id: brief.workflowRunId,
        phase_id: brief.phaseId as never,
        sub_phase_id: brief.subPhaseId,
        produced_by_agent_role: 'deep_memory_research',
        janumicode_version_sha: this.config.janumiCodeVersionSha,
        derived_from_record_ids: briefRecordId ? [briefRecordId] : [],
        content: {
          kind: 'query_decomposition',
          topic_entities: decomposition.topicEntities,
          decision_types_sought: decomposition.decisionTypesSought,
          temporal_scope: decomposition.temporalScope,
          authority_levels_included: decomposition.authorityLevelsIncluded,
          sources_in_scope: decomposition.sourcesInScope,
          known_conflict_zones: decomposition.knownConflictZones,
        },
      });
      return rec.id;
    } catch (err) {
      getLogger().warn('dmr', 'Failed to write query_decomposition_record', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * One-shot container record summarising all 7 stages of the DMR
   * pipeline. Written at the end of `research()` after every stage
   * journal entry has its final status + timing. The webview's
   * DmrPipelineCard routes on `record_type === 'dmr_pipeline'` and
   * renders the stages inline, with the detail records it references
   * (via `stages[].output_record_id`) nested visually.
   */
  private writeDmrPipelineRecord(
    brief: RetrievalBrief,
    stages: DmrStageEntry[],
    completenessStatus: CompletenessStatus,
    briefRecordId: string | null,
  ): string | null {
    if (!this.writer) return null;
    try {
      const content: DmrPipelineContent = {
        kind: 'dmr_pipeline',
        // `pipeline_id` is filled with the record's own id below — keep
        // the field on content too so consumers that only have the
        // content don't need to reach for the envelope.
        pipeline_id: '',
        requesting_agent_role: brief.requestingAgentRole,
        scope_tier: brief.scopeTier,
        query: brief.query,
        stages,
        completeness_status: completenessStatus,
        retrieval_brief_record_id: briefRecordId ?? undefined,
      };
      const rec = this.writer.writeRecord({
        record_type: 'dmr_pipeline',
        schema_version: '1.0',
        workflow_run_id: brief.workflowRunId,
        phase_id: brief.phaseId as never,
        sub_phase_id: brief.subPhaseId,
        produced_by_agent_role: 'deep_memory_research',
        janumicode_version_sha: this.config.janumiCodeVersionSha,
        derived_from_record_ids: briefRecordId ? [briefRecordId] : [],
        content: { ...content, pipeline_id: '' } as unknown as Record<string, unknown>,
      });
      // Patch pipeline_id to the actual record id. The UPDATE keeps
      // the record's identity stable — the content field is the only
      // surface the webview reads for pipeline_id.
      this.db.prepare(
        `UPDATE governed_stream SET content = json_set(content, '$.pipeline_id', ?) WHERE id = ?`,
      ).run(rec.id, rec.id);
      return rec.id;
    } catch (err) {
      getLogger().warn('dmr', 'Failed to write dmr_pipeline record', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private writeContextPacketRecord(
    brief: RetrievalBrief,
    packet: ContextPacket,
    briefRecordId: string | null,
    decompRecordId: string | null,
  ): string | null {
    if (!this.writer) return null;
    try {
      const derivedFrom: string[] = [];
      if (briefRecordId) derivedFrom.push(briefRecordId);
      if (decompRecordId) derivedFrom.push(decompRecordId);
      for (const f of packet.materialFindings.slice(0, 20)) {
        derivedFrom.push(f.id);
      }

      const rec = this.writer.writeRecord({
        record_type: 'context_packet',
        schema_version: '1.0',
        workflow_run_id: brief.workflowRunId,
        phase_id: brief.phaseId as never,
        sub_phase_id: brief.subPhaseId,
        produced_by_agent_role: 'deep_memory_research',
        janumicode_version_sha: this.config.janumiCodeVersionSha,
        derived_from_record_ids: derivedFrom,
        content: contextPacketToJson(packet),
      });
      return rec.id;
    } catch (err) {
      getLogger().warn('dmr', 'Failed to write context_packet record', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

/**
 * Convert the TS camelCase ContextPacket to the spec's snake_case JSON form
 * matching `context_packet.schema.json`.
 */
export function contextPacketToJson(packet: ContextPacket): Record<string, unknown> {
  return {
    artifact_type: 'context_packet',
    schema_version: '1.0',
    query_decomposition: {
      topic_entities: packet.queryDecomposition.topicEntities,
      decision_types_sought: packet.queryDecomposition.decisionTypesSought,
      temporal_scope: packet.queryDecomposition.temporalScope,
      authority_levels_included: packet.queryDecomposition.authorityLevelsIncluded,
      sources_in_scope: packet.queryDecomposition.sourcesInScope,
      known_conflict_zones: packet.queryDecomposition.knownConflictZones,
    },
    completeness_status: packet.completenessStatus,
    decision_context_summary: packet.decisionContextSummary,
    completeness_narrative: packet.completenessNarrative,
    unavailable_sources: packet.unavailableSources.map(s => ({
      source: s.source,
      reason: s.reason,
      materiality: s.materiality,
      materiality_explanation: s.materialityExplanation,
      recommendation: s.recommendation,
    })),
    material_findings: packet.materialFindings.map(f => ({
      id: f.id,
      record_type: f.recordType,
      authority_level: f.authorityLevel,
      governing_status: f.governingStatus,
      summary: f.summary,
      source_record_ids: f.sourceRecordIds,
      materiality_score: f.materialityScore,
    })),
    active_constraints: packet.activeConstraints.map(c => ({
      id: c.id,
      statement: c.statement,
      authority_level: c.authorityLevel,
      source_record_ids: c.sourceRecordIds,
      binding_class: c.bindingClass,
    })),
    supersession_chains: packet.supersessionChains.map(sc => ({
      subject: sc.subject,
      chain: sc.chain.map(e => ({
        record_id: e.recordId,
        position: e.position,
        timestamp: e.timestamp,
      })),
    })),
    contradictions: packet.contradictions.map(c => ({
      record_ids: c.recordIds,
      explanation: c.explanation,
      resolution_status: c.resolutionStatus,
      ...(c.resolvedByRecordId ? { resolved_by_record_id: c.resolvedByRecordId } : {}),
    })),
    open_questions: packet.openQuestions.map(oq => ({
      question: oq.question,
      first_raised: oq.firstRaised,
      still_unresolved: oq.stillUnresolved,
      source_record_id: oq.sourceRecordId,
    })),
    implicit_decisions: packet.implicitDecisions.map(id => ({
      inferred_decision: id.inferredDecision,
      basis: id.basis,
      confidence: id.confidence,
      source_record_ids: id.sourceRecordIds,
    })),
    recommended_drilldowns: packet.recommendedDrilldowns.map(rd => ({
      target_record_id: rd.targetRecordId,
      reason: rd.reason,
    })),
    coverage_assessment: {
      sources_queried: packet.coverageAssessment.sourcesQueried,
      sources_unavailable: packet.coverageAssessment.sourcesUnavailable,
      known_gaps: packet.coverageAssessment.knownGaps,
      confidence: packet.coverageAssessment.confidence,
    },
  };
}

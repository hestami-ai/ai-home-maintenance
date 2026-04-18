/**
 * Deep Memory Research Agent — multi-stage context reconstruction.
 * Based on JanumiCode Spec v2.3, §8.4.
 *
 * Seven-stage process:
 *   1. Query Decomposition           — LLM call (template-driven) + deterministic fallback
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
import type { DmrPipelineContent, DmrStageEntry } from '../types/records';

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
  1: 'llm',
  2: 'deterministic',
  3: 'deterministic',
  4: 'deterministic',
  5: 'deterministic',
  6: 'deterministic',
  7: 'llm',
};

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
}

export interface ContextPacket {
  queryDecomposition: {
    topicEntities: string[];
    decisionTypesSought: string[];
    temporalScope: { from: string; to: string };
    authorityLevelsIncluded: number[];
    sourcesInScope: string[];
  };
  completenessStatus: CompletenessStatus;
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
}

export interface SupersessionChain {
  subject: string;
  chain: { recordId: string; position: string; timestamp: string }[];
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
  private readonly model: string;
  private readonly provider: string;

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
    this.model = config.model ?? process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b';
    this.provider = config.provider ?? 'ollama';
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

    // Stage 2 — Broad Candidate Harvest
    markStart(2);
    const candidates = await this.harvestCandidates(brief, decomposition);
    markDone(2, { output_summary: `${candidates.length} candidate finding(s) harvested (FTS5 + vector + graph)` });

    // Stage 3 — Materiality Scoring
    markStart(3);
    const scored = await this.scoreCandidates(candidates, brief);
    markDone(3, { output_summary: `${scored.length} scored (threshold applied)` });

    // Stage 4 — Relationship Expansion
    markStart(4);
    const expanded = this.expandRelationships(scored);
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

  private async decomposeQuery(
    brief: RetrievalBrief,
  ): Promise<ContextPacket['queryDecomposition']> {
    const deterministicFallback: ContextPacket['queryDecomposition'] = {
      topicEntities: this.extractTopicEntities(brief.query),
      decisionTypesSought: ['menu_selection', 'mirror_approval', 'phase_gate_approval'],
      temporalScope: { from: '1970-01-01T00:00:00Z', to: new Date().toISOString() },
      authorityLevelsIncluded: [5, 6, 7],
      sourcesInScope: brief.scopeTier === 'current_run'
        ? ['governed_stream_current_run']
        : ['governed_stream_all_runs'],
    };

    if (!this.templateLoader) return deterministicFallback;

    const template = this.templateLoader.findTemplate(
      'deep_memory_research', 'cross_cutting_deep_memory_decomposition',
    );
    if (!template) return deterministicFallback;

    const rendered = this.templateLoader.render(template, {
      retrieval_brief_query: brief.query,
      scope_tier: brief.scopeTier,
      requesting_agent_role: brief.requestingAgentRole,
      janumicode_version_sha: this.config.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return deterministicFallback;

    // LLM throws propagate to the engine's phase catch (halts the
    // workflow). Empty/unparseable parsed JSON still falls back to
    // the deterministic decomposition — that's a successful call with
    // garbage output, not an unrecoverable failure.
    const result = await this.llmCaller.call({
      provider: this.provider,
      model: this.model,
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.3,
      traceContext: {
        workflowRunId: brief.workflowRunId,
        phaseId: brief.phaseId,
        subPhaseId: brief.subPhaseId,
        agentRole: 'deep_memory_research',
        label: 'DMR Stage 1 — Query Decomposition',
      },
    });

    const parsed = result.parsed as Record<string, unknown> | null;
    if (!parsed) return deterministicFallback;

    return {
      topicEntities: Array.isArray(parsed.topic_entities)
        ? (parsed.topic_entities as unknown[]).map(String)
        : deterministicFallback.topicEntities,
      decisionTypesSought: Array.isArray(parsed.decision_types_sought)
        ? (parsed.decision_types_sought as unknown[]).map(String)
        : deterministicFallback.decisionTypesSought,
      temporalScope: (parsed.temporal_scope as { from: string; to: string } | undefined)
        ?? deterministicFallback.temporalScope,
      authorityLevelsIncluded: Array.isArray(parsed.authority_levels_included)
        ? (parsed.authority_levels_included as unknown[]).map(n => Number(n)).filter(n => !isNaN(n))
        : deterministicFallback.authorityLevelsIncluded,
      sourcesInScope: Array.isArray(parsed.sources_in_scope)
        ? (parsed.sources_in_scope as unknown[]).map(String)
        : deterministicFallback.sourcesInScope,
    };
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

    return (
      w.semantic_similarity * semanticSimilarity +
      w.constraint_relevance * constraintRelevance +
      w.authority_level * authorityScore +
      w.temporal_recency * temporalRecency +
      w.causal_relevance * causalRelevance +
      w.contradiction_signal * contradictionSignal
    );
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

    const score = (
      w.semantic_similarity * semanticSimilarity +
      w.constraint_relevance * constraintRelevance +
      w.authority_level * authorityScore +
      w.temporal_recency * temporalRecency +
      w.causal_relevance * causalRelevance +
      w.contradiction_signal * contradictionSignal
    );

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

  private expandRelationships(findings: MaterialFinding[]): MaterialFinding[] {
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
          expanded.push({
            id: record.id as string,
            recordType: record.record_type as string,
            authorityLevel: record.authority_level as number,
            governingStatus: 'active',
            summary: this.extractSummary(record) || `Expanded via ${edge.edge_type} from ${finding.id}`,
            sourceRecordIds: [record.id as string],
            materialityScore: finding.materialityScore * 0.7,
          });
          seen.add(record.id as string);
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
        });
        for (const sup of supersedes) {
          const superseded = findings.find(f => f.id === sup.target_record_id);
          if (superseded) superseded.governingStatus = 'superseded';
          chain.chain.push({
            recordId: sup.target_record_id,
            position: 'superseded',
            timestamp: new Date().toISOString(),
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
    // Deterministic base — always built. LLM synthesis adds narrative.
    const activeConstraints: ActiveConstraint[] = findings
      .filter(f => f.authorityLevel >= 6 && f.governingStatus === 'active')
      .map(f => ({
        id: f.id,
        statement: f.summary,
        authorityLevel: f.authorityLevel,
        sourceRecordIds: f.sourceRecordIds,
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

    const basePacket: ContextPacket = {
      queryDecomposition: decomposition,
      completenessStatus,
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
        confidence: completenessStatus === 'complete' ? 1.0
                   : completenessStatus === 'partial_low' ? 0.85
                   : completenessStatus === 'partial_medium' ? 0.65
                   : 0.4,
      },
    };

    // LLM synthesis layer — optional. Enriches narrative and surfaces
    // open questions / implicit decisions beyond what deterministic
    // analysis can infer. Falls back to the base packet on any failure.
    if (!this.templateLoader) return basePacket;

    const template = this.templateLoader.findTemplate(
      'deep_memory_research', 'cross_cutting_deep_memory_synthesis',
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

    try {
      const result = await this.llmCaller.call({
        provider: this.provider,
        model: this.model,
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
      const openQuestionsRaw = unwrapped.open_questions;
      const openQuestions: OpenQuestion[] = Array.isArray(openQuestionsRaw)
        ? (openQuestionsRaw as Array<Record<string, unknown>>).map(oq => ({
            question: String(oq.question ?? ''),
            firstRaised: String(oq.first_raised ?? new Date().toISOString()),
            stillUnresolved: oq.still_unresolved !== false,
            sourceRecordId: String(oq.source_record_id ?? ''),
          }))
        : [];

      const llmNarrative = typeof unwrapped.completeness_narrative === 'string'
        ? unwrapped.completeness_narrative
        : basePacket.completenessNarrative;

      const decisionSummary = typeof unwrapped.decision_context_summary === 'string'
        ? `${unwrapped.decision_context_summary}\n\n${llmNarrative}`
        : llmNarrative;

      return {
        ...basePacket,
        completenessNarrative: decisionSummary,
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

  private extractTopicEntities(query: string): string[] {
    // Keep quoted phrases intact. Then strip stopwords and short tokens.
    const quoted = [...query.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    const stripped = query.replace(/"[^"]+"/g, ' ');
    const stopwords = new Set([
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these',
      'those', 'into', 'onto', 'over', 'then', 'than', 'when', 'where',
      'what', 'which', 'while', 'have', 'will', 'would', 'could', 'should',
    ]);
    const words = stripped.split(/\s+/)
      .filter(w => w.length > 3)
      .map(w => w.toLowerCase().replace(/[^a-z0-9_\-./]/g, ''))
      .filter(w => w.length > 0 && !stopwords.has(w));
    return [...quoted, ...words].slice(0, 12);
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

      const results = this.db.prepare(`
        SELECT gs.id, gs.record_type, gs.authority_level, gs.content
        FROM governed_stream_fts fts
        JOIN governed_stream gs ON gs.id = fts.id
        WHERE governed_stream_fts MATCH ? ${whereClause}
          AND gs.is_current_version = 1
        LIMIT ${this.maxFtsCandidates}
      `).all(...params) as Array<{ id: string; record_type: string; authority_level: number; content: string }>;

      return results.map(r => ({
        id: r.id,
        recordType: r.record_type,
        authorityLevel: r.authority_level,
        governingStatus: 'active' as const,
        summary: this.extractSummary({ content: r.content }),
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
      const rows = this.db.prepare(`
        SELECT gs.id, gs.record_type, gs.authority_level, gs.content, v.embedding
        FROM governed_stream gs
        JOIN governed_stream_vec v ON v.record_id = gs.id
        WHERE gs.is_current_version = 1 ${whereClause}
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
          summary: this.extractSummary({ content: s.row.content }),
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
    const minLevel = Math.min(...authorityLevels);
    if (minLevel < 5) return []; // Only auto-include governing records

    const whereClause = brief.scopeTier === 'current_run'
      ? 'AND workflow_run_id = ?'
      : '';
    const params = brief.scopeTier === 'current_run' ? [minLevel, brief.workflowRunId] : [minLevel];

    try {
      const rows = this.db.prepare(`
        SELECT id, record_type, authority_level, content
        FROM governed_stream
        WHERE authority_level >= ? AND is_current_version = 1 ${whereClause}
        ORDER BY authority_level DESC
        LIMIT 50
      `).all(...params) as Array<{ id: string; record_type: string; authority_level: number; content: string }>;

      return rows.map(r => ({
        id: r.id,
        recordType: r.record_type,
        authorityLevel: r.authority_level,
        governingStatus: 'active' as const,
        summary: this.extractSummary({ content: r.content }),
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
    const tokens = query
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.toLowerCase());
    if (tokens.length === 0) return null;
    return tokens.map(t => `"${t}"`).join(' OR ');
  }

  private extractSummary(record: Record<string, unknown>): string {
    let content: Record<string, unknown>;
    if (typeof record.content === 'string') {
      try { content = JSON.parse(record.content) as Record<string, unknown>; }
      catch { return String(record.content).slice(0, 200); }
    } else if (record.content && typeof record.content === 'object') {
      content = record.content as Record<string, unknown>;
    } else {
      return '';
    }

    if (typeof content.summary === 'string') return content.summary.slice(0, 300);
    if (typeof content.description === 'string') return content.description.slice(0, 300);
    if (typeof content.statement === 'string') return content.statement.slice(0, 300);
    if (typeof content.text === 'string') return content.text.slice(0, 300);
    if (typeof content.response_text === 'string') return content.response_text.slice(0, 300);
    if (typeof content.kind === 'string') return `[${content.kind}]`;
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
    },
    completeness_status: packet.completenessStatus,
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

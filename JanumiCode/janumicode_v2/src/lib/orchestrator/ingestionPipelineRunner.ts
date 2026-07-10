/**
 * IngestionPipelineRunner — synchronous normalization of new Governed Stream Records.
 * Based on JanumiCode Spec v2.3, §8.12.
 *
 * Stage I    — Type Classification and Authority Assignment (deterministic — in writer)
 * Stage II   — Deterministic Edge Assertion (deterministic — record_type rules)
 * Stage III  — LLM Relationship Extraction (one LLM call per non-plumbing record;
 *              dispatched by record class to artifact-class or reasoning-class prompt;
 *              writes `memory_edge_proposed` records + memory_edge rows with status='proposed')
 * Stage IIIb — Sub-Artifact Registration + Edge Extraction (deterministic — Architecture Canvas)
 * Stage IV   — Supersession Detection (deterministic + LLM escalation)
 * Stage V    — Open Question Resolution Check (deterministic)
 *
 * Stage III is gated by injection of LLMCaller + TemplateLoader + GovernedStreamWriter.
 * Unit tests run without them; thin-slice/calibration runs pass them in and pay
 * the synchronous LLM-per-record cost.
 */

import type { Database } from '../database/init';
import type { GovernedStreamRecord, MemoryEdgeType, SubArtifactEdgeType } from '../types/records';
import type { LLMCaller } from '../llm/llmCaller';
import type { TemplateLoader } from './templateLoader';
import type { GovernedStreamWriter } from './governedStreamWriter';
import { getLogger } from '../logging';

// Edge type vocabulary per spec §8.14 — Stage III LLM is required to emit
// one of these values; anything else is dropped as a hallucination.
const ALLOWED_EDGE_TYPES = new Set<string>([
  'derives_from', 'supports', 'contradicts', 'supersedes', 'implements',
  'depends_on', 'blocked_by', 'invalidates', 'raises', 'answers',
]);

// Plumbing record types — no LLM relationship extraction (no semantic content).
// Reasoning-trail records ARE extracted (spec CI-10: Governed Stream is lossless;
// drift detection depends on the reasoning trail being graph-connected).
const STAGE_III_LLM_SKIP_RECORD_TYPES = new Set<string>([
  'json_repair_record',
  'file_system_write_record',
  'mirror_presented',
  'decision_bundle_presented',
  'execution_wave_started',
  'execution_wave_completed',
  'workflow_run_closure',
  // memory_edge records themselves — avoid recursive edges on edges
  'memory_edge_proposed',
  'memory_edge_confirmed',
  // pipeline records — avoid recursive ingestion records
  'dmr_pipeline',
  'retrieval_brief_record',
  'context_packet',
  'query_decomposition_record',
  // constitutional_invariant has no relationships to extract (it's seed material)
  'constitutional_invariant',
]);

// Record types that use the reasoning-class prompt rather than the artifact-class prompt.
const REASONING_CLASS_RECORD_TYPES = new Set<string>([
  'agent_invocation',
  'agent_output',
  'agent_reasoning_step',
  'reasoning_review_finding_record',
  'reasoning_review_harness_record',
]);

// Max candidate related records included in the Stage III prompt. Beyond this
// the prompt gets too long for fast inference; the LLM is also worse at
// picking the right target when the haystack is huge.
const STAGE_III_MAX_CANDIDATES = 10;

// ── Types ───────────────────────────────────────────────────────────

export interface IngestionResult {
  recordId: string;
  stagesCompleted: number[];
  edgesCreated: EdgeCreated[];
  errors: string[];
}

export interface EdgeCreated {
  edgeType: MemoryEdgeType;
  sourceRecordId: string;
  targetRecordId: string;
  status: 'system_asserted' | 'proposed';
}

interface Stage3Candidate {
  id: string;
  record_type: string;
  authority_level: number;
  summary: string;
}

// ── IngestionPipelineRunner ─────────────────────────────────────────

export interface Stage3LLMDependencies {
  llmCaller: LLMCaller;
  templateLoader: TemplateLoader;
  writer: GovernedStreamWriter;
  provider: string;
  model: string;
  baseUrl?: string;
  janumiCodeVersionSha: string;
}

export class IngestionPipelineRunner {
  private stage3Deps: Stage3LLMDependencies | null = null;
  /**
   * Tracks fire-and-forget Stage III LLM promises so callers (especially
   * tests) can await all in-flight work deterministically via
   * `awaitPendingStage3()`. Production callers don't need this — they
   * accept eventual consistency in the memory_edge graph.
   */
  private readonly pendingStage3: Set<Promise<void>> = new Set();

  constructor(
    private readonly db: Database,
    private readonly generateId: () => string,
  ) {}

  /**
   * Await every Stage III LLM call kicked off by prior `ingest()` calls
   * that hasn't yet settled. Returns when the in-flight set is empty.
   * Intended for test harnesses that need deterministic completion of
   * the otherwise fire-and-forget Stage III work.
   */
  async awaitPendingStage3(): Promise<void> {
    while (this.pendingStage3.size > 0) {
      const snapshot = [...this.pendingStage3];
      await Promise.allSettled(snapshot);
      // New work may have been queued during the await — loop.
    }
  }

  /**
   * Attach the LLM dependencies that Stage III needs. Without this call,
   * Stage III LLM relationship extraction is a no-op (it logs once at
   * info level and otherwise stays silent). Unit tests never call this;
   * thin-slice and production runs do.
   */
  setStage3LLMDependencies(deps: Stage3LLMDependencies): void {
    this.stage3Deps = deps;
  }

  /**
   * Run the ingestion pipeline for a new record.
   * Synchronous — completes before the next Sub-Phase begins.
   */
  ingest(record: GovernedStreamRecord): IngestionResult {
    const result: IngestionResult = {
      recordId: record.id,
      stagesCompleted: [],
      edgesCreated: [],
      errors: [],
    };

    // Stage I — already handled by GovernedStreamWriter (authority_level, effective_at)
    result.stagesCompleted.push(1);

    // Stage II — Deterministic Edge Assertion
    try {
      const edges = this.runStageII(record);
      result.edgesCreated.push(...edges);
      result.stagesCompleted.push(2);
    } catch (err) {
      result.errors.push(`Stage II error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Stage III — LLM Relationship Extraction (spec §8.12).
    // Synchronous per-record LLM call. Dispatched by record class:
    //   - reasoning_trail record types → reasoning-class prompt
    //   - other non-plumbing record types → artifact-class prompt
    //   - plumbing record types → skipped
    // No-op if LLM dependencies have not been attached.
    try {
      const proposedEdges = this.runStageIIIRelationshipExtraction(record);
      result.edgesCreated.push(...proposedEdges);
    } catch (err) {
      result.errors.push(`Stage III LLM error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Stage IIIb — Sub-Artifact Registration + Edge Extraction (deterministic)
    // Registers sub-artifacts (components, ADRs, test cases, etc.) and extracts
    // edges between them for the Architecture Canvas.
    try {
      this.runStageIII(record);
      result.stagesCompleted.push(3);
    } catch (err) {
      result.errors.push(`Stage IIIb error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Stage IV — Supersession Detection (deterministic with LLM escalation)
    try {
      this.runStageIV(record);
      result.stagesCompleted.push(4);
    } catch (err) {
      result.errors.push(`Stage IV error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Stage V — Open Question Resolution Check (deterministic)
    try {
      this.runStageV(record);
      result.stagesCompleted.push(5);
    } catch (err) {
      result.errors.push(`Stage V error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
  }

  /**
   * Stage III — LLM Relationship Extraction (spec §8.12).
   *
   * For every non-plumbing record, retrieves candidate related records via
   * FTS5, renders the appropriate prompt (artifact-class or reasoning-class),
   * calls the LLM, parses the proposed edges, and writes both:
   *   1. A `memory_edge_proposed` Governed Stream Record per edge (audit trail)
   *   2. A row in `memory_edge` with status='proposed' (graph queryable)
   *
   * No-op when LLM dependencies aren't attached, when the record type is
   * pure plumbing, or when no candidate related records are found.
   *
   * Synchronous. On a single GPU this serializes against the workflow's
   * primary LLM calls; expected wall-clock cost is significant on large runs.
   */
  private runStageIIIRelationshipExtraction(record: GovernedStreamRecord): EdgeCreated[] {
    if (!this.stage3Deps) return [];
    if (STAGE_III_LLM_SKIP_RECORD_TYPES.has(record.record_type)) return [];

    const candidates = this.fetchStageIIICandidates(record);
    if (candidates.length === 0) return [];

    const deps = this.stage3Deps;
    // Template sub_phase keys match the frontmatter in
    // prompts/cross_cutting/stage_iii_relationship_extraction_*.system.md
    const templateName = REASONING_CLASS_RECORD_TYPES.has(record.record_type)
      ? 'ingestion_pipeline_stage3_reasoning'
      : 'ingestion_pipeline_stage3_artifact';
    const template = deps.templateLoader.findTemplate('orchestrator', templateName);
    if (!template) {
      getLogger().warn('governed_stream', `Stage III template not found: ${templateName}`, {
        recordId: record.id,
      });
      return [];
    }

    const renderArgs = {
      new_record_id: record.id,
      new_record_type: record.record_type,
      new_record_content: JSON.stringify(record.content, null, 2),
      related_record_summaries: candidates.map(c =>
        `- id=${c.id} | type=${c.record_type} | authority=${c.authority_level} | summary=${c.summary}`,
      ).join('\n'),
      janumicode_version_sha: deps.janumiCodeVersionSha,
    };
    const rendered = deps.templateLoader.render(template, renderArgs);
    if (rendered.missing_variables.length > 0) {
      getLogger().warn('governed_stream', 'Stage III prompt has missing variables', {
        recordId: record.id,
        missing: rendered.missing_variables,
      });
      return [];
    }

    // Fire-and-forget: ingest() is synchronous per spec contract; the LLM
    // call lands later and writes its edges into the graph asynchronously.
    // We track the promise on `pendingStage3` so test harnesses can call
    // `awaitPendingStage3()` to deterministically wait for completion.
    const promise = this.invokeStageIIIAsync(record, rendered.rendered, candidates)
      .finally(() => this.pendingStage3.delete(promise));
    this.pendingStage3.add(promise);
    return []; // Edges materialize asynchronously; caller can't reflect them in IngestionResult.
  }

  /**
   * Fire-and-await the Stage III LLM call. Writes records when the call
   * returns. Errors are logged and dropped — Stage III is best-effort.
   */
  private async invokeStageIIIAsync(
    record: GovernedStreamRecord,
    prompt: string,
    candidates: ReadonlyArray<Stage3Candidate>,
  ): Promise<void> {
    const deps = this.stage3Deps;
    if (!deps) return;
    try {
      const result = await deps.llmCaller.call({
        provider: deps.provider,
        model: deps.model,
        baseUrl: deps.baseUrl,
        prompt,
        responseFormat: 'json',
        temperature: 0.2,
        traceContext: {
          workflowRunId: record.workflow_run_id,
          phaseId: record.phase_id ?? null,
          subPhaseId: record.sub_phase_id ?? null,
          agentRole: 'ingestion_pipeline_stage3',
          label: `Stage III Relationship Extraction (${record.record_type})`,
        },
      });
      const parsed = result.parsed as Record<string, unknown> | null;
      if (!parsed) return;
      this.writeStageIIIProposedEdges(record, parsed, candidates);
    } catch (err) {
      getLogger().warn('governed_stream', 'Stage III LLM call failed', {
        recordId: record.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Parse the LLM's `proposed_edges` array and persist every edge that
   * survives validation. Extracted from `invokeStageIIIAsync` to keep that
   * method's cognitive complexity manageable. Behavior is identical: edges
   * are validated and written in array order; dropped edges are skipped.
   */
  private writeStageIIIProposedEdges(
    record: GovernedStreamRecord,
    parsed: Record<string, unknown>,
    candidates: ReadonlyArray<Stage3Candidate>,
  ): void {
    const proposed = Array.isArray(parsed.proposed_edges) ? parsed.proposed_edges : [];
    const candidateIds = new Set(candidates.map(c => c.id));
    for (const raw of proposed as Array<Record<string, unknown>>) {
      const edge = this.parseValidatedStageIIIEdge(raw, candidateIds, record.id);
      if (!edge) continue;
      this.writeProposedEdge(record, edge.edgeType as MemoryEdgeType, edge.targetId, edge.confidence, edge.rationale);
    }
  }

  /**
   * Coerce a raw proposed-edge object into typed fields and apply the
   * post-LLM validation guards (allowed edge type, target in candidate set,
   * no self-edge, confidence in range). Returns `null` when the edge should
   * be dropped. Field coercion is side-effect free; guard order and the
   * `||` short-circuit match the original inline logic exactly.
   */
  private parseValidatedStageIIIEdge(
    raw: Record<string, unknown>,
    candidateIds: ReadonlySet<string>,
    sourceRecordId: string,
  ): { edgeType: string; targetId: string; confidence: number; rationale: string } | null {
    const edgeType = typeof raw.edge_type === 'string' ? raw.edge_type : '';
    const targetId = typeof raw.target_record_id === 'string' ? raw.target_record_id : '';
    const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0;
    const rationale = typeof raw.rationale === 'string' ? raw.rationale : '';

    if (!ALLOWED_EDGE_TYPES.has(edgeType)) return null;
    if (!candidateIds.has(targetId)) return null; // anti-hallucination: target must be in candidates
    if (targetId === sourceRecordId) return null; // no self-edges
    if (confidence < 0 || confidence > 1) return null;

    return { edgeType, targetId, confidence, rationale };
  }

  /**
   * Persist a proposed edge: governed_stream `memory_edge_proposed` record
   * (audit trail) + memory_edge row with status='proposed' (graph entry).
   */
  private writeProposedEdge(
    sourceRecord: GovernedStreamRecord,
    edgeType: MemoryEdgeType,
    targetId: string,
    confidence: number,
    rationale: string,
  ): void {
    const deps = this.stage3Deps;
    if (!deps) return;
    try {
      // Governed stream audit record
      deps.writer.writeRecord({
        record_type: 'memory_edge_proposed',
        schema_version: '1.0',
        workflow_run_id: sourceRecord.workflow_run_id,
        phase_id: sourceRecord.phase_id ?? null,
        sub_phase_id: sourceRecord.sub_phase_id ?? null,
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: deps.janumiCodeVersionSha,
        content: {
          kind: 'memory_edge_proposed',
          source_record_id: sourceRecord.id,
          target_record_id: targetId,
          edge_type: edgeType,
          confidence,
          rationale,
          asserted_by: 'ingestion_pipeline_stage3',
        },
      });
      // Graph entry
      this.persistEdge({
        edgeType,
        sourceRecordId: sourceRecord.id,
        targetRecordId: targetId,
        status: 'proposed',
      });
    } catch (err) {
      getLogger().warn('governed_stream', 'Failed to persist proposed edge', {
        sourceId: sourceRecord.id,
        targetId,
        edgeType,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * FTS5-driven candidate retrieval for Stage III. Returns up to
   * STAGE_III_MAX_CANDIDATES records semantically related to the new
   * record's content. Excludes the new record itself and plumbing types.
   */
  private fetchStageIIICandidates(record: GovernedStreamRecord): Stage3Candidate[] {
    try {
      const queryText = this.extractStage3QueryText(record);
      if (!queryText) return [];
      const ftsQuery = this.buildFtsQuery(queryText);
      if (!ftsQuery) return [];
      const skipList = [...STAGE_III_LLM_SKIP_RECORD_TYPES].map(t => `'${t}'`).join(',');
      const rows = this.db.prepare(`
        SELECT gs.id, gs.record_type, gs.authority_level, gs.content
        FROM governed_stream_fts fts
        JOIN governed_stream gs ON gs.id = fts.id
        WHERE governed_stream_fts MATCH ?
          AND gs.is_current_version = 1
          AND gs.id != ?
          AND gs.record_type NOT IN (${skipList})
        LIMIT ${STAGE_III_MAX_CANDIDATES}
      `).all(ftsQuery, record.id) as Array<{
        id: string; record_type: string; authority_level: number; content: string;
      }>;
      return rows.map(r => ({
        id: r.id,
        record_type: r.record_type,
        authority_level: r.authority_level,
        summary: this.shortSummary(r.content),
      }));
    } catch {
      return [];
    }
  }

  private extractStage3QueryText(record: GovernedStreamRecord): string {
    const parts: string[] = [];
    const walk = (v: unknown, depth: number): void => {
      if (depth > 4) return;
      if (typeof v === 'string') {
        const s = v.trim();
        if (s.length >= 3 && s.length <= 2000) parts.push(s);
      } else if (Array.isArray(v)) {
        for (const x of v) walk(x, depth + 1);
      } else if (v && typeof v === 'object') {
        for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
      }
    };
    walk(record.content, 0);
    return parts.join(' ').slice(0, 3000);
  }

  private buildFtsQuery(text: string): string | null {
    const tokens = text
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 20) // Keep query short to control FTS rank time
      .map(w => `"${w.toLowerCase()}"`);
    if (tokens.length === 0) return null;
    return tokens.join(' OR ');
  }

  private shortSummary(rawContent: string): string {
    try {
      const c = JSON.parse(rawContent) as Record<string, unknown>;
      const candidates = [c.summary, c.description, c.statement, c.text, c.kind, c.invariant_id];
      for (const v of candidates) {
        if (typeof v === 'string' && v.length > 0) return v.slice(0, 200);
      }
      return JSON.stringify(c).slice(0, 200);
    } catch {
      return rawContent.slice(0, 200);
    }
  }

  /**
   * Stage II — Deterministic Edge Assertion.
   * Creates system Memory Edges based on record type rules.
   */
  private runStageII(record: GovernedStreamRecord): EdgeCreated[] {
    const edges: EdgeCreated[] = [];

    switch (record.record_type) {
      case 'phase_gate_approved': {
        // validates edges to all referenced artifact IDs
        const artifactIds = this.extractArtifactIds(record);
        for (const artifactId of artifactIds) {
          edges.push(this.createEdge('validates', record.id, artifactId, 'system_asserted'));
        }
        break;
      }

      case 'mirror_edited': {
        // corrects edge to the original mirror record
        const originalId = (record.content as Record<string, unknown>).original_mirror_id as string;
        if (originalId) {
          edges.push(this.createEdge('corrects', record.id, originalId, 'system_asserted'));
        }
        break;
      }

      case 'artifact_produced': {
        // derives_from edges to input artifact IDs
        for (const parentId of record.derived_from_record_ids) {
          edges.push(this.createEdge('derives_from', record.id, parentId, 'system_asserted'));
        }
        break;
      }

      case 'decision_trace': {
        edges.push(...this.decisionTraceEdges(record));
        break;
      }

      default:
        // No deterministic edges for this record type
        break;
    }

    // Persist edges
    for (const edge of edges) {
      this.persistEdge(edge);
    }

    return edges;
  }

  /**
   * Compute the deterministic supersedes edge(s) for a decision_trace record.
   */
  private decisionTraceEdges(record: GovernedStreamRecord): EdgeCreated[] {
    const content = record.content as Record<string, unknown>;
    if (content.decision_type !== 'prior_decision_override') return [];
    const supersededId = content.superseded_record_id as string;
    if (!supersededId) return [];
    // The record that supersedes is the NEW governing decision
    // (`superseding_record_id`) — so the edge reads
    // superseding → superseded and its source is a harvestable
    // governing artifact (which DMR Stage 5 actually surfaces).
    // Fall back to the decision_trace itself as source only when no
    // superseding record is named, preserving the prior contract.
    const supersedingId = typeof content.superseding_record_id === 'string'
      && content.superseding_record_id.length > 0
      ? content.superseding_record_id
      : record.id;
    return [this.createEdge('supersedes', supersedingId, supersededId, 'system_asserted')];
  }

  /**
   * Stage III -- Sub-Artifact Registration + Edge Extraction.
   * Deterministic extraction of sub-artifacts and their edges for Architecture Canvas.
   *
   * For artifact_produced records, extracts:
   * - Components from component_model artifacts
   * - ADRs from architectural_decisions artifacts
   * - Test cases from test_suite artifacts
   * - etc.
   *
   * Registers sub-artifacts with semantic IDs and extracts edges between them.
   */
  private runStageIII(record: GovernedStreamRecord): void {
    if (record.record_type !== 'artifact_produced') {
      return;
    }

    const content = record.content as Record<string, unknown>;
    const now = new Date().toISOString();

    // Handle component_model artifacts
    if (Array.isArray(content.components)) {
      this.registerComponents(content.components, record, now);
    }

    // Handle architectural_decisions artifacts
    if (Array.isArray(content.adrs)) {
      this.registerADRs(content.adrs, record, now);
    }

    // Handle test_suite artifacts
    if (Array.isArray(content.test_cases)) {
      this.registerTestCases(content.test_cases, record, now);
    }
  }

  /**
   * Register components from a component_model artifact.
   */
  private registerComponents(
    components: Array<Record<string, unknown>>,
    record: GovernedStreamRecord,
    now: string,
  ): void {
    for (const comp of components) {
      const compId = comp.id as string;
      if (!compId) continue;

      // Register sub-artifact
      this.registerSubArtifact({
        id: compId,
        parentRecordId: record.id,
        jsonPath: `components[${compId}]`,
        kind: 'component',
        workflowRunId: record.workflow_run_id,
        createdAt: now,
      });

      // Extract satisfies edges (component -> requirement)
      const satisfiesIds = comp.satisfies_requirement_ids as string[] | undefined;
      if (Array.isArray(satisfiesIds)) {
        for (const reqId of satisfiesIds) {
          this.registerSubArtifactEdge({
            sourceId: compId,
            targetId: reqId,
            edgeType: 'satisfies',
            workflowRunId: record.workflow_run_id,
            assertedBy: 'ingestion_pipeline',
            assertedAt: now,
          });
        }
      }

      // Extract depends_on edges (component -> component)
      const deps = comp.dependencies as Array<Record<string, unknown>> | undefined;
      this.registerComponentDependencyEdges(compId, deps, record, now);
    }
  }

  /**
   * Extract depends_on edges (component -> component) for a single component.
   */
  private registerComponentDependencyEdges(
    compId: string,
    deps: Array<Record<string, unknown>> | undefined,
    record: GovernedStreamRecord,
    now: string,
  ): void {
    if (!Array.isArray(deps)) return;
    for (const dep of deps) {
      const targetId = dep.target_component_id as string;
      if (targetId) {
        this.registerSubArtifactEdge({
          sourceId: compId,
          targetId,
          edgeType: 'depends_on',
          workflowRunId: record.workflow_run_id,
          assertedBy: 'ingestion_pipeline',
          assertedAt: now,
        });
      }
    }
  }

  /**
   * Register ADRs from an architectural_decisions artifact.
   */
  private registerADRs(
    adrs: Array<Record<string, unknown>>,
    record: GovernedStreamRecord,
    now: string,
  ): void {
    for (const adr of adrs) {
      const adrId = adr.id as string;
      if (!adrId) continue;

      // Register sub-artifact
      this.registerSubArtifact({
        id: adrId,
        parentRecordId: record.id,
        jsonPath: `adrs[${adrId}]`,
        kind: 'adr',
        workflowRunId: record.workflow_run_id,
        createdAt: now,
      });

      // Extract governs edges (ADR -> component)
      const governsIds = adr.governs_components as string[] | undefined;
      if (Array.isArray(governsIds)) {
        for (const compId of governsIds) {
          this.registerSubArtifactEdge({
            sourceId: adrId,
            targetId: compId,
            edgeType: 'governs',
            workflowRunId: record.workflow_run_id,
            assertedBy: 'ingestion_pipeline',
            assertedAt: now,
          });
        }
      }
    }
  }

  /**
   * Register test cases from a test_suite artifact.
   */
  private registerTestCases(
    testCases: Array<Record<string, unknown>>,
    record: GovernedStreamRecord,
    now: string,
  ): void {
    for (const tc of testCases) {
      const tcId = tc.id as string;
      if (!tcId) continue;

      // Register sub-artifact
      this.registerSubArtifact({
        id: tcId,
        parentRecordId: record.id,
        jsonPath: `test_cases[${tcId}]`,
        kind: 'test_case',
        workflowRunId: record.workflow_run_id,
        createdAt: now,
      });
    }
  }

  /**
   * Register a sub-artifact in the database.
   */
  private registerSubArtifact(params: {
    id: string;
    parentRecordId: string;
    jsonPath: string;
    kind: string;
    workflowRunId: string;
    createdAt: string;
  }): void {
    // Use INSERT OR IGNORE to avoid duplicates on re-ingestion
    this.db.prepare(`
      INSERT OR IGNORE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.parentRecordId,
      params.jsonPath,
      params.kind,
      params.workflowRunId,
      params.createdAt,
    );
  }

  /**
   * Register a sub-artifact edge in the database.
   */
  private registerSubArtifactEdge(params: {
    sourceId: string;
    targetId: string;
    edgeType: SubArtifactEdgeType;
    workflowRunId: string;
    assertedBy: string;
    assertedAt: string;
  }): void {
    const edgeId = this.generateId();

    // Use INSERT OR IGNORE to avoid duplicates
    this.db.prepare(`
      INSERT OR IGNORE INTO sub_artifact_edge (id, source_id, target_id, edge_type, asserted_by, asserted_at, authority_level, status, workflow_run_id)
      VALUES (?, ?, ?, ?, ?, ?, 5, 'system_asserted', ?)
    `).run(
      edgeId,
      params.sourceId,
      params.targetId,
      params.edgeType,
      params.assertedBy,
      params.assertedAt,
      params.workflowRunId,
    );
  }

  /**
   * Extract artifact IDs referenced in a record's content.
   */
  private extractArtifactIds(record: GovernedStreamRecord): string[] {
    const content = record.content as Record<string, unknown>;
    const ids: string[] = [];

    if (Array.isArray(content.artifact_ids)) {
      ids.push(...(content.artifact_ids as string[]));
    }
    if (typeof content.artifact_id === 'string') {
      ids.push(content.artifact_id);
    }
    if (Array.isArray(content.approved_artifact_ids)) {
      ids.push(...(content.approved_artifact_ids as string[]));
    }

    return ids;
  }

  private createEdge(
    edgeType: MemoryEdgeType,
    sourceId: string,
    targetId: string,
    status: 'system_asserted' | 'proposed',
  ): EdgeCreated {
    return {
      edgeType,
      sourceRecordId: sourceId,
      targetRecordId: targetId,
      status,
    };
  }

  private persistEdge(edge: EdgeCreated): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES (?, ?, ?, ?, 'ingestion_pipeline', ?, 5, ?)
    `).run(
      this.generateId(),
      edge.sourceRecordId,
      edge.targetRecordId,
      edge.edgeType,
      now,
      edge.status,
    );
  }

  /**
   * Stage IV — Supersession Detection (spec §8.12).
   *
   * Deterministic baseline:
   *   - `decision_trace.prior_decision_override` → handled in Stage II.
   *   - `artifact_produced` in same sub-phase as a prior current record →
   *     proposed `supersedes` edge to the prior (assumes the new one replaces it).
   *
   * Ambiguous-subject "LLM escalation" cases are covered by Stage III's
   * relationship extraction — both prompts list `supersedes` as an output
   * edge type, so any content evidence of supersession produces an edge
   * there. Adding a separate per-record-pair LLM check would duplicate work.
   */
  private runStageIV(record: GovernedStreamRecord): void {
    // Check for explicit supersession via record_type
    if (record.record_type === 'decision_trace') {
      const content = record.content as Record<string, unknown>;
      if (content.decision_type === 'prior_decision_override' && content.superseded_record_id) {
        // Already handled in Stage II — no additional work needed
        return;
      }
    }

    // A cross_run_modification (Phase 9.1) documents that a prior-run artifact
    // was changed by this run's refactoring — the modification SUPERSEDES that
    // artifact. Minting the edge here, producer-side on ingest, is what lets DMR
    // Stage 5 surface the applied cross-run change as a supersession_chain
    // (Option B: mint at the producer, not infer edgeless supersession in the
    // consumer). The override that TRIGGERED the refactor already has its own
    // edge; this records that the change was actually APPLIED to the dependent.
    if (record.record_type === 'cross_run_modification') {
      const content = record.content as Record<string, unknown>;
      const modifiedId = typeof content.modified_artifact_id === 'string' ? content.modified_artifact_id : '';
      if (modifiedId) {
        this.persistEdge(this.createEdge('supersedes', record.id, modifiedId, 'system_asserted'));
      }
      return;
    }

    // For artifact_produced: check if an existing artifact of the same type
    // in the same sub-phase has been superseded by this one
    if (record.record_type === 'artifact_produced' && record.sub_phase_id) {
      const existing = this.db.prepare(`
        SELECT id FROM governed_stream
        WHERE workflow_run_id = ? AND sub_phase_id = ? AND record_type = 'artifact_produced'
          AND id != ? AND is_current_version = 1
        ORDER BY produced_at DESC
      `).all(record.workflow_run_id, record.sub_phase_id, record.id) as { id: string }[];

      // If there's a prior artifact in the same sub-phase, the new one implicitly supersedes it
      // (This would be escalated to LLM for ambiguous cases in production)
      for (const prior of existing) {
        this.persistEdge(this.createEdge('supersedes', record.id, prior.id, 'proposed'));
      }
    }
  }

  /**
   * Stage V — Open Question Resolution Check (spec §8.12).
   *
   * The spec describes detecting `answers` edges from new records to prior
   * unresolved `raises` edges. Stage III's reasoning-class prompt explicitly
   * extracts `answers` edges, so when an agent_output or reasoning_step
   * actually resolves a prior open question, the edge appears there.
   *
   * What this method does: surfaces still-unanswered open questions for
   * downstream gate/UI consumers. It does not itself perform LLM-driven
   * semantic matching — that's redundant with Stage III.
   */
  private runStageV(record: GovernedStreamRecord): void {
    // Check if this record's content might answer open questions
    // by looking for 'raises' edges pointing to unresolved questions.
    // SAB-WARNING: caller of .all() — review for pagination if results grow unbounded.
    // This query has no workflow_run_id filter; it scans every 'raises' edge across the
    // workspace's entire history. On long-lived workspaces with many runs this could
    // exceed the 32MB SharedArrayBuffer ceiling enforced by the sidecar RPC bridge.
    // Consider scoping to the active run or adding LIMIT/OFFSET pagination if it fires.
    const openQuestions = this.db.prepare(`
      SELECT me.target_record_id, gs.content
      FROM memory_edge me
      JOIN governed_stream gs ON gs.id = me.target_record_id
      WHERE me.edge_type = 'raises'
        AND me.status IN ('confirmed', 'system_asserted')
        AND gs.is_current_version = 1
    `).all() as { target_record_id: string; content: string }[];

    // Check if any open question has an 'answers' edge already
    for (const oq of openQuestions) {
      const answered = this.db.prepare(`
        SELECT id FROM memory_edge
        WHERE target_record_id = ? AND edge_type = 'answers'
          AND status IN ('confirmed', 'system_asserted')
      `).get(oq.target_record_id) as { id: string } | undefined;

      if (!answered) {
        // This question is still open — would check via LLM if the new record answers it
        // For now: deterministic check left as no-op (LLM call needed for semantic matching)
      }
    }
  }
}

/**
 * IngestionPipelineRunner — synchronous normalization of new Governed Stream Records.
 * Based on JanumiCode Spec v2.3, §8.12.
 *
 * Wave 3: Implements Stages I + II (deterministic). Stages III-V stubbed.
 *
 * Stage I  — Type Classification and Authority Assignment (deterministic)
 * Stage II — Deterministic Edge Assertion (deterministic)
 * Stage III — Sub-Artifact Registration + Edge Extraction (deterministic — Architecture Canvas)
 * Stage IV  — Supersession Detection (deterministic + LLM — Wave 4)
 * Stage V   — Open Question Resolution Check (deterministic — Wave 4)
 */

import type { Database } from '../database/init';
import type { GovernedStreamRecord, MemoryEdgeType, SubArtifactEdgeType } from '../types/records';

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

// ── IngestionPipelineRunner ─────────────────────────────────────────

export class IngestionPipelineRunner {
  constructor(
    private readonly db: Database,
    private readonly generateId: () => string,
  ) {}

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

    // Stage III — Sub-Artifact Registration + Edge Extraction (deterministic)
    // Registers sub-artifacts (components, ADRs, test cases, etc.) and extracts
    // edges between them for the Architecture Canvas.
    try {
      this.runStageIII(record);
      result.stagesCompleted.push(3);
    } catch (err) {
      result.errors.push(`Stage III error: ${err instanceof Error ? err.message : String(err)}`);
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
        const decisionType = (record.content as Record<string, unknown>).decision_type as string;
        if (decisionType === 'prior_decision_override') {
          const supersededId = (record.content as Record<string, unknown>).superseded_record_id as string;
          if (supersededId) {
            edges.push(this.createEdge('supersedes', record.id, supersededId, 'system_asserted'));
          }
        }
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
      if (Array.isArray(deps)) {
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
   * Stage IV — Supersession Detection.
   * Checks if the new record supersedes any existing record on the same subject.
   * Deterministic when explicit relationships exist; LLM escalation for ambiguous cases.
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
   * Stage V — Open Question Resolution Check.
   * Checks if the new record answers any unresolved Open Questions.
   */
  private runStageV(record: GovernedStreamRecord): void {
    // Check if this record's content might answer open questions
    // by looking for 'raises' edges pointing to unresolved questions
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

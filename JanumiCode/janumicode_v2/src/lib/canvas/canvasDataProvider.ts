/**
 * Canvas Data Provider.
 *
 * Loads nodes and edges from the database for a workflow run's architecture canvas.
 * Queries governed_stream, sub_artifact, sub_artifact_edge, and canvas_layout_state tables.
 *
 * Wave 5: Data Provider + Extension Host Bridge
 */

import type { Database } from '../database/init';
import { getLogger } from '../logging';
import type { PhaseId } from '../types/records';
import type {
  CanvasNode,
  CanvasEdge,
  NodeLayoutState,
} from './types';

/**
 * Provides data for the Architecture Canvas.
 */
export class CanvasDataProvider {
  constructor(private readonly db: Database) {}

  /**
   * Load all nodes for a workflow run.
   * Combines artifact-level nodes from governed_stream and sub-artifact nodes.
   *
   * Wraps the DB call in try/catch and logs the failure with the full
   * SQL error so a schema mismatch (e.g. wrong column name) surfaces in
   * the JanumiCode output channel instead of silently returning [].
   */
  loadNodes(workflowRunId: string): CanvasNode[] {
    const log = getLogger();
    const nodes: CanvasNode[] = [];

    // Load artifact-level nodes from governed_stream records.
    // Column is `produced_at` (not `created_at` — `governed_stream`
    // uses produced_at; `sub_artifact` uses created_at; the two tables
    // intentionally diverge per the schema).
    let records: Array<{
      id: string;
      record_type: string;
      content: string;
      produced_at: string;
      sub_phase_id: string | null;
    }> = [];
    try {
      // Filter to is_current_version=1 — supersession is the canvas's
      // first concern. Loading superseded artifacts would re-extract
      // their sub-artifacts (e.g. NFR-001, NFR-002 from an old NFR
      // artifact PLUS the new one), producing duplicate ids that
      // crash ELK with a null deref inside its dispatcher.
      // sub_phase_id is selected as a fallback signal: Phase 9.1
      // task-execution records persist the raw Claude Code CLI
      // result envelope which has no `kind` discriminator. Without
      // sub_phase_id we'd lose 20+ execution records to phase 0.
      const rows = this.db
        .prepare(
          `SELECT id, record_type, content, produced_at, sub_phase_id
           FROM governed_stream
           WHERE workflow_run_id = ?
             AND record_type = 'artifact_produced'
             AND is_current_version = 1`,
        )
        .all(workflowRunId) as typeof records | null | undefined;
      records = Array.isArray(rows) ? rows : [];
    } catch (err) {
      log.error('ui', 'canvas: loadNodes governed_stream query failed', {
        workflowRunId,
        error: err instanceof Error ? err.message : String(err),
      });
      return nodes;
    }
    log.info('ui', 'canvas: loadNodes governed_stream rows', {
      workflowRunId,
      artifact_count: records.length,
    });

    for (const record of records) {
      const content = JSON.parse(record.content) as Record<string, unknown>;
      // Phase handlers write the artifact's kind discriminator at
      // `content.kind` (e.g. 'functional_requirements'), not
      // `content.artifact_kind`. Reading the wrong field made every
      // artifact's label render as "undefined" and every artifact
      // get phase '0'. Keep `artifact_kind` as a fallback for any
      // legacy rows that may carry it.
      const artifactKind = (content.kind as string | undefined)
        ?? (content.artifact_kind as string | undefined)
        ?? 'unknown';

      // Resolve phase: prefer the kind-based mapping; fall back to
      // sub_phase_id when kind is unknown (e.g. Phase 9.1 records that
      // store the raw CLI result envelope without a kind field).
      const phaseFromKind = this.getPhaseIdForArtifactKind(artifactKind);
      const phaseId = phaseFromKind === '0' && artifactKind === 'unknown' && record.sub_phase_id
        ? this.phaseIdFromSubPhase(record.sub_phase_id)
        : phaseFromKind;

      const label = artifactKind === 'unknown' && record.sub_phase_id
        ? `Phase ${record.sub_phase_id} Output`
        : this.getArtifactLabel(artifactKind, content);

      // Create artifact-level node
      nodes.push({
        id: record.id,
        type: 'artifact',
        phaseId,
        label,
        content,
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        status: 'complete',
      });

      // Extract sub-artifact nodes from content
      this.extractSubArtifactNodes(content, record.id, nodes);
    }

    // Defense in depth — duplicate ids crash ELK with a null deref;
    // drop them here with a clear log rather than fail downstream.
    const deduped = dedupeCanvasNodes(nodes, workflowRunId, log);

    // Apply saved layout positions
    this.applyLayoutPositions(workflowRunId, deduped);

    log.info('ui', 'canvas: loadNodes returning', {
      workflowRunId, count: deduped.length,
    });
    return deduped;
  }

  /**
   * Load all edges for a workflow run.
   * Combines record-level edges from memory_edge and sub-artifact edges.
   *
   * Schema note: `sub_artifact_edge` uses `source_id`/`target_id`;
   * `memory_edge` uses `source_record_id`/`target_record_id`. The two
   * tables intentionally diverge — sub-artifact edges reference
   * sub_artifact rows, memory edges reference governed_stream rows.
   */
  loadEdges(workflowRunId: string): CanvasEdge[] {
    const log = getLogger();
    const edges: CanvasEdge[] = [];

    // Load sub-artifact edges
    let subArtifactEdges: Array<{ id: string; source_id: string; target_id: string; edge_type: string }> = [];
    try {
      const rows = this.db
        .prepare(
          `SELECT id, source_id, target_id, edge_type
           FROM sub_artifact_edge
           WHERE workflow_run_id = ?`,
        )
        .all(workflowRunId) as typeof subArtifactEdges | null | undefined;
      subArtifactEdges = Array.isArray(rows) ? rows : [];
    } catch (err) {
      log.error('ui', 'canvas: loadEdges sub_artifact_edge query failed', {
        workflowRunId, error: err instanceof Error ? err.message : String(err),
      });
    }

    for (const edge of subArtifactEdges) {
      edges.push({
        id: edge.id,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        type: edge.edge_type as CanvasEdge['type'],
      });
    }

    // Load record-level edges from memory_edge.
    // Schema columns are source_record_id / target_record_id.
    let memoryEdges: Array<{ id: string; source_record_id: string; target_record_id: string; edge_type: string }> = [];
    try {
      const rows = this.db
        .prepare(
          `SELECT id, source_record_id, target_record_id, edge_type
           FROM memory_edge
           WHERE workflow_run_id = ?`,
        )
        .all(workflowRunId) as typeof memoryEdges | null | undefined;
      memoryEdges = Array.isArray(rows) ? rows : [];
    } catch (err) {
      log.error('ui', 'canvas: loadEdges memory_edge query failed', {
        workflowRunId, error: err instanceof Error ? err.message : String(err),
      });
    }

    for (const edge of memoryEdges) {
      edges.push({
        id: edge.id,
        sourceId: edge.source_record_id,
        targetId: edge.target_record_id,
        type: edge.edge_type as CanvasEdge['type'],
      });
    }

    log.info('ui', 'canvas: loadEdges totals', {
      workflowRunId,
      sub_artifact_edges: subArtifactEdges.length,
      memory_edges: memoryEdges.length,
      total: edges.length,
    });
    return edges;
  }

  /**
   * Load layout state for a workflow run.
   */
  loadLayout(workflowRunId: string): NodeLayoutState[] {
    const log = getLogger();
    try {
      const rows = this.db
        .prepare(
          `SELECT workflow_run_id, node_id, x, y, width, height, collapsed, user_positioned, last_modified_at
           FROM canvas_layout_state
           WHERE workflow_run_id = ?`,
        )
        .all(workflowRunId) as NodeLayoutState[] | null | undefined;
      const layout = Array.isArray(rows) ? rows : [];
      log.info('ui', 'canvas: loadLayout rows', { workflowRunId, count: layout.length });
      return layout;
    } catch (err) {
      log.error('ui', 'canvas: loadLayout query failed', {
        workflowRunId, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Save a node's layout position.
   */
  /**
   * Clear all saved layout positions for a workflow run. Used by the
   * "Reset Layout" toolbar action — after this, the next canvas open
   * (or the in-flight grid recompute) starts from a blank slate.
   */
  clearLayout(workflowRunId: string): void {
    const log = getLogger();
    try {
      const result = this.db
        .prepare(`DELETE FROM canvas_layout_state WHERE workflow_run_id = ?`)
        .run(workflowRunId);
      log.info('ui', 'canvas: clearLayout', {
        workflowRunId, deleted: result.changes,
      });
    } catch (err) {
      log.error('ui', 'canvas: clearLayout failed', {
        workflowRunId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  saveLayoutPosition(
    workflowRunId: string,
    nodeId: string,
    x: number,
    y: number,
    userPositioned = true,
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO canvas_layout_state
         (workflow_run_id, node_id, x, y, user_positioned, last_modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(workflowRunId, nodeId, x, y, userPositioned ? 1 : 0, now);
  }

  /**
   * Extract sub-artifact nodes from artifact content.
   *
   * Each artifact kind exposes its sub-items under a different field
   * with different label semantics:
   *   - functional_requirements: `user_stories[]` → label = action
   *   - non_functional_requirements: `requirements[]` → label = description
   *   - component_decomposition: `components[]` → label = name
   *   - adr_capture: `adrs[]` → label = title
   *   - test_case_generation: `test_cases[]` → label = name
   *   - data_models: `entities[]` → label = name
   *
   * Each rule is a `SubArtifactExtractor`; the loop below dispatches
   * over the rule table. `pickLabel` walks a list of candidate field
   * names and returns the first non-empty string, falling back to
   * the item's id, then to a last-resort sentinel — so a label is
   * NEVER `undefined`.
   */
  private extractSubArtifactNodes(
    content: Record<string, unknown>,
    parentRecordId: string,
    nodes: CanvasNode[],
  ): void {
    for (const rule of SUB_ARTIFACT_RULES) {
      const items = content[rule.field];
      if (!Array.isArray(items)) continue;
      for (const item of items as Array<Record<string, unknown>>) {
        nodes.push({
          id: pickLabel(item, ['id'], rule.idFallback),
          type: rule.nodeType,
          phaseId: rule.phaseId,
          label: pickLabel(item, rule.labelFields, rule.labelFallback),
          content: item,
          parentRecordId,
          x: 0,
          y: 0,
          width: rule.width,
          height: rule.height,
          status: 'complete',
        });
      }
    }
  }

  /**
   * Apply saved layout positions to nodes.
   */
  private applyLayoutPositions(workflowRunId: string, nodes: CanvasNode[]): void {
    const layout = this.loadLayout(workflowRunId);
    const layoutMap = new Map(layout.map((l) => [l.nodeId, l]));

    for (const node of nodes) {
      const saved = layoutMap.get(node.id);
      if (saved) {
        node.x = saved.x;
        node.y = saved.y;
        if (saved.width !== undefined) node.width = saved.width;
        if (saved.height !== undefined) node.height = saved.height;
        if (saved.collapsed !== undefined) node.collapsed = saved.collapsed;
      }
    }
  }

  /**
   * Get the phase ID for an artifact kind. Covers every kind currently
   * emitted across phases 0–10 (Wave 8 inventory). When extending to
   * new artifact kinds, ADD them here — unmapped kinds default to '0'
   * which lands them in the catch-all phase band rather than being
   * silently dropped from the canvas.
   */
  private getPhaseIdForArtifactKind(kind: string): PhaseId {
    const mapping: Record<string, PhaseId> = {
      // Phase 0 — Workspace initialization
      workspace_classification: '0',
      workflow_run_summary: '0',
      ingestion_pipeline_record: '0',
      prior_decision_summary: '0',  // Phase 0.5 cross-run impact

      // Phase 1 — Intent capture and convergence
      raw_intent_received: '1',
      intent_quality_report: '1',
      intent_lens_classification: '1',
      scope_classification: '1',
      compliance_context: '1',
      intent_bloom: '1',
      intent_discovery: '1',           // Phase 1.0b
      intent_discovery_bundle: '1',    // composite handoff
      intent_statement: '1',
      product_description_handoff: '1',
      technical_constraints_discovery: '1',  // Phase 1.0c
      compliance_retention_discovery: '1',   // Phase 1.0d
      vv_requirements_discovery: '1',        // Phase 1.0e
      canonical_vocabulary_discovery: '1',   // Phase 1.0f
      business_domains_bloom: '1',
      user_journey_bloom: '1',
      system_workflow_bloom: '1',
      journeys_workflows_bloom: '1', // legacy combined form (pre-Wave 7)
      entities_bloom: '1',
      integrations_qa_bloom: '1',
      release_plan: '1',
      coverage_gap: '1',  // 1.3c / 1.8 verifier outputs

      // Phase 2 — Requirements
      functional_requirements: '2',
      non_functional_requirements: '2',
      requirements_artifact: '2', // legacy alias
      consistency_report: '2',

      // Phase 3 — System specification
      system_boundary: '3',
      system_requirements: '3',
      interface_contracts: '3',

      // Phase 4 — Architecture
      software_domains: '4',
      component_decomposition: '4',
      component_model: '4', // legacy alias
      adr_capture: '4',

      // Phase 5 — Technical specification
      data_models: '5',
      api_definitions: '5',
      technical_spec: '5', // legacy alias
      error_handling_strategies: '5',
      configuration_parameters: '5',

      // Phase 6 — Implementation planning
      implementation_task_decomposition: '6',
      implementation_plan: '6', // legacy alias

      // Phase 7 — Test planning
      test_case_generation: '7',
      test_plan: '7', // legacy alias
      test_coverage_report: '7',

      // Phase 8 — Evaluation planning
      evaluation_design: '8',
      evaluation_plan: '8', // legacy alias
      quality_evaluation_plan: '8',
      reasoning_evaluation_plan: '8',

      // Phase 9 — Execution / evaluation outputs
      implementation_task_execution: '9',
      file_system_write_record: '9',
      evaluation_result: '9',
      reasoning_review_result: '9',
      loop_detection_result: '9',
      test_results: '9',

      // Phase 10 — Commit
      pre_commit_consistency: '10',
    };
    return mapping[kind] ?? '0';
  }

  /**
   * Derive a phase id from a sub_phase_id like "9.1" → "9". Last-resort
   * fallback when content.kind is missing (e.g. Phase 9.1 task
   * executions persist the raw CLI result envelope).
   */
  private phaseIdFromSubPhase(subPhaseId: string): PhaseId {
    const major = subPhaseId.split('.')[0];
    const valid = new Set(['0','1','2','3','4','5','6','7','8','9','10']);
    return (valid.has(major) ? major : '0') as PhaseId;
  }

  /**
   * Get a display label for an artifact. Resolution order:
   *   1. content.title — if the artifact has a top-level title
   *   2. The kind-specific label table below — covers every kind
   *      currently emitted across phases 0–10
   *   3. The kind itself, prettified — last-resort fallback so the
   *      label is never `undefined` (which is what made every box
   *      render as "undefined" before this fix)
   */
  private getArtifactLabel(
    kind: string,
    content: Record<string, unknown>,
  ): string {
    const titleField = content.title;
    if (typeof titleField === 'string' && titleField.length > 0) return titleField;

    const labels: Record<string, string> = {
      // Phase 0
      workspace_classification: 'Workspace Classification',
      ingestion_pipeline_record: 'Ingested File',

      // Phase 1
      raw_intent_received: 'Raw Intent',
      intent_quality_report: 'Intent Quality Check',
      intent_lens_classification: 'Intent Lens',
      scope_classification: 'Scope',
      compliance_context: 'Compliance Context',
      intent_bloom: 'Intent Bloom',
      intent_statement: 'Intent Statement',
      product_description_handoff: 'Product Description',
      business_domains_bloom: 'Business Domains',
      user_journey_bloom: 'User Journeys',
      system_workflow_bloom: 'System Workflows',
      journeys_workflows_bloom: 'Journeys & Workflows',
      entities_bloom: 'Entities',
      integrations_qa_bloom: 'Integrations & QA',
      release_plan: 'Release Plan',
      coverage_gap: 'Coverage Gap',

      // Phase 2
      functional_requirements: 'Functional Requirements',
      non_functional_requirements: 'Non-Functional Requirements',
      requirements_artifact: 'Requirements', // legacy alias
      consistency_report: 'Consistency Report',

      // Phase 3
      system_boundary: 'System Boundary',
      system_requirements: 'System Requirements',
      interface_contracts: 'Interface Contracts',

      // Phase 4
      software_domains: 'Software Domains',
      component_decomposition: 'Components',
      component_model: 'Architecture',
      adr_capture: 'ADRs',

      // Phase 5
      data_models: 'Data Models',
      api_definitions: 'API Definitions',
      technical_spec: 'Technical Spec',
      error_handling_strategies: 'Error Handling',
      configuration_parameters: 'Config Parameters',

      // Phase 6
      implementation_task_decomposition: 'Implementation Tasks',
      implementation_plan: 'Implementation Plan',

      // Phase 7
      test_case_generation: 'Test Cases',
      test_plan: 'Test Plan',
      test_coverage_report: 'Test Coverage',

      // Phase 8
      evaluation_design: 'Evaluation Design',
      evaluation_plan: 'Evaluation Plan',
      quality_evaluation_plan: 'Quality Eval Plan',
      reasoning_evaluation_plan: 'Reasoning Eval Plan',

      // Phase 9
      implementation_task_execution: 'Task Execution',
      file_system_write_record: 'File Write',
      evaluation_result: 'Evaluation',
      reasoning_review_result: 'Reasoning Review',
      loop_detection_result: 'Loop Detection',
      test_results: 'Test Results',

      // Phase 10
      pre_commit_consistency: 'Pre-Commit Consistency',
    };
    if (labels[kind]) return labels[kind];

    // Last-resort fallback: turn `system_boundary_v2` → `System Boundary V2`.
    if (kind && kind !== 'unknown') {
      return kind
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return 'Unknown Artifact';
  }
}

/**
 * One rule per sub-artifact kind. The extractor loop in
 * `extractSubArtifactNodes` dispatches over this table to keep the
 * cognitive complexity bounded — the previous per-kind cascading
 * `if` blocks tripped SonarLint at complexity 18.
 */
interface SubArtifactExtractor {
  /** Field on the artifact's `content` that holds the sub-items array. */
  field: string;
  /** CanvasNode.type to assign to the extracted node. */
  nodeType: CanvasNode['type'];
  /** PhaseId the sub-artifact belongs to (drives band assignment). */
  phaseId: PhaseId;
  /** Candidate fields to read for the label, in priority order. */
  labelFields: string[];
  /** Last-resort label string when no field has a non-empty value. */
  labelFallback: string;
  /** Last-resort id string when item.id is missing. */
  idFallback: string;
  /** Pixel width of the rendered node card. */
  width: number;
  /** Pixel height of the rendered node card. */
  height: number;
}

const SUB_ARTIFACT_RULES: SubArtifactExtractor[] = [
  // FR user stories — Phase 2.1 functional_requirements.
  // Each entry is { id, role, action, outcome, priority, traces_to,
  // acceptance_criteria }. The action is the most descriptive
  // single-line label.
  { field: 'user_stories', nodeType: 'requirement', phaseId: '2',
    labelFields: ['action', 'title'], labelFallback: 'Functional Requirement',
    idFallback: 'fr-unknown', width: 200, height: 80 },
  // NFRs — Phase 2.2 non_functional_requirements. Entries use
  // `description` (full sentence) — not `name` or `title`.
  { field: 'requirements', nodeType: 'requirement', phaseId: '2',
    labelFields: ['description', 'title', 'name'], labelFallback: 'Non-Functional Requirement',
    idFallback: 'nfr-unknown', width: 200, height: 80 },
  // Architecture components — Phase 4.
  { field: 'components', nodeType: 'component', phaseId: '4',
    labelFields: ['name', 'title'], labelFallback: 'Component',
    idFallback: 'comp-unknown', width: 150, height: 80 },
  // ADRs — Phase 4.
  { field: 'adrs', nodeType: 'adr', phaseId: '4',
    labelFields: ['title', 'name'], labelFallback: 'ADR',
    idFallback: 'adr-unknown', width: 150, height: 80 },
  // Data-model entities — Phase 5.
  { field: 'entities', nodeType: 'requirement', phaseId: '5',
    labelFields: ['name', 'title'], labelFallback: 'Entity',
    idFallback: 'entity-unknown', width: 150, height: 80 },
  // Implementation tasks — Phase 6 (implementation_plan.tasks[]).
  // Each task carries id, task_type, component_id,
  // component_responsibility, description, backing_tool,
  // dependency_task_ids, estimated_complexity, completion_criteria,
  // write/read_directory_paths. The description is the most useful
  // single-line label; component_responsibility is the secondary fallback.
  { field: 'tasks', nodeType: 'implementation_task', phaseId: '6',
    labelFields: ['description', 'component_responsibility', 'id'], labelFallback: 'Implementation Task',
    idFallback: 'task-unknown', width: 200, height: 80 },
  // Test cases — Phase 7.
  { field: 'test_cases', nodeType: 'test_case', phaseId: '7',
    labelFields: ['name', 'title', 'description'], labelFallback: 'Test Case',
    idFallback: 'tc-unknown', width: 150, height: 60 },
];

/** First non-empty string at any of `fields`, else `item.id`, else `fallback`. */
function pickLabel(
  item: Record<string, unknown>,
  fields: string[],
  fallback: string,
): string {
  for (const f of fields) {
    const v = item[f];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  const id = item.id;
  return typeof id === 'string' && id.length > 0 ? id : fallback;
}

/**
 * Drop CanvasNodes with empty or duplicated ids. Logs the duplicate
 * count + a small sample so operators can spot the pattern (e.g.
 * "NFR-001 appears twice" → an artifact got re-emitted somewhere
 * upstream). Pure function — no DB access, easy to unit-test.
 */
function dedupeCanvasNodes(
  nodes: CanvasNode[],
  workflowRunId: string,
  log: ReturnType<typeof getLogger>,
): CanvasNode[] {
  const seen = new Set<string>();
  const deduped: CanvasNode[] = [];
  const dupCounts = new Map<string, number>();
  for (const n of nodes) {
    if (!n.id) continue;
    if (seen.has(n.id)) {
      dupCounts.set(n.id, (dupCounts.get(n.id) ?? 1) + 1);
      continue;
    }
    seen.add(n.id);
    deduped.push(n);
  }
  if (dupCounts.size > 0) {
    const sample: Record<string, number> = {};
    let i = 0;
    for (const [id, count] of dupCounts) {
      if (i++ >= 10) break;
      sample[id] = count;
    }
    log.warn('ui', 'canvas: loadNodes dropped duplicate ids', {
      workflowRunId,
      unique_ids_with_dupes: dupCounts.size,
      kept: deduped.length,
      dropped: nodes.length - deduped.length,
      sample,
    });
  }
  return deduped;
}

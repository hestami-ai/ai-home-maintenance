/**
 * Canvas Data Provider.
 *
 * Loads nodes and edges from the database for a workflow run's architecture canvas.
 * Queries governed_stream, sub_artifact, sub_artifact_edge, and canvas_layout_state tables.
 *
 * Wave 5: Data Provider + Extension Host Bridge
 */

import type { Database } from '../database/init';
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
   */
  loadNodes(workflowRunId: string): CanvasNode[] {
    const nodes: CanvasNode[] = [];

    // Load artifact-level nodes from governed_stream records
    const records = this.db
      .prepare(
        `SELECT id, record_type, content, created_at
         FROM governed_stream
         WHERE workflow_run_id = ? AND record_type = 'artifact_produced'`,
      )
      .all(workflowRunId) as Array<{
        id: string;
        record_type: string;
        content: string;
        created_at: string;
      }>;

    for (const record of records) {
      const content = JSON.parse(record.content) as Record<string, unknown>;
      const artifactKind = content.artifact_kind as string;

      // Create artifact-level node
      nodes.push({
        id: record.id,
        type: 'artifact',
        phaseId: this.getPhaseIdForArtifactKind(artifactKind),
        label: this.getArtifactLabel(artifactKind, content),
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

    // Apply saved layout positions
    this.applyLayoutPositions(workflowRunId, nodes);

    return nodes;
  }

  /**
   * Load all edges for a workflow run.
   * Combines record-level edges from memory_edge and sub-artifact edges.
   */
  loadEdges(workflowRunId: string): CanvasEdge[] {
    const edges: CanvasEdge[] = [];

    // Load sub-artifact edges
    const subArtifactEdges = this.db
      .prepare(
        `SELECT id, source_id, target_id, edge_type
         FROM sub_artifact_edge
         WHERE workflow_run_id = ?`,
      )
      .all(workflowRunId) as Array<{
        id: string;
        source_id: string;
        target_id: string;
        edge_type: string;
      }>;

    for (const edge of subArtifactEdges) {
      edges.push({
        id: edge.id,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        type: edge.edge_type as CanvasEdge['type'],
      });
    }

    // Load record-level edges from memory_edge
    const memoryEdges = this.db
      .prepare(
        `SELECT id, source_id, target_id, edge_type
         FROM memory_edge
         WHERE workflow_run_id = ?`,
      )
      .all(workflowRunId) as Array<{
        id: string;
        source_id: string;
        target_id: string;
        edge_type: string;
      }>;

    for (const edge of memoryEdges) {
      edges.push({
        id: edge.id,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        type: edge.edge_type as CanvasEdge['type'],
      });
    }

    return edges;
  }

  /**
   * Load layout state for a workflow run.
   */
  loadLayout(workflowRunId: string): NodeLayoutState[] {
    return this.db
      .prepare(
        `SELECT workflow_run_id, node_id, x, y, width, height, collapsed, user_positioned, last_modified_at
         FROM canvas_layout_state
         WHERE workflow_run_id = ?`,
      )
      .all(workflowRunId) as NodeLayoutState[];
  }

  /**
   * Save a node's layout position.
   */
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
   */
  private extractSubArtifactNodes(
    content: Record<string, unknown>,
    parentRecordId: string,
    nodes: CanvasNode[],
  ): void {
    // Extract components
    const components = content.components as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(components)) {
      for (const comp of components) {
        nodes.push({
          id: comp.id as string,
          type: 'component',
          phaseId: '4',
          label: comp.name as string,
          content: comp,
          parentRecordId,
          x: 0,
          y: 0,
          width: 150,
          height: 80,
          status: 'complete',
        });
      }
    }

    // Extract ADRs
    const adrs = content.adrs as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(adrs)) {
      for (const adr of adrs) {
        nodes.push({
          id: adr.id as string,
          type: 'adr',
          phaseId: '4',
          label: adr.title as string,
          content: adr,
          parentRecordId,
          x: 0,
          y: 0,
          width: 150,
          height: 80,
          status: 'complete',
        });
      }
    }

    // Extract test cases
    const testCases = content.test_cases as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(testCases)) {
      for (const tc of testCases) {
        nodes.push({
          id: tc.id as string,
          type: 'test_case',
          phaseId: '7',
          label: tc.name as string,
          content: tc,
          parentRecordId,
          x: 0,
          y: 0,
          width: 150,
          height: 60,
          status: 'complete',
        });
      }
    }

    // Extract requirements (from requirements_artifact)
    const requirements = content.requirements as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(requirements)) {
      for (const req of requirements) {
        nodes.push({
          id: req.id as string,
          type: 'requirement',
          phaseId: '3',
          label: req.title as string,
          content: req,
          parentRecordId,
          x: 0,
          y: 0,
          width: 180,
          height: 80,
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
   * Get the phase ID for an artifact kind.
   */
  private getPhaseIdForArtifactKind(kind: string): PhaseId {
    const mapping: Record<string, PhaseId> = {
      requirements_artifact: '3',
      component_model: '4',
      technical_spec: '5',
      implementation_plan: '6',
      test_plan: '7',
      evaluation_plan: '8',
      consistency_report: '10',
    };
    return mapping[kind] ?? '0';
  }

  /**
   * Get a display label for an artifact.
   */
  private getArtifactLabel(
    kind: string,
    content: Record<string, unknown>,
  ): string {
    const labels: Record<string, string> = {
      requirements_artifact: 'Requirements',
      component_model: 'Architecture',
      technical_spec: 'Technical Spec',
      implementation_plan: 'Implementation Plan',
      test_plan: 'Test Plan',
      evaluation_plan: 'Evaluation Plan',
      consistency_report: 'Consistency Report',
    };
    return (content.title as string) ?? labels[kind] ?? kind;
  }
}

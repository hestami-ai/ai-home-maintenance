/**
 * Architecture Canvas Types
 * 
 * Types for the Architecture Canvas feature - an interactive visualization
 * of workflow phases 3-8 with nodes representing artifacts and sub-artifacts.
 */

import type { PhaseId } from '../types/records';

// -- Canvas Node Types --

/**
 * Kinds of nodes that can appear on the canvas.
 * Matches sub_artifact.kind values plus artifact-level nodes.
 */
export type CanvasNodeKind =
  // Phase 3: Requirements
  | 'requirement'
  | 'acceptance_criterion'
  // Phase 4: Architecture
  | 'software_domain'
  | 'component'
  | 'responsibility'
  | 'adr'
  // Phase 5: Technical Spec
  | 'api_endpoint'
  | 'data_model'
  | 'sequence_diagram'
  // Phase 6: Implementation Plan
  | 'implementation_task'
  // Phase 7: Test Planning
  | 'test_suite'
  | 'test_case'
  // Phase 8: Evaluation Planning
  | 'functional_eval_criterion'
  | 'quality_eval_criterion'
  | 'reasoning_scenario'
  // Phase 10: Deployment
  | 'consistency_report'
  // Artifact-level (parent nodes)
  | 'artifact';

/**
 * Lifecycle status of a canvas node.
 */
export type CanvasNodeStatus =
  | 'pending'      // Not yet generated
  | 'generating'   // Currently being produced by an agent
  | 'complete'     // Successfully generated
  | 'flagged';     // Has warnings or issues

/**
 * A node on the architecture canvas.
 * Uses semantic IDs (e.g., "COMP-001") for stability.
 */
export interface CanvasNode {
  /** Semantic ID (e.g., "COMP-001") or governed_stream record ID for artifact nodes */
  id: string;
  /** Type of node */
  type: CanvasNodeKind;
  /** Phase this node belongs to */
  phaseId: PhaseId;
  /** Display label */
  label: string;
  /** Full content object from artifact */
  content: Record<string, unknown>;
  /** Parent governed_stream record ID (for sub-artifacts) */
  parentRecordId?: string;
  /** Layout position X */
  x: number;
  /** Layout position Y */
  y: number;
  /** Node width */
  width: number;
  /** Node height */
  height: number;
  /** Lifecycle status */
  status: CanvasNodeStatus;
  /** Whether the node is collapsed (for compound nodes) */
  collapsed?: boolean;
}

// -- Canvas Edge Types --

/**
 * Kinds of edges that can appear on the canvas.
 * Combines MemoryEdgeType (record-level) and SubArtifactEdgeType.
 */
export type CanvasEdgeKind =
  // Record-level edges (from memory_edge)
  | 'derives_from'
  | 'implements'
  | 'tests'
  // Sub-artifact edges (from sub_artifact_edge)
  | 'satisfies'
  | 'depends_on'
  | 'governs';

/**
 * An edge on the architecture canvas.
 * Can connect record-level nodes or sub-artifact nodes.
 */
export interface CanvasEdge {
  /** Edge ID */
  id: string;
  /** Source node ID (semantic ID or record ID) */
  sourceId: string;
  /** Target node ID (semantic ID or record ID) */
  targetId: string;
  /** Edge type */
  type: CanvasEdgeKind;
}

// -- Viewport Types --

/**
 * Canvas viewport state for pan/zoom.
 */
export interface ViewportState {
  /** Pan offset X */
  x: number;
  /** Pan offset Y */
  y: number;
  /** Zoom level (1.0 = 100%) */
  zoom: number;
}

// -- Layout Types --

/**
 * Layout state for a single node, persisted to database.
 */
export interface NodeLayoutState {
  workflowRunId: string;
  nodeId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  collapsed?: boolean;
  userPositioned?: boolean;
  lastModifiedAt: string;
}

// -- Message Protocol Types --

/**
 * Messages from extension host to canvas webview.
 */
export type CanvasOutboundMessage =
  | { type: 'init'; nodes: CanvasNode[]; edges: CanvasEdge[]; layout: NodeLayoutState[] }
  | { type: 'nodeAdded'; node: CanvasNode }
  | { type: 'edgeAdded'; edge: CanvasEdge }
  | { type: 'nodeUpdated'; nodeId: string; updates: Partial<CanvasNode> }
  | { type: 'layoutUpdated'; nodeId: string; x: number; y: number };

/**
 * Messages from canvas webview to extension host.
 */
export type CanvasInboundMessage =
  | { type: 'ready' }
  | { type: 'persistPosition'; nodeId: string; x: number; y: number }
  | { type: 'getNodeDetails'; nodeId: string }
  | { type: 'fitAll' }
  | { type: 'fitPhase'; phaseId: string }
  | { type: 'toggleDependencyEdges'; visible: boolean }
  | { type: 'resetLayout' };

// -- Color Palette for Canvas 2D --

/**
 * Color palette extracted from design system CSS custom properties.
 * Used by Canvas 2D renderer for consistent styling.
 */
export interface CanvasColorPalette {
  surface: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  primary: string;
  tertiary: string;
  warning: string;
  error: string;
  onSurface: string;
  outline: string;
}

// -- Phase Band Types --

/**
 * A phase band on the canvas - a horizontal region containing nodes from one phase.
 */
export interface PhaseBand {
  phaseId: PhaseId;
  label: string;
  y: number;
  height: number;
  collapsed: boolean;
}

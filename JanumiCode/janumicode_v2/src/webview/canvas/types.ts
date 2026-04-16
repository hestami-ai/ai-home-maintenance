/**
 * Canvas Webview Types.
 *
 * Type definitions for messages between the extension host and canvas webview.
 * Wave 6: Webview Message Protocol Definition
 */

import type {
  CanvasNode,
  CanvasEdge,
  NodeLayoutState,
  ViewportState,
} from '../../lib/canvas/types';

// Re-export shared types
export type { CanvasNode, CanvasEdge, NodeLayoutState, ViewportState };

/**
 * Messages from extension host to canvas webview.
 */
export type CanvasOutboundMessage =
  | { type: 'init'; nodes: CanvasNode[]; edges: CanvasEdge[]; layout: NodeLayoutState[] }
  | { type: 'nodeAdded'; node: CanvasNode }
  | { type: 'edgeAdded'; edge: CanvasEdge }
  | { type: 'nodeUpdated'; nodeId: string; updates: Partial<CanvasNode> }
  | { type: 'layoutUpdated'; nodeId: string; x: number; y: number }
  | { type: 'viewportChanged'; viewport: ViewportState };

/**
 * Messages from canvas webview to extension host.
 */
export type CanvasInboundMessage =
  | { type: 'persistPosition'; nodeId: string; x: number; y: number }
  | { type: 'getNodeDetails'; nodeId: string }
  | { type: 'fitAll' }
  | { type: 'fitPhase'; phaseId: string }
  | { type: 'toggleDependencyEdges'; visible: boolean }
  | { type: 'nodeClicked'; nodeId: string; x: number; y: number }
  | { type: 'nodeDoubleClicked'; nodeId: string }
  | { type: 'nodeDragged'; nodeId: string; x: number; y: number }
  | { type: 'canvasRightClicked'; x: number; y: number }
  | { type: 'zoomChanged'; zoom: number }
  | { type: 'panChanged'; x: number; y: number };

/**
 * State managed by the canvas webview.
 */
export interface CanvasWebviewState {
  nodes: Map<string, CanvasNode>;
  edges: Map<string, CanvasEdge>;
  layout: Map<string, NodeLayoutState>;
  viewport: ViewportState;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  dependencyEdgesVisible: boolean;
}

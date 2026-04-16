/**
 * ELK Layout Engine.
 *
 * Uses elkjs to compute automatic layouts for canvas nodes.
 * Organizes nodes by phase bands with hierarchical layout within each band.
 *
 * Wave 8: ELK Layout Engine
 */

// @ts-expect-error - elkjs bundled module
import ELK from 'elkjs';
import type { CanvasNode, CanvasEdge } from '../../../lib/canvas/types';

/**
 * ELK graph node representation.
 */
interface ElkNode {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  labels?: Array<{ text: string; width: number; height: number }>;
  children?: ElkNode[];
  layoutOptions?: Record<string, string>;
}

/**
 * ELK graph edge representation.
 */
interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

/**
 * ELK graph representation.
 */
interface ElkGraph {
  id: string;
  children: ElkNode[];
  edges: ElkEdge[];
  layoutOptions?: Record<string, string>;
}

/**
 * Layout result with positioned nodes.
 */
export interface LayoutResult {
  nodes: Map<string, { x: number; y: number; width: number; height: number }>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// Layout constants
const PHASE_BAND_HEIGHT = 600;
const PHASE_BAND_GAP = 100;
const NODE_GAP_Y = 30;
const PADDING = 40;

// ELK instance (lazy initialized)
let elkInstance: InstanceType<typeof ELK> | null = null;

/**
 * Get or create the ELK instance.
 */
async function getElk(): Promise<InstanceType<typeof ELK>> {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

/**
 * Compute layout for all canvas nodes.
 *
 * Organizes nodes into phase bands, then uses ELK to compute
 * hierarchical layout within each band.
 */
export async function computeLayout(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Promise<LayoutResult> {
  const elk = await getElk();

  // Group nodes by phase
  const nodesByPhase = groupNodesByPhase(nodes);

  // Build ELK graph with phase bands as top-level nodes
  const elkGraph = buildElkGraph(nodesByPhase, edges);

  // Run ELK layout
  const layouted = await elk.layout(elkGraph);

  // Extract positions from layout result
  return extractPositions(layouted, nodes);
}

/**
 * Compute incremental layout for a subset of nodes.
 * Preserves positions of already-positioned nodes.
 */
export async function computeIncrementalLayout(
  newNodes: CanvasNode[],
  existingNodes: Map<string, { x: number; y: number }>,
  edges: CanvasEdge[],
): Promise<LayoutResult> {
  const elk = await getElk();

  // Build ELK graph for new nodes only
  const nodesByPhase = groupNodesByPhase(newNodes);
  const elkGraph = buildElkGraph(nodesByPhase, edges, existingNodes);

  // Run ELK layout
  const layouted = await elk.layout(elkGraph);

  // Extract positions and merge with existing
  const result = extractPositions(layouted, newNodes);

  // Add existing positions
  for (const [id, pos] of existingNodes) {
    if (!result.nodes.has(id)) {
      result.nodes.set(id, { ...pos, width: 150, height: 80 });
    }
  }

  return result;
}

/**
 * Group nodes by their phase ID.
 */
function groupNodesByPhase(nodes: CanvasNode[]): Map<string, CanvasNode[]> {
  const groups = new Map<string, CanvasNode[]>();

  for (const node of nodes) {
    const phaseId = node.phaseId;
    if (!groups.has(phaseId)) {
      groups.set(phaseId, []);
    }
    groups.get(phaseId)?.push(node);
  }

  return groups;
}

/**
 * Build ELK graph from nodes grouped by phase.
 */
function buildElkGraph(
  nodesByPhase: Map<string, CanvasNode[]>,
  edges: CanvasEdge[],
  existingPositions?: Map<string, { x: number; y: number }>,
): ElkGraph {
  const elkNodes: ElkNode[] = [];
  const elkEdges: ElkEdge[] = [];

  // Phase order for layout
  const phaseOrder = ['3', '4', '5', '6', '7', '8', '10'];

  // Create phase band nodes
  for (const phaseId of phaseOrder) {
    const phaseNodes = nodesByPhase.get(phaseId);
    if (!phaseNodes || phaseNodes.length === 0) continue;

    const phaseLabel = getPhaseLabel(phaseId);

    // Create compound node for phase band
    const phaseNode: ElkNode = {
      id: `phase-${phaseId}`,
      width: 1200,
      height: PHASE_BAND_HEIGHT,
      labels: [{ text: phaseLabel, width: 100, height: 20 }],
      layoutOptions: {
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': `${NODE_GAP_Y}`,
        'elk.padding': `[top=50,left=${PADDING},bottom=${PADDING},right=${PADDING}]`,
      },
      children: phaseNodes.map((node) => ({
        id: node.id,
        width: node.width,
        height: node.height,
        x: existingPositions?.get(node.id)?.x,
        y: existingPositions?.get(node.id)?.y,
        labels: [{ text: node.label, width: node.width - 20, height: 16 }],
      })),
    };

    elkNodes.push(phaseNode);
  }

  // Add edges (only between nodes that exist in the graph)
  const allNodes = Array.from(nodesByPhase.values()).flat();
  const nodeIds = new Set(allNodes.map((n: CanvasNode) => n.id));

  for (const edge of edges) {
    if (nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId)) {
      elkEdges.push({
        id: edge.id,
        sources: [edge.sourceId],
        targets: [edge.targetId],
      });
    }
  }

  return {
    id: 'root',
    children: elkNodes,
    edges: elkEdges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': `${PHASE_BAND_GAP}`,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
  };
}

/**
 * Extract node positions from ELK layout result.
 */
function extractPositions(
  layouted: ElkGraph,
  originalNodes: CanvasNode[],
): LayoutResult {
  const nodes = new Map<string, { x: number; y: number; width: number; height: number }>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Extract positions from phase bands
  if (layouted.children) {
    for (const phaseNode of layouted.children) {
      const phaseX = phaseNode.x ?? 0;
      const phaseY = phaseNode.y ?? 0;

      if (phaseNode.children) {
        for (const node of phaseNode.children) {
          const x = phaseX + (node.x ?? 0);
          const y = phaseY + (node.y ?? 0);

          nodes.set(node.id, {
            x,
            y,
            width: node.width,
            height: node.height,
          });

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + node.width);
          maxY = Math.max(maxY, y + node.height);
        }
      }
    }
  }

  // Handle nodes without positions (use original positions or defaults)
  for (const node of originalNodes) {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });

      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
  }

  return {
    nodes,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 1000 : maxX,
      maxY: maxY === -Infinity ? 1000 : maxY,
    },
  };
}

/**
 * Get a human-readable label for a phase.
 */
function getPhaseLabel(phaseId: string): string {
  const labels: Record<string, string> = {
    '3': 'Requirements',
    '4': 'Architecture',
    '5': 'Technical Spec',
    '6': 'Implementation Plan',
    '7': 'Test Planning',
    '8': 'Evaluation Planning',
    '10': 'Deployment',
  };
  return labels[phaseId] ?? `Phase ${phaseId}`;
}

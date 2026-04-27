/**
 * ELK Layout Engine.
 *
 * Uses elkjs to compute automatic layouts for canvas nodes.
 * Organizes nodes by phase bands with hierarchical layout within each band.
 *
 * Wave 8: ELK Layout Engine
 */

// Use the bundled browser entry — elkjs's default `main.js` imports
// `web-worker` (a Node-only shim) which esbuild can't resolve when
// bundling for the webview. `elk.bundled.js` is the all-in-one
// browser build that works without external worker setup.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { CanvasNode, CanvasEdge } from '../../../lib/canvas/types';

/**
 * ELK graph node representation.
 */
// Width / height are required for INPUT nodes (elkjs needs sizes to
// lay out), but the OUTPUT (post-layout) ElkNode from elkjs has them
// as optional because elk may set them itself. We type them as
// optional here to be assignment-compatible with elkjs's own ElkNode
// when passing through `extractPositions`. Build-time graph
// construction always supplies width/height so optionality doesn't
// loosen the actual contract.
interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  labels?: Array<{ text?: string; width?: number; height?: number }>;
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
 * Compute a deterministic phase-banded grid layout. Always succeeds —
 * no graph-shape preconditions, no async, no third-party algorithm.
 *
 * Output shape: each phase is a horizontal band stacked top-to-bottom
 * in numeric phase order. Within a band, nodes are arranged in a
 * left-to-right grid that wraps once it reaches the configured band
 * width. The resulting LayoutResult is identical in shape to the ELK
 * result so the rest of the canvas (auto-fit viewport, position
 * apply) stays unchanged.
 *
 * Why this is the primary layout engine: ELK's `layered` algorithm
 * has thrown null derefs on this graph through several rounds of
 * structural defenses (dedupe, edge filter, full-phase coverage,
 * version upgrade). Until we have a reproducer for ELK's specific
 * complaint, "always shows something" beats "may show nothing." ELK
 * is still wired (see `computeLayout`) — the App.svelte init handler
 * falls back to ELK on demand for users who want it via a future
 * toolbar toggle.
 */
const GRID_BAND_WIDTH = 1400;
const GRID_NODE_HSPACE = 30;
const GRID_NODE_VSPACE = 30;
const GRID_BAND_VPADDING = 60;
const GRID_BAND_HPADDING = 40;

/**
 * Lay out a single phase band's nodes in a left-to-right grid that
 * wraps at GRID_BAND_WIDTH. Mutates `out` and `bounds` in place; the
 * caller advances its band cursor using the returned `nextY`.
 */
function layoutPhaseBand(
  phaseNodes: CanvasNode[],
  bandTop: number,
  out: Map<string, { x: number; y: number; width: number; height: number }>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): { nextY: number } {
  let cursorX = GRID_BAND_HPADDING;
  let rowY = bandTop + GRID_BAND_VPADDING;
  let rowH = 0;
  for (const node of phaseNodes) {
    const w = node.width || 150;
    const h = node.height || 80;
    // Wrap to next row when we'd overflow the band's width.
    if (cursorX + w > GRID_BAND_WIDTH - GRID_BAND_HPADDING && cursorX > GRID_BAND_HPADDING) {
      cursorX = GRID_BAND_HPADDING;
      rowY += rowH + GRID_NODE_VSPACE;
      rowH = 0;
    }
    out.set(node.id, { x: cursorX, y: rowY, width: w, height: h });
    bounds.minX = Math.min(bounds.minX, cursorX);
    bounds.minY = Math.min(bounds.minY, rowY);
    bounds.maxX = Math.max(bounds.maxX, cursorX + w);
    bounds.maxY = Math.max(bounds.maxY, rowY + h);
    cursorX += w + GRID_NODE_HSPACE;
    rowH = Math.max(rowH, h);
  }
  return { nextY: rowY + rowH + GRID_BAND_VPADDING };
}

export function computeGridLayout(nodes: CanvasNode[]): LayoutResult {
  const nodesByPhase = groupNodesByPhase(nodes);
  const phaseOrder = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const seen = new Set(phaseOrder);
  for (const phaseId of nodesByPhase.keys()) {
    if (!seen.has(phaseId)) phaseOrder.push(phaseId);
  }

  const out = new Map<string, { x: number; y: number; width: number; height: number }>();
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let cursorY = 0;

  for (const phaseId of phaseOrder) {
    const phaseNodes = nodesByPhase.get(phaseId);
    if (!phaseNodes || phaseNodes.length === 0) continue;
    const result = layoutPhaseBand(phaseNodes, cursorY, out, bounds);
    cursorY = result.nextY;
  }

  return {
    nodes: out,
    bounds: {
      minX: Number.isFinite(bounds.minX) ? bounds.minX : 0,
      minY: Number.isFinite(bounds.minY) ? bounds.minY : 0,
      maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : 0,
      maxY: Number.isFinite(bounds.maxY) ? bounds.maxY : 0,
    },
  };
}

/**
 * Compute layout for all canvas nodes via ELK.
 *
 * Organizes nodes into phase bands, then uses ELK to compute
 * hierarchical layout within each band. Currently throws null derefs
 * on some graph shapes — `computeGridLayout` is the deterministic
 * fallback the App component uses.
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
/**
 * Resolve the phase-band ordering. Covers 0–10 explicitly, then
 * appends any phaseId in `nodesByPhase` that we don't recognize so
 * future artifact kinds don't get silently dropped.
 */
function resolvePhaseOrder(nodesByPhase: Map<string, CanvasNode[]>): string[] {
  const phaseOrder = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const seen = new Set(phaseOrder);
  for (const phaseId of nodesByPhase.keys()) {
    if (!seen.has(phaseId)) phaseOrder.push(phaseId);
  }
  return phaseOrder;
}

/** Build a single phase-band ElkNode with its child layout nodes. */
function buildPhaseBand(
  phaseId: string,
  phaseNodes: CanvasNode[],
  existingPositions: Map<string, { x: number; y: number }> | undefined,
): ElkNode {
  return {
    id: `phase-${phaseId}`,
    width: 1200,
    height: PHASE_BAND_HEIGHT,
    labels: [{ text: getPhaseLabel(phaseId), width: 100, height: 20 }],
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
}

/** Set of node ids actually emitted into the ELK graph. Used to gate edges. */
function collectEmittedIds(elkNodes: ElkNode[]): Set<string> {
  const ids = new Set<string>();
  for (const phaseNode of elkNodes) {
    if (phaseNode.children) {
      for (const child of phaseNode.children) ids.add(child.id);
    }
  }
  return ids;
}

/** Decide whether an edge is structurally safe to hand to ELK. */
function classifyEdge(
  edge: CanvasEdge,
  emittedIds: Set<string>,
  seenEdgeIds: Set<string>,
): 'keep' | 'duplicate_id' | 'dangling_or_self' {
  if (seenEdgeIds.has(edge.id)) return 'duplicate_id';
  if (!edge.sourceId || !edge.targetId || edge.sourceId === edge.targetId) {
    return 'dangling_or_self';
  }
  if (!emittedIds.has(edge.sourceId) || !emittedIds.has(edge.targetId)) {
    return 'dangling_or_self';
  }
  return 'keep';
}

/**
 * Filter edges to those ELK can safely handle.
 * Drops dangling references, self-loops, and duplicate ids (each of
 * these is a known cause of "Cannot read properties of null" inside
 * ELK's dispatcher).
 */
function buildElkEdges(edges: CanvasEdge[], emittedIds: Set<string>): ElkEdge[] {
  const elkEdges: ElkEdge[] = [];
  const seenEdgeIds = new Set<string>();
  let droppedDangling = 0;
  let droppedDuplicate = 0;
  for (const edge of edges) {
    const verdict = classifyEdge(edge, emittedIds, seenEdgeIds);
    if (verdict === 'duplicate_id') { droppedDuplicate++; continue; }
    if (verdict === 'dangling_or_self') { droppedDangling++; continue; }
    seenEdgeIds.add(edge.id);
    elkEdges.push({ id: edge.id, sources: [edge.sourceId], targets: [edge.targetId] });
  }
  if (droppedDangling > 0 || droppedDuplicate > 0) {
    // eslint-disable-next-line no-console
    console.warn('[canvas-elk] edges dropped during graph build', {
      total_input: edges.length,
      kept: elkEdges.length,
      dropped_dangling_or_self: droppedDangling,
      dropped_duplicate_id: droppedDuplicate,
    });
  }
  return elkEdges;
}

function buildElkGraph(
  nodesByPhase: Map<string, CanvasNode[]>,
  edges: CanvasEdge[],
  existingPositions?: Map<string, { x: number; y: number }>,
): ElkGraph {
  const elkNodes: ElkNode[] = [];
  for (const phaseId of resolvePhaseOrder(nodesByPhase)) {
    const phaseNodes = nodesByPhase.get(phaseId);
    if (!phaseNodes || phaseNodes.length === 0) continue;
    elkNodes.push(buildPhaseBand(phaseId, phaseNodes, existingPositions));
  }

  // Edges only between nodes that ACTUALLY made it into elkNodes —
  // the structural fix for the historical "ELK throws null deref"
  // failure mode where a node mapped to an unknown phaseId got
  // dropped from the graph but edges referencing it survived.
  const emittedIds = collectEmittedIds(elkNodes);
  const elkEdges = buildElkEdges(edges, emittedIds);

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
  // elkjs's `elk.layout()` returns its own `ElkNode` type whose
  // `children` field is optional. The local `ElkGraph` has required
  // `children` for build-time clarity. Accepting `ElkNode` here lets
  // us thread the layouted result through without a type-cast.
  layouted: ElkNode,
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
          // ELK's ElkNode types width/height as optional on the
          // post-layout result; in practice elk always assigns them.
          // Default to the canonical 150×80 if elk somehow omits.
          const width = node.width ?? 150;
          const height = node.height ?? 80;

          nodes.set(node.id, { x, y, width, height });

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
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

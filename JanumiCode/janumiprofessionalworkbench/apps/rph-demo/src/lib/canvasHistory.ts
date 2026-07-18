import {
	createGraph,
	getDiff,
	getInvertedDiff,
	isEmptyDiff,
	toPatches,
	updateGraphWithPatches,
	type GraphPatch
} from '@statelyai/graph';

/**
 * Canvas history is intentionally presentation-only. It records node positions and never
 * attempts to reverse a Janumi command, event, PWU Type edit, or authoring-agent turn.
 */
export interface PositionedCanvasNode {
	readonly id: string;
	readonly position: {
		readonly x: number;
		readonly y: number;
	};
}

type PositionData = Record<string, never>;
type PositionPatch = GraphPatch<PositionData, never>;

interface CanvasHistoryEntry {
	readonly undo: readonly PositionPatch[];
	readonly redo: readonly PositionPatch[];
}

export interface CanvasHistory {
	readonly past: readonly CanvasHistoryEntry[];
	readonly future: readonly CanvasHistoryEntry[];
}

export interface CanvasHistoryResult<TNode extends PositionedCanvasNode> {
	readonly history: CanvasHistory;
	readonly nodes: TNode[];
}

export const EMPTY_CANVAS_HISTORY: CanvasHistory = Object.freeze({ past: [], future: [] });

const MAX_HISTORY_ENTRIES = 100;

function positionGraph(nodes: readonly PositionedCanvasNode[]) {
	return createGraph<PositionData, never>({
		nodes: nodes.map((node) => ({
			id: node.id,
			x: node.position.x,
			y: node.position.y,
			data: {}
		})),
		edges: []
	});
}

/** Record one completed drag gesture. A no-op gesture does not create a history entry. */
export function recordCanvasMove(
	history: CanvasHistory,
	before: readonly PositionedCanvasNode[],
	after: readonly PositionedCanvasNode[]
): CanvasHistory {
	const diff = getDiff(positionGraph(before), positionGraph(after));
	if (isEmptyDiff(diff)) return history;

	const entry: CanvasHistoryEntry = {
		redo: toPatches(diff),
		undo: toPatches(getInvertedDiff(diff))
	};
	return {
		past: [...history.past, entry].slice(-MAX_HISTORY_ENTRIES),
		future: []
	};
}

function applyPositionPatches<TNode extends PositionedCanvasNode>(
	nodes: readonly TNode[],
	patches: readonly PositionPatch[]
): TNode[] {
	const graph = positionGraph(nodes);
	updateGraphWithPatches(graph, [...patches]);
	const positions = new Map(
		graph.nodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])
	);

	return nodes.map((node) => {
		const position = positions.get(node.id);
		return position ? ({ ...node, position } as TNode) : node;
	});
}

export function undoCanvasMove<TNode extends PositionedCanvasNode>(
	history: CanvasHistory,
	nodes: readonly TNode[]
): CanvasHistoryResult<TNode> {
	const entry = history.past.at(-1);
	if (!entry) return { history, nodes: [...nodes] };

	return {
		nodes: applyPositionPatches(nodes, entry.undo),
		history: {
			past: history.past.slice(0, -1),
			future: [...history.future, entry]
		}
	};
}

export function redoCanvasMove<TNode extends PositionedCanvasNode>(
	history: CanvasHistory,
	nodes: readonly TNode[]
): CanvasHistoryResult<TNode> {
	const entry = history.future.at(-1);
	if (!entry) return { history, nodes: [...nodes] };

	return {
		nodes: applyPositionPatches(nodes, entry.redo),
		history: {
			past: [...history.past, entry],
			future: history.future.slice(0, -1)
		}
	};
}

// Adapter: a PWA's PWU Types -> Svelte Flow nodes/edges for the node-graph PWA Designer. Nodes are the reusable
// PWU Types, rendered by the PwuTypeCard custom node (name/kind/N-L/cardinality + the §11.7.4 assurance rail).
// The BASE view is the COMPOSITION tree only ("permits" edges — "this type may be decomposed into that one"),
// laid out by ELK through a serializable @statelyai/graph projection (with Dagre as an explicit fallback). Data-flow
// (requiredOutputs->requiredInputs) is a SEPARATE overlay, off by default, so the composition tree reads cleanly
// instead of being crossed by hand-off edges (§11.7.2: graph position shows type-composition only, not order/flow).
// Collapsing a non-leaf hides its subtree.
import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/svelte';
import { assurancePolicyLabel, ASSURANCE_FLOOR } from '$lib/authoring/pwuType';

/** A per-child composition rule (cardinality annotation) as the card reads it. */
export interface ChildRule {
	readonly typeId: string;
	readonly cardinality: string;
	readonly applicabilityNote?: string;
}

export interface PwuTypeNode {
	readonly id: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly isRoot: boolean;
	readonly permittedChildTypeIds: readonly string[];
	readonly permittedChildren?: readonly ChildRule[];
	readonly requiredInputs?: readonly string[];
	readonly requiredOutputs?: readonly string[];
	readonly requiredAssurancePolicyIds?: readonly string[];
}

/** The data the PwuTypeCard custom node renders. */
export interface PwuCardData {
	readonly id: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly isRoot: boolean;
	readonly isLeaf: boolean;
	readonly childCount: number;
	readonly collapsed: boolean;
	readonly orphan: boolean;
	/** Compact cardinality summary of the permitted children, e.g. "2×M1 · 1×M+". */
	readonly cardinalitySummary: string;
	/** The locked de-minimis floor (constant labels) shown on every card. */
	readonly floorLabels: readonly string[];
	/** Declared additive assurance policy labels (from requiredAssurancePolicyIds). */
	readonly policyLabels: readonly string[];
	/** Keeps connection handles aligned with the active ELK/Dagre lens. */
	readonly layoutDirection: PwaLayoutDirection;
	readonly onToggleCollapse: () => void;
	[key: string]: unknown;
}

// Selection is intentionally NOT an input here: it is handled by Svelte Flow's native node `selected` prop, so
// clicking a node never re-runs layout — the flow only recomputes on structural change (types / collapse
// / overlay). The card reads `selected` from NodeProps for its highlight.
export interface PwaFlowOptions {
	readonly collapsed: ReadonlySet<string>;
	readonly showDataFlow: boolean;
	readonly onToggleCollapse: (id: string) => void;
	/** DOWN is the composition-tree lens; RIGHT supports a phase-map lens without changing graph semantics. */
	readonly layoutDirection?: PwaLayoutDirection;
}

export type PwaLayoutDirection = 'DOWN' | 'RIGHT';

export interface PwaFlow {
	readonly nodes: Node[];
	readonly edges: Edge[];
	/** Visible diagnostic so a browser-side ELK failure never silently masquerades as the intended layout path. */
	readonly layoutEngine: 'ELK' | 'DAGRE';
}

const NODE_W = 240;
const NODE_H = 160;
const FLOOR_LABELS = ASSURANCE_FLOOR.map((p) => p.label);

/** The permits (composition) edges among known types. */
function permitPairs(
	types: readonly PwuTypeNode[],
	ids: ReadonlySet<string>
): { from: string; to: string }[] {
	return types.flatMap((t) =>
		t.permittedChildTypeIds.filter((c) => ids.has(c)).map((c) => ({ from: t.id, to: c }))
	);
}

/** The set of nodes visible given the collapsed set: BFS from top-level nodes, not descending into a collapsed one. */
function visibleSet(
	types: readonly PwuTypeNode[],
	pairs: readonly { from: string; to: string }[],
	collapsed: ReadonlySet<string>
): Set<string> {
	const childrenOf = new Map<string, string[]>();
	const hasParent = new Set<string>();
	for (const e of pairs) {
		childrenOf.set(e.from, [...(childrenOf.get(e.from) ?? []), e.to]);
		hasParent.add(e.to);
	}
	// Top-level = explicit roots + anything with no incoming permits edge (so nothing is silently orphaned away).
	const visible = new Set<string>();
	const hiddenByCollapse = new Set<string>();

	// Expand all seeds in one pass before marking collapsed descendants. That preserves a shared child reached
	// through another uncollapsed parent, matching the previous multi-parent behavior.
	const expand = (seeds: readonly string[]) => {
		const queue = [...seeds];
		const newlyVisibleCollapsed: string[] = [];
		while (queue.length) {
			const id = queue.shift()!;
			if (visible.has(id) || hiddenByCollapse.has(id)) continue;
			visible.add(id);
			if (collapsed.has(id)) {
				newlyVisibleCollapsed.push(id);
				continue;
			}
			for (const child of childrenOf.get(id) ?? []) queue.push(child);
		}

		// Do not later resurrect a subtree merely because its invalid shape contains a source-less cycle. Already
		// visible nodes stay visible when another uncollapsed path reached them.
		const hiddenQueue = newlyVisibleCollapsed.flatMap((id) => childrenOf.get(id) ?? []);
		while (hiddenQueue.length) {
			const id = hiddenQueue.shift()!;
			if (visible.has(id) || hiddenByCollapse.has(id)) continue;
			hiddenByCollapse.add(id);
			for (const child of childrenOf.get(id) ?? []) hiddenQueue.push(child);
		}
	};

	expand(types.filter((t) => t.isRoot || !hasParent.has(t.id)).map((t) => t.id));
	// An invalid disconnected closed cycle has no root/no-incoming seed. Show one authored seed per otherwise
	// unvisited component so the designer's health report can be acted on instead of the bad component vanishing.
	for (const type of types) {
		if (!visible.has(type.id) && !hiddenByCollapse.has(type.id)) expand([type.id]);
	}
	return visible;
}

/** Pre-order (depth-first) sequence index per node, following authored child order from the roots. Drives the
 *  LEFT-TO-RIGHT sibling ordering: the first-authored child sits leftmost. `visibleEdges` preserve authored order
 *  (they are filtered from `permitPairs`, which walks each type's permittedChildTypeIds in order). */
function preorderIndex(
	visibleTypes: readonly PwuTypeNode[],
	visibleEdges: readonly { from: string; to: string }[]
): Map<string, number> {
	const childrenOf = new Map<string, string[]>();
	const hasParent = new Set<string>();
	for (const e of visibleEdges) {
		childrenOf.set(e.from, [...(childrenOf.get(e.from) ?? []), e.to]);
		hasParent.add(e.to);
	}
	// Roots in authored (type-array) order — same top-level set visibleSet uses, so orphans are covered.
	const roots = visibleTypes.filter((t) => t.isRoot || !hasParent.has(t.id)).map((t) => t.id);
	const order = new Map<string, number>();
	let next = 0;
	const visit = (id: string) => {
		if (order.has(id)) return;
		order.set(id, next++);
		for (const c of childrenOf.get(id) ?? []) visit(c);
	};
	for (const r of roots) visit(r);
	// Any node the DFS somehow missed sorts last, stably.
	for (const t of visibleTypes) if (!order.has(t.id)) order.set(t.id, next++);
	return order;
}

/** Dagre fallback over the visible composition edges. Within each rank, authored order is restored along the
 *  cross-axis (left-to-right for DOWN, top-to-bottom for RIGHT). Returns xyflow top-left positions. */
function dagreLayout(
	visibleTypes: readonly PwuTypeNode[],
	visibleEdges: readonly { from: string; to: string }[],
	direction: PwaLayoutDirection
): Record<string, { x: number; y: number }> {
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: direction === 'DOWN' ? 'TB' : 'LR',
		nodesep: 36,
		ranksep: 64,
		marginx: 24,
		marginy: 24
	});
	g.setDefaultEdgeLabel(() => ({}));
	for (const t of visibleTypes) g.setNode(t.id, { width: NODE_W, height: NODE_H });
	for (const e of visibleEdges) g.setEdge(e.from, e.to);
	dagre.layout(g);

	// Dagre centers nodes; collect them, then re-order each rank by authored pre-order index.
	const centers = new Map<string, { x: number; y: number }>();
	for (const t of visibleTypes) {
		const n = g.node(t.id);
		centers.set(t.id, n ? { x: n.x, y: n.y } : { x: 0, y: 0 });
	}
	const order = preorderIndex(visibleTypes, visibleEdges);
	const ranks = new Map<number, string[]>();
	for (const t of visibleTypes) {
		const center = centers.get(t.id)!;
		const rank = Math.round(direction === 'DOWN' ? center.y : center.x);
		ranks.set(rank, [...(ranks.get(rank) ?? []), t.id]);
	}
	const reassignedCrossAxis = new Map<string, number>();
	for (const ids of ranks.values()) {
		const slots = ids
			.map((id) => {
				const center = centers.get(id)!;
				return direction === 'DOWN' ? center.x : center.y;
			})
			.sort((a, b) => a - b);
		const ordered = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
		ordered.forEach((id, i) => reassignedCrossAxis.set(id, slots[i]!));
	}

	const pos: Record<string, { x: number; y: number }> = {};
	for (const t of visibleTypes) {
		const c = centers.get(t.id)!;
		const cross = reassignedCrossAxis.get(t.id);
		const cx = direction === 'DOWN' ? (cross ?? c.x) : c.x;
		const cy = direction === 'RIGHT' ? (cross ?? c.y) : c.y;
		// dagre positions are node centers; xyflow wants the top-left corner.
		pos[t.id] = { x: cx - NODE_W / 2, y: cy - NODE_H / 2 };
	}
	return pos;
}

function compositionEdgeId(from: string, to: string): string {
	return `${from}->${to}`;
}

/** Keep the fallback explicit while ELK is being introduced; it preserves the previous Dagre behavior. */
function dagreCompositionFlow(
	visibleTypes: readonly PwuTypeNode[],
	visibleEdges: readonly { from: string; to: string }[],
	direction: PwaLayoutDirection
): PwaFlow {
	const positions = dagreLayout(visibleTypes, visibleEdges, direction);
	return {
		nodes: visibleTypes.map((type) => ({
			id: type.id,
			position: positions[type.id] ?? { x: 0, y: 0 },
			data: {}
		})),
		edges: visibleEdges.map((edge) => ({
			id: compositionEdgeId(edge.from, edge.to),
			source: edge.from,
			target: edge.to,
			label: 'permits'
		})),
		layoutEngine: 'DAGRE'
	};
}

/** Serializable structural graph -> ELK visual graph -> xyflow render model. Only composition edges participate in
 *  layout; app callbacks and the optional data-flow overlay are deliberately added after this boundary. */
async function layoutComposition(
	visibleTypes: readonly PwuTypeNode[],
	visibleEdges: readonly { from: string; to: string }[],
	direction: PwaLayoutDirection
): Promise<PwaFlow> {
	try {
		// ELK is substantially larger than the surrounding designer shell. Load the Stately layout pipeline only when
		// this projection actually needs layout, leaving Vite free to split the engine into an on-demand browser chunk.
		// Import failures belong inside this boundary too: an offline/stale chunk must take the same explicit fallback
		// path as an ELK execution failure instead of leaving the canvas blank.
		const [{ createGraph }, { getElkLayout }, { toXYFlow }] = await Promise.all([
			import('@statelyai/graph'),
			import('@statelyai/graph/layout/elk'),
			import('@statelyai/graph/xyflow')
		]);
		const graph = createGraph({
			id: 'pwa-composition',
			direction: direction === 'DOWN' ? 'down' : 'right',
			nodes: visibleTypes.map((type) => ({
				id: type.id,
				label: type.name,
				width: NODE_W,
				height: NODE_H
			})),
			edges: visibleEdges.map((edge) => ({
				id: compositionEdgeId(edge.from, edge.to),
				sourceId: edge.from,
				targetId: edge.to,
				label: 'permits'
			}))
		});
		const laidOut = await getElkLayout(graph, {
			algorithm: 'layered',
			direction: direction === 'DOWN' ? 'down' : 'right',
			spacing: { node: 36, layer: 64 },
			layoutOptions: {
				'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
				'elk.layered.crossingMinimization.forceNodeModelOrder': 'true'
			}
		});
		const flow = toXYFlow(laidOut);
		return { nodes: flow.nodes as Node[], edges: flow.edges as Edge[], layoutEngine: 'ELK' };
	} catch (error) {
		console.warn('ELK layout failed; falling back to Dagre for this PWA projection.', error);
		return dagreCompositionFlow(visibleTypes, visibleEdges, direction);
	}
}

/** Compact cardinality summary of a type's permitted children (falls back to M1 for children with no rule). */
function cardinalitySummary(t: PwuTypeNode): string {
	if (t.permittedChildTypeIds.length === 0) return '';
	const rules = new Map((t.permittedChildren ?? []).map((r) => [r.typeId, r.cardinality]));
	const counts = new Map<string, number>();
	for (const cid of t.permittedChildTypeIds) {
		const code = rules.get(cid) ?? 'M1';
		counts.set(code, (counts.get(code) ?? 0) + 1);
	}
	return [...counts.entries()].map(([code, n]) => `${n}×${code}`).join(' · ');
}

/** What a data-flow edge carries so the inspector can show the configured hand-off (which artifacts flow, and
 *  between which types) when the edge is clicked. */
export interface DataFlowEdgeData {
	readonly kind: 'dataflow';
	readonly sourceName: string;
	readonly targetName: string;
	/** The artifact names configured to flow (producer.requiredOutputs ∩ consumer.requiredInputs). */
	readonly artifacts: readonly string[];
	[key: string]: unknown;
}

/** Data-flow (concern-3) edges: a producer's requiredOutputs feeding another type's requiredInputs. Each edge is
 *  SELECTABLE and carries the flowing-artifact list in `data`, so clicking it reveals the configured hand-off. */
function dataFlowEdges(types: readonly PwuTypeNode[], visible: ReadonlySet<string>): Edge[] {
	const nameById = new Map(types.map((t) => [t.id, t.name]));
	const edges: Edge[] = [];
	for (const producer of types) {
		if (!visible.has(producer.id)) continue;
		const outputs = new Set(producer.requiredOutputs ?? []);
		if (outputs.size === 0) continue;
		for (const consumer of types) {
			if (consumer.id === producer.id || !visible.has(consumer.id)) continue;
			const shared = (consumer.requiredInputs ?? []).filter((i) => outputs.has(i));
			if (shared.length === 0) continue;
			const data: DataFlowEdgeData = {
				kind: 'dataflow',
				sourceName: nameById.get(producer.id) ?? producer.id,
				targetName: nameById.get(consumer.id) ?? consumer.id,
				artifacts: shared
			};
			edges.push({
				id: `flow:${producer.id}->${consumer.id}`,
				source: producer.id,
				target: consumer.id,
				label: `⤳ ${shared.join(', ')}`,
				animated: true,
				selectable: true,
				class: 'dataflow-edge',
				data,
				style: 'stroke:#61dac1;stroke-dasharray:6 4;',
				// Teal chip, dark text (HTML label div — `color`/`background`, not SVG `fill`). Signals "clickable".
				labelStyle:
					'color:#06110d;background:#61dac1;border-color:#61dac1;font-weight:700;cursor:pointer;'
			});
		}
	}
	return edges;
}

export async function toPwaFlow(
	types: readonly PwuTypeNode[],
	opts: PwaFlowOptions
): Promise<PwaFlow> {
	const ids = new Set(types.map((t) => t.id));
	const pairs = permitPairs(types, ids);
	const hasParent = new Set(pairs.map((e) => e.to));
	const visible = visibleSet(types, pairs, opts.collapsed);
	const visibleTypes = types.filter((t) => visible.has(t.id));
	const visiblePairs = pairs.filter((e) => visible.has(e.from) && visible.has(e.to));
	const composition = await layoutComposition(
		visibleTypes,
		visiblePairs,
		opts.layoutDirection ?? 'DOWN'
	);
	const layoutNodeById = new Map(composition.nodes.map((node) => [node.id, node]));
	const layoutEdgeById = new Map(composition.edges.map((edge) => [edge.id, edge]));

	const nodes: Node[] = visibleTypes.map((t) => {
		const layoutNode = layoutNodeById.get(t.id);
		const data: PwuCardData = {
			...layoutNode?.data,
			id: t.id,
			name: t.name,
			pwuKind: t.pwuKind,
			isRoot: t.isRoot,
			isLeaf: t.permittedChildTypeIds.length === 0,
			childCount: t.permittedChildTypeIds.length,
			collapsed: opts.collapsed.has(t.id),
			orphan: !t.isRoot && !hasParent.has(t.id),
			cardinalitySummary: cardinalitySummary(t),
			floorLabels: FLOOR_LABELS,
			policyLabels: (t.requiredAssurancePolicyIds ?? []).map(assurancePolicyLabel),
			layoutDirection: opts.layoutDirection ?? 'DOWN',
			onToggleCollapse: () => opts.onToggleCollapse(t.id)
		};
		return {
			...layoutNode,
			id: t.id,
			type: 'pwuType',
			position: layoutNode?.position ?? { x: 0, y: 0 },
			// Keep renderer geometry identical to the dimensions supplied to ELK/Dagre. The card scrolls its assurance
			// rail within this box, so an unusually long policy list cannot overlap a neighboring layer.
			width: NODE_W,
			height: NODE_H,
			data
		};
	});

	const permitsEdges: Edge[] = visiblePairs.map((e) => {
		const id = compositionEdgeId(e.from, e.to);
		return {
			...layoutEdgeById.get(id),
			id,
			source: e.from,
			target: e.to,
			label: 'permits',
			animated: false,
			// Muted-but-visible stroke on the dark canvas. The label chip (an HTML .svelte-flow__edge-label) is themed
			// via CSS variables in +page.svelte — the default white-bg/light-text washed out (§11.7 contrast fix).
			style: 'stroke:#454b54;stroke-width:1.5;'
		};
	});
	const edges = opts.showDataFlow
		? [...permitsEdges, ...dataFlowEdges(types, visible)]
		: permitsEdges;
	return { nodes, edges, layoutEngine: composition.layoutEngine };
}

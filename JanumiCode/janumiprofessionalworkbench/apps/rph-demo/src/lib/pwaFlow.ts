// Adapter: a PWA's PWU Types -> Svelte Flow nodes/edges for the node-graph PWA Designer. Nodes are the reusable
// PWU Types, rendered by the PwuTypeCard custom node (name/kind/N-L/cardinality + the §11.7.4 assurance rail).
// The BASE view is the COMPOSITION tree only ("permits" edges — "this type may be decomposed into that one"),
// laid out top-down as a tidy tree by dagre. Data-flow (requiredOutputs->requiredInputs) is a SEPARATE overlay,
// off by default, so the composition tree reads cleanly instead of being crossed by hand-off edges (§11.7.2:
// graph position shows type-composition only, not order/flow). Collapsing a non-leaf hides its subtree.
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
	readonly onToggleCollapse: () => void;
	[key: string]: unknown;
}

// Selection is intentionally NOT an input here: it is handled by Svelte Flow's native node `selected` prop, so
// clicking a node never re-runs the dagre layout — the flow only recomputes on structural change (types / collapse
// / overlay). The card reads `selected` from NodeProps for its highlight.
export interface PwaFlowOptions {
	readonly collapsed: ReadonlySet<string>;
	readonly showDataFlow: boolean;
	readonly onToggleCollapse: (id: string) => void;
}

export interface PwaFlow {
	readonly nodes: Node[];
	readonly edges: Edge[];
}

const NODE_W = 240;
const NODE_H = 132;
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
	const queue = types.filter((t) => t.isRoot || !hasParent.has(t.id)).map((t) => t.id);
	const visible = new Set<string>();
	while (queue.length) {
		const id = queue.shift()!;
		if (visible.has(id)) continue;
		visible.add(id);
		if (collapsed.has(id)) continue; // a collapsed node's subtree stays hidden
		for (const c of childrenOf.get(id) ?? []) queue.push(c);
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

/** dagre tidy top-down layout over the visible composition edges, then a stable within-rank re-order so siblings
 *  read LEFT-TO-RIGHT in authored order (dagre's crossing-minimizer otherwise mirrors them). We keep dagre's x-slots
 *  and y-rows and only permute which node occupies each slot within a rank — so subtree grouping and parent-centering
 *  (a parent sits over the centroid of its children's slots, invariant under permutation) are preserved. Returns
 *  xyflow top-left positions. */
function layout(
	visibleTypes: readonly PwuTypeNode[],
	visibleEdges: readonly { from: string; to: string }[]
): Record<string, { x: number; y: number }> {
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 64, marginx: 24, marginy: 24 });
	g.setDefaultEdgeLabel(() => ({}));
	for (const t of visibleTypes) g.setNode(t.id, { width: NODE_W, height: NODE_H });
	for (const e of visibleEdges) g.setEdge(e.from, e.to);
	dagre.layout(g);

	// dagre centers; collect them, then re-order each rank by authored pre-order index.
	const centers = new Map<string, { x: number; y: number }>();
	for (const t of visibleTypes) {
		const n = g.node(t.id);
		centers.set(t.id, n ? { x: n.x, y: n.y } : { x: 0, y: 0 });
	}
	const order = preorderIndex(visibleTypes, visibleEdges);
	const ranks = new Map<number, string[]>();
	for (const t of visibleTypes) {
		const y = Math.round(centers.get(t.id)!.y);
		ranks.set(y, [...(ranks.get(y) ?? []), t.id]);
	}
	const reassignedX = new Map<string, number>();
	for (const ids of ranks.values()) {
		const slots = ids.map((id) => centers.get(id)!.x).sort((a, b) => a - b);
		const ordered = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
		ordered.forEach((id, i) => reassignedX.set(id, slots[i]!));
	}

	const pos: Record<string, { x: number; y: number }> = {};
	for (const t of visibleTypes) {
		const c = centers.get(t.id)!;
		const cx = reassignedX.get(t.id) ?? c.x;
		// dagre positions are node centers; xyflow wants the top-left corner.
		pos[t.id] = { x: cx - NODE_W / 2, y: c.y - NODE_H / 2 };
	}
	return pos;
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

export function toPwaFlow(types: readonly PwuTypeNode[], opts: PwaFlowOptions): PwaFlow {
	const ids = new Set(types.map((t) => t.id));
	const pairs = permitPairs(types, ids);
	const hasParent = new Set(pairs.map((e) => e.to));
	const visible = visibleSet(types, pairs, opts.collapsed);
	const visibleTypes = types.filter((t) => visible.has(t.id));
	const visiblePairs = pairs.filter((e) => visible.has(e.from) && visible.has(e.to));
	const pos = layout(visibleTypes, visiblePairs);

	const nodes: Node[] = visibleTypes.map((t) => {
		const data: PwuCardData = {
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
			onToggleCollapse: () => opts.onToggleCollapse(t.id)
		};
		return {
			id: t.id,
			type: 'pwuType',
			position: pos[t.id] ?? { x: 0, y: 0 },
			data
		};
	});

	const permitsEdges: Edge[] = visiblePairs.map((e) => ({
		id: `${e.from}->${e.to}`,
		source: e.from,
		target: e.to,
		label: 'permits',
		animated: false,
		// Muted-but-visible stroke on the dark canvas. The label chip (an HTML .svelte-flow__edge-label) is themed
		// via CSS variables in +page.svelte — the default white-bg/light-text washed out (§11.7 contrast fix).
		style: 'stroke:#454b54;stroke-width:1.5;'
	}));
	const edges = opts.showDataFlow
		? [...permitsEdges, ...dataFlowEdges(types, visible)]
		: permitsEdges;
	return { nodes, edges };
}

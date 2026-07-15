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

/** dagre tidy top-down layout over the visible composition edges; returns xyflow top-left positions. */
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
	const pos: Record<string, { x: number; y: number }> = {};
	for (const t of visibleTypes) {
		const n = g.node(t.id);
		// dagre positions are node centers; xyflow wants the top-left corner.
		pos[t.id] = n ? { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 } : { x: 0, y: 0 };
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

/** Data-flow (concern-3) edges: a producer's requiredOutputs feeding another type's requiredInputs. */
function dataFlowEdges(types: readonly PwuTypeNode[], visible: ReadonlySet<string>): Edge[] {
	const edges: Edge[] = [];
	for (const producer of types) {
		if (!visible.has(producer.id)) continue;
		const outputs = new Set(producer.requiredOutputs ?? []);
		if (outputs.size === 0) continue;
		for (const consumer of types) {
			if (consumer.id === producer.id || !visible.has(consumer.id)) continue;
			const shared = (consumer.requiredInputs ?? []).filter((i) => outputs.has(i));
			if (shared.length === 0) continue;
			edges.push({
				id: `flow:${producer.id}->${consumer.id}`,
				source: producer.id,
				target: consumer.id,
				label: `⤳ ${shared.join(', ')}`,
				animated: true,
				style: 'stroke:#61dac1;stroke-dasharray:6 4;',
				labelStyle: 'fill:#61dac1;font-size:10px;'
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
		animated: false
	}));
	const edges = opts.showDataFlow
		? [...permitsEdges, ...dataFlowEdges(types, visible)]
		: permitsEdges;
	return { nodes, edges };
}

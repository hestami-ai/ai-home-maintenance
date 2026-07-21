// The hand-off DEPENDENCY walk projection (JAN-PWADESIGNER-DS-001 §5 / JAN-PWADESIGNER-DR-001 DWP-01).
//
// Intent: given a PWA's PWU-Type graph, produce an HONEST partial order over the ARTIFACT HAND-OFF plane
// (requiredOutputs → requiredInputs, i.e. `ex.dataFlow`) as a STRICT 4-WAY PARTITION of every node. It answers
// "what must be produced before what can be consumed" — a DEPENDENCY order.
//
// Boundary: this is a DEPENDENCY order, NEVER an execution schedule. The Coding Agent Guide §9.1 is explicit —
// "A PWU defines professional work. It does not embed its runtime sequence"; §3 — `PWA ≠ Execution Workflow`,
// `semantic progression ≠ temporal execution sequence`. The consumer (the walkthrough UI) numbers LAYERS as
// "dependency step k", shared within a layer; it must never present these as execution/temporal order.
//
// Do not change: this projection is ADVISORY. It MUST NOT be wired into `analyzePwaGraph`'s `valid` verdict.
//   A hand-off cycle is a design smell surfaced as a finding (like `conservation`/`delegatedAssurance`), NOT a hard
//   structural invariant like `acyclic-permits`. `valid` stays purely structural so the ValidatePwa/floor gate is
//   unchanged (pwa-graph.ts §PwaGraphReport). Gating `valid` on a hand-off cycle would silently block publication.
//
// Pure + browser-safe (only type + ./leaf imports), like the rest of rph-projections.
import type { PwaGraphExport } from './pwa-graph.js';
import { leafKind, type LeafKind } from './leaf.js';

/**
 * The honest partial order over the hand-off (dataFlow) plane — a STRICT 4-way partition: every node in `ex.nodes`
 * appears in EXACTLY ONE of these four buckets.
 */
export interface HandoffOrder {
	/** Kahn dependency layers. Nodes in the same layer are mutually independent (concurrent) and share a step number. */
	readonly layers: string[][];
	/** Mutually-dependent hand-off clusters (a hand-off cycle / SCC of size > 1) — no internal ordering exists. */
	readonly cycles: string[][];
	/** Nodes NOT in a cycle but transitively DOWNSTREAM of one — never dependency-resolvable (a producer they need
	 *  is stuck in a cluster). Distinct from `cycles` and from `unordered`. */
	readonly blocked: string[];
	/** Nodes with NO hand-off edge at all (composition-only leaves, isolated types) — outside the dependency order. */
	readonly unordered: string[];
}

/** Node-keyed hand-off findings for the per-node panel — the cleanly node-keyed facts (no name-substring matching
 *  against flat advisory strings; graph-level conservation stays `analyzePwaGraph(ex).conservation`). */
export interface NodeHandoffFinding {
	readonly nodeId: string;
	readonly name: string;
	readonly leafKind: LeafKind;
	/** Convenience of `leafKind === 'DELEGATED'` — a delegated leaf's assurance is the counterparty attestation (INV-2). */
	readonly delegated: boolean;
	/** In a mutually-dependent hand-off cycle (SCC > 1). */
	readonly inCycle: boolean;
	/** Downstream of a hand-off cycle — dependency-unresolvable. */
	readonly blocked: boolean;
}

const byId = (a: string, b: string): number => a.localeCompare(b);

/** Producer→consumer adjacency (deduped by Set) + the set of nodes participating in ANY hand-off edge. */
function buildDependencyGraph(ex: PwaGraphExport): {
	adj: Map<string, Set<string>>;
	participants: Set<string>;
} {
	const adj = new Map<string, Set<string>>();
	const participants = new Set<string>();
	for (const e of ex.dataFlow) {
		participants.add(e.producer);
		participants.add(e.consumer);
		let outs = adj.get(e.producer);
		if (!outs) {
			outs = new Set<string>();
			adj.set(e.producer, outs);
		}
		outs.add(e.consumer);
	}
	return { adj, participants };
}

/**
 * Kahn layering over the participant subgraph: repeatedly emit the set of nodes whose producers are all already
 * emitted. Each emitted set is one layer (a shared dependency-step). Indegree counts DISTINCT predecessors (adj
 * values are Sets), so A→B via two artifacts still makes B depend on A once. Returns the layers plus the emitted
 * set; anything left un-emitted is stuck in (or downstream of) a cycle — classified separately.
 */
function kahnLayers(
	adj: Map<string, Set<string>>,
	participants: Set<string>
): { layers: string[][]; emitted: Set<string> } {
	const indeg = new Map<string, number>();
	for (const p of participants) indeg.set(p, 0);
	for (const outs of adj.values()) for (const c of outs) indeg.set(c, (indeg.get(c) ?? 0) + 1);

	const layers: string[][] = [];
	const emitted = new Set<string>();
	let frontier = [...participants].filter((n) => (indeg.get(n) ?? 0) === 0).sort(byId);
	while (frontier.length > 0) {
		layers.push(frontier);
		for (const n of frontier) emitted.add(n);
		const next: string[] = [];
		for (const n of frontier)
			for (const c of adj.get(n) ?? []) {
				const d = (indeg.get(c) ?? 0) - 1;
				indeg.set(c, d);
				if (d === 0) next.push(c);
			}
		frontier = next.sort(byId);
	}
	return { layers, emitted };
}

/** BFS: the set of nodes reachable from `start` following ≥1 edge. A node reaches itself IFF it lies on a cycle. */
function reachableFrom(start: string, adj: Map<string, Set<string>>): Set<string> {
	const seen = new Set<string>();
	const queue: string[] = [...(adj.get(start) ?? [])];
	for (let i = 0; i < queue.length; i++) {
		const n = queue[i];
		if (n === undefined || seen.has(n)) continue;
		seen.add(n);
		for (const c of adj.get(n) ?? []) queue.push(c);
	}
	return seen;
}

/**
 * Classify the STUCK nodes (participants Kahn could not emit).
 *
 * Do not change: a stuck node is NOT necessarily a cycle member. Kahn strands the cycle's members AND everything
 *   transitively downstream of them. Classifying "any un-emitted node" as a cycle member mislabels innocent
 *   descendants (the reason a naïve rule is wrong — JAN-PWADESIGNER-DR-001 §19 dim-2 BLOCKER). A node is a cycle
 *   member IFF it can return to itself (it is in an SCC>1, self-edges being excluded upstream); the rest are
 *   `blocked` (downstream of a cycle). Cycle members are grouped into clusters by mutual reachability.
 */
function classifyStuck(
	stuck: string[],
	adj: Map<string, Set<string>>
): { cycles: string[][]; blocked: string[] } {
	const reach = new Map<string, Set<string>>();
	for (const n of stuck) reach.set(n, reachableFrom(n, adj));
	const inCycle = (n: string): boolean => reach.get(n)?.has(n) ?? false;

	const cycleNodes = stuck.filter(inCycle);
	const blocked = stuck.filter((n) => !inCycle(n)).sort(byId);

	const cycles: string[][] = [];
	const assigned = new Set<string>();
	for (const n of cycleNodes) {
		if (assigned.has(n)) continue;
		// Same SCC iff mutually reachable (n reaches m AND m reaches n). n reaches n (it is on a cycle), so n ∈ cluster.
		const cluster = cycleNodes.filter((m) => (reach.get(n)?.has(m) ?? false) && (reach.get(m)?.has(n) ?? false));
		for (const m of cluster) assigned.add(m);
		cycles.push([...cluster].sort(byId));
	}
	return { cycles, blocked };
}

/**
 * Layer a PWA's hand-off graph into the strict 4-way partition. Layers are the Kahn partial order; `cycles` are the
 * SCC>1 clusters; `blocked` are nodes downstream of a cycle; `unordered` are nodes with no hand-off edge. Every node
 * in `ex.nodes` appears exactly once across the four buckets.
 */
export function layerHandoff(ex: PwaGraphExport): HandoffOrder {
	const { adj, participants } = buildDependencyGraph(ex);
	const unordered = ex.nodes.map((n) => n.id).filter((id) => !participants.has(id)).sort(byId);
	const { layers, emitted } = kahnLayers(adj, participants);
	const stuck = [...participants].filter((n) => !emitted.has(n));
	const { cycles, blocked } = classifyStuck(stuck, adj);
	return { layers, cycles, blocked, unordered };
}

/** Node-keyed hand-off findings for the walkthrough panel — leaf kind (via the shared `leafKind`, F-13) plus
 *  cycle/blocked membership from `layerHandoff`. No name-substring resolution; graph-level conservation advisories
 *  remain `analyzePwaGraph(ex).conservation` (they are branch-level, not per-leaf). */
export function handoffFindings(
	ex: PwaGraphExport,
	order: HandoffOrder = layerHandoff(ex)
): NodeHandoffFinding[] {
	const cycleSet = new Set(order.cycles.flat());
	const blockedSet = new Set(order.blocked);
	return ex.nodes.map((n) => {
		const kind = leafKind(n);
		return {
			nodeId: n.id,
			name: n.name,
			leafKind: kind,
			delegated: kind === 'DELEGATED',
			inCycle: cycleSet.has(n.id),
			blocked: blockedSet.has(n.id)
		};
	});
}

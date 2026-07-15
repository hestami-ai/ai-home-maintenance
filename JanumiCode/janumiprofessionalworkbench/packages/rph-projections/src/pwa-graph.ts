// The PWA graph EXPORT + ANALYZER — a normalized, queryable read-model of a PWA's PWU-Type graph, and a set of
// structural invariants over it. This is what a harness operator (or a human, or an LLM judge) validates AGAINST —
// not a screenshot and not the Svelte-Flow render model. It is derived from the event-sourced engine truth (the
// write model / source of truth stays the event log); this is the stable, diffable read-and-validate view.
//
// Two independent relations live on the graph:
//   • permits  — COMPOSITION: "this kind of work may be decomposed into that kind" (the decomposition hierarchy).
//   • dataFlow — ORDERING: a producer's requiredOutput artifact = a consumer's requiredInput artifact.
// Structural validity is asserted on the permits hierarchy (single root, acyclic, connected); data-flow gaps and
// fan-out are reported as findings. Everything here is PURE and browser-safe (no engine import).

export interface PwaGraphNode {
	readonly id: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly isRoot: boolean;
	readonly permittedChildTypeIds: readonly string[];
	readonly requiredInputs: readonly string[];
	readonly requiredOutputs: readonly string[];
}

export interface PwaMeta {
	readonly id: string;
	readonly name: string;
	readonly domain: string;
	readonly version: string;
	readonly publicationStatus: string;
}

export interface PermitsEdge {
	readonly parent: string;
	readonly child: string;
}
export interface DataFlowEdge {
	readonly producer: string;
	readonly consumer: string;
	readonly artifact: string;
}
export interface ArtifactFlow {
	readonly name: string;
	readonly producedBy: string[];
	readonly consumedBy: string[];
}

/** The normalized, self-contained export of a PWA's PWU-Type graph — the canonical thing to validate/diff/judge. */
export interface PwaGraphExport {
	readonly pwa: PwaMeta;
	readonly nodes: PwaGraphNode[];
	readonly permits: PermitsEdge[];
	readonly dataFlow: DataFlowEdge[];
	readonly artifacts: ArtifactFlow[];
	readonly roots: string[];
}

export interface Invariant {
	readonly name: string;
	readonly ok: boolean;
	readonly detail: string;
}

export interface PwaGraphMetrics {
	readonly nodeCount: number;
	readonly permitsEdges: number;
	readonly dataFlowEdges: number;
	readonly rootCount: number;
	readonly maxDepth: number;
	readonly maxFanout: number;
	readonly orphanCount: number;
	readonly danglingInputs: number;
	readonly unusedOutputs: number;
	readonly cycleCount: number;
}

export interface PwaGraphReport {
	/** True iff every HARD invariant holds (single root, acyclic permits, connected). Findings are advisory. */
	readonly valid: boolean;
	readonly invariants: Invariant[];
	readonly metrics: PwaGraphMetrics;
	readonly findings: string[];
}

const FANOUT_LIMIT = 5;

/** permits = COMPOSITION edges: for each node, each permitted child type that resolves to a known node. */
function collectPermits(nodes: readonly PwaGraphNode[], ids: ReadonlySet<string>): PermitsEdge[] {
	const permits: PermitsEdge[] = [];
	for (const n of nodes)
		for (const c of n.permittedChildTypeIds)
			if (ids.has(c)) permits.push({ parent: n.id, child: c });
	return permits;
}

/** Index nodes by the artifacts they produce/consume (returned maps are reused by the caller). */
function buildFlowMaps(nodes: readonly PwaGraphNode[]): {
	producersOf: Map<string, string[]>;
	consumersOf: Map<string, string[]>;
} {
	const producersOf = new Map<string, string[]>();
	const consumersOf = new Map<string, string[]>();
	for (const n of nodes) {
		for (const o of n.requiredOutputs) producersOf.set(o, [...(producersOf.get(o) ?? []), n.id]);
		for (const i of n.requiredInputs) consumersOf.set(i, [...(consumersOf.get(i) ?? []), n.id]);
	}
	return { producersOf, consumersOf };
}

/** dataFlow = ORDERING edges: producer.requiredOutputs ∩ consumer.requiredInputs (self-edges excluded). */
function collectDataFlow(
	producersOf: ReadonlyMap<string, string[]>,
	consumersOf: ReadonlyMap<string, string[]>
): DataFlowEdge[] {
	const dataFlow: DataFlowEdge[] = [];
	for (const [artifact, producers] of producersOf)
		for (const producer of producers)
			for (const consumer of consumersOf.get(artifact) ?? [])
				if (consumer !== producer) dataFlow.push({ producer, consumer, artifact });
	return dataFlow;
}

/** Build the normalized export from a PWA's metadata + its live PWU-Type nodes. */
export function buildPwaGraphExport(pwa: PwaMeta, nodes: readonly PwaGraphNode[]): PwaGraphExport {
	const ids = new Set(nodes.map((n) => n.id));
	const permits = collectPermits(nodes, ids);

	// Data-flow: producer.requiredOutputs ∩ consumer.requiredInputs.
	const { producersOf, consumersOf } = buildFlowMaps(nodes);
	const dataFlow = collectDataFlow(producersOf, consumersOf);

	const artifactNames = new Set<string>([...producersOf.keys(), ...consumersOf.keys()]);
	const artifacts: ArtifactFlow[] = [...artifactNames]
		.sort((a, b) => Number(a > b) - Number(a < b))
		.map((name) => ({
			name,
			producedBy: producersOf.get(name) ?? [],
			consumedBy: consumersOf.get(name) ?? []
		}));

	return {
		pwa,
		nodes: [...nodes],
		permits,
		dataFlow,
		artifacts,
		roots: nodes.filter((n) => n.isRoot).map((n) => n.id)
	};
}

/** Reachable node ids from the roots via permits edges (BFS). */
function reachable(ex: PwaGraphExport): Set<string> {
	const children = new Map<string, string[]>();
	for (const e of ex.permits) children.set(e.parent, [...(children.get(e.parent) ?? []), e.child]);
	const seen = new Set<string>(ex.roots);
	const queue = [...ex.roots];
	while (queue.length) {
		const id = queue.shift()!;
		for (const c of children.get(id) ?? [])
			if (!seen.has(c)) {
				seen.add(c);
				queue.push(c);
			}
	}
	return seen;
}

/** Ids that participate in a permits cycle (DFS colouring). */
function cycleNodes(ex: PwaGraphExport): Set<string> {
	const children = new Map<string, string[]>();
	for (const e of ex.permits) children.set(e.parent, [...(children.get(e.parent) ?? []), e.child]);
	const colour = new Map<string, 0 | 1 | 2>(); // 0=unseen,1=in-stack,2=done
	const inCycle = new Set<string>();
	const visit = (id: string, stack: string[]): void => {
		colour.set(id, 1);
		stack.push(id);
		for (const c of children.get(id) ?? []) {
			const col = colour.get(c) ?? 0;
			if (col === 1) {
				// back-edge: everything from c up the stack is in a cycle
				const from = stack.lastIndexOf(c);
				if (from >= 0) for (const n of stack.slice(from)) inCycle.add(n);
			} else if (col === 0) visit(c, stack);
		}
		stack.pop();
		colour.set(id, 2);
	};
	for (const n of ex.nodes) if ((colour.get(n.id) ?? 0) === 0) visit(n.id, []);
	return inCycle;
}

/** Longest permits path length from any root (0 for a lone root); Infinity is impossible (cycles handled separately). */
function maxDepth(ex: PwaGraphExport): number {
	const children = new Map<string, string[]>();
	for (const e of ex.permits) children.set(e.parent, [...(children.get(e.parent) ?? []), e.child]);
	const memo = new Map<string, number>();
	const visiting = new Set<string>();
	const depth = (id: string): number => {
		if (memo.has(id)) return memo.get(id)!;
		if (visiting.has(id)) return 0; // guard against cycles
		visiting.add(id);
		let d = 0;
		for (const c of children.get(id) ?? []) d = Math.max(d, 1 + depth(c));
		visiting.delete(id);
		memo.set(id, d);
		return d;
	};
	return Math.max(0, ...ex.roots.map(depth));
}

/**
 * Analyze a PWA graph export. HARD invariants (drive `valid`): exactly one root, permits acyclic, every node
 * reachable from the root. Advisory findings: dangling data-flow inputs (a non-root type consumes an artifact no
 * type produces), unused outputs, over-broad fan-out (a "star" not a decomposition), duplicate kinds/names.
 */
export function analyzePwaGraph(ex: PwaGraphExport): PwaGraphReport {
	const nodeById = new Map(ex.nodes.map((n) => [n.id, n]));
	const cyc = cycleNodes(ex);
	const reach = reachable(ex);
	const orphans = ex.nodes.filter((n) => !n.isRoot && !reach.has(n.id));

	const invariants: Invariant[] = [
		{
			name: 'single-root',
			ok: ex.roots.length === 1,
			detail:
				ex.roots.length === 1
					? 'exactly one root'
					: `${ex.roots.length} roots (${ex.roots.map((r) => nodeById.get(r)?.name ?? r).join(', ')})`
		},
		{
			name: 'acyclic-permits',
			ok: cyc.size === 0,
			detail:
				cyc.size === 0 ? 'no composition cycles' : `${cyc.size} node(s) in a composition cycle`
		},
		{
			name: 'connected',
			ok: orphans.length === 0,
			detail:
				orphans.length === 0
					? 'every type is reachable from the root'
					: `${orphans.length} orphan(s): ${orphans.map((o) => o.name).join(', ')}`
		}
	];

	const findings: string[] = [];

	// Advisory: fan-out.
	let maxFanout = 0;
	for (const n of ex.nodes) {
		const kids = ex.permits.filter((e) => e.parent === n.id).length;
		maxFanout = Math.max(maxFanout, kids);
		if (kids >= FANOUT_LIMIT)
			findings.push(
				`fan-out: "${n.name}" permits ${kids} children (a flat star, not a decomposition) — group under intermediate areas and use data-flow for ordering.`
			);
	}

	// Advisory: dangling inputs (a non-root type consumes an artifact nothing produces).
	let danglingInputs = 0;
	for (const a of ex.artifacts) {
		if (a.producedBy.length > 0) continue;
		const nonRootConsumers = a.consumedBy.filter((id) => !nodeById.get(id)?.isRoot);
		if (nonRootConsumers.length > 0) {
			danglingInputs += 1;
			findings.push(
				`data-flow: "${a.name}" is required by ${nonRootConsumers.map((id) => nodeById.get(id)?.name ?? id).join(', ')} but no type produces it (dangling input).`
			);
		}
	}

	// Advisory: unused outputs.
	const unusedOutputs = ex.artifacts.filter(
		(a) => a.producedBy.length > 0 && a.consumedBy.length === 0
	).length;

	// Advisory: duplicate kinds / names.
	const dup = (key: (n: PwaGraphNode) => string, label: string): void => {
		const counts = new Map<string, number>();
		for (const n of ex.nodes) counts.set(key(n), (counts.get(key(n)) ?? 0) + 1);
		for (const [v, c] of counts)
			if (c > 1) findings.push(`duplicate ${label}: "${v}" appears ${c} times.`);
	};
	dup((n) => n.pwuKind, 'kind');
	dup((n) => n.name, 'name');

	const metrics: PwaGraphMetrics = {
		nodeCount: ex.nodes.length,
		permitsEdges: ex.permits.length,
		dataFlowEdges: ex.dataFlow.length,
		rootCount: ex.roots.length,
		maxDepth: maxDepth(ex),
		maxFanout,
		orphanCount: orphans.length,
		danglingInputs,
		unusedOutputs,
		cycleCount: cyc.size
	};

	return {
		valid: invariants.every((i) => i.ok),
		invariants,
		metrics,
		findings
	};
}

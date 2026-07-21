// Pure, testable data derivation for the per-node walkthrough panel (JAN-PWADESIGNER-DR-001 DWP-02). Resolving a
// node's hand-off neighbours (which nodes PRODUCE its required inputs, which CONSUME its required outputs) lives here
// so the .svelte panel stays a thin renderer and the resolution is unit-tested. Resolution is by artifact name over
// the authored type list — the same producer×consumer relation `collectDataFlow` uses (pwa-graph.ts), computed
// browser-side from the already-loaded types. Resolution is by node id (self excluded), so it is duplicate-NAME safe.
import type { PwuTypeNode } from './pwaFlow';
import type { HandoffOrder } from '@janumipwb/rph-projections';

/** The reactive walkthrough view a PwuTypeCard reads from context — so the badge/dim reach the cards WITHOUT the
 *  route's layout `$effect` (the single owner of `nodes`) ever becoming a second writer (no re-layout, no self-loop). */
export interface WalkthroughContext {
	readonly active: boolean;
	/** The 1-based dependency-step number for a node, or undefined (walkthrough off, or the node is not layered). */
	stepOf(id: string): number | undefined;
	/** True iff the node should be dimmed (walkthrough on and the node is not in the current step's layer). */
	isDimmed(id: string): boolean;
}

export const WALKTHROUGH_CONTEXT_KEY = 'pwa-walkthrough';

/** 1-based dependency-step number for every LAYERED node (shared within a layer). Cycle/blocked/unordered nodes are
 *  ABSENT — they have no dependency step. */
export function stepNumbersByNode(order: HandoffOrder): Map<string, number> {
	const m = new Map<string, number>();
	order.layers.forEach((layer, i) => {
		for (const id of layer) m.set(id, i + 1);
	});
	return m;
}

/** An artifact hand-off link: the artifact name and the counterpart node NAMES (its producers, or its consumers). */
export interface ArtifactLink {
	readonly artifact: string;
	readonly counterparts: string[];
}

export interface HandoffNeighbors {
	/** For each required INPUT of the node: the other nodes that produce that artifact. */
	readonly inputs: ArtifactLink[];
	/** For each required OUTPUT of the node: the other nodes that consume that artifact. */
	readonly outputs: ArtifactLink[];
}

const counterpartNames = (
	types: readonly PwuTypeNode[],
	selfId: string,
	pick: (t: PwuTypeNode) => readonly string[] | undefined,
	artifact: string
): string[] =>
	types
		.filter((t) => t.id !== selfId && (pick(t) ?? []).includes(artifact))
		.map((t) => t.name)
		.sort((a, b) => a.localeCompare(b));

/** Resolve a node's hand-off neighbours from the authored type list: producers of its required inputs, consumers of
 *  its required outputs. Self-edges excluded; deterministic (names sorted). */
export function handoffNeighbors(node: PwuTypeNode, types: readonly PwuTypeNode[]): HandoffNeighbors {
	const inputs = (node.requiredInputs ?? []).map((artifact) => ({
		artifact,
		counterparts: counterpartNames(types, node.id, (t) => t.requiredOutputs, artifact)
	}));
	const outputs = (node.requiredOutputs ?? []).map((artifact) => ({
		artifact,
		counterparts: counterpartNames(types, node.id, (t) => t.requiredInputs, artifact)
	}));
	return { inputs, outputs };
}

// ⭐⭐ `JAN-EXEC` Phase 7, THE REVIEW OF AN AUTHORED PWA IN PARTS, B1 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1-D3).
//
// One reviewer reading a whole authored PWA in one prompt saw about half of run-11's 16-type candidate once each type's prompt
// and policies were exported (`REG-F-571`). So each type is reviewed as a PART: its whole declared definition is the SUBJECT,
// and its place in the PWA is the CONTEXT the host assembles from the same export — its ancestors, the rule its parent gives
// it, its children's skeletons, the artifacts it consumes and produces with the types on their other ends, and, for a type
// with children, the data flow among them and across its subtree's boundary (design D3). A type with children is judged for
// their composition too (DEC-6), so a composite's part carries what that judgment needs, and its children's own definitions
// are left to their own parts.
// ⭐ A2 (2) — AND A COMPOSITE'S CONTEXT NAMES ITS CHILDREN, NEVER ITS GRANDCHILDREN: a type inside its subtree but itself, on
// an artifact or a flow, is named by the child whose subtree holds it (`peerNames`). Its grandchildren's composition is their
// parent's part's to judge, and their definitions are in no skeleton it is shown.
//
// PURE AND BROWSER-SAFE, like the export it reads, so that one function can give the authoring floor and the reviewer
// qualification the same parts (design D1); the review input is built from a part by one builder (`apps/rph-demo`
// `pwaTypeReviewInput`).
//
// ⚠ WHAT IT DOES NOT DECIDE: whether the graph is well formed. A PWA with several roots, a cycle or an orphan is still split
// into exactly one part per type (no review is added for a whole), and its deterministic floor check refuses it (design D2).
import type { CardinalityCode } from '@janumipwb/rph-contracts';
import type { DataFlowEdge, PwaGraphExport, PwaGraphNode, PwaGraphPromptTemplate } from './pwa-graph.js';

/** On a root's subject: the PWA's name, domain and description, as the export carries them. */
export interface PwaPartPwa {
	readonly name: string;
	readonly domain: string;
	readonly description?: string;
}

/** A part's SUBJECT: the type's whole declared definition as the export carries it, and, on a root, the PWA's own. */
export interface PwaPartSubject {
	readonly type: PwaGraphNode;
	readonly pwa?: PwaPartPwa;
}

/** A type above the subject, as its context names it: its name, kind and purpose. */
export interface PwaPartAncestor {
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose?: string;
}

/**
 * The rule a type that permits the subject gives it, from that type's `permittedChildren`: its cardinality and applicability
 * note. ⚠ A parent that stores no rule for the subject carries its name alone — no authored value, which is instantiated M1.
 */
export interface PwaPartParentRule {
	readonly parent: string;
	readonly cardinality?: CardinalityCode;
	readonly applicabilityNote?: string;
}

/**
 * An artifact the subject consumes or produces, with every type of the PWA that produces and consumes it, by name.
 * ⭐ A2 (2) — on a composite's part, a type inside its subtree but itself is named by the child whose subtree holds it, each
 * name once.
 */
export interface PwaPartArtifact {
	readonly name: string;
	readonly producedBy: readonly string[];
	readonly consumedBy: readonly string[];
}

/** One data-flow edge, its producer and consumer by name — ⭐ A2 (2) — each as the composite's part names it (`peerNames`). */
export interface PwaPartFlow {
	readonly producer: string;
	readonly consumer: string;
	readonly artifact: string;
}

/**
 * A composite's data flow: each edge from one child's subtree to another's, and each edge with one end inside its own subtree
 * and the other outside. ⚠ An edge within one child's subtree is that child's own composition's, and an edge between the type
 * itself and its subtree is in its own `artifacts` already, so neither is listed here.
 * ⭐ A2 (2) — each listed BY CHILD: an end inside its subtree but the type itself is named by the child whose subtree holds
 * it, the type itself and an end outside by its own name, so edges that name the same producer, consumer and artifact are
 * listed once.
 */
export interface PwaPartDataFlow {
	readonly amongChildren: readonly PwaPartFlow[];
	readonly acrossBoundary: readonly PwaPartFlow[];
}

/** A part's CONTEXT, assembled from the export. `dataFlow` only for a type with children. */
export interface PwaPartContext {
	readonly ancestors: readonly PwaPartAncestor[];
	readonly parentRules: readonly PwaPartParentRule[];
	readonly artifacts: readonly PwaPartArtifact[];
	readonly dataFlow?: PwaPartDataFlow;
}

/** A child's SKELETON: every field the export carries of it but its prompt template's text and output contract. */
export type PwaChildSkeleton = Omit<PwaGraphNode, 'promptTemplate'> & {
	readonly promptTemplate?: Pick<PwaGraphPromptTemplate, 'status' | 'templateVersion'>;
};

/** One part: the type it reviews, its subject, its context, and its children's skeletons in their permitted order. */
export interface PwaTypePart {
	readonly typeId: string;
	readonly subject: PwaPartSubject;
	readonly context: PwaPartContext;
	readonly childSkeletons: readonly PwaChildSkeleton[];
}

/** Parent ids → child ids over the export's permits, each list deduplicated, in the export's order. */
function childrenByParent(ex: PwaGraphExport): Map<string, string[]> {
	const m = new Map<string, string[]>();
	for (const e of ex.permits) {
		const list = m.get(e.parent) ?? [];
		if (!list.includes(e.child)) list.push(e.child);
		m.set(e.parent, list);
	}
	return m;
}

/** `id` and every type below it over permits — cycle-guarded, so a type that permits itself ends the walk. */
function subtreeOf(children: ReadonlyMap<string, readonly string[]>, id: string): Set<string> {
	const out = new Set<string>();
	const queue = [id];
	while (queue.length > 0) {
		const x = queue.shift()!;
		if (out.has(x)) continue;
		out.add(x);
		for (const c of children.get(x) ?? []) if (!out.has(c)) queue.push(c);
	}
	return out;
}

/** Each type's depth below a root over permits, by breadth from every root at once; a type no root reaches has none. */
function depthsFromRoots(ex: PwaGraphExport, children: ReadonlyMap<string, readonly string[]>): Map<string, number> {
	const depth = new Map<string, number>();
	const queue: string[] = [];
	for (const r of ex.roots)
		if (!depth.has(r)) {
			depth.set(r, 0);
			queue.push(r);
		}
	while (queue.length > 0) {
		const x = queue.shift()!;
		for (const c of children.get(x) ?? [])
			if (!depth.has(c)) {
				depth.set(c, depth.get(x)! + 1);
				queue.push(c);
			}
	}
	return depth;
}

/**
 * The types above `id`, the root first: every ancestor over permits, ordered by its depth below a root and then by export
 * order; an ancestor no root reaches follows, in export order. ⚠ The subject itself is never its own ancestor, even in a cycle.
 */
function ancestorsOf(
	ex: PwaGraphExport,
	id: string,
	parents: ReadonlyMap<string, readonly string[]>,
	depth: ReadonlyMap<string, number>
): PwaGraphNode[] {
	const above = new Set<string>();
	const queue = [...(parents.get(id) ?? [])];
	while (queue.length > 0) {
		const x = queue.shift()!;
		if (x === id || above.has(x)) continue;
		above.add(x);
		queue.push(...(parents.get(x) ?? []));
	}
	const order = new Map(ex.nodes.map((n, i) => [n.id, i]));
	const rank = (n: PwaGraphNode): number => depth.get(n.id) ?? Number.POSITIVE_INFINITY;
	return ex.nodes
		.filter((n) => above.has(n.id))
		.sort((a, b) => rank(a) - rank(b) || order.get(a.id)! - order.get(b.id)!);
}

/** A child's skeleton: the node, field for field in its own order, its prompt template cut to its status and version. */
function skeletonOf(n: PwaGraphNode): PwaChildSkeleton {
	const template = n.promptTemplate;
	return Object.fromEntries(
		Object.entries(n).map(([key, value]) =>
			key === 'promptTemplate' && template !== undefined
				? [key, { status: template.status, templateVersion: template.templateVersion }]
				: [key, value]
		)
	) as PwaChildSkeleton;
}

/** The PWA's name, domain and description, for a root's subject. */
function pwaOf(ex: PwaGraphExport): PwaPartPwa {
	return {
		name: ex.pwa.name,
		domain: ex.pwa.domain,
		...(ex.pwa.description !== undefined ? { description: ex.pwa.description } : {})
	};
}

/**
 * ⭐ A2 (2) — HOW A TYPE'S PART NAMES ANOTHER TYPE: the type itself, and any type outside its subtree, by its own name; a type
 * inside its subtree by each of its children whose subtree holds it, in the order it permits them. So a leaf names every type
 * as itself, and a composite names its children, never its grandchildren.
 */
function peerNames(
	id: string,
	kids: readonly string[],
	children: ReadonlyMap<string, readonly string[]>,
	nameOf: (id: string) => string
): (other: string) => string[] {
	const childTrees = kids.map((c) => ({ name: nameOf(c), tree: subtreeOf(children, c) }));
	return (other) => {
		const holders = other === id ? [] : childTrees.filter((c) => c.tree.has(other)).map((c) => c.name);
		return holders.length > 0 ? holders : [nameOf(other)];
	};
}

/** `xs` with each repeat dropped, by its JSON, the first kept where it stood. */
function once<T>(xs: readonly T[]): T[] {
	const seen = new Set<string>();
	return xs.filter((x) => {
		const key = JSON.stringify(x);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** A composite's data flow over the export's edges, in their order (`PwaPartDataFlow`), each end named by `peer`. */
function dataFlowOf(
	ex: PwaGraphExport,
	id: string,
	kids: readonly string[],
	children: ReadonlyMap<string, readonly string[]>,
	peer: (other: string) => string[]
): PwaPartDataFlow {
	const subtree = subtreeOf(children, id);
	const childTrees = kids.map((c) => subtreeOf(children, c));
	const named = (e: DataFlowEdge): PwaPartFlow[] =>
		peer(e.producer).flatMap((producer) => peer(e.consumer).map((consumer) => ({ producer, consumer, artifact: e.artifact })));
	const amongChildren: PwaPartFlow[] = [];
	const acrossBoundary: PwaPartFlow[] = [];
	for (const e of ex.dataFlow) {
		const inside = [subtree.has(e.producer), subtree.has(e.consumer)];
		if (inside[0] !== inside[1]) acrossBoundary.push(...named(e));
		else if (
			inside[0] &&
			!childTrees.some((t) => t.has(e.producer) && t.has(e.consumer)) &&
			childTrees.some((t) => t.has(e.producer)) &&
			childTrees.some((t) => t.has(e.consumer))
		)
			amongChildren.push(...named(e));
	}
	return { amongChildren: once(amongChildren), acrossBoundary: once(acrossBoundary) };
}

/**
 * ⭐⭐ THE PARTS OF AN AUTHORED PWA: one per type, in the export's order — a type's subject its whole definition as the export
 * carries it (and the PWA's name, domain and description on a root), its context assembled from the same export, and its
 * children's skeletons in the order it permits them. Pure: the same export always gives the same parts.
 */
export function pwaTypeParts(ex: PwaGraphExport): PwaTypePart[] {
	const byId = new Map(ex.nodes.map((n) => [n.id, n]));
	const nameOf = (id: string): string => byId.get(id)?.name ?? id;
	const children = childrenByParent(ex);
	const parents = new Map<string, string[]>();
	for (const [parent, kids] of children)
		for (const kid of kids) parents.set(kid, [...(parents.get(kid) ?? []), parent]);
	const depth = depthsFromRoots(ex, children);
	return ex.nodes.map((n) => {
		const kids = children.get(n.id) ?? [];
		const peer = peerNames(n.id, kids, children, nameOf);
		const shared = new Set([...n.requiredInputs, ...n.requiredOutputs]);
		const parentRules: PwaPartParentRule[] = ex.nodes
			.filter((p) => (parents.get(n.id) ?? []).includes(p.id))
			.map((p) => {
				const rule = p.permittedChildren?.find((r) => r.typeId === n.id);
				return {
					parent: p.name,
					...(rule === undefined ? {} : { cardinality: rule.cardinality }),
					...(rule?.applicabilityNote === undefined ? {} : { applicabilityNote: rule.applicabilityNote })
				};
			});
		const context: PwaPartContext = {
			ancestors: ancestorsOf(ex, n.id, parents, depth).map((a) => ({
				name: a.name,
				pwuKind: a.pwuKind,
				...(a.purpose === undefined ? {} : { purpose: a.purpose })
			})),
			parentRules,
			artifacts: ex.artifacts
				.filter((a) => shared.has(a.name))
				.map((a) => ({ name: a.name, producedBy: once(a.producedBy.flatMap(peer)), consumedBy: once(a.consumedBy.flatMap(peer)) })),
			...(kids.length > 0 ? { dataFlow: dataFlowOf(ex, n.id, kids, children, peer) } : {})
		};
		return {
			typeId: n.id,
			subject: { type: n, ...(n.isRoot ? { pwa: pwaOf(ex) } : {}) },
			context,
			childSkeletons: kids.map((k) => skeletonOf(byId.get(k)!))
		};
	});
}

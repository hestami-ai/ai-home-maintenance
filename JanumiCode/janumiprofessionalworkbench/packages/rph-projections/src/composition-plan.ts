// JPWB-SPEC-001-DR-002 W-3 — what instantiating a Professional Work Architecture MEANS, as a pure function.
//
// A PWA declares a composition tree of PWU Types. An Undertaking that binds a PWA is supposed to realize that tree
// as PWU Instances. Until W-3 nothing did: creating an Undertaking produced ZERO PWUs, and the only way to
// populate one was to hand-pick a single type at a time. A reusable Work Architecture that no Undertaking
// instantiates is not performing the role DOC-001 gives it.
//
// THIS FILE DECIDES WHAT TO CREATE. It creates nothing itself — it emits a PLAN, so the decision is testable
// without an engine, a store, or a browser, and so the surface's job reduces to dispatching what it is handed.
//
// ── THE CARDINALITY RULE, AND WHY IT IS NOT "INSTANTIATE THE PERMITTED CHILDREN" ────────────────────────────
//
// `canonical-vocabulary.json` (CardinalityCode) states the ratified semantics verbatim:
//
//     "M1 mandatory-exactly-one; M+ mandatory-one-or-more; C1 conditional-zero-or-one;
//      C+ conditional-zero-or-more"
//
// The operative quantity is the MANDATORY MINIMUM: 1 for M1 and M+, 0 for C1 and C+. A conditional child is one
// a professional MAY add, on a judgement this system deliberately does not model yet — the vocabulary says the
// structured applicability predicate "is deferred (free-text note for now)". So instantiating a C1 or C+ child
// would be the surface making a professional judgement on the professional's behalf, which is the same defect
// class as the fabricated risk profile W-4 removes. They are OFFERED instead, and the offer carries the note.
//
// The roadmap that commissioned this said "M1/C1 instantiate one; M+/C+ instantiate one and offer more; C*
// conditional children are offered, not created" — which says two different things about C1 in one sentence, and
// gets the minimum wrong for both conditional codes. It was written from the enum's existence rather than from
// its declared meaning. The rule here is the vocabulary's.
import type { CardinalityCode, PermittedChildRule } from '@janumipwb/rph-contracts';

/** The subset of a PWU Type this planner reads. Structural only — no lifecycle, no assurance. */
export interface CompositionNode {
	readonly id: string;
	readonly isRoot: boolean;
	/** The flat permitted set. Authoritative for WHICH types may be children. */
	readonly permittedChildTypeIds: readonly string[];
	/** Per-child rules. Optional and frequently absent — see `ruleFor`. */
	readonly permittedChildren?: readonly PermittedChildRule[];
}

/** One PWU Instance the Undertaking should create. `key` is a plan-local handle, not an id. */
export interface PlannedInstance {
	readonly key: string;
	readonly typeId: string;
	readonly parentKey?: string;
}

/** A child a professional MAY add — surfaced as an affordance, never created. */
export interface OfferedChild {
	readonly parentKey: string;
	readonly typeId: string;
	readonly cardinality: CardinalityCode;
	readonly applicabilityNote?: string;
}

export interface CompositionPlan {
	readonly instances: readonly PlannedInstance[];
	/** Parent → children, for the DecompositionContract recorded once the instances exist. */
	readonly decompositions: readonly { readonly parentKey: string; readonly childKeys: readonly string[] }[];
	readonly offered: readonly OfferedChild[];
	/** Permitted child ids naming a type the PWA does not contain. Reported, never silently dropped. */
	readonly unresolved: readonly { readonly parentTypeId: string; readonly typeId: string }[];
}

/** The mandatory minimum for a cardinality code — the ONE place the M/C distinction is decided. */
function mandatoryMinimum(code: CardinalityCode): number {
	return code === 'M1' || code === 'M+' ? 1 : 0;
}

/**
 * The rule governing one permitted child.
 *
 * A permitted child with NO rule defaults to **M1**, which `m1-object-fields.json` states for
 * `permittedChildren` and which matters far more than it looks: `permittedChildren` is OPTIONAL on a PWU Type, so
 * a PWA authored before the field existed — or by any surface that does not set it — carries only the flat
 * `permittedChildTypeIds`. Defaulting those to "conditional" would instantiate NOTHING for such a PWA, and the
 * empty result is indistinguishable from a correctly-instantiated architecture whose children are all optional.
 * Defaulting to mandatory fails loudly instead.
 */
function ruleFor(node: CompositionNode, typeId: string): PermittedChildRule {
	const declared = node.permittedChildren?.find((r) => r.typeId === typeId);
	return declared ?? { typeId, cardinality: 'M1' };
}

/**
 * Plan the instantiation of `rootTypeId`'s composition tree.
 *
 * Depth-first from the root, creating the mandatory minimum for each permitted child and recording the rest as
 * offers. A type already on the current path is NOT descended into again — a PWA may legitimately declare a
 * recursive architecture, and the planner must terminate on one rather than trusting that no author will write it.
 * The cycle is reported through `unresolved` so it is visible rather than silently truncated.
 */
export function planComposition(
	nodes: readonly CompositionNode[],
	rootTypeId: string
): CompositionPlan {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const instances: PlannedInstance[] = [];
	const decompositions: { parentKey: string; childKeys: string[] }[] = [];
	const offered: OfferedChild[] = [];
	const unresolved: { parentTypeId: string; typeId: string }[] = [];
	if (!byId.has(rootTypeId)) return { instances, decompositions, offered, unresolved };

	let seq = 0;
	// Returns the key it minted. Deliberately: the first draft computed a child's key by PREDICTING the next
	// sequence number, which was correct only because the recursive call happened on the very next line — a
	// coupling nothing would have caught if a statement were ever inserted between them.
	const visit = (typeId: string, parentKey: string | undefined, path: readonly string[]): string => {
		const node = byId.get(typeId)!;
		const key = `i${++seq}`;
		instances.push(parentKey === undefined ? { key, typeId } : { key, typeId, parentKey });

		const childKeys: string[] = [];
		for (const childTypeId of node.permittedChildTypeIds) {
			if (!byId.has(childTypeId)) {
				// A PWA can PUBLISH with a permitted child that resolves to nothing: `definePwuType` never checks,
				// and the graph projection drops unresolvable ids when collecting permits. Reporting it is what lets
				// the caller refuse rather than quietly instantiate a smaller tree than the architecture declares.
				unresolved.push({ parentTypeId: typeId, typeId: childTypeId });
				continue;
			}
			const rule = ruleFor(node, childTypeId);
			if (mandatoryMinimum(rule.cardinality) === 0) {
				offered.push(
					rule.applicabilityNote === undefined
						? { parentKey: key, typeId: childTypeId, cardinality: rule.cardinality }
						: {
								parentKey: key,
								typeId: childTypeId,
								cardinality: rule.cardinality,
								applicabilityNote: rule.applicabilityNote
							}
				);
				continue;
			}
			if (path.includes(childTypeId)) {
				// Recursive architecture. The child is mandatory, so it is NOT an offer — it is a structure this
				// planner declines to expand, and saying so is the honest report.
				unresolved.push({ parentTypeId: typeId, typeId: childTypeId });
				continue;
			}
			childKeys.push(visit(childTypeId, key, [...path, typeId]));
		}
		if (childKeys.length > 0) decompositions.push({ parentKey: key, childKeys });
		return key;
	};

	visit(rootTypeId, undefined, []);
	return { instances, decompositions, offered, unresolved };
}

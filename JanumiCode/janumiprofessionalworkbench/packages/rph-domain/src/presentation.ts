// Presentation independence (Property P8 / §35.8; the RPH-PRJ family). A presentation/layout change — canvas
// position, node ordering, a display-only revision bump — MUST NOT alter an object's semantic version or its
// assurance state. Semantic version increments only when meaning, obligations, assurance requirements, or
// authority change (§4); layout carries no semantic weight. Pure, deterministic — no I/O.

/** The semantic facets a presentation change must leave untouched. */
export interface SemanticSnapshot {
	readonly semanticVersion: number;
	readonly assuranceState: string;
}

/** An object that carries both semantic facets and a presentation surface (layout + a display revision). */
export interface PresentationBearing extends SemanticSnapshot {
	readonly revision: number;
	readonly layout?: unknown;
}

/**
 * Property P8. True iff the change from `before` to `after` altered NOTHING semantic — the semantic version and
 * the assurance state are identical. A presentation-only edit must satisfy this; a change that fails it is a
 * semantic change and must have gone through the proper versioning path.
 */
export function isPresentationOnlyChange(
	before: SemanticSnapshot,
	after: SemanticSnapshot
): boolean {
	return (
		before.semanticVersion === after.semanticVersion &&
		before.assuranceState === after.assuranceState
	);
}

/**
 * Apply a presentation-only change: swap the layout and bump the DISPLAY revision, leaving semanticVersion and
 * assuranceState untouched (§4: layout is not a semantic change). The result always satisfies
 * isPresentationOnlyChange against the input.
 */
export function applyPresentationChange<T extends PresentationBearing>(
	obj: T,
	newLayout: unknown
): T {
	return { ...obj, revision: obj.revision + 1, layout: newLayout };
}

// Composition-structure lint — gentle, advisory checks on the PWU-Type graph's SHAPE (not a domain rule; the engine
// accepts any legal composition). It nudges toward a real decomposition HIERARCHY rather than a flat mesh: the most
// common failure is the root permitting every area (a star), which is not a decomposition and renders as a mesh.
// The agent runs this on itself (the review_composition tool) and fixes findings; a human can read the same list.

export interface CompositionNode {
	readonly id: string;
	readonly name: string;
	readonly isRoot: boolean;
	readonly permittedChildTypeIds: readonly string[];
}

export interface CompositionFinding {
	readonly severity: 'warn' | 'info';
	readonly message: string;
}

/** A type permitting this many or more children reads as a flat fan-out rather than a nested decomposition. */
export const FANOUT_LIMIT = 5;

/** Advisory structural findings for a PWU-Type graph (empty = clean). Never throws; order: root → fan-out → orphans. */
export function lintComposition(types: readonly CompositionNode[]): CompositionFinding[] {
	const findings: CompositionFinding[] = [];
	if (types.length === 0) return findings;
	const ids = new Set(types.map((t) => t.id));

	const roots = types.filter((t) => t.isRoot);
	if (roots.length === 0)
		findings.push({
			severity: 'warn',
			message: 'No root type — exactly one type must be the root.'
		});
	else if (roots.length > 1)
		findings.push({
			severity: 'warn',
			message: `${roots.length} root types (${roots
				.map((r) => r.name)
				.join(', ')}) — exactly one is expected; unset isRoot on the others.`
		});

	for (const t of types) {
		const children = t.permittedChildTypeIds.filter((c) => ids.has(c));
		if (children.length >= FANOUT_LIMIT)
			findings.push({
				severity: 'warn',
				message: `"${t.name}" permits ${children.length} children — that is a flat fan-out (a star), not a decomposition. Group them under 2–4 intermediate areas, and express phase ORDERING with data-flow (requiredOutputs → requiredInputs), not composition edges.`
			});
	}

	// Orphans: a non-root type that no live type permits as a child is unreachable from the root.
	const permitted = new Set<string>();
	for (const t of types) for (const c of t.permittedChildTypeIds) if (ids.has(c)) permitted.add(c);
	for (const t of types)
		if (!t.isRoot && !permitted.has(t.id))
			findings.push({
				severity: 'info',
				message: `"${t.name}" is not reachable from the root (no type permits it as a child) — link it under a parent.`
			});

	return findings;
}

// Composition-structure lint — gentle, advisory checks on the PWU-Type graph's SHAPE (not a domain rule; the engine
// accepts any legal composition). It nudges toward a real decomposition HIERARCHY rather than a flat mesh: the most
// common failure is the root permitting every area (a star), which is not a decomposition and renders as a mesh.
// The agent runs this on itself (the review_composition tool) and fixes findings; a human can read the same list.
import type { ExecutionBoundary } from '@janumipwb/rph-contracts';

export interface CompositionNode {
	readonly id: string;
	readonly name: string;
	readonly isRoot: boolean;
	readonly permittedChildTypeIds: readonly string[];
	/** JAN-PRPWA-DS-001 STD-2 — a DELEGATED_EXTERNAL node is terminal by contract and is SKIPPED by the
	 *  under-decomposition advisory (INV-4a). Optional/absent ⇒ treated as INTERNAL. */
	readonly executionBoundary?: ExecutionBoundary;
	/** The distinct deliverables the type produces — the structural proxy the under-decomposition advisory reads
	 *  (INV-4b). Optional so pre-existing CompositionNode literals keep compiling. */
	readonly requiredOutputs?: readonly string[];
}

export interface CompositionFinding {
	readonly severity: 'warn' | 'info';
	readonly message: string;
}

/** A type permitting this many or more children reads as a flat fan-out rather than a nested decomposition. */
export const FANOUT_LIMIT = 5;

/** Root-count findings: zero roots or more than one both violate the "exactly one root" rule. */
function checkRoot(types: readonly CompositionNode[], findings: CompositionFinding[]): void {
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
}

/** Fan-out findings: a type permitting FANOUT_LIMIT+ live children reads as a star, not a decomposition. */
function checkFanout(
	types: readonly CompositionNode[],
	ids: ReadonlySet<string>,
	findings: CompositionFinding[]
): void {
	for (const t of types) {
		const children = t.permittedChildTypeIds.filter((c) => ids.has(c));
		if (children.length >= FANOUT_LIMIT)
			findings.push({
				severity: 'warn',
				message: `"${t.name}" permits ${children.length} children — that is a flat fan-out (a star), not a decomposition. Group them under 2–4 intermediate areas, and express phase ORDERING with data-flow (requiredOutputs → requiredInputs), not composition edges.`
			});
	}
}

/**
 * Under-decomposition advisory — the symmetric partner to checkFanout (SPEC-2). A leaf (no live permitted children)
 * that is executed INTERNALLY yet declares more than one distinct requiredOutput is a multiple-responsibility
 * signal: it likely bundles work that should decompose (INV-4b). This is a HEURISTIC on a structural proxy, not a
 * machine-check of "irreducible" (R-5) — it MAY false-positive on a genuinely irreducible multi-output leaf, so it
 * is advisory (info) and dismissible, and never blocks a commit (INV-6).
 *
 * A DELEGATED_EXTERNAL node is terminal by contract (INV-1) and is SKIPPED structurally (INV-4a) — delegating a
 * whole unit across an organizational boundary is NOT under-decomposition, whatever it produces. This is a hard
 * structural suppression, not a tolerance.
 *
 * Only the >1-distinct-output arm is implemented now. The template-keyed arms (a pwuKind the domain template lists
 * as `typicallyDecomposed`; a branch shallower than a template-declared expectation) are DEFERRED — they depend on
 * the SPEC-4/R-12 domain template, which does not exist yet. The advisory is therefore a PARTIAL heuristic today.
 */
function checkUnderDecomposition(
	types: readonly CompositionNode[],
	ids: ReadonlySet<string>,
	findings: CompositionFinding[]
): void {
	for (const t of types) {
		// INV-4a: a delegated node is terminal by contract — never an under-decomposition candidate.
		if (t.executionBoundary === 'DELEGATED_EXTERNAL') continue;
		const children = t.permittedChildTypeIds.filter((c) => ids.has(c));
		if (children.length > 0) continue; // only leaves are candidates
		const distinctOutputs = new Set(t.requiredOutputs ?? []);
		if (distinctOutputs.size > 1)
			findings.push({
				severity: 'info',
				message: `"${t.name}" is a leaf producing ${distinctOutputs.size} distinct outputs (${[...distinctOutputs].join(', ')}) — more than one deliverable in one undecomposed unit is a decomposition signal. If it is genuinely a single accountable unit, keep it; otherwise split it into child types, or delegate it across an organizational boundary. (Advisory — never blocks a commit.)`
			});
	}
}

/** Orphan findings: a non-root type that no live type permits as a child is unreachable from the root. */
function checkOrphans(
	types: readonly CompositionNode[],
	ids: ReadonlySet<string>,
	findings: CompositionFinding[]
): void {
	const permitted = new Set<string>();
	for (const t of types) for (const c of t.permittedChildTypeIds) if (ids.has(c)) permitted.add(c);
	for (const t of types)
		if (!t.isRoot && !permitted.has(t.id))
			findings.push({
				severity: 'info',
				message: `"${t.name}" is not reachable from the root (no type permits it as a child) — link it under a parent.`
			});
}

/** Advisory structural findings for a PWU-Type graph (empty = clean). Never throws; order: root → fan-out →
 *  under-decomposition → orphans. */
export function lintComposition(types: readonly CompositionNode[]): CompositionFinding[] {
	const findings: CompositionFinding[] = [];
	if (types.length === 0) return findings;
	const ids = new Set(types.map((t) => t.id));

	checkRoot(types, findings);
	checkFanout(types, ids, findings);
	checkUnderDecomposition(types, ids, findings);
	checkOrphans(types, ids, findings);

	return findings;
}

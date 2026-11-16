// ⭐⭐ `JAN-EXEC` Phase 7, package L17a — design D72 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.26; `REG-D-166` (1), (2), (5);
// `REG-F-643`; `REG-F-212`) — A DEFECT A LATER CHECK FINDS GOES BACK TO THE UNIT THAT MADE IT, BY REPLACEMENT: THE ONE RESOLVER OF THE
// SUPERSESSION LINKS, THE CURRENT COMPOSITION, THE CANDIDATES AND THE REACH.
//
// ── THE LINKS, AND WHY EVERY READER FOLLOWS THEM ─────────────────────────────────────────────────────────────────────────────────────
// A replacement supersedes a unit with a new unit of its type (`SupersedePwu`), and the kernel writes the successor to the old unit's state
// (`supersedingWorkUnitId`). The old unit's shape stays write-once (`REG-F-109`): its parent and its dependencies keep the ids it was proposed
// with — and so do those of every unit that waited on it, a unit not started among them, which is not replaced and FOLLOWS the successors
// through the links (D72, "The reach"). So a reader of the Undertaking's composition reads it through the links: a recorded id resolved to the
// live end of its chain (`liveEndOf`); a unit's effective dependencies and effective parent, its recorded ones resolved so; and the current
// composition, its units not superseded (`isCurrentUnit`). ⭑ For an Undertaking with no supersession each is exactly the recorded relation.
//
// ── THE CANDIDATES AND THE REACH (the lead's, D72) ───────────────────────────────────────────────────────────────────────────────────
// The candidates: the units whose work the rejected unit's work used — its dependencies and theirs, transitively, and each composite's children.
// The reach: the unit the work is sent back to; then every STARTED unit (one with an execution plan) whose dependencies include a unit in the
// reach, and every started composite with a child in it, to a fixed point. ⭑ IT ENDS AT THE REJECTED UNIT on every state the product reaches,
// and is not cut there (the lead's ruling on the builder's reading): a unit that depends on the rejected unit cannot have started, for start
// readiness waits until the rejected unit is accepted and it never was; and its parents are composites, each of which waits for its children,
// the rejected unit among them, so none of them has begun. A unit not started is not replaced; a unit the fault did not reach is kept.
//
// Pure + browser-safe, like the rest of rph-projections: each reader hands in its own lookup — the kernel its store, the page its engine, the
// lane its snapshot.

/** A unit's successor, as its record links it: `supersedingWorkUnitId`, or undefined when the unit has none. */
export type SuccessorOf = (id: string) => string | undefined;

/** The live end of a chain of successor links: the first unit with no successor, or the cycle the links run in. */
export type LiveEnd =
	| { readonly ok: true; readonly id: string }
	| { readonly ok: false; readonly cycle: readonly string[] };

/**
 * ⭐⭐ D72 — THE RESOLVER: from `id`, along each unit's successor link, to the first unit that has none — the live end of the chain. ⛔ A chain
 * that comes back to a unit it passed is REFUSED (`ok: false`, the cycle named, from the unit it re-enters round to it again): it reaches no
 * live unit. No command can make one — the kernel admits only a PROPOSED successor that succeeds no other unit, and a superseded unit is never
 * PROPOSED — so a cycle is a record written otherwise, and each reader fails closed on it.
 */
export function liveEndOf(id: string, successorOf: SuccessorOf): LiveEnd {
	const chain: string[] = [id];
	for (;;) {
		const next = successorOf(chain.at(-1)!);
		if (next === undefined) return { ok: true, id: chain.at(-1)! };
		const at = chain.indexOf(next);
		if (at !== -1) return { ok: false, cycle: [...chain.slice(at), next] };
		chain.push(next);
	}
}

/** A stored unit's successor link, read from its state: its `supersedingWorkUnitId` where that is a non-empty string, else undefined. */
export function successorLinkOf(state: Readonly<Record<string, unknown>> | undefined): string | undefined {
	const link = state?.supersedingWorkUnitId;
	return typeof link === 'string' && link !== '' ? link : undefined;
}

/** ⭐ D72 — whether a unit in `workLifecycleState` belongs to the Undertaking's CURRENT composition: every unit not SUPERSEDED. */
export const isCurrentUnit = (workLifecycleState: string): boolean => workLifecycleState !== 'SUPERSEDED';

/**
 * ⭐ D72 — A UNIT'S EFFECTIVE DEPENDENCIES: its recorded ones, each resolved to the live end of its chain, once each, in the recorded order.
 * ⛔ A dependency whose chain runs in a cycle is kept as recorded — a superseded unit, never accepted — so a reader that waits for its
 * dependencies to be accepted fails closed on it.
 */
export function effectiveDependencyIds(recorded: readonly string[], successorOf: SuccessorOf): string[] {
	const ids: string[] = [];
	for (const d of recorded) {
		const end = liveEndOf(d, successorOf);
		const id = end.ok ? end.id : d;
		if (!ids.includes(id)) ids.push(id);
	}
	return ids;
}

/** ⭐ D72 — A UNIT'S EFFECTIVE PARENT: its recorded parent resolved to the live end of its chain; undefined for none, and for a cycle. */
export function effectiveParentId(recorded: string | undefined, successorOf: SuccessorOf): string | undefined {
	if (recorded === undefined || recorded === '') return undefined;
	const end = liveEndOf(recorded, successorOf);
	return end.ok ? end.id : undefined;
}

/** ⭐ D72 — one unit of the CURRENT composition as the candidates and the reach read it: its effective parent and dependencies, and whether it has started. */
export interface ReachUnit {
	readonly id: string;
	/** Its effective parent (`effectiveParentId`); undefined for the root. */
	readonly parentId: string | undefined;
	/** Its effective dependencies (`effectiveDependencyIds`). */
	readonly dependencyIds: readonly string[];
	/** It has started: it holds an execution plan (D72, "The reach"). */
	readonly started: boolean;
}

/**
 * ⭐⭐ D72 — THE CANDIDATES the work of `rejectedId` may be sent back to: the units whose work its work used — its dependencies and theirs,
 * transitively, and each composite's children — in the units' order; the rejected unit itself is not among them (its own re-run in place is
 * D71's act). Read over the current composition (`units`), each relation through the links.
 */
export function replacementCandidates(units: readonly ReachUnit[], rejectedId: string): string[] {
	const byId = new Map(units.map((u) => [u.id, u]));
	const used = new Set<string>();
	const visit = (id: string): void => {
		const children = units.filter((u) => u.parentId === id).map((u) => u.id);
		for (const next of [...(byId.get(id)?.dependencyIds ?? []), ...children]) {
			if (next === rejectedId || used.has(next) || !byId.has(next)) continue;
			used.add(next);
			visit(next);
		}
	};
	visit(rejectedId);
	return units.filter((u) => used.has(u.id)).map((u) => u.id);
}

/**
 * ⭐⭐ D72 — THE REACH of sending the work back to `chosenId`: the chosen unit; then, to a fixed point, every STARTED unit whose dependencies
 * include a unit in it, and every STARTED composite with a child in it — in the units' order. A unit not started is never in it (it follows
 * the successors through the links); a unit the fault did not reach is kept. It ends at the rejected unit (the header says why).
 */
export function replacementReach(units: readonly ReachUnit[], chosenId: string): string[] {
	const reached = new Set<string>([chosenId]);
	for (let grew = true; grew; ) {
		grew = false;
		for (const u of units) {
			if (reached.has(u.id) || !u.started) continue;
			const usesReached = u.dependencyIds.some((d) => reached.has(d));
			const holdsReached = units.some((c) => c.parentId === u.id && reached.has(c.id));
			if (usesReached || holdsReached) {
				reached.add(u.id);
				grew = true;
			}
		}
	}
	return units.filter((u) => reached.has(u.id)).map((u) => u.id);
}

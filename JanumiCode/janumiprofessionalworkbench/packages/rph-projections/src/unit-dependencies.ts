// ⭐⭐ `JAN-EXEC` Phase 7, package M — THE UNITS EACH UNIT WAITS FOR, AND WHETHER A UNIT MAY START (design
// `DESIGN-data-flow-order-and-deliverable-review.md` D1-D5; `REG-D-135` (2); `REG-F-578`).
//
// ── ⛔ WHAT THIS IS NOT: THE PWA'S ORDER ─────────────────────────────────────────────────────────────────────────────
// A PWA *"is not primarily a temporal sequence"*, and *"semantic progression ≠ temporal execution sequence"* (JPWB-DOC-002
// :72-73); the plan is *"the governed, versioned strategy for performing selected PWUs"* and the workflow *"the temporal
// machinery through which a plan is carried out"* (DOC-002 :94-96). *"Composition is not timing: prerequisites,
// dependencies, semantic progression, produced-input relations, and temporal execution steps are modeled as those
// relations — never mislabeled as parent/child decomposition."* (JPWB-DOC-003 :209). So nothing here is the PWA's order,
// and nothing here schedules. This module computes the INPUT TO AN EXECUTION STRATEGY'S READINESS: which instantiated
// units each unit waits for, read from the produced-input relation (a type's `requiredInputs` against other types'
// `requiredOutputs`) and from the decomposition (a parent waits for its children, whose results it recomposes — DEC-6).
// When a unit may start is the readiness rule below; in what order a host presses the units it admits is the host's.
//
// `handoff-order.ts` stays what it is: an ADVISORY layering of the PWA's TYPES for the designer's walkthrough, wired into
// nothing that refuses. This module is over INSTANCES — a type instantiated twice gives two producers, both waited for —
// and its readiness half is what the engine's refusal and the page's offer both read (D2, D3).
//
// ── THE TWO HALVES ───────────────────────────────────────────────────────────────────────────────────────────────────
//   · D1, `unitDependencies` — at instantiation, from the bound PWA's types and the Undertaking's units: for each required
//     input of a unit's type, EVERY other unit whose type lists that name as a required output; for a parent, each of its
//     children; `originating-intent` supplied by the Undertaking's Intent; the inputs no unit produces, named; and the
//     loops, named — from the data flow, and from a child that requires its parent's output while the parent waits for it.
//   · D2, `startReadiness` — from what the store RECORDED (`dependencyIds`, and `inputRequirements` marked ~~unproduced~~ ⭐
//     expected from outside, D21): a unit may start only when each unit it depends on is ACCEPTED — SATISFIED, RECOMPOSED or
//     BASELINED (`ACCEPTED_UNIT_STATES`; `packages/rph-contracts/src/enums.ts`, the unit lifecycle) ~~— and no input it
//     requires is unproduced~~. ⛔ CONDITIONALLY_SATISFIED does not count: its conditions are open, and *"'Assured required
//     child results' excludes conditionally satisfied dispositions"* (DOC-003 :231, DEC-6).
//
// ⭐⭐ `JAN-EXEC` Phase 7, package O — D21, OUTSIDE INPUTS (design revision 3; `REG-F-582`; the lead's decision, flagged for the
// sponsor) — ⛔ STRUCK 2026-10-26: ~~"and no input it requires is unproduced"~~. Package M refused a unit's start for a required
// input no instantiated unit produces, and so the canon's own reference PWA, whose types declare inputs owed by no unit of the
// Undertaking ("workspace and repository context", "organizational policy"), could start 0 of its 8 measured units. That block
// was the lead's extension of the sponsor's Q42b, which concerns producers finishing and having their work accepted (`REG-D-135`
// (2)); it gave no stronger guarantee. Such an input is now EXPECTED FROM OUTSIDE this Undertaking (`OUTSIDE_INPUT`): recorded
// so at instantiation, named on the page (`expectedFromOutside`), and withholding nothing. Producers, children and loops still
// withhold. ⚠ So a misspelt input reads as an outside input rather than blocking: the authoring prompt's start rule (D25) and
// the review in parts are where that mistake is caught.
//
// ⚠ A UNIT IS NEVER ITS OWN PRODUCER, as the PWA graph never draws a self-edge (`pwa-graph.ts`, `collectDataFlow`): an input
// only the unit's own type produces has no producer it could wait for, and is named ~~unproduced~~ ⭐ among the inputs no unit
// of the Undertaking produces — expected from outside it (D21).
//
// Pure + browser-safe (no imports), like the rest of rph-projections.

/** The inputs the Undertaking's Intent supplies: no unit produces them, and none is waited for (design D1). */
export const SUPPLIED_BY_INTENT: ReadonlySet<string> = new Set(['originating-intent']);

/**
 * ⭐ D2 — THE STATES IN WHICH A UNIT IS ACCEPTED, so a unit that depends on it may start: signed off (SATISFIED), recomposed
 * by an explicit assessment (RECOMPOSED), or baselined. ⛔ CONDITIONALLY_SATISFIED is not among them (DEC-6).
 */
export const ACCEPTED_UNIT_STATES: readonly string[] = ['SATISFIED', 'RECOMPOSED', 'BASELINED'];

/**
 * ⭐⭐ D21 — THE STATUS AN `inputRequirements` ENTRY CARRIES FOR A REQUIRED INPUT NO UNIT OF THE UNDERTAKING PRODUCES: it is
 * expected from outside this Undertaking, and withholds nothing (package O; `REG-F-582`).
 */
export const OUTSIDE_INPUT = 'EXPECTED_FROM_OUTSIDE';

/**
 * ~~The status an `inputRequirements` entry carries for a required input no unit of the Undertaking produces (D1).~~ ⛔ The
 * status package M wrote for such an input, which then refused the unit's start (struck 2026-10-26, package O, D21:
 * `OUTSIDE_INPUT` replaces it). ⭑ KEPT READABLE: a record made before D21 carries it, and it reads as `OUTSIDE_INPUT` does.
 */
export const UNPRODUCED_INPUT = 'UNPRODUCED';

/** ⭐ D21 — the statuses read as an input expected from outside: D21's own, and the one a record made before it carries. */
const OUTSIDE_INPUT_STATUSES: ReadonlySet<unknown> = new Set([OUTSIDE_INPUT, UNPRODUCED_INPUT]);

/** The subset of a PWU Type this projection reads: its produced-input relation. */
export interface DependencyType {
	readonly id: string;
	readonly requiredInputs: readonly string[];
	readonly requiredOutputs: readonly string[];
}

/** One instantiated unit, or one a plan will instantiate (its `id` then the plan's key): its type and its parent. */
export interface DependencyUnit {
	readonly id: string;
	readonly typeId: string;
	readonly parentId?: string;
}

/** One required input of a unit's type, and every OTHER unit whose type lists it as a required output. */
export interface InputProducers {
	readonly input: string;
	readonly producerIds: readonly string[];
}

/** ⭐ D1 — what one unit waits for. */
export interface UnitDependency {
	readonly unitId: string;
	/** Each required input that some other unit produces, in the type's order, with every producer, in the units' order. */
	readonly inputs: readonly InputProducers[];
	/** The required inputs the Undertaking's Intent supplies (`SUPPLIED_BY_INTENT`). */
	readonly suppliedByIntent: readonly string[];
	/**
	 * The required inputs no other unit of the Undertaking produces, named. ⭐ D21 — each is expected from outside this
	 * Undertaking: instantiation records it so (`OUTSIDE_INPUT`), and it withholds nothing.
	 */
	readonly unproduced: readonly string[];
	/** The unit's children, in the units' order: a parent waits for each. */
	readonly childIds: readonly string[];
	/** Every unit it waits for — its producers and its children — each once, in the units' order. */
	readonly dependencyIds: readonly string[];
}

export interface UnitDependencies {
	/** One record per unit, in the order given. */
	readonly units: readonly UnitDependency[];
	/** ⭐ D5 — each loop: units that wait, through one another, for themselves; each in the units' order. */
	readonly loops: readonly (readonly string[])[];
	/**
	 * ⭐ DEC-2 — for each parent, in the units' order, the children another child of the same parent waits for (DOC-003 :215:
	 * a decomposition records *"sibling identities, dependencies, and coordination rules"*): the decomposition contract's
	 * `siblingDependencyIds`. Each child's own `dependencyIds` says which sibling waits for which.
	 */
	readonly siblingDependencies: readonly {
		readonly parentId: string;
		readonly siblingDependencyIds: readonly string[];
	}[];
}

/** The ids in `ids`, each once, in `order`'s order. */
function inOrder(ids: Iterable<string>, order: ReadonlyMap<string, number>): string[] {
	return [...new Set(ids)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * ⭐ THE STRONGLY CONNECTED GROUPS OF MORE THAN ONE UNIT (Tarjan): the loops of a "waits for" relation. A unit never waits
 * for itself here (`unitDependencies` excludes it), so a loop always holds two units or more.
 */
function loopsOf(
	ids: readonly string[],
	waitsFor: (id: string) => readonly string[],
	order: ReadonlyMap<string, number>
): string[][] {
	let index = 0;
	const indexOf = new Map<string, number>();
	const low = new Map<string, number>();
	const stack: string[] = [];
	const onStack = new Set<string>();
	const groups: string[][] = [];
	const connect = (v: string): void => {
		indexOf.set(v, index);
		low.set(v, index);
		index += 1;
		stack.push(v);
		onStack.add(v);
		for (const w of waitsFor(v)) {
			if (!order.has(w)) continue;
			if (!indexOf.has(w)) {
				connect(w);
				low.set(v, Math.min(low.get(v)!, low.get(w)!));
			} else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, indexOf.get(w)!));
		}
		if (low.get(v) === indexOf.get(v)) {
			const group: string[] = [];
			let w: string;
			do {
				w = stack.pop()!;
				onStack.delete(w);
				group.push(w);
			} while (w !== v);
			if (group.length > 1) groups.push(inOrder(group, order));
		}
	};
	for (const id of ids) if (!indexOf.has(id)) connect(id);
	return groups.sort((a, b) => (order.get(a[0]!) ?? 0) - (order.get(b[0]!) ?? 0));
}

/**
 * ⭐⭐ D1 — EACH UNIT'S DEPENDENCY UNITS, from the bound PWA's types and the Undertaking's units (or a plan's instances). For
 * each required input of a unit's type: `originating-intent` is the Intent's; else EVERY other unit whose type lists the
 * name as a required output is a producer, all of them waited for; an input none produces is named. A parent also waits for
 * each of its children. A unit whose type the types do not hold requires nothing and produces nothing.
 */
export function unitDependencies(
	types: readonly DependencyType[],
	units: readonly DependencyUnit[]
): UnitDependencies {
	const typeById = new Map(types.map((t) => [t.id, t]));
	const order = new Map(units.map((u, i) => [u.id, i]));
	const producersOf = (input: string, consumerId: string): string[] =>
		units
			.filter((u) => u.id !== consumerId && (typeById.get(u.typeId)?.requiredOutputs ?? []).includes(input))
			.map((u) => u.id);
	const childrenOf = (parentId: string): string[] =>
		units.filter((u) => u.parentId === parentId).map((u) => u.id);

	const records: UnitDependency[] = units.map((u) => {
		const required = [...new Set(typeById.get(u.typeId)?.requiredInputs ?? [])];
		const suppliedByIntent = required.filter((name) => SUPPLIED_BY_INTENT.has(name));
		const produced = required
			.filter((name) => !SUPPLIED_BY_INTENT.has(name))
			.map((input) => ({ input, producerIds: producersOf(input, u.id) }));
		const childIds = childrenOf(u.id);
		return {
			unitId: u.id,
			inputs: produced.filter((p) => p.producerIds.length > 0),
			suppliedByIntent,
			unproduced: produced.filter((p) => p.producerIds.length === 0).map((p) => p.input),
			childIds,
			dependencyIds: inOrder([...produced.flatMap((p) => p.producerIds), ...childIds], order)
		};
	});
	const recordOf = new Map(records.map((r) => [r.unitId, r]));
	const loops = loopsOf(
		units.map((u) => u.id),
		(id) => recordOf.get(id)?.dependencyIds ?? [],
		order
	);
	const siblingDependencies = units
		.filter((u) => childrenOf(u.id).length > 0)
		.map((parent) => {
			const siblings = new Set(childrenOf(parent.id));
			const waitedFor = [...siblings].flatMap((child) =>
				(recordOf.get(child)?.dependencyIds ?? []).filter((d) => siblings.has(d))
			);
			return { parentId: parent.id, siblingDependencyIds: inOrder(waitedFor, order) };
		});
	return { units: records, loops, siblingDependencies };
}

/** The dependency layering of units by what they wait for (`dependencyLayers`). */
export interface DependencyLayers {
	/** Each layer: the units whose every dependency lies in an earlier layer, in the units' order. */
	readonly layers: readonly (readonly string[])[];
	/** ⭐ D5 — the loops: no unit of one can ever start. */
	readonly loops: readonly (readonly string[])[];
	/** The units outside every loop that wait, through others, on a loop's unit — or on a unit the set does not hold. */
	readonly blocked: readonly string[];
}

/**
 * The units in layers by what they wait for: the first layer waits for nothing, and each later one only for units of the
 * layers before it. ⚠ A LAYERING, NOT A SCHEDULE: it says which units COULD start were every earlier one accepted, and
 * the test of the design's data-flow order reads it; when a unit may start is `startReadiness`'s, from the store.
 */
export function dependencyLayers(
	units: readonly { readonly unitId: string; readonly dependencyIds: readonly string[] }[]
): DependencyLayers {
	const order = new Map(units.map((u, i) => [u.unitId, i]));
	const waitsFor = new Map(units.map((u) => [u.unitId, u.dependencyIds]));
	const loops = loopsOf(
		units.map((u) => u.unitId),
		(id) => waitsFor.get(id) ?? [],
		order
	);
	const placed = new Set<string>();
	const layers: string[][] = [];
	for (;;) {
		const layer = units
			.filter((u) => !placed.has(u.unitId) && u.dependencyIds.every((d) => placed.has(d)))
			.map((u) => u.unitId);
		if (layer.length === 0) break;
		for (const id of layer) placed.add(id);
		layers.push(layer);
	}
	const inLoop = new Set(loops.flat());
	return {
		layers,
		loops,
		blocked: units.map((u) => u.unitId).filter((id) => !placed.has(id) && !inLoop.has(id))
	};
}

// ── D2 — WHETHER A UNIT MAY START, FROM WHAT THE STORE RECORDED ─────────────────────────────────────────────────────────

/**
 * A unit as the readiness rule reads it from the store: who it waits for, and what it requires that nothing produces — ⭐ D21:
 * which it expects from outside its Undertaking.
 */
export interface ReadinessUnit {
	readonly id: string;
	readonly title: string;
	readonly workLifecycleState: string;
	readonly undertakingId: string | undefined;
	readonly dependencyIds: readonly string[];
	/**
	 * ~~`unproducedInputs`~~ ⭐ D21 (package O) — the required inputs recorded as expected from outside (`OUTSIDE_INPUT`, or
	 * `UNPRODUCED_INPUT` in a record made before D21), in the record's order. ⛔ None withholds the unit.
	 */
	readonly outsideInputs: readonly string[];
}

const strOf = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * A stored work unit's state, as the readiness rule reads it; undefined for anything that is not a work unit
 * (`objectType` PROFESSIONAL_WORK_UNIT) — so a dependency naming another kind of object names no unit.
 */
export function readinessUnitOf(
	id: string,
	state: Readonly<Record<string, unknown>> | undefined
): ReadinessUnit | undefined {
	if (state?.objectType !== 'PROFESSIONAL_WORK_UNIT') return undefined;
	const requirements = Array.isArray(state.inputRequirements) ? (state.inputRequirements as unknown[]) : [];
	return {
		id,
		title: strOf(state.title) || id,
		workLifecycleState: strOf(state.workLifecycleState),
		undertakingId: strOf(state.undertakingId) || undefined,
		dependencyIds: Array.isArray(state.dependencyIds)
			? (state.dependencyIds as unknown[]).filter((d): d is string => typeof d === 'string')
			: [],
		// ⭐ D21 — ~~`.filter((r) => r.status === UNPRODUCED_INPUT)`, each a reason to withhold~~: each an input expected from
		// outside, under D21's status or under the one a record made before it carries.
		outsideInputs: requirements
			.map((r) => (typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {}))
			.filter((r) => OUTSIDE_INPUT_STATUSES.has(r.status))
			.map((r) => strOf(r.name))
	};
}

/**
 * Why a PROPOSED unit is withheld, by kind — the page shows each, and the lane reads a loop's (D3, D5). ⛔ ~~`'unproduced'`~~ —
 * struck 2026-10-26 (package O, D21): an input no unit produces is expected from outside, and withholds nothing.
 */
export type WithheldKind = 'waiting' | 'abandoned' | 'unknown' | 'loop';

/** ⭐ D2 — whether a unit may start, and if not, every reason, named. */
export interface StartReadiness {
	readonly startable: boolean;
	/** The units it depends on that are not accepted, abandoned ones aside, with the state each is in. */
	readonly waitingFor: readonly { readonly id: string; readonly title: string; readonly state: string }[];
	/** ⭐ D4 — the units it depends on that were ABANDONED. */
	readonly abandoned: readonly { readonly id: string; readonly title: string }[];
	/** The dependency ids that name no unit of this unit's Undertaking. */
	readonly unknown: readonly string[];
	/**
	 * ~~`unproduced` — the required inputs no unit of the Undertaking produces~~ ⭐ D21 (package O) — the required inputs
	 * expected from outside this Undertaking, each once, in the record's order: shown on the page (`expectedFromOutside`), and
	 * ⛔ never a reason to withhold.
	 */
	readonly outside: readonly string[];
	/** ⭐ D5 — the loop it sits in, from it round to the unit before it again; null when it sits in none. */
	readonly loop: readonly { readonly id: string; readonly title: string }[] | null;
	readonly kinds: readonly WithheldKind[];
	/** The reasons in words, `; `-separated; null when it may start. */
	readonly reason: string | null;
}

/** A path from `start`, along what each unit waits for, back to `start`: the loop it sits in, or null. */
function loopThrough(start: string, lookup: (id: string) => ReadinessUnit | undefined): string[] | null {
	const seen = new Set<string>();
	const path: string[] = [];
	const reaches = (id: string): boolean => {
		for (const d of lookup(id)?.dependencyIds ?? []) {
			if (d === start) {
				path.push(id);
				return true;
			}
			if (seen.has(d)) continue;
			seen.add(d);
			if (reaches(d)) {
				path.push(id);
				return true;
			}
		}
		return false;
	};
	return reaches(start) ? path.reverse() : null;
}

/** `a`, `a and b`, `a, b and c`. */
function listed(items: readonly string[]): string {
	return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)!}`;
}

/**
 * ⭐⭐ D2 — MAY THIS UNIT START? Only when every unit it depends on is a unit of its own Undertaking and ACCEPTED
 * (`ACCEPTED_UNIT_STATES`) ~~, and no input it requires is unproduced~~ (⛔ struck 2026-10-26, package O, D21: an input no unit
 * produces is expected from outside, named in `outside`, and withholds nothing). `lookup` reads a unit from the store
 * (`readinessUnitOf`), so the engine's refusal (`MarkPwuReady`) and the page's offer read this one rule over one record.
 */
export function startReadiness(
	unitId: string,
	lookup: (id: string) => ReadinessUnit | undefined
): StartReadiness {
	const unit = lookup(unitId);
	const waitingFor: { id: string; title: string; state: string }[] = [];
	const abandoned: { id: string; title: string }[] = [];
	const unknown: string[] = [];
	for (const id of new Set(unit?.dependencyIds ?? [])) {
		const d = lookup(id);
		if (d === undefined || d.undertakingId === undefined || d.undertakingId !== unit?.undertakingId) unknown.push(id);
		else if (d.workLifecycleState === 'ABANDONED') abandoned.push({ id, title: d.title });
		else if (!ACCEPTED_UNIT_STATES.includes(d.workLifecycleState))
			waitingFor.push({ id, title: d.title, state: d.workLifecycleState });
	}
	// ⭐ D21 — named, each once, and never a kind: an input expected from outside withholds nothing.
	const outside = [...new Set(unit?.outsideInputs ?? [])];
	const cycle = unit === undefined ? null : loopThrough(unitId, lookup);
	const loop = cycle?.map((id) => ({ id, title: lookup(id)?.title ?? id })) ?? null;
	const kinds: WithheldKind[] = [
		...(waitingFor.length > 0 ? (['waiting'] as const) : []),
		...(abandoned.length > 0 ? (['abandoned'] as const) : []),
		...(unknown.length > 0 ? (['unknown'] as const) : []),
		// ~~...(unproduced.length > 0 ? (['unproduced'] as const) : []),~~ ⛔ D21.
		...(loop !== null ? (['loop'] as const) : [])
	];
	const quoted = (title: string): string => `"${title}"`;
	const reasons = [
		...(waitingFor.length > 0
			? [`it waits for ${listed(waitingFor.map((w) => `${quoted(w.title)} (${w.state})`))} to be accepted`]
			: []),
		...(abandoned.length > 0
			? [`its producer${abandoned.length > 1 ? 's' : ''} ${listed(abandoned.map((a) => quoted(a.title)))} ${abandoned.length > 1 ? 'were' : 'was'} ABANDONED`]
			: []),
		...(unknown.length > 0
			? [`${listed(unknown)} name${unknown.length > 1 ? '' : 's'} no unit of this Undertaking`]
			: []),
		// ~~"nothing in this Undertaking produces its input(s) …"~~ ⛔ D21: no reason — the page names it apart (`expectedFromOutside`).
		...(loop !== null
			? [`it sits in a loop: ${[...loop, loop[0]!].map((l) => quoted(l.title)).join(' → ')}`]
			: [])
	];
	return {
		startable: kinds.length === 0,
		waitingFor,
		abandoned,
		unknown,
		outside,
		loop,
		kinds,
		reason: reasons.length === 0 ? null : reasons.join('; ')
	};
}

/**
 * ⭐⭐ D21 — THE PAGE'S WORDS FOR A UNIT'S OUTSIDE INPUTS (`StartReadiness.outside`), beside its offer or its reason: `expects
 * "a" and "b" from outside this Undertaking`; null for a unit that expects nothing from outside.
 */
export function expectedFromOutside(outside: readonly string[]): string | null {
	return outside.length === 0 ? null : `expects ${listed(outside.map((name) => `"${name}"`))} from outside this Undertaking`;
}

/**
 * ⭐ THE REFUSAL'S OWN WORDS — what the engine's refusal (`MarkPwuReady`) and the route's preflight before its batch both say
 * (D2), so a person reads the same reason from either. Its first clause is the enforcement register's marker
 * (`RPH-PWU-011`).
 */
export const START_REFUSAL_MARKER = 'cannot start until each unit it depends on is accepted';

// ⛔ STRUCK 2026-10-26 (package O, D21): the refusal's clause ~~"— and nothing it requires is unproduced"~~, false now: an input no
// unit produces is expected from outside and refuses nothing.
export function startRefusal(unitId: string, readiness: StartReadiness): string {
	return (
		`PWU ${unitId} ${START_REFUSAL_MARKER} — SATISFIED, RECOMPOSED or BASELINED; CONDITIONALLY_SATISFIED does not ` +
		`count: ${readiness.reason ?? 'nothing withholds it'} (REG-D-135 (2); JPWB-DOC-003 STA-5)`
	);
}

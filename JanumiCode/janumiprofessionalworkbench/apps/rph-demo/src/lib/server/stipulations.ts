// ⭐ THE STIPULATION REGISTRY — what a TEST has declared it stipulates, per (PWA, framing) — ⭐ and, on the part arm, per part
// of the PWA (the review in parts, B6) — (`JAN-CRITREAD` J1-2; `DESIGN-what-the-tests-prove.md` §4.5; `REG-D-072` D6).
//
// In test engines only, the declared stand-in reviewer answers what the structural checker cannot judge with a CLEAN
// answer the TEST stipulates — recorded `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it. The test says so
// here, through `/test-api/reviewer-script`, never through the plan the producer reads (that is the reviewer's
// prompt, and would share prompt lineage with it).
//
// ── WHY MODULE STATE, AND WHY IT IS DISCARDED ON EVERY RESET ──────────────────────────────────────────────────
// A registration answers only the PWA it names, and test-mode ids restart at every reset — so a registration that
// outlived a reset would answer a LATER test's PWA that happened to get the same id. `resetEngine` clears this map
// in the same act that replaces the engine. And the stand-in consults it through a lookup the floor callers pass
// in (`REG-D-072` D6), never by reaching for the engine itself: `getEngine()` lazily opens and SEEDS a workbench,
// which a validator must never do as a side effect.
import type { EngineHandle } from '@janumipwb/rph-engine';

/**
 * The framings a test may stipulate for. A process result is never stipulated: no test needs it.
 * ⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `DESIGN-phase-7-completion.md` B1) — AND `DECLARED_POLICY`: the arm the
 * declared-policy stand-in answers (`declared-policy-review.ts`), each of a unit's declared policies judged against its own
 * criteria. A registration for it stipulates every criterion of every declared policy of that PWA's units CLEAN, recorded
 * `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it, exactly as the floor arm records its remainder: that stand-in
 * has no checker, so nothing of a declared policy is judged in the gate lane, and the record says so.
 * ⭐ The review in parts, B2 (`REG-D-125`; design D4, D10) — AND `PWA_TYPE`: one type of an authored PWA, reviewed as a part.
 * ⭐ B6: the authoring floor reviews each type of a PWA as a part, and asks about each with the PWA it belongs to
 * (`floor.ts`): a registration for the PWA answers every part of it, and one naming a type (`typeId`) answers that part.
 */
export type StipulableFraming = 'PWA_GRAPH' | 'WORK_PRODUCT' | 'DECLARED_POLICY' | 'PWA_TYPE';
const FRAMINGS: readonly StipulableFraming[] = ['PWA_GRAPH', 'WORK_PRODUCT', 'DECLARED_POLICY', 'PWA_TYPE'];

export interface StipulationRegistration {
	readonly pwaId: string;
	readonly framing: StipulableFraming;
	/**
	 * ⭐ The review in parts, B6 (`REG-D-125`; design D10) — ONE PART OF THAT PWA: the PWU Type a `PWA_TYPE` registration
	 * answers alone. Absent, the registration answers every part of the PWA; present, it answers this part, and is asked
	 * before the PWA's (`registrationFor`).
	 */
	readonly typeId?: string;
	/** Version one's whole grammar: the remainder the checker could not judge is stipulated CLEAN. */
	readonly remaining: 'CLEAN';
}

/** A registration this host will not accept, with the reason — the route answers it as a 422. */
export class StipulationRefused extends Error {}

const registered = new Map<string, StipulationRegistration>();
const key = (pwaId: string, framing: StipulableFraming, typeId?: string) =>
	`${pwaId}\u0000${framing}\u0000${typeId ?? ''}`;

/**
 * Record that the test stipulates the remainder CLEAN for `pwaId` under `framing`.
 *
 * ⛔ REFUSES a PWA the current engine does not hold — ids restart at every reset, so a registration for an id that
 * does not exist yet would answer whatever PWA later took it.
 */
export function registerStipulation(engine: EngineHandle, reg: unknown): StipulationRegistration {
	const r = (reg ?? {}) as Partial<Record<keyof StipulationRegistration, unknown>>;
	if (typeof r.pwaId !== 'string' || r.pwaId === '')
		throw new StipulationRefused('a stipulation must name the PWA it answers for (`pwaId`)');
	if (!FRAMINGS.includes(r.framing as StipulableFraming))
		throw new StipulationRefused(
			`a stipulation answers one arm: \`framing\` must be one of ${FRAMINGS.join(', ')} (a process result is never stipulated)`
		);
	if (r.remaining !== 'CLEAN')
		throw new StipulationRefused(
			'version one stipulates only a CLEAN remainder (`remaining: "CLEAN"`): a scripted fault would leave a BLOCKING observation indistinguishable from a reviewer’s finding'
		);
	if (engine.loadObject(r.pwaId)?.objectType !== 'PROFESSIONAL_WORK_ARCHITECTURE')
		throw new StipulationRefused(
			`the current engine holds no PWA ${r.pwaId}: register a stipulation after the PWA exists, reading its id from the store`
		);
	const typeId = r.typeId === undefined ? undefined : partOf(engine, r.pwaId, r.framing as StipulableFraming, r.typeId);
	const accepted: StipulationRegistration = {
		pwaId: r.pwaId,
		framing: r.framing as StipulableFraming,
		...(typeId === undefined ? {} : { typeId }),
		remaining: 'CLEAN'
	};
	registered.set(key(accepted.pwaId, accepted.framing, accepted.typeId), accepted);
	return accepted;
}

/**
 * ⭐ B6 — the part a registration names, checked: only on the part arm, and only a type the named PWA holds. ⛔ A type of
 * another PWA would answer a part of a PWA the registration does not name; a type the engine does not hold yet, whatever
 * later took its id.
 */
function partOf(engine: EngineHandle, pwaId: string, framing: StipulableFraming, typeId: unknown): string {
	if (framing !== 'PWA_TYPE')
		throw new StipulationRefused(`a stipulation names a type (\`typeId\`) only on the part arm, PWA_TYPE, not on ${framing}`);
	if (typeof typeId !== 'string' || typeId === '')
		throw new StipulationRefused('a stipulation’s `typeId`, when given, names one PWU Type of the PWA');
	const type = engine.loadObject(typeId);
	const owner = (type?.state as { pwaId?: unknown } | undefined)?.pwaId;
	if (type?.objectType !== 'PWU_TYPE' || owner !== pwaId)
		throw new StipulationRefused(
			`the current engine holds no PWU Type ${typeId} of PWA ${pwaId}: a part's registration names a type of the PWA it names`
		);
	return typeId;
}

/**
 * ⭐⭐ The review in parts, B6 (`REG-D-125`; design D10) — THE ONE LOOKUP OF A REGISTRATION, over any list of them: for a
 * part (`typeId`), its own registration first, then its PWA's; otherwise the PWA's alone. Pure, so the floor's lookup
 * (through `stipulationFor`) and the lane control's classifier (`lane-control.ts`) answer the same question the same way.
 */
export function registrationFor(
	registrations: Iterable<StipulationRegistration>,
	pwaId: string,
	framing: StipulableFraming,
	typeId?: string
): StipulationRegistration | undefined {
	const all = [...registrations];
	const find = (part: string | undefined) =>
		all.find((r) => r.pwaId === pwaId && r.framing === framing && r.typeId === part);
	return (typeId === undefined ? undefined : find(typeId)) ?? find(undefined);
}

/**
 * The registered remainder for (PWA, framing), if a test registered one — ⭐ B6: for one part of the PWA (`typeId`), its own
 * registration's, else its PWA's (`registrationFor`). Reads nothing but this map.
 */
export function stipulationFor(
	pwaId: string,
	framing: StipulableFraming,
	typeId?: string
): 'CLEAN' | undefined {
	return registrationFor(registered.values(), pwaId, framing, typeId)?.remaining;
}

/** Whether anything is registered — so a lookup can decline before reading the store at all. */
export function anyStipulationRegistered(): boolean {
	return registered.size > 0;
}

/** Every current registration, for the lane control to read back (`J1-3`). */
export function registeredStipulations(): readonly StipulationRegistration[] {
	return [...registered.values()];
}

/**
 * The PWA a WORK PRODUCT belongs to — `ARTIFACT.producingPwuId` → `PROFESSIONAL_WORK_UNIT.undertakingId` →
 * `UNDERTAKING.pwaId` — or `undefined` on any missing link. Two of those links are optional in the schema, and a
 * throw here would be `VALIDATOR_FAILED` (§4.1 rule 4), so a broken chain means "no registration", never an error.
 * Read BY ID on the engine the floor records into.
 */
export function workProductPwaOf(engine: Pick<EngineHandle, 'loadObject'>, artifactId: string): string | undefined {
	const field = (id: string | undefined, objectType: string, key: string): string | undefined => {
		if (id === undefined) return undefined;
		const object = engine.loadObject(id);
		if (object?.objectType !== objectType) return undefined;
		const value = (object.state as Record<string, unknown> | undefined)?.[key];
		return typeof value === 'string' && value !== '' ? value : undefined;
	};
	const pwuId = field(artifactId, 'ARTIFACT', 'producingPwuId');
	const undertakingId = field(pwuId, 'PROFESSIONAL_WORK_UNIT', 'undertakingId');
	return field(undertakingId, 'UNDERTAKING', 'pwaId');
}

/**
 * ⭐ E2 — the PWA a WORK UNIT belongs to — `PROFESSIONAL_WORK_UNIT.undertakingId` → `UNDERTAKING.pwaId` — or `undefined` on
 * any missing link, as `workProductPwaOf` reads its chain: the declared-policy stand-in's subject is the unit itself.
 */
export function workUnitPwaOf(engine: Pick<EngineHandle, 'loadObject'>, pwuId: string): string | undefined {
	const field = (id: string | undefined, objectType: string, key: string): string | undefined => {
		if (id === undefined) return undefined;
		const object = engine.loadObject(id);
		if (object?.objectType !== objectType) return undefined;
		const value = (object.state as Record<string, unknown> | undefined)?.[key];
		return typeof value === 'string' && value !== '' ? value : undefined;
	};
	return field(field(pwuId, 'PROFESSIONAL_WORK_UNIT', 'undertakingId'), 'UNDERTAKING', 'pwaId');
}

/** Discarded by `resetEngine`, in the same act that replaces the engine. */
export function clearStipulations(): void {
	registered.clear();
}

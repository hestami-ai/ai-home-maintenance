// ⭐ THE STIPULATION REGISTRY — what a TEST has declared it stipulates, per (PWA, framing) (`JAN-CRITREAD` J1-2;
// `DESIGN-what-the-tests-prove.md` §4.5; `REG-D-072` D6).
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

/** The framings a test may stipulate for. A process result is never stipulated: no test needs it. */
export type StipulableFraming = 'PWA_GRAPH' | 'WORK_PRODUCT';
const FRAMINGS: readonly StipulableFraming[] = ['PWA_GRAPH', 'WORK_PRODUCT'];

export interface StipulationRegistration {
	readonly pwaId: string;
	readonly framing: StipulableFraming;
	/** Version one's whole grammar: the remainder the checker could not judge is stipulated CLEAN. */
	readonly remaining: 'CLEAN';
}

/** A registration this host will not accept, with the reason — the route answers it as a 422. */
export class StipulationRefused extends Error {}

const registered = new Map<string, StipulationRegistration>();
const key = (pwaId: string, framing: StipulableFraming) => `${pwaId}\u0000${framing}`;

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
	const accepted: StipulationRegistration = {
		pwaId: r.pwaId,
		framing: r.framing as StipulableFraming,
		remaining: 'CLEAN'
	};
	registered.set(key(accepted.pwaId, accepted.framing), accepted);
	return accepted;
}

/** The registered remainder for (PWA, framing), if a test registered one. Reads nothing but this map. */
export function stipulationFor(pwaId: string, framing: StipulableFraming): 'CLEAN' | undefined {
	return registered.get(key(pwaId, framing))?.remaining;
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

/** Discarded by `resetEngine`, in the same act that replaces the engine. */
export function clearStipulations(): void {
	registered.clear();
}

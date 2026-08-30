// JAN-SLICE — the Slice declaration shape (JAN-SLICE-SWP-01, design REG-D-045 / roadmap REG-F-293).
//
// A Slice is a named, ordered journey of professional acts, driven end to end against a real engine, asserting at
// every act the ratified rules that govern it. This file declares ONLY the shape of a Slice's self-description.
// It emits no value and imports nothing.
//
// ── WHY THIS LIVES HERE, AND NOT IN verif/ ───────────────────────────────────────────────────────────────────
// Both planes must reach it. `verif/` is reachable from packages but NOT from `apps/rph-demo/e2e`, whose tsconfig
// extends the SvelteKit app config and resolves workspace packages rather than sibling directories.
// `@janumipwb/rph-contracts` is the only package both planes already depend on.
//
// ── AND WHY IT IS A SUBPATH, NOT THE BARREL ──────────────────────────────────────────────────────────────────
// Exported as `@janumipwb/rph-contracts/slice`. `index.ts` states the convention for `hash.ts` in its own words:
// verification apparatus does not belong in the runtime barrel. The `./slice` entry in package.json mirrors
// `./hash` field for field.

/** Which plane a Slice is driven on. ENGINE drives commands through the bus; SURFACE drives a browser. */
export type SlicePlane = 'ENGINE' | 'SURFACE';

/**
 * The eight ratified minimum scenario classes.
 *
 * ⚠ THIS UNION IS HAND-WRITTEN AND THEREFORE OWES A DERIVATION. `verif/slice-scenario-classes.test.ts` re-derives
 * the list from the ratified ontology sentence at
 * `packages/rph-product-realization-pwa/vocab/m8-ontology.json` and asserts it EQUALS these members, so a ratified
 * change reddens there instead of diverging here in silence. Hand-listing without that check is the defect one
 * level up: the list would be a claim about the corpus that nothing tests.
 *
 * The ratified sentence also carries its own deontic force, and `SL-5` only relays it:
 *   "Not every journey requires every class, but inapplicability must be explicit."
 */
export const SCENARIO_CLASSES = [
	'normal path',
	'alternate valid path',
	'user-error path',
	'system-failure path',
	'permission-denied path',
	'interrupted or resumed path',
	'data-unavailable path',
	'cancellation path'
] as const;

/**
 * ⚠ THE TYPE IS DERIVED FROM THE VALUE, NOT DECLARED BESIDE IT. A hand-written union would be invisible at
 * runtime, so the derivation test could not compare it to the ratified sentence at all — and a list nothing can
 * read is a list nothing can check. One source, two uses.
 */
export type ScenarioClass = (typeof SCENARIO_CLASSES)[number];

/**
 * A mutant that proves one cited clause is load-bearing.
 *
 * ⚠ `predictedMessage` IS THE FIELD THAT MATTERS AND THE ONE MOST EASILY SKIPPED. A mutant that predicts an error
 * CODE proves nothing about WHICH guard fired: `JAN-CSAA` closed 64 of 65 findings whose tests asserted a code
 * alone, because one code had 116 distinct emitters. The message is what tells two guards apart.
 *
 * ⚠ AND `SL-3a`: where a Slice cites several rules, a mutant that reddens more than one of them proves NONE of
 * them individually. `expectRed` names the clauses this mutant must break — if it names more than one, the rules
 * must be split across Slices until it names one.
 */
export interface SliceMutant {
	/** Stable id, unique within the Slice. */
	readonly id: string;
	/** Repo-relative path of the file to mutate. */
	readonly file: string;
	/** The anchor. MUST occur exactly once in `file`, or the mutant is unanchored and proves nothing. */
	readonly find: string;
	/** What the anchor becomes. */
	readonly replace: string;
	/** The clause ids this mutant must redden. Empty is itself a defect — a mutant with no named victim. */
	readonly expectRed: readonly string[];
	/** The MESSAGE the victim must emit, not a code. Short strings are refused by the generator. */
	readonly predictedMessage: string;
	/** The guard this mutant proves, in one line. */
	readonly why: string;
}

/** Fields every Slice carries, on either plane. */
export interface SliceCommon {
	/** Stable id, unique across the ledger. */
	readonly id: string;
	readonly title: string;
	readonly scenarioClass: ScenarioClass;
	/**
	 * Rule ids from the M12 catalog that this Slice asserts.
	 *
	 * ⚠ THIS IS A CLAIM BY THE AUTHOR AND THE GENERATOR DOES NOT VERIFY IT. It checks only that each id EXISTS in
	 * the ratified catalog. Whether the Slice actually asserts the rule is made true by the per-clause mutants and
	 * the messages they predict, and by nothing else. The roadmap's F-3 is why: the conformance gate checks that a
	 * cited file exists and never that it asserts anything, 125 of 125 — and 38 rules have their id present in a
	 * file whose sole occurrence is a "not probed here" marker.
	 */
	readonly citedRules: readonly string[];
	/** Register entries this Slice discharges. An empty array is a valid and useful declaration. */
	readonly dischargesRegisterEntries: readonly string[];
	readonly mutants: readonly SliceMutant[];
}

/** An ENGINE Slice drives commands through the real bus and store. */
export interface EngineSlice extends SliceCommon {
	readonly plane: 'ENGINE';
}

/**
 * A SURFACE Slice drives a browser.
 *
 * ⚠ `presupposes` IS REQUIRED, not optional. `SL-6`: a SURFACE Slice must name the ENGINE Slice it depends on,
 * and must not be admitted while that Slice is failing or absent — otherwise a browser failure cannot be told
 * apart from a domain failure.
 */
export interface SurfaceSlice extends SliceCommon {
	readonly plane: 'SURFACE';
	readonly presupposes: string;
}

export type SliceDeclaration = EngineSlice | SurfaceSlice;

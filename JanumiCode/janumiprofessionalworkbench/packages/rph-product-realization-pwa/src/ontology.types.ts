// The shape of the generated ontology dataset (ontology.data.ts).
//
// WHY THIS FILE EXISTS, SEPARATELY FROM ontology.ts. The generated dataset must be checked AT ITS LITERAL SITE
// (`} as const satisfies OntologyData`) — see below for why nothing else works. That means ontology.data.ts has
// to import these types, and ontology.ts already imports ontology.data.ts. Declaring them in ontology.ts would
// make a cycle, and `.dependency-cruiser.cjs` forbids circularity. So the types live here; both import them and
// nothing cycles. ontology.ts re-exports them, so this split is invisible to consumers.
//
// WHY `satisfies` AT THE LITERAL, AND NOT THE OBVIOUS ALTERNATIVES (each was probed, not assumed):
//   - `} as const;` + `export const seedPolicies = ...seedPolicies as readonly SeedPolicy[]` (what this repo
//     did): a type ASSERTION only requires comparability. It verifies NOTHING structurally. Re-adding the
//     invented `statement` field to a criterion passed `check-types` AND the full 21/21 gate.
//   - annotating the accessor (`export const seedPolicies: readonly SeedPolicy[] = ...`): catches a MISSING
//     field, but NOT an extra one. Excess-property checking fires only on fresh object literals; assigning an
//     already-typed const to an annotated binding is an ordinary assignability check, where extra properties
//     are legal. This would have missed the exact drift it is meant to stop.
//   - `as const satisfies` at the literal: preserves the literal types AND structurally checks both halves.
//
// These interfaces therefore have to describe the data EXACTLY. Under-declaring is what the old assertion was
// hiding: `SeedPolicy` omitted `sourceSection`, and `PwuTemplate` omitted five fields the dataset carries.
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';

/**
 * A deep-readonly view of a ratified contract type — DERIVED, never restated, because the dataset is `as const`
 * and its arrays are readonly.
 */
type Frozen<T> = {
	readonly [K in keyof T]: T[K] extends readonly (infer E)[] ? readonly E[] : T[K];
};

/**
 * An assessment criterion, per the RATIFIED DOC-004 §7 `interface AssessmentCriterion`.
 *
 * This was `{ id, statement, mandatory? }` — a shape no document ratifies, with no overlap beyond `id`. It
 * survived because `AssurancePolicy.criteria` was typed `z.array(z.record(z.string(), z.unknown()))`, an array
 * of ANY OBJECT (docs/_working/AUDIT-placeholder-helpers.md). Note what `mandatory: boolean` stood in for:
 * `severityIfNotMet`, a FIVE-level ratified severity collapsed to a Boolean — the disease §16 item 12 names
 * for waivers.
 */
export type Criterion = Frozen<AssessmentCriterion>;

export interface SeedPolicy {
	readonly policyId: string;
	readonly name?: string;
	readonly evaluatedClaimTypes?: readonly string[];
	readonly appliesToPwuKinds?: readonly string[];
	readonly requiredEvidenceTypes?: readonly string[];
	readonly criteria?: readonly Criterion[];
	/** The policy's ratified finding CODES (DOC-004 §N.5). Codes only — §N.5 ratifies no per-code description
	 *  or severity; the seeded FindingDefinition objects supply those (see seed-workbench / findingsFor). */
	readonly findingTypes?: readonly string[];
	readonly independenceRequirement?: string;
	readonly failureSeverity?: string;
	/** The evaluator role. AUTHORED — DOC-004 names no evaluator role for any policy. Declared here because the
	 *  `as const satisfies OntologyData` check at the literal caught it as an excess property the moment the six
	 *  §18/§20/§22/§24/§25/§26 policies were added: exactly the drift the assertion used to hide (Increment 11a). */
	readonly evaluatorRole?: string;
	/** Provenance for the policy's canonical id (DOC-004 §15.x). Carried by the dataset; previously undeclared,
	 *  which the `as readonly SeedPolicy[]` assertion silently tolerated. */
	readonly sourceSection?: string;
}

export interface PwuTemplate {
	readonly pwuKind: string;
	readonly isRoot?: boolean;
	readonly purpose?: string;
	readonly candidateChildren?: readonly string[];
	readonly defaultPolicyIds?: readonly string[];
	// The five below are carried by the dataset and were undeclared until 2026-07-16 — the assertion hid them.
	readonly inputs?: readonly string[];
	readonly outputArtifactTypes?: readonly string[];
	readonly completionClaims?: readonly string[];
	readonly requiredEvidenceTypes?: readonly string[];
	readonly sourceSection?: string;
}

export interface ConformanceProfile {
	readonly profile: string;
	readonly minIndependence?: string;
	readonly mandatoryPolicyIds?: readonly string[];
	/** Carried by the dataset; previously undeclared. */
	readonly appliesToRisk?: string;
}

export interface CompatibilityPhase {
	readonly phase: string;
	readonly triggeredBy?: string;
	readonly note?: string;
}

/** The whole generated dataset. `ontology.data.ts` is checked against this AT ITS LITERAL. */
export interface OntologyData {
	readonly version: string;
	readonly pwuTemplates: readonly PwuTemplate[];
	readonly seedPolicies: readonly SeedPolicy[];
	readonly conformanceProfiles: readonly ConformanceProfile[];
	readonly roleDefaults: readonly unknown[];
	readonly compatibilityPhaseMapping: readonly CompatibilityPhase[];
}

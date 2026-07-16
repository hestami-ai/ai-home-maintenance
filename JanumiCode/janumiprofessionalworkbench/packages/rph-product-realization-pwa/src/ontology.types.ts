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
import type { AssessmentCriterion, Frozen } from '@janumipwb/rph-contracts';

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

/**
 * AUTHORED per-finding detail, keyed by ratified finding code.
 *
 * DOC-004 §9.1 mandates `FindingDefinition.description` and `defaultSeverity` — and ratifies NEITHER, for ANY of
 * its 99 codes. Verified corpus-wide, not assumed: each code occurs EXACTLY ONCE in all 14 ratified documents, as
 * a bare bullet in its policy's Findings subsection, and `defaultSeverity` occurs exactly once, in the §9.1
 * interface itself. There is no finding registry. So the ratified layer specifies an interface it populates for
 * zero codes — an open gap for the sponsor (docs/_working/HARMONIZATION-LOG.md).
 *
 * Only the 11 codes that already carried authored text are annotated. The other 88 are NOT invented: they fall
 * back to the humanized code and their policy's own `failureSeverity` (see seedAdditivePolicies). Annotating a
 * code that its policy does not list is a build error — see seed-policy-arrays.test.ts.
 */
export interface FindingAnnotation {
	readonly defaultSeverity: string;
	readonly description: string;
}

/**
 * ONE seed policy — the ratified DOC-004 catalog entry in its authorable form.
 *
 * The fields the workbench needs to stand a policy up as a real ASSURANCE_POLICY object are REQUIRED here, which
 * is what lets `seedAdditivePolicies` read this dataset directly instead of keeping its own copy. It kept one
 * until 2026-07-16 (`ADDITIVE_POLICY_SEEDS`), and the two drifted exactly as duplicated governance content does:
 * the seeded objects — the ones the app, the agent and the UI actually read — carried 17 of the catalog's 81
 * criteria and 11 of its 99 findings, in paraphrase, and bound `IP-01`/`IP-02` to different criteria than this
 * dataset does. Same id, different meaning, in the layer that keys the audit trail.
 */
export interface SeedPolicy {
	readonly policyId: string;
	readonly name: string;
	/** RATIFIED — DOC-004 §N.1 (§15.2 for POL-INTENT-FIDELITY). */
	readonly purpose: string;
	/** AUTHORED — DOC-004 ratifies no rationale field. States provenance; see `sourceSection`. */
	readonly rationale: string;
	readonly evaluatedClaimTypes: readonly string[];
	readonly appliesToPwuKinds?: readonly string[];
	readonly requiredEvidenceTypes?: readonly string[];
	/** RATIFIED text. Every description is the doc's own words, machine-checked against the markdown itself by
	 *  `doc004-conformance.test.ts` — the fidelity claim is executable, not prose. */
	readonly criteria: readonly Criterion[];
	/** The policy's RATIFIED finding CODES, in document order (DOC-004 §N's Findings subsection — the number
	 *  differs per policy). Codes only; see `FindingAnnotation` for why nothing more is available. */
	readonly findingTypes: readonly string[];
	readonly findingAnnotations?: Readonly<Record<string, FindingAnnotation>>;
	readonly independenceRequirement: string;
	/** The policy's own declared severity. Load-bearing: it is the fallback `defaultSeverity` for the 88 finding
	 *  codes DOC-004 leaves unannotated, so a finding inherits its policy's severity rather than an invented one. */
	readonly failureSeverity: string;
	/** AUTHORED — DOC-004 names no evaluator role for any policy. Declared here because the
	 *  `as const satisfies OntologyData` check at the literal caught it as an excess property the moment the six
	 *  §18/§20/§22/§24/§25/§26 policies were added: exactly the drift the assertion used to hide (Increment 11a). */
	readonly evaluatorRole: string;
	/** RATIFIED for 4 policies (§15.10, §17.8, §19.8, §23.7). The other 8 sections ratify none, and an empty set
	 *  is not honest-by-omission — a policy that can find a problem but recommend nothing is incoherent. Those 8
	 *  get the DERIVED FLOOR: the intersection of the four ratified sets (RESHAPE_PWU, REQUEST_HUMAN_DECISION),
	 *  unioned with any pre-existing authored value. Narrow by construction; widening it is the sponsor's call. */
	readonly permittedControlActions: readonly string[];
	/** Per-field provenance: what is transcribed, what is derived and by which rule, what is authored. Prose — the
	 *  transcription claims it makes are the ones `doc004-conformance.test.ts` actually enforces. */
	readonly sourceSection: string;
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

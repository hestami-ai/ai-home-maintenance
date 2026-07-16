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
 * DOC-004 §9.1 mandates `FindingDefinition.description` and `defaultSeverity`; the catalog supplies them for
 * almost nothing, so the 11 codes that carry authored text are annotated here and the rest fall back to the
 * humanized code and their policy's own `failureSeverity` (see seedAdditivePolicies) rather than to invented
 * values. Annotating a code its policy does not list is a build error — see seed-policy-arrays.test.ts.
 *
 * CORRECTED 2026-07-16. This said: "ratifies NEITHER, for ANY of its 99 codes. Verified corpus-wide, not
 * assumed: each code occurs EXACTLY ONCE in all 14 ratified documents." Both halves were false, and the way they
 * were false is the point (HARMONIZATION-LOG C6):
 *   - I checked that the FIELD NAME `defaultSeverity` occurs once, and sampled THREE codes — then wrote "99".
 *     96 of 99 occur once; three do not.
 *   - DOC-004 §33's worked validator output binds `INTENT_EXPANSION` to `"severity": "MATERIAL"` outright, with
 *     a model statement and `dispositionRecommendation: "CONDITIONALLY_SATISFIED"`. The Executable Invariant and
 *     Conformance Test Specification ratifies blocking behaviour for several more cases. The content was there
 *     under a different key, in sections I had not opened.
 * An absence found by grepping a field name is a claim about the field name. Populating these remains open for
 * the sponsor — and is now blocked on a prior question: the catalog is ratified TWICE (see `SeedPolicy`).
 */
export type SeverityBasis =
	| 'RATIFIED_BLOCKING_CONDITION'
	| 'RATIFIED_CONFORMANCE_TEST'
	| 'RATIFIED_WORKED_EXAMPLE'
	| 'AUTHORED';

export interface FindingAnnotation {
	readonly defaultSeverity: string;
	readonly description: string;
	/** Where the severity came from. `RATIFIED_*` is a claim about the corpus and is CHECKED — see
	 *  doc004-conformance.test.ts, which requires `severityQuote` to occur in the ratified documents. `AUTHORED`
	 *  is the honest label for a judgement, including a well-grounded one. The label is what the sponsor audits. */
	readonly severityBasis: SeverityBasis;
	/** The corpus words that DECIDE this severity. Required iff basis is `RATIFIED_*`; must be in the documents. */
	readonly severityQuote?: string;
	/** Why this severity and not the adjacent one. Prose for audit; not machine-checked. */
	readonly severityRationale: string;
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
 *
 * ⚠️ THE CATALOG IS RATIFIED TWICE, AND THIS DATASET SILENTLY PICKS ONE (found 2026-07-16; open for the sponsor).
 * DOC-004 §15–§26 defines twelve policies. RPH-DOC-003 §25–§35 ("Assurance Policy: <Name>") defines ELEVEN of
 * the same policies — independently, with different content. They are not a superset and a subset:
 *   - DOC-003 §25 (Intent Fidelity) ratifies FOUR "Blocking conditions" ("mandatory constraint omitted"; "major
 *     ambiguity hidden"; …). DOC-004 §15 ratifies NONE.
 *   - DOC-003 §25's findings are prose and include "false precision" and "conflicting interpretation", which
 *     have no DOC-004 code; DOC-004 §15.7 has `OUTCOME_EROSION` and `NON_GOAL_CONFLICT`, which DOC-003 lacks.
 *   - DOC-003 §29 blocks on "no recomposition strategy"; DOC-004 §19.7 does not.
 *   - Only DOC-004 has POL-CONSTRAINT-PROPAGATION (§20) at all.
 * This dataset transcribes DOC-004 — the better-specified source (codes, criterion ids, twelve policies) — and
 * `doc004-conformance.test.ts` enforces that. But enforcing DOC-004 IS choosing DOC-004 over another ratified
 * document, and that choice is not mine to make: the only tiebreaker on disk is the Coding Agent Guide's §17
 * source map, and §16 item 1 says of that guide "This guide is itself proposed". Using a proposed distillation
 * to adjudicate between two ratified documents is precisely the borrowed authority this program corrected in C1.
 * Recorded, not resolved — see HARMONIZATION-LOG PART 4.
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

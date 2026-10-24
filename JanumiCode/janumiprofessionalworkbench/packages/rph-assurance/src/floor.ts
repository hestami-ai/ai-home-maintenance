// The de minimis assurance floor (§8.4) as a PLANE-AGNOSTIC pipeline over an AssuranceSubject — a material
// transformation output, whether an authoring-plane PWA draft or an execution-plane work product. Every material
// transformation receives, in order: (1) strict schema/invariant validation, (2) identity/provenance/trace checks,
// (3) a Reasoning Review Assessment iff produced or materially shaped by an AI/agent, and (4) canonical
// disposition + protected-transition enforcement. This module is the PURE core: it defines the Validator RESULT
// shape a Validator must emit (never bare prose/pass-fail/score — §8.9), the deterministic floor validators, the
// ordered floor plan, and `composeAssuranceOutcome`, which finally wires the assurance island (dispositionFromFindings
// → `REG-D-089`'s rule (a), a second pass → aggregateDisposition strictest-unresolved + checkIndependence + boundary).
// The model-backed Reasoning Review Validator and the registry/invocation live server-side (impure); step (4)
// enforcement is done by the caller that records the Assessment and re-checks the disposition at the gate.
import {
	aggregateDisposition,
	checkIndependence,
	classifyValidatorResult,
	dispositionFromFindings,
	type AggregateDisposition,
	type CriterionResult,
	type Disposition,
	type Identity,
	type IndependenceRequirement,
	type PolicyAssessment,
	type Severity,
	type ValidatorResultClass
} from './assurance-rules.js';

/** A material transformation output the floor runs over — plane-agnostic. */
export interface AssuranceSubject {
	readonly subjectId: string;
	readonly objectType: string;
	readonly semanticVersion: number;
	/** Was the subject produced or materially shaped by an AI/agent? Drives the mandatory Reasoning Review step. */
	readonly isAiProduced: boolean;
	/** Identity of the producer (executor) — the independence baseline the Reasoning Review evaluator must differ from. */
	readonly producer: Identity;
}

export const FLOOR_POLICY_IDS = {
	SCHEMA_INVARIANT: 'floor.schema-invariant',
	IDENTITY_PROVENANCE: 'floor.identity-provenance',
	REASONING_REVIEW: 'floor.reasoning-review'
} as const;
export type FloorPolicyId = (typeof FLOOR_POLICY_IDS)[keyof typeof FLOOR_POLICY_IDS];

export interface FloorPolicyRef {
	readonly policyId: FloorPolicyId;
	readonly policyVersion: string;
	readonly required: boolean;
	readonly independence: IndependenceRequirement;
}

/**
 * The ordered de minimis floor for a subject: schema/invariant → identity/provenance → (Reasoning Review IFF the
 * subject was produced or materially shaped by an AI/agent). The floor is NOT risk-optional — no profile, low-risk
 * classification, or planner may suppress it (§8.4). Reasoning Review requires model-level independence by default.
 */
export function deMinimisFloorPlan(subject: AssuranceSubject): FloorPolicyRef[] {
	const plan: FloorPolicyRef[] = [
		{
			policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			policyVersion: '1',
			required: true,
			independence: 'NONE'
		},
		{
			policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
			policyVersion: '1',
			required: true,
			independence: 'NONE'
		}
	];
	if (subject.isAiProduced) {
		plan.push({
			policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
			policyVersion: '1',
			required: true,
			independence: 'DIFFERENT_MODEL'
		});
	}
	return plan;
}

/** One concrete observation a Validator emits (feeds finding-type AssuranceObservations downstream). */
export interface FloorObservation {
	readonly code: string;
	readonly severity: Severity;
	readonly statement: string;
	readonly open: boolean;
}

export interface FloorCriterion extends CriterionResult {
	readonly criterionId: string;
	readonly rationale?: string;
	/** ⭐ `REG-D-071` Q4 (form D): a test's stipulated answer, carried BESIDE `outcome` (which stays
	 *  `UNABLE_TO_DETERMINE`). Absent means no stipulation — the conservative reading. */
	readonly stipulated?: 'MET';
}

/**
 * A Validator's schema-conformant RESULT (§8.9): it PROPOSES criterion results, observations, and a disposition
 * recommendation — it never mutates state and never returns only prose/pass-fail/unscoped confidence. The Assurance
 * Service (composeAssuranceOutcome) validates and composes it; it does not authorize acceptance.
 */
export interface ValidatorResult {
	readonly policyId: FloorPolicyId;
	readonly policyVersion: string;
	readonly validatorId: string;
	readonly validatorVersion: string;
	readonly subjectId: string;
	readonly subjectSemanticVersion: number;
	/** Identity of the evaluator (for the independence check against the subject's producer). */
	readonly evaluator: Identity;
	readonly criteria: readonly FloorCriterion[];
	readonly observations: readonly FloorObservation[];
	readonly dispositionRecommendation: Disposition;
	readonly consideredEvidenceIds: readonly string[];
	readonly rejectedEvidenceIds: readonly string[];
	readonly residualUncertainty: readonly string[];
	readonly executionFailed: boolean;
	readonly limitations: readonly string[];
}

function buildResult(args: {
	subject: AssuranceSubject;
	policyId: FloorPolicyId;
	validatorId: string;
	criteria: readonly FloorCriterion[];
	observations: readonly FloorObservation[];
	evaluator: Identity;
}): ValidatorResult {
	const dispositionRecommendation = dispositionFromFindings({
		findings: args.observations.map((o) => ({ severity: o.severity, open: o.open })),
		criteria: args.criteria
	});
	return {
		policyId: args.policyId,
		policyVersion: '1',
		validatorId: args.validatorId,
		validatorVersion: '1',
		subjectId: args.subject.subjectId,
		subjectSemanticVersion: args.subject.semanticVersion,
		evaluator: args.evaluator,
		criteria: args.criteria,
		observations: args.observations,
		dispositionRecommendation,
		consideredEvidenceIds: [],
		rejectedEvidenceIds: [],
		residualUncertainty: [],
		executionFailed: false,
		limitations: []
	};
}

const SYSTEM_EVALUATOR: Identity = { actorType: 'SYSTEM', agentId: 'floor.deterministic' };

// ── Step 1: strict output-contract/schema validation + applicable deterministic invariants ──────────────────────
export interface SchemaInvariantFacts {
	readonly schemaValid: boolean;
	/** Codes of violated deterministic invariants (empty = none). */
	readonly invariantViolations: readonly string[];
}

/** Deterministic floor Validator #1 — the subject conforms to its object contract/schema and every applicable
 *  deterministic invariant holds. A schema failure is CRITICAL; an invariant violation is BLOCKING. */
export function schemaInvariantValidator(
	subject: AssuranceSubject,
	facts: SchemaInvariantFacts
): ValidatorResult {
	const observations: FloorObservation[] = [];
	if (!facts.schemaValid)
		observations.push({
			code: 'SCHEMA_INVALID',
			severity: 'CRITICAL',
			statement: 'Subject failed strict output-contract/schema validation.',
			open: true
		});
	for (const v of facts.invariantViolations)
		observations.push({
			code: v,
			severity: 'BLOCKING',
			statement: `Deterministic invariant violated: ${v}`,
			open: true
		});
	const criteria: FloorCriterion[] = [
		{
			criterionId: 'FS-01-schema',
			mandatory: true,
			outcome: facts.schemaValid ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'FS-02-invariants',
			mandatory: true,
			outcome: facts.invariantViolations.length === 0 ? 'MET' : 'NOT_MET'
		}
	];
	return buildResult({
		subject,
		policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		validatorId: 'deterministic.schema-invariant',
		criteria,
		observations,
		evaluator: SYSTEM_EVALUATOR
	});
}

// ── Step 2: identity, semantic-version, provenance, authority, input/context/output, and trace completeness ──────
export interface IdentityProvenanceFacts {
	readonly hasStableId: boolean;
	readonly hasSemanticVersion: boolean;
	readonly hasProvenance: boolean;
	readonly hasProducer: boolean;
	readonly traceComplete: boolean;
}

/** Deterministic floor Validator #2 — identity/version/provenance/producer/trace completeness. Any missing element
 *  is BLOCKING (the subject cannot be admitted without a stable, traceable identity). */
export function identityProvenanceValidator(
	subject: AssuranceSubject,
	facts: IdentityProvenanceFacts
): ValidatorResult {
	const criteria: FloorCriterion[] = [
		{
			criterionId: 'IP-01-identity',
			mandatory: true,
			outcome: facts.hasStableId ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-02-version',
			mandatory: true,
			outcome: facts.hasSemanticVersion ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-03-provenance',
			mandatory: true,
			outcome: facts.hasProvenance ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-04-producer',
			mandatory: true,
			outcome: facts.hasProducer ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-05-trace',
			mandatory: true,
			outcome: facts.traceComplete ? 'MET' : 'NOT_MET'
		}
	];
	const observations: FloorObservation[] = criteria
		.filter((c) => c.outcome === 'NOT_MET')
		.map((c) => ({
			code: c.criterionId,
			severity: 'BLOCKING' as const,
			statement: `${c.criterionId} not satisfied — identity/provenance/trace incomplete.`,
			open: true
		}));
	return buildResult({
		subject,
		policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
		validatorId: 'deterministic.identity-provenance',
		criteria,
		observations,
		evaluator: SYSTEM_EVALUATOR
	});
}

// ── Step 4 (compose): validate each Validator result at the boundary, check independence, and aggregate ──────────
export interface FloorPolicyOutcome {
	readonly policyId: FloorPolicyId;
	readonly required: boolean;
	readonly resultClass: ValidatorResultClass | 'MISSING';
	readonly disposition: Disposition | 'VALIDATOR_FAILED' | 'BOUNDARY_REJECTED' | 'MISSING';
	readonly boundaryReason?: string;
	readonly independenceOk: boolean;
}

export interface AssuranceOutcome {
	readonly subjectId: string;
	readonly subjectSemanticVersion: number;
	readonly aggregate: AggregateDisposition;
	readonly perPolicy: readonly FloorPolicyOutcome[];
	readonly observations: readonly FloorObservation[];
	/** True iff the composed aggregate permits the protected downstream transition (SATISFIED only). Missing,
	 *  failed, boundary-rejected, inconclusive, conditional, or rejected floor results all block. */
	readonly gatePermitsTransition: boolean;
}

/** Options for the composition step. Absent means today's ladder exactly. */
export interface ComposeOptions {
	/**
	 * ⭐ THE ENGINE ADMITS TEST-STIPULATED ANSWERS (`REG-D-071` Q5 (a)). Callers pass the flag of the engine they will
	 * RECORD INTO (`EngineHandle.admitStipulatedAnswers`), so the ladder and Gate E answer the same question the
	 * same way — a ladder that admitted what Gate E refused would make the recorder throw.
	 */
	readonly admitStipulatedAnswers?: boolean;
	/**
	 * ⭐ The review in parts, B3 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D5) — A FLOOR POLICY OF THE SAME ROUND,
	 * OUTSIDE THIS PLAN, IS NOT SATISFIED. The authoring floor composes one round as several plans: the PWA's two
	 * deterministic policies, and one Reasoning Review per type of it. So condition (iv) of `REG-D-089`'s rule (a),
	 * *"nothing else already blocks"*, also reads what this plan does not hold: true, and a clean review its reviewer
	 * escalates stays as the ladder computed it, its recommendation recorded beside it. Absent, the plan is the whole round.
	 */
	readonly blockedOutsideThePlan?: boolean;
}

/**
 * ⭐ THE ONE ADMITTING BRANCH OF THE LADDER (`REG-D-071` Q5 (a); `REG-D-072` D3). In an engine built to admit them, a
 * reasoning-review row recorded `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it counts as met — and only
 * there, only under `floor.reasoning-review`. The record itself is untouched: it still says nobody judged the row.
 * ⛔ SCOPED TO ONE POLICY, AS GATE E IS: unscoped, a stipulated row under another policy would compose SATISFIED
 * here while Gate E refused the completion, and the recorder throws on any refusal.
 */
function countedCriteria(
	policyId: string,
	criteria: readonly FloorCriterion[],
	opts: ComposeOptions
): readonly FloorCriterion[] {
	if (opts.admitStipulatedAnswers !== true || policyId !== FLOOR_POLICY_IDS.REASONING_REVIEW) return criteria;
	return criteria.map((c) =>
		c.outcome === 'UNABLE_TO_DETERMINE' && c.stipulated === 'MET' ? { ...c, outcome: 'MET' as const } : c
	);
}

/**
 * ⭐⭐ `REG-D-089`'S RULE (a), AS `REG-D-090` READS IT (`JAN-ESCREC` design D1) — does this row escalate on its
 * reviewer's recommendation?
 *
 * THE RULING (sponsor, 2026-10-01, option (a)): *"escalate only when nothing else already blocks. If no criterion
 * failed, the outcome becomes ESCALATED: publishing stays blocked […]. If a criterion failed, the outcome stays
 * REJECTED, which is more actionable, with the escalation recorded beside it."* `REG-D-090` reads it as four
 * conditions, EVERY ONE required:
 *   (i)   the row is the Reasoning Review's, and its result's class is VALID;
 *   (ii)  the result recommends the literal `ESCALATED` — no other value, no other spelling;
 *   (iii) the row's computed disposition is SATISFIED;
 *   (iv)  every OTHER policy of the plan is SATISFIED.
 *
 * ⭑ (iii) IS KEYED ON SATISFIED, NOT ON "NO CRITERION FAILED". SATISFIED is a fully answered, clean review: every
 * mandatory criterion MET or NOT_APPLICABLE, and no open failure observation. An undetermined criterion is an
 * UNANSWERED one, and ASR-2 calls that *"invalid output"* — so such a review stays INCONCLUSIVE, and a failed row filed
 * under a corrupted id is never escalated past (`REG-F-428`). The agent's wider reading is withdrawn (`REG-D-090`).
 * ⚠ BUT "INVALID OUTPUT" IS ASR-2'S WORD, NOT THIS BOUNDARY'S CLASS (the ER-1 verifier's finding [7]). A PARTIAL
 * reply — criteria present, some undetermined — is classed VALID here and composes INCONCLUSIVE; it is not
 * boundary-rejected, as ASR-2's *"invalid output"* would have it. Only an EMPTY criteria list is: the
 * `requiredCriteriaPresent` flag that `composeAssuranceOutcome` hands the boundary (:440). That is why D2 records such
 * a review's recommendation: `recording.ts` reads VALID results (ASR-11), and this one is VALID — as its own findings,
 * recorded beside it, were before ER-1.
 * ⭑ AND IT READS THE DISPOSITION THE LADDER COMPUTED — this row's, which went through `countedCriteria` — never a
 * second reading of the criteria. So an engine that admits stipulations escalates exactly the remainder its own ladder
 * calls clean, and the two cannot disagree about what "clean" means.
 * ⭑ SO "NO CRITERION FAILED" MEANS THE COMPUTED SATISFIED (the ER-1 re-verifier's finding [5], decided in the second
 * fix round). `REG-D-090`'s gloss also says *"no NOT_MET"* and *"no open failure observation"*: both are read as the
 * ladder reads them, no MANDATORY criterion NOT_MET and no open finding a rung reads. So a NOT_MET criterion the policy
 * does not make mandatory, its finding open at ADVISORY, does not stop a SATISFIED, and the escalation stands; nor does
 * a mandatory criterion NOT_APPLICABLE. Pinned (`floor.test.ts`). No live review has either: every seeded Reasoning
 * Review criterion declares BLOCKING and may not be NOT_APPLICABLE (`floor-policies.ts`).
 *
 * ⭑ (i) IS ASR-11: *"Malformed or invalid validator output can never mutate authoritative state."* A boundary-rejected
 * or failed result's recommendation is never READ — `failedResult`'s `INCONCLUSIVE` (`validators.ts`) is a
 * placeholder, not a reviewer's word. ⚠ (iii) implies it today, because composition gives a non-VALID class a
 * non-SATISFIED row; it is stated anyway, so the guarantee does not rest on how the boundary arms happen to be spelt.
 * ⚠ Dropping (i) ALONE is therefore an EQUIVALENT mutant: a boundary mutant must also let the boundary row past (iii).
 *
 * ⭑ (iv) READS "NOTHING ELSE ALREADY BLOCKS" ACROSS THE FLOOR. A graph that is not well formed is revised first, with
 * the escalation recorded beside it: *"more actionable"* is the ruling's own reason, and a graph defect is that kind of
 * block. It reads the floor AS COMPUTED, before any row is escalated. In the qualification runner's plan the review
 * stands alone, so (iv) holds vacuously there — rightly: qualification asks what the reviewer's reply yields.
 * ⭐ The review in parts (`REG-D-125`): where one round is composed as several plans — the authoring floor's PWA and each of
 * its types — (iv) also reads the rest of the round, which its caller states (`ComposeOptions.blockedOutsideThePlan`).
 * ⭑ "ALREADY BLOCKS" MEANS WHAT THE ENGINE'S FLOOR GATE MEANS, NOT WHAT THIS PACKAGE'S AGGREGATE MEANS (the ER-1
 * verifier's finding [4], decided in its fix round). So (iv) asks EVERY other policy of the plan, required or not. The
 * engine's gate requires all three floor policies whatever a plan marks — `FLOOR_POLICY_IDS_REQUIRED` and
 * `floorGateBlock` (`packages/rph-application/src/handlers/floor-gate.ts:21-25`, `:275-295`) — so a floor policy
 * that is not SATISFIED blocks there, while `aggregateDisposition` (`assurance-rules.ts`) leaves a non-required
 * policy out of the aggregate. ⚠ The consequence, disclosed and pinned (`floor.test.ts`): beside a non-required
 * policy that is not SATISFIED, a clean review its reviewer escalates stays SATISFIED, and the PLAN's aggregate opens
 * its gate while the engine's gate refuses. No product plan marks a floor policy non-required: `deMinimisFloorPlan`
 * marks every policy it plans required.
 * ⚠ AND THE REVIEW'S OWN FLAG (the ER-1 re-verifier's finding [4], decided in the second fix round): no condition reads
 * the review's `required` flag either. Where the plan marks the review itself non-required, a clean review its reviewer
 * escalates is ESCALATED, and D2 records the recommendation; the second pass keeps the plan's flag in the aggregate's
 * input, so the aggregate leaves the escalated review out — SATISFIED, the PLAN's gate open — while the engine's gate,
 * which requires the review whatever the plan marks, refuses it. The same disclosed split, pinned (`floor.test.ts`,
 * `recording.test.ts`).
 *
 * ⛔ SCOPED TO `floor.reasoning-review`. A deterministic policy recommends what its own ladder computed (`buildResult`),
 * so it never escalates; a rule that read every policy's recommendation would let one hand-built result shut a floor
 * that is SATISFIED everywhere.
 *
 * ⚠ DISCLOSED: A CODED RULE, DEPARTING FROM ASR-1 (*"Policy applicability and disposition rules are declarative data
 * evaluated by the engine, never executable code"*). Its declarative home, a ratified `EscalationRule.trigger`, has no
 * evaluator (`REG-Q-057`); reaching it needs a contract change, a seed migration, an exception to the floor policies'
 * edit lock, and a store reader in this store-free package. This implements a sponsor ruling scoped to one locked
 * policy, and the departure is put to the sponsor (`REG-D-090`).
 * ⚠ DISCLOSED: POLICY VERSION '1' IS UNCHANGED, although what it yields changes. ASR-1's scope says *"Policy meaning is
 * stable across validator replacement"*; the meaning moves here by a ruling, not by a validator.
 */
function escalatesOnTheRecommendation(
	po: FloorPolicyOutcome,
	r: ValidatorResult | undefined,
	computed: readonly FloorPolicyOutcome[],
	opts: ComposeOptions
): boolean {
	return (
		po.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW &&
		po.resultClass === 'VALID' &&
		r?.dispositionRecommendation === 'ESCALATED' &&
		po.disposition === 'SATISFIED' &&
		computed.every((other) => other.policyId === po.policyId || other.disposition === 'SATISFIED') &&
		opts.blockedOutsideThePlan !== true
	);
}

/**
 * The Assurance-Service composition step. For each planned floor policy: if its Validator result is MISSING, the
 * floor is incomplete (never assume satisfied). Otherwise classify the result at the boundary (VALIDATOR_FAILED /
 * BOUNDARY_REJECTED never become authoritative findings), enforce the policy's independence requirement, derive the
 * single-policy disposition, and fold everything into the strictest-unresolved aggregate. The gate opens only on a
 * SATISFIED aggregate.
 * ⭐ `JAN-ESCREC` D1: between the two, a SECOND PASS applies `REG-D-089`'s rule (a) — a clean Reasoning Review its
 * reviewer recommends ESCALATED becomes ESCALATED when nothing else blocks (`escalatesOnTheRecommendation`).
 */
export function composeAssuranceOutcome(
	subject: AssuranceSubject,
	plan: readonly FloorPolicyRef[],
	results: readonly ValidatorResult[],
	opts: ComposeOptions = {}
): AssuranceOutcome {
	const byPolicy = new Map(results.map((r) => [r.policyId, r]));
	const perPolicy: FloorPolicyOutcome[] = [];
	const observations: FloorObservation[] = [];
	const policyAssessments: PolicyAssessment[] = [];

	for (const p of plan) {
		const r = byPolicy.get(p.policyId);
		if (!r) {
			perPolicy.push({
				policyId: p.policyId,
				required: p.required,
				resultClass: 'MISSING',
				disposition: 'MISSING',
				independenceOk: false
			});
			policyAssessments.push({ required: p.required, disposition: 'MISSING' });
			continue;
		}
		observations.push(...r.observations);
		const independence = checkIndependence(p.independence, subject.producer, r.evaluator);
		const mandatoryUnmet = r.criteria.some((c) => c.mandatory && c.outcome === 'NOT_MET');
		const klass = classifyValidatorResult({
			executionFailed: r.executionFailed,
			schemaValid: true,
			policyVersionMatches: r.policyVersion === p.policyVersion,
			subjectVersionMatches: r.subjectSemanticVersion === subject.semanticVersion,
			requiredCriteriaPresent: r.criteria.length > 0,
			evidenceExists: true,
			evidenceInvalidated: false,
			independenceSatisfied: independence.independent,
			recommendation: r.dispositionRecommendation,
			mandatoryCriterionUnmet: mandatoryUnmet
		});

		let disposition: FloorPolicyOutcome['disposition'];
		let aggDisposition: PolicyAssessment['disposition'];
		if (klass.klass === 'VALIDATOR_FAILED') {
			disposition = 'VALIDATOR_FAILED';
			aggDisposition = 'INCONCLUSIVE'; // §8.13: not REJECTED; leaves assurance incomplete → blocks.
		} else if (klass.klass === 'BOUNDARY_REJECTED') {
			disposition = 'BOUNDARY_REJECTED';
			aggDisposition = 'INCONCLUSIVE'; // malformed result cannot create an authoritative finding → blocks.
		} else {
			disposition = dispositionFromFindings({
				findings: r.observations.map((o) => ({ severity: o.severity, open: o.open })),
				criteria: countedCriteria(p.policyId, r.criteria, opts)
			});
			aggDisposition = disposition;
		}
		perPolicy.push({
			policyId: p.policyId,
			required: p.required,
			resultClass: klass.klass,
			disposition,
			...(klass.reason ? { boundaryReason: klass.reason } : {}),
			independenceOk: independence.independent
		});
		policyAssessments.push({ required: p.required, disposition: aggDisposition });
	}

	// ⭐⭐ THE SECOND PASS — `REG-D-089`'s rule (a), after every row is computed and BEFORE the aggregate (design D1).
	// ⛔ BOTH RECORDS MOVE, OR ONE OF TWO GATES LIES. The row is what the recorder persists and the engine's floor gate
	// reads (`floorGateBlock`, latest recorded assessment per policy); `policyAssessments` is the aggregate's input, where
	// a required ESCALATED reads INCONCLUSIVE (`aggregateDisposition`) and shuts `gatePermitsTransition`. The row alone
	// leaves the plan's gate OPEN for every host that acts on the verdict; the aggregate alone records the review
	// SATISFIED, which the engine's gate then admits.
	// ⭑ NOTHING ELSE MOVES: `resultClass` stays VALID (a ruling over a valid result is not a boundary event), the order
	// is the plan's, and `observations` are untouched — the recommendation is RECORDED after composition, by
	// `assuranceRecordingPlan` (D2), never placed in the ladder's input. ⭑ No `ComposeOptions` flag: every caller gets the
	// ruling, the qualification runner included (it composes with no options).
	const computed = [...perPolicy];
	computed.forEach((po, i) => {
		if (!escalatesOnTheRecommendation(po, byPolicy.get(po.policyId), computed, opts)) return;
		perPolicy[i] = { ...po, disposition: 'ESCALATED' };
		policyAssessments[i] = { required: po.required, disposition: 'ESCALATED' };
	});

	const aggregate = aggregateDisposition(policyAssessments);
	return {
		subjectId: subject.subjectId,
		subjectSemanticVersion: subject.semanticVersion,
		aggregate,
		perPolicy,
		observations,
		gatePermitsTransition: aggregate === 'SATISFIED'
	};
}

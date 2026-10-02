import { describe, expect, it } from 'vitest';
import { dispositionFromFindings, type Disposition, type Identity } from './assurance-rules.js';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	identityProvenanceValidator,
	schemaInvariantValidator,
	type AssuranceOutcome,
	type AssuranceSubject,
	type ComposeOptions,
	type FloorCriterion,
	type FloorObservation,
	type FloorPolicyId,
	type ValidatorResult
} from './floor.js';

const CODEX: Identity = {
	actorType: 'AGENT',
	agentId: 'executor',
	modelId: 'gpt-5.4-mini',
	providerId: 'openai'
};
const GEMINI: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};

function subject(over: Partial<AssuranceSubject> = {}): AssuranceSubject {
	return {
		subjectId: 'pwa_1',
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: 1,
		isAiProduced: true,
		producer: CODEX,
		...over
	};
}

function rr(
	s: AssuranceSubject,
	opts: {
		evaluator: Identity;
		criteria: FloorCriterion[];
		observations?: FloorObservation[];
		recommendation: Disposition;
	}
): ValidatorResult {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		policyVersion: '1',
		validatorId: 'agy.reasoning-review',
		validatorVersion: '1',
		subjectId: s.subjectId,
		subjectSemanticVersion: s.semanticVersion,
		evaluator: opts.evaluator,
		criteria: opts.criteria,
		observations: opts.observations ?? [],
		dispositionRecommendation: opts.recommendation,
		consideredEvidenceIds: [],
		rejectedEvidenceIds: [],
		residualUncertainty: [],
		executionFailed: false,
		limitations: []
	};
}
const MET: FloorCriterion[] = [{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' }];

const goodSchema = { schemaValid: true, invariantViolations: [] };
const goodIdentity = {
	hasStableId: true,
	hasSemanticVersion: true,
	hasProvenance: true,
	hasProducer: true,
	traceComplete: true
};

describe('deMinimisFloorPlan — the mandatory ordered floor (§8.4)', () => {
	it('a non-AI subject gets schema + identity/provenance only', () => {
		const plan = deMinimisFloorPlan(subject({ isAiProduced: false }));
		expect(plan.map((p) => p.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
	});
	it('an AI-produced subject additionally requires Reasoning Review with model independence', () => {
		const plan = deMinimisFloorPlan(subject({ isAiProduced: true }));
		expect(plan.map((p) => p.policyId)).toContain(FLOOR_POLICY_IDS.REASONING_REVIEW);
		const rrRef = plan.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rrRef.required).toBe(true);
		expect(rrRef.independence).toBe('DIFFERENT_MODEL');
	});
});

describe('deterministic floor validators', () => {
	it('schema/invariant: valid → SATISFIED; invalid → REJECTED with a CRITICAL observation', () => {
		expect(schemaInvariantValidator(subject(), goodSchema).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		const bad = schemaInvariantValidator(subject(), {
			schemaValid: false,
			invariantViolations: []
		});
		expect(bad.dispositionRecommendation).toBe('REJECTED');
		expect(bad.observations[0]?.severity).toBe('CRITICAL');
	});
	it('identity/provenance: complete → SATISFIED; missing provenance → REJECTED (BLOCKING)', () => {
		expect(identityProvenanceValidator(subject(), goodIdentity).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		const bad = identityProvenanceValidator(subject(), { ...goodIdentity, hasProvenance: false });
		expect(bad.dispositionRecommendation).toBe('REJECTED');
		expect(bad.observations.some((o) => o.code === 'IP-03-provenance')).toBe(true);
	});
});

describe('composeAssuranceOutcome — the Assurance Service floor composition', () => {
	it('all floor policies SATISFIED with an independent reviewer → aggregate SATISFIED, gate OPEN', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(out.aggregate).toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});

	it('a schema failure makes the aggregate REJECTED and blocks the gate', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, { schemaValid: false, invariantViolations: [] }),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(out.aggregate).toBe('REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a missing required Reasoning Review leaves the floor UNASSESSED and blocks (never assume satisfied)', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity)
			// Reasoning Review result deliberately absent
		]);
		expect(out.aggregate).toBe('UNASSESSED');
		expect(out.gatePermitsTransition).toBe(false);
		expect(
			out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)?.disposition
		).toBe('MISSING');
	});

	it('a Reasoning Review by the SAME model as the producer is boundary-rejected (independence violation) and blocks', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: CODEX, criteria: MET, recommendation: 'SATISFIED' }) // same model as producer
		]);
		const rrOut = out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rrOut.independenceOk).toBe(false);
		expect(rrOut.resultClass).toBe('BOUNDARY_REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a Reasoning Review recommending SATISFIED with an unmet mandatory criterion is boundary-rejected', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, {
				evaluator: GEMINI,
				criteria: [{ criterionId: 'RR-01', mandatory: true, outcome: 'NOT_MET' }],
				recommendation: 'SATISFIED'
			})
		]);
		const rrOut = out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rrOut.resultClass).toBe('BOUNDARY_REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});
});

// ── ⭐⭐ `JAN-ESCREC` D1 — `REG-D-089`'S RULE (a), AS `REG-D-090` READS IT ──────────────────────────────────────────────
//
// THE RULING (sponsor, 2026-10-01, option (a)): a reviewer's ESCALATED recommendation escalates the review *"only when
// nothing else already blocks"*. `REG-D-090` reads that as four conditions, every one required: the Reasoning Review's
// result is VALID; it recommends the literal `ESCALATED`; its own computed disposition is SATISFIED (fully answered,
// nothing failed); and every OTHER floor policy is SATISFIED. In every other case the review keeps the disposition the
// §10.3 ladder computed — and the recommendation is RECORDED beside it, which is D2's (`recording.test.ts`), never this
// file's: nothing here may add an observation.
//
// ⚠ RED VERSUS CONTROL IS SAID PER TEST, BY WHAT HEAD DOES. HEAD never escalates, so every arm that keeps the review as
// computed already passes there: those are CONTROLS, each guarding one conjunct a mutant could drop. Only an arm that
// must ESCALATE could be red, and the two written first, before the rule, are the REDs. (The design's §4.3 lists *"the
// same beside a REJECTED schema policy"* as a red; HEAD keeps that review SATISFIED, so it is a control here.)
// ⭑ THE ESCALATING ARMS ADDED IN THE SECOND FIX ROUND — the computed-SATISFIED rows, and the review the plan marks
// optional — are CONTROLS OF THAT ROUND: each passed on the code it was written against, after the rule, and reddens
// under the mutant it was written to kill (`ER1-V104`, `ER1-M200`, `ER1-V102`). At HEAD they would be red, as every
// escalating arm is.
describe('⭐⭐ JAN-ESCREC D1 — a clean review its reviewer escalates is ESCALATED, only when nothing else blocks (REG-D-089, REG-D-090)', () => {
	const REVIEW = FLOOR_POLICY_IDS.REASONING_REVIEW;
	const reviewOf = (out: AssuranceOutcome) => out.perPolicy.find((p) => p.policyId === REVIEW)!;
	/**
	 * ⭑ AN OPEN NOTE NO RUNG OF THE LADDER READS (ADVISORY), so the clean review still computes SATISFIED while carrying
	 * an observation — which makes *"exactly the inputs' observations"* an assertion over a NON-EMPTY list. Over `[]` it
	 * would also pass a composition that dropped every observation.
	 */
	const NOTE: FloorObservation = {
		code: 'RR-NOTE',
		severity: 'ADVISORY',
		statement: 'an advisory note the ladder does not read',
		open: true
	};
	/** A VALID, fully answered, clean review by an independent model, recommending ESCALATED — rule (a)'s subject. */
	const escalating = (
		s: AssuranceSubject,
		over: Partial<ValidatorResult> = {}
	): ValidatorResult => ({
		...rr(s, {
			evaluator: GEMINI,
			criteria: MET,
			observations: [NOTE],
			recommendation: 'ESCALATED'
		}),
		...over
	});
	/** The two deterministic policies, SATISFIED — "nothing else already blocks". */
	const satisfiedOthers = (s: AssuranceSubject): ValidatorResult[] => [
		schemaInvariantValidator(s, goodSchema),
		identityProvenanceValidator(s, goodIdentity)
	];
	const compose = (
		s: AssuranceSubject,
		results: readonly ValidatorResult[],
		opts?: ComposeOptions
	) => composeAssuranceOutcome(s, deMinimisFloorPlan(s), results, opts);

	it('⭐ RED — a VALID, fully answered, clean review recommending ESCALATED, beside a SATISFIED floor → ESCALATED; the aggregate INCONCLUSIVE; the gate SHUT', () => {
		// PREDICTED RED AT HEAD: the review composes SATISFIED (`dispositionFromFindings` never returns ESCALATED), so the
		// aggregate is SATISFIED and the gate OPEN — design G1, driven.
		const s = subject();
		const results = [...satisfiedOthers(s), escalating(s)];
		const out = compose(s, results);
		// ⛔ THE WHOLE ROW, STRICTLY: only `disposition` moves. `resultClass` stays VALID (a rule over a valid result is not
		// a boundary event), and no field is added or lost — `toStrictEqual` reddens on an extra key such as a
		// `boundaryReason`.
		expect(
			reviewOf(out),
			'the review is escalated, and nothing else in its row moves'
		).toStrictEqual({
			policyId: REVIEW,
			required: true,
			resultClass: 'VALID',
			disposition: 'ESCALATED',
			independenceOk: true
		});
		expect(
			out.perPolicy.map((p) => `${p.policyId}=${p.disposition}`),
			'the order and the other rows'
		).toEqual([
			'floor.schema-invariant=SATISFIED',
			'floor.identity-provenance=SATISFIED',
			'floor.reasoning-review=ESCALATED'
		]);
		// ⭐ THE AGGREGATE IS TOLD: a required ESCALATED is INCONCLUSIVE (`aggregateDisposition`), so the gate stays SHUT.
		// A pass that changed only the per-policy row would leave both of these at SATISFIED / true.
		expect(out.aggregate).toBe('INCONCLUSIVE');
		expect(out.gatePermitsTransition, 'publication stays blocked').toBe(false);
		// ⛔ NOTHING IS ADDED TO THE COMPOSITION'S OBSERVATIONS. D2 appends the recommendation AFTER composition, in the
		// recording plan; placed here it would enter whatever reads `outcome.observations` as a finding.
		expect(out.observations, 'exactly the inputs’ observations').toEqual(
			results.flatMap((r) => r.observations)
		);
		expect(out.observations).toEqual([NOTE]);
	});

	it('⭐ RED — in an engine that admits stipulations, a stipulated remainder computes SATISFIED, so the same recommendation escalates it', () => {
		// ⭑ THE RULE READS THE DISPOSITION THE LADDER COMPUTED — the per-policy row, which went through `countedCriteria`,
		// the one admitting branch (`REG-D-071` Q5 (a)) — and never re-reads the criteria for itself. So an admitting engine
		// and the ladder cannot disagree about what "clean" means here, any more than the ladder and Gate E can.
		// PREDICTED RED AT HEAD: the admitting ladder composes SATISFIED, and nothing escalates it.
		const s = subject();
		const stipulated: FloorCriterion[] = [
			{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' },
			{ criterionId: 'RR-02', mandatory: true, outcome: 'UNABLE_TO_DETERMINE', stipulated: 'MET' }
		];
		const results = [...satisfiedOthers(s), escalating(s, { criteria: stipulated })];
		expect(reviewOf(compose(s, results, { admitStipulatedAnswers: true })).disposition).toBe(
			'ESCALATED'
		);
		// CONTROL: the default ladder reads the same record INCONCLUSIVE — an unanswered criterion — and rule (a) leaves an
		// INCONCLUSIVE review alone (ASR-2: *"Partial output — an unanswered mandatory criterion — is invalid output."*).
		expect(reviewOf(compose(s, results)).disposition).toBe('INCONCLUSIVE');
	});

	// ⭑ "NO CRITERION FAILED" IS READ AS THE COMPUTED SATISFIED, AND THE LADDER READS ONLY MANDATORY CRITERIA (the ER-1
	// re-verifier's finding [5]; `ER1-V104`; decided in the second fix round). `REG-D-090`'s gloss reads *"every mandatory
	// criterion MET or NOT_APPLICABLE, no NOT_MET, and no open failure observation, which is a computed SATISFIED"*, and
	// the rule asks the computed SATISFIED. `dispositionFromFindings` never reads a criterion the policy does not make
	// mandatory, so one NOT_MET there — its finding open at a severity no rung reads — leaves the review SATISFIED, and
	// the escalation stands; so does a mandatory criterion NOT_APPLICABLE. A second reading of the criteria ("no NOT_MET
	// at all", "no NOT_APPLICABLE") would keep its row SATISFIED, and the reviewer's ESCALATED would decide nothing.
	// Each row must hold on its own (`ER1-V104`; `ER1-M200`). ⚠ No live review has either row today: every seeded
	// Reasoning Review criterion declares BLOCKING, so is mandatory, and none may be NOT_APPLICABLE
	// (`floor-policies.ts`); and the judgement mapper never writes NOT_APPLICABLE (`validators.ts`).
	it.each<{ shape: string; criteria: FloorCriterion[]; observations: FloorObservation[] }>([
		{
			// ADVISORY: one of the severities a policy may declare for a criterion it does not make mandatory, and one no rung
			// of the ladder reads. Declared MATERIAL, the finding would CONDITION the review, and a conditioned review is not
			// escalated (the (iii) rows below).
			shape: 'a NON-mandatory criterion NOT_MET (its ADVISORY finding open)',
			criteria: [
				{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' },
				{ criterionId: 'RR-09', mandatory: false, outcome: 'NOT_MET' }
			],
			observations: [
				{
					code: 'RR-09',
					severity: 'ADVISORY',
					statement: 'a non-mandatory failure class is present',
					open: true
				}
			]
		},
		{
			shape: 'a mandatory criterion NOT_APPLICABLE',
			criteria: [
				{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' },
				{ criterionId: 'RR-02', mandatory: true, outcome: 'NOT_APPLICABLE' }
			],
			observations: [NOTE]
		}
	])(
		'CONTROL — beside $shape, every other criterion MET, the review computes SATISFIED, so the one its reviewer escalates is ESCALATED',
		({ criteria, observations }) => {
			const s = subject();
			const review = escalating(s, { criteria, observations });
			// The arrangement: the ladder ALONE, with no recommendation read, calls this review SATISFIED — so the row tests
			// how rule (a) reads "no criterion failed", not what the ladder computes.
			expect(
				dispositionFromFindings({
					findings: review.observations.map((o) => ({ severity: o.severity, open: o.open })),
					criteria: review.criteria
				}),
				'the arrangement: the ladder computes SATISFIED'
			).toBe('SATISFIED');
			const out = compose(s, [...satisfiedOthers(s), review]);
			expect(reviewOf(out).disposition, 'the computed SATISFIED is escalated').toBe('ESCALATED');
			expect(reviewOf(out).resultClass).toBe('VALID');
			expect(
				out.perPolicy.filter((p) => p.policyId !== REVIEW).map((p) => p.disposition),
				'the arrangement: nothing else blocks'
			).toEqual(['SATISFIED', 'SATISFIED']);
			expect(out.aggregate).toBe('INCONCLUSIVE');
			expect(out.gatePermitsTransition).toBe(false);
		}
	);

	// ⛔ CONDITION (iv): "NOTHING ELSE ALREADY BLOCKS" IS READ ACROSS THE FLOOR. Another policy that is anything but
	// SATISFIED keeps the review as computed — a graph defect is revised first, with the escalation recorded beside it.
	// Each row is a different way for another policy not to be SATISFIED, and each must hold on its own: a pass that
	// tested `=== 'REJECTED'` alone would escalate past the other five.
	it.each<{ shape: string; others: (s: AssuranceSubject) => ValidatorResult[]; aggregate: string }>(
		[
			{
				shape: 'a REJECTED schema-invariant policy',
				others: (s: AssuranceSubject) => [
					schemaInvariantValidator(s, { schemaValid: false, invariantViolations: [] }),
					identityProvenanceValidator(s, goodIdentity)
				],
				aggregate: 'REJECTED'
			},
			{
				shape: 'an INCONCLUSIVE schema-invariant policy (an undetermined mandatory criterion)',
				others: (s: AssuranceSubject) => [
					{
						...schemaInvariantValidator(s, goodSchema),
						criteria: [
							{ criterionId: 'FS-01-schema', mandatory: true, outcome: 'MET' as const },
							{
								criterionId: 'FS-02-invariants',
								mandatory: true,
								outcome: 'UNABLE_TO_DETERMINE' as const
							}
						],
						dispositionRecommendation: 'INCONCLUSIVE' as const
					},
					identityProvenanceValidator(s, goodIdentity)
				],
				aggregate: 'INCONCLUSIVE'
			},
			{
				shape: 'a CONDITIONALLY_SATISFIED schema-invariant policy (an open MATERIAL observation)',
				others: (s: AssuranceSubject) => [
					{
						...schemaInvariantValidator(s, goodSchema),
						observations: [
							{
								code: 'SCHEMA_NOTE',
								severity: 'MATERIAL' as const,
								statement: 'a material note',
								open: true
							}
						],
						dispositionRecommendation: 'CONDITIONALLY_SATISFIED' as const
					},
					identityProvenanceValidator(s, goodIdentity)
				],
				aggregate: 'CONDITIONALLY_SATISFIED'
			},
			{
				shape: 'a VALIDATOR_FAILED schema-invariant policy',
				others: (s: AssuranceSubject) => [
					{
						...schemaInvariantValidator(s, goodSchema),
						criteria: [],
						executionFailed: true,
						dispositionRecommendation: 'INCONCLUSIVE' as const
					},
					identityProvenanceValidator(s, goodIdentity)
				],
				aggregate: 'INCONCLUSIVE'
			},
			{
				shape: 'a BOUNDARY_REJECTED schema-invariant policy (a policy-version mismatch)',
				others: (s: AssuranceSubject) => [
					{ ...schemaInvariantValidator(s, goodSchema), policyVersion: '2' },
					identityProvenanceValidator(s, goodIdentity)
				],
				aggregate: 'INCONCLUSIVE'
			},
			{
				shape: 'a MISSING identity-provenance policy',
				others: (s: AssuranceSubject) => [schemaInvariantValidator(s, goodSchema)],
				aggregate: 'UNASSESSED'
			}
		]
	)(
		'CONTROL — beside $shape the clean ESCALATED review stays SATISFIED, and the aggregate is the other policy’s',
		({ others, aggregate }) => {
			const s = subject();
			const out = compose(s, [...others(s), escalating(s)]);
			// The arrangement: the other policy really is not SATISFIED, so condition (iv) is what this row tests.
			expect(
				out.perPolicy
					.filter((p) => p.policyId !== REVIEW)
					.some((p) => p.disposition !== 'SATISFIED'),
				'the arrangement: another policy blocks'
			).toBe(true);
			expect(
				reviewOf(out).disposition,
				'the review keeps the disposition the ladder computed'
			).toBe('SATISFIED');
			expect(reviewOf(out).resultClass).toBe('VALID');
			expect(out.aggregate).toBe(aggregate);
			expect(out.gatePermitsTransition).toBe(false);
		}
	);

	// ⛔ CONDITION (iv) ASKS EVERY OTHER POLICY OF THE PLAN, REQUIRED OR NOT (the ER-1 verifier's finding [4]; `ER1-V4`).
	// "Already blocks" is read as the ENGINE's floor gate reads it: that gate requires all three floor policies whatever a
	// plan marks (`floorGateBlock`, `rph-application`), so a floor policy that is not SATISFIED blocks there even where
	// this package's aggregate — which counts only REQUIRED policies — would not. These rows are the cells where the two
	// readings part: by the aggregate's, nothing else blocks; by the engine's, the other policy does, and the review keeps
	// its SATISFIED. ⚠ The plan's own gate then OPENS (the aggregate leaves the optional policy out) while the engine's
	// refuses: the reading's disclosed consequence (`floor.ts`, condition (iv)), pinned here so that changing either side
	// is a decision. No product plan marks a floor policy non-required (`deMinimisFloorPlan` marks every policy it plans
	// required). OPTIONAL below means the plan marks it `required: false`.
	it.each<{
		shape: string;
		optional: FloorPolicyId;
		others: (s: AssuranceSubject) => ValidatorResult[];
		blocks: string;
	}>([
		{
			shape: 'an OPTIONAL, REJECTED schema policy',
			optional: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			others: (s) => [
				schemaInvariantValidator(s, { schemaValid: false, invariantViolations: [] }),
				identityProvenanceValidator(s, goodIdentity)
			],
			blocks: 'floor.schema-invariant=REJECTED'
		},
		{
			// ⭑ A policy that never ran is not SATISFIED either: the engine's gate reads its absence as MISSING, and blocks.
			shape: 'an OPTIONAL, MISSING identity policy',
			optional: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
			others: (s) => [schemaInvariantValidator(s, goodSchema)],
			blocks: 'floor.identity-provenance=MISSING'
		}
	])(
		'CONTROL — beside $shape the clean ESCALATED review stays SATISFIED: "already blocks" is read as the engine’s gate reads it',
		({ optional, others, blocks }) => {
			const s = subject();
			const plan = deMinimisFloorPlan(s).map((p) =>
				p.policyId === optional ? { ...p, required: false } : p
			);
			const out = composeAssuranceOutcome(s, plan, [...others(s), escalating(s)]);
			// The arrangement: exactly that policy is optional, and it is not SATISFIED.
			expect(
				plan.filter((p) => !p.required).map((p) => p.policyId),
				'the arrangement: one floor policy is optional'
			).toEqual([optional]);
			expect(
				out.perPolicy.map((p) => `${p.policyId}=${p.disposition}`),
				'the arrangement: the optional policy is not SATISFIED'
			).toContain(blocks);
			expect(
				reviewOf(out).disposition,
				'the review keeps the disposition the ladder computed'
			).toBe('SATISFIED');
			expect(reviewOf(out).resultClass).toBe('VALID');
			// ⚠ THE DISCLOSED CONSEQUENCE: the aggregate counts only required policies, so by ITS reading nothing else
			// blocks — it is SATISFIED, and the plan's gate opens. The engine's floor gate, which requires every floor
			// policy, is where this floor is refused.
			expect(out.aggregate, 'the aggregate leaves the optional policy out').toBe('SATISFIED');
			expect(out.gatePermitsTransition).toBe(true);
		}
	);

	// ⛔ AND THE REVIEW'S OWN FLAG (the ER-1 re-verifier's finding [4]; `ER1-V102`; decided in the second fix round). Rule
	// (a) reads no `required` flag, the review's included: where the PLAN marks the Reasoning Review itself non-required,
	// the clean review its reviewer escalates is ESCALATED all the same, and D2 records the recommendation
	// (`recording.test.ts`). The second pass moves only the disposition, so the aggregate's input keeps the plan's flag,
	// and the aggregate — which counts only required policies — leaves the escalated review out: SATISFIED, and the
	// PLAN's gate opens. The engine's floor gate requires all three floor policies whatever a plan marks, and refuses the
	// recorded ESCALATED review (`floorGateBlock`, `rph-application`; driven in `rph-engine`'s `floor-gate.test.ts`). ⚠ The
	// same disclosed plan-versus-engine split as the rows above, for the review's own flag (`floor.ts`, condition (iv)),
	// pinned so that changing either side is a decision. No product plan marks the review non-required
	// (`deMinimisFloorPlan` marks it required).
	it('CONTROL — where the PLAN marks the review itself OPTIONAL, the clean review its reviewer escalates is ESCALATED, and the aggregate leaves it out (SATISFIED, the plan’s gate open)', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s).map((p) =>
			p.policyId === REVIEW ? { ...p, required: false } : p
		);
		expect(
			plan.filter((p) => !p.required).map((p) => p.policyId),
			'the arrangement: the review, and nothing else, is optional'
		).toEqual([REVIEW]);
		const out = composeAssuranceOutcome(s, plan, [...satisfiedOthers(s), escalating(s)]);
		// ⛔ THE WHOLE ROW, STRICTLY: the review is escalated, and its row keeps the plan's flag.
		expect(
			reviewOf(out),
			'the review is escalated, and its row keeps the plan’s flag'
		).toStrictEqual({
			policyId: REVIEW,
			required: false,
			resultClass: 'VALID',
			disposition: 'ESCALATED',
			independenceOk: true
		});
		expect(
			out.perPolicy.filter((p) => p.policyId !== REVIEW).map((p) => p.disposition),
			'the arrangement: nothing else blocks'
		).toEqual(['SATISFIED', 'SATISFIED']);
		// ⚠ THE DISCLOSED CONSEQUENCE: the aggregate's input keeps the plan's `required: false`, so the aggregate leaves
		// the escalated review out — SATISFIED — and the plan's gate opens. A pass that counted the escalated review as
		// required would shut it (`ER1-V102`); that would be a decision, and this assertion is where it is taken.
		expect(out.aggregate, 'the aggregate leaves the optional review out').toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});

	// ⛔ CONDITIONS (i)-(iii), AND THE LITERAL: the review's own arms. Each keeps the review as computed.
	it.each<{
		shape: string;
		review: (s: AssuranceSubject) => ValidatorResult;
		disposition: string;
		resultClass: string;
	}>([
		{
			// (iii): a failed criterion stays REJECTED — the ruling's own words: *"If a criterion failed, the outcome stays
			// REJECTED, which is more actionable, with the escalation recorded beside it."*
			shape: 'a NOT_MET criterion (a failed criterion)',
			review: (s) =>
				escalating(s, {
					criteria: [{ criterionId: 'RR-01', mandatory: true, outcome: 'NOT_MET' }],
					observations: [
						{
							code: 'RR-01',
							severity: 'BLOCKING',
							statement: 'the failure class is present',
							open: true
						}
					]
				}),
			disposition: 'REJECTED',
			resultClass: 'VALID'
		},
		{
			// (iii), and `REG-D-090`'s narrowing: an UNANSWERED criterion is invalid output (ASR-2), so the review stays
			// INCONCLUSIVE. Revision 1 escalated this arm; a failed row under a corrupted id would then have erased a real
			// failure (`REG-F-428`).
			shape: 'an UNABLE_TO_DETERMINE mandatory criterion (an unanswered criterion)',
			review: (s) =>
				escalating(s, {
					criteria: [
						{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' },
						{ criterionId: 'RR-02', mandatory: true, outcome: 'UNABLE_TO_DETERMINE' }
					]
				}),
			disposition: 'INCONCLUSIVE',
			resultClass: 'VALID'
		},
		{
			// (iii): keyed on SATISFIED, so a review the ladder conditions is not escalated either.
			shape: 'an open MATERIAL finding',
			review: (s) =>
				escalating(s, {
					observations: [
						{ code: 'RR-X', severity: 'MATERIAL', statement: 'a material finding', open: true }
					]
				}),
			disposition: 'CONDITIONALLY_SATISFIED',
			resultClass: 'VALID'
		},
		// (ii): every OTHER recommendation, over the same clean criteria, leaves the review SATISFIED.
		{
			shape: 'a SATISFIED recommendation',
			review: (s) => escalating(s, { dispositionRecommendation: 'SATISFIED' }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		{
			shape: 'a CONDITIONALLY_SATISFIED recommendation with every criterion MET',
			review: (s) => escalating(s, { dispositionRecommendation: 'CONDITIONALLY_SATISFIED' }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		{
			shape: 'a REJECTED recommendation with every criterion MET',
			review: (s) => escalating(s, { dispositionRecommendation: 'REJECTED' }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		{
			shape: 'an INCONCLUSIVE recommendation with every criterion MET',
			review: (s) => escalating(s, { dispositionRecommendation: 'INCONCLUSIVE' }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		{
			// (ii), THE LITERAL ONLY: a recommendation that is not exactly `ESCALATED` is not one. The type admits no other
			// spelling; an unvalidated reply could carry one, and the rule must not read it generously.
			shape: 'a lowercase "escalated"',
			review: (s) => escalating(s, { dispositionRecommendation: 'escalated' as Disposition }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		// (ii), THE LITERAL ONLY AGAINST PADDING TOO (the ER-1 re-verifier's finding [3]; `ER1-V100`). The lowercase row
		// pins case, and a reading that TRIMMED the value passed it: the word with a space before it, or after it, is not
		// the literal either. ⭑ One row per side, so a reading that trims only one end is caught as well.
		{
			shape: 'a padded " ESCALATED" (a leading space)',
			review: (s) => escalating(s, { dispositionRecommendation: ' ESCALATED' as Disposition }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		{
			shape: 'a padded "ESCALATED " (a trailing space)',
			review: (s) => escalating(s, { dispositionRecommendation: 'ESCALATED ' as Disposition }),
			disposition: 'SATISFIED',
			resultClass: 'VALID'
		},
		{
			// (i): the boundary arm. The same-model evaluator is an independence violation, and a boundary-rejected result's
			// recommendation is never read (ASR-11: *"Malformed or invalid validator output can never mutate authoritative
			// state"*).
			shape: 'the SAME model as the producer (an independence violation)',
			review: (s) => escalating(s, { evaluator: CODEX }),
			disposition: 'BOUNDARY_REJECTED',
			resultClass: 'BOUNDARY_REJECTED'
		},
		{
			// (i): a failed validator. A real one recommends `failedResult`'s placeholder (`validators.ts`); this one
			// recommends ESCALATED, to show that even then the recommendation of a failed result is never read.
			shape: 'a failed validator execution',
			review: (s) => escalating(s, { executionFailed: true }),
			disposition: 'VALIDATOR_FAILED',
			resultClass: 'VALIDATOR_FAILED'
		}
	])(
		'CONTROL — a review recommending ESCALATED with $shape keeps its computed disposition ($disposition)',
		({ review, disposition, resultClass }) => {
			const s = subject();
			const out = compose(s, [...satisfiedOthers(s), review(s)]);
			expect(reviewOf(out).disposition).toBe(disposition);
			expect(reviewOf(out).resultClass).toBe(resultClass);
			expect(
				out.perPolicy.filter((p) => p.policyId !== REVIEW).map((p) => p.disposition),
				'the arrangement: nothing else blocks'
			).toEqual(['SATISFIED', 'SATISFIED']);
		}
	);

	// ⛔ CONDITION (iii)'S OBSERVATION LIMB, DRIVEN ALONE (the ER-1 verifier's finding [1]; `ER1-V5`). `REG-D-090` reads
	// "no criterion failed" as a computed SATISFIED — every mandatory criterion MET or NOT_APPLICABLE, AND no open failure
	// observation. The NOT_MET row above carries a failed criterion AND a BLOCKING observation, so it cannot tell the two
	// limbs apart, and the narrower reading — escalate a REJECTED review none of whose criteria failed — passed it. Here
	// every criterion is MET and one open BLOCKING or CRITICAL observation alone rejects the review, which stays REJECTED:
	// the ruling's "more actionable" outcome. ⭑ The CRITICAL row is not the BLOCKING row twice: the Assurance Policy
	// Catalog's §10.3 default precedence reads *"CRITICAL open finding → REJECTED or ESCALATED"* (quoted in `REG-F-473`),
	// so a CRITICAL rejection is the one a later edit would most plausibly escalate (`ER1-M101`). ⚠ A LIVE REPLY CAN
	// PRODUCE THE BLOCKING ROW'S ARRANGEMENT (the ER-1 re-verifier's finding [1]; corrected in the second fix round —
	// this ⚠ said no live reviewer could). One declared criterion listed twice, faulted and then clean, is recorded MET:
	// `reasoningReviewResultFromJudgement` keeps the LAST row per id (`validators.ts:294`, `:300`). And it stands beside
	// an open BLOCKING observation, because the mapper observes EVERY failed row (`:347-348`). The re-verifier drove it
	// through the real validator, with only the subprocess faked: VALID, REJECTED, the recommendation recorded. So this
	// row guards a live path, and the review fails closed on it; that the record then shows a criterion MET beside its
	// own open fault is a finding of its own (`REG-F-479`), not this rule's. The CRITICAL row has no
	// live path today: every seeded criterion declares BLOCKING (`floor-policies.ts`), and the mapper observes a
	// declared criterion at its declared severity.
	it.each<{ severity: 'BLOCKING' | 'CRITICAL' }>([
		{ severity: 'BLOCKING' },
		{ severity: 'CRITICAL' }
	])(
		'CONTROL — every criterion MET and one open $severity observation: the review recommending ESCALATED stays REJECTED',
		({ severity }) => {
			const s = subject();
			const review = escalating(s, {
				observations: [
					{
						code: 'RR-OPEN',
						severity,
						statement: `an open ${severity} observation, under no failed criterion`,
						open: true
					}
				]
			});
			expect(
				review.criteria.map((c) => c.outcome),
				'the arrangement: no criterion failed'
			).toEqual(['MET']);
			const out = compose(s, [...satisfiedOthers(s), review]);
			expect(
				reviewOf(out).disposition,
				'the observation alone rejects the review, and it stays REJECTED'
			).toBe('REJECTED');
			expect(reviewOf(out).resultClass).toBe('VALID');
			expect(
				out.perPolicy.filter((p) => p.policyId !== REVIEW).map((p) => p.disposition),
				'the arrangement: nothing else blocks'
			).toEqual(['SATISFIED', 'SATISFIED']);
			expect(out.aggregate).toBe('REJECTED');
			expect(out.gatePermitsTransition).toBe(false);
		}
	);

	// ⛔ THE RULE IS SCOPED TO `floor.reasoning-review`. A deterministic policy recommends what its own ladder computed
	// (`buildResult`), so ESCALATED never comes from one — but a result is data, and a rule that read every policy's
	// recommendation would let one hand-built result shut the gate on a floor that is SATISFIED everywhere.
	// ⭑ ONE ROW PER DETERMINISTIC POLICY (the ER-1 verifier's finding [0]; `ER1-V1`). With the schema row alone, a scope
	// rewritten as "not the schema policy" passed, and a hand-built identity-provenance result then shut this floor.
	// `recording.test.ts` holds the same two rows for D2: neither records anything.
	it.each<{ policy: string; results: (s: AssuranceSubject) => ValidatorResult[] }>([
		{
			policy: 'schema-invariant',
			results: (s) => [
				{ ...schemaInvariantValidator(s, goodSchema), dispositionRecommendation: 'ESCALATED' },
				identityProvenanceValidator(s, goodIdentity),
				rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
			]
		},
		{
			policy: 'identity-provenance',
			results: (s) => [
				schemaInvariantValidator(s, goodSchema),
				{ ...identityProvenanceValidator(s, goodIdentity), dispositionRecommendation: 'ESCALATED' },
				rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
			]
		}
	])(
		'CONTROL — the deterministic policies never escalate: a hand-built $policy result recommending ESCALATED stays SATISFIED (design §4.2)',
		({ policy, results }) => {
			const s = subject();
			const built = results(s);
			expect(
				built.filter((r) => r.dispositionRecommendation === 'ESCALATED').map((r) => r.policyId),
				'the arrangement: that deterministic result, and no other, recommends ESCALATED'
			).toEqual([`floor.${policy}`]);
			const out = compose(s, built);
			expect(out.perPolicy.map((p) => `${p.policyId}=${p.disposition}`)).toEqual([
				'floor.schema-invariant=SATISFIED',
				'floor.identity-provenance=SATISFIED',
				'floor.reasoning-review=SATISFIED'
			]);
			expect(out.aggregate).toBe('SATISFIED');
			expect(out.gatePermitsTransition).toBe(true);
			expect(out.observations, 'nothing is added to the composition’s observations').toEqual([]);
		}
	);
});

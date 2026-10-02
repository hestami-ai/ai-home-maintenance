import { describe, expect, it } from 'vitest';
import type { Disposition, Identity } from './assurance-rules.js';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	identityProvenanceValidator,
	schemaInvariantValidator,
	type AssuranceSubject,
	type FloorCriterion,
	type FloorObservation,
	type ValidatorResult
} from './floor.js';
import {
	assuranceRecordingPlan,
	REVIEWER_RECOMMENDED_ESCALATION,
	type AssuranceRecordingPlan
} from './recording.js';

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
		semanticVersion: 3,
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

function planFor(s: AssuranceSubject, results: ValidatorResult[]) {
	return assuranceRecordingPlan(s, deMinimisFloorPlan(s), results);
}

describe('assuranceRecordingPlan — floor run → canonical per-policy recording plan (§8.9)', () => {
	it('all floor policies SATISFIED (independent reviewer) → one assessment per policy, all SATISFIED, gate open', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(plan.subjectId).toBe('pwa_1');
		expect(plan.subjectSemanticVersion).toBe(3);
		expect(plan.aggregate).toBe('SATISFIED');
		expect(plan.gatePermitsTransition).toBe(true);
		expect(plan.assessments.map((a) => a.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
			FLOOR_POLICY_IDS.REASONING_REVIEW
		]);
		expect(plan.assessments.every((a) => a.disposition === 'SATISFIED')).toBe(true);
		expect(plan.assessments.every((a) => a.observations.length === 0)).toBe(true);
		expect(plan.assessments.every((a) => a.independenceOk)).toBe(true);
	});

	it('a schema failure records a REJECTED schema assessment carrying the specific finding code + severity', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, { schemaValid: false, invariantViolations: ['INV-DUP-ROOT'] }),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(plan.aggregate).toBe('REJECTED');
		expect(plan.gatePermitsTransition).toBe(false);
		const schema = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.SCHEMA_INVARIANT)!;
		expect(schema.disposition).toBe('REJECTED');
		expect(schema.observations.map((o) => o.code)).toEqual(['SCHEMA_INVALID', 'INV-DUP-ROOT']);
		expect(schema.observations[0]?.severity).toBe('CRITICAL');
		expect(schema.observations[1]?.severity).toBe('BLOCKING');
	});

	it('a MISSING required Reasoning Review records NO assessment for it (nothing ran) and the gate blocks', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity)
			// Reasoning Review deliberately absent
		]);
		expect(plan.assessments.map((a) => a.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
		expect(plan.aggregate).toBe('UNASSESSED');
		expect(plan.gatePermitsTransition).toBe(false);
	});

	it('a same-model Reasoning Review is boundary-rejected → recorded as INCONCLUSIVE with independenceOk false', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: CODEX, criteria: MET, recommendation: 'SATISFIED' }) // same model as producer
		]);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(review.disposition).toBe('INCONCLUSIVE');
		expect(review.independenceOk).toBe(false);
		expect(plan.gatePermitsTransition).toBe(false);
		// The violation must be a DURABLE OBSERVATION, not only the transient independenceOk flag: the recorder
		// persists observations, never the flag, so without this the violation vanishes at persistence and the
		// read-back fabricates independenceOk:true (§8.12 "record an independence violation"; finding 46 — an
		// Assessment can otherwise never reach a durable INDEPENDENCE_VIOLATION).
		expect(review.observations.map((o) => o.code)).toContain('INDEPENDENCE_VIOLATION');
		expect(review.observations.find((o) => o.code === 'INDEPENDENCE_VIOLATION')?.severity).toBe(
			'BLOCKING'
		);
	});

	it('a non-AI subject records only the two deterministic policies', () => {
		const s = subject({ isAiProduced: false });
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity)
		]);
		expect(plan.assessments.map((a) => a.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
		expect(plan.aggregate).toBe('SATISFIED');
	});
});

// ── ⭐⭐ `JAN-ESCREC` D2 — THE REVIEWER'S ESCALATED RECOMMENDATION IS RECORDED, WHATEVER THE OUTCOME ─────────────────────
//
// `REG-D-089`: *"the fix will store the reviewer's ESCALATED as its recommendation in every case"*. ASR-1 separates the
// validator's recommendation from the authoritative disposition, and the Contract Package's §38 lists both, *"For every
// validator call"*. `REG-D-090` records it as ONE observation, appended after composition to a VALID Reasoning Review
// result that recommends the literal ESCALATED: whatever its outcome, and nowhere else.
//
// ⛔ THE EXPECTED OBSERVATION IS WRITTEN OUT HERE, NOT IMPORTED. The statement is restated byte for byte from
// `REG-D-090`, and the code is pinned to its literal value once below: a test that compared the recorder's constant with
// itself would pass any edit of it, and the code is what an event reader discriminates on (the event carries no type).
const ESCALATION_STATEMENT =
	"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";
const ESCALATION_RECORD = {
	code: 'REVIEWER_RECOMMENDED_ESCALATION',
	observationType: 'RECOMMENDATION',
	severity: 'INFORMATIONAL',
	statement: ESCALATION_STATEMENT
};

describe('⭐⭐ JAN-ESCREC D2 — a VALID review recommending ESCALATED records the recommendation, in every arm and no other (REG-D-089, REG-D-090)', () => {
	const REVIEW = FLOOR_POLICY_IDS.REASONING_REVIEW;
	const reviewIn = (plan: AssuranceRecordingPlan) =>
		plan.assessments.find((a) => a.policyId === REVIEW);
	const everyObservation = (plan: AssuranceRecordingPlan) =>
		plan.assessments.flatMap((a) => a.observations);
	/** An open ADVISORY note no rung of the ladder reads: the clean review stays SATISFIED, so the ESCALATED arm has an
	 *  observation of its OWN for the recommendation to come AFTER. */
	const NOTE: FloorObservation = {
		code: 'RR-NOTE',
		severity: 'ADVISORY',
		statement: 'an advisory note',
		open: true
	};
	const FAULT: FloorObservation = {
		code: 'RR-01',
		severity: 'BLOCKING',
		statement: 'the failure class is present',
		open: true
	};
	const MATERIAL: FloorObservation = {
		code: 'RR-X',
		severity: 'MATERIAL',
		statement: 'a material finding',
		open: true
	};
	const escalating = (
		s: AssuranceSubject,
		over: Partial<ValidatorResult> = {}
	): ValidatorResult => ({
		...rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'ESCALATED' }),
		...over
	});
	const satisfiedOthers = (s: AssuranceSubject): ValidatorResult[] => [
		schemaInvariantValidator(s, goodSchema),
		identityProvenanceValidator(s, goodIdentity)
	];
	/** What `assuranceRecordingPlan` makes of a result's OWN observations: transcribed, and untyped. */
	const transcribed = (obs: readonly FloorObservation[]) =>
		obs.map((o) => ({ code: o.code, severity: o.severity, statement: o.statement }));
	/**
	 * ⭑ THE NO ARMS ADDED FOR THE ER-1 VERIFIER'S FINDINGS [0], [2], [3] — and, in the second fix round, the padded
	 * spellings for the re-verifier's finding [3] — named once, so the arrangement control at the end of this block drives
	 * the very results the NO arms do.
	 */
	const NOT_THE_LITERAL = ['escalated', 'Escalated', ' ESCALATED', 'ESCALATED '] as const;
	const BOUNDARY_ARMS = [
		{
			shape: 'a policy-version mismatch',
			over: { policyVersion: '2' },
			reason: 'RPH_POLICY_VERSION_MISMATCH'
		},
		{
			shape: 'a subject-version mismatch',
			over: { subjectSemanticVersion: 4 },
			reason: 'RPH_SUBJECT_VERSION_MISMATCH'
		},
		{ shape: 'no criteria at all', over: { criteria: [] }, reason: 'required criteria missing' }
	] as const;
	/** A hand-built identity-provenance result recommending ESCALATED, beside a clean floor and a SATISFIED review. */
	const identityEscalating = (s: AssuranceSubject): ValidatorResult[] => [
		schemaInvariantValidator(s, goodSchema),
		{ ...identityProvenanceValidator(s, goodIdentity), dispositionRecommendation: 'ESCALATED' },
		rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
	];

	it('pins the code to its literal value — it is the discriminator on the event, which carries no observation type', () => {
		expect(REVIEWER_RECOMMENDED_ESCALATION).toBe('REVIEWER_RECOMMENDED_ESCALATION');
	});

	// ⭐ EVERY VALID ESCALATED ARM: the recommendation is the LAST observation, exactly once, after the result's own —
	// which stay untyped, so a fault is never re-labelled a recommendation.
	it.each<{
		shape: string;
		results: (s: AssuranceSubject) => ValidatorResult[];
		own: readonly FloorObservation[];
		disposition: string;
	}>([
		{
			// The rule (a) arm (D1): clean, fully answered, nothing else blocks.
			shape: 'ESCALATED (clean, and nothing else blocks)',
			results: (s) => [...satisfiedOthers(s), escalating(s, { observations: [NOTE] })],
			own: [NOTE],
			disposition: 'ESCALATED'
		},
		{
			// *"If a criterion failed, the outcome stays REJECTED, which is more actionable, with the escalation recorded
			// beside it."* — the ruling's own words.
			shape: 'REJECTED (a failed criterion)',
			results: (s) => [
				...satisfiedOthers(s),
				escalating(s, {
					criteria: [{ criterionId: 'RR-01', mandatory: true, outcome: 'NOT_MET' }],
					observations: [FAULT]
				})
			],
			own: [FAULT],
			disposition: 'REJECTED'
		},
		{
			shape: 'INCONCLUSIVE (an unanswered criterion)',
			results: (s) => [
				...satisfiedOthers(s),
				escalating(s, {
					criteria: [
						{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' },
						{ criterionId: 'RR-02', mandatory: true, outcome: 'UNABLE_TO_DETERMINE' }
					]
				})
			],
			own: [],
			disposition: 'INCONCLUSIVE'
		},
		{
			shape: 'CONDITIONALLY_SATISFIED (an open MATERIAL finding)',
			results: (s) => [...satisfiedOthers(s), escalating(s, { observations: [MATERIAL] })],
			own: [MATERIAL],
			disposition: 'CONDITIONALLY_SATISFIED'
		},
		{
			// D1's condition (iv): another policy blocks, so the review keeps its SATISFIED — and the recommendation is
			// recorded beside it all the same.
			shape: 'SATISFIED kept beside a REJECTED schema-invariant policy',
			results: (s) => [
				schemaInvariantValidator(s, { schemaValid: false, invariantViolations: [] }),
				identityProvenanceValidator(s, goodIdentity),
				escalating(s)
			],
			own: [],
			disposition: 'SATISFIED'
		}
	])(
		'records it in the $shape arm, last and once, with the result’s own observations untyped',
		({ results, own, disposition }) => {
			const s = subject();
			const plan = planFor(s, results(s));
			const review = reviewIn(plan)!;
			expect(review.disposition, 'the recordable disposition').toBe(disposition);
			expect(
				review.observations.at(-1),
				'the recommendation is the LAST observation'
			).toStrictEqual(ESCALATION_RECORD);
			expect(
				review.observations.filter((o) => o.code === REVIEWER_RECOMMENDED_ESCALATION),
				'and it is recorded exactly ONCE'
			).toHaveLength(1);
			// ⛔ THE RESULT'S OWN OBSERVATIONS COME FIRST, BYTE FOR BYTE AND UNTYPED — the recorder defaults their type by
			// policy (FINDING for the review). Typing a failed criterion RECOMMENDATION would file a fault as advice.
			expect(
				review.observations.slice(0, -1),
				'the result’s own observations, transcribed and untyped'
			).toStrictEqual(transcribed(own));
			expect(
				plan.assessments
					.filter((a) => a.policyId !== REVIEW)
					.flatMap((a) => a.observations)
					.filter((o) => 'observationType' in o),
				'no other policy’s observation is typed'
			).toEqual([]);
		}
	);

	it('the ESCALATED arm’s recordable disposition is ESCALATED — completed as such, with the aggregate INCONCLUSIVE and the gate shut', () => {
		const s = subject();
		const plan = planFor(s, [...satisfiedOthers(s), escalating(s)]);
		expect(plan.assessments.map((a) => `${a.policyId}=${a.disposition}`)).toEqual([
			'floor.schema-invariant=SATISFIED',
			'floor.identity-provenance=SATISFIED',
			'floor.reasoning-review=ESCALATED'
		]);
		expect(plan.aggregate).toBe('INCONCLUSIVE');
		expect(plan.gatePermitsTransition).toBe(false);
	});

	// ⭐ NOR IS THE PLAN'S `required` FLAG READ (the ER-1 re-verifier's finding [4]; `ER1-V106`; decided in the second fix
	// round). `REG-D-089` records the recommendation *"in every case"*, and that includes a review the PLAN marks
	// non-required: D1 escalates it all the same (`floor.test.ts`), and the record says what its reviewer recommended — the
	// last observation, once. ⚠ The plan's aggregate leaves an optional review out (SATISFIED, its gate open), while the
	// engine's floor gate, which requires the review whatever the plan marks, refuses the recorded ESCALATED one: the
	// split `floor.ts` discloses under condition (iv). ⭑ A CONTROL OF THE SECOND FIX ROUND: it passed on the code it was
	// written against and reddens under `ER1-V106`; at HEAD, which recorded no recommendation, it would be red.
	it('records it where the PLAN marks the review itself OPTIONAL: completed ESCALATED, the recommendation last and once, the aggregate leaving the review out', () => {
		const s = subject();
		const optionalReview = deMinimisFloorPlan(s).map((p) =>
			p.policyId === REVIEW ? { ...p, required: false } : p
		);
		expect(
			optionalReview.filter((p) => !p.required).map((p) => p.policyId),
			'the arrangement: the review, and nothing else, is optional'
		).toEqual([REVIEW]);
		const plan = assuranceRecordingPlan(s, optionalReview, [
			...satisfiedOthers(s),
			escalating(s, { observations: [NOTE] })
		]);
		const review = reviewIn(plan)!;
		expect(review.disposition, 'the recordable disposition').toBe('ESCALATED');
		expect(
			review.observations,
			'the result’s own note, transcribed and untyped, then the recommendation, once'
		).toStrictEqual([...transcribed([NOTE]), ESCALATION_RECORD]);
		expect(plan.aggregate, 'the aggregate leaves the optional review out').toBe('SATISFIED');
		expect(plan.gatePermitsTransition).toBe(true);
	});

	it('⛔ the recommendation is appended AFTER composition: `composeAssuranceOutcome(...).observations` never holds it', () => {
		// It is never placed in the ladder's input, and what reads the composed observations (the app's subject
		// findings among them) must never see it as one. Pinned over the escalated arm AND the failed one.
		const s = subject();
		for (const results of [
			[...satisfiedOthers(s), escalating(s, { observations: [NOTE] })],
			[
				...satisfiedOthers(s),
				escalating(s, {
					criteria: [{ criterionId: 'RR-01', mandatory: true, outcome: 'NOT_MET' }],
					observations: [FAULT]
				})
			]
		]) {
			const composed = composeAssuranceOutcome(s, deMinimisFloorPlan(s), results);
			expect(
				composed.observations,
				'the composition carries exactly the inputs’ observations'
			).toEqual(results.flatMap((r) => r.observations));
			expect(composed.observations.map((o) => o.code)).not.toContain(
				REVIEWER_RECOMMENDED_ESCALATION
			);
			// …and the recording plan over the same results DOES carry it: the two differ by that one observation.
			expect(everyObservation(planFor(s, results)).map((o) => o.code)).toContain(
				'REVIEWER_RECOMMENDED_ESCALATION'
			);
		}
	});

	// ⛔ NO OTHER ARM. Each is a way a recommendation is NOT a VALID Reasoning Review's literal ESCALATED.
	it.each<{ shape: string; results: (s: AssuranceSubject) => ValidatorResult[] }>([
		...(['SATISFIED', 'CONDITIONALLY_SATISFIED', 'REJECTED', 'INCONCLUSIVE'] as const).map((d) => ({
			shape: `a VALID review recommending ${d}`,
			results: (s: AssuranceSubject) => [
				...satisfiedOthers(s),
				escalating(s, { dispositionRecommendation: d })
			]
		})),
		// ⛔ THE LITERAL ONLY (the ER-1 verifier's finding [2]; `ER1-V3`). D2 records exactly what D1 reads, and D1 reads the
		// literal: another spelling leaves the review SATISFIED there (`floor.test.ts`, `ER1-M8`), so it must record nothing
		// here — or the record would pair a reviewer's ESCALATED with an outcome rule (a) never applied. ⭑ AGAINST PADDING
		// TOO (the ER-1 re-verifier's finding [3]; `ER1-V101`): the two case spellings passed a reading that TRIMMED the
		// value, so the word with a space before it, and after it, is a NO arm as well.
		...NOT_THE_LITERAL.map((spelling) => ({
			shape: `a VALID review recommending "${spelling}", not the literal`,
			results: (s: AssuranceSubject) => [
				...satisfiedOthers(s),
				escalating(s, { dispositionRecommendation: spelling as Disposition })
			]
		})),
		// ⛔ VALID ONLY, WHATEVER THE BOUNDARY'S REASON (the ER-1 verifier's finding [3]; `ER1-V6`; ASR-11). The same-model
		// arm below is ALSO an independence failure, which hid whether the class test is there at all: these keep
		// independence satisfied, so only the result's class keeps each out.
		...BOUNDARY_ARMS.map(({ shape, over }) => ({
			shape: `a BOUNDARY_REJECTED review (${shape}) recommending ESCALATED`,
			results: (s: AssuranceSubject) => [...satisfiedOthers(s), escalating(s, over)]
		})),
		{
			// ASR-11: a boundary-rejected result's recommendation is never read. It carries its INDEPENDENCE_VIOLATION.
			shape: 'a BOUNDARY_REJECTED review (the same model as the producer) recommending ESCALATED',
			results: (s) => [...satisfiedOthers(s), escalating(s, { evaluator: CODEX })]
		},
		{
			shape: 'a VALIDATOR_FAILED review recommending ESCALATED',
			results: (s) => [...satisfiedOthers(s), escalating(s, { executionFailed: true })]
		},
		{
			// The deterministic policies never recommend ESCALATED; a hand-built one is not the reviewer's recommendation.
			shape: 'a schema-invariant result recommending ESCALATED',
			results: (s) => [
				{ ...schemaInvariantValidator(s, goodSchema), dispositionRecommendation: 'ESCALATED' },
				identityProvenanceValidator(s, goodIdentity),
				rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
			]
		},
		{
			// ⭑ AND THE OTHER DETERMINISTIC POLICY (the ER-1 verifier's finding [0]; `ER1-V2`): with the schema row alone, a
			// scope rewritten as "not the schema policy" recorded the reviewer's recommendation under identity-provenance.
			shape: 'an identity-provenance result recommending ESCALATED',
			results: identityEscalating
		},
		{
			shape: 'a MISSING review',
			results: (s) => satisfiedOthers(s)
		}
	])('records NOTHING for $shape', ({ results }) => {
		const s = subject();
		const plan = planFor(s, results(s));
		expect(
			everyObservation(plan).map((o) => o.code),
			'no recommendation is recorded'
		).not.toContain('REVIEWER_RECOMMENDED_ESCALATION');
		expect(
			everyObservation(plan).filter((o) => 'observationType' in o),
			'and nothing is typed'
		).toEqual([]);
	});

	it('CONTROL — the arrangements of the NO arms are what they say: VALID, boundary-rejected, failed, missing', () => {
		// Without this, a "records nothing" row could pass because its review was never VALID to begin with.
		const s = subject();
		const classOf = (results: ValidatorResult[]) =>
			composeAssuranceOutcome(s, deMinimisFloorPlan(s), results).perPolicy.find(
				(p) => p.policyId === REVIEW
			)?.resultClass;
		expect(
			classOf([...satisfiedOthers(s), escalating(s, { dispositionRecommendation: 'SATISFIED' })])
		).toBe('VALID');
		expect(classOf([...satisfiedOthers(s), escalating(s, { evaluator: CODEX })])).toBe(
			'BOUNDARY_REJECTED'
		);
		expect(classOf([...satisfiedOthers(s), escalating(s, { executionFailed: true })])).toBe(
			'VALIDATOR_FAILED'
		);
		expect(classOf(satisfiedOthers(s))).toBe('MISSING');
	});

	it('CONTROL — the arrangements of the NO arms added for the ER-1 verifier’s and re-verifier’s findings: VALID spellings, boundary reasons with independence kept, a VALID identity result', () => {
		// Without this, each added row could record nothing for a reason other than the one it names: a spelling row whose
		// review was not VALID, a boundary row that ALSO failed independence (the exclusion `ER1-V6` keeps), an identity row
		// whose result did not recommend ESCALATED.
		const s = subject();
		const rowOf = (results: ValidatorResult[], policyId: string) =>
			composeAssuranceOutcome(s, deMinimisFloorPlan(s), results).perPolicy.find(
				(p) => p.policyId === policyId
			)!;
		for (const spelling of NOT_THE_LITERAL) {
			const row = rowOf(
				[
					...satisfiedOthers(s),
					escalating(s, { dispositionRecommendation: spelling as Disposition })
				],
				REVIEW
			);
			expect([row.resultClass, row.disposition], spelling).toEqual(['VALID', 'SATISFIED']);
		}
		for (const { over, reason } of BOUNDARY_ARMS) {
			const row = rowOf([...satisfiedOthers(s), escalating(s, over)], REVIEW);
			expect([row.resultClass, row.boundaryReason, row.independenceOk], reason).toEqual([
				'BOUNDARY_REJECTED',
				reason,
				true
			]);
		}
		const identity = identityEscalating(s);
		expect(
			identity.filter((r) => r.dispositionRecommendation === 'ESCALATED').map((r) => r.policyId),
			'the identity-provenance result, and no other, recommends ESCALATED'
		).toEqual([FLOOR_POLICY_IDS.IDENTITY_PROVENANCE]);
		const identityRow = rowOf(identity, FLOOR_POLICY_IDS.IDENTITY_PROVENANCE);
		expect([identityRow.resultClass, identityRow.disposition]).toEqual(['VALID', 'SATISFIED']);
	});
});

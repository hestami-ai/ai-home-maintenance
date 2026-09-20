// Proves the Assurance-Service recording arm end to end: run the de minimis floor over a subject, then persist the
// result as canonical ASSURANCE_ASSESSMENT + ASSURANCE_OBSERVATION objects via live commands — one assessment per
// floor policy, completed to the floor-computed disposition, observations carrying the Validator's finding code.
import {
	SEEDED_REASONING_REVIEW_CRITERIA,
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	identityProvenanceValidatorInstance,
	reasoningReviewResultFromJudgement,
	runFloorAndPlanRecording,
	schemaInvariantValidatorInstance,
	type AssuranceSubject,
	type Identity,
	type Validator,
	type ValidatorContext,
	type ValidatorRegistry
} from '@janumipwb/rph-assurance';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import type { ActorReference } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { createEngine, listByType, recordAssuranceRecordingPlan } from './index.js';
import { seedFloorPolicies } from './seed-workbench.js';

const PRODUCER: Identity = {
	actorType: 'AGENT',
	agentId: 'executor',
	modelId: 'gpt-5.4',
	providerId: 'openai'
};
const JUDGE: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};
const ACTOR: ActorReference = {
	actorId: 'assurance-svc',
	actorType: 'SERVICE',
	displayName: 'Assurance Service'
};

// ONE ACTOR, AND IT MUST BE THE ASSURANCE SERVICE — not the shared human credential.
//
// ⚠ WHY THIS COMMENT CHANGED, WHICH MATTERS MORE THAN WHAT IT NOW SAYS. It used to justify the choice by a
// REFUSAL: the recorder DECLARED `issuedBy: opts.actor`, so a session that disagreed aborted the run. That
// declaration is gone (REG-F-062) and the refusal with it — meaning the justification evaporated while the
// fixture stayed identical. A knob whose stated reason has quietly expired is dead in every way that counts,
// so it gets a live one or it gets removed.
//
// THE LIVE REASON: the recorder now takes its issuer FROM the session, so `ACTOR` is what lands in every
// recorded assessment's `createdBy` — and the test below ASSERTS that. Point this directory at a human and
// that assertion reddens. `seedFloorPolicies` declares no issuer either and runs as whoever holds the session;
// the assurance service standing up the policies it goes on to cite is the honest reading of who acts here.
// (Same shape as `floor-execution-plane.test.ts`, deliberately — two fixtures over the same seam.)
const DIR = testDirectory([{ ...ACTOR, tenantId: 'tenant-test', organizationId: 'org-test' }]);

/** Deterministic ULID-format id minter (`<prefix>_<26 digits>`) — digits are valid Crockford base32. */
function ulidGen() {
	let n = 0;
	return (prefix: string) => `${prefix}_${String(++n).padStart(26, '0')}`;
}

/**
 * ⭐⭐ `JAN-ORPHANED` `OR-02` — WHAT A REVIEWER THAT EVALUATED EVERYTHING AND FAULTED NOTHING ACTUALLY
 * RETURNS: one `failed: false` row per criterion.
 *
 * ⛔ THIS FIXTURE USED TO BE `findings: []`, AND THAT MEANT THE OPPOSITE OF WHAT IT MEANS NOW. It was
 * authored 2026-07-14 under the contract where an unmentioned criterion read as `MET` — so an empty list
 * said *“evaluated everything, found nothing”*. `R26` (2026-09-20) ruled that absence means the reviewer
 * did not judge it, and re-meant every such literal without touching one: the `R26` commit changed seven
 * files and no fixture among them.
 *
 * ⭑ THE INTENT WAS ALWAYS THIS — IT IS WRITTEN IN THE FIXTURE'S OWN DOCSTRING (*“all 9 criteria MET”*).
 * What changed is only that a clean verdict must now be SAID rather than inferred from silence, which is
 * exactly what a live reviewer does: `REG-F-412` measured nine rows in five of five reviews.
 *
 * ⚠ DERIVED, NEVER HAND-LISTED. Nine written-out ids would stop covering a tenth criterion silently — the
 * hand-listing defect one level up. (The criterion list itself is pinned by id AND count in
 * `pwa-export.test.ts`, so this cannot mask a new one.)
 */
const allClean = () =>
	SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	}));

/** An independent Reasoning-Review Validator reporting every criterion evaluated and clean. */
const rrSatisfied: Validator = {
	policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
	validatorId: 'test.reasoning-review',
	evaluate: (subject) =>
		Promise.resolve(
			reasoningReviewResultFromJudgement(
				subject,
				JUDGE,
				'test.reasoning-review',
				{
					findings: allClean(),
					recommendation: 'SATISFIED'
				},
				SEEDED_REASONING_REVIEW_CRITERIA
			)
		)
};

function registry(): ValidatorRegistry {
	const r = createValidatorRegistry();
	r.register(schemaInvariantValidatorInstance);
	r.register(identityProvenanceValidatorInstance);
	r.register(rrSatisfied);
	return r;
}

function engine() {
	let s = 0;
	return createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-07-14T00:00:00Z',
		newEventId: () => `e${++s}`
	}).as(DIR.credentialFor(ACTOR.actorId));
}

const subject: AssuranceSubject = {
	subjectId: 'pwa_under_test',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 2,
	isAiProduced: true,
	producer: PRODUCER
};
const goodCtx: ValidatorContext = {
	schemaInvariant: { schemaValid: true, invariantViolations: [] },
	identityProvenance: {
		hasStableId: true,
		hasSemanticVersion: true,
		hasProvenance: true,
		hasProducer: true,
		traceComplete: true
	}
};

async function runAndRecord(ctx: ValidatorContext) {
	const eng = engine();
	seedFloorPolicies(eng); // the recorder cites floor.* policies — RequestAssuranceAssessment now requires them to exist
	const plan = await runFloorAndPlanRecording(subject, ctx, registry());
	const recorded = recordAssuranceRecordingPlan(eng, plan, {
		issuedAt: '2026-07-14T00:00:00Z',
		correlationId: 'floor-run',
		idPrefix: 'rec1',
		newId: ulidGen()
	});
	return { eng, plan, recorded };
}

describe('recordAssuranceRecordingPlan — floor outcome → canonical assessments/observations', () => {
	it('a fully-satisfied floor records one SATISFIED assessment per policy, no open observations', async () => {
		const { eng, plan } = await runAndRecord(goodCtx);
		expect(plan.gatePermitsTransition).toBe(true);

		const assessments = listByType(eng, 'ASSURANCE_ASSESSMENT');
		expect(assessments).toHaveLength(3);
		expect(assessments.every((a) => a.state.assessmentState === 'SATISFIED')).toBe(true);
		expect(assessments.map((a) => a.state.assurancePolicyId).sort()).toEqual([
			'floor.identity-provenance',
			'floor.reasoning-review',
			'floor.schema-invariant'
		]);
		expect(
			assessments.every((a) => (a.state.subjectObjectIds as string[])[0] === 'pwa_under_test')
		).toBe(true);
		expect(listByType(eng, 'ASSURANCE_OBSERVATION')).toHaveLength(0);
	});

	it('attributes every recorded assessment to the AUTHENTICATED session, not to a declared actor (REG-F-062)', async () => {
		const { eng } = await runAndRecord(goodCtx);
		const assessments = listByType(eng, 'ASSURANCE_ASSESSMENT');
		expect(assessments.length).toBeGreaterThan(0);
		// The recorder declares no issuer. What lands in `createdBy` is the principal the session resolved to —
		// which is why this fixture's directory holds the assurance service and nobody else. Restore
		// `issuedBy: opts.actor` in the recorder and this still passes (the values agree); point the SESSION at a
		// different actor and it reddens. That is the right sensitivity: the claim is about where the identity
		// COMES FROM, and only the session can change it now.
		for (const a of assessments) {
			const createdBy = a.state.createdBy as ActorReference;
			expect(createdBy.actorId, `assessment ${a.id} must be attributed to its session`).toBe(
				'assurance-svc'
			);
			expect(createdBy.actorType).toBe('SERVICE');
		}
	});

	it('persists the reasoning-review evaluator identity on the Assessment (§9.7 resolved model/provider; §8.4 recorded identities)', async () => {
		const { eng } = await runAndRecord(goodCtx);
		const review = listByType(eng, 'ASSURANCE_ASSESSMENT').find(
			(a) => a.state.assurancePolicyId === 'floor.reasoning-review'
		)!;
		// §9.7 requires "the resolved provider/model/version actually invoked" be recorded; §8.4 L851 requires the
		// evaluator's "actual identities and lineage are recorded". The AssuranceAssessment object has carried an
		// optional `evaluator: ActorReference` all along — the recorder simply dropped it, sending only the
		// disposition. The judge that actually reviewed the artifact was recorded nowhere.
		const evaluator = review.state.evaluator as ActorReference | undefined;
		expect(
			evaluator,
			'the judge identity must be recorded, not dropped at persistence'
		).toBeDefined();
		expect(evaluator?.modelId).toBe('gemini');
		expect(evaluator?.providerId).toBe('google');
		expect(evaluator?.actorId).toBe('judge');
	});

	it('⭐⭐ every criterion the floor COMPUTES is now RECORDED, and the expectation is DERIVED from the plan', async () => {
		// ⛔ THIS IS THE ASSERTION `JAN-CRITREAD` L3 EXISTS FOR. Until `CB-03` the floor computed every
		// criterion's outcome and dropped all of them at this boundary — `claimResults: []` — because §20's
		// only route is claim-keyed and a floor assessment carries `claimIds: []`. §32's
		// `recordCriterionResult` is the claim-less route, and it had never been built.
		//
		// ⭑ THE EXPECTATION IS DERIVED, NEVER HAND-LISTED. A literal list would encode today's floor rubric
		// and then defend it: this repository's own record is that hand-listing IS the defect one level up.
		// Adding a criterion to any floor policy must move this test by construction, not by edit.
		const { eng, plan } = await runAndRecord(goodCtx);
		const expected = plan.assessments
			.flatMap((a) => a.criteria.map((c) => `${c.criterionId}=${c.outcome}`))
			.sort();

		// ⛔ THE CONTROL ON THE CONTROL: if the floor computed NO criteria, every assertion below would pass
		// against two empty lists — the shape that makes a green test mean nothing.
		expect(expected.length, 'the floor computed no criteria at all, so this proves nothing').toBeGreaterThan(
			0
		);

		const recorded = eng
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceCriterionEvaluated')
			.map((e) => e.payload as { criterionId: string; result: string })
			.map((p) => `${p.criterionId}=${p.result}`)
			.sort();

		expect(recorded, 'a criterion the floor judged did not reach the governed stream').toEqual(expected);

		// ⭑ AND THE STAKES ARE NOT IN THE PAYLOAD (`R25`). `FloorCriterion` carries `mandatory`, derived from
		// the policy's `severityIfNotMet`. Sending it would let the judged party declare how bad its own
		// failure is; a reader must re-derive it from the policy every time.
		const keys = new Set(
			eng
				.readAllEvents()
				.filter((e) => e.eventType === 'AssuranceCriterionEvaluated')
				.flatMap((e) => Object.keys(e.payload as Record<string, unknown>))
		);
		// ⚠ A SUBSET CHECK, NOT AN EQUALITY, AND THE FIRST DRAFT GOT THAT WRONG. It asserted exactly three
		// keys and reddened on `rationale` — which the Reasoning Review legitimately supplies from the
		// reviewer's own statement even on a CLEAN run. So the optional field is genuinely exercised here,
		// and the claim worth asserting is about what must NEVER appear, not about an exact shape.
		expect([...keys].sort(), 'the payload grew a field the vocabulary does not declare').toEqual(
			[...keys].filter((k) => ['assessmentId', 'criterionId', 'result', 'rationale'].includes(k)).sort()
		);
		expect(keys.has('mandatory'), 'the judged party is declaring its own stakes (R25)').toBe(false);
		expect(keys.has('outcome'), 'the kernel spelling leaked past the boundary rename').toBe(false);
	});

	it('⛔ a FAILED criterion crosses the boundary with its outcome intact, which is what used to be lost', async () => {
		// A clean run records nine MET results, and a recorder that hardcoded MET would pass the test above.
		// This is the arrangement that tells them apart: `FS-01-schema` genuinely fails, and its NOT_MET
		// must arrive as NOT_MET. ⭑ The observation carrying the same failure is asserted separately below —
		// observations come only from failures, which is precisely why they could never carry the MET results.
		const { eng } = await runAndRecord({
			...goodCtx,
			schemaInvariant: { schemaValid: false, invariantViolations: [] }
		});

		const results = eng
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceCriterionEvaluated')
			.map((e) => e.payload as { criterionId: string; result: string });

		const schemaCriterion = results.find((p) => p.criterionId === 'FS-01-schema');
		expect(schemaCriterion?.result, 'the failing criterion did not reach the stream as failing').toBe(
			'NOT_MET'
		);
		// ⭐ AND THE REST ARE NOT COLLATERALLY FAILED — a recorder that wrote one outcome for the whole
		// assessment would satisfy the line above and destroy the per-criterion detail this increment exists
		// to preserve.
		expect(
			results.filter((p) => p.result === 'MET').length,
			'every criterion took the failing one\u2019s outcome, so nothing per-criterion survived'
		).toBeGreaterThan(0);
	});

	it('a schema failure records a REJECTED assessment + an observation carrying the specific finding code', async () => {
		const { eng, plan } = await runAndRecord({
			...goodCtx,
			schemaInvariant: { schemaValid: false, invariantViolations: [] }
		});
		expect(plan.gatePermitsTransition).toBe(false);

		const assessments = listByType(eng, 'ASSURANCE_ASSESSMENT');
		const schema = assessments.find((a) => a.state.assurancePolicyId === 'floor.schema-invariant')!;
		expect(schema.state.assessmentState).toBe('REJECTED');
		const review = assessments.find((a) => a.state.assurancePolicyId === 'floor.reasoning-review')!;
		expect(review.state.assessmentState).toBe('SATISFIED');

		const observations = listByType(eng, 'ASSURANCE_OBSERVATION');
		expect(observations).toHaveLength(1);
		const obs = observations[0]!;
		expect(obs.state.findingCode).toBe('SCHEMA_INVALID');
		expect(obs.state.observationType).toBe('POLICY_VIOLATION');
		expect(obs.state.severity).toBe('CRITICAL');
		expect(obs.state.assessmentId).toBe(schema.id);
	});
});

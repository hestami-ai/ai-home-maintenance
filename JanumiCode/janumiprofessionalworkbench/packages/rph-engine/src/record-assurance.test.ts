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

/** An independent Reasoning-Review Validator that recommends SATISFIED with no findings (all 9 criteria MET). */
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
					findings: [],
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

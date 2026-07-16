// Proves the Assurance-Service recording arm end to end: run the de minimis floor over a subject, then persist the
// result as canonical ASSURANCE_ASSESSMENT + ASSURANCE_OBSERVATION objects via live commands — one assessment per
// floor policy, completed to the floor-computed disposition, observations carrying the Validator's finding code.
import {
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
import type { ActorReference } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { createEngine, listByType, recordAssuranceRecordingPlan } from './index.js';

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
			reasoningReviewResultFromJudgement(subject, JUDGE, 'test.reasoning-review', {
				findings: [],
				recommendation: 'SATISFIED'
			})
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
	return createEngine({ ontology, now: () => '2026-07-14T00:00:00Z', newEventId: () => `e${++s}` });
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
	const plan = await runFloorAndPlanRecording(subject, ctx, registry());
	const recorded = recordAssuranceRecordingPlan(eng, plan, {
		actor: ACTOR,
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
		expect(evaluator, 'the judge identity must be recorded, not dropped at persistence').toBeDefined();
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

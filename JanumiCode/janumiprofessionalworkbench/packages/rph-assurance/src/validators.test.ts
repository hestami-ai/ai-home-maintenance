import { describe, expect, it } from 'vitest';
import type { Identity } from './assurance-rules.js';
import { FLOOR_POLICY_IDS, type AssuranceSubject } from './floor.js';
import {
	createValidatorRegistry,
	identityProvenanceValidatorInstance,
	reasoningReviewResultFromJudgement,
	runDeMinimisFloor,
	schemaInvariantValidatorInstance,
	type ReasoningReviewJudgement,
	type Validator,
	type ValidatorContext
} from './validators.js';

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

const subject: AssuranceSubject = {
	subjectId: 'pwa_1',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: CODEX
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

/** A mock Reasoning-Review Validator driven by a fixed judgement (stands in for the agy backend in unit tests). */
function mockReasoningReview(j: ReasoningReviewJudgement, evaluator: Identity = GEMINI): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: 'mock.reasoning-review',
		evaluate: (s) =>
			Promise.resolve(reasoningReviewResultFromJudgement(s, evaluator, 'mock.reasoning-review', j))
	};
}
const CLEAN: ReasoningReviewJudgement = { findings: [], recommendation: 'SATISFIED' };

describe('reasoningReviewResultFromJudgement — judgement → schema-conformant ValidatorResult', () => {
	it('maps each failure class to a mandatory criterion (MET iff absent) + open observations', () => {
		const r = reasoningReviewResultFromJudgement(subject, GEMINI, 'v1', {
			findings: [
				{
					criterionId: 'RR-05-no-premature-convergence',
					failed: true,
					statement: 'stopped after one pass',
					severity: 'BLOCKING'
				}
			],
			recommendation: 'REJECTED'
		});
		expect(r.criteria).toHaveLength(9); // all nine failure classes become criteria
		expect(
			r.criteria.find((c) => c.criterionId === 'RR-05-no-premature-convergence')?.outcome
		).toBe('NOT_MET');
		expect(r.criteria.find((c) => c.criterionId === 'RR-01-no-problem-substitution')?.outcome).toBe(
			'MET'
		);
		expect(r.observations).toHaveLength(1);
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.evaluator.modelId).toBe('gemini');
	});
});

describe('validator registry + runDeMinimisFloor', () => {
	function registry(rr?: Validator) {
		const reg = createValidatorRegistry();
		reg.register(schemaInvariantValidatorInstance);
		reg.register(identityProvenanceValidatorInstance);
		if (rr) reg.register(rr);
		return reg;
	}

	it('all floor validators present + clean → aggregate SATISFIED, gate OPEN', async () => {
		const out = await runDeMinimisFloor(subject, goodCtx, registry(mockReasoningReview(CLEAN)));
		expect(out.aggregate).toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});

	it('an AI subject with NO Reasoning-Review validator registered is UNASSESSED and blocked', async () => {
		const out = await runDeMinimisFloor(subject, goodCtx, registry());
		expect(out.aggregate).toBe('UNASSESSED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a Reasoning-Review validator that THROWS yields VALIDATOR_FAILED (blocks, never REJECTED)', async () => {
		const throwing: Validator = {
			policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
			validatorId: 'boom',
			evaluate: () => Promise.reject(new Error('agy unavailable'))
		};
		const out = await runDeMinimisFloor(subject, goodCtx, registry(throwing));
		const rr = out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rr.disposition).toBe('VALIDATOR_FAILED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a Reasoning-Review finding a failure class blocks the gate', async () => {
		const bad = mockReasoningReview({
			findings: [
				{
					criterionId: 'RR-04-no-proxy-satisfaction',
					failed: true,
					statement: 'surface repair',
					severity: 'BLOCKING'
				}
			],
			recommendation: 'REJECTED'
		});
		const out = await runDeMinimisFloor(subject, goodCtx, registry(bad));
		expect(out.aggregate).toBe('REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('missing deterministic facts in context fail the floor closed (schema facts unavailable → blocked)', async () => {
		const out = await runDeMinimisFloor(
			subject,
			{ reasoningReview: undefined },
			registry(mockReasoningReview(CLEAN))
		);
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a non-AI subject does not require Reasoning Review to pass', async () => {
		const nonAi: AssuranceSubject = { ...subject, isAiProduced: false };
		const out = await runDeMinimisFloor(nonAi, goodCtx, registry());
		expect(out.aggregate).toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});
});

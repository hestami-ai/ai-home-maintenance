// Proves the de minimis floor is PLANE-AGNOSTIC (guide §8.4): the SAME machinery — runFloorAndPlanRecording +
// recordAssuranceRecordingPlan — records over an EXECUTION-plane work product (an ExecutionStep output) exactly as it
// does over an authoring-plane PWA. One floor, two planes; the subject's objectType is the only thing that differs.
// (A concrete execution-plane protected-transition gate, e.g. on completeExecutionStep RUNNING→SUCCEEDED, is a
// follow-up for when a live execution flow exists to exercise it — the recording/composition proven here is reused.)
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
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import type { ActorReference } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import type { EngineHandle } from './engine.js';
import { createEngine, listByType, recordAssuranceRecordingPlan } from './index.js';
import { seedFloorPolicies } from './seed-workbench.js';

const TS = '2026-07-14T00:00:00Z';
const SVC: ActorReference = {
	actorId: 'assurance-svc',
	actorType: 'SERVICE',
	displayName: 'Assurance'
};
const EXECUTOR: Identity = {
	actorType: 'AGENT',
	agentId: 'exec',
	modelId: 'coder',
	providerId: 'x'
};
const JUDGE: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};

/** An independent Reasoning-Review Validator with a caller-chosen recommendation (findings only when it rejects). */
function rr(recommendation: 'SATISFIED' | 'REJECTED'): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: 'test.reasoning-review',
		evaluate: (subject) =>
			Promise.resolve(
				reasoningReviewResultFromJudgement(
					subject,
					JUDGE,
					'test.reasoning-review',
					{
						findings:
							recommendation === 'REJECTED'
								? [
										{
											criterionId: 'RR-04-no-proxy-satisfaction',
											failed: true,
											statement:
												'The execution output is a plausible stub, not the delegated work.',
											severity: 'BLOCKING'
										}
									]
								: [],
						recommendation
					},
					SEEDED_REASONING_REVIEW_CRITERIA
				)
			)
	};
}

function registry(recommendation: 'SATISFIED' | 'REJECTED') {
	const r = createValidatorRegistry();
	r.register(schemaInvariantValidatorInstance);
	r.register(identityProvenanceValidatorInstance);
	r.register(rr(recommendation));
	return r;
}

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

function engine(): EngineHandle {
	let s = 0;
	return createEngine({ ontology, now: () => TS, newEventId: () => `e${++s}` });
}

describe('de minimis floor is plane-agnostic (authoring + execution)', () => {
	it('records the same floor over an EXECUTION-plane work product as over a PWA', async () => {
		const eng = engine();
		seedFloorPolicies(eng); // the recorder cites floor.* policies — they must exist for RequestAssuranceAssessment
		let n = 0;
		const mint = (p: string) => `${p}_${String(++n).padStart(26, '0')}`;

		// Authoring-plane subject: a DRAFT PWA graph.
		const pwa: AssuranceSubject = {
			subjectId: 'pwa_auth',
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			semanticVersion: 1,
			isAiProduced: true,
			producer: EXECUTOR
		};
		// Execution-plane subject: an ExecutionStep's produced output — a material AI work product.
		const step: AssuranceSubject = {
			subjectId: 'step_exec',
			objectType: 'EXECUTION_STEP',
			semanticVersion: 1,
			isAiProduced: true,
			producer: EXECUTOR
		};

		const pwaPlan = await runFloorAndPlanRecording(pwa, goodCtx, registry('SATISFIED'));
		recordAssuranceRecordingPlan(eng, pwaPlan, {
			actor: SVC,
			issuedAt: TS,
			correlationId: 'floor',
			idPrefix: 'a',
			newId: mint
		});
		const stepPlan = await runFloorAndPlanRecording(step, goodCtx, registry('REJECTED'));
		recordAssuranceRecordingPlan(eng, stepPlan, {
			actor: SVC,
			issuedAt: TS,
			correlationId: 'floor',
			idPrefix: 'e',
			newId: mint
		});

		// The SAME composition ran for both planes.
		expect(pwaPlan.gatePermitsTransition).toBe(true);
		expect(stepPlan.gatePermitsTransition).toBe(false); // the execution output's reasoning review was REJECTED

		// Both planes recorded canonical ASSURANCE_ASSESSMENT objects, keyed to their own subject.
		const assessments = listByType(eng, 'ASSURANCE_ASSESSMENT');
		const forPwa = assessments.filter((a) =>
			(a.state.subjectObjectIds as string[]).includes('pwa_auth')
		);
		const forStep = assessments.filter((a) =>
			(a.state.subjectObjectIds as string[]).includes('step_exec')
		);
		expect(forPwa).toHaveLength(3);
		expect(forStep).toHaveLength(3);
		expect(forPwa.every((a) => a.state.assessmentState === 'SATISFIED')).toBe(true);
		const stepReview = forStep.find((a) => a.state.assurancePolicyId === 'floor.reasoning-review')!;
		expect(stepReview.state.assessmentState).toBe('REJECTED');

		// The execution-plane observation carries the Validator's specific finding code — same recorder, same fidelity.
		const stepObs = listByType(eng, 'ASSURANCE_OBSERVATION').filter((o) =>
			(o.state.subjectObjectIds as string[]).includes('step_exec')
		);
		expect(stepObs.map((o) => o.state.findingCode)).toContain('RR-04-no-proxy-satisfaction');
	});
});

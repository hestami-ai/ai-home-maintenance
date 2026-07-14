// Proves the recorder (3b) and the protected-transition gate (3c) compose: an AGENT-authored PWA cannot be PUBLISHED
// until the REAL de minimis floor — run by the actual Validators and persisted by recordAssuranceRecordingPlan — is
// recorded SATISFIED. This closes the loop the two package-local suites test in isolation.
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
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import type { EngineHandle } from './engine.js';
import { createEngine, recordAssuranceRecordingPlan } from './index.js';

const TS = '2026-07-14T00:00:00Z';
const AGENT: ActorReference = {
	actorId: 'agent-1',
	actorType: 'AGENT',
	displayName: 'Authoring Agent'
};
const SVC: ActorReference = {
	actorId: 'assurance',
	actorType: 'SERVICE',
	displayName: 'Assurance'
};
const PRODUCER: Identity = {
	actorType: 'AGENT',
	agentId: 'agent-1',
	modelId: 'gpt-5.4',
	providerId: 'openai'
};
const JUDGE: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S00';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S10';

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

let seq = 0;
function build(): EngineHandle {
	let s = 0;
	seq = 0;
	return createEngine({ ontology, now: () => TS, newEventId: () => `e${++s}` });
}

// Every command gets a UNIQUE idempotency key (a colliding key returns the prior receipt as DUPLICATE — so a
// blocked publish would otherwise mask a legitimate retry, and the recorder's commands would be skipped).
function send(
	eng: EngineHandle,
	actor: ActorReference,
	commandType: string,
	id: string,
	type: string,
	payload: unknown
) {
	seq += 1;
	const command: DomainCommand = {
		commandId: `g-${seq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: type,
		targetAggregateId: id,
		issuedAt: TS,
		issuedBy: actor,
		correlationId: 'gate-e2e',
		idempotencyKey: `g-idem-${seq}`,
		payload
	};
	return eng.dispatch(command);
}

function authorValidated(eng: EngineHandle) {
	send(eng, AGENT, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
		pwaId: PWA,
		name: 'Agent PWA',
		description: 'd',
		domain: 'software',
		version: '1.0.0'
	});
	send(eng, AGENT, 'DefinePwuType', ROOT, 'PWU_TYPE', {
		pwuTypeId: ROOT,
		pwaId: PWA,
		pwuKind: 'PRODUCT_REALIZATION',
		name: 'R',
		purpose: 'root',
		isRoot: true
	});
	send(eng, AGENT, 'SubmitPwaForReview', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
	send(eng, AGENT, 'ValidatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
}

const publish = (eng: EngineHandle) =>
	send(eng, AGENT, 'PublishPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { rootPwuTypeId: ROOT });

describe('floor gate + recorder compose (3b + 3c)', () => {
	it('an AGENT PWA is blocked until the real recorded floor is SATISFIED, then publishes', async () => {
		const eng = build();
		authorValidated(eng);

		// Gate blocks: no floor recorded yet.
		expect(publish(eng).status).toBe('REJECTED');
		expect((eng.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus).toBe(
			'VALIDATED'
		);

		// Run the REAL floor and persist it via the recorder.
		const subject: AssuranceSubject = {
			subjectId: PWA,
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			semanticVersion: 1,
			isAiProduced: true,
			producer: PRODUCER
		};
		const registry = createValidatorRegistry();
		registry.register(schemaInvariantValidatorInstance);
		registry.register(identityProvenanceValidatorInstance);
		registry.register(rrSatisfied);
		const ctx: ValidatorContext = {
			schemaInvariant: { schemaValid: true, invariantViolations: [] },
			identityProvenance: {
				hasStableId: true,
				hasSemanticVersion: true,
				hasProvenance: true,
				hasProducer: true,
				traceComplete: true
			}
		};
		const plan = await runFloorAndPlanRecording(subject, ctx, registry);
		expect(plan.gatePermitsTransition).toBe(true);
		let idn = 0;
		recordAssuranceRecordingPlan(eng, plan, {
			actor: SVC,
			issuedAt: TS,
			correlationId: 'floor',
			idPrefix: 'rec',
			newId: (p) => `${p}_${String(++idn).padStart(26, '0')}`
		});

		// Gate now permits.
		const r = publish(eng);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((eng.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus).toBe(
			'PUBLISHED'
		);
	});
});

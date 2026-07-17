// Increment I2 — independence is ENFORCED at completion, and a violation is a REACHABLE state.
//
// §39 invariant 8 ("Required independence must be verified"), §8.4, §20.2: an assessment under a policy that
// requires independence may not be satisfied unless the evaluator is independent of the subject's producer.
// completeAssuranceAssessment now calls the kernel rule checkIndependence and, on a real violation, transitions
// ASSESSING -> INDEPENDENCE_VIOLATION (the ratified §30 arrow) emitting AssuranceIndependenceViolated, instead of
// completing to a disposition. These tests drive that LIVE against a policy that genuinely requires DIFFERENT_AGENT.
//
// The gate is deliberately conditional (policy resolves + requirement != NONE + BOTH operands present); the third
// test pins the producer-absent skip as a CHOSEN behavior (proceed, do not fabricate a pass or a violation), so it
// cannot silently flip into either.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Owner' };
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69G5IND';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5SUB';

describe('completeAssuranceAssessment — independence enforcement (Increment I2)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	const cmd = (
		commandType: string,
		targetAggregateId: string,
		targetAggregateType: string,
		payload: unknown
	): DomainCommand => {
		const n = ++seq;
		return {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload
		};
	};

	function dispatchOk(command: DomainCommand): void {
		const r = engine.dispatch(command);
		if (r.status !== 'ACCEPTED') {
			throw new Error(`${command.commandType} rejected: ${JSON.stringify(r.error)}`);
		}
	}

	/** Create + activate a policy at version 1.0.0 with a given independence requirement. */
	function createPolicy(independenceRequirement: string): void {
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Independence-requiring fitness policy',
				purpose: 'Assess fitness under a required independence',
				rationale: 'Independence must be verified.',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'The subject is fit for its approved need.',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement,
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'Not fit.',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE']
			})
		);
		dispatchOk(cmd('ActivateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', { policyId: POLICY }));
	}

	/** Request an assessment (created directly in ASSESSING) against the policy. */
	function requestAssessment(assessmentId: string): void {
		dispatchOk(
			cmd('RequestAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				assessmentId,
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			})
		);
	}

	/** A schema-valid §20 verdict recommending SATISFIED, evaluated by `evaluatorActorId`. */
	function verdict(assessmentId: string, evaluatorActorId: string) {
		return {
			validatorId: 'reviewer',
			validatorVersion: '1',
			policyId: POLICY,
			policyVersion: '1.0.0',
			assessmentId,
			subjectObjectIds: [SUBJECT],
			subjectSemanticVersions: { [SUBJECT]: 1 },
			claimResults: [],
			evidenceConsideredIds: [],
			evidenceRejected: [],
			observations: [],
			dispositionRecommendation: 'SATISFIED',
			recommendedControlActions: [],
			residualUncertainty: [],
			limitations: [],
			executionProvenance: {
				evaluator: { actorId: evaluatorActorId, actorType: 'HUMAN', displayName: 'Reviewer' }
			}
		};
	}

	const stateOf = (id: string) =>
		store.loadObject(id)?.state as { assessmentState?: string } | undefined;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
	});

	it('a DIFFERENT_AGENT policy where producer === evaluator drives ASSESSING -> INDEPENDENCE_VIOLATION', () => {
		createPolicy('DIFFERENT_AGENT');
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A01';
		requestAssessment(assessmentId);

		// Same identity for producer and evaluator — DIFFERENT_AGENT cannot be satisfied.
		const result = engine.dispatch(
			cmd('CompleteAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(assessmentId, 'same-1'),
				producer: { actorId: 'same-1', actorType: 'HUMAN', displayName: 'Same' }
			})
		);
		expect(result.status).toBe('ACCEPTED');
		// The assessment did NOT reach a disposition; it is in the ratified violation state (INV-8 forbids it ever
		// reaching SATISFIED from here).
		expect(stateOf(assessmentId)?.assessmentState).toBe('INDEPENDENCE_VIOLATION');
		const violated = store
			.readAllEvents()
			.filter(
				(e) => e.eventType === 'AssuranceIndependenceViolated' && e.aggregateId === assessmentId
			);
		expect(violated).toHaveLength(1);
		expect(
			(violated[0]!.payload as { independenceRequirement?: string }).independenceRequirement
		).toBe('DIFFERENT_AGENT');
		expect((violated[0]!.payload as { reason?: string }).reason).toBe('same agent identity');
	});

	it('a DIFFERENT_AGENT policy where producer !== evaluator completes normally to the disposition', () => {
		createPolicy('DIFFERENT_AGENT');
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A02';
		requestAssessment(assessmentId);

		const result = engine.dispatch(
			cmd('CompleteAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(assessmentId, 'evaluator-1'),
				producer: { actorId: 'producer-1', actorType: 'HUMAN', displayName: 'Producer' }
			})
		);
		expect(result.status).toBe('ACCEPTED');
		expect(stateOf(assessmentId)?.assessmentState).toBe('SATISFIED');
		expect(store.readAllEvents().some((e) => e.eventType === 'AssuranceIndependenceViolated')).toBe(
			false
		);
	});

	it('the check is SKIPPED (proceeds, not violated) when the caller supplies no producer — the chosen gate', () => {
		// A required independence with no producer to compare against cannot be VERIFIED; the handler proceeds
		// rather than fabricate a pass OR a violation. This is a deliberate, recorded limitation (the floor recording
		// path supplies no producer yet), pinned here so it cannot silently become either outcome.
		createPolicy('DIFFERENT_AGENT');
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A03';
		requestAssessment(assessmentId);

		const result = engine.dispatch(
			cmd('CompleteAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(assessmentId, 'same-1')
				// producer deliberately omitted
			})
		);
		expect(result.status).toBe('ACCEPTED');
		expect(stateOf(assessmentId)?.assessmentState).toBe('SATISFIED');
	});
});

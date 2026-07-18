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

	/** Create + activate a policy at version 1.0.0 with a given independence requirement. Pass activate:false to
	 *  leave it DRAFT (regular policies are born DRAFT; assessments require ACTIVE). */
	function createPolicy(independenceRequirement: string, opts: { activate?: boolean } = {}): void {
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
		if (opts.activate !== false) {
			dispatchOk(cmd('ActivateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', { policyId: POLICY }));
		}
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

	it('rejects RequestAssuranceAssessment citing a policy that does not exist (fail-closed, independence follow-up B)', () => {
		// No createPolicy(...) — the cited policy was never created. The command must fail closed: an assessment
		// against a phantom policy assesses nothing and leaves the independence requirement unresolvable.
		const r = engine.dispatch(
			cmd('RequestAssuranceAssessment', 'asm_01ARZ3NDEKTSV4RRFFQ69G5A00', 'ASSURANCE_ASSESSMENT', {
				assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5A00',
				assurancePolicyId: 'pol_does_not_exist',
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(store.loadObject('asm_01ARZ3NDEKTSV4RRFFQ69G5A00')).toBeUndefined();
	});

	it('rejects RequestAssuranceAssessment against a DRAFT (created-but-not-activated) policy — a policy governs only while ACTIVE (DOC-002 §18)', () => {
		createPolicy('NONE', { activate: false }); // regular policy, left DRAFT
		expect((store.loadObject(POLICY)?.state as { status?: string })?.status).toBe('DRAFT');
		const r = engine.dispatch(
			cmd('RequestAssuranceAssessment', 'asm_01ARZ3NDEKTSV4RRFFQ69G5A08', 'ASSURANCE_ASSESSMENT', {
				assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5A08',
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(store.loadObject('asm_01ARZ3NDEKTSV4RRFFQ69G5A08')).toBeUndefined();
		// And once activated, the same assessment is accepted — the gate is on governance state, not existence.
		dispatchOk(cmd('ActivateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', { policyId: POLICY }));
		expect(
			engine.dispatch(
				cmd(
					'RequestAssuranceAssessment',
					'asm_01ARZ3NDEKTSV4RRFFQ69G5A09',
					'ASSURANCE_ASSESSMENT',
					{
						assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5A09',
						assurancePolicyId: POLICY,
						policyVersion: '1.0.0',
						subjectObjectIds: [SUBJECT],
						subjectSemanticVersions: { [SUBJECT]: 1 },
						claimIds: []
					}
				)
			).status
		).toBe('ACCEPTED');
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
		// Increment I4: the check RAN and PASSED, so the completion records the positive result.
		const completedEvt = store
			.readAllEvents()
			.find(
				(e) => e.eventType === 'AssuranceAssessmentCompleted' && e.aggregateId === assessmentId
			);
		expect((completedEvt!.payload as { independenceResult?: string }).independenceResult).toBe(
			'VERIFIED'
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
		// The check did NOT run (no producer), so the completion records NO independence result — unknown, not a
		// fabricated 'VERIFIED'.
		const completedEvt = store
			.readAllEvents()
			.find(
				(e) => e.eventType === 'AssuranceAssessmentCompleted' && e.aggregateId === assessmentId
			);
		expect(
			(completedEvt!.payload as { independenceResult?: string }).independenceResult
		).toBeUndefined();
	});

	it('a DIFFERENT_MODEL policy compares the MODEL dimension: same model -> INDEPENDENCE_VIOLATION, distinct model -> VERIFIED', () => {
		// The AI-review independence the Reasoning Review floor requires. The handler is generic over the requirement;
		// this pins the model dimension specifically (Increment I5 exercises it live in the reference undertaking).
		createPolicy('DIFFERENT_MODEL');

		const modelEvaluator = (actorId: string, modelId: string) => ({
			actorId,
			actorType: 'MODEL',
			displayName: 'Reviewing model',
			modelId
		});

		// Same model for producer and reviewer — DIFFERENT_MODEL cannot be satisfied.
		const same = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A04';
		requestAssessment(same);
		engine.dispatch(
			cmd('CompleteAssuranceAssessment', same, 'ASSURANCE_ASSESSMENT', {
				validatorResult: {
					...verdict(same, 'reviewer-model'),
					executionProvenance: { evaluator: modelEvaluator('reviewer-model', 'm-shared') }
				},
				producer: modelEvaluator('producer-model', 'm-shared')
			})
		);
		expect(stateOf(same)?.assessmentState).toBe('INDEPENDENCE_VIOLATION');

		// Distinct models — verified.
		const distinct = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A05';
		requestAssessment(distinct);
		engine.dispatch(
			cmd('CompleteAssuranceAssessment', distinct, 'ASSURANCE_ASSESSMENT', {
				validatorResult: {
					...verdict(distinct, 'reviewer-model'),
					executionProvenance: { evaluator: modelEvaluator('reviewer-model', 'm-reviewer') }
				},
				producer: modelEvaluator('producer-model', 'm-producer')
			})
		);
		expect(stateOf(distinct)?.assessmentState).toBe('SATISFIED');
		const completedEvt = store
			.readAllEvents()
			.find((e) => e.eventType === 'AssuranceAssessmentCompleted' && e.aggregateId === distinct);
		expect((completedEvt!.payload as { independenceResult?: string }).independenceResult).toBe(
			'VERIFIED'
		);
	});

	it('records BOTH independence operands (producer + evaluator) in object state — a VERIFIED completion and a VIOLATION both name the pair compared (contract-drift)', () => {
		createPolicy('DIFFERENT_AGENT');
		const identities = (id: string) =>
			store.loadObject(id)?.state as
				{ producer?: { actorId?: string }; evaluator?: { actorId?: string } } | undefined;

		// VERIFIED: producer !== evaluator. Both operands must be recorded, not just the outcome.
		const verified = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A06';
		requestAssessment(verified);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', verified, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(verified, 'evaluator-1'),
				producer: { actorId: 'producer-1', actorType: 'HUMAN', displayName: 'Producer' }
			})
		);
		expect(stateOf(verified)?.assessmentState).toBe('SATISFIED');
		expect(identities(verified)?.producer?.actorId).toBe('producer-1');
		expect(identities(verified)?.evaluator?.actorId).toBe('evaluator-1');

		// VIOLATION: producer === evaluator. The violation path (which previously wrote neither) must name the pair
		// that failed independence, or the INV-8 audit cannot say "producer X vs evaluator Y".
		const violated = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A07';
		requestAssessment(violated);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', violated, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(violated, 'same-1'),
				producer: { actorId: 'same-1', actorType: 'HUMAN', displayName: 'Same' }
			})
		);
		expect(stateOf(violated)?.assessmentState).toBe('INDEPENDENCE_VIOLATION');
		expect(identities(violated)?.producer?.actorId).toBe('same-1');
		expect(identities(violated)?.evaluator?.actorId).toBe('same-1');
	});

	it('§38 missing-evidence source: requestAssuranceAssessment resolves the policy requiredEvidence onto the Started event', () => {
		// A policy that DECLARES required evidence (§6.1). The assessment's Started event must carry those requirement
		// ids so the §38 read model can source "missing evidence" — the operator does not supply them, the policy does.
		const ev = (id: string, mayBeWaived: boolean) => ({
			id,
			evidenceType: 'TEST_RESULT',
			description: 'd',
			purpose: 'p',
			cardinality: 'AT_LEAST_ONE',
			admissibilityRules: [],
			requiredForDispositions: 'ALL',
			mayBeWaived
		});
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Evidence-requiring policy',
				purpose: 'Assess fitness with required evidence',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'd',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: ['EV-01'],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement: 'NONE',
				requiredEvidence: [ev('EV-01', false), ev('EV-02', true)],
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE']
			})
		);
		dispatchOk(cmd('ActivateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', { policyId: POLICY }));
		const A = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A20';
		requestAssessment(A);
		const startedEvt = store
			.readAllEvents()
			.find(
				(e) =>
					e.eventType === 'AssuranceAssessmentStarted' &&
					(e.payload as { assessmentId?: string }).assessmentId === A
			);
		expect(
			(startedEvt!.payload as { requiredEvidenceIds?: string[] }).requiredEvidenceIds
		).toEqual(['EV-01', 'EV-02']);
	});

	it('§32 submitEvidenceForAssessment emits AssuranceEvidenceReceived with the (evidence, requirement) binding', () => {
		// The SATISFACTION side, live. A policy declaring EV-01 + EV-02; an assessment; then a submission satisfying
		// EV-01. The event must carry which requirement the evidence satisfies — that binding is what makes the §38
		// "missing = required − received" fold well-defined across the two id namespaces (the projection unit test
		// exercises the fold itself; here we prove the handler emits the datum it needs and fails closed).
		const ev = (id: string) => ({
			id,
			evidenceType: 'TEST_RESULT',
			description: 'd',
			purpose: 'p',
			cardinality: 'AT_LEAST_ONE',
			admissibilityRules: [],
			requiredForDispositions: 'ALL',
			mayBeWaived: false
		});
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Evidence-requiring policy',
				purpose: 'Assess fitness with required evidence',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'd',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement: 'NONE',
				requiredEvidence: [ev('EV-01'), ev('EV-02')],
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE']
			})
		);
		dispatchOk(cmd('ActivateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', { policyId: POLICY }));
		const A = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A30';
		requestAssessment(A);

		dispatchOk(
			cmd('SubmitEvidenceForAssessment', A, 'ASSURANCE_ASSESSMENT', {
				evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5EV1',
				satisfiesRequirementId: 'EV-01'
			})
		);
		const received = store
			.readAllEvents()
			.find(
				(e) =>
					e.eventType === 'AssuranceEvidenceReceived' &&
					(e.payload as { assessmentId?: string }).assessmentId === A
			);
		expect(received).toBeDefined();
		expect(received!.payload).toMatchObject({
			assessmentId: A,
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5EV1',
			satisfiesRequirementId: 'EV-01'
		});

		// FAIL CLOSED: a submission naming a requirement the policy does not declare is rejected — otherwise
		// "missing evidence" could be reduced by evidence that satisfies nothing the policy asked for.
		const bad = engine.dispatch(
			cmd('SubmitEvidenceForAssessment', A, 'ASSURANCE_ASSESSMENT', {
				evidenceId: 'evd_x',
				satisfiesRequirementId: 'EV-NOT-DECLARED'
			})
		);
		expect(bad.status).toBe('REJECTED');
	});
});

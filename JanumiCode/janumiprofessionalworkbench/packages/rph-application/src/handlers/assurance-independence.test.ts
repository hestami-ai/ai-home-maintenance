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

	it('§11 permittedControlActions ENFORCED: a validator recommending a non-permitted action is rejected (Gate B)', () => {
		createPolicy('NONE'); // permittedControlActions: ['CONTINUE']
		const A = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A40';
		requestAssessment(A);
		const v = verdict(A, 'reviewer-x');
		// The policy permits only CONTINUE; ESCALATE is a real ControlAction but not permitted by THIS policy.
		const rejected = engine.dispatch(
			cmd('CompleteAssuranceAssessment', A, 'ASSURANCE_ASSESSMENT', {
				validatorResult: { ...v, recommendedControlActions: [{ action: 'ESCALATE' }] }
			})
		);
		expect(rejected.status).toBe('REJECTED');
		expect(stateOf(A)?.assessmentState).toBe('ASSESSING'); // not completed past the policy
		// A permitted action completes.
		dispatchOk(
			cmd('CompleteAssuranceAssessment', A, 'ASSURANCE_ASSESSMENT', {
				validatorResult: { ...v, recommendedControlActions: [{ action: 'CONTINUE' }] }
			})
		);
		expect(stateOf(A)?.assessmentState).toBe('SATISFIED');
	});

	it('§6.1 requiredEvidence ENFORCED: SATISFIED is rejected while mandatory evidence is unmet, then stands once submitted (Gate A)', () => {
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
				name: 'Evidence-gated policy',
				purpose: 'p',
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
				requiredEvidence: [ev('EV-01')],
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
		const A = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A50';
		requestAssessment(A);

		// SATISFIED with EV-01 unmet -> fail closed; the assessment stays ASSESSING.
		const early = engine.dispatch(
			cmd('CompleteAssuranceAssessment', A, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(A, 'reviewer-y')
			})
		);
		expect(early.status).toBe('REJECTED');
		expect(stateOf(A)?.assessmentState).toBe('ASSESSING');

		// Submit the required evidence, then the SATISFIED verdict stands.
		dispatchOk(
			cmd('SubmitEvidenceForAssessment', A, 'ASSURANCE_ASSESSMENT', {
				evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5E01',
				satisfiesRequirementId: 'EV-01'
			})
		);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', A, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(A, 'reviewer-y')
			})
		);
		expect(stateOf(A)?.assessmentState).toBe('SATISFIED');

		// A NEGATIVE disposition is NOT gated on evidence: rejecting BECAUSE evidence is insufficient is correct.
		const B = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A51';
		requestAssessment(B);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', B, 'ASSURANCE_ASSESSMENT', {
				validatorResult: { ...verdict(B, 'reviewer-z'), dispositionRecommendation: 'REJECTED' }
			})
		);
		expect(stateOf(B)?.assessmentState).toBe('REJECTED');
	});

	it('§10.3 dispositionRules foreclosure (Gate C): SATISFIED is rejected while an observation of a forbidden severity is OPEN', () => {
		// A policy whose dispositionRules forbid SATISFIED while a CRITICAL observation is open (§10.3).
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Foreclosing policy',
				purpose: 'p',
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
				dispositionRules: [
					{ disposition: 'SATISFIED', condition: 'no open critical', forbiddenOpenSeverities: ['CRITICAL'] }
				],
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

		// Assessment WITH an open CRITICAL observation -> SATISFIED is foreclosed.
		const A = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A60';
		requestAssessment(A);
		dispatchOk(
			cmd('RecordAssuranceObservation', 'obs_01ARZ3NDEKTSV4RRFFQ69G5B01', 'ASSURANCE_OBSERVATION', {
				assessmentId: A,
				observationType: 'FINDING',
				severity: 'CRITICAL',
				statement: 'a critical, unresolved gap'
			})
		);
		const early = engine.dispatch(
			cmd('CompleteAssuranceAssessment', A, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(A, 'reviewer-c')
			})
		);
		expect(early.status).toBe('REJECTED');
		expect(stateOf(A)?.assessmentState).toBe('ASSESSING');

		// A separate assessment whose only open observation is MATERIAL (NOT a forbidden severity) -> SATISFIED stands.
		const B = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A61';
		requestAssessment(B);
		dispatchOk(
			cmd('RecordAssuranceObservation', 'obs_01ARZ3NDEKTSV4RRFFQ69G5B02', 'ASSURANCE_OBSERVATION', {
				assessmentId: B,
				observationType: 'FINDING',
				severity: 'MATERIAL',
				statement: 'material, but not a forbidden severity'
			})
		);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', B, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(B, 'reviewer-c')
			})
		);
		expect(stateOf(B)?.assessmentState).toBe('SATISFIED');
	});

	it('§13/§10.3 escalationRules ENFORCED (Gate D): an open CRITICAL finding escalates ASSESSING → ESCALATED', () => {
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Escalating policy',
				purpose: 'p',
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
				escalationRules: [
					{
						trigger: 'critical open finding',
						escalationTarget: 'SECURITY_REVIEWER',
						requiredPackage: ['subject', 'finding'],
						escalateOnOpenSeverities: ['CRITICAL']
					}
				],
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

		// An open CRITICAL observation -> even a SATISFIED recommendation escalates (Gate D precedes the disposition
		// gates), and the ratified-but-previously-dead AssuranceAssessmentEscalated event fires.
		const A = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A70';
		requestAssessment(A);
		dispatchOk(
			cmd('RecordAssuranceObservation', 'obs_01ARZ3NDEKTSV4RRFFQ69G5B70', 'ASSURANCE_OBSERVATION', {
				assessmentId: A,
				observationType: 'FINDING',
				severity: 'CRITICAL',
				statement: 'a critical, unresolved gap'
			})
		);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', A, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(A, 'reviewer-e')
			})
		);
		expect(stateOf(A)?.assessmentState).toBe('ESCALATED');
		expect(
			store.readAllEvents().some((e) => e.eventType === 'AssuranceAssessmentEscalated' && e.aggregateId === A)
		).toBe(true);

		// A MATERIAL-only open observation does NOT escalate (§10.3 CRITICAL restriction) -> completes to SATISFIED.
		const B = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A71';
		requestAssessment(B);
		dispatchOk(
			cmd('RecordAssuranceObservation', 'obs_01ARZ3NDEKTSV4RRFFQ69G5B71', 'ASSURANCE_OBSERVATION', {
				assessmentId: B,
				observationType: 'FINDING',
				severity: 'MATERIAL',
				statement: 'material, not escalatable'
			})
		);
		dispatchOk(
			cmd('CompleteAssuranceAssessment', B, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(B, 'reviewer-e')
			})
		);
		expect(stateOf(B)?.assessmentState).toBe('SATISFIED');
	});

	it('§10.3 escalation is CRITICAL-only: authoring a non-CRITICAL escalateOnOpenSeverities is rejected', () => {
		const r = engine.dispatch(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Bad-escalation policy',
				purpose: 'p',
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
				escalationRules: [
					{
						trigger: 'x',
						escalationTarget: 'SECURITY_REVIEWER',
						requiredPackage: [],
						escalateOnOpenSeverities: ['BLOCKING'] // §10.3 routes BLOCKING to REJECTED, not escalation
					}
				],
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
		expect(r.status).toBe('REJECTED');
		expect(store.loadObject(POLICY)).toBeUndefined();
	});

	it('#5 remediationRules: a structured rule round-trips (settable), replacing the old z.record placeholder', () => {
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Remediating policy',
				purpose: 'p',
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
				permittedControlActions: ['RESHAPE_PWU', 'REQUEST_HUMAN_DECISION'],
				remediationRules: [
					{
						trigger: 'unfit finding present',
						remediationActions: ['RESHAPE_PWU'],
						appliesToFindingCodes: ['UNFIT'],
						appliesToSeverities: ['MATERIAL']
					}
				],
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['RESHAPE_PWU']
					}
				]
			})
		);
		const state = store.loadObject(POLICY)?.state as {
			remediationRules?: Array<{ remediationActions?: string[]; appliesToFindingCodes?: string[] }>;
		};
		expect(state.remediationRules).toHaveLength(1);
		expect(state.remediationRules?.[0]?.remediationActions).toEqual(['RESHAPE_PWU']);
		expect(state.remediationRules?.[0]?.appliesToFindingCodes).toEqual(['UNFIT']);
	});

	it('#5 remediationRules: a remediation action outside permittedControlActions is rejected (§11)', () => {
		const r = engine.dispatch(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Bad-remediation policy',
				purpose: 'p',
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
				permittedControlActions: ['RESHAPE_PWU'],
				remediationRules: [{ trigger: 'x', remediationActions: ['ABANDON'] }], // ABANDON is not permitted
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['RESHAPE_PWU']
					}
				]
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(store.loadObject(POLICY)).toBeUndefined();
	});

	// --- #1b + #5 EDIT-PATH + fail-closed edges (adversarial-review fixes). The effective-merge on edit is the
	// subtlest new logic; the empty-permitted case is the fail-open the review caught; the ordering test pins that
	// content validation runs AFTER existence/lifecycle checks. ---
	const basePolicy = (extra: Record<string, unknown>): Record<string, unknown> => ({
		policyId: POLICY,
		version: '1.0.0',
		name: 'Edit-path policy',
		purpose: 'p',
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
		findingDefinitions: [
			{
				code: 'UNFIT',
				name: 'Unfit',
				description: 'd',
				defaultSeverity: 'MATERIAL',
				affectedClaimTypes: ['FITNESS'],
				defaultControlActions: ['RESHAPE_PWU']
			}
		],
		...extra
	});

	it('#5 remediationRules: an explicit EMPTY permittedControlActions rejects any remediation action (fail-CLOSED, not the empty-set fail-open)', () => {
		// permittedControlActions: [] means the policy permits NO control action, so a remediation naming one is
		// ungoverned — set-theoretically X ⊆ [] holds only for empty X. (The prior guard skipped on size===0 = fail-open.)
		const r = engine.dispatch(
			cmd(
				'CreateAssurancePolicy',
				POLICY,
				'ASSURANCE_POLICY',
				basePolicy({ permittedControlActions: [], remediationRules: [{ remediationActions: ['RESHAPE_PWU'] }] })
			)
		);
		expect(r.status).toBe('REJECTED');
		expect(store.loadObject(POLICY)).toBeUndefined();
	});

	it('#5 remediationRules EDIT-PATH: narrowing permittedControlActions to orphan an EXISTING remediation action is rejected (effective-set re-check)', () => {
		dispatchOk(
			cmd(
				'CreateAssurancePolicy',
				POLICY,
				'ASSURANCE_POLICY',
				basePolicy({
					permittedControlActions: ['RESHAPE_PWU', 'REQUEST_HUMAN_DECISION'],
					remediationRules: [{ remediationActions: ['REQUEST_HUMAN_DECISION'] }]
				})
			)
		);
		// Narrow permitted to RESHAPE_PWU only, WITHOUT resupplying remediationRules — the existing rule's
		// REQUEST_HUMAN_DECISION is now ungoverned, so the edit must fail closed against the EFFECTIVE (existing) rules.
		const r = engine.dispatch(
			cmd('EditAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				permittedControlActions: ['RESHAPE_PWU']
			})
		);
		expect(r.status).toBe('REJECTED');
		const state = store.loadObject(POLICY)?.state as { permittedControlActions?: string[] };
		expect(state.permittedControlActions).toEqual(['RESHAPE_PWU', 'REQUEST_HUMAN_DECISION']);
	});

	it('#5 remediationRules EDIT-PATH: adding a valid remediation rule round-trips (settable on edit)', () => {
		dispatchOk(
			cmd(
				'CreateAssurancePolicy',
				POLICY,
				'ASSURANCE_POLICY',
				basePolicy({ permittedControlActions: ['RESHAPE_PWU'] })
			)
		);
		dispatchOk(
			cmd('EditAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				remediationRules: [
					{ trigger: 't', remediationActions: ['RESHAPE_PWU'], appliesToFindingCodes: ['UNFIT'] }
				]
			})
		);
		const state = store.loadObject(POLICY)?.state as {
			remediationRules?: Array<{ remediationActions?: string[] }>;
		};
		expect(state.remediationRules).toHaveLength(1);
		expect(state.remediationRules?.[0]?.remediationActions).toEqual(['RESHAPE_PWU']);
	});

	it('#1b escalationRules EDIT-PATH: a non-CRITICAL escalateOnOpenSeverities is rejected on edit too', () => {
		dispatchOk(
			cmd(
				'CreateAssurancePolicy',
				POLICY,
				'ASSURANCE_POLICY',
				basePolicy({ permittedControlActions: ['RESHAPE_PWU'] })
			)
		);
		const r = engine.dispatch(
			cmd('EditAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				escalationRules: [
					{
						trigger: 'x',
						escalationTarget: 'SECURITY_REVIEWER',
						requiredPackage: ['decision', 'subject', 'evidence'],
						escalateOnOpenSeverities: ['MATERIAL'] // not CRITICAL — the shortcut refuses it
					}
				]
			})
		);
		expect(r.status).toBe('REJECTED');
	});

	it('#1b EDIT-PATH ordering: editing a NONEXISTENT policy fails on existence, not on a bad escalation payload (content validation runs after loadOrReject)', () => {
		const ABSENT = 'pol_01ARZ3NDEKTSV4RRFFQ69G5ABS';
		const r = engine.dispatch(
			cmd('EditAssurancePolicy', ABSENT, 'ASSURANCE_POLICY', {
				policyId: ABSENT,
				escalationRules: [
					{
						trigger: 'x',
						escalationTarget: 'SECURITY_REVIEWER',
						requiredPackage: ['decision', 'subject', 'evidence'],
						escalateOnOpenSeverities: ['BLOCKING'] // also invalid — but existence must be reported first
					}
				]
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('does not exist');
	});
});

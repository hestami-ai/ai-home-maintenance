// JAN-DISPIND DI-01 — a DISPOSITION RULE's independence demand is read, and CONJOINED with the policy's.
//
// ⭑⭑ THE OBSERVATION WAS ALREADY DRIVEN AND RECORDED. `docs/tracking/w3b/invariant-verdicts.ndjson`
// `limb:ASR-2:6`, arrangement **L4e**: *"dispositionRules[SATISFIED].requiredIndependence = DIFFERENT_AGENT, no
// producer supplied → status = ACCEPTED, assessmentState = SATISFIED"*. Its `owed` field records the filing this
// slice discharges: *"a policy may demand independence for a specific disposition and no code reads the field,
// so the demand is inert (census: 2 hits, zero readers)."* The field was discarded by the policy NARROWING at
// the load, so no downstream line could have read it even in principle.
//
// ⛔ AND THE RECORDED REMEDY WAS WRONG. It said *"take the STRONGEST of the policy-level requirement and any
// matched rule's demand."* There is no strongest: `checkIndependence` is a flat switch of SINGLE-DIMENSION
// equality tests — `DIFFERENT_AGENT` compares `agentId` only, `DIFFERENT_MODEL` compares `modelId` only. That is
// the same fact `REG-F-357` recorded when it refuted *"DIFFERENT_PROVIDER is a stronger rung"*. Ranking two
// orthogonal demands DROPS one of them, so they are CONJOINED.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-07T00:00:00Z';
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69G5DSP';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5SUB';

describe('DI-01 — DispositionRule.requiredIndependence is read and conjoined', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
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
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload
		};
	};

	const dispatchOk = (command: DomainCommand): void => {
		const r = engine.dispatch(command);
		if (r.status !== 'ACCEPTED')
			throw new Error(`${command.commandType}: ${JSON.stringify(r.error)}`);
	};

	/** A policy whose independence may be declared at the POLICY level, the DISPOSITION-RULE level, or both. */
	function createPolicy(
		independenceRequirement: string,
		dispositionRules: readonly Record<string, unknown>[] = []
	): void {
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Disposition-scoped independence policy',
				purpose: 'Demand independence for a specific disposition',
				rationale: 'A SATISFIED verdict may warrant independence a weaker verdict does not.',
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
				dispositionRules,
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

	function assess(id: string): void {
		dispatchOk(
			cmd('RequestAssuranceAssessment', id, 'ASSURANCE_ASSESSMENT', {
				assessmentId: id,
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			})
		);
		dispatchOk(cmd('BeginAssuranceAssessment', id, 'ASSURANCE_ASSESSMENT', {}));
	}

	/** Complete with a SATISFIED recommendation. Identities are parameterised so each dimension can be varied. */
	function complete(
		id: string,
		producer: Record<string, unknown> | undefined,
		evaluator: Record<string, unknown>
	) {
		return engine.dispatch(
			cmd('CompleteAssuranceAssessment', id, 'ASSURANCE_ASSESSMENT', {
				...(producer ? { producer } : {}),
				validatorResult: {
					validatorId: 'reviewer',
					validatorVersion: '1',
					policyId: POLICY,
					policyVersion: '1.0.0',
					assessmentId: id,
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
					executionProvenance: { evaluator }
				}
			})
		);
	}

	const stateOf = (id: string) =>
		(store.loadObject(id)?.state as { assessmentState?: string } | undefined)?.assessmentState;
	const violation = () =>
		store.readAllEvents().find((e) => e.eventType === 'AssuranceIndependenceViolated')?.payload as
			{ independenceRequirement?: string; reason?: string } | undefined;

	// ⚠ `ActorReference` IS A strictObject WITH NO `agentId` — `actorReferenceToIdentity` (`:1761`) maps
	// `agentId: a.actorId`, so DIFFERENT_AGENT compares `actorId` and DIFFERENT_MODEL compares `modelId`. These
	// three fixtures vary exactly one dimension at a time, which is what makes the conjunction testable:
	//   A vs B  → different actor, SAME model
	//   A vs A2 → SAME actor, different model
	const AGENT_A = {
		actorId: 'agent-a',
		actorType: 'AGENT',
		displayName: 'Agent A',
		modelId: 'model-x'
	};
	const AGENT_A2 = {
		actorId: 'agent-a',
		actorType: 'AGENT',
		displayName: 'Agent A, other model',
		modelId: 'model-y'
	};
	const AGENT_B = {
		actorId: 'agent-b',
		actorType: 'AGENT',
		displayName: 'Agent B',
		modelId: 'model-x'
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
	});

	it('⭑⭑ L4e REPRODUCED — a rule-level demand now BITES where it was inert', () => {
		// The driven observation this slice discharges: the policy itself demands NOTHING, the SATISFIED rule
		// demands DIFFERENT_AGENT, and the same agent produced and evaluated. Before this slice: ACCEPTED,
		// assessmentState SATISFIED. THE MUTANT: drop `requiredIndependence` from the policy narrowing.
		createPolicy('NONE', [
			{ disposition: 'SATISFIED', condition: {}, requiredIndependence: 'DIFFERENT_AGENT' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D01';
		assess(id);
		expect(complete(id, AGENT_A, AGENT_A).status).toBe('ACCEPTED');
		expect(stateOf(id)).toBe('INDEPENDENCE_VIOLATION');
		expect(violation()?.independenceRequirement).toBe('DIFFERENT_AGENT');
	});

	it('⛔⛔ THE CONJUNCTION — a rule demand on a DIFFERENT dimension is not swallowed by the policy demand', () => {
		// ⭑ THIS IS THE TEST "TAKE THE STRONGEST" FAILS. The policy demands DIFFERENT_AGENT and the rule demands
		// DIFFERENT_MODEL. The agents DIFFER, so the policy's demand is satisfied — and a ranking implementation
		// would stop there. The models are the SAME, so the rule's demand is violated and the assessment must not
		// be SATISFIED. Ranking two orthogonal single-dimension checks drops one of them.
		createPolicy('DIFFERENT_AGENT', [
			{ disposition: 'SATISFIED', condition: {}, requiredIndependence: 'DIFFERENT_MODEL' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D02';
		assess(id);
		expect(complete(id, AGENT_A, AGENT_B).status).toBe('ACCEPTED'); // agent-a vs agent-b, both model-x
		expect(stateOf(id)).toBe('INDEPENDENCE_VIOLATION');
		expect(violation()?.independenceRequirement, 'the RULE-level demand is what failed').toBe(
			'DIFFERENT_MODEL'
		);
	});

	it('⛔ and the other way round — the POLICY demand still bites when the rule demand is met', () => {
		// The mirror arrangement, so "conjunction" cannot be satisfied by only ever checking the rule. Models
		// differ (the rule is met); agents are the same (the policy is violated).
		createPolicy('DIFFERENT_AGENT', [
			{ disposition: 'SATISFIED', condition: {}, requiredIndependence: 'DIFFERENT_MODEL' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D03';
		assess(id);
		expect(complete(id, AGENT_A, AGENT_A2).status).toBe('ACCEPTED'); // same agent-a, model-x vs model-y
		expect(stateOf(id)).toBe('INDEPENDENCE_VIOLATION');
		expect(violation()?.independenceRequirement).toBe('DIFFERENT_AGENT');
	});

	it('⚠ the reason names WHICH demand failed and WHERE it came from — but only when there are two', () => {
		// A reason a reader cannot act on is the silent omission `PER-9` forbids one layer up. ⭑ The suffix
		// appears only under ambiguity: with a single demand the existing message is complete and
		// `assurance-independence.test.ts:249` pins it, so appending unconditionally would change a message on a
		// path this slice does not touch.
		createPolicy('DIFFERENT_AGENT', [
			{ disposition: 'SATISFIED', condition: {}, requiredIndependence: 'DIFFERENT_MODEL' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D04';
		assess(id);
		complete(id, AGENT_A, AGENT_B);
		expect(violation()?.reason).toBe(
			'same model (DIFFERENT_MODEL required by the SATISFIED disposition rule)'
		);
	});

	it('⭑ CONTROL — the rule demand SATISFIED completes normally; this is not "refuse everything"', () => {
		// ⛔ Without this, every assertion above is satisfiable by an implementation that violates unconditionally.
		createPolicy('NONE', [
			{ disposition: 'SATISFIED', condition: {}, requiredIndependence: 'DIFFERENT_AGENT' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D05';
		assess(id);
		expect(complete(id, AGENT_A, AGENT_B).status).toBe('ACCEPTED');
		expect(stateOf(id)).toBe('SATISFIED');
		expect(violation()).toBeUndefined();
	});

	it('⭑ CONTROL — a rule for a DIFFERENT disposition does not apply', () => {
		// The rule is matched on the RECOMMENDED disposition, the same predicate Gate C uses (`:1881`). THE
		// MUTANT: take the first rule in the array — a policy's REJECTED rule would then govern a SATISFIED
		// verdict, and two gates would select different rules from one array.
		createPolicy('NONE', [
			{ disposition: 'REJECTED', condition: {}, requiredIndependence: 'DIFFERENT_AGENT' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D06';
		assess(id);
		expect(complete(id, AGENT_A, AGENT_A).status).toBe('ACCEPTED');
		expect(stateOf(id)).toBe('SATISFIED');
	});

	it('⭑ CONTROL — a policy with NO disposition rules behaves exactly as before', () => {
		// The population every shipped policy is in. This slice must be invisible to it.
		createPolicy('NONE');
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D07';
		assess(id);
		expect(complete(id, AGENT_A, AGENT_A).status).toBe('ACCEPTED');
		expect(stateOf(id)).toBe('SATISFIED');
	});

	it('⚠ DISCLOSED — the rule-level demand is exactly as DODGEABLE as the policy-level one', () => {
		// ⛔ THIS SLICE DOES NOT CLOSE THE `producer`-OMISSION DODGE, and pinning that here is the honest
		// alternative to letting a reader assume otherwise. The gate conjoins `&& producer && evaluator`; omit
		// the producer and no check runs, for a rule-level demand exactly as for a policy-level one.
		//
		// ⭑ THE FALL-THROUGH IS DELIBERATE AND PINNED ELSEWHERE (`assurance-independence.test.ts:298`, *"the
		// chosen gate"*) — overturning it turns on whether UNVERIFIED counts as NOT SATISFIED under §8.4, against
		// §13.3's *"fail closed on missing identity"* which this same handler already applies to a different
		// operand. That is a sponsor question, recorded rather than decided here. This test pins TODAY's
		// behaviour so a future change to it is deliberate and visible.
		createPolicy('NONE', [
			{ disposition: 'SATISFIED', condition: {}, requiredIndependence: 'DIFFERENT_AGENT' }
		]);
		const id = 'asm_01ARZ3NDEKTSV4RRFFQ69G5D08';
		assess(id);
		expect(complete(id, undefined, AGENT_A).status).toBe('ACCEPTED');
		expect(stateOf(id), 'unverified, not violated — the disclosed residual').toBe('SATISFIED');
		expect(violation()).toBeUndefined();
	});
});

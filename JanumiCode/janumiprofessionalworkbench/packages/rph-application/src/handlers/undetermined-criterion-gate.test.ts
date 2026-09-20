// ⭐⭐ `JAN-CRITREAD` `CR-03` — GATE E: `RPH-ASR-005` reaches the COMMAND path at last.
//
// Canon states the rule as an absolute with no policy override: *"Unable-to-determine is never treated as met."*
// The kernel has always derived mandatoriness correctly, and `completeAssuranceAssessment` never read criterion
// RESULTS at all — its four gates read permitted control actions, forbidden open severities, escalation rules
// and mandatory EVIDENCE. None asked what the criteria came back as.
//
// ⛔ IT FOLDS THE RECORDED EVENTS, NOT `validatorResult.claimResults`, AND THAT IS `REG-F-420` APPLIED. A gate
// on that field would refuse the floor's own SATISFIED path, because §20 routes per-criterion results through a
// CLAIM id and a floor assessment carries `claimIds: []`. §32's `recordCriterionResult` is the claim-less route,
// built in `CB-02`; these events are what this gate reads.
//
// ⚠ SO THE REGISTER'S OWN `RPH-ASR-005` ADMISSION IS UNAFFECTED AND STAYS ADMITTED. Its arrangement expresses
// the rule through `claimResults`, a channel no production path populates and whose element shape is a declared
// placeholder. That row is about a different channel, and flipping it on the strength of this gate would be
// claiming a rule this engine performs at one of the two places it can be expressed.
//
// ⭑ AND THE GATE IS A CROSS-CHECK, NOT A DUPLICATE. `dispositionFromFindings` already folds an undetermined
// mandatory criterion to INCONCLUSIVE on the FLOOR path, so the pairing refused here cannot arise there. What
// this adds is the command surface: a validator that computes its own disposition and recommends SATISFIED
// while reporting an undetermined mandatory criterion used to be taken at its word.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-09-20T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5E00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5E01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5E02';
const POLICY = 'pol_undetermined_gate';

const EVALUATOR: ActorReference = { actorId: 'reviewer-e', actorType: 'AGENT', displayName: 'Reviewer' };

/** ⭑ TWO CRITERIA, ONE BLOCKING AND ONE ADVISORY, BECAUSE THE DISCRIMINATION IS THE POINT. A gate that refused
 *  on ANY undetermined criterion would pass every test below except the advisory control — which is exactly
 *  why that control exists. Mandatoriness is DERIVED from `severityIfNotMet`, never declared by the result. */
const criterion = (id: string, severity: string) => ({
	id,
	name: id,
	description: `criterion ${id}`,
	criterionType: 'QUALITATIVE',
	evaluationMethod: 'HUMAN_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet: severity,
	mayBeNotApplicable: false
});

const validatorResult = (disposition: string) => ({
	validatorId: 'v.undetermined',
	validatorVersion: '1',
	policyId: POLICY,
	policyVersion: '1.0.0',
	assessmentId: ASSESS,
	subjectObjectIds: [PWU],
	subjectSemanticVersions: { [PWU]: 1 },
	claimResults: [],
	evidenceConsideredIds: [],
	evidenceRejected: [],
	observations: [],
	dispositionRecommendation: disposition,
	recommendedControlActions: [],
	residualUncertainty: [],
	limitations: [],
	executionProvenance: {}
});

describe('⛔ GATE E — a positive disposition may not stand over an UNDETERMINED mandatory criterion', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-e',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		});
	};

	const record = (criterionId: string, result: string) =>
		dispatch('RecordCriterionResult', { criterionId, result });

	const complete = (disposition: string) =>
		dispatch('CompleteAssuranceAssessment', { validatorResult: validatorResult(disposition) });

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
		seedPolicy(engine, POLICY, {
			criteria: [
				criterion('C-BLOCKING', 'BLOCKING'),
				criterion('C-BLOCKING-2', 'CRITICAL'),
				criterion('C-ADVISORY', 'ADVISORY')
			]
		});
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			{ targetAggregateId: INTENT, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'T',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'LOW',
					uncertainty: 'LOW',
					irreversibility: 'LOW',
					securitySensitivity: 'NONE',
					regulatoryExposure: 'NONE'
				}
			},
			{ targetAggregateId: PWU, targetAggregateType: 'PROFESSIONAL_WORK_UNIT' }
		);
		dispatch('RequestAssuranceAssessment', {
			assessmentId: ASSESS,
			assurancePolicyId: POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
		expect(dispatch('SelectAssuranceEvaluator', { evaluator: EVALUATOR }).status).toBe('ACCEPTED');
		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
	});

	it('⭐ CONTROL — every mandatory criterion MET completes to SATISFIED', () => {
		// ⛔ WITHOUT THIS, EVERY REFUSAL BELOW PASSES FOR A GATE THAT REFUSES UNCONDITIONALLY — the shape a
		// refusal-based remedy ships most often.
		expect(record('C-BLOCKING', 'MET').status).toBe('ACCEPTED');
		const r = complete('SATISFIED');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((store.loadObject(ASSESS)?.state as Record<string, unknown>).assessmentState).toBe('SATISFIED');
	});

	it('⛔ refuses SATISFIED over an UNDETERMINED mandatory criterion, and NAMES it', () => {
		// THE MUTANT: delete the gate. This is `RPH-ASR-005`'s registered arrangement, expressed through the
		// channel the engine actually populates.
		expect(record('C-BLOCKING', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		const r = complete('SATISFIED');

		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message, 'the refusal must name the criterion it refused on').toContain('C-BLOCKING');
		expect(r.error?.message).toContain('UNABLE_TO_DETERMINE');
		expect(
			(store.loadObject(ASSESS)?.state as Record<string, unknown>).assessmentState,
			'a refused completion moved the machine anyway'
		).toBe('ASSESSING');
	});

	it('⛔ names EVERY undetermined mandatory criterion, not just the first', () => {
		// ⛔ A GATE THAT NAMED ONLY THE FIRST WOULD PASS EVERY OTHER TEST IN THIS FILE, because each of them
		// leaves exactly one criterion undetermined. The remedy for this refusal is to DETERMINE the named
		// criteria, so a refusal naming one of two sends the evaluator back for a second refusal it could have
		// been told about the first time.
		//
		// ⭑ AND `C-BLOCKING-2` IS **CRITICAL**, NOT BLOCKING. `BLOCKING_SEVERITIES` holds both, and a gate that
		// hardcoded the string 'BLOCKING' would pass every test above and miss this one — the same
		// derive-from-the-ratified-set discipline `R25` establishes for severity.
		expect(record('C-BLOCKING', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		expect(record('C-BLOCKING-2', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		const r = complete('SATISFIED');

		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('C-BLOCKING,');
		expect(r.error?.message, 'the second undetermined criterion was not named').toContain('C-BLOCKING-2');
		// ⭑ And the refusal reads as English in both arities — 'criteria' here, 'criterion' in the single case
		// above. A message a professional has to parse twice is a message that gets skimmed.
		expect(r.error?.message).toContain('mandatory criteria [');
		expect(r.error?.targetObjectIds, 'the refusal must target every criterion it names').toEqual([
			ASSESS,
			'C-BLOCKING',
			'C-BLOCKING-2'
		]);
	});

	it('⛔ refuses CONDITIONALLY_SATISFIED too — both positive dispositions are gated', () => {
		// ⭑ `POSITIVE_DISPOSITIONS` holds two members, and a gate keyed on the string 'SATISFIED' would pass the
		// test above and admit this one.
		expect(record('C-BLOCKING', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		expect(complete('CONDITIONALLY_SATISFIED').status).toBe('REJECTED');
	});

	it('⭐ CONTROL — INCONCLUSIVE over the SAME undetermined criterion is ACCEPTED', () => {
		// ⛔ THE OVER-REFUSAL CONTROL, AND IT IS THE ONE THIS GATE COULD MOST EASILY GET WRONG. Gate A's docblock
		// settles the principle: *"escalating or rejecting BECAUSE evidence is insufficient is the correct
		// response, not a blocked one."* An assessment that goes INCONCLUSIVE BECAUSE a criterion is undetermined
		// is this rule WORKING. Gating it would refuse the right answer.
		expect(record('C-BLOCKING', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		const r = complete('INCONCLUSIVE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((store.loadObject(ASSESS)?.state as Record<string, unknown>).assessmentState).toBe('INCONCLUSIVE');
	});

	it('⭐ an ADVISORY criterion left undetermined does NOT block — mandatoriness comes from the POLICY', () => {
		// ⛔ THE DISCRIMINATION TEST. A gate that refused on ANY undetermined criterion would pass every other
		// test in this file. `R25`: mandatoriness is DERIVED from the policy's `severityIfNotMet`, and the judged
		// party does not set its own stakes — the recorded result carries no severity at all, by design.
		expect(record('C-BLOCKING', 'MET').status).toBe('ACCEPTED');
		expect(record('C-ADVISORY', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		const r = complete('SATISFIED');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('⭐ a policy declaring NOTHING mandatory is untouched by this gate — which is the DEMO’s own shape', () => {
		// ⛔ THE EARLY EXIT, AND IT IS NOT A MICRO-OPTIMISATION: it is the reason this gate could ship without
		// touching the running demo. `demo-policy.ts` declares a single criterion at MATERIAL, so its mandatory
		// set is EMPTY and the gate returns before reading a single event. ⭑ `REG-F-420` measured that the demo
		// lane's escape from the coverage gate rests on that same one severity value — an accident, recorded as
		// one — so the shape deserves a test of its own rather than being inferred from the ADVISORY case above,
		// whose policy still declares one BLOCKING criterion.
		const ADVISORY_ONLY = 'pol_nothing_mandatory';
		const ASSESS2 = 'assess_01ARZ3NDEKTSV4RRFFQ69G5E03';
		seedPolicy(engine, ADVISORY_ONLY, { criteria: [criterion('C-ONLY', 'MATERIAL')] });
		const at = (payload: unknown, type: string) =>
			dispatch(type, payload, { targetAggregateId: ASSESS2 });
		expect(
			at(
				{
					assessmentId: ASSESS2,
					assurancePolicyId: ADVISORY_ONLY,
					policyVersion: '1.0.0',
					subjectObjectIds: [PWU],
					subjectSemanticVersions: { [PWU]: 1 },
					claimIds: []
				},
				'RequestAssuranceAssessment'
			).status
		).toBe('ACCEPTED');
		expect(at({ evaluator: EVALUATOR }, 'SelectAssuranceEvaluator').status).toBe('ACCEPTED');
		expect(at({}, 'BeginAssuranceAssessment').status).toBe('ACCEPTED');
		expect(
			at({ criterionId: 'C-ONLY', result: 'UNABLE_TO_DETERMINE' }, 'RecordCriterionResult').status
		).toBe('ACCEPTED');

		const r = at(
			{ validatorResult: { ...validatorResult('SATISFIED'), policyId: ADVISORY_ONLY, assessmentId: ASSESS2 } },
			'CompleteAssuranceAssessment'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('⭐ a later determination SUPERSEDES an earlier UNABLE_TO_DETERMINE', () => {
		// ⚠ THE FOLD HAS TO SAY WHICH RECORDING COUNTS, because the handler permits a criterion to be recorded
		// more than once and each recording is its own durable event. Latest wins: the reverse reading would let
		// a stale undetermined result block a verdict the evaluator has since reached, which would make the
		// rule punish the act of revisiting a judgement.
		expect(record('C-BLOCKING', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		expect(record('C-BLOCKING', 'MET').status).toBe('ACCEPTED');
		const r = complete('SATISFIED');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('⛔ and the reverse order still blocks — a later UNDETERMINED supersedes an earlier MET', () => {
		// The other half of the same rule, and the half a "first wins" fold would get wrong.
		expect(record('C-BLOCKING', 'MET').status).toBe('ACCEPTED');
		expect(record('C-BLOCKING', 'UNABLE_TO_DETERMINE').status).toBe('ACCEPTED');
		expect(complete('SATISFIED').status).toBe('REJECTED');
	});
});

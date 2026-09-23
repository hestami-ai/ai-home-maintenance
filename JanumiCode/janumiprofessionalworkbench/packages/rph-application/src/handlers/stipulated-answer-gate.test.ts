// ⭐ GATE E'S ONE ADMITTING BRANCH (`JAN-CRITREAD` J1-1c; `REG-D-071` Q5 (a)).
//
// Gate E refuses a positive disposition over a mandatory criterion recorded `UNABLE_TO_DETERMINE` — canon's
// *"Unable-to-determine is never treated as met"* (`undetermined-criterion-gate.test.ts`). In an engine built to
// admit them — never durable, by the `Engine`'s own refusal — a row whose LATEST recording carries
// `stipulated: 'MET'` is not held against the completion, and ONLY under `floor.reasoning-review`.
//
// Every limb of that sentence has a test here, and each is the victim of the mutant that deletes it: the flag,
// the policy scope, and "latest wins" applied to the stipulation as well as the result.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedFloorPolicies, seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-09-23T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5J00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5J01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5J02';
const RR = 'floor.reasoning-review';
const OTHER = 'pol_not_the_reasoning_review';
const EVALUATOR: ActorReference = {
	actorId: 'standin-reviewer',
	actorType: 'AGENT',
	displayName: 'Stand-in',
	modelId: 'standin'
};
/** Two criteria of the policy under test: the reasoning review's own (seeded from `FLOOR_POLICY_DEFINITIONS`, all
 *  BLOCKING), or the two a plain seeded policy declares. */
const CRITERIA: Record<string, readonly [string, string]> = {
	[RR]: ['RR-04-no-proxy-satisfaction', 'RR-09-no-completeness-from-existence'],
	[OTHER]: ['C-A', 'C-B']
};

const criterion = (id: string) => ({
	id,
	name: id,
	description: `criterion ${id}`,
	criterionType: 'QUALITATIVE',
	evaluationMethod: 'MODEL_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet: 'BLOCKING',
	mayBeNotApplicable: false
});

/** An ASSESSING assessment under `policyId`, in an engine that does or does not admit stipulations. */
function arrange(policyId: string, admitStipulatedAnswers: boolean) {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine: AuthedEngine = new Engine({
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `evt_${++seq}`,
		admitStipulatedAnswers
	}).as(TEST_CRED.human);
	const dispatch = (commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-stip',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		});
	};
	// ⚠ A FLOOR POLICY IS BORN ACTIVE AND LOCKED, so it is seeded the way the floor seeds it — created, never
	// activated (the plain seeder's Activate is refused for a `floor.*` id).
	if (policyId === RR) seedFloorPolicies(engine);
	else seedPolicy(engine, policyId, { criteria: [criterion('C-A'), criterion('C-B')] });
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
	expect(
		dispatch('RequestAssuranceAssessment', {
			assessmentId: ASSESS,
			assurancePolicyId: policyId,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		}).status,
		'arrangement: the assessment exists'
	).toBe('ACCEPTED');
	expect(dispatch('SelectAssuranceEvaluator', { evaluator: EVALUATOR }).status).toBe('ACCEPTED');
	expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');

	const [judgedId, stipulatedId] = CRITERIA[policyId]!;
	/** `'A'` is the criterion the checker judged; `'B'` the one the test stipulates. */
	const record = (which: 'A' | 'B', result: string, stipulated?: 'MET') =>
		dispatch('RecordCriterionResult', {
			criterionId: which === 'A' ? judgedId : stipulatedId,
			result,
			...(stipulated ? { stipulated } : {})
		});
	const completeSatisfied = () =>
		dispatch('CompleteAssuranceAssessment', {
			validatorResult: {
				validatorId: 'standin.reasoning-review',
				validatorVersion: '1',
				policyId,
				policyVersion: '1.0.0',
				assessmentId: ASSESS,
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimResults: [],
				evidenceConsideredIds: [],
				evidenceRejected: [],
				observations: [],
				dispositionRecommendation: 'SATISFIED',
				recommendedControlActions: [],
				residualUncertainty: [],
				limitations: [],
				executionProvenance: {}
			}
		});
	const state = () => (store.loadObject(ASSESS)?.state as Record<string, unknown>).assessmentState;
	return { record, completeSatisfied, state, stipulatedId };
}

describe('⭐ GATE E admits a stipulated remainder — in an admitting engine, under the reasoning review, and nowhere else', () => {
	it('⭐ an admitting engine completes SATISFIED over a judged row and a stipulated one', () => {
		// PREDICTED RED BEFORE J1-1c: Gate E refuses — the stipulated row is UNABLE_TO_DETERMINE.
		const a = arrange(RR, true);
		expect(a.record('A', 'MET').status).toBe('ACCEPTED');
		expect(a.record('B', 'UNABLE_TO_DETERMINE', 'MET').status).toBe('ACCEPTED');
		const r = a.completeSatisfied();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(a.state()).toBe('SATISFIED');
	});

	it('⛔ an engine NOT built to admit them refuses the same completion, naming the stipulated row', () => {
		// THE MUTANT: ignore the flag. Every production engine would then satisfy the floor on answers nobody gave.
		const a = arrange(RR, false);
		a.record('A', 'MET');
		a.record('B', 'UNABLE_TO_DETERMINE', 'MET');
		const r = a.completeSatisfied();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain(a.stipulatedId);
	});

	it('⛔ an admitting engine still refuses a stipulated row under ANY OTHER policy', () => {
		// THE MUTANT: drop the policy scope. The permission `REG-D-071` Q5 (a) grants is for the reasoning review.
		const a = arrange(OTHER, true);
		a.record('A', 'MET');
		a.record('B', 'UNABLE_TO_DETERMINE', 'MET');
		const r = a.completeSatisfied();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain(a.stipulatedId);
	});

	it('⛔ a stipulation SUPERSEDED by an unstipulated UNABLE_TO_DETERMINE no longer counts — latest wins, whole', () => {
		// THE MUTANT: take the union — any stipulation ever recorded for the criterion. The fold keeps the latest
		// RESULT per criterion; the stipulation must come from that same latest event.
		const a = arrange(RR, true);
		a.record('A', 'MET');
		a.record('B', 'UNABLE_TO_DETERMINE', 'MET');
		a.record('B', 'UNABLE_TO_DETERMINE');
		const r = a.completeSatisfied();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain(a.stipulatedId);
	});

	it('⭐ CONTROL — an admitting engine still refuses a mandatory row nobody stipulated', () => {
		// Admitting is not "anything goes": an unstipulated UNABLE_TO_DETERMINE is refused exactly as before.
		const a = arrange(RR, true);
		a.record('A', 'MET');
		a.record('B', 'UNABLE_TO_DETERMINE');
		expect(a.completeSatisfied().status).toBe('REJECTED');
	});
});

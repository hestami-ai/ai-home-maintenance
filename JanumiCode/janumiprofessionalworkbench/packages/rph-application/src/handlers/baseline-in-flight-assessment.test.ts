// REG-F-021 increment 0 — a baseline may NOT be promoted over an assessment that has not concluded.
//
// THE DEFECT, AND WHY IT IS FIXED BEFORE THE STATES EXIST. PromoteBaseline decided completeness inline:
//     complete = disposition !== 'ASSESSING' && disposition !== 'REQUESTED'
// The ratified §30 machine has FOUR pre-conclusion states. That exclusion named TWO. So `EVIDENCE_PENDING` and
// `READY` counted as COMPLETE, with `disposition: 'EVIDENCE_PENDING'` reported as the outcome — a baseline
// promoted over an assessment that had not begun.
//
// It is harmless TODAY only because nothing can produce those states: `requestAssuranceAssessment` creates
// directly in `ASSESSING`. It becomes live the moment REG-F-021's increment 3 lands. Fixing it in increment 0
// means the dangerous window never opens, and — the reason this file can exist at all — the fix is verifiable
// NOW, in isolation, against a hand-built assessment rather than against a half-restored state machine.
//
// HOW THE UNREACHABLE STATE IS REACHED HERE. No command produces `EVIDENCE_PENDING`, so the assessment is driven
// into it through `commitState` against the SAME store the engine reads — the seam every handler writes through,
// with the object schema and every kit invariant still applying. That is deliberately not a store poke: if the
// state were not a legal domain object, this fixture would fail rather than manufacture a scenario the engine
// could never hold.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import { commitState, makeEvent, type HandlerContext } from './kit.js';

const TS = '2026-08-04T00:00:00Z';
// ⚠ THIS MUST BE THE SESSION'S OWN PRINCIPAL, and it was `gov-1 / Governor` until 2026-08-09.
//
// REG-F-014's fix refuses a `ProposeDecision` whose declared `authority` is not the issuing actor, and this file
// dispatches as `TEST_CRED.human` = `u1 / Operator`. So both governance dispatches in the arrangement below were
// REFUSED, the authorizing decision never existed, and all four tests passed anyway — the two positive arms
// legitimately (they assert the refusal GROUND, which promotion still reaches) and the CONTROL VACUOUSLY: it
// asserts only that the message does not say `INCOMPLETE`, and a refusal about a missing decision does not.
//
// Found by the unread-refusal ratchet the moment it was revived (REG-F-097). This is REG-F-015's own shape,
// caught by REG-F-015's own instrument, in a file written after both.
const human = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'Operator' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5J00';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5J01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5J02';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5J04';
const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5J05';

const silent: Logger = {
	log: () => undefined,
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
	fatal: () => undefined,
	child: () => silent
};

describe('PromoteBaseline: an assessment that has not concluded blocks promotion (REG-F-021 increment 0)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			correlationId: 'corr-in-flight',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	/** Move the (already created) assessment into a state no command can produce, through the real write seam. */
	function forceAssessmentState(assessmentState: string) {
		const existing = store.loadObject(ASSESS);
		if (!existing) throw new Error('fixture: the assessment must exist before it can be moved');
		const prior = existing.state as Record<string, unknown>;
		const ctx: HandlerContext = {
			store,
			now: () => TS,
			newEventId: () => `evt_force_${++seq}`,
			logger: silent
		};
		const command: DomainCommand = {
			commandId: `cmd-force-${++seq}`,
			commandType: 'RequestAssuranceAssessment',
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-in-flight',
			idempotencyKey: `idem-force-${seq}`,
			payload: {}
		};
		// `startedAt` is dropped ONLY for the pre-start states — an assessment that has not started must not carry
		// the moment it started, which is exactly what increment 0's schema relaxation makes representable. For any
		// other state the field is kept, because the kit invariant REQUIRES it there.
		//
		// That is not a fixture convenience; it is this file's third witness that the invariant is live. Written
		// first as an unconditional drop, this fixture was REFUSED at `INCONCLUSIVE` with
		// "must carry [startedAt] ... has lost a fact its own state asserts" — the guard catching the test that
		// was setting up to test something else.
		const preStart = ['REQUESTED', 'EVIDENCE_PENDING', 'READY'].includes(assessmentState);
		const { startedAt: _unset, ...withoutStartedAt } = prior;
		const base = preStart
			? withoutStartedAt
			: // A concluded assessment must carry the moment it began. After increment 3 the request lands in READY
				// with NO startedAt, so a fixture jumping straight to a terminal state has to supply one — the kit
				// invariant refuses otherwise, which is how this branch came to exist.
				{ ...prior, startedAt: prior.startedAt ?? TS };
		const nextState = { ...base, assessmentState, lifecycleStatus: assessmentState };
		const event = makeEvent(ctx, command, {
			eventType: 'AssuranceAssessmentStarted',
			aggregateType: 'ASSURANCE_ASSESSMENT',
			aggregateId: ASSESS,
			aggregateRevision: existing.revision + 1,
			payload: {
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: []
			}
		});
		const r = commitState(ctx, command, {
			objectType: 'ASSURANCE_ASSESSMENT',
			aggregateId: ASSESS,
			expectedRevision: existing.revision,
			newRevision: existing.revision + 1,
			newSemanticVersion: existing.semanticVersion,
			nextState,
			event
		});
		if (r.status !== 'ACCEPTED')
			throw new Error(`fixture: could not place the assessment in ${assessmentState}: ${JSON.stringify(r.error)}`);
	}

	function promote() {
		return dispatch(
			'PromoteBaseline',
			{
				promotionDecisionId: DEC,
				expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
				requiredAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE }
		);
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		seedPolicy(engine, 'pol_arch');
		dispatch(
			'CaptureIntent',
			{
				intentId: INTENT_ID,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			},
			{ targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU_ID,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'd',
				intentId: INTENT_ID,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			},
			{ targetAggregateId: PWU_ID }
		);
		dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: []
			},
			{ targetAggregateId: ASSESS, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		dispatch(
			'ProposeDecision',
			{
				decisionType: 'PROMOTE_BASELINE',
				subjectObjectIds: [PWU_ID],
				selectedOption: 'promote',
				rationale: 'ready',
				authority: human
			},
			{ targetAggregateId: DEC, targetAggregateType: 'DECISION' }
		);
		dispatch(
			'ApproveDecision',
			{
				selectedOption: 'promote',
				rationale: 'ready',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [PWU_ID]: 1 }
			},
			{ targetAggregateId: DEC }
		);
		dispatch(
			'CreateBaseline',
			{
				baselineType: 'ARCHITECTURE',
				itemObjectIds: [PWU_ID],
				assuranceAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE, targetAggregateType: 'BASELINE' }
		);
		dispatch('SubmitBaselineForReview', {}, { targetAggregateId: BASE });
		dispatch('ApproveBaseline', {}, { targetAggregateId: BASE });

		// ── THE ARRANGEMENT MUST HAVE HAPPENED, ASSERTED POSITIVELY ──────────────────────────────────────────
		// Not "each dispatch was ACCEPTED" but "the state those dispatches exist to produce is here" — the same
		// judgement `recordFloorAssessment` makes. For two days the two governance dispatches above were refused
		// and this block arranged a baseline with NO authorizing decision; every test still passed, because each
		// asserts a REFUSAL and a differently-caused refusal looks identical. A promotion test whose decision does
		// not exist is testing the decision check, not the assessment check.
		expect(
			(store.loadObject(DEC)?.state as Record<string, string> | undefined)?.status,
			'the promotion authority must be EFFECTIVE, or every refusal below could be about its absence'
		).toBe('EFFECTIVE');
		expect(
			(store.loadObject(BASE)?.state as Record<string, string> | undefined)?.status,
			'the baseline must be APPROVED and awaiting promotion, or `promote()` refuses on its status instead'
		).toBe('APPROVED');
	});

	// THE TWO STATES THE OLD EXCLUSION MISSED. Each would have been reported COMPLETE, with the state name itself
	// standing in for a disposition.
	for (const inFlight of ['EVIDENCE_PENDING', 'READY'] as const) {
		it(`refuses promotion while the required assessment is ${inFlight}`, () => {
			forceAssessmentState(inFlight);
			// Guard the fixture: if the state did not take, the refusal below would be about something else.
			expect((store.loadObject(ASSESS)?.state as Record<string, string>).assessmentState).toBe(inFlight);

			const r = promote();

			expect(r.status).not.toBe('ACCEPTED');
			// THE DISCRIMINATING ASSERTION, and it had to be found the hard way. Asserting merely "not ACCEPTED"
			// let the OLD, defective code pass this test: with `complete` wrongly true, promotion still refused —
			// via REQUIRED_ASSESSMENT_NOT_SATISFIED, because EVIDENCE_PENDING is not SATISFIED either. The defect
			// was never that the baseline got through; it is that the refusal names the WRONG GROUND. So the
			// assertion must be on the ground, not on the outcome.
			expect(
				r.error?.message,
				`a ${inFlight} assessment has NOT COMPLETED, and RPH-BAS-004 is the rule that says so. Reporting ` +
					'NOT_SATISFIED instead tells an operator the assessment reached an adverse verdict, when in ' +
					'truth it never began — a true refusal for a false reason'
			).toContain('REQUIRED_ASSESSMENT_INCOMPLETE');
			expect((store.loadObject(BASE)?.state as Record<string, string>).status).toBe('APPROVED');
		});
	}

	it('refuses promotion while the required assessment is still ASSESSING (the arm that already worked)', () => {
		// CONTROL for the fix's SCOPE: the two states the old check DID exclude must still be refused. If this
		// reddens, the positive classification lost ground the exclusion already held.
		//
		// The request now lands in READY (increment 3), so the assessment is BEGUN to reach ASSESSING — the state
		// this arm is about.
		expect(
			dispatch('BeginAssuranceAssessment', {}, { targetAggregateId: ASSESS, targetAggregateType: 'ASSURANCE_ASSESSMENT' }).status
		).toBe('ACCEPTED');
		expect((store.loadObject(ASSESS)?.state as Record<string, string>).assessmentState).toBe('ASSESSING');
		const r = promote();
		expect(r.status).not.toBe('ACCEPTED');
	});

	it('CONTROL: a CONCLUDED assessment does NOT block on these grounds — the fix did not simply refuse everything', () => {
		forceAssessmentState('INCONCLUSIVE');
		const r = promote();
		// INCONCLUSIVE is a concluded outcome, so the "assessment incomplete" ground does not apply. Promotion may
		// still be refused for OTHER reasons (an inconclusive assessment is not a satisfied one) — what must not
		// happen is a refusal that says the assessment has not concluded.
		expect(
			r.error?.message ?? '',
			'a concluded assessment must not be reported as incomplete, or the classification has just replaced a ' +
				'fail-open bug with a fail-closed one that blocks every promotion'
		).not.toContain('INCOMPLETE');
	});
});

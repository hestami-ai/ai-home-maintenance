// REG-F-021 INCREMENT 2 — the two acts of the ratified READY -> ASSESSING arrow.
//
// §30 says the arrow is "selectAssuranceEvaluator (AssuranceEvaluatorSelected) THEN beginAssuranceAssessment
// (AssuranceAssessmentStarted)". TWO acts, ONE arrow, and only the second moves the machine. This file drives
// both against a live engine.
//
// ── WHY THE FIXTURE FORCES `READY` ────────────────────────────────────────────────────────────────────────────
// No production path reaches READY until increment 3 flips `requestAssuranceAssessment` to create in REQUESTED.
// So the assessment is placed in READY through `commitState` — the same seam every handler writes through, with
// the object schema and every kit invariant still applying. Stated rather than hidden: these commands are correct
// and, on production paths, not yet reachable. A test that pretended otherwise would be the thing this repository
// keeps catching.
//
// ── WHAT INCREMENT 2 DOES AND DOES NOT CHANGE ─────────────────────────────────────────────────────────────────
// It does NOT stop `requestAssuranceAssessment` emitting AssuranceAssessmentStarted. Until increment 3, that event
// has TWO emitters: the request (wrongly, which is REG-F-021) and this command (rightly). The last test here pins
// that overlap, so the interval is a recorded fact rather than a thing someone notices later.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import { commitState, makeEvent, type HandlerContext } from './kit.js';

const TS = '2026-08-04T00:00:00Z';
const LATER = '2026-08-05T12:00:00Z';
const REVIEWER: ActorReference = {
	actorId: 'reviewer-7',
	actorType: 'AGENT',
	displayName: 'Independent Reviewer',
	modelId: 'model-x'
};
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5K02';

const silent: Logger = {
	log: () => undefined,
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
	fatal: () => undefined,
	child: () => silent
};

describe('REG-F-021 increment 2: the READY -> ASSESSING arrow', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-ready-arrow',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	const stateOf = () => store.loadObject(ASSESS)?.state as Record<string, unknown>;
	const eventsOf = () =>
		store.readAggregateEvents('ASSURANCE_ASSESSMENT', ASSESS).map((e) => e.eventType);

	/** Place the assessment in a pre-start state no command can yet produce, through the real write seam. */
	function force(assessmentState: string) {
		const existing = store.loadObject(ASSESS);
		if (!existing) throw new Error('fixture: assessment must exist first');
		const prior = existing.state as Record<string, unknown>;
		const ctx: HandlerContext = {
			store,
			now: () => TS,
			newEventId: () => `evt_f${++seq}`,
			logger: silent
		};
		const command: DomainCommand = {
			commandId: `cmd-force-${++seq}`,
			commandType: 'RequestAssuranceAssessment',
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-ready-arrow',
			idempotencyKey: `idem-force-${seq}`,
			payload: {}
		};
		// A pre-start assessment has NOT started, so `startedAt` is dropped — increment 0's relaxation is what makes
		// this representable at all, and the kit invariant would refuse it for any non-pre-start state.
		const { startedAt: _unset, ...rest } = prior;
		const event = makeEvent(ctx, command, {
			eventType: 'AssuranceAssessmentRequested',
			aggregateType: 'ASSURANCE_ASSESSMENT',
			aggregateId: ASSESS,
			aggregateRevision: existing.revision + 1,
			payload: {
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policySemanticVersion: 1,
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
			nextState: { ...rest, assessmentState, lifecycleStatus: assessmentState },
			event
		});
		if (r.status !== 'ACCEPTED')
			throw new Error(`fixture: could not reach ${assessmentState}: ${JSON.stringify(r.error)}`);
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
			{ targetAggregateId: PWU_ID, targetAggregateType: 'PROFESSIONAL_WORK_UNIT' }
		);
		dispatch('RequestAssuranceAssessment', {
			assessmentId: ASSESS,
			assurancePolicyId: 'pol_arch',
			policyVersion: '1',
			subjectObjectIds: [PWU_ID],
			subjectSemanticVersions: { [PWU_ID]: 1 },
			claimIds: []
		});
	});

	it('CONTROL: the fixture can place the assessment in READY without a startedAt', () => {
		force('READY');
		const s = stateOf();
		expect(s.assessmentState).toBe('READY');
		expect(
			s.startedAt,
			'a READY assessment has not begun — if this carried a startedAt, every assertion about WHEN it begins ' +
				'would be measuring the fixture'
		).toBeUndefined();
	});

	// ── ACT ONE ───────────────────────────────────────────────────────────────────────────────────────────────
	it('SelectAssuranceEvaluator records WHO will assess and does NOT move the machine', () => {
		force('READY');
		const r = dispatch('SelectAssuranceEvaluator', { evaluator: REVIEWER });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const s = stateOf();
		expect(s.evaluator).toEqual(REVIEWER);
		expect(s.assessmentState, 'selecting an evaluator is a fact, not an advance').toBe('READY');
		expect(eventsOf()).toContain('AssuranceEvaluatorSelected');
		// The governance point: WHO assessed now has its own committed event. Today the evaluator arrives inside
		// the VERDICT (validatorResult.executionProvenance.evaluator) — the assessor's identity as a field of the
		// answer they produced.
		const evt = store
			.readAggregateEvents('ASSURANCE_ASSESSMENT', ASSESS)
			.find((e) => e.eventType === 'AssuranceEvaluatorSelected');
		expect((evt?.payload as { evaluator?: ActorReference }).evaluator).toEqual(REVIEWER);
		// THE VALUE, NOT MERELY ITS PRESENCE. This was `.toBeTruthy()` — and `seedPolicy(engine, 'pol_arch')` takes
		// floor-fixtures' default `independenceRequirement: 'NONE'`, so a handler that recorded the CONSTANT 'NONE'
		// instead of the policy's value is byte-identical against THIS fixture and passes either assertion. Stating
		// the exact value is strictly stronger and says what the fixture established; the arrangement that can
		// actually DISCRIMINATE needs a policy requiring something else, and lives in the next describe.
		expect(
			(evt?.payload as { independenceRequirement?: string }).independenceRequirement,
			'the requirement IN FORCE AT SELECTION is recorded, so an audit is not left comparing against whatever ' +
				'the policy happens to require now'
		).toBe('NONE');
	});

	it('SelectAssuranceEvaluator is REFUSED unless the assessment is READY', () => {
		// Drive past READY: selecting an evaluator for an assessment already ASSESSING would change the assessor
		// mid-judgment.
		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
		expect(stateOf().assessmentState).toBe('ASSESSING');
		const r = dispatch('SelectAssuranceEvaluator', { evaluator: REVIEWER });
		expect(r.status).not.toBe('ACCEPTED');
		expect(stateOf().evaluator, 'a refused selection must not land').toBeUndefined();
	});

	// ── ACT TWO ───────────────────────────────────────────────────────────────────────────────────────────────
	it('BeginAssuranceAssessment moves READY -> ASSESSING and stamps startedAt', () => {
		force('READY');
		expect(stateOf().startedAt).toBeUndefined();
		const r = dispatch('BeginAssuranceAssessment', { startedAt: LATER });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const s = stateOf();
		expect(s.assessmentState).toBe('ASSESSING');
		expect(
			s.startedAt,
			'startedAt records when assessment BEGAN, which is this act — not the moment it was requested'
		).toBe(LATER);
		expect(eventsOf()).toContain('AssuranceAssessmentStarted');
	});

	it('BeginAssuranceAssessment defaults startedAt to the command moment when none is given', () => {
		force('READY');
		const r = dispatch('BeginAssuranceAssessment', {});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stateOf().startedAt).toBe(TS);
	});

	it('BeginAssuranceAssessment is REFUSED from ASSESSING — an assessment cannot begin twice', () => {
		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
		expect(stateOf().assessmentState).toBe('ASSESSING');
		const before = stateOf().startedAt;
		const r = dispatch('BeginAssuranceAssessment', { startedAt: LATER });
		expect(r.status).not.toBe('ACCEPTED');
		expect(stateOf().startedAt, 'a refused begin must not re-stamp the start').toBe(before);
	});

	// ── THE OVERLAP, CLOSED (increment 3) ─────────────────────────────────────────────────────────────────────
	it('AssuranceAssessmentStarted now has exactly ONE emitter — the command it belongs to', () => {
		// WRITTEN IN INCREMENT 2 AS A DELIBERATE RED FOR INCREMENT 3. It asserted TWO AssuranceAssessmentStarted
		// events on one aggregate — the fused request (wrongly) and the real begin (rightly) — and said it "must go
		// red in increment 3". It did. This is what replaces it.
		//
		// WHY IT EXISTS AT ALL: the event-surface census compares its three surfaces as SETS, so an event bound to
		// the right command and FIRED BY THE WRONG ONE looks identical to a correct one. Only a per-aggregate count
		// can see the difference, which is why this assertion is here and not there.
		expect(
			eventsOf().filter((e) => e === 'AssuranceAssessmentStarted'),
			'the REQUEST must no longer emit the STARTED event — that fusion IS REG-F-021'
		).toEqual([]);
		expect(
			eventsOf(),
			'the request emits the events of the arrows it actually crosses'
		).toEqual(['AssuranceAssessmentRequested', 'AssuranceEvidenceRequired']);

		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
		expect(
			eventsOf().filter((e) => e === 'AssuranceAssessmentStarted'),
			'and beginning it emits STARTED exactly once, from the command DOC-004 §32 names for it'
		).toHaveLength(1);
	});
});

// ── WHAT INDEPENDENCE WAS REQUIRED *AT SELECTION* (JAN-PFA S3.3, REG-F-392) ────────────────────────────────────
// The promise, verbatim at the site in assurance.ts::selectAssuranceEvaluator: "The policy's requirement is
// resolved HERE and recorded on the event, so an audit reads what independence was required AT SELECTION TIME
// rather than what the policy happens to require now." DOC-004 §22 makes the audit log record the independence
// result and §38 makes the view show independence status, and `AssuranceEvaluatorSelected` is the only carrier:
// the ASSURANCE_ASSESSMENT object schema has no such field, so whatever this event says is the whole account.
//
// ⛔ WHY A SECOND describe AND NOT ONE MORE LINE ABOVE. The block above seeds `pol_arch` through
// `seedPolicy(engine, 'pol_arch')`, whose default independenceRequirement is 'NONE' (floor-fixtures.ts:165).
// Every assertion this field has ever carried was made against that fixture, where a handler recording the
// CONSTANT 'NONE' and a handler resolving the policy's requirement emit byte-identical payloads. No assertion
// there — toBeTruthy(), or even toBe('NONE') — can tell them apart. Discriminating requires a policy that
// requires something ELSE, which requires its own seed.
//
// CLOSES the JAN-PFA mutant
//     ...(policy?.independenceRequirement ? { independenceRequirement: 'NONE' } : {})
// which is schema-valid (`AssuranceEvaluatorSelectedPayloadSchema.independenceRequirement` is
// `z.string().optional()`, not the 8-value enum), present, and a lie about what was required. The CHEAP inverse —
// drop the spread, record nothing — was already killed by the `independenceRequirement` assertion above; its
// PRECISION was not.
//
// ⭐ AND EVERY ASSERTION HERE HAS A CONTROL, because the fault this closes is "the field was present" mistaken for
// "the field was right":
//   · 'NONE' is still recorded when NONE is what the policy requires — so this is not a test that the field must
//     merely differ from 'NONE', and a handler that dropped or rewrote the weakest requirement could not satisfy
//     it while the DIFFERENT_MODEL case stayed green;
//   · two policies in ONE store each have their own requirement recorded — so no constant of ANY value, including
//     the one the first test expects, can pass.
describe('SelectAssuranceEvaluator: the independence requirement in force AT SELECTION', () => {
	const POL_MODEL = 'pol_indep_model';
	const POL_HUMAN = 'pol_indep_human';
	const POL_NONE = 'pol_indep_none';
	const PWU_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K11';
	const PWU_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K12';
	const ASSESS_A = 'assess_01ARZ3NDEKTSV4RRFFQ69G5K13';
	const ASSESS_B = 'assess_01ARZ3NDEKTSV4RRFFQ69G5K14';

	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function send(
		commandType: string,
		payload: unknown,
		targetAggregateId: string,
		targetAggregateType: string
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-indep-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'corr-indep-at-selection',
			idempotencyKey: `idem-indep-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		// Every dispatch is checked: an arrangement that silently arranged NOTHING is the failure mode
		// floor-fixtures.ts's header records, and it would make every assertion below true about nothing.
		expect(r.status, `${commandType} ${targetAggregateId}: ${JSON.stringify(r.error)}`).toBe(
			'ACCEPTED'
		);
	}

	function proposePwu(pwuId: string) {
		send(
			'ProposePwu',
			{
				pwuId,
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
			pwuId,
			'PROFESSIONAL_WORK_UNIT'
		);
	}

	/**
	 * Request an assessment of `pwuId` under `policyId` and select REVIEWER as its evaluator, ENTIRELY THROUGH THE
	 * COMMAND BUS — no `force()` write seam. The handler's own REACHABILITY note is what makes that possible:
	 * `requestAssuranceAssessment` lands READY because no production policy declares requiredEvidence (REG-F-022),
	 * and READY is the one state SelectAssuranceEvaluator admits. The landing state is asserted, so if that ever
	 * stops being true this block fails loudly instead of quietly asserting over a state no command produces.
	 *
	 * Returns the committed `AssuranceEvaluatorSelected` payload — the only place the requirement is recorded.
	 */
	function selectEvaluatorFor(assessmentId: string, policyId: string, pwuId: string) {
		send(
			'RequestAssuranceAssessment',
			{
				assessmentId,
				assurancePolicyId: policyId,
				policyVersion: '1',
				subjectObjectIds: [pwuId],
				subjectSemanticVersions: { [pwuId]: 1 },
				claimIds: []
			},
			assessmentId,
			'ASSURANCE_ASSESSMENT'
		);
		expect(
			(store.loadObject(assessmentId)?.state as Record<string, unknown>).assessmentState,
			'the production request path must reach READY on its own — SelectAssuranceEvaluator admits no other state'
		).toBe('READY');
		send('SelectAssuranceEvaluator', { evaluator: REVIEWER }, assessmentId, 'ASSURANCE_ASSESSMENT');
		const evt = store
			.readAggregateEvents('ASSURANCE_ASSESSMENT', assessmentId)
			.find((e) => e.eventType === 'AssuranceEvaluatorSelected');
		if (!evt)
			throw new Error(`fixture: no AssuranceEvaluatorSelected committed for ${assessmentId}`);
		return evt.payload as { independenceRequirement?: string; evaluator?: ActorReference };
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_i${++seq}`
		}).as(TEST_CRED.human);
		send(
			'CaptureIntent',
			{
				intentId: INTENT_ID,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			},
			INTENT_ID,
			'INTENT'
		);
	});

	it('records the requirement the POLICY declares — not a constant', () => {
		// THE KILLING ASSERTION for the JAN-PFA mutant. The policy in force requires DIFFERENT_MODEL; a handler
		// recording the literal 'NONE' reports that no independence was required of an evaluator chosen under a
		// policy that demanded a different model — the §22 audit entry and the §38 view would both read the
		// opposite of the governance fact, and nothing downstream could tell, because 'NONE' is schema-valid here.
		seedPolicy(engine, POL_MODEL, { independenceRequirement: 'DIFFERENT_MODEL' });
		proposePwu(PWU_A);
		expect(
			selectEvaluatorFor(ASSESS_A, POL_MODEL, PWU_A).independenceRequirement,
			'the event must record DIFFERENT_MODEL — the requirement in force when this evaluator was chosen'
		).toBe('DIFFERENT_MODEL');
	});

	it('CONTROL: a policy requiring NONE still has NONE recorded, present and unrewritten', () => {
		// ⭐ THE CONTROL, and why it is not decoration. Without it, the test above is satisfied by a handler that
		// simply never records 'NONE' — dropping the field, or substituting a stronger-looking value — which would
		// be the mirror-image lie. A legitimate NONE is a real governance fact (most seeded policies carry it), so
		// the event must carry it too, and the key must be PRESENT rather than absent: absent means "the policy did
		// not resolve" at this site, which is a different statement from "it required nothing".
		seedPolicy(engine, POL_NONE);
		proposePwu(PWU_A);
		const recorded = selectEvaluatorFor(ASSESS_A, POL_NONE, PWU_A);
		expect(
			Object.keys(recorded),
			'an ABSENT field says the policy did not resolve; NONE says it resolved and required nothing'
		).toContain('independenceRequirement');
		expect(recorded.independenceRequirement).toBe('NONE');
	});

	it('CONTROL: two assessments under two policies each record THEIR OWN requirement', () => {
		// ⭐ THE SECOND CONTROL: it closes the constant in general, not just the one constant the mutant chose. No
		// single hard-coded value — 'NONE', 'DIFFERENT_MODEL', or any other — can satisfy both halves of this, so
		// the recorded requirement is shown to TRACK the policy the assessment cites. Same store, same selecting
		// actor, same evaluator: the policy is the only thing that differs.
		seedPolicy(engine, POL_MODEL, { independenceRequirement: 'DIFFERENT_MODEL' });
		seedPolicy(engine, POL_HUMAN, { independenceRequirement: 'HUMAN' });
		proposePwu(PWU_A);
		proposePwu(PWU_B);
		const underModel = selectEvaluatorFor(ASSESS_A, POL_MODEL, PWU_A);
		const underHuman = selectEvaluatorFor(ASSESS_B, POL_HUMAN, PWU_B);
		expect(
			[underModel.independenceRequirement, underHuman.independenceRequirement],
			'each selection records the requirement of ITS policy; one value for both would be a constant'
		).toEqual(['DIFFERENT_MODEL', 'HUMAN']);
	});

	it('AT SELECTION, not at policy creation: an edit before the selection is what gets recorded', () => {
		// The temporal half of the same sentence, and it has its own failure mode: a handler sourcing the
		// requirement from the policy's CREATION (the AssurancePolicyCreated payload, or a value cached at request
		// time) would record 'NONE' here and look correct everywhere else in this file. The policy is created
		// requiring NONE and EDITED to HUMAN — `independenceRequirement` is in EDITABLE_PATCH_FIELDS — before any
		// evaluator is chosen, so "what the policy was created with" and "what was in force at selection" differ.
		seedPolicy(engine, POL_HUMAN);
		send(
			'EditAssurancePolicy',
			{ policyId: POL_HUMAN, independenceRequirement: 'HUMAN' },
			POL_HUMAN,
			'ASSURANCE_POLICY'
		);
		expect(
			(store.loadObject(POL_HUMAN)?.state as { independenceRequirement?: string })
				.independenceRequirement,
			'the edit must have actually moved the live policy, or the two times being distinguished are the same'
		).toBe('HUMAN');
		proposePwu(PWU_A);
		expect(
			selectEvaluatorFor(ASSESS_A, POL_HUMAN, PWU_A).independenceRequirement,
			'the requirement IN FORCE at the moment of selection — not the one the policy was created with'
		).toBe('HUMAN');
	});
});

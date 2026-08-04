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
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import { commitState, makeEvent, type HandlerContext } from './kit.js';

const TS = '2026-08-04T00:00:00Z';
const LATER = '2026-08-05T12:00:00Z';
const human: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };
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
	let engine: Engine;
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
			issuedBy: human,
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
			issuedBy: human,
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
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
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
		expect(
			(evt?.payload as { independenceRequirement?: string }).independenceRequirement,
			'the requirement IN FORCE AT SELECTION is recorded, so an audit is not left comparing against whatever ' +
				'the policy happens to require now'
		).toBeTruthy();
	});

	it('SelectAssuranceEvaluator is REFUSED unless the assessment is READY', () => {
		// The assessment is ASSESSING as created. Selecting an evaluator now would change the assessor mid-judgment.
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
		expect(stateOf().assessmentState).toBe('ASSESSING');
		const before = stateOf().startedAt;
		const r = dispatch('BeginAssuranceAssessment', { startedAt: LATER });
		expect(r.status).not.toBe('ACCEPTED');
		expect(stateOf().startedAt, 'a refused begin must not re-stamp the start').toBe(before);
	});

	// ── THE INTERVAL, PINNED ──────────────────────────────────────────────────────────────────────────────────
	it('AssuranceAssessmentStarted still has TWO emitters until increment 3 — recorded, not hidden', () => {
		// The request emits it (wrongly — that IS REG-F-021: the last arrow's event at the first arrow's moment).
		expect(
			eventsOf(),
			'requestAssuranceAssessment emits the STARTED event at REQUEST time; increment 3 is what moves it'
		).toContain('AssuranceAssessmentStarted');
		// And so does the command it actually belongs to.
		force('READY');
		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
		const started = eventsOf().filter((e) => e === 'AssuranceAssessmentStarted');
		expect(
			started,
			'TWO AssuranceAssessmentStarted events on one aggregate: the fused request and the real begin. The ' +
				'event-surface census CANNOT see this — it compares the three surfaces as SETS, so an event bound ' +
				'to the right command and fired by the wrong one looks identical to one that is correct. This ' +
				'assertion is the thing that watches the overlap, and it must go red in increment 3'
		).toHaveLength(2);
	});
});

// THE FIVE PRODUCT-BEHAVIOR ACTS — Actor, Capability, User Journey, Scenario, Requirement
// (JAN-SLICE-SWP-05, REG-D-046 Ruling 2).
//
// ⚠ WHY THIS FILE IS REQUIRED AND NOT OPTIONAL. `verif/command-dispatch-census.test.ts` refuses a ratified,
// routable command whose handler has never run — *"its preconditions, its emitted payload and its event-gate
// conformance are claims nothing checks."* That census reddened naming all five the moment they were
// registered, and `event-surface-census.test.ts` reddened beside it naming all five events. The repository
// refusing a declared-but-unexercised plane is the hollow-governed-layer defect being caught rather than
// argued about, and it is the reason SWP-05 is shape AND act AND producer.
//
// ⚠⚠ EVERY REFUSAL BELOW ASSERTS ITS MESSAGE, NOT ITS CODE, AND THAT IS NOT STYLE. `JAN-CSAA` closed 64 of 65
// findings whose tests asserted an error CODE alone, because one code had 116 distinct emitters — a test that
// says "something was rejected" cannot tell WHICH guard fired, so it survives the guard being replaced by any
// other refusal. All five guards here share `RPH_INVARIANT_VIOLATION`; only the message tells them apart.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const ACTOR_ID = 'actor_01ARZ3NDEKTSV4RRFFQ69G0301';
const CAP_ID = 'cap_01ARZ3NDEKTSV4RRFFQ69G0302';
const JRNY_ID = 'jrny_01ARZ3NDEKTSV4RRFFQ69G0303';
const SCEN_ID = 'scen_01ARZ3NDEKTSV4RRFFQ69G0304';
const REQ_ID = 'req_01ARZ3NDEKTSV4RRFFQ69G0305';
const AUTHORITY = {
	authorityId: 'auth_product_modeler',
	authorityType: 'ORGANIZATIONAL_ROLE',
	scope: ['REQUIREMENTS'],
	validFrom: TS
};

describe('the W7 product-behavior plane — the five acts that mint it', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
	});

	function send(commandType: string, targetAggregateType: string, id: string, payload: unknown) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const actor = (over: Record<string, unknown> = {}) => ({
		actorId: ACTOR_ID,
		name: 'Field Technician',
		actorType: 'HUMAN',
		...over
	});
	const capability = (over: Record<string, unknown> = {}) => ({
		capabilityId: CAP_ID,
		statement: 'Scheduling and dispatch',
		refinedByRequirementIds: [],
		...over
	});
	const journey = (over: Record<string, unknown> = {}) => ({
		journeyId: JRNY_ID,
		journeyIdentity: 'Request to Completed Job',
		originatingOutcome: 'A work request becomes a completed job with recorded payment status.',
		primaryActorId: ACTOR_ID,
		supportingActorIds: [],
		trigger: 'Customer or office staff creates work request',
		preconditions: [],
		steps: ['Customer or office staff creates work request', 'Payment status is recorded'],
		decisions: [],
		alternatePaths: [],
		exceptionalPaths: ['Customer cancels.'],
		completionCondition: 'Payment status is recorded',
		failureCondition: '',
		affectedEntityIds: [],
		requiredCapabilityIds: [CAP_ID],
		evidenceOfSuccess: '',
		...over
	});
	const scenario = (over: Record<string, unknown> = {}) => ({
		scenarioId: SCEN_ID,
		statement: 'Customer cancels.',
		journeyId: JRNY_ID,
		scenarioClass: 'CANCELLATION_PATH',
		...over
	});
	const requirement = (over: Record<string, unknown> = {}) => ({
		requirementId: REQ_ID,
		statement: 'The system shall support conversion of an approved estimate into a schedulable job.',
		rationale: '',
		authority: AUTHORITY,
		sourceObjectIds: [JRNY_ID],
		priority: '',
		applicability: '',
		verificationMethod: '',
		affectedArtifactIds: [],
		dependencyIds: [],
		conflictStatus: '',
		lifecycle: '',
		requirementType: 'FUNCTIONAL',
		...over
	});

	/** The refusal message for a rejected dispatch, or '' when it was accepted. */
	function refusal(result: ReturnType<AuthedEngine['dispatch']>): string {
		return result.status === 'ACCEPTED' ? '' : (result.error?.message ?? '');
	}

	function emitted(eventType: string) {
		return store.readAllEvents().filter((e) => e.eventType === eventType);
	}

	// ── THE FIVE ACTS PRODUCE THEIR FIVE EVENTS ─────────────────────────────────────────────────────────────
	it('mints all five object types and emits one event each', () => {
		expect(send('DefineActor', 'ACTOR', ACTOR_ID, actor()).status).toBe('ACCEPTED');
		expect(send('DefineCapability', 'CAPABILITY', CAP_ID, capability()).status).toBe('ACCEPTED');
		expect(send('DefineUserJourney', 'USER_JOURNEY', JRNY_ID, journey()).status).toBe('ACCEPTED');
		expect(send('DefineScenario', 'SCENARIO', SCEN_ID, scenario()).status).toBe('ACCEPTED');
		expect(send('DefineRequirement', 'REQUIREMENT', REQ_ID, requirement()).status).toBe('ACCEPTED');

		for (const eventType of [
			'ActorDefined',
			'CapabilityDefined',
			'UserJourneyDefined',
			'ScenarioDefined',
			'RequirementDefined'
		]) {
			expect(emitted(eventType), `exactly one ${eventType}`).toHaveLength(1);
		}
	});

	// ── THE TRACEABILITY EDGES REACH THE STORE, NOT JUST THE PAYLOAD ────────────────────────────────────────
	// ⚠ THE POINT OF PROMOTING THE PLANE IS THE EDGES, so asserting only that an event fired would miss what
	// the promotion was for. Ontology §6 makes the relationships typed and traceable in terms — "Generic
	// untyped links are insufficient for authoritative reasoning" — and these are the two that cross from the
	// new plane into it: the journey REALIZES its capabilities, and the requirement traces to its source.
	it('the journey carries §6 REALIZES and the requirement carries §13 source traceability', () => {
		send('DefineUserJourney', 'USER_JOURNEY', JRNY_ID, journey());
		send('DefineRequirement', 'REQUIREMENT', REQ_ID, requirement());

		const j = emitted('UserJourneyDefined')[0]!.payload as { requiredCapabilityIds: string[] };
		expect(j.requiredCapabilityIds, 'User Journey REALIZES Capability (§6)').toEqual([CAP_ID]);

		const r = emitted('RequirementDefined')[0]!.payload as { sourceObjectIds: string[] };
		expect(r.sourceObjectIds, '§13 required property 4 — "source intent or journey"').toEqual([JRNY_ID]);
	});

	// ── THE FIVE REFUSALS, EACH ASSERTED BY ITS OWN MESSAGE ─────────────────────────────────────────────────
	it('REFUSES an unnamed actor — §5.4 defines an actor as a participant, and an unnamed one identifies no one', () => {
		expect(refusal(send('DefineActor', 'ACTOR', ACTOR_ID, actor({ name: '   ' })))).toContain(
			'An actor must be named'
		);
		expect(emitted('ActorDefined'), 'no event may be written for a refused command').toHaveLength(0);
	});

	it('REFUSES a capability with no statement — §5.6 is "an ability the product must provide"', () => {
		expect(
			refusal(send('DefineCapability', 'CAPABILITY', CAP_ID, capability({ statement: '' })))
		).toContain('A capability must state the ability it provides');
	});

	it('REFUSES a journey with no identity — §12 names it the first of fifteen required fields', () => {
		expect(
			refusal(send('DefineUserJourney', 'USER_JOURNEY', JRNY_ID, journey({ journeyIdentity: '' })))
		).toContain('A journey must carry its identity');
	});

	// ⚠ THE ONE EMPTY-ARRAY REFUSAL, AND ITS GROUND IS §5.8 RATHER THAN TASTE: a journey is "how an actor seeks
	// an outcome ACROSS INTERACTIONS", so zero steps is not an under-filled journey but a non-journey. The
	// control immediately below is what stops this reading as "empty arrays are refused" in general.
	it('REFUSES a journey with no steps — §5.8 defines a journey as interactions, and zero steps are none', () => {
		expect(refusal(send('DefineUserJourney', 'USER_JOURNEY', JRNY_ID, journey({ steps: [] })))).toContain(
			'A journey must record at least one step'
		);
	});

	it('CONTROL — the OTHER journey arrays may be empty, so the steps refusal is about steps', () => {
		// Without this, the guard above would be indistinguishable from a handler that refused any empty
		// array — and the producer depends on empty `preconditions`, `decisions` and `alternatePaths` being
		// accepted, because that is how it states what the fixture does not say without inventing content.
		expect(
			send(
				'DefineUserJourney',
				'USER_JOURNEY',
				JRNY_ID,
				journey({ preconditions: [], decisions: [], alternatePaths: [], supportingActorIds: [] })
			).status
		).toBe('ACCEPTED');
	});

	it('REFUSES a scenario naming no journey — §5.9 is "a variation OF A JOURNEY"', () => {
		expect(refusal(send('DefineScenario', 'SCENARIO', SCEN_ID, scenario({ journeyId: '' })))).toContain(
			'A scenario must name the journey it varies'
		);
	});

	it('REFUSES a requirement with no statement — §13 makes it the first required property', () => {
		expect(
			refusal(send('DefineRequirement', 'REQUIREMENT', REQ_ID, requirement({ statement: '' })))
		).toContain('A requirement must state the obligation it imposes');
	});

	// ── CONTROLS ────────────────────────────────────────────────────────────────────────────────────────────
	// CONTROL — THE REFUSALS DISCRIMINATE. Without this, a handler that rejected every payload would satisfy
	// all six refusal tests above and prove nothing about any clause.
	//
	// ⚠ EVERY GUARD ABOVE WAS DRIVEN, AND SO WAS THIS CONTROL. Disabling each of the six guards in turn
	// reddened EXACTLY its own test and no other — 6/6 SOUND — which is what makes each refusal load-bearing
	// rather than merely present. The control below was driven too, by making `defineActor` refuse
	// unconditionally: it reddens, which is what a control existing to catch a refuse-everything handler must
	// do. That mutant necessarily reddens the mint test and the reader control as well, because a handler that
	// accepts nothing breaks everything that mints an actor — so it is NOT a per-clause mutant and must not be
	// recorded as one. It proves this control is not vacuous, and that is all it proves.
	it('CONTROL — every well-formed payload is accepted, so the refusals are about their clauses', () => {
		expect(send('DefineActor', 'ACTOR', ACTOR_ID, actor()).status).toBe('ACCEPTED');
		expect(send('DefineCapability', 'CAPABILITY', CAP_ID, capability()).status).toBe('ACCEPTED');
		expect(send('DefineUserJourney', 'USER_JOURNEY', JRNY_ID, journey()).status).toBe('ACCEPTED');
		expect(send('DefineScenario', 'SCENARIO', SCEN_ID, scenario()).status).toBe('ACCEPTED');
		expect(send('DefineRequirement', 'REQUIREMENT', REQ_ID, requirement()).status).toBe('ACCEPTED');
	});

	// CONTROL — THE REFUSAL READER REALLY READS A MESSAGE. Every `toContain` above is satisfied by a reader
	// that returned the asserted substring for any input, and this repository has shipped an instrument that
	// failed exactly like its subject before. An ACCEPTED dispatch must yield the empty string.
	it('CONTROL — the refusal reader returns a message only when the command was refused', () => {
		expect(refusal(send('DefineActor', 'ACTOR', ACTOR_ID, actor())), 'accepted → no message').toBe('');
		expect(
			refusal(send('DefineActor', 'ACTOR', ACTOR_ID, actor({ name: '' }))).length,
			'refused → a real message, not an empty string that trivially "contains" nothing'
		).toBeGreaterThan(20);
	});
});

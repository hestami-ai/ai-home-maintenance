// JAN-PFA S3.3 — `blockPwu` records EVERY missing object, not merely the first.
//
// ⚠ THE FILENAME IS NOT THE ONE THE BRIEF ASSIGNED, AND THE REASON IS MEASURED RATHER THAN PREFERRED. The brief
// named `packages/rph-application/src/handlers/class-data-unavailable.slice.test.ts`. That path is RECOGNISED as
// a Journey Slice — `verif/slice-ledger.ts` RECOGNITION limb 1 is
// `^packages/[^/]+/src/(?:.+/)?[^/]+\.slice\.test\.ts$` — so the Slice Ledger parses it, demands a declaration it
// does not carry, and refuses. Driven, not inferred: with a stub at that exact path,
// `bun run scripts/slice-ledger.ts --check` (step ONE of `gate:fast`) exits 1 with
// *"slice-ledger: packages/rph-application/src/handlers/class-data-unavailable.slice.test.ts — no exported const
// named SLICE"*, and exits 0 both before and after its removal. This file is NOT a Slice: it asserts one promise
// of one handler and declares no journey, no scenario class and no cited rule, so declaring it as one to satisfy
// the parser would put a false record in a derived ledger. The `.slice.` infix is dropped; nothing else changes.
//
// ── THE PROMISE, AND WHY ONE MEMBER OF A SET IS NOT ENOUGH TO PIN IT ──────────────────────────────────────────
// `PwuBlocked.missingObjectIds` is `z.array(z.string()).optional()` — PLURAL, because a halt can lack several
// inputs at once — and the engine Slice states what the field is FOR in its own words: *"the block must name the
// object whose absence caused it — the same artifact the step refusal named, so the two records agree about one
// fact"*.
//
// ⛔ EVERY EXISTING ASSERTION ON THIS FIELD PASSES A LIST OF LENGTH ONE. `class-data-unavailable.slice.test.ts`
// blocks on `[SURVEY]`; `block-escalate.test.ts` cites nothing at all. So a handler that recorded only the FIRST
// id would have satisfied the whole repository, and the two records would silently stop agreeing about every
// blocker after the first — recovery chases one third of what is actually missing. THAT IS THE GAP THIS FILE
// CLOSES, and it is closed the only way a universal promise can be: by asserting it over the WHOLE set, and
// naming the dropped member when it fails.
//
// ── WHAT IS AND IS NOT A CONTROL HERE ────────────────────────────────────────────────────────────────────────
// The load-bearing test below would be satisfied by a handler that made the enumeration MANDATORY, or by one that
// echoed a constant list. Both are guards that "refuse everything" in the shape this promise can take, so both get
// a control, and BOTH controls are built to stay GREEN under the mutation the headline test is proved against —
// a control that reddens with the herd is not a control (`block-escalate.test.ts` demotes one of its own by name
// for exactly this).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-13T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69P3A00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69P3A10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69P3A20';
const STEP = `${PLAN}-s1`;

/**
 * The three field records the architecture step was planned to read, none of which was ever captured: the network
 * dropped mid-update and the technician could not be re-reached. THREE rather than two, deliberately — a pair is
 * killed by a truncation to one, and is NOT killed by a truncation to two, so a two-member set would pin the
 * promise only as tightly as the mutant it happened to be measured against.
 */
const SURVEY = 'art_01ARZ3NDEKTSV4RRFFQ69P3B01';
const READINGS = 'art_01ARZ3NDEKTSV4RRFFQ69P3B02';
const PHOTOS = 'art_01ARZ3NDEKTSV4RRFFQ69P3B03';
const MISSING: readonly string[] = [SURVEY, READINGS, PHOTOS];

/** An id no test sends to `BlockPwu` — the control below proves the recorded list is READ, not constant. */
const CALIBRATION = 'art_01ARZ3NDEKTSV4RRFFQ69P3B04';

describe('JAN-PFA S3.3 — BlockPwu records the WHOLE absence', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (
		commandType: string,
		payload: unknown,
		id = PWU,
		aggType = 'PROFESSIONAL_WORK_UNIT'
	) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'pfa-s33',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const lifecycle = () =>
		(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState;

	/** The `PwuBlocked` payload, PROVED to exist before any key of it is read. */
	const blockedPayload = () => {
		const events = store
			.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU)
			.filter((e) => e.eventType === 'PwuBlocked');
		expect(events.length, 'exactly one PwuBlocked must have been written').toBe(1);
		return events[0]!.payload as Record<string, unknown>;
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'intent'
		);
		ok(
			dispatch('ProposePwu', {
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: {
					inScope: ['the on-site field update'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_1', kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'HIGH',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'LOW'
				}
			}),
			'pwu'
		);
		ok(dispatch('BeginPwuShaping', {}), 'shaping');
	});

	/**
	 * The antecedent, DRIVEN rather than narrated: a plan whose one step binds three input artifacts that nobody
	 * recorded, started, and refused. Returns the refusal so the caller can read it — an unread refusal is an
	 * arrangement whose failure the test could not have noticed.
	 */
	const refuseTheStepThatNeedsThem = () => {
		ok(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{
							id: STEP,
							executionPlanId: PLAN,
							stepType: 'TRANSFORMATION',
							purpose: 'fold the field records into the architecture',
							inputBindings: MISSING.map((artifactId) => ({ artifactId, required: true })),
							outputBindings: [],
							preconditions: [],
							postconditions: [],
							stepState: 'QUEUED'
						}
					],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			),
			'propose plan'
		);
		ok(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN'), 'approve plan');
		ok(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN'),
			'activate plan'
		);
		return dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
	};

	// ── THE GAP ──────────────────────────────────────────────────────────────────────────────────────────────
	it('records EVERY object whose absence caused the halt — a block naming three blockers records three', () => {
		const refused = refuseTheStepThatNeedsThem();
		expect(refused.status, 'the block follows an actual refusal, not a supposed one').toBe('REJECTED');
		// The refusal is the OTHER of the two records that must agree. Asserted over the whole set, and by the
		// same membership rule as the block below, so neither record is pinned by one lucky member.
		const message = refused.error?.message ?? '';
		const unnamedByRefusal = MISSING.filter((id) => !message.includes(id));
		expect(
			unnamedByRefusal,
			`the step refusal must name every unresolved input; it omitted [${unnamedByRefusal.join(', ')}] from: ${message}`
		).toEqual([]);

		ok(
			dispatch('BlockPwu', {
				blockReason:
					'The on-site field records were never captured: the network was unavailable during the field update and the technician could not be reached to re-transmit them.',
				missingObjectIds: [...MISSING]
			}),
			'block naming three missing objects'
		);
		expect(
			lifecycle(),
			'the work must read BLOCKED — a halt that leaves the PWU reading EXECUTING is a halt no read model can see'
		).toBe('BLOCKED');

		const recorded = blockedPayload().missingObjectIds;
		expect(Array.isArray(recorded), 'missingObjectIds must have been recorded at all').toBe(true);
		const list = recorded as string[];

		// ⭐ THE UNIVERSAL LIMB, AND IT NAMES THE OFFENDER. A truncating handler drops the members the caller listed
		// LAST, which is precisely the population a test pinning one id cannot see.
		const dropped = MISSING.filter((id) => !list.includes(id));
		expect(
			dropped,
			`the block must name EVERY object whose absence caused it — it dropped [${dropped.join(', ')}] of the ${MISSING.length} the caller and the step refusal both named, so recovery would chase ${list.length} of ${MISSING.length} blockers and the two records would stop agreeing about the rest`
		).toEqual([]);
		// And nothing invented: the recorded list is the caller's, entire and in order.
		expect(
			list,
			'the recorded list must be the caller’s, entire and in order — neither truncated nor padded'
		).toEqual([...MISSING]);
	});

	// ── CONTROL 1: THE ENUMERATION IS STILL OPTIONAL ─────────────────────────────────────────────────────────
	// Without this, the test above is satisfied by a handler that made `missingObjectIds` REQUIRED — which would
	// make the honest case ("something is missing and we cannot say what") unreportable, the failure `blockPwu`'s
	// own header names in terms. GREEN under the truncation mutant, so it reddens for its own reason or not at all.
	it('CONTROL — an absence that cannot be itemised is still ACCEPTED, and the key is OMITTED rather than emptied', () => {
		const reason =
			'The technician is unavailable and the site cannot be re-attended within the service window; what the records would have contained is not known, so nothing can be named as missing.';
		ok(dispatch('BlockPwu', { blockReason: reason }), 'block that cannot itemise');
		expect(lifecycle()).toBe('BLOCKED');

		const payload = blockedPayload();
		expect(
			payload.blockReason,
			'the block must have been WRITTEN and carry the reason that was sent — the omission asserted next is read off a payload that would also be absent if nothing had been written'
		).toBe(reason);
		expect(
			Object.hasOwn(payload, 'missingObjectIds'),
			'the event must OMIT the key rather than carry an empty list — an empty array reads as "nothing is missing", the opposite of what this block records'
		).toBe(false);
	});

	// ── CONTROL 2: THE LIST IS READ FROM THE COMMAND, NOT CONSTANT ───────────────────────────────────────────
	// Without this, the test above is satisfied by a handler that echoed a fixed three-member list. ONE id, chosen
	// so the truncation mutant leaves this GREEN, and an id no other test sends, so a constant could not match it
	// by coincidence.
	it('CONTROL — a block naming ONE object records exactly that object, and it is the one the caller named', () => {
		ok(
			dispatch('BlockPwu', {
				blockReason: 'The calibration record for the site instrument was never filed.',
				missingObjectIds: [CALIBRATION]
			}),
			'block naming one missing object'
		);
		expect(
			blockedPayload().missingObjectIds,
			'the recorded list must be exactly what this caller sent — a handler echoing a constant would record some other set'
		).toEqual([CALIBRATION]);
	});
});

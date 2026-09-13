// JAN-PWUWP W-5 — BLOCKED and ESCALATED get named commands, and DELIBERATELY get no authority guard.
//
// Every other act this programme has named needed one. These two do not, and the difference is the point:
// JPWB-DOC-001 §5.2 reserves waiver, risk acceptance, rejection, abandonment and promotion to Governance —
// **not blocking and not escalation**. Their arrows' VERBATIM corpus triggers are facts and absences: "Missing
// information", "Runtime dependency unavailable", "Evidence impossible to obtain".
//
// ⚠ SO THE CONTROLS HERE POINT THE OTHER WAY FROM USUAL. The risk being tested is not that trouble can be
// recorded without permission — it is that some later increment ADDS permission and makes trouble harder to
// report than progress, which this repository names in terms as worse than checking neither.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { getMachine } from '@janumipwb/rph-domain';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import {
	expectPwuReplayEquivalence,
	seedPwuWorkLifecycleState_FIXTURE
} from './__tests__/pwu-fixtures.js';

const TS = '2026-08-09T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H9100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9110';
// JAN-PFA S3.4. Three evidence ids, because `unobtainableEvidenceIds` is PLURAL and a list is only
// observably a list above length one.
const EVD_A = 'evd_01ARZ3NDEKTSV4RRFFQ69H91A0';
const EVD_B = 'evd_01ARZ3NDEKTSV4RRFFQ69H91B0';
const EVD_C = 'evd_01ARZ3NDEKTSV4RRFFQ69H91C0';

describe('JAN-PWUWP W-5 — BlockPwu and EscalatePwu', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id = PWU, aggType = 'PROFESSIONAL_WORK_UNIT') => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'w5',
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
	const emitted = () =>
		store.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU).map((e) => e.eventType);
	/** The payload of this PWU's most recent `eventType`, and it FAILS rather than returning nothing when the
	 * event was never emitted — an assertion on `undefined.foo` reports the wrong defect. */
	const lastPayload = (eventType: string): Record<string, unknown> => {
		const matching = store
			.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU)
			.filter((e) => e.eventType === eventType);
		expect(matching.length, `no ${eventType} was emitted at all`).toBeGreaterThan(0);
		return matching.at(-1)!.payload as Record<string, unknown>;
	};


	const replayMatchesMaterialized = () => expectPwuReplayEquivalence(store, PWU);
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
					inScope: ['the governed work under test'],
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
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			}),
			'pwu'
		);
		ok(dispatch('BeginPwuShaping', {}), 'shaping');
	});

	// ── BlockPwu ──────────────────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS a block from SHAPING with a reason and NOTHING else cited', () => {
		ok(dispatch('BlockPwu', { blockReason: 'the upstream interface contract is not published' }), 'block');
		expect(lifecycle()).toBe('BLOCKED');
		expect(emitted(), 'the semantic event, not the generic one').toContain('PwuBlocked');
		expect(emitted()).not.toContain('PwuStateChanged');
	});

	it('REJECTS a block with no reason — the CONTRACT requires it, an unexplained halt records nothing', () => {
		const r = dispatch('BlockPwu', {});
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(lifecycle()).toBe('SHAPING');
	});

	it('ACCEPTS a block that cannot itemise what is missing — the trigger is an ABSENCE', () => {
		// `missingObjectIds` is optional on purpose. "Missing information" frequently cannot enumerate itself,
		// and requiring the list would make the honest case unreportable.
		ok(dispatch('BlockPwu', { blockReason: 'we do not yet know what we are missing' }), 'block');
		expect(lifecycle()).toBe('BLOCKED');
	});

	// ── EscalatePwu ───────────────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS an escalation from EVIDENCE_PENDING, emitting the event authored for it', () => {
		// ARRANGEMENT, NOT THE SUBJECT: EVIDENCE_PENDING sits behind the whole execution chain (a cited plan with
		// a succeeded step). The named escape hatch validates against the ratified schema AND machine before
		// writing, so it cannot arrange a shape the contract forbids.
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(
			dispatch('EscalatePwu', { escalationReason: 'the evidence cannot be obtained at any cost' }),
			'escalate'
		);
		expect(lifecycle()).toBe('ESCALATED');
		expect(emitted(), 'PwuEscalated did not exist before W-5 — this is its first emission').toContain(
			'PwuEscalated'
		);
	});

	it('REJECTS an escalation with no reason (CON-000 AX-8: a transfer of responsibility must say why)', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		expect(dispatch('EscalatePwu', {}).status).toBe('VALIDATION_FAILED');
		expect(lifecycle()).toBe('EVIDENCE_PENDING');
	});

	// ── CONTROL 1: THE SETTER IS CLOSED FOR BOTH, in the commit that minted them ──────────────────────────────
	// Predicted red for the mutant deleting either row from PWU_SEMANTIC_LIFECYCLE_COMMANDS, and only for it.
	it('CONTROL — the generic setter refuses both arrows and names the command', () => {
		const setter = (previousState: string, newState: string) =>
			dispatch('ChangePwuState', {
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			});
		expect(setter('SHAPING', 'BLOCKED').error?.message).toContain('Dispatch BlockPwu instead');
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		expect(setter('EVIDENCE_PENDING', 'ESCALATED').error?.message).toContain(
			'Dispatch EscalatePwu instead'
		);
	});

	// ── TROUBLE STAYS CHEAP TO REPORT — asserted, but NOT counted as a control ───────────────────────────────
	// ⚠ HONEST LABELLING, and the second time this programme has had to do it. This was written as "CONTROL 2"
	// on the reasoning that a future increment adding an authority conjunct would redden it and nothing else.
	// Mutation says otherwise: adding a `missingObjectIds` requirement to `BlockPwu` reddens FOUR tests — this
	// one and three accept cases, because none of them cites anything either. It reddens WITH THE HERD, so it is
	// not a control by this repository's standard. Kept because the property it states is the one most at risk
	// of quiet drift, and demoted in name so the count of real controls stays true.
	it('blocking and escalating need no decision, no evidence, no citation', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block with nothing cited');
		expect(lifecycle()).toBe('BLOCKED');
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(dispatch('EscalatePwu', { escalationReason: 'r' }), 'escalate with nothing cited');
		expect(lifecycle()).toBe('ESCALATED');
	});

	// ── CONTROL 3: THE REPLAY FOLD IS LOAD-BEARING FOR BOTH EVENTS ───────────────────────────────────────────
	// ⚠ THIS TEST EXISTS BECAUSE A MUTANT FOUND ITS ABSENCE, and it is the SECOND time this exact defect has
	// been built. W-1 added `PwuAbandoned`/`PwuRejected` as emitters and to nothing else; W-4.5 discovered it two
	// increments later, and only by accident — `BASELINED` happens to be in the reference seed. W-5 then added
	// `PwuBlocked`/`PwuEscalated` to `pwu-replay.ts` in the same commit, believing that closed it.
	//
	// It did not. Deleting BOTH fold cases left 1203 tests GREEN. The fold entries were dead code, because
	// `replay-equivalence.test.ts` walks the reference undertaking and the seed BLOCKS AND ESCALATES NOTHING —
	// the same structural blindness, one increment on. Folding in the right commit is necessary and not
	// sufficient: the fold must be DRIVEN by a test that actually emits the event.
	//
	// Predicted red for the fold mutant, and measured: 0 tests before this one, 2 after.
	it('CONTROL — a BLOCKED PWU rebuilds from its own event stream', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		replayMatchesMaterialized();
	});

	it('CONTROL — an ESCALATED PWU rebuilds from its own event stream', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(dispatch('EscalatePwu', { escalationReason: 'r' }), 'escalate');
		replayMatchesMaterialized();
	});

	// ── W-5.5: THE WAY BACK ──────────────────────────────────────────────────────────────────────────────────
	// REG-D-043 ruled the recovery ACT exists; the arrows are §8.2's in-arrows reversed. Recovery returns the
	// PWU to the state it was blocked OUT OF, so the assertion is on WHICH state it lands in, never merely that
	// it moved — a command that always resumed at SHAPING would pass "it is no longer BLOCKED".
	it.each([
		['SHAPING', 'SHAPING'],
		['PLANNED', 'PLANNED'],
		['EXECUTING', 'EXECUTING']
	] as const)('UnblockPwu returns a PWU blocked out of %s to %s', (from, expected) => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, from);
		ok(dispatch('BlockPwu', { blockReason: 'r' }), `block from ${from}`);
		expect(lifecycle()).toBe('BLOCKED');
		ok(dispatch('UnblockPwu', { recoveryReason: 'dependency restored' }), `unblock to ${expected}`);
		expect(lifecycle()).toBe(expected);
		expect(emitted()).toContain('PwuUnblocked');
	});

	it('UnblockPwu returns an ESCALATED PWU to EVIDENCE_PENDING — its ONE ratified in-arrow, so no origin is needed', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(dispatch('EscalatePwu', { escalationReason: 'r' }), 'escalate');
		ok(dispatch('UnblockPwu', { recoveryReason: 'evidence obtained after all' }), 'de-escalate');
		expect(lifecycle()).toBe('EVIDENCE_PENDING');
	});

	// ⚠ THE FAIL-CLOSED CASE, AND IT IS THE ONE THAT MATTERS MOST. A PWU blocked before `blockedFrom` existed
	// carries no origin. The only ways to produce one are to fold the event prefix — which CON-000 AX-6 forbids
	// — or to guess. So it REFUSES (AX-8).
	//
	// The arrangement seeds BLOCKED directly, committing no events, which is a FAITHFUL pre-W-5.5 history rather
	// than a doctored one: what the recovery command actually faces is a PWU sitting in BLOCKED whose stream
	// records no origin, and it must not matter whether that is because the field did not exist yet or because
	// the event is absent entirely. Both are "the record cannot say".
	it('UnblockPwu REFUSES a block that recorded no origin, rather than guessing one', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'BLOCKED');
		const r = dispatch('UnblockPwu', { recoveryReason: 'anything' });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message ?? '').toContain('ordering');
		expect(lifecycle(), 'it must stay BLOCKED rather than land somewhere plausible').toBe('BLOCKED');
	});

	it('UnblockPwu refuses a PWU that is neither BLOCKED nor ESCALATED — an UNDECLARED ARROW, not an illegal one', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EXECUTING');
		const r = dispatch('UnblockPwu', { recoveryReason: 'nothing to recover from' });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message ?? '').toContain('UNDECLARED ARROW');
		expect(lifecycle()).toBe('EXECUTING');
	});

	// ⚠ THE ARROW THAT WAS DELIBERATELY NOT ADDED. BLOCKED -> READY is not a §8.2 in-arrow reversed, and it is
	// the discriminating case proving this set was derived rather than chosen: READY is the state a caller would
	// most naturally want to resume at. A PWU blocked out of SHAPING resumes at SHAPING, never at READY.
	it('CONTROL — recovery never reaches READY, the target convenience would have added', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SHAPING');
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		ok(dispatch('UnblockPwu', { recoveryReason: 'cleared' }), 'unblock');
		expect(lifecycle(), 'SHAPING is where it was blocked from; READY is not a declared recovery target').toBe(
			'SHAPING'
		);
	});

	it('CONTROL — an unblocked PWU rebuilds from its own event stream', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'PLANNED');
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		ok(dispatch('UnblockPwu', { recoveryReason: 'cleared' }), 'unblock');
		replayMatchesMaterialized();
	});

	// ── W-5.5: THE ORIGIN IS RECORDED, NOT INFERRED ──────────────────────────────────────────────────────────
	// `PwuBlocked` carried `blockReason`, `missingObjectIds?` and a `workLifecycleState` set to BLOCKED itself —
	// so the DEDICATED arrow recorded strictly LESS than the GENERIC `PwuStateChanged`, which carries
	// `previousState`, and it dropped exactly the datum a recovery needs. The alternative was to fold the event
	// prefix at recovery time; CON-000 AX-6 forbids that — *"professional meaning is never inferred from …
	// ordering"* — so the origin is READ from the loaded aggregate and written down.
	//
	// DRIVEN FROM ALL THREE RATIFIED SOURCES, not one. A single case would be satisfied by hardcoding the
	// state that case happens to use, which is the shape of defect this file's CONTROL 3 already records.
	it.each(['SHAPING', 'PLANNED', 'EXECUTING'] as const)(
		'PwuBlocked records blockedFrom=%s — the state recovery must return to',
		(from) => {
			seedPwuWorkLifecycleState_FIXTURE(store, PWU, from);
			ok(dispatch('BlockPwu', { blockReason: 'r' }), `block from ${from}`);
			const blocked = store
				.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU)
				.filter((e) => e.eventType === 'PwuBlocked');
			expect(blocked, 'exactly one PwuBlocked').toHaveLength(1);
			expect(blocked[0]!.payload as Record<string, unknown>).toMatchObject({
				blockedFrom: from,
				workLifecycleState: 'BLOCKED'
			});
		}
	);

	// CONTROL — the field is not a constant wearing a variable's name. Every case above asserts the value it
	// seeded, so all three must differ from each other for the assertions to have distinguished anything.
	it('CONTROL — blockedFrom takes THREE distinct values across the three ratified in-arrows', () => {
		const seen = new Set<unknown>();
		for (const from of ['SHAPING', 'PLANNED', 'EXECUTING'] as const) {
			// The fixture forces the axis, so the same PWU can be walked back and re-blocked; each pass appends
			// one more PwuBlocked and the LAST is this pass's.
			seedPwuWorkLifecycleState_FIXTURE(store, PWU, from);
			ok(dispatch('BlockPwu', { blockReason: 'r' }), `block from ${from}`);
			const blocked = store
				.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU)
				.filter((e) => e.eventType === 'PwuBlocked');
			seen.add((blocked.at(-1)!.payload as Record<string, unknown>).blockedFrom);
		}
		expect(seen, 'a hardcoded origin would collapse these to one').toEqual(
			new Set(['SHAPING', 'PLANNED', 'EXECUTING'])
		);
	});

	// ── CONTROL 4: BLOCKED IS A ONE-WAY DOOR, and the machine does not advertise it ──────────────────────────
	// BLOCKED is NOT in `terminalStates`, yet its only out-arrows are ABANDONED and SUPERSEDED. The roadmap's
	// W-5 named an `UnblockPwu`; there is no arrow for one to perform. Asserted so the absence is a recorded
	// fact rather than a discovery, and so that ADDING a recovery arrow reddens here and gets noticed.
	//
	// ⚠⚠ REWRITTEN 2026-08-16 (REG-F-193), AND THE REWRITE IS THE POINT — AS WRITTEN THIS CONTROL COULD NOT
	// OBSERVE THE EVENT IT EXISTS TO NOTICE. It asserted `status === 'REJECTED'` and nothing else. W-5.5 lands
	// the four recovery arrows AND the ownership repair that keeps the generic setter off them IN THE SAME
	// COMMIT — which is the only order in which the hole never exists — so after W-5.5 all four of these are
	// STILL REJECTED and only the error CODE changes. **A status-only assertion is therefore green before the
	// change and green after it**, across the exact transition it was written to catch. Not a test pinning the
	// wrong absence: a test that cannot see.
	//
	// ⚠ AND THE REASON I BELIEVED OTHERWISE WAS BACKWARDS. I recorded that SHAPING and READY are refused by the
	// REG-F-072 OWNERSHIP guard rather than by arrow absence. They are not: ownership runs LAST (pwu.ts:1400,
	// *"an arrow that is ILLEGAL should be reported as illegal rather than as owned"*), so an unratified arrow
	// to an owned target is refused as ILLEGAL and never reaches the ownership guard at all.
	// `generic-setter-scope.test.ts` CONTROL 2 measures the analogous case (`PROPOSED -> READY`) and passes.
	//
	// SO THE CODE IS THE LOAD-BEARING ASSERTION, and the four outcomes are COLLECTED rather than asserted in
	// the loop — the old form threw on the first failure and never reached READY, so it could not have shown
	// which of the four moved.
	it('CONTROL — a BLOCKED PWU has no way back; recovery is not a missing command but a missing arrow', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		const outcomes = ['SHAPING', 'PLANNED', 'EXECUTING', 'READY'].map((back) => {
			const r = dispatch('ChangePwuState', {
				previousState: 'BLOCKED',
				newState: back,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			});
			return {
				arrow: `BLOCKED->${back}`,
				status: r.status,
				code: r.error?.code,
				// TRUE when the refusal came from OWNERSHIP rather than from the machine — the setter names the
				// command to dispatch instead. This is what distinguishes the two refusal reasons by TEST rather
				// than by argument, which is what REG-F-192 set out to do and did not.
				redirected: (r.error?.message ?? '').includes('Dispatch ')
			};
		});

		// ⚠⚠ UPDATED BY W-5.5, AND THE SHAPE OF THE UPDATE IS THE WHOLE POINT OF HAVING WRITTEN IT THIS WAY.
		// **`status` is identical on all four rows before and after this increment.** What moved is the CODE, on
		// three of them: the three arrows W-5.5 ratified are now refused because `UnblockPwu` OWNS them, not
		// because the machine lacks them — so the setter never gained one, and the caller is redirected to the
		// command that does own it. Had this control asserted only `status`, it would have been green on both
		// sides of the exact transition it exists to notice, and REG-F-193 would have been an unverified essay.
		//
		// THE FOURTH ROW IS UNCHANGED, AND IT IS THE DISCRIMINATING ABSENCE. `BLOCKED -> READY` is still refused
		// as ILLEGAL because W-5.5 deliberately did not add it: READY is not a §8.2 in-arrow reversed. It is the
		// row that shows the other three moved for a REASON rather than because a guard was loosened.
		expect(
			outcomes,
			'BLOCKED still has no way back through the SETTER — three arrows now belong to UnblockPwu, and READY ' +
				'remains no arrow at all'
		).toEqual([
			{ arrow: 'BLOCKED->SHAPING', status: 'REJECTED', code: 'RPH_INVARIANT_VIOLATION', redirected: true },
			{ arrow: 'BLOCKED->PLANNED', status: 'REJECTED', code: 'RPH_INVARIANT_VIOLATION', redirected: true },
			{ arrow: 'BLOCKED->EXECUTING', status: 'REJECTED', code: 'RPH_INVARIANT_VIOLATION', redirected: true },
			{ arrow: 'BLOCKED->READY', status: 'REJECTED', code: 'RPH_ILLEGAL_STATE_TRANSITION', redirected: false }
		]);
		expect(lifecycle()).toBe('BLOCKED');
	});

	// ── CONTROL 5: THE INSTRUMENT ABOVE CAN ACTUALLY READ THE OTHER VALUE ────────────────────────────────────
	// CONTROL 4 distinguishes an ARROW refusal from an OWNERSHIP refusal by `code` and `redirected` — but every
	// one of its four cases reads the SAME value on both fields, so nothing there shows the two are separable
	// rather than that the second is always false. **A discriminator that has only ever seen one answer is not
	// known to discriminate.** This is the positive control for that instrument, and it is deliberately driven
	// from BLOCKED so it exercises the identical starting state.
	//
	// `BLOCKED -> ABANDONED` is the discriminating case and it is ratified (§8.2's "Any active" umbrella), so
	// legality PASSES and the refusal comes from ownership instead — `ABANDONED: 'AbandonPwu'`. Different code,
	// and it redirects.
	it('CONTROL — the same instrument reads an OWNERSHIP refusal differently: BLOCKED -> ABANDONED', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		const r = dispatch('ChangePwuState', {
			previousState: 'BLOCKED',
			newState: 'ABANDONED',
			executionState: 'NOT_PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});
		expect(
			{
				status: r.status,
				code: r.error?.code,
				redirected: (r.error?.message ?? '').includes('Dispatch ')
			},
			'a LEGAL arrow to an OWNED target must refuse as OWNED and redirect — the value CONTROL 4 never sees'
		).toEqual({ status: 'REJECTED', code: 'RPH_INVARIANT_VIOLATION', redirected: true });
		expect(lifecycle()).toBe('BLOCKED');
	});

	// ══ JAN-PFA S3.4 — TWO PRECISION GAPS, CLOSED BY ASSERTION ════════════════════════════════════════════════
	//
	// Both were found by mutants that SURVIVED this whole suite, and both share one shape: the suite proved a
	// refusal HAPPENS (or that an event was emitted) and never that it was PRECISE. Nothing below changes
	// behaviour; the production handlers are untouched.

	// ── GAP 1 — `BeginPwuShaping` IS NOT A SECOND WAY OUT OF `BLOCKED` ───────────────────────────────────────
	// ⚠ AND THE PROMISE BEING BROKEN IS `UnblockPwu`'S, WHICH THE MUTANT NEVER TOUCHES. `UnblockPwu` TAKES NO
	// TARGET, and that absence is the guarantee it offers: the state a PWU resumes at is READ from the
	// `blockedFrom` its own `PwuBlocked` recorded, never supplied by the caller — because a caller-chosen target
	// would permit `SHAPING -> BLOCKED -> EXECUTING`, silently skipping PLANNED, which is the exact failure
	// REG-D-043 identified. Widening `BeginPwuShaping.sourceStates` to `['PROPOSED', 'BLOCKED']` hands a
	// CALLER-CHOSEN way out of BLOCKED to a SECOND command: a PWU blocked out of EXECUTING resumes at SHAPING
	// because the caller picked the command, not because any record said so. `BLOCKED -> SHAPING` is machine-legal
	// (it is one of W-5.5's four recovery arrows) and `advancePwuLifecycle` runs no ownership check, so the
	// declared source set is the ONLY thing between that mutant and an ACCEPTED command. Nothing asserted it:
	// CONTROL 1 and CONTROL 4 above both ask this question of the GENERIC SETTER and of no named command.
	//
	// ARRANGED BY COMMANDS ALONE — no fixture — because the reachability of BLOCKED is the whole point: a
	// professional reaches it with ProposePwu -> BeginPwuShaping -> BlockPwu, which is this suite's `beforeEach`
	// plus one dispatch.
	it('BeginPwuShaping is refused from BLOCKED — the way back is UnblockPwu alone, and it is not a second one', () => {
		ok(dispatch('BlockPwu', { blockReason: 'the upstream interface contract is not published' }), 'block');
		expect(lifecycle(), 'reached by commands only: ProposePwu -> BeginPwuShaping -> BlockPwu').toBe('BLOCKED');

		const r = dispatch('BeginPwuShaping', {});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(
			r.error?.message ?? '',
			'the caller reached for the wrong command, which is a different mistake from an illegal arrow'
		).toContain('UNDECLARED ARROW');
		expect(r.error?.message ?? '').toContain('BeginPwuShaping does not declare BLOCKED as a source state');
		expect(lifecycle(), 'a refused command moves nothing').toBe('BLOCKED');

		// CONTROL — BLOCKED IS NOT THEREBY SEALED. The refusal above must be about WHICH COMMAND OWNS THE ARROW,
		// not about there being no way back at all; a BLOCKED PWU that nothing could recover would satisfy the
		// assertion above and would be a worse defect than the one it is written to catch. The legitimate route
		// still works, and it lands where the RECORD says rather than where a caller asked.
		ok(dispatch('UnblockPwu', { recoveryReason: 'the contract was published' }), 'unblock');
		expect(lifecycle(), 'SHAPING is what PwuBlocked.blockedFrom recorded — read, not chosen').toBe('SHAPING');
	});

	// ── GAP 1, UNIVERSAL FORM — the declaration says PROPOSED and NOTHING ELSE ───────────────────────────────
	// ⚠ THE CASE ABOVE ALONE WOULD BE THE DEFECT THIS PROGRAMME KEEPS FINDING: a test that pins ONE member of a
	// set proves nothing about the others, and the previous increment caught exactly that — a floor-lock test
	// hard-coding one of three ids, so a mutant narrowing the lock to that id PASSED it. A mutant widening
	// `sourceStates` to `['PROPOSED', 'PLANNED']` walks straight past the BLOCKED case above. So the promise is
	// asserted over EVERY state of the ratified machine, DERIVED from the machine rather than transcribed, with
	// the offending state named in the failure message.
	//
	// The fixture is ARRANGEMENT, not the subject — it forces the axis to each state in turn so the same
	// question can be put to the command from all of them.
	it('BeginPwuShaping declares PROPOSED and NOTHING else — every other state is an UNDECLARED ARROW', () => {
		const states = getMachine('PWU.workLifecycleState').states;
		expect(states, 'the sweep is worthless if the machine list does not contain the declared source').toContain(
			'PROPOSED'
		);
		expect(states.length, 'nor if it is a singleton').toBeGreaterThan(1);

		const outcomes = states.map((from) => {
			seedPwuWorkLifecycleState_FIXTURE(store, PWU, from);
			const r = dispatch('BeginPwuShaping', {});
			return {
				from,
				status: r.status,
				landed: lifecycle(),
				undeclared: (r.error?.message ?? '').includes('UNDECLARED ARROW')
			};
		});

		for (const o of outcomes) {
			if (o.from === 'PROPOSED') continue;
			expect(
				{ status: o.status, landed: o.landed, undeclared: o.undeclared },
				`BeginPwuShaping from ${o.from}: the declaration claims [PROPOSED] alone, so ${o.from} must be ` +
					`refused as an UNDECLARED ARROW and the PWU must not move`
			).toEqual({ status: 'REJECTED', landed: o.from, undeclared: true });
		}

		// CONTROL — the ONE declared source is still ADMITTED, and it lands. Without this, a `sourceStates: []`
		// refusing every state in the machine would satisfy the loop above completely.
		expect(
			outcomes.find((o) => o.from === 'PROPOSED'),
			'CONTROL: a command that refuses everything is not a command that declares PROPOSED'
		).toEqual({ from: 'PROPOSED', status: 'ACCEPTED', landed: 'SHAPING', undeclared: false });
		expect(
			outcomes.filter((o) => o.status === 'ACCEPTED').map((o) => o.from),
			'exactly one state is declared; a widened declaration puts the widened state in this list'
		).toEqual(['PROPOSED']);
	});

	// ── GAP 2 — `PwuEscalated` RECORDS WHAT THE ESCALATOR SAID ───────────────────────────────────────────────
	// ⚠ THE EVENT IS THE WHOLE OF THIS COMMAND'S DELTA, and nothing asserted a single field of it. The handler
	// states the promise itself: *"`escalationReason` is required for AX-8's reason: a transfer of responsibility
	// with no stated reason transfers nothing"* — CON-000 AX-8 calling escalation *"the responsible transfer of
	// unresolved professional responsibility"*. This suite proved the refusal HAPPENS (an escalation with no
	// reason is VALIDATION_FAILED) and that `PwuEscalated` was EMITTED, and stopped there: a handler recording a
	// constant reason, or one professional's words under another's escalation, passes every assertion in this
	// file. The transfer would be logged; WHAT was transferred would not be.
	//
	// AND THE EVIDENCE LIST IS DRIVEN AT LENGTH THREE ON PURPOSE. `unobtainableEvidenceIds` is `z.array` —
	// PLURAL — because an impossibility usually spans several artifacts. The only assertion on it anywhere
	// (`pwu-nothing-inferred.test.ts`) supplies a ONE-element list, which a handler truncating with
	// `.slice(0, 1)` round-trips perfectly: the precision of a list is unobservable at length one.
	it('PwuEscalated carries the reason verbatim and EVERY id declared unobtainable, not the first', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		const escalationReason = 'the custodian system was decommissioned and its archive was not retained';
		ok(
			dispatch('EscalatePwu', { escalationReason, unobtainableEvidenceIds: [EVD_A, EVD_B, EVD_C] }),
			'escalate'
		);
		expect(
			lastPayload('PwuEscalated'),
			'the event is this command delta in its entirety — a field it drops is a fact nobody transferred'
		).toEqual({
			escalationReason,
			unobtainableEvidenceIds: [EVD_A, EVD_B, EVD_C],
			workLifecycleState: 'ESCALATED'
		});

		// CONTROL — THE FIELDS ARE VARIABLES, NOT CONSTANTS WEARING THEIR NAMES. A single case is satisfied by a
		// handler hardcoding the values that case happens to use, which is a shape this file already records
		// once. The second escalation is driven entirely by commands — de-escalate, escalate again — and must
		// record ITS OWN words and ITS OWN shorter list.
		ok(dispatch('UnblockPwu', { recoveryReason: 'one of the three turned up' }), 'de-escalate');
		expect(lifecycle()).toBe('EVIDENCE_PENDING');
		const second = 'the remaining two are held by a counterparty that will not release them';
		expect(second, 'the control is inert unless the two escalations actually differ').not.toBe(
			escalationReason
		);
		ok(
			dispatch('EscalatePwu', { escalationReason: second, unobtainableEvidenceIds: [EVD_B, EVD_C] }),
			're-escalate'
		);
		expect(lastPayload('PwuEscalated'), 'the second transfer records the SECOND reason').toEqual({
			escalationReason: second,
			unobtainableEvidenceIds: [EVD_B, EVD_C],
			workLifecycleState: 'ESCALATED'
		});
	});

	// ── GAP 2, THE ADMITTING CONTROL — the honest un-itemisable escalation is STILL ACCEPTED ─────────────────
	// ⚠ WITHOUT THIS, THE ASSERTION ABOVE IS SATISFIED BY A HANDLER THAT REQUIRED THE LIST. The trigger is
	// *"Evidence impossible to obtain"*, and the handler defends the optionality in terms — impossibility "is
	// often not itemisable" — so a rule demanding the enumeration would make the honest case UNREPORTABLE,
	// which this repository names as the same failure one level down. And the key must be ABSENT rather than an
	// empty array, because `unobtainableEvidenceIds: []` is a positive claim that nothing was unobtainable,
	// which is not what an escalation with nothing citable means (CON-000 AX-6).
	it('CONTROL — an escalation that cannot itemise the evidence is admitted, and records NO list rather than an empty one', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		const escalationReason = 'we cannot establish what the decommissioned system held, only that it is gone';
		ok(dispatch('EscalatePwu', { escalationReason }), 'escalate with nothing citable');
		const payload = lastPayload('PwuEscalated');
		expect(payload, 'the reason is still carried when the citation cannot be').toEqual({
			escalationReason,
			workLifecycleState: 'ESCALATED'
		});
		expect(
			'unobtainableEvidenceIds' in payload,
			'an ABSENT list is an absence; an empty list would assert that nothing was unobtainable'
		).toBe(false);
	});
});

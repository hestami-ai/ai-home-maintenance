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

		// EVERY arrow refused, and every one of them refused BY ARROW ABSENCE — no in-arrow exists, so the
		// legality check refuses before ownership is ever consulted, and nothing redirects the caller.
		expect(outcomes, 'BLOCKED has no way back, and the reason is the machine — not command ownership').toEqual([
			{ arrow: 'BLOCKED->SHAPING', status: 'REJECTED', code: 'RPH_ILLEGAL_STATE_TRANSITION', redirected: false },
			{ arrow: 'BLOCKED->PLANNED', status: 'REJECTED', code: 'RPH_ILLEGAL_STATE_TRANSITION', redirected: false },
			{ arrow: 'BLOCKED->EXECUTING', status: 'REJECTED', code: 'RPH_ILLEGAL_STATE_TRANSITION', redirected: false },
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
});

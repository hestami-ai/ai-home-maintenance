// A-5 — the handler's DECLARED-SOURCE check must be killable, and until this file existed it was not.
//
// ⚠ THE GAP THIS CLOSES IS IN MY OWN INCREMENT, found while declaring the mutant that was supposed to guard it.
// `advancePwuLifecycle` now asks `checkDeclaredSource` before consulting the machine (REG-F-114). Deleting that
// call changes NOTHING any existing test can observe:
//
//   * no real spec is narrower than its machine, so no command can be driven from a state it fails to claim
//     while the machine permits it — the case the kernel unit test covers with a synthetic spec; and
//   * the refusal reuses `RPH_ILLEGAL_STATE_TRANSITION`, which is exactly what `canAdvanceWorkLifecycle` would
//     have returned anyway, and **no test in the repository asserts the MESSAGE** — only the code.
//
// So the check was declared, wired, and unkillable: a guard whose removal is invisible. That is the shape this
// programme keeps finding, arriving inside the fix for it.
//
// WHAT MAKES IT OBSERVABLE IS THE ORDER, WHICH WAS CHOSEN FOR A DIFFERENT REASON AND PAYS HERE. The declared-set
// check runs FIRST, so a state the machine ALSO forbids now reports "undeclared arrow" where it used to report
// "cannot advance". Same code, different sentence — and the sentence is the whole point of running the check
// first, because it sends the caller to find the command that owns the arrow instead of to read a state diagram.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-10T15:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H9100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9110';

describe('REG-F-114 — a command refused from a state it does not CLAIM says so, and says which', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'f114',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
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
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
	});

	/**
	 * `ChallengePwu` claims READY alone. The PWU is at PROPOSED, so the DECLARED-SOURCE check refuses it before
	 * the machine is consulted.
	 *
	 * ChallengePwu is chosen deliberately: its handler goes straight to `advancePwuLifecycle` with no
	 * precondition of its own. `MarkPwuReady` would have been refused earlier by its readiness contract, and the
	 * test would have passed while proving nothing about this check — the control-that-measures-the-wrong-thing
	 * failure this session has already produced three times.
	 */
	it('REFUSES ChallengePwu from PROPOSED as an UNDECLARED ARROW, naming what it does claim', () => {
		const r = dispatch('ChallengePwu', { challengeReason: 'x' }, PWU, 'PROFESSIONAL_WORK_UNIT');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		// ⚠ THE MESSAGE IS THE ASSERTION, and it is the ONLY thing that distinguishes this check from the machine
		// check that would refuse the same command with the same code. Deleting the declared-source call in
		// `advancePwuLifecycle` reverts this sentence to "Cannot advance PWU …" and reddens here — which is what
		// makes the guard killable at all.
		expect(r.error?.message, 'the refusal must name itself an undeclared arrow').toContain(
			'UNDECLARED ARROW'
		);
		expect(r.error?.message, 'and must name the command').toContain('ChallengePwu');
		expect(r.error?.message, 'and must name what it DOES claim').toContain('READY');
		expect(r.error?.message, 'and must NOT be mistaken for a machine refusal').toContain(
			'not an illegal transition'
		);
	});

	it('the PWU does not move — a refusal that advanced the object is no refusal', () => {
		// ⚠ THE RESULT IS ASSERTED, NOT DISCARDED. My first version dispatched and looked only at the store, and
		// REG-F-015's standing unread-refusal ratchet caught it: "the engine rejected this command and the test
		// never looked at the result, so if it was an arrangement, the arrangement did not happen and nothing
		// here could tell." Revived earlier today; it earned its keep within the hour.
		const r = dispatch('ChallengePwu', { challengeReason: 'x' }, PWU, 'PROFESSIONAL_WORK_UNIT');
		expect(r.status).toBe('REJECTED');
		const state = store.loadObject(PWU)?.state as { workLifecycleState?: string };
		expect(state?.workLifecycleState).toBe('PROPOSED');
	});

	// CONTROL — SAME PWU, SAME STATE, A COMMAND THAT DOES CLAIM IT. Without this, the refusal above is equally
	// consistent with an engine that has stopped performing PWU arrows at all.
	//
	// `BeginPwuShaping` claims PROPOSED, so the discrimination is exactly the declared source set and nothing
	// else — same fixture, same state, two commands. ⚠ MY FIRST ATTEMPT DROVE `ChallengePwu` FROM READY INSTEAD,
	// which needed `MarkPwuReady` and therefore the whole §9.1 readiness contract; it failed on the arrangement
	// and would have been "fixed" by building a fuller fixture — adding setup that has nothing to do with the
	// property, and moving the control further from the thing it measures.
	it('CONTROL — BeginPwuShaping, which DOES claim PROPOSED, performs its arrow from the same state', () => {
		const r = dispatch('BeginPwuShaping', {}, PWU, 'PROFESSIONAL_WORK_UNIT');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((store.loadObject(PWU)?.state as { workLifecycleState?: string })?.workLifecycleState).toBe(
			'SHAPING'
		);
	});
});

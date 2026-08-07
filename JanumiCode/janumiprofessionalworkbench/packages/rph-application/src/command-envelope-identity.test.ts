// REG-F-011, the CRASH half. `Engine.dispatch`'s entire contract is that it RETURNS a typed, classified
// `CommandResult` — that is what `RphError` exists for, and what every caller including the demo's form actions is
// written against. Measured 2026-08-02: a command missing `commandId` or `correlationId` made an unhandled
// `SqliteError` ESCAPE dispatch ("NOT NULL constraint failed: command_receipts.command_id"), so a caller without a
// try/catch failed in a way the error contract says is impossible, and the VALIDATION/INVARIANT/CONCURRENCY
// classification was absent exactly where it was most needed.
//
// WHAT THIS FILE DOES NOT DO, deliberately. It does NOT pin the current behaviour, and it does NOT validate the
// whole envelope. REG-F-011 separates two remediations and this is the contained one: the ENVELOPE VALIDATION half
// would refuse commands the engine accepts today (several fixtures in this repository omit envelope fields) and
// owes a caller-and-fixture survey first. This half changes no accept/reject outcome for any well-formed command —
// it converts a CRASH into a typed refusal, and nothing else.
//
// So the assertions are written against the CONTRACT, not against a chosen error string: dispatch RETURNS, the
// result carries a classified code, and a well-formed command is still accepted. A fix that returned the wrong
// code would still be a fix for the defect this file is about; a fix that kept throwing would not.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';

const TS = '2026-08-02T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H6500';

describe('REG-F-011 — a malformed envelope is REFUSED, never thrown (Engine.dispatch returns)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;

	const wellFormed = (): Record<string, unknown> => ({
		commandId: 'c-1',
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: INTENT,
		issuedAt: TS,
		issuedBy: actor,
		correlationId: 'corr-1',
		idempotencyKey: 'k-1',
		payload: {
			intentId: INTENT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		}
	});

	/** Dispatch, converting a THROW into a sentinel so the assertion can name it rather than the suite exploding. */
	const dispatchSafely = (
		cmd: Record<string, unknown>
	): { threw: unknown; status: string; code?: string } => {
		try {
			const r = engine.dispatch(cmd as unknown as DomainCommand);
			return { threw: undefined, status: r.status, code: r.error?.code };
		} catch (e) {
			return { threw: e, status: '(threw)' };
		}
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		let seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	});

	it.each(['commandId', 'correlationId'])(
		'a command with no %s RETURNS a classified refusal instead of throwing',
		(field) => {
			const cmd = wellFormed();
			delete cmd[field];
			const r = dispatchSafely(cmd);
			expect(
				r.threw,
				`dispatch threw instead of returning a CommandResult: ${String(r.threw)}`
			).toBeUndefined();
			expect(r.status, 'a malformed envelope must not be ACCEPTED').not.toBe('ACCEPTED');
			expect(r.code, 'the refusal must carry a classified RPH error code').toBeTruthy();
		}
	);

	it('an empty-string identity is refused too — presence is not the same as identity', () => {
		// `''` satisfies a NOT NULL column, so a presence-only fix would leave a receipt keyed on nothing and a
		// second such command would collide with it. The guard is about IDENTITY, not about the field existing.
		for (const field of ['commandId', 'correlationId']) {
			const r = dispatchSafely({ ...wellFormed(), [field]: '' });
			expect(r.threw, `empty ${field} threw: ${String(r.threw)}`).toBeUndefined();
			expect(r.status, `empty ${field} must not be ACCEPTED`).not.toBe('ACCEPTED');
		}
	});

	it('CONTROL — a well-formed command is still ACCEPTED, so the guard refuses nothing it should not', () => {
		// Without this the whole file is satisfied by a bus that refuses everything, which is over-refusal wearing
		// the fix's clothes — the failure mode this programme's controls exist for.
		const r = dispatchSafely(wellFormed());
		expect(r.threw).toBeUndefined();
		expect(r.status, 'the control must be ACCEPTED').toBe('ACCEPTED');
	});
});

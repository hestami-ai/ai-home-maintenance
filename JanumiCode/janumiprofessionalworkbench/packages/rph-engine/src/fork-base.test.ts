// ── WHAT A FORK WAS TAKEN FROM, AND WHAT IT WROTE (`JAN-CRITREAD` `DD-3`, `REG-D-070` §5.1) ────────────────────────────
//
// An authoring turn declares its dependencies from its fork's base: every aggregate it writes pinned at its revision
// at the fork's position, and every policy each write newly referenced against the state that write REPLACED — the
// state the replay validates that command against. Each case isolates one of those facts; a wrong one pins the wrong
// revision (a stale commit, or a false conflict) or leaves a replay-validated policy unpinned.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine } from './index.js';

const TS = '2026-09-22T00:00:00Z';
const BASE = 'int_01ARZ3NDEKTSV4RRFFQ69G5FB0';
const BORN = 'int_01ARZ3NDEKTSV4RRFFQ69G5FB1';

let seq = 0;
function command(commandType: string, intentId: string, payload: unknown): DomainCommand {
	seq += 1;
	return {
		commandId: `cmd-${seq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: intentId,
		issuedAt: TS,
		correlationId: `corr-${seq}`,
		idempotencyKey: `idem-${seq}`,
		payload
	};
}
const capture = (intentId: string) =>
	command('CaptureIntent', intentId, {
		intentId,
		originatingExpression: 'x',
		ontologyId: 'product-realization-pwa',
		ontologyVersion: '1.0.0'
	});
const beginDiscovery = (intentId: string) => command('BeginIntentDiscovery', intentId, {});

/** A canonical engine holding BASE at revision 0, and a fork of it. */
function arrange() {
	seq = 0;
	let n = 0;
	const engine = createEngine({
		authenticate: testAuthenticator(),
		ontology,
		now: () => TS,
		newEventId: () => `evt_${++n}`
	}).as(TEST_CRED.human);
	expect(engine.dispatch(capture(BASE)).status).toBe('ACCEPTED');
	return { engine, fork: engine.fork() };
}

describe('a fork reports what it was taken from and what it wrote', () => {
	it('FB-1 — a canonical handle is not a fork; a fork’s mark is canonical’s position at capture, and stays there', () => {
		const { engine, fork } = arrange();
		expect(engine.forkBase(), 'canonical has no fork base').toBeUndefined();
		const mark = fork.forkBase()!.mark;
		expect(mark, 'one event on canonical at capture').toBe(1);
		expect(engine.dispatch(capture(BORN)).status).toBe('ACCEPTED');
		expect(fork.forkBase()!.mark, 'canonical grew; the fork did not move').toBe(mark);
	});

	it('FB-2 — a revision at the base is the BASE’s, even after the fork writes the aggregate or gives it birth', () => {
		const { fork } = arrange();
		expect(fork.dispatch(beginDiscovery(BASE)).status).toBe('ACCEPTED');
		expect(fork.dispatch(capture(BORN)).status).toBe('ACCEPTED');
		expect(fork.loadObject(BASE)?.revision, 'arrangement: the fork moved BASE').toBe(1);
		expect(fork.forkBase()!.revisionAt(BASE)).toBe(0);
		expect(
			fork.forkBase()!.revisionAt(BORN),
			'absent at the base, whatever the fork did'
		).toBeUndefined();
	});

	it('FB-3 — every write in commit order, each with its base revision and the state it REPLACED', () => {
		const { fork } = arrange();
		const baseState = fork.loadObject(BASE)?.state;
		expect(fork.dispatch(beginDiscovery(BASE)).status).toBe('ACCEPTED');
		expect(fork.dispatch(capture(BORN)).status).toBe('ACCEPTED');
		const bornState = fork.loadObject(BORN)?.state;
		expect(fork.dispatch(beginDiscovery(BORN)).status).toBe('ACCEPTED');

		const writes = fork.forkBase()!.writes();
		expect(writes.map((w) => [w.aggregateId, w.baseRevision])).toEqual([
			[BASE, 0],
			[BORN, undefined],
			[BORN, undefined]
		]);
		expect(writes[0]!.priorState, 'the first write replaced the BASE state').toEqual(baseState);
		expect(writes[1]!.priorState, 'a birth replaced nothing').toBeUndefined();
		expect(writes[2]!.priorState, 'a second write replaced the fork’s OWN earlier one').toEqual(
			bornState
		);
		expect(writes[2]!.nextState).toEqual(fork.loadObject(BORN)?.state);
	});

	it('FB-4 — a rolled-back batch’s writes are not among them', () => {
		const { fork } = arrange();
		const batch = fork.dispatchBatch([beginDiscovery(BASE), beginDiscovery(BASE)]);
		expect(batch.ok, 'arrangement: the second command is refused, so the batch rolls back').toBe(
			false
		);
		expect(fork.loadObject(BASE)?.revision, 'arrangement: nothing applied').toBe(0);
		expect(fork.forkBase()!.writes()).toEqual([]);
	});
});

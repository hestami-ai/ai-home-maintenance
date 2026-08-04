// THE GUARD'S OWN CONTROL — proof that `emitted-event-guard.ts` is reached (REG-F-020).
//
// WHY THIS FILE EXISTS, and it is not a formality. That guard is a PROTOTYPE PATCH installed from a setup file,
// and that arrangement fails in exactly one way that matters: silently. If the patch stops being reached, every
// run is green, the ledger certifies nothing, and the absence looks identical to cleanliness.
//
// IT ALREADY HAPPENED ONCE, while the guard was being built. A probe edit left a literal newline inside a string
// literal; the module stopped parsing; and three consecutive runs reported "no violations found" that were really
// "no guard running". The report I was reading could not tell those apart, and neither could I until I asked the
// guard how many events it had seen. Same shape as the mutant harness earlier in this session that reported "no
// test reddened" for nine mutants because its reporter flag did not exist.
//
// So: the guard now counts what it inspects, and this asserts the counter MOVES for a real dispatch.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { Engine } from '@janumipwb/rph-application';
import { LEDGER, liveness } from './emitted-event-guard.js';

const TS = '2026-08-04T00:00:00Z';
const ACTOR: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69JA001';

describe('the emitted-event guard is alive', () => {
	it('inspects a handler-produced event when a command is dispatched', () => {
		const before = liveness.inspected;
		const store = new SqliteStorageAdapter({ now: () => TS });
		let seq = 0;
		const engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		const command: DomainCommand = {
			commandId: 'c-1',
			commandType: 'CaptureIntent',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: INTENT,
			issuedAt: TS,
			issuedBy: ACTOR,
			correlationId: 'guard-liveness',
			idempotencyKey: 'guard-liveness-1',
			payload: {
				intentId: INTENT,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			}
		};
		expect(engine.dispatch(command).status, 'the arrangement must actually commit').toBe('ACCEPTED');

		expect(
			liveness.inspected,
			'THE POINT: the guard is a prototype patch from a setup file. If it is not reached, every run is ' +
				'green and the ledger certifies nothing — which is indistinguishable from a clean system.'
		).toBeGreaterThan(before);
		expect(liveness.types.has('IntentCaptured')).toBe(true);
		store.close();
	});

	// TWO DIFFERENT CLAIMS, and the test above only proves the first. It proves the MECHANISM works: importing the
	// module patches the prototypes and a dispatch is inspected. It does NOT prove the guard is INSTALLED in the
	// projects that run the engine — this `verif` project declares no setup files, so the import above is what
	// installed it here. That second claim is a fact about the project config, so it is asserted against the
	// config.
	it('is declared as a setup file for EVERY project that runs tests', () => {
		const config = readFileSync(new URL('../vitest.projects.ts', import.meta.url), 'utf8');
		const declarations = config.match(/setupFiles: \[[^\]]*\]/g) ?? [];
		expect(declarations.length, 'no setupFiles declarations found — the config shape changed').toBeGreaterThan(
			0
		);
		const without = declarations.filter((d) => !d.includes('SETUP_EMITTED_EVENT'));
		expect(
			without,
			'a project declares setupFiles WITHOUT the emitted-event guard, so its dispatches are unwatched. ' +
				'The guard is declared centrally precisely so a package cannot opt out by omission.'
		).toEqual([]);
	});

	// The ledger is an ACCEPT-list: every row makes this gate tolerate one more type. More names = weaker, so the
	// rows are worth counting out loud rather than letting the number drift.
	it('the ledger is a bounded accept-list, not an open one', () => {
		const rows = Object.keys(LEDGER);
		expect(rows.length, `ledger rows: ${rows.sort().join(', ')}`).toBeLessThanOrEqual(1);
		expect(
			rows.every((r) => LEDGER[r] !== undefined && LEDGER[r]!.length > 0),
			'every row carries its MEASURED violation — a row without one is an assertion nobody checked'
		).toBe(true);
	});
});

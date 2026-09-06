// JAN-CTXPOL / ICP-04 — the handler, driven directly.
//
// ⭑ THREE VERIF GATES ASKED FOR THIS AND THEY WERE RIGHT. `command-dispatch-census` refuses a ratified,
// routable command no test drives — *"its preconditions, its emitted payload and its event-gate conformance are
// claims nothing checks"* — and `event-surface-census` refuses an event the vocab BINDS that nothing emits,
// because *"a bound-but-unemitted event means a command produces something other than what it declares."*
// The seed test drove the command through a helper, so the census could not see it named.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-06T00:00:00Z';
const OBJECT_ID = 'ctxpol_00000000000000000000000CTX';

describe('CreateContextAssemblyPolicy', () => {
	let store: SqliteStorageAdapter;
	let engine: ReturnType<Engine['as']>;
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

	function create(payload: unknown, targetId = OBJECT_ID) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType: 'CreateContextAssemblyPolicy',
			commandSchemaVersion: 1,
			targetAggregateType: 'CONTEXT_ASSEMBLY_POLICY',
			targetAggregateId: targetId,
			issuedAt: TS,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const emitted = () =>
		store.readAllEvents().filter((e) => e.eventType === 'ContextAssemblyPolicyCreated');

	it('⭑ creates the policy and EMITS its event with the full field set', () => {
		// ⭑ THE FULL PAYLOAD IS THE POINT, not a nicety. `PER-2`: "authoritative history remains reconstructable"
		// and current state is "a cache of this history, not a second authority". THE MUTANT: emit only the id.
		// The state row becomes the sole authority and the event can no longer rebuild it.
		const r = create({
			policyId: 'ctx-default',
			permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
		});
		expect(r.status).toBe('ACCEPTED');
		const events = emitted();
		expect(events).toHaveLength(1);
		expect(events[0]!.payload).toEqual({
			policyId: 'ctx-default',
			permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
		});
	});

	it('⚠ the OBJECT id is the command target; the POLICY id is content — they are different identities', () => {
		// ⛔ THE FIRST VERSION USED `policyId` FOR BOTH AND THE EMITTED SCHEMA REFUSED IT. A RUNTIME_BINDING names
		// a POLICY ('ctx-default'), the way FLOOR_POLICY_IDS names 'floor.reasoning-review'; the stored object
		// needs its own mintable identity. THE MUTANT: write `p.policyId` into the envelope — the id-format check
		// rejects it, which is the schema being right and the handler being wrong.
		create({
			policyId: 'ctx-default',
			permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
		});
		const state = store.loadObject(OBJECT_ID) as { state: Record<string, unknown> } | undefined;
		expect(state?.state.id, 'the envelope id is the minted object id').toBe(OBJECT_ID);
		expect(state?.state.policyId, 'the policy id is content').toBe('ctx-default');
	});

	it('⛔ REFUSES a policy whose permittedSources names a source outside the closed union', () => {
		// ⭑ `PER-12` forbids volunteered reasoning reaching an evaluator's context and `REG-Q-077` — may it be
		// read back at all — is OPEN, so the union must not be able to express it. THE MUTANT: widen the union.
		// Nothing else would notice, because nothing would yet USE the member — it would ship as an unused enum
		// value and later be read as licence.
		const r = create({
			policyId: 'ctx-loose',
			permittedSources: [{ source: 'VOLUNTEERED_REASONING', scope: 'THIS_WORK_UNIT' }]
		});
		// ⭑ `VALIDATION_FAILED`, NOT A HANDLER REFUSAL, AND THAT IS STRONGER: the closed union is enforced by the
		// generated SCHEMA, so no handler has to remember to check it and no second handler can forget.
		expect(r.status).toBe('VALIDATION_FAILED');
	});
});

// THE VALIDATOR REGISTRY MACHINE, DRIVEN (REG-E-024(c)).
//
// §35 ratified three statuses and NO transition table — so ACTIVE / DEGRADED / DISABLED were the LAST unreachable
// states in the system. The arrows are now declared (§0.3 authored clarification, 2026-08-05) and these are the
// commands that take them.
//
// WHAT MUST REDDEN (a green here means nothing unless these hold):
//   1. An arrow removed from `m2-transitions.json`  -> its ACCEPTED case reddens.
//   2. A source state widened (e.g. DEGRADED -> ACTIVE allowed from DISABLED) -> the matching refusal reddens.
//   3. The whole registry reverted -> every case here reddens, and `state-reachability` un-closes.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-05T00:00:00Z';
const actor: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };
const VID = 'vld_01ARZ3NDEKTSV4RRFFQ69G5V10';

describe('ValidatorRegistryEntry.status — the five declared arrows', () => {
	let engine: Engine;
	let store: SqliteStorageAdapter;
	let seq = 0;

	const send = (commandType: string, payload: unknown) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'VALIDATOR_REGISTRY_ENTRY',
			targetAggregateId: VID,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr-vr',
			idempotencyKey: `k-${n}`,
			payload
		} as DomainCommand);
	};

	const register = () =>
		send('RegisterValidator', {
			validatorId: VID,
			supportedPolicies: ['pol_intent_fidelity'],
			roleId: 'REVIEWER',
			implementationType: 'MODEL',
			requiredCapabilities: [],
			independenceAttributes: { modelFamily: 'alpha', provider: 'acme' },
			costClass: 'MEDIUM',
			latencyClass: 'STANDARD'
		});

	const statusOf = () =>
		(store.loadObject(VID)?.state as { status?: string } | undefined)?.status;

	beforeEach(() => {
		seq = 0;
		store = new SqliteStorageAdapter({ now: () => TS });
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	it('registers in ACTIVE — the machine’s declared initial state', () => {
		expect(register().status, 'RegisterValidator must be accepted').toBe('ACCEPTED');
		expect(statusOf()).toBe('ACTIVE');
	});

	it('ACTIVE → DEGRADED → ACTIVE — degradation is recoverable', () => {
		// If DEGRADED could not be left, it would be DISABLED under another name, and §35 gives those separate
		// meanings — impaired versus withdrawn.
		register();
		expect(send('MarkValidatorDegraded', { validatorId: VID, reason: 'timed out twice' }).status).toBe(
			'ACCEPTED'
		);
		expect(statusOf()).toBe('DEGRADED');
		expect(send('RestoreValidator', { validatorId: VID, reason: 'recovered' }).status).toBe('ACCEPTED');
		expect(statusOf()).toBe('ACTIVE');
	});

	it('DISABLED is reachable from BOTH source states — §35’s table gives that arrow two', () => {
		register();
		expect(send('DisableValidator', { validatorId: VID, reason: 'withdrawn' }).status).toBe('ACCEPTED');
		expect(statusOf()).toBe('DISABLED');
		// ...and from DEGRADED, on a fresh entry.
		seq = 0;
		store = new SqliteStorageAdapter({ now: () => TS });
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		register();
		send('MarkValidatorDegraded', { validatorId: VID, reason: 'flaky' });
		expect(send('DisableValidator', { validatorId: VID, reason: 'withdrawn' }).status).toBe('ACCEPTED');
		expect(statusOf()).toBe('DISABLED');
	});

	it('DISABLED → ACTIVE on reinstatement, not to DEGRADED', () => {
		// Reinstatement asserts fitness. Returning to DEGRADED would mean the act said "available again, but
		// still impaired", which is a claim nobody made.
		register();
		send('DisableValidator', { validatorId: VID, reason: 'withdrawn' });
		expect(send('EnableValidator', { validatorId: VID, reason: 'reinstated' }).status).toBe('ACCEPTED');
		expect(statusOf()).toBe('ACTIVE');
	});

	it('REFUSES arrows the machine does not declare', () => {
		// THE HALF THAT MAKES THE REST MEAN SOMETHING. Every case above is an ACCEPTED, so a handler that accepted
		// everything would pass all of them. The machine — not a remembered `if` — is what refuses these.
		register();
		// ACTIVE has no RestoreValidator arrow (that is DEGRADED -> ACTIVE).
		expect(send('RestoreValidator', { validatorId: VID, reason: 'nothing to restore' }).status).not.toBe(
			'ACCEPTED'
		);
		// ACTIVE has no EnableValidator arrow (that is DISABLED -> ACTIVE).
		expect(send('EnableValidator', { validatorId: VID, reason: 'already active' }).status).not.toBe(
			'ACCEPTED'
		);
		expect(statusOf(), 'and a refused command changes nothing').toBe('ACTIVE');
		// From DISABLED, degrading is not an arrow either — a withdrawn implementation is not "impaired".
		send('DisableValidator', { validatorId: VID, reason: 'withdrawn' });
		expect(send('MarkValidatorDegraded', { validatorId: VID, reason: 'moot' }).status).not.toBe(
			'ACCEPTED'
		);
		expect(statusOf()).toBe('DISABLED');
	});

	it('every status change records WHY, on the event and not on the snapshot', () => {
		// The entry's CURRENT status is the fact; why it got there is history. Putting `reason` on the object would
		// leave the last reason attached to a status it no longer explains.
		register();
		send('MarkValidatorDegraded', { validatorId: VID, reason: 'sandbox unavailable' });
		const degraded = store.readAllEvents().filter((e) => e.eventType === 'ValidatorDegraded');
		expect(degraded).toHaveLength(1);
		expect((degraded[0]!.payload as { reason?: string }).reason).toBe('sandbox unavailable');
		expect((degraded[0]!.payload as { status?: string }).status).toBe('DEGRADED');
		expect(store.loadObject(VID)?.state, 'the snapshot carries status, not reason').not.toHaveProperty(
			'reason'
		);
	});
});

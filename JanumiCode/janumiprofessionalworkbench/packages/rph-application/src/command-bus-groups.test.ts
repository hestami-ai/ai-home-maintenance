// ── THE GUARDED BATCH, DECLARED-GROUPS FORM (`JAN-CRITREAD` `DD-2`, `REG-D-070`) ─────────────────────────────────────
//
// A staged candidate is refused only when something it DECLARED it depends on changed: a pinned aggregate's
// revision, or a member of a declared group touched by an event after the candidate's position that is not one of its
// own acts. Every other write to the store is ignored — which is what ends `REG-F-430`'s false conflict, where ANY
// write anywhere destroyed every open draft.
//
// Each case isolates one term. G-B2 is the discrimination control: a rule that refused everything would pass G-B1,
// G-B3 and G-B5, and only a foreign write that MUST commit tells it apart from the old whole-log check.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
import { StoreBusyError, type StorageAdapter } from '@janumipwb/rph-ports';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SnapshotOverlayStorageAdapter, SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	memberOfGroup,
	type DependencyGroup,
	type ObjectPostcondition,
	type RevisionPrecondition
} from './command-bus.js';
import { Engine } from './index.js';

const TS = '2026-09-22T00:00:00Z';
const id = (k: string) => `int_01ARZ3NDEKTSV4RRFFQ69G5${k.padStart(3, '0')}`;
const BASE = id('0');

/** `inner` with some methods replaced; every other method still bound to `inner`. */
function wrapping(inner: StorageAdapter, overrides: Partial<StorageAdapter>): StorageAdapter {
	return new Proxy(inner, {
		get(target, prop) {
			if (prop in overrides) return overrides[prop as keyof StorageAdapter];
			const value = Reflect.get(target, prop, target) as unknown;
			return typeof value === 'function'
				? (value as (...a: unknown[]) => unknown).bind(target)
				: value;
		}
	});
}

describe('memberOfGroup — the key operators', () => {
	const state = { pwaId: 'pwa_1', subjectObjectIds: ['pwa_1', 'x'], policy: 'rr' };

	it('equals: the field must be the value', () => {
		expect(memberOfGroup(state, [{ field: 'pwaId', equals: 'pwa_1' }])).toBe(true);
		expect(memberOfGroup(state, [{ field: 'pwaId', equals: 'pwa_2' }])).toBe(false);
	});

	it('contains: the field must be an array holding the value', () => {
		expect(memberOfGroup(state, [{ field: 'subjectObjectIds', contains: 'pwa_1' }])).toBe(true);
		expect(memberOfGroup(state, [{ field: 'subjectObjectIds', contains: 'pwa_2' }])).toBe(false);
		expect(memberOfGroup(state, [{ field: 'pwaId', contains: 'pwa_1' }]), 'not an array').toBe(
			false
		);
	});

	it('oneOf: the field must be a string among the values', () => {
		expect(memberOfGroup(state, [{ field: 'policy', oneOf: ['sc', 'rr'] }])).toBe(true);
		expect(memberOfGroup(state, [{ field: 'policy', oneOf: ['sc', 'ip'] }])).toBe(false);
		expect(
			memberOfGroup(state, [{ field: 'subjectObjectIds', oneOf: ['pwa_1'] }]),
			'not a string'
		).toBe(false);
	});

	it('a key is a conjunction, and a missing field is never a member', () => {
		expect(
			memberOfGroup(state, [
				{ field: 'pwaId', equals: 'pwa_1' },
				{ field: 'policy', oneOf: ['rr'] }
			])
		).toBe(true);
		expect(
			memberOfGroup(state, [
				{ field: 'pwaId', equals: 'pwa_1' },
				{ field: 'policy', oneOf: ['sc'] }
			]),
			'every conjunct must hold'
		).toBe(false);
		expect(memberOfGroup(state, [{ field: 'absent', equals: 'pwa_1' }])).toBe(false);
		expect(memberOfGroup(undefined, [{ field: 'pwaId', equals: 'pwa_1' }]), 'no state').toBe(false);
	});
});

describe('the guarded batch refuses only on a declared dependency', () => {
	let store: StorageAdapter;
	let seq = 0;
	const hide = { on: false };
	const busy = { on: false };

	const capture = (intentId: string): DomainCommand => {
		seq += 1;
		return {
			commandId: `c-${seq}`,
			commandType: 'CaptureIntent',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: intentId,
			issuedAt: TS,
			correlationId: `corr-${seq}`,
			idempotencyKey: `idem-${seq}`,
			payload: { intentId, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' }
		};
	};
	const beginDiscovery = (intentId: string): DomainCommand => {
		seq += 1;
		return {
			commandId: `c-${seq}`,
			commandType: 'BeginIntentDiscovery',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: intentId,
			issuedAt: TS,
			correlationId: `corr-${seq}`,
			idempotencyKey: `idem-${seq}`,
			payload: {}
		};
	};
	/** "Intent K": the group whose one member is the intent with that id (the stored state keys it as `id`). */
	const intentGroup = (k: string): DependencyGroup => ({
		name: `intent ${k}`,
		aggregateType: 'INTENT',
		key: [{ field: 'id', equals: id(k) }]
	});

	/** An engine over `over` (the plain store, or one wrapping it), with the base intent captured and the mark taken. */
	function arrange(over: (s: StorageAdapter) => StorageAdapter = (s) => s) {
		const inner = new SqliteStorageAdapter({ now: () => TS });
		store = over(inner);
		const engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
		expect(engine.dispatch(capture(BASE)).status).toBe('ACCEPTED');
		const mark = store.highWaterMark();
		/** Another writer's act: an intent born after the mark. */
		const act = (k: string): string => {
			const r = engine.dispatch(capture(id(k)));
			expect(r.status).toBe('ACCEPTED');
			return r.producedEventIds[0]!;
		};
		const guardedWith = (opts: {
			groups?: readonly DependencyGroup[];
			admittedEventIds?: readonly string[];
			commands?: readonly DomainCommand[];
			preconditions?: readonly RevisionPrecondition[];
			postconditions?: readonly ObjectPostcondition[];
		}) =>
			engine.dispatchBatchGuarded(
				opts.commands ?? [beginDiscovery(BASE)],
				opts.preconditions ?? [{ aggregateId: BASE, expectedRevision: 0 }],
				{ mark, admittedEventIds: opts.admittedEventIds ?? [], groups: opts.groups ?? [] },
				opts.postconditions
			);
		const guarded = (
			groups: readonly DependencyGroup[],
			admittedEventIds: readonly string[] = []
		) => guardedWith({ groups, admittedEventIds });
		const applied = () => inner.loadObject(BASE)?.revision === 1;
		return { engine, inner, act, guarded, guardedWith, applied };
	}

	beforeEach(() => {
		seq = 0;
		hide.on = false;
		busy.on = false;
	});

	it('G-B1 — an event on a member of a declared group refuses, and names the group and the event', () => {
		const { act, guarded, applied } = arrange();
		const foreign = act('1');
		const result = guarded([intentGroup('1')]);
		expect(result.ok).toBe(false);
		expect(result.dependencyViolations).toEqual([
			{
				kind: 'GROUP',
				name: 'intent 1',
				aggregateId: id('1'),
				event: expect.objectContaining({ eventId: foreign, eventType: 'IntentCaptured' }) as unknown
			}
		]);
		expect(applied(), 'the batch did not apply').toBe(false);
	});

	it('G-B2 — CONTROL: an event on a NON-member commits — the write is not the candidate’s business', () => {
		const { act, guarded, applied } = arrange();
		act('2');
		const result = guarded([intentGroup('1')]);
		expect(result.ok, JSON.stringify(result.dependencyViolations)).toBe(true);
		expect(applied()).toBe(true);
	});

	it('G-B3 — every violation is reported, not the first', () => {
		const { act, guarded } = arrange();
		act('1');
		act('3');
		const result = guarded([intentGroup('1'), intentGroup('3')]);
		expect(result.dependencyViolations?.map((v) => v.name)).toEqual(['intent 1', 'intent 3']);
	});

	it('G-B4 — the candidate’s own acts are skipped BY ID; a foreign event on a member is not', () => {
		const { act, guarded } = arrange();
		const own = act('1');
		const foreign = act('3');
		const result = guarded([intentGroup('1'), intentGroup('3')], [own]);
		expect(result.dependencyViolations?.map((v) => v.event?.eventId)).toEqual([foreign]);
	});

	it('G-B5 — a group-typed event whose aggregate cannot be read is refused, never assumed harmless (fail closed)', () => {
		const hidden = id('1');
		const { act, guarded, applied } = arrange((inner) =>
			wrapping(inner, {
				loadObject: (aggregateId) =>
					aggregateId === hidden ? undefined : inner.loadObject(aggregateId)
			})
		);
		act('1');
		const result = guarded([intentGroup('9')]);
		expect(result.dependencyViolations).toEqual([
			expect.objectContaining({ kind: 'UNREADABLE', name: 'intent 9', aggregateId: hidden })
		]);
		expect(applied()).toBe(false);
	});

	it('G-B8 — a key field the member type does not carry is refused, never read as "not a member" (fail closed)', () => {
		// The defect this guards was OBSERVED building this file: a group keyed INTENT on `intentId` — the stored state
		// says `id` — matched nothing, so every change to its "members" would have committed unseen, and G-B2's control
		// passed for the wrong reason.
		const { act, guarded, applied } = arrange();
		act('1');
		const result = guarded([
			{ name: 'misnamed', aggregateType: 'INTENT', key: [{ field: 'intentId', equals: id('1') }] }
		]);
		expect(result.dependencyViolations).toEqual([
			expect.objectContaining({
				kind: 'UNREADABLE',
				name: 'misnamed',
				aggregateId: id('1'),
				detail: "its state has no key field 'intentId'"
			})
		]);
		expect(applied()).toBe(false);
	});

	it('G-B6 — an event on ANOTHER type is not a member, whatever its state holds', () => {
		const { act, guarded, applied } = arrange();
		act('1');
		// The same key, declared on a type no event after the mark carries.
		const result = guarded([
			{ name: 'not intents', aggregateType: 'PWU_TYPE', key: [{ field: 'id', equals: id('1') }] }
		]);
		expect(result.ok, JSON.stringify(result.dependencyViolations)).toBe(true);
		expect(applied()).toBe(true);
	});

	it('G-B7 — a pin whose revision moved is reported beside the group violations', () => {
		const { engine, act, guarded } = arrange();
		act('1');
		expect(engine.dispatch(beginDiscovery(BASE)).status, 'arrangement: the pinned base moves').toBe(
			'ACCEPTED'
		);
		const result = guarded([intentGroup('1')]);
		expect(result.dependencyViolations?.map((v) => `${v.kind}:${v.name}`)).toEqual([
			`PIN:${BASE}`,
			'GROUP:intent 1'
		]);
		expect(result.dependencyViolations?.[0]).toMatchObject({
			expectedRevision: 0,
			actualRevision: 1
		});
	});

	it('G-B9 — an aggregate that reads as ANOTHER type than its event is refused, naming both types (fail closed)', () => {
		const disguised = id('1');
		const { act, guarded, applied } = arrange((inner) =>
			wrapping(inner, {
				loadObject: (aggregateId) => {
					const object = inner.loadObject(aggregateId);
					return aggregateId === disguised && object
						? { ...object, objectType: 'PWU_TYPE' }
						: object;
				}
			})
		);
		act('1');
		const result = guarded([intentGroup('9')]);
		expect(result.dependencyViolations).toEqual([
			expect.objectContaining({
				kind: 'UNREADABLE',
				aggregateId: disguised,
				detail: 'the aggregate reads as PWU_TYPE, not INTENT'
			})
		]);
		expect(applied()).toBe(false);
	});

	it('G-B10 — a member touched twice is reported ONCE, naming the FIRST event that touched it', () => {
		const { engine, act, guarded } = arrange();
		const first = act('1');
		expect(engine.dispatch(beginDiscovery(id('1'))).status).toBe('ACCEPTED');
		const result = guarded([intentGroup('1')]);
		expect(result.dependencyViolations?.map((v) => v.event?.eventId)).toEqual([first]);
	});

	it('G-B11 — a pin reads both ways: an absence that became a birth, and a revision that became an absence', () => {
		const vanished = BASE;
		const { act, guardedWith } = arrange((inner) =>
			wrapping(inner, {
				loadObject: (aggregateId) =>
					aggregateId === vanished && hide.on ? undefined : inner.loadObject(aggregateId)
			})
		);
		act('1');
		hide.on = true;
		const result = guardedWith({
			preconditions: [
				{ aggregateId: id('1'), mustNotExist: true },
				{ aggregateId: vanished, expectedRevision: 0 }
			]
		});
		expect(result.dependencyViolations).toEqual([
			{ kind: 'PIN', name: id('1'), aggregateId: id('1'), actualRevision: 0 },
			{ kind: 'PIN', name: vanished, aggregateId: vanished, expectedRevision: 0 }
		]);
	});

	it('G-B12 — with every dependency held, a replay the handlers refuse is reported as a refusal, never a violation', () => {
		const { guardedWith, applied } = arrange();
		const result = guardedWith({ commands: [beginDiscovery(BASE), beginDiscovery(BASE)] });
		expect(result.ok).toBe(false);
		expect(result.dependencyViolations, 'nothing declared changed').toBeUndefined();
		expect(result.failedIndex).toBe(1);
		expect(applied(), 'the batch rolled back whole').toBe(false);
	});

	it('G-B13 — with every dependency held, a replay that diverges from its candidate rolls back and says so', () => {
		const { guardedWith, applied } = arrange();
		const result = guardedWith({
			postconditions: [{ aggregateId: BASE, expectedContentHash: 'sha256:deliberately-wrong' }]
		});
		expect(result.ok).toBe(false);
		expect(result.postconditionConflict).toMatchObject({
			aggregateId: BASE,
			expectedContentHash: 'sha256:deliberately-wrong'
		});
		expect(applied()).toBe(false);
	});

	it('G-B14 — a store that cannot take its write lock refuses with RPH_STORE_BUSY, out of the guarded batch', () => {
		const { guarded, applied } = arrange((inner) =>
			wrapping(inner, {
				transaction: <T>(fn: () => T): T => {
					if (busy.on) throw new StoreBusyError();
					return inner.transaction(fn);
				}
			})
		);
		busy.on = true;
		let thrown: unknown;
		try {
			guarded([intentGroup('1')]);
		} catch (error) {
			thrown = error;
		}
		busy.on = false;
		expect(thrown).toBeInstanceOf(StoreBusyError);
		expect(applied()).toBe(false);
	});

	it('G-B15 — CONTROL: every dependency held and the replay reproduces the candidate exactly — the batch commits', () => {
		const { inner, guardedWith, applied } = arrange();
		// The candidate as an authoring turn builds one: the SAME command, first on a fork of the store.
		const command = beginDiscovery(BASE);
		const forkStore = new SnapshotOverlayStorageAdapter(inner);
		const fork = new Engine({
			authenticate: testAuthenticator(),
			store: forkStore,
			now: () => TS,
			newEventId: () => `evt_fork_${++seq}`
		}).as(TEST_CRED.human);
		expect(fork.dispatch(command).status, 'arrangement: the candidate').toBe('ACCEPTED');
		const result = guardedWith({
			commands: [command],
			postconditions: [
				{ aggregateId: BASE, expectedContentHash: contentHash(forkStore.loadObject(BASE)) }
			]
		});
		expect(result.ok, JSON.stringify(result.postconditionConflict)).toBe(true);
		expect(applied()).toBe(true);
	});

	it('G-B16 — a postcondition on an aggregate the replay did not produce refuses: absence never satisfies a hash', () => {
		const { guardedWith, applied } = arrange();
		const never = id('55');
		const result = guardedWith({
			postconditions: [{ aggregateId: never, expectedContentHash: 'sha256:anything' }]
		});
		expect(result.ok).toBe(false);
		expect(result.postconditionConflict).toEqual({
			aggregateId: never,
			expectedContentHash: 'sha256:anything',
			actualContentHash: undefined
		});
		expect(applied()).toBe(false);
	});
});

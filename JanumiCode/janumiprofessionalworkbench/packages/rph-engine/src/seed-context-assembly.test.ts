// JAN-CTXPOL / ICP-04 — the id `'ctx-default'` finally RESOLVES, driven against a real engine.
//
// ⭑ `contextAssemblyPolicyId` has been REQUIRED on every `RUNTIME_BINDING` since the field was authored, and
// every binding was minted with the constant `'ctx-default'` (`handlers/runtime-binding.ts:67`) pointing at
// nothing. This is the first test in this system's history that can resolve it.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import {
	DEFAULT_CONTEXT_ASSEMBLY_POLICY,
	DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID,
	LOOP_CONTEXT_ASSEMBLY_POLICY_ID,
	permits,
	resolveContextAssemblyPolicy
} from '@janumipwb/rph-application';
import { RuntimeBindingRequestedPayloadSchema } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { createEngine, listByType, seedContextAssemblyPolicy } from './index.js';

const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

/** ⭑ FINDS BY **POLICY** ID, which is what a RUNTIME_BINDING names — the stored object carries its own minted
 *  `ctxpol_<ULID>` identity, and conflating the two would work only until an id format was enforced. */
const finder = (engine: ReturnType<typeof build>) => (policyId: string) =>
	listByType(engine, 'CONTEXT_ASSEMBLY_POLICY')
		.map((r) => r.state as Record<string, unknown>)
		.find((s) => s.policyId === policyId);

/** ⭐ L17b3 — arrangement: a case may hand in the store, to write a row through the storage port (the lead's ruling 4 on Stage 1's writing). */
function build(store?: SqliteStorageAdapter) {
	let s = 0;
	return createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-09-06T00:00:00Z',
		newEventId: () => `e${++s}`,
		...(store === undefined ? {} : { store })
	}).as(OWNER);
}

describe('JAN-CTXPOL — the seeded policy resolves from a real engine', () => {
	it('⭑⭑ CONTROL — after seeding, `ctx-default` RESOLVES', () => {
		// ⛔ WITHOUT THIS THE REFUSAL BELOW IS "REFUSE EVERYTHING", which is `D-2`'s first horn: *"a fail-closed
		// default breaks every existing binding."* This is the whole reason the default is seeded rather than
		// left to refuse.
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const policy = resolveContextAssemblyPolicy(finder(engine), DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID);
		expect(policy.policyId).toBe(DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID);
	});

	it('⛔ and an unseeded id REFUSES — ICP-04’s exit test, against the real store', () => {
		// THE MUTANT: resolve any id to a permissive default. `ICP-04` names that exact failure — *"seeding a
		// permissive default so the check can never fire"* — and it is the second horn of `D-2`.
		const engine = build();
		seedContextAssemblyPolicy(engine);
		expect(() => resolveContextAssemblyPolicy(finder(engine), 'ctx-nope')).toThrow(
			/does not resolve/
		);
	});

	// ⭐⭐ RESTATED 2026-11-13 (`JAN-EXEC` Phase 7, package L15 — design D69; `REG-D-159`): the stored seed permits the accepted work of
	// the units a unit depends on at THIS_UNDERTAKING, which its instruction now names — and still nothing else there.
	it('⭑ the STORED policy says what the code actually does — CORRECTED at CP-04 ⭐ and at package L15 (D69)', () => {
		// ⚠ THE SEED IS A CLAIM, NOT A STUB, and this asserts the claim is the true one. Its first version
		// asserted `PRIOR_WORK_PRODUCT` was NOT permitted, which was false the day it was written: the held
		// session (`JAN-EXECSESS`) carries the producer's own prior work product into a repair turn. The
		// behaviour was right; this assertion about it was wrong.
		//
		// THE MUTANT: seed a permit-everything policy. It would resolve, every test above would still pass, and
		// the object would mean nothing — the vacuous route `ICP-04` exists to avoid. It is caught by the
		// SECOND assertion, which is now where the falsifiable content lives.
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const policy = resolveContextAssemblyPolicy(finder(engine), DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID);
		expect(permits(policy, 'RENDERED_INSTRUCTION', 'THIS_TRY')).toBe(true);
		expect(permits(policy, 'PRIOR_WORK_PRODUCT', 'THIS_WORK_UNIT')).toBe(true);
		// ⭑ The boundary the correction keeps: the session is per work unit, so nothing crosses into a second ~~.~~ ⭐ — but the
		// accepted work of the units a unit depends on, which its instruction names (package L15, D69): ~~`.toBe(false)`~~ `.toBe(true)`
		// for that pair, and every other source at THIS_UNDERTAKING still refused.
		expect(permits(policy, 'PRIOR_WORK_PRODUCT', 'THIS_UNDERTAKING')).toBe(true);
		for (const source of ['RENDERED_INSTRUCTION', 'PRIOR_REVIEW_FINDING', 'PRIOR_RATIONALE'] as const)
			expect(permits(policy, source, 'THIS_UNDERTAKING'), `${source} crosses into a second unit`).toBe(false);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — `REG-D-170` (the lead's delegated ruling, flagged for the sponsor's confirmation) — A SECOND POLICY, UNDER A NEW
// ID, SEEDED BESIDE `ctx-default`, WHICH STAYS AS IT IS: `ctx-default`'s five pairs and the defect loop's two at THIS_UNDERTAKING; and every binding
// minted from here on names it. ⛔ Still no other unit's instruction: `RENDERED_INSTRUCTION` at THIS_UNDERTAKING stays refused.
describe('⭐⭐ REG-D-170 — ctx-default-loop, seeded beside ctx-default and named by every new binding', () => {
	it('⛔ RED FIRST — the seed holds ctx-default-loop: ctx-default’s five pairs, then PRIOR_RATIONALE and PRIOR_REVIEW_FINDING at THIS_UNDERTAKING', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const loop = resolveContextAssemblyPolicy(finder(engine), LOOP_CONTEXT_ASSEMBLY_POLICY_ID);
		expect(loop.permittedSources, 'the loop’s policy is not ctx-default’s pairs and the two').toEqual([
			...DEFAULT_CONTEXT_ASSEMBLY_POLICY.permittedSources,
			{ source: 'PRIOR_RATIONALE', scope: 'THIS_UNDERTAKING' },
			{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_UNDERTAKING' }
		]);
		expect(permits(loop, 'RENDERED_INSTRUCTION', 'THIS_UNDERTAKING'), 'another unit’s instruction crosses').toBe(false);
		expect(
			listByType(engine, 'CONTEXT_ASSEMBLY_POLICY').map((r) => (r.state as { policyId?: unknown }).policyId),
			'the seed does not hold the two policies'
		).toEqual([DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID, LOOP_CONTEXT_ASSEMBLY_POLICY_ID]);
	});

	it('⭑ CONTROL — ctx-default stays seeded, unchanged: the record of what governed every binding minted before', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const policy = resolveContextAssemblyPolicy(finder(engine), DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID);
		expect(policy.permittedSources, 'ctx-default moved').toEqual(DEFAULT_CONTEXT_ASSEMBLY_POLICY.permittedSources);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89, `REG-D-173` (2)): ~~'⛔ RED FIRST — a binding requested now names
	// ctx-default-loop, which resolves'~~, its payload ~~`{ runtimeBindingId: bindingId, executionStepId: 'plan_01ARZ3NDEKTSV4RRFFQ69H17B1-s1', roleId:
	// 'role-executor', requestedCapabilities: [{ capability: 'file-system' }] }`~~ and ~~`expect(named, 'a new binding does not name the loop’s
	// policy').toBe(LOOP_CONTEXT_ASSEMBLY_POLICY_ID)`~~ — the binding's policy is no constant since D89: the request names it (the page names
	// `ctx-default-loop` for each step the loop's material reaches and `ctx-default` for every other), and the handler records the one named. The promise
	// kept: the policy a new binding names resolves, the loop's among them.
	it('⛔ RED FIRST — a binding records the context policy its request names, either of the two, and the policy it names resolves (D89)', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		for (const [n, policyId] of [
			[1, DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID],
			[2, LOOP_CONTEXT_ASSEMBLY_POLICY_ID]
		] as const) {
			const r = requestBinding(engine, n, { contextAssemblyPolicyId: policyId });
			expect(r.status, `arrangement: the binding — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
			const named = bindingStateOf(engine, n)?.contextAssemblyPolicyId;
			expect(named, 'a new binding does not record the policy its request names').toBe(policyId);
			expect(resolveContextAssemblyPolicy(finder(engine), String(named)).policyId, 'the policy it names does not resolve').toBe(policyId);
		}
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (§12.43; `REG-D-173` (2)) — `RequestRuntimeBinding` NAMES ITS CONTEXT POLICY, REQUIRED, and the
// handler refuses one the store does not hold, recording the one named on the binding (the domain model's §22 field) and on its event.
/** Request binding `n`, its payload the four fields every request has and `over`'s. */
function requestBinding(engine: ReturnType<typeof build>, n: number, over: Record<string, unknown>) {
	const bindingId = bindingIdOf(n);
	return engine.dispatch({
		commandId: `l17b3-bind-${n}`,
		commandType: 'RequestRuntimeBinding',
		commandSchemaVersion: 1,
		targetAggregateType: 'RUNTIME_BINDING',
		targetAggregateId: bindingId,
		issuedAt: '2026-09-06T00:00:00Z',
		correlationId: 'l17b3',
		idempotencyKey: `l17b3-bind-${n}`,
		payload: {
			runtimeBindingId: bindingId,
			executionStepId: `plan_01ARZ3NDEKTSV4RRFFQ69H17B${n}-s1`,
			roleId: 'role-executor',
			requestedCapabilities: [{ capability: 'file-system' }],
			...over
		}
	});
}
const bindingIdOf = (n: number): string => `bind_01ARZ3NDEKTSV4RRFFQ69H17B${n}`;
const bindingStateOf = (engine: ReturnType<typeof build>, n: number) =>
	listByType(engine, 'RUNTIME_BINDING').find((b) => b.id === bindingIdOf(n))?.state as { contextAssemblyPolicyId?: unknown } | undefined;

describe('⭐⭐ L17b3 (D89) — a binding’s request names its context policy', () => {
	// ⭐ AMENDED AFTER STAGE 1'S RUNS (the lead's ruling, `l17b3-facts.md` §7.2 (2)): ~~`expect(r.status, 'a request naming no context policy was
	// accepted').toBe('REJECTED')`~~ — the field is required in the payload's schema, so the command bus refuses a request without it
	// `VALIDATION_FAILED`, before any handler runs (`command-bus.ts:547-548`); and the refusal's reason must name the field, so that a schema refusal
	// for another reason cannot pass it.
	it('⛔ RED FIRST — a request naming no context policy is refused by the payload’s schema, the refusal naming the field, and no binding is made', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const r = requestBinding(engine, 3, {});
		expect(r.status, 'a request naming no context policy was not refused by the payload’s schema').toBe('VALIDATION_FAILED');
		expect(
			((r.error as { details?: { issues?: { path?: unknown }[] } } | undefined)?.details?.issues ?? []).map((i) => i.path),
			'the schema’s refusal does not name the field'
		).toEqual(['contextAssemblyPolicyId']);
		expect(bindingStateOf(engine, 3), 'a binding was made').toBeUndefined();
	});

	// ⭐ AMENDED BEFORE ANY RUN (the lead's ruling 4 on Stage 1's writing: the handler resolves the named policy with the turn's own resolver, and its
	// refusal names the policy and carries the resolver's reason): ~~"RequestRuntimeBinding blocked: the context assembly policy 'ctx-nope' is not held
	// by this store, so the binding would name a policy that cannot govern its step. Create the policy, or name one this store holds (design D89)."~~
	it('⛔ RED FIRST — a request naming a policy this store does not hold is refused, naming it, with the resolver’s reason, and no binding is made', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const r = requestBinding(engine, 4, { contextAssemblyPolicyId: 'ctx-nope' });
		// ⭐ AMENDED AFTER STAGE 1'S RUNS (§7.2 (1)): ~~'a request naming a policy this store does not hold was accepted'~~ — the status line says what it
		// checks: the handler's own refusal, `REJECTED`, never the schema's. At the base this line reddens (the base's schema refuses the fifth key).
		expect(r.status, 'a request naming a policy this store does not hold was not refused by the binding’s handler (REJECTED)').toBe('REJECTED');
		expect(r.error?.message, 'the refusal does not name the policy and why').toContain(
			"RequestRuntimeBinding blocked: the binding would name the context assembly policy 'ctx-nope', which this store does not hold as a policy, so it could not govern its step: Context assembly policy 'ctx-nope' does not resolve."
		);
		expect(r.error?.message, 'the refusal does not say what to do').toContain('Create the policy, or name one this store holds (design D89).');
		expect(bindingStateOf(engine, 4), 'a binding was made').toBeUndefined();
	});

	// ⭐⭐ The lead's ruling 4 on Stage 1's writing (`l17b3-facts.md` §5.2) — THE BINDING REFUSES EXACTLY WHAT THE TURN WOULD: the named policy resolved
	// with `resolveContextAssemblyPolicy` itself, given the turn's finder by `policyId` — so an object held by that policy id that is not a policy is
	// refused at the binding too, with the resolver's reason.
	it('⛔ RED FIRST — a request naming a policy id whose stored object is not a policy is refused, with the resolver’s reason, as the turn would refuse it', () => {
		const store = new SqliteStorageAdapter({ now: () => '2026-09-06T00:00:00Z' });
		const engine = build(store);
		seedContextAssemblyPolicy(engine);
		// ⭑ A policy created as any is, then its stored state overwritten through the storage port — as a row no command wrote would stand — so the object
		// held by that policy id is not a policy (`floor-gate.test.ts` writes a stored state the same way).
		const objectId = 'ctxpol_0000000000000000000000CTX9';
		const created = engine.dispatch({
			commandId: 'l17b3-ctx-broken',
			commandType: 'CreateContextAssemblyPolicy',
			commandSchemaVersion: 1,
			targetAggregateType: 'CONTEXT_ASSEMBLY_POLICY',
			targetAggregateId: objectId,
			issuedAt: '2026-09-06T00:00:00Z',
			correlationId: 'l17b3',
			idempotencyKey: 'l17b3-ctx-broken',
			payload: { policyId: 'ctx-broken', permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }] }
		});
		expect(created.status, `arrangement: the policy — ${created.error?.message ?? ''}`).toBe('ACCEPTED');
		const stored = store.loadObject(objectId)!;
		const written = store.commit({
			aggregateType: 'CONTEXT_ASSEMBLY_POLICY',
			aggregateId: objectId,
			objectType: 'CONTEXT_ASSEMBLY_POLICY',
			expectedRevision: stored.revision,
			newRevision: stored.revision + 1,
			newSemanticVersion: stored.semanticVersion,
			currentState: { ...(stored.state as Record<string, unknown>), permittedSources: 'everything' },
			events: [],
			receipt: {
				commandId: 'l17b3-ctx-broken-state',
				idempotencyKey: 'l17b3-ctx-broken-state',
				commandType: 'FixtureOverwritePolicyState',
				targetAggregateId: objectId,
				status: 'ACCEPTED',
				producedEventIds: []
			}
		});
		expect(written.ok, 'arrangement: the stored state was not overwritten').toBe(true);
		// ⭐ AMENDED AFTER STAGE 1'S RUNS (the review's L17-19; §7.4 (1)): the turn's resolver's own reason, captured whole — the complete reason, with
		// the issue its resolver names for the overwritten field — is what the binding's refusal must carry, not its prefix alone.
		let turnsReason = '';
		try {
			resolveContextAssemblyPolicy(finder(engine), 'ctx-broken');
		} catch (e) {
			turnsReason = e instanceof Error ? e.message : String(e);
		}
		expect(
			[turnsReason.startsWith("Context assembly policy 'ctx-broken' resolved to an object that is not a policy: "), turnsReason.includes('permittedSources: ')],
			'arrangement: the turn’s resolver does not refuse it, naming the field'
		).toEqual([true, true]);

		const r = requestBinding(engine, 6, { contextAssemblyPolicyId: 'ctx-broken' });

		// ⭐ AMENDED AFTER STAGE 1'S RUNS (§7.2 (1)): ~~'a request naming an object that is not a policy was accepted'~~ — the line says what it checks.
		expect(r.status, 'a request naming an object that is not a policy was not refused by the binding’s handler (REJECTED)').toBe('REJECTED');
		// ⭐ AMENDED (L17-19): ~~`… resolved to an object that is not a policy: "`~~, the prefix — the refusal carries the resolver's reason WHOLE.
		expect(r.error?.message, 'the refusal does not name the policy and carry the resolver’s reason whole').toContain(
			`RequestRuntimeBinding blocked: the binding would name the context assembly policy 'ctx-broken', which this store does not hold as a policy, so it could not govern its step: ${turnsReason}`
		);
		expect(bindingStateOf(engine, 6), 'a binding was made').toBeUndefined();
	});

	// ⭐⭐ The review's L17-07 (§7.4 (1)) — THE EVENT'S FIELD IS OPTIONAL, AND THAT IS HELD BOTH WAYS (§3.2 ruling 7: "optional in the event's schema,
	// written on every new event, required on the command"): every `RuntimeBindingRequested` recorded before this package — without the field — still
	// parses, so it replays; and a new one carrying it parses too.
	it('⭑ CONTROL — a RuntimeBindingRequested recorded before this package, without the field, still parses: the field is optional in the event’s schema', () => {
		const historical = { executionStepId: 'plan_01ARZ3NDEKTSV4RRFFQ69H17B9-s1', roleId: 'MODEL', requestedCapabilities: [{ capability: 'network' }], authorizationStatus: 'REQUESTED' };
		expect(RuntimeBindingRequestedPayloadSchema.safeParse(historical).success, 'a historical event without the field no longer parses').toBe(true);
	});

	it('⛔ RED FIRST — and a new RuntimeBindingRequested carrying the field parses: the field is in the event’s schema', () => {
		const current = {
			executionStepId: 'plan_01ARZ3NDEKTSV4RRFFQ69H17B9-s1',
			roleId: 'MODEL',
			requestedCapabilities: [{ capability: 'network' }],
			authorizationStatus: 'REQUESTED',
			contextAssemblyPolicyId: LOOP_CONTEXT_ASSEMBLY_POLICY_ID
		};
		const parsed = RuntimeBindingRequestedPayloadSchema.safeParse(current);
		expect(parsed.success, 'an event carrying the policy it names does not parse').toBe(true);
	});

	it('⛔ RED FIRST — the binding’s RuntimeBindingRequested event carries the policy it names', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const r = requestBinding(engine, 5, { contextAssemblyPolicyId: LOOP_CONTEXT_ASSEMBLY_POLICY_ID });
		expect(r.status, `arrangement: the binding — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		const event = engine.readAllEvents().find((e) => e.eventType === 'RuntimeBindingRequested' && e.aggregateId === bindingIdOf(5));
		expect((event?.payload as { contextAssemblyPolicyId?: unknown } | undefined)?.contextAssemblyPolicyId, 'the event does not carry the policy the binding names').toBe(
			LOOP_CONTEXT_ASSEMBLY_POLICY_ID
		);
	});
});

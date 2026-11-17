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

function build() {
	let s = 0;
	return createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-09-06T00:00:00Z',
		newEventId: () => `e${++s}`
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

	it('⛔ RED FIRST — a binding requested now names ctx-default-loop, which resolves', () => {
		const engine = build();
		seedContextAssemblyPolicy(engine);
		const bindingId = 'bind_01ARZ3NDEKTSV4RRFFQ69H17B1';
		const r = engine.dispatch({
			commandId: 'l17b1-bind-1',
			commandType: 'RequestRuntimeBinding',
			commandSchemaVersion: 1,
			targetAggregateType: 'RUNTIME_BINDING',
			targetAggregateId: bindingId,
			issuedAt: '2026-09-06T00:00:00Z',
			correlationId: 'l17b1',
			idempotencyKey: 'l17b1-bind-1',
			payload: {
				runtimeBindingId: bindingId,
				executionStepId: 'plan_01ARZ3NDEKTSV4RRFFQ69H17B1-s1',
				roleId: 'role-executor',
				requestedCapabilities: [{ capability: 'file-system' }]
			}
		});
		expect(r.status, `arrangement: the binding — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		const named = (listByType(engine, 'RUNTIME_BINDING').find((b) => b.id === bindingId)?.state as { contextAssemblyPolicyId?: unknown } | undefined)
			?.contextAssemblyPolicyId;
		expect(named, 'a new binding does not name the loop’s policy').toBe(LOOP_CONTEXT_ASSEMBLY_POLICY_ID);
		expect(resolveContextAssemblyPolicy(finder(engine), String(named)).policyId, 'the policy it names does not resolve').toBe(
			LOOP_CONTEXT_ASSEMBLY_POLICY_ID
		);
	});
});

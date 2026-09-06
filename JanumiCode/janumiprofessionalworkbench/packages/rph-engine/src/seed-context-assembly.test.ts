// JAN-CTXPOL / ICP-04 — the id `'ctx-default'` finally RESOLVES, driven against a real engine.
//
// ⭑ `contextAssemblyPolicyId` has been REQUIRED on every `RUNTIME_BINDING` since the field was authored, and
// every binding was minted with the constant `'ctx-default'` (`handlers/runtime-binding.ts:67`) pointing at
// nothing. This is the first test in this system's history that can resolve it.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import {
	DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID,
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

	it('⭑ the STORED policy says what the code actually does — CORRECTED at CP-04', () => {
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
		// ⭑ The boundary the correction keeps: the session is per work unit, so nothing crosses into a second.
		expect(permits(policy, 'PRIOR_WORK_PRODUCT', 'THIS_UNDERTAKING')).toBe(false);
	});
});

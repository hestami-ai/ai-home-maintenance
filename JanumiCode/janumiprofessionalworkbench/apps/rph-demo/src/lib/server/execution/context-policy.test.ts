// JAN-CTXPOL / CP-04d — the policy id resolves against a REAL store, or the step refuses.
//
// ⭑ `ICP-04`'s exit test — *"point a binding at a policy that does not exist. This MUST refuse"* — stood only
// in a unit test with a hand-built finder. This drives it through the engine the demo actually runs on.
import { describe, expect, it } from 'vitest';
import { openWorkbench } from '../workbench.js';
import {
	contextPolicyIdFor,
	resolveContextPolicy,
	resolveContextPolicyFrom
} from './context-policy.js';

describe('CP-04d — which policy id governs a step, and where it came from', () => {
	it('⭑ a RUNTIME_BINDING for the step supplies the id, and the provenance says so', () => {
		// ⭑ THE RATIFIED CARRIER, READ. `contextAssemblyPolicyId` has been REQUIRED on every binding since the
		// field was authored and every binding was minted with a constant pointing at nothing.
		expect(
			contextPolicyIdFor(
				[{ executionStepId: 'step-1', contextAssemblyPolicyId: 'ctx-special' }],
				'step-1'
			)
		).toEqual({ policyId: 'ctx-special', from: 'RUNTIME_BINDING' });
	});

	it('⚠ with NO binding for the step, the host default is used — and the gap is DISCLOSED', () => {
		// ⛔ THE MUTANT: return the default and drop `from`. The demo's own plans activate with
		// `authorizedRuntimeBindingIds: []`, so this is the branch production actually takes — and a fallback
		// that does not say it is one is the value-standing-in-for-a-decision defect this programme is about.
		expect(contextPolicyIdFor([], 'step-1')).toEqual({
			policyId: 'ctx-default',
			from: 'HOST_DEFAULT'
		});
	});

	it('⚠ a binding for a DIFFERENT step does not supply this one’s id', () => {
		// THE MUTANT: take the first binding in the list. With more than one step in a plan, every step would
		// then be governed by whichever binding happened to be stored first.
		expect(contextPolicyIdFor([{ executionStepId: 'step-2' }], 'step-1').from).toBe('HOST_DEFAULT');
	});

	it('⚠ a binding whose id is EMPTY falls through rather than resolving to nothing', () => {
		// THE MUTANT: trust the field's presence rather than its content. `resolveContextAssemblyPolicy('')`
		// would then refuse with "'' does not resolve", naming nothing a reader can act on.
		expect(
			contextPolicyIdFor([{ executionStepId: 'step-1', contextAssemblyPolicyId: '' }], 'step-1')
				.from
		).toBe('HOST_DEFAULT');
	});
});

describe('CP-04d — resolution against the engine the demo runs on', () => {
	it('⭑⭑ CONTROL — the seeded policy RESOLVES from the real store', () => {
		// ⛔ Without this the refusal below is "refuse everything", which is `D-2`'s first horn: the fail-closed
		// default that breaks every existing binding. It is also the only assertion here that touches the DEMO'S
		// OWN engine, so it is what proves the seed reaches production rather than only the engine package.
		const { policy, from } = resolveContextPolicy(openWorkbench(), 'no-such-step');
		expect(policy.policyId).toBe('ctx-default');
		expect(from).toBe('HOST_DEFAULT');
		expect(policy.permittedSources.length).toBeGreaterThan(0);
	});

	it('⛔ a binding naming a policy that does not exist REFUSES', () => {
		// ⭑ `ICP-04`'S STATED EXIT TEST, through the same function the route calls. THE MUTANT: resolve an
		// unknown id to `DEFAULT_CONTEXT_ASSEMBLY_POLICY` — the second horn, *"a permissive seed reproduces the
		// vacuous route"*, and the check could never fire again.
		expect(() =>
			resolveContextPolicyFrom(
				[{ executionStepId: 'step-1', contextAssemblyPolicyId: 'ctx-nope' }],
				[{ policyId: 'ctx-default', permittedSources: [] }],
				'step-1'
			)
		).toThrow(/does not resolve/);
	});

	it('⛔ and a deployment that never seeded the policy refuses too, rather than assuming one', () => {
		// ⚠ THE SAME REFUSAL FROM THE OTHER DIRECTION: the id is fine and the STORE is empty. THE MUTANT: treat
		// an empty policy list as "no policy configured, proceed" — which is the vacuous route wearing the
		// clothes of a cold start.
		expect(() => resolveContextPolicyFrom([], [], 'step-1')).toThrow(/does not resolve/);
	});
});

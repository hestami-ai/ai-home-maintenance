// JAN-CTXPOL / CP-04d — resolving the policy on the LIVE path, so the reader is consulted with real data.
//
// ⭑ `ICP-04`'s exit test is *"point a binding at a policy that does not exist. This MUST refuse."* Until this
// module, that refusal stood only in a unit test with a hand-built finder. Here it stands where an execution
// actually happens, against the engine's own store.
import { listByType, type EngineHandle } from '@janumipwb/rph-engine';
import {
	DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID,
	resolveContextAssemblyPolicy,
	type ContextAssemblyPolicyContent
} from '@janumipwb/rph-application';

/**
 * Which policy id governs this step, and where that id CAME FROM.
 *
 * ⛔ THE PROVENANCE IS RETURNED, NOT SWALLOWED, and that is the point. `contextAssemblyPolicyId` lives on
 * `RUNTIME_BINDING` — that is the ratified carrier. But the demo's execution action mints its plan inline and
 * activates it with `authorizedRuntimeBindingIds: []`, so a demo-run step HAS NO BINDING. Falling back to the
 * host's default silently would be the same defect this whole programme is about: a value standing in for a
 * decision, with nothing recording that it did.
 *
 * ⚠ MINTING A BINDING HERE IS NOT TAKEN. `RequestRuntimeBinding` refuses a request naming no capability (N-20)
 * and `AuthorizeRuntimeBinding` refuses an authorization granting nothing (N-22); doing it properly is a
 * capability-modelling exercise, not a line in this slice.
 */
export function contextPolicyIdFor(
	bindings: readonly Record<string, unknown>[],
	stepId: string
): { readonly policyId: string; readonly from: 'RUNTIME_BINDING' | 'HOST_DEFAULT' } {
	const binding = bindings.find((b) => b.executionStepId === stepId);
	const declared = binding?.contextAssemblyPolicyId;
	return typeof declared === 'string' && declared.length > 0
		? { policyId: declared, from: 'RUNTIME_BINDING' }
		: { policyId: DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID, from: 'HOST_DEFAULT' };
}

/**
 * Resolve the governing policy from the engine's own store, or REFUSE.
 *
 * ⭑ THE FINDER IS BY **POLICY** ID, matching what a binding names — the stored object carries its own minted
 * `ctxpol_<ULID>` identity, and conflating the two would work only until an id format was enforced.
 */
export function resolveContextPolicyFrom(
	bindings: readonly Record<string, unknown>[],
	policies: readonly Record<string, unknown>[],
	stepId: string
): { readonly policy: ContextAssemblyPolicyContent; readonly from: string } {
	const { policyId, from } = contextPolicyIdFor(bindings, stepId);
	const policy = resolveContextAssemblyPolicy(
		(id) => policies.find((p) => p.policyId === id),
		policyId
	);
	return { policy, from };
}

/**
 * The same resolution, reading both lists from the engine.
 *
 * ⚠ SPLIT FROM `resolveContextPolicyFrom` SO THE REFUSAL IS REACHABLE WITHOUT A FAKE. `openWorkbench` always
 * seeds, so there is no unseeded engine to point at a missing policy — and my first attempt at this test
 * stubbed `loadObject` to return `undefined`, which makes EVERY object unloadable and would have reddened for
 * a reason unrelated to the one its name claimed.
 */
export function resolveContextPolicy(
	engine: EngineHandle,
	stepId: string
): { readonly policy: ContextAssemblyPolicyContent; readonly from: string } {
	return resolveContextPolicyFrom(
		listByType(engine, 'RUNTIME_BINDING').map((b) => b.state as Record<string, unknown>),
		listByType(engine, 'CONTEXT_ASSEMBLY_POLICY').map((p) => p.state as Record<string, unknown>),
		stepId
	);
}

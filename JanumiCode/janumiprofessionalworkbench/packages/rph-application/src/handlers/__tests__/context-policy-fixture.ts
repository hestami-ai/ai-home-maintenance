// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`REG-D-173` (2)) — A CONTEXT ASSEMBLY POLICY HELD BY A TEST'S STORE, so a binding request can name
// one: `RequestRuntimeBinding` now names its step's context policy (required), and its handler refuses a policy the store does not hold
// (`handlers/runtime-binding.ts`). A test of a bare engine — which seeds nothing — holds the default policy through the command, as the seed holds it
// (`seed-workbench.ts`), and names it. Arrangement only: what each test checks is unchanged.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '../../context-assembly.js';

/** The policy a test's binding request names: the default, `ctx-default`, as a step outside the loop's is. */
export const HELD_CONTEXT_POLICY_ID = DEFAULT_CONTEXT_ASSEMBLY_POLICY.policyId;

/** Hold the default context assembly policy in `engine`'s store, through the command; an arrangement that fails throws, naming why. */
export function holdDefaultContextPolicy(
	engine: { dispatch(command: DomainCommand): { readonly status: string; readonly error?: { readonly message?: string } } },
	issuedAt: string
): void {
	const r = engine.dispatch({
		commandId: 'c-held-context-policy',
		commandType: 'CreateContextAssemblyPolicy',
		commandSchemaVersion: 1,
		targetAggregateType: 'CONTEXT_ASSEMBLY_POLICY',
		targetAggregateId: 'ctxpol_01ARZ3NDEKTSV4RRFFQ69HBCTX',
		issuedAt,
		correlationId: 'held-context-policy',
		idempotencyKey: 'k-held-context-policy',
		payload: { policyId: DEFAULT_CONTEXT_ASSEMBLY_POLICY.policyId, permittedSources: DEFAULT_CONTEXT_ASSEMBLY_POLICY.permittedSources }
	} as DomainCommand);
	if (r.status !== 'ACCEPTED') throw new Error(`arrangement: the held context policy — ${r.error?.message ?? r.status}`);
}

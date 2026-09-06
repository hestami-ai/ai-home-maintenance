// JAN-CTXPOL / ICP-04 — the READER, which is the half that makes the object worth having.
//
// ⭑ `ICP-04`'s deliverable is *"an object, an id that resolves, and a reader"*. Three ratified slots in this
// system already have no reader (`contextAssemblyPolicyId`, `memoryPolicyId`, `PWU_TYPE.contextSpecification`);
// adding a fourth would be the defect rather than the fix.
import { z } from 'zod';
import { ContextSourceRuleSchema, type ContextSourceRule } from '@janumipwb/rph-contracts';

/**
 * What the READER consumes — the policy's CONTENT, not the stored envelope.
 *
 * ⭑ DELIBERATELY NOT `ContextAssemblyPolicySchema`. That is the full stored object and requires `id`,
 * `objectType`, `revision`, `createdBy` and nine more envelope fields the reader never looks at; parsing
 * against it would couple this consumer to envelope details it does not use, and would reject a perfectly
 * good policy handed to it from anywhere but the store. ⚠ It is `z.object`, not `z.strictObject`, precisely so
 * a STORED row — envelope and all — parses here unchanged.
 */
const PolicyContentSchema = z.object({
	policyId: z.string(),
	permittedSources: z.array(ContextSourceRuleSchema)
});

/** The policy as its reader sees it. */
export type ContextAssemblyPolicyContent = z.infer<typeof PolicyContentSchema>;

/** The id every `RUNTIME_BINDING` is minted with (`handlers/runtime-binding.ts:67`). */
export const DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID = 'ctx-default';

/**
 * What this deployment permits a producer to be given, seeded as a TRUE statement of today's behaviour.
 *
 * ⛔ NOT A PERMISSIVE STUB, AND THAT IS THE WHOLE POINT OF `D-2`. The roadmap names the trap in terms: *"a
 * fail-closed default breaks every existing binding; a permissive seed reproduces the vacuous route."* A policy
 * that permitted everything would resolve and mean nothing — the check could never fire. This one says exactly
 * what the execution path does today: it assembles the rendered instruction and nothing prior. It resolves, so
 * no binding breaks; and it is FALSIFIABLE, so the day the behaviour widens the policy is wrong until updated.
 */
export const DEFAULT_CONTEXT_ASSEMBLY_POLICY: ContextAssemblyPolicyContent = Object.freeze({
	policyId: DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID,
	permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
}) as ContextAssemblyPolicyContent;

/**
 * Resolve a binding's `contextAssemblyPolicyId` to the policy it names, or REFUSE.
 *
 * ⛔ THE REFUSAL IS `ICP-04`'S STATED EXIT TEST: *"Point a binding at a policy that does not exist. This MUST
 * refuse."* An id that names nothing is not a permissive default — it is a binding that cannot say what its
 * producer may be given, and proceeding would assemble context under no declared authority.
 *
 * ⚠ IT REFUSES ON SHAPE TOO, not only on absence. A stored row that does not parse as a policy is the same
 * failure wearing a better disguise: the id resolved, and what came back cannot govern anything.
 */
export function resolveContextAssemblyPolicy(
	// ⭑ A FINDER BY **POLICY** ID, NOT A LOADER BY OBJECT ID, and the emitted schema is what made the difference
	// explicit. A `RUNTIME_BINDING` names a POLICY (`'ctx-default'`) exactly as `FLOOR_POLICY_IDS` names
	// `'floor.reasoning-review'`; the stored object has a mintable identity of its own (`ctxpol_<ULID>`).
	// Conflating the two would have worked only until an id format was enforced.
	findByPolicyId: (policyId: string) => unknown,
	policyId: string
): ContextAssemblyPolicyContent {
	const raw = findByPolicyId(policyId);
	if (raw === undefined || raw === null)
		throw new Error(
			`Context assembly policy '${policyId}' does not resolve. A RUNTIME_BINDING names it (ICP-04), and an ` +
				'id that names nothing cannot say what the producer may be given. Seed the policy or correct the ' +
				'binding — refusing rather than assembling context under no declared authority.'
		);
	const parsed = PolicyContentSchema.safeParse(raw);
	if (!parsed.success)
		throw new Error(
			`Context assembly policy '${policyId}' resolved to an object that is not a policy: ` +
				`${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
		);
	return parsed.data;
}

/**
 * Is a source permitted by this policy, at this scope?
 *
 * ⭑ THE CONSULTATION, kept separate from the resolution so a caller cannot resolve a policy and then ignore it
 * without that being visible at the call site.
 */
export function permits(
	policy: ContextAssemblyPolicyContent,
	source: ContextSourceRule['source'],
	scope: ContextSourceRule['scope']
): boolean {
	return policy.permittedSources.some((r) => r.source === source && r.scope === scope);
}

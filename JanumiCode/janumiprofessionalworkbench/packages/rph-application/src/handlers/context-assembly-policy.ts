// JAN-CTXPOL / ICP-04 — the object `contextAssemblyPolicyId` has always named and never had.
//
// ⭑ AUTHORED 2026-09-06 UNDER SPONSOR GRANT (D-1). `contextAssemblyPolicyId` is REQUIRED on `RUNTIME_BINDING`
// and every binding is minted with the constant `'ctx-default'` (`handlers/runtime-binding.ts:67`) pointing at
// nothing. `ICP-04`'s deliverable is *"an object, an id that resolves, and a reader"*; this is the first.
//
// ⚠ BORN TERMINAL, like `MODEL_EXCHANGE`: there is no second status because there is no second command. A
// policy is created and read; editing it is a later question and would be its own command with its own
// versioning story, not a status arrow bolted on here.
import type { CreateContextAssemblyPolicyPayload } from '@janumipwb/rph-contracts';
import { createObject, newEnvelope, type CommandHandler } from './kit.js';

const CONTEXT_ASSEMBLY_POLICY = 'CONTEXT_ASSEMBLY_POLICY';

export const createContextAssemblyPolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreateContextAssemblyPolicyPayload;
	// ⭑ THE OBJECT ID IS THE COMMAND'S TARGET; THE POLICY ID IS CONTENT. A `RUNTIME_BINDING` names the POLICY
	// ('ctx-default'), the way `FLOOR_POLICY_IDS` names 'floor.reasoning-review' — while the stored object needs
	// its own mintable identity (`ctxpol_<ULID>`). ⚠ The first version used `policyId` for both and the emitted
	// schema refused it: the id format is enforced for this type because it HAS an emitted schema, which
	// ASSURANCE_POLICY does not. The schema was right and the handler was wrong.
	const objectId = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, CONTEXT_ASSEMBLY_POLICY, objectId, {
			lifecycleStatus: 'ACTIVE',
			originType: 'HUMAN_DECISION'
		}),
		policyId: p.policyId,
		permittedSources: p.permittedSources
	};
	return createObject(ctx, command, {
		objectType: CONTEXT_ASSEMBLY_POLICY,
		aggregateId: objectId,
		state,
		eventType: 'ContextAssemblyPolicyCreated',
		// ⭑ THE FULL FIELD SET, for the reason `RecordModelExchange` records: `PER-2` requires that
		// "authoritative history remains reconstructable" and that current state is "a cache of this history,
		// not a second authority." A partial payload would invert that.
		eventPayload: { policyId: p.policyId, permittedSources: p.permittedSources }
	});
};

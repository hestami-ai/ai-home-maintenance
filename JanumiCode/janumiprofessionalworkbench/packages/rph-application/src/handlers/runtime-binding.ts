// Runtime Binding handlers — the RuntimeBinding.authorizationStatus machine REQUESTED -> {AUTHORIZED | DENIED};
// AUTHORIZED -> REVOKED. A binding grants scoped runtime capability to an execution step and carries NO semantic
// authority (§2.4); requested capability is NOT granted capability (§22.1) — AuthorizeRuntimeBinding records the
// separately-granted set. A revoked binding cannot back a new attempt (§22.1).
import type { RequestRuntimeBindingPayload } from '@janumipwb/rph-contracts';
import { advanceStatus, createObject, newEnvelope, type CommandHandler } from './kit.js';

const BINDING = 'RUNTIME_BINDING';
const MACHINE = 'RuntimeBinding.authorizationStatus';

/** RequestRuntimeBinding — create a RuntimeBinding in REQUESTED for an execution step. */
export const requestRuntimeBinding: CommandHandler = (ctx, command, payload) => {
	const p = payload as RequestRuntimeBindingPayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, BINDING, p.runtimeBindingId, {
			lifecycleStatus: 'REQUESTED',
			originType: 'DERIVED',
			sourceObjectIds: [p.executionStepId]
		}),
		executionStepId: p.executionStepId,
		roleId: p.roleId,
		modelSelectionPolicy: {},
		requestedCapabilities: p.requestedCapabilities,
		grantedCapabilities: [],
		sandboxPolicy: {},
		contextAssemblyPolicyId: 'ctx-default',
		observabilityPolicyId: 'obs-default',
		authorizationStatus: 'REQUESTED'
	};
	return createObject(ctx, command, {
		objectType: BINDING,
		aggregateId: p.runtimeBindingId,
		state,
		eventType: 'RuntimeBindingRequested'
	});
};

/** AuthorizeRuntimeBinding — REQUESTED -> AUTHORIZED (records the granted capability set). */
export const authorizeRuntimeBinding: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'AUTHORIZED',
		eventType: 'RuntimeBindingAuthorized',
		mutate: (base) => {
			const p = command.payload as { grantedCapabilities?: unknown[] };
			return { ...base, grantedCapabilities: p.grantedCapabilities ?? [] };
		}
	});

/** DenyRuntimeBinding — REQUESTED -> DENIED. */
export const denyRuntimeBinding: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'DENIED',
		eventType: 'RuntimeBindingDenied'
	});

/** RevokeRuntimeCapability — AUTHORIZED -> REVOKED (a revoked binding cannot back a new attempt). */
export const revokeRuntimeCapability: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'REVOKED',
		eventType: 'RuntimeCapabilityRevoked'
	});

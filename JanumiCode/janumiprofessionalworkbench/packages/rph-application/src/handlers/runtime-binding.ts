// Runtime Binding handlers — the RuntimeBinding.authorizationStatus machine REQUESTED -> {AUTHORIZED | DENIED};
// AUTHORIZED -> REVOKED. A binding grants scoped runtime capability to an execution step and carries NO semantic
// authority (§2.4); requested capability is NOT granted capability (§22.1) — AuthorizeRuntimeBinding records the
// separately-granted set. A revoked binding cannot back a new attempt (§22.1).
import type { RequestRuntimeBindingPayload } from '@janumipwb/rph-contracts';
import { grantedWithinRequest } from '@janumipwb/rph-domain';
import { advanceStatus, createObject, newEnvelope, reject, type CommandHandler } from './kit.js';
import { fromStates } from './command-precondition.js';

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
		// Machine in-arrows to AUTHORIZED are REQUESTED|PARTIALLY_AUTHORIZED. Without this an already-AUTHORIZED
		// binding could be re-authorized: the mutate REPLACES the granted capability set wholesale, so a second actor
		// could grant capabilities the binding never REQUESTED (§22.1 — requested is not granted), with no new request
		// and no new authorization decision, leaving two RuntimeBindingAuthorized events and nothing saying which
		// governs. Runtime bindings gate what an execution step may actually do, so this is a privilege escalation.
		precondition: fromStates('REQUESTED', 'PARTIALLY_AUTHORIZED'),
		// ── N-4 CLOSED (JAN-CAPBIND WP-2): a grant may not exceed its request ───────────────────────────────────
		//
		// THE DEFECT. The `mutate` below writes `grantedCapabilities` WHOLESALE from the payload, checked against
		// nothing. The comment above named the hazard — "a second actor could grant capabilities the binding never
		// REQUESTED" — and then guarded only the RE-authorization case via `fromStates`. The FIRST authorization was
		// entirely unconstrained, so `?? []` was the only thing standing between a payload and the granted set.
		//
		// §22.1 forbids it twice over: "requested capability is not granted capability", and "privilege expansion
		// requires a new authorization event" — granting what was never asked for IS expansion, and performing it
		// inside an authorization of something else is expansion without its own event.
		//
		// SITED IN `guard`, NOT IN AN `allOf` PRECONDITION, and the ordering is the reason. `advanceStatus` runs
		// precondition -> guard -> checkTransition, so `fromStates` still wins on a SECOND authorization and the
		// existing re-issue battery keeps asserting the state machine rather than this rule. Folding both into a
		// hand-ordered `allOf` would make that ordering mine to maintain; here the primitive owns it.
		//
		// SUBSET IS PERMITTED. A narrower grant is legal — it is RPH-EXE-004's own example and the reason the
		// ratified machine has PARTIALLY_AUTHORIZED. Refusing partial grants would strand every least-privilege
		// authorization, which is the over-refusal half this is most at risk of.
		guard: (state) => {
			const p = command.payload as { grantedCapabilities?: unknown[] };
			const check = grantedWithinRequest({
				requested: capabilityIds(state.requestedCapabilities),
				granted: capabilityIds(p.grantedCapabilities)
			});
			if (check.ok) return null;
			// The kernel's label travels in the MESSAGE: `RPH_CAPABILITY_NOT_REQUESTED` is not a member of the
			// ratified 15-value RphErrorCodeSchema, so it goes there or nowhere (the WP-11 discipline).
			return reject(
				command,
				'RPH_INVARIANT_VIOLATION',
				`AuthorizeRuntimeBinding blocked (${check.errorCode}): ${check.reason}. Request the additional capability on a new RuntimeBinding, then authorize that.`,
				[command.targetAggregateId]
			);
		},
		eventType: 'RuntimeBindingAuthorized',
		mutate: (base) => {
			const p = command.payload as { grantedCapabilities?: unknown[] };
			return { ...base, grantedCapabilities: p.grantedCapabilities ?? [] };
		}
	});

/**
 * Project a persisted capability array onto its comparable IDENTITIES.
 *
 * Defensive about the element shape on purpose: these arrays are read from the STORE, so they include rows written
 * before WP-0 authored `CapabilityRequest`/`CapabilityGrant`, when the contract emitted an opaque record and any
 * object was legal. An element that carries no `capability` contributes no identity rather than throwing — and it
 * cannot be laundered into a match either, because `undefined` is filtered out rather than compared.
 */
const capabilityIds = (raw: unknown): string[] =>
	(Array.isArray(raw) ? raw : [])
		.map((c) => (c as { capability?: unknown })?.capability)
		.filter((c): c is string => typeof c === 'string');

/** DenyRuntimeBinding — REQUESTED -> DENIED. */
export const denyRuntimeBinding: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'DENIED',
		precondition: fromStates('REQUESTED'), // the machine's only in-arrow to DENIED
		eventType: 'RuntimeBindingDenied'
	});

/** RevokeRuntimeCapability — AUTHORIZED -> REVOKED (a revoked binding cannot back a new attempt). */
export const revokeRuntimeCapability: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'REVOKED',
		// In-arrows: AUTHORIZED|PARTIALLY_AUTHORIZED. A re-revocation would re-write the revocation reason/actor over
		// an already-revoked binding and append a second RuntimeCapabilityRevoked for a revocation that did not occur.
		precondition: fromStates('AUTHORIZED', 'PARTIALLY_AUTHORIZED'),
		eventType: 'RuntimeCapabilityRevoked'
	});

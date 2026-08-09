// Runtime Binding handlers — the RuntimeBinding.authorizationStatus machine REQUESTED -> {AUTHORIZED | DENIED};
// AUTHORIZED -> REVOKED. A binding grants scoped runtime capability to an execution step and carries NO semantic
// authority (§2.4); requested capability is NOT granted capability (§22.1) — AuthorizeRuntimeBinding records the
// separately-granted set. A revoked binding cannot back a new attempt (§22.1).
import type {
	DenyRuntimeBindingPayload,
	RequestRuntimeBindingPayload,
	RevokeRuntimeCapabilityPayload
} from '@janumipwb/rph-contracts';
import {
	authorizationOutcome,
	capabilityIdentities,
	grantIsMonotone,
	grantedWithinRequest
} from '@janumipwb/rph-domain';
import { advanceStatus, createObject, newEnvelope, reject, type CommandHandler } from './kit.js';
import { fromStates } from './command-precondition.js';

const BINDING = 'RUNTIME_BINDING';
const MACHINE = 'RuntimeBinding.authorizationStatus';

/**
 * RequestRuntimeBinding — create a RuntimeBinding in REQUESTED for an execution step.
 *
 * ── N-20: A REQUEST FOR NOTHING IS REFUSED HERE, AND ONLY HERE ──────────────────────────────────────────────
 *
 * A binding that requests NO capability is answered by `authorizationOutcome` with AUTHORIZED — correctly, since
 * everything asked for was granted — and that leaves an aggregate which PERMITS EXECUTION while conferring
 * nothing. N-18's ruling refuses exactly that at Start.
 *
 * BUT IT CANNOT BE REFUSED AT START, AND THE ASYMMETRY IS THE WHOLE POINT. N-18's case is repairable: a
 * PARTIALLY_AUTHORIZED binding can be re-authorized (`grantIsMonotone` forbids only shrinking), so the refusal
 * names an act that clears it. This one reaches AUTHORIZED, which `fromStates` does not admit as a source — so
 * there is NO second authorization, no command re-points a step's `runtimeBindingId`, and a refusal at Start
 * would be a WEDGE of the class this lineage has now shipped and withdrawn twice.
 *
 * The only point with a remedy is here, before anything is stored: the remedy is to request again, naming what
 * the step needs. So the guard sits at the creation, and the limb at Start stays clear of it.
 *
 * DISCLOSED AS AN INFERENCE, not a derivation: the corpus declares `requestedCapabilities: CapabilityRequest[]`
 * REQUIRED but does not say the array must be non-empty. What the corpus DOES supply is the consequence —
 * §22.1's "requested capability is NOT granted capability" is contentless over an empty request, and a
 * RuntimeBinding exists to convey runtime capability. Recorded for a sponsor ruling rather than presented as
 * forced.
 */
export const requestRuntimeBinding: CommandHandler = (ctx, command, payload) => {
	const p = payload as RequestRuntimeBindingPayload;
	if (capabilityIdentities(p.requestedCapabilities).length === 0)
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RequestRuntimeBinding blocked: the request names no capability. A RuntimeBinding exists to convey runtime capability to a step, and an empty request authorizes nothing while still reaching AUTHORIZED — a state no later command can repair, because a binding may not be re-authorized once AUTHORIZED. Request the capability the step needs (N-20).`,
			[p.runtimeBindingId]
		);
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
		// JAN-PWUWP / REG-F-074 residue: declared so C-0c can analyse this machine at all. Value TRACED FROM THE HANDLER, not from the machine's `initialState` (REG-F-071 measured that as a fiction on four machines).
		// ⚠ NOTE THE FIELD: `authorizationStatus`, not `status`. `lifecycleStatus` mirrors the same value here, so a
		// wrong statusField would still parse — createObject's own birth check (kit.ts:567) is what catches it.
		births: [{ machine: 'RuntimeBinding.authorizationStatus', statusField: 'authorizationStatus', values: ['REQUESTED'] }],
		aggregateId: p.runtimeBindingId,
		state,
		eventType: 'RuntimeBindingRequested',
		// ── REG-F-020: THE EVENT RECORDS THE BINDING THAT NOW EXISTS, NOT THE REQUEST THAT ASKED FOR IT ─────────
		//
		// This emitted the raw COMMAND payload, which fails the declared shape TWICE OVER: it carries
		// `runtimeBindingId` — a key `RuntimeBindingRequestedPayloadSchema` (a strictObject) rejects outright, and
		// which is already the event envelope's `aggregateId`, so nothing is lost by dropping it — and it omits
		// `authorizationStatus`, which the shape declares REQUIRED. An event announcing a binding entered REQUESTED
		// did not contain the word REQUESTED.
		//
		// BUILT FROM `state`, the object this same call is about to validate and commit, so the event and the
		// aggregate cannot disagree. `modelSelectionPolicy`/`sandboxPolicy` are declared OPTIONAL and are emitted
		// because they are genuinely present on the committed object (defaulted empty here) — not written as
		// `undefined`.
		eventPayload: {
			executionStepId: state.executionStepId,
			roleId: state.roleId,
			modelSelectionPolicy: state.modelSelectionPolicy,
			requestedCapabilities: state.requestedCapabilities,
			sandboxPolicy: state.sandboxPolicy,
			authorizationStatus: state.authorizationStatus
		}
	});
};

/**
 * AuthorizeRuntimeBinding — REQUESTED|PARTIALLY_AUTHORIZED -> AUTHORIZED **or** PARTIALLY_AUTHORIZED, according to
 * whether the grant COVERS the request (JAN-PARTAUTH, closing N-6).
 *
 * N-6 WAS: the ratified machine declares `REQUESTED -> PARTIALLY_AUTHORIZED` and `bindingPermitsExecution` PERMITS
 * execution on that state — but no command produced it, so a ratified rule had an acceptance limb the command bus
 * could not reach, and the only test covering it had to SEED the aggregate.
 *
 * AND THE FIX IS A DERIVATION, NOT A NEW COMMAND. The register previously concluded this needed a
 * `PartiallyAuthorizeRuntimeBinding`, reasoning from the arrow's own trigger ("partial grant") and from
 * `advanceStatus` taking a single `target`. Both premises were wrong: 206 of the corpus's 290 triggers are PROSE
 * rather than event names, and the single `target` was a property of a helper. The authored vocabulary settles it
 * the other way — `RuntimeBindingAuthorized` declares `authorizationStatus` REQUIRED, noted
 * "REQUESTED->AUTHORIZED|PARTIALLY_AUTHORIZED". One event, two outcomes.
 */
export const authorizeRuntimeBinding: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		// DERIVED from the request this grant answers. `checkTransition` then validates whichever arrow that is, so
		// both outcomes are checked against the ratified machine rather than one being asserted.
		// The deriver's RANGE, declared. Checked at runtime by `advanceStatus` (an outcome outside it refuses),
		// and read by the C-0 arrow census, which cannot infer a function's range and must not guess one.
		targetStates: ['AUTHORIZED', 'PARTIALLY_AUTHORIZED'],
		target: (state) =>
			authorizationOutcome({
				requested: capabilityIds(state.requestedCapabilities),
				granted: capabilityIds((command.payload as { grantedCapabilities?: unknown[] })
					.grantedCapabilities)
			}),
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
		//
		// ── AND THE MONOTONICITY LIMB (JAN-PARTAUTH) — IN SCOPE BECAUSE THIS COMMIT CREATES ITS CASE ──────────
		//
		// `mutate` below writes `grantedCapabilities` WHOLESALE, and `fromStates` already admits
		// PARTIALLY_AUTHORIZED. So the moment that state becomes REACHABLE — which is what this work package does —
		// a second authorization carrying a smaller set silently drops granted capability and records the removal
		// as a `RuntimeBindingAuthorized` event, while `RevokeRuntimeCapability` exists precisely to record removal
		// with a reason. Landing the derivation without this guard would not leave an existing defect alone; it
		// would CREATE a live one. The machine's own trigger for that arrow reads "new authorization event
		// (privilege expansion)" — this arrow authorizes EXPANSION.
		//
		// ── AND THE SELF-ARROW LIMB (N-22) — A HOLE THIS SERIES OPENED, CAUGHT BY AN EXISTING TEST ────────────
		//
		// `fromStates` was written when `target` was the literal AUTHORIZED, so PARTIALLY_AUTHORIZED could only ever
		// mean a real transition. With the target DERIVED, a second authorization carrying the same partial grant
		// lands PARTIALLY_AUTHORIZED -> PARTIALLY_AUTHORIZED — and `checkTransition` admits from === to as a NOOP,
		// so it would commit a revision and append a `RuntimeBindingAuthorized` event for a change that did not
		// happen. That is precisely what this handler's own precondition docblock says preconditions exist to stop:
		// "an event for a change that did not happen is a false entry in an append-only record".
		//
		// THE RATIFIED MACHINE SETTLES IT, so this is a derivation and not a preference: the arrows out of
		// PARTIALLY_AUTHORIZED are exactly two — to AUTHORIZED ("new authorization event (privilege expansion)") and
		// to REVOKED. There is NO self-loop. A further authorization must therefore COMPLETE the request.
		//
		// DISCLOSED CONSEQUENCE, recorded as N-22 rather than worked around: this makes INCREMENTAL multi-party
		// authorization — grant one of three, then a second of three — inexpressible. The ratified machine does not
		// model it. If the platform needs it (and a two-approver chain is exactly the case that wants it), that is a
		// new arrow with its own trigger, which is a ratification act and not mine to author.
		guard: (state) => {
			const p = command.payload as { grantedCapabilities?: unknown[] };
			const granted = capabilityIds(p.grantedCapabilities);
			const shrunk = grantIsMonotone({
				current: capabilityIds(state.grantedCapabilities),
				next: granted
			});
			if (!shrunk.ok)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`AuthorizeRuntimeBinding blocked (${shrunk.errorCode}): ${shrunk.reason}.`,
					[command.targetAggregateId]
				);
			const check = grantedWithinRequest({
				requested: capabilityIds(state.requestedCapabilities),
				granted
			});
			if (!check.ok)
				// The kernel's label travels in the MESSAGE: `RPH_CAPABILITY_NOT_REQUESTED` is not a member of the
				// ratified 15-value RphErrorCodeSchema, so it goes there or nowhere (the WP-11 discipline).
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`AuthorizeRuntimeBinding blocked (${check.errorCode}): ${check.reason}. Request the additional capability on a new RuntimeBinding, then authorize that.`,
					[command.targetAggregateId]
				);

			// ── N-22, NARROWED: THE DEFECT IS "NOTHING CHANGED", NOT "THE STATUS STAYED THE SAME" ─────────────────
			//
			// RUNS LAST, same discipline as SCOPE-before-STATUS in bindingAuthorityVerdict: report the MOST SPECIFIC
			// defect. A shrink is both a reduction and a null change, and "you dropped `network`; use
			// RevokeRuntimeCapability" is actionable where "nothing changed" is not. So this is the RESIDUAL case.
			//
			// MY FIRST FORMULATION REFUSED EVERY `from === to`, AND IT WAS OVER-BROAD — recorded because the
			// over-refusal was disclosed to the sponsor as an unavoidable cost of the ratified machine, and it was
			// not. The reasoning was: the machine's arrows out of PARTIALLY_AUTHORIZED are to AUTHORIZED and to
			// REVOKED, with no self-loop, therefore a self-transition is illegal. But `checkTransition` admits
			// `from === to` as a NOOP by design, and THIS CODEBASE ALREADY HAS TWO GENUINE SAME-STATE HOLDS
			// (`ApplyTacticalChange` declares fromStates('ACTIVE') -> ACTIVE; the ChangePwuState path likewise) —
			// they simply declare their target rather than omitting it. A same-state transition is not forbidden
			// here; it is UNDECLARED, which is a different thing.
			//
			// WHAT THE PRECONDITION DOCBLOCK ACTUALLY FORBIDS is "an event for a change THAT DID NOT HAPPEN". A
			// second authorization that adds a capability IS a change: `grantedCapabilities` differs, the event
			// records it truthfully, and an auditor reading the log sees a real grant. Only an authorization adding
			// NOTHING is the false entry.
			//
			// SO THE DISCLOSED COST IS WITHDRAWN. Incremental multi-party authorization — approver 1 grants A,
			// approver 2 adds B, approver 3 completes with C — is EXPRESSIBLE, and it was the case the sponsor's own
			// correction on N-18 was about. It needs no new arrow and therefore no ratification act. `grantIsMonotone`
			// above already guarantees the set only ever grows, so "added nothing" is the whole of the residual.
			const from = String(state.authorizationStatus);
			const to = authorizationOutcome({
				requested: capabilityIds(state.requestedCapabilities),
				granted
			});
			const currentlyGranted = new Set(capabilityIds(state.grantedCapabilities));
			const added = granted.filter((c) => !currentlyGranted.has(c));
			// BOTH conditions are load-bearing. `added.length === 0` alone would refuse the legitimate FIRST
			// authorization that deliberately grants nothing (N-18's case: REQUESTED -> PARTIALLY_AUTHORIZED, a
			// review that conferred nothing), which the sponsor ruled must stay recordable. `from === to` alone is
			// the over-refusal this comment withdraws.
			if (from === to && added.length === 0)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`AuthorizeRuntimeBinding blocked: this authorization grants nothing the binding does not already have and leaves it in ${from} — so it would append a RuntimeBindingAuthorized event for a change that did not happen (DOC-002 §27: events record ACCEPTED STATE CHANGES). Grant a capability that is still outstanding, complete the request, or revoke the binding (N-22).`,
					[command.targetAggregateId]
				);
			return null;
		},
		eventType: 'RuntimeBindingAuthorized',
		// ── R2 (ruled 2026-07-26): THE EVENT RECORDS THE OUTCOME IT DECLARES ────────────────────────────────────
		//
		// These four handlers emitted the raw COMMAND payload, so `RuntimeBindingAuthorized` carried
		// `grantedCapabilities` and NOT the resulting `authorizationStatus` — while the vocabulary declares that
		// field REQUIRED on this very event, noted "REQUESTED->AUTHORIZED|PARTIALLY_AUTHORIZED". Before JAN-PARTAUTH
		// the omission cost nothing, because the outcome was always AUTHORIZED. Now it is derived, and an auditor
		// reading the log cannot tell a full authorization from a partial one — the exact distinction the derivation
		// exists to make.
		//
		// THE RULING, AND ITS LIMIT. `advanceStatus`'s convention is that callers whose event interface is RATIFIED
		// supply an `eventPayload`, and this one is UNRATIFIED-AUTHORED ("Do NOT treat this sourceSection as proof
		// the shape is ratified"). Emitting it anyway is judged correct on three grounds: the event already emits a
		// strict SUBSET of the declared shape, so adding a declared REQUIRED field increases conformance rather than
		// inventing any; the VALUE is a fact the engine has just committed, not a semantic; and the audit consumer
		// has no other way to learn it. DISCLOSED RESIDUAL: if the shape is later ratified differently this field may
		// have to change — but omitting it does not protect against that, it only loses the fact meanwhile.
		//
		// Built from the COMMITTED next state, not from the command, so it can never disagree with the aggregate.
		eventPayload: (nextState) => ({
			grantedCapabilities: nextState.grantedCapabilities,
			authorizationStatus: nextState.authorizationStatus
		}),
		mutate: (base) => {
			const p = command.payload as { grantedCapabilities?: unknown[] };
			return { ...base, grantedCapabilities: p.grantedCapabilities ?? [] };
		}
	});

// The projection this file used to own moved to rph-domain as `capabilityIdentities` (N-18): the Start-time
// NOTHING_GRANTED limb is a third reader, and a projection copied per reader is how two readers come to disagree
// about what counts as a capability. `capabilityIds` is kept as a local alias so the call sites below read the
// same as they did — the name is this file's, the rule is the kernel's.
const capabilityIds = capabilityIdentities;

/** DenyRuntimeBinding — REQUESTED -> DENIED. */
export const denyRuntimeBinding: CommandHandler = (ctx, command, payload) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'DENIED',
		precondition: fromStates('REQUESTED'), // the machine's only in-arrow to DENIED
		eventType: 'RuntimeBindingDenied',
		// ── REG-F-020: THE EVENT RECORDS THE DENIAL, AND IT IS THE ONLY PLACE THE REASON LIVES ─────────────────
		//
		// This emitted the raw COMMAND payload `{reason}`: `reason` is a key the declared strictObject rejects, and
		// `authorizationStatus` — declared REQUIRED — was absent, so the event recording that a binding became
		// DENIED did not contain the word DENIED.
		//
		// `reason` IS NOT DROPPED, IT IS RENAMED to the field the contract declares for it (`denialReason`). That
		// matters here more than elsewhere: `RuntimeBindingSchema` has NO denial-reason field, so unlike the status
		// — which a reader can always recover from the aggregate — the reason exists ONLY on this event. Losing it
		// would make a denial unexplainable forever in an append-only log.
		//
		// `denialReason` is declared OPTIONAL but is emitted UNCONDITIONALLY, because `DenyRuntimeBindingPayload`
		// declares `reason` REQUIRED and the bus validates the command payload before any handler runs — so it is
		// always a string, never an `undefined` written into the governed stream.
		eventPayload: (next) => ({
			denialReason: (payload as DenyRuntimeBindingPayload).reason,
			authorizationStatus: next.authorizationStatus
		})
	});

/** RevokeRuntimeCapability — AUTHORIZED -> REVOKED (a revoked binding cannot back a new attempt). */
export const revokeRuntimeCapability: CommandHandler = (ctx, command, payload) =>
	advanceStatus(ctx, command, {
		objectType: BINDING,
		statusField: 'authorizationStatus',
		machine: MACHINE,
		target: 'REVOKED',
		// In-arrows: AUTHORIZED|PARTIALLY_AUTHORIZED. A re-revocation would re-write the revocation reason/actor over
		// an already-revoked binding and append a second RuntimeCapabilityRevoked for a revocation that did not occur.
		precondition: fromStates('AUTHORIZED', 'PARTIALLY_AUTHORIZED'),
		eventType: 'RuntimeCapabilityRevoked',
		// ── REG-F-020: same defect, same rename, plus ONE DERIVED FIELD THAT IS DISCLOSED AS SUCH ──────────────
		//
		// The raw command payload `{reason}` failed the declared shape on all three counts: `reason` is an
		// unrecognized key, `revocationReason` (REQUIRED) was missing, and `authorizationStatus` (REQUIRED) was
		// missing — the event recording "this became REVOKED" did not contain the word REVOKED. As with the denial,
		// `RuntimeBindingSchema` carries no revocation-reason field, so the event is the reason's only home.
		//
		// `revokedCapabilities` IS A DERIVATION, not a payload echo, and it is optional so it is emitted only when
		// there is something to name. RevokeRuntimeCapability takes NO capability list — it revokes the BINDING
		// (AUTHORIZED|PARTIALLY_AUTHORIZED -> REVOKED), and a revoked binding cannot back a new attempt (§22.1) —
		// so what it revokes is exactly the set the binding held when it was revoked. Read off the COMMITTED next
		// state (this handler does not clear `grantedCapabilities`, so the set survives on the aggregate too and
		// the two cannot disagree).
		eventPayload: (next) => {
			const revoked = next.grantedCapabilities;
			return {
				revocationReason: (payload as RevokeRuntimeCapabilityPayload).reason,
				...(Array.isArray(revoked) && revoked.length > 0 ? { revokedCapabilities: revoked } : {}),
				authorizationStatus: next.authorizationStatus
			};
		}
	});

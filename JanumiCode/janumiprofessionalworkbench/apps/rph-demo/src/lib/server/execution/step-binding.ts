// JAN-EXECGOV EG-02 — the RUNTIME_BINDING a step needs, so `STA-8` stops being unmet.
//
// ⭑⭑ `STA-8` (`JPWB-DOC-003:203`): *"Execution requires an approved plan and **authorized Runtime Bindings**."*
// Measured at `REG-F-365`: `RequestRuntimeBinding` had ZERO production dispatch sites (positive control, same
// form: `ApproveExecutionPlan` → 4), both activation sites passed `authorizedRuntimeBindingIds: []`, and
// `bindingAuthorityVerdict` therefore returned `OUT_OF_SCOPE` for every step in the system — leaving four live,
// tested checks unreachable on real work. The rule was not merely unenforced; it had nothing to enforce against.
//
// ── ⛔ NOTHING HERE IS COINED, AND THAT WAS THE WHOLE QUESTION ───────────────────────────────────────────────
//
// The sponsor granted authority to name capability vocabulary. It was handed back unspent, because the corpus
// already names it. `RPH-EXE-004`, ratified conformance (`packages/rph-domain/vocab/m12-conformance.json`):
//
//   *"When a binding requests **file-system and network access** but only **file-system** is granted, **network
//   operations** fail authorization (requested capability is not granted capability)."*
//
// A model invocation reaches a provider over the network. `network` is that capability, named by the rule's own
// example — ADOPTED, exactly as `DEC-4`'s five fates were adopted rather than respelled.
//
// ⭑ AND `roleId` IS NOT COINED EITHER. It is a free string with no vocab note, and the register records
// `ActorReference.roleId` as a HOLLOW whose intended source is the principal (`D-3` of the trust-boundary
// design, `REG-D-026`) — which no session sets today. So rather than invent `role-executor` (which exists in
// exactly two TESTS and nowhere else) this uses `PWU_TYPE.workDischarge`: a RATIFIED enum, authored by the
// professional, stating who discharges the type's work. ⭑ And the authoring handler already REFUSES a type
// carrying an ACTIVE prompt template that declares anything but `MODEL` (`pwa-authoring.ts:332`), so for
// precisely the steps bound here the value is guaranteed by a gate rather than assumed.
import type { CapabilityRequest } from '@janumipwb/rph-contracts';
import { capabilityAuthorized } from '@janumipwb/rph-domain';

/** What a step's binding must ask for, and on whose behalf. */
export interface StepBindingRequest {
	readonly runtimeBindingId: string;
	readonly executionStepId: string;
	/** `PWU_TYPE.workDischarge` — the type's own statement of who does this work. */
	readonly roleId: string;
	readonly requestedCapabilities: readonly CapabilityRequest[];
}

/**
 * The binding a step of this kind needs — or `undefined` when it needs none.
 *
 * ⛔⛔ `undefined` IS LOAD-BEARING AND MUST STAY REACHABLE. `bindingAuthorityVerdict` returns `OUT_OF_SCOPE`
 * for a step naming no binding, and the kernel records why collapsing that *"would make every plan in the
 * reference seed — which authors no RuntimeBinding whatsoever — permanently unstartable"*
 * (`rph-domain/src/execution.ts:195-196`). A TRANSFORMATION step performs no model invocation, needs no
 * network, and gets no binding.
 *
 * ⚠ AND THE REGISTER RECORDS WHAT HAPPENS IF THIS IS OVER-APPLIED. `JAN-EXEBIND` added a refusal keyed on the
 * plan's `authorizedRuntimeBindingIds` and it proved *"an UNRECOVERABLE WEDGE whose refusal message prescribed
 * a remedy the engine categorically forbids"* — the plan could not be re-activated to fix itself. That refusal
 * stays withdrawn; this only ever ADDS a binding where one is genuinely needed.
 */
export function stepBindingFor(
	stepType: string,
	workDischarge: string | undefined,
	runtimeBindingId: string,
	executionStepId: string
): StepBindingRequest | undefined {
	// ⚠ BOTH CONDITIONS, NOT EITHER. `stepType` says what the step DOES; `workDischarge` says who the TYPE says
	// does it. A MODEL_INVOCATION on a type that does not declare MODEL is a contradiction the authoring gate
	// already refuses — binding it anyway would assert a role the type denies.
	if (stepType !== 'MODEL_INVOCATION' || workDischarge !== 'MODEL') return undefined;
	return {
		runtimeBindingId,
		executionStepId,
		roleId: workDischarge,
		// ⛔ EXACTLY WHAT THE STEP DOES, AND NO MORE. `RequestRuntimeBinding` refuses an empty request (N-20);
		// an INFLATED one is the opposite failure and nothing catches it, so the list is the one capability a
		// model invocation actually exercises. §22.1: *"Requested capability is not granted capability. Capability
		// scope must be explicit."*
		requestedCapabilities: [{ capability: 'network' }]
	};
}

/**
 * Refuse to invoke when the binding no longer grants what the step needs — or `undefined` to proceed.
 *
 * ⭑⭑ THIS GIVES `capabilityAuthorized` ITS FIRST PRODUCTION CALLER, AND THE REGISTER SAYS IT HAD NONE BY
 * DESIGN. `RPH-EXE-004` is recorded `UNENFORCED_DISCLOSED` with a reasoned three-way split — DECLARATION is
 * JPWB's and enforced; ADMISSION *"has NO SUBJECT — no ratified step-level required-capability declaration
 * exists"*; OPERATION *"is the Platform's and is deferred to M5."* Two of that entry's stated grounds are now
 * FALSE, and its own exit condition is met:
 *
 *   • *"JPWB is never in the path of an operation: it governs plans and hosts no tool invocation."* ⛔ It does
 *     now — `runModelInvocationStep` invokes models and records exchanges. `execution-invocation.ts:3-8`
 *     already refutes that sentence against the Guide: *"A step IS the invocation … The caller was unbuilt,
 *     never forbidden."*
 *   • *"its caller does not exist yet. EXIT: revisit when a broker exists to call it."* ⭑ The broker exists.
 *
 * ⛔ AND THE OPERATION TIER IS STILL NOT BUILT, WHICH IS THE PART THAT MATTERS. This does NOT intercept a
 * network call — that is the Platform's, and the Charter allocates it there. It refuses to BEGIN an invocation
 * whose binding does not authorise it, which is plan-and-step governance and squarely JPWB's.
 *
 * ⚠ AND IT CAN ACTUALLY FAIL, which is the difference between a control and a ceremony. The grant is read from
 * the STORE at invocation time, not from the request that produced it, so `RevokeRuntimeCapability` — §22.1's
 * *"Revoked bindings cannot be used for new attempts"* — changes the answer. Comparing the request against
 * itself would be a check that cannot fail.
 */
export function stepCapabilityRefusal(
	binding: StepBindingRequest,
	grantedCapabilities: readonly string[]
): string | undefined {
	for (const { capability } of binding.requestedCapabilities) {
		const verdict = capabilityAuthorized({ grantedCapabilities, requiredCapability: capability });
		if (!verdict.ok)
			return (
				`Runtime binding ${binding.runtimeBindingId} does not grant '${capability}', which this step ` +
				`needs to invoke a model (${verdict.errorCode}: ${verdict.reason}). §22.1: requested capability ` +
				`is not granted capability, and a revoked binding cannot be used for new attempts. Authorize the ` +
				`capability on the binding, or do not run this step as a model invocation.`
			);
	}
	return undefined;
}

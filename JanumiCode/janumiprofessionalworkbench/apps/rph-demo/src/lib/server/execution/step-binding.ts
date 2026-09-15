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
//
// ── ⭐⭐ JAN-EXEC PHASE 3 — THE REQUEST STOPS BEING ONE HARDCODED CAPABILITY ──────────────────────────────────
//
// Until this phase the request was the literal `[{capability:'network'}]` for EVERY model step, and the step
// exercised no other privilege because the host minted it no tools at all. Phase 3 gives the model HANDS — a
// file it may write inside the Undertaking's workspace, a command it may run there — and a request that did not
// name those would be a binding granting a privilege nobody asked for, which `grantedWithinRequest` refuses and
// §22.1 calls privilege expansion.
//
// ⭐ THE GRANT WAS ALREADY GIVEN, AND ITS FORM IS FOLLOWED RATHER THAN RE-SOUGHT. `JAN-EXECGOV` `G-1`:
// *"one capability per step type that a model invocation actually needs, named in the vocabulary with its note,
// exactly as `D-1` was handled."* That is precisely this act, so `STEP_CAPABILITY_VOCABULARY` below IS the
// vocabulary and every entry carries its note. ⛔ `file-system` is VERBATIM in `RPH-EXE-004` and is adopted, not
// coined. `process-execution` IS coined, under that grant, and it is NOT collapsed into `file-system`: starting
// a process is strictly larger than writing a file — a process may open sockets, spawn children and outlive the
// request that started it — and merging them would leave the grant unable to express the distinction the live
// precision control turns on, which is the one case this phase exists to be ABLE to fail.
//
// ── ⭐⭐ REQUIRES vs USES — HOW `RPH-EXE-004` IS RECONCILED RATHER THAN HALF-CHOSEN ───────────────────────────
//
// The ratified rule degrades an OPERATION (*"network operations fail authorization"*); `stepCapabilityRefusal`
// refuses the whole STEP. Both readings are in the corpus and this takes neither as the exception:
//
//   REQUIRES  ungranted ⇒ the step is REFUSED, because there is nothing to degrade TO. A model invocation with
//             no `network` cannot reach a provider at all, so *"proceed with less"* is not an available state.
//   USES      ungranted ⇒ the TOOL IS NEVER MINTED (`mintExecutionTools`). The step runs with a narrower
//             surface and the exchange record names the surface it had. ⭐ **That IS operation-level
//             degradation** — the operation is unavailable while the invocation proceeds — so the ratified
//             wording is satisfied by the mechanism rather than by a step-level refusal standing in for it.
//
// ⛔ AND THE SPLIT BELONGS TO THE STEP TYPE, NOT TO A CALLER. A caller handed the two lists separately could
// declare a REQUIRES as a USES and buy itself a step that runs without the thing it needs — the self-consistency
// defect `R11`'s `W1` records, one plane over. `stepBindingFor` derives BOTH the needs and the wire request from
// ONE table, so they cannot disagree.
import type { CapabilityRequest, RequestRuntimeBindingPayload } from '@janumipwb/rph-contracts';
import { capabilityAuthorized } from '@janumipwb/rph-domain';

/**
 * How a step needs a capability — the distinction `RPH-EXE-004`'s two readings turn on.
 *
 * ⛔ `USES` IS NOT "OPTIONAL". An ungranted `USES` capability changes what the model is ABLE to do, and the
 * record says which surface it had. Calling it optional would invite a reader to treat the missing tool as
 * immaterial, which is exactly the reading the observed-tool-call record exists to refuse.
 */
export type CapabilityNeedKind = 'REQUIRES' | 'USES';

/** One capability a step type needs, how it needs it, and the NOTE that names it (`G-1`'s form). */
export interface StepCapabilityNeed {
	readonly capability: string;
	readonly need: CapabilityNeedKind;
	readonly note: string;
}

/**
 * ⛔ ADOPTED, NOT COINED — `RPH-EXE-004`'s own example names it, and it is what a model invocation actually
 * exercises when it reaches a provider.
 */
const NETWORK = Object.freeze({
	capability: 'network',
	note:
		"ADOPTED from RPH-EXE-004's ratified statement, which names 'network access' verbatim. A MODEL_INVOCATION " +
		'step reaches a model provider over the network; without it there is no invocation left to degrade, so it ' +
		'is REQUIRED rather than USED.'
});

/** ⛔ ALSO ADOPTED — `file-system` is VERBATIM in `RPH-EXE-004` (*"requests file-system and network access"*). */
const FILE_SYSTEM = Object.freeze({
	capability: 'file-system',
	note:
		"ADOPTED from RPH-EXE-004's ratified statement, which names 'file-system' verbatim. It authorises ONE " +
		"tool — `write_file`, bound to the Undertaking's deliverable workspace, whose own containment predicate " +
		'decides what a workspace-relative path may reach. Ungranted, the tool is never minted and the model is ' +
		'never told it exists.'
});

/**
 * ⭐ COINED, under `JAN-EXECGOV` `G-1`, and the note carries why it is its own capability rather than part of
 * `file-system`.
 */
const PROCESS_EXECUTION = Object.freeze({
	capability: 'process-execution',
	note:
		'COINED under the JAN-EXECGOV G-1 grant (one capability per step type that a model invocation actually ' +
		'needs, named in the vocabulary with its note). The corpus names no capability for starting a process. ' +
		'⛔ It is DELIBERATELY NOT file-system: starting a process is strictly larger than writing a file — a ' +
		'process may open sockets, spawn children and outlive the request that started it — and a grant that ' +
		'could not tell the two apart could not express "may write, may not run", which is the narrowest useful ' +
		"authorization this seam has. It authorises ONE tool: `run_command`, bound to the Undertaking's " +
		"ProcessRunner, which runs in that workspace's own directory and refuses every other cwd."
});

/**
 * The capability vocabulary this host may name, each with its note — `G-1`'s form, in one place.
 *
 * ⚠ IT IS AN IN-PROCESS DECLARATION AND NOT A RATIFIED ENUM, which is the position `backing-tool.ts` already
 * records for the tool suite: *"of the 100 closed enums in the ratified contracts NOT ONE names a tool, agent,
 * provider, CLI or vendor, and `PER-2` would make a deployment fact permanent."* `CapabilityRequestSchema` is
 * `{ capability: z.string() }` DELIBERATELY — `capbind-subtypes-contract.test.ts` pins that openness with its
 * own reason — so naming a capability is an authoring act here, not a contract change.
 */
export const STEP_CAPABILITY_VOCABULARY: readonly {
	readonly capability: string;
	readonly note: string;
}[] = Object.freeze([NETWORK, FILE_SYSTEM, PROCESS_EXECUTION]);

/**
 * What a `MODEL_INVOCATION` step discharged by a MODEL needs — the ONE table the wire request, the refusal and
 * the minted tool surface are all decided from.
 */
const MODEL_INVOCATION_NEEDS: readonly StepCapabilityNeed[] = Object.freeze([
	{ ...NETWORK, need: 'REQUIRES' as const },
	{ ...FILE_SYSTEM, need: 'USES' as const },
	{ ...PROCESS_EXECUTION, need: 'USES' as const }
]);

/** What a step's binding must ask for, and on whose behalf. ⛔ PAYLOAD-SHAPED — see `StepBinding`. */
export interface StepBindingRequest {
	readonly runtimeBindingId: string;
	readonly executionStepId: string;
	/** `PWU_TYPE.workDischarge` — the type's own statement of who does this work. */
	readonly roleId: string;
	readonly requestedCapabilities: readonly CapabilityRequest[];
}

/**
 * A step's binding: the wire REQUEST, and the NEEDS the request was derived from.
 *
 * ⛔⛔ TWO FIELDS RATHER THAN ONE WIDER OBJECT, AND THE SCHEMA IS WHY. `RequestRuntimeBindingPayloadSchema` is a
 * `z.strictObject` with exactly four keys, so a `capabilityNeeds` field hung on the request would be REFUSED by
 * the command bus. The alternative to this shape is a projection function that rebuilds the payload field by
 * field — and a projection is a second place the two can disagree. Here the object that is DISPATCHED is the
 * object the caller holds, so there is nothing to keep in step.
 *
 * ⚠ AND `requestedCapabilities` IS DERIVED FROM `capabilityNeeds`, never authored beside it — see `stepBindingFor`.
 */
export interface StepBinding {
	readonly request: StepBindingRequest;
	readonly capabilityNeeds: readonly StepCapabilityNeed[];
}

/**
 * ⚠ READONLY IS DROPPED FOR THE COMPARISON BELOW, AND ONLY READONLY. A `readonly T[]` is not assignable to a
 * `T[]`, so a naive `StepBindingRequest extends RequestRuntimeBindingPayload` is FALSE — which is exactly what
 * the first draft of this proof asserted, and the compiler refuted it on the first run. That difference is
 * deliberate and harmless: mutability is a TypeScript-only notion and the wire is validated by zod, which sees
 * a plain array either way. What is NOT harmless is a field on one side and not the other, which is what this
 * mapped type leaves the comparison able to see.
 */
type MutableFields<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer E)[] ? E[] : T[K] };

/**
 * ⭑⭑ A COMPILE-TIME PROOF THAT THE REQUEST **IS** THE PAYLOAD, so no projection has to be written or guarded.
 *
 * ⛔ BOTH DIRECTIONS, AND NEITHER MAY BE REMOVED — the discipline `agent/types.ts` already states for its event
 * union: *"One-directional exhaustiveness is how a list rots while still type-checking."* The first catches a
 * field this file adds that the strict payload would REFUSE at dispatch; the second catches a field the ratified
 * payload GAINS that this request would then never supply. Only one of those two is visible from either side.
 */
const _theRequestFitsThePayload: MutableFields<StepBindingRequest> extends RequestRuntimeBindingPayload
	? true
	: never = true;
const _thePayloadFitsTheRequest: RequestRuntimeBindingPayload extends MutableFields<StepBindingRequest>
	? true
	: never = true;
void _theRequestFitsThePayload;
void _thePayloadFitsTheRequest;

/**
 * The one place the step-type condition is written, so `stepBindingFor` and the needs cannot drift apart.
 *
 * ⚠ BOTH CONDITIONS, NOT EITHER. `stepType` says what the step DOES; `workDischarge` says who the TYPE says
 * does it. A MODEL_INVOCATION on a type that does not declare MODEL is a contradiction the authoring gate
 * already refuses — binding it anyway would assert a role the type denies.
 */
function boundStep(
	stepType: string,
	workDischarge: string | undefined
): { readonly roleId: string; readonly needs: readonly StepCapabilityNeed[] } | undefined {
	if (stepType !== 'MODEL_INVOCATION' || workDischarge !== 'MODEL') return undefined;
	return { roleId: workDischarge, needs: MODEL_INVOCATION_NEEDS };
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
 *
 * ⛔ THE REQUEST IS EXACTLY THE STEP TYPE'S DECLARED NEEDS AND NO MORE. `RequestRuntimeBinding` refuses an EMPTY
 * request (N-20); an INFLATED one is the opposite failure and nothing catches it. §22.1: *"Requested capability
 * is not granted capability. Capability scope must be explicit."*
 */
export function stepBindingFor(
	stepType: string,
	workDischarge: string | undefined,
	runtimeBindingId: string,
	executionStepId: string
): StepBinding | undefined {
	const bound = boundStep(stepType, workDischarge);
	if (bound === undefined) return undefined;
	return {
		request: {
			runtimeBindingId,
			executionStepId,
			roleId: bound.roleId,
			// ⭑ DERIVED, so the wire request and the REQUIRES/USES table are one statement written once.
			requestedCapabilities: bound.needs.map((n) => ({ capability: n.capability }))
		},
		capabilityNeeds: bound.needs
	};
}

/**
 * Refuse to invoke when the binding no longer grants what the step REQUIRES — or `undefined` to proceed.
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
 * ⭐⭐ AND SINCE PHASE 3 THE OPERATION TIER IS NO LONGER WHOLLY ABSENT — it is discharged BY ABSENCE rather than
 * by interception. A capability the step merely USES is not refused here: its TOOL IS NEVER MINTED, so the
 * operation is unavailable to the model with no call to intercept and no refusal path to get wrong. ⚠ What
 * remains the Platform's is intercepting an operation the host DID authorise — this connect(), this path — which
 * the Charter allocates to §33.4 and which this host still does not do.
 *
 * ⚠ AND IT CAN ACTUALLY FAIL, which is the difference between a control and a ceremony. The grant is read from
 * the STORE at invocation time, not from the request that produced it, so `RevokeRuntimeCapability` — §22.1's
 * *"Revoked bindings cannot be used for new attempts"* — changes the answer. Comparing the request against
 * itself would be a check that cannot fail.
 */
export function stepCapabilityRefusal(
	binding: StepBinding,
	grantedCapabilities: readonly string[]
): string | undefined {
	for (const { capability, need } of binding.capabilityNeeds) {
		// ⛔ ONLY `REQUIRES`. A `USES` capability that was not granted is a NARROWER TOOL SURFACE, not a failed
		// step — refusing it here would overturn the operation-level degradation `RPH-EXE-004` actually states,
		// and would make "granted file-system but not process-execution" unrunnable rather than reduced.
		if (need !== 'REQUIRES') continue;
		const verdict = capabilityAuthorized({ grantedCapabilities, requiredCapability: capability });
		if (!verdict.ok)
			return (
				`Runtime binding ${binding.request.runtimeBindingId} does not grant '${capability}', which this ` +
				`step REQUIRES to invoke a model (${verdict.errorCode}: ${verdict.reason}). §22.1: requested ` +
				`capability is not granted capability, and a revoked binding cannot be used for new attempts. ` +
				`Authorize the capability on the binding, or do not run this step as a model invocation.`
			);
	}
	return undefined;
}

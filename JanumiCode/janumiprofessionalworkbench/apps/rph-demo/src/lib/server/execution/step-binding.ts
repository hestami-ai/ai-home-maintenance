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
import { canReuseBindingForNewAttempt, capabilityAuthorized } from '@janumipwb/rph-domain';

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
	// ⭑ SUBSUMES NOTHING. Reaching a provider is not a way to write a file or start a process.
	subsumes: [] as readonly string[],
	note:
		"ADOPTED from RPH-EXE-004's ratified statement, which names 'network access' verbatim. A MODEL_INVOCATION " +
		'step reaches a model provider over the network; without it there is no invocation left to degrade, so it ' +
		'is REQUIRED rather than USED. ' +
		'⚠ R12: it is SUBSUMED BY `process-execution` — a granted child process opens whatever sockets it likes, ' +
		"so withholding this one bounds what THIS HOST will do on the step's behalf and bounds nothing the step " +
		'can reach once a process runs.'
});

/** ⛔ ALSO ADOPTED — `file-system` is VERBATIM in `RPH-EXE-004` (*"requests file-system and network access"*). */
const FILE_SYSTEM = Object.freeze({
	capability: 'file-system',
	// ⭑ SUBSUMES NOTHING. `write_file` writes bytes; it starts nothing and opens no socket.
	subsumes: [] as readonly string[],
	note:
		"ADOPTED from RPH-EXE-004's ratified statement, which names 'file-system' verbatim. It authorises ONE " +
		"tool — `write_file`, bound to the Undertaking's deliverable workspace, whose own containment predicate " +
		'decides what a workspace-relative path may reach. Ungranted, the tool is never minted and the model is ' +
		'never told it exists. ' +
		'⛔ R12: THAT IS A TOOL WITHHELD, NOT A FILESYSTEM DENIED, and the difference was driven. It is SUBSUMED ' +
		'BY `process-execution`: with this capability withheld and that one granted, the model wrote a file ' +
		'outside the workspace through a child process. Withholding it is meaningful ONLY in a grant that also ' +
		'withholds `process-execution`.'
});

/**
 * ⭐ COINED, under `JAN-EXECGOV` `G-1`, and the note carries why it is its own capability rather than part of
 * `file-system`.
 *
 * ── ⭐⭐ `R12` / `R13` (SPONSOR, 2026-09-15) — THE SUBSUMPTION, SAID PLAINLY ───────────────────────────────────
 *
 * ⛔ **`process-execution` SUBSUMES `file-system` AND `network`. The three are NOT independent, and the
 * vocabulary used to present them as if they were.** `R12` was DRIVEN: with `file-system` WITHHELD the model got
 * only `run_command` — and wrote a file outside the workspace anyway, because **a child process is not confined
 * by anything userspace can assert.** The withholding removed a TOOL; it removed no ABILITY.
 *
 * ⛔ **`R13`: THE INTERPRETER IS NOT REFUSED — THE FACT IS RECORDED.** A model naming `cmd.exe` or
 * `powershell.exe` as `argv[0]` was driven and works (`namesABatchTarget` tests only `/\.(bat|cmd)$/`). A
 * blocklist was REFUSED BY RULING: refusing `cmd.exe` while permitting `node -e` is theatre, and a later reader
 * would mistake the refusal for a containment property. **`process-execution` means ARBITRARY CODE AS THE SERVER
 * USER**, and `R9`'s deployment tier (OpenSandbox / OpenShell / a container) is the only claimed boundary.
 *
 * ⭑ SO WHY IS IT STILL ITS OWN CAPABILITY? Because the grant must be able to express *"may write, may not run"*,
 * which is the narrowest useful authorization this seam has and the one the live precision control turns on.
 * ⚠ What it must NOT be read as is the converse — *"may run, may not write"* is not an expressible state, and
 * the note now says so rather than leaving a reader to infer independence from three separate entries.
 */
const PROCESS_EXECUTION = Object.freeze({
	capability: 'process-execution',
	// ⛔⛔ R12, AS DATA. Driven, not reasoned: `file-system` withheld, `process-execution` granted, and the
	// model wrote outside the workspace through the child. `network` follows for the same reason.
	subsumes: ['file-system', 'network'] as readonly string[],
	note:
		'COINED under the JAN-EXECGOV G-1 grant (one capability per step type that a model invocation actually ' +
		'needs, named in the vocabulary with its note). The corpus names no capability for starting a process. ' +
		"It authorises ONE tool: `run_command`, bound to the Undertaking's ProcessRunner, which runs in that " +
		"workspace's own directory and refuses every other cwd. " +
		'⛔⛔ R12 (SPONSOR, 2026-09-15): THIS CAPABILITY SUBSUMES `file-system` AND `network`, and the three are ' +
		'NOT independent. DRIVEN: with `file-system` withheld the model held only `run_command` and wrote a file ' +
		'outside the workspace anyway — a child process is not confined by anything userspace can assert. ' +
		'Withholding `file-system` therefore removes a TOOL and no ABILITY. ' +
		'⛔ R13 (SPONSOR, same day): granting it means ARBITRARY CODE AS THE SERVER USER. Naming cmd.exe or ' +
		'powershell.exe as argv[0] was driven and works; a blocklist is REFUSED BY RULING, because refusing ' +
		'cmd.exe while permitting `node -e` is theatre a later reader would mistake for a containment property. ' +
		"⭑ The only claimed boundary is R9's deployment tier — OpenSandbox / OpenShell / container isolation — " +
		'NOT this code. It stays a separate capability solely so a grant can express "may write, may not run"; ' +
		'the converse, "may run, may not write", is NOT an expressible state.'
});

/**
 * The capability vocabulary this host may name, each with its note — `G-1`'s form, in one place.
 *
 * ⚠ IT IS AN IN-PROCESS DECLARATION AND NOT A RATIFIED ENUM, which is the position `backing-tool.ts` already
 * records for the tool suite: *"of the 100 closed enums in the ratified contracts NOT ONE names a tool, agent,
 * provider, CLI or vendor, and `PER-2` would make a deployment fact permanent."* `CapabilityRequestSchema` is
 * `{ capability: z.string() }` DELIBERATELY — `capbind-subtypes-contract.test.ts` pins that openness with its
 * own reason — so naming a capability is an authoring act here, not a contract change.
 *
 * ⛔⛔ **AND THE THREE ENTRIES ARE NOT INDEPENDENT — `R12`, SAID HERE BECAUSE A LIST IMPLIES INDEPENDENCE.**
 * `process-execution` SUBSUMES `file-system` AND `network`: a granted child process writes files and opens
 * sockets whatever the other two say, and that was DRIVEN rather than reasoned. So a grant is only as narrow as
 * its widest member, and the one narrowing this vocabulary can actually express is *"may write, may not run"*.
 * ⚠ AND IT IS CARRIED AS DATA (`subsumes`), NOT ONLY AS PROSE. A subsumption stated only in a note is a claim
 * no gate can read; as a field it is assertable, and a later entry that forgets to declare its relation to the
 * others is a visible omission rather than an invisible one.
 */
export const STEP_CAPABILITY_VOCABULARY: readonly {
	readonly capability: string;
	readonly note: string;
	/**
	 * ⛔ THE CAPABILITIES THIS ONE ALREADY CONFERS — `R12`, as data.
	 *
	 * Granting `X` when `X.subsumes` contains `Y` grants `Y` in substance however the binding spells its grant.
	 * ⚠ IT IS NOT USED TO WIDEN THE MINTED SURFACE, and must not be: `mintExecutionTools` keeps minting on EXACT
	 * membership, so `mintedToolNames` stays a faithful statement of what the HOST offered. This field states
	 * what the model can REACH, which is a different question and the one `R12` answers.
	 */
	readonly subsumes: readonly string[];
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
type MutableFields<T> = {
	-readonly [K in keyof T]: T[K] extends readonly (infer E)[] ? E[] : T[K];
};

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
 * ── ⛔⛔ `B-1` / `B-1b` — THE SENTENCE THAT USED TO STAND HERE WAS A CONTROL THAT COULD NOT FAIL ───────────────
 *
 * It read: *"AND IT CAN ACTUALLY FAIL, which is the difference between a control and a ceremony. The grant is
 * read from the STORE at invocation time … so `RevokeRuntimeCapability` changes the answer."* **DRIVEN, AND
 * FALSE IN THE ONLY PRODUCTION PATH.** The demo authorizes the FULL request (it has no authorizer UI able to
 * express a narrower grant), `grantIsMonotone` forbids a later authorization from narrowing it, and
 * `RevokeRuntimeCapability` DELIBERATELY DOES NOT CLEAR `grantedCapabilities` — its handler says so, because the
 * revocation EVENT is derived from the set the binding held. So the stored capability LIST was identical before
 * and after a revocation, and every reader in the Phase 3 path took a LIST and never a STATUS.
 *
 * ⭐⭐ **`authorizationStatus` IS THEREFORE A PARAMETER, AND IT IS THE LIMB THAT CAN FAIL.** §22.1 verbatim:
 * *"Revoked bindings cannot be used for new attempts."* `RPH-EXE-003` enforces that on the START arrow
 * (`bindingAuthorityVerdict`); NOTHING enforced it per TRY, and the demo's repair loop takes several tries
 * against one already-started step without dispatching another command. This is that enforcement.
 *
 * ⛔ THE KERNEL'S OWN PREDICATE, NOT A SECOND SPELLING. `canReuseBindingForNewAttempt` IS §22.1's sentence, in
 * `rph-domain`, unit-proven — and re-deriving `status !== 'REVOKED'` here would be the second spelling this
 * repository has repeatedly found to be the loose one.
 *
 * ⚠ AND IT IS ONE LIMB, NOT TWO. `bindingPermitsExecution` would ALSO catch `REQUESTED`, and adding it would
 * make an arrangement trip two conjuncts and prove neither. `REQUESTED` cannot reach this function: the START
 * arrow already refuses it, and the machine has no arrow back from a started step's binding.
 *
 * ⚠⚠ **AND WHAT *THIS DEMO SURFACE* CAN STILL NOT MAKE FIRE — MEASURED, NOT ASSUMED, BECAUSE THE FIRST DRAFT OF
 * THIS PARAGRAPH REPEATED THE DEFECT IT REPLACED.** It said *"only the STATUS limb fires on real work"*, which
 * quietly claims the demo can revoke a binding. **IT CANNOT.** `RevokeRuntimeCapability` has ZERO production
 * dispatch sites in `apps/` — every occurrence there is a comment in this programme — and the positive control
 * discriminates: `AuthorizeRuntimeBinding` HAS one, at `+page.server.ts:963`. So through the page today:
 *
 *   · the CAPABILITY limbs cannot fire — the demo grants the FULL request and `grantIsMonotone` forbids a later
 *     authorization from narrowing it, so `granted` always covers every declared need;
 *   · the STATUS limb cannot fire either — no surface in this app issues the one command that changes the status.
 *
 * ⭑ **THAT IS A PROPERTY OF THE DEMO'S UI, NOT OF THIS FUNCTION, AND THE DIFFERENCE IS THE WHOLE POINT OF THE
 * CORRECTION.** `RevokeRuntimeCapability` is a live command on the bus with a real handler and a ratified
 * machine, so any client — including the engine's own command surface, which is what this page is one client of
 * — makes this limb fire, and the gate drives exactly that. What was false before `B-1` is different in KIND: the
 * refusal could not fire **for any caller at all**, because nothing read the status. It now fires for every
 * caller that revokes; the demo simply has no button that does, which is a missing affordance and is recorded as
 * one rather than dressed up as a control.
 */
export function stepCapabilityRefusal(
	binding: StepBinding,
	grantedCapabilities: readonly string[],
	/** The binding's CURRENT `authorizationStatus`, read from the store on this try. ⛔ Never the request's. */
	authorizationStatus: string
): string | undefined {
	// ⛔⛔ FIRST, AND ITS OWN MESSAGE. A revoked binding still LISTS its granted capabilities, so folding this
	// into "does not grant 'network'" would state something false about what the caller was given — the defect
	// `filesystem-workspace.ts` records for its over-folded refusal, one plane over.
	if (!canReuseBindingForNewAttempt(authorizationStatus))
		return (
			`Runtime binding ${binding.request.runtimeBindingId} is ${authorizationStatus} ` +
			`and cannot back a new attempt. §22.1: revoked bindings cannot be used for new attempts. ` +
			`⚠ The binding still LISTS the capabilities it was granted — RevokeRuntimeCapability revokes the ` +
			`BINDING and does not clear the set, because the revocation event is derived from it — so a reader ` +
			`must not take the surviving list as an authorization. Request and authorize a new runtime binding, ` +
			`or do not run this step as a model invocation.`
		);
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

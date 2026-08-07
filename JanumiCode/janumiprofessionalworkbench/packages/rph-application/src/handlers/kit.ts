// The handler kit — the shared pipeline every command handler uses so the registry's handlers all follow the
// identical fail-loud contract that the M4 CaptureIntent handler established: reject with a typed RphError, load
// an existing aggregate, build the DomainEvent, validate the PRODUCED state against its object schema (never
// persist a bad object), commit atomically, and map the StoreResult → CommandResult. Handlers stay small: they
// compute the next state + pick the transition; the kit does the boilerplate and enforces the invariants.
import {
	makeRphError,
	OBJECT_SCHEMAS,
	RATIFIED_EVENT_PAYLOADS,
	validateAgainst,
	type CommandResult,
	type DomainCommand,
	type DomainEvent,
	type RphErrorCode
} from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
import { classifyTransition } from '@janumipwb/rph-domain';
import type { CommitInput, Logger, StorageAdapter } from '@janumipwb/rph-ports';
import type { ZodType } from 'zod';
import {
	evaluatePrecondition,
	type Precondition,
	type PreconditionReader
} from './command-precondition.js';

/** What a handler needs from the Engine to do its work (a projection of the Engine's fields). */
export interface HandlerContext {
	readonly store: StorageAdapter;
	readonly now: () => string;
	readonly newEventId: () => string;
	readonly logger: Logger;
}

/** A command handler: given the context + validated payload, produce next state + event and commit. */
export type CommandHandler = (
	ctx: HandlerContext,
	command: DomainCommand,
	payload: unknown
) => CommandResult;

/** The narrow read-only surface a PREDICATE precondition may consult (JAN-CMDPRE critique-B4 ruling):
 *  never the full HandlerContext — a precondition is a declaration and must not be able to write. */
export function preconditionReader(ctx: HandlerContext): PreconditionReader {
	return {
		objectState: (oid) => ctx.store.loadObject(oid)?.state as Record<string, unknown> | undefined,
		aggregateEvents: (aggregateType, aggregateId) =>
			ctx.store.readAggregateEvents(aggregateType, aggregateId)
	};
}

/**
 * Evaluate a PRECONDITION for a `commitState`-based handler (JAN-CMDPRE DWP-08). `advanceStatus`/`advanceIntent`
 * evaluate their precondition inline; the eight `commitState` sites are EDITS / DELETIONS / appends (no status arrow),
 * so they call this DIRECTLY — ahead of their `commitState` — to make each per-site rule a first-class `Precondition`
 * (critique-B4 reader-precondition variant). Returns a REJECTED result if the precondition refuses, else null. `state`
 * is CLONED (exactly as `advanceStatus` clones it) so a predicate cannot write the committed state; the reader is
 * copy-on-read. `site` only shapes a FROM_STATES refusal message, which these predicate-kind rules never use, so it
 * defaults sensibly from the command.
 */
export function checkPrecondition(
	ctx: HandlerContext,
	command: DomainCommand,
	pre: Precondition,
	state: Record<string, unknown>,
	site?: { statusField: string; subject: string; eventType: string }
): CommandResult | null {
	const resolvedSite = site ?? {
		statusField: 'status',
		subject: command.targetAggregateType,
		eventType: command.commandType
	};
	const refusal = evaluatePrecondition(
		pre,
		{
			state: structuredClone(state),
			payload: structuredClone(command.payload),
			command,
			read: preconditionReader(ctx)
		},
		resolvedSite
	);
	return refusal
		? reject(command, refusal.code, refusal.message, [command.targetAggregateId])
		: null;
}

type CommandStatus = CommandResult['status'];

// Map the fail-loud error codes to the CommandResult status the pipeline reports. Codes not listed → 'REJECTED'.
const STATUS_FOR_CODE: Partial<Record<RphErrorCode, CommandStatus>> = {
	RPH_VALIDATION_SCHEMA_FAILED: 'VALIDATION_FAILED',
	RPH_REVISION_CONFLICT: 'CONFLICT',
	RPH_AUTHORITY_INSUFFICIENT: 'UNAUTHORIZED'
};

/** Build a rejecting CommandResult with a typed RphError, mapping the error code to the right result status. */
export function reject(
	command: DomainCommand,
	code: RphErrorCode,
	message: string,
	targetObjectIds: string[] = [command.targetAggregateId]
): CommandResult {
	return {
		commandId: command.commandId,
		status: STATUS_FOR_CODE[code] ?? 'REJECTED',
		producedEventIds: [],
		error: makeRphError(code, {
			message,
			correlationId: command.correlationId,
			targetObjectIds
		})
	};
}

/** Outcome of loading an aggregate for an update handler. */
export type LoadOutcome =
	| {
			readonly ok: true;
			readonly state: Record<string, unknown>;
			readonly revision: number;
			readonly semanticVersion: number;
	  }
	| { readonly ok: false; readonly result: CommandResult };

/** Load an aggregate's current state (+ revision/semanticVersion), or a REJECTED result if it does not exist. */
export function loadOrReject(ctx: HandlerContext, command: DomainCommand, id: string): LoadOutcome {
	const existing = ctx.store.loadObject(id);
	if (!existing) {
		return {
			ok: false,
			result: reject(command, 'RPH_VALIDATION_SEMANTIC_FAILED', `Aggregate ${id} does not exist`, [
				id
			])
		};
	}
	// Optimistic concurrency against the CLIENT's expected version (RPH-CON-003; DOC-007 §8 puts `expectedRevision`
	// on the Command envelope for exactly this). When the client sends it, it must match the aggregate's current
	// revision — otherwise the client acted on a stale read and applying the update would be silent last-write-wins.
	// It was never read: a stale command was applied to whatever version happened to be current. The store's own
	// lock (commitState) compares the just-loaded revision, which cannot catch a client that read v5 before v6 landed.
	// NOTE: this HONORS a sent expectedRevision; ENFORCING its presence on every update (the stricter RPH-CON-003
	// reading in the envelope doc) is a separate migration — every update caller must send it — tracked in the log.
	if (command.expectedRevision !== undefined && command.expectedRevision !== existing.revision) {
		return {
			ok: false,
			result: reject(
				command,
				'RPH_REVISION_CONFLICT',
				`Revision conflict on ${id}: command expected revision ${command.expectedRevision}, actual is ${existing.revision}`,
				[id]
			)
		};
	}
	return {
		ok: true,
		state: existing.state as Record<string, unknown>,
		revision: existing.revision,
		semanticVersion: existing.semanticVersion
	};
}

/**
 * A REJECTED result if `from -> to` is not a legal (or no-op) transition on `machine`; otherwise null.
 *
 * ADMITS LEGAL **or** NOOP — the PERMISSIVE sibling of rph-domain's `canTransition` (LEGAL only). The split is
 * deliberate (JAN-CMDPRE DWP-07 / D2): `advanceStatus` admits the NOOP here at the machine layer and refuses a
 * same-state re-issue ONE layer up, via the command's `precondition` — so re-issue legality is declared PER COMMAND,
 * not baked into the machine. Guards that must refuse the NOOP themselves use `canTransition` instead. A DECLARED
 * illegal self-edge (DWP-07: §24.2 AUTHORITATIVE-baseline immutability) classifies ILLEGAL_EXPLICIT and IS refused here.
 */
export function checkTransition(
	command: DomainCommand,
	machine: string,
	from: string,
	to: string
): CommandResult | null {
	const c = classifyTransition(machine, from, to);
	if (c.klass === 'LEGAL' || c.klass === 'NOOP') return null;
	const reasonSuffix = c.reason ? `: ${c.reason}` : '';
	return reject(
		command,
		'RPH_ILLEGAL_STATE_TRANSITION',
		`Illegal transition on ${machine}: ${from} -> ${to} (${c.klass}${reasonSuffix})`
	);
}

/** Build a DomainEvent envelope for a handler's produced event. */
export function makeEvent(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly eventType: string;
		readonly aggregateType: string;
		readonly aggregateId: string;
		readonly aggregateRevision: number;
		readonly payload: unknown;
	}
): DomainEvent {
	return {
		eventId: ctx.newEventId(),
		eventType: args.eventType,
		eventSchemaVersion: 1,
		aggregateType: args.aggregateType,
		aggregateId: args.aggregateId,
		aggregateRevision: args.aggregateRevision,
		occurredAt: command.issuedAt,
		recordedAt: ctx.now(),
		actor: command.issuedBy,
		correlationId: command.correlationId,
		commandId: command.commandId,
		// ── THE CHAIN, NOT THE HOP ─────────────────────────────────────────────────────────────────────────
		// `commandId` already answers "which command produced this event" and is populated on 446/446 events.
		// `causationId` answers a different question — what caused THE COMMAND — so an event inherits its
		// command's cause rather than being handed its own command as its cause.
		//
		// THE NAIVE VERSION WAS WRITTEN INTO THE DESIGN RECORD AND IS WRONG: setting `causationId` to the
		// dispatching command on every event would duplicate `commandId` and destroy the very distinction the
		// field exists for. If everything has a cause, nothing is marked as derived. Causation is meaningful
		// PRECISELY BECAUSE IT IS ABSENT on an act somebody actually issued.
		//
		// So this line is `undefined` for the overwhelming majority of events, and that is the correct result.
		...(command.causationId === undefined ? {} : { causationId: command.causationId }),
		payload: args.payload
	};
}

/** Envelope fields common to every mutation: bump revision + updated-by/at (and optionally semanticVersion). */
export function nextEnvelope(
	current: Record<string, unknown>,
	command: DomainCommand,
	newRevision: number,
	newSemanticVersion?: number
): Record<string, unknown> {
	return {
		...current,
		revision: newRevision,
		...(newSemanticVersion !== undefined ? { semanticVersion: newSemanticVersion } : {}),
		updatedAt: command.issuedAt,
		updatedBy: command.issuedBy
	};
}

export interface CommitArgs {
	readonly objectType: string;
	readonly aggregateId: string;
	/** undefined = the aggregate must NOT yet exist (create); a number = optimistic-concurrency expected revision. */
	readonly expectedRevision: number | undefined;
	readonly newRevision: number;
	readonly newSemanticVersion: number;
	readonly nextState: Record<string, unknown>;
	readonly event: DomainEvent;
	/**
	 * FURTHER events committed atomically after `event`, in order, with contiguous aggregateRevisions.
	 *
	 * WHY A COMMAND MAY NEED MORE THAN ONE. The ratified §30 `REQUESTED -> EVIDENCE_PENDING` arrow puts two acts
	 * under a single trigger: *"AssuranceAssessmentRequested; claims instantiated, evidence requirements evaluated,
	 * missing evidence requested (AssuranceEvidenceRequired)"*. One command, two governed facts, and the second is
	 * not a detail of the first — it names the required evidence set, which is what §38 folds "missing evidence"
	 * from. Collapsing them would lose the record of WHAT was required at request time.
	 *
	 * The storage layer always supported this (`CommitInput.events` is an array); only this helper wrapped a single
	 * event, so no handler could express it. Extended rather than worked around, because the alternative — a second
	 * dispatch — would make the requirement evaluation a separately-failable act, which the trigger says it is not.
	 *
	 * EVERY event still passes the (d2) event gate individually: a follow-on event is not a way to smuggle an
	 * unvalidated payload in behind a valid one.
	 */
	readonly alsoEvents?: readonly DomainEvent[];
}

const SCHEMA_BY_TYPE = OBJECT_SCHEMAS as Record<string, { schema: ZodType } | undefined>;

/**
 * STATE-CONDITIONAL FIELD INVARIANTS — constraints a per-field schema cannot express, checked at the one seam
 * every write passes through so no handler can opt out by omission (the same reason the setup guards are declared
 * in `vitest.projects.ts` rather than per package).
 *
 * REG-F-021 increment 0. `AssuranceAssessment.startedAt` became OPTIONAL because the ratified §30 machine creates
 * an assessment in `REQUESTED`, which by definition has not started — and while the field was REQUIRED, such an
 * object could not be persisted at all (`kit.ts` refuses to write a state its schema rejects), which made the
 * whole lifecycle restoration unbuildable. Relaxing a required field with nothing put back is precisely the
 * economy REG-D-013 forbids, so **the guarantee moved rather than lapsing**: optional at the schema, mandatory at
 * the state that implies it.
 *
 * EXPRESSED AS THE EXEMPT SET, DELIBERATELY, BECAUSE THAT FAILS CLOSED. The three pre-start states are named; every
 * other state — ASSESSING and all eleven terminal dispositions — requires the field. A state added later therefore
 * defaults to REQUIRING `startedAt`. The positive form (list the states that require it) would default a new state
 * to exempt, which is the direction that loses the guarantee silently.
 */
const STATE_CONDITIONAL_FIELDS: Readonly<
	Record<string, { statusField: string; exemptStates: readonly string[]; required: readonly string[] }>
> = {
	ASSURANCE_ASSESSMENT: {
		statusField: 'assessmentState',
		// CANCELLED joins the three pre-start states (REG-F-021 R-1, 2026-08-05) and the reason is the same one:
		// DOC-004 §30's `ANY ACTIVE → CANCELLED` means an assessment can be cancelled BEFORE it begins, so a
		// cancelled assessment may honestly have no `startedAt`. Without this the arrow is declared and
		// unusable from exactly the state it was delivered for — an assessment stalled in EVIDENCE_PENDING
		// could be cancelled by the machine and then refused by this invariant.
		//
		// FOUND BY THIS GUARD REFUSING THE INCREMENT THAT NEEDED IT, which is the exempt set doing its job
		// rather than a hole in it: adding a terminal state reachable from a pre-start state is exactly the
		// change that should have to come back here and say so.
		exemptStates: ['REQUESTED', 'EVIDENCE_PENDING', 'READY', 'CANCELLED'],
		required: ['startedAt']
	}
};

/** null when the state satisfies its state-conditional invariants; otherwise the reason it does not.
 *  EXPORTED so it can be tested directly: no command can currently produce an `ASSESSING` assessment without
 *  `startedAt` (the handler always stamps it), so an integration test alone could never show this refusing —
 *  it would be a guard with no demonstrated failure mode, which is the defect this repository keeps finding. */
export function stateConditionalViolation(
	objectType: string,
	state: Record<string, unknown>
): string | null {
	const rule = STATE_CONDITIONAL_FIELDS[objectType];
	if (!rule) return null;
	const status = state[rule.statusField];
	if (typeof status !== 'string' || rule.exemptStates.includes(status)) return null;
	const missing = rule.required.filter((f) => state[f] === undefined || state[f] === null);
	if (missing.length === 0) return null;
	return `${objectType} in ${rule.statusField} '${status}' must carry [${missing.join(', ')}] — the field is optional on the schema only because the pre-start states (${rule.exemptStates.join(', ')}) legitimately lack it; a '${status}' object without it has lost a fact its own state asserts.`;
}

/**
 * Validate the produced state against its object schema (fail-loud — never persist an object that is not a valid
 * domain object), then commit the event + state + receipt atomically and map the StoreResult to a CommandResult.
 * This is the (d)-(e)-(f) tail of the command pipeline, shared by every handler.
 */
export function commitState(
	ctx: HandlerContext,
	command: DomainCommand,
	args: CommitArgs
): CommandResult {
	const entry = SCHEMA_BY_TYPE[args.objectType];
	if (!entry) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`No object schema registered for aggregate type ${args.objectType}`,
			[args.aggregateId]
		);
	}
	// (d) The produced state MUST be a valid domain object — fail loud otherwise (never persist a bad state).
	const stateCheck = validateAgainst(entry.schema, args.nextState, {
		correlationId: command.correlationId,
		targetObjectIds: [args.aggregateId]
	});
	if (!stateCheck.ok) {
		ctx.logger.error('invariant.produced_state_invalid', {
			correlationId: command.correlationId,
			aggregateId: args.aggregateId,
			commandType: command.commandType
		});
		return {
			commandId: command.commandId,
			producedEventIds: [],
			status: 'REJECTED',
			error: stateCheck.error
		};
	}
	// (d1b) STATE-CONDITIONAL FIELDS — the half of the contract the per-field schema cannot carry. See
	// STATE_CONDITIONAL_FIELDS: a field may be optional because SOME states legitimately lack it, without becoming
	// optional for the states that assert it.
	const conditional = stateConditionalViolation(args.objectType, args.nextState);
	if (conditional) {
		ctx.logger.error('invariant.state_conditional_field_missing', {
			correlationId: command.correlationId,
			aggregateId: args.aggregateId,
			commandType: command.commandType
		});
		return reject(command, 'RPH_INVARIANT_VIOLATION', conditional, [args.aggregateId]);
	}
	// (d2) THE EVENT GATE — LIVE as of 2026-07-17.
	//
	// The append-only event log IS the governed stream: the audit record, the replay source, the only durable
	// account of why the system did what it did. Before this gate, nothing validated an event payload — the
	// pipeline checked the COMMAND payload (command-bus.ts) and the PRODUCED STATE (above) and left the one
	// artifact that cannot be fixed later unchecked, because replay reconstructs state FROM it. A malformed
	// event is not a bad request; it is a permanently wrong history.
	//
	// SCOPE, and why it fails closed on exactly the right set. `RATIFIED_EVENT_PAYLOADS` is DERIVED from vocab
	// provenance by gen-messages (a DOC-007 §N citation, not UNRATIFIED-AUTHORED, AND payloadFields non-empty) —
	// never hand-kept, so it cannot rot into an allowlist. The non-empty requirement is load-bearing: an event
	// that cites a section but declares no fields would generate `z.strictObject({})`, which means "nobody
	// specified this", NOT "this payload is empty" — enforcing it would strip real fields off real events. A
	// citation is not an interface. Events outside the map pass unchecked BY DESIGN: we do not enforce shapes we
	// authored ourselves as though the corpus had ratified them.
	//
	// This was parked for one commit on a "sponsor decision" about `markPwuReady`/`reasonCode` that did not
	// exist. The blocker was an authored vocab entry binding MarkPwuReady to the generic PwuStateChanged, which
	// contradicted the vocab's own transitions table and the corpus's own §26 worked trace. See pwu.ts
	// markPwuReady. HARMONIZATION-LOG PART 3h.
	//
	// LOOPS OVER EVERY EVENT, not just the first. `alsoEvents` lets ONE command commit several governed facts — the
	// ratified §30 REQUESTED -> EVIDENCE_PENDING arrow is two acts under one trigger. A follow-on event must not
	// become a way to smuggle an unvalidated payload in behind a valid one, so the gate applies to each in turn.
	for (const evt of [args.event, ...(args.alsoEvents ?? [])]) {
		const ratifiedEventPayload = RATIFIED_EVENT_PAYLOADS[evt.eventType];
		if (!ratifiedEventPayload) continue;
		const eventCheck = ratifiedEventPayload.safeParse(evt.payload);
		if (!eventCheck.success) {
			const detail = eventCheck.error.issues
				.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
				.join('; ');
			ctx.logger.warn('event.payload_invalid', {
				correlationId: command.correlationId,
				aggregateId: args.aggregateId,
				commandType: command.commandType,
				eventType: evt.eventType,
				detail
			});
			// The ratified code, not a new one. DOC-007 §25.1 fixes FIFTEEN canonical error codes; a 16th
			// ('RPH_EVENT_PAYLOAD_INVALID') was the obvious reach and would have been an invented governance
			// fact, minted while building the gate that exists to stop invented governance facts. §25.1's
			// meaning fits as written: "Structural (JSON Schema) validation of the payload failed" — it does
			// not say COMMAND payload. Routed through reject() so STATUS_FOR_CODE maps the status (this code
			// is VALIDATION_FAILED, not REJECTED — hand-rolling the return got that wrong).
			return reject(
				command,
				'RPH_VALIDATION_SCHEMA_FAILED',
				`${command.commandType} would emit a ${evt.eventType} event whose payload violates its ratified contract — refusing to write it to the governed stream. ${detail}`,
				[args.aggregateId]
			);
		}
	}
	// (e) Assemble the atomic commit (state + event + outbox + receipt).
	const input: CommitInput = {
		aggregateType: args.objectType,
		aggregateId: args.aggregateId,
		objectType: args.objectType,
		expectedRevision: args.expectedRevision,
		newRevision: args.newRevision,
		newSemanticVersion: args.newSemanticVersion,
		currentState: args.nextState,
		events: [args.event, ...(args.alsoEvents ?? [])],
		receipt: {
			commandId: command.commandId,
			idempotencyKey: command.idempotencyKey,
			commandType: command.commandType,
			targetAggregateId: args.aggregateId,
			status: 'ACCEPTED',
			producedEventIds: [args.event.eventId],
			resultHash: contentHash(args.nextState),
			// REG-F-012 clause 3 — bind the key to the payload that claimed it. RECOMPUTED rather than threaded
			// through `HandlerContext`: the bus has already hashed this exact payload at step 0c and REFUSED the
			// command if it could not, so reaching here means it canonicalizes. A handler invoked directly (only
			// tests do that) with an uncanonicalizable payload throws here, loudly, at the boundary that documents
			// the requirement — which is the right failure for a caller bypassing the bus.
			payloadHash: contentHash(command.payload)
		}
	};
	// (f) Commit and map the result.
	const result = ctx.store.commit(input);
	if (!result.ok) {
		ctx.logger.warn('command.revision_conflict', {
			correlationId: command.correlationId,
			aggregateId: args.aggregateId
		});
		return {
			commandId: command.commandId,
			producedEventIds: [],
			status: 'CONFLICT',
			error: makeRphError('RPH_REVISION_CONFLICT', {
				message: `Revision conflict on ${args.aggregateId} (actual revision ${String(result.actualRevision)})`,
				correlationId: command.correlationId,
				targetObjectIds: [args.aggregateId]
			})
		};
	}
	ctx.logger.info('command.accepted', {
		correlationId: command.correlationId,
		eventType: args.event.eventType,
		aggregateId: args.aggregateId
	});
	return {
		commandId: command.commandId,
		status: 'ACCEPTED',
		producedEventIds: [args.event.eventId]
	};
}

/** Build the shared envelope fields for a NEW object (revision 0, semanticVersion 1). Callers merge their
 * object-specific fields (including the typed lifecycle field) on top. */
export function newEnvelope(
	command: DomainCommand,
	objectType: string,
	id: string,
	opts: {
		readonly lifecycleStatus: string;
		readonly originType?: string;
		readonly sourceObjectIds?: string[];
		readonly ontologyId?: string;
		readonly ontologyVersion?: string;
	}
): Record<string, unknown> {
	const ts = command.issuedAt;
	return {
		id,
		objectType,
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: opts.lifecycleStatus,
		createdAt: ts,
		createdBy: command.issuedBy,
		updatedAt: ts,
		updatedBy: command.issuedBy,
		provenance: {
			originType: opts.originType ?? 'USER_INPUT',
			sourceObjectIds: opts.sourceObjectIds ?? [],
			sourceEventIds: []
		},
		...(opts.ontologyId ? { ontologyId: opts.ontologyId } : {}),
		...(opts.ontologyVersion ? { ontologyVersion: opts.ontologyVersion } : {}),
		tags: [],
		extensions: []
	};
}

/** Create a NEW aggregate (revision 0): validate the produced state + commit it, emitting `eventType`. */
export function createObject(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly objectType: string;
		readonly aggregateId: string;
		readonly state: Record<string, unknown>;
		readonly eventType: string;
		/** The event's ratified DOC-007 payload. Omitted → the raw command payload (the legacy pass-through, which
		 *  for a schematized event is a different shape than the one DOC-007 ratifies). */
		readonly eventPayload?: unknown;
		/** FURTHER events this creation commits, in order — see `CommitArgs.alsoEvents`. A creating command may
		 *  cross more than one arrow of its machine: the ratified §30 request evaluates evidence requirements in
		 *  the same trigger that creates the assessment, and the required set it computes is a governed fact with
		 *  its own event. Each gets the next contiguous aggregateRevision. */
		readonly alsoEvents?: readonly { eventType: string; payload: unknown }[];
	}
): CommandResult {
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: args.objectType,
		aggregateId: args.aggregateId,
		aggregateRevision: 0,
		payload: args.eventPayload ?? command.payload
	});
	const alsoEvents = (args.alsoEvents ?? []).map((e, i) =>
		makeEvent(ctx, command, {
			eventType: e.eventType,
			aggregateType: args.objectType,
			aggregateId: args.aggregateId,
			aggregateRevision: i + 1,
			payload: e.payload
		})
	);
	return commitState(ctx, command, {
		objectType: args.objectType,
		aggregateId: args.aggregateId,
		expectedRevision: undefined,
		// The aggregate's revision after the commit is the LAST event's revision — otherwise a follow-on event
		// would carry a revision the aggregate never reaches, and replay would reconstruct a gap.
		newRevision: alsoEvents.length,
		newSemanticVersion: 1,
		nextState: args.state,
		event,
		alsoEvents
	});
}

/**
 * Advance a single status field of an existing aggregate along its state machine: load -> optional domain guard
 * -> transition legality (checkTransition on `machine`) -> set the status field (+ mirror lifecycleStatus) ->
 * commit. Covers the many "guarded single-status transition" commands compactly. `guard` runs a domain kernel
 * check (returns a rejecting CommandResult or null); `mutate` applies payload-derived field updates.
 *
 * `eventPayload` builds the EVENT payload from the committed next state; omitted, the event carries the raw
 * COMMAND payload (the long-standing default). The command payload is NOT the event payload: where DOC-007
 * ratifies an event's interface the two shapes differ, and the event log is the audit + replay source. Callers
 * whose event interface is ratified supply this; the rest keep the default until theirs is schematized.
 */
export function advanceStatus(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly objectType: string;
		readonly statusField: string;
		readonly machine: string;
		/**
		 * The state to advance TO — a literal, or DERIVED from the loaded state (JAN-PARTAUTH, closing N-6).
		 *
		 * The deriver exists because one ratified command legitimately drives two arrows: `AuthorizeRuntimeBinding`
		 * produces AUTHORIZED or PARTIALLY_AUTHORIZED depending on whether the grant covers the request, and the
		 * authored vocabulary says so itself — `RuntimeBindingAuthorized` declares `authorizationStatus` as a
		 * REQUIRED payload field noted "REQUESTED->AUTHORIZED|PARTIALLY_AUTHORIZED". Before this, `target: string`
		 * was read as evidence that the domain required two COMMANDS; it was only ever a property of this helper.
		 *
		 * Evaluated ONCE, on the state as loaded, and used for the transition check, the status field and the
		 * mirrored `lifecycleStatus` alike — so those three can never disagree about where the aggregate went.
		 * Every literal call site is unaffected.
		 */
		readonly target: string | ((state: Record<string, unknown>) => string);
		readonly eventType: string;
		readonly setLifecycleStatus?: boolean;
		readonly guard?: (state: Record<string, unknown>, ctx: HandlerContext) => CommandResult | null;
		readonly mutate?: (base: Record<string, unknown>) => Record<string, unknown>;
		/** Build the event payload from the committed next state. Omitted → the raw command payload. */
		readonly eventPayload?: (nextState: Record<string, unknown>) => unknown;
		readonly bumpSemanticVersion?: boolean;
		/**
		 * The PRECONDITION under which this command may be issued (JAN-CMDPRE; supersedes DWP-00's `requireFrom`).
		 * `fromStates(...)` is the common special case — the states this command may be issued FROM (JAN-NOOP-01).
		 *
		 * The state machine alone is NOT a sufficient precondition, for two independent reasons:
		 *
		 *  1. `classifyTransition` returns NOOP whenever from === to, and `checkTransition` admits NOOP as legal — so a
		 *     command RE-ISSUED against an aggregate ALREADY in the target state passes, runs `mutate` again against the
		 *     already-mutated state, bumps the revision (and semanticVersion, where the caller bumps it) and appends a
		 *     fresh immutable event whose payload may CONTRADICT the first. Events record ACCEPTED STATE CHANGES
		 *     (DOC-002 §27; DOC-007 §9.1 "the accepted facts, not the original request"), so an event for a change that
		 *     did not happen is a false entry in an append-only record that has no retraction mechanism.
		 *  2. The machine legalises an arrow into the target from ANY of its sources, but a COMMAND is usually narrower
		 *     than the machine — several distinct commands can drive the same target from different states — and at
		 *     least one command family is narrower in a way NO state set can express (`decisionType`, DS-001 §5).
		 *
		 * Enforced BEFORE `args.guard` (DR-001 roadmap critique B3): a precondition sited behind a `canTransition`-based guard
		 * is dead code, because `canTransition` counts only 'LEGAL' (excluding NOOP) and refuses the same inputs first
		 * — protection by accident, with the wrong refusal code. Sets are HAND-AUTHORED per call site from the
		 * machine's own in-arrows — NOT generated from the vocab's `drivesFrom`, which has no ratified authority, is
		 * absent for twelve commands, names the wrong machine for at least one, and is narrower than the machine for
		 * eight. REQUIRED since JAN-CMDPRE DWP-06 (D5): every status advance MUST declare a precondition — the compiler
		 * enforces it, so no `advanceStatus` site can silently omit one again. The two genuine same-state HOLDS
		 * (ApplyTacticalChange declares fromStates('ACTIVE') → ACTIVE; the analogous ChangePwuState path) declare their
		 * own target state rather than omitting the declaration.
		 */
		readonly precondition: Precondition;
	}
): CommandResult {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (args.precondition) {
		// CLONES, not the live references: `loaded.state` is later spread into the committed next state and
		// `command.payload` is the default event payload, so handing either to a predicate would let a
		// "declaration" write into the store or the governed stream — the exact thing the critique-B4 ruling
		// (see command-precondition.ts) exists to prevent. The reader is already copy-on-read; this closes the
		// only other write path mechanically rather than by convention.
		const refusal = evaluatePrecondition(
			args.precondition,
			{
				state: structuredClone(loaded.state),
				payload: structuredClone(command.payload),
				command,
				read: preconditionReader(ctx)
			},
			{ statusField: args.statusField, subject: args.objectType, eventType: args.eventType }
		);
		if (refusal) return reject(command, refusal.code, refusal.message, [id]);
	}
	const guardFailure = args.guard?.(loaded.state, ctx);
	if (guardFailure) return guardFailure;
	const from = String(loaded.state[args.statusField]);
	// ONCE, before the transition check — so the legality check, the status field and the mirrored lifecycleStatus
	// below are the SAME answer. Deriving it per use would let a non-deterministic deriver commit an aggregate whose
	// status contradicts the arrow that was checked.
	const target =
		typeof args.target === 'function' ? args.target(structuredClone(loaded.state)) : args.target;
	const illegal = checkTransition(command, args.machine, from, target);
	if (illegal) return illegal;
	const newRevision = loaded.revision + 1;
	const newSemanticVersion = args.bumpSemanticVersion
		? loaded.semanticVersion + 1
		: loaded.semanticVersion;
	const base = nextEnvelope(
		loaded.state,
		command,
		newRevision,
		args.bumpSemanticVersion ? newSemanticVersion : undefined
	);
	const mutated = args.mutate ? args.mutate(base) : base;
	const next = {
		...mutated,
		[args.statusField]: target,
		...(args.setLifecycleStatus === false ? {} : { lifecycleStatus: target })
	};
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: args.objectType,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: args.eventPayload ? args.eventPayload(next) : command.payload
	});
	return commitState(ctx, command, {
		objectType: args.objectType,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion,
		nextState: next,
		event
	});
}

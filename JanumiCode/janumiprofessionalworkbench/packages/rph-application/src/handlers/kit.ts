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

/** A REJECTED result if `from -> to` is not a legal (or no-op) transition on `machine`; otherwise null. */
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
}

const SCHEMA_BY_TYPE = OBJECT_SCHEMAS as Record<string, { schema: ZodType } | undefined>;

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
	const ratifiedEventPayload = RATIFIED_EVENT_PAYLOADS[args.event.eventType];
	if (ratifiedEventPayload) {
		const eventCheck = ratifiedEventPayload.safeParse(args.event.payload);
		if (!eventCheck.success) {
			const detail = eventCheck.error.issues
				.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
				.join('; ');
			ctx.logger.warn('event.payload_invalid', {
				correlationId: command.correlationId,
				aggregateId: args.aggregateId,
				commandType: command.commandType,
				eventType: args.event.eventType,
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
				`${command.commandType} would emit a ${args.event.eventType} event whose payload violates its ratified contract — refusing to write it to the governed stream. ${detail}`,
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
		events: [args.event],
		receipt: {
			commandId: command.commandId,
			idempotencyKey: command.idempotencyKey,
			commandType: command.commandType,
			targetAggregateId: args.aggregateId,
			status: 'ACCEPTED',
			producedEventIds: [args.event.eventId],
			resultHash: contentHash(args.nextState)
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
	}
): CommandResult {
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: args.objectType,
		aggregateId: args.aggregateId,
		aggregateRevision: 0,
		payload: args.eventPayload ?? command.payload
	});
	return commitState(ctx, command, {
		objectType: args.objectType,
		aggregateId: args.aggregateId,
		expectedRevision: undefined,
		newRevision: 0,
		newSemanticVersion: 1,
		nextState: args.state,
		event
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
		readonly target: string;
		readonly eventType: string;
		readonly setLifecycleStatus?: boolean;
		readonly guard?: (state: Record<string, unknown>, ctx: HandlerContext) => CommandResult | null;
		readonly mutate?: (base: Record<string, unknown>) => Record<string, unknown>;
		/** Build the event payload from the committed next state. Omitted → the raw command payload. */
		readonly eventPayload?: (nextState: Record<string, unknown>) => unknown;
		readonly bumpSemanticVersion?: boolean;
	}
): CommandResult {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const guardFailure = args.guard?.(loaded.state, ctx);
	if (guardFailure) return guardFailure;
	const from = String(loaded.state[args.statusField]);
	const illegal = checkTransition(command, args.machine, from, args.target);
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
		[args.statusField]: args.target,
		...(args.setLifecycleStatus === false ? {} : { lifecycleStatus: args.target })
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

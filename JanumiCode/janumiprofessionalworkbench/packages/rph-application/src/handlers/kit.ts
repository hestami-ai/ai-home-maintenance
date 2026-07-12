// The handler kit — the shared pipeline every command handler uses so the registry's handlers all follow the
// identical fail-loud contract that the M4 CaptureIntent handler established: reject with a typed RphError, load
// an existing aggregate, build the DomainEvent, validate the PRODUCED state against its object schema (never
// persist a bad object), commit atomically, and map the StoreResult → CommandResult. Handlers stay small: they
// compute the next state + pick the transition; the kit does the boilerplate and enforces the invariants.
import {
	makeRphError,
	OBJECT_SCHEMAS,
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
	return reject(
		command,
		'RPH_ILLEGAL_STATE_TRANSITION',
		`Illegal transition on ${machine}: ${from} -> ${to} (${c.klass}${c.reason ? `: ${c.reason}` : ''})`
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

// The command core. dispatch() runs the pipeline: idempotency check -> validate command payload -> route to the
// registered handler (which loads state, enforces the domain guards, produces the new object state + domain
// event, validates the produced state, and commits events + outbox + receipt atomically) -> map to a
// CommandResult. drainOutbox() delivers persisted events to subscribers (the in-process outbox drain that stands
// in for a broker on the embedded tier).
//
// The per-command handlers live in ./handlers/* and register in ./handlers/registry.ts; the pipeline here is
// command-agnostic. A command whose type has no registered handler is REJECTED (RPH_VALIDATION_SEMANTIC_FAILED),
// preserving the M4 posture while the handler surface fills in.
import {
	COMMANDS,
	makeRphError,
	mintId,
	validateAgainst,
	type CommandResult,
	type DomainCommand,
	type DomainEvent
} from '@janumipwb/rph-contracts';
import type { Logger, StorageAdapter } from '@janumipwb/rph-ports';
import { NoopLogger } from '@janumipwb/rph-ports';
import type { ZodType } from 'zod';
import type { HandlerContext } from './handlers/kit.js';
import { HANDLERS } from './handlers/registry.js';

export interface EngineDeps {
	readonly store: StorageAdapter;
	readonly now?: () => string;
	readonly newEventId?: () => string;
	readonly logger?: Logger;
}

export type EventSubscriber = (event: DomainEvent) => void;

type CommandSpec = { readonly payload: ZodType };

/** Internal marker to unwind a dispatchBatch transaction (rolls back every commit in the batch). */
class BatchAbort extends Error {}

/** Result of dispatchBatch: every command's result in order, plus whether the whole batch committed. */
export interface BatchResult {
	readonly ok: boolean;
	readonly results: CommandResult[];
	readonly failedIndex?: number;
}

export class Engine {
	private readonly store: StorageAdapter;
	private readonly now: () => string;
	private readonly newEventId: () => string;
	private readonly logger: Logger;
	private readonly subscribers: EventSubscriber[] = [];

	constructor(deps: EngineDeps) {
		this.store = deps.store;
		this.now = deps.now ?? (() => new Date().toISOString());
		this.newEventId = deps.newEventId ?? (() => mintId('EVENT'));
		this.logger = deps.logger ?? new NoopLogger();
	}

	subscribe(handler: EventSubscriber): void {
		this.subscribers.push(handler);
	}

	dispatch(command: DomainCommand): CommandResult {
		const correlationId = command.correlationId;
		const base = { commandId: command.commandId, producedEventIds: [] as string[] };
		this.logger.info('command.received', {
			commandType: command.commandType,
			correlationId,
			commandId: command.commandId
		});

		// 1. Idempotency: a replay of the same idempotencyKey returns the prior result, no new event.
		const prior = this.store.getReceipt(command.idempotencyKey);
		if (prior) {
			this.logger.info('command.duplicate', {
				correlationId,
				idempotencyKey: command.idempotencyKey
			});
			return {
				commandId: command.commandId,
				status: 'DUPLICATE',
				producedEventIds: [...prior.producedEventIds]
			};
		}

		// 2. Validate the command payload against its contract.
		const spec = (COMMANDS as unknown as Record<string, CommandSpec | undefined>)[
			command.commandType
		];
		if (!spec) {
			return {
				...base,
				status: 'REJECTED',
				error: makeRphError('RPH_VALIDATION_SCHEMA_FAILED', {
					message: `Unknown command type: ${command.commandType}`,
					correlationId,
					targetObjectIds: [command.targetAggregateId]
				})
			};
		}
		const parsed = validateAgainst(spec.payload, command.payload, {
			correlationId,
			targetObjectIds: [command.targetAggregateId]
		});
		if (!parsed.ok) {
			return { ...base, status: 'VALIDATION_FAILED', error: parsed.error };
		}

		// 3. Route to the registered handler for this command type.
		const handler = HANDLERS[command.commandType];
		if (!handler) {
			return {
				...base,
				status: 'REJECTED',
				error: makeRphError('RPH_VALIDATION_SEMANTIC_FAILED', {
					message: `No handler registered for command type: ${command.commandType}`,
					correlationId,
					targetObjectIds: [command.targetAggregateId]
				})
			};
		}
		const ctx: HandlerContext = {
			store: this.store,
			now: this.now,
			newEventId: this.newEventId,
			logger: this.logger
		};
		return handler(ctx, command, parsed.value);
	}

	/**
	 * Dispatch several commands ATOMICALLY: they all commit, or — on the first rejection — NONE do (the storage
	 * transaction is rolled back, leaving no partial state). Each command's CommandResult is returned in order; a
	 * non-mutating DUPLICATE (idempotency replay) counts as success. A multi-step authoring sequence (or the agent
	 * proposing several linked commands) uses this so a mid-sequence failure can't strand a half-built DRAFT.
	 */
	dispatchBatch(commands: readonly DomainCommand[]): BatchResult {
		const results: CommandResult[] = [];
		let failedIndex: number | undefined;
		try {
			this.store.transaction(() => {
				for (let i = 0; i < commands.length; i += 1) {
					const r = this.dispatch(commands[i]!);
					results.push(r);
					if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE') {
						failedIndex = i;
						throw new BatchAbort();
					}
				}
			});
		} catch (e) {
			if (!(e instanceof BatchAbort)) throw e;
			return { ok: false, results, failedIndex };
		}
		return { ok: true, results };
	}

	/** Deliver pending outbox events to subscribers and mark them published. Returns the count drained. */
	drainOutbox(): number {
		const pending = this.store.readPendingOutbox();
		for (const record of pending) {
			for (const subscriber of this.subscribers) subscriber(record.event);
		}
		this.store.markOutboxPublished(pending.map((p) => p.outboxId));
		return pending.length;
	}
}

// The command core. dispatch() runs the pipeline: idempotency check -> validate command payload -> produce
// the new object state + domain event -> validate the produced state against its object schema (a produced
// state that is not a valid domain object is a fail-loud internal invariant) -> commit events + outbox +
// receipt atomically -> map the store result to a CommandResult. drainOutbox() delivers persisted events to
// subscribers (the in-process outbox drain that stands in for a broker on the embedded tier).
//
// M4 (walking skeleton) implements one handler: CaptureIntent. The pipeline is command-agnostic; further
// handlers register alongside it in later milestones.
import {
	CaptureIntentPayloadSchema,
	IntentObjectSchema,
	COMMANDS,
	makeRphError,
	mintId,
	validateAgainst,
	type CaptureIntentPayload,
	type CommandResult,
	type DomainCommand,
	type DomainEvent
} from '@janumipwb/rph-contracts';
// contentHash is a Node-only capability (node:crypto), so it lives behind the /hash subpath — kept out of the
// contracts barrel to keep that barrel browser-safe (see rph-contracts/src/index.ts).
import { contentHash } from '@janumipwb/rph-contracts/hash';
import type { CommitInput, Logger, StorageAdapter } from '@janumipwb/rph-ports';
import { NoopLogger } from '@janumipwb/rph-ports';

export interface EngineDeps {
	readonly store: StorageAdapter;
	readonly now?: () => string;
	readonly newEventId?: () => string;
	readonly logger?: Logger;
}

export type EventSubscriber = (event: DomainEvent) => void;

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
		const spec = (
			COMMANDS as unknown as Record<
				string,
				{ payload: typeof CaptureIntentPayloadSchema } | undefined
			>
		)[command.commandType];
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

		// 3. Produce the new state + event (M4: CaptureIntent only).
		if (command.commandType !== 'CaptureIntent') {
			return {
				...base,
				status: 'REJECTED',
				error: makeRphError('RPH_VALIDATION_SEMANTIC_FAILED', {
					message: `No handler for command type: ${command.commandType} (M4 walking skeleton handles CaptureIntent)`,
					correlationId,
					targetObjectIds: [command.targetAggregateId]
				})
			};
		}
		return this.captureIntent(command, parsed.value as CaptureIntentPayload, correlationId);
	}

	private captureIntent(
		command: DomainCommand,
		payload: CaptureIntentPayload,
		correlationId: string
	): CommandResult {
		const ts = command.issuedAt;
		const actor = command.issuedBy;
		const intent = {
			id: payload.intentId,
			objectType: 'INTENT' as const,
			schemaVersion: 1,
			semanticVersion: 1,
			revision: 0,
			lifecycleStatus: 'RAW',
			createdAt: ts,
			createdBy: actor,
			updatedAt: ts,
			updatedBy: actor,
			provenance: { originType: 'USER_INPUT' as const, sourceObjectIds: [], sourceEventIds: [] },
			ontologyId: payload.ontologyId,
			ontologyVersion: payload.ontologyVersion,
			tags: [] as string[],
			extensions: [] as never[],
			originatingExpression: payload.originatingExpression,
			desiredOutcomes: [] as never[],
			successConditions: [] as never[],
			nonGoals: [] as string[],
			ambiguityIds: [] as string[],
			constraintIds: [] as string[],
			stakeholderIds: [] as string[],
			intentStatus: 'RAW' as const
		};

		// The produced state MUST be a valid domain object — fail loud otherwise (never persist a bad state).
		const stateCheck = validateAgainst(IntentObjectSchema, intent, {
			correlationId,
			targetObjectIds: [intent.id]
		});
		if (!stateCheck.ok) {
			this.logger.error('invariant.produced_state_invalid', {
				correlationId,
				aggregateId: intent.id
			});
			return {
				commandId: command.commandId,
				producedEventIds: [],
				status: 'REJECTED',
				error: stateCheck.error
			};
		}

		const eventId = this.newEventId();
		const recordedAt = this.now();
		const event: DomainEvent = {
			eventId,
			eventType: 'IntentCaptured',
			eventSchemaVersion: 1,
			aggregateType: 'INTENT',
			aggregateId: payload.intentId,
			aggregateRevision: 0,
			occurredAt: ts,
			recordedAt,
			actor,
			correlationId,
			commandId: command.commandId,
			payload
		};

		const input: CommitInput = {
			aggregateType: 'INTENT',
			aggregateId: payload.intentId,
			objectType: 'INTENT',
			expectedRevision: command.expectedRevision,
			newRevision: 0,
			newSemanticVersion: 1,
			currentState: intent,
			events: [event],
			receipt: {
				commandId: command.commandId,
				idempotencyKey: command.idempotencyKey,
				commandType: command.commandType,
				targetAggregateId: payload.intentId,
				status: 'ACCEPTED',
				producedEventIds: [eventId],
				resultHash: contentHash(intent)
			}
		};

		const result = this.store.commit(input);
		if (!result.ok) {
			this.logger.warn('command.revision_conflict', {
				correlationId,
				aggregateId: payload.intentId
			});
			return {
				commandId: command.commandId,
				producedEventIds: [],
				status: 'CONFLICT',
				error: makeRphError('RPH_REVISION_CONFLICT', {
					message: `Revision conflict on ${payload.intentId} (actual revision ${String(result.actualRevision)})`,
					correlationId,
					targetObjectIds: [payload.intentId]
				})
			};
		}

		this.logger.info('command.accepted', {
			correlationId,
			eventType: event.eventType,
			aggregateId: payload.intentId
		});
		return { commandId: command.commandId, status: 'ACCEPTED', producedEventIds: [eventId] };
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

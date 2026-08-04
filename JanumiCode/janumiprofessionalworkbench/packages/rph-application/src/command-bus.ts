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
	DomainCommandSchema,
	makeRphError,
	mintId,
	validateAgainst,
	type CommandResult,
	type DomainCommand,
	type DomainEvent
} from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
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
	/** Present when a guarded batch observed canonical state different from its captured revision vector. */
	readonly guardConflict?: RevisionGuardConflict;
	/** Present when replay succeeded but did not produce the exact candidate object state; the transaction rolled back. */
	readonly postconditionConflict?: ObjectPostconditionConflict;
}

/** One serializable object precondition captured when an isolated candidate began. */
export type RevisionPrecondition =
	| { readonly aggregateId: string; readonly expectedRevision: number }
	| { readonly aggregateId: string; readonly mustNotExist: true };

export interface RevisionGuardConflict {
	readonly aggregateId: string;
	readonly expectedRevision: number | undefined;
	readonly actualRevision: number | undefined;
}

/** Exact materialized-state expectation for an aggregate after candidate replay. */
export interface ObjectPostcondition {
	readonly aggregateId: string;
	readonly expectedContentHash: string;
}

export interface ObjectPostconditionConflict {
	readonly aggregateId: string;
	readonly expectedContentHash: string;
	readonly actualContentHash: string | undefined;
}

/** Internal marker to roll back a guarded batch whose deterministic replay diverged from its candidate. */
class PostconditionAbort extends Error {}

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
		// ── REG-F-011, THE CRASH HALF ────────────────────────────────────────────────────────────────────────
		//
		// `commandId` and `correlationId` are the two envelope fields the STORE requires NOT NULL
		// (`command_receipts.command_id`, `domain_events.correlation_id`). Without this guard a command omitting
		// either reached the store and threw a raw `SqliteError` straight OUT of `dispatch` — and this method's
		// entire contract is that it RETURNS a typed, classified `CommandResult`. A caller without a try/catch
		// failed in a way the error contract says is impossible, and the VALIDATION/INVARIANT/CONCURRENCY
		// classification was missing exactly where it mattered most.
		//
		// DELIBERATELY NARROW. This is NOT envelope validation — REG-F-011 separates the two remediations because
		// validating the whole envelope against `DomainCommandSchema` would refuse commands the engine accepts
		// today (several fixtures here omit envelope fields) and owes a caller survey first. This changes no
		// accept/reject outcome for any well-formed command; it converts a crash into a refusal and nothing else.
		//
		// IDENTITY, NOT PRESENCE: `''` satisfies a NOT NULL column, so a presence-only check would leave a receipt
		// keyed on nothing and let a second such command collide with it.
		const missingIdentity = (['commandId', 'correlationId'] as const).filter((field) => {
			const v: unknown = command[field];
			return typeof v !== 'string' || v.length === 0;
		});
		if (missingIdentity.length > 0) {
			const cid = typeof command.correlationId === 'string' ? command.correlationId : '';
			return {
				commandId: typeof command.commandId === 'string' ? command.commandId : '',
				status: 'VALIDATION_FAILED',
				producedEventIds: [],
				error: makeRphError('RPH_VALIDATION_SCHEMA_FAILED', {
					message:
						`Command envelope is missing required identity: ${missingIdentity.join(', ')}. ` +
						`These identify the command receipt and the event correlation, are NOT NULL in the store, ` +
						`and cannot be defaulted — a command the engine cannot identify cannot be recorded as having ` +
						`happened (REG-F-011).`,
					correlationId: cid,
					targetObjectIds:
						typeof command.targetAggregateId === 'string' ? [command.targetAggregateId] : []
				})
			};
		}

		const correlationId = command.correlationId;
		const base = { commandId: command.commandId, producedEventIds: [] as string[] };
		this.logger.info('command.received', {
			commandType: command.commandType,
			correlationId,
			commandId: command.commandId
		});

		// 0b. Validate the command ENVELOPE (REG-F-011, 2026-08-04).
		//
		// `DomainCommandSchema` was validated NOWHERE in production. Its four references were all inside
		// `rph-contracts` — its own definition, the generated schema manifest, and its registration into a
		// `SchemaRegistry` that itself had no production consumer. Only the PAYLOAD was ever checked, so measured
		// by dispatch: `commandSchemaVersion`, `targetAggregateType`, `targetAggregateId` and `idempotencyKey`
		// could each be omitted ENTIRELY and the command was ACCEPTED, and an undeclared envelope-level property
		// was ACCEPTED although the schema is a `z.strictObject`.
		//
		// SURVEYED BEFORE TURNING IT ON, and the survey CORRECTED the finding's own estimate. REG-F-011 recorded
		// that "several test fixtures in this repository omit envelope fields today and would begin failing,
		// which is the honest cost". Instrumented across the whole suite, ALL 16,609 DISPATCHES ALREADY PASS. The
		// cost was zero. The estimate was a reasonable guess and it was wrong, which is the argument for measuring
		// rather than for guessing more carefully.
		//
		// BEFORE IDEMPOTENCY ON PURPOSE: a malformed envelope must not be answered from a receipt. `commandId`
		// and `correlationId` are still checked ahead of this (the crash half, fixed 2026-08-02) because their
		// absence breaks the store's NOT NULL columns before any schema could speak.
		//
		// Routed through `validateAgainst` so the refusal carries `details.issues` in the SAME shape the payload
		// path produces — that is what the enforcement register's SCHEMA-layer markers (`<issueCode>@<path>`)
		// match against, so an envelope rule can now be cited the way RPH-CON-002 already is.
		const envelope = validateAgainst(DomainCommandSchema, command, {
			correlationId,
			targetObjectIds:
				typeof command.targetAggregateId === 'string' ? [command.targetAggregateId] : []
		});
		if (!envelope.ok) {
			return { ...base, status: 'VALIDATION_FAILED', error: envelope.error };
		}

		// 1. Idempotency: a replay of the same idempotencyKey returns the prior result, no new event.
		const prior = this.store.getReceipt(command.idempotencyKey);
		// REG-F-012 (2026-08-04). This used to return DUPLICATE on the mere EXISTENCE of a receipt, comparing
		// NOTHING — so a wholly different command reusing a key was silently discarded: no events, no aggregate,
		// and a `DUPLICATE` status that the demo's own multi-step authoring path treats as SUCCESS. The caller was
		// told its command had already happened when it never had.
		//
		// THE DETECTION MATERIAL WAS ALREADY PERSISTED AND ALREADY RETURNED: `command_receipts` stores
		// `command_type` and `target_aggregate_id`, `getReceipt` reads them, `CommandReceiptRecord` carries them.
		// This is those two comparisons. Canon PER-5 — "reuse of a key with a different payload fails".
		//
		// THE THIRD DIMENSION IS NOT CLOSED AND IS NOT SKIPPED SILENTLY: same command, same target, DIFFERENT
		// PAYLOAD still replays. The receipt's `resultHash` is `contentHash(nextState)` — a hash of the RESULTING
		// OBJECT, not of the payload — so comparing payloads needs a stored payload hash (a persistence schema
		// change), and deriving it from `resultHash` would mean executing the command first, which is what
		// idempotency exists to avoid.
		//
		// THE CODE IS A RATIFIED ONE CARRYING A LABEL (the WP-11 discipline). `RPH_IDEMPOTENCY_CONFLICT` would be
		// the natural code and is NOT among the ratified fifteen — minting one is a sponsor act.
		// `RPH_IDEMPOTENCY_DUPLICATE` is ratified but belongs to the REPLAY, which REG-F-010 records as correctly
		// carrying no error at all. So the label travels in the message where a reader and a future code can both
		// find it.
		if (
			prior &&
			(prior.commandType !== command.commandType ||
				prior.targetAggregateId !== command.targetAggregateId)
		) {
			this.logger.info('command.idempotency_key_reused', {
				correlationId,
				idempotencyKey: command.idempotencyKey
			});
			return {
				...base,
				status: 'REJECTED',
				error: makeRphError('RPH_VALIDATION_SEMANTIC_FAILED', {
					message:
						`IDEMPOTENCY_KEY_REUSED: key '${command.idempotencyKey}' was claimed by ` +
						`${prior.commandType} on ${prior.targetAggregateId}, and this is ` +
						`${command.commandType} on ${String(command.targetAggregateId)}. A key identifies ONE ` +
						`command; returning the prior result here would report success for work that never ` +
						`happened (DOC-003 PER-5).`,
					correlationId,
					targetObjectIds:
						typeof command.targetAggregateId === 'string' ? [command.targetAggregateId] : []
				})
			};
		}
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

	/**
	 * Verify a candidate's entire read/dependency revision vector and replay its commands in the SAME storage
	 * transaction. This closes the check/commit race that an application-level preflight followed by
	 * `dispatchBatch` would leave open. The command batch retains the ordinary all-or-nothing semantics.
	 */
	dispatchBatchGuarded(
		commands: readonly DomainCommand[],
		preconditions: readonly RevisionPrecondition[],
		expectedEventCount?: number,
		postconditions: readonly ObjectPostcondition[] = []
	): BatchResult {
		let conflict: RevisionGuardConflict | undefined;
		let postconditionConflict: ObjectPostconditionConflict | undefined;
		let result: BatchResult | undefined;
		try {
			this.store.transaction(() => {
				if (expectedEventCount !== undefined) {
					const actualEventCount = this.store.readAllEvents().length;
					if (actualEventCount !== expectedEventCount) {
						conflict = {
							aggregateId: '@event-log',
							expectedRevision: expectedEventCount,
							actualRevision: actualEventCount
						};
						return;
					}
				}
				for (const precondition of preconditions) {
					const expectedRevision =
						'mustNotExist' in precondition ? undefined : precondition.expectedRevision;
					const actualRevision = this.store.loadObject(precondition.aggregateId)?.revision;
					if (actualRevision !== expectedRevision) {
						conflict = {
							aggregateId: precondition.aggregateId,
							expectedRevision,
							actualRevision
						};
						return;
					}
				}
				result = this.dispatchBatch(commands);
				if (!result.ok) return;
				for (const postcondition of postconditions) {
					const actual = this.store.loadObject(postcondition.aggregateId);
					const actualContentHash = actual ? contentHash(actual) : undefined;
					if (actualContentHash !== postcondition.expectedContentHash) {
						postconditionConflict = { ...postcondition, actualContentHash };
						throw new PostconditionAbort();
					}
				}
			});
		} catch (error) {
			if (!(error instanceof PostconditionAbort)) throw error;
		}
		if (conflict) return { ok: false, results: [], guardConflict: conflict };
		if (postconditionConflict) {
			return {
				ok: false,
				results: result?.results ?? [],
				postconditionConflict
			};
		}
		return result!;
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

	/**
	 * W2-INC-2 (WP-2-007) — restart recovery. On (re)open of a DURABLE store, re-drive every outbox message the
	 * store still holds as PENDING: after a crash between commit and delivery the event is durably committed (it
	 * is in `domain_events` + `outbox_messages`) but was never delivered to any subscriber. Re-driving is
	 * idempotent — `readPendingOutbox` returns only PENDING rows and `markOutboxPublished` is the checkpoint, so
	 * an already-PUBLISHED message is NEVER re-delivered ("restart recovery avoids duplicate external side
	 * effects"). Delivery is therefore at-least-once; subscribers SHALL be idempotent. A durable host SHALL call
	 * this at startup, after wiring its subscribers and before accepting new commands. Returns the count recovered.
	 */
	recoverOutbox(): number {
		const recovered = this.drainOutbox();
		if (recovered > 0) this.logger.info('outbox.recovered', { count: recovered });
		return recovered;
	}
}

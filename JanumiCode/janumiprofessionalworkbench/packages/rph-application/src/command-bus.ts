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
	type DomainEvent,
	type StampedCommand
} from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
import type {
	AuthenticationPort,
	Credential,
	Logger,
	Principal,
	StorageAdapter
} from '@janumipwb/rph-ports';
import { NoopLogger } from '@janumipwb/rph-ports';
import type { ZodType } from 'zod';
import type { HandlerContext } from './handlers/kit.js';
import { HANDLERS } from './handlers/registry.js';

export interface EngineDeps {
	readonly store: StorageAdapter;
	/**
	 * THE TRUST BOUNDARY, AND IT IS REQUIRED (DOC-003 §9 PER-3; DOC-004 §5; REG-D-027).
	 *
	 * Not optional, because PER-3's SCOPE clause makes *"the existence and completeness of the gate"* the
	 * semantic requirement: an optional port turns "no gate" from a compile error into a runtime condition,
	 * and every permissive default in this repository's history became the live path.
	 */
	readonly authenticate: AuthenticationPort;
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

/**
 * A dispatcher bound to ONE authenticated principal. The only way to reach a command.
 *
 * ⚠ THE SEAM IS A RECEIVER, NOT A PARAMETER (REG-D-028), and that closes two hazards by construction rather
 * than by remembering:
 *   - the authoring broker HOLDS one bound to an AGENT credential, so its agent identity is what it IS rather
 *     than a default field that falls dead once the engine stamps;
 *   - a recorded turn REPLAYS through the session that recorded it, so accepting an agent's work cannot
 *     re-attribute it to the human who pressed accept.
 * There is also no positional credential to append, and therefore none to silently drop.
 */
export interface AuthedEngine {
	/**
	 * WHO THIS SESSION IS — resolved from the credential, `undefined` when it did not resolve.
	 *
	 * This exists because some ratified PAYLOADS must NAME an actor: a Decision's `authority` (ASR-15), an
	 * ExecutionAttempt's `executedBy` (§20 execution provenance), an assessment's evaluator. Stamping
	 * `issuedBy` does not reach any of them, and before this the surfaces filled them with a hardcoded literal
	 * — `ui-user`, an identity no authenticator has ever issued (REG-F-061). Reading the resolved principal is
	 * JPWB-DOC-004 §5 performed rather than quoted: "derive tenant and principal context from authenticated
	 * context, never from a payload's claim about itself."
	 *
	 * ⚠ IT IS NOT A CAPABILITY. A caller can only learn who it ALREADY is — it needs the credential to get
	 * here, and it cannot construct a session for anyone else. `undefined` must be treated as a refusal, never
	 * as a licence to substitute a default: a surface that cannot name its actor has nothing true to write.
	 */
	readonly principal: Principal | undefined;
	dispatch(command: DomainCommand): CommandResult;
	dispatchBatch(commands: readonly DomainCommand[]): BatchResult;
	dispatchBatchGuarded(
		commands: readonly DomainCommand[],
		preconditions: readonly RevisionPrecondition[],
		expectedEventCount?: number,
		postconditions?: readonly ObjectPostcondition[]
	): BatchResult;
	// The read/lifecycle surface rides along so a caller that dispatches does not need to hold two references.
	// These need no credential and are unchanged by it; carrying them here weakens nothing and removes the
	// temptation to keep an ungated engine in scope beside the gated one.
	subscribe(handler: EventSubscriber): void;
	drainOutbox(): number;
	recoverOutbox(): number;
}

/** Internal marker to roll back a guarded batch whose deterministic replay diverged from its candidate. */
class PostconditionAbort extends Error {}

export class Engine {
	private readonly store: StorageAdapter;
	private readonly now: () => string;
	private readonly newEventId: () => string;
	private readonly logger: Logger;
	private readonly authenticate: AuthenticationPort;
	private readonly subscribers: EventSubscriber[] = [];

	constructor(deps: EngineDeps) {
		this.store = deps.store;
		this.now = deps.now ?? (() => new Date().toISOString());
		this.newEventId = deps.newEventId ?? (() => mintId('EVENT'));
		this.logger = deps.logger ?? new NoopLogger();
		// No `??` fallback, deliberately. There is no default authenticator and there must not be one.
		this.authenticate = deps.authenticate;
	}

	/**
	 * Bind a credential and obtain the only object that can dispatch.
	 *
	 * Resolution happens HERE, once per session — an unresolvable credential yields a session whose every
	 * dispatch refuses with `RPH_AUTHENTICATION_REQUIRED`. It fails CLOSED rather than throwing, because a
	 * refusal is a governed outcome the caller must be able to record and a throw is not.
	 */
	as(credential: Credential): AuthedEngine {
		const outcome = this.authenticate.authenticate(credential);
		const principal = outcome.ok ? outcome.principal : undefined;
		const reason = outcome.ok ? undefined : outcome.reason;
		return {
			principal,
			dispatch: (command) => this.dispatchAs(principal, reason, command),
			dispatchBatch: (commands) => this.dispatchBatchAs(principal, reason, commands),
			dispatchBatchGuarded: (commands, preconditions, expectedEventCount, postconditions) =>
				this.dispatchBatchGuardedAs(
					principal,
					reason,
					commands,
					preconditions,
					expectedEventCount,
					postconditions
				),
			subscribe: (handler) => this.subscribe(handler),
			drainOutbox: () => this.drainOutbox(),
			recoverOutbox: () => this.recoverOutbox()
		};
	}

	subscribe(handler: EventSubscriber): void {
		this.subscribers.push(handler);
	}

	/**
	 * The authenticated dispatch. `principal` is set iff the session's credential resolved.
	 *
	 * ⚠ A DECLARED `issuedBy` THAT DISAGREES IS REFUSED, NOT SILENTLY CORRECTED. Overwriting quietly would
	 * make a forgery attempt invisible — the record would show the true actor and no trace that anyone claimed
	 * otherwise. Refusing turns the attempt into a recorded refusal, which is the difference between an audit
	 * trail and a tidy one.
	 */
	private dispatchAs(
		principal: Principal | undefined,
		reason: string | undefined,
		rawCommand: DomainCommand
	): CommandResult {
		const gated = this.stampOrRefuse(principal, reason, rawCommand);
		return 'error' in gated ? gated.error : this.dispatchStamped(gated.command);
	}

	/** Resolve the acting identity onto the command, or produce the refusal. Shared by all three entry points. */
	private stampOrRefuse(
		principal: Principal | undefined,
		reason: string | undefined,
		command: DomainCommand
	): { command: StampedCommand } | { error: CommandResult } {
		const base = {
			commandId: typeof command.commandId === 'string' ? command.commandId : '',
			producedEventIds: [] as string[]
		};
		const correlationId = typeof command.correlationId === 'string' ? command.correlationId : '';
		const targetObjectIds =
			typeof command.targetAggregateId === 'string' ? [command.targetAggregateId] : [];
		const refuse = (message: string): { error: CommandResult } => ({
			error: {
				...base,
				status: 'UNAUTHORIZED',
				error: makeRphError('RPH_AUTHENTICATION_REQUIRED', {
					message,
					correlationId,
					targetObjectIds
				})
			}
		});

		if (!principal) {
			return refuse(
				`The acting principal could not be established from authenticated context ` +
					`(${reason ?? 'NO_SESSION'}), so this command cannot be attributed and is refused before ` +
					`any effect (DOC-003 §9 PER-3; DOC-004 §5).`
			);
		}

		// A DECLARED ISSUER IS A CHECKED CLAIM (REG-D-027(b)). Most callers now declare nothing and are simply
		// stamped; one that DOES declare is compared, and a disagreement is refused rather than corrected — so
		// an attempt to act as someone else is a recorded refusal instead of an invisible overwrite.
		const declared = command.issuedBy as { actorId?: string; actorType?: string } | undefined;
		if (
			declared &&
			(declared.actorId !== principal.actorId || declared.actorType !== principal.actorType)
		) {
			return refuse(
				`This command declares an issuer it is not: it names ${String(declared.actorType)} ` +
					`${String(declared.actorId)} while the authenticated principal is ${principal.actorType} ` +
					`${principal.actorId}. Refused rather than corrected, so the attempt is recorded (DOC-004 §5).`
			);
		}

		// THE STAMP — a total function onto the ratified `ActorReference` shape. `tenantId`/`organizationId`
		// live on the Principal but have no home on ActorReference; carrying them onto the OBJECT ENVELOPE is
		// REG-D-026's work in D-3, and it is not smuggled in here.
		return {
			command: {
				...command,
				issuedBy: {
					actorId: principal.actorId,
					actorType: principal.actorType,
					displayName: principal.displayName,
					...(principal.roleId === undefined ? {} : { roleId: principal.roleId }),
					...(principal.modelId === undefined ? {} : { modelId: principal.modelId }),
					...(principal.providerId === undefined ? {} : { providerId: principal.providerId }),
					...(principal.executionInstanceId === undefined
						? {}
						: { executionInstanceId: principal.executionInstanceId })
				}
			} as StampedCommand
		};
	}

	private dispatchStamped(command: StampedCommand): CommandResult {
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

		// 0c. Hash the payload, so step 1 can bind the key to it (REG-F-012 clause 3, 2026-08-04).
		//
		// WHY IT CAN FAIL AND MUST NOT THROW. `contentHash` canonicalizes, and canonical JSON admits only FINITE
		// INTEGER numbers — "a float in hashed content is a modeling smell and is rejected loudly". Twenty-two
		// command payload fields are `z.number()` with no `.int()`, so a caller CAN send `1.5` past Zod. Hashing it
		// unguarded here would put a `CanonicalJsonError` on the throw path out of `dispatch` — precisely the crash
		// class REG-F-011's first half closed, reopened by the fix for a different finding.
		//
		// SO IT REFUSES INSTEAD, and this is a real (if narrow) tightening rather than pure plumbing: such a payload
		// is one the engine could never have receipted, and for handlers that carry the field into state it ALREADY
		// crashed a few frames later at `contentHash(nextState)`. This converts that into a classified refusal.
		// `RPH_VALIDATION_SCHEMA_FAILED` is the ratified §25.1 code — "structural validation of the payload failed",
		// which does not say SCHEMA validation — the same reading `kit.ts` already relies on for event payloads.
		//
		// MEASURED FIRST: 0 of 16,612 dispatches across the suite fail to canonicalize, so this refuses nothing the
		// engine accepts today.
		//
		// AND IT KEEPS `payload_hash` HONEST. If an unhashable payload were instead receipted with a NULL hash, NULL
		// would mean two different things — "written before v2" and "we gave up" — and the second is a bypass: claim
		// a key with a float, and every later reuse of that key skips the payload comparison. One marker, one
		// meaning.
		let payloadHash: string;
		try {
			payloadHash = contentHash(command.payload);
		} catch (e) {
			return {
				...base,
				status: 'VALIDATION_FAILED',
				error: makeRphError('RPH_VALIDATION_SCHEMA_FAILED', {
					message:
						`Command payload cannot be canonicalized, so it cannot be bound to its idempotency key: ` +
						`${e instanceof Error ? e.message : String(e)}`,
					correlationId,
					targetObjectIds: [command.targetAggregateId]
				})
			};
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
		// THE THIRD DIMENSION IS NOW CLOSED TOO (2026-08-04) by `command_receipts.payload_hash` — schema v2, with
		// the first forward migration this engine has ever run. `resultHash` could never decide it: it is
		// `contentHash(nextState)`, the RESULTING OBJECT, and having that means having executed the command, which
		// is what idempotency exists to avoid.
		//
		// AN ABSENT `payloadHash` IS SKIPPED, NOT FAILED. Receipts written before v2 carry NULL, and reading that
		// as "the payload differed" would turn every legitimate replay in an upgraded durable store into a refusal.
		// Absence of evidence is not evidence of difference — a mistake this register has recorded more than once,
		// so the guard is written to make it obvious rather than to be terse.
		//
		// ~~THE CODE IS A RATIFIED ONE CARRYING A LABEL (the WP-11 discipline). `RPH_IDEMPOTENCY_CONFLICT` would be
		// the natural code and is NOT among the ratified fifteen — ~~minting one is a sponsor act~~.~~
		// ✅ MINTED 2026-08-15 (REG-F-181). The code below IS `RPH_IDEMPOTENCY_CONFLICT`, category CONCURRENCY —
		// still not one of the ratified fifteen, and still disclosed as authored in `errors.ts` rather than blended
		// into them. The paragraph beneath is left standing because it is the record of WHY this took eight days:
		// the ground was removed on 2026-08-07 and this consumer was never told.
		//
		// ⚠ THE LABEL STAYS IN THE MESSAGE, AND THAT IS A DECISION RATHER THAN LEFTOVER. It now duplicates the
		// code. It stays because it is prose emitted from the same refusal — no drift surface between them — four
		// assertions and any operator grep depend on it, and removing it is a separable call that must not ride in
		// on a mint. Whoever removes it should do so deliberately, not while tidying.
		// ⚠ THE AUTHORITY CLAIM ABOVE IS REFUTED, AND THIS COMMENT IS WHY IT MATTERED (REG-F-144). REG-D-027/REG-F-057 settled on 2026-08-07 that minting an error code is **a repository shape change, through the contract procedure — NOT a sponsor act**: REG-D-004 makes the repository authoritative for "error codes" by name, and DOC-004 §5 routes enum extension through the contract procedure. `packages/rph-contracts/src/errors.ts` records the correction AND records that THIS SITE is what the refuted claim was blocking — *"a code comment in command-bus.ts that refused to mint a needed code on the strength of it"*. ⚠ AND THE COUNT SENTENCE THAT STOOD HERE WAS ITSELF THE CONFLATION THIS COMMIT REVERTED ELSEWHERE (corrected REG-F-148). It read "the ratified set is no longer fifteen". **It still is fifteen.** `errors.ts` states the split explicitly — "Fifteen transcribed from DOC-007 §25.1 ... plus one AUTHORED addition disclosed inline below" — and the sixteenth member carries "AUTHORED 2026-08-07 (REG-D-027). Not from DOC-007 §25.1; **disclosed rather than blended in**". So the RATIFIED set is fifteen and the WIRE ENUM is sixteen, and writing "the ratified set is no longer fifteen" blends in the very member that was deliberately kept separate. `RPH_IDEMPOTENCY_CONFLICT` is in NEITHER set, which is why the struck limb above was TRUE and is restored, and why minting it remains a real contract change. **The workaround below therefore stands on a ground that was removed seven days ago.** Minting `RPH_IDEMPOTENCY_CONFLICT` is now AVAILABLE — it is a contract change with schema, storage, fixture and test coordination, so it is filed as its own work package rather than smuggled into a comment fix.
		// `RPH_IDEMPOTENCY_DUPLICATE` is ratified but belongs to the REPLAY, which REG-F-010 records as correctly
		// carrying no error at all. So the label travels in the message where a reader and a future code can both
		// find it.
		const reused = prior
			? [
					prior.commandType !== command.commandType ? 'command type' : undefined,
					prior.targetAggregateId !== command.targetAggregateId ? 'target aggregate' : undefined,
					// `undefined` is the SKIP, not a mismatch — see above.
					prior.payloadHash !== undefined && prior.payloadHash !== payloadHash
						? 'payload'
						: undefined
				].filter((d): d is string => d !== undefined)
			: [];
		if (prior && reused.length > 0) {
			this.logger.info('command.idempotency_key_reused', {
				correlationId,
				idempotencyKey: command.idempotencyKey,
				differing: reused.join(', ')
			});
			return {
				...base,
				status: 'REJECTED',
				error: makeRphError('RPH_IDEMPOTENCY_CONFLICT', {
					message:
						`IDEMPOTENCY_KEY_REUSED: key '${command.idempotencyKey}' was claimed by ` +
						`${prior.commandType} on ${prior.targetAggregateId}, and this is ` +
						`${command.commandType} on ${String(command.targetAggregateId)} — differing by ` +
						`${reused.join(', ')}. A key identifies ONE command; returning the prior result here ` +
						`would report success for work that never happened (DOC-003 PER-5).`,
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
	private dispatchBatchAs(
		principal: Principal | undefined,
		reason: string | undefined,
		commands: readonly DomainCommand[]
	): BatchResult {
		const results: CommandResult[] = [];
		let failedIndex: number | undefined;
		try {
			this.store.transaction(() => {
				for (let i = 0; i < commands.length; i += 1) {
					const r = this.dispatchAs(principal, reason, commands[i]!);
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
	private dispatchBatchGuardedAs(
		principal: Principal | undefined,
		reason: string | undefined,
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
				result = this.dispatchBatchAs(principal, reason, commands);
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

	/**
	 * Deliver pending outbox events to subscribers and mark them published. Returns the count DELIVERED.
	 *
	 * ── ⚠ A DRAIN WITH NO SUBSCRIBER DELIVERS NOTHING, AND USED TO MARK EVERYTHING PUBLISHED ANYWAY ───────────
	 *
	 * The loop over `this.subscribers` is a no-op when the list is empty, and `markOutboxPublished` then ran
	 * unconditionally over every pending id. In production the list IS empty — nothing registers an event
	 * subscriber anywhere in the app, and `enforcement-register.ts` already recorded that — so every event this
	 * engine has ever committed was marked delivered to nobody.
	 *
	 * THE WRITE IT CORRUPTS IS THE `status` COLUMN, AND THE DAMAGE IS PERMANENT. `recoverOutbox` re-drives only
	 * PENDING rows, by design, so that a restart cannot duplicate an external side effect. A row wrongly marked
	 * PUBLISHED is therefore invisible to every future subscriber forever: the moment anyone wires a projection,
	 * it silently starts from the present with no way to learn it missed the past.
	 *
	 * It also falsifies this class's own stated contract two methods down — *"Delivery is therefore
	 * at-least-once; subscribers SHALL be idempotent."* With no subscriber it was at-most-zero, and the row said
	 * otherwise.
	 *
	 * SO NOTHING IS MARKED WHEN THERE IS NOBODY TO DELIVER TO. The rows stay PENDING, which is what they are, and
	 * a growing outbox becomes the visible form of "no consumer exists" instead of a silent discard. This is
	 * deliberately NOT a throw: a host legitimately has no subscribers before it wires them, and refusing there
	 * would break startup for a condition that is not an error — only a lie about it is.
	 */
	drainOutbox(): number {
		const pending = this.store.readPendingOutbox();
		if (pending.length === 0) return 0;
		if (this.subscribers.length === 0) {
			this.logger.warn('outbox.undelivered', {
				pending: pending.length,
				reason: 'no subscriber is registered; rows are left PENDING rather than marked published'
			});
			return 0;
		}
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

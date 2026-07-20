// PWA-authoring handlers — the PWA Design context (RPH-DOC-010 §6, §11, §20). A Professional Work Architecture is
// authored as a draft, its PWU Types are defined, then it is submitted → validated → published; a PUBLISHED PWA
// version is immutable (changes create a successor). An Undertaking is instantiated from a PUBLISHED PWA version
// (§42): CreateUndertaking binds the exact PWA version; the root PWU Instance + children are then shaped in the
// Undertaking context (via ProposePwu carrying undertakingId + pwuTypeId — the CON-009 ownership binding).
import type {
	AppendConversationEntriesPayload,
	CommandResult,
	CreatePwaPayload,
	CreateUndertakingPayload,
	DefinePwuTypePayload,
	DomainCommand,
	EditPwaPayload,
	EditPwuTypePayload,
	PublishPwaPayload
} from '@janumipwb/rph-contracts';
import {
	analyzePwaGraph,
	buildPwaGraphExport,
	type PwaGraphExport,
	type PwaGraphNode
} from '@janumipwb/rph-projections';
import {
	advanceStatus,
	commitState,
	createObject,
	loadOrReject,
	makeEvent,
	newEnvelope,
	nextEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';
import { AI_ACTOR_TYPES, floorGateBlock } from './floor-gate.js';

const PWA = 'PROFESSIONAL_WORK_ARCHITECTURE';
const PWU_TYPE = 'PWU_TYPE';
const UNDERTAKING = 'UNDERTAKING';
const CONVERSATION = 'AUTHORING_CONVERSATION';
const PWA_MACHINE = 'PWA.publicationStatus';

/** Primitive types `String(...)` coerces without hitting Object's default `[object Object]` stringification. */
type Stringifiable = string | number | boolean;

/** AppendConversationEntries — the durable, event-sourced transcript of the authoring agent's work on a DRAFT PWA.
 *  This is DOMAIN state (a precursor to the JanumiCode v2 governed stream), NOT UI metadata: each turn's messages /
 *  tool calls / results are appended as domain events, so the conversation survives reloads and (when the engine is
 *  backed by a durable store) restarts, and is part of the authoritative audit trail. First append CREATES the
 *  conversation aggregate; subsequent appends extend its ordered entries. One conversation per PWA (the host keys
 *  the conversationId to the pwaId). */
export const appendConversationEntries: CommandHandler = (ctx, command, payload) => {
	const p = payload as AppendConversationEntriesPayload;
	const id = command.targetAggregateId;
	const existing = ctx.store.loadObject(id);
	if (!existing) {
		const state: Record<string, unknown> = {
			...newEnvelope(command, CONVERSATION, id, {
				lifecycleStatus: 'ACTIVE',
				originType: 'USER_INPUT',
				sourceObjectIds: [p.pwaId]
			}),
			pwaId: p.pwaId,
			entries: p.entries
		};
		return createObject(ctx, command, {
			objectType: CONVERSATION,
			aggregateId: id,
			state,
			eventType: 'ConversationEntriesAppended'
		});
	}
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const prior = Array.isArray(loaded.state.entries) ? (loaded.state.entries as unknown[]) : [];
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		entries: [...prior, ...p.entries]
	};
	const event = makeEvent(ctx, command, {
		eventType: 'ConversationEntriesAppended',
		aggregateType: CONVERSATION,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: CONVERSATION,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

// ── Material graph edits raise the PWA's semantic version (guide §10.1 L1379, §8.4 L854) ─────────────────────────
/** Rolls back the whole (PWU-Type write + PWA version bump) pair when the bump cannot be committed. */
class BumpAbort extends Error {}

/**
 * Raise the PWA's semanticVersion because its PWU-Type graph was materially edited.
 *
 * WHY: §10.1 L1379 — "Claims, Assessments, Decisions, and waivers bind exact subject semantic versions;" — and
 * §8.4 L854 — "A missing, stale, malformed, failed, unavailable, or independence-invalid required review cannot
 * satisfy assurance or permit its protected transition." `floor-gate.ts`'s `versionOk` check (`rec?.version ===
 * opts.subjectVersion`) is a REAL check of exactly that, and it was inert: no authoring command ever moved the
 * PWA's semanticVersion, so a floor satisfied over a 1-type graph silently authorized publication of a graph a
 * PWU Type had been smuggled into afterwards. The subject of the floor is the PWA (its graph), so the version the
 * floor binds must move when the graph does.
 *
 * WHY HERE: DefinePwuType/EditPwuType/RemovePwuType target the PWU_TYPE aggregate, but the reviewed subject is the
 * PWA — and a `CommitInput` carries the state of ONE aggregate, so raising the PWA's version needs its own commit.
 * The pair is wrapped in `ctx.store.transaction` (the port's existing all-or-nothing seam, as `dispatchBatch` uses)
 * so a graph edit can never land with the version left behind — which would silently re-create this defect.
 *
 * NO NEW EVENT IS INVENTED: this emits the generated-registry event `PwaEdited` on the PROFESSIONAL_WORK_ARCHITECTURE
 * aggregate with `{ pwaId }` (its schema requires only `pwaId`; name/description/domain/version are optional). That
 * is literally what happened — the PWA changed — and it keeps the version history of the PWA readable as its own
 * event stream. The second commit needs its own receipt (`idempotency_key` is a PRIMARY KEY), so the key/commandId
 * are DERIVED deterministically from the originating command; a genuine replay never reaches here because the bus
 * short-circuits on the original key first.
 */
function bumpPwaSemanticVersion(
	ctx: HandlerContext,
	command: DomainCommand,
	pwaId: string
): CommandResult | null {
	const loaded = loadOrReject(ctx, command, pwaId);
	if (!loaded.ok) return loaded.result;
	const bumpCommand: DomainCommand = {
		...command,
		commandId: `${command.commandId}#pwa-version`,
		idempotencyKey: `${command.idempotencyKey}#pwa-version`
	};
	const newRevision = loaded.revision + 1;
	const newSemanticVersion = loaded.semanticVersion + 1;
	const next = nextEnvelope(loaded.state, bumpCommand, newRevision, newSemanticVersion);
	const event = makeEvent(ctx, bumpCommand, {
		eventType: 'PwaEdited',
		aggregateType: PWA,
		aggregateId: pwaId,
		aggregateRevision: newRevision,
		payload: { pwaId }
	});
	const result = commitState(ctx, bumpCommand, {
		objectType: PWA,
		aggregateId: pwaId,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion,
		nextState: next,
		event
	});
	return result.status === 'ACCEPTED' ? null : result;
}

/** Commit a material PWU-Type edit AND the owning PWA's version bump atomically (see bumpPwaSemanticVersion). */
function withPwaVersionBump(
	ctx: HandlerContext,
	command: DomainCommand,
	pwaId: string,
	commitEdit: () => CommandResult
): CommandResult {
	let outcome: CommandResult | undefined;
	try {
		ctx.store.transaction(() => {
			outcome = commitEdit();
			if (outcome.status !== 'ACCEPTED') throw new BumpAbort();
			const failure = bumpPwaSemanticVersion(ctx, command, pwaId);
			if (failure) {
				outcome = failure;
				throw new BumpAbort();
			}
		});
	} catch (e) {
		if (!(e instanceof BumpAbort)) throw e;
	}
	return outcome!;
}

/** CreatePwa — create a Professional Work Architecture in DRAFT. */
export const createPwa: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreatePwaPayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, PWA, p.pwaId, {
			lifecycleStatus: 'DRAFT',
			originType: 'HUMAN_DECISION'
		}),
		name: p.name,
		description: p.description,
		domain: p.domain,
		version: p.version,
		pwuTypeIds: [],
		assurancePolicyIds: [],
		baselineTypeIds: [],
		roleIds: [],
		executionStrategyIds: [],
		conformanceFixtureIds: [],
		publicationStatus: 'DRAFT'
	};
	return createObject(ctx, command, {
		objectType: PWA,
		aggregateId: p.pwaId,
		state,
		eventType: 'PwaCreated'
	});
};

/**
 * INV-1 / STD-3 (JAN-PRPWA-DS-001) — the executionBoundary/boundaryContract coherence invariant, checked at the
 * domain WRITE boundary (never only in the broker/UI, C-5) against the already-MERGED next state, so a patch-merge
 * edit cannot leave an incoherent pair. `next.executionBoundary` is resolved absent → INTERNAL (STD-2 default).
 *
 *   DELEGATED_EXTERNAL ⇒ a boundaryContract with a non-empty counterpartyLabel (STD-3, min-length not
 *                        schema-expressible) AND no permitted child types (INV-1: a delegated node is terminal).
 *   INTERNAL           ⇒ no boundaryContract (a boundary contract is authored only across an org boundary).
 *
 * Returns a rejecting CommandResult (RPH_INVARIANT_VIOLATION — the removePwuType precedent for a domain invariant)
 * or null. Decision observability (EP-OBS-2 / JAN-ENGC-001 §4.11): every rejection emits a structured, greppable
 * record (reason + resolved boundary). `warn`, not `error`: an incoherent authoring request is an EXPECTED input
 * rejection, whereas `error` (kit.ts `invariant.produced_state_invalid`) is reserved for a handler that built a
 * bad state — a genuine fault. The record makes the violation queryable without a false alarm.
 */
function checkBoundaryCoherence(
	ctx: HandlerContext,
	command: DomainCommand,
	next: Record<string, unknown>,
	id: string
): CommandResult | null {
	const boundary = next.executionBoundary === 'DELEGATED_EXTERNAL' ? 'DELEGATED_EXTERNAL' : 'INTERNAL';
	const contract = next.boundaryContract as { counterpartyLabel?: unknown } | undefined;
	const childCount =
		(Array.isArray(next.permittedChildTypeIds) ? next.permittedChildTypeIds.length : 0) +
		(Array.isArray(next.permittedChildren) ? next.permittedChildren.length : 0);
	const violation = (reason: string, message: string): CommandResult => {
		ctx.logger.warn('invariant.boundary_coherence_violation', {
			correlationId: command.correlationId,
			aggregateId: id,
			commandType: command.commandType,
			boundary,
			reason
		});
		return reject(command, 'RPH_INVARIANT_VIOLATION', message, [id]);
	};
	if (boundary === 'DELEGATED_EXTERNAL') {
		if (!contract) {
			return violation(
				'delegated_without_contract',
				`PWU Type ${id} is DELEGATED_EXTERNAL but declares no boundaryContract (STD-3: a delegated node authors a boundary contract in lieu of an internal decomposition)`
			);
		}
		if (typeof contract.counterpartyLabel !== 'string' || contract.counterpartyLabel.trim() === '') {
			return violation(
				'empty_counterparty_label',
				`PWU Type ${id}: boundaryContract.counterpartyLabel must be a non-empty label identifying the external counterparty (STD-3)`
			);
		}
		if (childCount > 0) {
			return violation(
				'delegated_with_children',
				`PWU Type ${id} is DELEGATED_EXTERNAL and therefore terminal (INV-1): it must declare no permitted child types`
			);
		}
	} else if (contract) {
		return violation(
			'internal_with_contract',
			`PWU Type ${id} is INTERNAL but carries a boundaryContract; a boundary contract is authored only for a DELEGATED_EXTERNAL node (INV-1)`
		);
	}
	return null;
}

/** DefinePwuType — create a PWU Type under a DRAFT PWA (types are edited draft-only, §39). */
export const definePwuType: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefinePwuTypePayload;
	const pwa = ctx.store.loadObject(p.pwaId)?.state as
		{ publicationStatus?: string; version?: string } | undefined;
	if (!pwa) {
		return reject(command, 'RPH_VALIDATION_SEMANTIC_FAILED', `PWA ${p.pwaId} does not exist`, [
			p.pwuTypeId
		]);
	}
	if (pwa.publicationStatus !== 'DRAFT') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`PWU Types can only be defined on a DRAFT PWA (${p.pwaId} is ${String(pwa.publicationStatus)})`,
			[p.pwuTypeId]
		);
	}
	// permittedChildTypeIds stays the authoritative flat edge list (render/projections consume it); permittedChildren
	// is the parallel cardinality annotation. If only the rules are supplied, derive the flat list from them.
	const childRules = (p.permittedChildren ?? []) as ReadonlyArray<{ typeId: string }>;
	const state: Record<string, unknown> = {
		...newEnvelope(command, PWU_TYPE, p.pwuTypeId, {
			lifecycleStatus: 'DRAFT',
			originType: 'HUMAN_DECISION',
			sourceObjectIds: [p.pwaId]
		}),
		pwaId: p.pwaId,
		// RPH-CON-009: a PWU Type's identity binds to a VERSIONED PWA, not a bare pwaId. DERIVED from the owning
		// PWA's `version` — not caller-supplied, so the broker/agent/UI need not thread it — and stable across
		// publish (publishPwa flips publicationStatus only, never `version`). If the PWA somehow lacks a version,
		// the required-string schema rejects at commit (fail-loud) rather than persist a versionless type.
		pwaVersion: pwa.version,
		pwuKind: p.pwuKind,
		name: p.name,
		purpose: p.purpose,
		isRoot: p.isRoot,
		permittedParentTypeIds: p.permittedParentTypeIds ?? [],
		permittedChildTypeIds: p.permittedChildTypeIds ?? childRules.map((r) => r.typeId),
		permittedChildren: p.permittedChildren ?? [],
		// STD-2/STD-3 (JAN-PRPWA-DS-001, DWP-02): executionBoundary defaults to INTERNAL (absent ⇒ INTERNAL); the
		// boundaryContract is set only when supplied. An INTERNAL define carrying a contract is a contradictory
		// request and is REJECTED below (not silently stripped) — stripping is an edit-only affordance for the
		// DELEGATED→INTERNAL flip. INV-1/STD-3 are then enforced against the merged state before the commit.
		executionBoundary: p.executionBoundary ?? 'INTERNAL',
		...(p.boundaryContract !== undefined ? { boundaryContract: p.boundaryContract } : {}),
		requiredInputs: p.requiredInputs ?? [],
		requiredOutputs: p.requiredOutputs ?? [],
		requiredAssurancePolicyIds: p.requiredAssurancePolicyIds ?? [],
		completionRule:
			p.completionRule ?? 'Execution succeeded AND required outputs exist AND assurance satisfied',
		status: 'DRAFT'
	};
	const boundaryViolation = checkBoundaryCoherence(ctx, command, state, p.pwuTypeId);
	if (boundaryViolation) return boundaryViolation;
	// Adding a PWU Type materially edits the PWA's graph: raise the PWA's semanticVersion with it, so a floor
	// satisfied over the previous graph cannot authorize this one (§10.1 L1379).
	return withPwaVersionBump(ctx, command, p.pwaId, () =>
		createObject(ctx, command, {
			objectType: PWU_TYPE,
			aggregateId: p.pwuTypeId,
			state,
			eventType: 'PwuTypeDefined'
		})
	);
};

/** EditPwa — update a DRAFT PWA's metadata in place. A PUBLISHED version is immutable (§11), so this rejects
 *  unless publicationStatus is DRAFT. Only the fields present in the payload are changed. */
export const editPwa: CommandHandler = (ctx, command, payload) => {
	const p = payload as EditPwaPayload;
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (loaded.state.publicationStatus !== 'DRAFT') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`A PWA can only be edited while DRAFT (${id} is ${String(loaded.state.publicationStatus)})`
		);
	}
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		...(p.name !== undefined ? { name: p.name } : {}),
		...(p.description !== undefined ? { description: p.description } : {}),
		...(p.domain !== undefined ? { domain: p.domain } : {}),
		...(p.version !== undefined ? { version: p.version } : {})
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwaEdited',
		aggregateType: PWA,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: PWA,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/** Count Undertakings instantiated from this PWA (any status) — a PWA "in use" cannot be deleted. */
function undertakingsOf(ctx: HandlerContext, pwaId: string): number {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === UNDERTAKING) ids.add(e.aggregateId);
	let n = 0;
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as { pwaId?: string } | undefined;
		if (s?.pwaId === pwaId) n += 1;
	}
	return n;
}

/** DeletePwa — discard a PWA (tombstone via publicationStatus DISCARDED; the Library hides it). Referential
 *  integrity is enforced HERE: a PWA that any Undertaking was instantiated from is IN USE and cannot be deleted
 *  (deprecate/retire it instead) — deleting it would strand those Undertakings' PWA binding. Deletion is otherwise
 *  allowed from any status (a DRAFT you no longer want, or an unused published version). Idempotent-safe: a second
 *  delete of an already-DISCARDED PWA is rejected by loadOrReject/guard naturally. */
export const deletePwa: CommandHandler = (ctx, command) => {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (loaded.state.publicationStatus === 'DISCARDED') {
		return reject(command, 'RPH_INVARIANT_VIOLATION', `PWA ${id} is already deleted`);
	}
	const inUse = undertakingsOf(ctx, id);
	if (inUse > 0) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`Cannot delete PWA ${id}: ${inUse} Undertaking(s) were instantiated from it (it is in use). Deprecate/retire it instead.`
		);
	}
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		publicationStatus: 'DISCARDED'
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwaDeleted',
		aggregateType: PWA,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: command.payload
	});
	return commitState(ctx, command, {
		objectType: PWA,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/** A PWU Type may only be edited/removed while its OWNING PWA is DRAFT (types are draft-only, §39). */
function requireDraftOwner(
	ctx: HandlerContext,
	command: DomainCommand,
	typeState: Record<string, unknown>
): CommandResult | null {
	const pwaId = String(typeState.pwaId);
	const pwa = ctx.store.loadObject(pwaId)?.state as { publicationStatus?: string } | undefined;
	if (pwa?.publicationStatus !== 'DRAFT') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`A PWU Type can only be changed while its PWA is DRAFT (${pwaId} is ${String(pwa?.publicationStatus)})`,
			[command.targetAggregateId]
		);
	}
	return null;
}

/** EditPwuType — update a PWU Type's definition in place while its PWA is DRAFT. Only payload-present fields
 *  change; this is how the richer fields (completionRule, permittedChildTypeIds, requiredAssurancePolicyIds) are
 *  authored after the initial DefinePwuType. */
export const editPwuType: CommandHandler = (ctx, command, payload) => {
	const p = payload as EditPwuTypePayload;
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const guard = requireDraftOwner(ctx, command, loaded.state);
	if (guard) return guard;
	const newRevision = loaded.revision + 1;
	// Keep the flat edge list authoritative: an explicit permittedChildTypeIds wins; otherwise, when only the
	// cardinality rules are edited, re-derive the flat list from them so the two never drift.
	const childRules = p.permittedChildren as ReadonlyArray<{ typeId: string }> | undefined;
	let childTypeIdsPatch: Record<string, unknown> = {};
	if (p.permittedChildTypeIds !== undefined) {
		childTypeIdsPatch = { permittedChildTypeIds: p.permittedChildTypeIds };
	} else if (childRules !== undefined) {
		childTypeIdsPatch = { permittedChildTypeIds: childRules.map((r) => r.typeId) };
	}
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		...(p.name !== undefined ? { name: p.name } : {}),
		...(p.purpose !== undefined ? { purpose: p.purpose } : {}),
		...(p.pwuKind !== undefined ? { pwuKind: p.pwuKind } : {}),
		...(p.isRoot !== undefined ? { isRoot: p.isRoot } : {}),
		...(p.completionRule !== undefined ? { completionRule: p.completionRule } : {}),
		...childTypeIdsPatch,
		...(p.permittedChildren !== undefined ? { permittedChildren: p.permittedChildren } : {}),
		...(p.requiredInputs !== undefined ? { requiredInputs: p.requiredInputs } : {}),
		...(p.requiredOutputs !== undefined ? { requiredOutputs: p.requiredOutputs } : {}),
		...(p.requiredAssurancePolicyIds !== undefined
			? { requiredAssurancePolicyIds: p.requiredAssurancePolicyIds }
			: {})
	};
	// STD-2/STD-3/INV-1 (JAN-PRPWA-DS-001, DWP-02). executionBoundary is authoritative and defaulted onto every
	// edit (resolve: explicit patch → existing state → INTERNAL). The boundaryContract is DERIVED from the RESOLVED
	// boundary: on the INTERNAL branch it is STRIPPED — a DELEGATED→INTERNAL flip patch-merges, so a stale contract
	// carried forward by nextEnvelope would otherwise violate INV-1; on the DELEGATED branch an explicit contract in
	// the patch overrides, else the existing one carries forward. INV-1/STD-3 are then enforced on the merged state.
	const nextBoundary =
		p.executionBoundary ?? (loaded.state.executionBoundary as string | undefined) ?? 'INTERNAL';
	next.executionBoundary = nextBoundary;
	if (nextBoundary === 'DELEGATED_EXTERNAL') {
		if (p.boundaryContract !== undefined) next.boundaryContract = p.boundaryContract;
	} else {
		delete next.boundaryContract;
	}
	const boundaryViolation = checkBoundaryCoherence(ctx, command, next, id);
	if (boundaryViolation) return boundaryViolation;
	const event = makeEvent(ctx, command, {
		eventType: 'PwuTypeRedefined',
		aggregateType: PWU_TYPE,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	// Redefining a PWU Type materially edits the PWA's graph — raise the PWA's semanticVersion with it (§10.1 L1379).
	return withPwaVersionBump(ctx, command, String(loaded.state.pwaId), () =>
		commitState(ctx, command, {
			objectType: PWU_TYPE,
			aggregateId: id,
			expectedRevision: loaded.revision,
			newRevision,
			newSemanticVersion: loaded.semanticVersion,
			nextState: next,
			event
		})
	);
};

/** Ids of sibling PWU Types (same PWA, still live) that reference `pwuTypeId` as a permitted parent/child. */
function referencingSiblings(ctx: HandlerContext, pwaId: string, pwuTypeId: string): string[] {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === PWU_TYPE) ids.add(e.aggregateId);
	const refs: string[] = [];
	for (const sid of ids) {
		if (sid === pwuTypeId) continue;
		const s = ctx.store.loadObject(sid)?.state as
			| {
					pwaId?: string;
					status?: string;
					permittedChildTypeIds?: string[];
					permittedParentTypeIds?: string[];
			  }
			| undefined;
		if (s?.pwaId !== pwaId || s.status === 'REMOVED') continue;
		const children = Array.isArray(s.permittedChildTypeIds) ? s.permittedChildTypeIds : [];
		const parents = Array.isArray(s.permittedParentTypeIds) ? s.permittedParentTypeIds : [];
		if (children.includes(pwuTypeId) || parents.includes(pwuTypeId)) refs.push(sid);
	}
	return refs;
}

/** RemovePwuType — tombstone a PWU Type (status REMOVED) while its PWA is DRAFT; the query surface hides REMOVED
 *  types so they disappear from the Work Architecture. Referential integrity (no dangling permitted parent/child
 *  reference) is enforced HERE, in the domain — not just the UI. */
export const removePwuType: CommandHandler = (ctx, command) => {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const guard = requireDraftOwner(ctx, command, loaded.state);
	if (guard) return guard;
	// Referential integrity is now enforced HERE (the domain), not just the UI: don't strand a dangling reference.
	const refs = referencingSiblings(ctx, String(loaded.state.pwaId), id);
	if (refs.length > 0) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`Cannot remove PWU Type ${id}: ${refs.length} other type(s) reference it as a permitted parent/child; clear those references first`,
			[id]
		);
	}
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		status: 'REMOVED'
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwuTypeRemoved',
		aggregateType: PWU_TYPE,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: command.payload
	});
	// Removing a PWU Type materially edits the PWA's graph — raise the PWA's semanticVersion with it (§10.1 L1379).
	return withPwaVersionBump(ctx, command, String(loaded.state.pwaId), () =>
		commitState(ctx, command, {
			objectType: PWU_TYPE,
			aggregateId: id,
			expectedRevision: loaded.revision,
			newRevision,
			newSemanticVersion: loaded.semanticVersion,
			nextState: next,
			event
		})
	);
};

/** SubmitPwaForReview — DRAFT -> UNDER_REVIEW. */
export const submitPwaForReview: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'UNDER_REVIEW',
		eventType: 'PwaSubmittedForReview'
	});

// ── ValidatePwa gate: recursive-composition validation (guide §11.6 L1639) ───────────────────────────────────────
/** The live (non-REMOVED) PWU Types of `pwaId`, as the projection layer's graph nodes. */
function pwuTypeNodesOf(ctx: HandlerContext, pwaId: string): PwaGraphNode[] {
	const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === PWU_TYPE) ids.add(e.aggregateId);
	const nodes: PwaGraphNode[] = [];
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as Record<string, unknown> | undefined;
		if (s?.pwaId !== pwaId || s?.status === 'REMOVED') continue;
		nodes.push({
			id,
			name: String((s.name ?? id) as Stringifiable),
			pwuKind: String((s.pwuKind ?? '') as Stringifiable),
			isRoot: Boolean(s.isRoot),
			permittedChildTypeIds: arr(s.permittedChildTypeIds),
			requiredInputs: arr(s.requiredInputs),
			requiredOutputs: arr(s.requiredOutputs)
		});
	}
	return nodes;
}

/** The PWA's PWU-Type graph as the canonical projections export (the same shape the demo's Reasoning Review reads). */
function pwaGraphExport(
	ctx: HandlerContext,
	pwaId: string,
	state: Record<string, unknown>
): PwaGraphExport {
	return buildPwaGraphExport(
		{
			id: pwaId,
			name: String((state.name ?? pwaId) as Stringifiable),
			domain: String((state.domain ?? '') as Stringifiable),
			version: String((state.version ?? '') as Stringifiable),
			publicationStatus: String((state.publicationStatus ?? 'DRAFT') as Stringifiable)
		},
		pwuTypeNodesOf(ctx, pwaId)
	);
}

/**
 * ValidatePwa gate: the PWA's recursive composition must actually hold (guide §11.6 L1639 — "A Draft cannot become
 * `VALIDATED` or `PUBLISHED` unless recursive-composition and assurance-assignment validation proves: explicit
 * leaf/non-leaf treatment; coherent decomposition/recomposition; no missing/disallowed/cyclic child rules; …").
 *
 * The verdict is NOT computed here: `analyzePwaGraph` (rph-projections) already decides exactly these HARD
 * invariants — `single-root`, `acyclic-permits`, `connected` — and is unit-proven at `pwa-graph.test.ts`. It was
 * called by the demo's floor, the PWA route, and the Reasoning Review validator, but NOT by the handler that gates
 * the transition, so VALIDATED was a pure status label: the structural verdict was computed everywhere except the
 * one call site that could act on it. This routes the call site through it.
 *
 * NOT enforced here, deliberately — the assurance-assignment limb of L1639: see `pwa-validation-gate.test.ts`'s
 * skipped case. §11.7.4 makes the floor "🔒 de minimis floor · non-removable" on EVERY PWU Type (so it is never an
 * assignment that can go *missing*) and shows additive policies varying per type; L1639's "A missing policy
 * assignment blocks PWA validation/publication" is therefore relative to APPLICABILITY, and `requiredAssurancePolicyIds`
 * is a bare id list carrying none of §11.7.4 rail 1's "trigger/materiality rule, subject and Claim, required
 * Evidence, independence, protected boundary/transition". Deciding applicability without that is choosing a
 * convenient interpretation and encoding it as architecture — §0.3 forbids it. Un-skip when the declaration is
 * contracted (§16 item 9) and route through `evaluateApplicability`.
 */
function pwaCompositionGate(
	command: DomainCommand,
	state: Record<string, unknown>,
	ctx: HandlerContext
): CommandResult | null {
	const pwaId = command.targetAggregateId;
	const report = analyzePwaGraph(pwaGraphExport(ctx, pwaId, state));
	if (report.valid) return null;
	const failed = report.invariants.filter((i) => !i.ok);
	const detail = failed.map((i) => `${i.name}: ${i.detail}`).join('; ');
	return reject(
		command,
		'RPH_INVARIANT_VIOLATION',
		`ValidatePwa blocked: the PWU-Type composition of PWA ${pwaId} is not a valid recursive decomposition (${detail}). Fix the child rules so the graph has exactly one root, no composition cycle, and every type reachable from that root (§11.6).`,
		[pwaId]
	);
}

/** ValidatePwa — UNDER_REVIEW -> VALIDATED. Gated by recursive-composition validation (pwaCompositionGate). */
export const validatePwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'VALIDATED',
		eventType: 'PwaValidated',
		guard: (state, gctx) => pwaCompositionGate(command, state, gctx)
	});

// ── Protected-transition gate: the de minimis assurance floor (guide §8.4 step 4) ────────────────────────────────
/** PublishPwa gate: a PWA may not be PUBLISHED until its de minimis assurance floor is SATISFIED — schema/invariant +
 *  identity/provenance + an independent Reasoning Review, each a recorded ASSURANCE_ASSESSMENT completed SATISFIED
 *  against the PWA's CURRENT semanticVersion (guide §8.4; version-bound, so a stale floor cannot authorize a
 *  re-versioned PWA). The floor applies to an AI-produced PWA (createdBy AGENT/MODEL) AND to any PWA that HAS a
 *  recorded floor — if it was assessed (e.g. an agent shaped the graph over the human-created shell), it must pass. A
 *  purely human-authored, never-assessed PWA passes; an EFFECTIVE governance waiver overrides a block. The shared,
 *  plane-agnostic decision lives in floorGateBlock (reused by the execution-plane gate). */
function pwaFloorGate(
	command: DomainCommand,
	state: Record<string, unknown>,
	ctx: HandlerContext
): CommandResult | null {
	const createdBy = state.createdBy as { actorType?: string } | undefined;
	const aiProduced = createdBy ? AI_ACTOR_TYPES.has(String(createdBy.actorType)) : false;
	const pwaId = command.targetAggregateId;
	const version = Number(state.semanticVersion ?? 1);
	const blocking = floorGateBlock(ctx, pwaId, {
		aiProduced,
		subjectVersion: version,
		now: command.issuedAt
	});
	if (!blocking) return null;
	const detail = blocking.map((b) => `${b.policyId}=${b.disposition}`).join(', ');
	return reject(
		command,
		'RPH_INVARIANT_VIOLATION',
		`PublishPwa blocked: the de minimis assurance floor is not SATISFIED for PWA ${pwaId} at v${version} (${detail}). Record a satisfied floor (schema/invariant, identity/provenance, independent reasoning review) for the current version, or a governance waiver, before publishing.`,
		[pwaId]
	);
}

/** PublishPwa — VALIDATED -> PUBLISHED (the published version is immutable). Gated by the de minimis assurance
 *  floor for AI-produced PWAs (pwaFloorGate). */
export const publishPwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'PUBLISHED',
		eventType: 'PwaPublished',
		guard: (state, gctx) => pwaFloorGate(command, state, gctx),
		mutate: (base) => {
			const p = command.payload as PublishPwaPayload;
			return p.rootPwuTypeId ? { ...base, rootPwuTypeId: p.rootPwuTypeId } : base;
		}
	});

/** DeprecatePwa — PUBLISHED -> DEPRECATED. */
export const deprecatePwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'DEPRECATED',
		eventType: 'PwaDeprecated'
	});

/** RetirePwa — DEPRECATED -> RETIRED. */
export const retirePwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'RETIRED',
		eventType: 'PwaRetired'
	});

/** CreateUndertaking — instantiate a PUBLISHED PWA version as a concrete Undertaking (§42). The root PWU Instance
 * + children are then shaped in the Undertaking context via ProposePwu (undertakingId + pwuTypeId ownership). */
export const createUndertaking: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreateUndertakingPayload;
	const pwa = ctx.store.loadObject(p.pwaId)?.state as
		{ publicationStatus?: string; version?: string } | undefined;
	if (!pwa) {
		return reject(command, 'RPH_VALIDATION_SEMANTIC_FAILED', `PWA ${p.pwaId} does not exist`, [
			p.undertakingId
		]);
	}
	if (pwa.publicationStatus !== 'PUBLISHED') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`An Undertaking can only instantiate a PUBLISHED PWA (${p.pwaId} is ${String(pwa.publicationStatus)})`,
			[p.undertakingId]
		);
	}
	// RPH-CON-009: an Undertaking binds a specific PWA VERSION. The bound pwaVersion must be the PWA's actual
	// `version`, else the CON-009 gate (ProposePwu: a PWU Type's pwaVersion must equal the Undertaking's) would
	// reject correct types. Callers already pass `pwa.version` (seed + demo derive it); this makes the binding
	// fail-closed instead of trusting the caller's literal.
	if (p.pwaVersion !== pwa.version) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`CreateUndertaking: pwaVersion '${String(p.pwaVersion)}' does not match published PWA ${p.pwaId}'s version '${String(pwa.version)}' (RPH-CON-009 — an Undertaking binds a specific PWA version).`,
			[p.undertakingId]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, UNDERTAKING, p.undertakingId, {
			lifecycleStatus: 'ACTIVE',
			originType: 'HUMAN_DECISION',
			sourceObjectIds: [p.pwaId]
		}),
		name: p.name,
		description: p.description,
		pwaId: p.pwaId,
		pwaVersion: p.pwaVersion,
		instantiationProfile: p.instantiationProfile,
		objective: p.objective,
		intendedOutputProduct: p.intendedOutputProduct,
		status: 'ACTIVE'
	};
	return createObject(ctx, command, {
		objectType: UNDERTAKING,
		aggregateId: p.undertakingId,
		state,
		eventType: 'UndertakingCreated'
	});
};

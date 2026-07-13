// PWA-authoring handlers — the PWA Design context (RPH-DOC-010 §6, §11, §20). A Professional Work Architecture is
// authored as a draft, its PWU Types are defined, then it is submitted → validated → published; a PUBLISHED PWA
// version is immutable (changes create a successor). An Undertaking is instantiated from a PUBLISHED PWA version
// (§42): CreateUndertaking binds the exact PWA version; the root PWU Instance + children are then shaped in the
// Undertaking context (via ProposePwu carrying undertakingId + pwuTypeId — the CON-009 ownership binding).
import type {
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

const PWA = 'PROFESSIONAL_WORK_ARCHITECTURE';
const PWU_TYPE = 'PWU_TYPE';
const UNDERTAKING = 'UNDERTAKING';
const PWA_MACHINE = 'PWA.publicationStatus';

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

/** DefinePwuType — create a PWU Type under a DRAFT PWA (types are edited draft-only, §39). */
export const definePwuType: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefinePwuTypePayload;
	const pwa = ctx.store.loadObject(p.pwaId)?.state as { publicationStatus?: string } | undefined;
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
	const state: Record<string, unknown> = {
		...newEnvelope(command, PWU_TYPE, p.pwuTypeId, {
			lifecycleStatus: 'DRAFT',
			originType: 'HUMAN_DECISION',
			sourceObjectIds: [p.pwaId]
		}),
		pwaId: p.pwaId,
		pwuKind: p.pwuKind,
		name: p.name,
		purpose: p.purpose,
		isRoot: p.isRoot,
		permittedParentTypeIds: p.permittedParentTypeIds ?? [],
		permittedChildTypeIds: p.permittedChildTypeIds ?? [],
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: p.requiredAssurancePolicyIds ?? [],
		completionRule:
			p.completionRule ?? 'Execution succeeded AND required outputs exist AND assurance satisfied',
		status: 'DRAFT'
	};
	return createObject(ctx, command, {
		objectType: PWU_TYPE,
		aggregateId: p.pwuTypeId,
		state,
		eventType: 'PwuTypeDefined'
	});
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
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		...(p.name !== undefined ? { name: p.name } : {}),
		...(p.purpose !== undefined ? { purpose: p.purpose } : {}),
		...(p.pwuKind !== undefined ? { pwuKind: p.pwuKind } : {}),
		...(p.isRoot !== undefined ? { isRoot: p.isRoot } : {}),
		...(p.completionRule !== undefined ? { completionRule: p.completionRule } : {}),
		...(p.permittedChildTypeIds !== undefined
			? { permittedChildTypeIds: p.permittedChildTypeIds }
			: {}),
		...(p.requiredAssurancePolicyIds !== undefined
			? { requiredAssurancePolicyIds: p.requiredAssurancePolicyIds }
			: {})
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwuTypeRedefined',
		aggregateType: PWU_TYPE,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: PWU_TYPE,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
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
		if (!s || s.pwaId !== pwaId || s.status === 'REMOVED') continue;
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
	return commitState(ctx, command, {
		objectType: PWU_TYPE,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
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

/** ValidatePwa — UNDER_REVIEW -> VALIDATED. */
export const validatePwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'VALIDATED',
		eventType: 'PwaValidated'
	});

/** PublishPwa — VALIDATED -> PUBLISHED (the published version is immutable). */
export const publishPwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PWA,
		statusField: 'publicationStatus',
		machine: PWA_MACHINE,
		target: 'PUBLISHED',
		eventType: 'PwaPublished',
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

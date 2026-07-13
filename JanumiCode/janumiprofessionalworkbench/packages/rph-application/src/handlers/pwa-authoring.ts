// PWA-authoring handlers — the PWA Design context (RPH-DOC-010 §6, §11, §20). A Professional Work Architecture is
// authored as a draft, its PWU Types are defined, then it is submitted → validated → published; a PUBLISHED PWA
// version is immutable (changes create a successor). An Undertaking is instantiated from a PUBLISHED PWA version
// (§42): CreateUndertaking binds the exact PWA version; the root PWU Instance + children are then shaped in the
// Undertaking context (via ProposePwu carrying undertakingId + pwuTypeId — the CON-009 ownership binding).
import type {
	CreatePwaPayload,
	CreateUndertakingPayload,
	DefinePwuTypePayload,
	PublishPwaPayload
} from '@janumipwb/rph-contracts';
import { advanceStatus, createObject, newEnvelope, reject, type CommandHandler } from './kit.js';

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

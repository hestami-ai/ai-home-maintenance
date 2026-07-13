// seedWorkbench — stand up a fully-populated workbench in one call, entirely through live commands: author + publish
// the Product Realization PWA (its PWU Types = the §7 work areas), instantiate it as the Field Service Management
// Undertaking, and drive that Undertaking's Professional Work Graph. This gives the UI a real PWA (PWA Design
// context) AND a real Undertaking with a live graph (Undertaking context) to render — the RPH-DOC-010 separation,
// demonstrated end to end. It is deterministic: it drives commands; no fixture event log is replayed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { EngineHandle } from './engine.js';
import { driveReferenceUndertaking } from './reference-undertaking.js';

const ACTOR: ActorReference = {
	actorId: 'workbench',
	actorType: 'HUMAN',
	displayName: 'Workbench'
};

export const SEED_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5Z00';
export const SEED_PWA_VERSION = '1.3.0';
export const SEED_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69G5Z10';

/** The Product Realization PWA PWU Types (RPH-DOC-010 §7 work areas + a generic Architecture Concern type). */
const PWU_TYPES: ReadonlyArray<{
	id: string;
	kind: string;
	name: string;
	purpose: string;
	root?: boolean;
}> = [
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z20',
		kind: 'PRODUCT_REALIZATION',
		name: 'Product Realization',
		purpose: 'Root: structure product work from intent to authoritative baselines',
		root: true
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z30',
		kind: 'INTENT_DEFINITION',
		name: 'Intent & Product Definition',
		purpose: 'Originating intent, stakeholders, product boundary'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z40',
		kind: 'PRODUCT_BEHAVIOR',
		name: 'Product Behavior Definition',
		purpose: 'Actors, capabilities, journeys, requirements'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z50',
		kind: 'ARCHITECTURE',
		name: 'Architecture Definition',
		purpose: 'A coherent technical structure realizing approved behavior'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z60',
		kind: 'IMPLEMENTATION_PLANNING',
		name: 'Implementation Planning',
		purpose: 'Increments, decomposition, dependencies, test + migration planning'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z70',
		kind: 'PRODUCT_IMPLEMENTATION',
		name: 'Product Implementation',
		purpose: 'Realize the planned increments'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z80',
		kind: 'INTEGRATED_VALIDATION',
		name: 'Integrated Product Validation',
		purpose: 'Journey/requirement/architecture/fitness validation'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z90',
		kind: 'BASELINE_PROMOTION',
		name: 'Product Baseline Promotion',
		purpose: 'Evidence package, residual-risk + promotion decisions, authoritative baseline'
	},
	{
		id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZA0',
		kind: 'ARCHITECTURE_CONCERN',
		name: 'Architecture Concern',
		purpose: 'A generic architecture concern contributing to Architecture Definition'
	}
];

// Each sender uses a UNIQUE key prefix so idempotency keys never collide across logical seed operations (a
// collision would return a prior receipt as DUPLICATE and silently skip the command).
function sender(handle: EngineHandle, prefix: string) {
	let n = 0;
	return (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): void => {
		n += 1;
		const command: DomainCommand = {
			commandId: `${prefix}-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: '2026-07-12T00:00:00Z',
			issuedBy: ACTOR,
			correlationId: 'seed-workbench',
			idempotencyKey: `${prefix}-idem-${n}`,
			payload
		};
		const r = handle.dispatch(command);
		if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE') {
			throw new Error(
				`seedWorkbench failed at ${commandType} (${targetAggregateId}): ${r.status} ${JSON.stringify(r.error)}`
			);
		}
	};
}

/** Author + publish the Product Realization PWA (idempotent-ish: safe to call once per engine). */
export function authorProductRealizationPwa(handle: EngineHandle): void {
	const send = sender(handle, 'seedpwa');
	send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {
		pwaId: SEED_PWA,
		name: 'Product Realization',
		domain: 'software product',
		description:
			'Structure product-development work from originating intent through validated, authoritative product baselines.',
		version: SEED_PWA_VERSION
	});
	for (const t of PWU_TYPES) {
		send('DefinePwuType', 'PWU_TYPE', t.id, {
			pwuTypeId: t.id,
			pwaId: SEED_PWA,
			pwuKind: t.kind,
			name: t.name,
			purpose: t.purpose,
			isRoot: t.root ?? false
		});
	}
	send('SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {});
	send('ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {});
	send('PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {
		rootPwuTypeId: PWU_TYPES[0]!.id
	});
}

/** Author the PWA, instantiate the Field Service Management Undertaking under it, and drive its graph. */
export function seedWorkbench(handle: EngineHandle): void {
	authorProductRealizationPwa(handle);
	const send = sender(handle, 'sedund');
	send('CreateUndertaking', 'UNDERTAKING', SEED_UNDERTAKING, {
		undertakingId: SEED_UNDERTAKING,
		name: 'Field Service Management SaaS Undertaking',
		description:
			'Build a multi-tenant Field Service Management SaaS product for trades businesses.',
		pwaId: SEED_PWA,
		pwaVersion: SEED_PWA_VERSION,
		instantiationProfile: 'Standard Product Realization',
		objective: 'Enable trades businesses to manage customer work from request through invoice.',
		intendedOutputProduct: 'Field Service Management SaaS'
	});
	const pwuTypeByKind: Record<string, string> = {};
	for (const t of PWU_TYPES) pwuTypeByKind[t.kind] = t.id;
	driveReferenceUndertaking(handle, { undertakingId: SEED_UNDERTAKING, pwuTypeByKind });
}

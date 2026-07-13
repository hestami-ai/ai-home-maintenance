// Drives the PWA Design context LIVE: author a PWA (DRAFT) -> define PWU Types -> submit -> validate -> publish,
// then instantiate it as an Undertaking. Proves the guards: PWU Types can only be defined on a DRAFT PWA, and an
// Undertaking can only instantiate a PUBLISHED PWA. Also proves the CON-009 ownership binding on ProposePwu.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'des-1', actorType: 'HUMAN' as const, displayName: 'Designer' };
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P10';
const UND = 'und_01ARZ3NDEKTSV4RRFFQ69G5P30';

describe('PWA-authoring handlers (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function d(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	// Build a command WITHOUT dispatching it (for dispatchBatch).
	function mk(commandType: string, payload: unknown, id: string, type: string): DomainCommand {
		const n = ++seq;
		return {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
	}
	const pubStatus = () =>
		(store.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus;

	function createDraftPwa() {
		const r = d(
			'CreatePwa',
			{
				pwaId: PWA,
				name: 'Product Realization',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}
	function defineRoot() {
		d(
			'DefinePwuType',
			{
				pwuTypeId: ROOT_TYPE,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'Product Realization',
				purpose: 'root',
				isRoot: true
			},
			ROOT_TYPE,
			'PWU_TYPE'
		);
	}
	function publish() {
		d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		d('PublishPwa', { rootPwuTypeId: ROOT_TYPE }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
	}

	it('authors and publishes a PWA DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED', () => {
		createDraftPwa();
		expect(pubStatus()).toBe('DRAFT');
		defineRoot();
		expect((store.loadObject(ROOT_TYPE)?.state as { isRoot: boolean }).isRoot).toBe(true);
		publish();
		expect(pubStatus()).toBe('PUBLISHED');
		expect((store.loadObject(PWA)?.state as { rootPwuTypeId: string }).rootPwuTypeId).toBe(
			ROOT_TYPE
		);
	});

	it('rejects defining a PWU Type on a non-DRAFT PWA', () => {
		createDraftPwa();
		defineRoot();
		publish();
		const r = d(
			'DefinePwuType',
			{
				pwuTypeId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P40',
				pwaId: PWA,
				pwuKind: 'X',
				name: 'X',
				purpose: 'p',
				isRoot: false
			},
			'pwut_01ARZ3NDEKTSV4RRFFQ69G5P40',
			'PWU_TYPE'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('rejects instantiating an Undertaking from a non-PUBLISHED PWA, accepts from a PUBLISHED one', () => {
		createDraftPwa();
		defineRoot();
		const undPayload = {
			undertakingId: UND,
			name: 'FSM SaaS',
			description: 'd',
			pwaId: PWA,
			pwaVersion: '1.0.0',
			instantiationProfile: 'Standard',
			objective: 'o',
			intendedOutputProduct: 'Field Service Management SaaS'
		};
		const early = d('CreateUndertaking', undPayload, UND, 'UNDERTAKING');
		expect(early.status).toBe('REJECTED');
		expect(early.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		publish();
		const ok = d('CreateUndertaking', undPayload, UND, 'UNDERTAKING');
		expect(ok.status).toBe('ACCEPTED');
		expect((store.loadObject(UND)?.state as { status: string; pwaId: string }).pwaId).toBe(PWA);
	});

	it('DeletePwa discards a DRAFT PWA (tombstone) when it is not in use', () => {
		createDraftPwa();
		const r = d('DeletePwa', { pwaId: PWA }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pubStatus()).toBe('DISCARDED');
		// a second delete of an already-discarded PWA is rejected
		expect(d('DeletePwa', { pwaId: PWA }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'REJECTED'
		);
	});

	it('DeletePwa rejects a PWA that has Undertakings instantiated from it (in use)', () => {
		createDraftPwa();
		defineRoot();
		publish();
		d(
			'CreateUndertaking',
			{
				undertakingId: UND,
				name: 'U',
				description: 'd',
				pwaId: PWA,
				pwaVersion: '1.0.0',
				instantiationProfile: 'Standard',
				objective: 'o',
				intendedOutputProduct: 'p'
			},
			UND,
			'UNDERTAKING'
		);
		const r = d('DeletePwa', { pwaId: PWA }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pubStatus()).toBe('PUBLISHED');
	});

	it('binds a PWU Instance to its Undertaking + PWU Type (CON-009)', () => {
		createDraftPwa();
		defineRoot();
		publish();
		d(
			'CreateUndertaking',
			{
				undertakingId: UND,
				name: 'U',
				description: 'd',
				pwaId: PWA,
				pwaVersion: '1.0.0',
				instantiationProfile: 'Standard',
				objective: 'o',
				intendedOutputProduct: 'p'
			},
			UND,
			'UNDERTAKING'
		);
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5P50';
		const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5P60';
		d(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		const r = d(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'PRODUCT_REALIZATION',
				title: 'Root',
				description: 'd',
				intentId: INTENT,
				undertakingId: UND,
				pwuTypeId: ROOT_TYPE,
				isLocalExtension: false,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
		expect(r.status).toBe('ACCEPTED');
		const pwu = store.loadObject(PWU)?.state as { undertakingId?: string; pwuTypeId?: string };
		expect(pwu.undertakingId).toBe(UND);
		expect(pwu.pwuTypeId).toBe(ROOT_TYPE);
	});

	it('EditPwuType updates a DRAFT type in place (untouched fields preserved); EditPwa updates PWA metadata', () => {
		createDraftPwa();
		defineRoot();
		const e = d(
			'EditPwuType',
			{
				pwuTypeId: ROOT_TYPE,
				purpose: 'the revised root purpose',
				completionRule: 'custom completion rule',
				permittedChildTypeIds: ['pwut_child_x']
			},
			ROOT_TYPE,
			'PWU_TYPE'
		);
		expect(e.status, JSON.stringify(e.error)).toBe('ACCEPTED');
		const t = store.loadObject(ROOT_TYPE)?.state as {
			purpose: string;
			completionRule: string;
			permittedChildTypeIds: string[];
			name: string;
			isRoot: boolean;
		};
		expect(t.purpose).toBe('the revised root purpose');
		expect(t.completionRule).toBe('custom completion rule');
		expect(t.permittedChildTypeIds).toEqual(['pwut_child_x']);
		expect(t.name).toBe('Product Realization'); // untouched field preserved
		expect(t.isRoot).toBe(true); // untouched field preserved

		const ep = d(
			'EditPwa',
			{ pwaId: PWA, description: 'revised', domain: 'logistics' },
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(ep.status, JSON.stringify(ep.error)).toBe('ACCEPTED');
		const pwa = store.loadObject(PWA)?.state as {
			description: string;
			domain: string;
			name: string;
		};
		expect(pwa.description).toBe('revised');
		expect(pwa.domain).toBe('logistics');
		expect(pwa.name).toBe('Product Realization');
	});

	it('rejects EditPwuType and EditPwa once the PWA is PUBLISHED (immutable, §11)', () => {
		createDraftPwa();
		defineRoot();
		publish();
		const e = d('EditPwuType', { pwuTypeId: ROOT_TYPE, purpose: 'nope' }, ROOT_TYPE, 'PWU_TYPE');
		expect(e.status).toBe('REJECTED');
		expect(e.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		const ep = d('EditPwa', { pwaId: PWA, name: 'nope' }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(ep.status).toBe('REJECTED');
		expect(ep.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('RemovePwuType tombstones a type (status REMOVED) on a DRAFT PWA', () => {
		createDraftPwa();
		defineRoot();
		const EXTRA = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P70';
		d(
			'DefinePwuType',
			{ pwuTypeId: EXTRA, pwaId: PWA, pwuKind: 'X', name: 'X', purpose: 'p', isRoot: false },
			EXTRA,
			'PWU_TYPE'
		);
		const r = d('RemovePwuType', { pwuTypeId: EXTRA }, EXTRA, 'PWU_TYPE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((store.loadObject(EXTRA)?.state as { status: string }).status).toBe('REMOVED');
	});

	it('RemovePwuType rejects a type another references as a permitted child (referential integrity, domain-enforced)', () => {
		createDraftPwa();
		defineRoot();
		const CHILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5PA0';
		d(
			'DefinePwuType',
			{ pwuTypeId: CHILD, pwaId: PWA, pwuKind: 'C', name: 'C', purpose: 'p', isRoot: false },
			CHILD,
			'PWU_TYPE'
		);
		d(
			'EditPwuType',
			{ pwuTypeId: ROOT_TYPE, permittedChildTypeIds: [CHILD] },
			ROOT_TYPE,
			'PWU_TYPE'
		);
		const blocked = d('RemovePwuType', { pwuTypeId: CHILD }, CHILD, 'PWU_TYPE');
		expect(blocked.status).toBe('REJECTED');
		expect(blocked.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		// Clearing the reference lets the removal through.
		d('EditPwuType', { pwuTypeId: ROOT_TYPE, permittedChildTypeIds: [] }, ROOT_TYPE, 'PWU_TYPE');
		const ok = d('RemovePwuType', { pwuTypeId: CHILD }, CHILD, 'PWU_TYPE');
		expect(ok.status, JSON.stringify(ok.error)).toBe('ACCEPTED');
	});

	it('dispatchBatch is atomic — a mid-batch rejection rolls back the whole batch', () => {
		createDraftPwa();
		const batch = engine.dispatchBatch([
			mk('EditPwa', { pwaId: PWA, name: 'Batched Name' }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE'),
			mk(
				'EditPwuType',
				{ pwuTypeId: 'pwut_does_not_exist', name: 'x' },
				'pwut_does_not_exist',
				'PWU_TYPE'
			)
		]);
		expect(batch.ok).toBe(false);
		expect(batch.failedIndex).toBe(1);
		// The first command (EditPwa) must have ROLLED BACK — the name is unchanged.
		expect((store.loadObject(PWA)?.state as { name: string }).name).toBe('Product Realization');
	});

	it('dispatchBatch commits every command on success', () => {
		createDraftPwa();
		const A = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5PB0';
		const B = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5PC0';
		const batch = engine.dispatchBatch([
			mk(
				'DefinePwuType',
				{ pwuTypeId: A, pwaId: PWA, pwuKind: 'A', name: 'A', purpose: 'p', isRoot: true },
				A,
				'PWU_TYPE'
			),
			mk(
				'DefinePwuType',
				{ pwuTypeId: B, pwaId: PWA, pwuKind: 'B', name: 'B', purpose: 'p', isRoot: false },
				B,
				'PWU_TYPE'
			)
		]);
		expect(batch.ok, JSON.stringify(batch.results.map((r) => r.error))).toBe(true);
		expect(store.loadObject(A)).toBeDefined();
		expect(store.loadObject(B)).toBeDefined();
	});
});

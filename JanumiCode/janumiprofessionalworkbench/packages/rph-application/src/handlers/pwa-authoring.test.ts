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
});

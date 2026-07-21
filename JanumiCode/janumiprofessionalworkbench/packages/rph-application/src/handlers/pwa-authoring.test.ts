// Drives the PWA Design context LIVE: author a PWA (DRAFT) -> define PWU Types -> submit -> validate -> publish,
// then instantiate it as an Undertaking. Proves the guards: PWU Types can only be defined on a DRAFT PWA, and an
// Undertaking can only instantiate a PUBLISHED PWA. Also proves the CON-009 ownership binding on ProposePwu.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedFloorPolicies } from './__tests__/floor-fixtures.js';
import type { AssuranceDispositionRecommendation } from '@janumipwb/rph-contracts';

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

	it('AppendConversationEntries creates then extends the durable authoring transcript', () => {
		const CONV = 'conv_01ARZ3NDEKTSV4RRFFQ69G5P70';
		const r1 = d(
			'AppendConversationEntries',
			{
				conversationId: CONV,
				pwaId: PWA,
				entries: [{ role: 'USER', kind: 'message', text: 'build it' }]
			},
			CONV,
			'AUTHORING_CONVERSATION'
		);
		expect(r1.status, JSON.stringify(r1.error)).toBe('ACCEPTED');
		let c = store.loadObject(CONV)?.state as { pwaId: string; entries: unknown[] };
		expect(c.pwaId).toBe(PWA);
		expect(c.entries).toHaveLength(1);
		// a second append EXTENDS the same conversation (event-sourced transcript).
		const r2 = d(
			'AppendConversationEntries',
			{
				conversationId: CONV,
				pwaId: PWA,
				entries: [
					{ role: 'AGENT', kind: 'message', text: 'done' },
					{ role: 'AGENT', kind: 'tool_result', text: 'define_pwu_type: ok', success: true }
				]
			},
			CONV,
			'AUTHORING_CONVERSATION'
		);
		expect(r2.status).toBe('ACCEPTED');
		c = store.loadObject(CONV)?.state as { pwaId: string; entries: unknown[] };
		expect(c.entries).toHaveLength(3);
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

	it('RPH-CON-009: a PWU Type carries the PWA VERSION (derived), and CreateUndertaking rejects a mismatched version', () => {
		createDraftPwa(); // version 1.0.0
		defineRoot();
		// A type's identity binds to a VERSIONED PWA — pwaVersion is derived from the owning PWA, not a bare pwaId.
		expect((store.loadObject(ROOT_TYPE)?.state as { pwaVersion?: string }).pwaVersion).toBe('1.0.0');
		publish();
		// The Undertaking's bound pwaVersion must be the PWA's actual version (fail-closed, not caller-trusted).
		const bad = d(
			'CreateUndertaking',
			{
				undertakingId: UND,
				name: 'U',
				description: 'd',
				pwaId: PWA,
				pwaVersion: '9.9.9',
				instantiationProfile: 'Standard',
				objective: 'o',
				intendedOutputProduct: 'p'
			},
			UND,
			'UNDERTAKING'
		);
		expect(bad.status).toBe('REJECTED');
	});

	it('RPH-CON-009 version precision: a type defined against an OLD PWA version cannot realize into a NEW-version Undertaking', () => {
		createDraftPwa(); // version 1.0.0
		defineRoot(); // ROOT_TYPE.pwaVersion = 1.0.0 (derived)
		// The PWA evolves to 2.0.0 while still DRAFT; ROOT_TYPE keeps its 1.0.0 binding (a now-stale type).
		d('EditPwa', { pwaId: PWA, version: '2.0.0' }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		publish();
		// The Undertaking binds the PUBLISHED 2.0.0 version.
		expect(
			d(
				'CreateUndertaking',
				{
					undertakingId: UND,
					name: 'U',
					description: 'd',
					pwaId: PWA,
					pwaVersion: '2.0.0',
					instantiationProfile: 'Standard',
					objective: 'o',
					intendedOutputProduct: 'p'
				},
				UND,
				'UNDERTAKING'
			).status
		).toBe('ACCEPTED');
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5P51';
		const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5P61';
		d(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		// The stale 1.0.0 type (same pwaId) must NOT resolve into the 2.0.0 Undertaking — the version gate fires.
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
		expect(r.status).toBe('REJECTED');
	});

	it('CON-009 is ENFORCED: rejects unknown Undertaking, non-resolving type, local-claims-type, and kind-alone', () => {
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
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5P70';
		d(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		const propose = (pwuId: string, over: Record<string, unknown>) =>
			d(
				'ProposePwu',
				{
					pwuId,
					pwuKind: 'PRODUCT_REALIZATION',
					title: 'T',
					description: 'd',
					intentId: INTENT,
					boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
					obligationIds: [],
					constraintIds: [],
					assumptionIds: [],
					expectedOutputs: [],
					assurancePolicyIds: [],
					riskProfile: {
						consequence: 'LOW',
						uncertainty: 'LOW',
						irreversibility: 'LOW',
						securitySensitivity: 'LOW',
						regulatoryExposure: 'NONE'
					},
					...over
				},
				pwuId,
				'PROFESSIONAL_WORK_UNIT'
			);
		// 1. undertakingId names no Undertaking.
		expect(
			propose('pwu_01ARZ3NDEKTSV4RRFFQ69G5P71', {
				undertakingId: 'und_does_not_exist',
				pwuTypeId: ROOT_TYPE,
				isLocalExtension: false
			}).status
		).toBe('REJECTED');
		// 2. non-local pwuTypeId does not resolve to a PWU Type in the bound PWA.
		expect(
			propose('pwu_01ARZ3NDEKTSV4RRFFQ69G5P72', {
				undertakingId: UND,
				pwuTypeId: 'pwut_not_in_this_pwa',
				isLocalExtension: false
			}).status
		).toBe('REJECTED');
		// 3. a local extension must not claim a published pwuTypeId.
		expect(
			propose('pwu_01ARZ3NDEKTSV4RRFFQ69G5P73', {
				undertakingId: UND,
				pwuTypeId: ROOT_TYPE,
				isLocalExtension: true
			}).status
		).toBe('REJECTED');
		// 4. pwuKind alone is insufficient — a non-local instance names no type.
		expect(
			propose('pwu_01ARZ3NDEKTSV4RRFFQ69G5P74', {
				undertakingId: UND,
				isLocalExtension: false
			}).status
		).toBe('REJECTED');
		// Control: a valid Undertaking-local extension (isLocalExtension=true, no type) IS accepted.
		expect(
			propose('pwu_01ARZ3NDEKTSV4RRFFQ69G5P75', { undertakingId: UND, isLocalExtension: true })
				.status
		).toBe('ACCEPTED');
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

describe('PublishPwa protected-transition gate — the de minimis assurance floor (§8.4)', () => {
	const AGENT: ActorReference = {
		actorId: 'agent-1',
		actorType: 'AGENT',
		displayName: 'Authoring Agent'
	};
	const SVC: ActorReference = {
		actorId: 'assurance',
		actorType: 'SERVICE',
		displayName: 'Assurance'
	};
	const AI_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5R00';
	const AI_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R10';
	const SCHEMA = 'floor.schema-invariant';
	const IDENTITY = 'floor.identity-provenance';
	const REVIEW = 'floor.reasoning-review';

	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	let asmtSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		seedFloorPolicies(engine); // the floor assessments below cite floor.* policies — now they must exist
	});

	function d(
		actor: ActorReference,
		commandType: string,
		payload: unknown,
		id: string,
		type: string
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'gate',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const pub = () =>
		(store.loadObject(AI_PWA)?.state as { publicationStatus: string }).publicationStatus;

	// Author an AGENT-produced PWA and drive it to VALIDATED (the state PublishPwa transitions from).
	function authorValidatedAiPwa() {
		d(
			AGENT,
			'CreatePwa',
			{
				pwaId: AI_PWA,
				name: 'Agent-authored',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			AI_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		d(
			AGENT,
			'DefinePwuType',
			{
				pwuTypeId: AI_ROOT,
				pwaId: AI_PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			},
			AI_ROOT,
			'PWU_TYPE'
		);
		d(AGENT, 'SubmitPwaForReview', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		d(AGENT, 'ValidatePwa', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
	}

	// A ULID-format id (prefix_<26 digits>; digits are valid Crockford base32).
	const ulid = (prefix: string) => `${prefix}_${String(++asmtSeq).padStart(26, '0')}`;

	/** The PWA's CURRENT semanticVersion, read from engine state — never assumed. Authoring commands that materially
	 *  edit the graph now raise it (§10.1 L1379), so "1" is no longer a safe literal for an authored PWA. */
	const pwaVersion = () =>
		Number((store.loadObject(AI_PWA)?.state as { semanticVersion?: number }).semanticVersion ?? 1);

	// Record a floor assessment per policy at the given disposition (as the Assurance Service), against `version` —
	// defaulting to whatever version the PWA is ACTUALLY at, i.e. the assurance run reviews the graph as it stands.
	// Pass a different value to exercise version-binding.
	function recordFloor(
		dispositions: Record<string, AssuranceDispositionRecommendation>,
		version = pwaVersion()
	): Record<string, string> {
		const assessmentIds: Record<string, string> = {};
		for (const [policyId, disposition] of Object.entries(dispositions)) {
			const assessmentId = ulid('asmt');
			assessmentIds[policyId] = assessmentId;
			d(
				SVC,
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [AI_PWA],
					subjectSemanticVersions: { [AI_PWA]: version },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			d(
				SVC,
				'CompleteAssuranceAssessment',
				{
					validatorResult: floorValidatorResult({
						assessmentId,
						policyId,
						subjectId: AI_PWA,
						subjectSemanticVersion: version,
						disposition
					})
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
		}
		return assessmentIds;
	}

	/** Record an OPEN finding against an assessment — the thing a waiver must name to discharge (DOC-004 §12.2). */
	function recordFinding(assessmentId: string, findingCode: string): string {
		const observationId = ulid('obs');
		d(
			SVC,
			'RecordAssuranceObservation',
			{
				assessmentId,
				observationType: 'FINDING',
				findingCode,
				severity: 'BLOCKING',
				statement: `${findingCode} not satisfied.`
			},
			observationId,
			'ASSURANCE_OBSERVATION'
		);
		return observationId;
	}

	const publish = () =>
		d(AGENT, 'PublishPwa', { rootPwuTypeId: AI_ROOT }, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

	it('blocks publishing an AI-produced PWA with no recorded floor', () => {
		authorValidatedAiPwa();
		const r = publish();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pub()).toBe('VALIDATED');
	});

	it('permits publish once all three floor policies are recorded SATISFIED', () => {
		authorValidatedAiPwa();
		recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'SATISFIED' });
		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
	});

	it('keeps publish blocked when the Reasoning Review floor is REJECTED', () => {
		authorValidatedAiPwa();
		recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'REJECTED' });
		const r = publish();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pub()).toBe('VALIDATED');
	});

	it('a partial floor (missing Reasoning Review) blocks publish', () => {
		authorValidatedAiPwa();
		recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED' });
		const r = publish();
		expect(r.status).toBe('REJECTED');
		expect(pub()).toBe('VALIDATED');
	});

	it('a floor recorded against a STALE PWA version does not authorize publish (version-binding)', () => {
		authorValidatedAiPwa();
		// All three policies SATISFIED, but recorded against the version BEFORE the one the PWA is actually at — a
		// stale floor must not count. The staleness is derived from live state, not a literal: this previously read
		// "recorded against v2 while the PWA is v1", which pinned BOTH sides to constants and (since a floor ahead of
		// its subject is not stale at all) inverted the drift it names. Now the PWA really is a version past this one.
		recordFloor(
			{ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'SATISFIED' },
			pwaVersion() - 1
		);
		const r = publish();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pub()).toBe('VALIDATED');
	});

	const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
	const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5R20';

	/** Request + grant an EFFECTIVE waiver naming an exact (policy, criterion) per DOC-004 §12.2. */
	function grantWaiver(over: { policyId: string; criterionId: string; findingIds: string[] }) {
		const req = d(
			HUMAN,
			'RequestWaiver',
			{
				subjectObjectIds: [AI_PWA],
				scope: 'de minimis assurance floor',
				rationale: 'Accepted residual risk for the pilot.',
				duration: 'until superseded',
				affectedObjectIds: [AI_PWA],
				waivedPolicyId: over.policyId,
				waivedCriterionId: over.criterionId,
				waivedFindingIds: over.findingIds,
				compensatingControls: ['Manual architecture review before pilot rollout.'],
				reviewConditions: ['Revisit at the next PWA version.']
			},
			WAIVER,
			'DECISION'
		);
		expect(req.status, JSON.stringify(req.error)).toBe('ACCEPTED');
		const grant = d(
			HUMAN,
			'GrantWaiver',
			{ waiverDecisionId: WAIVER, effectiveAt: TS, duration: 'until superseded' },
			WAIVER,
			'DECISION'
		);
		expect(grant.status, JSON.stringify(grant.error)).toBe('ACCEPTED');
	}

	/**
	 * §8.15 permits a governance waiver over the floor. It is honored ONLY when it names the exact policy +
	 * criterion + object + version DOC-004 §12.2 requires — routed through rph-domain's waiverCovers /
	 * waiverStillDischarges, which were written and unit-proven long before anything could call them.
	 */
	it('an EFFECTIVE waiver naming the exact failed criterion discharges that policy and lets the PWA publish', () => {
		authorValidatedAiPwa();
		const ids = recordFloor({
			[SCHEMA]: 'SATISFIED',
			[IDENTITY]: 'SATISFIED',
			[REVIEW]: 'REJECTED'
		});
		const findingId = recordFinding(ids[REVIEW]!, 'RR-04-completeness-shortcut');
		expect(publish().status).toBe('REJECTED');

		grantWaiver({
			policyId: REVIEW,
			criterionId: 'RR-04-completeness-shortcut',
			findingIds: [findingId]
		});
		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
	});

	/**
	 * The discriminator — and the CRITICAL defect this whole contract exists to kill. RPH-GOV-005: a waiver "does
	 * not bleed to another criterion, another object, or another version." A waiver naming a DIFFERENT criterion
	 * of the same policy must leave the floor blocking. Before the WaiverDetail contract, ANY effective waiver
	 * naming the subject discharged the ENTIRE floor — a waiver for a naming-convention nit silently discharged a
	 * REJECTED independent Reasoning Review.
	 */
	it('a waiver naming a DIFFERENT criterion does NOT discharge the failed one (RPH-GOV-005: no bleeding)', () => {
		authorValidatedAiPwa();
		const ids = recordFloor({
			[SCHEMA]: 'SATISFIED',
			[IDENTITY]: 'SATISFIED',
			[REVIEW]: 'REJECTED'
		});
		const findingId = recordFinding(ids[REVIEW]!, 'RR-04-completeness-shortcut');
		expect(publish().status).toBe('REJECTED');

		// Waives RR-01, but RR-04 is what actually failed.
		grantWaiver({
			policyId: REVIEW,
			criterionId: 'RR-01-no-problem-substitution',
			findingIds: [findingId]
		});
		const r = publish();
		expect(r.status).toBe('REJECTED');
		expect(pub()).toBe('VALIDATED');
	});
});

// JAN-PRPWA-DS-001 STD-2/STD-3/INV-1 (DWP-02): the execution-boundary coherence invariant is enforced at the
// domain WRITE boundary (checkBoundaryCoherence), against the merged next state, for both DefinePwuType and the
// patch-merging EditPwuType. The engine is the authoritative gate (C-5); these prove it directly.
describe('PWU-Type execution boundary — INV-1 / STD-2 / STD-3 (JAN-PRPWA-DS-001, DWP-02)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	const B_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5B00';
	const B_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5B10';
	const CONTRACT = {
		counterpartyLabel: 'Contract Lab — Hematology',
		attestedAssurancePolicyIds: [] as string[]
	};

	function dispatch(commandType: string, payload: unknown, id: string, type: string) {
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
	const defineType = (id: string, extra: Record<string, unknown>) =>
		dispatch(
			'DefinePwuType',
			{ pwuTypeId: id, pwaId: B_PWA, pwuKind: 'X', name: 'X', purpose: 'p', isRoot: false, ...extra },
			id,
			'PWU_TYPE'
		);
	const editType = (id: string, patch: Record<string, unknown>) =>
		dispatch('EditPwuType', { pwuTypeId: id, ...patch }, id, 'PWU_TYPE');
	const load = (id: string) => store.loadObject(id)?.state as Record<string, unknown> | undefined;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		const r = dispatch(
			'CreatePwa',
			{ pwaId: B_PWA, name: 'Boundary', description: 'd', domain: 'healthcare', version: '1.0.0' },
			B_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('rejects a DELEGATED_EXTERNAL type with no boundaryContract (STD-3)', () => {
		const r = defineType(B_ROOT, { executionBoundary: 'DELEGATED_EXTERNAL' });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('rejects a DELEGATED_EXTERNAL type that declares permitted children (INV-1: terminal)', () => {
		const r = defineType(B_ROOT, {
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: CONTRACT,
			permittedChildTypeIds: ['pwut_child']
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('rejects an INTERNAL type carrying a boundaryContract (coherence)', () => {
		const r = defineType(B_ROOT, { boundaryContract: CONTRACT });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('rejects a boundaryContract with an empty counterpartyLabel (STD-3 non-empty, handler-enforced)', () => {
		const r = defineType(B_ROOT, {
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: { counterpartyLabel: '   ', attestedAssurancePolicyIds: [] }
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('rejects an out-of-enum executionBoundary at the command-bus gate (VALIDATION_FAILED)', () => {
		const r = defineType(B_ROOT, { executionBoundary: 'OFFSHORE' });
		expect(r.status).toBe('VALIDATION_FAILED');
	});

	it('accepts a well-formed DELEGATED_EXTERNAL leaf and persists both fields (round-trip)', () => {
		const r = defineType(B_ROOT, {
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: {
				counterpartyLabel: 'Contract Lab',
				attestedAssurancePolicyIds: [],
				applicabilityNote: 'STAT only'
			}
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const s = load(B_ROOT)!;
		expect(s.executionBoundary).toBe('DELEGATED_EXTERNAL');
		expect(s.boundaryContract).toMatchObject({ counterpartyLabel: 'Contract Lab' });
	});

	it('defaults executionBoundary to INTERNAL when absent, and a later unrelated edit preserves it', () => {
		expect(defineType(B_ROOT, {}).status).toBe('ACCEPTED');
		expect(load(B_ROOT)!.executionBoundary).toBe('INTERNAL');
		expect(load(B_ROOT)!.boundaryContract).toBeUndefined();
		expect(editType(B_ROOT, { purpose: 'revised' }).status).toBe('ACCEPTED');
		expect(load(B_ROOT)!.executionBoundary).toBe('INTERNAL');
		expect(load(B_ROOT)!.boundaryContract).toBeUndefined();
	});

	it('edit DELEGATED_EXTERNAL → INTERNAL clears the contract and succeeds', () => {
		expect(
			defineType(B_ROOT, { executionBoundary: 'DELEGATED_EXTERNAL', boundaryContract: CONTRACT })
				.status
		).toBe('ACCEPTED');
		const r = editType(B_ROOT, { executionBoundary: 'INTERNAL' });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const s = load(B_ROOT)!;
		expect(s.executionBoundary).toBe('INTERNAL');
		expect(s.boundaryContract).toBeUndefined();
	});

	it('edit flipping INTERNAL → DELEGATED_EXTERNAL while children remain is rejected (INV-1)', () => {
		expect(defineType(B_ROOT, { permittedChildTypeIds: ['pwut_child'] }).status).toBe('ACCEPTED');
		const r = editType(B_ROOT, {
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: CONTRACT
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('edit INTERNAL → DELEGATED_EXTERNAL succeeds when the children are cleared in the same edit', () => {
		expect(defineType(B_ROOT, { permittedChildTypeIds: ['pwut_child'] }).status).toBe('ACCEPTED');
		const r = editType(B_ROOT, {
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: CONTRACT,
			permittedChildTypeIds: []
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(load(B_ROOT)!.executionBoundary).toBe('DELEGATED_EXTERNAL');
	});

	it('an unrelated edit of a DELEGATED_EXTERNAL type retains its boundaryContract (carried forward)', () => {
		expect(
			defineType(B_ROOT, { executionBoundary: 'DELEGATED_EXTERNAL', boundaryContract: CONTRACT })
				.status
		).toBe('ACCEPTED');
		expect(editType(B_ROOT, { purpose: 'clarified scope' }).status).toBe('ACCEPTED');
		const s = load(B_ROOT)!;
		expect(s.executionBoundary).toBe('DELEGATED_EXTERNAL');
		expect(s.boundaryContract).toMatchObject({ counterpartyLabel: 'Contract Lab — Hematology' });
	});
});

// F-7 closure (JAN-PRPWA-DR-001 §15 Option 3): the assurance-policy-reference gate is now enforced at the DOMAIN
// write boundary, so a DIRECT command (bypassing the broker + SvelteKit-action friendly pre-checks) can no longer
// persist a reference to a locked-floor / DRAFT / SUSPENDED / missing policy — for requiredAssurancePolicyIds OR a
// delegated node's boundaryContract.attestedAssurancePolicyIds. Existing declarations are retained.
describe('PWU-Type assurance-policy references — handler write-boundary gate (F-7 closure)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	const F_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5F00';
	const F_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5F10';
	const ACTIVE_POL = 'pol_f7_active';
	const DRAFT_POL = 'pol_f7_draft';
	const FLOOR_POL = 'floor.reasoning-review';

	function dispatch(commandType: string, payload: unknown, id: string, type: string) {
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
	function createPolicy(id: string, activate: boolean) {
		const r = dispatch(
			'CreateAssurancePolicy',
			{
				policyId: id,
				version: '1.0.0',
				name: id,
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['CORRECTNESS'],
				criteria: [
					{
						id: 'C-01',
						name: 'n',
						description: 's',
						criterionType: 'BOOLEAN',
						evaluationMethod: 'MODEL_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'BLOCKING',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'reviewer',
				independenceRequirement: 'DIFFERENT_AGENT',
				findingDefinitions: [],
				permittedControlActions: ['CLARIFY']
			},
			id,
			'ASSURANCE_POLICY'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		if (activate)
			expect(
				dispatch('ActivateAssurancePolicy', { policyId: id }, id, 'ASSURANCE_POLICY').status
			).toBe('ACCEPTED');
	}
	const defineType = (id: string, extra: Record<string, unknown>) =>
		dispatch(
			'DefinePwuType',
			{ pwuTypeId: id, pwaId: F_PWA, pwuKind: 'X', name: 'X', purpose: 'p', isRoot: false, ...extra },
			id,
			'PWU_TYPE'
		);
	const delegatedTo = (ids: string[]) => ({
		executionBoundary: 'DELEGATED_EXTERNAL',
		boundaryContract: { counterpartyLabel: 'Lab', attestedAssurancePolicyIds: ids }
	});
	const load = (id: string) => store.loadObject(id)?.state as Record<string, unknown> | undefined;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		seedFloorPolicies(engine);
		createPolicy(ACTIVE_POL, true);
		createPolicy(DRAFT_POL, false);
		const r = dispatch(
			'CreatePwa',
			{ pwaId: F_PWA, name: 'F7', description: 'd', domain: 'software', version: '1.0.0' },
			F_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('rejects a DIRECT command that references a locked floor policy (bypassing broker/UI)', () => {
		const r = defineType(F_TYPE, { requiredAssurancePolicyIds: [FLOOR_POL] });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(load(F_TYPE)).toBeUndefined(); // nothing persisted
	});

	it('rejects a DIRECT command that references a DRAFT policy', () => {
		const r = defineType(F_TYPE, { requiredAssurancePolicyIds: [DRAFT_POL] });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('rejects a DIRECT command that references a missing policy', () => {
		const r = defineType(F_TYPE, { requiredAssurancePolicyIds: ['pol_does_not_exist'] });
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
	});

	it('accepts an ACTIVE non-floor policy reference and persists it', () => {
		expect(defineType(F_TYPE, { requiredAssurancePolicyIds: [ACTIVE_POL] }).status).toBe('ACCEPTED');
		expect(load(F_TYPE)!.requiredAssurancePolicyIds).toEqual([ACTIVE_POL]);
	});

	it('applies the same gate to a delegated node’s attestedAssurancePolicyIds (R-10)', () => {
		expect(defineType('pwut_01ARZ3NDEKTSV4RRFFQ69G5FA1', delegatedTo([DRAFT_POL])).status).toBe(
			'REJECTED'
		);
		expect(defineType('pwut_01ARZ3NDEKTSV4RRFFQ69G5FA2', delegatedTo([FLOOR_POL])).status).toBe(
			'REJECTED'
		);
		const cr = defineType('pwut_01ARZ3NDEKTSV4RRFFQ69G5FA3', delegatedTo([ACTIVE_POL]));
		expect(cr.status, JSON.stringify(cr.error)).toBe('ACCEPTED');
	});

	it('retains a since-suspended reference on an unrelated edit, but rejects newly adding a non-ACTIVE one', () => {
		expect(defineType(F_TYPE, { requiredAssurancePolicyIds: [ACTIVE_POL] }).status).toBe('ACCEPTED');
		expect(
			dispatch('SuspendAssurancePolicy', { policyId: ACTIVE_POL }, ACTIVE_POL, 'ASSURANCE_POLICY')
				.status
		).toBe('ACCEPTED');
		// The reference is now to a SUSPENDED policy — an unrelated edit must retain it, not re-reject.
		const e = dispatch('EditPwuType', { pwuTypeId: F_TYPE, purpose: 'clarified' }, F_TYPE, 'PWU_TYPE');
		expect(e.status, JSON.stringify(e.error)).toBe('ACCEPTED');
		expect(load(F_TYPE)!.requiredAssurancePolicyIds).toEqual([ACTIVE_POL]);
		// But NEWLY adding a non-ACTIVE policy on an edit is still rejected.
		const e2 = dispatch(
			'EditPwuType',
			{ pwuTypeId: F_TYPE, requiredAssurancePolicyIds: [ACTIVE_POL, DRAFT_POL] },
			F_TYPE,
			'PWU_TYPE'
		);
		expect(e2.status).toBe('REJECTED');
	});
});

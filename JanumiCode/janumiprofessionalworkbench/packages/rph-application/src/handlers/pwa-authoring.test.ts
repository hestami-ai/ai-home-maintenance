// Drives the PWA Design context LIVE: author a PWA (DRAFT) -> define PWU Types -> submit -> validate -> publish,
// then instantiate it as an Undertaking. Proves the guards: PWU Types can only be defined on a DRAFT PWA, and an
// Undertaking can only instantiate a PUBLISHED PWA. Also proves the CON-009 ownership binding on ProposePwu.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator, testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedFloorPolicies, seedPolicy } from './__tests__/floor-fixtures.js';
import {
	BINDINGS,
	ProfessionalWorkArchitectureSchema,
	PwaCreatedPayloadSchema,
	PwuTypeRedefinedPayloadSchema
} from '@janumipwb/rph-contracts';
import type { AssuranceDispositionRecommendation } from '@janumipwb/rph-contracts';

// Three of the four suites below act as ONE human and never assert who that is, so they take the shared
// operator credential. The floor-gate suite is the exception — WHO authored the PWA is the variable its whole
// rule turns on — and it registers its own three-principal directory.
const TS = '2026-07-12T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P10';
const UND = 'und_01ARZ3NDEKTSV4RRFFQ69G5P30';

describe('PWA-authoring handlers (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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
		expect((store.loadObject(ROOT_TYPE)?.state as { pwaVersion?: string }).pwaVersion).toBe(
			'1.0.0'
		);
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
	// Declared here rather than beside the waiver helpers that use them: the directory below has to name every
	// principal this suite acts as, and a `const` referenced before its initializer is a TDZ error.
	const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
	const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5R20';
	// THE ACTOR IS THE VARIABLE UNDER TEST HERE. §8.4's floor applies to an AI-produced PWA — `createdBy`
	// AGENT/MODEL — so the agent that authors, the service that assesses it, and the human that waives must each
	// dispatch through their OWN session. One shared credential would make every PWA human-authored and the
	// gate would never fire; the suite would pass by never arranging the thing it names.
	const DIR = testDirectory([
		{ ...AGENT, tenantId: 't', organizationId: 'o' },
		{ ...SVC, tenantId: 't', organizationId: 'o' },
		{ ...HUMAN, tenantId: 't', organizationId: 'o' }
	]);
	const AI_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5R00';
	const AI_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R10';
	const SCHEMA = 'floor.schema-invariant';
	const IDENTITY = 'floor.identity-provenance';
	const REVIEW = 'floor.reasoning-review';

	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	let asmtSeq = 0;

	/** The dispatching session for an actor — the identity is now the session, never a command field. */
	const as = (a: ActorReference) => engine.as(DIR.credentialFor(a.actorId));

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({
			authenticate: DIR.authenticate,
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		});
		// Seeded by the human: policy creation is workbench setup, not part of the AI-authored graph under test.
		seedFloorPolicies(as(HUMAN)); // the floor assessments below cite floor.* policies — now they must exist
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
			correlationId: 'gate',
			idempotencyKey: `k-${n}`,
			payload
		};
		return as(actor).dispatch(command);
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
			// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
			// assessment in READY, so it must be BEGUN before it can be assessed or completed.
			d(SVC, 'BeginAssuranceAssessment', {}, assessmentId, 'ASSURANCE_ASSESSMENT');
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

	// DWP-01b: the precondition (fromStates('VALIDATED')) now runs BEFORE the floor guard. DELIBERATE
	// refusal-code change, enumerated in the roadmap: a wrong-state publish whose floor is ALSO unsatisfied
	// (here: a DRAFT that was never validated and has no floor) refuses on the state fact, where the floor
	// guard previously fired first with RPH_INVARIANT_VIOLATION. The floor gate itself is untouched — every
	// publish from VALIDATED still refuses on the floor, as the tests above prove.
	it('publishing a DRAFT (never-validated) AI PWA refuses on state, not on the floor', () => {
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
		const r = publish();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	it('permits publish once all three floor policies are recorded SATISFIED', () => {
		authorValidatedAiPwa();
		recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'SATISFIED' });
		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
	});

	// JAN-CMDPRE DWP-01b kill coverage: publishPwa's fromStates('VALIDATED'). Once PUBLISHED, a re-publish would
	// rewrite rootPwuTypeId (a field editPwa declares immutable) and bypass the single-root gate that runs only on
	// ValidatePwa — so the precondition, not the floor guard, must refuse it. Weakening the set went unpunished.
	it('REFUSES a re-published PWA once it is PUBLISHED (rootPwuTypeId is immutable after publish)', () => {
		authorValidatedAiPwa();
		recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'SATISFIED' });
		expect(publish().status).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
		const published = store.readAllEvents().filter((e) => e.eventType === 'PwaPublished').length;

		const again = publish();
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(store.readAllEvents().filter((e) => e.eventType === 'PwaPublished')).toHaveLength(
			published
		);
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

	// (HUMAN and WAIVER are declared at the top of this describe — the credential directory has to name them.)

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
			{ waiverDecisionId: WAIVER, duration: 'until superseded' },
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
			// ⚠ INVERTED 2026-08-20 (REG-F-202, sponsor ruling on ASR-3). This asserted ACCEPTED: an exactly-scoped
			// waiver used to discharge the floor. ASR-3 (JPWB-DOC-003:249) makes the de minimis floor UNCONDITIONAL,
			// so the discharge apparatus was deleted from floor-gate.ts and NO waiver reaches a required floor policy.
			// The waiver is still RECORDED and still EFFECTIVE — ASR-14's "a waiver accepts risk; it never rewrites
			// truth" — it simply discharges nothing. What changed is its REACH, not its recordability.
			findingIds: [findingId]
		});
		const r = publish();
		expect(r.status, 'ASR-3: the floor is unconditional; the waiver discharges nothing').toBe(
			'REJECTED'
		);
		expect(pub()).toBe('VALIDATED');
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
	let engine: AuthedEngine;
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
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const defineType = (id: string, extra: Record<string, unknown>) =>
		dispatch(
			'DefinePwuType',
			{
				pwuTypeId: id,
				pwaId: B_PWA,
				pwuKind: 'X',
				name: 'X',
				purpose: 'p',
				isRoot: false,
				...extra
			},
			id,
			'PWU_TYPE'
		);
	const editType = (id: string, patch: Record<string, unknown>) =>
		dispatch('EditPwuType', { pwuTypeId: id, ...patch }, id, 'PWU_TYPE');
	const load = (id: string) => store.loadObject(id)?.state as Record<string, unknown> | undefined;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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
	let engine: AuthedEngine;
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
			{
				pwuTypeId: id,
				pwaId: F_PWA,
				pwuKind: 'X',
				name: 'X',
				purpose: 'p',
				isRoot: false,
				...extra
			},
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
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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
		expect(defineType(F_TYPE, { requiredAssurancePolicyIds: [ACTIVE_POL] }).status).toBe(
			'ACCEPTED'
		);
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
		expect(defineType(F_TYPE, { requiredAssurancePolicyIds: [ACTIVE_POL] }).status).toBe(
			'ACCEPTED'
		);
		expect(
			dispatch('SuspendAssurancePolicy', { policyId: ACTIVE_POL }, ACTIVE_POL, 'ASSURANCE_POLICY')
				.status
		).toBe('ACCEPTED');
		// The reference is now to a SUSPENDED policy — an unrelated edit must retain it, not re-reject.
		const e = dispatch(
			'EditPwuType',
			{ pwuTypeId: F_TYPE, purpose: 'clarified' },
			F_TYPE,
			'PWU_TYPE'
		);
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

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// JAN-PFA / REG-F-392 — PRECISION CLOSURES.
//
// Each `it` below closes ONE inventoried gap: a promise this module makes that the suite already proved HAPPENS
// but never proved was PRECISE. Forty mutants against these handlers all SURVIVED, and every one of them attacked
// a promise nothing asserted — so the remedy is assertions, and they share one shape:
//
//   ⭑ ASSERT THE PROMISE OVER THE WHOLE SET IT QUANTIFIES OVER, DERIVED FROM THE RATIFIED CONTRACT. Pinning one
//     member of a set proves nothing about the others: the previous increment found a floor-lock test hard-coding
//     one of three ids, and a mutant narrowing the lock to exactly that id passed it. The status sweeps below take
//     their set from `ProfessionalWorkArchitectureSchema`, the event assertions from the event payload schemas,
//     and the arrow sweep from `BINDINGS` — so a status, field or arrow added to the contract joins the sweep
//     rather than slipping past it, and the driver throws where it cannot keep up.
//   ⭑ AND GIVE IT A CONTROL. Every gap in the inventory exists because a suite proved a refusal HAPPENS and never
//     that it was PRECISE. Each test below also exercises the legitimate case, so a guard that refuses everything
//     (or an emitter that emits everything) cannot satisfy it.
describe('JAN-PFA precision closures — pwa-authoring promises asserted over their whole set', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;
	const PWA_T = 'PROFESSIONAL_WORK_ARCHITECTURE';
	const TYPE_T = 'PWU_TYPE';

	/** Every publicationStatus a PWA can hold — DERIVED from the ratified object contract rather than hand-listed,
	 *  so a status added to the enum joins the sweeps below automatically (and `pwaAt` throws until it is taught
	 *  the command that reaches it) instead of being silently excluded from a promise that quantifies over all. */
	const PUBLICATION_STATUSES = ProfessionalWorkArchitectureSchema.shape.publicationStatus.options;

	/** The PWA.publicationStatus arrows a command performs, DERIVED from the ratified command→transition table.
	 *  Hand-listing them is what these tests exist to stop doing: an arrow added to the contract joins the sweep. */
	const PWA_ARROWS = BINDINGS.filter(
		(b) => b.machine === 'PWA.publicationStatus' && b.from !== undefined && b.from !== '(initial)'
	);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const stateOf = (id: string) =>
		store.loadObject(id)?.state as Record<string, unknown> | undefined;
	const statusOf = (pwaId: string) => stateOf(pwaId)?.publicationStatus as string | undefined;
	const semverOf = (pwaId: string) => Number(stateOf(pwaId)?.semanticVersion);
	const eventsOf = (eventType: string) =>
		store.readAllEvents().filter((e) => e.eventType === eventType);
	const payloadOf = (eventType: string, nth = 0) =>
		eventsOf(eventType)[nth]!.payload as Record<string, unknown>;
	/** A ULID-shaped id (prefix_ + 26 Crockford digits) keyed by `n`, so every fixture in a sweep gets its own. */
	const uid = (prefix: string, n: number) =>
		`${prefix}_01ARZ3NDEKTSV4RRFFQ69G5${String(n).padStart(3, '0')}`;

	/** The publication arrows ORDERED by walking the machine forward from its initial state. */
	function arrowPath(): ReadonlyArray<{ commandType: string; from: string; to: string }> {
		const path: { commandType: string; from: string; to: string }[] = [];
		let at = 'DRAFT';
		for (;;) {
			const next = PWA_ARROWS.find((a) => a.from === at);
			if (!next) return path;
			path.push({ commandType: next.commandType, from: String(next.from), to: String(next.to) });
			at = String(next.to);
		}
	}

	/** Drive a FRESH PWA (plus its root type) to `status` through real commands, and prove it landed there — no
	 *  test below writes a status into the store, because a state no command sequence produces is not a promise
	 *  anyone can break. Unknown statuses THROW: the set comes from the contract, and the driver must keep up. */
	function pwaAt(status: string, n: number): { pwaId: string; rootId: string } {
		const pwaId = uid('pwa', n);
		const rootId = uid('pwut', n);
		const created = d(
			'CreatePwa',
			{ pwaId, name: `PWA ${n}`, description: 'd', domain: 'software', version: '1.0.0' },
			pwaId,
			PWA_T
		);
		expect(created.status, JSON.stringify(created.error)).toBe('ACCEPTED');
		const root = d(
			'DefinePwuType',
			{
				pwuTypeId: rootId,
				pwaId,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			},
			rootId,
			TYPE_T
		);
		expect(root.status, JSON.stringify(root.error)).toBe('ACCEPTED');
		if (status === 'DISCARDED') {
			// DISCARDED is the one status the ratified enum declares that the PWA.publicationStatus MACHINE does
			// not: `deletePwa` writes the tombstone directly rather than through an arrow, so there is no binding
			// to derive it from and the driver has to know the command.
			const del = d('DeletePwa', { pwaId }, pwaId, PWA_T);
			expect(del.status, JSON.stringify(del.error)).toBe('ACCEPTED');
		} else if (status !== 'DRAFT') {
			const path = arrowPath();
			const upTo = path.findIndex((a) => a.to === status);
			if (upTo < 0)
				throw new Error(
					`pwaAt: no command sequence reaches publicationStatus ${status}. The ratified enum declares it and this driver does not know how to get there — teach it the command, or the sweeps below silently stop quantifying over the whole set.`
				);
			for (const arrow of path.slice(0, upTo + 1)) {
				const r = d(
					arrow.commandType,
					arrow.commandType === 'PublishPwa' ? { rootPwuTypeId: rootId } : {},
					pwaId,
					PWA_T
				);
				expect(r.status, `${arrow.commandType}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
			}
		}
		expect(statusOf(pwaId), `pwaAt(${status}) did not actually land the PWA there`).toBe(status);
		return { pwaId, rootId };
	}

	// ── createPwa ────────────────────────────────────────────────────────────────────────────────────────────────
	// GAP: `eventPayload: { pwaId, name: p.name, version }` → `{ …, name: p.domain, … }` survived. The PWA's
	// STATE name/version are asserted elsewhere; the recorded EVENT's were not, and the event log is "the audit
	// record, the replay source, the only durable account of why the system did what it did", with no retraction
	// mechanism — a PwaCreated naming the wrong thing is not a bad request, it is a permanently wrong history.
	it('PwaCreated records the CreatePwa facts BY NAME — every field the ratified event declares', () => {
		const pwaId = uid('pwa', 40);
		// ⚠ THE VALUES ARE PAIRWISE DISTINCT ON PURPOSE. A fixture that reuses one string cannot see a mutant
		// that binds one declared field to a different command field; the assertion below would pass while the
		// history was wrong. So the distinctness is itself asserted rather than left to the reader's care.
		const cmd: Record<string, string> = {
			pwaId,
			name: 'Product Realization',
			description: 'how this organisation realizes a product',
			domain: 'software',
			version: '1.4.2'
		};
		expect(
			new Set(Object.values(cmd)).size,
			'the fixture values must be pairwise distinct or a field-swap mutation is undetectable'
		).toBe(Object.keys(cmd).length);
		const r = d('CreatePwa', cmd, pwaId, PWA_T);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		const declared = Object.keys(PwaCreatedPayloadSchema.shape);
		expect(eventsOf('PwaCreated')).toHaveLength(1);
		const recorded = payloadOf('PwaCreated');
		expect(
			[...Object.keys(recorded)].sort(),
			'PwaCreated carries EXACTLY the fields its ratified strictObject declares'
		).toEqual([...declared].sort());
		for (const key of declared) {
			expect(
				Object.prototype.hasOwnProperty.call(cmd, key),
				`the ratified PwaCreated declares '${key}' and this fixture cannot source it from the CreatePwa payload — teach the fixture rather than dropping the field from the check`
			).toBe(true);
			expect(
				recorded[key],
				`PwaCreated.${key} must record the CreatePwa payload's '${key}' — a declared field bound to any OTHER fact is a permanently wrong history (REG-F-020)`
			).toBe(cmd[key]);
		}
		// CONTROL — the event's narrowness is a DECLARED shape, not data loss: the fields it does not carry are
		// on the PWA's own state. Without this, an event that recorded nothing at all would look acceptable.
		const s = stateOf(pwaId)!;
		expect(s.description, 'the PWA state still carries what the event does not').toBe(
			cmd.description
		);
		expect(s.domain).toBe(cmd.domain);
	});

	// ── appendConversationEntries ────────────────────────────────────────────────────────────────────────────────
	// GAP: `entries: [...prior, ...p.entries]` → `[...p.entries, ...prior]` survived. The suite proved the
	// transcript GREW (length 1 → 3) and never that it was a transcript: in an audit trail the SEQUENCE of a tool
	// call and its result is the whole content of the record, and a tool_result rendered before the message that
	// asked for it is a false account of what happened.
	it('AppendConversationEntries EXTENDS the transcript — every turn lands after the turn before it', () => {
		const conv = uid('conv', 50);
		const pwaId = uid('pwa', 50);
		// Four DISTINCT turns across three appends, the middle append carrying two: that covers order ACROSS
		// appends and WITHIN one batch, which a one-entry-per-append fixture cannot tell apart.
		const TURNS = [
			'turn 1 — user: build it',
			'turn 2 — agent: calling define_pwu_type',
			'turn 3 — agent: define_pwu_type returned ok',
			'turn 4 — user: now publish it'
		];
		const append = (...texts: string[]) =>
			d(
				'AppendConversationEntries',
				{
					conversationId: conv,
					pwaId,
					entries: texts.map((text) => ({ role: 'AGENT', kind: 'message', text }))
				},
				conv,
				'AUTHORING_CONVERSATION'
			);
		expect(append(TURNS[0]!).status).toBe('ACCEPTED');
		expect(append(TURNS[1]!, TURNS[2]!).status).toBe('ACCEPTED');
		expect(append(TURNS[3]!).status).toBe('ACCEPTED');

		const entries = stateOf(conv)!.entries as { text: string }[];
		// CONTROL — nothing was dropped. An order assertion over a truncated transcript proves nothing, and an
		// append that kept only the newest batch would otherwise satisfy a first-element check.
		expect(entries, 'every appended entry must still be in the transcript').toHaveLength(
			TURNS.length
		);
		expect(
			entries.map((e) => e.text),
			'the transcript is a SEQUENCE, not a set: turn N+1 lands after turn N, across appends and within a batch'
		).toEqual(TURNS);
	});

	// ── definePwuType ────────────────────────────────────────────────────────────────────────────────────────────
	// GAP: `publicationStatus !== 'DRAFT'` → `!== 'DRAFT' && !== 'UNDER_REVIEW'` survived, because the only
	// non-DRAFT case the suite drove was PUBLISHED. UNDER_REVIEW is the dangerous member: a reviewer approves a
	// graph and a type is smuggled into it before publication — the very defect bumpPwaSemanticVersion exists for.
	it('DefinePwuType is admitted in DRAFT and refused in EVERY other publication status (the graph freezes at submission)', () => {
		const admitted: string[] = [];
		PUBLICATION_STATUSES.forEach((status, i) => {
			const { pwaId } = pwaAt(status, 100 + i);
			const newType = uid('pwut', 130 + i);
			const r = d(
				'DefinePwuType',
				{
					pwuTypeId: newType,
					pwaId,
					pwuKind: 'X',
					name: 'Late Addition',
					purpose: 'p',
					isRoot: false
				},
				newType,
				TYPE_T
			);
			if (r.status === 'ACCEPTED') {
				admitted.push(status);
				expect(
					stateOf(newType),
					`an ACCEPTED define on a ${status} PWA must persist the type`
				).toBeDefined();
				return;
			}
			expect(r.error?.code, `DefinePwuType on a ${status} PWA`).toBe('RPH_INVARIANT_VIOLATION');
			expect(
				r.error?.message,
				`the refusal on a ${status} PWA must be the DRAFT-only rule itself and must name the offending status`
			).toContain(`PWU Types can only be defined on a DRAFT PWA (${pwaId} is ${status})`);
			expect(
				stateOf(newType),
				`nothing may be persisted for a type refused on a ${status} PWA`
			).toBeUndefined();
		});
		// The promise is UNIVERSAL — exactly ONE status admits a new type — and the DRAFT member of this
		// assertion is the CONTROL: a guard that refused every status would fail here, not pass quietly.
		expect(
			admitted,
			'DefinePwuType must be admitted in DRAFT and in no other publication status'
		).toEqual(['DRAFT']);
	});

	// ── createUndertaking ────────────────────────────────────────────────────────────────────────────────────────
	// GAP: `publicationStatus !== 'PUBLISHED'` → `!== 'PUBLISHED' && !== 'DEPRECATED'` survived, because the only
	// non-PUBLISHED case the suite drove was DRAFT. DEPRECATED is the member whose entire operational meaning is
	// "existing Undertakings continue, no NEW work starts here" — and deletePwa's docblock prescribes deprecation
	// as the remedy for a PWA in use, which is only a remedy if deprecating actually stops new instantiation.
	it('CreateUndertaking is admitted from a PUBLISHED PWA and refused from EVERY other publication status', () => {
		const admitted: string[] = [];
		PUBLICATION_STATUSES.forEach((status, i) => {
			const { pwaId } = pwaAt(status, 160 + i);
			const undertakingId = uid('und', 190 + i);
			const r = d(
				'CreateUndertaking',
				{
					undertakingId,
					name: 'U',
					description: 'd',
					pwaId,
					pwaVersion: '1.0.0',
					instantiationProfile: 'Standard',
					objective: 'o',
					intendedOutputProduct: 'p'
				},
				undertakingId,
				'UNDERTAKING'
			);
			if (r.status === 'ACCEPTED') {
				admitted.push(status);
				expect(
					stateOf(undertakingId)?.pwaId,
					`an ACCEPTED CreateUndertaking against a ${status} PWA must bind it`
				).toBe(pwaId);
				return;
			}
			expect(r.error?.code, `CreateUndertaking from a ${status} PWA`).toBe(
				'RPH_INVARIANT_VIOLATION'
			);
			expect(
				r.error?.message,
				`the refusal from a ${status} PWA must be the PUBLISHED-only rule itself and must name the offending status`
			).toContain(`An Undertaking can only instantiate a PUBLISHED PWA (${pwaId} is ${status})`);
			expect(
				stateOf(undertakingId),
				`nothing may be persisted for an Undertaking refused against a ${status} PWA`
			).toBeUndefined();
		});
		// Universal, and the PUBLISHED member is the CONTROL: §42's rule is "instantiated from a PUBLISHED PWA
		// version", so exactly one status admits — a gate that refused all of them would fail here.
		expect(
			admitted,
			'CreateUndertaking must be admitted from PUBLISHED and from no other publication status'
		).toEqual(['PUBLISHED']);
	});

	// ── editPwuType ──────────────────────────────────────────────────────────────────────────────────────────────
	// GAP: deleting `'permittedChildTypeIds'` from the emitted-payload whitelist survived. The edit that sets the
	// child edge list is driven twice in this file and only its resulting STATE is asserted, so the event — whose
	// own comment promises it "records what the edit changed" — could silently stop carrying the graph edge the
	// edit was FOR. The assertion is therefore over the whole DECLARED field set, derived from the event schema.
	it('PwuTypeRedefined carries EVERY declared field the edit supplied — and only the fields it changed (control)', () => {
		const pwaId = uid('pwa', 210);
		const typeId = uid('pwut', 211);
		const POLICY = 'pol_pfa_active';
		seedPolicy(engine, POLICY);
		expect(
			d(
				'CreatePwa',
				{ pwaId, name: 'Redefine', description: 'd', domain: 'software', version: '1.0.0' },
				pwaId,
				PWA_T
			).status
		).toBe('ACCEPTED');
		expect(
			d(
				'DefinePwuType',
				{
					pwuTypeId: typeId,
					pwaId,
					pwuKind: 'ANALYSIS',
					name: 'Before',
					purpose: 'before',
					isRoot: false
				},
				typeId,
				TYPE_T
			).status
		).toBe('ACCEPTED');

		const declared = Object.keys(PwuTypeRedefinedPayloadSchema.shape);
		// Every DECLARED field, supplied in one edit and each with a value different from the one it replaces.
		const patch: Record<string, unknown> = {
			pwuTypeId: typeId,
			name: 'After',
			purpose: 'the revised purpose',
			pwuKind: 'SYNTHESIS',
			isRoot: true,
			completionRule: 'a custom completion rule',
			permittedChildTypeIds: ['pwut_child_x'],
			requiredAssurancePolicyIds: [POLICY]
		};
		expect(
			[...Object.keys(patch)].sort(),
			'this test must SUPPLY every field the ratified event declares, or it cannot prove they are all recorded — a field added to PwuTypeRedefined belongs here, never dropped from the check'
		).toEqual([...declared].sort());
		const e = d('EditPwuType', patch, typeId, TYPE_T);
		expect(e.status, JSON.stringify(e.error)).toBe('ACCEPTED');

		const recorded = payloadOf('PwuTypeRedefined');
		expect(
			[...Object.keys(recorded)].sort(),
			'an edit that supplied every declared field must emit every declared field — a field silently missing from the whitelist is an event that does not carry what the act did (the twenty-one REG-F-020 defects)'
		).toEqual([...declared].sort());
		for (const key of declared) {
			expect(
				recorded[key],
				`PwuTypeRedefined.${key} must record what the edit changed, not a stale or absent value`
			).toEqual(patch[key]);
		}

		// CONTROL — the emitter is PRECISE, not exhaustive. A second edit changes only `purpose` while also
		// carrying fields the ratified event does NOT declare (requiredInputs, permittedChildren): the payload
		// must be exactly { pwuTypeId, purpose }. Without this, an emitter that dumped the whole command payload
		// would satisfy the assertion above while asserting `undefined` for everything the edit did not touch.
		const e2 = d(
			'EditPwuType',
			{
				pwuTypeId: typeId,
				purpose: 'a later clarification',
				requiredInputs: ['an input the ratified event does not declare']
			},
			typeId,
			TYPE_T
		);
		expect(e2.status, JSON.stringify(e2.error)).toBe('ACCEPTED');
		expect(
			[...Object.keys(payloadOf('PwuTypeRedefined', 1))].sort(),
			'only the fields actually PRESENT in the patch are emitted — the event records what the edit changed'
		).toEqual(['purpose', 'pwuTypeId']);
	});

	// ── publishPwa ───────────────────────────────────────────────────────────────────────────────────────────────
	// GAP: adding `bumpSemanticVersion: true` to publishPwa's advanceStatus survived. semanticVersion is the
	// MATERIAL-CHANGE counter every version-bound assurance record binds (§10.1 L1379), and the floor gate's
	// `versionOk` check compares it — so a publication ARROW that moves it staleness-invalidates a floor that is
	// still true. The converse is asserted one door down for a REFUSED edit; nowhere for an ACCEPTED publish.
	// Swept over EVERY arrow, because the identical mutation applies to each of them.
	it('no publication-status ARROW moves the PWA semanticVersion — only a material graph edit does (control)', () => {
		const pwaId = uid('pwa', 60);
		const rootId = uid('pwut', 61);
		expect(
			d(
				'CreatePwa',
				{ pwaId, name: 'Versioned', description: 'd', domain: 'software', version: '1.0.0' },
				pwaId,
				PWA_T
			).status
		).toBe('ACCEPTED');
		const atBirth = semverOf(pwaId);
		// CONTROL — the counter CAN move, and this is what moves it: a material edit to the PWA's graph. Without
		// it, every assertion below is satisfied by a semanticVersion that is simply frozen forever, which is the
		// original defect (a floor satisfied over a 1-type graph authorizing a graph a type was smuggled into).
		expect(
			d(
				'DefinePwuType',
				{
					pwuTypeId: rootId,
					pwaId,
					pwuKind: 'PRODUCT_REALIZATION',
					name: 'R',
					purpose: 'root',
					isRoot: true
				},
				rootId,
				TYPE_T
			).status
		).toBe('ACCEPTED');
		expect(
			semverOf(pwaId),
			'adding a PWU Type materially edits the graph, so the version every assurance record binds must rise'
		).toBe(atBirth + 1);

		const judged = semverOf(pwaId); // the version an assurance floor would have been judged against
		const path = arrowPath();
		expect(
			path.map((a) => a.commandType).sort(),
			'the walked path must cover EVERY ratified PWA.publicationStatus arrow — a branch in the machine would otherwise drop arrows out of this sweep'
		).toEqual(PWA_ARROWS.map((a) => a.commandType).sort());
		for (const arrow of path) {
			const r = d(
				arrow.commandType,
				arrow.commandType === 'PublishPwa' ? { rootPwuTypeId: rootId } : {},
				pwaId,
				PWA_T
			);
			expect(r.status, `${arrow.commandType}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
			expect(statusOf(pwaId), `${arrow.commandType} must land the PWA in ${arrow.to}`).toBe(
				arrow.to
			);
			expect(
				semverOf(pwaId),
				`${arrow.commandType} (${arrow.from} -> ${arrow.to}) MOVED the PWA's semanticVersion. A publication arrow edits no graph; moving the material-change counter there invalidates an assurance floor that is still true of the graph it was judged against.`
			).toBe(judged);
		}
	});

	// ── removePwuType ────────────────────────────────────────────────────────────────────────────────────────────
	// GAP: `referencingSiblings(ctx, pwaId, id)` → `…, command.payload.pwuTypeId)` survived, because all three
	// RemovePwuType dispatches in this file pass payload.pwuTypeId === targetAggregateId, so the mutated census
	// reads the same id and the suite cannot tell the two apart. The subject of the integrity census must be the
	// aggregate the command TARGETS — the one about to be tombstoned — or the rule is steerable by the caller.
	it('RemovePwuType — the referential-integrity census is about the TARGET aggregate, not the id in the payload', () => {
		const pwaId = uid('pwa', 70);
		const rootId = uid('pwut', 71);
		const childId = uid('pwut', 72);
		expect(
			d(
				'CreatePwa',
				{ pwaId, name: 'Integrity', description: 'd', domain: 'software', version: '1.0.0' },
				pwaId,
				PWA_T
			).status
		).toBe('ACCEPTED');
		for (const [id, isRoot] of [
			[rootId, true],
			[childId, false]
		] as const)
			expect(
				d(
					'DefinePwuType',
					{ pwuTypeId: id, pwaId, pwuKind: 'X', name: id, purpose: 'p', isRoot },
					id,
					TYPE_T
				).status
			).toBe('ACCEPTED');
		expect(
			d('EditPwuType', { pwuTypeId: rootId, permittedChildTypeIds: [childId] }, rootId, TYPE_T)
				.status
		).toBe('ACCEPTED');

		// A DIRECT command may disagree with itself: the bus performs no payload/target coherence check, and the
		// domain is the authoritative gate (C-5), so the payload names ROOT — which nothing references — while
		// the command TARGETS, and would tombstone, the CHILD that ROOT still points at.
		const blocked = d('RemovePwuType', { pwuTypeId: rootId }, childId, TYPE_T);
		expect(
			blocked.status,
			'the TARGET is referenced by another type; naming an unreferenced id in the payload must not buy its removal'
		).toBe('REJECTED');
		expect(blocked.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(
			blocked.error?.message,
			'the refusal must be about the target aggregate, and must name it'
		).toContain(`Cannot remove PWU Type ${childId}`);
		expect(stateOf(childId)?.status, 'the referenced target must still be live').toBe('DRAFT');

		// CONTROL — the SAME divergent-payload command is ADMITTED once the reference is cleared. Without it a
		// handler that simply refused every payload/target mismatch would satisfy the assertion above, and the
		// census would be proven to fire rather than proven to be about the right aggregate.
		expect(
			d('EditPwuType', { pwuTypeId: rootId, permittedChildTypeIds: [] }, rootId, TYPE_T).status
		).toBe('ACCEPTED');
		const ok = d('RemovePwuType', { pwuTypeId: rootId }, childId, TYPE_T);
		expect(ok.status, JSON.stringify(ok.error)).toBe('ACCEPTED');
		expect(stateOf(childId)?.status, 'the TARGET is what gets tombstoned').toBe('REMOVED');
		expect(
			stateOf(rootId)?.status,
			'the id in the PAYLOAD is not the aggregate this command removes'
		).toBe('DRAFT');
	});
});

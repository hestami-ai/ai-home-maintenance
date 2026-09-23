// What an authoring write LEAVES BEHIND — the failure half of the PWA Design context (pwa-authoring.ts).
//
// WHY THIS FILE EXISTS. `pwa-authoring.test.ts` drives the happy path of every command in that module, and
// `pwa-validation-gate.test.ts` / `pwa-publish-stale-floor.test.ts` pin its two transition gates. None of them
// asks the question a write answers when it CANNOT complete: does the refusal name the thing it could not find,
// and does the store still hold exactly what it held before? Three properties were live in production and
// exercised by nothing:
//
//   1. FIVE REFUSALS NAME A SUBJECT AND NOTHING READ THE NAME. DefinePwuType and CreateUndertaking on an absent
//      PWA; EditPwa, DeletePwa and RemovePwuType on an absent aggregate; RemovePwuType against a PWA that has
//      left DRAFT. Each returns the sentence a professional reads to learn what to fix, and each arm was dead.
//   2. THE TWO-AGGREGATE WRITE HAD NO FAILURE TEST AT ALL. `withPwaVersionBump` exists because "a graph edit can
//      never land with the version left behind — which would silently re-create this defect" (its own comment):
//      the PWU-Type write and the owning PWA's semanticVersion bump are ONE act. Every prior test takes the path
//      where both halves succeed, so the `BumpAbort` rollback, the `if (failure)` arm and the rethrow of a
//      non-BumpAbort fault had never executed once. `StorageAdapter` is a PORT and failing one commit through it
//      is the only way to make half of the pair fail; that is what `FaultInjectingStore` below is for. It
//      delegates every method to the real SQLite adapter and substitutes a result for ONE commit, chosen by
//      aggregate type, only while armed.
//   3. THE TWO GRAPH CENSUSES COUNT BY EXCLUSION AND NOTHING PROVED THE EXCLUSIONS. `referencingSiblings`
//      (removal's referential-integrity check) and `pwuTypeNodesOf` (ValidatePwa's composition graph) both skip a
//      type that is REMOVED or belongs to another PWA. Both skips were dead: every prior arrangement had one PWA
//      and no tombstones. A census that counted tombstoned or foreign types would have passed every test in this
//      package while blocking a legitimate removal and failing a legitimate ValidatePwa.
//
// ⛔ WHAT THIS FILE DELIBERATELY DOES NOT CLOSE, because executing those lines would assert nothing:
//   (a) `pwuTypeNodesOf`'s DELEGATED_EXTERNAL arm. `analyzePwaGraph` never reads a node's `executionBoundary` —
//       the word occurs once in `pwa-graph.ts`, on the type declaration — so no dispatch outcome can tell the two
//       arms apart. A test that lit it would be asserting the fixture it just wrote.
//   (b) Every `?? default` over a field the envelope or the define handler ALWAYS writes: `createdBy` and
//       `semanticVersion` on a PWA, a type's array fields, a sibling's permitted lists, `executionBoundary`'s
//       third fallback. Reaching them needs an object state hand-seeded past the commands that produce it, which
//       is a fixture asserting its own shape rather than a behaviour.
import type { CommitInput, CommitResult, StorageAdapter } from '@janumipwb/rph-ports';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5D00';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5D01';
const ABSENT_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5D99';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5D10';
const CHILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5D11';
const SIBLING = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5D12';
const FOREIGN_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5D13';
const ABSENT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5D98';
const UND = 'und_01ARZ3NDEKTSV4RRFFQ69G5D20';
const CONV = 'conv_01ARZ3NDEKTSV4RRFFQ69G5D30';

/**
 * A StorageAdapter that IS the real one until it is armed, then substitutes the result of a single `commit`.
 *
 * Nothing else is faked: `transaction` is the real SQLite transaction, so the rollback these tests assert is the
 * production rollback and not a stub's opinion of one. `fault` is consulted per commit and picks its victim by
 * aggregate type, which is how the two halves of the PWU-Type/PWA pair are failed independently. A fault that
 * THROWS (rather than returning a CommitResult) models a driver-level fault, which is a different path: a
 * returned REVISION_CONFLICT is a refusal the handler must convert, a throw is a fault it must not swallow.
 */
class FaultInjectingStore implements StorageAdapter {
	fault: ((input: CommitInput) => CommitResult | undefined) | undefined;

	constructor(readonly inner: SqliteStorageAdapter) {}

	get durability() {
		return this.inner.durability;
	}

	getReceipt(idempotencyKey: string) {
		return this.inner.getReceipt(idempotencyKey);
	}
	loadObject(id: string) {
		return this.inner.loadObject(id);
	}
	commit(input: CommitInput): CommitResult {
		return this.fault?.(input) ?? this.inner.commit(input);
	}
	transaction<T>(fn: () => T): T {
		return this.inner.transaction(fn);
	}
	readTransaction<T>(fn: () => T): T {
		return this.inner.readTransaction(fn);
	}
	highWaterMark() {
		return this.inner.highWaterMark();
	}
	eventsAfter(mark: number) {
		return this.inner.eventsAfter(mark);
	}
	readAggregateEvents(aggregateType: string, aggregateId: string) {
		return this.inner.readAggregateEvents(aggregateType, aggregateId);
	}
	readAllEvents() {
		return this.inner.readAllEvents();
	}
	readPendingOutbox() {
		return this.inner.readPendingOutbox();
	}
	markOutboxPublished(outboxIds: readonly string[]) {
		this.inner.markOutboxPublished(outboxIds);
	}
	close() {
		this.inner.close();
	}
}

describe('PWA authoring — what a write leaves behind', () => {
	let store: FaultInjectingStore;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new FaultInjectingStore(new SqliteStorageAdapter({ now: () => TS }));
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
	});

	function d(
		commandType: string,
		payload: unknown,
		id: string,
		type: string,
		extra: Partial<DomainCommand> = {}
	) {
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
			payload,
			...extra
		};
		return engine.dispatch(command);
	}

	// Fixtures are asserted ACCEPTED so a later red can only mean the behaviour moved — never a malformed payload.
	function createDraftPwa(id = PWA) {
		const r = d(
			'CreatePwa',
			{
				pwaId: id,
				name: 'Product Realization',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			id,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	function defineType(id: string, extra: Record<string, unknown> = {}, pwaId = PWA) {
		const r = d(
			'DefinePwuType',
			{
				pwuTypeId: id,
				pwaId,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'p',
				isRoot: false,
				...extra
			},
			id,
			'PWU_TYPE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	const objState = (id: string) =>
		store.loadObject(id)?.state as Record<string, unknown> | undefined;
	const pwaSemanticVersion = (id = PWA) => store.loadObject(id)?.semanticVersion;
	const pubStatus = (id = PWA) =>
		(store.loadObject(id)?.state as { publicationStatus?: string } | undefined)?.publicationStatus;

	// ── 1. A refusal names the subject it could not find ─────────────────────────────────────────────────────

	it('DefinePwuType names the PWA it could not find, and mints no type', () => {
		const r = d(
			'DefinePwuType',
			{ pwuTypeId: ROOT, pwaId: ABSENT_PWA, pwuKind: 'K', name: 'R', purpose: 'p', isRoot: true },
			ROOT,
			'PWU_TYPE'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toBe(`PWA ${ABSENT_PWA} does not exist`);
		// The refusal is the WHOLE effect: a type whose owning PWA does not exist must not be in the store.
		expect(store.loadObject(ROOT)).toBeUndefined();
	});

	it('CreateUndertaking names the PWA it could not find, and instantiates nothing', () => {
		const r = d(
			'CreateUndertaking',
			{
				undertakingId: UND,
				name: 'U',
				description: 'd',
				pwaId: ABSENT_PWA,
				pwaVersion: '1.0.0',
				instantiationProfile: 'Standard',
				objective: 'o',
				intendedOutputProduct: 'p'
			},
			UND,
			'UNDERTAKING'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toBe(`PWA ${ABSENT_PWA} does not exist`);
		expect(store.loadObject(UND)).toBeUndefined();
	});

	it('EditPwa, DeletePwa and RemovePwuType each refuse an aggregate that does not exist, naming it', () => {
		const edit = d(
			'EditPwa',
			{ pwaId: ABSENT_PWA, name: 'x' },
			ABSENT_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(edit.status).toBe('REJECTED');
		expect(edit.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(edit.error?.message).toBe(`Aggregate ${ABSENT_PWA} does not exist`);

		const del = d('DeletePwa', { pwaId: ABSENT_PWA }, ABSENT_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(del.status).toBe('REJECTED');
		expect(del.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(del.error?.message).toBe(`Aggregate ${ABSENT_PWA} does not exist`);

		const remove = d('RemovePwuType', { pwuTypeId: ABSENT_TYPE }, ABSENT_TYPE, 'PWU_TYPE');
		expect(remove.status).toBe('REJECTED');
		expect(remove.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(remove.error?.message).toBe(`Aggregate ${ABSENT_TYPE} does not exist`);
	});

	it('AppendConversationEntries refuses a stale expectedRevision and appends nothing to the transcript', () => {
		const first = d(
			'AppendConversationEntries',
			{
				conversationId: CONV,
				pwaId: PWA,
				entries: [{ role: 'USER', kind: 'message', text: 'build it' }]
			},
			CONV,
			'AUTHORING_CONVERSATION'
		);
		expect(first.status, JSON.stringify(first.error)).toBe('ACCEPTED');
		// The transcript is event-sourced DOMAIN state, so an append issued against a revision the caller no
		// longer holds must not silently extend it — the second half of that sentence is what this asserts.
		const stale = d(
			'AppendConversationEntries',
			{
				conversationId: CONV,
				pwaId: PWA,
				entries: [{ role: 'AGENT', kind: 'message', text: 'lost turn' }]
			},
			CONV,
			'AUTHORING_CONVERSATION',
			{ expectedRevision: 99 }
		);
		expect(stale.error?.code).toBe('RPH_REVISION_CONFLICT');
		expect(stale.error?.message).toBe(
			`Revision conflict on ${CONV}: command expected revision 99, actual is 0`
		);
		expect(objState(CONV)?.entries as unknown[]).toHaveLength(1);
	});

	it('RemovePwuType refuses once the owning PWA has left DRAFT, and the type keeps its status', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		expect(d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		expect(d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe('ACCEPTED');
		expect(
			d('PublishPwa', { rootPwuTypeId: ROOT }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status
		).toBe('ACCEPTED');
		const r = d('RemovePwuType', { pwuTypeId: ROOT }, ROOT, 'PWU_TYPE');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toBe(
			`A PWU Type can only be changed while its PWA is DRAFT (${PWA} is PUBLISHED)`
		);
		// No tombstone was written: the published architecture still declares this type.
		expect(objState(ROOT)?.status).toBe('DRAFT');
	});

	// ── 2. Discharge coherence, on both write paths and in both phrasings ───────────────────────────────────

	it('DefinePwuType refuses an ACTIVE prompt template on a type that declares no discharge, naming "(none)"', () => {
		createDraftPwa();
		const r = d(
			'DefinePwuType',
			{
				pwuTypeId: ROOT,
				pwaId: PWA,
				pwuKind: 'K',
				name: 'R',
				purpose: 'p',
				isRoot: true,
				promptTemplate: {
					templateText: 'draft the brief',
					templateVersion: 1,
					declaredPlaceholders: [],
					status: 'ACTIVE'
				}
			},
			ROOT,
			'PWU_TYPE'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toBe(
			`PWU Type ${ROOT} carries an ACTIVE prompt template but declares workDischarge (none). The prompt would never be rendered and nothing would say so — an authored, reviewed, published instruction sitting inert. Declare MODEL, or leave the template DRAFT.`
		);
		expect(store.loadObject(ROOT)).toBeUndefined();
	});

	it('EditPwuType refuses an ACTIVE prompt template on a HUMAN-discharged type, landing neither it nor a version bump', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		const bumpedByDefine = pwaSemanticVersion();
		const r = d(
			'EditPwuType',
			{
				pwuTypeId: ROOT,
				workDischarge: 'HUMAN',
				promptTemplate: {
					templateText: 'draft the brief',
					templateVersion: 1,
					declaredPlaceholders: [],
					status: 'ACTIVE'
				}
			},
			ROOT,
			'PWU_TYPE'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toBe(
			`PWU Type ${ROOT} carries an ACTIVE prompt template but declares workDischarge HUMAN. The prompt would never be rendered and nothing would say so — an authored, reviewed, published instruction sitting inert. Declare MODEL, or leave the template DRAFT.`
		);
		expect(objState(ROOT)?.promptTemplate).toBeUndefined();
		expect(objState(ROOT)?.workDischarge).toBeUndefined();
		// The refused edit must not have raised the PWA's semanticVersion — a floor satisfied over this graph
		// still binds it (§10.1 L1379), and a bump for an edit that did not happen would invalidate it.
		expect(pwaSemanticVersion()).toBe(bumpedByDefine);
	});

	// ── 3. A write lands exactly the fields it was given ────────────────────────────────────────────────────

	it('DefinePwuType lands the contextSpecification it was given', () => {
		createDraftPwa();
		const spec = { requiredElements: ['the approved brief'], constraintDispositions: [] };
		defineType(ROOT, { isRoot: true, contextSpecification: spec });
		// The define path builds its state separately from the edit path, and has already dropped one runtime
		// asset on the floor exactly here (JAN-PROMPT, see the handler's own note).
		expect(objState(ROOT)?.contextSpecification).toEqual(spec);
	});

	it('EditPwuType lands every editable field the patch carries', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		const spec = { requiredElements: ['the approved brief'], constraintDispositions: [] };
		const r = d(
			'EditPwuType',
			{
				pwuTypeId: ROOT,
				pwuKind: 'DISCOVERY',
				isRoot: false,
				requiredInputs: ['the brief'],
				requiredOutputs: ['the specification'],
				workDischarge: 'MODEL',
				contextSpecification: spec
			},
			ROOT,
			'PWU_TYPE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const t = objState(ROOT)!;
		expect(t.pwuKind).toBe('DISCOVERY');
		expect(t.isRoot).toBe(false);
		expect(t.requiredInputs).toEqual(['the brief']);
		expect(t.requiredOutputs).toEqual(['the specification']);
		expect(t.workDischarge).toBe('MODEL');
		expect(t.contextSpecification).toEqual(spec);
	});

	it('DefinePwuType derives the flat edge list from the cardinality rules alone', () => {
		createDraftPwa();
		defineType(CHILD);
		// The define path derives this list separately from the edit path below — two write paths for one field,
		// which is the drift the handler's own reader comment warns about and has already been bitten by once.
		defineType(ROOT, { isRoot: true, permittedChildren: [{ typeId: CHILD, cardinality: 'M+' }] });
		expect(objState(ROOT)?.permittedChildTypeIds).toEqual([CHILD]);
	});

	it('EditPwuType re-derives the flat edge list when only the cardinality rules are edited', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		defineType(CHILD);
		const rules = [{ typeId: CHILD, cardinality: 'M1' }];
		const r = d('EditPwuType', { pwuTypeId: ROOT, permittedChildren: rules }, ROOT, 'PWU_TYPE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		// permittedChildTypeIds stays the AUTHORITATIVE edge list that render/projections consume: editing only
		// the annotation must not leave the two statements of one fact disagreeing.
		expect(objState(ROOT)?.permittedChildTypeIds).toEqual([CHILD]);
		expect(objState(ROOT)?.permittedChildren).toEqual(rules);
	});

	it('PublishPwa writes no rootPwuTypeId when the payload carries an empty one', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		expect(d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		expect(d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe('ACCEPTED');
		const r = d('PublishPwa', { rootPwuTypeId: '' }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pubStatus()).toBe('PUBLISHED');
		// An empty root id is not a root: publication must leave the field ABSENT rather than write a binding
		// that names nothing, which every Undertaking instantiated from this version would then inherit.
		expect(Object.hasOwn(store.loadObject(PWA)!.state as object, 'rootPwuTypeId')).toBe(false);
	});

	// ── 4. The censuses count by exclusion ──────────────────────────────────────────────────────────────────

	it('RemovePwuType ignores a reference held by a type that is itself REMOVED', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		defineType(CHILD);
		defineType(SIBLING, { permittedChildTypeIds: [CHILD] });
		expect(d('RemovePwuType', { pwuTypeId: SIBLING }, SIBLING, 'PWU_TYPE').status).toBe('ACCEPTED');
		// SIBLING still declares CHILD as a permitted child, but SIBLING is a tombstone: the query surface hides
		// it, so its edge cannot strand anything. (The live-reference refusal itself is pinned in
		// pwa-authoring.test.ts — this is the exclusion that keeps it from over-refusing.)
		const r = d('RemovePwuType', { pwuTypeId: CHILD }, CHILD, 'PWU_TYPE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(objState(CHILD)?.status).toBe('REMOVED');
	});

	it("RemovePwuType ignores a reference held by another PWA's type", () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		defineType(CHILD);
		createDraftPwa(OTHER_PWA);
		defineType(FOREIGN_ROOT, { isRoot: true, permittedChildTypeIds: [CHILD] }, OTHER_PWA);
		// A PWU Type id is only meaningful inside its own architecture; a foreign type naming it is not a
		// reference this graph can strand.
		const r = d('RemovePwuType', { pwuTypeId: CHILD }, CHILD, 'PWU_TYPE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(objState(CHILD)?.status).toBe('REMOVED');
	});

	it('DeletePwa is not blocked by an Undertaking instantiated from a DIFFERENT PWA', () => {
		// OTHER_PWA is published and in use; PWA is an unused draft. "In use" is a fact about THIS PWA, and the
		// in-use census counts by the same exclusion the other two do.
		createDraftPwa(OTHER_PWA);
		defineType(FOREIGN_ROOT, { isRoot: true }, OTHER_PWA);
		expect(d('SubmitPwaForReview', {}, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		expect(d('ValidatePwa', {}, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		expect(
			d('PublishPwa', { rootPwuTypeId: FOREIGN_ROOT }, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE')
				.status
		).toBe('ACCEPTED');
		expect(
			d(
				'CreateUndertaking',
				{
					undertakingId: UND,
					name: 'U',
					description: 'd',
					pwaId: OTHER_PWA,
					pwaVersion: '1.0.0',
					instantiationProfile: 'Standard',
					objective: 'o',
					intendedOutputProduct: 'p'
				},
				UND,
				'UNDERTAKING'
			).status
		).toBe('ACCEPTED');
		createDraftPwa();
		const r = d('DeletePwa', { pwaId: PWA }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pubStatus()).toBe('DISCARDED');
		expect(pubStatus(OTHER_PWA)).toBe('PUBLISHED');
	});

	it('ValidatePwa composes over live types only — a REMOVED orphan does not break connectivity', () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		defineType(CHILD); // unreachable from ROOT: as a LIVE node this graph fails `connected`
		expect(d('RemovePwuType', { pwuTypeId: CHILD }, CHILD, 'PWU_TYPE').status).toBe('ACCEPTED');
		expect(d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pubStatus()).toBe('VALIDATED');
	});

	it("ValidatePwa composes over its OWN types only — another PWA's root is not a second root", () => {
		createDraftPwa();
		defineType(ROOT, { isRoot: true });
		createDraftPwa(OTHER_PWA);
		defineType(FOREIGN_ROOT, { isRoot: true }, OTHER_PWA);
		expect(d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pubStatus()).toBe('VALIDATED');
	});

	// ── 5. The PWU-Type write and the PWA version bump are ONE act ──────────────────────────────────────────

	it('a refused PWA version bump rolls the PWU-Type write back and returns the bump’s own refusal', () => {
		createDraftPwa();
		const before = pwaSemanticVersion();
		store.fault = (input) =>
			input.aggregateType === 'PROFESSIONAL_WORK_ARCHITECTURE'
				? { ok: false, reason: 'REVISION_CONFLICT', actualRevision: 7 }
				: undefined;
		const r = d(
			'DefinePwuType',
			{ pwuTypeId: ROOT, pwaId: PWA, pwuKind: 'K', name: 'R', purpose: 'p', isRoot: true },
			ROOT,
			'PWU_TYPE'
		);
		store.fault = undefined;
		expect(r.error?.code).toBe('RPH_REVISION_CONFLICT');
		expect(r.error?.message).toBe(`Revision conflict on ${PWA} (actual revision 7)`);
		// THE POINT: the type's own commit SUCCEEDED before the bump failed. If the pair were not one
		// transaction, this graph edit would now be in the store with the version it obliges left behind — a
		// floor satisfied over the old graph would authorize publishing the new one.
		expect(store.loadObject(ROOT)).toBeUndefined();
		expect(pwaSemanticVersion()).toBe(before);
	});

	it('a refused PWU-Type write leaves the PWA version untouched and returns the type’s own refusal', () => {
		createDraftPwa();
		const before = pwaSemanticVersion();
		store.fault = (input) =>
			input.aggregateType === 'PWU_TYPE'
				? { ok: false, reason: 'REVISION_CONFLICT', actualRevision: 3 }
				: undefined;
		const r = d(
			'DefinePwuType',
			{ pwuTypeId: ROOT, pwaId: PWA, pwuKind: 'K', name: 'R', purpose: 'p', isRoot: true },
			ROOT,
			'PWU_TYPE'
		);
		store.fault = undefined;
		expect(r.error?.code).toBe('RPH_REVISION_CONFLICT');
		expect(r.error?.message).toBe(`Revision conflict on ${ROOT} (actual revision 3)`);
		expect(store.loadObject(ROOT)).toBeUndefined();
		// The other direction of the same invariant: no graph edit happened, so the PWA's version must not move
		// and no PwaEdited may stand in the governed stream claiming one did.
		expect(pwaSemanticVersion()).toBe(before);
		expect(store.readAllEvents().filter((e) => e.eventType === 'PwaEdited')).toHaveLength(0);
	});

	it('a store FAULT inside the pair is rethrown, never swallowed into a result', () => {
		createDraftPwa();
		store.fault = (input) => {
			if (input.aggregateType === 'PROFESSIONAL_WORK_ARCHITECTURE')
				throw new Error('sqlite driver exploded');
			return undefined;
		};
		// `withPwaVersionBump` catches only its own BumpAbort. Swallowing anything else would return the
		// uninitialised `outcome` — the engine handing its caller `undefined` where its contract promises a
		// classified CommandResult, with no refusal anywhere to read.
		expect(() =>
			d(
				'DefinePwuType',
				{ pwuTypeId: ROOT, pwaId: PWA, pwuKind: 'K', name: 'R', purpose: 'p', isRoot: true },
				ROOT,
				'PWU_TYPE'
			)
		).toThrow('sqlite driver exploded');
		store.fault = undefined;
		expect(store.loadObject(ROOT)).toBeUndefined();
	});

	// ── 6. A DeletePwa refusal answers with the RIGHT code, across the whole refusal set ─────────────────────

	it('DeletePwa answers each of its three refusals with the code its condition earns — tombstone and in-use are INVARIANT, absent is VALIDATION', () => {
		// THE PROMISE IS ABOUT THE CODE, NOT THE SENTENCE. The ratified taxonomy (DOC-007 §25.1, rendered by
		// JPWB-SPEC-001's fifteen-row table) attaches a DISPOSITION to each code, and the Surface shows it:
		// `RPH_VALIDATION_SEMANTIC_FAILED` (row 2, category VALIDATION) means "correct the input and re-derive
		// before re-issuing"; `RPH_INVARIANT_VIOLATION` (row 6, category INVARIANT) means "satisfy the
		// invariant's precondition; do not re-issue unchanged". `makeRphError` derives `category` from the code,
		// so the code alone decides what the professional is told to DO about the refusal. A DELIBERATE
		// TOMBSTONE reported as VALIDATION would say "what you addressed is not admissible input" — the same
		// answer as a PWA that never existed — and would invite the one retry that can never succeed. The
		// handler's docblock makes this branch load-bearing on purpose: "a second delete of an already-DISCARDED
		// PWA is rejected by the EXPLICIT already-DISCARDED guard". Reachable from the Library card: the demo's
		// `delete` action (apps/rph-demo/src/routes/+page.server.ts) dispatches DeletePwa with an id read off
		// the submitted form, so a re-submit of a page rendered before the delete issues exactly this command,
		// and its `error.message`/code is what the card then shows.
		//
		// ⚠ ASSERTED OVER THE WHOLE REFUSAL SET, NOT ONE MEMBER. DeletePwa refuses in three ways and TWO of them
		// are domain-invariant; a test pinning only the tombstone would let a narrowing of the in-use refusal
		// through unseen. Every row names itself in the failure message.
		createDraftPwa();

		// CONTROL — the guard still ADMITS the legitimate act. An unused DRAFT PWA is deleted, with no error at
		// all. A guard that refused every DeletePwa would satisfy all three refusal rows below and fail HERE,
		// which is the only reason those rows mean anything.
		const legitimate = d('DeletePwa', { pwaId: PWA }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(legitimate.status, JSON.stringify(legitimate.error)).toBe('ACCEPTED');
		expect(legitimate.error).toBeUndefined();
		expect(pubStatus()).toBe('DISCARDED');

		// OTHER_PWA is published with one Undertaking instantiated from it — the second invariant refusal.
		createDraftPwa(OTHER_PWA);
		defineType(FOREIGN_ROOT, { isRoot: true }, OTHER_PWA);
		expect(d('SubmitPwaForReview', {}, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		expect(d('ValidatePwa', {}, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE').status).toBe(
			'ACCEPTED'
		);
		expect(
			d('PublishPwa', { rootPwuTypeId: FOREIGN_ROOT }, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE')
				.status
		).toBe('ACCEPTED');
		expect(
			d(
				'CreateUndertaking',
				{
					undertakingId: UND,
					name: 'U',
					description: 'd',
					pwaId: OTHER_PWA,
					pwaVersion: '1.0.0',
					instantiationProfile: 'Standard',
					objective: 'o',
					intendedOutputProduct: 'p'
				},
				UND,
				'UNDERTAKING'
			).status
		).toBe('ACCEPTED');

		const tombstone = d('DeletePwa', { pwaId: PWA }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		const inUse = d('DeletePwa', { pwaId: OTHER_PWA }, OTHER_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		const absent = d(
			'DeletePwa',
			{ pwaId: ABSENT_PWA },
			ABSENT_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		const refusals = [
			{
				member: 'already-deleted (a deliberate tombstone the professional created)',
				result: tombstone,
				code: 'RPH_INVARIANT_VIOLATION',
				category: 'INVARIANT',
				message: `PWA ${PWA} is already deleted`
			},
			{
				member: 'in use (an Undertaking was instantiated from it)',
				result: inUse,
				code: 'RPH_INVARIANT_VIOLATION',
				category: 'INVARIANT',
				message: `Cannot delete PWA ${OTHER_PWA}: 1 Undertaking(s) were instantiated from it (it is in use). Deprecate/retire it instead.`
			},
			{
				member: 'absent (no such PWA was ever created)',
				result: absent,
				code: 'RPH_VALIDATION_SEMANTIC_FAILED',
				category: 'VALIDATION',
				message: `Aggregate ${ABSENT_PWA} does not exist`
			}
		];
		// Every row's STATUS is read before any row's CODE is judged, so that a code failure leaves no dispatch
		// unread — otherwise this test's own red would arrive wearing REG-F-015's "fix the arrangement" coat.
		for (const row of refusals)
			expect(row.result.status, `DeletePwa refusal — ${row.member}`).toBe('REJECTED');
		for (const row of refusals) {
			const where = `DeletePwa refusal — ${row.member}`;
			expect(row.result.error?.code, where).toBe(row.code);
			expect(row.result.error?.category, where).toBe(row.category);
			expect(row.result.error?.message, where).toBe(row.message);
		}
		// And the discrimination stated as itself: a state the professional PRODUCED and a target that never
		// existed must not come back as the same kind of answer.
		expect(tombstone.error?.code, 'a tombstone must not report as an absent aggregate').not.toBe(
			absent.error?.code
		);
		// The refusal is the whole effect: no second tombstone was appended for PWA (the docblock's
		// "idempotent-safe" is a REFUSAL, not a second write), and the in-use PWA is exactly as it was.
		expect(store.readAllEvents().filter((e) => e.eventType === 'PwaDeleted')).toHaveLength(1);
		expect(pubStatus(OTHER_PWA)).toBe('PUBLISHED');
	});
});

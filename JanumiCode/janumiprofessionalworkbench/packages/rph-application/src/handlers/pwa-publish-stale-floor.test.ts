// Drives the PWA authoring pipeline LIVE to ask a question no existing test asks: does the PublishPwa CALL SITE
// enforce the floor's version binding when the graph is edited AFTER the floor was recorded? The neighbouring
// pwa-authoring.test.ts proves floorGateBlock's version check works by hand-recording a floor against v2 while the
// PWA sits at v1 — it manufactures the drift instead of causing it. Here the drift is caused the only way it can
// happen in production: by a real authoring command. Nothing else is faked.
//
// Guide §10.1 L1379: "Claims, Assessments, Decisions, and waivers bind exact subject semantic versions;"
// Guide §8.4 L854: "A missing, stale, malformed, failed, unavailable, or independence-invalid required review
// cannot satisfy assurance or permit its protected transition."
//
// DEAD KERNEL: packages/rph-domain/src/governance.ts:95 decisionAuthorizesVersions(d, currentSubjectVersions)
// already decides exactly this ("the prior decision does not carry to it — the subject is (re-)review-required")
// and is called only by its own tests. The authoring plane never bumps semanticVersion, so floor-gate.ts:95's
// version comparison has nothing to compare and the kernel's ruling is never asked for.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedFloorPolicies } from './__tests__/floor-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
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

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S00';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S10';
const SMUGGLED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S20';
const FLOOR = ['floor.schema-invariant', 'floor.identity-provenance', 'floor.reasoning-review'];

describe('PublishPwa: a floor satisfied BEFORE a graph edit must not authorize the edited graph', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;
	let asmtSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
		seedFloorPolicies(engine); // the floor assessment below cites floor.* policies — now they must exist
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
			correlationId: 'stale-floor',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const pwaState = () =>
		store.loadObject(PWA)?.state as { publicationStatus: string; semanticVersion?: number };
	const ulid = (prefix: string) => `${prefix}_${String(++asmtSeq).padStart(26, '0')}`;

	function definePwuType(id: string, name: string, isRoot: boolean) {
		const r = d(
			AGENT,
			'DefinePwuType',
			{ pwuTypeId: id, pwaId: PWA, pwuKind: 'PRODUCT_REALIZATION', name, purpose: 'p', isRoot },
			id,
			'PWU_TYPE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	/** Attach `childId` under ROOT so the graph stays a valid recursive decomposition (every type reachable from the
	 *  one root). Without this the added type is an ORPHAN, and ValidatePwa now rejects an orphaned graph outright
	 *  (§11.6 L1639, "no missing/disallowed/cyclic child rules") — which would block this test's subject (the STALE
	 *  FLOOR) behind an unrelated structural failure it is not trying to test. This is a material graph edit in its
	 *  own right, so it raises the PWA's semanticVersion again; that only widens the drift being asserted. */
	function permitChildOfRoot(childId: string) {
		const r = d(
			AGENT,
			'EditPwuType',
			{ pwuTypeId: ROOT, permittedChildTypeIds: [childId] },
			ROOT,
			'PWU_TYPE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	// The assurance run over the graph AS IT STANDS: all three floor policies SATISFIED, bound to the PWA's version
	// at the moment of review (read from state, not assumed — the binding must track whatever the engine reports).
	function recordSatisfiedFloorAtCurrentVersion() {
		const version = Number(pwaState().semanticVersion ?? 1);
		for (const policyId of FLOOR) {
			const assessmentId = ulid('asmt');
			const req = d(
				SVC,
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [PWA],
					subjectSemanticVersions: { [PWA]: version },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
			// assessment in READY, so it must be BEGUN before it can be assessed or completed.
			d(
				SVC,
				'BeginAssuranceAssessment',
				{},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			expect(req.status, JSON.stringify(req.error)).toBe('ACCEPTED');
			const done = d(
				SVC,
				'CompleteAssuranceAssessment',
				{
					validatorResult: floorValidatorResult({
						assessmentId,
						policyId,
						subjectId: PWA,
						subjectSemanticVersion: version,
						disposition: 'SATISFIED'
					})
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		}
		return version;
	}

	function livePwuTypeIds(): string[] {
		const ids = new Set<string>();
		for (const e of store.readAllEvents())
			if (e.aggregateType === 'PWU_TYPE') ids.add(e.aggregateId);
		return [...ids].filter((id) => {
			const s = store.loadObject(id)?.state as { pwaId?: string; status?: string } | undefined;
			return s?.pwaId === PWA && s.status !== 'REMOVED';
		});
	}

	it('rejects PublishPwa when a PWU Type was added to the graph after the floor was satisfied', () => {
		d(
			AGENT,
			'CreatePwa',
			{
				pwaId: PWA,
				name: 'Agent-authored',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		definePwuType(ROOT, 'Product Realization', true);

		// Step 1 — the floor runs over the two-object graph and is SATISFIED. This is the authority to publish.
		const reviewedVersion = recordSatisfiedFloorAtCurrentVersion();
		expect(livePwuTypeIds()).toHaveLength(1);

		// Step 2 — the graph is then MATERIALLY edited: a PWU Type the review never saw is added. Every artifact the
		// floor's Reasoning Review reasoned about is now out of date.
		definePwuType(SMUGGLED, 'Never Reviewed', false);
		permitChildOfRoot(SMUGGLED);
		expect(livePwuTypeIds()).toHaveLength(2);

		// Step 3 — publish. The recorded floor binds `reviewedVersion` (§10.1 L1379). It is stale with respect to the
		// graph now being published, so per §8.4 L854 it cannot permit this protected transition.
		// ⭐⭐ RESTATED BY PACKAGE L11 — design D66 (`REG-D-155`; `l11-facts.md` §3 (e)): SubmitPwaForReview now asks the floor PublishPwa asks,
		// so it refuses this PWA first, while it is DRAFT and can still be edited — D66's own case, a floor a type's edit has left at another
		// version. Then PublishPwa's own check, the second guard, is reached as a store written before L11 holds the PWA (Submit then had no
		// guard): VALIDATED, as Submit and Validate left it.
		const before = store.readAllEvents().length;
		const submitted = d(AGENT, 'SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(submitted.status, 'Submit admitted a PWA whose floor PublishPwa refuses (D66)').toBe('REJECTED');
		expect(submitted.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(submitted.error?.message).toContain(
			`The floor, PublishPwa's check: the de minimis assurance floor is not SATISFIED at v${Number(pwaState().semanticVersion ?? 1)} (`
		);
		expect([pwaState().publicationStatus, store.readAllEvents().length - before], 'a refused Submit moved the PWA').toEqual(['DRAFT', 0]);
		asAStoreBeforeL11Holds();
		const r = d(
			AGENT,
			'PublishPwa',
			{ rootPwuTypeId: ROOT },
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);

		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pwaState().publicationStatus).toBe('VALIDATED');
		// Diagnosis, asserted last so the control failure above is what surfaces first: the floor's binding is only
		// meaningful if the edit moved the version off the one the review bound.
		expect(Number(pwaState().semanticVersion ?? 1)).not.toBe(reviewedVersion);
		// ⭐⭐ L11 — Submit and Publish named the same dispositions (`pwaFloorFailure`, the one decision both call).
		const dispositions = (m: string | undefined) => /not SATISFIED (?:for PWA \S+ )?at v\d+ \(([^)]*)\)/.exec(m ?? '')?.[1];
		expect(dispositions(submitted.error?.message), 'Submit and Publish named other dispositions').toBe(dispositions(r.error?.message));
	});

	/**
	 * ⭐⭐ L11 (D66; `REG-D-155` (2)) — THE PWA VALIDATED, AS A STORE WRITTEN BEFORE PACKAGE L11 HOLDS IT. Until L11 SubmitPwaForReview had no
	 * guard, so Submit and Validate took this PWA to VALIDATED, and PublishPwa's own floor check is the second guard for a store that holds it;
	 * since L11 no command takes it past DRAFT. Written as the two transitions left it — the status and its `lifecycleStatus` mirror, the
	 * revision moved and the semantic version not — with no event, the repository's way of arranging a state no command reaches
	 * (`sta6-superseded-intent.test.ts`).
	 */
	function asAStoreBeforeL11Holds(): void {
		const stored = store.loadObject(PWA);
		expect(stored?.objectType, 'arrangement: the PWA').toBe('PROFESSIONAL_WORK_ARCHITECTURE');
		const tag = `fixture-l11-${PWA}-VALIDATED`;
		const written = store.commit({
			aggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			aggregateId: PWA,
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			expectedRevision: stored!.revision,
			newRevision: stored!.revision + 1,
			newSemanticVersion: stored!.semanticVersion,
			currentState: { ...(stored!.state as Record<string, unknown>), publicationStatus: 'VALIDATED', lifecycleStatus: 'VALIDATED' },
			events: [],
			receipt: { commandId: tag, idempotencyKey: tag, commandType: 'FixtureSeedPublicationStatus', targetAggregateId: PWA, status: 'ACCEPTED', producedEventIds: [] }
		});
		expect(written.ok, 'arrangement: the status was not written').toBe(true);
	}

	// The mechanism behind the test above, isolated: floor-gate.ts:95 compares `rec?.version === opts.subjectVersion`,
	// which can only ever fire if an authoring command moves the PWA's semanticVersion. Nothing does.
	it('bumps the PWA semanticVersion when its graph is materially edited', () => {
		d(
			AGENT,
			'CreatePwa',
			{
				pwaId: PWA,
				name: 'Agent-authored',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		definePwuType(ROOT, 'Product Realization', true);
		const before = Number(pwaState().semanticVersion ?? 1);

		definePwuType(SMUGGLED, 'Never Reviewed', false);

		expect(Number(pwaState().semanticVersion ?? 1)).toBeGreaterThan(before);
	});
});

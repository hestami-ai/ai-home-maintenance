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
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const AGENT: ActorReference = { actorId: 'agent-1', actorType: 'AGENT', displayName: 'Authoring Agent' };
const SVC: ActorReference = { actorId: 'assurance', actorType: 'SERVICE', displayName: 'Assurance' };

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S00';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S10';
const SMUGGLED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S20';
const FLOOR = ['floor.schema-invariant', 'floor.identity-provenance', 'floor.reasoning-review'];

describe('PublishPwa: a floor satisfied BEFORE a graph edit must not authorize the edited graph', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	let asmtSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function d(actor: ActorReference, commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
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
			expect(req.status, JSON.stringify(req.error)).toBe('ACCEPTED');
			const done = d(
				SVC,
				'CompleteAssuranceAssessment',
				{ validatorResult: { dispositionRecommendation: 'SATISFIED' } },
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		}
		return version;
	}

	function livePwuTypeIds(): string[] {
		const ids = new Set<string>();
		for (const e of store.readAllEvents()) if (e.aggregateType === 'PWU_TYPE') ids.add(e.aggregateId);
		return [...ids].filter((id) => {
			const s = store.loadObject(id)?.state as { pwaId?: string; status?: string } | undefined;
			return s?.pwaId === PWA && s.status !== 'REMOVED';
		});
	}

	it('rejects PublishPwa when a PWU Type was added to the graph after the floor was satisfied', () => {
		d(
			AGENT,
			'CreatePwa',
			{ pwaId: PWA, name: 'Agent-authored', description: 'd', domain: 'software', version: '1.0.0' },
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
		expect(livePwuTypeIds()).toHaveLength(2);

		// Step 3 — publish. The recorded floor binds `reviewedVersion` (§10.1 L1379). It is stale with respect to the
		// graph now being published, so per §8.4 L854 it cannot permit this protected transition.
		d(AGENT, 'SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		d(AGENT, 'ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		const r = d(AGENT, 'PublishPwa', { rootPwuTypeId: ROOT }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pwaState().publicationStatus).toBe('VALIDATED');
		// Diagnosis, asserted last so the control failure above is what surfaces first: the floor's binding is only
		// meaningful if the edit moved the version off the one the review bound.
		expect(Number(pwaState().semanticVersion ?? 1)).not.toBe(reviewedVersion);
	});

	// The mechanism behind the test above, isolated: floor-gate.ts:95 compares `rec?.version === opts.subjectVersion`,
	// which can only ever fire if an authoring command moves the PWA's semanticVersion. Nothing does.
	it('bumps the PWA semanticVersion when its graph is materially edited', () => {
		d(
			AGENT,
			'CreatePwa',
			{ pwaId: PWA, name: 'Agent-authored', description: 'd', domain: 'software', version: '1.0.0' },
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		definePwuType(ROOT, 'Product Realization', true);
		const before = Number(pwaState().semanticVersion ?? 1);

		definePwuType(SMUGGLED, 'Never Reviewed', false);

		expect(Number(pwaState().semanticVersion ?? 1)).toBeGreaterThan(before);
	});
});

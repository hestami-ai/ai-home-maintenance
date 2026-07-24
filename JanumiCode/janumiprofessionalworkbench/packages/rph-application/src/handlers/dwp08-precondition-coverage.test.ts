// JAN-CMDPRE DWP-08 — per-site precondition coverage for the commitState sites (the reader-precondition variant,
// critique B4). These are EDITS / DELETIONS / appends, not status advances, so each carries a per-site PREDICATE
// (not a fromStates set), evaluated inline via checkPrecondition before commitState. Rule KINDs:
//   EDIT — refuse a no-op (every payload-present field already equals current): editAssurancePolicy, editPwa, editPwuType
//   DELETION — refuse a re-remove of an already-removed target: removePwuType (deletePwa already had this guard)
//   EVENT-LOG-DEPENDENT (reader) — refuse a duplicate the event log reveals: submitEvidenceForAssessment
//   EDIT sub-rule — refuse an empty batch: appendConversationEntries (the duplicate-BATCH rule is DEFERRED — a
//     content-only key would over-refuse a legitimately recurring identical turn; see the residual register)
//
// EVERY site proves BOTH halves: the refusable case is REFUSED, and — the over-refusal trap this DWP exists to avoid —
// the LEGITIMATE case still SUCCEEDS. Mutation red-proof (neuter checkPrecondition) is performed live in implementation.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-24T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'User' };

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'dwp08',
			idempotencyKey: `k-${n}`, // distinct each time — a re-issue is a new request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	};
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	const revisionOf = (id: string) => store.loadObject(id)?.revision;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	return { store, engine, d, stateOf, revisionOf, eventsOfType };
}

function policyPayload(policyId: string, over: Record<string, unknown> = {}) {
	return {
		policyId,
		version: '1.0.0',
		name: 'Test Policy',
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
		independenceRequirement: 'NONE',
		findingDefinitions: [
			{
				code: 'F-01',
				name: 'F 01',
				description: 's',
				defaultSeverity: 'MATERIAL',
				affectedClaimTypes: ['CORRECTNESS'],
				defaultControlActions: ['CLARIFY']
			}
		],
		permittedControlActions: ['CLARIFY'],
		...over
	};
}

// ───────────────────────────── EditAssurancePolicy (EDIT no-op) ──────────────────────────────────────────────────
describe('DWP-08 EditAssurancePolicy — refuse a no-op edit; a real edit succeeds', () => {
	let h: ReturnType<typeof harness>;
	const P = 'pol_dwp08_01';
	beforeEach(() => {
		h = harness();
		expect(h.d('CreateAssurancePolicy', P, 'ASSURANCE_POLICY', policyPayload(P)).status).toBe(
			'ACCEPTED'
		);
	});

	it('REFUSES a no-op edit (payload fields all equal current), no 2nd AssurancePolicyEdited, no rev bump', () => {
		const rev = h.revisionOf(P);
		const r = h.d('EditAssurancePolicy', P, 'ASSURANCE_POLICY', { policyId: P, name: 'Test Policy' });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(h.eventsOfType('AssurancePolicyEdited')).toHaveLength(0);
		expect(h.revisionOf(P), 'no silent revision bump').toBe(rev);
	});

	it('ACCEPTS a real edit that changes a field (the legitimate case)', () => {
		const r = h.d('EditAssurancePolicy', P, 'ASSURANCE_POLICY', { policyId: P, name: 'Renamed' });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((h.stateOf(P) as { name: string }).name).toBe('Renamed');
		expect(h.eventsOfType('AssurancePolicyEdited')).toHaveLength(1);
	});
});

// ───────────────────────── submitEvidenceForAssessment (EVENT-LOG-DEPENDENT / reader) ────────────────────────────
describe('DWP-08 submitEvidenceForAssessment — refuse a duplicate (evidenceId, requirement); legit submissions succeed', () => {
	let h: ReturnType<typeof harness>;
	const POL = 'pol_dwp08_ev';
	const ASSESS = 'asmt_01ARZ3NDEKTSV4RRFFQ69GH800';
	const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69GH810';
	const req = {
		id: 'EV-01',
		evidenceType: 'TEST_RESULT',
		description: 'unit tests pass',
		purpose: 'demonstrate correctness',
		cardinality: 'AT_LEAST_ONE',
		admissibilityRules: [],
		requiredForDispositions: 'ALL',
		mayBeWaived: false
	};
	const submit = (evidenceId: string, satisfiesRequirementId: string) =>
		h.d('SubmitEvidenceForAssessment', ASSESS, 'ASSURANCE_ASSESSMENT', {
			evidenceId,
			satisfiesRequirementId
		});

	beforeEach(() => {
		h = harness();
		expect(
			h.d('CreateAssurancePolicy', POL, 'ASSURANCE_POLICY', policyPayload(POL, { requiredEvidence: [req] }))
				.status
		).toBe('ACCEPTED');
		expect(h.d('ActivateAssurancePolicy', POL, 'ASSURANCE_POLICY', { policyId: POL }).status).toBe(
			'ACCEPTED'
		);
		expect(
			h.d('RequestAssuranceAssessment', ASSESS, 'ASSURANCE_ASSESSMENT', {
				assessmentId: ASSESS,
				assurancePolicyId: POL,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			}).status
		).toBe('ACCEPTED');
	});

	it('ACCEPTS the FIRST submission (zero state delta by design — must NOT be refused as a "no change")', () => {
		const r = submit('evd_1', 'EV-01');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(h.eventsOfType('AssuranceEvidenceReceived')).toHaveLength(1);
	});

	it('REFUSES the SAME (evidenceId, requirement) re-submitted; no 2nd AssuranceEvidenceReceived', () => {
		expect(submit('evd_1', 'EV-01').status).toBe('ACCEPTED');
		const again = submit('evd_1', 'EV-01');
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(h.eventsOfType('AssuranceEvidenceReceived')).toHaveLength(1);
	});

	it('ACCEPTS DIFFERENT evidence for the same requirement (the legitimate case — not a duplicate)', () => {
		expect(submit('evd_1', 'EV-01').status).toBe('ACCEPTED');
		const r = submit('evd_2', 'EV-01');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(h.eventsOfType('AssuranceEvidenceReceived')).toHaveLength(2);
	});
});

// ───────────────────────────── appendConversationEntries (empty-batch; dup-batch DEFERRED) ───────────────────────
describe('DWP-08 appendConversationEntries — refuse an empty batch; a recurring identical batch STILL succeeds (dup rule deferred)', () => {
	let h: ReturnType<typeof harness>;
	const CONV = 'conv_01ARZ3NDEKTSV4RRFFQ69GH820';
	const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GH830';
	const entry = (text: string) => ({ role: 'assistant', kind: 'message', text });
	const append = (entries: unknown[]) =>
		h.d('AppendConversationEntries', CONV, 'AUTHORING_CONVERSATION', {
			conversationId: CONV,
			pwaId: PWA,
			entries
		});

	beforeEach(() => {
		h = harness();
	});

	it('REFUSES an empty entries batch (no ConversationEntriesAppended)', () => {
		expect(append([entry('hi')]).status).toBe('ACCEPTED'); // first append creates the aggregate
		const r = append([]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(h.eventsOfType('ConversationEntriesAppended')).toHaveLength(1);
	});

	it('ACCEPTS a legitimately RECURRING identical batch across turns (the dup-batch rule is DEFERRED — no over-refusal)', () => {
		expect(append([entry('OK')]).status).toBe('ACCEPTED');
		// A deterministic/mock agent re-issuing the same instruction produces a byte-identical batch. It MUST still
		// be accepted — refusing it (a content-only key) is the over-refusal DWP-08 deliberately did not ship.
		const r = append([entry('OK')]);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(h.eventsOfType('ConversationEntriesAppended')).toHaveLength(2);
	});
});

// ───────────────────────────── editPwa / editPwuType (EDIT no-op) + removePwuType (DELETION) ─────────────────────
describe('DWP-08 pwa-authoring EDIT/DELETION sites', () => {
	let h: ReturnType<typeof harness>;
	const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GH840';
	const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69GH850';

	function draftPwaWithType() {
		expect(
			h.d('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
				pwaId: PWA,
				name: 'A',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('DefinePwuType', ROOT, 'PWU_TYPE', {
				pwuTypeId: ROOT,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			}).status
		).toBe('ACCEPTED');
	}

	beforeEach(() => {
		h = harness();
		draftPwaWithType();
	});

	it('EditPwa — REFUSES a no-op edit; ACCEPTS a real edit', () => {
		// DefinePwuType (setup) already emitted one PwaEdited via the version bump — the no-op must add NONE.
		const pwaEditedBefore = h.eventsOfType('PwaEdited').length;
		const revBefore = h.revisionOf(PWA);
		const noop = h.d('EditPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { pwaId: PWA, name: 'A' });
		expect(noop.status).toBe('REJECTED');
		expect(noop.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(h.eventsOfType('PwaEdited'), 'no 2nd PwaEdited from the no-op').toHaveLength(pwaEditedBefore);
		expect(h.revisionOf(PWA), 'no silent revision bump on the no-op').toBe(revBefore);

		const real = h.d('EditPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { pwaId: PWA, name: 'B' });
		expect(real.status, JSON.stringify(real.error)).toBe('ACCEPTED');
		expect((h.stateOf(PWA) as { name: string }).name).toBe('B');
	});

	it('EditPwuType — REFUSES a no-op edit; ACCEPTS a real edit (and does not re-bump the PWA semanticVersion on the no-op)', () => {
		const semverBefore = (h.stateOf(PWA) as { semanticVersion: number }).semanticVersion;
		const noop = h.d('EditPwuType', ROOT, 'PWU_TYPE', { pwuTypeId: ROOT, name: 'R' });
		expect(noop.status).toBe('REJECTED');
		expect(noop.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(h.eventsOfType('PwuTypeRedefined')).toHaveLength(0);
		expect(
			(h.stateOf(PWA) as { semanticVersion: number }).semanticVersion,
			'no INV-6 semver re-bump on a no-op'
		).toBe(semverBefore);

		const real = h.d('EditPwuType', ROOT, 'PWU_TYPE', { pwuTypeId: ROOT, name: 'Renamed' });
		expect(real.status, JSON.stringify(real.error)).toBe('ACCEPTED');
		expect((h.stateOf(ROOT) as { name: string }).name).toBe('Renamed');
	});

	it('RemovePwuType — ACCEPTS the first removal; REFUSES a re-remove of an already-REMOVED type', () => {
		// Give the root a sibling so it is removable (a lone root has no dangling-ref issue anyway).
		const first = h.d('RemovePwuType', ROOT, 'PWU_TYPE', { pwuTypeId: ROOT });
		expect(first.status, JSON.stringify(first.error)).toBe('ACCEPTED');
		expect((h.stateOf(ROOT) as { status: string }).status).toBe('REMOVED');

		const again = h.d('RemovePwuType', ROOT, 'PWU_TYPE', { pwuTypeId: ROOT });
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(h.eventsOfType('PwuTypeRemoved')).toHaveLength(1);
	});
});

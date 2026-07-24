// JAN-CMDPRE DWP-03 — per-site precondition coverage for the intent, evidence/assumption, and
// decomposition/recomposition families (DS-001 D4). Each site now declares the source-state set derived from its
// machine's own in-arrows (the mechanism itself is proven in command-precondition.test.ts). This file proves the
// site-level contract the roadmap requires: a RE-ISSUE against an already-advanced aggregate is REFUSED with no
// second event, and the WIDEST legitimate in-arrow the seed does not already exercise still succeeds — the
// regression a hand-authored source set is most likely to cause.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-23T00:00:00Z';
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
			correlationId: 'dwp03',
			idempotencyKey: `k-${n}`, // distinct each time — a re-issue is a new request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	};
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	return { store, engine, d, stateOf, eventsOfType };
}

// ─────────────────────────────────────────── Intent (advanceIntent, 4 sites) ───────────────────────────────────
describe('DWP-03 intent — each advanceIntent site refuses a re-issue on its own machine in-arrows', () => {
	let h: ReturnType<typeof harness>;
	const INT = 'int_01ARZ3NDEKTSV4RRFFQ69G5W00';
	const ver = () => Number((h.stateOf(INT) as { semanticVersion?: number }).semanticVersion ?? 1);

	beforeEach(() => {
		h = harness();
		expect(
			h.d('CaptureIntent', INT, 'INTENT', {
				intentId: INT,
				originatingExpression: 'ship the thing',
				ontologyId: 'o',
				ontologyVersion: '1'
			}).status
		).toBe('ACCEPTED');
	});

	const formalizePayload = {
		formalizedObjective: 'Ship the thing',
		desiredOutcomes: [{ description: 'the thing ships' }],
		successConditions: [{ statement: 'it shipped' }],
		nonGoals: [],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: []
	};

	function driveToApproved() {
		expect(h.d('BeginIntentDiscovery', INT, 'INTENT', {}).status).toBe('ACCEPTED');
		expect(h.d('ProvisionIntent', INT, 'INTENT', { ambiguityIds: [] }).status).toBe('ACCEPTED');
		expect(h.d('FormalizeIntent', INT, 'INTENT', formalizePayload).status).toBe('ACCEPTED');
		expect(
			h.d('ApproveIntent', INT, 'INTENT', {
				decisionId: 'dec_1',
				approvedSemanticVersion: ver(),
				approvalScope: 'full'
			}).status
		).toBe('ACCEPTED');
	}

	it('BeginIntentDiscovery (from RAW) refuses a re-issue once UNDER_DISCOVERY', () => {
		expect(h.d('BeginIntentDiscovery', INT, 'INTENT', {}).status).toBe('ACCEPTED');
		const again = h.d('BeginIntentDiscovery', INT, 'INTENT', {});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('IntentDiscoveryStarted')).toHaveLength(1);
	});

	it('ProvisionIntent (from UNDER_DISCOVERY) refuses a re-issue once PROVISIONAL', () => {
		h.d('BeginIntentDiscovery', INT, 'INTENT', {});
		expect(h.d('ProvisionIntent', INT, 'INTENT', { ambiguityIds: [] }).status).toBe('ACCEPTED');
		const again = h.d('ProvisionIntent', INT, 'INTENT', { ambiguityIds: [] });
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('IntentProvisioned')).toHaveLength(1);
	});

	it('FormalizeIntent (from PROVISIONAL) refuses a re-issue once FORMALIZED', () => {
		h.d('BeginIntentDiscovery', INT, 'INTENT', {});
		h.d('ProvisionIntent', INT, 'INTENT', { ambiguityIds: [] });
		expect(h.d('FormalizeIntent', INT, 'INTENT', formalizePayload).status).toBe('ACCEPTED');
		const again = h.d('FormalizeIntent', INT, 'INTENT', formalizePayload);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('IntentFormalized')).toHaveLength(1);
	});

	it('ApproveIntent refuses a re-issue once APPROVED (source APPROVED is not FORMALIZED|REVISED)', () => {
		driveToApproved();
		const again = h.d('ApproveIntent', INT, 'INTENT', {
			decisionId: 'dec_1',
			approvedSemanticVersion: ver(),
			approvalScope: 'full'
		});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('IntentApproved')).toHaveLength(1);
	});

	it('ApproveIntent still accepts the WIDER machine in-arrow REVISED -> APPROVED (the vocab-narrower case)', () => {
		driveToApproved();
		expect(h.d('ReviseIntent', INT, 'INTENT', { changeRationale: 'a real revision' }).status).toBe(
			'ACCEPTED'
		);
		expect((h.stateOf(INT) as { intentStatus: string }).intentStatus).toBe('REVISED');
		// Re-approval from REVISED is legitimate (the machine's second in-arrow); the precondition must admit it.
		const re = h.d('ApproveIntent', INT, 'INTENT', {
			decisionId: 'dec_2',
			approvedSemanticVersion: ver(), // the revision bumped the version; bind the current one
			approvalScope: 'full'
		});
		expect(re.status, JSON.stringify(re.error)).toBe('ACCEPTED');
		expect((h.stateOf(INT) as { intentStatus: string }).intentStatus).toBe('APPROVED');
		expect(h.eventsOfType('IntentApproved')).toHaveLength(2); // two DISTINCT approvals, correctly
	});
});

// ─────────────────────────────────────── Evidence + Assumption (advanceStatus) ──────────────────────────────────
describe('DWP-03 evidence/assumption — re-issue refused on Evidence.status / Assumption.status in-arrows', () => {
	let h: ReturnType<typeof harness>;
	const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5W10';
	const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5W20';

	beforeEach(() => {
		h = harness();
	});

	// An ADMISSIBLE evidence: everything §8.11 needs (scope stated, provenance, content, limitations recorded).
	function proposeAdmissible() {
		expect(
			h.d('ProposeEvidence', EV, 'EVIDENCE', {
				evidenceId: EV,
				evidenceType: 'TEST_RESULT',
				contentReference: {},
				producedBy: HUMAN,
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: 'architecture',
				limitations: [],
				capturedAt: TS
			}).status
		).toBe('ACCEPTED');
		expect((h.stateOf(EV) as { status: string }).status).toBe('PROPOSED');
	}

	it('AdmitEvidence (from PROPOSED) refuses a re-issue once ADMISSIBLE', () => {
		proposeAdmissible();
		expect(
			h.d('AdmitEvidence', EV, 'EVIDENCE', {
				admissibilityAssessmentId: 'a',
				admittedScope: 'architecture',
				admittedClaimIds: []
			}).status
		).toBe('ACCEPTED');
		expect((h.stateOf(EV) as { status: string }).status).toBe('ADMISSIBLE');

		const again = h.d('AdmitEvidence', EV, 'EVIDENCE', {
			admissibilityAssessmentId: 'a2',
			admittedScope: 'architecture',
			admittedClaimIds: []
		});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('EvidenceAdmitted')).toHaveLength(1);
	});

	it('InvalidateEvidence (from ADMISSIBLE) refuses a re-issue once INVALIDATED', () => {
		proposeAdmissible();
		h.d('AdmitEvidence', EV, 'EVIDENCE', {
			admissibilityAssessmentId: 'a',
			admittedScope: 'architecture',
			admittedClaimIds: []
		});
		expect(
			h.d('InvalidateEvidence', EV, 'EVIDENCE', { invalidationReason: 'superseded by v2' }).status
		).toBe('ACCEPTED');
		expect((h.stateOf(EV) as { status: string }).status).toBe('INVALIDATED');

		const again = h.d('InvalidateEvidence', EV, 'EVIDENCE', {
			invalidationReason: 'a different, contradicting reason'
		});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('EvidenceInvalidated')).toHaveLength(1);
	});

	it('ExpireAssumption (from PROPOSED, one of four in-arrows) refuses a re-issue once EXPIRED', () => {
		expect(
			h.d('DetectAssumption', ASM, 'ASSUMPTION', {
				assumptionId: ASM,
				statement: 'the network is reliable',
				introducedBy: HUMAN,
				affectedObjectIds: [],
				materiality: 'MATERIAL'
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('ExpireAssumption', ASM, 'ASSUMPTION', { expirationCondition: 'review window closed' })
				.status
		).toBe('ACCEPTED');
		expect((h.stateOf(ASM) as { status: string }).status).toBe('EXPIRED');

		const again = h.d('ExpireAssumption', ASM, 'ASSUMPTION', {
			expirationCondition: 'a second expiry'
		});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('AssumptionExpired')).toHaveLength(1);
	});
});

// ─────────────────────────────────── Decomposition + Recomposition (advanceStatus) ──────────────────────────────
describe('DWP-03 decomposition/recomposition — re-issue refused + the re-evaluation in-arrow honoured', () => {
	let h: ReturnType<typeof harness>;
	const INT = 'int_01ARZ3NDEKTSV4RRFFQ69G5W30';
	const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W31';
	const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W3A';
	const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W3B';
	const DCP = 'dcp_01ARZ3NDEKTSV4RRFFQ69G5W32';
	const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5W33';
	const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5W34';
	const statusOf = (id: string) => (h.stateOf(id) as { status?: string })?.status ?? '';

	function proposePwu(id: string) {
		expect(
			h.d('ProposePwu', id, 'PROFESSIONAL_WORK_UNIT', {
				pwuId: id,
				pwuKind: 'ARCHITECTURE',
				title: id,
				description: 'd',
				intentId: INT,
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
			}).status
		).toBe('ACCEPTED');
	}

	beforeEach(() => {
		h = harness();
		h.d('CaptureIntent', INT, 'INTENT', {
			intentId: INT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		});
		proposePwu(PARENT);
		proposePwu(CHILD_A);
		proposePwu(CHILD_B);
	});

	function proposeDecomposition() {
		expect(
			h.d('ProposeDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PARENT,
				childWorkUnitIds: [CHILD_A, CHILD_B],
				rationale: 'split'
			}).status
		).toBe('ACCEPTED');
		expect(statusOf(DCP)).toBe('UNDER_REVIEW');
	}

	it('ValidateDecomposition (from UNDER_REVIEW) refuses a re-issue once VALID — no contradicting second verdict', () => {
		proposeDecomposition();
		expect(h.d('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition: 'VALID' }).status).toBe(
			'ACCEPTED'
		);
		expect(statusOf(DCP)).toBe('VALID');

		// A re-issue with the SAME disposition is a NOOP checkTransition would admit; the precondition refuses it.
		const again = h.d('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition: 'VALID' });
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('DecompositionValidated')).toHaveLength(1);
	});

	it('ReviseDecomposition also supersedes from CONDITIONALLY_VALID and INVALID (the full machine set, not just VALID)', () => {
		// CONDITIONALLY_VALID -> SUPERSEDED
		proposeDecomposition();
		h.d('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition: 'CONDITIONALLY_VALID' });
		expect(statusOf(DCP)).toBe('CONDITIONALLY_VALID');
		expect(
			h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { rationale: 'refine' }).status
		).toBe('ACCEPTED');
		expect(statusOf(DCP)).toBe('SUPERSEDED');

		// INVALID -> SUPERSEDED (a fresh contract; INVALID skips the conservation guard entirely)
		const DCP2 = 'dcp_01ARZ3NDEKTSV4RRFFQ69G5W35';
		expect(
			h.d('ProposeDecomposition', DCP2, 'DECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PARENT,
				childWorkUnitIds: [CHILD_A, CHILD_B],
				rationale: 'split'
			}).status
		).toBe('ACCEPTED');
		h.d('ValidateDecomposition', DCP2, 'DECOMPOSITION_CONTRACT', { disposition: 'INVALID' });
		expect(statusOf(DCP2)).toBe('INVALID');
		expect(
			h.d('ReviseDecomposition', DCP2, 'DECOMPOSITION_CONTRACT', { rationale: 'redo' }).status
		).toBe('ACCEPTED');
		expect(statusOf(DCP2)).toBe('SUPERSEDED');
	});

	it('ReviseDecomposition (from VALID) supersedes, then refuses a re-issue once SUPERSEDED', () => {
		proposeDecomposition();
		h.d('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition: 'VALID' });
		expect(
			h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { rationale: 'refine' }).status
		).toBe('ACCEPTED');
		expect(statusOf(DCP)).toBe('SUPERSEDED');
		const verAfter = (h.stateOf(DCP) as { semanticVersion?: number }).semanticVersion;

		const again = h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { rationale: 'again' });
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('DecompositionRevised')).toHaveLength(1);
		// no silent semanticVersion inflation from the refused re-revise
		expect((h.stateOf(DCP) as { semanticVersion?: number }).semanticVersion).toBe(verAfter);
	});

	function beginRecomposition(children: string[], conflictRules: unknown[] = []) {
		expect(
			h.d('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PARENT,
				requiredChildWorkUnitIds: children,
				parentCompletionClaimId: CLAIM,
				conflictResolutionRules: conflictRules
			}).status
		).toBe('ACCEPTED');
		expect(h.d('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP }).status).toBe(
			'ACCEPTED'
		);
		expect(statusOf(RCP)).toBe('EVALUATING');
	}

	it('BeginRecomposition (from READY) refuses a re-issue once EVALUATING — the only NOOP', () => {
		beginRecomposition([]);
		const again = h.d('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP });
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('RecompositionStarted')).toHaveLength(1);
	});

	it('BeginRecomposition still accepts the re-evaluation in-arrow CONFLICTED -> EVALUATING (the machine-wide set)', () => {
		beginRecomposition([CHILD_A, CHILD_B]);
		// Complete with a detected conflict -> CONFLICTED.
		expect(
			h.d('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentCompletionClaimId: CLAIM,
				detectedConflicts: [
					{
						conflictType: 'TENANT_IDENTITY_MISMATCH',
						conflictingChildWorkUnitIds: [CHILD_A, CHILD_B],
						description: 'incompatible tenant identity models'
					}
				]
			}).status
		).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('CONFLICTED');

		// Re-evaluation after remediation: BeginRecomposition from CONFLICTED is legitimate and must be ACCEPTED —
		// it emits a SECOND RecompositionStarted, which is a distinct attempt, not the refused NOOP.
		const reEval = h.d('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP });
		expect(reEval.status, JSON.stringify(reEval.error)).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('EVALUATING');
		expect(h.eventsOfType('RecompositionStarted')).toHaveLength(2);
	});

	it('CompleteRecomposition (from EVALUATING) refuses a re-issue once a terminal-ish outcome is recorded', () => {
		beginRecomposition([]); // no required children, no conflict -> COMPOSABLE
		expect(
			h.d('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { parentCompletionClaimId: CLAIM }).status
		).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('COMPOSABLE');

		const again = h.d('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentCompletionClaimId: CLAIM
		});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(statusOf(RCP)).toBe('COMPOSABLE'); // the refused re-issue left the recorded outcome untouched
	});
});

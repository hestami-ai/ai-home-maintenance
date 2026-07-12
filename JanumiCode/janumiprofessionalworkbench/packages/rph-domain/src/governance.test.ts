// M10 conformance: controller / governance decisions / baseline promotion. Each test binds to a numbered
// conformance test (RPH-GOV-*, RPH-BAS-*) or a named property (P5/P7) from the Executable Invariant &
// Conformance Test Spec, using the canonical Reference Undertaking fixture ids (dec_fsm_arch_001 approval,
// base_fsm_arch_001 architecture baseline) where the scenario is instance-specific.
import { describe, expect, it } from 'vitest';
import {
	assertBaselineItemSetImmutable,
	assessDecisionRevocation,
	authorizeDecisionEffective,
	canPromoteBaseline,
	canSupersedeBaseline,
	controllerMarksPwuSatisfied,
	decisionAuthorizesVersions,
	isEffectiveApproval,
	normalizeControlAction,
	selectControlAction,
	waiverCovers,
	waiverPreservesFindings,
	waiverStillDischarges,
	type BaselinePromotionInput,
	type DecisionView,
	type WaiverView
} from './index.js';

// ---- Fixture fragment: the architecture approval dec_fsm_arch_001 approves pwu_fsm_arch + art_fsm_architecture_002
// (v2) — an authorized, effective APPROVAL. ----
const decision = (over: Partial<DecisionView> = {}): DecisionView => ({
	decisionId: 'dec_fsm_arch_001',
	decisionType: 'APPROVAL',
	status: 'EFFECTIVE',
	subjectObjectIds: ['pwu_fsm_arch', 'art_fsm_architecture_002'],
	subjectSemanticVersions: { pwu_fsm_arch: 2, art_fsm_architecture_002: 2 },
	authorityHeld: true,
	...over
});

describe('M10 governance authority (RPH-GOV-001/002; §23.2, §35.5)', () => {
	it('RPH-GOV-001: an approval without authority is rejected RPH_AUTHORITY_INSUFFICIENT before it can be effective', () => {
		const r = authorizeDecisionEffective(decision({ status: 'PROPOSED', authorityHeld: false }));
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_AUTHORITY_INSUFFICIENT');
		const ok = authorizeDecisionEffective(decision({ status: 'PROPOSED', authorityHeld: true }));
		expect(ok.ok).toBe(true);
	});

	it('RPH-GOV-002: a recommendation (PROPOSED) is not an approval — no effective decision exists', () => {
		expect(isEffectiveApproval(decision({ status: 'PROPOSED' }))).toBe(false);
		expect(isEffectiveApproval(decision({ status: 'EFFECTIVE', authorityHeld: false }))).toBe(
			false
		);
		expect(isEffectiveApproval(decision())).toBe(true);
	});
});

describe('M10 version binding (RPH-GOV-003 / Property P5; §4)', () => {
	it('RPH-GOV-003 / P5: an approval of version 2 does not authorize version 3', () => {
		// current versions match the bound versions => still authorized
		expect(
			decisionAuthorizesVersions(decision(), { pwu_fsm_arch: 2, art_fsm_architecture_002: 2 }).ok
		).toBe(true);
		// art_fsm_architecture_002 bumped to v3 => the v2 decision no longer authorizes it
		const stale = decisionAuthorizesVersions(decision(), {
			pwu_fsm_arch: 2,
			art_fsm_architecture_002: 3
		});
		expect(stale.ok).toBe(false);
		expect(stale.staleSubjects).toEqual([
			{ subjectId: 'art_fsm_architecture_002', approvedVersion: 2, currentVersion: 3 }
		]);
	});
});

describe('M10 waivers (RPH-GOV-005/006, RPH-CNS-004; Catalog §12)', () => {
	const waiver = (over: Partial<WaiverView> = {}): WaiverView => ({
		decisionId: 'dec_waiver_ac04',
		status: 'EFFECTIVE',
		waivedCriterionId: 'AC-04',
		subjectObjectId: 'art_fsm_architecture_002',
		subjectSemanticVersion: 2,
		expired: false,
		...over
	});

	it('RPH-GOV-005: a waiver is scoped to its exact (criterion, object, version); it does not bleed', () => {
		const w = waiver();
		expect(waiverCovers(w, 'AC-04', 'art_fsm_architecture_002', 2)).toBe(true);
		expect(waiverCovers(w, 'AC-05', 'art_fsm_architecture_002', 2)).toBe(false); // another criterion
		expect(waiverCovers(w, 'AC-04', 'art_other', 2)).toBe(false); // another object
		expect(waiverCovers(w, 'AC-04', 'art_fsm_architecture_002', 3)).toBe(false); // another version
	});

	it('RPH-GOV-006 / RPH-CNS-004: an expired (or non-effective) waiver no longer discharges its finding', () => {
		expect(waiverStillDischarges(waiver())).toBe(true);
		expect(waiverStillDischarges(waiver({ expired: true }))).toBe(false);
		expect(waiverStillDischarges(waiver({ status: 'PROPOSED' }))).toBe(false);
	});

	it('RPH-GOV-004: a human override PRESERVES the finding (visible, WAIVED, rationale+authority, evidence unchanged)', () => {
		const ok = waiverPreservesFindings({
			findingVisible: true,
			findingDisposition: 'WAIVED',
			rationale: 'offline scope deferred from first increment',
			authorityHeld: true,
			evidenceUnchanged: true
		});
		expect(ok.ok, ok.reasons.join('; ')).toBe(true);
		// erasing the finding, silently satisfying it, or rewriting evidence each violates RPH-GOV-004
		expect(
			waiverPreservesFindings({
				findingVisible: false,
				findingDisposition: 'WAIVED',
				rationale: 'x',
				authorityHeld: true,
				evidenceUnchanged: true
			}).ok
		).toBe(false);
		expect(
			waiverPreservesFindings({
				findingVisible: true,
				findingDisposition: 'SATISFIED',
				rationale: 'x',
				authorityHeld: true,
				evidenceUnchanged: true
			}).ok
		).toBe(false);
		expect(
			waiverPreservesFindings({
				findingVisible: true,
				findingDisposition: 'WAIVED',
				rationale: 'x',
				authorityHeld: false,
				evidenceUnchanged: true
			}).ok
		).toBe(false);
		expect(
			waiverPreservesFindings({
				findingVisible: true,
				findingDisposition: 'WAIVED',
				rationale: 'x',
				authorityHeld: true,
				evidenceUnchanged: false
			}).ok
		).toBe(false);
	});
});

describe('M10 baseline promotion gate (RPH-BAS-001..004, RPH-GOV-006; §24.2, §35.2)', () => {
	// The fixture base_fsm_arch_001 items, promoted after remediation with all assessments SATISFIED.
	const items = [
		{ objectId: 'art_fsm_architecture_002', semanticVersion: 2, contentHash: 'h1' },
		{ objectId: 'art_fsm_context_001', semanticVersion: 1, contentHash: 'h2' }
	];
	const base = (over: Partial<BaselinePromotionInput> = {}): BaselinePromotionInput => ({
		baselineStatus: 'APPROVED',
		promotionDecision: decision({ decisionType: 'PROMOTE_BASELINE' }),
		candidateItems: items,
		reviewedItems: items,
		requiredAssessments: [
			{ assessmentId: 'assess_fsm_arch_coverage_002', complete: true, disposition: 'SATISFIED' },
			{
				assessmentId: 'assess_fsm_intent_preservation_001',
				complete: true,
				disposition: 'SATISFIED'
			}
		],
		openObservations: [],
		contestedClaims: [],
		requiredWaivers: [],
		...over
	});

	it('promotes when every precondition holds (fixture happy path)', () => {
		const r = canPromoteBaseline(base());
		expect(r.ok, r.findings.map((f) => f.code).join(',')).toBe(true);
	});

	it('RPH-BAS-006 / §23.2: no effective promotion decision => rejected (a commit is not a baseline)', () => {
		const r = canPromoteBaseline(base({ promotionDecision: decision({ status: 'PROPOSED' }) }));
		expect(r.findings.map((f) => f.code)).toContain('NO_EFFECTIVE_PROMOTION_DECISION');
	});

	it('RPH-BAS-002: a promoted item hash that differs from the reviewed hash => BASELINE_VERSION_MISMATCH', () => {
		const r = canPromoteBaseline(
			base({ candidateItems: [{ ...items[0]!, contentHash: 'DIFFERENT' }, items[1]!] })
		);
		expect(r.findings.map((f) => f.code)).toContain('BASELINE_VERSION_MISMATCH');
	});

	it('RPH-BAS-003: an open unwaived blocking finding (tenant-isolation) blocks promotion; a waived one does not', () => {
		const blocked = canPromoteBaseline(
			base({
				openObservations: [{ observationId: 'obs_fsm_arch_002', blocking: true, waived: false }]
			})
		);
		expect(blocked.findings.map((f) => f.code)).toContain('OPEN_BLOCKING_FINDING');
		const waived = canPromoteBaseline(
			base({
				openObservations: [{ observationId: 'obs_fsm_arch_002', blocking: true, waived: true }]
			})
		);
		expect(waived.ok).toBe(true);
	});

	it('RPH-BAS-004 + no-green-without-assurance: an incomplete or non-SATISFIED required assessment blocks promotion', () => {
		const incomplete = canPromoteBaseline(
			base({
				requiredAssessments: [
					{
						assessmentId: 'assess_fsm_intent_preservation_001',
						complete: false,
						disposition: 'ASSESSING'
					}
				]
			})
		);
		expect(incomplete.findings.map((f) => f.code)).toContain('REQUIRED_ASSESSMENT_INCOMPLETE');
		// execution succeeded but assurance only CONDITIONALLY_SATISFIED => not promotable (no green without assurance)
		const conditional = canPromoteBaseline(
			base({
				requiredAssessments: [
					{ assessmentId: 'a', complete: true, disposition: 'CONDITIONALLY_SATISFIED' }
				]
			})
		);
		expect(conditional.findings.map((f) => f.code)).toContain('REQUIRED_ASSESSMENT_NOT_SATISFIED');
	});

	it('RPH-GOV-006: an expired required waiver blocks promotion; §15.2: a contested claim blocks promotion', () => {
		const expired = canPromoteBaseline(
			base({
				requiredWaivers: [
					{
						decisionId: 'w',
						status: 'EFFECTIVE',
						waivedCriterionId: 'AC-04',
						subjectObjectId: 'x',
						subjectSemanticVersion: 2,
						expired: true
					}
				]
			})
		);
		expect(expired.findings.map((f) => f.code)).toContain('EXPIRED_REQUIRED_WAIVER');
		const contested = canPromoteBaseline(
			base({ contestedClaims: [{ claimId: 'clm_tenant', contested: true }] })
		);
		expect(contested.findings.map((f) => f.code)).toContain('CONTESTED_CLAIM');
	});

	it('a baseline not in APPROVED cannot be promoted (illegal transition)', () => {
		const r = canPromoteBaseline(base({ baselineStatus: 'CANDIDATE' }));
		expect(r.findings.map((f) => f.code)).toContain('ILLEGAL_PROMOTION_TRANSITION');
	});
});

describe('M10 baseline immutability & supersession (Property P7 / RPH-BAS-005/007; §24.2)', () => {
	it('P7 / RPH-BAS-005: an AUTHORITATIVE baseline item set cannot be mutated — a successor is required', () => {
		const auth = assertBaselineItemSetImmutable('AUTHORITATIVE');
		expect(auth.ok).toBe(false);
		expect(auth.requiresSuccessor).toBe(true);
		expect(assertBaselineItemSetImmutable('APPROVED').ok).toBe(true); // pre-promotion is still editable
	});

	it('RPH-BAS-007: an authoritative baseline may be superseded (the only legal replacement)', () => {
		expect(canSupersedeBaseline('AUTHORITATIVE')).toBe(true);
		expect(canSupersedeBaseline('DRAFT')).toBe(false);
	});
});

describe('M10 decision revocation (RPH-GOV-007; §23.2)', () => {
	it('RPH-GOV-007: revoking an effective approval flags dependent baselines review-required + requires impact analysis', () => {
		const r = assessDecisionRevocation(decision(), ['base_fsm_arch_001']);
		expect(r.baselineDisposition).toBe('REVIEW_REQUIRED');
		expect(r.impactAnalysisRequired).toBe(true);
		expect(r.impactedBaselineIds).toEqual(['base_fsm_arch_001']);
	});
});

describe('M10 controller control-action selection (§37, Migration §14)', () => {
	it('normalizes validator/decision spellings to the canonical §37 tokens', () => {
		expect(normalizeControlAction('RESHAPE')).toBe('RESHAPE_PWU');
		expect(normalizeControlAction('REPLAN')).toBe('REPLAN_EXECUTION');
		expect(normalizeControlAction('WAIVER')).toBe('WAIVE');
		expect(normalizeControlAction('GATHER_EVIDENCE')).toBe('GATHER_EVIDENCE');
	});

	it('selects without averaging: proceed if no decisive action, take the sole decisive one, else ESCALATE', () => {
		// no decisive action recommended => proceed (ACCEPT dominates CONTINUE)
		expect(selectControlAction([])).toBe('CONTINUE');
		expect(selectControlAction(['CONTINUE', 'ACCEPT'])).toBe('ACCEPT');
		// exactly one distinct decisive action => take it (normalized first)
		expect(selectControlAction(['CONTINUE', 'GATHER_EVIDENCE', 'GATHER_EVIDENCE'])).toBe(
			'GATHER_EVIDENCE'
		);
		expect(selectControlAction(['RESHAPE', 'CONTINUE'])).toBe('RESHAPE_PWU');
		// validators disagree on a decisive action => defer to human/policy (Catalog §11), never a fabricated winner
		expect(selectControlAction(['ESCALATE', 'RETRY', 'CONTINUE'])).toBe('ESCALATE');
		expect(selectControlAction(['REJECT', 'GATHER_EVIDENCE'])).toBe('ESCALATE');
	});

	it('controller refuses PWU-satisfied on execution success alone (INV-5: exec != assurance)', () => {
		// the §21 fixture ruling: SUCCEEDED + CONDITIONALLY_SATISFIED + 2 open observations => NOT satisfied
		expect(
			controllerMarksPwuSatisfied({
				executionState: 'SUCCEEDED',
				assuranceState: 'CONDITIONALLY_SATISFIED',
				openBlockingObservations: 2
			})
		).toBe(false);
		expect(
			controllerMarksPwuSatisfied({
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				openBlockingObservations: 1
			})
		).toBe(false);
		expect(
			controllerMarksPwuSatisfied({
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				openBlockingObservations: 0
			})
		).toBe(true);
	});
});

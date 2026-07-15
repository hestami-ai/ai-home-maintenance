// Governance / baseline enforcement — the M10 domain kernel. Pure, deterministic predicates over lightweight
// read-models the caller assembles (same idiom as pwuGuards / decomposition.ts). These make the TEXT-ONLY
// guards on the Decision.status / Baseline.status machines and the CROSS_AXIS_RULES prose EXECUTABLE. No I/O,
// no clock (temporal facts like waiver-expiry arrive as precomputed flags); depends only on rph-contracts
// (indirectly, via string states) and the generic transition matrix in stateMachine.js.
//
// The load-bearing laws (Canonical Domain Model §23/§24/§37; Conformance Spec RPH-GOV-*, RPH-BAS-*, P5/P7):
//   * Authority (RPH-GOV-001/002): a decision is authority-verified BEFORE it can be EFFECTIVE; a
//     recommendation (PROPOSED) is not an approval.
//   * Version-binding (RPH-GOV-003 / Property P5): a decision binds exact subject semantic versions — an
//     approval of version n NEVER authorizes version n+1.
//   * Baseline promotion (RPH-BAS-001..004, RPH-GOV-006): promotion needs an effective decision, exact
//     item versions/hashes, all required assessments satisfied ("no green without assurance"), no open
//     blocking finding / contested claim, and no expired required waiver.
//   * Immutability (Property P7 / RPH-BAS-005/007): no command mutates an AUTHORITATIVE baseline's item set —
//     change is a successor baseline, supersede-never-mutate with preserved history.
import { canTransition } from './stateMachine.js';

// ============================================================================================
// Governance decisions — authority verification (RPH-GOV-001/002; §23.2, §35.5)
// ============================================================================================

/** A governance Decision read-model. `authorityHeld` is caller-computed: whether the acting actor holds
 *  sufficient, in-scope, unexpired authority for this decisionType (verified via the injected authorizer
 *  port — the engine defines the seam but does not implement the policy engine). */
export interface DecisionView {
	readonly decisionId: string;
	/** APPROVAL | REJECTION | WAIVER | ESCALATION | RESHAPE | REPLAN | PROMOTE_BASELINE | ABANDON | REVOKE. */
	readonly decisionType: string;
	/** PROPOSED | EFFECTIVE | REVOKED | SUPERSEDED (§23.1). */
	readonly status: string;
	readonly subjectObjectIds: readonly string[];
	/** Per-subject semantic version this decision binds to (the version-binding substrate, Contract §22). */
	readonly subjectSemanticVersions: Readonly<Record<string, number>>;
	/** Does the acting authority suffice for this decisionType (scope + validity already checked upstream)? */
	readonly authorityHeld: boolean;
}

export interface AuthorityCheck {
	readonly ok: boolean;
	readonly errorCode?: 'RPH_AUTHORITY_INSUFFICIENT';
	readonly reason?: string;
}

/**
 * RPH-GOV-001 / §35.5. A decision may become EFFECTIVE only when the acting authority suffices; otherwise the
 * command is rejected with RPH_AUTHORITY_INSUFFICIENT BEFORE any DecisionEffective is produced. Also checks the
 * PROPOSED -> EFFECTIVE transition is legal on the Decision.status machine.
 */
export function authorizeDecisionEffective(d: DecisionView): AuthorityCheck {
	if (!canTransition('Decision.status', d.status, 'EFFECTIVE'))
		return {
			ok: false,
			reason: `not a legal Decision.status transition: ${d.status} -> EFFECTIVE`
		};
	if (!d.authorityHeld)
		return {
			ok: false,
			errorCode: 'RPH_AUTHORITY_INSUFFICIENT',
			reason: 'actor lacks sufficient authority to make this decision effective'
		};
	return { ok: true };
}

/**
 * RPH-GOV-002 / §23.2. A recommendation is NOT an approval: an effective governance decision exists only when
 * the decision is EFFECTIVE and was authority-backed. A PROPOSED decision (an agent's recommendation) never
 * constitutes approval, whatever its decisionType.
 */
export function isEffectiveApproval(d: DecisionView): boolean {
	return d.status === 'EFFECTIVE' && d.authorityHeld && d.decisionType === 'APPROVAL';
}

// ============================================================================================
// Version binding (RPH-GOV-003 / Property P5; §4)
// ============================================================================================

export interface StaleSubject {
	readonly subjectId: string;
	readonly approvedVersion: number;
	readonly currentVersion: number;
}

export interface VersionBindingCheck {
	readonly ok: boolean;
	/** Subjects whose current semantic version differs from the version the decision bound (decision is stale). */
	readonly staleSubjects: readonly StaleSubject[];
}

/**
 * RPH-GOV-003 / Property P5. A decision authorizes a subject ONLY at the exact semantic version it bound. When
 * a new semantic version of an approved subject is created, the prior decision does not carry to it — the
 * subject is (re-)review-required. Returns ok only when every bound subject is still at its approved version.
 */
export function decisionAuthorizesVersions(
	d: DecisionView,
	currentSubjectVersions: Readonly<Record<string, number>>
): VersionBindingCheck {
	const staleSubjects: StaleSubject[] = [];
	for (const [subjectId, approvedVersion] of Object.entries(d.subjectSemanticVersions)) {
		const currentVersion = currentSubjectVersions[subjectId];
		if (currentVersion !== undefined && currentVersion !== approvedVersion)
			staleSubjects.push({ subjectId, approvedVersion, currentVersion });
	}
	return { ok: staleSubjects.length === 0, staleSubjects };
}

// ============================================================================================
// Waivers (RPH-GOV-004/005/006, RPH-CNS-004; §23.2, Catalog §12)
// ============================================================================================

/** A waiver read-model. A waiver is a Decision of decisionType WAIVER; `expired` is caller-computed (clock-free,
 *  mirroring decomposition.ts's waiverExpired flag). */
export interface WaiverView {
	readonly decisionId: string;
	readonly status: string; // EFFECTIVE to discharge
	readonly waivedCriterionId: string;
	readonly subjectObjectId: string;
	readonly subjectSemanticVersion: number;
	readonly expired: boolean;
}

/**
 * RPH-GOV-005 / Catalog §12.2. Waiver scope is exact: a waiver discharges ONLY its (criterion, object,
 * semantic version) triple. It does not bleed to another criterion, another object, or another version.
 */
export function waiverCovers(
	w: WaiverView,
	criterionId: string,
	subjectObjectId: string,
	subjectSemanticVersion: number
): boolean {
	return (
		w.waivedCriterionId === criterionId &&
		w.subjectObjectId === subjectObjectId &&
		w.subjectSemanticVersion === subjectSemanticVersion
	);
}

/**
 * RPH-GOV-006 / RPH-CNS-004. A waiver discharges its finding only while EFFECTIVE and not expired. An expired
 * waiver no longer satisfies the disposition — affected work becomes review-required and, if the finding
 * remains applicable, baseline promotion is blocked (enforced in canPromoteBaseline).
 */
export function waiverStillDischarges(w: WaiverView): boolean {
	return w.status === 'EFFECTIVE' && !w.expired;
}

/** The state of a finding after a human override (waiver) is applied — what RPH-GOV-004 constrains. */
export interface WaiverOverrideView {
	/** The waived finding must remain VISIBLE — a waiver does not erase it (§18.1). */
	readonly findingVisible: boolean;
	/** The finding's disposition after the override (must become WAIVED, not e.g. SATISFIED). */
	readonly findingDisposition: string;
	readonly rationale?: string;
	/** Whether the granting actor held waiver authority. */
	readonly authorityHeld: boolean;
	/** A waiver must not rewrite the underlying evidence (§23.2 "a decision cannot retroactively change evidence"). */
	readonly evidenceUnchanged: boolean;
}

export interface OverrideCheck {
	readonly ok: boolean;
	readonly reasons: readonly string[];
}

/**
 * RPH-GOV-004 / §23.2 / §18.1. A human override (waiver) PRESERVES the finding: the finding stays visible, its
 * disposition becomes WAIVED (never silently SATISFIED), rationale and authority are recorded, and the
 * underlying evidence is left unchanged. Returns ok only when every part of that invariant holds.
 */
export function waiverPreservesFindings(o: WaiverOverrideView): OverrideCheck {
	const reasons: string[] = [];
	if (!o.findingVisible)
		reasons.push('a waiver must not erase the finding — it remains visible (§18.1)');
	if (o.findingDisposition !== 'WAIVED')
		reasons.push(`override disposition must be WAIVED, not ${o.findingDisposition}`);
	if (!o.rationale) reasons.push('a waiver requires a recorded rationale (§23.2)');
	if (!o.authorityHeld) reasons.push('a waiver requires recorded authority (§23.2)');
	if (!o.evidenceUnchanged) reasons.push('a decision cannot retroactively change evidence (§23.2)');
	return { ok: reasons.length === 0, reasons };
}

// ============================================================================================
// Baseline promotion gate (RPH-BAS-001..004, RPH-GOV-006; §24.2, §35.2/§35.3)
// ============================================================================================

export interface BaselineItemVersionView {
	readonly objectId: string;
	readonly semanticVersion: number;
	readonly contentHash?: string;
}

/** A required assurance assessment backing the promotion. `disposition` is the AssuranceAssessment disposition. */
export interface RequiredAssessmentView {
	readonly assessmentId: string;
	readonly complete: boolean;
	/** SATISFIED | CONDITIONALLY_SATISFIED | WAIVED | REJECTED | INCONCLUSIVE | ... (§18). */
	readonly disposition: string;
}

export interface OpenObservationView {
	readonly observationId: string;
	readonly blocking: boolean;
	readonly waived: boolean;
}

export interface ContestedClaimView {
	readonly claimId: string;
	readonly contested: boolean;
}

export interface BaselinePromotionInput {
	/** Baseline.status the promotion would advance from — must be APPROVED to reach AUTHORITATIVE. */
	readonly baselineStatus: string;
	/** The PROMOTE_BASELINE / APPROVAL decision authorizing promotion; must be an effective approval. */
	readonly promotionDecision?: DecisionView;
	/** The exact item versions the candidate baseline freezes (RPH-BAS-001). */
	readonly candidateItems: readonly BaselineItemVersionView[];
	/** The item versions/hashes that were reviewed (RPH-BAS-002: promoted must match reviewed exactly). */
	readonly reviewedItems: readonly BaselineItemVersionView[];
	readonly requiredAssessments: readonly RequiredAssessmentView[];
	readonly openObservations: readonly OpenObservationView[];
	readonly contestedClaims?: readonly ContestedClaimView[];
	/** Waivers that must hold for promotion (e.g. a scoped deferral) — an expired one blocks promotion. */
	readonly requiredWaivers?: readonly WaiverView[];
}

export type BaselinePromotionFindingCode =
	| 'NO_EFFECTIVE_PROMOTION_DECISION' // §23.2 / RPH-BAS-006: promotion needs an explicit effective decision
	| 'ILLEGAL_PROMOTION_TRANSITION' // baseline not in a promotable (APPROVED) state
	| 'MISSING_ITEM_VERSION' // RPH-BAS-001: an item lacks a semantic version
	| 'BASELINE_VERSION_MISMATCH' // RPH-BAS-002: promoted item version/hash != reviewed (RPH_BASELINE_VERSION_MISMATCH)
	| 'OPEN_BLOCKING_FINDING' // RPH-BAS-003: an open blocking observation is unwaived
	| 'REQUIRED_ASSESSMENT_INCOMPLETE' // RPH-BAS-004: a required assessment has not completed
	| 'REQUIRED_ASSESSMENT_NOT_SATISFIED' // no green without assurance: complete but not SATISFIED/WAIVED (§35.2)
	| 'CONTESTED_CLAIM' // §15.2: a contested claim cannot authorize promotion
	| 'EXPIRED_REQUIRED_WAIVER'; // RPH-GOV-006 / RPH-CNS-004: a required waiver has expired

export interface BaselinePromotionFinding {
	readonly code: BaselinePromotionFindingCode;
	readonly detail: string;
}

export interface BaselinePromotionResult {
	readonly ok: boolean;
	readonly findings: readonly BaselinePromotionFinding[];
}

/** Assurance dispositions that permit promotion. SATISFIED = clean; WAIVED = an authorized waiver carries the
 *  residual (§39 Scenario 4). CONDITIONALLY_SATISFIED still has unmet conditions → not promotable on its own. */
const PROMOTABLE_DISPOSITIONS = new Set(['SATISFIED', 'WAIVED']);

/** RPH-BAS-001: every candidate item must pin a semantic version. */
function findMissingItemVersions(
	candidateItems: readonly BaselineItemVersionView[]
): BaselinePromotionFinding[] {
	const findings: BaselinePromotionFinding[] = [];
	for (const item of candidateItems)
		if (item.semanticVersion === undefined || item.semanticVersion === null)
			findings.push({
				code: 'MISSING_ITEM_VERSION',
				detail: `item ${item.objectId} has no semantic version`
			});
	return findings;
}

/** RPH-BAS-002: candidate item versions+hashes must match the reviewed set exactly. */
function findVersionMismatches(
	candidateItems: readonly BaselineItemVersionView[],
	reviewedItems: readonly BaselineItemVersionView[]
): BaselinePromotionFinding[] {
	const findings: BaselinePromotionFinding[] = [];
	const reviewed = new Map(reviewedItems.map((i) => [i.objectId, i]));
	for (const item of candidateItems) {
		const r = reviewed.get(item.objectId);
		if (!r || r.semanticVersion !== item.semanticVersion || r.contentHash !== item.contentHash)
			findings.push({
				code: 'BASELINE_VERSION_MISMATCH',
				detail: `item ${item.objectId} promoted version/hash does not match the reviewed version/hash`
			});
	}
	return findings;
}

/** RPH-BAS-003: no unwaived open blocking observation. */
function findOpenBlockingObservations(
	openObservations: readonly OpenObservationView[]
): BaselinePromotionFinding[] {
	const findings: BaselinePromotionFinding[] = [];
	for (const o of openObservations)
		if (o.blocking && !o.waived)
			findings.push({
				code: 'OPEN_BLOCKING_FINDING',
				detail: `open blocking observation ${o.observationId}`
			});
	return findings;
}

/** §15.2: no contested claim. */
function findContestedClaims(
	contestedClaims: readonly ContestedClaimView[] | undefined
): BaselinePromotionFinding[] {
	const findings: BaselinePromotionFinding[] = [];
	for (const c of contestedClaims ?? [])
		if (c.contested)
			findings.push({
				code: 'CONTESTED_CLAIM',
				detail: `contested claim ${c.claimId} cannot authorize promotion`
			});
	return findings;
}

/** RPH-BAS-004 + no-green-without-assurance: every required assessment complete AND satisfied/waived. */
function findAssessmentDefects(
	requiredAssessments: readonly RequiredAssessmentView[]
): BaselinePromotionFinding[] {
	const findings: BaselinePromotionFinding[] = [];
	for (const a of requiredAssessments) {
		if (!a.complete)
			findings.push({
				code: 'REQUIRED_ASSESSMENT_INCOMPLETE',
				detail: `required assessment ${a.assessmentId} incomplete`
			});
		else if (!PROMOTABLE_DISPOSITIONS.has(a.disposition))
			findings.push({
				code: 'REQUIRED_ASSESSMENT_NOT_SATISFIED',
				detail: `required assessment ${a.assessmentId} is ${a.disposition}, not SATISFIED/WAIVED`
			});
	}
	return findings;
}

/** RPH-GOV-006 / RPH-CNS-004: no expired required waiver. */
function findExpiredWaivers(
	requiredWaivers: readonly WaiverView[] | undefined
): BaselinePromotionFinding[] {
	const findings: BaselinePromotionFinding[] = [];
	for (const w of requiredWaivers ?? [])
		if (w.expired)
			findings.push({
				code: 'EXPIRED_REQUIRED_WAIVER',
				detail: `required waiver ${w.decisionId} has expired`
			});
	return findings;
}

/**
 * The baseline promotion gate (RPH-BAS-001..004, RPH-GOV-006, §24.2). A baseline may become AUTHORITATIVE only
 * when EVERY precondition holds — each violation is an independent finding (all reported, not short-circuited):
 *   - an effective, authority-backed PROMOTE_BASELINE/APPROVAL decision exists (a commit is not a baseline);
 *   - the promotion transition APPROVED -> AUTHORITATIVE is legal;
 *   - every candidate item carries a semantic version, and matches the reviewed item version+hash exactly;
 *   - no open blocking observation is unwaived, and no contested claim remains;
 *   - every required assessment has completed AND is SATISFIED or WAIVED (execution success alone is never
 *     enough — "no green without assurance", §35.2);
 *   - no required waiver has expired.
 */
export function canPromoteBaseline(input: BaselinePromotionInput): BaselinePromotionResult {
	const findings: BaselinePromotionFinding[] = [];

	// Effective, authorized promotion decision (RPH-BAS-006, §23.2).
	const d = input.promotionDecision;
	const decisionOk =
		!!d &&
		d.status === 'EFFECTIVE' &&
		d.authorityHeld &&
		(d.decisionType === 'PROMOTE_BASELINE' || d.decisionType === 'APPROVAL');
	if (!decisionOk)
		findings.push({
			code: 'NO_EFFECTIVE_PROMOTION_DECISION',
			detail: 'promotion requires an effective, authority-backed PROMOTE_BASELINE/APPROVAL decision'
		});

	// Promotion transition legality (APPROVED -> AUTHORITATIVE).
	if (!canTransition('Baseline.status', input.baselineStatus, 'AUTHORITATIVE'))
		findings.push({
			code: 'ILLEGAL_PROMOTION_TRANSITION',
			detail: `baseline in ${input.baselineStatus} cannot be promoted to AUTHORITATIVE`
		});

	findings.push(
		...findMissingItemVersions(input.candidateItems),
		...findVersionMismatches(input.candidateItems, input.reviewedItems),
		...findOpenBlockingObservations(input.openObservations),
		...findContestedClaims(input.contestedClaims),
		...findAssessmentDefects(input.requiredAssessments),
		...findExpiredWaivers(input.requiredWaivers)
	);

	return { ok: findings.length === 0, findings };
}

// ============================================================================================
// Baseline immutability & supersession (Property P7 / RPH-BAS-005/006/007; §24.2)
// ============================================================================================

export interface BaselineMutationCheck {
	readonly ok: boolean;
	/** True when the change must be expressed as a successor baseline rather than an in-place mutation. */
	readonly requiresSuccessor: boolean;
	readonly reason?: string;
}

/**
 * Property P7 / RPH-BAS-005. No legal command mutates an AUTHORITATIVE baseline's item set. Any change to a
 * baselined item leaves the authoritative baseline untouched and requires a SUCCESSOR baseline (supersede-
 * never-mutate). Returns ok=false + requiresSuccessor when the baseline is AUTHORITATIVE.
 */
export function assertBaselineItemSetImmutable(baselineStatus: string): BaselineMutationCheck {
	if (baselineStatus === 'AUTHORITATIVE')
		return {
			ok: false,
			requiresSuccessor: true,
			reason: 'an authoritative baseline is immutable; express the change as a successor baseline'
		};
	return { ok: true, requiresSuccessor: false };
}

/** RPH-BAS-007. Supersession is the only legal replacement of an authoritative baseline (AUTHORITATIVE ->
 *  SUPERSEDED); the prior baseline stays queryable/immutable with a supersession trace. */
export function canSupersedeBaseline(baselineStatus: string): boolean {
	return canTransition('Baseline.status', baselineStatus, 'SUPERSEDED');
}

// ============================================================================================
// Decision revocation impact (RPH-GOV-007; §23.2)
// ============================================================================================

export interface RevocationOutcome {
	readonly baselineDisposition: 'REVIEW_REQUIRED' | 'REVOKED';
	readonly impactAnalysisRequired: true;
	readonly impactedBaselineIds: readonly string[];
}

/**
 * RPH-GOV-007. Revoking an effective decision (e.g. an Architecture approval) makes the dependent baseline
 * review-required or revoked and initiates impact analysis on downstream planning. Never rewrites history —
 * the revocation is a new governance act (append-only).
 */
export function assessDecisionRevocation(
	d: DecisionView,
	dependentBaselineIds: readonly string[]
): RevocationOutcome {
	return {
		baselineDisposition: 'REVIEW_REQUIRED',
		impactAnalysisRequired: true,
		impactedBaselineIds: [...dependentBaselineIds]
	};
}

// ============================================================================================
// Controller — control-action selection (§37, Migration §14; Catalog §11)
// ============================================================================================

/** Canonical §37 controller control actions (the authoritative superset of the §18 validator recommendations). */
export const CONTROLLER_ACTIONS = [
	'CONTINUE',
	'WAIT',
	'RETRY',
	'GATHER_EVIDENCE',
	'REVISE_CONTEXT',
	'REVISE_PROMPT',
	'CHANGE_MODEL',
	'CHANGE_TOOL',
	'CHANGE_TACTIC',
	'RESHAPE_PWU',
	'REVISE_DECOMPOSITION',
	'REPLAN_EXECUTION',
	'ESCALATE',
	'WAIVE',
	'REJECT',
	'ABANDON',
	'ACCEPT',
	'PROMOTE_BASELINE'
] as const;

/** Normalize a validator-recommendation / decision-type spelling to the canonical §37 ControlAction token
 *  (the §18 validator set spells the shape/plan actions RESHAPE/REPLAN; §37 spells them RESHAPE_PWU/
 *  REPLAN_EXECUTION; a WAIVER decision maps to the WAIVE action). */
export function normalizeControlAction(action: string): string {
	switch (action) {
		case 'RESHAPE':
			return 'RESHAPE_PWU';
		case 'REPLAN':
			return 'REPLAN_EXECUTION';
		case 'WAIVER':
			return 'WAIVE';
		default:
			return action;
	}
}

// Advisory (non-decisive) actions — the two that let the flow proceed as-is. Everything else in §37 is a
// decisive intervention. The spec does NOT define a total order over control actions (§37 is an unordered set;
// Catalog §11: "the controller selects and executes them under policy"), so we do NOT invent one. The only
// grounded principle is "don't silently average / stay decisive" (§38 no confidence fusion; Conformance
// "results are not averaged silently"), analogous — at the DISPOSITION level — to the strictest-unresolved
// aggregation of Catalog §10.3 / RPH-ASR-012.
const NON_DECISIVE_ACTIONS = new Set(['CONTINUE', 'ACCEPT']);

/**
 * The controller selects ONE control action from the validators' recommendations, WITHOUT averaging and WITHOUT
 * a fabricated strictness order:
 *   - if no decisive action is recommended, proceed (ACCEPT if any validator accepted, else CONTINUE);
 *   - if exactly one distinct decisive action is recommended, take it;
 *   - if validators recommend DIFFERENT decisive actions, defer to human/policy via ESCALATE (Catalog §11
 *     "under policy") rather than a hardcoded winner — the safe, spec-grounded resolution of a genuine conflict.
 * Inputs are normalized to §37 tokens first.
 */
export function selectControlAction(recommended: readonly string[]): string {
	const normalized = recommended.map(normalizeControlAction);
	const decisive = [...new Set(normalized.filter((a) => !NON_DECISIVE_ACTIONS.has(a)))];
	if (decisive.length === 0) return normalized.includes('ACCEPT') ? 'ACCEPT' : 'CONTINUE';
	if (decisive.length === 1) return decisive[0]!;
	return 'ESCALATE';
}

export interface PwuControllerAxes {
	readonly executionState: string;
	readonly assuranceState: string;
	readonly openBlockingObservations: number;
}

/**
 * The controller marks a PWU satisfied ONLY when execution SUCCEEDED, assurance is SATISFIED, and no open
 * blocking observation remains — execution success is never sufficient (INV-5 / P1). This is the §21 fixture
 * ruling made executable: SUCCEEDED + CONDITIONALLY_SATISFIED + open observations => NOT satisfied.
 */
export function controllerMarksPwuSatisfied(axes: PwuControllerAxes): boolean {
	return (
		axes.executionState === 'SUCCEEDED' &&
		axes.assuranceState === 'SATISFIED' &&
		axes.openBlockingObservations === 0
	);
}

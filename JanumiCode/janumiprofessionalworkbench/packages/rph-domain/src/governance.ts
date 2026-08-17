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
	/**
	 * The baseline being promoted — REQUIRED, because the decision must NAME it (REG-F-073).
	 *
	 * Added after `decisionOk` was found to check kind, status and authority and NOT subject scope, so **any**
	 * effective promotion decision in the store authorized **any** promotion. Driven through the real bus: a
	 * decision whose only subject was an unrelated PWU promoted a different PWU's baseline, ACCEPTED.
	 */
	readonly baselineId: string;
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
	| 'PROMOTION_DECISION_OUT_OF_SCOPE' // REG-F-073 / RPH-GOV-005: the decision does not name THIS baseline
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
	// ── SCOPE, AND ITS ABSENCE MADE EVERY PROMOTION DECISION UNIVERSAL (REG-F-073) ────────────────────────────
	//
	// The four conditions above are kind, status and authority. None of them asks WHAT the decision was about,
	// and nothing downstream did either: the call site resolves the decision by id and `decisionAuthorizesVersions`
	// iterates the DECISION'S OWN subjects, so an unrelated decision satisfies it vacuously. Measured on the live
	// bus: a PROMOTE_BASELINE decision whose only subject was an unrelated PWU promoted a different PWU's
	// baseline — ACCEPTED, AUTHORITATIVE.
	//
	// It also silently weakened `rejectUnbackedBaselining`, which gates PWU SATISFIED -> BASELINED on a cited
	// baseline being AUTHORITATIVE — a status this hole handed out on an off-topic decision.
	//
	// THE RULE IS NOT INVENTED HERE. `resolveSkipAuthorization` already does exactly this for skips, refusing
	// with "an authorization does not bleed to another step (RPH-GOV-005)", whose ratified text is "a waiver does
	// not bleed to another criterion, another object, or another version". Promotion is the act
	// JPWB-DOC-001 §5.2 reserves to Governance BY NAME, and it was the one without the discipline.
	//
	// The repository's own correct usage already satisfies it: the reference Undertaking's promotion decision
	// names `[pwuId, baselineId]`.
	if (decisionOk && !d.subjectObjectIds.includes(input.baselineId))
		findings.push({
			code: 'PROMOTION_DECISION_OUT_OF_SCOPE',
			detail:
				`decision ${d.decisionId} does not name baseline ${input.baselineId} among its subjectObjectIds — ` +
				`an authorization does not bleed to another object (RPH-GOV-005)`
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

// ============================================================================================
// Assessment conclusion (REG-F-021 increment 0) — "has this assessment reached an outcome?"
// ============================================================================================

/**
 * The states in which an AssuranceAssessment has REACHED AN OUTCOME, so a governance act may rely on it.
 *
 * WHY THIS EXISTS, AND WHY IT IS A POSITIVE LIST. Baseline promotion asked the question inline as
 * `complete = disposition !== 'ASSESSING' && disposition !== 'REQUESTED'` — an ad-hoc exclusion of two states.
 * The ratified §30 machine has FOUR pre-conclusion states (`REQUESTED, EVIDENCE_PENDING, READY, ASSESSING`); the
 * exclusion named two, so `EVIDENCE_PENDING` and `READY` counted as CONCLUDED. That is currently harmless only
 * because those states are unreachable — `requestAssuranceAssessment` creates directly in `ASSESSING` — and it
 * becomes a live fail-open defect the moment REG-F-021 makes them reachable: a baseline promoted over an
 * assessment that has not begun, reporting `disposition: 'EVIDENCE_PENDING'`.
 *
 * THE DIRECTION OF THE LIST IS THE FIX, not just its contents. A negative list (name the in-flight states, treat
 * everything else as concluded) fails OPEN on a state added later: the new state is not excluded, so it counts as
 * concluded. A positive list fails CLOSED: an unclassified state is simply not concluded, and promotion blocks
 * until someone says what it means. `assessment-conclusion.test.ts` asserts this set and the in-flight set
 * together EXHAUST the machine's declared states and do not overlap, so a state added to the enum reddens rather
 * than silently defaulting either way.
 *
 * NOT `isTerminalState('AssuranceAssessment.state', …)`: the machine's own `terminalStates` deliberately EXCLUDES
 * `SATISFIED`, `CONDITIONALLY_SATISFIED` and `WAIVED` (a satisfied assessment can still be INVALIDATED or have
 * its waiver expire). Those are exactly the outcomes a promotion cares about, so terminality is the wrong
 * question here — "has it concluded" is not "can it never change again".
 */
export const ASSESSMENT_CONCLUDED_STATES: readonly string[] = [
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED',
	'WAIVED',
	'VALIDATOR_FAILED',
	'INDEPENDENCE_VIOLATION',
	'INVALIDATED',
	'WAIVER_EXPIRED',
	'CANCELLED'
];

/** The four states of the ratified §30 machine in which an assessment has NOT yet reached an outcome. */
export const ASSESSMENT_IN_FLIGHT_STATES: readonly string[] = [
	'REQUESTED',
	'EVIDENCE_PENDING',
	'READY',
	'ASSESSING'
];

/** True when the assessment has reached an outcome a governance act may rely on. Unknown state => NOT concluded. */
export function assessmentHasConcluded(assessmentState: string | undefined): boolean {
	return assessmentState !== undefined && ASSESSMENT_CONCLUDED_STATES.includes(assessmentState);
}

// ============================================================================================
// Policy applicability (DOC-004 §5.1 / §5.2) — does this policy govern this work at all?
// ============================================================================================

/** The subject facts an applicability decision needs. Assembled by the caller from the object it is about. */
export interface ApplicabilitySubject {
	readonly objectType: string;
	/** PWU kind, when the subject is a PWU. Absent for other object types. */
	readonly pwuKind?: string;
	readonly tags?: readonly string[];
}

/** The §5.1 fields this kernel can decide from. Everything else in the rule is ignored, deliberately — see below. */
export interface ApplicabilityRuleView {
	readonly objectTypeConditions?: readonly unknown[];
	readonly pwuKindConditions?: readonly string[];
	readonly requiredTags?: readonly string[];
	readonly excludedTags?: readonly string[];
	readonly expression?: unknown;
}

/**
 * The §5.1 `expression` clause, applied AFTER every field this kernel can decide has already said "applies". An
 * expression can only NARROW that standing verdict, never widen it — a subject already excluded by object type,
 * kind or tags never reaches here. Three cases, and the last two are the load-bearing ones:
 *   - no expression: the standing verdict stands (REQUIRED);
 *   - an expression but no injected evaluator: REQUIRES_HUMAN_DETERMINATION — the condition is unevaluable on
 *     THIS CALL, which is not the same as absent, and ignoring it would be the fail-open reading;
 *   - an expression whose evaluation THROWS (malformed / out-of-grammar): also undecidable, never NOT_APPLICABLE.
 *     Reading "did not evaluate" as "condition not met" would be a decided negative derived from not
 *     understanding the input.
 */
function narrowByExpression(
	expression: unknown,
	subject: ApplicabilitySubject,
	evaluate: ((expression: unknown, subject: ApplicabilitySubject) => boolean) | undefined
): ApplicabilityOutcomeValue {
	if (expression === undefined) return 'REQUIRED';
	if (!evaluate) return 'REQUIRES_HUMAN_DETERMINATION'; // no evaluator supplied — see the note above
	try {
		return evaluate(expression, subject) ? 'REQUIRED' : 'NOT_APPLICABLE';
	} catch {
		return 'REQUIRES_HUMAN_DETERMINATION';
	}
}

/**
 * Decide whether a policy applies to a subject, as a DOC-004 §5.2 `ApplicabilityOutcome`.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
 * §5.1 ratifies an ApplicabilityRule and §5.2 ratifies the outcomes a determination yields. The corpus defines
 * both and the engine consulted neither: `applicability` was hardcoded `{}` on every policy, and no code path
 * asked whether a policy governed the work it was being used to assess. Delivering the field without reading it
 * would be REG-F-022 one field over — an authored value that reaches an object nothing consults.
 *
 * ── WHAT IT REFUSES TO DECIDE, AND WHY THAT IS THE IMPORTANT PART ──────────────────────────────────────────
 * A rule may carry an `expression`. Given no way to evaluate one, this kernel returns
 * **REQUIRES_HUMAN_DETERMINATION** — a §5.2 outcome, not an invented one — rather than ignoring it and answering
 * from the fields it does understand. Ignoring it would be the fail-open reading: a policy whose real condition
 * is "applies only to externally delegated work" would be reported APPLICABLE to everything. An unevaluable
 * condition is not an absent one.
 *
 * ⚠ THE REASON THIS FILE GAVE FOR THAT WAS FALSE, AND IS CORRECTED HERE (2026-08-05, adversarial review).
 * It read: *"§5.1's `expression` is a `PolicyExpression`, a type the corpus NAMES and DEFINES NOWHERE."* The
 * corpus defines it. DOC-007 §18 ratifies the full **eight-op `ApplicabilityExpression` grammar**
 * (ALL/ANY/NOT/EQUALS/IN/CONTAINS/EXISTS/RISK_AT_LEAST), ratified item **C-9** unifies the two names — *"the
 * PolicyExpression grammar is unified with the ApplicabilityExpression op set (one DSL)"* — and this repository
 * has implemented and unit-tested that evaluator since before this kernel was written
 * (`rph-assurance/src/applicability.ts::evaluateApplicability`).
 *
 * I searched for the string `PolicyExpression`, found only references, and concluded the CONCEPT was undefined.
 * Searching one name and concluding about the corpus is the absence-of-evidence error, and the refutation was
 * sitting in the register this kernel's own finding was being written into.
 *
 * SO THE UNDECIDABLE OUTCOME IS NOW EARNED RATHER THAN ASSERTED. `evaluate` is INJECTED: the DSL evaluator lives
 * in `rph-assurance`, which depends on this package, so importing it here would be a cycle the boundary check
 * forbids. Callers that can see both packages supply it. With an evaluator, an expression is EVALUATED. Without
 * one, the outcome is still REQUIRES_HUMAN_DETERMINATION — but that now states a true fact about THIS CALL ("no
 * evaluator was supplied") instead of a false one about the corpus.
 *
 * `lifecycleTriggers`, `eventTriggers`, `riskConditions` and `semanticChangeConditions` are ACTIVATION conditions
 * (§5.3 — *when* a policy activates), not SCOPE conditions (*what* it governs). This kernel answers scope only,
 * which is the question `RequestAssuranceAssessment` needs answered; activation is a separate concern and is not
 * silently folded in here.
 */
export function policyApplicability(
	rule: ApplicabilityRuleView | undefined,
	subject: ApplicabilitySubject,
	/**
	 * Evaluates a DOC-007 §18 expression against the subject. Injected rather than imported — see the note above.
	 * Omit it and an expression stays undecidable; supply it and the expression decides.
	 */
	evaluate?: (expression: unknown, subject: ApplicabilitySubject) => boolean
): ApplicabilityOutcomeValue {
	// No rule at all: nothing scopes the policy, so nothing excludes this subject. Not the same as a rule that
	// says "everything" — it is the absence of a scope, and the honest reading of absence here is permissive
	// because a policy with no declared scope has not declared this subject out.
	if (!rule) return 'REQUIRED';
	const objectTypes = (rule.objectTypeConditions ?? []).filter(
		(c): c is string => typeof c === 'string'
	);
	// A rule whose objectTypeConditions are present but NOT plain strings cannot be compared — the corpus does not
	// define ObjectTypeCondition, so a structured one is undecidable here rather than unsatisfied.
	if ((rule.objectTypeConditions ?? []).length > 0 && objectTypes.length === 0)
		return 'REQUIRES_HUMAN_DETERMINATION';
	if (objectTypes.length > 0 && !objectTypes.includes(subject.objectType)) return 'NOT_APPLICABLE';
	// pwuKindConditions restricts WHICH KIND of work unit. Absent = unrestricted; present = an allow-list. A
	// subject with no pwuKind (a PWA, say) cannot satisfy a kind restriction, so a kind-scoped policy does not
	// apply to it.
	const kinds = rule.pwuKindConditions ?? [];
	if (kinds.length > 0 && (subject.pwuKind === undefined || !kinds.includes(subject.pwuKind)))
		return 'NOT_APPLICABLE';
	const tags = subject.tags ?? [];
	if ((rule.requiredTags ?? []).some((t) => !tags.includes(t))) return 'NOT_APPLICABLE';
	if ((rule.excludedTags ?? []).some((t) => tags.includes(t))) return 'NOT_APPLICABLE';
	// Everything this kernel CAN decide says the policy applies. An expression is the last word: it can only
	// NARROW the verdict reached above, never widen it — a subject already excluded by object type or kind is not
	// re-admitted by an expression that happens to hold. Absent expression => the verdict above stands (REQUIRED).
	return narrowByExpression(rule.expression, subject, evaluate);
}

/** The §5.2 outcomes, as a local union so rph-domain stays free of a contracts import (pure kernel, string states). */
export type ApplicabilityOutcomeValue =
	'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL' | 'NOT_APPLICABLE' | 'REQUIRES_HUMAN_DETERMINATION';

/** True when an outcome permits assessing the subject under the policy. Only NOT_APPLICABLE forbids it: a
 *  REQUIRES_HUMAN_DETERMINATION outcome means the machine cannot decide, and refusing on it would block work on
 *  an unevaluable condition rather than surfacing it. It is permitted and DISCLOSED by the caller. */
export function applicabilityPermitsAssessment(outcome: ApplicabilityOutcomeValue): boolean {
	return outcome !== 'NOT_APPLICABLE';
}

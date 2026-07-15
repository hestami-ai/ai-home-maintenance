// Decomposition / recomposition enforcement — the M9 domain kernel. Pure, deterministic predicates over
// lightweight read-models (the caller assembles them from the contract objects + supplementary evidence,
// exactly as pwuGuards consumes PwuAxes rather than a whole PWU). Grounded in the Canonical Domain Model
// (§10-§14, §35.1) and the Executable Invariant & Conformance Test Spec (RPH-DEC-*, RPH-CNS-*, RPH-ASM-*,
// Property P2/P3). No I/O; depends only on rph-contracts enums (indirectly, via string states) and the
// generic transition matrix in stateMachine.js.
//
// Three load-bearing laws are encoded here:
//   * Obligation conservation (§35.1 "No obligation disappears", Property P2, RPH-DEC-002/007):
//     mandatory parent obligations = allocated + retained + satisfied + authorized waivers.
//   * Constraint non-drop (§11.2, §35.1 "No constraint silently drops", Property P3, RPH-CNS-001..004,
//     RPH-DEC-003): every mandatory applicable parent constraint has one of five dispositions per child.
//   * Recomposition is not concatenation (§14.1, RPH-DEC-006): a recomposition may be CONFLICTED even when
//     every child PWU is individually SATISFIED — child satisfaction is necessary but not sufficient.
import { canTransition } from './stateMachine.js';

// ============================================================================================
// Obligation conservation (§13, §35.1; RPH-DEC-002, RPH-DEC-007; Property P2)
// ============================================================================================

/** The four legal dispositions of a parent obligation during decomposition (persistence allocation_type,
 *  §8.4). NOTE: RETAINED is a decomposition-level disposition, NOT an Obligation.status value (§10.1). */
export type ObligationDisposition = 'ALLOCATED' | 'RETAINED' | 'SATISFIED' | 'WAIVED';

export interface ParentObligation {
	readonly obligationId: string;
	/** 'MANDATORY' | 'CONDITIONAL' | 'ADVISORY' (§10.1). Only MANDATORY obligations are conservation-gated. */
	readonly strength: string;
}

/** Everything needed to decide whether every mandatory parent obligation is accounted for. The allocated and
 *  retained sets come straight off the DecompositionContract; satisfied/waived are supplied by the caller
 *  from supported claims and authorized waivers respectively (they are not carried on the contract). */
export interface ObligationConservationInput {
	readonly parentObligations: readonly ParentObligation[];
	readonly allocatedObligationIds: readonly string[];
	readonly retainedObligationIds: readonly string[];
	/** Obligations already satisfied by a supported claim (§10.2: a related PWU merely completing is NOT enough). */
	readonly satisfiedObligationIds: readonly string[];
	/** Obligations discharged by an authorized waiver (§10.2, §23.2 governance). */
	readonly authorizedWaiverObligationIds: readonly string[];
}

export interface ObligationConservationFinding {
	readonly code: 'MISSING_OBLIGATION_ALLOCATION';
	readonly obligationId: string;
}

export interface ObligationConservationResult {
	readonly ok: boolean;
	readonly findings: readonly ObligationConservationFinding[];
	/** Per mandatory obligation: every disposition it currently holds (may be more than one). */
	readonly dispositions: ReadonlyMap<string, readonly ObligationDisposition[]>;
}

/**
 * RPH-DEC-002 / RPH-DEC-007 / Property P2. Every MANDATORY parent obligation must have at least one valid
 * disposition (allocated ∪ retained ∪ satisfied ∪ authorized-waiver). Any mandatory obligation with none is
 * a MISSING_OBLIGATION_ALLOCATION finding — the caller turns the decomposition INVALID and blocks child
 * execution. CONDITIONAL/ADVISORY obligations are not gated (§13.2 gates *mandatory* obligations only).
 */
export function validateObligationConservation(
	input: ObligationConservationInput
): ObligationConservationResult {
	const allocated = new Set(input.allocatedObligationIds);
	const retained = new Set(input.retainedObligationIds);
	const satisfied = new Set(input.satisfiedObligationIds);
	const waived = new Set(input.authorizedWaiverObligationIds);

	const dispositions = new Map<string, readonly ObligationDisposition[]>();
	const findings: ObligationConservationFinding[] = [];

	for (const o of input.parentObligations) {
		if (o.strength !== 'MANDATORY') continue;
		const d: ObligationDisposition[] = [];
		if (allocated.has(o.obligationId)) d.push('ALLOCATED');
		if (retained.has(o.obligationId)) d.push('RETAINED');
		if (satisfied.has(o.obligationId)) d.push('SATISFIED');
		if (waived.has(o.obligationId)) d.push('WAIVED');
		dispositions.set(o.obligationId, d);
		if (d.length === 0)
			findings.push({ code: 'MISSING_OBLIGATION_ALLOCATION', obligationId: o.obligationId });
	}

	return { ok: findings.length === 0, findings, dispositions };
}

// ============================================================================================
// Constraint propagation (§11.2, §35.1; RPH-CNS-001..004, RPH-DEC-003; Property P3)
// ============================================================================================

/** The five dispositions a mandatory parent constraint may take toward a relevant child (§11.2). */
export type ConstraintDisposition =
	'PROPAGATED' | 'RETAINED' | 'INAPPLICABLE' | 'WAIVED' | 'SUPERSEDED';

export interface ParentConstraint {
	readonly constraintId: string;
	/** 'MANDATORY' | 'PREFERRED' | 'ADVISORY' (§11.1). Only MANDATORY + applicable constraints are gated. */
	readonly strength: string;
	/** Whether the constraint is relevant/applicable to this decomposition (§11.2 "relevant child"). */
	readonly applicable: boolean;
	/** The children this mandatory constraint is relevant to (§11.2 / Property P3 quantify PER RELEVANT
	 *  CHILD). Every one of these must be dispositioned; any omitted child is a per-child silent drop
	 *  (RPH-DEC-003). Empty => the constraint is retained wholly at the parent and delegates to no child. */
	readonly relevantChildWorkUnitIds: readonly string[];
}

/** One disposition of one parent constraint toward one or more relevant children. A constraint may be
 *  dispositioned by several records (e.g. propagated to some children, retained for others); the union of the
 *  records' childWorkUnitIds must cover every relevant child (§11.2 "for each relevant child"). */
export interface ConstraintDispositionRecord {
	readonly constraintId: string;
	readonly disposition: ConstraintDisposition;
	/** The relevant children this record dispositions (fixture §13 shape: constraintPropagations carry a
	 *  childWorkUnitIds list). A record covering no children still runs its well-formedness checks. */
	readonly childWorkUnitIds: readonly string[];
	readonly rationale?: string;
	readonly authorityDecisionId?: string;
	readonly supersededByConstraintId?: string;
	/** Strength at the child when PROPAGATED. Absent => strength preserved. Present & weaker => RPH-CNS-002. */
	readonly propagatedStrength?: string;
	/** RPH-CNS-004: the caller has determined this WAIVED disposition's waiver has expired (evaluated asOf the
	 *  relevant time — the pure kernel takes no clock, mirroring canAuthorizeNewWork/RPH-ASM-006). */
	readonly waiverExpired?: boolean;
}

export interface ConstraintPropagationInput {
	readonly parentConstraints: readonly ParentConstraint[];
	readonly dispositions: readonly ConstraintDispositionRecord[];
}

export type ConstraintFindingCode =
	| 'SILENT_CONSTRAINT_DROP' // RPH-DEC-003 / §11.2: a relevant child with no disposition for the constraint
	| 'CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY' // RPH-CNS-001/002: propagated but strength reduced w/o authority
	| 'INAPPLICABLE_WITHOUT_RATIONALE' // RPH-CNS-003: inapplicable lacking rationale or authority basis
	| 'WAIVED_WITHOUT_AUTHORITY' // waived lacking an authority decision (§11.2)
	| 'WAIVED_EXPIRED' // RPH-CNS-004: an expired waiver no longer satisfies the constraint disposition
	| 'SUPERSEDED_WITHOUT_REPLACEMENT'; // superseded lacking the stronger replacement constraint

export interface ConstraintPropagationFinding {
	readonly code: ConstraintFindingCode;
	readonly constraintId: string;
	/** Set for per-child findings (SILENT_CONSTRAINT_DROP names the uncovered relevant child). */
	readonly childWorkUnitId?: string;
}

export interface ConstraintPropagationResult {
	readonly ok: boolean;
	readonly findings: readonly ConstraintPropagationFinding[];
}

/**
 * RPH-CNS-001..004 / RPH-DEC-003 / Property P3. For every MANDATORY applicable parent constraint, EVERY relevant
 * child must be dispositioned (the union of the constraint's disposition records must cover
 * relevantChildWorkUnitIds — a single uncovered relevant child is a per-child SILENT_CONSTRAINT_DROP, which
 * §35.1 "No constraint silently drops" / RPH-DEC-003 require to reject the decomposition), and each disposition
 * record must be well-formed:
 *   - PROPAGATED preserves strength; a weaker propagatedStrength without an authority decision => weakened
 *     without authority (RPH-CNS-001/002).
 *   - INAPPLICABLE requires a rationale and an authority/policy basis (RPH-CNS-003).
 *   - WAIVED requires an authority decision, and an expired waiver no longer satisfies the disposition
 *     (RPH-CNS-004 — the "review-required" half; the baseline-promotion-block half is M10 governance).
 *   - SUPERSEDED requires the id of the stronger replacement constraint.
 */
export function validateConstraintPropagation(
	input: ConstraintPropagationInput
): ConstraintPropagationResult {
	const byConstraint = new Map<string, ConstraintDispositionRecord[]>();
	for (const r of input.dispositions) {
		const list = byConstraint.get(r.constraintId) ?? [];
		list.push(r);
		byConstraint.set(r.constraintId, list);
	}

	const findings: ConstraintPropagationFinding[] = [];
	for (const c of input.parentConstraints) {
		findings.push(...collectConstraintFindings(c, byConstraint));
	}
	return { ok: findings.length === 0, findings };
}

/** Per-constraint gate for {@link validateConstraintPropagation}: findings for one MANDATORY applicable parent
 *  constraint (per-relevant-child coverage §11.2/P3 + each record's well-formedness). A non-gated constraint
 *  (not MANDATORY or not applicable) yields none. Order: SILENT_CONSTRAINT_DROP findings first, then per-record
 *  disposition findings — identical to the original inlined loop body. */
function collectConstraintFindings(
	c: ParentConstraint,
	byConstraint: Map<string, ConstraintDispositionRecord[]>
): ConstraintPropagationFinding[] {
	if (c.strength !== 'MANDATORY' || !c.applicable) return [];
	const records = byConstraint.get(c.constraintId) ?? [];
	const findings: ConstraintPropagationFinding[] = [];

	// Per-relevant-child coverage (§11.2 / Property P3): every relevant child must be dispositioned.
	const covered = new Set<string>();
	for (const r of records) for (const child of r.childWorkUnitIds) covered.add(child);
	for (const child of c.relevantChildWorkUnitIds)
		if (!covered.has(child))
			findings.push({
				code: 'SILENT_CONSTRAINT_DROP',
				constraintId: c.constraintId,
				childWorkUnitId: child
			});

	// A mandatory constraint with relevant children but no disposition record at all is also a drop
	// (covered by the loop above); a constraint relevant to NO child (relevantChildWorkUnitIds = []) is
	// retained wholly at the parent and needs no record.
	for (const r of records) findings.push(...checkConstraintDisposition(c.constraintId, r));
	return findings;
}

function checkConstraintDisposition(
	constraintId: string,
	r: ConstraintDispositionRecord
): ConstraintPropagationFinding[] {
	const out: ConstraintPropagationFinding[] = [];
	switch (r.disposition) {
		case 'PROPAGATED':
			// RPH-CNS-001: propagation preserves strength. RPH-CNS-002: weakening requires authority.
			if (r.propagatedStrength && r.propagatedStrength !== 'MANDATORY' && !r.authorityDecisionId)
				out.push({ code: 'CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY', constraintId });
			break;
		case 'INAPPLICABLE':
			// RPH-CNS-003: rationale AND an authority/policy basis required.
			if (!r.rationale || !r.authorityDecisionId)
				out.push({ code: 'INAPPLICABLE_WITHOUT_RATIONALE', constraintId });
			break;
		case 'WAIVED':
			// RPH-CNS-004: an expired waiver no longer satisfies the disposition (review-required).
			if (!r.authorityDecisionId) out.push({ code: 'WAIVED_WITHOUT_AUTHORITY', constraintId });
			else if (r.waiverExpired) out.push({ code: 'WAIVED_EXPIRED', constraintId });
			break;
		case 'SUPERSEDED':
			if (!r.supersededByConstraintId)
				out.push({ code: 'SUPERSEDED_WITHOUT_REPLACEMENT', constraintId });
			break;
		case 'RETAINED':
			break; // retention at parent level is always a valid disposition (§11.2)
	}
	return out;
}

// ============================================================================================
// Recomposition (§14, §14.1; RPH-DEC-005, RPH-DEC-006)
// ============================================================================================

/** A required child's contribution to recomposition. `acceptable` = SATISFIED / CONDITIONALLY_SATISFIED /
 *  WAIVED / SUPERSEDED-via-authorized-decision (§14.1); the caller computes it from the child's axes. */
export interface RequiredChildResult {
	readonly childWorkUnitId: string;
	readonly acceptable: boolean;
}

/** A contradiction discovered while aggregating child outputs (e.g. incompatible tenant-identity models). */
export interface DetectedConflict {
	readonly conflictType: string;
	readonly conflictingChildWorkUnitIds: readonly string[];
	readonly description: string;
}

export interface ConflictResolutionRuleInput {
	readonly conflictType: string;
	readonly action: string;
}

export interface RecompositionInput {
	readonly requiredChildResults: readonly RequiredChildResult[];
	readonly detectedConflicts: readonly DetectedConflict[];
	readonly conflictResolutionRules: readonly ConflictResolutionRuleInput[];
	/** Does the recomposed whole support the PARENT completion claim (§14.1: not merely child claims)? */
	readonly parentCompletionClaimSupported: boolean;
	/** Do the parent constraints hold against the recomposed result (§14.1)? */
	readonly parentConstraintsHoldAgainstWhole: boolean;
}

export type RecompositionOutcome = 'SATISFIED' | 'CONFLICTED' | 'INSUFFICIENT';

export interface AppliedResolution {
	readonly conflictType: string;
	readonly action: string;
}

export interface RecompositionEvaluation {
	readonly status: RecompositionOutcome;
	readonly parentSatisfied: boolean;
	readonly event:
		'RecompositionCompleted' | 'RecompositionConflictDetected' | 'RecompositionFailed';
	readonly appliedResolutions: readonly AppliedResolution[];
	readonly unsatisfiedChildWorkUnitIds: readonly string[];
	readonly reasons: readonly string[];
}

/** Default action when a conflict has no matching resolution rule (§14: a detected conflict blocks the parent). */
const DEFAULT_CONFLICT_ACTION = 'REJECT_RECOMPOSITION';

/**
 * §14.1 / RPH-DEC-006. Recomposition is NOT concatenation. Precedence:
 *   1. Any detected conflict => CONFLICTED, parent NOT satisfied, RecompositionConflictDetected — EVEN IF every
 *      required child is individually acceptable. This is the recomposition analog of property P1: child
 *      satisfaction is necessary but not sufficient. Each conflict is mapped to its resolution action.
 *   2. Otherwise, any required child not acceptable => INSUFFICIENT, RecompositionFailed.
 *   3. Otherwise, if the recomposed whole does not support the parent completion claim or the parent
 *      constraints do not hold against the whole => INSUFFICIENT, RecompositionFailed.
 *   4. Otherwise => SATISFIED, parent satisfied, RecompositionCompleted.
 */
export function evaluateRecomposition(input: RecompositionInput): RecompositionEvaluation {
	const unsatisfied = input.requiredChildResults
		.filter((c) => !c.acceptable)
		.map((c) => c.childWorkUnitId);

	if (input.detectedConflicts.length > 0) {
		const ruleByType = new Map(
			input.conflictResolutionRules.map((r) => [r.conflictType, r.action])
		);
		const appliedResolutions = input.detectedConflicts.map((c) => ({
			conflictType: c.conflictType,
			action: ruleByType.get(c.conflictType) ?? DEFAULT_CONFLICT_ACTION
		}));
		return {
			status: 'CONFLICTED',
			parentSatisfied: false,
			event: 'RecompositionConflictDetected',
			appliedResolutions,
			unsatisfiedChildWorkUnitIds: unsatisfied,
			reasons: input.detectedConflicts.map((c) => `${c.conflictType}: ${c.description}`)
		};
	}

	if (unsatisfied.length > 0) {
		return {
			status: 'INSUFFICIENT',
			parentSatisfied: false,
			event: 'RecompositionFailed',
			appliedResolutions: [],
			unsatisfiedChildWorkUnitIds: unsatisfied,
			reasons: ['required children not yet acceptable']
		};
	}

	const wholeReasons: string[] = [];
	if (!input.parentCompletionClaimSupported)
		wholeReasons.push('recomposed evidence does not support the parent completion claim');
	if (!input.parentConstraintsHoldAgainstWhole)
		wholeReasons.push('parent constraints do not hold against the recomposed whole');
	if (wholeReasons.length > 0) {
		return {
			status: 'INSUFFICIENT',
			parentSatisfied: false,
			event: 'RecompositionFailed',
			appliedResolutions: [],
			unsatisfiedChildWorkUnitIds: [],
			reasons: wholeReasons
		};
	}

	return {
		status: 'SATISFIED',
		parentSatisfied: true,
		event: 'RecompositionCompleted',
		appliedResolutions: [],
		unsatisfiedChildWorkUnitIds: [],
		reasons: []
	};
}

// ============================================================================================
// Assumption reification & lifecycle (§12; RPH-ASM-001..006)
// ============================================================================================

export interface AssumptionView {
	readonly assumptionId: string;
	/** 'IMMATERIAL' | 'MATERIAL' | 'CRITICAL' (§12.1). */
	readonly materiality: string;
	/** Assumption.status (§12.1): PROPOSED | DISCLOSED | UNDER_VERIFICATION | ACCEPTED | VERIFIED |
	 *  FALSIFIED | EXPIRED | SUPERSEDED. */
	readonly status: string;
	readonly affectedObjectIds: readonly string[];
}

/** §12.1 materiality classifier. A MATERIAL or CRITICAL assumption must be reified into a first-class
 *  Assumption Object (see validateAssumptionReification for the enforcing gate); IMMATERIAL need not be. */
export function requiresReification(materiality: string): boolean {
	return materiality === 'MATERIAL' || materiality === 'CRITICAL';
}

/** A material assumption an assessment surfaced, together with whether it was reified into an Assumption Object. */
export interface DetectedAssumption {
	readonly assumptionId: string;
	readonly materiality: string;
	/** True when a first-class Assumption Object was created and linked (RPH-ASM-001). */
	readonly reified: boolean;
}

export interface AssumptionReificationFinding {
	readonly code: 'UNREIFIED_MATERIAL_ASSUMPTION';
	readonly assumptionId: string;
}

export interface AssumptionReificationResult {
	/** false => the assessment must be REJECTED or remain INCOMPLETE (RPH-ASM-002). */
	readonly ok: boolean;
	readonly findings: readonly AssumptionReificationFinding[];
}

/**
 * RPH-ASM-001 / RPH-ASM-002 / §35.1 "No hidden material assumption". The reify-or-reject GATE (distinct from the
 * requiresReification classifier): every MATERIAL/CRITICAL assumption an assessment surfaced must have been
 * reified into a first-class Assumption Object. If any material assumption completed still embedded only in
 * prose (reified === false), the assessment result is rejected or remains incomplete (ok === false). This is a
 * conservation law in the same family as "No obligation disappears" / "No constraint silently drops".
 */
export function validateAssumptionReification(
	detected: readonly DetectedAssumption[]
): AssumptionReificationResult {
	const findings: AssumptionReificationFinding[] = [];
	for (const a of detected)
		if (requiresReification(a.materiality) && !a.reified)
			findings.push({ code: 'UNREIFIED_MATERIAL_ASSUMPTION', assumptionId: a.assumptionId });
	return { ok: findings.length === 0, findings };
}

export interface AcceptanceOutcome {
	readonly newStatus: 'ACCEPTED';
	readonly isVerified: false;
	readonly legalTransition: boolean;
}

/** RPH-ASM-003 / §12.2. Human acceptance sets status ACCEPTED, NOT VERIFIED: acceptance is an authority act
 *  permitting proceeding under residual risk; verification is an evidentiary act. `legalTransition` reports
 *  whether the Assumption.status machine permits from -> ACCEPTED. */
export function assessAcceptance(a: AssumptionView): AcceptanceOutcome {
	return {
		newStatus: 'ACCEPTED',
		isVerified: false,
		legalTransition: canTransition('Assumption.status', a.status, 'ACCEPTED')
	};
}

export interface FalsificationOutcome {
	readonly newStatus: 'FALSIFIED';
	readonly impactAnalysisRequired: true;
	/** The objects whose validity must be re-examined — the assumption's affected objects (§12.1, §29.1). */
	readonly impactedObjectIds: readonly string[];
	readonly contradictingEvidenceIds: readonly string[];
	readonly event: 'AssumptionFalsified';
	readonly legalTransition: boolean;
}

/** RPH-ASM-004 / §12.2 / §29.1. Contradicting evidence falsifies an assumption: status FALSIFIED,
 *  AssumptionFalsified emitted, impact analysis REQUIRED over the affected objects, dependent claims reviewed. */
export function assessFalsification(
	a: AssumptionView,
	contradictingEvidenceIds: readonly string[]
): FalsificationOutcome {
	return {
		newStatus: 'FALSIFIED',
		impactAnalysisRequired: true,
		impactedObjectIds: [...a.affectedObjectIds],
		contradictingEvidenceIds: [...contradictingEvidenceIds],
		event: 'AssumptionFalsified',
		legalTransition: canTransition('Assumption.status', a.status, 'FALSIFIED')
	};
}

/** RPH-ASM-005 / §12.2. An unresolved CRITICAL assumption blocks an irreversible execution step unless it has
 *  been verified OR explicitly accepted by authority. (MATERIAL/IMMATERIAL do not block on their own.) */
export function blocksIrreversibleWork(a: AssumptionView): boolean {
	if (a.materiality !== 'CRITICAL') return false;
	return a.status !== 'VERIFIED' && a.status !== 'ACCEPTED';
}

/** RPH-ASM-006 / §12.2. An EXPIRED (or FALSIFIED / SUPERSEDED) assumption cannot authorize new work — a new
 *  execution plan depending on it is rejected at plan approval. Only live assumptions may authorize work. */
export function canAuthorizeNewWork(a: AssumptionView): boolean {
	return a.status !== 'EXPIRED' && a.status !== 'FALSIFIED' && a.status !== 'SUPERSEDED';
}

// ============================================================================================
// Decomposition validation (composition) — §13.2; RPH-DEC-001..005
// ============================================================================================

export type DecompositionFindingCode =
	| ObligationConservationFinding['code']
	| ConstraintFindingCode
	| 'MISSING_RECOMPOSITION_CONTRACT' // RPH-DEC-005
	| 'CHILD_DOES_NOT_TRACE_TO_PARENT' // §13.2 (every child must trace to the parent)
	| 'CHILD_INTENT_DIVERGENCE'; // RPH-DEC-004

export type FindingSeverity = 'BLOCKING' | 'REQUIRES_DECISION';

export interface DecompositionFinding {
	readonly code: DecompositionFindingCode;
	readonly severity: FindingSeverity;
	readonly detail: string;
}

export interface DecompositionValidationInput {
	readonly obligations: ObligationConservationInput;
	readonly constraints: ConstraintPropagationInput;
	/** RPH-DEC-005: a material decomposition needs a paired recomposition contract to become valid. */
	readonly hasRecompositionContract: boolean;
	readonly isMaterialDecomposition: boolean;
	/** §13.2: every child PWU must trace to the parent. */
	readonly childrenTraceToParent: boolean;
	/** RPH-DEC-004: child ids that introduce unauthorized divergent intent. */
	readonly intentDivergentChildIds?: readonly string[];
}

export interface DecompositionValidation {
	readonly status: 'VALID' | 'CONDITIONALLY_VALID' | 'INVALID';
	readonly findings: readonly DecompositionFinding[];
	/** §13.2 gate: the parent may become PLANNED through child execution only when NOT INVALID. */
	readonly permitsParentPlanned: boolean;
}

/**
 * Compose the obligation, constraint, recomposition, trace and intent checks into an overall decomposition
 * disposition (RPH-DEC-001..005, §13.2). Any BLOCKING finding => INVALID (child execution blocked). Only
 * REQUIRES_DECISION findings (e.g. child intent divergence, which §RPH-DEC-004 says is "rejected OR requires a
 * human decision") => CONDITIONALLY_VALID. No findings => VALID.
 */
export function validateDecomposition(
	input: DecompositionValidationInput
): DecompositionValidation {
	const findings: DecompositionFinding[] = [];

	for (const f of validateObligationConservation(input.obligations).findings)
		findings.push({
			code: f.code,
			severity: 'BLOCKING',
			detail: `mandatory obligation ${f.obligationId} is neither allocated, retained, satisfied, nor waived`
		});

	for (const f of validateConstraintPropagation(input.constraints).findings)
		findings.push({
			code: f.code,
			severity: 'BLOCKING',
			detail: `constraint ${f.constraintId}: ${f.code}`
		});

	if (input.isMaterialDecomposition && !input.hasRecompositionContract)
		findings.push({
			code: 'MISSING_RECOMPOSITION_CONTRACT',
			severity: 'BLOCKING',
			detail: 'a material decomposition requires a paired recomposition contract (RPH-DEC-005)'
		});

	if (!input.childrenTraceToParent)
		findings.push({
			code: 'CHILD_DOES_NOT_TRACE_TO_PARENT',
			severity: 'BLOCKING',
			detail: 'every child PWU must trace to the parent (§13.2)'
		});

	for (const childId of input.intentDivergentChildIds ?? [])
		findings.push({
			code: 'CHILD_INTENT_DIVERGENCE',
			severity: 'REQUIRES_DECISION',
			detail: `child ${childId} introduces unauthorized divergent intent (RPH-DEC-004)`
		});

	const hasBlocking = findings.some((f) => f.severity === 'BLOCKING');
	let status: DecompositionValidation['status'];
	if (hasBlocking) status = 'INVALID';
	else if (findings.length > 0) status = 'CONDITIONALLY_VALID';
	else status = 'VALID';
	return { status, findings, permitsParentPlanned: status !== 'INVALID' };
}

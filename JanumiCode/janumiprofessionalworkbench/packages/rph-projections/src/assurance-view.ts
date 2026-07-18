// The Assurance View — the read model DOC-004 §38 ("Assurance Workbench Requirements") describes: for each
// assessment, what was assessed, under which policy, on what evidence, with what findings, and how it came out.
// A pure fold over the assurance events in the domain log, following the same Projector contract as the Work view.
//
// WHY THIS IS HONEST ABOUT ITS SCOPE. §38 lists fourteen fields the view must show. A 14-agent sweep (Increment
// 32) mapped each to the live log; this projector folds ONLY what the log genuinely sources today and leaves the
// rest visibly absent rather than fabricated. The mapping, per field:
//
//   POPULATED (sourceable now):
//     policyId / policyVersion    — AssuranceAssessmentStarted + Completed        (§38 "applicable policies", assessed sense)
//     assessmentState             — Started -> ASSESSING, Completed -> disposition (§38 "assessment state")
//     evidenceConsideredIds       — AssuranceAssessmentCompleted                   (§38 "evidence considered")
//     disposition                 — AssuranceAssessmentCompleted                   (§38 "disposition")
//     observations[].findingCode  — AssuranceObservationRecorded                   (§38 "findings")
//     observations[].severity     — AssuranceObservationRecorded                   (§38 "severity")
//     openConditions              — Completed.residualUncertainty when disposition CONDITIONALLY_SATISFIED (§38 "open conditions")
//     validatorImplementationIdentity / ...Version — AssuranceAssessmentCompleted.validatorId / .validatorVersion
//                                       (§38 "validator implementation identity"; §22 audit "validator/version"). Threaded
//                                       onto the event in Increment 37 — the §20 ValidatorResult always carried it, the
//                                       §19.3 first-slice event had dropped it. Now sourced; `undefined` only on a
//                                       (pre-Increment-37 / malformed) event that lacks the field — unknown, not "none".
//     independenceStatus              — 'VERIFIED' from AssuranceAssessmentCompleted.independenceResult (the check RAN and
//                                       passed, Increment I4); 'VIOLATED' from the AssuranceIndependenceViolated event
//                                       (Increment I2, a distinct terminal state); `undefined` when the check did not run
//                                       — unknown, never a fabricated pass. §38 field + §39 invariant 8 + §22 "independence result".
//     waivers                         — WaiverRequested/Granted/Denied, correlated by the Decision aggregate id and
//                                       attached to each assessment whose (policyId, subjectObjectIds) the waiver names
//                                       (§12 waiver path; §38 "waivers"; §39 invariants 13/14). A waiver is attached at
//                                       REQUEST time (when subject+policy are on the wire) and its status is advanced in
//                                       place on Grant/Deny. Empty = no waiver names this assessment (a real none).
//     invalidations (§38 "invalidation status") — EvidenceInvalidated marks an assessment whose evidenceConsideredIds
//                                       include the invalidated evidence; PwuInvalidated marks one whose subject it is
//                                       (§39 invariants 15/16). The events ARE folded, so an empty list is a real
//                                       "not invalidated", not "unknown".
//     claimsEvaluated (§38 "claims evaluated") — AssuranceAssessmentStarted.claimIds.
//     controlActions  (§38 "control actions")  — AssuranceAssessmentCompleted.recommendedControlActions (the validator's
//                                       recommended actions; the 23-value ControlAction enum). Empty before completion.
//                                       CORRECTION (Increment F): an earlier note here filed this UNSOURCED as "no
//                                       control-action event exists" — that grepped for an event TYPE and missed the
//                                       FIELD on the completion event. The datum was on the wire all along.
//     missingEvidence (§38 "missing evidence") — required MINUS received. The required side is the
//                                       evidence-requirement ids the policy declares
//                                       (AssuranceAssessmentStarted.requiredEvidenceIds, resolved from §6.1,
//                                       Increment K); the received side removes each requirement satisfied by a
//                                       submitted evidence (AssuranceEvidenceReceived.satisfiesRequirementId — the
//                                       §32 submitEvidenceForAssessment sub-lifecycle, Increment Q). Empty = the
//                                       policy requires no evidence OR every requirement has been satisfied. FAITHFUL
//                                       now, not partial: it is a real difference-fold (DOC-004 §31 L1770 — the
//                                       schema-and-wiring task, done). The one honest limit is the namespace: the
//                                       satisfied set is keyed by EvidenceRequirement id (which the submit command
//                                       binds explicitly), never inferred from an Evidence object's proximity.
//
// The distinction between "unknown" (no source) and "none" (a real empty) is load-bearing: rendering an unsourced
// field as "none" is the false-negative that lets a node look assured when it was never checked. Every §38 field is
// sourced; `missingEvidence` is a real required-minus-received fold, and its empties are real (a policy requiring no
// evidence, or one whose requirements are all satisfied, has none missing).
import type { DomainEvent } from '@janumipwb/rph-contracts';

export interface AssuranceObservationView {
	readonly observationId: string;
	readonly findingCode: string;
	readonly severity: string;
	readonly statement: string;
	readonly disposition: string;
}

/** §38 "waivers" — a waiver naming this assessment's policy + subject, with its lifecycle status. */
export interface AssuranceWaiverView {
	/** The waiver Decision's aggregate id — the correlation key across Requested/Granted/Denied. */
	readonly waiverDecisionId: string;
	/** 'PROPOSED' (Requested) -> 'EFFECTIVE' (Granted) | 'DENIED' (Denied). */
	readonly status: string;
	readonly waivedPolicyId?: string;
	readonly waivedCriterionId?: string;
	readonly waivedFindingIds: readonly string[];
	readonly rationale?: string;
	/** Set when the waiver is granted (WaiverGranted.effectiveAt). */
	readonly effectiveAt?: string;
}

/** §38 "invalidation status" — one cause that invalidated this assessment (§39 invariants 15/16). */
export interface AssuranceInvalidationView {
	/** 'EVIDENCE_INVALIDATED' (a considered evidence was invalidated) | 'SUBJECT_INVALIDATED' (the subject PWU was). */
	readonly status: string;
	/** The evidence or PWU id whose invalidation triggered this. */
	readonly invalidatedObjectId: string;
	readonly reason?: string;
}

export interface AssuranceAssessmentView {
	readonly assessmentId: string;
	readonly policyId: string;
	readonly policyVersion: string;
	readonly subjectObjectIds: readonly string[];
	/** §38 "assessment state": 'ASSESSING' until completed, then the disposition. */
	readonly assessmentState: string;
	/** §38 "disposition" — undefined until the assessment completes. */
	readonly disposition?: string;
	readonly evidenceConsideredIds: readonly string[];
	readonly observations: readonly AssuranceObservationView[];
	/** §38 "open conditions" — the residual statements a CONDITIONALLY_SATISFIED disposition leaves open. */
	readonly openConditions: readonly string[];
	/** §38 "validator implementation identity" — WHICH validator produced this verdict (Completed.validatorId).
	 *  undefined only on an event that predates Increment 37 or lacks the field = unknown, never "none". */
	readonly validatorImplementationIdentity?: string;
	/** The version half of the validator's identity (Completed.validatorVersion; §22 "validator/version"). */
	readonly validatorImplementationVersion?: string;
	/** §38 "independence status" — 'VERIFIED' (Completed.independenceResult) / 'VIOLATED' (AssuranceIndependenceViolated
	 *  event) / undefined when the check did not run = unknown, never a fabricated pass. */
	readonly independenceStatus?: string;
	/** §38 "waivers" — waivers naming this assessment's (policy, subject). Empty = none (the events are folded). */
	readonly waivers: readonly AssuranceWaiverView[];
	/** §38 "invalidation status" — invalidation causes affecting this assessment. Empty = not invalidated. */
	readonly invalidations: readonly AssuranceInvalidationView[];
	/** §38 "claims evaluated" — the claim ids the assessment evaluated (AssuranceAssessmentStarted.claimIds). */
	readonly claimsEvaluated: readonly string[];
	/** §38 "control actions" — the control actions the validator recommended for this result
	 *  (AssuranceAssessmentCompleted.recommendedControlActions). Empty until completion, then a real set. */
	readonly controlActions: readonly string[];
	/** §38 "missing evidence" — required MINUS received: the evidence-requirement ids the policy declares
	 *  (AssuranceAssessmentStarted.requiredEvidenceIds, Increment K) with the ones satisfied by a submitted evidence
	 *  (AssuranceEvidenceReceived.satisfiesRequirementId, §32, Increment Q) removed. Empty = the policy requires no
	 *  evidence OR every requirement has been satisfied — a real answer either way, no longer the whole required set. */
	readonly missingEvidence: readonly string[];
}

export interface AssuranceView {
	readonly assessments: Readonly<Record<string, AssuranceAssessmentView>>;
}

type Payload = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const strArr = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Upsert one assessment into the view — the shared shape every fold below returns. */
function withAssessment(
	view: AssuranceView,
	id: string,
	assessment: AssuranceAssessmentView
): AssuranceView {
	return { assessments: { ...view.assessments, [id]: assessment } };
}

function foldStarted(view: AssuranceView, p: Payload): AssuranceView {
	const assessmentId = str(p.assessmentId);
	const policyId = str(p.assurancePolicyId);
	if (!assessmentId || !policyId) return view;
	return withAssessment(view, assessmentId, {
		assessmentId,
		policyId,
		policyVersion: str(p.policyVersion) ?? '',
		subjectObjectIds: strArr(p.subjectObjectIds),
		assessmentState: 'ASSESSING',
		evidenceConsideredIds: [],
		observations: [],
		openConditions: [],
		waivers: [],
		invalidations: [],
		// §38 "claims evaluated" rides the Started event; "control actions" are recommended only at completion.
		claimsEvaluated: strArr(p.claimIds),
		controlActions: [],
		// §38 "missing evidence": the policy's required-evidence-requirement ids, resolved onto the Started event. It
		// is the full required set until §32 submitEvidenceForAssessment tracks per-requirement satisfaction.
		missingEvidence: strArr(p.requiredEvidenceIds)
	});
}

function foldObservation(view: AssuranceView, p: Payload): AssuranceView {
	const assessmentId = str(p.assessmentId);
	if (!assessmentId) return view;
	const existing = view.assessments[assessmentId];
	if (!existing) return view; // an observation with no started assessment has nothing to attach to
	const observation: AssuranceObservationView = {
		observationId: str(p.observationId) ?? '',
		findingCode: str(p.findingCode) ?? '',
		severity: str(p.severity) ?? '',
		statement: str(p.statement) ?? '',
		disposition: str(p.disposition) ?? ''
	};
	return withAssessment(view, assessmentId, {
		...existing,
		observations: [...existing.observations, observation]
	});
}

function foldEvidenceReceived(view: AssuranceView, p: Payload): AssuranceView {
	const assessmentId = str(p.assessmentId);
	const satisfied = str(p.satisfiesRequirementId);
	if (!assessmentId || !satisfied) return view;
	const existing = view.assessments[assessmentId];
	if (!existing) return view; // received evidence for an unstarted assessment attaches to nothing
	// §38 "missing evidence" is required MINUS received: drop the satisfied requirement id. A filter (not a Set
	// subtraction) keeps it idempotent and order-preserving — re-submitting the same requirement leaves it unchanged,
	// and a requirement the policy never declared (already absent from missingEvidence) is a no-op here too.
	return withAssessment(view, assessmentId, {
		...existing,
		missingEvidence: existing.missingEvidence.filter((reqId) => reqId !== satisfied)
	});
}

function foldCompleted(view: AssuranceView, p: Payload): AssuranceView {
	const assessmentId = str(p.assessmentId);
	if (!assessmentId) return view;
	const existing = view.assessments[assessmentId];
	if (!existing) return view;
	const disposition = str(p.disposition) ?? existing.assessmentState;
	return withAssessment(view, assessmentId, {
		...existing,
		assessmentState: disposition,
		disposition,
		evidenceConsideredIds: strArr(p.evidenceConsideredIds),
		// §38 "open conditions": residuals are conditions only while the disposition is conditional.
		openConditions: disposition === 'CONDITIONALLY_SATISFIED' ? strArr(p.residualUncertainty) : [],
		// §38 "validator implementation identity" — WHO/WHAT judged. `str()` leaves it undefined on an event
		// without the field (pre-Increment-37 / malformed): unknown, never a fabricated identity.
		validatorImplementationIdentity: str(p.validatorId),
		validatorImplementationVersion: str(p.validatorVersion),
		// §38 "independence status": 'VERIFIED' only when the check ran and passed (I4); absent = unknown.
		independenceStatus: str(p.independenceResult),
		// §38 "control actions": the validator's recommended actions for this disposition (the 23-value ControlAction
		// enum, §11). Sourced from the completion event; absent before completion.
		controlActions: strArr(p.recommendedControlActions)
	});
}

function foldViolated(view: AssuranceView, p: Payload): AssuranceView {
	// The ratified §30 terminal state: the assessment did NOT complete to a disposition — required independence
	// failed. Distinct from a normal completion, so it is its own event (Increment I2); the view reads it as the
	// negative half of §38 "independence status".
	const assessmentId = str(p.assessmentId);
	if (!assessmentId) return view;
	const existing = view.assessments[assessmentId];
	if (!existing) return view;
	return withAssessment(view, assessmentId, {
		...existing,
		assessmentState: 'INDEPENDENCE_VIOLATION',
		independenceStatus: 'VIOLATED'
	});
}

/** Map every assessment through `f`. Waivers and invalidations name a policy/subject/evidence, not one assessment
 *  id, so they touch many assessments at once — unlike the assessment-keyed folds above. */
function mapAssessments(
	view: AssuranceView,
	f: (a: AssuranceAssessmentView) => AssuranceAssessmentView
): AssuranceView {
	const next: Record<string, AssuranceAssessmentView> = {};
	for (const [id, a] of Object.entries(view.assessments)) next[id] = f(a);
	return { assessments: next };
}

const intersects = (a: readonly string[], b: readonly string[]): boolean => a.some((x) => b.includes(x));

/** WaiverRequested — attach a PROPOSED waiver to every assessment the waiver names by (policyId, subject). The
 *  waiver's subject + policy ride the RequestWaiver passthrough; the Decision aggregate id is the key the later
 *  Grant/Deny reference. A waiver that names no started assessment attaches to nothing (it waives something
 *  not-yet-assessed) — the same forward-only stance foldObservation takes. */
function foldWaiverRequested(view: AssuranceView, p: Payload, decisionId: string): AssuranceView {
	const waivedPolicyId = str(p.waivedPolicyId);
	const waiverSubjects = strArr(p.subjectObjectIds);
	const waiver: AssuranceWaiverView = {
		waiverDecisionId: decisionId,
		status: 'PROPOSED',
		waivedPolicyId,
		waivedCriterionId: str(p.waivedCriterionId),
		waivedFindingIds: strArr(p.waivedFindingIds),
		rationale: str(p.rationale)
	};
	return mapAssessments(view, (a) =>
		(waivedPolicyId === undefined || a.policyId === waivedPolicyId) &&
		intersects(a.subjectObjectIds, waiverSubjects)
			? { ...a, waivers: [...a.waivers, waiver] }
			: a
	);
}

/** WaiverGranted / WaiverDenied — advance the attached waiver's status in place, found by the Decision aggregate id
 *  (Grant/Deny carry only that). Touches only waivers with the matching id; leaves the rest untouched. */
function foldWaiverResolved(
	view: AssuranceView,
	p: Payload,
	decisionId: string,
	status: string
): AssuranceView {
	const effectiveAt = str(p.effectiveAt);
	return mapAssessments(view, (a) =>
		a.waivers.some((w) => w.waiverDecisionId === decisionId)
			? {
					...a,
					waivers: a.waivers.map((w) =>
						w.waiverDecisionId === decisionId
							? { ...w, status, ...(effectiveAt ? { effectiveAt } : {}) }
							: w
					)
				}
			: a
	);
}

/** EvidenceInvalidated / PwuInvalidated — mark every assessment whose considered evidence (or subject) is the
 *  invalidated object, whose id is the event's own aggregate id. §39 invariant 15 (invalidated evidence -> reassess
 *  dependent claims) and 16 (a subject change invalidates/reviews prior assessments). */
function foldInvalidation(
	view: AssuranceView,
	p: Payload,
	invalidatedObjectId: string,
	status: 'EVIDENCE_INVALIDATED' | 'SUBJECT_INVALIDATED'
): AssuranceView {
	const invalidation: AssuranceInvalidationView = {
		status,
		invalidatedObjectId,
		reason: str(p.invalidationReason)
	};
	const affected = (a: AssuranceAssessmentView): boolean =>
		status === 'EVIDENCE_INVALIDATED'
			? a.evidenceConsideredIds.includes(invalidatedObjectId)
			: a.subjectObjectIds.includes(invalidatedObjectId);
	return mapAssessments(view, (a) =>
		affected(a) ? { ...a, invalidations: [...a.invalidations, invalidation] } : a
	);
}

/** One event -> the next view. Assessment-keyed events read `assessmentId` from the payload; waiver and
 *  invalidation events name a policy/subject/evidence and use the event's own `aggregateId`. Every field is READ
 *  FROM THE EVENT; nothing is inferred from a name. */
export function applyAssuranceEvent(view: AssuranceView, event: DomainEvent): AssuranceView {
	const p = (event.payload ?? {}) as Payload;
	switch (event.eventType) {
		case 'AssuranceAssessmentStarted':
			return foldStarted(view, p);
		case 'AssuranceObservationRecorded':
			return foldObservation(view, p);
		case 'AssuranceEvidenceReceived':
			return foldEvidenceReceived(view, p);
		case 'AssuranceAssessmentCompleted':
			return foldCompleted(view, p);
		case 'AssuranceIndependenceViolated':
			return foldViolated(view, p);
		case 'WaiverRequested':
			return foldWaiverRequested(view, p, event.aggregateId);
		case 'WaiverGranted':
			return foldWaiverResolved(view, p, event.aggregateId, 'EFFECTIVE');
		case 'WaiverDenied':
			return foldWaiverResolved(view, p, event.aggregateId, 'DENIED');
		case 'EvidenceInvalidated':
			return foldInvalidation(view, p, event.aggregateId, 'EVIDENCE_INVALIDATED');
		case 'PwuInvalidated':
			return foldInvalidation(view, p, event.aggregateId, 'SUBJECT_INVALIDATED');
		default:
			return view;
	}
}

/** Fold the whole event log into the Assurance View. */
export function buildAssuranceView(events: readonly DomainEvent[]): AssuranceView {
	let view: AssuranceView = { assessments: {} };
	for (const event of events) view = applyAssuranceEvent(view, event);
	return view;
}

// ---- §38 "applicable policies" (per-PWU) ----------------------------------------------------------------------
//
// §38's FIRST field is "applicable policies", and §38's green-node rule requires "required assurance is satisfied".
// The Assurance View above is assessment-keyed — it shows the policies that WERE assessed. The missing half is the
// policy that APPLIES but was never assessed: the required-but-unassessed gap that §39 invariant 20 ("a baseline
// cannot be promoted solely because all execution steps completed") exists to catch. That set is NOT in the event
// stream — a PWU's applicable policies live on OBJECT STATE (PWU.assurancePolicyIds, and its PwuType's
// requiredAssurancePolicyIds; PwuProposed deliberately drops assurancePolicyIds per §11.3), so this is a JOIN over
// object snapshots the caller reads, not a fold. Kept pure: the caller passes the id arrays; this never touches a
// store.

/** One policy that applies to a PWU, and whether an assessment covers it. */
export interface ApplicablePolicyView {
	readonly policyId: string;
	/** Where the policy applies from: the PWU's own assurancePolicyIds, its PwuType's required set, or both. */
	readonly source: 'DIRECT' | 'TYPE' | 'BOTH';
	/** True when at least one assessment names this policy AND this PWU as a subject. */
	readonly assessed: boolean;
	/** The disposition of the covering assessment, once it has completed (undefined while merely ASSESSING). */
	readonly disposition?: string;
	readonly assessmentId?: string;
}

function policySource(isDirect: boolean, isTypeRequired: boolean): ApplicablePolicyView['source'] {
	if (isDirect && isTypeRequired) return 'BOTH';
	return isDirect ? 'DIRECT' : 'TYPE';
}

/** Join a PWU's applicable-policy set (direct + PwuType-required) against the assessment view to surface, per
 *  policy, whether it is assessed and how it came out — and, by `assessed: false`, the required-but-unassessed
 *  policies §38's green-node rule forbids ignoring. Pure: the caller supplies the object-state id arrays. */
export function buildApplicablePolicies(args: {
	pwuId: string;
	directPolicyIds: readonly string[];
	typeRequiredPolicyIds: readonly string[];
	view: AssuranceView;
}): ApplicablePolicyView[] {
	const direct = new Set(args.directPolicyIds);
	const typeReq = new Set(args.typeRequiredPolicyIds);
	const assessments = Object.values(args.view.assessments);
	return [...new Set([...direct, ...typeReq])].map((policyId) => {
		const source = policySource(direct.has(policyId), typeReq.has(policyId));
		const covering = assessments.filter(
			(a) => a.policyId === policyId && a.subjectObjectIds.includes(args.pwuId)
		);
		// Prefer a COMPLETED assessment (one carrying a disposition) for the reported outcome; else the last match.
		const completed = covering.filter((a) => a.disposition !== undefined);
		const chosen = completed.at(-1) ?? covering.at(-1);
		return {
			policyId,
			source,
			assessed: covering.length > 0,
			...(chosen?.disposition !== undefined ? { disposition: chosen.disposition } : {}),
			...(chosen ? { assessmentId: chosen.assessmentId } : {})
		};
	});
}

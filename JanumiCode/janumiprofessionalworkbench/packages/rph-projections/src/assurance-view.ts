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
//
//   NOT POPULATED, and WHY — recorded, never faked (a blank the view must render as "unknown", not "none"):
//     missingEvidence                 — required-evidence set never reaches the log (AssuranceEvidenceRequired is a
//                                       ratified name, unbuilt — Increment 33). Empty, meaning UNKNOWN not NONE.
//     controlActions / waivers / invalidationStatus — see the §32/§37 conformance items; not folded here yet.
//
// The distinction between "unknown" (no source) and "none" (a real empty) is load-bearing: rendering an
// unsourced field as "none" is the false-negative that lets a node look assured when it was never checked.
import type { DomainEvent } from '@janumipwb/rph-contracts';

export interface AssuranceObservationView {
	readonly observationId: string;
	readonly findingCode: string;
	readonly severity: string;
	readonly statement: string;
	readonly disposition: string;
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
		openConditions: []
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
		independenceStatus: str(p.independenceResult)
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

/** One assurance event -> the next view. Every field is READ FROM THE EVENT; nothing is inferred from a name. */
export function applyAssuranceEvent(view: AssuranceView, event: DomainEvent): AssuranceView {
	const p = (event.payload ?? {}) as Payload;
	switch (event.eventType) {
		case 'AssuranceAssessmentStarted':
			return foldStarted(view, p);
		case 'AssuranceObservationRecorded':
			return foldObservation(view, p);
		case 'AssuranceAssessmentCompleted':
			return foldCompleted(view, p);
		case 'AssuranceIndependenceViolated':
			return foldViolated(view, p);
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

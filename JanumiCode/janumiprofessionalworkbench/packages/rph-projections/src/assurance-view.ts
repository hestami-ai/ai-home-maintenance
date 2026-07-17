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
//
//   NOT POPULATED, and WHY — recorded, never faked (a blank the view must render as "unknown", not "none"):
//     independenceStatus              — the §20 ValidatorResult carries NO independence result, only the policy's
//                                       REQUIREMENT is logged; the independence scorer is built but uncalled. §38 field
//                                       + §39 invariant 8 + §22 "independence result" with no source yet. `undefined`.
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
	/** §38 "independence status" — NO SOURCE today (only the requirement is logged). undefined = unknown. */
	readonly independenceStatus?: string;
}

export interface AssuranceView {
	readonly assessments: Readonly<Record<string, AssuranceAssessmentView>>;
}

type Payload = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const strArr = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** One assurance event -> the next view. Every field is READ FROM THE EVENT; nothing is inferred from a name. */
export function applyAssuranceEvent(view: AssuranceView, event: DomainEvent): AssuranceView {
	const p = (event.payload ?? {}) as Payload;
	switch (event.eventType) {
		case 'AssuranceAssessmentStarted': {
			const assessmentId = str(p.assessmentId);
			const policyId = str(p.assurancePolicyId);
			if (!assessmentId || !policyId) return view;
			return {
				assessments: {
					...view.assessments,
					[assessmentId]: {
						assessmentId,
						policyId,
						policyVersion: str(p.policyVersion) ?? '',
						subjectObjectIds: strArr(p.subjectObjectIds),
						assessmentState: 'ASSESSING',
						evidenceConsideredIds: [],
						observations: [],
						openConditions: []
					}
				}
			};
		}
		case 'AssuranceObservationRecorded': {
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
			return {
				assessments: {
					...view.assessments,
					[assessmentId]: {
						...existing,
						observations: [...existing.observations, observation]
					}
				}
			};
		}
		case 'AssuranceAssessmentCompleted': {
			const assessmentId = str(p.assessmentId);
			if (!assessmentId) return view;
			const existing = view.assessments[assessmentId];
			if (!existing) return view;
			const disposition = str(p.disposition) ?? existing.assessmentState;
			return {
				assessments: {
					...view.assessments,
					[assessmentId]: {
						...existing,
						assessmentState: disposition,
						disposition,
						evidenceConsideredIds: strArr(p.evidenceConsideredIds),
						// §38 "open conditions": residuals are conditions only while the disposition is conditional.
						openConditions:
							disposition === 'CONDITIONALLY_SATISFIED' ? strArr(p.residualUncertainty) : [],
						// §38 "validator implementation identity" — WHO/WHAT judged. `str()` leaves it undefined on an
						// event without the field (pre-Increment-37 / malformed): unknown, never a fabricated identity.
						validatorImplementationIdentity: str(p.validatorId),
						validatorImplementationVersion: str(p.validatorVersion)
					}
				}
			};
		}
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

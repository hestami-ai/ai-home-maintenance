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
//
//   NOT POPULATED, and WHY — recorded, never faked (a blank the view must render as "unknown", not "none"):
//     validatorImplementationIdentity — AssuranceAssessmentCompleted carries NO validatorId (the ValidatorResult
//                                       has one; the event drops it). §38 field with no source. `undefined` here.
//     independenceStatus              — only the policy's REQUIREMENT is logged, never a VERIFIED status. `undefined`.
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
	/** §38 "validator implementation identity" — NO SOURCE today (the event drops validatorId). undefined = unknown. */
	readonly validatorImplementationIdentity?: string;
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
							disposition === 'CONDITIONALLY_SATISFIED' ? strArr(p.residualUncertainty) : []
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

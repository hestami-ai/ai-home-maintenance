// JPWB-SPEC-001-DR-002 W-5 — what a Surface must disclose about a PWU's material uncertainty.
//
// SPEC-001 O-8-R1 (SHALL): "A Surface presenting a PWU SHALL disclose that PWU's material uncertainty."
// SPEC-001 O-8-R2 (SHALL): "Absence of a disclosure SHALL be reportable, not merely undetectable."
// SPEC-001 O-8-R7 (SHALL NOT): a Surface SHALL NOT present incomplete professional understanding as settled.
//
// ── WHY THIS READS EVENTS AND NOT THE ASSESSMENT OBJECT, WHICH IS THE WHOLE POINT ───────────────────────────
//
// `AssuranceAssessment` DECLARES a `residualUncertainty` field, and it is always `[]`.
// `rph-application/src/handlers/assurance.ts` says why, in a comment written long before this work package:
//
//     "evidenceConsideredIds / residualUncertainty / recommendedControlActions are read from the validatorResult
//      and NOT from the object, which reports [] for all three: requestAssuranceAssessment hardcodes them empty
//      and no completion path ever writes them ... SO THE OBJECT'S [] IS SILENCE, NOT A FINDING OF 'NONE'.
//      ... reconciling the object is the §32 increment, not this one."
//
// Measured on the reference seed: 0 statements across every assessment OBJECT, 1 across 32 completion EVENTS.
//
// A disclosure built on the object would therefore have rendered "no residual uncertainty declared" for work
// nobody had assessed — presenting silence as a professional's finding of none, which is O-8-R7 exactly, in the
// component built to satisfy it. The object is deliberately NOT repaired here: the kernel comment scopes that to
// the §32 increment, and widening a surface work package into the assurance kernel would be the roadmap error
// this programme has already made twice.
//
// ── THE THREE STATES, AND WHY TWO OF THEM ARE NOT "NOTHING TO SHOW" ─────────────────────────────────────────
//
//   UNASSESSED     no completion event names this PWU.        Nothing is known.
//   NONE_DECLARED  a validator completed and declared none.   Something is known: someone looked.
//   DECLARED       the statements.
//
// "No uncertainty shown" is true of all three, which is exactly why a Surface that renders them alike discloses
// nothing while appearing to. Only the middle state means "considered, and nothing outstanding".

/**
 * The subset of a domain event this projection reads.
 *
 * `payload` is `unknown` because that is what `DomainEvent` declares. Widening it to `Record<string, unknown>`
 * here would make every caller cast, and a cast at the call site is a claim about a payload the caller has not
 * inspected either — so the narrowing happens once, below, where it can be wrong in only one place.
 */
export interface CompletionEventLike {
	readonly eventType: string;
	readonly payload?: unknown;
}

export type DisclosureState = 'UNASSESSED' | 'NONE_DECLARED' | 'DECLARED';

export interface UncertaintyDisclosure {
	readonly subjectId: string;
	readonly state: DisclosureState;
	readonly statements: readonly string[];
	/** O-8-R2: the count a conformance run compares against expected, so silence is reportable. */
	readonly disclosedCount: number;
}

const EVENT_TYPE = 'AssuranceAssessmentCompleted';

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * The uncertainty disclosure for each subject id, derived from the completion events that name it.
 *
 * Every requested subject gets an entry. A subject with no entry at all would be indistinguishable, at the
 * surface, from one the caller forgot to ask about — and "the row is missing" is not a disclosure.
 */
export function uncertaintyDisclosures(
	events: readonly CompletionEventLike[],
	subjectIds: readonly string[]
): UncertaintyDisclosure[] {
	const assessed = new Set<string>();
	const bySubject = new Map<string, string[]>();

	for (const event of events) {
		if (event.eventType !== EVENT_TYPE) continue;
		const payload: Record<string, unknown> =
			typeof event.payload === 'object' && event.payload !== null
				? (event.payload as Record<string, unknown>)
				: {};
		const subjects = strings(payload.subjectObjectIds);
		const residuals = strings(payload.residualUncertainty);
		for (const subject of subjects) {
			// Marked assessed by the COMPLETION, not by the presence of residuals: a completion declaring none is
			// the NONE_DECLARED state, and conflating it with UNASSESSED is the defect this file exists to avoid.
			assessed.add(subject);
			if (residuals.length === 0) continue;
			const existing = bySubject.get(subject);
			if (existing) existing.push(...residuals);
			else bySubject.set(subject, [...residuals]);
		}
	}

	return subjectIds.map((subjectId) => {
		const statements = bySubject.get(subjectId) ?? [];
		return {
			subjectId,
			state: disclosureState(statements.length > 0, assessed.has(subjectId)),
			statements,
			disclosedCount: statements.length
		};
	});
}

/**
 * The three-state decision, named rather than inlined — it is the whole obligation of this file.
 *
 * Note the ORDER of the two questions. "Was anything declared?" is asked first, so a subject with statements is
 * DECLARED whether or not some other completion also named it. Asking "was it assessed?" first would be the same
 * three states in the same words and would still be correct here; making the sequence explicit is the point,
 * because the collapse this guards against — treating `hasAssessment === false` and `statements.length === 0` as
 * one condition — reads perfectly naturally when it is written as one expression.
 */
function disclosureState(hasStatements: boolean, hasAssessment: boolean): DisclosureState {
	if (hasStatements) return 'DECLARED';
	return hasAssessment ? 'NONE_DECLARED' : 'UNASSESSED';
}

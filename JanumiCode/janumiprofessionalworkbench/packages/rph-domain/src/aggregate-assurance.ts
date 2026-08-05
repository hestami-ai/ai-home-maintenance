// THE AGGREGATE ASSURANCE DISPOSITION — DOC-004 §28.2, transcribed as the fold it always was.
//
// ── REG-E-024(b) ASKED THE WRONG QUESTION, AND I REPEATED IT ─────────────────────────────────────────────────
// The elicitation item reads: "`AggregateAssuranceDisposition` — six states, no arrows: is the aggregate roll-up
// axis intended and unbuilt, or superseded?" Both branches presuppose a STATE MACHINE.
//
// It is not one. It has no arrows because it is a REDUCTION — and this repository already knew: `gen-transitions.ts`
// calls such rows "not an arrow at all (a computed reduction, e.g. AggregateAssuranceDisposition's …)" and
// `state-reachability.test.ts` EXCLUDES it from the reachability census for that reason. Asking which arrows it
// lacks is like asking which arrows `sum()` lacks.
//
// AND THE RULE IS RATIFIED IN FULL. I declined to touch PWU-level roll-up earlier the same day "because
// AggregateAssuranceDisposition is six ratified states with no arrows" — taking the item's framing as the
// measurement instead of opening §28. The rule was there the whole time.
//
// ── WHAT §28 STATES ─────────────────────────────────────────────────────────────────────────────────────────
// §28.2, verbatim and in document order:
//
//     Any critical rejection               -> REJECTED
//     Any blocking rejection               -> REJECTED
//     Any required assessment missing      -> EVIDENCE_REQUIRED or UNASSESSED
//     Any inconclusive required assessment -> INCONCLUSIVE
//     Any conditional required assessment  -> CONDITIONALLY_SATISFIED
//     All required assessments satisfied   -> SATISFIED
//
//     "This must not be reduced to a numerical average."
//
// §28.1 supplies the invariant: "An aggregate assurance state must preserve the STRICTEST UNRESOLVED disposition
// relevant to the work", and "a satisfied advisory policy does not override a rejected blocking policy".
//
// THE DOCUMENT ORDER IS THE STRICTNESS ORDER. That is the whole design: first match wins, and the rungs descend.
// It makes §28.1 executable rather than aspirational, and the companion test checks it as a monotonicity property
// (replacing any input with a stricter one may never weaken the result) rather than only case by case.
import type { AggregateAssuranceDisposition } from '@janumipwb/rph-contracts';

/** One applicable policy's contribution to the aggregate. */
export interface AggregateInput {
	readonly policyId: string;
	/**
	 * The completed assessment's disposition, or `undefined` when no assessment has concluded for this policy.
	 *
	 * `undefined` is NOT "assume the best" — it drives §28.2's "required assessment missing" rung. The distinction
	 * between the two values that rung offers is `assessed` below.
	 */
	readonly disposition?: string;
	/**
	 * Does an assessment for this policy EXIST (even if it has not concluded)?
	 *
	 * §28.2 says "EVIDENCE_REQUIRED **or** UNASSESSED" and does not say which. This is the distinction the two
	 * words carry: an assessment underway but not concluded is EVIDENCE_REQUIRED; no assessment at all is
	 * UNASSESSED. DERIVED, and it is the only reading under which both ratified values are reachable.
	 */
	readonly assessed: boolean;
	/**
	 * False when a §5.1 determination says the policy does not govern this subject.
	 *
	 * EXCLUDED FROM THE FOLD, because §28.2 speaks of "required assessment" and a policy determined
	 * NOT_APPLICABLE requires nothing. It is NOT dropped from the VIEW — guide §8.4 requires inapplicable
	 * coverage to stay explainable — so the row remains visible and merely stops voting.
	 *
	 * `undefined` means nobody determined it, which is not the same as "not applicable" and counts as applicable
	 * (the pre-existing stance in `buildApplicablePolicies`: a default of `false` would hide real coverage).
	 */
	readonly applicable?: boolean;
}

/**
 * `ESCALATED` is a ratified ASSESSMENT disposition with no rung in §28.2 and no member in the aggregate enum.
 *
 * Mapped to `INCONCLUSIVE` — §28.1 requires the strictest UNRESOLVED disposition, and among the six aggregate
 * values `INCONCLUSIVE` is the one meaning "assessed, not concluded". `SATISFIED` is unthinkable; `REJECTED`
 * would assert a verdict nobody gave. **This is a genuine gap in §28.2, recorded rather than papered over** — the
 * corpus ratifies five assessment dispositions and gives an aggregate rung to four of them.
 */
const ESCALATED_MAPS_TO: AggregateAssuranceDisposition = 'INCONCLUSIVE';

/**
 * Fold the applicable policies of one subject into its aggregate assurance disposition (DOC-004 §28.2).
 *
 * FIRST MATCH WINS, in §28.2's own order. An empty input yields `UNASSESSED`: a subject no policy governs has not
 * been assured, and reporting `SATISFIED` for it would be the vacuous-green this repository exists to prevent —
 * "all required assessments satisfied" is vacuously true over an empty set, which is exactly the reading §28.1's
 * "strictest unresolved" forbids.
 *
 * NOTE WHAT IS DELIBERATELY NOT MODELLED: §28.2's first two rungs distinguish a *critical* from a *blocking*
 * rejection, and both produce `REJECTED`. The distinction cannot change the output, so modelling it would be
 * false precision. Said here rather than left to look like an oversight.
 */
export function aggregateAssuranceDisposition(
	inputs: readonly AggregateInput[]
): AggregateAssuranceDisposition {
	// §28.2 speaks of REQUIRED assessments; a policy determined not to govern requires nothing.
	const required = inputs.filter((i) => i.applicable !== false);
	if (required.length === 0) return 'UNASSESSED';

	const dispositionOf = (i: AggregateInput): string | undefined =>
		i.disposition === 'ESCALATED' ? ESCALATED_MAPS_TO : i.disposition;

	// Rung 1+2 — "any critical rejection" / "any blocking rejection". Both -> REJECTED.
	if (required.some((i) => dispositionOf(i) === 'REJECTED')) return 'REJECTED';
	// Rung 3 — "any required assessment missing". The disjunction resolved: no assessment at all -> UNASSESSED
	// (the stricter of the two, since nothing is even underway), else EVIDENCE_REQUIRED.
	const missing = required.filter((i) => dispositionOf(i) === undefined);
	if (missing.length > 0) return missing.some((i) => !i.assessed) ? 'UNASSESSED' : 'EVIDENCE_REQUIRED';
	// Rung 4 — "any inconclusive required assessment" (and ESCALATED, per ESCALATED_MAPS_TO).
	if (required.some((i) => dispositionOf(i) === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
	// Rung 5 — "any conditional required assessment".
	if (required.some((i) => dispositionOf(i) === 'CONDITIONALLY_SATISFIED')) return 'CONDITIONALLY_SATISFIED';
	// Rung 6 — "all required assessments satisfied". Checked POSITIVELY rather than reached by elimination, so an
	// unrecognised disposition cannot fall through into a green.
	if (required.every((i) => dispositionOf(i) === 'SATISFIED')) return 'SATISFIED';
	// FAIL CLOSED. A disposition none of the rungs recognise must not become SATISFIED by exhaustion — that is
	// how a new ratified value would silently acquire a passing verdict.
	return 'INCONCLUSIVE';
}

/**
 * The strictness order of §28.2, most strict first — the document's own order, made addressable.
 *
 * Exported because the §28.1 invariant ("preserve the strictest unresolved disposition") is only checkable
 * against an explicit order, and a second copy of that order in the test would be a twin.
 */
export const AGGREGATE_STRICTNESS: readonly AggregateAssuranceDisposition[] = [
	'REJECTED',
	'UNASSESSED',
	'EVIDENCE_REQUIRED',
	'INCONCLUSIVE',
	'CONDITIONALLY_SATISFIED',
	'SATISFIED'
];

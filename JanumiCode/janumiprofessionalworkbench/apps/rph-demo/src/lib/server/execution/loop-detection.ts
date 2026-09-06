// JAN-EXECLOOP EL-01 — is the repair loop getting anywhere?
//
// ⭑ THE INCREMENT `REG-D-059` LICENSED AND LEFT OPEN. The sponsor: *"that could go in loops so there is
// expected to be a loop detection capability … At some point — say two loops or three — there would be an
// escalation."* That entry measured the ground and named the gap exactly: *"three of the four parts exist …
// What is missing is the LOOP — a bound greater than one, and the classification that decides when to stop."*
//
// ⛔ THREE STATES, NOT THE SIBLING'S FOUR, AND THE OMISSION IS A MEASUREMENT. `loopDetectionMonitor.ts` also
// classifies `SCOPE_BLIND`, from available-but-unused tools and identical tool-call sequences. A JPWB execution
// step invokes NO TOOLS — `MODEL_INVOCATION` is the only step type anything runs — so a signal derived from
// that history would read "no loop" forever: **a check that cannot fail**, which is a defect class this
// repository has shipped before and now refuses on sight.

export type LoopTrend = 'NO_TREND_YET' | 'CONVERGING' | 'STALLED' | 'DIVERGING';

/**
 * Classify the repair loop from the count of OPEN FINDINGS after each try.
 *
 * ⚠ THE COUNT IS THE FINDINGS THE REMEDIATION ACTUALLY RETURNS, not a severity threshold I invented.
 * `classifyFloorRemediation` already filters to *"structured, valid subject findings … never operational
 * failures"*, so that set IS the open work. ⭑ Choosing a severity cut here would have introduced a second
 * definition of "what counts as a problem" alongside the policy's — the restated-vocabulary defect
 * `REG-F-353` names — and a reviewer returning only `MATERIAL` findings would then show zero on every try and
 * read as STALLED while genuinely progressing.
 *
 * ⭑ NOTHING IS CLASSIFIED FROM ONE POINT. The sibling monitor runs *"from attempt 2 onward"* for the same
 * reason: a single count is not a trend, and calling it one would let the first try decide the loop's fate.
 *
 * ⚠ COMPARES THE LATEST AGAINST THE PREVIOUS, not a regression over the whole series. That is a deliberate
 * simplification for a bound of three: with at most two comparisons available, a longer window adds no
 * information. It would need revisiting if the bound ever grew.
 */
export function classifyTrend(openFindingsPerTry: readonly number[]): LoopTrend {
	if (openFindingsPerTry.length < 2) return 'NO_TREND_YET';
	const latest = openFindingsPerTry[openFindingsPerTry.length - 1]!;
	const previous = openFindingsPerTry[openFindingsPerTry.length - 2]!;
	if (latest < previous) return 'CONVERGING';
	if (latest > previous) return 'DIVERGING';
	return 'STALLED';
}

/**
 * May the loop run another try?
 *
 * ⛔ THE BOUND IS A SAFETY PROPERTY OF THE HARNESS, SO IT HAS A DEFAULT — unlike the model, which `REG-D-052`
 * requires be configured with no default because it is a deployment choice about QUALITY. An unbounded repair
 * loop is the failure `REG-Q-078` named: a repair try is *"not wrong, it is unbounded."*
 *
 * ⚠ `NO_TREND_YET` PERMITS A SECOND TRY. It must: with one try there is no trend, and refusing there would
 * reduce the bound to one — which is the authoring plane's existing behaviour and precisely what this
 * increment exists to raise.
 */
export const DEFAULT_REPAIR_BOUND = 3;

export function mayRetry(
	triesSoFar: number,
	trend: LoopTrend,
	bound: number = DEFAULT_REPAIR_BOUND
): { readonly retry: boolean; readonly reason: string } {
	if (triesSoFar >= bound)
		return {
			retry: false,
			reason: `The repair bound of ${bound} tries is reached. Escalating rather than trying again — the sponsor's bound (REG-D-059), not a failure of the work.`
		};
	if (trend === 'STALLED')
		return {
			retry: false,
			reason:
				'The open-finding count did not move between tries: the producer is not addressing the findings, so another identical attempt buys nothing.'
		};
	if (trend === 'DIVERGING')
		return {
			retry: false,
			reason:
				'The open-finding count ROSE between tries: each attempt is making the work product worse, and continuing would compound it.'
		};
	return { retry: true, reason: trend === 'CONVERGING' ? 'Findings are reducing.' : 'No trend yet.' };
}

/**
 * ⛔ MAY THE REVIEWER SEE ITS OWN PRIOR FINDINGS? **NO BY DEFAULT**, and that default is the sponsor's original
 * hypothesis — since corroborated by the deployed system in the paper they supplied.
 *
 * **SPONSOR (2026-09-06):** *"the original hypothesis is that assurance policies being basically LLM as judge
 * approach should be the no, each try reviewed cold because they weren't intended to have state as such … That
 * responsibility was on the PWU executing agent's memory via its chat history, context window, context
 * engineering … it is the component responsible for tracking or remembering how it responded to the various
 * feedback from the various assurance policies."*
 *
 * ⭑⭑ AND THE PAPER DEPLOYS EXACTLY THAT. arXiv 2608.18300 §6.1, verbatim: *"the tuned judge scores it against
 * the criteria … emitting a pass/fail label and reason per criterion. If all criteria pass, the explanation is
 * served; if any fails, **the judge's reason is appended to the generator prompt and the generator is
 * re-invoked**, up to K retries."* The judge re-scores each draft COLD; the loop's state lives on the
 * GENERATOR side. Nothing in that pipeline hands the judge its own prior reasons.
 *
 * ⚠ SO THIS FLAG EXISTS BECAUSE THE SPONSOR RULED IT CONFIGURABLE, NOT BECAUSE IT IS RECOMMENDED. Turning it on
 * gives the reviewer the designed `prior` framing — *"A PREVIOUS review flagged … Judge whether those are
 * genuinely resolved"* — which is a real capability and a real question. It also gives the reviewer state it
 * was not designed to have, and touches `ASR-13`'s *shared prompt lineage* dimension, which nothing checks.
 */
export function reviewSeesPriorFindings(
	configured = process.env.JPWB_REVIEW_SEES_PRIOR
): boolean {
	return configured?.trim() === '1' || configured?.trim().toLowerCase() === 'true';
}

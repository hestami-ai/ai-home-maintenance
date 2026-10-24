// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — THE RESUME BANNER'S SENTENCE, EVERY BRANCH WHOLE.
//
// ⛔ WHAT WAS WRONG (the ER-1 app verifier's finding [6]). The banner's sentence was composed in the PWA page's template, and
// its ESCALATED branch — *"The reviewer recommended escalation to a human reviewer —"*, and *"refining re-runs the same
// automated reviewer"* (`REG-F-474`) — had no test at all: no reviewer the default e2e lane can select recommends
// ESCALATED, and the route tests hold only the summary's DATA. A mutant that keyed the branch on the wrong status
// (`ER1-PROBE-the-banner-never-names-the-escalation`) compiled and survived its victim, `e2e/resume-hint.e2e.ts`.
//
// ⭑ SO THE SENTENCE IS A PURE FUNCTION OF THE TURN'S SUMMARY (`resumeHintText`, beside `summarizeAuthoringTurn`), answered
// once by the page's load and rendered in ONE interpolation. This file holds every branch WHOLE; `e2e/resume-hint.e2e.ts`
// holds the INCOMPLETE banner whole in the browser, which proves the template renders what this function returns.
//
// ⭑ THE STRINGS ARE RESTATED HERE, NOT IMPORTED: they are what the professional reads, so a change to one must redden here
// rather than be followed.
import { describe, expect, it } from 'vitest';
import type { AuthoringTurnState } from './authoring-turn-machine.js';
import { resumeHintText } from './authoring-turn.js';
import type { FloorRemediationAction } from './floor.js';

/** The classifier's ESCALATE_REVIEW guidance, verbatim (`lib/server/floor.ts`) — the `detail` an escalated block carries. */
const ESCALATE_REVIEW_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review was escalated. Route the recorded review to the governed human or alternate independent-review path, then rerun assurance; an automatic subject edit cannot substitute for the escalation.';
/** The classifier's guidance for an INCOMPLETE review, verbatim — the commonest external block in the default lane. */
const INCOMPLETE_REVIEW_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.';
/** What the authoring route records when the producer never resolved, so no review ran (`agent/+server.ts`). */
const FLOOR_NOT_RUN =
	'⚖ Assurance floor not run — the producing model/provider never resolved, so reviewer independence cannot be established. PublishPwa remains blocked; retry the producing run or repair its model/provider configuration before rerunning assurance.';

/**
 * ⛔ EVERY ACTION BUT THE ESCALATION — exhaustive by construction: `satisfies` refuses a member of the union left out, so an
 * action added to `FloorRemediationAction` must be decided here before this file compiles.
 */
const NOT_AN_ESCALATION = {
	NONE: true,
	REFINE_SUBJECT: true,
	RETRY_OR_CONFIGURE_REVIEWER: true,
	REQUALIFY_OR_RESELECT_REVIEWER: true,
	CHANGE_REVIEWER: true,
	RESOLVE_OTHER_FLOOR_FINDINGS: true
} as const satisfies Record<Exclude<FloorRemediationAction, 'ESCALATE_REVIEW'>, true>;

/** ⛔ EVERY STATUS THE PAGE DOES NOT OFFER TO RESUME — exhaustive by construction, as above. */
const NOT_RESUMABLE = {
	COLLECTING: true,
	VALIDATING: true,
	ASSURING: true,
	READY_TO_COMMIT: true,
	COMMITTING: true,
	COMMITTED: true,
	CONFLICTED: true,
	COMMIT_FAILED: true,
	DISCARDED: true
} as const satisfies Record<
	Exclude<AuthoringTurnState, 'REVISION_REQUIRED' | 'BLOCKED_EXTERNAL'>,
	true
>;

describe('⭐ JAN-ESCREC D3 — resumeHintText: the resume banner names an escalation, and only an escalation', () => {
	it('⭐ BLOCKED_EXTERNAL on ESCALATE_REVIEW: the frame names the escalation, and "Refine it" says what refining does — WHOLE', () => {
		expect(
			resumeHintText({
				status: 'BLOCKED_EXTERNAL',
				detail: ESCALATE_REVIEW_GUIDANCE,
				remediationAction: 'ESCALATE_REVIEW'
			})
		).toBe(
			`The reviewer recommended escalation to a human reviewer — ${ESCALATE_REVIEW_GUIDANCE} This candidate is preserved. Refine it in the chat below (it continues on the same candidate, and refining re-runs the same automated reviewer), or Discard.`
		);
	});

	it.each(Object.keys(NOT_AN_ESCALATION) as Exclude<FloorRemediationAction, 'ESCALATE_REVIEW'>[])(
		'⛔ BLOCKED_EXTERNAL on %s: the review is framed as one that reached no usable verdict, and no escalation is named — WHOLE',
		(action) => {
			expect(
				resumeHintText({
					status: 'BLOCKED_EXTERNAL',
					detail: INCOMPLETE_REVIEW_GUIDANCE,
					remediationAction: action
				})
			).toBe(
				`The review did not produce a usable verdict — ${INCOMPLETE_REVIEW_GUIDANCE} This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
			);
		}
	);

	it('⛔ BLOCKED_EXTERNAL with NO action — the floor never ran, so nothing classified the block: no escalation is named — WHOLE', () => {
		expect(resumeHintText({ status: 'BLOCKED_EXTERNAL', detail: FLOOR_NOT_RUN })).toBe(
			`The review did not produce a usable verdict — ${FLOOR_NOT_RUN} This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
		);
	});

	it('⭑ BLOCKED_EXTERNAL with no detail recorded: the banner says the reviewer did not complete — WHOLE, with its full stop', () => {
		// ⭐ A DELIBERATE EXPECTATION CHANGE (the ER-1 app re-verifier's finding [8], item 4): this pinned "…the reviewer did not
		// complete This candidate is preserved." — the fallback ran on into the next sentence with no full stop, as the
		// template composed it before `resumeHintText` existed. Every recorded detail ends with its own; the fallback now does.
		expect(resumeHintText({ status: 'BLOCKED_EXTERNAL' })).toBe(
			'The review did not produce a usable verdict — the reviewer did not complete. This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.'
		);
	});

	it('⛔ REVISION_REQUIRED: revision is requested and no escalation is named — WHOLE, whatever action the summary carries', () => {
		const revision =
			'Revision requested — this candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.';
		expect(
			resumeHintText({
				status: 'REVISION_REQUIRED',
				detail: 'The candidate did not satisfy the floor.'
			})
		).toBe(revision);
		// ⭑ Not a shape the route writes — only an external block carries an action — and that is the point: the escalation
		// is keyed on the STATUS as well as the action, so this branch can never name one.
		expect(
			resumeHintText({ status: 'REVISION_REQUIRED', remediationAction: 'ESCALATE_REVIEW' }),
			'a revision request was framed as an escalation'
		).toBe(revision);
	});

	it('⭐ package E, E1 — REVISION_REQUIRED beside parts whose reviews failed: the revision is the concluded parts’ findings’, and the failed parts are named and reviewed again — WHOLE', () => {
		const failed = '"Build" (pwut_01ARZ3NDEKTSV4RRFFQ69G5Q11)';
		expect(
			resumeHintText({
				status: 'REVISION_REQUIRED',
				detail: 'The candidate did not satisfy the floor.',
				failedReviews: failed
			})
		).toBe(
			`Revision requested by the findings of the types whose reviews concluded — the Reasoning Review of ${failed} failed operationally and recorded no finding, and every type, the failed ones included, is reviewed again when the revised candidate is. This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
		);
		// ⭑ Keyed on the status too: a BLOCKED_EXTERNAL turn never names a part this way (only a revision request carries them).
		expect(
			resumeHintText({ status: 'BLOCKED_EXTERNAL', detail: INCOMPLETE_REVIEW_GUIDANCE, failedReviews: failed })
		).toBe(
			`The review did not produce a usable verdict — ${INCOMPLETE_REVIEW_GUIDANCE} This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
		);
	});

	it.each(
		Object.keys(NOT_RESUMABLE) as Exclude<
			AuthoringTurnState,
			'REVISION_REQUIRED' | 'BLOCKED_EXTERNAL'
		>[]
	)('⭑ %s: no resume sentence at all — the page offers no resume for it', (status) => {
		expect(resumeHintText({ status, remediationAction: 'ESCALATE_REVIEW' })).toBeUndefined();
	});
});

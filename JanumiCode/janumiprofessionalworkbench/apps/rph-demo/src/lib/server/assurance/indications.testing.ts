// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`; design §12.2) — TEST DOUBLES FOR THE INDICATIONS SOURCE, the seam the
// decision model stands behind (`reasoning-review-validator.ts` `IndicationsSource`).
//
// ⛔ WHY THEY EXIST, AND WHY ONLY TESTS HOLD THEM. Since package Z1 every review asks a decision model for its potential
// indications before its first reviewer call, and a validator given no source refuses every review
// (`NO_INDICATIONS_SOURCE_STATEMENT`): no default stands in for the model. A test that drives a review through the real
// validator therefore hands it a source of its own, beside its `print` — one of these, which answer by key, call no model and
// reach no network. ⚠ Package Z2 lands the production client and the committed records; until then production reviews are
// refused, which is why Z1 merges only with Z2 (the build brief's integration note).
//
// ⚠ IMPORTING ONLY TYPES, so this file stays out of the production import graph (`guards:export` keys "is this consumer a
// test?" on the filename, as `clearing-reviewer.testing.ts` says).
import type { IndicationRequest, IndicationsResult, IndicationsSource } from './reasoning-review-validator.js';

/** A source scoring each request by `score`, with every request's key: what a decision model that answered looks like. */
export function scoredIndications(score: (r: IndicationRequest, index: number) => number): IndicationsSource {
	return async (requests) => ({ scores: Object.fromEntries(requests.map((r, i) => [r.key, score(r, i)])) });
}

/**
 * ⭐ THE DOUBLE MOST TESTS HAND THE VALIDATOR: every question scored the same, so each list keeps its own order. ⭑ A test about
 * something else entirely — identity, capture, the fence, a repair — needs only that the review is sent.
 */
export const TEST_INDICATIONS: IndicationsSource = scoredIndications(() => 0.5);

/** A source that refuses with `reason`, as the decision model's client refuses a review it cannot score. */
export function refusingIndications(reason: string): IndicationsSource {
	return async () => ({ refusal: reason });
}

/** A source answering `result` whatever it was asked: a score missing, one not asked for, one that is no probability. */
export function answeringIndications(result: IndicationsResult): IndicationsSource {
	return async () => result;
}

/** A source scoring as `inner` does and keeping every call's requests, so a test can say what was asked, and how often. */
export function recordingIndications(inner: IndicationsSource = TEST_INDICATIONS): {
	readonly source: IndicationsSource;
	readonly calls: (readonly IndicationRequest[])[];
} {
	const calls: (readonly IndicationRequest[])[] = [];
	return {
		calls,
		source: async (requests, material) => {
			calls.push(requests);
			return inner(requests, material);
		}
	};
}

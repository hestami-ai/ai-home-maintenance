// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.6, revision 9) —
// THE HISTORY'S DECISION MODEL: what the tests that render reviews D54's records do not hold read in place of the committed records'
// static source (`scripts/reviewer-qual/recorded-indications.ts`, `COMMITTED_INDICATIONS`), by `vi.mock` in their own file.
//
// ⭑ WHY. D54 records the questions of case set v13 and of the fingerprint's probes, and no others; the static source refuses any
// other question, as it must. These tests ask others: the case sets' history (versions one to twelve — what moved from one version
// to the next, and what did not), the check's fixtures over those versions, and the fingerprint's tests that change a seam so that
// a case's material moves. Each was written against the placeholder decision model, which scores every question 0 (`indications.ts`,
// package Z1's departure 8), and asserts nothing of a score: a comparison of two versions' prompts, or of a seam's change.
// ⭑ WHAT IT ANSWERS. A question whose body the committed records hold: that record's score, by the static source's own lookup (the
// product's body, `decisionModelBody`, with the records' model and the review's material; its sha256). A question no record holds:
// 0, the placeholder's score — and its body's hash is kept in `UNRECORDED`. A body the records score twice is refused, as the static
// source refuses it. ⭐ (Z2b phase 1b) And a body the records hold refused by the server (HTTP 413) is refused in the client's own
// words, as the static source refuses it (`answerOf`).
// ⭐ So a prompt these tests render is the product's own wherever the records hold its every question, and what a test pins as TODAY'S
// is the product's only if `UNRECORDED` stays empty while it is rendered: the fingerprint's test holds it empty over the current case
// set and the probes (`reviewer-qualification-fingerprint.test.ts`, Z2b).
// ⛔ Tests only. The product, the gate's check, the re-scoring and the qualification CLI read the static source, which refuses.
import { createHash } from 'node:crypto';
import { refusedRequestReason } from '../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import { DECISION_MODEL_RECORDS_IDENTITY } from '../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import { decisionModelBody } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import type { IndicationsSource } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import type { DecisionModelRecords, RecordsRead } from '../scripts/reviewer-qual/recorded-indications.js';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** The hash of every body this file's history source answered with 0: no committed record holds it. */
export const UNRECORDED = new Set<string>();

/**
 * ⭐ Z2b phase 1b — what the records say of one body, as the static source reads it: its score, a refusal (two scores, a refusal and
 * another answer, or the server's refusal in the client's own words from the recorded status and answer), or nothing.
 */
function answerOf(r: DecisionModelRecords, sha: string, key: string): { readonly refusal: string } | number | undefined {
	if (r.contradicted.has(sha)) return { refusal: `the records hold two scores for request ${key}’s body ${sha.slice(0, 12)}…: they contradict themselves` };
	// ⭐⭐ Z2b phase 1b — D54 restated — A RECORDED REFUSAL REPLAYED AS THE STATIC SOURCE REPLAYS IT: the client's own words from the
	// recorded status and answer (`refusedRequestReason`), at the request it refused — never 0, which would send a prompt the product
	// refuses.
	if (r.refusalContradicted.has(sha))
		return { refusal: `the records hold a refusal and another answer for request ${key}’s body ${sha.slice(0, 12)}…: they contradict themselves` };
	const refused = r.refused.get(sha);
	if (refused !== undefined) return { refusal: refusedRequestReason(key, refused.status, refused.response) };
	return r.scores.get(sha);
}

/**
 * ⭐ The history's source over the committed records `read` reads (the static source's own reader, handed in by the mock so this
 * module imports nothing it mocks): the records' score where they hold the body, 0 where they do not — kept in `UNRECORDED`.
 */
export function historyIndications(read: () => RecordsRead): IndicationsSource {
	let records: RecordsRead | undefined;
	return async (requests, material) => {
		const r = (records ??= read());
		const model = 'refusal' in r ? DECISION_MODEL_RECORDS_IDENTITY.model : r.identity.model;
		const scores: Record<string, number> = {};
		for (const q of requests) {
			const sha = sha256(decisionModelBody(model, material, q));
			// ~~the two-scores refusal, then `r.scores.get(sha)`, inline~~ ⛔ MOVED 2026-11-07 (Z2b phase 1b): what the records say of the
			// body, a refusal of the server's among it, read as the static source reads it (`answerOf`).
			const said = 'refusal' in r ? undefined : answerOf(r, sha, q.key);
			if (typeof said === 'object') return said;
			if (said === undefined) UNRECORDED.add(sha);
			scores[q.key] = said ?? 0;
		}
		return { scores };
	};
}

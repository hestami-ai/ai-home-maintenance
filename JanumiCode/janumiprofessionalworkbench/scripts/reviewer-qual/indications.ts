// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.2 and §12.6) —
// THE PLACEHOLDER DECISION MODEL OF THE MEASUREMENT SCRIPTS, UNTIL PACKAGE Z2's RECORDS LAND.
//
// Since package Z1 every review asks a decision model for its potential indications before its first reviewer call
// (`IndicationsSource`), and a validator given no source refuses the review. The scripts that build the product's
// prompts WITHOUT calling a reviewer — the fingerprint's probes, case prompts and scoring digest (`fingerprint.ts`), the
// re-scoring of recorded replies (`rescore.ts`), the negative control's dry run (`../phase7/negative-control.ts`) — need
// scores to build them, and no record of scores exists yet: D54's committed records are package Z2's.
//
// ⭑ SO THIS SCORES EVERY QUESTION 0 — written `0.00`, four characters, as every score from 0 to 1 is: the placeholder the
// design's own sizes were measured with (`d46-facts.md` §7). The section's wording, its format, the cuts, the requests
// and their order, and every bound are measured with it; what no placeholder can measure is the model's scores. ⛔ IT IS
// NEVER A SOURCE A REVIEW SENT TO A REVIEWER IS BUILT WITH: the paid qualification runner (`run.ts`) and the negative
// control's `--live` run hand their validator no source, so they refuse before any call until package Z2 lands the client
// and the records — which is why Z1 merges only with Z2 (the build brief's integration note). Z2 replaces this with the
// records' static source.
import type { IndicationsSource } from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';

export const PLACEHOLDER_INDICATIONS: IndicationsSource = async (requests) => ({
	scores: Object.fromEntries(requests.map((r) => [r.key, 0]))
});

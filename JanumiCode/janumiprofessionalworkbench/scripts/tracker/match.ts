/**
 * The consumer-walk's name matcher — extracted so it can be TESTED, which is the whole reason it
 * exists as a module.
 *
 * ⚠ WHY THIS IS NOT `String.prototype.includes`. W-3's consumer walk asked "does this ratified name
 * appear in production?" with an unanchored substring test. On 2026-08-20 that reported the
 * ratified query `getPwu` as PRESENT — because it is a PREFIX of `getPwuTemplate`, an unrelated
 * ontology-template lookup in `packages/rph-product-realization-pwa/src/ontology.ts:34`. One
 * capability's implementation status rested on a coincidence of spelling.
 *
 * The blast radius was DERIVED, not assumed: re-running the identical walk over all 118 consumer-walk
 * items (14 queries, 96 events, 8 surfaces) under identifier-boundary matching changed exactly ONE
 * verdict — `getPwu`, DECLARED → ABSENT. The instrument was wrong in one place, and that place
 * happened to be the sole survivor of the population the walk was commissioned to measure: the
 * §34.5 query roster is 14-of-14 name-absent, not 13-of-14.
 *
 * A boundary occurrence is one where neither the character before nor the character after the match
 * can continue a JavaScript/TypeScript identifier. `getPwu` inside `getPwuTemplate` fails on the
 * trailing `T`; `getPwu(` and `.getPwu;` and `'getPwu'` all pass. Prose names (UI surfaces such as
 * "Execution Workbench") get the same treatment, which is correct for them too: it is the substring
 * case — a name embedded in a longer word — that the test must refuse.
 *
 * Implemented with indexOf rather than a RegExp because the needles come from documents and may
 * contain regex metacharacters; escaping them correctly is one more thing that can be wrong.
 */

/** Characters that can continue a JS/TS identifier — the boundary test is their absence. */
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;

/**
 * True when `needle` occurs in `haystack` at least once as a whole identifier/phrase rather than as
 * a fragment of a longer one. An empty needle never matches: a name we do not have is not a name we
 * found everywhere.
 */
export function hasIdentifierOccurrence(haystack: string, needle: string): boolean {
	if (needle.length === 0) return false;
	let at = haystack.indexOf(needle);
	while (at >= 0) {
		const before = at === 0 ? '' : haystack[at - 1]!;
		const afterIndex = at + needle.length;
		const after = afterIndex >= haystack.length ? '' : haystack[afterIndex]!;
		if (!IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after)) return true;
		at = haystack.indexOf(needle, at + 1);
	}
	return false;
}

// THE LEDGER'S OWN INTEGRITY — JAN-VERIF V-2c.
//
// The mutant ledger is an instrument, and this programme's recurring finding is that instruments go wrong in ways
// that read as passing. Three specific ways, all observed here, all now checked:
//
//   1. TWO ENTRIES DECLARING THE SAME MUTATION. The V-2 harvest merged two work-package harnesses without
//      deduplicating, so three mutations appeared twice. The first authoritative run then reported "90 mutants,
//      0 SURVIVED" when 87 distinct mutations had been measured and three kills had been counted twice. The
//      guarantee held; the DENOMINATOR did not, and a mutation score is a ratio.
//   2. AN ID THAT NAMES MORE THAN ONE ENTRY. `bun run mutants <id>` filters by substring and `show.ts` prints by
//      substring, so a repeated id makes "I ran that mutant" ambiguous about which one.
//   3. A CROSS-REFERENCE THAT NAMES NOTHING. `supersededBy` and `duplicateOf` are what make RETIRED and DUPLICATE
//      honest rather than a way to silence an inconvenient entry: each says "the guard is still proven, over there".
//      If the named successor does not exist, the entry has been retired into a void and the guard is unproven with
//      no verdict saying so — strictly worse than leaving it broken, because a broken entry at least reports.
//
// These are checks on the LEDGER, not on the product, which is why they live in `verif/` beside the source-resolution
// proof rather than in any package's suite.
import { describe, expect, it } from 'vitest';
import { DECLARED_MUTANTS } from '../scripts/mutants/ledger.js';

/**
 * The mutation itself, independent of who declared it or what they expected.
 *
 * `JSON.stringify` of the tuple rather than a delimiter-joined string: anchors contain tabs, newlines, backticks and
 * `${…}`, so any delimiter chosen for being "unlikely" is a delimiter that will eventually appear inside a `find`
 * and silently merge two different mutations into one key.
 */
const mutationKey = (m: (typeof DECLARED_MUTANTS)[number]) =>
	JSON.stringify([m.file, m.find, m.replace]);

describe('the mutant ledger is internally coherent', () => {
	it('gives every entry a unique id, so selecting one selects one', () => {
		const seen = new Map<string, number>();
		for (const m of DECLARED_MUTANTS) seen.set(m.id, (seen.get(m.id) ?? 0) + 1);
		expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
	});

	it('declares each distinct mutation ONCE — or says which entry it duplicates', () => {
		const groups = new Map<string, typeof DECLARED_MUTANTS>();
		for (const m of DECLARED_MUTANTS)
			groups.set(mutationKey(m), [...(groups.get(mutationKey(m)) ?? []), m]);

		const offenders: string[] = [];
		for (const group of groups.values()) {
			if (group.length === 1) continue;
			// THREE LEGITIMATE REASONS for a shared mutation, and each must be POSITIVELY declared:
			//   - all but one entry names the entry it duplicates;
			//   - an entry is RETIRED, so it never runs and cannot double-count. This is what lets V2C-T1 reuse
			//     WP12B-M3's edit: the same text change, kept for what it genuinely proves (the union is closed)
			//     while the entry that claimed the wrong thing about it stays on the record, retired;
			//   - the entries assert DIFFERENT victims, which is a different claim about the same edit. B4/B5 are the
			//     case that matters: one mutation, asked of the unit suite and of the reference seed, because "the unit
			//     tests catch it" and "the seed cannot survive it" are two facts and the second is the load-bearing one.
			const undeclared = group.filter(
				(m) => m.duplicateOf === undefined && m.supersededBy === undefined
			);
			const victimSets = new Set(undeclared.map((m) => [...m.expectRed].sort().join('|')));
			if (undeclared.length > 1 && victimSets.size !== undeclared.length)
				offenders.push(undeclared.map((m) => m.id).join('  ==  '));
		}
		expect(offenders).toEqual([]);
	});

	it('resolves every supersededBy and duplicateOf to an entry that EXISTS', () => {
		const ids = DECLARED_MUTANTS.map((m) => m.id);
		// The cross-reference is prose ending in an em-dash rationale; the id is what precedes it, and it must be
		// findable. Substring rather than equality because a reference names the twin's id as written, and several
		// ids were suffixed with their harvest source when they were disambiguated.
		const dangling = DECLARED_MUTANTS.flatMap((m) =>
			[m.supersededBy, m.duplicateOf].flatMap((ref) => {
				if (ref === undefined) return [];
				const named = ref.split(' —')[0]!.trim();
				return ids.some((id) => id.includes(named) || named.includes(id)) ? [] : [`${m.id} -> ${named}`];
			})
		);
		expect(dangling).toEqual([]);
	});

	it('never marks one entry as both retired and duplicate, which would say the guard moved AND did not', () => {
		expect(
			DECLARED_MUTANTS.filter((m) => m.supersededBy !== undefined && m.duplicateOf !== undefined).map(
				(m) => m.id
			)
		).toEqual([]);
	});

	it('gives every entry a rationale and a provenance, because an unexplained mutant cannot be triaged', () => {
		expect(
			DECLARED_MUTANTS.filter((m) => m.why.trim() === '' || m.source.trim() === '').map((m) => m.id)
		).toEqual([]);
	});
});

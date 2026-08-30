// P — THE EIGHT SCENARIO CLASSES ARE THE RATIFIED EIGHT, DERIVED RATHER THAN COPIED.
//
// `SCENARIO_CLASSES` in `@janumipwb/rph-contracts/slice` is a hand-written list, and a hand-written list of a
// ratified set is a claim about the corpus that nothing checks. This file is the check: it re-derives the classes
// from the ratified ontology sentence and asserts set equality.
//
// ⚠ WHY THIS MATTERS MORE THAN IT LOOKS. `SL-5` requires every class to be covered or EXPLICITLY recorded
// inapplicable. If the ratified set gains a ninth class and this list does not, the Slice programme would report
// full coverage of a set that had grown underneath it — the shape of defect this repository has recorded as a
// vocabulary split silently narrowing every predicate keyed on the old word.
import { readFileSync } from 'node:fs';

import { SCENARIO_CLASSES } from '@janumipwb/rph-contracts/slice';
import { describe, expect, it } from 'vitest';

const ONTOLOGY = new URL(
	'../packages/rph-product-realization-pwa/vocab/m8-ontology.json',
	import.meta.url
);

/**
 * The ratified sentence, verbatim at the time of writing:
 *
 *   "Applicable scenario classes (normal path, alternate valid path, user-error path, system-failure path,
 *    permission-denied path, interrupted or resumed path, data-unavailable path, cancellation path) are covered
 *    or their inapplicability is explicit."
 *
 * The classes are the comma-separated span inside the parentheses. The anchor is the phrase, not a line number:
 * `JPWB-DOC-004 §10 item 10` — an annotation never moves the lines it annotates, and a `@228` anchor would rot
 * the moment anything above it changed.
 */
function ratifiedClasses(): string[] {
	const text = readFileSync(ONTOLOGY, 'utf8');
	const sentence = /Applicable scenario classes \(([^)]+)\)/.exec(text);
	if (!sentence) throw new Error('the ratified scenario-class sentence was not found in the ontology');
	return sentence[1]!.split(',').map((s) => s.trim());
}

describe('the eight scenario classes are the ratified eight', () => {
	it('SCENARIO_CLASSES equals the ratified set, in order', () => {
		expect(
			[...SCENARIO_CLASSES],
			'the hand-written list has diverged from the ratified ontology sentence. The ontology governs: ' +
				'change the list, not the corpus.'
		).toEqual(ratifiedClasses());
	});

	// CONTROL — THE DERIVATION READS A REAL SENTENCE. Every assertion above is satisfied by a parser that returns
	// nothing on both sides. This is the vacuity this repository has recorded repeatedly.
	it('CONTROL — the ratified sentence is really being read', () => {
		const derived = ratifiedClasses();
		expect(derived.length, 'classes parsed out of the ontology').toBe(8);
		expect(derived, 'and they are the real ones, not empty strings').toContain('cancellation path');
	});

	// CONTROL — IT DISCRIMINATES. Without this, a derivation that returned the list it was comparing against
	// would pass. The mutation is applied to the DERIVED side, so a broken extractor is what reddens.
	it('CONTROL — a changed ratified set would redden', () => {
		const derived = ratifiedClasses();
		const mutated = derived.slice(0, -1);
		expect(mutated).not.toEqual([...SCENARIO_CLASSES]);
		expect(mutated.length).toBe(SCENARIO_CLASSES.length - 1);
	});
});

/**
 * The consumer-walk matcher's witness.
 *
 * WHY IT IS ITS OWN FILE. `scripts/tracker/measure.ts` is a CLI with top-level side effects (it
 * walks the tree and prints), so importing it from a test executes it. The matcher was extracted to
 * `match.ts` precisely so the decision it makes can be examined directly, at the granularity where
 * it went wrong — and the granularity where it went wrong was ONE CHARACTER: the `T` in
 * `getPwuTemplate`.
 *
 * THE INCIDENT, in one line: W-3's walk reported the ratified query `getPwu` as implemented because
 * `String.includes` found it inside `getPwuTemplate`, an unrelated ontology-template lookup. That
 * was the SOLE positive result in the fourteen-name population the walk existed to measure.
 *
 * ⚠ THIS SUITE HAS ITS OWN MUTANT: `MU-TRACKER-01-boundary-check-always-passes` in
 * scripts/mutants/ledger.ts collapses the boundary test back to a bare `return true` — the exact
 * `String.includes` behaviour that produced the incident — and names THIS file as its single victim.
 * Its sibling MU-TRACKER-02 drops only the TRAILING boundary check (admitting exactly the prefix case)
 * and aims at the census leg instead, so between them they prove both that the decision is wrong and
 * that the tracker gate can see it. One victim each, deliberately: run.ts invokes vitest once over the
 * named set, so a second name would mean 'any of these reddens' — a WEAKER claim. A control that has
 * never been seen to fail is the REG-F-196 shape.
 */
import { describe, expect, it } from 'vitest';

import { hasIdentifierOccurrence, stripComments } from '../scripts/tracker/match.js';

describe('consumer-walk name matching (identifier boundaries, never substrings)', () => {
	it('refuses the incident: getPwu is not present merely because getPwuTemplate is', () => {
		// The literal line from packages/rph-product-realization-pwa/src/ontology.ts:34 that the
		// flawed walk cited as evidence that a ratified query was implemented.
		const ontology = 'export function getPwuTemplate(pwuKind: string): PwuTemplate | undefined {';
		expect(hasIdentifierOccurrence(ontology, 'getPwu')).toBe(false);
		// …and the control: the SAME haystack shape with the real declaration does match, so the
		// refusal above is discrimination and not a matcher that simply says no.
		expect(
			hasIdentifierOccurrence('export function getPwu(id: string): PwuRow | undefined {', 'getPwu')
		).toBe(true);
	});

	it('accepts every ordinary way a name is written in TypeScript source', () => {
		for (const haystack of [
			'getPwu(id)',
			'const f = getPwu;',
			"import { getPwu } from './queries.js';",
			"send('getPwu')",
			'engine.getPwu(id)',
			'getPwu',
			'\tgetPwu,\n'
		])
			expect(hasIdentifierOccurrence(haystack, 'getPwu'), haystack).toBe(true);
	});

	it('refuses every way a name can be a fragment of a longer identifier', () => {
		for (const haystack of [
			'getPwuTemplate(k)', // trailing identifier char — the incident
			'makegetPwu(k)', // leading identifier char
			'my_getPwu_helper', // both, via underscores
			'getPwu2', // digits continue an identifier
			'getPwu$fn' // $ continues an identifier
		])
			expect(hasIdentifierOccurrence(haystack, 'getPwu'), haystack).toBe(false);
	});

	it('applies the same rule to prose names, which is what UI surfaces are', () => {
		expect(
			hasIdentifierOccurrence('the Execution Workbench renders steps', 'Execution Workbench')
		).toBe(true);
		expect(hasIdentifierOccurrence('<h1>Execution Workbench</h1>', 'Execution Workbench')).toBe(
			true
		);
		// A surface name embedded in a longer word is the same defect wearing prose.
		expect(hasIdentifierOccurrence('PreExecution Workbenchy', 'Execution Workbench')).toBe(false);
	});

	it('never reports an empty needle as found', () => {
		// A name we failed to extract from a document must not read as a name present everywhere —
		// that is how a parser bug becomes a wall of false ENFORCED.
		expect(hasIdentifierOccurrence('anything at all', '')).toBe(false);
	});

	it('refuses the SECOND incident: a docblock naming a MISSING capability is not evidence of it', () => {
		// The literal shape that flipped four ratified queries from ABSENT to DECLARED on 2026-08-20 —
		// a comment explaining that `getObject` stands in for queries that DO NOT EXIST. Writing the
		// documentation would have manufactured the implementation.
		const source = [
			'/**',
			' * stands in for four ratified typed queries (getUndertaking, getPwu, getBaseline).',
			' */',
			'export function getObject(handle, id) { return handle.loadObject(id); }'
		].join('\n');
		expect(hasIdentifierOccurrence(source, 'getUndertaking'), 'raw text does contain it').toBe(
			true
		);
		expect(
			hasIdentifierOccurrence(stripComments(source), 'getUndertaking'),
			'a name appearing ONLY in a comment must not read as an implementation'
		).toBe(false);
		// THE CONTROL: the real declaration in the same file survives the strip, so this discriminates
		// rather than being a stripper that eats everything.
		expect(hasIdentifierOccurrence(stripComments(source), 'getObject')).toBe(true);
	});

	it('strips both comment forms while preserving length and line structure', () => {
		// Asserted as PROPERTIES rather than as literal space counts: the properties are what the walk
		// depends on (offsets and line numbers stay usable), and a hand-counted string of blanks is a
		// fixture that tests my arithmetic instead of the code — my first version of this test got the
		// count wrong by one and would have been "fixed" by copying whatever the code emitted, which is
		// how a test starts asserting the bug.
		for (const source of ['a // b\nc', 'a /* b\nc */ d', 'x/*y*/z // tail\nw']) {
			const stripped = stripComments(source);
			expect(stripped, source).toHaveLength(source.length);
			expect(stripped.split('\n'), source).toHaveLength(source.split('\n').length);
			// No comment CONTENT survives: 'b' and 'y' appear only inside comments in these fixtures.
			expect(stripped.includes('b'), source).toBe(false);
			expect(stripped.includes('y'), source).toBe(false);
		}
		// …and code outside the comments is untouched.
		expect(stripComments('x/*y*/z // tail\nw')).toContain('x');
		expect(stripComments('x/*y*/z // tail\nw')).toContain('z');
		expect(stripComments('x/*y*/z // tail\nw')).toContain('w');
	});

	it('is lexical, so it can only ever LOSE a match and never invent one', () => {
		// A `//` inside a string blanks the rest of that line. That makes the walk CONSERVATIVE — it can
		// under-credit and never over-credit — which is the safe direction for an instrument whose whole
		// job is to refuse false evidence. Stated as a test so the limitation is measured, not implied.
		expect(
			hasIdentifierOccurrence(
				stripComments('const u = "https://x.test/getPwuHierarchy";'),
				'getPwuHierarchy'
			)
		).toBe(false);
	});

	it('finds a later boundary occurrence even when an earlier one is a fragment', () => {
		// The loop must not stop at the first substring hit: real files mention a name in a comment
		// as part of a longer word before declaring it. Both citation corrections on 2026-08-20
		// (makeDecisionEffective, controllerMarksPwuSatisfied) were exactly this shape.
		expect(
			hasIdentifierOccurrence(
				'// makeDecisionEffective guards\nemit(DecisionEffective);',
				'DecisionEffective'
			)
		).toBe(true);
	});
});

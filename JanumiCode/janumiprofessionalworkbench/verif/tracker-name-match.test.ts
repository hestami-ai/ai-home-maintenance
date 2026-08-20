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
 * `String.includes` behaviour that produced the incident — and expects THIS file plus the census
 * assertion in tracker-ingest.test.ts to redden. A control that has never been seen to fail is the
 * REG-F-196 shape.
 */
import { describe, expect, it } from 'vitest';

import { hasIdentifierOccurrence } from '../scripts/tracker/match.js';

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

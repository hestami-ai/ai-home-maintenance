// ⭐ A MUTANT'S REPLACEMENT IS APPLIED LITERALLY — every `$` pattern `String.prototype.replace` would expand is
// inserted as written (`JAN-CRITREAD` J2-2; `scripts/mutants/apply.ts`).
//
// PREDICTED RED: `run.ts` applied mutants with `original.replace(m.find, m.replace)`, so `J22-M25`'s
// `key.startsWith('$')` spliced the text after the match into the file and was reported NO_COMPILE.
import { describe, expect, it } from 'vitest';
import { applyMutant } from '../scripts/mutants/apply.js';

describe('⭐ applyMutant inserts the replacement as written', () => {
	it.each([
		["$'", 'the text after the match'],
		['$`', 'the text before the match'],
		['$&', 'the match itself'],
		['$$', 'a single dollar']
	])('⛔ %s is inserted literally — not %s', (pattern) => {
		const original = 'before FIND after';
		expect(applyMutant(original, 'FIND', `x${pattern}y`)).toBe(`before x${pattern}y after`);
	});

	it('⭐ CONTROL — an ordinary replacement, and only the FIRST occurrence (the ledger requires exactly one)', () => {
		expect(applyMutant('a FIND b FIND c', 'FIND', 'NEW')).toBe('a NEW b FIND c');
	});
});

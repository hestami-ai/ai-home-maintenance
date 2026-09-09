import { describe, expect, it } from 'vitest';
import { lintComposition } from './lint.js';

// ⚠ `workDischarge: 'HUMAN'` IS PART OF THE ARRANGEMENT, NOT A CONCESSION TO A NEW CHECK. EG-07c made
// "who does this work" a property of a well-formed type, and the first test below asserts a well-formed
// hierarchy is CLEAN. Leaving it off would make that fixture assert cleanliness for types that are not
// well-formed. The ASSERTIONS are untouched; the arrangement now states a fact it previously left silent —
// and the absent case it used to represent by accident is now tested DELIBERATELY, below.
const node = (id: string, isRoot: boolean, children: string[] = []) => ({
	id,
	name: id,
	isRoot,
	permittedChildTypeIds: children,
	workDischarge: 'HUMAN' as const
});

/** The same node with the question unanswered — absent (never asked) unless a value is given. */
const undeclaredNode = (id: string, isRoot: boolean, workDischarge?: 'UNDECLARED') => ({
	id,
	name: id,
	isRoot,
	permittedChildTypeIds: [] as string[],
	...(workDischarge ? { workDischarge } : {})
});

describe('lintComposition — advisory structure checks', () => {
	it('is clean for a small hierarchy with one root', () => {
		expect(
			lintComposition([
				node('root', true, ['a', 'b']),
				node('a', false, ['c']),
				node('b', false),
				node('c', false)
			])
		).toEqual([]);
	});

	it('flags a flat fan-out (star) — the root permitting everything', () => {
		const kids = ['a', 'b', 'c', 'd', 'e'];
		const types = [node('root', true, kids), ...kids.map((k) => node(k, false))];
		const f = lintComposition(types);
		expect(f.some((x) => x.severity === 'warn' && /flat fan-out/.test(x.message))).toBe(true);
	});

	it('flags missing and duplicate roots', () => {
		expect(lintComposition([node('a', false)]).some((f) => /No root/.test(f.message))).toBe(true);
		expect(
			lintComposition([node('a', true), node('b', true)]).some((f) =>
				/2 root types/.test(f.message)
			)
		).toBe(true);
	});

	it('flags an orphan (a non-root type no one permits)', () => {
		const f = lintComposition([node('root', true, ['a']), node('a', false), node('orphan', false)]);
		expect(f.some((x) => x.severity === 'info' && /not reachable/.test(x.message))).toBe(true);
	});

	it('returns nothing for an empty graph', () => {
		expect(lintComposition([])).toEqual([]);
	});

	// JAN-PRPWA-DS-001 SPEC-2 / INV-4a / INV-4b (DWP-03): the under-decomposition advisory.
	const leaf = (
		id: string,
		requiredOutputs: string[],
		executionBoundary?: 'INTERNAL' | 'DELEGATED_EXTERNAL'
	) => ({ id, name: id, isRoot: false, permittedChildTypeIds: [] as string[], requiredOutputs, executionBoundary });

	it('INV-4b: fires on an INTERNAL leaf that produces >1 distinct output', () => {
		const f = lintComposition([node('root', true, ['multi']), leaf('multi', ['spec', 'code', 'tests'])]);
		expect(
			f.some((x) => x.severity === 'info' && /distinct outputs/.test(x.message))
		).toBe(true);
	});

	it('INV-4b: does NOT fire on a single-output (or zero-output) irreducible INTERNAL leaf', () => {
		const f = lintComposition([node('root', true, ['one', 'none']), leaf('one', ['artifact']), leaf('none', [])]);
		expect(f.some((x) => /distinct outputs/.test(x.message))).toBe(false);
	});

	it('INV-4a: NEVER fires on a DELEGATED_EXTERNAL node, whatever it produces (structural suppression)', () => {
		const f = lintComposition([
			node('root', true, ['delegated']),
			leaf('delegated', ['result-a', 'result-b', 'result-c'], 'DELEGATED_EXTERNAL')
		]);
		expect(f.some((x) => /distinct outputs/.test(x.message))).toBe(false);
	});

	it('deduplicates outputs: a leaf repeating one output name is not flagged', () => {
		const f = lintComposition([node('root', true, ['dup']), leaf('dup', ['artifact', 'artifact'])]);
		expect(f.some((x) => /distinct outputs/.test(x.message))).toBe(false);
	});
});

// ── ⭑⭑ JAN-EXECGOV EG-07c — THE EXECUTION CONSEQUENCE, SPOKEN AT AUTHORING TIME ──────────────────────────────
//
// `undertakings/[id]/+page.server.ts` decides `isModelStep = pwuType?.workDischarge === 'MODEL'`, so a type that
// declares nothing is SILENTLY downgraded to a TRANSFORMATION step: no runtime binding, `OUT_OF_SCOPE`, and
// nothing anywhere says so. The author finds out three layers away, at execution, if at all.
describe('EG-07c — an undeclared discharge is disclosed, not refused', () => {
	const n = undeclaredNode;

	it('⛔ names the types that have not yet decided, and states the consequence', () => {
		const f = lintComposition([n('root', true, 'UNDECLARED'), n('a', false, 'UNDECLARED')]);
		const m = f.find((x) => /have not yet decided/.test(x.message));
		expect(m, 'the UNDECLARED case must be reported').toBeDefined();
		expect(m!.message).toMatch(/root, a/);
		// THE MUTANT: report the fact without the consequence. "You did not declare X" is an instruction to fill
		// a field; naming what it COSTS is what makes it a decision.
		expect(m!.message).toMatch(/requests no runtime binding/);
	});

	it('⛔⛔ ABSENT gets its OWN message — never asked is not the same as asked and deferred', () => {
		// THE MUTANT: emit one message for both. That collapse is precisely what `workDischarge` exists to
		// prevent, and committing it inside the instrument that reports on it would be the defect twice over.
		const f = lintComposition([n('root', true), n('a', false)]);
		expect(f.find((x) => /were never asked/.test(x.message))).toBeDefined();
		expect(f.find((x) => /have not yet decided/.test(x.message))).toBeUndefined();
	});

	it('⭑ the two facts are reported SEPARATELY when both are present', () => {
		const f = lintComposition([n('root', true), n('a', false, 'UNDECLARED')]);
		expect(f.filter((x) => /never asked|not yet decided/.test(x.message))).toHaveLength(2);
	});

	it('⭑⭑ CONTROL — it is an ADVISORY, never a refusal, and never a warn', () => {
		// ⛔ `JAN-EXEBIND` added a refusal keyed on this family and the register records the result: "an
		// UNRECOVERABLE WEDGE whose refusal message prescribed a remedy the engine categorically forbids". That
		// refusal stays withdrawn. `lintComposition` returns findings; it cannot refuse — so what this control
		// really pins is the SEVERITY, the one dial that could quietly turn an advisory into a blocker.
		// ⚠ BOTH BRANCHES, AND A MUTANT PROVED IT NECESSARY. The first version arranged only the ABSENT case,
		// so flipping the UNDECLARED branch's severity to 'warn' left this control GREEN — a control that did
		// not cover half of what its own name claims. Each message is now asserted separately.
		const unasked = lintComposition([n('root', true)]);
		const undeclared = lintComposition([n('root', true, 'UNDECLARED')]);
		expect(unasked.length).toBeGreaterThan(0);
		expect(undeclared.length).toBeGreaterThan(0);
		expect([...unasked, ...undeclared].every((x) => x.severity === 'info')).toBe(true);
	});

	it('⭑⭑ CONTROL — DELEGATED_EXTERNAL is SILENT, because the engine refuses a discharge on it', () => {
		// THE MUTANT: drop the skip. The advisory would then tell an author to declare a value that
		// `pwa-authoring.ts` REFUSES on a delegated type — this instrument instructing them to break the build.
		const f = lintComposition([
			{ id: 'root', name: 'root', isRoot: true, permittedChildTypeIds: [], workDischarge: 'HUMAN' as const },
			{
				id: 'ext',
				name: 'ext',
				isRoot: false,
				permittedChildTypeIds: [] as string[],
				executionBoundary: 'DELEGATED_EXTERNAL' as const
			}
		]);
		expect(f.filter((x) => /never asked|not yet decided/.test(x.message))).toEqual([]);
	});

	it('⭑ CONTROL — a fully declared graph says nothing, so this is not "advise on everything"', () => {
		expect(lintComposition([node('root', true, ['a']), node('a', false)])).toEqual([]);
	});
});

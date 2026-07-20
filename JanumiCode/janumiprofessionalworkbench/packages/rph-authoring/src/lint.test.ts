import { describe, expect, it } from 'vitest';
import { lintComposition } from './lint.js';

const node = (id: string, isRoot: boolean, children: string[] = []) => ({
	id,
	name: id,
	isRoot,
	permittedChildTypeIds: children
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

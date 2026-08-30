// P — THE SLICE LEDGER IS DERIVED, AND ITS PREDICATE HAS A BLIND-SPOT CONTROL THAT CANNOT PASS VACUOUSLY.
//
// ── WHY THIS FILE IS THE POINT OF SWP-01 ─────────────────────────────────────────────────────────────────────
// The measured mechanism of tracker divergence in this repository is that **the reader's predicate was narrower
// than the claim the artifact made**. `docs/tracking/README.md` stated its own predicate in prose, and
// `docs/tracking/w3b/` — 614 records — appeared beside it one day later, invisible to the index. Stating a
// predicate is necessary and demonstrably insufficient. This file is the half that is load-bearing.
import { readFileSync, writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
	CANARY,
	RECOGNITION,
	buildLedger,
	canonicalJson,
	discover,
	PREDICATE_SELF,
	parseSliceSource,
	recognise,
	renderRegion,
	replaceRegion,
	toRow,
	workingSet
} from './slice-ledger.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LEDGER_MD = 'docs/tracking/slices/LEDGER.md';
const BASELINE = 'verif/slices/slice-ledger.baseline.json';

const files = workingSet(ROOT);
const recognised = recognise(files);
const discovered = discover(ROOT, files);
const delta = discovered.filter((f) => !recognised.includes(f));

describe('SL-L3 — the ledger notices what its own predicate cannot see', () => {
	// ⚠ THE ASSERTION IS `delta == [CANARY]`, NOT `delta == []`.
	//
	// `delta == []` is an ABSENCE assertion, and a sweep that silently returned nothing satisfies it perfectly —
	// the gate would be green because it looked at no files. Committing one permanently unreachable Slice turns a
	// two-outcome check into a three-outcome one, and the third outcome is the one that catches a broken sweep.
	it('the wide sweep finds exactly the canary outside the recognised set', () => {
		expect(
			delta,
			'a Slice-shaped file exists where the ledger cannot see it. Either move it under one of the four ' +
				'recognised patterns, or — if it is deliberately unreachable — this gate has found the thing it ' +
				'exists to find. An EMPTY delta is also a failure: it means the sweep stopped seeing the canary ' +
				'and is no longer measuring anything.'
		).toEqual([CANARY]);
	});

	// CONTROL 1 — THE SWEEP READS A REAL TREE. Every assertion here is satisfied by a sweep that returns nothing
	// on both sides. This is the vacuity this repository has recorded repeatedly.
	it('CONTROL — the working set and the sweep are real', () => {
		expect(files.length, 'files in the gitignore-aware working set').toBeGreaterThan(500);
		expect(
			files.filter((f) => /\.(ts|svelte)$/.test(f)).length,
			'sources the marker limb sweeps'
		).toBeGreaterThan(300);
		expect(discovered, 'the sweep must at minimum find the canary').toContain(CANARY);
	});

	// CONTROL 2 — RECOGNITION AND DISCOVERY DISAGREE IN THE RIGHT DIRECTION, ON THE EXACT FILENAME THE ROADMAP
	// ORIGINALLY PROPOSED. `*.slice.ts` is collected by NO runner here (REG-F-293), so a Slice named that way
	// would assert nothing while still appearing in a ledger built by a laxer predicate.
	it('CONTROL — the roadmap ORIGINAL filename is discovered but NOT recognised', () => {
		const planted = 'packages/rph-engine/src/slices/e2e-001-intent-to-architecture.slice.ts';
		expect(RECOGNITION.some((re) => re.test(planted)), 'must NOT be recognised').toBe(false);
		expect(/\.slice\./.test(planted) || /(^|\/)slices\//.test(planted), 'must BE discovered').toBe(true);
	});

	// CONTROL 3 — THE CORRECTED NAMES ARE RECOGNISED. Without this, a recognition predicate that matched nothing
	// at all would pass CONTROL 2 and silently ledger zero Slices forever.
	it('CONTROL — the corrected suffixes ARE recognised, on both planes', () => {
		const engine = 'packages/rph-engine/src/slices/e2e-001-intent-to-architecture.slice.test.ts';
		const surface = 'apps/rph-demo/e2e/slices/s-001-evidence.slice.e2e.ts';
		expect(RECOGNITION.some((re) => re.test(engine)), 'ENGINE plane').toBe(true);
		expect(RECOGNITION.some((re) => re.test(surface)), 'SURFACE plane').toBe(true);
	});

	// CONTROL 4 — THE SELF-EXEMPTION IS EARNING ITS PLACE, CHECKED IN BOTH DIRECTIONS.
	//
	// ⚠ AN EXEMPTION LIST IS HOW A GATE ROTS INTO AN ALLOWLIST, and this repository has recorded that against
	// itself. So the two files exempted from the marker limb must each (a) exist and (b) actually contain the
	// marker — an entry whose reason expired fails here rather than sitting quietly. They are exempt only because
	// the code that searches for a string necessarily contains that string.
	it('CONTROL — every self-exemption names a real file that really contains the marker', () => {
		expect(PREDICATE_SELF.length, 'the exemption must stay small').toBeLessThanOrEqual(2);
		for (const f of PREDICATE_SELF) {
			expect(files, `${f} is exempted but is not in the working set`).toContain(f);
			expect(
				readFileSync(`${ROOT}/${f}`, 'utf8'),
				`${f} is exempted from the marker limb but does not contain the marker — remove the exemption`
			).toContain('export const SLICE');
		}
	});

	// CONTROL 5 — A KNOWN FALSE-POSITIVE RISK IS CORRECTLY REJECTED. Keying discovery on the WORD "slice" was
	// rejected with a number: 52 tracked .ts files contain it. This is one of them.
	it('CONTROL — an unrelated file with "slice" in its name is neither recognised nor discovered', () => {
		const unrelated = 'packages/csaa/src/query/module-code-slice.ts';
		expect(RECOGNITION.some((re) => re.test(unrelated))).toBe(false);
		expect(/\.slice\./.test(unrelated.split('/').pop()!)).toBe(false);
		expect(/(^|\/)slices\//.test(unrelated)).toBe(false);
	});
});

describe('SL-L1/SL-L2 — the committed ledger equals what the declarations generate', () => {
	const ledger = buildLedger(ROOT);

	it('the committed products are not stale', () => {
		const md = replaceRegion(readFileSync(`${ROOT}/${LEDGER_MD}`, 'utf8'), renderRegion(ledger));
		expect(
			readFileSync(`${ROOT}/${LEDGER_MD}`, 'utf8'),
			`${LEDGER_MD} is stale. Run \`bun run slices:ledger\`. Never hand-edit it.`
		).toBe(md);

		const baseline = canonicalJson({
			canary: CANARY,
			recognisedCount: ledger.recognisedCount,
			rows: ledger.rows
		});
		expect(
			readFileSync(`${ROOT}/${BASELINE}`, 'utf8'),
			`${BASELINE} is stale. Run \`bun run slices:ledger\`.`
		).toBe(baseline);
	});

	// CONTROL — A HAND EDIT INSIDE THE GENERATED REGION REDDENS. Driven against a real tamper, then restored: a
	// staleness gate never seen to fail is the instrument shape this repository has recorded against itself.
	//
	// ⚠ THE TAMPER MUST BE INSIDE THE MARKERS, AND THE FIRST DRAFT PUT IT OUTSIDE. Appending to the end of the
	// file did NOT redden, correctly — `replaceRegion` rewrites only the region, so the human-authored preamble
	// survives by design. That near-miss is worth keeping: this gate protects the GENERATED REGION, not the whole
	// document, and a control that tampered outside it would have "passed" while proving nothing.
	it('CONTROL — a hand edit INSIDE the generated region reddens the equality check', () => {
		const path = `${ROOT}/${LEDGER_MD}`;
		const original = readFileSync(path, 'utf8');
		try {
			const tamperedText = original.replace('### Slices', '### Slices (hand-edited)');
			expect(tamperedText, 'the tamper must actually change the region').not.toBe(original);
			writeFileSync(path, tamperedText, 'utf8');
			const regenerated = replaceRegion(readFileSync(path, 'utf8'), renderRegion(buildLedger(ROOT)));
			expect(readFileSync(path, 'utf8'), 'the tamper must be detectable').not.toBe(regenerated);
		} finally {
			writeFileSync(path, original, 'utf8');
		}
		expect(readFileSync(path, 'utf8'), 'and the file must be restored').toBe(original);
	});

	it('the ledger records the true count, which is zero until SWP-02', () => {
		expect(ledger.recognisedCount).toBe(recognised.length);
		expect(ledger.rows).toHaveLength(recognised.length);
	});
});

describe('the declaration reader refuses rather than guesses', () => {
	const CATALOG = new Set(['RPH-E2E-001']);
	// ⚠ PARSED FROM A STRING, NEVER FROM A FILE — and that is a finding, not a style choice. A first draft wrote
	// fixture files; but any fixture named to exercise the reader matches the recognition predicate, so the
	// reader's own test polluted the recognised set and refused the whole ledger. Any fixture merely CONTAINING
	// `export const SLICE` would also have been caught by the discovery sweep and broken the blind-spot control
	// above. The test for a reader must not be visible to the thing the reader feeds.
	const parse = (source: string): unknown =>
		toRow(parseSliceSource(source, 'fixture.slice.test.ts'), CATALOG);

	const WELL_FORMED = [
		'export const SLICE = {',
		"	id: 'FIXTURE',",
		"	title: 'a fixture',",
		"	plane: 'ENGINE',",
		"	scenarioClass: 'normal path',",
		"	citedRules: ['RPH-E2E-001'],",
		'	dischargesRegisterEntries: [],',
		'	mutants: [',
		"		{ id: 'm1', file: 'a.ts', find: 'x', replace: 'y', expectRed: ['c1'],",
		"		  predictedMessage: 'a message long enough to identify one guard', why: 'because' }",
		'	]',
		'};'
	].join('\n');

	// CONTROL — THE FIXTURE IS ACCEPTED. Without this, every refusal below would be satisfied by a reader that
	// refuses everything, which is the control-that-cannot-fail shape.
	it('CONTROL — a well-formed declaration is accepted', () => {
		expect((parse(WELL_FORMED) as { id: string }).id).toBe('FIXTURE');
	});

	it('refuses a scenario class that is not one of the ratified eight', () => {
		expect(() => parse(WELL_FORMED.replace("'normal path'", "'happy path'"))).toThrow(
			/scenarioClass 'happy path' is not one of the eight ratified classes/
		);
	});

	it('refuses a cited rule that is not in the M12 catalog', () => {
		expect(() => parse(WELL_FORMED.replace("'RPH-E2E-001'", "'RPH-NOPE-999'"))).toThrow(
			/names 'RPH-NOPE-999', which is not in the M12 rule catalog/
		);
	});

	// ⚠ THE MESSAGE, NOT THE CODE. JAN-CSAA closed 64 of 65 findings whose tests asserted an issue CODE alone,
	// because one code had 116 emitters. A mutant predicting a code tells no two guards apart.
	it('refuses a predicted message too short to identify a guard', () => {
		expect(() => parse(WELL_FORMED.replace("'a message long enough to identify one guard'", "'nope'"))).toThrow(
			/predictedMessage is shorter than 20 characters; predict a MESSAGE, not a code/
		);
	});

	it('refuses a mutant with no named victim', () => {
		expect(() => parse(WELL_FORMED.replace("expectRed: ['c1']", 'expectRed: []'))).toThrow(
			/expectRed is empty; a mutant with no named victim proves nothing/
		);
	});

	it('refuses a Slice that cites no ratified rule at all', () => {
		expect(() => parse(WELL_FORMED.replace("citedRules: ['RPH-E2E-001']", 'citedRules: []'))).toThrow(
			/citedRules is empty; a Slice citing no ratified rule is a demonstration, not a verification/
		);
	});

	it('refuses a file with no exported SLICE', () => {
		expect(() => parse('export const NOT_SLICE = {};')).toThrow(/no exported const named SLICE/);
	});

	it('refuses a non-literal, rather than evaluating it', () => {
		expect(() => parse(WELL_FORMED.replace("'a fixture'", 'someCall()'))).toThrow(/not a literal/);
	});
});

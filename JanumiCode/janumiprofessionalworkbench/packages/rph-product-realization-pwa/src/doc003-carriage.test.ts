// RPH-DOC-003's ONTOLOGY POPULATIONS ARE CARRIED IN THE SEED, AND UNTIL NOW NOTHING SAID SO — REG-F-183/184.
//
// Ratify Sheet Part 4's first precondition (REG-Q-045) holds RPH-DOC-003/004 until the seeded Product Realization
// PWA carries their "type hierarchy, policy catalog, profiles, and taxonomies losslessly". REG-F-183 audited that
// by hand: all 58 named items ARE carried, but 36 of them live inside SIX prose strings that nothing enumerates —
// so a careless edit drops a ratified distinction and no test reddens. This file is that missing test.
//
// ⚠ WHAT IT DOES NOT DO, SAID FIRST SO THE COVERAGE IS NOT OVER-READ. It does not move content out of prose into
// structured fields, and it does not fix the deeper oddity REG-F-183 named — that §10's six failure modes are
// carried inside a `sourceSection` PROVENANCE string rather than as content. It pins the WORDS against the
// ratified text. That is strictly less than "the taxonomy is modelled", and strictly more than nothing, which is
// what was there before.
//
// ⚠ AND IT DELIBERATELY ADDS NO ONTOLOGY FIELD. `packages/rph-engine/src/ontology-delivery-census.test.ts` fails
// for any authored `pwuTemplates` key that is neither delivered into the seeder payload nor carried by a
// `TEMPLATE_ACCOUNTED_FOR` row — and that list has been EMPTY since 2026-08-06, its own comment recording that
// "an exemption nobody checks is how this table rots into an allowlist". Adding a field here to hold these items
// would have reopened it. The content is already in the dataset; what was missing was the check.
//
// ── WHY IT READS THE RATIFIED DOCUMENT AT RUNTIME ───────────────────────────────────────────────────────────
// Transcribing the expected lists into this file would make it a copy checked against a copy: the two could drift
// together and the test would still pass. `doc004-conformance.test.ts` established the alternative for the twelve
// policies — derive the expectation from the corpus on every run — and REG-D-034 (sponsor ruling, 2026-08-09)
// makes that permanently sound by abandoning the corpus retirement and admitting these documents as SOURCE OF
// RECORD, authoritative for DETAIL. The oracle is not going anywhere.
//
// ⚠ SUBSECTIONS ARE FOUND BY TITLE AND ANCHOR TEXT, NEVER BY NUMBER OR LINE. RPH-DOC-003's subsections are
// UNNUMBERED (`## Minimum scenario classes`), a third shape beside DOC-004's `## N.M Title` and its own numbered
// `## 4.1 Lightweight Profile`. `doc004-conformance.test.ts` records why this matters: "assuming a number is the
// single most reliable way to read the wrong subsection and report it as ratified". Line numbers are worse still
// — REG-Q-045 cites L535-542/L548-555/L633-644, and a single edit above them moves every one.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ontology } from './index.js';

const DOC003 = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'docs',
	'Recursive Professional Harness',
	'Janumi Professional Workbench Product Realization PWA - Professional Ontology and Assurance Policy Specification.md'
);
const lines = readFileSync(DOC003, 'utf8').split(/\r?\n/);

/** The contiguous `* item;` run beginning after the first line matching `anchor`. Throws if the anchor is gone. */
function bulletsAfter(anchor: RegExp): string[] {
	const at = lines.findIndex((l) => anchor.test(l.trim()));
	if (at < 0) throw new Error(`RPH-DOC-003 no longer contains the anchor ${anchor} — the corpus moved.`);
	const items: string[] = [];
	for (let i = at + 1; i < lines.length; i += 1) {
		const line = lines[i]!.trim();
		if (line === '') {
			if (items.length > 0) break;
			continue;
		}
		if (!line.startsWith('* ')) break;
		items.push(line.slice(2).replace(/[;.]$/, ''));
	}
	return items;
}

/** Every `Appropriate for:` run in the document, in order — the three profiles' selection criteria. */
function everyAppropriateForRun(): string[][] {
	const runs: string[][] = [];
	lines.forEach((l, idx) => {
		if (!/^Appropriate for:$/.test(l.trim())) return;
		const items: string[] = [];
		for (let i = idx + 1; i < lines.length; i += 1) {
			const line = lines[i]!.trim();
			if (line === '') {
				if (items.length > 0) break;
				continue;
			}
			if (!line.startsWith('* ')) break;
			items.push(line.slice(2).replace(/[;.]$/, ''));
		}
		runs.push(items);
	});
	return runs;
}

/** The seeded ontology as one searchable body. The question is CARRIAGE, not which field carries it. */
const seeded = JSON.stringify(ontology).toLowerCase();
const carries = (item: string): boolean => seeded.includes(item.toLowerCase());

const POPULATIONS = [
	{
		name: 'Intent Discovery epistemic taxonomy (§10 "must distinguish")',
		items: bulletsAfter(/^A PWU Instance of this type must distinguish:$/),
		expect: 6
	},
	{
		name: 'validator-hunted failure modes (§10 "should specifically check for")',
		items: bulletsAfter(/should specifically check for:$/),
		expect: 6
	},
	{
		name: 'minimum scenario classes (§12)',
		items: bulletsAfter(/^For material journeys:$/),
		expect: 8
	}
];

describe('REG-F-183 — every RPH-DOC-003 ontology population the seed claims to carry is carried VERBATIM', () => {
	describe.each(POPULATIONS.map((p) => [p.name, p] as const))('%s', (_name, population) => {
		// The population's SIZE is pinned too. A doc edit that deleted five of six bullets would otherwise leave a
		// green run over the one survivor — the shape REG-F-121 recorded, where a shrinking denominator reported
		// as success.
		it('the ratified population is the size this repository was audited against', () => {
			expect(population.items).toHaveLength(population.expect);
		});

		it('every item is carried by the seeded ontology, in the ratified wording', () => {
			const missing = population.items.filter((i) => !carries(i));
			expect(
				missing,
				'A ratified item is no longer present in the seeded Product Realization PWA in the words ' +
					'RPH-DOC-003 uses. Either the seed lost it, or it was ABBREVIATED — and an abbreviation is how ' +
					'36 of these 58 items came to sit in prose that nothing checked (REG-F-183). Carry the ratified ' +
					'wording; do not relax this test to match a paraphrase.'
			).toEqual([]);
		});
	});

	it('the three conformance profiles carry all sixteen selection criteria', () => {
		const runs = everyAppropriateForRun();
		// ⚠ SIXTEEN, NOT FIFTEEN. REG-Q-045 describes "three conformance profiles with five selection criteria";
		// the source is 5 + 5 + 6 (High-Assurance has six). Derived here rather than restated, which is how the
		// off-by-one was found in the first place (REG-F-183).
		expect(runs.map((r) => r.length)).toEqual([5, 5, 6]);
		const missing = runs.flat().filter((c) => !carries(c));
		expect(missing, 'a profile selection criterion is not carried in the ratified wording').toEqual([]);
	});

	// ── CONTROLS ────────────────────────────────────────────────────────────────────────────────────────────
	//
	// Every assertion above is `expect(missing).toEqual([])`, which is exactly what a reader that finds NOTHING
	// also produces. These hold the discriminating half.
	it('CONTROL — the reader resolves the real document, not an empty one', () => {
		expect(lines.length, 'RPH-DOC-003 did not load').toBeGreaterThan(1000);
		expect(POPULATIONS.flatMap((p) => p.items).length).toBe(20);
	});

	it('CONTROL — `carries` REJECTS a phrase of the same shape that is not in the seed', () => {
		expect(carries('quantum flux capacitor path')).toBe(false);
		expect(carries('user-stated facts')).toBe(true);
	});

	it('CONTROL — a missing anchor THROWS rather than yielding an empty population', () => {
		expect(() => bulletsAfter(/^this anchor is not in the document:$/)).toThrow(/corpus moved/);
	});
});

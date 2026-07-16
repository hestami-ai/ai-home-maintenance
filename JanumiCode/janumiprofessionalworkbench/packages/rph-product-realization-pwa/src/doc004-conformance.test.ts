// THE ONTOLOGY IS CHECKED AGAINST THE RATIFIED DOCUMENT ITSELF — not against a transcription of it.
//
// WHY THIS EXISTS. Every seed policy carries a `sourceSection` claiming what is transcribed from DOC-004 and what
// is authored. Those claims were prose, and prose does not fail a build. On 2026-07-16 exactly one of them was
// checked by hand and it was FALSE: pol_historical_consistency asserted "the 5 criteria descriptions are §22.3's
// 'Claims evaluated' items 1:1 verbatim" when ONE of the five was verbatim. Ratified claim §22.3.5 ("stale or
// inapplicable precedent is not treated as binding") had been dropped entirely and HC-05 restated §22.3.4 in its
// place — a policy that silently lost a ratified claim and gained one nobody ratified. That shipped, described as
// adversarially verified. A second reviewer had passed it, because "faithful" reads as true for a paraphrase.
//
// So the fix is not a better reviewer. Fidelity to a ratified corpus is a machine-checkable property, and this is
// the machine check: the corpus is IN this repository, so the test reads DOC-004 and compares. A paraphrase now
// fails CI. That is also what lets `sourceSection`'s transcription claims be trusted — they are the claims this
// test enforces.
//
// WHAT THIS DELIBERATELY DOES NOT CHECK. Only what DOC-004 actually ratifies: criterion text, criterion ids/names
// where a "Criteria" subsection ratifies them, and finding codes. It does NOT check criterion ids for the ten
// policies whose sections have no Criteria subsection (minted by ordinal — the doc ratifies none), nor any of the
// authored fields (evaluatorRole, failureSeverity, …). Checking an authored value against the doc would fail; the
// point is to pin the line between the two, not to blur it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ontology } from './index.js';
import type { SeedPolicy } from './ontology.types.js';

const DOC = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'docs',
	'Recursive Professional Harness',
	'Janumi Professional Workbench Product Realization PWA - Assurance Policy Catalog and Validator Contract.md'
);

/** section number -> policyId. The catalog's twelve ratified policies (DOC-004 §15-§26). */
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
	['15', 'pol_intent_fidelity'],
	['16', 'pol_intent_completeness'],
	['17', 'pol_assumption_disclosure'],
	['18', 'pol_requirement_coverage'],
	['19', 'pol_decomposition_coverage'],
	['20', 'pol_constraint_propagation'],
	['21', 'pol_architecture_coverage'],
	['22', 'pol_historical_consistency'],
	['23', 'pol_intent_preservation'],
	['24', 'pol_test_adequacy'],
	['25', 'pol_fitness_for_purpose'],
	['26', 'pol_baseline_promotion']
];

interface RatifiedCriterion {
	readonly id?: string;
	readonly name?: string;
	readonly text: string;
}

const lines = readFileSync(DOC, 'utf8').split(/\r?\n/);

/** The body lines of section `# N. …`, up to the next top-level heading. */
function sectionLines(section: string): string[] {
	const start = lines.findIndex((l) => new RegExp(`^# ${section}\\. `).test(l));
	if (start < 0) throw new Error(`DOC-004 has no section "# ${section}."`);
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((l) => /^# \d+\./.test(l));
	return end < 0 ? rest : rest.slice(0, end);
}

/**
 * The body of the subsection whose TITLE matches, e.g. `subsection(body, 'Findings')`.
 *
 * BY TITLE, never by number. Subsection numbering is NOT uniform across the twelve policies: Purpose is §15.2 but
 * §16.1; Findings is §15.7, §16.5, §20.4, §24.5; only §15 and §19 have Criteria at all. Assuming a number is the
 * single most reliable way to read the wrong subsection and report it as ratified — it is how §20.5 ("Blocking
 * conditions") was once cited as the source of §20.4's finding codes.
 */
function subsection(body: string[], title: string): string[] | undefined {
	const start = body.findIndex((l) => new RegExp(`^## \\d+\\.\\d+ ${title}$`).test(l));
	if (start < 0) return undefined;
	const rest = body.slice(start + 1);
	const end = rest.findIndex((l) => /^## \d+\.\d+ /.test(l));
	return end < 0 ? rest : rest.slice(0, end);
}

/** The ratified criteria: a `Criteria` subsection (ids + names ratified) else `Claims evaluated` (neither). */
function ratifiedCriteria(body: string[]): {
	criteria: RatifiedCriterion[];
	namesRatified: boolean;
} {
	const criteria = subsection(body, 'Criteria');
	if (criteria) {
		const out: RatifiedCriterion[] = [];
		for (let i = 0; i < criteria.length; i += 1) {
			const heading = /^### (\S+) (.+)$/.exec(criteria[i] ?? '');
			const text = criteria.slice(i + 1).find((l) => l.trim() !== '');
			if (heading?.[1] && heading[2] && text) {
				out.push({ id: heading[1], name: heading[2], text: text.trim() });
			}
		}
		return { criteria: out, namesRatified: true };
	}
	const claims = subsection(body, 'Claims evaluated');
	if (!claims) throw new Error('section has neither a Criteria nor a Claims evaluated subsection');
	return {
		criteria: claims
			.filter((l) => /^\d+\.\s/.test(l))
			.map((l) => ({ text: l.replace(/^\d+\.\s*/, '').trim() })),
		namesRatified: false
	};
}

/** The ratified finding codes, in document order, from the `Findings` subsection. */
function ratifiedFindingCodes(body: string[]): string[] {
	const findings = subsection(body, 'Findings');
	if (!findings) throw new Error('section has no Findings subsection');
	return findings.flatMap((l) => {
		const m = /^\*\s+`([A-Z][A-Z0-9_]*)`\s*$/.exec(l);
		return m?.[1] ? [m[1]] : [];
	});
}

/**
 * The one documented normalization: the leading character is sentence-cased.
 *
 * DOC-004's numbered lists are inconsistently cased ("1. Desired outcomes are sufficiently explicit." but
 * "3. known stakeholders and actors are represented proportionally."), which is list formatting, not meaning. No
 * other transformation is permitted: no added word, no dropped word, no reordering, no question turned into a
 * statement. That is exactly what the paraphrases did.
 */
function sentenceCase(s: string): string {
	return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Keyed to the DECLARED interface, not to the dataset's literal types: `as const satisfies` narrows each entry to
// its own literal shape, so the union only admits `findingAnnotations` on the entries that happen to carry one.
const policies = new Map<string, SeedPolicy>(ontology.seedPolicies.map((p) => [p.policyId, p]));

describe('the seeded catalog conforms to DOC-004 itself', () => {
	it('covers every ratified policy — DOC-004 §15-§26 is twelve policies', () => {
		expect(ontology.seedPolicies).toHaveLength(SECTIONS.length);
		expect([...policies.keys()].sort()).toEqual(SECTIONS.map(([, id]) => id).sort());
	});

	describe.each(SECTIONS)('§%s -> %s', (section, policyId) => {
		const body = sectionLines(section);
		const policy = policies.get(policyId);
		if (!policy) throw new Error(`ontology has no seed policy ${policyId}`);

		it('every criterion description is the ratified text', () => {
			const { criteria } = ratifiedCriteria(body);
			expect(policy.criteria).toHaveLength(criteria.length);
			policy.criteria.forEach((seeded, i) => {
				expect(
					seeded.description,
					`${policyId}/${seeded.id} is not §${section}'s ratified text`
				).toBe(sentenceCase(criteria[i]?.text ?? ''));
			});
		});

		it('criterion ids and names are the ratified ones where the doc ratifies them', () => {
			const { criteria, namesRatified } = ratifiedCriteria(body);
			if (!namesRatified) {
				// The doc ratifies neither id nor name here, so name = the id (the minting rule). Asserting the id
				// itself against the doc is impossible — that is the point of recording it as a derivation.
				policy.criteria.forEach((c) => expect(c.name).toBe(c.id));
				return;
			}
			policy.criteria.forEach((seeded, i) => {
				expect(seeded.id).toBe(criteria[i]?.id);
				expect(seeded.name).toBe(criteria[i]?.name);
			});
		});

		it('finding codes are the ratified ones, complete and in document order', () => {
			expect(policy.findingTypes).toEqual(ratifiedFindingCodes(body));
		});

		it('every annotated finding code is one this policy actually lists', () => {
			// An annotation is authored text attached to a ratified code. One attached to a code the policy does
			// not list is orphaned — it would describe a finding this policy can never raise.
			for (const code of Object.keys(policy.findingAnnotations ?? {})) {
				expect(policy.findingTypes, `${policyId} annotates unlisted code ${code}`).toContain(code);
			}
		});
	});

	it('the DERIVED control-action floor really is the intersection of the four ratified sets', () => {
		// The eight policies whose sections ratify no control actions use a derived floor. It is only defensible if
		// it is genuinely derived, so it is computed from the doc here rather than trusted: if DOC-004 later
		// ratifies control actions differently, this fails instead of silently going stale.
		const ratifiedSets = SECTIONS.map(
			([section]) =>
				subsection(sectionLines(section), 'Permitted control actions') ??
				subsection(sectionLines(section), 'Control actions')
		)
			.filter((s): s is string[] => s !== undefined)
			.map((s) =>
				s.flatMap((l) => (/^\*\s+([A-Z_]+)\s*$/.exec(l) ? [/^\*\s+([A-Z_]+)\s*$/.exec(l)![1]] : []))
			);
		expect(ratifiedSets, 'DOC-004 ratifies control actions for exactly four policies').toHaveLength(
			4
		);

		const intersection = ratifiedSets
			.reduce((acc, set) => acc.filter((a) => set.includes(a)))
			.sort();
		expect(intersection).toEqual(['REQUEST_HUMAN_DECISION', 'RESHAPE_PWU']);

		// pol_test_adequacy (§24) ratifies none and had no prior authored value -> it carries exactly the floor.
		const testAdequacy = policies.get('pol_test_adequacy');
		expect([...(testAdequacy?.permittedControlActions ?? [])].sort()).toEqual(intersection);
	});
});

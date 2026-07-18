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
//
// WHY DOC-004 GOVERNS THE STRUCTURE CHECKED HERE, AND DOC-003 STILL GOVERNS SEVERITY.
// RPH-DOC-003 §25–§35 covers eleven of these same twelve policies. It was briefly recorded as an unresolvable
// conflict ("which document governs?"). It is not a conflict — the two compose, and the documents say so
// themselves (docs/_working/RULING-doc003-doc004-compose.md):
//   - They never contradict. The ONLY policy where both state blocking conditions is Intent Preservation, and
//     they state the same rule (DOC-004 §23.6 / DOC-003 §32). For Decomposition Coverage DOC-004 §19.7 is a
//     strict SUBSET of DOC-003 §29.
//   - DOC-004 DANGLES what DOC-003 DEFINES: it says "no blocking fidelity finding remains" (§15.9) and uses
//     "blocking" nine times in §26 without ever saying which findings block. DOC-003 supplies 17 such conditions.
//   - The one policy DOC-004 gives its own Blocking conditions (§20.5, Constraint Propagation) is the one policy
//     DOC-003 has no section for. DOC-004 added it, so it had to.
//   - DOC-003's finding lists are "Common findings" — its own word, illustrative. DOC-004's are enumerated CODEs.
// So: this file checks the STRUCTURE (criteria text, ids/names, codes) against DOC-004, which is the document
// that states them; and the authored-layer tests below check severity quotes against ALL THREE ratified sources,
// because that is where the severity text actually lives. Nothing ratified is discarded by either choice.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ontology } from './index.js';
import type { SeedPolicy } from './ontology.types.js';

const CORPUS = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'docs',
	'Recursive Professional Harness'
);
const DOC = join(
	CORPUS,
	'Janumi Professional Workbench Product Realization PWA - Assurance Policy Catalog and Validator Contract.md'
);
/** RPH-DOC-003 — the SPECIFICATION half of the same catalog. Its `Blocking conditions` are the referent of
 *  DOC-004's dangling "blocking finding" language, so they decide severity. See RULING-doc003-doc004-compose.md. */
const DOC003 = join(
	CORPUS,
	'Janumi Professional Workbench Product Realization PWA - Professional Ontology and Assurance Policy Specification.md'
);
/** The third ratified source of severity-bearing text: its Given/When/Then tests ratify blocking behaviour. */
const TEST_SPEC = join(
	CORPUS,
	'Janumi Professional Workbench Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md'
);

/** Collapse whitespace. A quote lifted from a JSON block or a bulleted list reflows; its WORDS must not change. */
function normalize(s: string): string {
	return s.replace(/\s+/g, ' ').trim();
}

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

	// ── The authored layer: what §9.1 mandates and the catalog supplies for only 19 of 99 codes ───────────────
	//
	// These tests are the whole defence of 80 authored severities. They cannot check that a judgement is GOOD —
	// no test can. They check the two things that CAN be checked, which are exactly the two ways this content
	// could lie to a reader: a description that fails §9.2 (which the doc states literally), and a severity that
	// claims the corpus decided it when the corpus did not.
	//
	// The second is the important one, and it is not hypothetical. Authoring took four adversarial rounds. In
	// round 1, 20 severities claimed ratified authority and a refuter demolished essentially all of it — the
	// standard error being to quote a clause that gates SATISFIED as if it decided BLOCKING, when §10.3 has an
	// open MATERIAL finding foreclose SATISFIED too. Prose provenance could not have caught that. This can.
	describe('the authored FindingDefinition layer', () => {
		const annotated = SECTIONS.flatMap(([section, policyId]) => {
			const policy = policies.get(policyId);
			return Object.entries(policy?.findingAnnotations ?? {}).map(
				([code, a]) => [section, policyId, code, a] as const
			);
		});

		it('annotates EVERY ratified finding code — the fallback is a safety net, not the norm', () => {
			// seedAdditivePolicies falls back to the policy's failureSeverity + the humanized code for an
			// unannotated code. That fallback stays (a newly ratified code must not break the seed) but it must
			// never fire in practice: adding a code should force a deliberate authoring decision, not a default.
			for (const [, policyId] of SECTIONS) {
				const policy = policies.get(policyId);
				expect(
					Object.keys(policy?.findingAnnotations ?? {}).sort(),
					`${policyId} has unannotated finding codes`
				).toEqual([...(policy?.findingTypes ?? [])].sort());
			}
			expect(annotated).toHaveLength(99);
		});

		it('every description meets §9.2 — the doc bans this language literally', () => {
			// §9.2 verbatim: "Observations must avoid vague language such as: 'could be improved'; 'looks
			// reasonable'; 'probably acceptable'; 'consider reviewing.' The finding must explain what is deficient
			// and why it matters."
			const BANNED = [
				'could be improved',
				'looks reasonable',
				'probably acceptable',
				'consider reviewing'
			];
			for (const [, policyId, code, a] of annotated) {
				for (const phrase of BANNED) {
					expect(
						a.description.toLowerCase(),
						`${policyId}/${code} uses §9.2-banned language: "${phrase}"`
					).not.toContain(phrase);
				}
				// "what is deficient AND why it matters" — a humanization of the code does neither.
				expect(a.description.length, `${policyId}/${code}: too thin for §9.2`).toBeGreaterThan(40);
				expect(a.description.toLowerCase()).not.toBe(code.toLowerCase().replaceAll('_', ' '));
			}
		});

		it('A RATIFIED SEVERITY CLAIM MUST BE IN THE RATIFIED DOCUMENTS — the anti-laundering lock', () => {
			// `severityBasis: RATIFIED_*` says "the corpus decided this, not me". That is checkable, so it is
			// checked against all three ratified sources. Whitespace-normalized, because a quote lifted from a
			// JSON block or a bulleted list reflows — but not word-normalized, so no word may be added or dropped.
			const corpus = normalize(
				[DOC, DOC003, TEST_SPEC].map((f) => readFileSync(f, 'utf8')).join('\n')
			);
			for (const [, policyId, code, a] of annotated) {
				if (a.severityBasis === 'AUTHORED') {
					expect(a.severityQuote ?? '', `${policyId}/${code} is AUTHORED but claims a quote`).toBe(
						''
					);
					continue;
				}
				const quote = normalize(a.severityQuote ?? '');
				expect(
					quote.length,
					`${policyId}/${code} claims ${a.severityBasis} with no quote`
				).toBeGreaterThan(0);
				expect(
					corpus.includes(quote),
					`${policyId}/${code} claims ${a.severityBasis} on words that are NOT in the ratified corpus:\n  ${quote}`
				).toBe(true);
			}
		});

		it('records a rationale and a legal severity for every code — the sponsor audits the call', () => {
			for (const [, policyId, code, a] of annotated) {
				expect(
					a.severityRationale.length,
					`${policyId}/${code}: no severity rationale`
				).toBeGreaterThan(30);
				expect(['INFORMATIONAL', 'ADVISORY', 'MATERIAL', 'BLOCKING', 'CRITICAL']).toContain(
					a.defaultSeverity
				);
			}
		});

		it('19 of 99 severities are ratified and 80 are authored — the split, stated as a number', () => {
			// Pinned so the honest ratio cannot drift upward unnoticed. It moved 0 -> 19 only by finding DOC-003's
			// blocking conditions; if a later change claims more ratified authority, the anti-laundering lock
			// above has to pass first, and this number has to be updated deliberately.
			const ratified = annotated.filter(([, , , a]) => a.severityBasis !== 'AUTHORED');
			expect(ratified).toHaveLength(19);
			expect(annotated.filter(([, , , a]) => a.severityBasis === 'AUTHORED')).toHaveLength(80);
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

// ── The RULING's premise, machine-checked: DOC-003 and DOC-004 COMPOSE without contradiction ─────────────────
//
// docs/_working/RULING-doc003-doc004-compose.md concludes the two catalog documents are one catalog at two
// levels. That conclusion rests on a structural claim about their `Blocking conditions`, and a prose claim does
// not fail a build (the lesson at the top of this file). So the claim is pinned here, read from the corpus:
//
//   - The ONLY policy for which BOTH documents state blocking conditions is Intent Preservation, and there the
//     two rules AGREE (both: material divergence, without authorization). That single overlap is the whole
//     non-contradiction argument — if a future edit adds a second both-blocked policy, this fails, because a
//     second overlap is exactly where a contradiction could hide.
//   - The one policy DOC-004 blocks that DOC-003 has NO section for is Constraint Propagation — the twelfth
//     policy DOC-004 adds. That is why DOC-004 states its own blocking conditions there and nowhere DOC-003
//     already did.
//
// This is a structural guard, not a semantic one: it cannot prove two rules mean the same thing. It pins the
// shape the ruling depends on, so the corpus cannot drift out from under the composition reading unnoticed.
describe('RPH-DOC-003 and RPH-DOC-004 compose without contradiction (the ruling premise)', () => {
	const doc003Lines = readFileSync(DOC003, 'utf8').split(/\r?\n/);

	/** DOC-003's eleven policy section names -> policyId. Constraint Propagation is deliberately ABSENT — the
	 *  point of one assertion below is that DOC-003 has no section for it. */
	const DOC003_POLICY_IDS: Readonly<Record<string, string>> = {
		'Intent Fidelity': 'pol_intent_fidelity',
		'Intent Completeness': 'pol_intent_completeness',
		'Assumption Disclosure': 'pol_assumption_disclosure',
		'Requirement Coverage': 'pol_requirement_coverage',
		'Decomposition Coverage': 'pol_decomposition_coverage',
		'Architecture Coverage': 'pol_architecture_coverage',
		'Historical Consistency': 'pol_historical_consistency',
		'Intent Preservation': 'pol_intent_preservation',
		'Test Adequacy': 'pol_test_adequacy',
		'Fitness for Purpose': 'pol_fitness_for_purpose',
		'Baseline Promotion': 'pol_baseline_promotion'
	};

	/** Each DOC-003 `# N. Assurance Policy: <name>` section, with its body up to the next top-level heading. */
	function doc003PolicySections(): { name: string; body: string[] }[] {
		const out: { name: string; body: string[] }[] = [];
		for (let i = 0; i < doc003Lines.length; i += 1) {
			const m = /^# \d+\. Assurance Policy: (.+)$/.exec(doc003Lines[i] ?? '');
			if (!m?.[1]) continue;
			const rest = doc003Lines.slice(i + 1);
			const end = rest.findIndex((l) => /^# \d+\. /.test(l));
			out.push({ name: m[1].trim(), body: end < 0 ? rest : rest.slice(0, end) });
		}
		return out;
	}

	/** DOC-003 subsections are unnumbered (`## Blocking conditions`), unlike DOC-004's `## N.M Blocking …`. */
	function doc003BlockingPolicyIds(): Set<string> {
		const ids = new Set<string>();
		for (const { name, body } of doc003PolicySections()) {
			if (body.some((l) => /^## Blocking conditions$/.test(l))) {
				const id = DOC003_POLICY_IDS[name];
				if (id) ids.add(id);
			}
		}
		return ids;
	}

	const SECTION_TO_POLICY = new Map<string, string>(SECTIONS.map(([s, id]) => [s, id]));

	/** DOC-004's own `## N.M Blocking conditions` subsections, mapped to policyId. */
	function doc004BlockingPolicyIds(): Set<string> {
		const ids = new Set<string>();
		for (const l of lines) {
			const m = /^## (\d+)\.\d+ Blocking conditions$/.exec(l);
			const id = m?.[1] ? SECTION_TO_POLICY.get(m[1]) : undefined;
			if (id) ids.add(id);
		}
		return ids;
	}

	function firstNonEmptyAfter(body: string[], headerRe: RegExp): string {
		const idx = body.findIndex((l) => headerRe.test(l));
		return idx < 0 ? '' : (body.slice(idx + 1).find((l) => l.trim() !== '')?.trim() ?? '');
	}

	it('the only policy both documents block is Intent Preservation — the single overlap', () => {
		const d003 = doc003BlockingPolicyIds();
		const d004 = doc004BlockingPolicyIds();
		const overlap = [...d004].filter((id) => d003.has(id)).sort();
		expect(overlap).toEqual(['pol_intent_preservation']);
	});

	it('the one policy DOC-004 blocks that DOC-003 has no section for is Constraint Propagation', () => {
		const d003 = doc003BlockingPolicyIds();
		const doc004Only = [...doc004BlockingPolicyIds()].filter((id) => !d003.has(id)).sort();
		expect(doc004Only).toEqual(['pol_constraint_propagation']);
		// …and DOC-003 genuinely has no section for it: none of its policy sections name Constraint Propagation.
		expect(doc003PolicySections().map((s) => s.name)).not.toContain('Constraint Propagation');
	});

	it('where both block Intent Preservation, the two rules agree — material divergence, unauthorized', () => {
		// DOC-003 §32: "Material divergence without authorized intent revision."
		// DOC-004 §23.6: "Any material unauthorized divergence from approved intent."
		const ip = doc003PolicySections().find((s) => s.name === 'Intent Preservation');
		if (!ip) throw new Error('DOC-003 has no Intent Preservation section');
		const d003Rule = firstNonEmptyAfter(ip.body, /^## Blocking conditions$/).toLowerCase();
		const d004Rule = firstNonEmptyAfter(sectionLines('23'), /^## 23\.6 Blocking conditions$/).toLowerCase();
		for (const rule of [d003Rule, d004Rule]) {
			expect(rule).toContain('material');
			expect(rule).toContain('diverg');
			expect(rule).toContain('authoriz');
		}
	});
});

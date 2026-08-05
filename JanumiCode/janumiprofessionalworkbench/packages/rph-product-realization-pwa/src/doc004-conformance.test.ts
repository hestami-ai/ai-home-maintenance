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
import { EvidenceTypeSchema } from '@janumipwb/rph-contracts';
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
 * The four evidence items whose referent is CONTINGENT, and why (REG-E-026).
 *
 * ── THIS IS AUTHORED JUDGEMENT, NOT TRANSCRIPTION, AND IT IS THE MOST CONSEQUENTIAL CALL IN THIS WORK ──────────
 * The corpus gives exactly one explicit cardinality signal: it hedges an item ("where applicable", "where
 * relevant"). Everything else defaults to AT_LEAST_ONE, which is the non-vacuous reading and is what makes Gate A
 * a real gate rather than a decoration.
 *
 * These four are the exception, because a blanket AT_LEAST_ONE would punish the unambiguous request: an intent
 * captured from ONE clear user expression could never reach a SATISFIED intent-fidelity verdict, for want of a
 * clarification dialogue that never happened. Absurdity is legitimate evidence that a derivation is wrong.
 *
 * ── ⚠ THE RULE HAD A SECOND ARM AND IT WAS INVALID. WITHDRAWN 2026-08-05 BY ADVERSARIAL REVIEW ───────────────
 * The first draft also exempted an item when *"the system has no object type that can produce it"*, and used
 * that to make `EV-16-02` (ambiguity catalog) and `EV-16-04` (stakeholder catalog) contingent — reasoning that
 * no `AMBIGUITY` or `STAKEHOLDER` object type exists, so the requirement would be unsatisfiable.
 *
 * **That reasoning is false, and it was false 200 lines from where I wrote it.** `cardinality` counts EVIDENCE
 * instances, and an Evidence object needs no same-named object type — `EvidenceObject.contentReference` is an
 * open record. There is no `NON_GOAL` object type either, yet `EV-16-05` gates and the reference undertaking
 * evidences it by pointing at the INTENT. Applied consistently the arm would also have voided `EV-15-01`,
 * `EV-16-05` and `EV-16-06`. **It emptied the gate rather than discriminating within it** — which is the exact
 * failure mode the whole exercise exists to prevent, committed inside the fix for it.
 *
 * **What survives is a criterion the corpus actually licenses:** an item is contingent when it exists only if an
 * optional exchange occurred AND no ratified transition guard or mandatory schema field makes its record
 * unavoidable. DOC-002 §6.2's intent transition matrix is the discriminator, and it separates the two cases the
 * bad arm lumped together:
 *   * `| UNDER_DISCOVERY | Create provisional intent | PROVISIONAL | Objective and **known ambiguities
 *     recorded** |` — a GUARD on the only path to the state these policies assess. So EV-16-02 **gates**.
 *   * The matrix names **stakeholders nowhere**, while its next row names non-goals and constraints (which is
 *     why EV-16-03 and EV-16-05 correctly gate). So EV-16-04 stays contingent, on its surviving ground alone.
 *
 * Each entry carries a textual hook rather than a preference, and each is listed so a reviewer can reject one
 * specific call — which is how this correction arrived.
 */
const CONTINGENT_EVIDENCE: Readonly<Record<string, string>> = {
	'EV-15-02':
		'a clarification dialogue exists only if a clarification exchange occurred; §15.5 nowhere requires that one happen, and DOC-002 §6.2 makes no transition depend on it',
	'EV-15-03': 'supplied documents exist only if the user supplied any',
	'EV-15-06': 'recorded user corrections exist only if the user corrected something',
	'EV-16-04':
		'§16.3 claim 3 asks that stakeholders be "represented proportionally" — proportional to none known is none — and DOC-002 §6.2\'s intent transition matrix names stakeholders in no guard, unlike ambiguities, non-goals and constraints'
};

/** The bullet items of a subsection: `* text;` -> `text`. Trailing `;`/`.` is list punctuation, not content. */
function bulletItems(body: string[]): string[] {
	return body.flatMap((l) => {
		const m = /^\*\s+(.+?)\s*[;.]?\s*$/.exec(l);
		return m?.[1] ? [m[1].trim()] : [];
	});
}

/** Which evidence tier a policy section declares, and the items it lists.
 *
 * ── READ THIS BEFORE CHANGING THE LOOKUP ──────────────────────────────────────────────────────────────────────
 * `subsection` already warns: BY TITLE, never by number. This function is the other half of that warning, and it
 * exists because I made its mirror image. Measuring the corpus by grepping the document for the heading
 * "Required evidence" returns two hits (§15.5, §16.4) — and I reported that as "only 2 of 12 policies declare
 * required evidence". It is not a fact about the corpus. It is a fact about the search string: from §17 onward
 * the heading is plain "Evidence", and ELEVEN of twelve policies carry a list.
 *
 * So the question is asked STRUCTURE-FIRST: enumerate the twelve policy sections, then ask each one which
 * heading it has. A name-first search can only ever tell you where a name is — never where the content is.
 *
 * THE TIER IS THE CORPUS'S OWN WORD, and it selects the field. DOC-004 §3.1 declares BOTH
 * `requiredEvidence: EvidenceRequirement[]` and `optionalEvidence?: EvidenceRequirement[]`; two sections say
 * "Required evidence" and nine say "Evidence". Calling all eleven required would add a word to nine sections
 * that do not use it — the same "no added word" rule `sentenceCase` enforces on criterion text.
 */
function ratifiedEvidence(body: string[]): {
	tier: 'REQUIRED' | 'OPTIONAL' | 'NONE';
	items: string[];
} {
	// `subsection` anchors the title with `$`, so "## 15.5 Required evidence" cannot match 'Evidence' and
	// "## 27.6 Evidence Sufficiency" cannot match it either. The two lookups are genuinely disjoint.
	const required = subsection(body, 'Required evidence');
	if (required) return { tier: 'REQUIRED', items: bulletItems(required) };
	const optional = subsection(body, 'Evidence');
	if (optional) return { tier: 'OPTIONAL', items: bulletItems(optional) };
	return { tier: 'NONE', items: [] };
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

	// ── THE 2026-08-05 CORPUS AMENDMENTS, CHECKED AGAINST THE DOCUMENT ─────────────────────────────────────────
	//
	// Two §0.3 authored clarifications were added to DOC-004 itself, and three repository annotations were changed
	// from AUTHORED to RATIFIED on the strength of them. THAT IS A RATIFICATION CLAIM, and this file's own
	// anti-laundering rule applies to it: a claim that the corpus decided something must be checkable against the
	// corpus, or it is exactly the borrowed authority the rule exists to prevent — with the aggravating factor
	// that here I am both the amender and the claimant.
	describe('the corpus amendments are IN the corpus', () => {
		const DOC_TEXT = readFileSync(DOC, 'utf8');

		it('§30 declared the arrow, and §31/§32 now name its event and command', () => {
			// The gap: §30's alternate transitions carried `ANY ACTIVE -> CANCELLED` while the event list and the
			// command list named neither — an ARROW WITH NO TRIGGER. The amendment adds only the two names that
			// arrow already required.
			/** A top-level `# N.` section's body lines — `sectionLines` handles only policy sections' shape. */
			const section = (n: string): string[] => {
				const start = lines.findIndex((l) => new RegExp(`^# ${n}\\. `).test(l));
				const rest = lines.slice(start + 1);
				const end = rest.findIndex((l) => /^# \d+\./.test(l));
				return end < 0 ? rest : rest.slice(0, end);
			};
			expect(section('30'), 'the arrow this rests on must still be declared').toContain(
				'ANY ACTIVE → CANCELLED'
			);
			// THE FENCED LIST, NOT THE SECTION TEXT — and this correction came from the mutant. The first version
			// asserted `section(n)` CONTAINED the name, and it passed with the name REMOVED FROM THE LIST, because
			// the amendment blockquote below the list also mentions it: the check was satisfied by the commentary
			// ABOUT the declaration rather than by the declaration. A gate that cannot tell a declaration from
			// prose discussing it is reading a label instead of the content — this file's oldest lesson, in the
			// test I wrote to enforce that lesson.
			const fencedList = (n: string): string[] => {
				const body = section(n);
				const open = body.findIndex((l) => l.startsWith('```'));
				const close = body.findIndex((l, i) => i > open && l.startsWith('```'));
				expect(open, `§${n} must have a fenced list to read`).toBeGreaterThanOrEqual(0);
				return body.slice(open + 1, close);
			};
			expect(fencedList('31'), '§31’s EVENT LIST must name the cancellation event').toContain(
				'AssuranceAssessmentCancelled'
			);
			expect(fencedList('32'), '§32’s COMMAND LIST must name the cancellation command').toContain(
				'cancelAssuranceAssessment'
			);
			// Both amendments must be MARKED as authored clarifications, not slipped in as though always present.
			// A silent corpus edit is worse than an unratified annotation: it destroys the reader's ability to tell
			// ratified text from ours.
			// `.join` here on purpose: this one IS a claim about the prose, so it reads the prose. The assertions
			// above are claims about the DECLARATION and read the fenced list. Same section, two different
			// questions, two different readers — which is the distinction the mutant proved was missing.
			expect(section('31').join(' ')).toContain('authored clarification, §0.3 grant');
			expect(section('32').join(' ')).toContain('authored clarification, §0.3 grant');
		});

		it('ControlActionRecommendation is now DEFINED, and defined as §33 demonstrates it', () => {
			// It was referenced four times across the corpus and defined nowhere — which is what blocked
			// REG-F-026 group (d) until §33's worked example was read.
			expect(DOC_TEXT).toContain('type ControlActionRecommendation = ControlAction;');
			expect(DOC_TEXT, 'the definition must be marked as authored').toContain(
				'`ControlActionRecommendation` (authored clarification, §0.3 grant'
			);
			// And it must still AGREE with the worked example it was derived from — if §33 ever changes to show a
			// structure, this definition is wrong and must redden rather than quietly disagree.
			expect(normalize(DOC_TEXT)).toContain(
				normalize('"recommendedControlActions": [\n        "RESHAPE_PWU",\n        "REQUEST_HUMAN_DECISION"\n      ]')
			);
		});
	});

	// ── THE EVIDENCE CENSUS, DERIVED FROM THE DOCUMENT (REG-E-026) ─────────────────────────────────────────────
	//
	// These numbers are load-bearing: 89 authored EvidenceRequirements rest on them, and the LAST count anybody
	// quoted here ("2 of 12") was wrong by a factor of 5.5 because it came from a grep instead of a walk. So the
	// count is DERIVED here, and reddens if the document changes underneath it.
	describe('the ratified evidence sections (REG-E-026)', () => {
		const census = SECTIONS.map(([section, policyId]) => {
			const { tier, items } = ratifiedEvidence(sectionLines(section));
			return { section, policyId, tier, items };
		});

		it('ELEVEN of twelve policies list evidence — and §20 is the one that does not', () => {
			// Stated as the SPLIT rather than as "11", so a section losing its list and another gaining one cannot
			// cancel out into a green.
			expect(
				census.filter((c) => c.tier === 'REQUIRED').map((c) => c.section),
				'only §15.5 and §16.4 use the words "Required evidence"'
			).toEqual(['15', '16']);
			expect(
				census.filter((c) => c.tier === 'OPTIONAL').map((c) => c.section),
				'§17 onward the heading is plain "Evidence" — this is the list a name-first grep cannot see'
			).toEqual(['17', '18', '19', '21', '22', '23', '24', '25', '26']);
			expect(
				census.filter((c) => c.tier === 'NONE').map((c) => c.policyId),
				'POL-CONSTRAINT-PROPAGATION has no evidence subsection at all. Its requirements are honestly [] — ' +
					'and this assertion is what stops "all twelve carry evidence" quietly becoming the pass condition.'
			).toEqual(['pol_constraint_propagation']);
		});

		it('the item counts are the document’s, per policy and in total', () => {
			// Per-policy, so a mis-parse in one section cannot hide inside a correct total.
			expect(Object.fromEntries(census.map((c) => [c.section, c.items.length]))).toEqual({
				'15': 7,
				'16': 6,
				'17': 7,
				'18': 8,
				'19': 9,
				'20': 0,
				'21': 11,
				'22': 7,
				'23': 8,
				'24': 8,
				'25': 9,
				'26': 9
			});
			expect(census.reduce((n, c) => n + c.items.length, 0)).toBe(89);
		});

		// ── THE SEEDED SIDE: 89 authored requirements, checked against the document they claim to transcribe ────
		//
		// `description` is the corpus item verbatim. `id` and `cardinality` follow stated rules. Everything here is
		// mechanically checkable — which is the point: the two fields that are NOT (evidenceType, purpose) are
		// exactly the two this cannot defend, and they are named as authored in every policy's sourceSection.
		describe.each(SECTIONS)('§%s -> %s evidence', (section, policyId) => {
			const { tier, items } = ratifiedEvidence(sectionLines(section));
			const policy = policies.get(policyId);
			const seeded = tier === 'REQUIRED' ? policy?.requiredEvidence : policy?.optionalEvidence;
			const other = tier === 'REQUIRED' ? policy?.optionalEvidence : policy?.requiredEvidence;

			it('lands in the field the corpus heading selects, and the other stays empty', () => {
				expect(seeded ?? [], `§${section} is a "${tier}" section`).toHaveLength(items.length);
				// The one that matters: a §17-§26 list must NOT reach `requiredEvidence`, because that field gates
				// Gate A. Putting 76 unratified-as-required items there would make nine policies unsatisfiable.
				expect(other ?? [], `${policyId} must not populate both evidence fields`).toEqual([]);
			});

			it('every description is the ratified item, verbatim and in document order', () => {
				(seeded ?? []).forEach((r, i) => {
					expect(r.description, `${policyId}/${r.id} is not §${section}'s ratified item ${i + 1}`).toBe(
						sentenceCase(items[i] ?? '')
					);
				});
			});

			it('ids are EV-<section>-<NN> by document order — the stated derivation, not a mint', () => {
				expect((seeded ?? []).map((r) => r.id)).toEqual(
					items.map((_, i) => `EV-${section}-${String(i + 1).padStart(2, '0')}`)
				);
			});

			it('cardinality follows the hedge rule plus the five NAMED contingent items', () => {
				// TWO clauses, and the second one is authored judgement rather than transcription — so it is
				// enumerated here, item by item, where a reviewer can disagree with a specific call instead of
				// with a vibe. EXACTLY_ONE / ONE_PER_SUBJECT / ONE_PER_OBLIGATION are ratified spellings the
				// corpus never applies to any item, and applying one would be invention.
				(seeded ?? []).forEach((r, i) => {
					const hedged = /\bwhere (applicable|relevant)\b/i.test(items[i] ?? '');
					const contingent = Object.hasOwn(CONTINGENT_EVIDENCE, r.id);
					expect(r.cardinality, `${policyId}/${r.id}`).toBe(
						hedged || contingent ? 'ZERO_OR_MORE' : 'AT_LEAST_ONE'
					);
				});
			});

			it('the derived fields are uniform, and the honest empties are empty', () => {
				for (const r of seeded ?? []) {
					// §15.9: "SATISFIED only when ... required evidence is admissible" — a condition of the VERDICT.
					// Nothing gets 'ALL', which is what keeps every assessment able to reach ASSESSING.
					expect(r.requiredForDispositions, `${policyId}/${r.id}`).toBe('SATISFIED_ONLY');
					// Fail-closed: the corpus nowhere states that a requirement may be waived.
					expect(r.mayBeWaived, `${policyId}/${r.id}`).toBe(false);
					// §6.2 states admissibility globally, not per requirement.
					expect(r.admissibilityRules, `${policyId}/${r.id}`).toEqual([]);
					expect(r, `${policyId}/${r.id} must not invent a freshnessRule`).not.toHaveProperty(
						'freshnessRule'
					);
					// AUTHORED, but constrained to the ratified enum and required to say something.
					expect(EvidenceTypeSchema.options, `${policyId}/${r.id}`).toContain(r.evidenceType);
					expect(r.purpose.length, `${policyId}/${r.id} purpose is not a sentence`).toBeGreaterThan(20);
				}
			});
		});

		it('CONTROL: the reader returns real text, not empty strings it then counts', () => {
			// A parser that yields 89 empty strings would satisfy every count above. This is the assertion that
			// makes "89" mean 89 ITEMS rather than 89 successful regex matches.
			const all = census.flatMap((c) => c.items);
			expect(all.every((t) => t.length > 2)).toBe(true);
			expect(all[0], 'the first item of §15.5, verbatim').toBe('originating expression');
			expect(census.find((c) => c.section === '26')?.items.at(-1)).toBe('superseded baseline');
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

	it('every policy grants the control-action floor — the escalate-and-reshape universal minimum', () => {
		// The floor is not just test_adequacy's value; it is the minimum EVERY policy must grant. A policy that can
		// raise a blocking finding must be able to escalate to a human rather than invent a resolution
		// (REQUEST_HUMAN_DECISION — the "escalate rather than invent" minimum) and to take the minimal governed
		// corrective action (RESHAPE_PWU). Two policies once under-declared it — pol_intent_completeness could only
		// GATHER_CONTEXT (it could not escalate at all), pol_architecture_coverage only RESHAPE_PWU — and both were
		// raised to the floor on 2026-07-18 under the sponsor's grant. This pins that none can drop below it again.
		const FLOOR = ['REQUEST_HUMAN_DECISION', 'RESHAPE_PWU']; // the intersection pinned by the test above
		for (const [, policyId] of SECTIONS) {
			const actions = policies.get(policyId)?.permittedControlActions ?? [];
			for (const action of FLOOR) {
				expect(actions, `${policyId} cannot ${action} — below the control-action floor`).toContain(action);
			}
		}
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

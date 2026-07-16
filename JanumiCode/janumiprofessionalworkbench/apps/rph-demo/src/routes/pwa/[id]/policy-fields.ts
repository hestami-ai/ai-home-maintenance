// Reading the Assurance Policy authoring form. Extracted from +page.server.ts so the criteria round-trip is
// directly testable — it was lossy and nothing could see it (policy-round-trip.test.ts).
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';

/**
 * Read the Assurance Policy authoring fields from a form. `criteria` is a textarea, one criterion per line.
 *
 * Each line becomes a RATIFIED DOC-004 §7 `AssessmentCriterion`. This used to mint `{id, statement,
 * mandatory: true}` — a shape no document defines — while its own comment called the result an
 * "AssessmentCriterion". The engine accepted it because `CreateAssurancePolicy.criteria` was
 * `z.array(z.unknown())`: literally anything (docs/_working/AUDIT-placeholder-helpers.md).
 *
 * ⚠️ `prior` EXISTS BECAUSE THIS ROUND-TRIP WAS LOSSY, and my comment here previously claimed it was not.
 * Adversarial review caught it (2026-07-16). The textarea projects only `description` — §7's other seven
 * fields have no control — so editing a policy re-minted every criterion from its line and silently destroyed:
 *
 *   1. `name`: a seeded 'Objective fidelity' became the whole sentence; and
 *   2. `severityIfNotMet`: every criterion reset to BLOCKING, PROMOTING the ADVISORY criteria of all six
 *      additive policies to blocking. That changes what those policies MEAN — assurance-rules maps a BLOCKING
 *      criterion's NOT_MET to REJECTED, while an ADVISORY one does not affect the disposition. Nothing about
 *      editing a policy's wording should make it stricter.
 *
 * Reusing any prior criterion whose `description` is unchanged preserves id, name and severity. Matching on
 * description rather than index also survives reordering.
 *
 * For a genuinely NEW line, `name` and `description` both take it: a one-line surface supplies ONE string and
 * §7 requires both. Duplicating the author's own words invents nothing; splitting them needs a richer surface —
 * deliberately not built here. A new line's `severityIfNotMet: 'BLOCKING'` preserves the old `mandatory: true`
 * default exactly. The other four levels stay unreachable from this textarea — the residual cost of the Boolean
 * this replaces, and the reason a per-criterion severity control is the natural follow-up.
 */
export function readPolicyFields(form: FormData, prior: readonly AssessmentCriterion[] = []) {
	const criteria: AssessmentCriterion[] = String((form.get('criteria') ?? '') as string)
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map((line, i) => {
			const kept = prior.find((c) => c.description === line);
			if (kept) return kept;
			return {
				id: `C-${String(i + 1).padStart(2, '0')}`,
				name: line,
				description: line,
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			};
		});
	return {
		name: String((form.get('name') ?? '') as string).trim(),
		purpose: String((form.get('purpose') ?? '') as string).trim(),
		rationale: String((form.get('rationale') ?? '') as string).trim(),
		evaluatedClaimTypes: String((form.get('evaluatedClaimTypes') ?? '') as string).trim(),
		evaluatorRole: String((form.get('evaluatorRole') ?? '') as string).trim(),
		independenceRequirement: String((form.get('independenceRequirement') ?? '') as string).trim(),
		applicableObjectTypes: String((form.get('applicableObjectTypes') ?? '') as string).trim(),
		permittedControlActions: String((form.get('permittedControlActions') ?? '') as string).trim(),
		criteria
	};
}

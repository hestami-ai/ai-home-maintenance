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
export interface PolicyFormFields {
	readonly name: string;
	readonly purpose: string;
	readonly rationale: string;
	readonly evaluatorRole: string;
	readonly independenceRequirement: string;
	/** `undefined` when the form carried no such key — see `csvList`. NOT the same as an empty list. */
	readonly evaluatedClaimTypes: string[] | undefined;
	readonly applicableObjectTypes: string[] | undefined;
	readonly permittedControlActions: string[] | undefined;
	readonly criteria: AssessmentCriterion[];
}

export function readPolicyFields(
	form: FormData,
	prior: readonly AssessmentCriterion[] = []
): PolicyFormFields {
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
		evaluatorRole: String((form.get('evaluatorRole') ?? '') as string).trim(),
		independenceRequirement: String((form.get('independenceRequirement') ?? '') as string).trim(),
		// The three ratified ARRAYS (DOC-004 §3.1, DOC-007, DOC-002 §17.1: ProfessionalWorkObjectType[],
		// ClaimType[], ControlAction[]). Each was read as a single trimmed string, because both generators
		// dropped the `[]` from any enumRef field and the schema therefore said scalar.
		//
		// ⚠⚠ AND `applicableObjectTypes` IS READ HERE WITH NO CONTROL ANYWHERE THAT POSTS IT — see EG-04's
		// tests in `policy-round-trip.test.ts`. `csvList` therefore distinguishes ABSENT from EMPTY, which is
		// the whole fix: only an absent key means "the author did not touch this", and the kernel already has
		// the limb for it — `reconcileApplicability` early-returns on `undefined` with the comment *"scope
		// untouched by this edit"*. Returning `[]` for a missing key made that limb unreachable and, because
		// `[]` is TRUTHY, slipped past every downstream guard.
		evaluatedClaimTypes: csvList(form.get('evaluatedClaimTypes')),
		applicableObjectTypes: csvList(form.get('applicableObjectTypes')),
		permittedControlActions: csvList(form.get('permittedControlActions')),
		criteria
	};
}

/**
 * Split a comma/newline/semicolon-separated form field into a clean, de-duplicated string[] — or `undefined`
 * when the form carried no such key at all.
 *
 * ⛔ THE `undefined` IS THE LOAD-BEARING PART, AND IT IS NOT DEFENSIVENESS. `FormData.get` returns `null` for a
 * key no control posted and `''` for a control left blank; collapsing both to `[]` erased the difference between
 * "the author cleared this" and "this surface cannot express this at all". The second is the true state of
 * `applicableObjectTypes`, and reporting it as the first is what widened every UI-authored policy's scope.
 */
function csvList(v: FormDataEntryValue | null): string[] | undefined {
	if (v === null) return undefined;
	return [
		...new Set(
			String(v as string)
				.split(SEPARATORS)
				.map((x) => x.trim())
				.filter(Boolean)
		)
	];
}

const SEPARATORS = /[\n,;]/;

/** A ratified-array field the author supplied, or the stated default when the form could not express it. */
export function listOrDefault(v: string[] | undefined, fallback: string): string[] {
	return v && v.length ? v : [fallback];
}

/**
 * The `EditAssurancePolicy` patch for a policy form — ONE guard, in one place.
 *
 * ⛔⛔ IT IS A FUNCTION BECAUSE THE INLINE VERSION HELD TWO SPELLINGS OF ONE RULE, THREE LINES APART:
 * `...(f.applicableObjectTypes ? {…} : {})` beside `...(f.criteria.length ? {…} : {})`, in a single object
 * literal. A bare truthiness test on an ARRAY is never a guard — `[]` is truthy — so the first spelling always
 * patched and the second did not. That is `REG-F-024`'s *"a gate that covers one of two writers is not a gate"*
 * occurring inside one expression.
 *
 * ⚠⚠ AND THE CONSOLIDATION IS NOT WHAT FIXED THE BUG — A MUTANT SAYS SO, AND SAYING SO IS THE POINT.
 * Restoring the bare truthiness test here and re-running the suite leaves it GREEN. Once `csvList` can return
 * `undefined`, the two spellings agree on every value an array field can take: `undefined` is falsy and `[]`
 * is truthy, so both omit the first and patch the second. The defect was `csvList` collapsing ABSENT into
 * EMPTY; this function's value is that the rule is written ONCE rather than eight times, which is a
 * maintenance property and not a behavioural one. Claiming otherwise would be a control that cannot fail.
 *
 * ⚠ THE RULE, STATED ONCE: a field is patched when the FORM CARRIED IT (`!== undefined`), not when its value
 * happens to be non-empty. Emptiness is the author's to express; absence is the surface's admission that it
 * cannot. `criteria` keeps its `.length` guard deliberately — that textarea always posts, so an empty one means
 * "cleared", and whether wiping it should delete every criterion is a separate decision this does not take.
 */
export function policyEditPatch(f: PolicyFormFields): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	if (f.name) patch.name = f.name;
	if (f.purpose) patch.purpose = f.purpose;
	if (f.rationale) patch.rationale = f.rationale;
	if (f.evaluatorRole) patch.evaluatorRole = f.evaluatorRole;
	if (f.independenceRequirement) patch.independenceRequirement = f.independenceRequirement;
	if (f.evaluatedClaimTypes !== undefined) patch.evaluatedClaimTypes = f.evaluatedClaimTypes;
	if (f.applicableObjectTypes !== undefined) patch.applicableObjectTypes = f.applicableObjectTypes;
	if (f.permittedControlActions !== undefined)
		patch.permittedControlActions = f.permittedControlActions;
	if (f.criteria.length) patch.criteria = f.criteria;
	return patch;
}

/** Copy a stored ratified-array field through verbatim, falling back to a single-value array. Never String():
 *  that stringifies an array into 'A,B' and the strictly-typed payload then rejects it. */
function strList(v: unknown, fallback: string): string[] {
	return Array.isArray(v) && v.length ? (v as string[]).map(String) : [fallback];
}

/** Copy a stored array-valued field through BY REFERENCE (never a clone), or an empty array when it is absent
 *  or not an array — the shape every rule-array field of a successor policy is copied with. */
function arrayOrEmpty(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

/**
 * The content-preserving payload for a policy's successor version.
 *
 * ⛔⛔ ITS OWN DOCBLOCK USED TO SAY *"every field of the predecessor copied verbatim"*, AND IT COPIED
 * SEVENTEEN — omitting `applicability` and `remediationRules`. That is not a cosmetic gap.
 * `createAssurancePolicy` derives `applicability ?? { objectTypeConditions: applicableObjectTypes }`, so a
 * successor was scoped by object type ALONE. Every one of the twelve seeded catalog policies carries a
 * `pwuKindConditions` arm, and that arm is currently the ONLY thing protecting them from EG-04's other defect —
 * so pressing "Create & activate version" on one of them silently removed the protection.
 *
 * ⚠ `applicability` IS OMITTED RATHER THAN PASSED AS `undefined` when the predecessor has none, because create
 * DERIVES the rule from `applicableObjectTypes` in that case. An explicit `undefined` and an absent key are the
 * same distinction this whole slice turns on, one layer up.
 */
export function successorPolicyPayload(
	prev: Record<string, unknown>,
	successorId: string,
	newVersion: string
): Record<string, unknown> {
	return {
		policyId: successorId,
		version: newVersion,
		name: String((prev.name ?? 'Policy') as string),
		purpose: String((prev.purpose ?? '') as string),
		rationale: String((prev.rationale ?? '') as string),
		applicableObjectTypes: strList(prev.applicableObjectTypes, 'PROFESSIONAL_WORK_UNIT'),
		...(prev.applicability !== undefined ? { applicability: prev.applicability } : {}),
		evaluatedClaimTypes: strList(prev.evaluatedClaimTypes, 'CORRECTNESS'),
		criteria: arrayOrEmpty(prev.criteria),
		evaluatorRole: String((prev.evaluatorRole ?? 'reviewer') as string),
		independenceRequirement: String((prev.independenceRequirement ?? 'DIFFERENT_AGENT') as string),
		findingDefinitions: arrayOrEmpty(prev.findingDefinitions),
		waiverRules: arrayOrEmpty(prev.waiverRules),
		requiredEvidence: arrayOrEmpty(prev.requiredEvidence),
		optionalEvidence: arrayOrEmpty(prev.optionalEvidence),
		dispositionRules: arrayOrEmpty(prev.dispositionRules),
		escalationRules: arrayOrEmpty(prev.escalationRules),
		remediationRules: arrayOrEmpty(prev.remediationRules),
		permittedControlActions: strList(prev.permittedControlActions, 'ESCALATE')
	};
}

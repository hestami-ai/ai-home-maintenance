// JAN-PROMPT — rendering a work-unit type's template against assembled context.
//
// ⭑ RENDERING HAPPENS AT THE STEP, NOT IN THE TYPE. `DEC-1` (`JPWB-DOC-003:211`): *"Do not create a PWU for
// prompt rendering … Those are execution steps."* The type OWNS the template (`REG-D-058`); an execution step
// renders it. This module is the rendering, and it is deliberately a pure function with no engine, no store
// and no model — so the rule it enforces is testable without staging a run.
//
// ── ⛔ A MISSING PLACEHOLDER REFUSES. SPONSOR RULING, 2026-09-04 ─────────────────────────────────────────────
// The alternative — render the hole and disclose it afterwards — was put to the sponsor and declined. The
// reason is `DEC-4`, whose SCOPE names context assembly in terms: *"a context omission must not silently
// remove a mandatory constraint."* A rendered prompt with a hole in it has already gone to the model by the
// time anything discloses; the disclosure arrives after the harm. Refusing is the only order that works.
import type { PromptTemplate } from '@janumipwb/rph-contracts';

export type RenderOutcome =
	| { readonly rendered: true; readonly text: string }
	| { readonly rendered: false; readonly refusedBecause: string };

/**
 * Every `{marker}` in the text, in order of appearance, deduplicated.
 *
 * ⚠ DERIVED FROM THE TEXT, NOT FROM THE DECLARED LIST. Reading the declared list and checking it against
 * itself is the shape this repository keeps recording as ceremony — it compares one claim to a copy of the
 * same claim and cannot fail.
 */
export function markersIn(templateText: string): string[] {
	const found = new Set<string>();
	for (const m of templateText.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) found.add(m[1]!);
	return [...found];
}

/**
 * Render a template against the supplied context.
 *
 * ⭑ THE CHECK RUNS IN BOTH DIRECTIONS, and each direction catches a different real failure:
 *
 *  - **Declared but not supplied** — the context assembly dropped something the template needs. This is
 *    `DEC-4`'s silent omission, arriving through the front door.
 *  - **Present in the text but not declared** — the template grew a marker nobody declared. Without this the
 *    closed list is decorative: an author adds `{priorFindings}` to the text, nothing supplies it, and the
 *    first direction never fires because it only walks the declared list.
 *
 * A refusal names the markers, because a refusal a reader cannot act on is the silent omission `PER-9`
 * forbids one layer up.
 */
export function renderPromptTemplate(
	template: PromptTemplate,
	context: Readonly<Record<string, string>>
): RenderOutcome {
	if (template.status !== 'ACTIVE')
		return {
			rendered: false,
			refusedBecause: `The template is ${template.status} and only an ACTIVE template is a runnable asset. A DRAFT is authored text, not an instruction anyone approved.`
		};

	const inText = markersIn(template.templateText);
	const declared = new Set(template.declaredPlaceholders);

	const undeclared = inText.filter((m) => !declared.has(m));
	if (undeclared.length > 0)
		return {
			rendered: false,
			refusedBecause: `The template text uses ${undeclared.map((m) => `{${m}}`).join(', ')}, which ${undeclared.length === 1 ? 'is' : 'are'} not in declaredPlaceholders. An undeclared marker is a hole nobody declared: nothing is obliged to supply it, so it would render empty and the prompt would silently lose whatever it was for.`
		};

	const unsupplied = [...declared].filter((m) => context[m] === undefined);
	if (unsupplied.length > 0)
		return {
			rendered: false,
			refusedBecause: `The assembled context supplies no value for ${unsupplied.map((m) => `{${m}}`).join(', ')}. DEC-4 (DOC-003:224-225) governs context assembly and forbids a silent omission; rendering the hole and disclosing it afterwards would disclose AFTER the prompt reached the model, which is the wrong order.`
		};

	// Replace only DECLARED markers. Anything else is unreachable by construction — the undeclared check above
	// already refused it — which is why this cannot quietly interpolate something nobody authorised.
	const text = template.templateText.replace(
		/\{([A-Za-z][A-Za-z0-9_]*)\}/g,
		(_whole, name: string) => context[name]!
	);
	return { rendered: true, text };
}

/**
 * The identity `MODEL_EXCHANGE.promptTemplateFingerprint` finally resolves to.
 *
 * ⭑ `PER-9`: *"A prompt or template fingerprint identifies that record; it never substitutes for it."* Until
 * `REG-D-058` the field fingerprinted a template with no home — an identifier for a thing that did not exist.
 * It now names an owning type and a version, which is a thing a reader can go and look at.
 */
export function promptTemplateFingerprint(pwuTypeId: string, template: PromptTemplate): string {
	return `${pwuTypeId}@v${template.templateVersion}`;
}

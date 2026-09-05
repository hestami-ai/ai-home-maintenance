// JAN-EXECRUN — preparing a MODEL_INVOCATION step: what the model is told, and when we refuse to tell it.
//
// ── ⭑ THERE IS NO BOUNDARY HERE, AND THE CORPUS SAYS SO ─────────────────────────────────────────────────────
// An audit reported that this system *"governs plans and hosts no tool invocation"*, allocating execution to a
// platform layer that does not exist. Searched at HEAD, that is the opposite of what canon says. Guide `:1137`:
// *"An **Execution Step** is temporal machinery: **model/tool invocation**, retrieval, transformation, human
// interaction, wait, branch, parallel group, or assurance invocation."* A step IS the invocation, and
// `StepTypeSchema`'s FIRST member is `MODEL_INVOCATION`. The caller was unbuilt, never forbidden.
//
// ── WHAT THIS MODULE IS, AND WHAT IT REFUSES TO BE ──────────────────────────────────────────────────────────
// A pure function. No engine, no store, no model. It decides what a model would be told and whether it may be
// told anything at all — which is the part worth testing without staging a run.
import type { PromptTemplate } from '@janumipwb/rph-contracts';
import { promptTemplateFingerprint, renderPromptTemplate } from './prompt-render.js';

/** The PWU fields a template may draw on. Structural, so a fixture can drive this without an engine. */
export interface InvocationSubject {
	readonly id: string;
	readonly title?: string;
	readonly description?: string;
	readonly statement?: string;
	readonly purpose?: string;
	readonly expectedOutputs?: readonly string[];
	readonly inputRequirements?: readonly string[];
}

export type InvocationPlan =
	| { readonly ready: true; readonly prompt: string; readonly fingerprint: string }
	| { readonly ready: false; readonly reason: string };

/**
 * Build the context a template will be rendered against, from the work unit's OWN fields.
 *
 * ⚠ THIS DOES NOT REFUSE, AND THAT IS DELIBERATE. A field the work unit cannot supply is simply absent here;
 * `renderPromptTemplate` is the single place that decides whether an absence is fatal. Two components both
 * entitled to refuse is how a refusal ends up reported twice with different words, or — worse — how one of
 * them starts substituting a default to avoid the duplication.
 *
 * ⛔ AND IT SUPPLIES ONLY WHAT THE TEMPLATE DECLARED. Handing over every field the work unit happens to have
 * would let a template quietly grow a dependency nobody declared, which is the drift the closed
 * `declaredPlaceholders` list exists to prevent.
 */
export function assembleStepContext(
	subject: InvocationSubject,
	template: PromptTemplate
): Record<string, string> {
	const available: Record<string, string | undefined> = {
		subject: subject.title ?? subject.statement,
		title: subject.title,
		description: subject.description,
		statement: subject.statement,
		purpose: subject.purpose,
		expectedOutputs: subject.expectedOutputs?.join(', '),
		inputRequirements: subject.inputRequirements?.join(', ')
	};
	const context: Record<string, string> = {};
	for (const name of template.declaredPlaceholders) {
		const value = available[name];
		if (value !== undefined) context[name] = value;
	}
	return context;
}

/**
 * Decide whether this work unit's type can be executed by a model, and with what.
 *
 * ⭑ EVERY REFUSAL NAMES ITS CAUSE, because the alternative is a step that quietly does nothing and a work unit
 * that looks executed. A refusal a reader cannot act on is the silent omission `PER-9` forbids.
 */
export function prepareModelInvocation(
	subject: InvocationSubject,
	pwuTypeId: string,
	template: PromptTemplate | undefined
): InvocationPlan {
	// ⛔ NO DEFAULT PROMPT. A type without a template declares no agent behaviour — TRUE of every type that
	// existed before REG-D-058 — and inventing one would be the seeded-policy-as-projection defect this
	// repository already records: an object written once and never read, standing in for a decision nobody made.
	if (!template)
		return {
			ready: false,
			reason: `The work-unit type ${pwuTypeId} carries no prompt template, so it declares no agent behaviour. Author one on the type before executing this step as a model invocation.`
		};

	const context = assembleStepContext(subject, template);
	const rendered = renderPromptTemplate(template, context);
	if (!rendered.rendered)
		return {
			ready: false,
			reason: `The prompt for ${pwuTypeId} could not be rendered: ${rendered.refusedBecause}`
		};

	return {
		ready: true,
		prompt: rendered.text,
		fingerprint: promptTemplateFingerprint(pwuTypeId, template)
	};
}

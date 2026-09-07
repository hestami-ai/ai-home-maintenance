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
import type {
	ContextSourceRule,
	ContextSpecification,
	PromptTemplate
} from '@janumipwb/rph-contracts';
import { permits, type ContextAssemblyPolicyContent } from './context-assembly.js';
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

/**
 * What this step will put in front of the producer, and what the deployment PERMITS it to.
 *
 * ⭑⭑ REQUIRED, NOT OPTIONAL, AND THAT IS THE POINT OF `CP-04`. The roadmap's predicted red is *"resolve the
 * policy and ignore it"* — three ratified slots in this system already have no reader, and a fourth would be
 * the defect rather than the fix. An OPTIONAL policy parameter is that defect wearing a default: every existing
 * call site keeps compiling and the consultation quietly never happens. Made required, the type-checker names
 * every caller that has not consulted one.
 */
export interface ContextAssembly {
	/** The policy `binding.contextAssemblyPolicyId` resolved to (`resolveContextAssemblyPolicy`). */
	readonly policy: ContextAssemblyPolicyContent;
	/**
	 * Sources this step will assemble BEYOND the rendered instruction.
	 *
	 * ⚠ The instruction itself is not listed here and does not need to be — it is added below, so a caller
	 * cannot forget to declare the one element every invocation carries.
	 */
	readonly alsoAssembles: readonly ContextSourceRule[];
	/** The work-unit TYPE's own context specification, when it declares one. */
	readonly specification?: ContextSpecification;
}

/**
 * The one element every model invocation assembles.
 *
 * ⭑ IT IS CHECKED LIKE ANY OTHER, which is what stops the ceiling being vacuous on the common path. A policy
 * with `permittedSources: []` — the empty list the field's own vocab note calls *"a CLAIM ('this deployment
 * assembles nothing beyond the instruction')"* — must refuse every invocation, and exempting the instruction
 * would make that claim unsayable.
 */
const RENDERED_INSTRUCTION: ContextSourceRule = {
	source: 'RENDERED_INSTRUCTION',
	scope: 'THIS_TRY'
};

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
	template: PromptTemplate | undefined,
	assembly: ContextAssembly
): InvocationPlan {
	// ⛔ NO DEFAULT PROMPT. A type without a template declares no agent behaviour — TRUE of every type that
	// existed before REG-D-058 — and inventing one would be the seeded-policy-as-projection defect this
	// repository already records: an object written once and never read, standing in for a decision nobody made.
	if (!template)
		return {
			ready: false,
			reason: `The work-unit type ${pwuTypeId} carries no prompt template, so it declares no agent behaviour. Author one on the type before executing this step as a model invocation.`
		};

	// ── ⭑⭑ CP-04a — THE CEILING, CONSULTED BEFORE ANYTHING IS BUILT ────────────────────────────────────────
	//
	// `permittedSources` is a PERMISSION, not an obligation — the vocab note reads *"WHICH SOURCE a deployment
	// PERMITS a producer to be given"* — so the rule is a subset check: everything this step will place in
	// front of the producer must be within the permitted set.
	//
	// ⛔ AND IT RUNS BEFORE THE RENDER, on the sponsor's own ordering argument at `prompt-render.ts:8-12`:
	// *"the disclosure arrives after the harm. Refusing is the only order that works."* A prompt built and then
	// refused has already been built out of material the deployment did not permit.
	const assembling: readonly ContextSourceRule[] = [
		RENDERED_INSTRUCTION,
		...assembly.alsoAssembles
	];
	const unpermitted = assembling.filter((r) => !permits(assembly.policy, r.source, r.scope));
	if (unpermitted.length > 0)
		return {
			ready: false,
			reason: `Context assembly policy '${assembly.policy.policyId}' does not permit ${unpermitted
				.map((r) => `${r.source} at ${r.scope}`)
				.join(
					', '
				)}. A RUNTIME_BINDING names this policy (ICP-04) and it declares what a producer may be given; assembling anything else would put material in front of the model under no declared authority. Widen the policy, or stop assembling that source.`
		};

	const context = assembleStepContext(subject, template);

	// ── ⭑ CP-04b — THE FLOOR: DEC-4's SILENT OMISSION, WHERE IT IS ACTUALLY UNWATCHED ──────────────────────
	//
	// `DEC-4`'s SCOPE (`DOC-003:225`) names context assembly in terms: *"a context omission must not silently
	// remove a mandatory constraint."* For DECLARED PLACEHOLDERS that is already enforced, and by REFUSAL
	// rather than disposition — `renderPromptTemplate` below, under the sponsor ruling of 2026-09-04. A second,
	// weaker path for the same rule would be `REG-F-353` and would soften that ruling, so there is none.
	//
	// ⭑ WHAT IS UNWATCHED IS ONE LAYER UP. `PWU_TYPE.contextSpecification.requiredElements` says what the TYPE
	// requires in its context, and until this line NOTHING READ IT. A type may require an element its own
	// template never declares: `assembleStepContext` walks `declaredPlaceholders`, and `renderPromptTemplate`
	// checks declared-vs-supplied and text-vs-declared. Neither ever looks here, so such an element is simply
	// absent — the silent omission, with nothing watching.
	//
	// ── ⛔⛔ AND MISSING IS MISSING. THE EXCUSE PATH THAT STOOD HERE WAS A CATEGORY ERROR ──────────────────
	//
	// SPONSOR, 2026-09-07: *"if it's missing but is required then the only answer is that this will have to
	// fail because those other options are about the 'disposition' of ownership and relevance. But missing is
	// missing."* Correct, and the vocabulary says so in two notes I had read and not joined:
	//
	//   `requiredElements`        — *"What the type declares must be assembled for it. Aligns with the
	//                               template's declaredPlaceholders; the render guard is what holds them
	//                               together."*
	//   `constraintDispositions`  — *"DEC-4: for every mandatory PARENT CONSTRAINT, exactly one fate."*
	//
	// ⛔ TWO AXES, TWO NAMESPACES. `constraintId` names a CONSTRAINT — an obligation flowing from a parent work
	// unit in a decomposition. `requiredElements` names a CONTEXT ELEMENT. The first version of this check
	// matched `constraintId === element` and built an excuse mechanism on a lock-and-key relationship the
	// vocabulary never declares. Correcting the FATE reading afterwards (`REG-F-361`) made a wrong mechanism
	// more precise instead of removing it.
	//
	// ⚠ AND THE SOPHISTICATED READING IS NOT COMPUTABLE EITHER. "Refuse if the omission removes a mandatory
	// constraint" needs to know WHICH constraint depends on WHICH element, and no carrier expresses that.
	// Claiming it would invent a relationship the data does not hold — the defect class this whole series has
	// been removing.
	//
	// ⭑ THE ORIGINAL FINDING STANDS AND IS STRONGER FOR IT. A type may require an element its own template
	// never declares: `assembleStepContext` walks `declaredPlaceholders`, and `renderPromptTemplate` checks
	// declared-vs-supplied and text-vs-declared. Neither ever looks at `requiredElements`, so such an element
	// is simply absent. That gap is now closed by a plain refusal rather than a fabricated excuse.
	const missing = (assembly.specification?.requiredElements ?? []).filter(
		(e) => context[e] === undefined
	);
	if (missing.length > 0)
		return {
			ready: false,
			reason:
				`The work-unit type ${pwuTypeId} requires ${missing.join(', ')} in its assembled context and the ` +
				`context supplies ${missing.length === 1 ? 'it' : 'them'} not. DEC-4 (DOC-003:225) governs context ` +
				`assembly and forbids a silent omission. Supply ${missing.length === 1 ? 'it' : 'them'}, or stop ` +
				`declaring ${missing.length === 1 ? 'it' : 'them'} required — a constraintDisposition cannot excuse ` +
				`this, because it dispositions a mandatory parent CONSTRAINT and not a context ELEMENT.`
		};

	const rendered = renderPromptTemplate(template, context);
	if (!rendered.rendered)
		return {
			ready: false,
			reason: `The prompt for ${pwuTypeId} could not be rendered: ${rendered.refusedBecause}`
		};

	return {
		ready: true,
		prompt: withOutputContract(rendered.text, template.outputContract),
		fingerprint: promptTemplateFingerprint(pwuTypeId, template)
	};
}

/**
 * Append the type's own `outputContract` to its rendered instruction.
 *
 * ⭑⭑ THE HARNESS ALREADY PROMISED THIS AND THE ASSEMBLY DID NOT KEEP IT. `EXECUTION_CONTRACT_PROMPT` — the
 * system prompt every executing model is given — opens: *"You will be given an instruction that states the work
 * and the exact output it requires."* `outputContract` is the field where a professional declares exactly that,
 * and it reached NOTHING: authored through the PWA Designer, stored on the type, and read by no code on any
 * path. The instruction stated the required output only when a template author happened to repeat it inside
 * `templateText`.
 *
 * ⛔ IT GOES IN THE INSTRUCTION, NOT IN THE SYSTEM PROMPT, and `execution-contract.ts` states the rule that
 * decides it: *"The type says WHAT work; the harness says the EXECUTION CONTRACT. Injecting this into the
 * template would silently edit someone else's contract."* That cuts both ways. The harness's prompt is set once
 * per SESSION (`systemPromptOverride`), so putting one type's contract there would carry it across every later
 * work unit the session touches. `templateText` and `outputContract` are both the TYPE's content; joining them
 * is the type stating its whole requirement, not a boundary crossing.
 *
 * ⚠ AND IT IS STILL `RENDERED_INSTRUCTION` AT `THIS_TRY`. `CP-04`'s ceiling is unchanged and no context
 * assembly policy needs widening — the instruction simply says what it was always supposed to say.
 *
 * ⚠ ABSENT MEANS ABSENT. An empty trailer would tell the producer a contract exists and then show it nothing,
 * which is worse than silence.
 */
function withOutputContract(rendered: string, outputContract: string | undefined): string {
	const contract = outputContract?.trim();
	// ⚠ THE CONTRACT FOLLOWS THE WORK. The instruction reads "do this work / and return it in this shape";
	// inverting it makes the producer meet an output shape before it has been told what the work is.
	return contract ? `${rendered}\n\nThe output this work requires:\n${contract}` : rendered;
}

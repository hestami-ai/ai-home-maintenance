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
	PromptTemplate,
	Undertaking
} from '@janumipwb/rph-contracts';
// ⭑ RUNTIME schemas, not types — `R30` parses a projection rather than asserting its shape.
import { ProfessionalWorkUnitSchema, PwuTypeSchema, UndertakingSchema } from '@janumipwb/rph-contracts';
import { permits, type ContextAssemblyPolicyContent } from './context-assembly.js';
import { promptTemplateFingerprint, renderPromptTemplate } from './prompt-render.js';

/**
 * The PWU fields a template may draw on. Structural, so a fixture can drive this without an engine.
 *
 * ⭐⭐ `JAN-ASSERTED` `R29` — `expectedOutputs` AND `inputRequirements` ARE GONE FROM THIS TYPE, and their
 * absence is the remedy rather than a tidy-up (`REG-F-411`).
 *
 * ⛔ THEY WERE DECLARED `readonly string[]` AND THE CONTRACT SAYS OBJECTS. `objects.ts:556` declares
 * `expectedOutputs: z.array(OutputDefinitionSchema)` where `OutputDefinitionSchema = z.record(z.string(),
 * z.unknown())`; `:555` says the same of `inputRequirements`. A cast in the demo route laundered the objects
 * into strings, `.join(', ')` rendered them, and **every executing model and every reviewer was shown
 * `Required outputs: [object Object]`** — while `check-types` stayed green, because the cast existed precisely
 * to stop it.
 *
 * ⭑ AND NO FORMATTER WOULD HAVE HELPED, WHICH IS WHY THE FIELDS LEAVE RATHER THAN CHANGE TYPE. Every
 * production site mints `{ outputId: 'out_<ulid>', kind: 'DOCUMENT' }` — `+page.server.ts:957`,
 * `undertakings/+page.server.ts:233`, `reference-undertaking.ts:449` — and NO form anywhere lets a
 * professional author the field. The best possible rendering is a minted id and a constant the surface
 * invented: not a rendering problem, but a claim the record cannot support. `OutputDefinition`'s fields are
 * additionally unratified (`vocab/m1-object-fields.json:2662`: *"Source TBD"*), so a key-precedence formatter
 * would fabricate.
 *
 * ⭐ THE PROFESSIONAL'S OWN STATEMENT OF THE REQUIRED OUTPUT ALREADY REACHES THE INSTRUCTION BY ANOTHER ROUTE:
 * `PromptTemplate.outputContract`, authored in the PWA Designer and appended by `withOutputContract` below.
 * Nothing a professional wrote is lost by this removal; what is lost is a value nobody wrote.
 *
 * ⚠ A TEMPLATE DECLARING `{expectedOutputs}` NOW **REFUSES**, and that is the ratified behaviour rather than a
 * new one: `JAN-PROMPT` sponsor default #2 (2026-09-04, `REG-D-058`) — *"A missing declared placeholder at
 * render time is a REFUSAL, not a disclosed gap."*
 */
export interface InvocationSubject {
	readonly id: string;
	readonly title?: string;
	readonly description?: string;
	readonly statement?: string;
	readonly purpose?: string;
}

/** ⭐ `REG-F-507` — what a work unit's own record puts in its subject: `resolveInvocationSubject` returns these and no other. */
export type WorkUnitFields = Pick<InvocationSubject, 'id' | 'title' | 'description'>;

/**
 * ⭐⭐ `JAN-ASSERTED` `R30` — BUILD THE SUBJECT BY **PARSING** THE STORED WORK UNIT, NEVER BY ASSERTING IT.
 *
 * ⛔ WHAT THIS REPLACES IS ELEVEN HAND-WRITTEN TYPE ASSERTIONS AT ONE CALL SITE. The demo route read a PWU
 * with a type-blind `getObject`, then asserted each field into the shape it wanted:
 * `String((pwu?.title ?? '') as string)`, `(pwu?.expectedOutputs as string[] | undefined) ?? []`, and so on.
 * Two of those contradicted their contract outright (`REG-F-411`), and `check-types` could not say so —
 * **because the assertions existed precisely to stop it.**
 *
 * ⭑ PRECEDENT, NOT INVENTION. Six production sites in this package already parse a projection before trusting
 * it, and `handlers/abandon-authorization.ts` states the argument: *"It must PARSE as one … guessing at the
 * fields would be the field-name-inference defect this repo has recorded."* `resolveContextAssemblyPolicy`
 * above is the same function one object over, and this deliberately mirrors its signature.
 *
 * ⭐ IT CLOSES THE FORM BY CONSTRUCTION RATHER THAN BY ENUMERATION. One parse covers every field, so a twelfth
 * field added later is checked for free — and a field the schema has never heard of (the `AS-06` class, where
 * an assertion INVENTED `exchangeId`) becomes a named error instead of a silent `undefined`.
 *
 * ⚠ IT CANNOT SPURIOUSLY REFUSE A WELL-FORMED STORE, and that is measured rather than hoped: `handlers/kit.ts`
 * validates every `nextState` against `OBJECT_SCHEMAS[objectType].schema` and rejects with
 * `produced_state_invalid`, so anything the engine persisted already parses. A refusal here means the row was
 * written by something that bypassed the command path, which is exactly when a caller should stop.
 */
export function resolveInvocationSubject(
	find: (objectId: string) => unknown,
	pwuId: string
): WorkUnitFields {
	const raw = find(pwuId);
	if (raw === undefined || raw === null)
		throw new Error(
			`Work unit '${pwuId}' does not resolve, so there is no subject to put in front of a producer. ` +
				'Refusing rather than invoking a model on behalf of a work unit that does not exist.'
		);
	const parsed = ProfessionalWorkUnitSchema.safeParse(raw);
	if (!parsed.success)
		throw new Error(
			`Work unit '${pwuId}' resolved to an object that does not parse as a PROFESSIONAL_WORK_UNIT: ` +
				`${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
		);
	const pwu = parsed.data;
	// ⭑ ONLY THE FIELDS A TEMPLATE MAY DRAW ON, and every one of them is a `z.string()` in the contract. ⛔ A
	// STRUCTURED FIELD MUST NEVER BE ADDED HERE without a ratified rendering — `expectedOutputs` was, rendered
	// with `.join(', ')`, and every producer was shown `[object Object]` (`R29`).
	return { id: pwuId, title: pwu.title, description: pwu.description };
}

/**
 * The facts a work-unit TYPE contributes to an invocation, parsed rather than asserted.
 *
 * ⭐⭐ THE `promptTemplate` ARM IS THE SHARPEST REASON THIS EXISTS. The demo route read it as
 * `pwuType?.promptTemplate as PromptTemplate | undefined` — a whole strict structured object, asserted — and
 * `prompt-render.ts` then does `new Set(template.declaredPlaceholders)`. ⛔ A wrong shape there is a
 * **`TypeError`, not a refusal**: the surface 500s and the record says nothing about why. Parsing turns the
 * same fact into a stated refusal that names the type.
 *
 * ⚠ `undefined` IS RETURNED FOR AN ABSENT TYPE, NOT A THROW, and the asymmetry with the subject above is
 * deliberate: a work unit with no resolvable TYPE is already handled downstream — `prepareModelInvocation`
 * refuses with *"declares no agent behaviour"*, which names the type and is the message a reader wants. A
 * throw here would replace a good refusal with a worse one.
 */
export function resolvePwuTypeFacts(
	find: (objectId: string) => unknown,
	pwuTypeId: string | undefined
): { purpose?: string; promptTemplate?: PromptTemplate; contextSpecification?: ContextSpecification } {
	if (!pwuTypeId) return {};
	const raw = find(pwuTypeId);
	if (raw === undefined || raw === null) return {};
	const parsed = PwuTypeSchema.safeParse(raw);
	if (!parsed.success)
		throw new Error(
			`Work-unit type '${pwuTypeId}' resolved to an object that does not parse as a PWU_TYPE: ` +
				`${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
		);
	const t = parsed.data;
	return {
		purpose: t.purpose,
		...(t.promptTemplate ? { promptTemplate: t.promptTemplate } : {}),
		...(t.contextSpecification ? { contextSpecification: t.contextSpecification } : {})
	};
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L7 — design D61 (`REG-D-151` (1); `REG-F-510`, remedy 2; `REG-F-623`) — WHAT AN UNDERTAKING
 * STATES OF ITS WORK: its intended product and its objective, the contract's own two fields (`objects.ts`, `UNDERTAKING`), which
 * every unit's instruction now states. ⛔ `REG-F-510`: nothing carried them past the Undertaking's page — a unit's subject is its
 * id, title and description, copied from its type — so two Undertakings of one PWA rendered the same instruction for one type,
 * and P6 again's third run's requirements unit, told neither the product's platform nor its brief, wrote a Python
 * specification for a Node.js product (`REG-F-623`).
 */
export type UndertakingStatement = Pick<Undertaking, 'intendedOutputProduct' | 'objective'>;

/** ⭐⭐ Package L7 — D61 — the section's heading line, spelled ONCE, here. */
export const UNDERTAKING_SECTION_HEADING =
	'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:';

/**
 * ⭐⭐ Package L7 — D61 — THE SECTION THAT STATES AN UNDERTAKING: the heading line; `Intended product: ` and the product; `Objective:`
 * and the objective on the lines after it. Each value trimmed. ⚠ ABSENT MEANS ABSENT, as `withOutputContract` holds of a contract:
 * an empty value's line is left out, and with both empty — or no statement at all — there is no section (`undefined`), since a
 * heading over nothing would tell the producer the Undertaking said something and then show it nothing.
 */
export function undertakingSection(statement: UndertakingStatement | undefined): string | undefined {
	const product = statement?.intendedOutputProduct.trim() ?? '';
	const objective = statement?.objective.trim() ?? '';
	if (product === '' && objective === '') return undefined;
	return [
		UNDERTAKING_SECTION_HEADING,
		...(product === '' ? [] : [`Intended product: ${product}`]),
		...(objective === '' ? [] : ['Objective:', objective])
	].join('\n');
}

/**
 * ⭐⭐ Package L7 — D61 — `text`, a blank line, then the Undertaking's section; `text` alone where there is none. ONE COMPOSITION FOR
 * BOTH ITS USES: the engine's, after a type's rendered text and before its output contract (`prepareModelInvocation`); and the
 * route's, after a unit's purpose, where a declared review in the `UNIT_PURPOSE` framing is given that purpose as its instruction.
 */
export function withUndertakingSection(text: string, statement: UndertakingStatement | undefined): string {
	const section = undertakingSection(statement);
	return section === undefined ? text : `${text}\n\n${section}`;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L15 — design D69 (`REG-D-159`; `REG-F-634`; `REG-F-358`) — A UNIT WHOSE ACCEPTED WORK ANOTHER UNIT
 * DEPENDS ON: its title and its id, which name the file in the Undertaking's shared workspace that holds its accepted work product
 * (`acceptedWorkFile`). ⛔ `REG-F-634`: the engine started a unit only once the units it depends on were accepted (D1, D2), and handed
 * it none of their work — a unit's prompt carried only its own fields — so P6 again's seventh run's Technical Design never saw the
 * accepted Requirements Specification, contradicted it on two points it had settled, and was rejected by both its declared reviews.
 */
export interface AcceptedWorkDependency {
	readonly title: string;
	readonly unitId: string;
}

/** ⭐⭐ Package L15 — D69 — the section's first line, spelled ONCE, here: the lead's words, byte for byte. */
export const ACCEPTED_WORK_SECTION_HEADING =
	"This work depends on the accepted work of other units of this Undertaking. Before you begin, read each file below. Each holds one unit's accepted work product, exactly as its reviews judged it. The workbench writes these files; do not change them.";

/** ⭐⭐ Package L15 — D69 — the folder of the Undertaking's shared workspace that holds each accepted unit's file (the lead's). */
const ACCEPTED_WORK_FOLDER = '.jpwb/accepted';

/** ⭐⭐ Package L15 — D69 — the longest a file's slug may be (the lead's). */
const ACCEPTED_WORK_SLUG_MAX = 60;

/**
 * ⭐⭐ Package L15 — D69 — A UNIT'S TITLE AS THE FIRST PART OF ITS FILE'S NAME (the lead's): in lower case, each run of characters other
 * than `a` to `z` and `0` to `9` one hyphen, trimmed of hyphens, at most 60 characters. ⚠ Trimmed again after the cut, so a slug cut at
 * a hyphen does not end in one — the builder's reading of an order D69 does not state, named in package L15's facts.
 */
function acceptedWorkSlug(title: string): string {
	return title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '')
		.slice(0, ACCEPTED_WORK_SLUG_MAX)
		.replace(/-+$/, '');
}

/**
 * ⭐⭐ Package L15 — D69 — WHERE A UNIT'S ACCEPTED WORK PRODUCT IS WRITTEN, relative to the Undertaking's shared workspace (the lead's):
 * `.jpwb/accepted/<slug>--<unit id>.txt`, the unit's id making the name unique. ⭑ ONE SPELLING FOR BOTH ITS USES: the route writes the
 * file there (`Workspace.writeFile`), and the section names it (`acceptedWorkSection`).
 */
export function acceptedWorkFile(title: string, unitId: string): string {
	return `${ACCEPTED_WORK_FOLDER}/${acceptedWorkSlug(title)}--${unitId}.txt`;
}

/**
 * ⭐⭐ Package L15 — D69 — THE SECTION THAT POINTS A UNIT AT THE ACCEPTED WORK IT DEPENDS ON, AND ITS ONE RENDERER: the heading line
 * (`ACCEPTED_WORK_SECTION_HEADING`), then `- <its title>: <its file>` for each unit, in the order given — the order of the unit's
 * recorded dependencies (`dependencyIds`, D1). ⚠ ABSENT MEANS ABSENT, as D61's section holds: with none there is no section
 * (`undefined`), so a unit that depends on no accepted work is given the instruction it was given before, byte for byte.
 */
export function acceptedWorkSection(dependencies: readonly AcceptedWorkDependency[]): string | undefined {
	if (dependencies.length === 0) return undefined;
	return [
		ACCEPTED_WORK_SECTION_HEADING,
		...dependencies.map((d) => `- ${d.title}: ${acceptedWorkFile(d.title, d.unitId)}`)
	].join('\n');
}

/**
 * ⭐⭐ Package L15 — D69 — `text`, a blank line, then the section; `text` alone where there is none. ⚠ LAST in the instruction, after the
 * output contract (the lead's seat): the candidate checks measure the type's text, the Undertaking's statement and the output contract
 * against the 4,000 characters a reviewer is shown of an instruction (`PROMPT-LENGTH`; `USER_INTENT_MAX`), so that part is shown as
 * before, and the section after it as far as it fits.
 */
function withAcceptedWorkSection(text: string, dependencies: readonly AcceptedWorkDependency[]): string {
	const listed = acceptedWorkSection(dependencies);
	return listed === undefined ? text : `${text}\n\n${listed}`;
}

/**
 * ⭐⭐ Package L7 — D61 — THE STATEMENT OF THE UNDERTAKING `undertakingId` NAMES, BY **PARSING** THE STORED OBJECT (`R30`, as
 * `resolveInvocationSubject` reads a work unit), never by asserting it: its two fields, and nothing else. ⛔ Refused when it does
 * not resolve, or does not parse as an UNDERTAKING — anything the engine persisted parses (`handlers/kit.ts`), so a refusal means
 * a row written past the command path, which is exactly when a caller should stop rather than instruct a model without it.
 */
export function resolveUndertakingStatement(
	find: (objectId: string) => unknown,
	undertakingId: string
): UndertakingStatement {
	const raw = find(undertakingId);
	if (raw === undefined || raw === null)
		throw new Error(
			`Undertaking '${undertakingId}' does not resolve, so there is no statement of its intended product and objective ` +
				'to put in front of a producer. Refusing rather than instructing a model without it.'
		);
	const parsed = UndertakingSchema.safeParse(raw);
	if (!parsed.success)
		throw new Error(
			`Undertaking '${undertakingId}' resolved to an object that does not parse as an UNDERTAKING: ` +
				`${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
		);
	return { intendedOutputProduct: parsed.data.intendedOutputProduct, objective: parsed.data.objective };
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
 * THE RENDER MAP: each marker a template may declare, and the value a subject gives it — `undefined` where the
 * subject has none. The one map `assembleStepContext` renders from, and `WORK_UNIT_MARKERS` is read from.
 */
function renderMap(subject: InvocationSubject): Record<string, string | undefined> {
	// ⭐⭐ EVERY VALUE HERE IS A STRING IN ITS OWN CONTRACT, AND THAT IS NOW AN INVARIANT OF THIS MAP RATHER
	// THAN A COINCIDENCE (`JAN-ASSERTED` `R29`, `REG-F-411`). `expectedOutputs` and `inputRequirements` used to
	// sit in this literal rendered with `.join(', ')`; their contracts declare ARRAYS OF OBJECTS, so what a
	// producer actually received was `[object Object]`. ⛔ A structured field does not belong in a map whose
	// values are handed to a professional verbatim — if one is ever wanted here it needs a ratified rendering,
	// not a `.join`.
	return {
		subject: subject.title ?? subject.statement,
		title: subject.title,
		description: subject.description,
		statement: subject.statement,
		purpose: subject.purpose
	};
}

/**
 * ⭐ `REG-F-507` (`REG-D-121` Q18) — A SUBJECT CARRYING EVERY FIELD A WORK UNIT SUPPLIES: its own (`WorkUnitFields`) and its
 * type's purpose, which the route sets beside them when the type has one. `Required` makes a field added to
 * `WorkUnitFields` a field this must carry too, and the annotation refuses one a work unit does not supply.
 */
const SUPPLIED_BY_A_WORK_UNIT: Required<WorkUnitFields> & Required<Pick<InvocationSubject, 'purpose'>> = {
	id: 'id',
	title: 'title',
	description: 'description',
	purpose: 'purpose'
};

/**
 * ⭐ `REG-F-507` — THE MARKERS A WORK UNIT'S PROMPT MAY USE: each marker the render map fills from what a work unit
 * supplies. `{statement}` is in the map and fills from a field no work unit has, so it is not one, and a marker the map
 * does not name is filled by nothing. The help both authors read and the authoring agent's instructions name these,
 * read from here (`rph-authoring`'s `catalog.ts`, `PWU_TYPE_HELP.promptTemplateText`); a marker outside them refuses
 * its step at render (`prompt-render.ts`).
 */
export const WORK_UNIT_MARKERS: readonly string[] = Object.entries(renderMap(SUPPLIED_BY_A_WORK_UNIT))
	.filter(([, value]) => value !== undefined)
	.map(([marker]) => marker);

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
	const available = renderMap(subject);
	const context: Record<string, string> = {};
	for (const name of template.declaredPlaceholders) {
		const value = available[name];
		if (value !== undefined) context[name] = value;
	}
	return context;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L10 — design D65 (`REG-D-154` (2); `REG-F-508`, remedy 1) — THE WORDS THE STEP REFUSES A TYPE WITH NO
 * TEMPLATE IN, SPELLED ONCE: `prepareModelInvocation`'s refusal, and Publish's reason for such a type (`unitPromptRefusal`).
 */
function noPromptTemplateReason(pwuTypeId: string): string {
	return `The work-unit type ${pwuTypeId} carries no prompt template, so it declares no agent behaviour. Author one on the type before executing this step as a model invocation.`;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L10 — design D65 — THE SUBJECT A WORK UNIT OF A TYPE IS GIVEN WHEN ITS STEP RUNS, BUILT FROM THE TYPE.
 * ⚠ APP CODE GIVES EACH VALUE, so none is taken from the code that gives it (D65: the build names each): each is built here exactly as
 * that code builds it, and the agreement is pinned against it (`apps/rph-demo/src/lib/server/execution/begin-execute-unit-prompt.test.ts`):
 *   · `title` — the type's name, which instantiation copies onto the unit (`routes/undertakings/+page.server.ts`: `name ?? typeId`) and
 *     the step reads off it (`resolveInvocationSubject`);
 *   · `description` — the type's purpose, as instantiation copies it (`purpose ?? title`);
 *   · `purpose` — the type's purpose ONLY WHEN IT IS NOT EMPTY, as the route sets it beside the unit's own fields
 *     (`routes/undertakings/[id]/+page.server.ts`: `...(typeFacts.purpose ? { purpose: typeFacts.purpose } : {})`).
 * The unit's id is no marker (`renderMap`), so the type's stands in for it; and a unit proposed by hand carries a title and a
 * description of its own, each a string (`ProfessionalWorkUnitSchema`), so it is supplied the same markers.
 */
export function unitSubjectOfType(
	pwuTypeId: string,
	name: string,
	purpose: string | undefined
): InvocationSubject {
	return { id: pwuTypeId, title: name, description: purpose ?? name, ...(purpose ? { purpose } : {}) };
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L10 — design D65 — WHY A WORK UNIT OF THIS TYPE COULD NOT HAVE ITS PROMPT RENDERED WHEN ITS STEP RUNS, or
 * `undefined` where it could: with no template, the step's own refusal (`noPromptTemplateReason`); else `renderPromptTemplate`'s own words
 * — a DRAFT, or a marker nothing supplies — given the context `assembleStepContext` builds for a unit of the type. The code the step
 * runs, so Publish and the step cannot disagree (the lead's decision). `facts` as `resolvePwuTypeFacts` reads them, as Begin & Execute
 * does. ⚠ The render alone: the step's other refusals (the context assembly policy, the type's required elements) are outside D65.
 */
export function unitPromptRefusal(
	pwuTypeId: string,
	name: string,
	facts: { readonly purpose?: string; readonly promptTemplate?: PromptTemplate }
): string | undefined {
	const template = facts.promptTemplate;
	if (!template) return noPromptTemplateReason(pwuTypeId);
	const outcome = renderPromptTemplate(
		template,
		assembleStepContext(unitSubjectOfType(pwuTypeId, name, facts.purpose), template)
	);
	return outcome.rendered ? undefined : outcome.refusedBecause;
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
	assembly: ContextAssembly,
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package L7 — design D61 (`REG-D-151` (1)) — the Undertaking's statement, which the instruction
	 * states after the type's rendered text and before its output contract. ⛔ REQUIRED, `undefined` where there is none, for
	 * CP-04's reason: an optional one would let a caller skip it by omission, and the type-checker would name no caller.
	 */
	undertaking: UndertakingStatement | undefined,
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package L15 — design D69 (`REG-D-159`) — the units whose accepted work this unit depends on, each its
	 * title and its id, in the order its recorded dependencies name them: the instruction names the file that holds each one's work
	 * LAST, after its output contract (`acceptedWorkSection`). ⛔ REQUIRED, `[]` where there is none, for D61's reason: an optional
	 * list would let a caller skip it by omission — a rebuild a review is shown above all — and the type-checker would name no caller.
	 */
	acceptedWork: readonly AcceptedWorkDependency[]
): InvocationPlan {
	// ⛔ NO DEFAULT PROMPT. A type without a template declares no agent behaviour — TRUE of every type that
	// existed before REG-D-058 — and inventing one would be the seeded-policy-as-projection defect this
	// repository already records: an object written once and never read, standing in for a decision nobody made.
	// ⭐⭐ Package L10 — D65 — in the words Publish gives such a type (`noPromptTemplateReason`), byte for byte as before.
	if (!template) return { ready: false, reason: noPromptTemplateReason(pwuTypeId) };

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
		// ⭐⭐ Package L7 — D61 — the work, what it is part of, then the shape to return: the Undertaking's section after the
		// type's rendered text, and the output contract ~~LAST, as before~~ after it. ⚠ Still the RENDERED_INSTRUCTION at THIS_TRY, as
		// the contract is (the lead's reading, named in D61): ~~`ctx-default`'s THIS_UNDERTAKING, permitted for nothing, concerns
		// material from another work unit, which still crosses nowhere, so no policy needs widening.~~ ⭐ (2026-11-13, package L15, as
		// D61 is amended for D69) D61's section needs nothing at THIS_UNDERTAKING, whose reason is material from another work unit; D69
		// hands such material on, below.
		// ⭐⭐ Package L15 — D69 (`REG-D-159`) — and LAST, after the output contract, the section naming the files that hold the accepted
		// work this unit depends on (`withAcceptedWorkSection`): a step whose instruction carries it declares PRIOR_WORK_PRODUCT at
		// THIS_UNDERTAKING (`run-model-step.ts`), which the seeded `ctx-default` permits (`context-assembly.ts`). With none, the
		// instruction is the one it was before, byte for byte.
		prompt: withAcceptedWorkSection(
			withOutputContract(withUndertakingSection(rendered.text, undertaking), template.outputContract),
			acceptedWork
		),
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

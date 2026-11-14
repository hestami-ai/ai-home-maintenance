// JAN-EXECRUN XR-01 — what a model would be told, and when it is told nothing.
import { describe, expect, it } from 'vitest';
import type { ContextSpecification, PromptTemplate } from '@janumipwb/rph-contracts';
import { ConstraintDispositionSchema, UndertakingSchema } from '@janumipwb/rph-contracts';
import {
	ACCEPTED_WORK_SECTION_HEADING,
	acceptedWorkFile,
	acceptedWorkSection,
	assembleStepContext,
	prepareModelInvocation,
	resolveUndertakingStatement,
	UNDERTAKING_SECTION_HEADING,
	undertakingSection,
	withUndertakingSection,
	type AcceptedWorkDependency,
	type UndertakingStatement
} from './execution-invocation.js';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from './context-assembly.js';
import type { ContextAssemblyPolicyContent } from './context-assembly.js';

const PWU = {
	id: 'pwu_1',
	title: 'Route Assessment',
	description: 'Assess the delivery route',
	purpose: 'Decide whether the route is viable'
};

const ACTIVE: PromptTemplate = {
	// ⭐ `{purpose}` RATHER THAN `{expectedOutputs}` (`JAN-ASSERTED` `R29`, `REG-F-411`). The old fixture
	// declared a placeholder the work unit can no longer supply, so every test leaning on it would
	// now be exercising the REFUSAL path instead of the rendering it means to assert. `purpose` is a
	// `z.string()` in the contract (`objects.ts:855`), so it renders as itself.
	templateText: 'Assess {subject}. Deliver {purpose}.',
	templateVersion: 4,
	declaredPlaceholders: ['subject', 'purpose'],
	status: 'ACTIVE'
};

/** Try 1 under the seeded policy: the rendered instruction and nothing else. */
const ASSEMBLY = { policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY, alsoAssembles: [] } as const;

describe('JAN-EXECRUN — preparing a model invocation', () => {
	it('renders the prompt and resolves the fingerprint to something a reader can look up', () => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, ASSEMBLY, undefined, []);
		expect(plan.ready && plan.prompt).toBe('Assess Route Assessment. Deliver Decide whether the route is viable.');
		// PER-9: a fingerprint "identifies that record; it never substitutes for it". Before REG-D-058 this
		// field named a template with no home.
		expect(plan.ready && plan.fingerprint).toBe('pwut_9@v4');
	});

	it('⛔ REFUSES when the type carries no template — and does NOT substitute a default', () => {
		// ⭑ THE MUTANT THAT MATTERS: fall back to a generic prompt ("Do the work described by {purpose}"). The
		// demo would then appear to execute every work unit, and every one of them would be executed against an
		// instruction nobody authored, reviewed or published. That is the seeded-policy-as-projection defect
		// this repository already records — an object standing in for a decision nobody made.
		const plan = prepareModelInvocation(PWU, 'pwut_9', undefined, ASSEMBLY, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason, 'the refusal must name the type').toMatch(/pwut_9/);
		expect(!plan.ready && plan.reason).toMatch(/declares no agent behaviour/);
	});

	it('⛔ REFUSES a DRAFT template — authoring is not arming', () => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', { ...ACTIVE, status: 'DRAFT' }, ASSEMBLY, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason).toMatch(/DRAFT/);
	});

	it('⛔ REFUSES when the work unit cannot supply a declared placeholder, and says which', () => {
		// THE MUTANT: substitute an empty string for the missing value. The model then receives "Assess . " —
		// grammatical, plausible, and missing the subject, with nothing downstream able to tell that from a
		// subject legitimately named "".
		const needsMore: PromptTemplate = {
			...ACTIVE,
			templateText: 'Assess {subject} against {criteria}.',
			declaredPlaceholders: ['subject', 'criteria']
		};
		const plan = prepareModelInvocation(PWU, 'pwut_9', needsMore, ASSEMBLY, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason, 'the refusal must name the missing marker').toMatch(
			/\{criteria\}/
		);
	});

	it('⛔ the context supplies ONLY what the template declared', () => {
		// THE MUTANT: return every available field regardless of the declared list. A template could then grow
		// `{description}` and render successfully having declared nothing — and the closed list, which is the
		// whole mechanism keeping a prompt's dependencies visible, would be decorative.
		const ctx = assembleStepContext(PWU, ACTIVE);
		expect(Object.keys(ctx).sort()).toEqual(['purpose', 'subject']);
		expect(ctx.description, 'an undeclared field must not be handed over').toBeUndefined();
	});

	it('CONTROL — a declared field the work unit genuinely lacks is absent, not empty', () => {
		// Without this, "supplies only what was declared" could not be told apart from "supplies nothing", and
		// the refusal above would fire for every template rather than for a real gap. An ABSENT key is what lets
		// the render guard distinguish "not supplied" from "supplied as empty".
		const bare = { id: 'pwu_2' };
		const ctx = assembleStepContext(bare, ACTIVE);
		expect(ctx).toEqual({});
		expect('subject' in ctx, 'absent, not present-and-empty').toBe(false);
	});
});

// ── ⭑⭑ JAN-CTXPOL / CP-04 — THE POLICY IS CONSULTED, AND CAN REFUSE ─────────────────────────────────────────
describe('CP-04a — the CEILING: nothing is assembled that the policy does not permit', () => {
	const REPAIR = [
		{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_WORK_UNIT' },
		{ source: 'PRIOR_WORK_PRODUCT', scope: 'THIS_WORK_UNIT' },
		{ source: 'PRIOR_RATIONALE', scope: 'THIS_WORK_UNIT' }
	] as const;

	it('⭑⭑ CONTROL — a repair turn the policy PERMITS runs', () => {
		// ⛔ WITHOUT THIS THE CEILING IS "REFUSE EVERYTHING", which is `D-2`'s first horn and would make every
		// refusal below unfalsifiable. It is also the test that proves the CORRECTED seed: under the seed this
		// slice replaced — `RENDERED_INSTRUCTION` alone — this call REFUSES, and the demo's own repair turn
		// with it.
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
			alsoAssembles: REPAIR
		}, undefined, []);
		expect(plan.ready).toBe(true);
	});

	it('⛔ REFUSES a source the policy does not permit, and NAMES it', () => {
		// THE MUTANT: resolve the policy and never read it — the roadmap's own predicted red, and the exact
		// shape of the three ratified slots this system already has with no reader.
		const instructionOnly: ContextAssemblyPolicyContent = {
			policyId: 'ctx-narrow',
			permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
		};
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			policy: instructionOnly,
			alsoAssembles: REPAIR
		}, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason).toMatch(/ctx-narrow/);
		expect(
			!plan.ready && plan.reason,
			'a refusal a reader cannot act on is itself an omission'
		).toMatch(/PRIOR_REVIEW_FINDING at THIS_WORK_UNIT/);
	});

	it('⛔ an EMPTY policy refuses even the rendered instruction', () => {
		// ⭑ THE VACUITY TEST. `permittedSources`'s vocab note calls an empty list *"a CLAIM ('this deployment
		// assembles nothing beyond the instruction')"*. THE MUTANT: exempt `RENDERED_INSTRUCTION` from the
		// check as "always allowed" — the claim then becomes unsayable and the ceiling never fires on the one
		// path every invocation takes.
		const nothing: ContextAssemblyPolicyContent = { policyId: 'ctx-empty', permittedSources: [] };
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			policy: nothing,
			alsoAssembles: []
		}, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason).toMatch(/RENDERED_INSTRUCTION at THIS_TRY/);
	});

	it('⚠ SCOPE is checked, not only source', () => {
		// THE MUTANT: match on `source` alone. A policy permitting prior findings within THIS_WORK_UNIT would
		// then also permit drawing them from across the whole undertaking — which is the boundary the corrected
		// seed keeps, and the only falsifiable content it has left.
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
			alsoAssembles: [{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_UNDERTAKING' }]
		}, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason).toMatch(/THIS_UNDERTAKING/);
	});

	it('⛔ the ceiling refuses BEFORE the render, so a bad assembly is never built', () => {
		// ⭑ THE ORDERING IS THE SPONSOR'S, at `prompt-render.ts:8-12`: *"the disclosure arrives after the harm.
		// Refusing is the only order that works."* This template ALSO fails to render (`{criteria}` is
		// unsupplied), so the reason it gives says which check ran first. THE MUTANT: consult the policy after
		// rendering — the render refusal wins and the prompt has already been built from unpermitted material.
		const needsMore: PromptTemplate = {
			...ACTIVE,
			templateText: 'Assess {subject} against {criteria}.',
			declaredPlaceholders: ['subject', 'criteria']
		};
		const plan = prepareModelInvocation(PWU, 'pwut_9', needsMore, {
			policy: { policyId: 'ctx-empty', permittedSources: [] },
			alsoAssembles: []
		}, undefined, []);
		expect(!plan.ready && plan.reason, 'the POLICY refusal, not the render refusal').toMatch(
			/does not permit/
		);
		expect(!plan.ready && plan.reason).not.toMatch(/supplies no value/);
	});
});

describe('CP-04b CORRECTED — a required element that is MISSING simply REFUSES', () => {
	// ── ⛔⛔ THE EXCUSE PATH THAT STOOD HERE WAS A CATEGORY ERROR, AND THE SPONSOR CAUGHT IT ────────────────
	//
	// SPONSOR, 2026-09-07: *"if it's missing but is required then the only answer is that this will have to
	// fail because those other options are about the 'disposition' of ownership and relevance. But missing is
	// missing."*
	//
	// The first version let a `constraintDisposition` naming the element excuse its absence, matching
	// `constraintId === element`. Two axes, two namespaces: `constraintId` names a mandatory PARENT CONSTRAINT
	// from a decomposition; `requiredElements` names a CONTEXT ELEMENT whose own vocab note says *"the render
	// guard is what holds them together."* ⚠ Correcting the FATE reading first (`REG-F-361`) made a wrong
	// mechanism more precise instead of removing it. These tests replace the ones that pinned it.
	const requires = (elements: string[]): ContextSpecification => ({
		requiredElements: elements,
		constraintDispositions: []
	});

	it('⛔ REFUSES a required element the assembled context does not carry', () => {
		// ⭑⭑ THE GAP NOTHING ELSE WATCHES, AND IT SURVIVED THE CORRECTION. `assembleStepContext` walks
		// `declaredPlaceholders`; `renderPromptTemplate` checks declared-vs-supplied and text-vs-declared. A type
		// may require an element its own template never declares — as here — and every one of those checks
		// passes while the element is simply absent. THE MUTANT: drop this check; `requiredElements` returns to
		// having no reader at all.
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			...ASSEMBLY,
			specification: requires(['criteria'])
		}, undefined, []);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason).toMatch(/criteria/);
		expect(!plan.ready && plan.reason, 'the rule it enforces, quotable').toMatch(/DEC-4/);
	});

	it('⛔⛔ and NO constraintDisposition excuses it — not even one naming the element', () => {
		// ⭑ THE CORRECTION, PINNED. THE MUTANT is the code this replaced: build an excuse set from
		// `constraintId` and let any disposition naming the element through. Every fate is tried, so the test
		// cannot pass merely because one spelling was overlooked.
		for (const fate of ConstraintDispositionSchema.shape.fate.options) {
			const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
				...ASSEMBLY,
				specification: {
					requiredElements: ['criteria'],
					constraintDispositions: [
						{ constraintId: 'criteria', fate, rationale: 'a thorough-looking rationale' }
					]
				}
			}, undefined, []);
			expect(plan.ready, `fate ${fate} must not excuse a missing required element`).toBe(false);
		}
	});

	it('⚠ and the refusal SAYS why a disposition cannot excuse it', () => {
		// A refusal a reader cannot act on is itself an omission. An author who reached for a disposition needs
		// to be told it is the wrong instrument, not merely that the element is missing.
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			...ASSEMBLY,
			specification: {
				requiredElements: ['criteria'],
				constraintDispositions: [{ constraintId: 'criteria', fate: 'WAIVED_THROUGH_AUTHORITY' }]
			}
		}, undefined, []);
		expect(!plan.ready && plan.reason).toMatch(/CONSTRAINT and not a context ELEMENT/);
	});

	it('⭑ CONTROL — a required element the context DOES supply proceeds', () => {
		// Without this the floor is satisfiable by refusing whenever a specification exists at all, and the
		// refusals above could not be told apart from "refuse everything".
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			...ASSEMBLY,
			specification: requires(['subject'])
		}, undefined, []);
		expect(plan.ready).toBe(true);
	});

	it('⭑ CONTROL — a type declaring NO required elements is unaffected', () => {
		// The path must stay dormant for every type that declares no contextSpecification, which is all of them
		// in the seeded workbench today.
		expect(prepareModelInvocation(PWU, 'pwut_9', ACTIVE, ASSEMBLY, undefined, []).ready).toBe(true);
	});
});

// ── ⭑⭑ JAN-OUTCONTRACT OC-01 — THE INSTRUCTION STATES THE OUTPUT THE TYPE REQUIRES ─────────────────────────
//
// `EXECUTION_CONTRACT_PROMPT` promises every executing model *"an instruction that states the work and the
// exact output it requires"*. `PromptTemplate.outputContract` is where a professional declares exactly that —
// authored through the PWA Designer, stored on the type, and until this slice read by NO code on ANY path.
describe('OC-01 — the type’s outputContract reaches the rendered instruction', () => {
	const WITH_CONTRACT: PromptTemplate = {
		...ACTIVE,
		outputContract: 'A single JSON object: {"finding": string, "basis": string[]}.'
	};

	it('⭑⭑ the contract is APPENDED to the instruction', () => {
		// THE MUTANT: render the template and drop the contract — i.e. today's behaviour. The harness's own
		// promise then goes unkept for every type whose author did not repeat the contract inside templateText.
		const plan = prepareModelInvocation(PWU, 'pwut_9', WITH_CONTRACT, ASSEMBLY, undefined, []);
		expect(plan.ready && plan.prompt).toContain('Assess Route Assessment');
		expect(plan.ready && plan.prompt).toContain('{"finding": string, "basis": string[]}');
	});

	it('⭑ CONTROL — a template with NO contract renders EXACTLY as before, byte for byte', () => {
		// ⛔ WITHOUT THIS, "appends the contract" cannot be told apart from "appends a section always". An empty
		// trailer would announce a contract and then show the producer nothing, which is worse than silence —
		// and it would change every existing prompt fingerprint's rendered text for no reason.
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, ASSEMBLY, undefined, []);
		expect(plan.ready && plan.prompt).toBe('Assess Route Assessment. Deliver Decide whether the route is viable.');
	});

	it('⚠ a whitespace-only contract is treated as ABSENT, not as an empty contract', () => {
		// THE MUTANT: test truthiness on the raw string. The authoring form submits `.trim()`ed input, but a
		// stored value of "   " would otherwise render a header with nothing under it.
		const plan = prepareModelInvocation(
			PWU,
			'pwut_9',
			{ ...ACTIVE, outputContract: '   ' },
			ASSEMBLY,
			undefined, []
		);
		expect(plan.ready && plan.prompt).toBe('Assess Route Assessment. Deliver Decide whether the route is viable.');
	});

	it('⭑ the contract follows the rendered work, never precedes it', () => {
		// The instruction reads as "do this work / and return it in this shape". Inverting the order makes the
		// producer meet the output shape before it has been told what the work is.
		const plan = prepareModelInvocation(PWU, 'pwut_9', WITH_CONTRACT, ASSEMBLY, undefined, []);
		const text = plan.ready ? plan.prompt : '';
		expect(text.indexOf('Assess Route Assessment')).toBeLessThan(text.indexOf('{"finding"'));
	});

	it('⛔ it is STILL a RENDERED_INSTRUCTION at THIS_TRY — CP-04’s ceiling is untouched', () => {
		// ⭑ ASSERTED SO A LATER READER DOES NOT HAVE TO RE-DERIVE IT. Appending the type's own contract does not
		// introduce a context SOURCE; the instruction simply says what it was always supposed to say. THE
		// MUTANT: treat the contract as a separate source — the seeded policy would then need widening for a
		// change that assembles nothing new.
		const instructionOnly: ContextAssemblyPolicyContent = {
			policyId: 'ctx-instruction-only',
			permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
		};
		const plan = prepareModelInvocation(PWU, 'pwut_9', WITH_CONTRACT, {
			policy: instructionOnly,
			alsoAssembles: []
		}, undefined, []);
		expect(plan.ready).toBe(true);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package L7 — design D61 (`REG-D-151` (1); `REG-F-510`, remedy 2; `REG-F-623`) ───────────────────
//
// Every unit's instruction states its Undertaking's intended product and objective: after the type's rendered text and
// before its output contract, which stays last. ⛔ PREDICTED RED, each limb but its controls: at HEAD the instruction carried
// nothing of its Undertaking (`REG-F-510`), so two Undertakings of one PWA rendered the same instruction for one type — and P6
// again's third run's requirements unit, told neither the product's platform nor its brief, specified a Python tool for a
// Node.js product (`REG-F-623`).
describe('⭐⭐ L7 (D61) — every unit’s instruction states its Undertaking’s intended product and objective', () => {
	const WITH_CONTRACT: PromptTemplate = {
		...ACTIVE,
		outputContract: 'A single JSON object: {"finding": string, "basis": string[]}.'
	};
	const WORDFREQ: UndertakingStatement = {
		intendedOutputProduct: 'wordfreq',
		objective: 'Build wordfreq, a Node.js command-line tool.'
	};
	const LINECOUNT: UndertakingStatement = {
		intendedOutputProduct: 'linecount',
		objective: 'Build linecount, a Python command-line tool.'
	};
	const WORK = 'Assess Route Assessment. Deliver Decide whether the route is viable.';
	const promptOf = (statement: UndertakingStatement | undefined, template: PromptTemplate = WITH_CONTRACT): string => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', template, ASSEMBLY, statement, []);
		return plan.ready ? plan.prompt : `REFUSED: ${plan.reason}`;
	};

	it('⛔ REG-F-510’s predicted red — two Undertakings of one PWA, with different objectives, render different instructions for one type', () => {
		expect(promptOf(WORDFREQ), 'two Undertakings, one instruction').not.toBe(promptOf(LINECOUNT));
	});

	it('⛔ the section sits between the work and the contract: its heading, the intended product, then the objective on the lines after its label', () => {
		expect(promptOf(WORDFREQ)).toBe(
			`${WORK}\n\n` +
				'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
				'Intended product: wordfreq\n' +
				'Objective:\n' +
				'Build wordfreq, a Node.js command-line tool.\n\n' +
				'The output this work requires:\n' +
				'A single JSON object: {"finding": string, "basis": string[]}.'
		);
	});

	it('⛔ with no output contract the section ends the instruction, an objective of several lines stated whole and each value trimmed', () => {
		const brief = '  wordfreq prints the N most frequent words.\n- It reads UTF-8 text.\n- Exit 2 on a usage error.\n\n';
		expect(promptOf({ intendedOutputProduct: '  wordfreq \n', objective: brief }, ACTIVE)).toBe(
			`${WORK}\n\n` +
				'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
				'Intended product: wordfreq\n' +
				'Objective:\n' +
				'wordfreq prints the N most frequent words.\n- It reads UTF-8 text.\n- Exit 2 on a usage error.'
		);
	});

	it('⛔ an empty value’s line is left out: no product, the objective alone; no objective, the product alone', () => {
		expect(promptOf({ intendedOutputProduct: ' ', objective: 'Build wordfreq.' }, ACTIVE)).toBe(
			`${WORK}\n\n` +
				'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
				'Objective:\n' +
				'Build wordfreq.'
		);
		expect(promptOf({ intendedOutputProduct: 'wordfreq', objective: '' }, ACTIVE)).toBe(
			`${WORK}\n\n` +
				'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
				'Intended product: wordfreq'
		);
	});

	it('⭑ CONTROL — both values empty, or no statement at all: no section, the instruction exactly as before', () => {
		expect(promptOf({ intendedOutputProduct: '', objective: '  \n' }, ACTIVE)).toBe(WORK);
		expect(promptOf(undefined, ACTIVE)).toBe(WORK);
		expect(promptOf(undefined)).toBe(
			`${WORK}\n\nThe output this work requires:\nA single JSON object: {"finding": string, "basis": string[]}.`
		);
	});

	it('⭑ CONTROL — it is still the RENDERED_INSTRUCTION at THIS_TRY: an instruction-only policy admits it, and no Undertaking source is assembled', () => {
		// The lead's reading (design D61): ~~`ctx-default`'s THIS_UNDERTAKING, permitted for nothing, concerns material from another
		// work unit, which still crosses nowhere.~~ ⭐ (2026-11-13, package L15, as D61 is amended for D69) D61's section needs nothing at
		// THIS_UNDERTAKING, whose reason is material from another work unit; D69 hands such material on (below). THE MUTANT: assemble
		// the statement as a source of its own — this policy refuses it.
		const instructionOnly: ContextAssemblyPolicyContent = {
			policyId: 'ctx-instruction-only',
			permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
		};
		const plan = prepareModelInvocation(PWU, 'pwut_9', WITH_CONTRACT, { policy: instructionOnly, alsoAssembles: [] }, WORDFREQ, []);
		expect(plan.ready, plan.ready ? '' : plan.reason).toBe(true);
	});

	it('⛔ the section is spelled once and exported: its heading, the section, and its composition after a text, which the route uses for a unit’s purpose', () => {
		expect(UNDERTAKING_SECTION_HEADING).toBe(
			'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:'
		);
		const section = `${UNDERTAKING_SECTION_HEADING}\nIntended product: wordfreq\nObjective:\nBuild wordfreq, a Node.js command-line tool.`;
		expect(undertakingSection(WORDFREQ)).toBe(section);
		expect(undertakingSection(undefined)).toBeUndefined();
		expect(undertakingSection({ intendedOutputProduct: ' ', objective: '' })).toBeUndefined();
		expect(withUndertakingSection('Decide whether the route is viable.', WORDFREQ)).toBe(
			`Decide whether the route is viable.\n\n${section}`
		);
		expect(withUndertakingSection('Decide whether the route is viable.', undefined)).toBe('Decide whether the route is viable.');
		expect(promptOf(WORDFREQ), 'the prompt is not the exported section between the work and the contract').toContain(
			`${WORK}\n\n${section}\n\nThe output this work requires:\n`
		);
	});

	it('⛔ R30 — the statement is read by PARSING the stored Undertaking: its two fields; refused when it does not resolve, or does not parse', () => {
		// Composed from `objectEnvelopeShape` field by field (`number-integrity.test.ts`'s way): a fixture that fails to parse
		// for the WRONG reason would make the refusal below pass vacuously, so the CONTROL first.
		const ACTOR = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
		const stored = {
			id: 'und_01ARZ3NDEKTSV4RRFFQ69J8003',
			objectType: 'UNDERTAKING' as const,
			schemaVersion: 1,
			semanticVersion: 1,
			revision: 0,
			lifecycleStatus: 'ACTIVE',
			createdAt: '2026-11-11T00:00:00Z',
			createdBy: ACTOR,
			updatedAt: '2026-11-11T00:00:00Z',
			updatedBy: ACTOR,
			provenance: { originType: 'HUMAN_DECISION', sourceObjectIds: [], sourceEventIds: [] },
			tags: [],
			extensions: [],
			name: 'wordfreq realization',
			description: 'Build wordfreq.',
			pwaId: 'pwa_01ARZ3NDEKTSV4RRFFQ69J8004',
			pwaVersion: '0.1.0',
			instantiationProfile: 'Standard',
			objective: 'Build wordfreq, a Node.js command-line tool.',
			intendedOutputProduct: 'wordfreq',
			status: 'ACTIVE'
		};
		expect(UndertakingSchema.safeParse(stored).success, 'CONTROL: the stored fixture is an UNDERTAKING').toBe(true);
		const find = (id: string): unknown => (id === stored.id ? stored : undefined);
		expect(resolveUndertakingStatement(find, stored.id)).toEqual(WORDFREQ);
		expect(() => resolveUndertakingStatement(find, 'und_missing')).toThrow(/Undertaking 'und_missing' does not resolve/);
		expect(() => resolveUndertakingStatement(() => null, 'und_null')).toThrow(/Undertaking 'und_null' does not resolve/);
		expect(() => resolveUndertakingStatement(() => ({ ...stored, objective: 7 }), stored.id)).toThrow(
			/does not parse as an UNDERTAKING: objective: /
		);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package L15 — design D69 (`REG-D-159`; `REG-F-634`; `REG-F-358`) ──────────────────────────────────────────
//
// A unit whose recorded dependencies hold accepted work is told, LAST in its instruction — after its output contract — which files in
// the Undertaking's shared workspace hold that work, and to read them before it begins. ⛔ PREDICTED RED, each limb but its control: at
// HEAD the instruction named no other unit's work (`REG-F-634`), and P6 again's seventh run's Technical Design never saw the accepted
// Requirements Specification it depended on.
describe('⭐⭐ L15 (D69) — a unit is told which files hold the accepted work it depends on, last in its instruction', () => {
	const WITH_CONTRACT: PromptTemplate = {
		...ACTIVE,
		outputContract: 'A single JSON object: {"finding": string, "basis": string[]}.'
	};
	const WORDFREQ: UndertakingStatement = {
		intendedOutputProduct: 'wordfreq',
		objective: 'Build wordfreq, a Node.js command-line tool.'
	};
	const WORK = 'Assess Route Assessment. Deliver Decide whether the route is viable.';
	const STATED =
		'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
		'Intended product: wordfreq\nObjective:\nBuild wordfreq, a Node.js command-line tool.';
	const CONTRACT = 'The output this work requires:\nA single JSON object: {"finding": string, "basis": string[]}.';
	/** ⭐ D69's first line, the lead's words, BYTE FOR BYTE — restated here, never imported. */
	const HEADING =
		"This work depends on the accepted work of other units of this Undertaking. Before you begin, read each file below. Each holds one unit's accepted work product, exactly as its reviews judged it. The workbench writes these files; do not change them.";
	const SPEC: AcceptedWorkDependency = { title: 'Requirements Specification', unitId: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5XSP' };
	const GLOSSARY: AcceptedWorkDependency = { title: 'Glossary', unitId: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5XGL' };
	const SPEC_LINE = '- Requirements Specification: .jpwb/accepted/requirements-specification--pwu_01ARZ3NDEKTSV4RRFFQ69G5XSP.txt';
	const GLOSSARY_LINE = '- Glossary: .jpwb/accepted/glossary--pwu_01ARZ3NDEKTSV4RRFFQ69G5XGL.txt';
	// ⚠ NO DEFAULTS: an explicit `undefined` would take a default parameter's value, and "no statement" would render WORDFREQ's.
	const promptOf = (
		work: readonly AcceptedWorkDependency[],
		template: PromptTemplate,
		statement: UndertakingStatement | undefined
	): string => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', template, ASSEMBLY, statement, work);
		return plan.ready ? plan.prompt : `REFUSED: ${plan.reason}`;
	};

	it('⛔ REG-F-634’s predicted red — a unit that depends on accepted work is told its file, LAST, after its output contract', () => {
		expect(promptOf([SPEC], WITH_CONTRACT, WORDFREQ)).toBe(`${WORK}\n\n${STATED}\n\n${CONTRACT}\n\n${HEADING}\n${SPEC_LINE}`);
	});

	it('⛔ one line for each unit, in the order given — its recorded dependencies’ order, never sorted', () => {
		expect(promptOf([SPEC, GLOSSARY], WITH_CONTRACT, WORDFREQ)).toBe(`${WORK}\n\n${STATED}\n\n${CONTRACT}\n\n${HEADING}\n${SPEC_LINE}\n${GLOSSARY_LINE}`);
		expect(promptOf([GLOSSARY, SPEC], WITH_CONTRACT, WORDFREQ)).toBe(`${WORK}\n\n${STATED}\n\n${CONTRACT}\n\n${HEADING}\n${GLOSSARY_LINE}\n${SPEC_LINE}`);
	});

	it('⛔ with no output contract and no Undertaking statement, the section still ends the instruction', () => {
		expect(promptOf([SPEC], ACTIVE, undefined)).toBe(`${WORK}\n\n${HEADING}\n${SPEC_LINE}`);
	});

	it('⭑ CONTROL — a unit that depends on no accepted work is given its instruction byte for byte as before', () => {
		expect(promptOf([], WITH_CONTRACT, WORDFREQ)).toBe(`${WORK}\n\n${STATED}\n\n${CONTRACT}`);
		expect(promptOf([], ACTIVE, WORDFREQ)).toBe(`${WORK}\n\n${STATED}`);
		expect(promptOf([], ACTIVE, undefined)).toBe(WORK);
	});

	it('⛔ the file’s name: the title in lower case, each run of other characters one hyphen, trimmed, at most 60 characters, then the unit’s id', () => {
		expect(acceptedWorkFile('Requirements Specification', 'pwu_1')).toBe('.jpwb/accepted/requirements-specification--pwu_1.txt');
		expect(acceptedWorkFile('  Unit Test Suite (v2) — "core"!  ', 'pwu_2')).toBe('.jpwb/accepted/unit-test-suite-v2-core--pwu_2.txt');
		expect(acceptedWorkFile('Résumé Builder', 'pwu_3')).toBe('.jpwb/accepted/r-sum-builder--pwu_3.txt');
		expect(acceptedWorkFile('x'.repeat(61), 'pwu_4')).toBe(`.jpwb/accepted/${'x'.repeat(60)}--pwu_4.txt`);
		// ⚠ The cut at 60 falls on a hyphen here: trimmed after the cut too, so a slug never ends in one (the builder's reading of the
		// order, named in package L15's facts).
		expect(acceptedWorkFile(`${'a'.repeat(59)} b`, 'pwu_5')).toBe(`.jpwb/accepted/${'a'.repeat(59)}--pwu_5.txt`);
		// The unit's id makes the name unique: two units of one title, two files.
		expect(acceptedWorkFile('Glossary', 'pwu_6')).not.toBe(acceptedWorkFile('Glossary', 'pwu_7'));
	});

	it('⛔ the section is spelled once and exported: its heading, and the one renderer the instruction ends with', () => {
		expect(ACCEPTED_WORK_SECTION_HEADING).toBe(HEADING);
		expect(acceptedWorkSection([SPEC, GLOSSARY])).toBe(`${HEADING}\n${SPEC_LINE}\n${GLOSSARY_LINE}`);
		expect(acceptedWorkSection([])).toBeUndefined();
		expect(promptOf([SPEC, GLOSSARY], WITH_CONTRACT, WORDFREQ).endsWith(`${CONTRACT}\n\n${acceptedWorkSection([SPEC, GLOSSARY]) ?? ''}`)).toBe(true);
	});
});

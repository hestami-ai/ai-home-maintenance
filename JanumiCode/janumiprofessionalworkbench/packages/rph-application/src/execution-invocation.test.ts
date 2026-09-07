// JAN-EXECRUN XR-01 — what a model would be told, and when it is told nothing.
import { describe, expect, it } from 'vitest';
import type { ContextSpecification, PromptTemplate } from '@janumipwb/rph-contracts';
import { ConstraintDispositionSchema } from '@janumipwb/rph-contracts';
import { assembleStepContext, prepareModelInvocation } from './execution-invocation.js';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from './context-assembly.js';
import type { ContextAssemblyPolicyContent } from './context-assembly.js';

const PWU = {
	id: 'pwu_1',
	title: 'Route Assessment',
	description: 'Assess the delivery route',
	purpose: 'Decide whether the route is viable',
	expectedOutputs: ['a viability finding'],
	inputRequirements: ['the route plan']
};

const ACTIVE: PromptTemplate = {
	templateText: 'Assess {subject}. Deliver {expectedOutputs}.',
	templateVersion: 4,
	declaredPlaceholders: ['subject', 'expectedOutputs'],
	status: 'ACTIVE'
};

/** Try 1 under the seeded policy: the rendered instruction and nothing else. */
const ASSEMBLY = { policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY, alsoAssembles: [] } as const;

describe('JAN-EXECRUN — preparing a model invocation', () => {
	it('renders the prompt and resolves the fingerprint to something a reader can look up', () => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, ASSEMBLY);
		expect(plan.ready && plan.prompt).toBe('Assess Route Assessment. Deliver a viability finding.');
		// PER-9: a fingerprint "identifies that record; it never substitutes for it". Before REG-D-058 this
		// field named a template with no home.
		expect(plan.ready && plan.fingerprint).toBe('pwut_9@v4');
	});

	it('⛔ REFUSES when the type carries no template — and does NOT substitute a default', () => {
		// ⭑ THE MUTANT THAT MATTERS: fall back to a generic prompt ("Do the work described by {purpose}"). The
		// demo would then appear to execute every work unit, and every one of them would be executed against an
		// instruction nobody authored, reviewed or published. That is the seeded-policy-as-projection defect
		// this repository already records — an object standing in for a decision nobody made.
		const plan = prepareModelInvocation(PWU, 'pwut_9', undefined, ASSEMBLY);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason, 'the refusal must name the type').toMatch(/pwut_9/);
		expect(!plan.ready && plan.reason).toMatch(/declares no agent behaviour/);
	});

	it('⛔ REFUSES a DRAFT template — authoring is not arming', () => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', { ...ACTIVE, status: 'DRAFT' }, ASSEMBLY);
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
		const plan = prepareModelInvocation(PWU, 'pwut_9', needsMore, ASSEMBLY);
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
		expect(Object.keys(ctx).sort()).toEqual(['expectedOutputs', 'subject']);
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
		});
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
		});
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
		});
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
		});
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
		});
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
		});
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
			});
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
		});
		expect(!plan.ready && plan.reason).toMatch(/CONSTRAINT and not a context ELEMENT/);
	});

	it('⭑ CONTROL — a required element the context DOES supply proceeds', () => {
		// Without this the floor is satisfiable by refusing whenever a specification exists at all, and the
		// refusals above could not be told apart from "refuse everything".
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, {
			...ASSEMBLY,
			specification: requires(['subject'])
		});
		expect(plan.ready).toBe(true);
	});

	it('⭑ CONTROL — a type declaring NO required elements is unaffected', () => {
		// The path must stay dormant for every type that declares no contextSpecification, which is all of them
		// in the seeded workbench today.
		expect(prepareModelInvocation(PWU, 'pwut_9', ACTIVE, ASSEMBLY).ready).toBe(true);
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
		const plan = prepareModelInvocation(PWU, 'pwut_9', WITH_CONTRACT, ASSEMBLY);
		expect(plan.ready && plan.prompt).toContain('Assess Route Assessment');
		expect(plan.ready && plan.prompt).toContain('{"finding": string, "basis": string[]}');
	});

	it('⭑ CONTROL — a template with NO contract renders EXACTLY as before, byte for byte', () => {
		// ⛔ WITHOUT THIS, "appends the contract" cannot be told apart from "appends a section always". An empty
		// trailer would announce a contract and then show the producer nothing, which is worse than silence —
		// and it would change every existing prompt fingerprint's rendered text for no reason.
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE, ASSEMBLY);
		expect(plan.ready && plan.prompt).toBe('Assess Route Assessment. Deliver a viability finding.');
	});

	it('⚠ a whitespace-only contract is treated as ABSENT, not as an empty contract', () => {
		// THE MUTANT: test truthiness on the raw string. The authoring form submits `.trim()`ed input, but a
		// stored value of "   " would otherwise render a header with nothing under it.
		const plan = prepareModelInvocation(
			PWU,
			'pwut_9',
			{ ...ACTIVE, outputContract: '   ' },
			ASSEMBLY
		);
		expect(plan.ready && plan.prompt).toBe('Assess Route Assessment. Deliver a viability finding.');
	});

	it('⭑ the contract follows the rendered work, never precedes it', () => {
		// The instruction reads as "do this work / and return it in this shape". Inverting the order makes the
		// producer meet the output shape before it has been told what the work is.
		const plan = prepareModelInvocation(PWU, 'pwut_9', WITH_CONTRACT, ASSEMBLY);
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
		});
		expect(plan.ready).toBe(true);
	});
});

// JAN-EXECRUN XR-01 — what a model would be told, and when it is told nothing.
import { describe, expect, it } from 'vitest';
import type { PromptTemplate } from '@janumipwb/rph-contracts';
import { assembleStepContext, prepareModelInvocation } from './execution-invocation.js';

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

describe('JAN-EXECRUN — preparing a model invocation', () => {
	it('renders the prompt and resolves the fingerprint to something a reader can look up', () => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', ACTIVE);
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
		const plan = prepareModelInvocation(PWU, 'pwut_9', undefined);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason, 'the refusal must name the type').toMatch(/pwut_9/);
		expect(!plan.ready && plan.reason).toMatch(/declares no agent behaviour/);
	});

	it('⛔ REFUSES a DRAFT template — authoring is not arming', () => {
		const plan = prepareModelInvocation(PWU, 'pwut_9', { ...ACTIVE, status: 'DRAFT' });
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
		const plan = prepareModelInvocation(PWU, 'pwut_9', needsMore);
		expect(plan.ready).toBe(false);
		expect(!plan.ready && plan.reason, 'the refusal must name the missing marker').toMatch(/\{criteria\}/);
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

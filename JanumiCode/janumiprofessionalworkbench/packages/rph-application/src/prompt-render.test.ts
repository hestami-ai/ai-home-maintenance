// JAN-PROMPT — the render refusal the sponsor ruled on, and the two directions it has to run in.
import { describe, expect, it } from 'vitest';
import type { PromptTemplate } from '@janumipwb/rph-contracts';
import { markersIn, promptTemplateFingerprint, renderPromptTemplate } from './prompt-render.js';

const ACTIVE: PromptTemplate = {
	templateText: 'Assess {subject} against {criteria}.',
	templateVersion: 3,
	declaredPlaceholders: ['subject', 'criteria'],
	status: 'ACTIVE'
};

const FULL = { subject: 'the graph', criteria: 'the rubric' };

describe('JAN-PROMPT — rendering refuses a hole rather than filling it with nothing', () => {
	it('renders when every declared marker is supplied', () => {
		const r = renderPromptTemplate(ACTIVE, FULL);
		expect(r.rendered && r.text).toBe('Assess the graph against the rubric.');
	});

	it('⛔ REFUSES when the context supplies no value for a declared marker', () => {
		// The sponsor ruled REFUSE over render-and-disclose. The reason is ORDER: a rendered prompt has already
		// reached the model by the time anything discloses, so the disclosure arrives after the harm.
		//
		// THE MUTANT: substitute an empty string for a missing value. The prompt then goes out saying "Assess
		// against the rubric" — grammatical, plausible, and missing the subject. Nothing downstream can tell
		// that from a subject legitimately named "".
		const r = renderPromptTemplate(ACTIVE, { criteria: 'the rubric' });
		expect(r.rendered).toBe(false);
		expect(!r.rendered && r.refusedBecause, 'the refusal must name the marker').toMatch(/\{subject\}/);
		expect(!r.rendered && r.refusedBecause, 'and cite the rule').toMatch(/DEC-4/);
	});

	it('⛔ REFUSES a marker present in the TEXT but absent from the declared list', () => {
		// ⭑ THE SECOND DIRECTION, AND WITHOUT IT THE CLOSED LIST IS DECORATIVE. The first check only walks
		// `declaredPlaceholders`; an author who adds `{priorFindings}` to the text and declares nothing is
		// invisible to it. Nothing is obliged to supply an undeclared marker, so it would render empty and the
		// prompt would silently lose whatever it was for.
		//
		// THE MUTANT: delete this check. The test above still passes, and a template can grow holes for free.
		const drifted: PromptTemplate = {
			...ACTIVE,
			templateText: 'Assess {subject} against {criteria}, noting {priorFindings}.'
		};
		const r = renderPromptTemplate(drifted, { ...FULL, priorFindings: 'none' });
		expect(r.rendered, 'supplying a value must NOT excuse an undeclared marker').toBe(false);
		expect(!r.rendered && r.refusedBecause).toMatch(/\{priorFindings\}/);
		expect(!r.rendered && r.refusedBecause).toMatch(/declaredPlaceholders/);
	});

	it('⛔ REFUSES a DRAFT template — authored text is not an approved instruction', () => {
		// THE MUTANT: render any status. A half-written prompt then reaches a model as though a professional
		// had finished and published it.
		const r = renderPromptTemplate({ ...ACTIVE, status: 'DRAFT' }, FULL);
		expect(r.rendered).toBe(false);
		expect(!r.rendered && r.refusedBecause).toMatch(/DRAFT/);
	});

	it('CONTROL — the guard is about MISSING values, not about empty ones', () => {
		// An empty string is a value someone supplied; `undefined` is an absence. Conflating them would refuse a
		// legitimately empty section — "prior findings: (none)" — and this is what keeps the refusal narrow.
		const r = renderPromptTemplate(ACTIVE, { subject: '', criteria: 'the rubric' });
		expect(r.rendered, 'a supplied empty value is not a missing one').toBe(true);
	});

	it('markers are derived from the TEXT, not read off the declared list', () => {
		// THE MUTANT: return `template.declaredPlaceholders` from `markersIn`. Every check above then compares
		// the declared list to itself and cannot fail — the ceremony shape this repository keeps recording.
		expect(markersIn('a {one} b {two} c {one}').sort()).toEqual(['one', 'two']);
		expect(markersIn('nothing here at all')).toEqual([]);
	});

	it('the fingerprint names an owning type and a version — a thing a reader can go and look at', () => {
		// PER-9: "A prompt or template fingerprint identifies that record; it never substitutes for it." Until
		// REG-D-058 this field fingerprinted a template with no home — an identifier for a thing that did not
		// exist. It now resolves.
		expect(promptTemplateFingerprint('pwut_abc', ACTIVE)).toBe('pwut_abc@v3');
	});
});

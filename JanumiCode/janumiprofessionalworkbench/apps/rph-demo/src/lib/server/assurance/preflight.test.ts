import { describe, expect, it } from 'vitest';
import { assurancePreflight } from './preflight.js';

describe('assurancePreflight — live authoring cannot outrun its mandatory reviewer', () => {
	it('REFUSES a live turn when JPWB_JUDGE_MODEL is absent — the preflight can now say NOT ready', () => {
		const result = assurancePreflight({
			testMode: false,
			assessor: undefined,
			judgeModel: undefined
		});

		// ⚠ THIS ASSERTION EXISTS BECAUSE THE PREFLIGHT USED TO BE UNABLE TO FAIL. `ready` was the literal
		// `true` on every path and the code union had ONE member, so a preflight over the mandatory Reasoning
		// Review could not report that the review could not run. It reported READY while the pinned default was
		// one the installed agy rejects (REG-F-331).
		expect(result.ready).toBe(false);
		expect(result.code).toBe('JUDGE_MODEL_UNCONFIGURED');
		expect(result.guidance).toMatch(/JPWB_JUDGE_MODEL/);
		expect(result.judgeModel).toBeUndefined();
	});

	it('treats whitespace-only live configuration as absent and refuses', () => {
		const r = assurancePreflight({ testMode: false, assessor: undefined, judgeModel: '  ' });
		expect(r.ready).toBe(false);
		expect(r.judgeModel).toBeUndefined();
	});

	it('allows a live turn when the reviewer model is pinned without invoking the reviewer', () => {
		expect(
			assurancePreflight({
				testMode: false,
				assessor: undefined,
				judgeModel: 'gemini-reviewer-v1'
			})
		).toEqual({
			ready: true,
			code: 'READY',
			guidance: '',
			judgeModel: 'gemini-reviewer-v1'
		});
	});

	it('allows test-mode mock assurance without live reviewer configuration', () => {
		expect(
			assurancePreflight({ testMode: true, assessor: undefined, judgeModel: undefined }).ready
		).toBe(true);
	});

	it('REFUSES when test mode explicitly selects the real agy reviewer with no model configured', () => {
		expect(
			assurancePreflight({ testMode: true, assessor: 'agy', judgeModel: undefined }).ready
		).toBe(false);
	});

	it('ignores a production request for the mock assessor just as the registry does', () => {
		// Production still requires the real reviewer, so an unconfigured model refuses rather than silently
		// downgrading to the deterministic mock — which is the selection rule createFloorRegistry enforces.
		const r = assurancePreflight({ testMode: false, assessor: 'mock', judgeModel: undefined });
		expect(r.ready).toBe(false);
		expect(r.code).toBe('JUDGE_MODEL_UNCONFIGURED');
	});
});
